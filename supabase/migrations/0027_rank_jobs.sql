-- ───────────────────────────────────────────────────────────────
-- 순위 수집을 '버튼 트리거(작업 큐)'로 전환. 상시 루프 대신 필요할 때만 수집(프록시 절약).
--  • 앱: 스케줄표에서 "순위 수집" 버튼 → enqueue_rank_job 으로 작업 1건 적재.
--        범위(scope) = 본인(mine) / 특정 담당자(manager) / 전체(all).
--        모드(mode)  = pending(미발견·미수집 탭만) / all(전체 재수집).
--  • 수집기: claim_rank_job 으로 작업 1건 집어 rank_job_targets 로 '수집할 탭'만 받아 수집 →
--           patch_entry_ranks 로 기록 → set_rank_job_progress / finish_rank_job.
--  • realtime: rank_jobs FULL → 앱에서 진행도(3/12·완료) 실시간 표시.
--  • ★ pending 모드 핵심: rankByTab[탭] 이 '숫자(발견)' 인 탭은 빼고, null(미발견)/미수집 탭만 내려준다.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.rank_jobs (
  id                text primary key,
  scope_type        text not null,                 -- 'mine' | 'manager' | 'all'
  manager_id        text,                           -- mine/manager 일 때 대상 담당자 id
  manager_name      text,
  mode              text not null default 'pending',-- 'pending'(미발견만) | 'all'(전체)
  status            text not null default 'queued', -- queued | running | done | error | empty
  requested_by      text,
  requested_by_name text,
  total             int  not null default 0,
  done              int  not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  claimed_at        timestamptz,
  finished_at       timestamptz
);

alter table public.rank_jobs enable row level security;

drop policy if exists "rank_jobs_all_auth" on public.rank_jobs;
create policy "rank_jobs_all_auth" on public.rank_jobs
  for all to authenticated using (true) with check (true);

-- 진행도 UPDATE 가 앱에 실시간 전파되도록 발행 + FULL 식별
-- (재실행 안전: 이미 publication 멤버면 add 를 건너뛴다)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rank_jobs'
  ) then
    alter publication supabase_realtime add table public.rank_jobs;
  end if;
end $$;
alter table public.rank_jobs replica identity full;


-- ── enqueue: 버튼이 호출. 같은 범위+모드의 진행중/대기 작업이 있으면 재사용(중복 수집 방지) ──
create or replace function public.enqueue_rank_job(
  p_scope_type text, p_manager_id text, p_manager_name text,
  p_mode text, p_requested_by text, p_requested_by_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_id text; v_existing text;
begin
  select id into v_existing from public.rank_jobs
   where status in ('queued', 'running')
     and scope_type = p_scope_type
     and coalesce(manager_id, '') = coalesce(p_manager_id, '')
     and mode = p_mode
   order by created_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  v_id := 'rj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);
  insert into public.rank_jobs(id, scope_type, manager_id, manager_name, mode, status, requested_by, requested_by_name)
  values (v_id, p_scope_type, p_manager_id, p_manager_name, coalesce(p_mode, 'pending'), 'queued', p_requested_by, p_requested_by_name);
  return v_id;
end; $$;
grant execute on function public.enqueue_rank_job(text, text, text, text, text, text) to authenticated;


-- ── claim: 수집기가 호출. 대기 작업 1건을 원자적으로 집어 running 으로 ──
create or replace function public.claim_rank_job()
returns setof public.rank_jobs
language plpgsql security definer set search_path = public
as $$
declare v_id text;
begin
  select id into v_id from public.rank_jobs
   where status = 'queued' order by created_at asc
   limit 1 for update skip locked;
  if v_id is null then return; end if;
  update public.rank_jobs set status = 'running', claimed_at = now() where id = v_id;
  return query select * from public.rank_jobs where id = v_id;
end; $$;
grant execute on function public.claim_rank_job() to authenticated;


-- ── targets: 그 작업이 수집할 '일정 + 탭' 목록. ★pending 모드면 이미 잡힌 탭은 제외 ──
create or replace function public.rank_job_targets(p_job_id text)
returns table (id text, keyword text, link text, category text, search_tabs jsonb)
language plpgsql security definer set search_path = public
as $$
declare j public.rank_jobs;
begin
  -- ★ id 한정: returns table(id ...) 때문에 비한정 id 는 OUT 변수와 충돌 → 테이블 별칭으로 한정
  select * into j from public.rank_jobs rj where rj.id = p_job_id;
  if j.id is null then return; end if;

  return query
  with base as (
    select e.id, e.data
      from public.schedule_entries e
     where e.data->>'category' in ('블로그 상위노출', '블로그관리', '카페 상위노출')
       and jsonb_typeof(e.data->'searchTabs') = 'array'
       and jsonb_array_length(e.data->'searchTabs') > 0
       and coalesce(e.data->>'keyword', '') <> ''
       and (j.scope_type = 'all' or e.data->>'managerId' = j.manager_id)
  ),
  withtabs as (
    select b.id, b.data,
      case when j.mode = 'all' then b.data->'searchTabs'
           else (  -- pending: rankByTab[탭] 이 숫자(발견)가 아닌 탭만
             select coalesce(jsonb_agg(t), '[]'::jsonb)
               from jsonb_array_elements_text(b.data->'searchTabs') t
              where jsonb_typeof((b.data->'rankByTab') -> t) is distinct from 'number'
           )
      end as tabs
      from base b
  )
  select w.id, w.data->>'keyword', w.data->>'link', w.data->>'category', w.tabs
    from withtabs w
   where jsonb_array_length(w.tabs) > 0;
end; $$;
grant execute on function public.rank_job_targets(text) to authenticated;


-- ── 진행도/완료 ──
create or replace function public.set_rank_job_progress(p_job_id text, p_total int, p_done int)
returns void language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set total = coalesce(p_total, total), done = coalesce(p_done, done)
   where id = p_job_id;
$$;
grant execute on function public.set_rank_job_progress(text, int, int) to authenticated;

create or replace function public.finish_rank_job(p_job_id text, p_status text, p_error text default null)
returns void language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set status = p_status, error = p_error, finished_at = now()
   where id = p_job_id;
$$;
grant execute on function public.finish_rank_job(text, text, text) to authenticated;

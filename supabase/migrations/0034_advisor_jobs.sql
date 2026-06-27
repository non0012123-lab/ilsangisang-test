-- ───────────────────────────────────────────────────────────────
-- 크리에이터 어드바이저 수집 — '버튼 트리거(작업 큐)' (Goal 3, Step 5)
--  • 앱: 광고주 상세의 "어드바이저 수집" 버튼 → enqueue_advisor_job 으로 작업 1건 적재.
--        광고주(Client) 1곳 = 작업 1건(scope/mode 없음 — 순위와 달리 계정 단위).
--  • 수집기: claim_advisor_job → advisor_job_client 로 '수집할 광고주' 받아
--           광고주 세션으로 creator-advisor.naver.com 긁어 → patch_advisor_insight 로 스냅샷 upsert →
--           set_advisor_job_progress / finish_advisor_job.
--  • 자격증명(ID/PW·쿠키)은 앱/DB 에 두지 않는다 — 세션은 수집기 머신 로컬 상주.
--        세션 없음/만료면 수집기가 status='need_login' 으로 보고(앱이 안내).
--  • realtime: advisor_jobs FULL → 진행도(2/3·완료) 실시간 / advisor_insights FULL → 카드 즉시 반영.
--  • 계약서: spike-rank/ADVISOR-CONTRACT.md
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- ── 작업 큐 (rank_jobs 동형, 단 광고주 단위라 단순) ──
create table if not exists public.advisor_jobs (
  id                text primary key,
  client_id         text not null,                  -- 수집 대상 광고주(clients.id)
  client_name       text,
  period            text not null default '30d',     -- '7d' | '30d' (트렌드 범위)
  status            text not null default 'queued',  -- queued | running | done | empty | error | need_login
  requested_by      text,
  requested_by_name text,
  total             int  not null default 0,
  done              int  not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  claimed_at        timestamptz,
  finished_at       timestamptz
);

alter table public.advisor_jobs enable row level security;
drop policy if exists "advisor_jobs_all_auth" on public.advisor_jobs;
create policy "advisor_jobs_all_auth" on public.advisor_jobs
  for all to authenticated using (true) with check (true);

-- ── 광고주별 인사이트 스냅샷(1광고주 = 1행, 최신본) ──
--    data jsonb = { inflowKeywords[], viewsTrend{}, demographics{} } (계약서 §3)
create table if not exists public.advisor_insights (
  client_id    text primary key,
  data         jsonb not null default '{}'::jsonb,
  collected_at timestamptz,                          -- 수집기가 마지막으로 긁은 시각(신선도 표기)
  updated_at   timestamptz not null default now()
);

alter table public.advisor_insights enable row level security;
drop policy if exists "advisor_insights_all_auth" on public.advisor_insights;
create policy "advisor_insights_all_auth" on public.advisor_insights
  for all to authenticated using (true) with check (true);

-- 진행도/스냅샷 UPDATE 가 앱에 실시간 전파되도록 발행 + FULL 식별(재실행 안전)
do $$
begin
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='advisor_jobs') then
    alter publication supabase_realtime add table public.advisor_jobs;
  end if;
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='advisor_insights') then
    alter publication supabase_realtime add table public.advisor_insights;
  end if;
end $$;
alter table public.advisor_jobs     replica identity full;
alter table public.advisor_insights replica identity full;


-- ── enqueue: 버튼이 호출. 같은 광고주의 진행중/대기 작업이 있으면 재사용(중복 수집 방지) ──
create or replace function public.enqueue_advisor_job(
  p_client_id text, p_client_name text, p_period text,
  p_requested_by text, p_requested_by_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_id text; v_existing text;
begin
  select id into v_existing from public.advisor_jobs
   where status in ('queued', 'running') and client_id = p_client_id
   order by created_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  v_id := 'aj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);
  insert into public.advisor_jobs(id, client_id, client_name, period, status, requested_by, requested_by_name)
  values (v_id, p_client_id, p_client_name, coalesce(p_period, '30d'), 'queued', p_requested_by, p_requested_by_name);
  return v_id;
end; $$;
grant execute on function public.enqueue_advisor_job(text, text, text, text, text) to authenticated;


-- ── claim: 수집기가 호출. 대기 작업 1건을 원자적으로 집어 running 으로 ──
create or replace function public.claim_advisor_job()
returns setof public.advisor_jobs
language plpgsql security definer set search_path = public
as $$
declare v_id text;
begin
  select id into v_id from public.advisor_jobs
   where status = 'queued' order by created_at asc
   limit 1 for update skip locked;
  if v_id is null then return; end if;
  update public.advisor_jobs set status = 'running', claimed_at = now() where id = v_id;
  return query select * from public.advisor_jobs where id = v_id;
end; $$;
grant execute on function public.claim_advisor_job() to authenticated;


-- ── client: 그 작업이 수집할 광고주(세션은 수집기 로컬에서 client_id 로 찾음) ──
create or replace function public.advisor_job_client(p_job_id text)
returns table (client_id text, client_name text, period text)
language plpgsql security definer set search_path = public
as $$
begin
  -- ★ 컬럼 한정: returns table(client_id ...) 와 OUT 변수 충돌 방지(별칭 aj)
  return query
  select aj.client_id, aj.client_name, aj.period
    from public.advisor_jobs aj
   where aj.id = p_job_id;
end; $$;
grant execute on function public.advisor_job_client(text) to authenticated;


-- ── 진행도 ──
create or replace function public.set_advisor_job_progress(p_job_id text, p_total int, p_done int)
returns void language sql security definer set search_path = public
as $$
  update public.advisor_jobs
     set total = coalesce(p_total, total), done = coalesce(p_done, done)
   where id = p_job_id;
$$;
grant execute on function public.set_advisor_job_progress(text, int, int) to authenticated;


-- ── 스냅샷 되써넣기: 최상위 키 병합(준 키만 갱신, 안 준 묶음은 보존 = 부분수집 규약) ──
create or replace function public.patch_advisor_insight(p_client_id text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_data jsonb;
begin
  insert into public.advisor_insights as ai (client_id, data, collected_at, updated_at)
  values (p_client_id, coalesce(p_payload, '{}'::jsonb), now(), now())
  on conflict (client_id) do update
     set data = coalesce(ai.data, '{}'::jsonb) || coalesce(excluded.data, '{}'::jsonb),
         collected_at = now(),
         updated_at = now()
  returning data into v_data;
  return v_data;
end; $$;
grant execute on function public.patch_advisor_insight(text, jsonb) to authenticated;


-- ── 완료/실패 보고 ──
create or replace function public.finish_advisor_job(p_job_id text, p_status text, p_error text default null)
returns void language sql security definer set search_path = public
as $$
  update public.advisor_jobs
     set status = p_status, error = p_error, finished_at = now()
   where id = p_job_id;
$$;
grant execute on function public.finish_advisor_job(text, text, text) to authenticated;

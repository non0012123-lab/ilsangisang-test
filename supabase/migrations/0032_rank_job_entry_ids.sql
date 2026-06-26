-- ───────────────────────────────────────────────────────────────
-- 순위 수집을 '페이지에 보이는 일정'만 대상으로. (전역 범위 → 화면 컨텍스트)
--  • 버튼이 현재 화면의 순위추적 일정 id 목록(entry_ids)을 작업에 실어 보낸다.
--  • rank_job_targets 가 그 id 들만 대상으로 한다 → 일일=그 날짜, 전체=화면 필터 결과.
--  • entry_ids 가 있으면 scope/날짜 무관하게 그 목록이 곧 대상. (없으면 기존 scope 로직)
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0031 다음)
-- ───────────────────────────────────────────────────────────────

alter table public.rank_jobs add column if not exists entry_ids jsonb;

-- enqueue 에 p_entry_ids 추가. entry_ids 가 있으면 dedup 없이 새 작업(매 화면 수집은 별개).
drop function if exists public.enqueue_rank_job(text, text, text, text, text, text);
create or replace function public.enqueue_rank_job(
  p_scope_type text, p_manager_id text, p_manager_name text,
  p_mode text, p_requested_by text, p_requested_by_name text,
  p_entry_ids jsonb default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_id text; v_existing text;
begin
  if p_entry_ids is null then
    select id into v_existing from public.rank_jobs
     where status in ('queued', 'running')
       and scope_type = p_scope_type
       and coalesce(manager_id, '') = coalesce(p_manager_id, '')
       and mode = p_mode
     order by created_at desc limit 1;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_id := 'rj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);
  insert into public.rank_jobs(id, scope_type, manager_id, manager_name, mode, status, requested_by, requested_by_name, entry_ids)
  values (v_id, p_scope_type, p_manager_id, p_manager_name, coalesce(p_mode, 'pending'), 'queued', p_requested_by, p_requested_by_name, p_entry_ids);
  return v_id;
end; $$;
grant execute on function public.enqueue_rank_job(text, text, text, text, text, text, jsonb) to authenticated;

-- rank_job_targets: entry_ids 필터 추가 (반환 구조 동일, drop 후 재생성)
drop function if exists public.rank_job_targets(text);
create or replace function public.rank_job_targets(p_job_id text)
returns table (id text, keyword text, link text, category text, search_tabs jsonb, all_tabs jsonb, post_title text, sub_keywords jsonb)
language plpgsql security definer set search_path = public
as $$
declare j public.rank_jobs;
begin
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
       and (j.entry_ids is null or e.id in (select jsonb_array_elements_text(j.entry_ids)))
  ),
  withtabs as (
    select b.id, b.data,
      case when j.mode = 'all' then b.data->'searchTabs'
           else (
             select coalesce(jsonb_agg(t), '[]'::jsonb)
               from jsonb_array_elements_text(b.data->'searchTabs') t
              where jsonb_typeof((b.data->'rankByTab') -> t) is distinct from 'number'
           )
      end as tabs,
      coalesce(b.data->'subKeywords', '[]'::jsonb) as subs
      from base b
  )
  select w.id, w.data->>'keyword', w.data->>'link', w.data->>'category',
         w.tabs, w.data->'searchTabs', w.data->>'postTitle', w.subs
    from withtabs w
   where jsonb_array_length(w.tabs) > 0 or jsonb_array_length(w.subs) > 0;
end; $$;
grant execute on function public.rank_job_targets(text) to authenticated;

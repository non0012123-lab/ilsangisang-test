-- ───────────────────────────────────────────────────────────────
-- 순위 수집 모드를 3개로 분리: 전체수집 / 미수집 / 미노출.
--  • 기존 'pending'(미발견만) 은 사실 두 경우의 합집합이었다:
--      - 미수집(uncollected): rankByTab 에 그 탭 키 자체가 없음 → 아예 수집 안 돌린 탭
--      - 미노출(unexposed):   rankByTab[탭] 키는 있으나 숫자가 아님(null) → 수집은 했는데 못 찾은 탭
--  • patch_entry_ranks 가 검색 후 못 찾으면 rankByTab[탭]=null(+rankCheckedAt) 을 남기고,
--    검색을 아예 안 한 탭은 키 자체가 없다 → 이 '키 존재 여부' 가 미수집/미노출의 경계.
--  • 메인 탭의 미수집/미노출 분리는 전부 여기(rank_job_targets)에서 끝난다 → 수집기는 받은 탭만 긁으면 됨.
--  • 'pending' 은 구작업(in-flight) 호환을 위해 합집합으로 그대로 유지.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0035 다음)
-- ───────────────────────────────────────────────────────────────

-- rank_job_targets: mode 3-way 분기 (반환 구조는 0032 와 동일)
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
      case
        when j.mode = 'all' then b.data->'searchTabs'
        when j.mode = 'uncollected' then (   -- 미수집: rankByTab 에 탭 키가 아예 없는 탭만
          select coalesce(jsonb_agg(t), '[]'::jsonb)
            from jsonb_array_elements_text(b.data->'searchTabs') t
           where not coalesce((b.data->'rankByTab') ? t, false)
        )
        when j.mode = 'unexposed' then (     -- 미노출: 키는 있으나 숫자가 아닌(null) 탭만
          select coalesce(jsonb_agg(t), '[]'::jsonb)
            from jsonb_array_elements_text(b.data->'searchTabs') t
           where coalesce((b.data->'rankByTab') ? t, false)
             and jsonb_typeof((b.data->'rankByTab') -> t) is distinct from 'number'
        )
        else (                               -- pending(legacy): 미수집 ∪ 미노출 = 숫자 아닌 탭 전부
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

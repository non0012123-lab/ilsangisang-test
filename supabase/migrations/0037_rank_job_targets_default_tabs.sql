-- ───────────────────────────────────────────────────────────────
-- 순위 수집: searchTabs 미저장(과거 항목·AI 등록 등)도 카테고리 기본 탭으로 자동 대체.
--  • 기존 rank_job_targets 는 e.data->'searchTabs' 가 비어있지 않은 배열인 일정만 대상으로 삼아,
--    한 번도 '수정' 저장을 안 한 과거 일정은 영영 수집되지 않았다(편집 두 번 눌러야 하던 원인).
--  • 이제 저장된 searchTabs 가 없으면 카테고리 기본 탭으로 대체(eff_tabs):
--      카페 상위노출 → [cafe] · 블로그관리/블로그 상위노출 → [integrated, blog]
--    → 일정을 손대지 않아도(과거 포함) 즉시 수집 대상이 된다. (앱의 effectiveSearchTabs 와 동일 규칙)
--  • 모드 분기(전체/미수집/미노출)·all_tabs 반환도 eff_tabs 기준으로 통일. 수집기 계약(반환 구조)은 그대로.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0036 다음)
-- ───────────────────────────────────────────────────────────────

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
    select e.id, e.data,
      -- 실제 수집할 탭(eff_tabs): 명시 저장된 searchTabs 가 있으면 그걸, 없으면 카테고리 기본값.
      case
        when jsonb_typeof(e.data->'searchTabs') = 'array' and jsonb_array_length(e.data->'searchTabs') > 0
          then e.data->'searchTabs'
        when e.data->>'category' = '카페 상위노출' then '["cafe"]'::jsonb
        when e.data->>'category' in ('블로그관리', '블로그 상위노출') then '["integrated","blog"]'::jsonb
        else '[]'::jsonb
      end as eff_tabs
      from public.schedule_entries e
     where e.data->>'category' in ('블로그 상위노출', '블로그관리', '카페 상위노출')
       and coalesce(e.data->>'keyword', '') <> ''
       and (j.scope_type = 'all' or e.data->>'managerId' = j.manager_id)
       and (j.entry_ids is null or e.id in (select jsonb_array_elements_text(j.entry_ids)))
  ),
  withtabs as (
    select b.id, b.data, b.eff_tabs,
      case
        when j.mode = 'all' then b.eff_tabs
        when j.mode = 'uncollected' then (   -- 미수집: rankByTab 에 탭 키가 아예 없는 탭만
          select coalesce(jsonb_agg(t), '[]'::jsonb)
            from jsonb_array_elements_text(b.eff_tabs) t
           where not coalesce((b.data->'rankByTab') ? t, false)
        )
        when j.mode = 'unexposed' then (     -- 미노출: 키는 있으나 숫자가 아닌(null) 탭만
          select coalesce(jsonb_agg(t), '[]'::jsonb)
            from jsonb_array_elements_text(b.eff_tabs) t
           where coalesce((b.data->'rankByTab') ? t, false)
             and jsonb_typeof((b.data->'rankByTab') -> t) is distinct from 'number'
        )
        else (                               -- pending(legacy): 미수집 ∪ 미노출 = 숫자 아닌 탭 전부
          select coalesce(jsonb_agg(t), '[]'::jsonb)
            from jsonb_array_elements_text(b.eff_tabs) t
           where jsonb_typeof((b.data->'rankByTab') -> t) is distinct from 'number'
        )
      end as tabs,
      coalesce(b.data->'subKeywords', '[]'::jsonb) as subs
      from base b
     where jsonb_array_length(b.eff_tabs) > 0
  )
  select w.id, w.data->>'keyword', w.data->>'link', w.data->>'category',
         w.tabs, w.eff_tabs, w.data->>'postTitle', w.subs
    from withtabs w
   where jsonb_array_length(w.tabs) > 0 or jsonb_array_length(w.subs) > 0;
end; $$;
grant execute on function public.rank_job_targets(text) to authenticated;

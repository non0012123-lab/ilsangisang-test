-- ───────────────────────────────────────────────────────────────
-- 순위 수집: '메인만' vs '메인+롱테일' 선택 + 항목별 롱테일 발굴 스킵(A안)
--  • 지금까지 "롱테일 발굴"은 독립 스위치가 아니라 mode='all' 에 암묵적으로 묶여 있었다.
--    → 순위보장(월보장)처럼 롱테일이 필요 없는데도 항상 롱테일까지 긁혔다.
--  • 이제 job 단위 플래그 include_longtail 로 명시 제어한다:
--     - false(메인만): 롱테일은 발굴·순위 모두 스킵. 메인 keyword 만 수집.
--     - true(메인+롱테일): 롱테일도 수집. 단 '새 발굴'은 아직 롱테일이 없는 항목에만(A안).
--       이미 롱테일이 있는 항목은 발굴을 건너뛰고(중복 방지) 기존 롱테일 순위만 갱신한다.
--  • 위 규칙을 rank_job_targets 가 항목별로 계산해 내려준다(워커는 값만 보면 됨):
--     - sub_keywords : 순위를 재수집할 기존 롱테일. include_longtail=false 면 [] (=메인만).
--     - expand_longtail(신규 컬럼) : true 면 longtail-expand 로 '새 롱테일 발굴' 수행.
--
--  ── 워커(외부 CDP 수집 프로그램) 계약 ─────────────────────────────
--   워커는 rank_job_targets 각 행에 대해:
--    1) search_tabs 의 탭들에 대해 메인 keyword 순위 수집 → patch_entry_ranks (항상)
--    2) sub_keywords 가 비어있지 않으면 그 롱테일들의 순위 재수집 → patch_entry_subkeywords
--    3) expand_longtail=true 이면 longtail-expand 로 새 롱테일 후보 발굴 후 patch_entry_subkeywords
--       (expand_longtail=false 이고 sub_keywords 가 []면 롱테일 관련 아무것도 안 함 = 메인만)
--   ⇒ '메인만' job 은 sub_keywords=[] · expand_longtail=false 로 내려오므로 워커가 자동으로 메인만 수집.
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다. (0043 다음)
-- ───────────────────────────────────────────────────────────────

alter table public.rank_jobs add column if not exists include_longtail boolean not null default true;

-- enqueue_rank_job: p_include_longtail 추가(기본 true = 기존 동작 유지)
drop function if exists public.enqueue_rank_job(text, text, text, text, text, text, jsonb);
create or replace function public.enqueue_rank_job(
  p_scope_type text, p_manager_id text, p_manager_name text,
  p_mode text, p_requested_by text, p_requested_by_name text,
  p_entry_ids jsonb default null,
  p_include_longtail boolean default true)
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
       and include_longtail = coalesce(p_include_longtail, true)  -- 메인만/메인+롱테일 은 서로 다른 작업
     order by created_at desc limit 1;
    if v_existing is not null then return v_existing; end if;
  end if;

  v_id := 'rj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);
  insert into public.rank_jobs(id, scope_type, manager_id, manager_name, mode, status, requested_by, requested_by_name, entry_ids, include_longtail)
  values (v_id, p_scope_type, p_manager_id, p_manager_name, coalesce(p_mode, 'pending'), 'queued', p_requested_by, p_requested_by_name, p_entry_ids, coalesce(p_include_longtail, true));
  return v_id;
end; $$;
grant execute on function public.enqueue_rank_job(text, text, text, text, text, text, jsonb, boolean) to authenticated;

-- rank_job_targets: expand_longtail 신규 컬럼(맨 끝에 추가 — 기존 워커 위치 파싱 호환) + subs 조건부
drop function if exists public.rank_job_targets(text);
create or replace function public.rank_job_targets(p_job_id text)
returns table (id text, keyword text, link text, category text, search_tabs jsonb, all_tabs jsonb, post_title text, sub_keywords jsonb, expand_longtail boolean)
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
      -- 롱테일 순위 재수집 대상: 메인만(include_longtail=false)이면 []로 내려 워커가 롱테일을 건드리지 않게.
      case when coalesce(j.include_longtail, true)
           then coalesce(b.data->'subKeywords', '[]'::jsonb)
           else '[]'::jsonb end as subs,
      -- 새 롱테일 '발굴' 여부: include_longtail=true 이고 아직 롱테일이 하나도 없을 때만(A안 — 이미 있으면 발굴 스킵).
      (coalesce(j.include_longtail, true)
        and jsonb_array_length(coalesce(b.data->'subKeywords', '[]'::jsonb)) = 0) as expand
      from base b
     where jsonb_array_length(b.eff_tabs) > 0
  )
  select w.id, w.data->>'keyword', w.data->>'link', w.data->>'category',
         w.tabs, w.eff_tabs, w.data->>'postTitle', w.subs, w.expand
    from withtabs w
   where jsonb_array_length(w.tabs) > 0 or jsonb_array_length(w.subs) > 0 or w.expand;
end; $$;
grant execute on function public.rank_job_targets(text) to authenticated;

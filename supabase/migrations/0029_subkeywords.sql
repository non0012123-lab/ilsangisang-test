-- ───────────────────────────────────────────────────────────────
-- 롱테일 서브키워드 발굴/수집 지원 (Goal 2).
--  • 수집기가 "순위 잡힌 롱테일만" subKeywords 에 기입한다(제목 캡처 포함).
--  • rank_job_targets 가 제목·기존 서브키워드도 함께 내려, 수집기가 재수집/발굴을 판단한다.
--  • 메인 키워드 pending 필터(이미 잡힌 탭 제외)는 그대로. 서브키워드가 있으면 메인이 다 잡혔어도 항목을 내려준다.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0028 다음)
-- ───────────────────────────────────────────────────────────────

-- ── 서브키워드 + 제목 patch (수집기 전용). data.subKeywords 통째 교체 + postTitle 선택 갱신 ──
--    subKeywords 는 수집기가 단독 관리(앱은 읽기전용)하므로 통째 교체로 충분.
create or replace function public.patch_entry_subkeywords(p_id text, p_subs jsonb, p_post_title text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_data jsonb;
begin
  select data into v_data from public.schedule_entries where id = p_id for update;
  if v_data is null then return null; end if;

  if p_post_title is not null and p_post_title <> '' then
    v_data := jsonb_set(v_data, '{postTitle}', to_jsonb(p_post_title), true);
  end if;
  v_data := jsonb_set(v_data, '{subKeywords}', coalesce(p_subs, '[]'::jsonb), true);

  update public.schedule_entries set data = v_data, updated_at = now() where id = p_id;
  return v_data;
end; $$;
grant execute on function public.patch_entry_subkeywords(text, jsonb, text) to authenticated;


-- ── rank_job_targets 확장: post_title + sub_keywords 추가 반환 ──
--    (반환 컬럼이 바뀌므로 drop 후 재생성)
drop function if exists public.rank_job_targets(text);
create or replace function public.rank_job_targets(p_job_id text)
returns table (id text, keyword text, link text, category text, search_tabs jsonb, all_tabs jsonb, post_title text, sub_keywords jsonb)
language plpgsql security definer set search_path = public
as $$
declare j public.rank_jobs;
begin
  -- ★ id 한정: returns table(id ...) 와 충돌 방지
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
           else (  -- pending: 메인 rankByTab[탭] 이 숫자(발견)가 아닌 탭만
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
   -- 메인 수집할 탭이 있거나(=pending 잔여), 재수집할 서브키워드가 있으면 내려준다
   where jsonb_array_length(w.tabs) > 0 or jsonb_array_length(w.subs) > 0;
end; $$;
grant execute on function public.rank_job_targets(text) to authenticated;

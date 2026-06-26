-- ───────────────────────────────────────────────────────────────
-- 순위 수집기(외부 로그인 프로그램)가 schedule_entries 의 순위만 안전하게 패치하는 RPC.
--  • 문제: data 는 일정 객체 통짜 jsonb. 수집기가 data 전체를 덮어쓰면 앱의 동시 수정과 충돌(clobber).
--  • 해결: jsonb_set 으로 rankByTab[탭] / rankCheckedAt[탭] / 대표 rank(최고값) 만 부분 패치.
--  • 대표 rank = rankByTab 의 숫자 값들 중 최소(=가장 좋은 순위). 모두 없으면 rank 키 제거.
--  • for update 행잠금으로 RPC 간 경합 직렬화. (앱의 통짜 upsert와의 잔여 경합은 realtime 재동기화로 수렴)
--  • realtime: schedule_entries 는 0017 에서 REPLICA IDENTITY FULL → 패치가 앱 화면에 즉시 반영.
--
-- 호출 예 (수집기):
--   select public.patch_entry_ranks('1718000000000', '{"integrated":7,"blog":3}'::jsonb);
--   -- 통합 7위·블로그 3위 기록 → 대표 rank=3. 못 찾은 탭은 null:  '{"integrated":null}'
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create or replace function public.patch_entry_ranks(p_id text, p_ranks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
  v_tab  text;
  v_val  jsonb;
  v_now  text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_best int;
begin
  -- 대상 일정 잠그고 조회 (없으면 stale id 로 보고 조용히 무시)
  select data into v_data from public.schedule_entries where id = p_id for update;
  if v_data is null then
    return null;
  end if;

  -- 컨테이너 보장 (jsonb_set 은 부모가 없으면 리프를 못 만든다)
  if not (v_data ? 'rankByTab')     then v_data := jsonb_set(v_data, '{rankByTab}',     '{}'::jsonb, true); end if;
  if not (v_data ? 'rankCheckedAt') then v_data := jsonb_set(v_data, '{rankCheckedAt}', '{}'::jsonb, true); end if;

  -- 전달된 탭만 패치 (허용 탭 화이트리스트). 값은 정수 또는 null(=검색했으나 미발견)
  for v_tab, v_val in select key, value from jsonb_each(p_ranks) loop
    if v_tab in ('integrated', 'blog', 'cafe') then
      v_data := jsonb_set(v_data, array['rankByTab', v_tab],     v_val,            true);
      v_data := jsonb_set(v_data, array['rankCheckedAt', v_tab], to_jsonb(v_now),  true);
    end if;
  end loop;

  -- 대표 rank = rankByTab 의 숫자 값 중 최소(min). 숫자 아닌(null 등) 값은 제외.
  select min((value)::int) into v_best
    from jsonb_each_text(v_data->'rankByTab')
   where value ~ '^[0-9]+$';

  if v_best is null then
    v_data := v_data - 'rank';                              -- 잡힌 순위 없음 → 대표 rank 제거
  else
    v_data := jsonb_set(v_data, '{rank}', to_jsonb(v_best), true);
  end if;

  update public.schedule_entries set data = v_data, updated_at = now() where id = p_id;
  return v_data;
end;
$$;

-- 수집기가 인증 사용자(서비스 계정)로 호출할 수 있게 실행 권한 부여.
-- (service_role 키로 호출하면 RLS 우회로 어차피 가능하지만, 일반 인증 경로도 열어둔다)
grant execute on function public.patch_entry_ranks(text, jsonb) to authenticated;


-- ───────────────────────────────────────────────────────────────
-- 수집기 읽기용: 순위를 수집해야 할 '할 일' 목록.
--  • 상위노출/관리 카테고리 + searchTabs 가 비어있지 않고 + 키워드가 있는 일정만.
--  • 한 행 = 한 일정(+ 그 일정이 추적할 탭 배열). 수집기는 탭별로 URL 만들어 수집 후
--    patch_entry_ranks(id, {탭:순위,...}) 로 한 번에 되써넣는다.
--  • (향후) 재수집 주기는 rankCheckedAt 으로 필터 추가 가능 — 지금은 전체 반환.
-- ───────────────────────────────────────────────────────────────
create or replace function public.list_rank_targets()
returns table (id text, keyword text, link text, category text, search_tabs jsonb)
language sql
security definer
set search_path = public
as $$
  select e.id,
         e.data->>'keyword'    as keyword,
         e.data->>'link'       as link,
         e.data->>'category'   as category,
         e.data->'searchTabs'  as search_tabs
    from public.schedule_entries e
   where e.data->>'category' in ('블로그 상위노출', '블로그관리', '카페 상위노출')
     and jsonb_typeof(e.data->'searchTabs') = 'array'
     and jsonb_array_length(e.data->'searchTabs') > 0
     and coalesce(e.data->>'keyword', '') <> '';
$$;

grant execute on function public.list_rank_targets() to authenticated;

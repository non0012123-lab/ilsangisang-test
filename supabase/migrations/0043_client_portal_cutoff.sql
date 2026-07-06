-- ───────────────────────────────────────────────────────────────
-- 클라이언트 포털 노출 시작일(컷오프)
--  • 6월은 내부 테스트로 사용했고, 클라이언트 대시보드는 정식 개시일(2026-07-01)
--    이후 데이터만 광고주에게 보여야 한다. 내부 시스템(직원 화면)은 종전대로 전부 노출.
--  • 컷오프는 클라이언트별로 관리한다: clients.data->>'portalCutoff' (YYYY-MM-DD).
--    미설정이면 기본값 2026-07-01 을 적용(신규 클라이언트는 온보딩 시점에 맞춰 조정).
--  • 적용 대상은 "날짜가 박힌 업무 기록"인 schedule_entries·reports 뿐이다.
--    advisor_insights(매체 인사이트)는 1d/7d/30d 롤링 스냅샷(항상 최신)이라 컷오프를
--    걸면 재수집 전까지 빈 화면이 되므로 제외한다.
--  • 강제 지점은 RLS 로, 프론트만 막으면 AppContext 가 전량 로드하므로 서버에서 차단한다.
--    프론트(ClientPortalPage)에도 동일 컷오프를 걸어 직원 '미리보기'가 실제 클라이언트
--    화면과 일치하도록 한다(직원은 is_staff 로 RLS 를 통과하므로 프론트 필터가 필요).
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다
--    (git push 만으로는 DB 에 반영되지 않음).
-- ───────────────────────────────────────────────────────────────

-- 현재 로그인 클라이언트의 포털 노출 시작일. clients.data->>'portalCutoff' 없으면 기본값.
--  (RLS 재귀 방지를 위해 my_client_id() 와 동일하게 SECURITY DEFINER — clients RLS 우회)
--  ※ 폴백값 '2026-07-01' 은 프론트 DEFAULT_PORTAL_CUTOFF(src/types/index.ts)와 동일하게 유지.
create or replace function public.my_portal_cutoff()
returns text
language sql
security definer stable set search_path = public
as $$
  select coalesce(
    nullif((select data->>'portalCutoff' from public.clients where id = public.my_client_id()), ''),
    '2026-07-01'
  );
$$;

-- schedule_entries: 본인 업체 + 작업 시작일(data.date)이 컷오프 이후인 것만
drop policy if exists "schedule_entries_client_read" on public.schedule_entries;
create policy "schedule_entries_client_read" on public.schedule_entries
  for select to authenticated
  using (
    data->>'clientId' = public.my_client_id()
    and coalesce(data->>'date', '') >= public.my_portal_cutoff()
  );

-- reports: 본인 업체 + 보고 기간 종료일(없으면 발행일)이 컷오프 이후인 것만
--  (periodEnd 기준 — 6월 구간 보고서는 숨기고, 컷오프에 걸치는 구간은 노출)
drop policy if exists "reports_client_read" on public.reports;
create policy "reports_client_read" on public.reports
  for select to authenticated
  using (
    data->>'clientId' = public.my_client_id()
    and coalesce(nullif(data->>'periodEnd', ''), data->>'date', '') >= public.my_portal_cutoff()
  );

-- advisor_insights_client_read(0040) 는 그대로 유지 — 롤링 스냅샷이라 컷오프 미적용.
-- 직원(staff) 정책들(is_staff)도 변경 없음 — 내부 시스템은 6월 포함 전부 노출.

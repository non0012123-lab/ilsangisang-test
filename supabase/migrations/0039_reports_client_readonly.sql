-- ───────────────────────────────────────────────────────────────
-- reports: 클라이언트를 읽기 전용으로 (담당자 검토형 워크플로우 전환)
--  • 기존 0038 에서는 포털이 클라이언트 세션에서 월간 보고서를 자동 생성·저장했기에
--    클라이언트에게 본인 reports 의 insert/update 권한(reports_client_rw)을 줬다.
--  • 이제 보고서 생성·발행은 담당자(직원)가 '클라이언트 관리 → 보고서' 탭에서 검토 후 처리한다.
--    클라이언트는 발행된 보고서를 "읽기"만 하면 되므로 쓰기 권한을 회수한다(최소권한).
--  • client_insights 는 여전히 클라이언트 포털이 로그인 시 생성하므로 rw 유지(건드리지 않음).
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "reports_client_rw" on public.reports;
drop policy if exists "reports_client_read" on public.reports;
create policy "reports_client_read" on public.reports
  for select to authenticated
  using (data->>'clientId' = public.my_client_id());

-- reports_staff_all(직원 전체 CRUD)는 0038 그대로 유지 — 담당자가 보고서를 생성·발행·삭제한다.

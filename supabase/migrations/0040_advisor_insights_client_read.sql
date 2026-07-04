-- ───────────────────────────────────────────────────────────────
-- advisor_insights: 클라이언트가 "본인 것"을 읽을 수 있게 (매체 인사이트 포털 노출)
--  • 0038 에서 advisor_insights 를 직원 전용(advisor_insights_staff_all)으로 잠갔다.
--  • 이제 클라이언트 포털 '매체 인사이트' 탭에서 네이버 블로그(어드바이저) 인사이트를
--    광고주 본인이 열람하므로, 본인(client_id) 스냅샷에 한해 SELECT 를 허용한다.
--  • 수집(enqueue)·advisor_jobs 는 여전히 직원/수집기 전용(건드리지 않음) — 클라이언트는 읽기만.
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "advisor_insights_client_read" on public.advisor_insights;
create policy "advisor_insights_client_read" on public.advisor_insights
  for select to authenticated
  using (client_id = public.my_client_id());

-- advisor_insights_staff_all(직원 전체) · advisor_jobs(직원 전용) 은 0038 그대로 유지.

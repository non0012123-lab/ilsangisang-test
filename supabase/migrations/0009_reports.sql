-- ───────────────────────────────────────────────────────────────
-- 월간 보고서(reports) 영구 저장
--  • 클라이언트 보고 설정(reportStartDay/releaseDay/reportPeriods)에 따라
--    전송일이 지나면 포털에서 자동 생성되는 월간 보고서를 보관한다.
--  • AI 요약을 1회만 생성하도록 캐시 역할도 한다(여러 기기·브라우저 공유).
--  • 다른 업무 데이터와 동일하게 앱 객체를 그대로 jsonb(data)로 저장.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 + 클라이언트 본인 열람)
drop policy if exists "reports_all_auth" on public.reports;
create policy "reports_all_auth" on public.reports
  for all to authenticated using (true) with check (true);

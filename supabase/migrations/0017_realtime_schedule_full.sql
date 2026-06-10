-- ───────────────────────────────────────────────────────────────
-- 스케줄 실시간 — UPDATE/DELETE 전파 보강
--  • 0010_realtime_schedule.sql 은 schedule_entries 를 realtime publication 에
--    추가했지만, REPLICA IDENTITY 가 기본값(PK만)이라 UPDATE/DELETE 이벤트가
--    클라이언트로 전달되지 않았다(INSERT 만 동작).
--  • 그 결과 한 컨텍스트(예: 데스크톱 메인창)에서 순위·링크를 바꾸거나 일정을
--    삭제해도, 다른 컨텍스트(트레이 AI 위젯·다른 기기·다른 탭)는 새로고침 전까지
--    옛 상태를 그대로 들고 있었다 → 어시스턴트가 "삭제했는데 아직 있다"고 답하거나
--    일일 스케줄에 변경이 늦게 반영되는 문제.
--  • requests(0012)·internal_events(0014)·sales_entries(0016) 와 동일한 이유·조치.
-- 대시보드 → SQL Editor 에 붙여 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- ★ UPDATE/DELETE 이벤트 전달에 필수.
--  • RLS 가 켜진 테이블에서 realtime 이 UPDATE/DELETE 를 보내려면 이전 행(old) 전체가
--    필요한데, 기본 REPLICA IDENTITY 는 PK 만 담아 이벤트가 누락된다(INSERT 는 영향 없음).
alter table public.schedule_entries replica identity full;

-- (혹시 publication 에 아직 없다면 함께 추가 — 이미 있으면 "already member" 에러는 무시)
-- alter publication supabase_realtime add table public.schedule_entries;

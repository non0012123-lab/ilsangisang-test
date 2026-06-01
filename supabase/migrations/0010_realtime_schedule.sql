-- ───────────────────────────────────────────────────────────────
-- 스케줄 실시간 알림
--  • schedule_entries 의 INSERT 를 Supabase Realtime 으로 발행해,
--    다른 사람(또는 다른 기기)이 내 담당 스케줄을 등록하면 새로고침 없이
--    우측 상단 종 알림 + (다른 탭일 때) 데스크톱 알림이 뜨도록 한다.
--  • RLS 는 기존 정책을 그대로 사용한다(인증 사용자 조회 허용).
-- 대시보드 → SQL Editor 에 붙여 실행하세요.
-- (이미 발행에 추가돼 있으면 "already member of publication" 에러가 날 수 있는데, 그러면 이미 적용된 것이니 무시하세요.)
-- ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.schedule_entries;

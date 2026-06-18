-- ───────────────────────────────────────────────────────────────
-- 조회용 공유 테이블 실시간 전파 — 업체·계정·홈페이지·외주사·인수인계
--  • clients / accounts / site_entries / vendors / handover_docs 는 그동안
--    realtime publication 에 없어, mount 시 1회 로드 후 갱신되지 않았다.
--  • 그 결과 데스크톱 메인창에서 홈페이지·업체·계정 정보를 바꿔도, 별개 webview 인
--    트레이 AI 위젯(별개 in-memory state)은 옛 값을 그대로 들고 있어 어시스턴트가
--    바뀐 정보를 반영하지 못했다(다른 기기/다른 탭도 동일).
--  • schedule_entries(0010/0017) · internal_events(0014) 등과 동일한 조치:
--    publication 추가 + REPLICA IDENTITY FULL(RLS 테이블의 UPDATE/DELETE 전파 필수).
-- 대시보드 → SQL Editor 에 붙여 실행하세요. (이미 있으면 "already member" 에러는 무시)
-- ───────────────────────────────────────────────────────────────

-- 1) realtime publication 에 추가(INSERT/UPDATE/DELETE 이벤트 송출 대상으로 등록)
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.site_entries;
alter publication supabase_realtime add table public.vendors;
alter publication supabase_realtime add table public.handover_docs;

-- 2) UPDATE/DELETE 이벤트 전달에 필수.
--  • RLS 가 켜진 테이블에서 realtime 이 UPDATE/DELETE 를 보내려면 이전 행(old) 전체가
--    필요한데, 기본 REPLICA IDENTITY 는 PK 만 담아 이벤트가 누락된다(INSERT 는 영향 없음).
alter table public.clients        replica identity full;
alter table public.accounts       replica identity full;
alter table public.site_entries   replica identity full;
alter table public.vendors        replica identity full;
alter table public.handover_docs  replica identity full;

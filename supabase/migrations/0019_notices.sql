-- ───────────────────────────────────────────────────────────────
-- 공지 (팀/전체 브로드캐스트) 영구 저장
--  • 요청(1:1)과 달리 한 번에 팀 전원 또는 전 직원에게 뿌리는 읽기 전용 알림.
--    확인/완료 같은 라이프사이클이 없다. 받는 사람은 data.audience 로 결정:
--      'all' = 전 직원,  팀 이름(마케팅팀 등) = 그 팀 전원(클라이언트에서 필터).
--  • 다른 업무 데이터와 동일하게 앱 객체를 그대로 jsonb(data)로 저장한다.
--  • realtime: 누군가 공지를 올리면 대상 인원 화면에 즉시 반영 + 종/PC/스티커 알림.
--    삭제(DELETE) 이벤트도 전파되도록 REPLICA IDENTITY FULL 을 함께 설정한다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요(배포 전 먼저 실행해야 로드/알림이 안 깨짐).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.notices (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.notices enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 데이터)
drop policy if exists "notices_all_auth" on public.notices;
create policy "notices_all_auth" on public.notices
  for all to authenticated using (true) with check (true);

-- realtime 발행 + DELETE 전파를 위한 FULL 식별
alter publication supabase_realtime add table public.notices;
alter table public.notices replica identity full;

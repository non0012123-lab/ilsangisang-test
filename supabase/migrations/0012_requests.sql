-- ───────────────────────────────────────────────────────────────
-- 업무 요청(요청함)
--  • 다른 담당자에게 "이것 좀 해줘"를 보내는 요청. 일정과 별개로,
--    일정 없이도 "이거 확인해줘"가 가능하다.
--  • 흐름: pending(대기) → confirmed(담당자 확인) → done(완료).
--    - 요청 생성 → 담당자 화면에 스티커메모 + 종/PC 알림(realtime INSERT).
--    - 담당자가 "확인" → 요청자에게 알림(realtime UPDATE, status=confirmed).
--    - 담당자가 "완료" → 요청자에게 알림(realtime UPDATE, status=done).
--  • 사내 공유 데이터이므로 RLS 는 인증 사용자 전체 허용(앱이 to/from uid 로 필터).
--  • 앱 객체(WorkRequest)를 그대로 jsonb(data)로 저장.
-- 대시보드 → SQL Editor 에 붙여 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.requests (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.requests enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (앱에서 본인 관련 요청만 필터해 표시)
drop policy if exists "requests_all_auth" on public.requests;
create policy "requests_all_auth" on public.requests
  for all to authenticated using (true) with check (true);

-- 요청 생성·상태변경을 새로고침 없이 상대 화면에 반영하기 위해 realtime 발행에 추가.
-- (이미 추가돼 있으면 "already member of publication" 에러 — 그러면 무시하세요.)
alter publication supabase_realtime add table public.requests;

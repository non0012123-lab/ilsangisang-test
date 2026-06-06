-- ───────────────────────────────────────────────────────────────
-- 내부 일정 (사내 전용)
--  • 클라이언트로 넘어가지 않는 사내 일정: 회의실/미팅/면접/촬영/휴가 등.
--  • 종류(카테고리)는 internal_categories 에서 관리하며 사용자가 추가/삭제 가능.
--  • 각 레코드는 앱 객체를 그대로 jsonb(data)로 저장(다른 업무 데이터와 동일).
--  • 사내 공유 데이터라 RLS 는 인증 사용자 전체 허용.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.internal_events (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.internal_categories (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.internal_events     enable row level security;
alter table public.internal_categories enable row level security;

drop policy if exists "internal_events_all_auth" on public.internal_events;
create policy "internal_events_all_auth" on public.internal_events
  for all to authenticated using (true) with check (true);

drop policy if exists "internal_categories_all_auth" on public.internal_categories;
create policy "internal_categories_all_auth" on public.internal_categories
  for all to authenticated using (true) with check (true);

-- 다른 사람이 등록/수정/삭제한 내부 일정을 새로고침 없이 반영(realtime).
--  • UPDATE/DELETE 까지 전달되도록 REPLICA IDENTITY FULL 설정(참고: 0012 와 동일 이유).
-- (이미 발행에 있으면 "already member of publication" 에러 — 무시하세요.)
alter publication supabase_realtime add table public.internal_events;
alter table public.internal_events replica identity full;

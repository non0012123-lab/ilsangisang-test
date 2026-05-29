-- ───────────────────────────────────────────────────────────────
-- 업무 데이터(클라이언트 / 스케줄 / 인계문서) 영구 저장
--  • 지금까지 이 데이터는 코드 내 목업을 메모리에 올려 써서, 새로고침·배포
--    때마다 초기화됐다. 이를 Supabase 테이블에 저장해 유지·공유되게 한다.
--  • 각 레코드는 앱의 객체를 그대로 jsonb(data)로 저장한다(스키마 변경 없이).
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.clients (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.handover_docs (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.clients          enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.handover_docs    enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 데이터)
drop policy if exists "clients_all_auth" on public.clients;
create policy "clients_all_auth" on public.clients
  for all to authenticated using (true) with check (true);

drop policy if exists "schedule_entries_all_auth" on public.schedule_entries;
create policy "schedule_entries_all_auth" on public.schedule_entries
  for all to authenticated using (true) with check (true);

drop policy if exists "handover_docs_all_auth" on public.handover_docs;
create policy "handover_docs_all_auth" on public.handover_docs
  for all to authenticated using (true) with check (true);

-- ───────────────────────────────────────────────────────────────
-- 참고: 앱 최초 로그인 시 테이블이 비어 있으면 기존 목업 데이터를
--       한 번 자동으로 채웁니다(시드). 이후에는 추가/수정/삭제가 그대로 유지됩니다.
-- ───────────────────────────────────────────────────────────────

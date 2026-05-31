-- ───────────────────────────────────────────────────────────────
-- 아이디 목록(accounts) / 홈페이지 목록(site_entries) 영구 저장
--  • 아이디 목록: 블로그·SNS·유튜브 등 계정 + 프록시 IP
--  • 홈페이지 목록: 문자발송·외주 주문 등 사내 사용 사이트 + 계정
--  • 다른 업무 데이터와 동일하게 앱 객체를 그대로 jsonb(data)로 저장한다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.accounts (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.accounts     enable row level security;
alter table public.site_entries enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 데이터)
drop policy if exists "accounts_all_auth" on public.accounts;
create policy "accounts_all_auth" on public.accounts
  for all to authenticated using (true) with check (true);

drop policy if exists "site_entries_all_auth" on public.site_entries;
create policy "site_entries_all_auth" on public.site_entries
  for all to authenticated using (true) with check (true);

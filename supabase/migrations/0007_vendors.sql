-- ───────────────────────────────────────────────────────────────
-- 외주사(아웃소싱 파트너) 영구 저장
--  • 영수증리뷰·앱설치·앱후기 등 외주를 맡기는 외부 업체를 관리한다.
--  • 다른 업무 데이터와 동일하게 앱 객체를 그대로 jsonb(data)로 저장한다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.vendors (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 데이터)
drop policy if exists "vendors_all_auth" on public.vendors;
create policy "vendors_all_auth" on public.vendors
  for all to authenticated using (true) with check (true);

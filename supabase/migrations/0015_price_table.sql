-- ───────────────────────────────────────────────────────────────
-- 단가표 (외부 마케팅 쇼핑몰에서 수집한 패키지/단일 상품 가격)
--  • shop.gpakorea.com 의 상품별 패키지/단일 옵션·가격을 긁어 보관.
--  • '단가표 새로고침' 버튼을 누르면 서버(/api/pricing-scrape)가 재수집해 이 테이블을 upsert 한다.
--  • 각 레코드(id=소스 상품 id)는 앱 객체(PriceProduct)를 그대로 jsonb(data)로 저장(다른 업무 데이터와 동일).
--  • 사내 공유 데이터라 RLS 는 인증 사용자 전체 허용.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.price_table (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.price_table enable row level security;

drop policy if exists "price_table_all_auth" on public.price_table;
create policy "price_table_all_auth" on public.price_table
  for all to authenticated using (true) with check (true);

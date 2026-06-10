-- ───────────────────────────────────────────────────────────────
-- 순위 보장 (순위가 잡혀야 카운팅되는 보장형 상품) 영구 저장
--  • 키워드(항목) 단건 = 1건. 항목 rank 가 채워지면 카운트되고, 보장 목표(건수) 도달 시 연장 체크.
--  • 다른 업무 데이터와 동일하게 앱 객체를 그대로 jsonb(data)로 저장한다(items 배열 임베드).
--  • realtime: 여러 담당자가 순위를 입력 → 다른 화면에 즉시 반영 + 임박/도달 알림.
--    UPDATE/DELETE 이벤트가 누락되지 않도록 REPLICA IDENTITY FULL 을 함께 설정한다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.rank_guarantees (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.rank_guarantees enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유 데이터)
drop policy if exists "rank_guarantees_all_auth" on public.rank_guarantees;
create policy "rank_guarantees_all_auth" on public.rank_guarantees
  for all to authenticated using (true) with check (true);

-- realtime 발행 + UPDATE/DELETE 전파를 위한 FULL 식별
alter publication supabase_realtime add table public.rank_guarantees;
alter table public.rank_guarantees replica identity full;

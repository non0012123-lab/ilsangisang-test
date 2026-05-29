-- ───────────────────────────────────────────────────────────────
-- AI 기획 결과 보관 (모두 조회 가능 + 인수인계 연계)
--  • AI 기획 리포트(텍스트)와 메타데이터를 저장해 누구나 다시 볼 수 있게 한다.
--  • 이미지(base64)는 용량이 커서 저장하지 않는다(생성 세션에서만 보관).
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.ai_plans (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_plans enable row level security;

-- 로그인한 사용자는 모두 조회/생성/수정/삭제 가능 (사내 공유)
drop policy if exists "ai_plans_all_auth" on public.ai_plans;
create policy "ai_plans_all_auth" on public.ai_plans
  for all to authenticated using (true) with check (true);

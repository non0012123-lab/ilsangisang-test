-- ───────────────────────────────────────────────────────────────
-- 클라이언트 포털 일일 AI 인사이트 캐시
--  • 광고주 포털 대시보드의 "AI 마케팅 인사이트"를 그날 1회만 생성(어제 데이터 기준)하고
--    자정까지 캐시해 AI 반복 호출을 막는다. 키(id) = `${clientId}-${showDate}` 로 하루 1건.
--  • 앱 객체(ClientInsight)를 그대로 jsonb(data)로 저장(다른 테이블과 동일 패턴).
--  • 클라이언트(role=client)도 인증 사용자이므로 RLS 는 authenticated 전체 허용.
-- 대시보드 → SQL Editor 에 붙여 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.client_insights (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.client_insights enable row level security;

drop policy if exists "client_insights_all_auth" on public.client_insights;
create policy "client_insights_all_auth" on public.client_insights
  for all to authenticated using (true) with check (true);

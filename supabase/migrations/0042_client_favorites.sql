-- ───────────────────────────────────────────────────────────────
-- client_favorites: 사용자별 개인 즐겨찾기(별표)
--  • 클라이언트가 많아지면서 각 직원이 자주 보는 업체를 별표로 고정해 두고
--    목록/사이드바 맨 위에서 바로 찾을 수 있게 한다.
--  • "각자"의 목록이므로 행 하나 = 사용자 한 명(id = auth.uid()). 공유가 아니다.
--  • 다른 업무 데이터와 동일한 {id, data} jsonb 패턴 —
--    data = { id: <uid>, clientIds: string[] }. (앱은 clientIds 만 사용)
--  • realtime: 같은 계정으로 다른 기기/창에서 별표를 바꾸면 즉시 반영.
--    UPDATE/DELETE 누락 방지를 위해 REPLICA IDENTITY FULL 함께 설정(0018/0041 과 동일 이유).
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다
--    (git push 만으로는 DB 에 반영되지 않음).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.client_favorites (
  id         text primary key,      -- = auth.uid() (사용자 1명당 1행)
  data       jsonb not null,        -- { id, clientIds: [] }
  updated_at timestamptz not null default now()
);

alter table public.client_favorites enable row level security;

-- 본인 행만 조회/생성/수정/삭제 (각자 개인 목록 — 서로 못 봄)
drop policy if exists "client_favorites_own" on public.client_favorites;
create policy "client_favorites_own" on public.client_favorites
  for all to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- realtime 발행 + UPDATE/DELETE 전파를 위한 FULL 식별
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_favorites'
  ) then
    alter publication supabase_realtime add table public.client_favorites;
  end if;
end $$;

alter table public.client_favorites replica identity full;

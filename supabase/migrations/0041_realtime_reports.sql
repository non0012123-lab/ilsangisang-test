-- ───────────────────────────────────────────────────────────────
-- reports 실시간 반영 — 담당자가 보고서를 발행/수정/삭제하면
--  클라이언트 포털·미리보기·다른 창/기기에 새로고침 없이 바로 반영되게 한다.
--  • publication 에 추가해야 realtime 이벤트가 흐르고,
--  • REPLICA IDENTITY FULL 이어야 UPDATE(초안→발행, 내용 수정)·DELETE 이벤트가 누락되지 않는다
--    (기본 REPLICA IDENTITY 는 PK 만 실어 UPDATE/DELETE payload 가 비어 앱이 못 받는다 — 0017/0021 과 동일 이유).
--
-- ⚠️ Supabase 대시보드 → SQL Editor 에 붙여넣어 직접 실행해야 적용됩니다.
-- ───────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;

alter table public.reports replica identity full;

-- ───────────────────────────────────────────────────────────────
-- API 역할 statement_timeout 상향 — 이미지(media) 청크 조회가 끊기지 않도록
--  • 배경: base64 이미지를 media 컬럼으로 분리해 목록(data)은 가벼워졌지만, 이미지(media) 자체를
--    백그라운드로 조회할 때 한 청크라도 용량이 커서 기본 statement_timeout(약 8s)을 넘겨 500 이 났다.
--  • 조치: PostgREST 가 쓰는 anon/authenticated 역할의 timeout 을 20s 로 올려 청크 조회가 완료되게 한다.
--    (앱은 media 를 아주 작은 청크로 백그라운드 로드하므로 일반 쿼리 성능엔 영향 없음.)
--  • ※ 근본적으로 이미지가 매우 많아지면 Supabase Storage 이전이 권장되지만, 현재 규모에선 이 상향으로 충분.
-- 대시보드 → SQL Editor 에 붙여 실행.
-- ───────────────────────────────────────────────────────────────

alter role authenticated set statement_timeout = '20s';
alter role anon          set statement_timeout = '20s';

-- PostgREST 가 변경을 즉시 반영하도록 설정 리로드
notify pgrst, 'reload config';

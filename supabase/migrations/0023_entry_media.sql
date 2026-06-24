-- ───────────────────────────────────────────────────────────────
-- 이미지(base64) 분리 — schedule_entries / ai_plans 의 무거운 이미지를 별도 media 컬럼으로
--  • 문제: 로그인 시 `select id, data` 로 전체 jsonb 를 일괄 조회하는데, data 안에 base64 이미지
--    (일정 첨부/스크린샷, AI 기획 그리드 시안)가 들어 있어 데이터가 쌓이면 detoast·전송 비용으로
--    "canceling statement due to statement timeout"(500) 이 발생한다.
--  • 해결: 이미지를 data 에서 분리해 media 컬럼으로 옮긴다. 목록은 `select id, data`(가벼움)로 즉시
--    불러오고, 이미지는 앱이 백그라운드에서 `select id, media` 로 청크 로드해 채운다.
--  • ★ 반드시 코드 배포보다 "먼저" 실행하세요(코드가 media 컬럼에 upsert 합니다).
-- 대시보드 → SQL Editor 에 붙여 실행.
-- ───────────────────────────────────────────────────────────────

set statement_timeout = '300s'; -- 일회성 대량 UPDATE 가 끊기지 않도록(이 세션 한정)

alter table public.schedule_entries add column if not exists media jsonb;
alter table public.ai_plans        add column if not exists media jsonb;

-- 기존 행: 이미지/스크린샷을 media 로 옮기고 data 에서 제거(가볍게)
update public.schedule_entries
  set media = jsonb_strip_nulls(jsonb_build_object('images', data->'images', 'screenshot', data->'screenshot')),
      data  = data - 'images' - 'screenshot'
  where data ? 'images' or data ? 'screenshot';

update public.ai_plans
  set media = jsonb_build_object('images', data->'images'),
      data  = data - 'images'
  where data ? 'images';

-- 만약 위 UPDATE 가 그래도 타임아웃 나면(행이 매우 많을 때), 아래처럼 나눠서 반복 실행하세요:
--   update public.schedule_entries set media = jsonb_strip_nulls(jsonb_build_object('images', data->'images','screenshot', data->'screenshot')), data = data - 'images' - 'screenshot'
--     where (data ? 'images' or data ? 'screenshot') and id in (select id from public.schedule_entries where (data ? 'images' or data ? 'screenshot') limit 500);
--   (결과 0행이 될 때까지 반복. ai_plans 도 동일 패턴.)

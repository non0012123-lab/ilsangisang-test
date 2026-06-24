-- ───────────────────────────────────────────────────────────────
-- 0023 백필 보강 — 큰 일괄 UPDATE 가 SQL 에디터 게이트웨이 타임아웃으로 끊겼을 수 있어,
-- 작은 배치로 "여러 번" 나눠 확실히 끝낸다. (data 에 아직 이미지가 남은 행을 media 로 마저 이전)
--
-- 사용법:
--   1) 아래 ①, ② 를 각각 "Rows returned/affected: 0" 이 될 때까지 반복 실행.
--      (한 번에 다 안 끝나면 같은 쿼리를 다시 실행 — 행이 0 이 될 때까지)
--   2) 남은 행 수 확인은 ③.
-- ───────────────────────────────────────────────────────────────

-- ① schedule_entries 배치(300행씩)
with batch as (
  select id from public.schedule_entries
  where data ? 'images' or data ? 'screenshot'
  limit 300
)
update public.schedule_entries e
  set media = jsonb_strip_nulls(jsonb_build_object('images', e.data->'images', 'screenshot', e.data->'screenshot')),
      data  = e.data - 'images' - 'screenshot'
  from batch
  where e.id = batch.id;

-- ② ai_plans 배치(100행씩 — 행이 더 큼)
with batch as (
  select id from public.ai_plans
  where data ? 'images'
  limit 100
)
update public.ai_plans p
  set media = jsonb_build_object('images', p.data->'images'),
      data  = p.data - 'images'
  from batch
  where p.id = batch.id;

-- ③ 남은 행 수(둘 다 0 이면 백필 완료)
select
  (select count(*) from public.schedule_entries where data ? 'images' or data ? 'screenshot') as schedule_remaining,
  (select count(*) from public.ai_plans where data ? 'images') as ai_plans_remaining;

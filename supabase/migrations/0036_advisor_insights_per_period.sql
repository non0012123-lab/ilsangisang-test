-- ───────────────────────────────────────────────────────────────
-- 어드바이저 인사이트를 '기간(period)별로 분리 저장'. (어제=1d / 7일=7d / 30일=30d)
--  • 문제: 0034 는 광고주당 1행(블롭 1개) → 7일 수집 후 30일 수집하면 같은 data 에 덮여서
--    7일을 다시 눌러도 30일 데이터가 보였다. 기간 버튼은 '재수집' 없이 해당 기간만 보여줘야 함.
--  • 해결: PK 를 (client_id) → (client_id, period) 로. 기간마다 별도 행/스냅샷.
--  • patch_advisor_insight 에 p_period 추가(그 기간 행만 merge). enqueue 중복판정도 (client_id, period).
--  • 계약: spike-rank/ADVISOR-CONTRACT.md (period 값 '1d'|'7d'|'30d')
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- ── advisor_insights: period 컬럼 추가 + PK (client_id, period) ──
alter table public.advisor_insights add column if not exists period text not null default '30d';
-- 기존 단일 PK(client_id) 제거 후 복합 PK. 기존 행은 period 기본 '30d' 로 보존됨.
alter table public.advisor_insights drop constraint if exists advisor_insights_pkey;
alter table public.advisor_insights add primary key (client_id, period);

-- ── patch: 기간별 스냅샷 upsert(최상위 키 || 병합 = 그 기간 안에서 준 묶음만 갱신, 부분수집 보존) ──
drop function if exists public.patch_advisor_insight(text, jsonb);
create or replace function public.patch_advisor_insight(p_client_id text, p_period text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_data jsonb; v_period text := coalesce(p_period, '30d');
begin
  insert into public.advisor_insights as ai (client_id, period, data, collected_at, updated_at)
  values (p_client_id, v_period, coalesce(p_payload, '{}'::jsonb), now(), now())
  on conflict (client_id, period) do update
     set data = coalesce(ai.data, '{}'::jsonb) || coalesce(excluded.data, '{}'::jsonb),
         collected_at = now(),
         updated_at = now()
  returning data into v_data;
  return v_data;
end; $$;
grant execute on function public.patch_advisor_insight(text, text, jsonb) to authenticated;

-- ── enqueue: 같은 광고주+같은 기간의 진행중/대기 작업만 재사용(기간 다르면 별도 작업) ──
create or replace function public.enqueue_advisor_job(
  p_client_id text, p_client_name text, p_period text,
  p_requested_by text, p_requested_by_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_id text; v_existing text; v_period text := coalesce(p_period, '30d');
begin
  select id into v_existing from public.advisor_jobs
   where status in ('queued', 'running') and client_id = p_client_id and period = v_period
   order by created_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  v_id := 'aj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);
  insert into public.advisor_jobs(id, client_id, client_name, period, status, requested_by, requested_by_name)
  values (v_id, p_client_id, p_client_name, v_period, 'queued', p_requested_by, p_requested_by_name);
  return v_id;
end; $$;
grant execute on function public.enqueue_advisor_job(text, text, text, text, text) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 클라이언트 데이터 격리 (RLS 강화)
--  • 지금까지 업무 테이블은 전부 `for all to authenticated using(true)` 였다.
--    → role='client' 계정도 로그인만 하면 서버에서 "모든 업체"의 스케줄·계정·
--      단가·매출·인수인계 등 내부 데이터를 통째로 읽을 수 있었다(격리는 프론트
--      .filter 뿐 = 서버 미보호). 외부 광고주에게 계정을 내주는 구조라 위험.
--  • 이 마이그레이션은 서버(RLS) 단에서 다음을 강제한다:
--     - 직원(admin/manager, is_staff): 기존과 동일하게 전체 CRUD
--     - 클라이언트(role='client'): 본인 업체(client_id) 데이터만 열람,
--       포털이 자동 생성하는 reports·client_insights 만 본인 것 쓰기 허용
--     - 그 외 내부 전용 테이블: 클라이언트 접근 전면 차단(직원만)
--  • 앱 동작은 그대로: 클라이언트 포털은 원래도 본인 데이터만 화면에 그렸고,
--    직원 화면은 is_staff() 로 종전 권한을 유지한다.
--
-- ⚠️ 이 파일은 Supabase 대시보드 → SQL Editor 에 붙여넣어 "직접 실행"해야 적용됩니다
--    (git push 만으로는 DB 에 반영되지 않음). 실행 즉시 격리가 걸립니다.
-- ───────────────────────────────────────────────────────────────

-- ── 판별 함수 (RLS 재귀 방지를 위해 is_admin 과 동일하게 SECURITY DEFINER) ──
-- 직원 = admin 또는 manager. pending·client 는 직원이 아니다.
create or replace function public.is_staff()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

-- 현재 로그인 사용자의 연결 업체 id(profiles.client_id). 직원/미연결이면 null.
create or replace function public.my_client_id()
returns text
language sql
security definer stable set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ═══════════════════════════════════════════════════════════════
-- 1) 클라이언트가 "본인 것만" 접근하는 테이블
-- ═══════════════════════════════════════════════════════════════

-- clients: 직원은 전체 CRUD, 클라이언트는 본인 업체 행만 조회(id = 연결 client_id)
drop policy if exists "clients_all_auth" on public.clients;
drop policy if exists "clients_staff_all" on public.clients;
drop policy if exists "clients_client_read" on public.clients;
create policy "clients_staff_all" on public.clients
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "clients_client_read" on public.clients
  for select to authenticated using (id = public.my_client_id());

-- schedule_entries: 직원 전체, 클라이언트는 본인 업체 작업만 조회
drop policy if exists "schedule_entries_all_auth" on public.schedule_entries;
drop policy if exists "schedule_entries_staff_all" on public.schedule_entries;
drop policy if exists "schedule_entries_client_read" on public.schedule_entries;
create policy "schedule_entries_staff_all" on public.schedule_entries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "schedule_entries_client_read" on public.schedule_entries
  for select to authenticated using (data->>'clientId' = public.my_client_id());

-- reports: 직원 전체. 클라이언트는 본인 업체 보고서 조회 + 포털 자동생성(insert/update) 허용
--  (포털이 전송일 지난 월간 보고서를 클라이언트 세션에서 생성·저장한다)
drop policy if exists "reports_all_auth" on public.reports;
drop policy if exists "reports_staff_all" on public.reports;
drop policy if exists "reports_client_rw" on public.reports;
create policy "reports_staff_all" on public.reports
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "reports_client_rw" on public.reports
  for all to authenticated
  using (data->>'clientId' = public.my_client_id())
  with check (data->>'clientId' = public.my_client_id());

-- client_insights: 직원 전체. 클라이언트는 본인 인사이트 조회 + 포털 1일 1회 생성(upsert) 허용
drop policy if exists "client_insights_all_auth" on public.client_insights;
drop policy if exists "client_insights_staff_all" on public.client_insights;
drop policy if exists "client_insights_client_rw" on public.client_insights;
create policy "client_insights_staff_all" on public.client_insights
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "client_insights_client_rw" on public.client_insights
  for all to authenticated
  using (data->>'clientId' = public.my_client_id())
  with check (data->>'clientId' = public.my_client_id());

-- ═══════════════════════════════════════════════════════════════
-- 2) 내부 전용 테이블 — 클라이언트 접근 전면 차단(직원만)
--    (handover_docs·accounts·site_entries·vendors·requests·notices·
--     rank_guarantees·price_table·internal_events·internal_categories·
--     ai_plans·rank_jobs·advisor_jobs·advisor_insights)
--  ※ sales_entries(권한기반)·assistant_conversations(본인기반)·profiles 는
--     이미 별도 정책이 있어 여기서 건드리지 않는다.
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  t text;
  staff_only text[] := array[
    'handover_docs','accounts','site_entries','vendors','requests','notices',
    'rank_guarantees','price_table','internal_events','internal_categories',
    'ai_plans','rank_jobs','advisor_jobs','advisor_insights'
  ];
begin
  foreach t in array staff_only loop
    -- 테이블이 존재할 때만(마이그레이션 실행 순서·환경차 방어)
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_all_auth', t);
      execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
        t || '_staff_all', t
      );
    end if;
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────
-- 참고
--  • 적용 후 클라이언트 계정으로 로그인하면 포털(본인 대시보드/타임테이블/보고서)은
--    그대로 보이고, 다른 업체·내부 데이터는 서버에서 아예 내려오지 않는다.
--  • 직원 화면은 변화 없음. 만약 직원인데 데이터가 안 보이면 해당 계정 role 이
--    admin/manager 인지(=pending 아님) 확인할 것.
--  • profiles(직원 이름·이메일)도 현재 authenticated 전체 조회 허용이라 클라이언트가
--    조회 가능 — 민감도는 낮으나 후속으로 좁힐 수 있음(본인 행만 + 직원용 별도 정책).
-- ───────────────────────────────────────────────────────────────

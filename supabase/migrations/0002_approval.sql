-- ───────────────────────────────────────────────────────────────
-- 가입 승인제: 신규 가입은 'pending' 으로 시작하고, 관리자가 승인해야
-- 담당자(manager) / 클라이언트(client) 권한을 갖는다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- 1) role 에 'pending' 허용
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'client', 'pending'));

-- 2) 신규 가입 기본 role = 'pending' (승인 전까지 내부 접근 불가)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, department, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    new.raw_user_meta_data->>'department',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) 관리자 판별 함수 (RLS 재귀 방지를 위해 SECURITY DEFINER)
create or replace function public.is_admin()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 4) 관리자는 모든 프로필을 수정 가능 (승인 / 역할·클라이언트 지정)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────────────────────────────────────────────────────────
-- ★ 최초 관리자 지정 (필수): 본인 계정을 admin 으로 승격하세요.
--    update public.profiles set role = 'admin' where email = '본인이메일@example.com';
--
--  (선택) 기존에 manager 로 가입된 계정들을 다시 승인 대기로 돌리려면:
--    update public.profiles set role = 'pending'
--    where role = 'manager' and email <> '본인이메일@example.com';
-- ───────────────────────────────────────────────────────────────

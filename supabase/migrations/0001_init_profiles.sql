-- ───────────────────────────────────────────────────────────────
-- 인증 프로필 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣어 실행하거나,
-- Supabase CLI: `supabase db push` 로 적용하세요.
-- ───────────────────────────────────────────────────────────────

-- auth.users 와 1:1로 연결되는 프로필 (역할/이름/부서/클라이언트 연결)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  role        text not null default 'manager' check (role in ('admin', 'manager', 'client')),
  department  text,
  client_id   text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 사용자는 모든 프로필을 조회할 수 있음 (담당자명 등 화면 표시용)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- 본인 프로필만 수정 가능
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 신규 가입 시 profiles 행을 자동 생성 (기본 role = manager)
-- 회원가입 시 전달한 메타데이터(name, department)를 사용
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
    'manager'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────
-- 참고
--  • 특정 사용자를 관리자로 승격:
--      update public.profiles set role = 'admin' where email = 'admin@ilsangisang.com';
--  • 클라이언트 계정 발급(관리자): 대시보드 Authentication 에서 사용자 생성 후
--      update public.profiles set role = 'client', client_id = 'cl1' where email = 'starbucks@client.com';
-- ───────────────────────────────────────────────────────────────

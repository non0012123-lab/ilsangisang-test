-- ───────────────────────────────────────────────────────────────
-- 계정 상태(활성/중지) + 탈퇴(삭제) 지원
--  • 관리자가 직원/클라이언트 계정을 "중지"(일시 차단)하거나
--    "탈퇴"(프로필 삭제)시킬 수 있게 한다.
--  • 중지된 계정은 로그인은 되지만 내부 화면 접근이 차단된다(앱에서 처리).
--  • 본인이 스스로 status / role / client_id 를 바꾸는 것은 계속 차단.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- 1) status 컬럼 추가 (기본 'active')
alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

-- 2) 권한 변경 차단 트리거에 status 도 포함
--    (중지된 사용자가 profiles_update_own 으로 스스로 'active' 로 되돌리는 것 차단)
create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.client_id is distinct from old.client_id
      or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception '권한(role)·상태(status)·클라이언트 연결 변경은 관리자만 가능합니다.';
  end if;
  return new;
end;
$$;

-- 3) 탈퇴(프로필 삭제)는 관리자만 가능
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ───────────────────────────────────────────────────────────────
-- 참고
--  • "탈퇴"는 profiles 행만 삭제합니다. 로그인 계정(auth.users)은 남지만,
--    프로필이 없으면 앱에서 '승인 대기'로 취급되어 내부 접근이 차단됩니다.
--  • auth.users 까지 완전히 삭제하려면 service_role 키가 필요하므로
--    Cloudflare Pages Function 등 서버에서 처리해야 합니다(브라우저 불가).
-- ───────────────────────────────────────────────────────────────

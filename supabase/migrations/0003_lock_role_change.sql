-- ───────────────────────────────────────────────────────────────
-- 보안 수정: 본인 프로필 수정(profiles_update_own)으로 사용자가 스스로
-- role / client_id 를 바꿔 권한을 승격하는 것을 차단한다.
-- (이름/부서 등 다른 컬럼은 본인이 수정 가능하게 유지)
-- role·client_id 변경은 오직 관리자(is_admin())만 가능.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.client_id is distinct from old.client_id)
     and not public.is_admin() then
    raise exception '권한(role)·클라이언트 연결 변경은 관리자만 가능합니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_role_change on public.profiles;
create trigger protect_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();

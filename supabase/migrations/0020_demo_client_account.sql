-- ───────────────────────────────────────────────────────────────
-- 데모(쇼케이스) 클라이언트 계정 발급
--  • 클라이언트에게 광고주 포털을 시연하기 위한 로그인 계정 1개를 만든다.
--  • 이 계정으로 로그인하면 앱이 client_id = 'demo' 를 감지해, Supabase 의
--    실제 데이터 대신 코드 내장 정적 데모 데이터(가상 클라이언트·업무·차트)를
--    화면에만 주입한다. DB 에는 데모 데이터가 전혀 저장되지 않으므로
--    내부 시스템(관리/대시보드/보고서/순위보장)에는 절대 노출되지 않는다.
--
-- ▶ 실행 전 1단계 (계정이 아직 없을 때만):
--    Supabase 대시보드 → Authentication → Users → "Add user" 로 데모 로그인
--    계정을 먼저 생성한다. (홈페이지 회원가입으로 이미 만든 계정이 있으면 그걸 써도 됨)
--    가입 트리거(on_auth_user_created)가 profiles 행을 자동 생성한다(기본 role=manager).
--
-- ▶ 실행 2단계 (이 파일):
--    아래 이메일을 본인이 만든 데모 계정 이메일로 바꿔 SQL Editor 에서 실행한다.
--    (\set 같은 psql 변수는 SQL Editor 에서 안 되므로 이메일을 직접 적는다)
-- ───────────────────────────────────────────────────────────────

-- ★ 두 곳의 이메일을 본인 데모 계정으로 수정하세요. (현재 예시: demo@12sang.com)
--
--   profiles 에는 "본인이 스스로 role/client_id 를 못 바꾸게" 막는 트리거
--   (protect_role_change)가 걸려 있다. SQL Editor 에는 로그인 사용자(auth.uid)가
--   없어 is_admin()=false 로 판정돼 차단되므로, 관리자 자격으로 1회 부여하기 위해
--   트리거를 잠깐 끄고 → 변경하고 → 다시 켠다.
alter table public.profiles disable trigger protect_role_change;

update public.profiles
   set role = 'client',
       client_id = 'demo',
       status = 'active'
 where email = 'demo@12sang.com';

alter table public.profiles enable trigger protect_role_change;

-- 확인: 1행이 role='client' / client_id='demo' 로 나오면 정상
select id, email, role, client_id, status
  from public.profiles
 where email = 'demo@12sang.com';

-- ───────────────────────────────────────────────────────────────
-- 참고
--  • update 결과가 0행이면: 해당 이메일의 가입(auth.users)·프로필이 아직 없는 것.
--    대시보드 Authentication 에서 계정을 먼저 만든 뒤 다시 실행한다.
--  • 데모를 끄려면(일반 계정으로 되돌리기):
--      update public.profiles set role='manager', client_id=null where email='demo@12sang.com';
--  • 데모 데이터의 내용(업종·키워드·수치)은 src/data/demoData.ts 에서 수정한다.
-- ───────────────────────────────────────────────────────────────

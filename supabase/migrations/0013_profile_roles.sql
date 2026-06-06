-- ───────────────────────────────────────────────────────────────
-- 직함(title) · 직책(position) 부여
--  • 팀(department)은 기존 컬럼 사용: 마케팅팀 / 디자인팀 / 영상팀 / 총괄팀 / 대표
--  • 직함(title): 사원 / 주임 / 대리 / 과장 / 차장 / 부장
--  • 직책(position): 팀장 / 파트장 / 실장 / 본부장 / 이사 / 대표이사 / 매니저 / PD / 감독
--  • 관리자가 "가입 승인/권한 관리" 화면에서 개인별로 지정한다.
--  • AI 어시스턴트가 "디자인팀장", "영상팀 PD" 같은 표현을 사람으로 해석하는 근거가 된다.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists title    text; -- 직함
alter table public.profiles add column if not exists position  text; -- 직책

-- 기존 RLS 그대로: 조회는 인증 사용자 전체, 수정은 본인 또는 관리자(profiles_update_admin).
-- title/position 은 role 이 아니므로 prevent_role_self_change 트리거의 제약을 받지 않는다.

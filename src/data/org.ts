// 조직 구성 옵션 — 가입/승인 화면 드롭다운과 AI 어시스턴트 해석의 기준.
// 팀(department) · 직함(title) · 직책(position) 세 축으로 개인을 식별한다.

// 팀 (department)
export const DEPARTMENTS = ['마케팅팀', '디자인팀', '영상팀', '총괄팀', '대표'] as const;

// 직함 (title) — 일반적인 호봉 체계
export const TITLES = ['사원', '주임', '대리', '과장', '차장', '부장'] as const;

// 직책 (position) — 보직. 영상팀의 PD/감독 포함.
export const POSITIONS = ['팀장', '파트장', '실장', '본부장', '이사', '대표이사', '매니저', 'PD', '감독'] as const;

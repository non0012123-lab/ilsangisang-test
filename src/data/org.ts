// 조직 구성 옵션 — 가입/승인 화면 드롭다운과 AI 어시스턴트 해석의 기준.
// 팀(department) · 직함(title) · 직책(position) 세 축으로 개인을 식별한다.

// 팀 (department)
export const DEPARTMENTS = ['마케팅팀', '디자인팀', '영상팀', '총괄팀', '대표'] as const;

// 직함 (title) — 일반적인 호봉 체계
export const TITLES = ['사원', '주임', '대리', '과장', '차장', '부장'] as const;

// 직책 (position) — 보직. 영상팀의 PD/감독 포함.
export const POSITIONS = ['팀장', '파트장', '실장', '본부장', '이사', '대표이사', '매니저', 'PD', '감독'] as const;

// 팀 필터 칩에서는 제외할 팀 — '대표'는 1인이라 팀별 보기가 의미 없음(전체·담당자 검색으로 봄).
const TEAM_FILTER_EXCLUDE = new Set(['대표']);

// 실제 존재하는 팀(department) 목록을 DEPARTMENTS 순서대로 정렬해 반환한다.
//  • 팀 필터 칩의 소스 — 가입 시 쓰는 표준 팀을 먼저, 그 외(레거시/커스텀 팀)는 뒤에 붙인다.
//  • 빈/미지정·제외 대상(대표)은 뺀다.
export function orderedTeams(depts: (string | undefined)[]): string[] {
  const present = new Set(depts.filter((d): d is string => !!d && d.trim() !== '' && !TEAM_FILTER_EXCLUDE.has(d)));
  const std = (DEPARTMENTS as readonly string[]).filter(d => present.has(d));
  const extra = [...present].filter(d => !(DEPARTMENTS as readonly string[]).includes(d)).sort();
  return [...std, ...extra];
}

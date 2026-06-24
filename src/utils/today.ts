// 앱 전역의 "오늘" 기준 — 실제 현재 날짜(로컬)를 사용한다.
// (toISOString 은 UTC 라 자정 부근 오프바이원이 생길 수 있어 로컬 기준으로 포맷)
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const todayStr = (): string => localDateStr(new Date());

export const currentMonthStr = (): string => todayStr().slice(0, 7); // YYYY-MM

export function monthStartStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEndStr(d: Date = new Date()): string {
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// 로컬 현재 시각 "YYYY-MM-DDTHH:mm" (datetime-local 입력값과 동일 형식)
export function nowLocalStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${localDateStr(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 상담 일시 등 일시 문자열을 "YYYY-MM-DDTHH:mm" 로 통일(저장 형식 일관 → 정렬 안정).
//  • 빈값 → 현재 시각  • 날짜만(YYYY-MM-DD) → 그 날짜 + 현재 시각(=적용 시각)  • 'T'/공백 혼용 → 'T' 통일
export function normDateTime(raw?: string, now: Date = new Date()): string {
  const s = (raw ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!m) return nowLocalStr(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const time = m[2] ?? `${p(now.getHours())}:${p(now.getMinutes())}`;
  return `${m[1]}T${time}`;
}

// 정렬/비교용: 일시 문자열 → 타임스탬프(ms). 'T'/공백/날짜만 모두 처리(날짜만이면 그날 00:00). 실패 시 0.
export function dateTimeMs(raw?: string): number {
  const m = (raw ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) { const t = new Date((raw ?? '').trim()).getTime(); return Number.isNaN(t) ? 0 : t; }
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0).getTime();
}

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

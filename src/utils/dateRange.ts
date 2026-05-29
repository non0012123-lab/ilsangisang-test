import type { ScheduleEntry } from '../types';

// 로컬 날짜 기준 YYYY-MM-DD (toISOString의 UTC 변환 오프바이원 방지)
export function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 작업의 종료일 (없으면 시작일과 동일)
export function entryEnd(entry: ScheduleEntry): string {
  return entry.endDate && entry.endDate >= entry.date ? entry.endDate : entry.date;
}

// 해당 날짜(dateStr)가 작업 기간 [date, endDate]에 포함되는가
export function coversDate(entry: ScheduleEntry, dateStr: string): boolean {
  return dateStr >= entry.date && dateStr <= entryEnd(entry);
}

// 작업 기간이 [from, to] 구간과 겹치는가 (둘 중 하나가 비면 무시)
export function overlapsRange(entry: ScheduleEntry, from?: string, to?: string): boolean {
  const start = entry.date;
  const end = entryEnd(entry);
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

// 작업이 기간 작업인지 (마감일이 시작일보다 뒤)
export function isMultiDay(entry: ScheduleEntry): boolean {
  return !!entry.endDate && entry.endDate > entry.date;
}

// 시작일~종료일 사이의 모든 날짜 문자열 배열 (특정 월 prefix로 제한 가능)
export function enumerateDays(entry: ScheduleEntry, monthPrefix?: string): string[] {
  const days: string[] = [];
  const start = new Date(entry.date + 'T00:00:00');
  const end = new Date(entryEnd(entry) + 'T00:00:00');
  // 안전장치: 최대 366일
  let guard = 0;
  for (let d = new Date(start); d <= end && guard < 366; d.setDate(d.getDate() + 1), guard++) {
    const s = fmtLocal(d);
    if (!monthPrefix || s.startsWith(monthPrefix)) days.push(s);
  }
  return days;
}

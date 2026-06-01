import type { Client, ScheduleEntry } from '../types';
import { overlapsRange } from './dateRange';
import { localDateStr } from './today';

// 한 보고 구간: 집계 기간 [start,end] + 공개일(release)
export interface DuePeriod { start: string; end: string; releaseDate: string; }

const CYCLE_DAYS = 30;
const addDays = (dateStr: string, n: number): string => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};

// 보고 기준 시작일(reportAnchorDate, 없으면 계약 startDate) 기준 30일 롤링 구간 산출.
//  • 구간 k = [anchor + 30k] ~ [anchor + 30(k+1)]  (예: 6/5 → 6/5~7/5, 다음 7/5~8/4)
//  • 공개일 = 구간 종료 다음 날 (종료 당일 작업 포함 후 그 다음 날 배포)
//  • 최근 ~13개 구간만 산출하고, 공개일이 오늘 이하인 것만 duePeriods 에서 노출.
function autoPeriods(client: Client, today: string, lookback = 13): DuePeriod[] {
  const anchor = client.reportAnchorDate || client.startDate;
  if (!anchor) return [];
  const daysSince = Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(anchor + 'T00:00:00').getTime()) / 86_400_000);
  const curK = Math.floor(daysSince / CYCLE_DAYS);
  if (curK < 0) return [];
  const out: DuePeriod[] = [];
  for (let k = Math.max(0, curK - lookback); k <= curK; k++) {
    const start = addDays(anchor, CYCLE_DAYS * k);
    const end = addDays(anchor, CYCLE_DAYS * (k + 1));
    out.push({ start, end, releaseDate: addDays(end, 1) });
  }
  return out;
}

export const reportIdFor = (clientId: string, start: string) => `rpt-${clientId}-${start}`;

// 자동 + 수동 구간을 합쳐, 공개일이 오늘 이하인(=노출 대상) 구간만 반환. start 기준 중복 제거(수동 우선).
export function duePeriods(client: Client, today: string): DuePeriod[] {
  const manual: DuePeriod[] = (client.reportPeriods ?? [])
    .filter(p => p.start && p.end && p.releaseDate)
    .map(p => ({ start: p.start, end: p.end, releaseDate: p.releaseDate }));
  const byStart = new Map<string, DuePeriod>();
  for (const p of autoPeriods(client, today)) byStart.set(p.start, p);
  for (const p of manual) byStart.set(p.start, p); // 수동이 자동을 덮어씀
  return [...byStart.values()]
    .filter(p => p.releaseDate <= today)
    .sort((a, b) => b.start.localeCompare(a.start));
}

// 사람이 읽는 기간 라벨
export function periodLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const lastOfMonth = new Date(sy, sm, 0).getDate();
  // 1일~말일(같은 달) 이면 "YYYY년 M월"
  if (sd === 1 && end === `${start.slice(0, 7)}-${String(lastOfMonth).padStart(2, '0')}`) {
    return `${sy}년 ${sm}월`;
  }
  return `${start.replace(/-/g, '.')} ~ ${end.slice(5).replace('-', '.')}`;
}

export interface PeriodAgg {
  entries: ScheduleEntry[];
  total: number;
  completed: number;
  totalViews: number;
  totalLikes: number;
  totalSaves: number;
  byCategory: { category: string; count: number }[];
}

// 해당 기간에 걸치는 클라이언트 일정 집계(기간 작업 포함)
export function aggregateForPeriod(allEntries: ScheduleEntry[], clientId: string, start: string, end: string): PeriodAgg {
  const entries = allEntries
    .filter(e => e.clientId === clientId && overlapsRange(e, start, end))
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalViews = entries.reduce((s, e) => s + (e.metrics?.views ?? 0) + (e.metrics?.blogViews ?? 0), 0);
  const totalLikes = entries.reduce((s, e) => s + (e.metrics?.likes ?? 0), 0);
  const totalSaves = entries.reduce((s, e) => s + (e.metrics?.saves ?? 0), 0);
  const catMap = new Map<string, number>();
  entries.forEach(e => catMap.set(e.category, (catMap.get(e.category) ?? 0) + 1));
  return {
    entries,
    total: entries.length,
    completed: entries.filter(e => e.status === 'completed').length,
    totalViews, totalLikes, totalSaves,
    byCategory: [...catMap.entries()].map(([category, count]) => ({ category, count })),
  };
}

const num = (n: number) => n.toLocaleString('ko-KR');

// AI 미사용/실패 시 쓰는 규칙기반 요약·하이라이트
export function fallbackSummary(label: string, agg: PeriodAgg): string {
  if (agg.total === 0) return `${label} 기간에 등록된 작업이 없습니다.`;
  const cats = agg.byCategory.map(c => `${c.category} ${c.count}건`).join(', ');
  return `${label} 동안 총 ${agg.total}건의 작업을 진행하여 ${agg.completed}건을 완료했습니다. 매체별로는 ${cats} 진행되었으며, 누적 조회수 약 ${num(agg.totalViews)}회를 기록했습니다.`;
}
export function fallbackHighlights(agg: PeriodAgg): string[] {
  const h: string[] = [];
  h.push(`총 작업 ${agg.total}건 중 ${agg.completed}건 완료`);
  if (agg.totalViews) h.push(`누적 조회수 ${num(agg.totalViews)}회`);
  if (agg.totalLikes) h.push(`좋아요 합계 ${num(agg.totalLikes)}건`);
  if (agg.totalSaves) h.push(`저장수 합계 ${num(agg.totalSaves)}건`);
  agg.byCategory.slice(0, 3).forEach(c => h.push(`${c.category} ${c.count}건 수행`));
  return h.slice(0, 5);
}

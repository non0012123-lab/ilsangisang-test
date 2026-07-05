// 순위 보장 카운팅/상태 파생 헬퍼 — 페이지(표시)와 AppContext(저장/알림)가 함께 쓴다.
//  • 카운트는 저장값이 아니라 items 에서 매번 센다(수정·삭제에도 자동 정확).
//  • "유효(카운트 대상)" 기준은 여기 한 곳에서만 정의 → 정책 변경(예: 1~N위 제한) 시 여기만 고친다.
//  • 방식별(월 건바이건 / 키워드 월보장 / 모니터링) 판정도 여기서 통일한다. [[rank-guarantee]]
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus, RankGuaranteeType, RankSample } from '../types';
import { todayStr, localDateStr } from './today';

export const DEFAULT_WINDOW_DAYS = 30;
export const DEFAULT_GUARANTEED_DAYS = 25;
export const SAMPLE_KEEP_DAYS = 35; // 샘플 보관 상한(윈도우 30일 + 여유)

// 방식(없으면 레거시 count). type 분기의 단일 진입점.
export const guaranteeType = (rg: Pick<RankGuarantee, 'type'>): RankGuaranteeType => rg.type ?? 'count';

// ── 날짜 헬퍼(로컬 기준) ──
const parseYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
export const addDays = (ymd: string, n: number): string => { const d = parseYmd(ymd); d.setDate(d.getDate() + n); return localDateStr(d); };
const dayDiff = (a: string, b: string): number => Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);

// anchor 기준 windowDays 주기에서 today 가 속한 '현재 구간' [start, end].
//  • anchor(보고 기준일)가 있으면 고정 계약 구간 → 남은 일수(end-today)로 이탈위험 판정 가능.
//  • 없으면 trailing 윈도우(end=today)로 폴백(추이만, 남은 일수 0).
export function currentWindow(anchor: string | undefined, windowDays: number, today = todayStr()): { start: string; end: string } {
  if (!anchor) return { start: addDays(today, -(windowDays - 1)), end: today };
  const diff = dayDiff(today, anchor);
  const k = Math.floor(diff / windowDays); // 음수(계약 시작 전)면 첫 구간으로
  const start = addDays(anchor, Math.max(0, k) * windowDays);
  return { start, end: addDays(start, windowDays - 1) };
}

// ── 순위 샘플 ──
// 하루 1개(같은 날 재수집이면 최신값으로 덮음). 최근 SAMPLE_KEEP_DAYS 일치만 보관.
export function appendSample(samples: RankSample[] | undefined, date: string, rank: number): RankSample[] {
  const rest = (samples ?? []).filter(s => s.date !== date);
  return [...rest, { date, rank }].sort((a, b) => a.date.localeCompare(b.date)).slice(-SAMPLE_KEEP_DAYS);
}

// ── 레거시 건수 보장(count) ──
// 순위 값이 채워져 있으면 유효(카운트). 현재 정책: 값 존재만 보면 됨(1순위 제한 없음).
export const isAchieved = (it: RankGuaranteeItem): boolean =>
  it.rank != null && String(it.rank).trim() !== '';

// 현재 회차에서 순위가 잡힌 항목 수(=달성 건수).
export const countAchieved = (rg: Pick<RankGuarantee, 'items' | 'cycle'>): number =>
  rg.items.filter(it => it.cycle === rg.cycle && isAchieved(it)).length;

// ── 월 건바이건(count_monthly) ──
// 현재 윈도우 안에 순위가 잡힌 건수. 편입일(rankedAt) 또는 최신 샘플일이 윈도우에 들면 카운트.
export const inWindow = (date: string | undefined, w: { start: string; end: string }): boolean =>
  !!date && date >= w.start && date <= w.end;

export function countInWindow(rg: Pick<RankGuarantee, 'items' | 'cycle'>, w: { start: string; end: string }): number {
  return rg.items.filter(it => {
    if (it.cycle !== rg.cycle || !isAchieved(it)) return false;
    const latest = it.samples?.length ? it.samples[it.samples.length - 1].date : undefined;
    return inWindow(it.rankedAt, w) || inWindow(latest, w);
  }).length;
}

// ── 키워드 월보장(keyword_coverage) ──
// 윈도우 안에서 targetRank '이내'로 잡힌 서로 다른 날 수. targetRank 없으면 노출된 날 모두 인정.
export function coveredDays(item: RankGuaranteeItem, w: { start: string; end: string }): number {
  const seen = new Set<string>();
  for (const s of item.samples ?? []) {
    if (s.date < w.start || s.date > w.end) continue;
    if (item.targetRank == null || s.rank <= item.targetRank) seen.add(s.date);
  }
  return seen.size;
}
// 현재 회차의 커버리지 대상 항목.
export const coverageItems = (rg: Pick<RankGuarantee, 'items' | 'cycle'>): RankGuaranteeItem[] =>
  rg.items.filter(it => it.cycle === rg.cycle);

// 임계 = 목표 - 알림오프셋 (건수/일수 공통). 음수 방지.
export const thresholdOf = (target: number, alertOffset: number): number => Math.max(0, target - alertOffset);

// 항목이 보장 충족했는가(coveredDays ≥ 보장일수).
export function itemMet(item: RankGuaranteeItem, guaranteedDays: number, w: { start: string; end: string }): boolean {
  return coveredDays(item, w) >= guaranteedDays;
}
// 이번 구간에서 산술적으로 더는 달성 불가(남은 일수 < 부족 일수) → 이탈위험.
export function itemAtRisk(item: RankGuaranteeItem, guaranteedDays: number, w: { start: string; end: string }, today = todayStr()): boolean {
  const need = guaranteedDays - coveredDays(item, w);
  if (need <= 0) return false;
  const remaining = Math.max(0, dayDiff(w.end, today)); // 오늘 이후 남은 일수
  return remaining < need;
}

// ── 방식별 상태 파생 ──
// closed 면 'closed'. monitor 는 목표 없음 → 'active'.
//  • count/count_monthly: 건수 ≥ 목표=reached, ≥임계=due_soon.
//  • keyword_coverage: 모든 대상 항목 충족=reached, 하나라도 임박(부족 ≤ offset)=due_soon.
export function deriveStatus(
  rg: Pick<RankGuarantee, 'type' | 'items' | 'cycle' | 'guaranteedCount' | 'guaranteedDays' | 'windowDays' | 'alertOffset' | 'closed'>,
  ctx: { anchorDate?: string; today?: string } = {},
): RankGuaranteeStatus {
  if (rg.closed) return 'closed';
  const type = guaranteeType(rg);
  if (type === 'monitor') return 'active';
  const today = ctx.today ?? todayStr();

  if (type === 'keyword_coverage') {
    const items = coverageItems(rg);
    if (!items.length) return 'active';
    const gDays = rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS;
    const w = currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today);
    if (items.every(it => itemMet(it, gDays, w))) return 'reached';
    const dueSoon = items.some(it => {
      const need = gDays - coveredDays(it, w);
      return need > 0 && need <= rg.alertOffset;
    });
    return dueSoon ? 'due_soon' : 'active';
  }

  // count / count_monthly
  const n = type === 'count_monthly'
    ? countInWindow(rg, currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today))
    : countAchieved(rg);
  if (n >= rg.guaranteedCount) return 'reached';
  if (n >= thresholdOf(rg.guaranteedCount, rg.alertOffset)) return 'due_soon';
  return 'active';
}

// 방식별 진척(분자/분모/단위) — UI 진행바·알림 문구를 한 곳에서 통일.
//  • count/count_monthly: 건수/목표건수. keyword_coverage: 충족 키워드/전체 키워드.
//  • monitor: 목표 없음 → target 0(표시는 페이지가 추이로 대체).
export function progress(
  rg: Pick<RankGuarantee, 'type' | 'items' | 'cycle' | 'guaranteedCount' | 'guaranteedDays' | 'windowDays'>,
  ctx: { anchorDate?: string; today?: string } = {},
): { n: number; target: number; unit: string } {
  const type = guaranteeType(rg);
  const today = ctx.today ?? todayStr();
  if (type === 'monitor') return { n: coverageItems(rg).length, target: 0, unit: '키워드' };
  if (type === 'keyword_coverage') {
    const items = coverageItems(rg);
    const gDays = rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS;
    const w = currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today);
    return { n: items.filter(it => itemMet(it, gDays, w)).length, target: items.length, unit: '키워드' };
  }
  if (type === 'count_monthly') {
    const w = currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today);
    return { n: countInWindow(rg, w), target: rg.guaranteedCount, unit: '건' };
  }
  return { n: countAchieved(rg), target: rg.guaranteedCount, unit: '건' };
}

export const STATUS_LABEL: Record<RankGuaranteeStatus, string> = {
  active: '진행중', due_soon: '임박', reached: '도달', closed: '종료',
};

export const TYPE_LABEL: Record<RankGuaranteeType, string> = {
  count: '건수 보장', count_monthly: '월 건바이건', keyword_coverage: '키워드 월보장', monitor: '키워드 모니터링',
};

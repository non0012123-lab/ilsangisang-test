// 순위 보장 카운팅/상태 파생 헬퍼 — 페이지(표시)와 AppContext(저장/알림)가 함께 쓴다.
//  • 카운트/커버리지는 저장값이 아니라 items 에서 매번 센다(수정·삭제에도 자동 정확).
//  • "달성(인정)" 기준 = 판정탭(judgeTabs) 중 최상위 순위가 목표순위(targetRank) '이내'. 여기 한 곳에서만 정의.
//  • 판정탭/목표순위는 보장(캠페인) 기본값 + 항목 덮어쓰기(judgeOf 로 해석). [[rank-guarantee]]
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus, RankGuaranteeType, RankSample, SearchTab } from '../types';
import { todayStr, localDateStr } from './today';

export const DEFAULT_WINDOW_DAYS = 30;
export const DEFAULT_GUARANTEED_DAYS = 25;
export const SAMPLE_KEEP_DAYS = 35;                 // 샘플 보관 상한(윈도우 30일 + 여유)
export const DEFAULT_TARGET_RANK = 10;              // 기본 목표순위(1페이지)
export const DEFAULT_JUDGE_TABS: SearchTab[] = ['integrated', 'blog']; // 기본 판정탭(통합·블로그 중 아무데나)

// 방식(없으면 레거시 count). type 분기의 단일 진입점.
export const guaranteeType = (rg: Pick<RankGuarantee, 'type'>): RankGuaranteeType => rg.type ?? 'count';

// ── 목표순위·판정탭 해석 (항목 → 보장 → 기본값) ──
export interface Judge { targetRank: number; judgeTabs: SearchTab[] }
export function judgeOf(
  item: Pick<RankGuaranteeItem, 'targetRank' | 'judgeTabs' | 'targetTab'>,
  rg: Pick<RankGuarantee, 'targetRank' | 'judgeTabs'>,
): Judge {
  const targetRank = item.targetRank ?? rg.targetRank ?? DEFAULT_TARGET_RANK;
  const judgeTabs = item.judgeTabs ?? (item.targetTab ? [item.targetTab] : undefined) ?? rg.judgeTabs ?? DEFAULT_JUDGE_TABS;
  return { targetRank, judgeTabs: judgeTabs.length ? judgeTabs : DEFAULT_JUDGE_TABS };
}

// 탭별 순위 맵에서 판정탭 중 최상위(min). 잡힌 게 없으면 undefined.
export function judgedRank(ranks: Partial<Record<SearchTab, number | null>> | undefined, judgeTabs: SearchTab[]): number | undefined {
  if (!ranks) return undefined;
  const vals = judgeTabs.map(t => ranks[t]).filter((n): n is number => typeof n === 'number');
  return vals.length ? Math.min(...vals) : undefined;
}
// 샘플의 판정순위 — ranks(탭별) 우선, 없으면 레거시 단일 rank.
export function sampleJudged(s: RankSample, judgeTabs: SearchTab[]): number | undefined {
  const j = judgedRank(s.ranks, judgeTabs);
  return j != null ? j : (typeof s.rank === 'number' ? s.rank : undefined);
}
// 항목의 '현재' 판정순위 — rankByTab 스냅샷 우선, 없으면 레거시 단일 rank.
export function currentJudged(item: RankGuaranteeItem, judge: Judge): number | undefined {
  const j = judgedRank(item.rankByTab, judge.judgeTabs);
  return j != null ? j : (typeof item.rank === 'number' ? item.rank : undefined);
}
// 항목의 '역대 최고' 판정순위 — bestByTab(sticky) 우선. 밀려도 안 내려감(월건 카운트·증빙 기준).
export function bestJudged(item: RankGuaranteeItem, judge: Judge): number | undefined {
  const b = judgedRank(item.bestByTab, judge.judgeTabs);
  if (b != null) return b;
  return currentJudged(item, judge);
}

// ── 날짜 헬퍼(로컬 기준) ──
const parseYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
export const addDays = (ymd: string, n: number): string => { const d = parseYmd(ymd); d.setDate(d.getDate() + n); return localDateStr(d); };
const dayDiff = (a: string, b: string): number => Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);

// anchor 기준 windowDays 주기에서 today 가 속한 '현재 구간' [start, end].
export function currentWindow(anchor: string | undefined, windowDays: number, today = todayStr()): { start: string; end: string } {
  if (!anchor) return { start: addDays(today, -(windowDays - 1)), end: today };
  const diff = dayDiff(today, anchor);
  const k = Math.floor(diff / windowDays);
  const start = addDays(anchor, Math.max(0, k) * windowDays);
  return { start, end: addDays(start, windowDays - 1) };
}
export const inWindow = (date: string | undefined, w: { start: string; end: string }): boolean =>
  !!date && date >= w.start && date <= w.end;

// ── 순위 샘플 ──
// 하루 1개(같은 날 재수집이면 최신값으로 덮음). 최근 SAMPLE_KEEP_DAYS 일치만 보관.
export function appendSample(samples: RankSample[] | undefined, sample: RankSample): RankSample[] {
  const rest = (samples ?? []).filter(s => s.date !== sample.date);
  return [...rest, sample].sort((a, b) => a.date.localeCompare(b.date)).slice(-SAMPLE_KEEP_DAYS);
}

// ── 레거시 건수 보장(count) ──
// 순위가 하나라도 잡혀 있으면 카운트(목표순위 미적용 — 기존 데이터 안정성 유지). best/current/legacy 모두 인정.
export const isRanked = (it: RankGuaranteeItem): boolean =>
  (!!it.bestByTab && Object.values(it.bestByTab).some(v => typeof v === 'number')) ||
  (!!it.rankByTab && Object.values(it.rankByTab).some(v => typeof v === 'number')) || it.rank != null;
export const countAchieved = (rg: Pick<RankGuarantee, 'items' | 'cycle'>): number =>
  rg.items.filter(it => it.cycle === rg.cycle && isRanked(it)).length;

// 현재 회차의 대상 항목.
export const coverageItems = (rg: Pick<RankGuarantee, 'items' | 'cycle'>): RankGuaranteeItem[] =>
  rg.items.filter(it => it.cycle === rg.cycle);

// ── 월 건바이건(count_monthly) ──
// 윈도우(포스팅일 기준) 안에서 '목표순위 이내'로 잡힌 건수.
//  • 판정은 bestByTab(역대 최고) 기준 → 1일이라도 달성하면 카운트, 재수집으로 밀려도 안 빠짐.
export function countInWindow(rg: Pick<RankGuarantee, 'items' | 'cycle' | 'targetRank' | 'judgeTabs'>, w: { start: string; end: string }): number {
  return coverageItems(rg).filter(it => {
    const judge = judgeOf(it, rg);
    const r = bestJudged(it, judge);
    if (r == null || r > judge.targetRank) return false;
    const date = it.postDate ?? it.rankedAt ?? (it.samples?.length ? it.samples[it.samples.length - 1].date : undefined);
    return inWindow(date, w);
  }).length;
}

// ── 키워드 월보장(keyword_coverage) ──
// 윈도우 안에서 판정순위가 목표순위 '이내'인 서로 다른 날 수.
export function coveredDays(item: RankGuaranteeItem, w: { start: string; end: string }, judge: Judge): number {
  const seen = new Set<string>();
  for (const s of item.samples ?? []) {
    if (s.date < w.start || s.date > w.end) continue;
    const r = sampleJudged(s, judge.judgeTabs);
    if (r != null && r <= judge.targetRank) seen.add(s.date);
  }
  return seen.size;
}
// 임계 = 목표 - 알림오프셋 (건수/일수 공통). 음수 방지.
export const thresholdOf = (target: number, alertOffset: number): number => Math.max(0, target - alertOffset);

export function itemMet(item: RankGuaranteeItem, guaranteedDays: number, w: { start: string; end: string }, judge: Judge): boolean {
  return coveredDays(item, w, judge) >= guaranteedDays;
}
// 이번 구간에서 산술적으로 더는 달성 불가(남은 일수 < 부족 일수) → 이탈위험.
export function itemAtRisk(item: RankGuaranteeItem, guaranteedDays: number, w: { start: string; end: string }, judge: Judge, today = todayStr()): boolean {
  const need = guaranteedDays - coveredDays(item, w, judge);
  if (need <= 0) return false;
  const remaining = Math.max(0, dayDiff(w.end, today));
  return remaining < need;
}

// ── 방식별 상태 파생 ──
export function deriveStatus(
  rg: Pick<RankGuarantee, 'type' | 'items' | 'cycle' | 'guaranteedCount' | 'guaranteedDays' | 'windowDays' | 'alertOffset' | 'closed' | 'targetRank' | 'judgeTabs'>,
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
    if (items.every(it => itemMet(it, gDays, w, judgeOf(it, rg)))) return 'reached';
    const dueSoon = items.some(it => {
      const need = gDays - coveredDays(it, w, judgeOf(it, rg));
      return need > 0 && need <= rg.alertOffset;
    });
    return dueSoon ? 'due_soon' : 'active';
  }

  const n = type === 'count_monthly'
    ? countInWindow(rg, currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today))
    : countAchieved(rg);
  if (n >= rg.guaranteedCount) return 'reached';
  if (n >= thresholdOf(rg.guaranteedCount, rg.alertOffset)) return 'due_soon';
  return 'active';
}

// 방식별 진척(분자/분모/단위) — UI 진행바·알림 문구를 한 곳에서 통일.
export function progress(
  rg: Pick<RankGuarantee, 'type' | 'items' | 'cycle' | 'guaranteedCount' | 'guaranteedDays' | 'windowDays' | 'targetRank' | 'judgeTabs'>,
  ctx: { anchorDate?: string; today?: string } = {},
): { n: number; target: number; unit: string } {
  const type = guaranteeType(rg);
  const today = ctx.today ?? todayStr();
  if (type === 'monitor') return { n: coverageItems(rg).length, target: 0, unit: '키워드' };
  if (type === 'keyword_coverage') {
    const items = coverageItems(rg);
    const gDays = rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS;
    const w = currentWindow(ctx.anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS, today);
    return { n: items.filter(it => itemMet(it, gDays, w, judgeOf(it, rg))).length, target: items.length, unit: '키워드' };
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

// 판정탭 프리셋(생성 폼 UI). 순서·라벨 단일 소스.
export const JUDGE_PRESETS: { key: string; label: string; tabs: SearchTab[] }[] = [
  { key: 'any', label: '둘 중 아무데나', tabs: ['integrated', 'blog'] },
  { key: 'integrated', label: '통합검색만', tabs: ['integrated'] },
  { key: 'blog', label: '블로그탭만', tabs: ['blog'] },
  { key: 'cafe', label: '카페탭만', tabs: ['cafe'] },
];
export const judgePresetKey = (tabs: SearchTab[] | undefined): string => {
  const t = tabs && tabs.length ? tabs : DEFAULT_JUDGE_TABS;
  return JUDGE_PRESETS.find(p => p.tabs.length === t.length && p.tabs.every(x => t.includes(x)))?.key ?? 'any';
};

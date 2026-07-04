import type { ScheduleEntry, SearchTab } from '../types';
import { foundRanks, bestRank } from './searchTabs';

// 클라이언트 포털 "AI 마케팅 인사이트" 계산 — AI 실패 시 폴백 + 데모용으로 공용 사용한다.
// (기존 DemoInsight 컴포넌트의 계산/문구 로직을 추출)

const nf = (n: number) => n.toLocaleString();

// 메인 + 서브키워드 순위를 한 줄씩 평탄화(둘 다 rankByTab 의 최고값을 대표순위로).
//  → 인사이트/차트가 롱테일(서브키워드) 순위까지 함께 소비하도록 하는 단일 소스.
export interface FlatRank { category: string; keyword: string; rank: number; isSub: boolean; link?: string }
export function collectRanks(entries: ScheduleEntry[]): FlatRank[] {
  const out: FlatRank[] = [];
  for (const e of entries) {
    const main = e.rank ?? bestRank(e.rankByTab);
    if (main != null && e.keyword) out.push({ category: e.category, keyword: e.keyword, rank: main, isSub: false, link: e.link });
    for (const s of e.subKeywords ?? []) {
      const r = bestRank(s.rankByTab);
      if (r != null) out.push({ category: e.category, keyword: s.keyword, rank: r, isSub: true, link: e.link });
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}

// 업무에서 PV(조회수) 추출 — views 우선, 없으면 블로그/카페 조회 합산
export function pvOf(e: ScheduleEntry): number {
  const m = e.metrics;
  if (!m) return 0;
  return m.views ?? ((m.blogViews ?? 0) + (m.cafeViews ?? 0));
}

export interface InsightStats {
  total: number;
  completed: number;
  totalPv: number;
  topChannel?: [string, number];
  best?: FlatRank;        // 최고 순위(메인·서브 통합)
  top5: number;           // 5위 이내 키워드 수(메인+서브)
  subRanked: number;      // 순위 잡힌 서브(롱테일) 키워드 수
  topContent?: ScheduleEntry; // 최고 조회수 콘텐츠
}

export function insightStats(entries: ScheduleEntry[]): InsightStats {
  const total = entries.length;
  const completed = entries.filter(e => e.status === 'completed').length;
  const totalPv = entries.reduce((s, e) => s + pvOf(e), 0);

  const pvByCh: Record<string, number> = {};
  entries.forEach(e => { const pv = pvOf(e); if (pv > 0) pvByCh[e.category] = (pvByCh[e.category] ?? 0) + pv; });
  const topChannel = Object.entries(pvByCh).sort((a, b) => b[1] - a[1])[0];

  // 메인 + 서브키워드 순위를 통합해 집계(롱테일도 성과에 포함)
  const ranks = collectRanks(entries);
  const top5 = ranks.filter(r => r.rank <= 5).length;
  const best = ranks[0];
  const subRanked = ranks.filter(r => r.isSub).length;

  const topContent = [...entries].sort((a, b) => pvOf(b) - pvOf(a))[0];
  return { total, completed, totalPv, topChannel, best, top5, subRanked, topContent };
}

// 결정적(정확) 집계 — 카테고리별 건수 + 순위 잡힌 항목(메인 + 서브키워드). 화면에서 live 로 계산해 항상 최신.
export interface RankedTab { tab: SearchTab; rank: number }
export interface RankedSub { keyword: string; rank: number; tabs: RankedTab[] }
export interface RankedItem {
  category: string;
  keyword: string;
  rank: number | null;   // 메인 대표순위(null=메인 미노출이나 서브는 잡힘)
  tabs: RankedTab[];      // 메인 탭별 순위
  link?: string;
  subs: RankedSub[];      // 순위 잡힌 서브(롱테일) 키워드 — 순위 오름차순
}
export interface InsightBreakdown {
  total: number;
  completed: number;
  byCategory: { category: string; total: number; completed: number }[]; // 건수 많은 순
  ranked: RankedItem[];  // 대표순위 오름차순(메인 또는 서브 중 최고)
}
// 정렬 키: 메인 순위 우선, 메인이 없으면 가장 좋은 서브 순위, 둘 다 없으면 뒤로.
const sortKey = (r: RankedItem) => r.rank ?? r.subs[0]?.rank ?? 999;

export function insightBreakdown(entries: ScheduleEntry[]): InsightBreakdown {
  const total = entries.length;
  const completed = entries.filter(e => e.status === 'completed').length;

  const map = new Map<string, { total: number; completed: number }>();
  for (const e of entries) {
    const g = map.get(e.category) ?? { total: 0, completed: 0 };
    g.total += 1;
    if (e.status === 'completed') g.completed += 1;
    map.set(e.category, g);
  }
  const byCategory = [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  const ranked: RankedItem[] = entries
    .map(e => {
      const tabs = foundRanks(e.rankByTab);
      const rank = e.rank ?? (tabs.length ? Math.min(...tabs.map(t => t.rank)) : null);
      const subs: RankedSub[] = (e.subKeywords ?? [])
        .map(s => ({ keyword: s.keyword, tabs: foundRanks(s.rankByTab) }))
        .filter(s => s.tabs.length > 0)
        .map(s => ({ keyword: s.keyword, rank: Math.min(...s.tabs.map(t => t.rank)), tabs: s.tabs }))
        .sort((a, b) => a.rank - b.rank);
      return { category: e.category, keyword: e.keyword ?? '', rank, tabs, link: e.link, subs };
    })
    .filter(r => (r.rank != null && r.keyword) || r.subs.length > 0)
    .sort((a, b) => sortKey(a) - sortKey(b));

  return { total, completed, byCategory, ranked };
}

export interface InsightContent { narrative: string; highlights: string[] }

// 규칙기반 인사이트(브리핑 문단 + 핵심 포인트). dateLabel 예: "어제(6/24)".
export function ruleBasedInsight(entries: ScheduleEntry[], dateLabel: string): InsightContent {
  const s = insightStats(entries);

  const parts: string[] = [];
  if (s.total === 0) {
    parts.push(`${dateLabel} 집행된 마케팅 활동이 없습니다. 오늘 진행되는 작업은 완료 후 내일 인사이트에 반영됩니다.`);
  } else {
    parts.push(`${dateLabel} 기준 총 ${s.total}건의 마케팅 활동을 집행했고, 그중 ${s.completed}건이 완료되었습니다.`);
    if (s.totalPv > 0) parts.push(`누적 노출(PV)은 약 ${nf(s.totalPv)}회로, 전반적인 도달이 안정적으로 확대되는 흐름입니다.`);
    if (s.topChannel) parts.push(`특히 ${s.topChannel[0]} 채널이 ${nf(s.topChannel[1])}회로 노출을 견인했습니다.`);
    if (s.top5 > 0 && s.best?.keyword) parts.push(`네이버 상위노출에서는 '${s.best.keyword}'가 ${s.best.rank}위에 안착하는 등 핵심 키워드 ${s.top5}건이 5위 이내에 진입했습니다.`);
    if (s.subRanked > 0) parts.push(`메인 키워드 외에 롱테일(세부) 키워드 ${s.subRanked}건도 검색 상위에 노출되며 유입 경로가 넓어지고 있습니다.`);
  }

  const highlights: string[] = [];
  if (s.topContent && pvOf(s.topContent) > 0) {
    highlights.push(`최고 성과 콘텐츠: ${s.topContent.category} '${s.topContent.keyword ?? '-'}' — 조회수 ${nf(pvOf(s.topContent))}회`);
  }
  if (s.best?.keyword) {
    highlights.push(`상위노출 최고 순위: '${s.best.keyword}'${s.best.isSub ? '(세부)' : ''} ${s.best.rank}위 (5위 이내 키워드 ${s.top5}건 확보)`);
  }
  if (s.subRanked > 0) {
    highlights.push(`롱테일 노출 확대: 세부 키워드 ${s.subRanked}건이 검색 상위에 함께 노출되고 있습니다.`);
  }
  highlights.push(
    s.topChannel
      ? `다음 단계 제안: 성과가 검증된 ${s.topChannel[0]} 채널에 집중하고, 상위 콘텐츠 포맷을 시리즈화해 도달을 확장하는 것을 권장합니다.`
      : `다음 단계 제안: 핵심 키워드의 상위노출을 유지하며 콘텐츠 발행 빈도를 높이는 것을 권장합니다.`,
  );

  return { narrative: parts.join(' '), highlights };
}

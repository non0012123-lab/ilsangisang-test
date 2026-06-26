// 순위 수집 대상 검색 탭(다중 선택) 관련 헬퍼.
//  - 광고주마다 보고 싶은 탭이 달라 일정별로 다중 선택한다(블로그관리는 통합+블로그 둘 다 등).
//  - 탭별 순위는 entry.rankByTab 에 저장되고, 대표 entry.rank 는 그중 '최고(min)' 값으로 산출한다.
//    → 기존 보고서/인사이트(reportPdf, clientInsight)가 entry.rank 한 칸만 읽으므로 그대로 동작.
import type { SearchTab, Category } from '../types';

export const SEARCH_TAB_ORDER: SearchTab[] = ['integrated', 'blog', 'cafe'];

export const SEARCH_TAB_LABEL: Record<SearchTab, string> = {
  integrated: '통합검색',
  blog: '블로그탭',
  cafe: '카페탭',
};

// 순위 수집 대상(검색 탭 선택을 노출할) 카테고리.
export const isRankTrackedCategory = (c?: Category | string): boolean =>
  c === '블로그 상위노출' || c === '블로그관리' || c === '카페 상위노출';

// 카테고리별 기본 선택 탭. 블로그관리는 통합/블로그 어디든 잡히면 되므로 둘 다 기본.
export const defaultSearchTabs = (c?: Category | string): SearchTab[] => {
  if (c === '카페 상위노출') return ['cafe'];
  if (c === '블로그관리') return ['integrated', 'blog'];
  if (c === '블로그 상위노출') return ['integrated'];
  return [];
};

// 대표 순위 = 선택 탭 중 최고(min). 수집값이 하나도 없으면 undefined.
export const bestRank = (rankByTab?: Partial<Record<SearchTab, number | null>>): number | undefined => {
  if (!rankByTab) return undefined;
  const vals = Object.values(rankByTab).filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.min(...vals) : undefined;
};

import type { Category, AIMetrics } from '../types';

// ── 업무 카테고리 단일 소스 ───────────────────────────────
// 카테고리 목록·색·아이콘·지표가 예전엔 ~12개 파일에 복붙돼 있었다. 여기 한 곳에서만 정의하고
// 모든 화면/보고서/AI 가 import 해서 쓴다. 새 카테고리는 여기에만 추가하면 전부 반영된다.
//  • 네이버 계열(블로그/카페/클립 + 여론작업)은 "네이버" 그룹으로 묶어 보여 준다(NAVER_FAMILY).

// 드롭다운/AI 에 쓰는 전체 순서 목록 (그룹이 보이도록 네이버 계열을 모아 둠)
export const CATEGORIES: Category[] = [
  '네이버', '블로그 상위노출', '블로그관리', '블로그 배포', '카페 상위노출', '카페 배포', '클립', '네이버 여론작업',
  'SNS', '유튜브', '영상제작', '디자인제작', '기타',
];

// 보고서/포털에서 "네이버 마케팅"으로 묶어 집계할 계열 (여론작업은 별도 섹션이므로 제외)
export const NAVER_FAMILY: Category[] = [
  '네이버', '블로그 상위노출', '블로그관리', '블로그 배포', '카페 상위노출', '카페 배포', '클립',
];

// 표시용 짧은 라벨 (값과 다를 때만; 없으면 카테고리명 그대로)
export const CATEGORY_LABEL: Partial<Record<Category, string>> = {
  '네이버 여론작업': '여론작업',
};
export const catLabel = (c: Category): string => CATEGORY_LABEL[c] ?? c;

// 뱃지 앞 아이콘 (네이버 계열만)
export const CATEGORY_ICON: Partial<Record<Category, string>> = {
  '블로그 상위노출': '📝', '블로그관리': '📝', '블로그 배포': '📝',
  '카페 상위노출': '☕', '카페 배포': '☕',
  '클립': '🎬',
};

// 색: 뱃지(Tailwind class) + 차트/PDF(hex) 통합. 네이버 계열은 초록~청록~호박~자홍 계열로 묶어 식별.
export interface CategoryColor { bg: string; text: string; hex: string }
export const CATEGORY_COLORS: Record<Category, CategoryColor> = {
  '네이버':          { bg: 'bg-green-100',   text: 'text-green-700',   hex: '#22c55e' },
  '블로그 상위노출': { bg: 'bg-emerald-100', text: 'text-emerald-700', hex: '#10b981' },
  '블로그관리':      { bg: 'bg-teal-100',    text: 'text-teal-700',    hex: '#14b8a6' },
  '블로그 배포':     { bg: 'bg-lime-100',    text: 'text-lime-700',    hex: '#65a30d' },
  '카페 상위노출':   { bg: 'bg-cyan-100',    text: 'text-cyan-700',    hex: '#06b6d4' },
  '카페 배포':       { bg: 'bg-amber-100',   text: 'text-amber-700',   hex: '#f59e0b' },
  '클립':            { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', hex: '#d946ef' },
  '네이버 여론작업': { bg: 'bg-sky-100',     text: 'text-sky-700',     hex: '#0ea5e9' },
  'SNS':             { bg: 'bg-pink-100',    text: 'text-pink-700',    hex: '#ec4899' },
  '유튜브':          { bg: 'bg-red-100',     text: 'text-red-700',     hex: '#ef4444' },
  '영상제작':        { bg: 'bg-purple-100',  text: 'text-purple-700',  hex: '#a855f7' },
  '디자인제작':      { bg: 'bg-orange-100',  text: 'text-orange-700',  hex: '#f97316' },
  '기타':            { bg: 'bg-gray-100',    text: 'text-gray-700',    hex: '#6b7280' },
};
// hex 만 빠르게 뽑는 헬퍼 (차트/PDF용 색 맵 대체)
export const catHex = (c: string): string => CATEGORY_COLORS[c as Category]?.hex ?? '#6b7280';

// 드롭다운 <optgroup> 렌더용 — 네이버 계열을 한 묶음으로 보여 준다.
export interface CategoryGroup { label: string; items: Category[] }
export const CATEGORY_GROUPS: CategoryGroup[] = [
  { label: '네이버', items: ['네이버', '블로그 상위노출', '블로그관리', '블로그 배포', '카페 상위노출', '카페 배포', '클립', '네이버 여론작업'] },
  { label: '기타 채널', items: ['SNS', '유튜브', '영상제작', '디자인제작', '기타'] },
];

// 카테고리 → 관련 AI 지표 입력 필드 (ScheduleModal 에서 이동)
export const CATEGORY_METRICS: Record<string, { key: keyof AIMetrics; label: string }[]> = {
  'SNS':             [{ key: 'impressions', label: '노출수' }, { key: 'reach', label: '도달수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }, { key: 'saves', label: '저장수' }, { key: 'shares', label: '공유수' }, { key: 'followers', label: '팔로워 증가' }],
  '유튜브':          [{ key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }, { key: 'subscribers', label: '구독자 증가' }, { key: 'watchTime', label: '평균 시청시간' }],
  '네이버':          [{ key: 'blogViews', label: '블로그 조회수' }, { key: 'cafeViews', label: '카페 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  '블로그 상위노출': [{ key: 'blogViews', label: '블로그 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  '블로그관리':      [{ key: 'blogViews', label: '블로그 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  '블로그 배포':     [{ key: 'blogViews', label: '블로그 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  '카페 상위노출':   [{ key: 'cafeViews', label: '카페 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  '카페 배포':       [{ key: 'cafeViews', label: '카페 조회수' }, { key: 'comments', label: '댓글수' }],
  '클립':            [{ key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }],
  '영상제작':        [{ key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }],
  '디자인제작':      [{ key: 'impressions', label: '노출수' }, { key: 'saves', label: '저장수' }, { key: 'clicks', label: '클릭수' }],
  '네이버 여론작업': [{ key: 'views', label: '조회수' }, { key: 'comments', label: '댓글수' }],
  '기타':            [{ key: 'views', label: '조회수' }, { key: 'clicks', label: '클릭수' }],
};

// ── 네이버 카테고리 줄임말 정규화 ──────────────────────────
// 한국 현업에서 "상노=상위노출, 블관/관리=블로그관리, 카상·카상노=카페 상위노출" 처럼
// 줄임말을 많이 쓴다. AI/사용자 입력의 category·keyword 에서 이 신호어를 읽어
//  ① 정확한 카테고리(또는 블로그/카페 모호 시 후보들)로 보정하고
//  ② 키워드에 섞여 들어온 신호어("강남치과 상노" → "강남치과")를 떼어낸다.

// 키워드에서 제거할 작업종류/줄임말 표현(긴 것부터). 브랜드명에 잘 안 쓰이는 업무어만 골라 담음.
const STRIP_TOKENS = [
  '블로그 상위노출', '블로그상위노출', '카페 상위노출', '카페상위노출',
  '블로그 관리', '블로그관리', '블로그 배포', '블로그배포', '카페 배포', '카페배포',
  '네이버 클립', '네이버클립', '여론작업',
  '블상노', '카상노', '블상', '블배', '블관', '카상', '카배',
  '상위노출', '상노', '배포', '관리', '클립', '여론',
];

const SANGWI_RE = /상위\s*노출|상노|블상|카상|상위|노출/;   // 상위노출 계열
const BAEPO_RE = /배포|블배|카배/;                          // 배포 계열
const GWANLI_RE = /블로그\s*관리|블관|관리/;                // 관리(=블로그관리)
const CLIP_RE = /클립/;                                     // 클립
const YEORON_RE = /여론/;                                   // 여론작업
const CAFE_RE = /카페|카상|카배|카노|카관/;                 // 카페 신호
const BLOG_RE = /블로그|블상|블배|블관|블노/;               // 블로그 신호

export interface NaverNorm { category?: string; categoryOptions?: string[]; categorySignal?: string; keyword?: string }

// category(원문) + keyword 를 보고 네이버 세부 카테고리를 보정한다.
//  • aiCategory 가 이미 네이버 세부/여론/클립이면 그 분류는 신뢰하고 키워드만 정리한다.
//  • aiCategory 가 ''·'네이버'·'기타'(=모호) 일 때만 신호어로 분류를 덮어쓴다(SNS·유튜브 등은 건드리지 않음).
export function normalizeNaverCategory(aiCategory?: string, keyword?: string, aiOptions?: string[]): NaverNorm {
  const t = `${aiCategory ?? ''} ${keyword ?? ''}`;
  const validOpts = (aiOptions ?? []).filter(c => (CATEGORIES as string[]).includes(c));

  // 1) 키워드에서 업무 신호어 떼어내기
  let kw = keyword ?? '';
  for (const tok of STRIP_TOKENS) kw = kw.split(tok).join(' ');
  kw = kw.replace(/[·∙•\-_/|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanedKeyword = kw || undefined;

  // 2) 카테고리 보정 — 이미 구체적인 카테고리면 분류는 유지
  const concrete = new Set<string>(['블로그 상위노출', '블로그관리', '블로그 배포', '카페 상위노출', '카페 배포', '클립', '네이버 여론작업']);
  if (aiCategory && concrete.has(aiCategory)) {
    return { category: aiCategory, categoryOptions: validOpts.length >= 2 ? validOpts : undefined, keyword: cleanedKeyword };
  }
  const ambiguousBucket = !aiCategory || aiCategory === '네이버' || aiCategory === '기타';
  if (!ambiguousBucket) return {}; // SNS/유튜브/영상제작 등은 그대로 둠(보정/키워드정리 안 함)

  const isCafe = CAFE_RE.test(t);
  const isBlog = BLOG_RE.test(t);
  const pick = (blog: string, cafe: string): NaverNorm =>
    isCafe ? { category: cafe, keyword: cleanedKeyword }
      : isBlog ? { category: blog, keyword: cleanedKeyword }
      : { category: blog, categoryOptions: [blog, cafe], keyword: cleanedKeyword }; // 플랫폼 불명 → 후보 제시

  if (CLIP_RE.test(t)) return { category: '클립', keyword: cleanedKeyword };
  if (YEORON_RE.test(t)) return { category: '네이버 여론작업', keyword: cleanedKeyword };
  if (GWANLI_RE.test(t)) {
    // "블로그관리/블관" 처럼 블로그가 명시되면 확정. 단독 "관리"는 블로그·홈페이지(기타)·추후 카페가 모두
    // 가능하므로 모호 처리 → [블로그관리, 기타] 후보 제시. '기타' 선택 시 신호어("관리")를 키워드에 되살린다.
    if (isBlog) return { category: '블로그관리', keyword: cleanedKeyword };
    return { category: '블로그관리', categoryOptions: ['블로그관리', '기타'], categorySignal: '관리', keyword: cleanedKeyword };
  }
  if (SANGWI_RE.test(t)) return validOpts.length >= 2 ? { ...pick('블로그 상위노출', '카페 상위노출'), categoryOptions: validOpts } : pick('블로그 상위노출', '카페 상위노출');
  if (BAEPO_RE.test(t)) return validOpts.length >= 2 ? { ...pick('블로그 배포', '카페 배포'), categoryOptions: validOpts } : pick('블로그 배포', '카페 배포');
  return {}; // 네이버 신호 없음 → 손대지 않음
}

// 후보 칩 클릭 시 카테고리 확정 + 키워드의 신호어 재배치.
//  • '기타'를 고르면(카테고리가 업무종류를 못 담음) 신호어("관리")를 키워드에 되살린다("홈페이지" → "홈페이지 관리").
//  • 구체 카테고리를 고르면 신호어를 키워드에서 떼어 둔 상태로 유지한다.
export function applyCategoryChoice(keyword: string | undefined, signal: string | undefined, category: string): { keyword?: string } {
  if (!signal) return { keyword };
  const base = (keyword ?? '').split(signal).join(' ').replace(/\s+/g, ' ').trim();
  const kw = category === '기타' ? `${base} ${signal}`.trim() : base;
  return { keyword: kw || undefined };
}

import type { ScheduleEntry } from '../types';

// 클라이언트 포털 "AI 마케팅 인사이트" 계산 — AI 실패 시 폴백 + 데모용으로 공용 사용한다.
// (기존 DemoInsight 컴포넌트의 계산/문구 로직을 추출)

const nf = (n: number) => n.toLocaleString();

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
  best?: ScheduleEntry;   // 최고 순위(1위에 가까운) 작업
  top5: number;           // 5위 이내 키워드 수
  topContent?: ScheduleEntry; // 최고 조회수 콘텐츠
}

export function insightStats(entries: ScheduleEntry[]): InsightStats {
  const total = entries.length;
  const completed = entries.filter(e => e.status === 'completed').length;
  const totalPv = entries.reduce((s, e) => s + pvOf(e), 0);

  const pvByCh: Record<string, number> = {};
  entries.forEach(e => { const pv = pvOf(e); if (pv > 0) pvByCh[e.category] = (pvByCh[e.category] ?? 0) + pv; });
  const topChannel = Object.entries(pvByCh).sort((a, b) => b[1] - a[1])[0];

  const ranked = entries.filter(e => e.rank != null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const top5 = ranked.filter(e => (e.rank ?? 99) <= 5).length;
  const best = ranked[0];

  const topContent = [...entries].sort((a, b) => pvOf(b) - pvOf(a))[0];
  return { total, completed, totalPv, topChannel, best, top5, topContent };
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
  }

  const highlights: string[] = [];
  if (s.topContent && pvOf(s.topContent) > 0) {
    highlights.push(`최고 성과 콘텐츠: ${s.topContent.category} '${s.topContent.keyword ?? '-'}' — 조회수 ${nf(pvOf(s.topContent))}회`);
  }
  if (s.best?.keyword) {
    highlights.push(`상위노출 최고 순위: '${s.best.keyword}' ${s.best.rank}위 (5위 이내 키워드 ${s.top5}건 확보)`);
  }
  highlights.push(
    s.topChannel
      ? `다음 단계 제안: 성과가 검증된 ${s.topChannel[0]} 채널에 집중하고, 상위 콘텐츠 포맷을 시리즈화해 도달을 확장하는 것을 권장합니다.`
      : `다음 단계 제안: 핵심 키워드의 상위노출을 유지하며 콘텐츠 발행 빈도를 높이는 것을 권장합니다.`,
  );

  return { narrative: parts.join(' '), highlights };
}

// 데모(쇼케이스) 전용 — 광고주 포털 첫 화면에 "AI 마케팅 인사이트" 요약을 보여준다.
// 전문 마케터가 현황을 브리핑하듯, 선택 기간의 실제 데모 수치에서 뽑아 문장을 구성한다.
// (데모 한정 UI. 실제 클라이언트에는 노출되지 않는다 — ClientPortalPage 에서 isDemo 일 때만 렌더)
import { Sparkles, TrendingUp, Target, Lightbulb } from 'lucide-react';
import type { ScheduleEntry } from '../types';

function pvOf(e: ScheduleEntry): number {
  const m = e.metrics;
  if (!m) return 0;
  return m.views ?? ((m.blogViews ?? 0) + (m.cafeViews ?? 0));
}
const nf = (n: number) => n.toLocaleString();

export default function DemoInsight({ entries, rangeLabel }: { entries: ScheduleEntry[]; rangeLabel: string }) {
  const total = entries.length;
  const completed = entries.filter(e => e.status === 'completed').length;
  const totalPv = entries.reduce((s, e) => s + pvOf(e), 0);

  // 채널별 PV 집계 → 최고 효율 채널
  const pvByCh: Record<string, number> = {};
  entries.forEach(e => { const pv = pvOf(e); if (pv > 0) pvByCh[e.category] = (pvByCh[e.category] ?? 0) + pv; });
  const topCh = Object.entries(pvByCh).sort((a, b) => b[1] - a[1])[0];

  // 순위 성과
  const ranked = entries.filter(e => e.rank != null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const top5 = ranked.filter(e => (e.rank ?? 99) <= 5).length;
  const best = ranked[0];

  // 최고 조회수 콘텐츠
  const topContent = [...entries].sort((a, b) => pvOf(b) - pvOf(a))[0];

  const narrative = (() => {
    const parts: string[] = [];
    parts.push(`${rangeLabel} 기준 총 ${total}건의 마케팅 활동을 집행했고, 그중 ${completed}건이 완료되었습니다.`);
    if (totalPv > 0) parts.push(`누적 노출(PV)은 약 ${nf(totalPv)}회로, 전반적인 도달이 안정적으로 확대되는 흐름입니다.`);
    if (topCh) parts.push(`특히 ${topCh[0]} 채널이 ${nf(topCh[1])}회로 노출을 견인하며 이번 기간의 핵심 성장 동력이 되었습니다.`);
    if (top5 > 0 && best?.keyword) parts.push(`네이버 상위노출에서는 '${best.keyword}'가 ${best.rank}위에 안착하는 등 핵심 키워드 ${top5}건이 5위 이내에 진입했습니다.`);
    return parts.join(' ');
  })();

  const highlights: { icon: React.ReactNode; text: string }[] = [];
  if (topContent && pvOf(topContent) > 0) {
    highlights.push({ icon: <TrendingUp size={14} className="text-blue-600" />, text: `최고 성과 콘텐츠: ${topContent.category} '${topContent.keyword}' — 조회수 ${nf(pvOf(topContent))}회` });
  }
  if (best?.keyword) {
    highlights.push({ icon: <Target size={14} className="text-green-600" />, text: `상위노출 최고 순위: '${best.keyword}' ${best.rank}위 (5위 이내 키워드 ${top5}건 확보)` });
  }
  highlights.push({
    icon: <Lightbulb size={14} className="text-amber-500" />,
    text: topCh
      ? `다음 단계 제안: 성과가 검증된 ${topCh[0]} 채널에 예산을 집중하고, 상위 콘텐츠 포맷을 시리즈화해 도달을 확장하는 것을 권장합니다.`
      : `다음 단계 제안: 핵심 키워드의 상위노출을 유지하며 콘텐츠 발행 빈도를 높이는 것을 권장합니다.`,
  });

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <Sparkles size={15} className="text-white" />
        </div>
        <h3 className="font-bold text-gray-900 text-sm">AI 마케팅 인사이트</h3>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">AI 분석</span>
        <span className="ml-auto text-xs text-gray-400">{rangeLabel} 요약</span>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-4">{narrative}</p>

      <div className="space-y-2">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2 border border-white">
            <span className="mt-0.5 shrink-0">{h.icon}</span>
            <span className="text-xs text-gray-700 leading-relaxed">{h.text}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-gray-400">※ 본 인사이트는 집행 데이터를 기반으로 자동 생성된 요약입니다.</p>
    </div>
  );
}

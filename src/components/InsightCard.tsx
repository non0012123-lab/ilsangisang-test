// 광고주 포털 "AI 마케팅 인사이트" 카드.
//  • 구조표(카테고리별 건수·순위·링크)는 부모가 실제 데이터에서 계산(insightBreakdown)해 넘긴다 → 항상 정확.
//  • narrative 는 그 수치를 해석한 AI 코멘트(없으면 생성 중/규칙기반). 링크는 읽기전용 외부 링크.
import { Sparkles, ExternalLink, Trophy, Loader2 } from 'lucide-react';
import type { Category } from '../types';
import type { InsightBreakdown } from '../utils/clientInsight';
import { CATEGORY_ICON, catLabel } from '../data/categories';

interface Props {
  breakdown: InsightBreakdown;
  dateLabel: string;       // 예: "어제(6/23)" / "지난 7일"
  narrative?: string;      // AI 코멘트(아직 생성 전이면 undefined)
  aiGenerated?: boolean;
  generating?: boolean;    // 실제 AI 호출 중일 때만 true → "생성 중" 표기(캐시/로딩 플래시와 구분)
}

export default function InsightCard({ breakdown, dateLabel, narrative, aiGenerated = true, generating = false }: Props) {
  const { total, completed, byCategory, ranked } = breakdown;
  const empty = total === 0;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <Sparkles size={15} className="text-white" />
        </div>
        <h3 className="font-bold text-gray-900 text-sm">AI 마케팅 인사이트</h3>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{aiGenerated ? 'AI 분석' : '요약'}</span>
        <span className="ml-auto text-xs text-gray-400">{dateLabel} 기준</span>
      </div>

      {empty ? (
        <p className="text-sm text-gray-500 leading-relaxed">{dateLabel} 집행된 마케팅 활동이 없습니다. 진행되는 작업은 완료 후 다음 인사이트에 반영됩니다.</p>
      ) : (
        <>
          {/* 요약 + 카테고리별 건수 */}
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-bold text-gray-900">{dateLabel}</span> 총 <span className="font-bold">{total}건</span> 중 <span className="font-bold text-green-600">{completed}건 완료</span>
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {byCategory.map(c => (
              <span key={c.category} className="inline-flex items-center gap-1 bg-white/80 border border-gray-100 rounded-full px-2.5 py-1 text-xs text-gray-700">
                <span>{CATEGORY_ICON[c.category as Category] ?? '•'}</span>
                <span className="font-semibold">{catLabel(c.category as Category)}</span>
                <span className="text-gray-500">{c.total}건{c.completed < c.total ? ` (완료 ${c.completed})` : ''}</span>
              </span>
            ))}
          </div>

          {/* 순위 잡힌 항목 — 키워드·순위·링크 */}
          {ranked.length > 0 && (
            <div className="bg-white/70 rounded-xl border border-white p-3 mb-3">
              <p className="flex items-center gap-1 text-[11px] font-bold text-gray-500 mb-1.5"><Trophy size={12} className="text-amber-500" /> 순위 현황</p>
              <ul className="space-y-1">
                {ranked.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-700">
                    <span className={`font-bold tabular-nums ${r.rank <= 5 ? 'text-green-600' : 'text-gray-500'}`}>{r.rank}위</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-medium">{catLabel(r.category as Category)}</span>
                    <span className="truncate">‘{r.keyword}’</span>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline shrink-0 ml-auto">
                        <ExternalLink size={12} /> 링크
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI 코멘트(해석·제안) — 캐시가 있으면 즉시 표시. 진짜 생성 중일 때만 로딩 문구 */}
          {narrative
            ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{narrative}</p>
            : generating
              ? <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> AI 코멘트를 생성하는 중입니다…</p>
              : null}
        </>
      )}

      <p className="mt-3 text-[10px] text-gray-400">※ 건수·순위는 실제 집행 데이터이며, 코멘트는 {aiGenerated ? 'AI가 ' : ''}이를 해석해 자동 생성합니다.</p>
    </div>
  );
}

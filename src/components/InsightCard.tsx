// 광고주 포털 "AI 마케팅 인사이트" 카드(표시 전용).
//  • 계산/생성은 하지 않는다 — 부모가 AI 결과(또는 규칙기반 폴백, utils/clientInsight)를 narrative/highlights 로 넘긴다.
//  • 당일 화면엔 "어제" 기준 인사이트가 들어온다(dateLabel 로 표기).
import { Sparkles, Lightbulb } from 'lucide-react';

interface Props {
  narrative: string;
  highlights: string[];
  dateLabel: string;     // 예: "어제(6/24)"
  aiGenerated?: boolean; // false 면 규칙기반 폴백 표시
}

export default function InsightCard({ narrative, highlights, dateLabel, aiGenerated = true }: Props) {
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

      <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{narrative}</p>

      {highlights.length > 0 && (
        <div className="space-y-2">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2 border border-white">
              <span className="mt-0.5 shrink-0"><Lightbulb size={14} className="text-amber-500" /></span>
              <span className="text-xs text-gray-700 leading-relaxed">{h}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-400">※ 본 인사이트는 어제까지의 집행 데이터를 기반으로 {aiGenerated ? 'AI가 ' : ''}자동 생성된 요약입니다.</p>
    </div>
  );
}

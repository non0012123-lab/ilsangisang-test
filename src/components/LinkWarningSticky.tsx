// 링크-키워드 불일치(잘못된 링크 삽입) 의심 항목을 어느 페이지에서든 우상단에 알림.
//  • "몇월 몇일 · 클라이언트 · 키워드 — 링크가 키워드와 맞지 않습니다" 목록. 세션 동안 닫기 가능.
import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { linkKeywordMismatch } from '../utils/searchTabs';

export default function LinkWarningSticky() {
  const { entries } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const warnings = useMemo(() => entries.filter(linkKeywordMismatch), [entries]);
  if (dismissed || warnings.length === 0) return null;

  const fmt = (d: string) => { const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}`; };

  return (
    <div className="fixed right-4 top-16 lg:top-4 z-40 w-[19rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-red-200 overflow-hidden">
      <div className="flex items-center justify-between bg-red-50 px-3 py-2">
        <span className="text-xs font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle size={13} /> 링크 확인 필요 {warnings.length}건</span>
        <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </div>
      <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
        {warnings.slice(0, 20).map(e => (
          <div key={e.id} className="px-3 py-1.5 text-[11px] text-gray-700 leading-snug">
            <span className="text-gray-400">{fmt(e.date)}</span> · <span className="font-medium">{e.clientName}</span> · {e.keyword}
            <span className="text-red-500"> — 링크가 키워드와 맞지 않습니다</span>
          </div>
        ))}
        {warnings.length > 20 && <div className="px-3 py-1.5 text-[10px] text-gray-400">외 {warnings.length - 20}건…</div>}
      </div>
    </div>
  );
}

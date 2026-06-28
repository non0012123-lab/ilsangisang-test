// 링크-키워드 불일치(잘못된 링크 삽입) 의심 항목을 어느 페이지에서든 우상단에 알림.
//  • "몇월 몇일 · 클라이언트 · 키워드 — 링크가 키워드와 맞지 않습니다" 목록.
//  • 닫힌 항목 id 를 localStorage 에 보관 → Layout 리마운트(페이지 이동)에도 닫힘 유지.
//    새로 생긴(다른 id) 경고는 다시 표시된다.
import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { linkKeywordMismatch } from '../utils/searchTabs';

const DISMISS_KEY = 'linkWarnDismissedIds';
const loadDismissed = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[]); } catch { return new Set(); }
};

export default function LinkWarningSticky() {
  const { entries } = useApp();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(loadDismissed);

  const warnings = useMemo(() => entries.filter(linkKeywordMismatch), [entries]);
  const visible = warnings.filter(w => !dismissedIds.has(w.id));
  if (visible.length === 0) return null;

  const save = (next: Set<string>) => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    setDismissedIds(next);
  };
  const dismiss = () => { const next = new Set(dismissedIds); visible.forEach(w => next.add(w.id)); save(next); };
  const dismissOne = (id: string) => { const next = new Set(dismissedIds); next.add(id); save(next); };

  const fmt = (d: string) => { const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}`; };

  return (
    <div className="fixed right-4 top-16 lg:top-4 z-40 w-[19rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-red-200 overflow-hidden">
      <div className="flex items-center justify-between bg-red-50 px-3 py-2">
        <span className="text-xs font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle size={13} /> 링크 확인 필요 {visible.length}건</span>
        <button onClick={dismiss} title="모두 닫기" className="text-[11px] font-semibold text-red-400 hover:text-red-600">모두 닫기</button>
      </div>
      <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
        {visible.slice(0, 20).map(e => (
          <div key={e.id} className="flex items-start gap-1.5 px-3 py-1.5 text-[11px] text-gray-700 leading-snug">
            <div className="flex-1">
              <span className="text-gray-400">{fmt(e.date)}</span> · <span className="font-medium">{e.clientName}</span> · {e.keyword}
              <span className="text-red-500"> — 링크가 키워드와 맞지 않습니다</span>
            </div>
            <button onClick={() => dismissOne(e.id)} title="이 항목 확인(닫기)"
              className="shrink-0 mt-0.5 text-gray-300 hover:text-red-500"><X size={13} /></button>
          </div>
        ))}
        {visible.length > 20 && <div className="px-3 py-1.5 text-[10px] text-gray-400">외 {visible.length - 20}건…</div>}
      </div>
    </div>
  );
}

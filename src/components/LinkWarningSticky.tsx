// 링크-키워드 불일치(잘못된 링크 삽입) 의심 항목을 어느 페이지에서든 우상단에 알림.
//  • "몇월 몇일 · 클라이언트 · 키워드 — 링크가 키워드와 맞지 않습니다" 목록.
//  • 닫기 = 그 일정의 현재 제목을 '확인 처리'(linkConfirmedTitle) 로 저장(Supabase 영속).
//    → 표 배지·이 알림이 함께 사라지고, 재배포·다른 기기에도 유지. 제목/링크가 바뀌면 자동 재경고.
import { useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { linkKeywordMismatch } from '../utils/searchTabs';

export default function LinkWarningSticky() {
  const { entries, patchEntry } = useApp();

  const visible = useMemo(() => entries.filter(linkKeywordMismatch), [entries]);
  if (visible.length === 0) return null;

  const dismissOne = (id: string, title?: string) => patchEntry(id, { linkConfirmedTitle: title ?? '' });
  const dismiss = () => visible.forEach(w => dismissOne(w.id, w.postTitle));

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
            <button onClick={() => dismissOne(e.id, e.postTitle)} title="이 항목 확인(닫기)"
              className="shrink-0 mt-0.5 text-gray-300 hover:text-red-500"><X size={13} /></button>
          </div>
        ))}
        {visible.length > 20 && <div className="px-3 py-1.5 text-[10px] text-gray-400">외 {visible.length - 20}건…</div>}
      </div>
    </div>
  );
}

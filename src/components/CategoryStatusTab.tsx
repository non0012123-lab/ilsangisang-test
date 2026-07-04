// 클라이언트 포털 '카테고리별 현황' 탭 — 선택 기간 작업을 카테고리(매체)별로 묶어 카드로.
//  건수·완료/진행/예정 + (순위추적이면) 최고순위·5위내 수 + 입력된 지표 합계.
import type { ScheduleEntry, Category, AIMetrics } from '../types';
import CategoryBadge from './CategoryBadge';
import { CATEGORY_METRICS } from '../data/categories';
import { foundRanks } from '../utils/searchTabs';

const nf = (n: number) => n.toLocaleString('ko-KR');

export default function CategoryStatusTab({ entries }: { entries: ScheduleEntry[] }) {
  const byCat = new Map<Category, ScheduleEntry[]>();
  for (const e of entries) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e);
    byCat.set(e.category, arr);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);

  if (cats.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm bg-white border border-gray-100 rounded-2xl">이 기간에 진행된 작업이 없습니다.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {cats.map(([cat, es]) => {
        const done = es.filter(e => e.status === 'completed').length;
        const prog = es.filter(e => e.status === 'in-progress').length;
        const pend = es.filter(e => e.status === 'pending').length;
        // 순위(탭별 잡힌 순위) 요약
        const ranks = es.flatMap(e => foundRanks(e.rankByTab).map(f => f.rank));
        const best = ranks.length ? Math.min(...ranks) : null;
        const top5 = ranks.filter(r => r <= 5).length;
        // 입력된 지표 합계(값이 있는 것만)
        const metricVals = (CATEGORY_METRICS[cat] ?? [])
          .map(m => ({ label: m.label, sum: es.reduce((s, e) => s + (Number(e.metrics?.[m.key as keyof AIMetrics]) || 0), 0) }))
          .filter(m => m.sum > 0);

        return (
          <div key={cat} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <CategoryBadge category={cat} />
              <span className="text-xs text-gray-400">{es.length}건</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-green-600 font-semibold">완료 {done}</span>
              <span className="text-blue-600 font-semibold">진행 {prog}</span>
              <span className="text-amber-600 font-semibold">예정 {pend}</span>
              {best != null && <span className="text-indigo-600 font-semibold ml-auto">최고 {best}위 · 5위내 {top5}건</span>}
            </div>
            {metricVals.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {metricVals.slice(0, 6).map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-gray-400 truncate">{m.label}</p>
                    <p className="text-sm font-bold text-gray-900">{nf(m.sum)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

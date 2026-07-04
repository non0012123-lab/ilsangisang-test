// 클라이언트 포털 '카테고리별' 탭 — 카테고리(매체)별로 작업 내역을 아코디언으로 열람.
//  • 헤더: 카테고리 + 건수 + 완료/진행/예정 요약. 클릭하면 그 카테고리 작업 내역이 펼쳐진다.
//  • 항목: 날짜·키워드(+링크)·순위(탭 영역)·상태 + 순위추적이면 롱테일 서브키워드, 여론작업이면 내용.
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, CornerDownRight } from 'lucide-react';
import type { ScheduleEntry, Category } from '../types';
import CategoryBadge from './CategoryBadge';
import { foundRanks, SEARCH_TAB_SHORT, isMultiLinkCategory, entryLinks } from '../utils/searchTabs';

// 어느 탭에서 몇 위인지 "통합 3위 · 블로그 5위". rankByTab 없으면 대표순위(레거시).
const tabRankText = (e: ScheduleEntry): string => {
  const fr = foundRanks(e.rankByTab);
  if (fr.length) return fr.map(f => `${SEARCH_TAB_SHORT[f.tab]} ${f.rank}위`).join(' · ');
  return e.rank ? `${e.rank}위` : '';
};
const rankedSubs = (e: ScheduleEntry): { keyword: string; label: string }[] =>
  (e.subKeywords ?? [])
    .map(s => ({ keyword: s.keyword, found: foundRanks(s.rankByTab) }))
    .filter(s => s.found.length > 0)
    .map(s => ({ keyword: s.keyword, label: s.found.map(f => `${SEARCH_TAB_SHORT[f.tab]} ${f.rank}위`).join(' · ') }));

const STATUS = {
  completed: { label: '완료', cls: 'bg-green-50 text-green-700' },
  'in-progress': { label: '진행중', cls: 'bg-blue-50 text-blue-700' },
  pending: { label: '대기중', cls: 'bg-amber-50 text-amber-700' },
} as const;

function EntryItem({ e }: { e: ScheduleEntry }) {
  const st = STATUS[e.status] ?? STATUS.pending;
  const rank = tabRankText(e);
  const subs = rankedSubs(e);
  const isMulti = isMultiLinkCategory(e.category);
  const links = entryLinks(e);
  const title = e.keyword || e.opinionTitle || '-';
  return (
    <div className="py-2 border-t border-gray-50 first:border-t-0">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-400 whitespace-nowrap shrink-0">{e.date}</span>
        <span className="font-medium text-gray-800 break-keep">{title}</span>
        {isMulti && links.length > 0 && <span className="text-sky-600 font-bold whitespace-nowrap">{links.length}건</span>}
        {rank && <span className="text-blue-700 font-bold whitespace-nowrap">{rank}</span>}
        {!isMulti && e.link && (
          <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-500 hover:underline shrink-0">
            <ExternalLink size={11} /> 링크
          </a>
        )}
        <span className={`ml-auto shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
      </div>
      {/* 롱테일(세부) 키워드 */}
      {subs.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 pl-1 mt-0.5 text-[11px] text-gray-500">
          <CornerDownRight size={11} className="text-gray-300 shrink-0" />
          <span className="text-indigo-600 font-semibold whitespace-nowrap">{s.label}</span>
          <span className="truncate">{s.keyword}</span>
        </div>
      ))}
      {/* 다건 링크 목록(여론작업·배포) */}
      {isMulti && links.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5 pl-1">
          {links.map((l, i) => (
            <a key={i} href={l} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline max-w-full">
              <ExternalLink size={10} className="shrink-0" /><span className="truncate">{l}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryStatusTab({ entries }: { entries: ScheduleEntry[] }) {
  const byCat = new Map<Category, ScheduleEntry[]>();
  for (const e of entries) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e);
    byCat.set(e.category, arr);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
  // 각 카테고리 항목은 최신순 정렬
  cats.forEach(([, es]) => es.sort((a, b) => b.date.localeCompare(a.date)));

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (c: string) => setOpen(p => ({ ...p, [c]: !p[c] }));

  if (cats.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm bg-white border border-gray-100 rounded-2xl">이 기간에 진행된 작업이 없습니다.</p>;
  }

  return (
    <div className="space-y-2.5">
      {cats.map(([cat, es], idx) => {
        const isOpen = open[cat] ?? idx === 0; // 기본: 건수 많은 첫 카테고리만 펼침
        const done = es.filter(e => e.status === 'completed').length;
        const prog = es.filter(e => e.status === 'in-progress').length;
        const pend = es.filter(e => e.status === 'pending').length;
        return (
          <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => toggle(cat)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50/70 transition-colors text-left">
              {isOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
              <CategoryBadge category={cat} />
              <span className="text-xs text-gray-400">{es.length}건</span>
              <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold shrink-0">
                {done > 0 && <span className="text-green-600">완료 {done}</span>}
                {prog > 0 && <span className="text-blue-600">진행 {prog}</span>}
                {pend > 0 && <span className="text-amber-600">예정 {pend}</span>}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3">
                {es.map(e => <EntryItem key={e.id} e={e} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

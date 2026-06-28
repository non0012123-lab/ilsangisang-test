// 스케줄 행에서 탭별 수집 순위를 한눈에 보여주는 배지.
//  - 성공(숫자) = 파랑 · 미노출(null) = 노랑 · 미수집(키없음) = 회색
//  - 순위 추적 대상이 아니거나 탭 미설정이면 기존 단일 rank 표시(하위호환)
//  - showChecked=true 면 마지막 수집 시각(상대시간)을 아래 작게 표시(카드용)
import { AlertTriangle, X } from 'lucide-react';
import type { ScheduleEntry, SearchTab } from '../types';
import { SEARCH_TAB_ORDER, SEARCH_TAB_LABEL, isRankTrackedCategory, linkKeywordMismatch } from '../utils/searchTabs';
import { useApp } from '../context/AppContext';

const SHORT: Record<SearchTab, string> = { integrated: '통합', blog: '블로그', cafe: '카페' };

function relTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function RankTabsBadge({ entry, showChecked = false }: { entry: ScheduleEntry; showChecked?: boolean }) {
  const { patchEntry } = useApp();
  const tabs = entry.searchTabs;

  // 순위 추적 대상 아님/탭 미설정 → 기존 단일 rank
  if (!isRankTrackedCategory(entry.category) || !tabs || tabs.length === 0) {
    return entry.rank != null
      ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}</span>
      : <span className="text-gray-300">-</span>;
  }

  const order = SEARCH_TAB_ORDER.filter(t => tabs.includes(t));
  const lastChecked = order
    .map(t => entry.rankCheckedAt?.[t])
    .filter((v): v is string => !!v)
    .sort()
    .slice(-1)[0];
  const mismatch = linkKeywordMismatch(entry);

  return (
    <div className="flex flex-col gap-0.5 items-start">
      {mismatch && (
        <span title="제목이 키워드와 맞지 않고 어느 탭에도 미발견 — 링크가 잘못 들어갔는지 확인하세요. ×를 누르면 확인 처리(경고 숨김)."
          className="inline-flex items-center gap-1 pl-1.5 pr-0.5 h-6 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold border border-red-200">
          <AlertTriangle size={11} /> 링크확인
          <button onClick={e => { e.stopPropagation(); patchEntry(entry.id, { linkConfirmedTitle: entry.postTitle }); }}
            title="확인했어요 (이 경고 숨기기)"
            className="ml-0.5 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600"><X size={11} /></button>
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {order.map(t => {
          const r = entry.rankByTab?.[t];
          const checked = entry.rankCheckedAt?.[t];
          const found = typeof r === 'number';
          const notFound = r === null;
          const cls = found ? 'bg-blue-50 text-blue-700' : notFound ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400';
          const val = found ? `${r}위` : notFound ? '미노출' : '미수집';
          const title = `${SEARCH_TAB_LABEL[t]} · ${val}${checked ? ` · ${relTime(checked)}` : ''}`;
          return (
            <span key={t} title={title}
              className={`inline-flex items-center gap-1 px-1.5 h-6 rounded-lg text-[11px] font-semibold ${cls}`}>
              <span className="opacity-60 font-medium">{SHORT[t]}</span>{val}
            </span>
          );
        })}
      </div>
      {showChecked && lastChecked && <span className="text-[10px] text-gray-400">{relTime(lastChecked)} 수집</span>}
    </div>
  );
}

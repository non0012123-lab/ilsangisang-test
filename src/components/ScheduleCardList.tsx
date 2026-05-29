import { Pencil, Trash2, CalendarRange } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import InlineStatus from './InlineStatus';
import InlineScreenshot from './InlineScreenshot';
import InlineLink from './InlineLink';
import { isMultiDay } from '../utils/dateRange';
import type { ScheduleEntry, ScheduleStatus } from '../types';

interface Props {
  entries: ScheduleEntry[];
  onPatch: (id: string, patch: Partial<ScheduleEntry>) => void;
  onPreview: (img: string) => void;
  onEdit?: (entry: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
  onCopied?: () => void;
  emptyText?: string;
}

// 모바일(md 미만)에서 스케줄 표 대신 보여주는 카드 리스트
export default function ScheduleCardList({ entries, onPatch, onPreview, onEdit, onDelete, onCopied, emptyText = '조건에 맞는 스케줄이 없습니다.' }: Props) {
  if (entries.length === 0) {
    return <div className="md:hidden bg-white rounded-2xl border border-gray-100 py-10 text-center text-gray-400 text-sm">{emptyText}</div>;
  }
  return (
    <div className="md:hidden space-y-3">
      {entries.map(entry => (
        <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
              {isMultiDay(entry)
                ? <><CalendarRange size={13} className="text-blue-600" /> {entry.date}<span className="text-gray-300">~</span>{entry.endDate?.slice(5)}</>
                : entry.date}
            </span>
            {(onEdit || onDelete) && (
              <div className="flex gap-1">
                {onEdit && <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>}
                {onDelete && <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <CategoryBadge category={entry.category} />
            <InlineStatus status={entry.status} onChange={(s: ScheduleStatus) => onPatch(entry.id, { status: s })} />
            {entry.rank ? <span className="inline-flex items-center justify-center px-2 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}위</span> : null}
          </div>
          <p className="font-semibold text-gray-900 text-sm mb-0.5 break-words">{entry.opinionTitle ?? entry.keyword ?? '-'}</p>
          <p className="text-xs text-gray-500 mb-2">{entry.managerName} · {entry.clientName}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <InlineLink link={entry.link} onChange={v => onPatch(entry.id, { link: v })} onCopied={onCopied} />
            <InlineScreenshot screenshot={entry.screenshot} onChange={v => onPatch(entry.id, { screenshot: v })} onPreview={onPreview} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 일정 표/카드의 링크 칸 — 다건(여론작업·배포)이면 'N건 + 링크 목록', 그 외엔 기존 단일 InlineLink(인라인 편집).
//  다건 링크의 개별 편집은 일정 수정 모달에서 한다(여기선 읽기 표시 + 바로가기).
import { ExternalLink } from 'lucide-react';
import type { ScheduleEntry } from '../types';
import { isMultiLinkCategory, entryLinks } from '../utils/searchTabs';
import InlineLink from './InlineLink';

export default function EntryLinkCell({
  entry, onChange, onCopied,
}: {
  entry: ScheduleEntry;
  onChange: (v: string | undefined) => void;
  onCopied?: () => void;
}) {
  if (isMultiLinkCategory(entry.category)) {
    const links = entryLinks(entry);
    if (links.length === 0) return <span className="text-gray-300 text-xs">-</span>;
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-semibold text-sky-600">{links.length}건</span>
        {links.map((l, i) => (
          <a key={i} href={l} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline max-w-full">
            <ExternalLink size={11} className="shrink-0" /><span className="truncate">{l}</span>
          </a>
        ))}
      </div>
    );
  }
  return <InlineLink link={entry.link} onChange={onChange} onCopied={onCopied} />;
}

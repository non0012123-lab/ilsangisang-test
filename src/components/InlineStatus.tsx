import { useState, useRef, useEffect } from 'react';
import type { ScheduleStatus } from '../types';

const OPTIONS: { value: ScheduleStatus; label: string; dot: string; text: string; bg: string }[] = [
  { value: 'pending',     label: '대기중', dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50' },
  { value: 'in-progress', label: '진행중', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50' },
  { value: 'completed',   label: '완료',   dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50' },
];

export default function InlineStatus({
  status,
  onChange,
}: {
  status: ScheduleStatus;
  onChange: (s: ScheduleStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const cur = OPTIONS.find(o => o.value === status)!;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-75 ${cur.bg} ${cur.text}`}
        title="클릭하여 상태 변경"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.dot}`} />
        {cur.label}
        <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-40 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[104px]">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors ${opt.value === status ? `${opt.text} font-semibold` : 'text-gray-700'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
              {opt.label}
              {opt.value === status && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

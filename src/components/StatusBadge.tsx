import type { ScheduleStatus } from '../types';

const CONFIG: Record<ScheduleStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  label: '대기중' },
  'in-progress':{ bg: 'bg-blue-50',  text: 'text-blue-700',   dot: 'bg-blue-400',   label: '진행중' },
  completed:   { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400',  label: '완료' },
};

export default function StatusBadge({ status }: { status: ScheduleStatus }) {
  const { bg, text, dot, label } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

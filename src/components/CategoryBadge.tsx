import type { Category } from '../types';

const CONFIG: Record<Category, { bg: string; text: string; label: string }> = {
  SNS:            { bg: 'bg-pink-100',   text: 'text-pink-700',   label: 'SNS' },
  유튜브:         { bg: 'bg-red-100',    text: 'text-red-700',    label: '유튜브' },
  네이버:         { bg: 'bg-green-100',  text: 'text-green-700',  label: '네이버' },
  영상제작:       { bg: 'bg-purple-100', text: 'text-purple-700', label: '영상제작' },
  디자인제작:     { bg: 'bg-orange-100', text: 'text-orange-700', label: '디자인제작' },
  '네이버 여론작업': { bg: 'bg-sky-100', text: 'text-sky-700',   label: '여론작업' },
  기타:           { bg: 'bg-gray-100',   text: 'text-gray-700',   label: '기타' },
};

export default function CategoryBadge({ category }: { category: Category }) {
  const { bg, text, label } = CONFIG[category] ?? CONFIG['기타'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${bg} ${text}`}>
      {label}
    </span>
  );
}

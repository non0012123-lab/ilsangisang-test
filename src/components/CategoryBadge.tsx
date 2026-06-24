import type { Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICON, catLabel } from '../data/categories';

export default function CategoryBadge({ category }: { category: Category }) {
  const c = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['기타'];
  const icon = CATEGORY_ICON[category];
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${c.bg} ${c.text}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {catLabel(category)}
    </span>
  );
}

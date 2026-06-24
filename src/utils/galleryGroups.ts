import type { ScheduleEntry, Category, ImageKind } from '../types';
import { entryImages } from './entryImages';
import { CATEGORIES as ORDER } from '../data/categories';

// 갤러리에 표시할 이미지 1장 + 출처(어떤 일정인지) 정보
export interface GalleryImage {
  url: string;
  kind: ImageKind;
  date: string;
  endDate?: string;
  keyword?: string;
  managerName: string;
}
// 매체(카테고리)별 묶음 — 시안/인사이트 분리
export interface GalleryGroup {
  category: Category;
  design: GalleryImage[];
  insight: GalleryImage[];
}

// 일정들의 첨부 이미지를 매체(카테고리)별로 모으고, 각 매체 안에서 시안/인사이트로 분리한다.
export function buildGalleryGroups(entries: ScheduleEntry[]): GalleryGroup[] {
  const byCat = new Map<Category, { design: GalleryImage[]; insight: GalleryImage[] }>();
  for (const e of entries) {
    const imgs = entryImages(e);
    if (!imgs.length) continue;
    let g = byCat.get(e.category);
    if (!g) { g = { design: [], insight: [] }; byCat.set(e.category, g); }
    for (const im of imgs) {
      const gi: GalleryImage = { url: im.url, kind: im.kind, date: e.date, endDate: e.endDate, keyword: e.keyword, managerName: e.managerName };
      (im.kind === 'insight' ? g.insight : g.design).push(gi);
    }
  }
  // 정해진 매체 순서대로, 이미지가 있는 매체만 반환
  return ORDER.filter(c => byCat.has(c)).map(c => ({ category: c, ...byCat.get(c)! }));
}

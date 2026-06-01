import type { ScheduleEntry, EntryImage } from '../types';

// 한 일정에 첨부할 수 있는 이미지 최대 장수 (디자인제작 SNS 카드 등 다중 첨부 고려)
export const MAX_IMAGES = 10;

// 레거시(단일 screenshot, 문자열 배열)와 신규({url,kind} 배열)를 모두 EntryImage[] 로 정규화한다.
// 종류가 없던 과거 데이터는 모두 '시안(design)' 으로 본다.
export function entryImages(e: Pick<ScheduleEntry, 'images' | 'screenshot'>): EntryImage[] {
  const raw = e.images;
  if (raw && raw.length) {
    return raw.map(img => (typeof img === 'string' ? { url: img, kind: 'design' as const } : { url: img.url, kind: img.kind ?? 'design' }));
  }
  return e.screenshot ? [{ url: e.screenshot, kind: 'design' }] : [];
}

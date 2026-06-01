import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import { buildGalleryGroups, type GalleryImage } from '../utils/galleryGroups';
import type { ScheduleEntry } from '../types';

const caption = (im: GalleryImage) =>
  `${im.date}${im.endDate && im.endDate > im.date ? ` ~ ${im.endDate.slice(5)}` : ''}${im.keyword ? ` · ${im.keyword}` : ''}`;

// 매체(카테고리)별로 묶고, 각 매체 안에서 시안/인사이트를 분리해 보여주는 갤러리.
// 인사이트(글씨·숫자·그래프)는 크게(잘림 없이), 시안은 그리드로. 클릭 시 원본 확대.
export default function ImageGallery({ entries, title = '첨부 이미지' }: { entries: ScheduleEntry[]; title?: string }) {
  const groups = buildGalleryGroups(entries);
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (groups.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
        <ImageIcon size={16} className="text-blue-600" />
        <h3 className="font-bold text-gray-900">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">매체별 · 시안/인사이트</span>
      </div>
      <div className="p-4 sm:p-6 space-y-7">
        {groups.map(g => (
          <div key={g.category}>
            <div className="flex items-center gap-2 mb-3">
              <CategoryBadge category={g.category} />
              <span className="text-xs text-gray-400">시안 {g.design.length} · 인사이트 {g.insight.length}</span>
            </div>

            {g.design.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">시안 · 결과물</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {g.design.map((im, i) => (
                    <figure key={i}>
                      <img src={im.url} alt={caption(im)} onClick={() => setLightbox(im.url)}
                        className="w-full aspect-square object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                      <figcaption className="text-[10px] text-gray-400 mt-1 truncate" title={caption(im)}>{caption(im)}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {g.insight.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-2">인사이트 (데이터)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {g.insight.map((im, i) => (
                    <figure key={i} className="border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                      <img src={im.url} alt={caption(im)} onClick={() => setLightbox(im.url)}
                        className="w-full max-h-[480px] object-contain rounded-lg cursor-pointer bg-white" />
                      <figcaption className="text-[11px] text-gray-500 mt-1.5">{caption(im)} · {im.managerName}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="원본 이미지" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

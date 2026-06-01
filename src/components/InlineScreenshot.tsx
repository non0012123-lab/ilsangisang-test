import { useState } from 'react';
import { Camera, Pencil, X } from 'lucide-react';
import ImageDropzone from './ImageDropzone';
import ImageThumb from './ImageThumb';
import { MAX_IMAGES } from '../utils/entryImages';
import type { EntryImage } from '../types';

interface Props {
  images: EntryImage[];
  onImagesChange: (images: EntryImage[]) => void;
  onPreview: (url: string) => void;
}

// 표/카드의 이미지 칸. 작아서 직접 드롭하면 엉뚱한 곳에 떨어질 수 있어,
// 클릭하면 네모난 팝업을 띄우고 그 안에서 여러 장(최대 10장)을 관리한다.
// 각 이미지는 시안/인사이트로 구분(인사이트는 보고서에 크게 표시).
export default function InlineScreenshot({ images, onImagesChange, onPreview }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const add = (url: string) => { if (images.length < MAX_IMAGES) onImagesChange([...images, { url, kind: 'design' }]); };
  const removeAt = (i: number) => onImagesChange(images.filter((_, idx) => idx !== i));
  const toggleKind = (i: number) => onImagesChange(images.map((im, idx) => idx === i ? { ...im, kind: im.kind === 'insight' ? 'design' : 'insight' } : im));

  const picker = pickerOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickerOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-900">이미지 <span className="text-gray-400 font-normal">({images.length}/{MAX_IMAGES})</span></h3>
          <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">배지를 눌러 <b>시안 / 인사이트</b>를 전환하세요. 인사이트는 보고서에서 크게 표시됩니다.</p>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.map((img, i) => (
              <ImageThumb key={i} img={img} onClick={() => onPreview(img.url)} onToggleKind={() => toggleKind(i)} onRemove={() => removeAt(i)} />
            ))}
          </div>
        )}
        {images.length < MAX_IMAGES
          ? <ImageDropzone className="w-full h-36" onImage={add} />
          : <p className="text-xs text-amber-600 text-center py-2">최대 {MAX_IMAGES}장까지 첨부할 수 있습니다.</p>}
      </div>
    </div>
  );

  if (images.length > 0) {
    return (
      <div className="relative inline-block group">
        <img
          src={images[0].url}
          alt="이미지"
          className="w-9 h-9 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onPreview(images[0].url)}
          title="클릭하여 원본 보기"
        />
        {images.length > 1 && (
          <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] font-bold leading-none px-1 py-0.5 rounded-full border border-white">+{images.length - 1}</span>
        )}
        <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex">
          <button
            onClick={() => setPickerOpen(true)}
            className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
            title="이미지 관리"
          >
            <Pencil size={8} />
          </button>
        </div>
        {picker}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className="w-9 h-9 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-colors"
        title="이미지 업로드"
      >
        <Camera size={14} />
      </button>
      {picker}
    </>
  );
}

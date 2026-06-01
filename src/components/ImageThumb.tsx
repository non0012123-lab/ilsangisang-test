import { X } from 'lucide-react';
import type { EntryImage } from '../types';

interface Props {
  img: EntryImage;
  onClick?: () => void;      // 클릭 시 원본 보기
  onToggleKind: () => void;  // 시안 ↔ 인사이트 전환
  onRemove: () => void;
}

// 첨부 이미지 한 장: 썸네일 + 종류 배지(클릭 전환) + 삭제. 모달/인라인 팝업 공용.
export default function ImageThumb({ img, onClick, onToggleKind, onRemove }: Props) {
  const insight = img.kind === 'insight';
  return (
    <div className="relative group aspect-square">
      <img src={img.url} alt={insight ? '인사이트 이미지' : '시안 이미지'} onClick={onClick}
        className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
      <button type="button" onClick={onToggleKind} title="시안 / 인사이트 전환 (인사이트는 보고서에 크게 표시)"
        className={`absolute bottom-1 left-1 text-[9px] font-bold leading-none px-1.5 py-1 rounded-full border border-white shadow ${insight ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'}`}>
        {insight ? '인사이트' : '시안'}
      </button>
      <button type="button" onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow">
        <X size={11} />
      </button>
    </div>
  );
}

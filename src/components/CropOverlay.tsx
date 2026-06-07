import { useRef, useState } from 'react';
import { Check, X, Crop, Image as ImageIcon } from 'lucide-react';
import { autoFileName } from '../utils/capture';

// 캡처본 위에서 사각형을 드래그해 영역을 잘라 저장하거나, 전체를 저장한다.
//  • src: "data:image/png;base64,…" 형태
//  • onSave(base64, filename): 접두사 없는 base64 + 파일명
export default function CropOverlay({ src, onSave, onCancel }: {
  src: string;
  onSave: (base64: string, filename: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [filename, setFilename] = useState(autoFileName());
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const rel = (e: React.MouseEvent) => {
    const box = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - box.left, box.width)),
      y: Math.max(0, Math.min(e.clientY - box.top, box.height)),
    };
  };
  const onDown = (e: React.MouseEvent) => { const p = rel(e); setStart(p); setRect({ x: p.x, y: p.y, w: 0, h: 0 }); };
  const onMove = (e: React.MouseEvent) => {
    if (!start) return;
    const p = rel(e);
    setRect({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
  };
  const onUp = () => setStart(null);

  const fname = () => (filename.trim() || autoFileName());

  const saveFull = () => onSave(src.split(',')[1] ?? '', fname());
  const saveRegion = () => {
    const img = imgRef.current!;
    if (!rect || rect.w < 4 || rect.h < 4) return;
    const scale = img.naturalWidth / img.getBoundingClientRect().width; // 표시→원본 픽셀 비율
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * scale);
    canvas.height = Math.round(rect.h * scale);
    canvas.getContext('2d')!.drawImage(
      img, rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale,
      0, 0, canvas.width, canvas.height,
    );
    onSave(canvas.toDataURL('image/png').split(',')[1], fname());
  };

  const hasRegion = !!rect && rect.w >= 4 && rect.h >= 4;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 text-white text-sm flex-wrap">
        <span className="font-medium">캡처 저장</span>
        <span className="text-white/60 text-xs">전체를 저장하거나, 드래그해 영역만 저장하세요</span>
        <input value={filename} onChange={e => setFilename(e.target.value)}
          className="ml-auto w-56 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="파일명" />
        <button onClick={saveFull} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">
          <ImageIcon size={14} /> 전체 저장
        </button>
        <button onClick={saveRegion} disabled={!hasRegion}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg font-semibold">
          <Crop size={14} /> 영역 저장
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg">
          <X size={14} /> 취소
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <div className="relative inline-block select-none" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <img ref={imgRef} src={src} alt="capture" className="max-w-full block" draggable={false} />
          {rect && rect.w > 0 && (
            <div className="absolute border-2 border-emerald-400 bg-emerald-400/15 pointer-events-none flex items-center justify-center"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              {hasRegion && <Check size={18} className="text-emerald-300" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

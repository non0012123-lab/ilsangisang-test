import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onImage?: (dataUrl: string) => void;        // 1장씩(레거시 호환)
  onImages?: (dataUrls: string[]) => void;    // 여러 장 한 번에(드롭/선택 다중)
  // 크기/모양 지정용 (예: 'w-full h-48'). 기본은 정사각형 느낌의 박스.
  className?: string;
}

// 클릭 또는 드래그앤드롭으로 이미지 여러 장을 받는 사각형 드롭존.
export default function ImageDropzone({ onImage, onImages, className = 'w-full h-44' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target?.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  // 드롭/선택된 이미지 파일 "전부"를 읽어 한 번에 넘긴다(개별 setState 로 인한 유실 방지).
  const loadFiles = async (list?: FileList | null) => {
    const imgs = [...(list ?? [])].filter(f => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    const urls = (await Promise.all(imgs.map(f => readAsDataUrl(f).catch(() => '')))).filter(Boolean);
    if (urls.length === 0) return;
    if (onImages) onImages(urls);
    else urls.forEach(u => onImage?.(u));
  };

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); void loadFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer text-center px-4 transition-colors ${className} ${
        dragOver
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-500'
      }`}
    >
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { void loadFiles(e.target.files); e.target.value = ''; }} />
      <Upload size={28} className={dragOver ? 'text-blue-500' : 'text-gray-400'} />
      <p className="text-sm font-semibold">{dragOver ? '여기에 놓으세요' : '이미지를 여기로 드래그앤 드롭'}</p>
      <p className="text-xs text-gray-400">여러 장 한 번에 · 또는 클릭하여 선택</p>
    </div>
  );
}

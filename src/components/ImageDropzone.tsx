import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onImage: (dataUrl: string) => void;
  // 크기/모양 지정용 (예: 'w-full h-48'). 기본은 정사각형 느낌의 박스.
  className?: string;
}

// 클릭 또는 드래그앤드롭으로 이미지 1장을 받는 사각형 드롭존.
export default function ImageDropzone({ onImage, className = 'w-full h-44' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => onImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files?.[0]); }}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer text-center px-4 transition-colors ${className} ${
        dragOver
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-500'
      }`}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
      <Upload size={28} className={dragOver ? 'text-blue-500' : 'text-gray-400'} />
      <p className="text-sm font-semibold">{dragOver ? '여기에 놓으세요' : '이미지를 여기로 드래그앤 드롭'}</p>
      <p className="text-xs text-gray-400">또는 클릭하여 파일 선택</p>
    </div>
  );
}

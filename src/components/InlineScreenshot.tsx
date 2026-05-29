import { useRef } from 'react';
import { Camera, Pencil, X } from 'lucide-react';

interface Props {
  screenshot?: string;
  onChange: (v: string | undefined) => void;
  onPreview: (url: string) => void;
}

export default function InlineScreenshot({ screenshot, onChange, onPreview }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (screenshot) {
    return (
      <div className="relative inline-block group">
        <img
          src={screenshot}
          alt="캡처본"
          className="w-9 h-9 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onPreview(screenshot)}
          title="클릭하여 원본 보기"
        />
        <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
            title="교체"
          >
            <Pencil size={8} />
          </button>
          <button
            onClick={() => onChange(undefined)}
            className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            title="삭제"
          >
            <X size={8} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-9 h-9 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-colors"
        title="캡처본 업로드"
      >
        <Camera size={14} />
      </button>
    </>
  );
}

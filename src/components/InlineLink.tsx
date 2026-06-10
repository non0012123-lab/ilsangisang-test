import { useState, useRef, useEffect } from 'react';
import { ExternalLink, Copy, Plus, Check, X } from 'lucide-react';
import { toNasForOS } from '../utils/nasPath';

interface Props {
  link?: string;
  onChange: (v: string | undefined) => void;
  onCopied?: () => void;
  className?: string;
}

export default function InlineLink({ link, onChange, onCopied, className = '' }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(link ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    const v = value.trim();
    onChange(v === '' ? undefined : v);
    setEditing(false);
  };

  const cancel = () => {
    setValue(link ?? '');
    setEditing(false);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    });
    onCopied?.();
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type="url"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          placeholder="https://..."
          className="flex-1 min-w-0 border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0" title="저장"><Check size={12} /></button>
        <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded shrink-0" title="취소"><X size={12} /></button>
      </div>
    );
  }

  if (!link) {
    return (
      <button
        onClick={() => { setValue(''); setEditing(true); }}
        className={`flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors ${className}`}
        title="링크 첨부"
      >
        <Plus size={12} /> 링크 추가
      </button>
    );
  }

  // NAS 경로는 보는 사람 OS 방언(\\… ↔ smb://…)으로 표시·복사. 웹 링크는 원문 그대로.
  const shown = toNasForOS(link);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <a href={shown} target="_blank" rel="noopener noreferrer"
        className="table-link link-cell" title={shown}>{shown}</a>
      <div className="flex gap-0.5 shrink-0">
        <a href={shown} target="_blank" rel="noopener noreferrer"
          className="p-1 text-gray-300 hover:text-blue-500 transition-colors" title="새 탭으로 열기">
          <ExternalLink size={12} />
        </a>
        <button onClick={() => copy(shown)} className="p-1 text-gray-300 hover:text-gray-700 transition-colors" title="링크 복사">
          <Copy size={12} />
        </button>
        <button onClick={() => { setValue(link); setEditing(true); }} className="p-1 text-gray-300 hover:text-gray-700 transition-colors" title="링크 수정">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>
    </div>
  );
}

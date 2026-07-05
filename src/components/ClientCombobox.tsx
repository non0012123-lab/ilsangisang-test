import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star, ChevronDown, Check } from 'lucide-react';
import type { Client } from '../types';
import { sortClients } from '../utils/clientSort';

interface Props {
  clients: Client[];                 // 선택 후보(보통 활성 업체)
  value: string;                     // 선택된 clientId
  onChange: (client: Client) => void;
  favIds?: Set<string>;              // 즐겨찾기 id 집합 — 후보 상단 우선 + 별 표시
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;                 // 필수인데 미선택 — 빨간 테두리로 강조(폼 검증)
  compact?: boolean;                 // 표 행 등 좁은 곳에 맞는 작은 크기
}

// 타이핑 검색형 클라이언트 선택 콤보박스.
//  • 업체가 많아진 상황에서 드롭다운을 스크롤하지 않고 이름/업종 일부만 쳐서 좁힌다.
//  • 즐겨찾기(별표)한 업체가 후보 맨 위에 오고, 별로 표시된다.
//  • 키보드: ↑↓ 이동, Enter 선택, Esc 닫기.
export default function ClientCombobox({ clients, value, onChange, favIds = new Set(), placeholder = '업체 검색·선택…', autoFocus, invalid, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  // 즐겨찾기 → 상태 → 가나다 정렬 후, 검색어(업체명·업종)로 좁힌다.
  const options = useMemo(() => {
    const sorted = sortClients(clients, favIds);
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(c => c.name.toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q));
  }, [clients, favIds, query]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 열릴 때 입력 포커스(DOM 동기화만 — 활성 인덱스 초기화는 여는 쪽 핸들러에서 처리).
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  // 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => { setActive(0); setOpen(true); };
  const choose = (c: Client) => { onChange(c); setOpen(false); setQuery(''); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { openList(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = options[active]; if (c) choose(c); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* 트리거 — 선택된 업체명 표시(없으면 placeholder) */}
      <button type="button" onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} ${invalid ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
        <span className={`flex items-center gap-1.5 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected && favIds.has(selected.id) && <Star size={compact ? 11 : 13} className="text-amber-400 fill-amber-400 shrink-0" />}
          <span className="truncate">{selected ? selected.name : placeholder}</span>
        </span>
        <ChevronDown size={compact ? 13 : 15} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-gray-100">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={inputRef} type="text" value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
              autoFocus={autoFocus} placeholder="업체명·업종 검색"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">검색 결과가 없습니다</p>
            ) : options.map((c, i) => {
              const fav = favIds.has(c.id);
              return (
                <button type="button" key={c.id} data-idx={i} onClick={() => choose(c)} onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  {fav
                    ? <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
                    : <span className="w-[13px] shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900 truncate block leading-tight">{c.name}</span>
                    {c.industry && <span className="text-[11px] text-gray-400 truncate block leading-tight">{c.industry}</span>}
                  </span>
                  {c.id === value && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleStatus } from '../types';

const OPTIONS: { value: ScheduleStatus; label: string; dot: string; text: string; bg: string }[] = [
  { value: 'pending',     label: '대기중', dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50' },
  { value: 'in-progress', label: '진행중', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50' },
  { value: 'completed',   label: '완료',   dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50' },
];

const ROW_H = 32;          // 옵션 한 줄 높이(px) — 위/아래 플립 판정용 추정치
const MENU_PAD = 8;        // 메뉴 상하 패딩
const GAP = 4;             // 버튼과 메뉴 사이 간격

export default function InlineStatus({
  status,
  onChange,
}: {
  status: ScheduleStatus;
  onChange: (s: ScheduleStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 버튼 위치 기준으로 메뉴를 viewport 고정 좌표에 배치. 아래 공간이 부족하면 위로 띄운다.
  //  → 카드/테이블의 overflow 에 잘리지 않도록 portal(body) + position:fixed 사용.
  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const menuH = OPTIONS.length * ROW_H + MENU_PAD;
    const menuW = Math.max(b.width, 112);
    const spaceBelow = window.innerHeight - b.bottom;
    const openUp = spaceBelow < menuH + GAP && b.top > menuH + GAP; // 아래가 좁고 위가 충분하면 위로
    const top = openUp ? b.top - menuH - GAP : b.bottom + GAP;
    let left = b.left;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - 8 - menuW;
    if (left < 8) left = 8;
    setPos({ left, top, width: menuW });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    // capture=true 로 어떤 컨테이너 스크롤에도 따라 움직이게 + 스크롤 시작하면 닫는 게 자연스러우나, 여기선 따라가게 둔다
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const cur = OPTIONS.find(o => o.value === status)!;

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-75 ${cur.bg} ${cur.text}`}
        title="클릭하여 상태 변경"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.dot}`} />
        {cur.label}
        <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, minWidth: pos.width }}
          className="z-[100] bg-white border border-gray-200 rounded-xl shadow-xl py-1"
        >
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors ${opt.value === status ? `${opt.text} font-semibold` : 'text-gray-700'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
              {opt.label}
              {opt.value === status && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

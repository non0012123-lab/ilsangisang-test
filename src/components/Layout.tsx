import { useState, type ReactNode } from 'react';
import { Menu, BarChart3 } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <main className="flex-1 lg:ml-60 min-h-screen flex flex-col min-w-0">
        {/* 모바일 상단바 (lg 미만에서만 표시) */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-white p-1 -ml-1" aria-label="메뉴 열기">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 size={15} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm">일상이상</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, Users, LogOut,
  Hash, PlayCircle, Globe, Video, Paintbrush, ChevronDown, ChevronRight,
  BarChart3, MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface NavItem { to: string; icon: React.ReactNode; label: string; }

const mainNav: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: '대시보드' },
  { to: '/schedule/daily', icon: <Calendar size={18} />, label: '일일 스케줄' },
  { to: '/schedule/full', icon: <CalendarDays size={18} />, label: '전체 스케줄' },
];

const categoryNav: NavItem[] = [
  { to: '/category/sns',            icon: <Hash size={16} />,          label: 'SNS' },
  { to: '/category/youtube',        icon: <PlayCircle size={16} />,    label: '유튜브' },
  { to: '/category/naver',          icon: <Globe size={16} />,         label: '네이버' },
  { to: '/category/video',          icon: <Video size={16} />,         label: '영상제작' },
  { to: '/category/design',         icon: <Paintbrush size={16} />,    label: '디자인제작' },
  { to: '/category/naver-opinion',  icon: <MessageSquare size={16} />, label: '네이버 여론작업' },
];

export default function Sidebar() {
  const [catOpen, setCatOpen] = useState(true);
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 flex flex-col z-40 select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">일상이상</p>
            <p className="text-slate-400 text-xs">커뮤니케이션</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {mainNav.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          >{item.icon}{item.label}</NavLink>
        ))}

        {/* Category section */}
        <div className="pt-2">
          <button onClick={() => setCatOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
            <span>카테고리별</span>
            {catOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {catOpen && (
            <div className="mt-1 space-y-0.5">
              {categoryNav.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ml-2 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
                  }
                >{item.icon}{item.label}</NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-700/50">
          <NavLink to="/clients"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          ><Users size={18} />클라이언트 관리</NavLink>
        </div>
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.department ?? '관리자'}</p>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors" title="로그아웃">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, Users, LogOut,
  Hash, PlayCircle, Globe, Video, Paintbrush, ChevronDown, ChevronRight,
  BarChart3, MessageSquare, CalendarRange, Sparkles, Building2, ShieldCheck, FileText, Search, Boxes, KeyRound, Inbox, CalendarClock, Tags, PhoneCall,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

interface NavItem { to: string; icon: React.ReactNode; label: string; }

const mainNav: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: '대시보드' },
  { to: '/schedule/daily', icon: <Calendar size={18} />, label: '일일 스케줄' },
  { to: '/schedule/full', icon: <CalendarDays size={18} />, label: '전체 스케줄' },
  { to: '/timetable', icon: <CalendarRange size={18} />, label: '타임테이블' },
  { to: '/internal', icon: <CalendarClock size={18} />, label: '내부 일정' },
  { to: '/ai-planning', icon: <Sparkles size={18} />, label: 'AI 기획' },
  { to: '/ai-results', icon: <FileText size={18} />, label: 'AI 기획 결과' },
  { to: '/keyword-tool', icon: <Search size={18} />, label: '키워드 조회' },
  { to: '/accounts', icon: <KeyRound size={18} />, label: '아이디 목록' },
  { to: '/sites', icon: <Globe size={18} />, label: '홈페이지 목록' },
  { to: '/pricing', icon: <Tags size={18} />, label: '단가표' },
];

const categoryNav: NavItem[] = [
  { to: '/category/sns',            icon: <Hash size={16} />,          label: 'SNS' },
  { to: '/category/youtube',        icon: <PlayCircle size={16} />,    label: '유튜브' },
  { to: '/category/naver',          icon: <Globe size={16} />,         label: '네이버' },
  { to: '/category/video',          icon: <Video size={16} />,         label: '영상제작' },
  { to: '/category/design',         icon: <Paintbrush size={16} />,    label: '디자인제작' },
  { to: '/category/naver-opinion',  icon: <MessageSquare size={16} />, label: '네이버 여론작업' },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const [catOpen, setCatOpen] = useState(false);
  const [cliOpen, setCliOpen] = useState(false);
  const { user, logout } = useAuth();
  const { clients, requests, salesAccess } = useApp();
  // 받은 요청 중 아직 확인 안 한(대기중) 건수 — 사이드바 뱃지
  const pendingReqCount = requests.filter(r => r.toUid === user?.id && r.status === 'pending').length;
  // 활성 클라이언트는 등록 즉시 자동으로 이 목록에 표시·연동됨
  const navClients = clients.filter(c => c.status !== 'inactive');

  const isAdmin = user?.role === 'admin';
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!isAdmin || !supabase) return;
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [isAdmin]);

  return (
    <>
      {/* 모바일 오버레이 */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={onClose} />}

      <aside className={`fixed left-0 top-0 h-screen w-60 bg-slate-900 flex flex-col z-50 select-none transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
          <NavLink key={item.to} to={item.to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          >{item.icon}{item.label}</NavLink>
        ))}

        {/* 요청함 (받은 요청 대기 건수 뱃지) */}
        <NavLink to="/requests" onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
          }
        ><Inbox size={18} />요청함
          {pendingReqCount > 0 && (
            <span className="ml-auto text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{pendingReqCount > 9 ? '9+' : pendingReqCount}</span>
          )}
        </NavLink>

        {/* 영업관리 (권한자만 노출) */}
        {salesAccess && (
          <NavLink to="/sales" onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          ><PhoneCall size={18} />영업관리</NavLink>
        )}

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
                <NavLink key={item.to} to={item.to} onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ml-2 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
                  }
                >{item.icon}{item.label}</NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Client section (등록된 클라이언트 자동 연동) */}
        <div className="pt-1">
          <button onClick={() => setCliOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
            <span>클라이언트별</span>
            {cliOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {cliOpen && (
            <div className="mt-1 space-y-0.5">
              {navClients.length === 0 ? (
                <p className="px-3 py-2 ml-2 text-xs text-slate-600">등록된 클라이언트 없음</p>
              ) : navClients.map(c => (
                <NavLink key={c.id} to={`/client/${c.id}`} onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ml-2 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
                  }
                ><Building2 size={16} className="shrink-0" /><span className="truncate">{c.name}</span></NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-700/50 space-y-0.5">
          <NavLink to="/clients" onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          ><Users size={18} />클라이언트 관리</NavLink>
          <NavLink to="/vendors" onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }
          ><Boxes size={18} />외주사 관리</NavLink>
          {isAdmin && (
            <NavLink to="/approvals" onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
              }
            ><ShieldCheck size={18} />가입 승인
              {pendingCount > 0 && (
                <span className="ml-auto text-xs font-bold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </NavLink>
          )}
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
    </>
  );
}

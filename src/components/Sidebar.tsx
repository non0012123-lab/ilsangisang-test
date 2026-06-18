import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, Users, LogOut,
  Globe,
  BarChart3, CalendarRange, Sparkles, Building2, ShieldCheck, FileText, Search, Boxes, KeyRound, Inbox, CalendarClock, Tags, PhoneCall, Target, Megaphone,
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
  { to: '/client', icon: <Building2 size={18} />, label: '클라이언트별 스케줄' },
  { to: '/internal', icon: <CalendarClock size={18} />, label: '내부 일정' },
  { to: '/rank-guarantee', icon: <Target size={18} />, label: '순위 보장' },
  { to: '/ai-planning', icon: <Sparkles size={18} />, label: 'AI 기획' },
  { to: '/ai-results', icon: <FileText size={18} />, label: 'AI 기획 결과' },
  { to: '/keyword-tool', icon: <Search size={18} />, label: '키워드 조회' },
  { to: '/accounts', icon: <KeyRound size={18} />, label: '아이디 목록' },
  { to: '/sites', icon: <Globe size={18} />, label: '홈페이지 목록' },
  { to: '/pricing', icon: <Tags size={18} />, label: '단가표' },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { requests, salesAccess, notices } = useApp();
  // 받은 요청 중 아직 확인 안 한(대기중) 건수 — 사이드바 뱃지
  const pendingReqCount = requests.filter(r => r.toUid === user?.id && r.status === 'pending').length;
  // 내 대상 공지 중 내가 아직 '확인' 안 누른 건수(내가 올린 공지는 제외) — 공지사항 뱃지
  const unreadNoticeCount = notices.filter(n =>
    (n.audience === 'all' || n.audience === user?.department) && n.fromUid !== user?.id && !(n.readBy ?? []).includes(user?.id ?? '')).length;

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
        {/* 대시보드 */}
        <NavLink to={mainNav[0].to} onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
          }
        >{mainNav[0].icon}{mainNav[0].label}</NavLink>

        {/* 공지사항 (대시보드 바로 아래 · 내가 아직 확인 안 한 공지 수 뱃지) */}
        <NavLink to="/notices" onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
          }
        ><Megaphone size={18} />공지사항
          {unreadNoticeCount > 0 && (
            <span className="ml-auto text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadNoticeCount > 9 ? '9+' : unreadNoticeCount}</span>
          )}
        </NavLink>

        {/* 나머지 메뉴 */}
        {mainNav.slice(1).map(item => (
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

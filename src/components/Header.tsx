import { useEffect, useRef, useState } from 'react';
import { Bell, Check, FileText, Image as ImageIcon, CalendarClock, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { isNotifySupported, notifyPermission } from '../utils/notifications';
import type { AppNotification } from '../types';

interface Props {
  title: string;
  subtitle?: string;
}

// 알림 발생 시각을 상대 표기로
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

const TYPE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  schedule: <CalendarClock size={15} className="text-blue-500" />,
  'ai-plan': <FileText size={15} className="text-purple-500" />,
  'ai-image': <ImageIcon size={15} className="text-pink-500" />,
};

export default function Header({ title, subtitle }: Props) {
  const { user } = useAuth();
  const {
    notifications, unreadCount, markAllNotificationsRead, markNotificationRead, clearNotifications,
    desktopNotifyEnabled, enableDesktopNotify,
  } = useApp();
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onClickItem = (n: AppNotification) => {
    markNotificationRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  // 데스크톱 알림 토글 상태
  const supported = isNotifySupported();
  const blocked = supported && notifyPermission() === 'denied';
  const desktopOn = supported && desktopNotifyEnabled && notifyPermission() === 'granted';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 hidden md:block">{today}</span>

        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="알림">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="font-bold text-gray-900 text-sm">알림</span>
                {notifications.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 hover:underline">모두 읽음</button>
                    <button onClick={clearNotifications} className="text-xs text-gray-400 hover:underline">전체 삭제</button>
                  </div>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-gray-400">새 알림이 없습니다.</p>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => onClickItem(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${n.read ? '' : 'bg-blue-50/40'}`}>
                      <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
                          <span className="text-sm font-semibold text-gray-900 truncate">{n.title}</span>
                        </span>
                        {n.body && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</span>}
                        <span className="block text-[11px] text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* PC 데스크톱 알림 토글 */}
              <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
                {!supported ? (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5"><Monitor size={13} /> 이 브라우저는 PC 알림을 지원하지 않습니다.</p>
                ) : blocked ? (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5"><Monitor size={13} /> PC 알림이 차단됨 — 브라우저 주소창의 알림 설정에서 허용해 주세요.</p>
                ) : desktopOn ? (
                  <p className="text-xs text-green-600 flex items-center gap-1.5"><Check size={13} /> PC 알림이 켜져 있어요 (항상 표시)</p>
                ) : (
                  <button onClick={enableDesktopNotify} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1.5">
                    <Monitor size={13} /> PC 알림 켜기
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
          {user?.name?.[0]}
        </div>
      </div>
    </header>
  );
}

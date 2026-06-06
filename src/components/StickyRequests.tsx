import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCheck, X, Inbox, CalendarClock, FileText, Image as ImageIcon, Sparkles, Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

// 화면 우하단에 뜨는 "스티커메모" — 내가 받은 미확인(대기중) 업무 요청을 보여준다.
//  • 확인/완료 버튼을 누르면 상태가 바뀌어 카드가 사라지고, 요청자에게 알림이 간다.
//  • X(나중에)는 이번 세션에서만 숨김 — 새로고침하면 대기중인 한 다시 뜬다(놓치지 않게).
const MAX = 3;

// 일반 스티커(스케줄 등) 타입별 아이콘 — 헤더 종 알림과 동일 색감
const NOTICE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  schedule: <CalendarClock size={13} className="text-blue-500" />,
  'ai-plan': <FileText size={13} className="text-purple-500" />,
  'ai-image': <ImageIcon size={13} className="text-pink-500" />,
  assistant: <Sparkles size={13} className="text-amber-500" />,
  request: <Inbox size={13} className="text-emerald-500" />,
  internal: <CalendarClock size={13} className="text-cyan-500" />,
};

export default function StickyRequests() {
  const { user } = useAuth();
  const { requests, confirmRequest, completeRequest, outgoingAlerts, dismissOutgoingAlert, stickyNotices, dismissStickyNotice } = useApp();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const uid = user?.id;

  const pending = requests.filter(r => r.toUid === uid && r.status === 'pending' && !dismissed.includes(r.id));
  if (pending.length === 0 && outgoingAlerts.length === 0 && stickyNotices.length === 0) return null;

  const shown = pending.slice(0, MAX);
  const more = pending.length - shown.length;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 w-[19rem] max-w-[calc(100vw-2rem)]">
      {/* 일반 스티커(새 스케줄 등) — PC/종 알림과 이중 표시 */}
      {stickyNotices.map(n => (
        <div key={n.id} className="bg-white rounded-xl shadow-lg p-3.5 border border-gray-200 ring-1 ring-gray-100">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">{NOTICE_ICON[n.type] ?? <Bell size={13} />} 알림</span>
            <button onClick={() => dismissStickyNotice(n.id)} className="p-0.5 -mr-1 -mt-1 text-gray-300 hover:text-gray-500" title="닫기">
              <X size={14} />
            </button>
          </div>
          <button onClick={() => { dismissStickyNotice(n.id); if (n.link) navigate(n.link); }} className="block text-left w-full">
            <p className="font-bold text-gray-900 text-sm mt-1 break-words">{n.title}</p>
            {n.body && <p className="text-xs text-gray-500 mt-0.5 break-words">{n.body}</p>}
          </button>
        </div>
      ))}

      {/* 내가 보낸 요청이 확인/완료됨 — 요청자에게 보여주는 스티커 */}
      {outgoingAlerts.map(r => {
        const done = r.status === 'done';
        return (
          <div key={`out-${r.id}`} className={`bg-white rounded-xl shadow-lg p-3.5 border ring-1 ${done ? 'border-emerald-200 ring-emerald-100' : 'border-blue-200 ring-blue-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <span className={`flex items-center gap-1.5 text-[11px] font-bold ${done ? 'text-emerald-600' : 'text-blue-600'}`}>
                {done ? <CheckCheck size={13} /> : <Check size={13} />} 요청 {done ? '완료' : '확인'}
              </span>
              <button onClick={() => dismissOutgoingAlert(r.id)} className="p-0.5 -mr-1 -mt-1 text-gray-300 hover:text-gray-500" title="닫기">
                <X size={14} />
              </button>
            </div>
            <button onClick={() => { dismissOutgoingAlert(r.id); navigate('/requests'); }} className="block text-left w-full">
              <p className="text-sm text-gray-800 mt-1 break-words">
                <span className="font-bold">{r.toName || '담당자'}</span>님이 <span className="font-bold">‘{r.title}’</span>{done ? '을(를) 완료했어요' : ' 요청을 확인했어요'}
              </p>
            </button>
          </div>
        );
      })}

      {/* 내가 받은 미확인 요청 스티커 */}
      {shown.map(r => (
        <div key={r.id} className="bg-white rounded-xl shadow-lg border border-amber-200 ring-1 ring-amber-100 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600"><Inbox size={13} /> 새 업무 요청</span>
            <button onClick={() => setDismissed(d => [...d, r.id])} className="p-0.5 -mr-1 -mt-1 text-gray-300 hover:text-gray-500" title="나중에 보기">
              <X size={14} />
            </button>
          </div>
          <button onClick={() => navigate('/requests')} className="block text-left w-full">
            <p className="font-bold text-gray-900 text-sm mt-1 break-words">{r.title}</p>
            {r.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 break-words">{r.body}</p>}
            <p className="text-[11px] text-gray-400 mt-1">요청: {r.fromName || '?'}</p>
          </button>
          <div className="flex items-center gap-1.5 mt-2.5">
            <button onClick={() => confirmRequest(r.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <Check size={13} /> 확인
            </button>
            <button onClick={() => completeRequest(r.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
              <CheckCheck size={13} /> 완료
            </button>
          </div>
        </div>
      ))}
      {more > 0 && (
        <button onClick={() => navigate('/requests')} className="text-xs font-semibold text-gray-500 bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100 py-1.5 hover:bg-gray-50 transition-colors">
          + {more}건 더 보기
        </button>
      )}
    </div>
  );
}

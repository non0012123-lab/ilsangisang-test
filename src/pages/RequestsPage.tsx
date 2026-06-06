import { useMemo, useState } from 'react';
import { Inbox, Send, Plus, X, Check, CheckCheck, Clock, Trash2, ArrowRight } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { WorkRequest, RequestStatus } from '../types';

const relTime = (ts: number): string => {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

// 상태 뱃지 (대기중=amber / 확인함=blue / 완료=green)
const STATUS_META: Record<RequestStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: '대기중', cls: 'bg-amber-100 text-amber-700',   icon: <Clock size={12} /> },
  confirmed: { label: '확인함', cls: 'bg-blue-100 text-blue-700',     icon: <Check size={12} /> },
  done:      { label: '완료',   cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCheck size={12} /> },
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, members, sendRequest, confirmRequest, completeRequest, removeRequest } = useApp();
  const uid = user?.id;
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [showForm, setShowForm] = useState(false);
  const [toId, setToId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // 대기중 → 확인함 → 완료 순서가 아니라, 처리할 게 위로 오도록 최신순 + 미완료 우선
  const sortReqs = (list: WorkRequest[]) =>
    [...list].sort((a, b) => {
      const ad = a.status === 'done' ? 1 : 0, bd = b.status === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;            // 완료는 아래로
      return b.createdAt - a.createdAt;          // 그 안에서 최신순
    });

  const received = useMemo(() => sortReqs(requests.filter(r => r.toUid === uid)), [requests, uid]);
  const sent = useMemo(() => sortReqs(requests.filter(r => r.fromUid === uid)), [requests, uid]);
  const pendingReceived = received.filter(r => r.status === 'pending').length;

  // 담당자 후보(본인 제외) — 새 요청 대상
  const candidates = members.filter(m => m.id !== uid);

  const openForm = () => { setToId(candidates[0]?.id ?? ''); setTitle(''); setBody(''); setShowForm(true); };
  const handleSend = () => {
    if (!toId) { alert('요청 받을 담당자를 선택하세요.'); return; }
    if (!title.trim()) { alert('요청 내용을 입력하세요.'); return; }
    sendRequest(toId, title, body);
    setShowForm(false);
    setTab('sent');
  };

  const list = tab === 'received' ? received : sent;

  return (
    <Layout>
      <Header title="요청함" subtitle="다른 담당자에게 보낸·받은 업무 요청을 관리합니다 (일정과 별개)" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* 탭 + 새 요청 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button onClick={() => setTab('received')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'received' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Inbox size={15} /> 받은 요청
              {pendingReceived > 0 && <span className="ml-0.5 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{pendingReceived}</span>}
            </button>
            <button onClick={() => setTab('sent')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Send size={15} /> 보낸 요청
            </button>
          </div>
          <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> 새 요청
          </button>
        </div>

        {list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-sm text-gray-400">
            {tab === 'received' ? '받은 요청이 없습니다.' : '보낸 요청이 없습니다. ‘새 요청’으로 다른 담당자에게 업무를 요청하세요.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map(r => (
              <div key={r.id} className={`bg-white rounded-2xl shadow-sm border p-4 ${r.status === 'pending' && tab === 'received' ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-400">{relTime(r.createdAt)}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 break-words">{r.title}</h3>
                    {r.body && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap break-words">{r.body}</p>}
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      {tab === 'received'
                        ? <>요청한 사람: <span className="font-medium text-gray-600">{r.fromName || '?'}</span></>
                        : <><span className="font-medium text-gray-600">{r.fromName || '나'}</span> <ArrowRight size={11} /> <span className="font-medium text-gray-600">{r.toName || '?'}</span></>}
                    </p>
                  </div>

                  {/* 액션 */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {tab === 'received' ? (
                      <>
                        {r.status === 'pending' && (
                          <button onClick={() => confirmRequest(r.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                            <Check size={13} /> 확인
                          </button>
                        )}
                        {r.status !== 'done' && (
                          <button onClick={() => completeRequest(r.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
                            <CheckCheck size={13} /> 완료
                          </button>
                        )}
                      </>
                    ) : (
                      <button onClick={() => { if (window.confirm('이 요청을 삭제할까요?')) removeRequest(r.id); }} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="요청 삭제">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 새 요청 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><Send size={16} /></div>
                <h2 className="text-base font-bold text-gray-900">새 업무 요청</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">받는 담당자 *</label>
                {candidates.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">요청을 보낼 다른 담당자가 없습니다.</p>
                ) : (
                  <select value={toId} onChange={e => setToId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {candidates.map(m => <option key={m.id} value={m.id}>{m.name}{m.department ? ` (${m.department})` : ''}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">요청 내용 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 디자인 제작 요청"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상세 설명 (선택)</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="요청 배경·마감일·참고 링크 등"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSend} disabled={candidates.length === 0} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-lg transition-colors">요청 보내기</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

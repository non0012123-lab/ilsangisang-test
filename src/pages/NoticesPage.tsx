import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Users, Plus, X, Trash2, Check, CheckCheck } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import LinkifiedText from '../components/LinkifiedText';
import { orderedTeams } from '../data/org';

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

// 팀/전체 공지 — 확인(읽음) 추적 포함. 각자 '확인'을 누르면 작성자·관리자가 확인 현황(N/M)을 본다.
export default function NoticesPage() {
  const { user } = useAuth();
  const { notices, members, sendNotice, removeNotice, confirmNotice } = useApp();
  const uid = user?.id;
  const myDept = user?.department;
  const isAdmin = user?.role === 'admin';

  // 작성 폼
  const [showForm, setShowForm] = useState(false);
  const [audience, setAudience] = useState('all');
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const teamOptions = useMemo(() => orderedTeams(members.map(m => m.department)), [members]);
  const openForm = () => { setAudience('all'); setNTitle(''); setNBody(''); setShowForm(true); };
  const handleSend = () => {
    if (!nTitle.trim()) { alert('공지 내용을 입력하세요.'); return; }
    sendNotice(audience, audience === 'all' ? '전체' : audience, nTitle, nBody);
    setShowForm(false);
  };

  // 내가 볼 공지: 전체 공지 + 내 팀 공지 + 내가 올린 공지 (최신순)
  const visible = useMemo(
    () => [...notices]
      .filter(n => n.audience === 'all' || n.audience === myDept || n.fromUid === uid)
      .sort((a, b) => b.createdAt - a.createdAt),
    [notices, myDept, uid],
  );

  // 공지의 대상 인원(작성자 제외) — 확인 현황(N/M) 계산용.
  const recipientsOf = (n: typeof notices[number]) =>
    members.filter(m => (n.audience === 'all' || m.department === n.audience) && m.id !== n.fromUid);

  // PC/인앱 알림에서 ?focus=<공지id> 로 들어오면 해당 공지로 스크롤·강조하고, 내가 대상이면 확인 처리한다.
  const [params, setParams] = useSearchParams();
  const focusId = params.get('focus');
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const target = notices.find(n => n.id === focusId);
    if (!target) return; // 아직 로드 전이면 notices 갱신 시 재실행
    setHighlight(focusId);
    const el = document.getElementById(`notice-${focusId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 내가 대상인 공지면 확인(읽음) 처리 — 알림을 눌러 열람한 것이므로
    if (uid && target.fromUid !== uid && (target.audience === 'all' || target.audience === myDept) && !(target.readBy ?? []).includes(uid)) {
      confirmNotice(focusId);
    }
    const t = setTimeout(() => setHighlight(null), 2600);
    // 강조 후 URL 의 focus 파라미터는 정리(새로고침 시 재강조·중복 동작 방지)
    const clean = setTimeout(() => setParams(p => { const next = new URLSearchParams(p); next.delete('focus'); return next; }, { replace: true }), 800);
    return () => { clearTimeout(t); clearTimeout(clean); };
    // notices 를 의존성에 넣어 데이터가 늦게 로드돼도 한 번 더 시도
  }, [focusId, notices, uid, myDept, confirmNotice, setParams]);

  return (
    <Layout>
      <Header title="공지사항" subtitle="팀·전체 공지를 확인하고, ‘확인’을 눌러 열람을 알립니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-end">
          <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> 새 공지
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-sm text-gray-400">
            등록된 공지가 없습니다. ‘새 공지’로 팀이나 전체에 알림을 보내세요.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map(n => {
              const mine = n.fromUid === uid;
              const isAll = n.audience === 'all';
              const recipients = recipientsOf(n);
              const readSet = new Set(n.readBy ?? []);
              const readCount = recipients.filter(m => readSet.has(m.id)).length;
              const unread = recipients.filter(m => !readSet.has(m.id));
              // 내가 이 공지의 대상인가(작성자 제외) → 확인 버튼 표시 대상
              const iAmRecipient = !mine && (isAll || n.audience === myDept);
              const iConfirmed = !!uid && readSet.has(uid);
              return (
                <div key={n.id} id={`notice-${n.id}`} className={`bg-white rounded-2xl shadow-sm border p-4 transition-shadow ${highlight === n.id ? 'ring-2 ring-amber-400 border-amber-300' : isAll ? 'border-indigo-200' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isAll ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                          {isAll ? <Megaphone size={12} /> : <Users size={12} />} {n.audienceLabel}
                        </span>
                        <span className="text-xs text-gray-400">{relTime(n.createdAt)}</span>
                        {/* 확인 현황 N/M (모두에게 보임) */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                          <CheckCheck size={12} /> 확인 {readCount}/{recipients.length}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 break-words">{n.title}</h3>
                      {n.body && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap break-words"><LinkifiedText text={n.body} /></p>}
                      <p className="text-xs text-gray-400 mt-1.5">
                        {mine ? '내가 올린 공지' : <>작성: <span className="font-medium text-gray-600">{n.fromName || '?'}</span>{n.fromDept ? ` · ${n.fromDept}` : ''}</>}
                      </p>
                      {/* 미확인자 이름 목록 — 작성자/관리자에게만 */}
                      {(mine || isAdmin) && unread.length > 0 && (
                        <p className="text-[11px] text-amber-600 mt-1.5">
                          미확인 {unread.length}명: <span className="text-gray-500">{unread.map(m => m.name).join(', ')}</span>
                        </p>
                      )}
                      {(mine || isAdmin) && recipients.length > 0 && unread.length === 0 && (
                        <p className="text-[11px] text-emerald-600 mt-1.5">전원 확인 완료 ✓</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {/* 확인 버튼 — 내가 대상이고 아직 확인 안 했을 때 */}
                      {iAmRecipient && (
                        iConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <Check size={13} /> 확인함
                          </span>
                        ) : (
                          <button onClick={() => confirmNotice(n.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                            <Check size={13} /> 확인
                          </button>
                        )
                      )}
                      {(mine || isAdmin) && (
                        <button onClick={() => { if (window.confirm('이 공지를 삭제할까요? 모두의 화면에서 사라집니다.')) removeNotice(n.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" title="공지 삭제">
                          <Trash2 size={13} /> 삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 새 공지 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white"><Megaphone size={16} /></div>
                <h2 className="text-base font-bold text-gray-900">새 공지</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">공지 대상 *</label>
                <select value={audience} onChange={e => setAudience(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all">📢 전체 (전 직원)</option>
                  {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">{audience === 'all' ? '회사 전 직원이 봅니다.' : `${audience} 소속 인원 전체가 봅니다.`}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">공지 내용 *</label>
                <input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="예: 금요일 전사 회의 오후 3시"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상세 설명 (선택)</label>
                <textarea value={nBody} onChange={e => setNBody(e.target.value)} rows={3} placeholder="배경·일정·참고 링크 등"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSend} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">공지 보내기</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

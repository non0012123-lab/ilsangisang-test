import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, CalendarPlus, Check, Pencil, Building2, ClipboardList, Boxes, Search, Trash2, RotateCcw, KeyRound, Globe, Copy, Plus, X, MessageSquare, PanelLeftClose, PanelLeftOpen, CalendarClock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { AssistantMessage } from '../types';

const relTime = (ts: number): string => {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = { pending: '대기중', 'in-progress': '진행중', completed: '완료' };
const REMINDER_TEXT: Record<string, string> = { '1h': '1시간 전', '30m': '30분 전', '10m': '10분 전', onTime: '정각' };

const EXAMPLES = [
  '오늘 스케줄 시간 분배는 어떻게 하는 게 효율적일까?',
  '스타벅스 코리아 업체 가이드라인 알려줘',
  '영수증리뷰 어디에 맡겨?',
  '리뷰팩토리 외주사 추가해줘 (영수증리뷰·앱설치·앱후기, 건당 3천원)',
  '강남 피부과 키워드 조회수 알려줘',
  '우리본병원 블로그 아이디·비번 알려줘',
  '내일 스타벅스 SNS 신메뉴 키워드 작업 등록해줘',
  '6월 2일부터 6월 6일까지 네이버 블로그 5건 담당자별로 배분해줘',
  '방두환한테 디자인 제작 요청해줘',
  '내일 오후 3시 디자인팀 회의 잡아줘 (회의실 A)',
  '6/10 현대자동차 블로그관리 일정 삭제해줘',
  '새 업체 "그린마취통증의학과" 등록하고 인수인계 문서도 만들어줘',
];

export default function DashboardAssistant() {
  const {
    entries, accounts, siteEntries, assistantMessages, assistantLoading, runAssistant, applyAssistantProposal, undoAssistantProposal,
    conversations, activeConversationId, newConversation, selectConversation, deleteConversation, deleteAssistantMessage,
  } = useApp();
  const { user } = useAuth();
  // 담당자를 명시하지 않은 일정은 적용 시 로그인 본인이 담당자가 되므로, 미리보기에도 본인 이름을 보여준다.
  const selfName = user?.name ?? '담당자?';
  const [input, setInput] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 대화목록 사이드바: 좁은 화면(모바일)에선 기본 접힘 → 채팅 영역을 넓게 쓴다. 토글로 펼침.
  const [convListOpen, setConvListOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640);
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 640;
  // 모바일에선 대화 선택/새 채팅 후 목록을 자동으로 접어 곧바로 채팅을 넓게 본다.
  const handleSelect = (id: string) => { selectConversation(id); if (isMobile()) setConvListOpen(false); };
  const handleNew = () => { newConversation(); if (isMobile()) setConvListOpen(false); };

  const copy = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(c => (c === key ? null : c)), 1500);
  };
  // 라벨 + 값 + 복사 버튼
  const field = (label: string, value: string | undefined, key: string) => value ? (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-400 w-12 shrink-0">{label}</span>
      <span className="font-mono text-gray-800 truncate">{value}</span>
      <button onClick={() => copy(value, key)} className={`shrink-0 p-0.5 rounded transition-colors ${copiedKey === key ? 'text-green-600' : 'text-gray-400 hover:text-blue-600'}`} title="복사">
        {copiedKey === key ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  ) : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [assistantMessages, assistantLoading]);

  const send = (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || assistantLoading) return;
    runAssistant(text);
    setInput('');
  };

  const proposalCount = (m: AssistantMessage) =>
    (m.entries?.length ?? 0) + (m.updates?.length ?? 0) + (m.clients?.length ?? 0) + (m.handovers?.length ?? 0) + (m.vendors?.length ?? 0) + (m.deletes?.length ?? 0) + (m.accounts?.length ?? 0) + (m.sites?.length ?? 0) + (m.requests?.length ?? 0) + (m.internalEvents?.length ?? 0);

  const opLabel = (op?: string) => op === 'delete' ? '삭제' : op === 'update' ? '수정' : '추가';

  const fmtCnt = (v: number | string) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : (v ?? '-'));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
          <Sparkles size={15} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-tight">AI 어시스턴트</h3>
          <p className="text-xs text-gray-400">일정·업체·인수인계·외주사·아이디/홈페이지 목록 조회·등록·수정·삭제, 키워드 조회수까지 대화로 처리합니다</p>
        </div>
        <button onClick={() => setConvListOpen(o => !o)} title={convListOpen ? '대화목록 접기' : '대화목록 펼치기'}
          className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors">
          {convListOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          <span className="hidden sm:inline">{convListOpen ? '목록 접기' : '대화목록'}</span>
        </button>
      </div>

      <div className="flex">
        {/* 대화목록 + 새 채팅 */}
        <aside className={`${convListOpen ? 'flex' : 'hidden'} w-40 sm:w-52 shrink-0 border-r border-gray-50 flex-col`} style={{ maxHeight: '30rem' }}>
          <button onClick={handleNew}
            className="m-2 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
            <Plus size={13} /> 새 채팅
          </button>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center px-2 py-4 leading-relaxed">대화를 시작하면<br />여기에 기록됩니다</p>
            ) : (
              conversations.map(c => (
                <div key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={`group/conv flex items-center gap-1 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    c.id === activeConversationId ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-50 text-gray-700'
                  }`}>
                  <MessageSquare size={12} className="shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate leading-tight">{c.title}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{relTime(c.updatedAt)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm('이 대화를 삭제할까요?')) deleteConversation(c.id); }}
                    title="대화 삭제"
                    className="shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover/conv:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* 채팅 영역 */}
        <div className="flex-1 min-w-0 flex flex-col">
      {/* 대화 영역 */}
      <div ref={scrollRef} className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '24rem', minHeight: '8rem' }}>
        {assistantMessages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">무엇을 도와드릴까요? 예를 들어:</p>
            <div className="flex flex-col gap-2 max-w-xl mx-auto">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => send(ex)} disabled={assistantLoading}
                  className="text-left text-xs text-gray-600 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 border border-gray-100 rounded-xl px-3 py-2 transition-colors disabled:opacity-50">
                  💬 {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          assistantMessages.map((m, idx) => (
            <div key={idx} className={`group flex items-start gap-1 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${m.role === 'user' ? 'order-2' : ''}`}>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  {m.text}
                </div>

                {/* 제안된 액션 */}
                {m.role === 'assistant' && proposalCount(m) > 0 && (
                  <div className="mt-2 border border-purple-100 bg-purple-50/50 rounded-xl p-3 space-y-1.5">
                    {(m.clients ?? []).map((c, i) => {
                      const op = c.op ?? (c.id ? 'update' : 'add');
                      const label = op === 'delete' ? '업체 삭제' : op === 'update' ? '업체 수정' : '신규 업체';
                      const extra = [c.industry, c.reportAnchorDate ? `보고기준 ${c.reportAnchorDate}` : '', c.status].filter(Boolean).join(' · ');
                      return (
                        <div key={`c${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                          <Building2 size={13} className={`shrink-0 mt-0.5 ${op === 'delete' ? 'text-red-500' : 'text-emerald-500'}`} />
                          <span><strong>{label}</strong> {c.name || '업체명?'}{extra ? ` · ${extra}` : ''}</span>
                        </div>
                      );
                    })}
                    {(m.handovers ?? []).map((h, i) => (
                      <div key={`h${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <ClipboardList size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <span><strong>인수인계 문서</strong> {h.clientName || '업체?'}</span>
                      </div>
                    ))}
                    {(m.vendors ?? []).map((v, i) => (
                      <div key={`v${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <Boxes size={13} className="text-teal-500 shrink-0 mt-0.5" />
                        <span><strong>신규 외주사</strong> {v.name || '외주사?'}{v.services ? ` · ${v.services}` : ''}</span>
                      </div>
                    ))}
                    {(m.accounts ?? []).map((a, i) => (
                      <div key={`ac${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <KeyRound size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                        <span><strong>아이디 {opLabel(a.op)}</strong> {a.name || a.username || '계정?'}{a.username && a.name ? ` · ${a.username}` : ''}</span>
                      </div>
                    ))}
                    {(m.sites ?? []).map((s, i) => (
                      <div key={`st${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <Globe size={13} className="text-sky-500 shrink-0 mt-0.5" />
                        <span><strong>홈페이지 {opLabel(s.op)}</strong> {s.name || '홈페이지?'}{s.description ? ` · ${s.description}` : ''}</span>
                      </div>
                    ))}
                    {(m.requests ?? []).map((r, i) => (
                      <div key={`rq${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <Send size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <span><strong>업무 요청</strong> {r.toName || '담당자?'}에게 · {r.title || '내용?'}{r.body ? ` — ${r.body}` : ''}</span>
                      </div>
                    ))}
                    {(m.internalEvents ?? []).map((iv, i) => (
                      <div key={`iv${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <CalendarClock size={13} className="text-cyan-500 shrink-0 mt-0.5" />
                        <span><strong>내부 일정</strong> {iv.date}{iv.startTime ? ` ${iv.startTime}` : ''} · {iv.category || '종류?'} · {iv.title || '제목?'}{iv.location ? ` @${iv.location}` : ''}{iv.participantNames?.length ? ` · ${iv.participantNames.join(', ')}` : ''}{iv.reminder && iv.reminder !== 'off' ? ` · 🔔${REMINDER_TEXT[iv.reminder] ?? iv.reminder}` : ''}</span>
                      </div>
                    ))}
                    {(m.entries ?? []).map((e, i) => (
                      <div key={`e${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <CalendarPlus size={13} className="text-purple-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>신규 일정</strong> {e.date}{e.endDate && e.endDate !== 'null' ? `~${e.endDate}` : ''} · {e.managerName || selfName} · {e.clientName || '업체?'} · {e.category || '기타'}
                          {e.keyword ? ` · ${e.keyword}` : ''}{e.status && e.status !== 'pending' ? ` (${STATUS_LABEL[e.status] ?? e.status})` : ''}{e.link ? ' · 🔗 링크' : ''}
                        </span>
                      </div>
                    ))}
                    {(m.updates ?? []).map((u, i) => {
                      const cur = entries.find(en => en.id === u.id);
                      return (
                        <div key={`u${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                          <Pencil size={13} className="text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>일정 변경</strong> {cur ? `${cur.clientName} ${cur.category}${cur.keyword ? ` (${cur.keyword})` : ''}` : u.id}
                            {' → '}
                            {[u.date && u.date !== 'null' ? `날짜 ${u.date}` : '', u.managerName && u.managerName !== 'null' ? `담당 ${u.managerName}` : '', u.status && u.status !== 'null' ? STATUS_LABEL[u.status] ?? u.status : '', u.link != null && u.link !== 'null' ? (u.link ? '🔗 링크 변경' : '🔗 링크 삭제') : ''].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      );
                    })}
                    {(m.deletes ?? []).map((id, i) => {
                      const cur = entries.find(en => en.id === id);
                      return (
                        <div key={`d${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                          <Trash2 size={13} className="text-red-500 shrink-0 mt-0.5" />
                          <span><strong>일정 삭제</strong> {cur ? `${cur.date} · ${cur.clientName} · ${cur.category}${cur.keyword ? ` (${cur.keyword})` : ''}` : `(이미 없는 일정: ${id})`}</span>
                        </div>
                      );
                    })}

                    {m.applied != null ? (
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                          <Check size={13} /> {m.applied}건 적용됨 — 스케줄·업체·인수인계에 반영되었습니다.
                        </div>
                        {m.undo && (m.undo.entryIds.length + m.undo.clientIds.length + m.undo.vendorIds.length + m.undo.handoverIds.length + m.undo.deletedEntries.length + m.undo.updatedPrev.length + (m.undo.requestIds?.length ?? 0) + (m.undo.internalEventIds?.length ?? 0)) > 0 && (
                          m.undone ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400"><RotateCcw size={12} /> 되돌림 완료</span>
                          ) : (
                            <button onClick={() => undoAssistantProposal(idx)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                              <RotateCcw size={12} /> 방금 적용 되돌리기
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <button onClick={() => applyAssistantProposal(idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors mt-1">
                        <Check size={12} /> 적용하기 ({proposalCount(m)}건)
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400">적용 후 각 화면에서 세부 내용을 수정할 수 있고, ‘되돌리기’로 직전 적용을 취소할 수 있습니다.</p>
                  </div>
                )}

                {/* 키워드 조회수 (모바일/PC/총) */}
                {m.role === 'assistant' && (m.keywords?.length ?? 0) > 0 && (
                  m.keywordStats === undefined ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                      <Search size={12} /> 조회수 조회 중...
                    </div>
                  ) : (
                    <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500">
                            <th className="text-left font-semibold px-3 py-1.5">키워드</th>
                            <th className="text-right font-semibold px-3 py-1.5">모바일</th>
                            <th className="text-right font-semibold px-3 py-1.5">PC</th>
                            <th className="text-right font-semibold px-3 py-1.5">총조회수</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {m.keywordStats.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-2 text-center text-gray-400">조회 결과가 없습니다.</td></tr>
                          ) : m.keywordStats.map((s, i) => (
                            <tr key={`${s.keyword}-${i}`} className="text-gray-700">
                              <td className="px-3 py-1.5 font-medium">{s.keyword}</td>
                              <td className="px-3 py-1.5 text-right">{s.found ? fmtCnt(s.mobile) : '-'}</td>
                              <td className="px-3 py-1.5 text-right">{s.found ? fmtCnt(s.pc) : '-'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-blue-600">{s.found ? fmtCnt(s.total) : '조회불가'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* 아이디 목록 조회 결과 (복사 버튼) */}
                {m.role === 'assistant' && (m.accountLookups?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.accountLookups!.map(id => {
                      const a = accounts.find(x => x.id === id);
                      if (!a) return null;
                      return (
                        <div key={id} className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3">
                          <p className="text-xs font-bold text-gray-900 mb-1.5 flex items-center gap-1.5 flex-wrap">
                            <KeyRound size={12} className="text-indigo-500" /> {a.name || a.username}
                            {a.platform && <span className="font-medium text-[11px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{a.platform}</span>}
                            {a.grade && <span className="font-medium text-[11px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{a.grade}</span>}
                            {a.ownership && <span className="font-medium text-[11px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{a.ownership === 'client' ? '업체 소유' : '사내'}</span>}
                          </p>
                          <div className="space-y-1">
                            {field('아이디', a.username, `${id}:user`)}
                            {field('비밀번호', a.password, `${id}:pw`)}
                            {field('아이피', a.ip, `${id}:ip`)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 홈페이지 목록 조회 결과 (복사 버튼) */}
                {m.role === 'assistant' && (m.siteLookups?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.siteLookups!.map(id => {
                      const s = siteEntries.find(x => x.id === id);
                      if (!s) return null;
                      return (
                        <div key={id} className="border border-sky-100 bg-sky-50/40 rounded-xl p-3">
                          <p className="text-xs font-bold text-gray-900 mb-1.5 flex items-center gap-1.5"><Globe size={12} className="text-sky-500" /> {s.name}</p>
                          <div className="space-y-1">
                            {field('주소', s.url, `${id}:url`)}
                            {field('아이디', s.username, `${id}:user`)}
                            {field('비밀번호', s.password, `${id}:pw`)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={() => deleteAssistantMessage(idx)} title="이 메시지 삭제"
                className="opacity-0 group-hover:opacity-100 mt-1 p-1 rounded text-gray-300 hover:text-red-500 transition-opacity shrink-0">
                <X size={12} />
              </button>
            </div>
          ))
        )}

        {assistantLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              생각 중...
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="border-t border-gray-50 p-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="예: 오늘 스케줄 시간 분배 어떻게 하면 좋을까? (Enter 전송, Shift+Enter 줄바꿈)"
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-28" />
        <button onClick={() => send()} disabled={assistantLoading || !input.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-colors shrink-0">
          <Send size={16} />
        </button>
      </div>
        </div>{/* 채팅 영역 */}
      </div>{/* flex 행 */}
    </div>
  );
}

import { useState } from 'react';
import { Plus, Save, Copy, Sparkles, Users, Link2, FileText, AlertTriangle, MessageSquare, BookOpen, ChevronDown, ChevronUp, Pencil, Trash2, X, Check, ImageIcon, Download } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import CategoryBadge from '../components/CategoryBadge';
import { openAiPlanPrint } from '../utils/aiPlanPdf';
import type { HandoverDoc, KeyContact, ImportantLink } from '../types';

type DocTab = 'overview' | 'history' | 'contacts' | 'guidelines' | 'memo' | 'prompt' | 'ai';

const TAB_CONFIG = [
  { key: 'overview',   icon: <BookOpen size={14} />,     label: '개요' },
  { key: 'history',    icon: <FileText size={14} />,     label: '작업 이력' },
  { key: 'contacts',   icon: <Users size={14} />,        label: '연락처' },
  { key: 'guidelines', icon: <AlertTriangle size={14} />, label: '가이드라인' },
  { key: 'memo',       icon: <MessageSquare size={14} />, label: '인수인계 메모' },
  { key: 'ai',         icon: <Sparkles size={14} />,     label: 'AI 기획' },
  { key: 'prompt',     icon: <Sparkles size={14} />,     label: 'AI 프롬프트' },
] as const;

function generatePrompt(doc: HandoverDoc, entries: ReturnType<typeof useApp>['entries']): string {
  const clientEntries = entries
    .filter(e => e.clientId === doc.clientId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const historyLines = clientEntries.map(e =>
    `- [${e.date}] ${e.category}: ${e.opinionTitle ?? e.keyword ?? '-'}${e.link ? ` (${e.link})` : ''} [${e.status === 'completed' ? '완료' : e.status === 'in-progress' ? '진행중' : '대기'}]`
  ).join('\n');

  const contactLines = doc.keyContacts.map(c =>
    `- ${c.name} (${c.role})${c.phone ? ` / ${c.phone}` : ''}${c.email ? ` / ${c.email}` : ''}${c.notes ? ` → ${c.notes}` : ''}`
  ).join('\n');

  const linkLines = doc.importantLinks.map(l =>
    `- [${l.category}] ${l.title}: ${l.url}${l.notes ? ` (${l.notes})` : ''}`
  ).join('\n');

  return `# ${doc.clientName} 인수인계 문서
작성자: ${doc.authorName} | 최종 수정: ${doc.updatedAt}

## 업체 개요
${doc.overview}

## 주요 연락처
${contactLines || '(등록된 연락처 없음)'}

## 주요 링크
${linkLines || '(등록된 링크 없음)'}

## 운영 가이드라인
${doc.guidelines || '(없음)'}

## 톤앤매너
${doc.tone || '(없음)'}

## 절대 하지 말 것
${doc.dontDo || '(없음)'}

## 특이사항
${doc.specialNotes || '(없음)'}

## 전임 담당자 인수인계 메모
${doc.managerMemo || '(없음)'}

## 최근 작업 이력 (최근 20건)
${historyLines || '(작업 이력 없음)'}

---
위 정보를 참고하여 ${doc.clientName} 업무를 수행해주세요.`;
}

function CollapsibleSection({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">{icon}{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function HandoverPage() {
  const { entries, clients, handoverDocs, saveHandover, removeHandover, aiHistory } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // 표시용 이름: 수동 제목이 있으면 그것, 없으면 현재 클라이언트명(이름 변경 자동 연동)
  const docName = (d: HandoverDoc) => d.title?.trim() || clients.find(c => c.id === d.clientId)?.name || d.clientName;
  const [selectedId, setSelectedId] = useState<string | null>(handoverDocs[0]?.id ?? null);
  const [tab, setTab] = useState<DocTab>('overview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HandoverDoc | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClientId, setNewClientId] = useState('');

  const selected = handoverDocs.find(d => d.id === selectedId) ?? null;

  const startEdit = () => {
    if (!selected) return;
    setDraft({ ...selected, keyContacts: selected.keyContacts.map(c => ({ ...c })), importantLinks: selected.importantLinks.map(l => ({ ...l })) });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!draft) return;
    saveHandover({ ...draft, updatedAt: '2026-05-29', authorId: user?.id ?? draft.authorId, authorName: user?.name ?? draft.authorName });
    setEditing(false);
    setDraft(null);
  };

  const cancelEdit = () => { setEditing(false); setDraft(null); };

  const doc = editing ? draft : selected;

  const addNewDoc = () => {
    if (!newClientId) return;
    const client = clients.find(c => c.id === newClientId);
    if (!client) return;
    const newDoc: HandoverDoc = {
      id: Date.now().toString(),
      clientId: newClientId,
      clientName: client.name,
      authorId: user?.id ?? '',
      authorName: user?.name ?? '',
      updatedAt: '2026-05-29',
      overview: '',
      keyContacts: [],
      importantLinks: [],
      guidelines: '',
      tone: '',
      dontDo: '',
      specialNotes: '',
      managerMemo: '',
    };
    saveHandover(newDoc);
    setSelectedId(newDoc.id);
    setShowNewForm(false);
    setNewClientId('');
    setDraft({ ...newDoc });
    setEditing(true);
  };

  const addContact = () => {
    if (!draft) return;
    setDraft(d => d ? { ...d, keyContacts: [...d.keyContacts, { id: Date.now().toString(), name: '', role: '', phone: '', email: '', notes: '' }] } : d);
  };
  const removeContact = (id: string) => {
    if (!draft) return;
    setDraft(d => d ? { ...d, keyContacts: d.keyContacts.filter(c => c.id !== id) } : d);
  };
  const updateContact = (id: string, patch: Partial<KeyContact>) => {
    if (!draft) return;
    setDraft(d => d ? { ...d, keyContacts: d.keyContacts.map(c => c.id === id ? { ...c, ...patch } : c) } : d);
  };

  const addLink = () => {
    if (!draft) return;
    setDraft(d => d ? { ...d, importantLinks: [...d.importantLinks, { id: Date.now().toString(), title: '', url: '', category: 'SNS', notes: '' }] } : d);
  };
  const removeLink = (id: string) => {
    if (!draft) return;
    setDraft(d => d ? { ...d, importantLinks: d.importantLinks.filter(l => l.id !== id) } : d);
  };
  const updateLink = (id: string, patch: Partial<ImportantLink>) => {
    if (!draft) return;
    setDraft(d => d ? { ...d, importantLinks: d.importantLinks.map(l => l.id === id ? { ...l, ...patch } : l) } : d);
  };

  const clientEntries = selected ? entries.filter(e => e.clientId === selected.clientId).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const promptText = selected ? generatePrompt({ ...selected, clientName: docName(selected) }, entries) : '';

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(`'${docName(selected)}' 인수인계 문서를 삭제할까요? (되돌릴 수 없음)`)) return;
    removeHandover(selected.id);
    setSelectedId(null);
    setEditing(false);
    setDraft(null);
  };
  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const clientsWithoutDoc = clients.filter(c => c.status !== 'inactive' && !handoverDocs.find(d => d.clientId === c.id));

  return (
    <Layout>
      <Header title="인수인계" subtitle="클라이언트 담당 변경 시 필요한 모든 정보를 관리합니다" />
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>

        {/* Left: Client List */}
        <div className="w-56 border-r border-gray-100 bg-white flex flex-col shrink-0">
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => setShowNewForm(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={14} /> 문서 추가
            </button>
            {showNewForm && (
              <div className="mt-2 p-2 bg-gray-50 rounded-xl space-y-2">
                <select value={newClientId} onChange={e => setNewClientId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">클라이언트 선택</option>
                  {clientsWithoutDoc.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={addNewDoc} disabled={!newClientId}
                  className="w-full py-1.5 bg-blue-600 disabled:bg-gray-200 text-white disabled:text-gray-400 text-xs font-semibold rounded-lg transition-colors">
                  생성
                </button>
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {handoverDocs.map(doc => (
              <button key={doc.id}
                onClick={() => { setSelectedId(doc.id); setEditing(false); setDraft(null); setTab('overview'); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  selectedId === doc.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                <p className={`font-semibold text-sm truncate ${selectedId === doc.id ? 'text-white' : 'text-gray-900'}`}>{docName(doc)}</p>
                <p className={`text-xs truncate mt-0.5 ${selectedId === doc.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  {doc.authorName} · {doc.updatedAt}
                </p>
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Document */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">클라이언트를 선택하세요</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {/* Doc Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                    {docName(selected)[0]}
                  </div>
                  {editing ? (
                    <div className="flex-1 min-w-0">
                      <input
                        value={draft?.title ?? ''}
                        onChange={e => setDraft(d => d ? { ...d, title: e.target.value } : d)}
                        placeholder={`${clients.find(c => c.id === selected.clientId)?.name ?? selected.clientName} (제목 미입력 시 클라이언트명 사용)`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <p className="text-xs text-gray-400 mt-1">제목을 비워두면 클라이언트 이름이 자동으로 연동됩니다.</p>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900 truncate">{docName(selected)} 인수인계 문서</h2>
                      <p className="text-xs text-gray-400">작성: {selected.authorName} · 최종 수정: {selected.updatedAt}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button onClick={cancelEdit} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <X size={14} /> 취소
                      </button>
                      <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        <Save size={14} /> 저장
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={startEdit} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <Pencil size={14} /> 수정
                      </button>
                      {isAdmin && (
                        <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 transition-colors">
                          <Trash2 size={14} /> 삭제
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {TAB_CONFIG.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Doc Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* 개요 */}
              {tab === 'overview' && (
                <div className="max-w-3xl space-y-4">
                  <CollapsibleSection title="업체 개요 및 현황" icon={<BookOpen size={14} />}>
                    {editing ? (
                      <textarea value={draft?.overview ?? ''} onChange={e => setDraft(d => d ? { ...d, overview: e.target.value } : d)}
                        rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="업체 개요, 현재 운영 현황, 계약 내용 등을 입력하세요..." />
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{doc?.overview || <span className="text-gray-400">내용 없음. 수정 버튼을 눌러 작성하세요.</span>}</p>
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection title="주요 링크" icon={<Link2 size={14} />}>
                    {doc?.importantLinks && doc.importantLinks.length > 0 ? (
                      <div className="space-y-2">
                        {(editing ? draft?.importantLinks : doc.importantLinks)?.map(link => (
                          editing ? (
                            <div key={link.id} className="flex gap-2 items-start">
                              <div className="grid grid-cols-4 gap-2 flex-1">
                                <input value={link.title} onChange={e => updateLink(link.id, { title: e.target.value })} placeholder="제목" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input value={link.url} onChange={e => updateLink(link.id, { url: e.target.value })} placeholder="URL" className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input value={link.category} onChange={e => updateLink(link.id, { category: e.target.value })} placeholder="카테고리" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <button onClick={() => removeLink(link.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          ) : (
                            <div key={link.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full shrink-0">{link.category}</span>
                              <span className="font-medium text-sm text-gray-900 shrink-0">{link.title}</span>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex-1">{link.url}</a>
                              {link.notes && <span className="text-xs text-gray-400 shrink-0">{link.notes}</span>}
                            </div>
                          )
                        ))}
                        {editing && (
                          <button onClick={addLink} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors w-full justify-center">
                            <Plus size={12} /> 링크 추가
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        {editing && <button onClick={addLink} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors"><Plus size={12} /> 링크 추가</button>}
                        {!editing && <p className="text-sm text-gray-400">등록된 링크가 없습니다.</p>}
                      </div>
                    )}
                  </CollapsibleSection>
                </div>
              )}

              {/* 작업 이력 */}
              {tab === 'history' && (
                <div className="max-w-4xl">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="font-semibold text-gray-900 text-sm">전체 작업 이력 ({clientEntries.length}건)</p>
                      <p className="text-xs text-gray-400">최신순 정렬</p>
                    </div>
                    {clientEntries.length === 0 ? (
                      <p className="text-center py-10 text-gray-400 text-sm">작업 이력이 없습니다.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {['날짜', '담당자', '카테고리', '키워드/제목', '링크', '상태'].map(h => (
                                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {clientEntries.map(entry => (
                              <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-medium">{entry.date}</td>
                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">{entry.managerName}</td>
                                <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                                <td className="px-4 py-3 text-gray-800 max-w-[160px]">
                                  <span className="truncate block text-xs">{entry.opinionTitle ?? entry.keyword ?? '-'}</span>
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                  {entry.link ? <a href={entry.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">{entry.link}</a> : <span className="text-gray-300 text-xs">-</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.status === 'completed' ? 'bg-green-50 text-green-700' : entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {entry.status === 'completed' ? '완료' : entry.status === 'in-progress' ? '진행중' : '대기중'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 연락처 */}
              {tab === 'contacts' && (
                <div className="max-w-2xl space-y-3">
                  {(editing ? draft?.keyContacts : doc?.keyContacts)?.map(c => (
                    editing ? (
                      <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-gray-400 uppercase">연락처</span>
                          <button onClick={() => removeContact(c.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={c.name} onChange={e => updateContact(c.id, { name: e.target.value })} placeholder="이름 *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <input value={c.role} onChange={e => updateContact(c.id, { role: e.target.value })} placeholder="직함/역할 *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <input value={c.phone ?? ''} onChange={e => updateContact(c.id, { phone: e.target.value })} placeholder="전화번호" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <input value={c.email ?? ''} onChange={e => updateContact(c.id, { email: e.target.value })} placeholder="이메일" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <input value={c.notes ?? ''} onChange={e => updateContact(c.id, { notes: e.target.value })} placeholder="특이사항 (예: 오전 중 연락 선호)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ) : (
                      <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-gray-900">{c.name}</p>
                            <p className="text-sm text-gray-500">{c.role}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          {c.phone && <div className="text-gray-600">📞 {c.phone}</div>}
                          {c.email && <div className="text-gray-600">✉️ {c.email}</div>}
                        </div>
                        {c.notes && <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">💡 {c.notes}</p>}
                      </div>
                    )
                  ))}
                  {editing && (
                    <button onClick={addContact} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                      <Plus size={16} /> 연락처 추가
                    </button>
                  )}
                  {!editing && (!doc?.keyContacts || doc.keyContacts.length === 0) && (
                    <p className="text-center text-gray-400 py-8 text-sm">등록된 연락처가 없습니다. 수정 버튼을 눌러 추가하세요.</p>
                  )}
                </div>
              )}

              {/* 가이드라인 */}
              {tab === 'guidelines' && (
                <div className="max-w-2xl space-y-4">
                  {[
                    { key: 'guidelines', label: '운영 가이드라인', icon: <FileText size={14} />, placeholder: '게시 빈도, 컨펌 프로세스, 규칙 등을 입력하세요...' },
                    { key: 'tone', label: '톤앤매너', icon: <MessageSquare size={14} />, placeholder: '브랜드 보이스, 말투, 이모지 사용 여부 등...' },
                    { key: 'dontDo', label: '절대 하지 말 것', icon: <AlertTriangle size={14} />, placeholder: '경쟁사 언급, 금지 단어, 민감한 주제 등...' },
                    { key: 'specialNotes', label: '특이사항', icon: <BookOpen size={14} />, placeholder: '시즌 이벤트, 중요 날짜, 특수한 요구사항 등...' },
                  ].map(field => (
                    <CollapsibleSection key={field.key} title={field.label} icon={field.icon}>
                      {editing ? (
                        <textarea
                          value={(draft as unknown as Record<string, string>)?.[field.key] ?? ''}
                          onChange={e => setDraft(d => d ? { ...d, [field.key]: e.target.value } : d)}
                          rows={5} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder={field.placeholder} />
                      ) : (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {(doc as unknown as Record<string, string>)?.[field.key] || <span className="text-gray-400">내용 없음</span>}
                        </p>
                      )}
                    </CollapsibleSection>
                  ))}
                </div>
              )}

              {/* 인수인계 메모 */}
              {tab === 'memo' && (
                <div className="max-w-2xl">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <p className="text-xs font-bold text-amber-700 mb-1">💌 인수인계 메모 작성 안내</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      새로운 담당자가 이 업체를 맡았을 때 꼭 알아야 할 정보, 팁, 주의사항을 자유롭게 작성해주세요.
                      공식 가이드라인에 없는 실무적인 내용일수록 가치 있습니다.
                    </p>
                  </div>
                  {editing ? (
                    <textarea
                      value={draft?.managerMemo ?? ''}
                      onChange={e => setDraft(d => d ? { ...d, managerMemo: e.target.value } : d)}
                      rows={18}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="예: 이 클라이언트에서 가장 중요한 건..., 담당자 연락 시 주의할 점은..., 성과를 낼 수 있었던 비결은..." />
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-2xl p-5">
                      {doc?.managerMemo ? (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{doc.managerMemo}</p>
                      ) : (
                        <p className="text-gray-400 text-sm text-center py-8">인수인계 메모가 없습니다. 수정 버튼을 눌러 작성해주세요.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AI 기획 결과 (해당 업체로 자동 연계) */}
              {tab === 'ai' && doc && (
                <div className="max-w-2xl space-y-3">
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-purple-700 mb-1">🔗 연계된 AI 기획 결과</p>
                    <p className="text-xs text-purple-600 leading-relaxed">
                      이 업체로 생성된 AI 기획 리포트가 자동으로 모입니다. 인수인계 시 함께 참고하세요.
                    </p>
                  </div>
                  {(() => {
                    const linked = aiHistory.filter(p => p.clientId === doc.clientId);
                    return linked.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8 bg-white border border-gray-100 rounded-2xl">
                        연계된 AI 기획 결과가 없습니다. (AI 기획 메뉴에서 이 업체로 생성하면 자동 표시됩니다)
                      </p>
                    ) : linked.map(p => {
                      const saved = p.images.filter(i => i.saved);
                      return (
                      <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1.5">
                              {p.campaignType} · {p.period.start} ~ {p.period.end}
                              {saved.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full text-xs shrink-0">
                                  <ImageIcon size={9} /> {saved.length}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleString('ko-KR')}{p.authorName ? ` · ${p.authorName}` : ''}</p>
                          </div>
                          <button onClick={() => openAiPlanPrint(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors whitespace-nowrap shrink-0">
                            <FileText size={12} /> PDF 보기
                          </button>
                        </div>
                        {saved.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {saved.map(img => (
                              <div key={img.id} className="border border-gray-100 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between px-2 py-1 bg-gray-50 gap-1">
                                  <span className="text-[11px] font-semibold text-gray-600 truncate">{img.channel}</span>
                                  <a href={img.url} download={`${img.channel}_시안.png`}
                                    className="flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-purple-600 transition-colors shrink-0">
                                    <Download size={10} />
                                  </a>
                                </div>
                                <img src={img.url} alt={`${img.channel} 시안`} className="w-full object-contain bg-gray-50" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* AI 프롬프트 */}
              {tab === 'prompt' && (
                <div className="max-w-2xl space-y-4">
                  <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Sparkles size={20} /></div>
                      <div>
                        <p className="font-bold">AI 통합 프롬프트</p>
                        <p className="text-purple-200 text-sm">이 문서의 모든 정보를 AI가 이해할 수 있는 형태로 정리합니다</p>
                      </div>
                    </div>
                    <p className="text-purple-100 text-sm leading-relaxed">
                      생성된 프롬프트를 ChatGPT, Claude 등 AI 도구에 붙여넣으면 이 클라이언트의 맥락을 이해한 AI 어시스턴트로 활용할 수 있습니다.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm">생성된 프롬프트</p>
                      <button onClick={copyPrompt}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${promptCopied ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        {promptCopied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
                      </button>
                    </div>
                    <pre className="p-5 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 overflow-auto max-h-[500px]">
                      {promptText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useState } from 'react';
import {
  Plus, Mail, Calendar, X, Pencil, Users, Phone, Save, Check, Copy, Sparkles,
  Link2, FileText, AlertTriangle, MessageSquare, BookOpen, ChevronDown, ChevronUp,
  Trash2, ImageIcon, Download,
} from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { openAiPlanPrint } from '../utils/aiPlanPdf';
import { todayStr } from '../utils/today';
import type { Client, Category, HandoverDoc, KeyContact, ImportantLink } from '../types';

const ALL_CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업'];
const STATUS_ORDER: Record<string, number> = { active: 0, pending: 1, inactive: 2 };

const EMPTY_CLIENT: Omit<Client, 'id'> = {
  name: '', industry: '', contactPerson: '', email: '', phone: '',
  startDate: '', categories: [], status: 'active', description: '', monthlyBudget: '',
};

type DetailTab = 'overview' | 'schedule' | 'contacts' | 'guidelines' | 'memo' | 'ai' | 'prompt';

const TAB_CONFIG = [
  { key: 'overview',   icon: <BookOpen size={14} />,      label: '개요' },
  { key: 'schedule',   icon: <Calendar size={14} />,      label: '스케줄' },
  { key: 'contacts',   icon: <Users size={14} />,         label: '연락처' },
  { key: 'guidelines', icon: <AlertTriangle size={14} />, label: '가이드라인' },
  { key: 'memo',       icon: <MessageSquare size={14} />, label: '인수인계 메모' },
  { key: 'ai',         icon: <Sparkles size={14} />,      label: 'AI 기획' },
  { key: 'prompt',     icon: <Sparkles size={14} />,      label: 'AI 프롬프트' },
] as const;

// 인수인계 내용을 인라인 편집할 수 있는 탭들
const HANDOVER_EDIT_TABS = new Set<DetailTab>(['overview', 'contacts', 'guidelines', 'memo']);

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
작성자: ${doc.authorName || '-'} | 최종 수정: ${doc.updatedAt}

## 업체 개요
${doc.overview || '(없음)'}

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

function StatusDot({ status }: { status: Client['status'] }) {
  const map = { active: 'bg-green-400', inactive: 'bg-gray-300', pending: 'bg-amber-400' };
  const label = { active: '활성', inactive: '비활성', pending: '대기' };
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${map[status]}`} />
      {label[status]}
    </span>
  );
}

export default function ClientManagementPage() {
  const { entries, clients, saveClient, handoverDocs, saveHandover, aiHistory } = useApp();
  const { user } = useAuth();

  const [selected, setSelected] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<Omit<Client, 'id'>>(EMPTY_CLIENT);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 상세 화면 탭 + 인수인계 인라인 편집 상태
  const [tab, setTab] = useState<DetailTab>('overview');
  const [hoEditing, setHoEditing] = useState(false);
  const [hoDraft, setHoDraft] = useState<HandoverDoc | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // Sort: active → pending → inactive
  const sorted = [...clients].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const filtered = sorted.filter(c => filterStatus === 'all' || c.status === filterStatus);

  const openClient = (c: Client) => { setSelected(c); setTab('overview'); setHoEditing(false); setHoDraft(null); };
  const closeClient = () => { setSelected(null); setHoEditing(false); setHoDraft(null); };

  const openAdd = () => { setForm(EMPTY_CLIENT); setEditClient(null); setShowForm(true); };
  const openEdit = (c: Client) => { setForm({ ...c }); setEditClient(c); setShowForm(true); };

  const handleSave = () => {
    if (!form.name || !form.email) { alert('업체명과 이메일은 필수입니다.'); return; }
    if (editClient) {
      const updated = { ...form, id: editClient.id };
      saveClient(updated);
      if (selected?.id === editClient.id) setSelected(updated);
    } else {
      saveClient({ ...form, id: Date.now().toString() });
    }
    setShowForm(false);
  };

  const handleStatusChange = (clientId: string, status: Client['status']) => {
    const c = clients.find(x => x.id === clientId);
    if (c) saveClient({ ...c, status });
    if (selected?.id === clientId) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const toggleCategory = (cat: Category) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  // ── 인수인계 (클라이언트당 1개) ──
  const handoverDoc = selected ? handoverDocs.find(d => d.clientId === selected.id) ?? null : null;
  // 인수인계는 클라이언트와 1:1 이므로 결정적 id 를 사용(렌더 중 호출돼도 안정적)
  const emptyHandover = (client: Client): HandoverDoc => ({
    id: `ho-${client.id}`,
    clientId: client.id,
    clientName: client.name,
    authorId: user?.id ?? '',
    authorName: user?.name ?? '',
    updatedAt: todayStr(),
    overview: '', keyContacts: [], importantLinks: [],
    guidelines: '', tone: '', dontDo: '', specialNotes: '', managerMemo: '',
  });

  const startHoEdit = () => {
    if (!selected) return;
    const base = handoverDoc
      ? { ...handoverDoc, keyContacts: handoverDoc.keyContacts.map(c => ({ ...c })), importantLinks: handoverDoc.importantLinks.map(l => ({ ...l })) }
      : emptyHandover(selected);
    setHoDraft(base);
    setHoEditing(true);
  };
  const saveHoEdit = () => {
    if (!hoDraft) return;
    saveHandover({ ...hoDraft, updatedAt: todayStr(), authorId: user?.id ?? hoDraft.authorId, authorName: user?.name ?? hoDraft.authorName });
    setHoEditing(false);
    setHoDraft(null);
  };
  const cancelHoEdit = () => { setHoEditing(false); setHoDraft(null); };

  // 화면에 표시할 인수인계 데이터(편집 중이면 draft)
  const hoView = hoEditing ? hoDraft : handoverDoc;

  const addContact = () => setHoDraft(d => d ? { ...d, keyContacts: [...d.keyContacts, { id: Date.now().toString(), name: '', role: '', phone: '', email: '', notes: '' }] } : d);
  const removeContact = (id: string) => setHoDraft(d => d ? { ...d, keyContacts: d.keyContacts.filter(c => c.id !== id) } : d);
  const updateContact = (id: string, patch: Partial<KeyContact>) => setHoDraft(d => d ? { ...d, keyContacts: d.keyContacts.map(c => c.id === id ? { ...c, ...patch } : c) } : d);

  const addLink = () => setHoDraft(d => d ? { ...d, importantLinks: [...d.importantLinks, { id: Date.now().toString(), title: '', url: '', category: 'SNS', notes: '' }] } : d);
  const removeLink = (id: string) => setHoDraft(d => d ? { ...d, importantLinks: d.importantLinks.filter(l => l.id !== id) } : d);
  const updateLink = (id: string, patch: Partial<ImportantLink>) => setHoDraft(d => d ? { ...d, importantLinks: d.importantLinks.map(l => l.id === id ? { ...l, ...patch } : l) } : d);

  const clientEntries = selected ? entries.filter(e => e.clientId === selected.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const promptText = selected ? generatePrompt({ ...(handoverDoc ?? emptyHandover(selected)), clientName: selected.name }, entries) : '';
  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  return (
    <Layout>
      <Header title="클라이언트 관리" subtitle="업체 정보·스케줄·인수인계를 한곳에서 관리합니다" />
      <div className="flex-1 p-4 lg:p-6">
        {selected ? (
          /* === Client Detail View === */
          <div className="space-y-5">
            <button onClick={closeClient} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              ← 목록으로
            </button>

            {/* Header card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl lg:text-2xl font-bold shrink-0">
                    {selected.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg lg:text-xl font-bold text-gray-900 truncate">{selected.name}</h2>
                      <StatusDot status={selected.status} />
                    </div>
                    <p className="text-gray-500 text-sm">{selected.industry || '업종 미입력'}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {selected.categories.map(c => <CategoryBadge key={c} category={c} />)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selected.status}
                    onChange={e => handleStatusChange(selected.id, e.target.value as Client['status'])}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">활성</option>
                    <option value="pending">대기</option>
                    <option value="inactive">비활성</option>
                  </select>
                  <button onClick={() => openEdit(selected)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <Pencil size={14} /> 정보 수정
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 flex-wrap mt-5 pt-4 border-t border-gray-100">
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

            {/* 인수인계 편집 툴바 (편집 가능한 탭에서만) */}
            {HANDOVER_EDIT_TABS.has(tab) && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-gray-400">
                  {handoverDoc ? `인수인계 최종 수정: ${handoverDoc.updatedAt}${handoverDoc.authorName ? ` · ${handoverDoc.authorName}` : ''}` : '아직 작성된 인수인계 정보가 없습니다.'}
                </p>
                {hoEditing ? (
                  <div className="flex items-center gap-2">
                    <button onClick={cancelHoEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                      <X size={13} /> 취소
                    </button>
                    <button onClick={saveHoEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                      <Save size={13} /> 인수인계 저장
                    </button>
                  </div>
                ) : (
                  <button onClick={startHoEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                    <Pencil size={13} /> {handoverDoc ? '인수인계 수정' : '인수인계 작성'}
                  </button>
                )}
              </div>
            )}

            {/* === 개요 === */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* 계약/기본 정보 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: '담당자', value: selected.contactPerson, icon: <Users size={14} /> },
                      { label: '이메일', value: selected.email, icon: <Mail size={14} /> },
                      { label: '연락처', value: selected.phone, icon: <Phone size={14} /> },
                      { label: '계약 시작', value: selected.startDate, icon: <Calendar size={14} /> },
                      { label: '계약 종료', value: selected.contractEnd, icon: <Calendar size={14} /> },
                      { label: '월 예산', value: selected.monthlyBudget, icon: <FileText size={14} /> },
                    ].map(info => (
                      <div key={info.label}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1">{info.icon} {info.label}</div>
                        <p className="text-sm text-gray-800 font-medium break-words">{info.value || '-'}</p>
                      </div>
                    ))}
                  </div>
                  {selected.description && (
                    <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-wrap">{selected.description}</p>
                  )}
                </div>

                {/* 인수인계 개요 + 주요 링크 */}
                <div className="max-w-3xl">
                  <CollapsibleSection title="업체 개요 및 현황 (인수인계)" icon={<BookOpen size={14} />}>
                    {hoEditing ? (
                      <textarea value={hoDraft?.overview ?? ''} onChange={e => setHoDraft(d => d ? { ...d, overview: e.target.value } : d)}
                        rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="업체 개요, 현재 운영 현황, 계약 내용 등을 입력하세요..." />
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{hoView?.overview || <span className="text-gray-400">내용 없음. '인수인계 작성'을 눌러 작성하세요.</span>}</p>
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection title="주요 링크" icon={<Link2 size={14} />}>
                    {(hoView?.importantLinks && hoView.importantLinks.length > 0) || hoEditing ? (
                      <div className="space-y-2">
                        {hoView?.importantLinks?.map(link => (
                          hoEditing ? (
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
                        {hoEditing && (
                          <button onClick={addLink} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors w-full justify-center">
                            <Plus size={12} /> 링크 추가
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">등록된 링크가 없습니다.</p>
                    )}
                  </CollapsibleSection>
                </div>
              </div>
            )}

            {/* === 스케줄 === */}
            {tab === 'schedule' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">전체 스케줄 ({clientEntries.length}건)</p>
                  <p className="text-xs text-gray-400">최신순 정렬</p>
                </div>
                {clientEntries.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">등록된 스케줄이 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['날짜', '담당자', '카테고리', '키워드/제목', '링크', '순위', '상태'].map(h => (
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
                            <td className="px-4 py-3 text-gray-800 max-w-[160px]"><span className="truncate block text-xs">{entry.opinionTitle ?? entry.keyword ?? '-'}</span></td>
                            <td className="px-4 py-3 max-w-[180px]">
                              {entry.link ? <a href={entry.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">{entry.link}</a> : <span className="text-gray-300 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">{entry.rank ? <span className="text-blue-700 font-bold">{entry.rank}</span> : '-'}</td>
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
            )}

            {/* === 연락처 === */}
            {tab === 'contacts' && (
              <div className="max-w-2xl space-y-3">
                {hoView?.keyContacts?.map(c => (
                  hoEditing ? (
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
                {hoEditing && (
                  <button onClick={addContact} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                    <Plus size={16} /> 연락처 추가
                  </button>
                )}
                {!hoEditing && (!hoView?.keyContacts || hoView.keyContacts.length === 0) && (
                  <p className="text-center text-gray-400 py-8 text-sm">등록된 연락처가 없습니다. '인수인계 수정'을 눌러 추가하세요.</p>
                )}
              </div>
            )}

            {/* === 가이드라인 === */}
            {tab === 'guidelines' && (
              <div className="max-w-2xl">
                {[
                  { key: 'guidelines', label: '운영 가이드라인', icon: <FileText size={14} />, placeholder: '게시 빈도, 컨펌 프로세스, 규칙 등을 입력하세요...' },
                  { key: 'tone', label: '톤앤매너', icon: <MessageSquare size={14} />, placeholder: '브랜드 보이스, 말투, 이모지 사용 여부 등...' },
                  { key: 'dontDo', label: '절대 하지 말 것', icon: <AlertTriangle size={14} />, placeholder: '경쟁사 언급, 금지 단어, 민감한 주제 등...' },
                  { key: 'specialNotes', label: '특이사항', icon: <BookOpen size={14} />, placeholder: '시즌 이벤트, 중요 날짜, 특수한 요구사항 등...' },
                ].map(field => (
                  <CollapsibleSection key={field.key} title={field.label} icon={field.icon}>
                    {hoEditing ? (
                      <textarea
                        value={(hoDraft as unknown as Record<string, string>)?.[field.key] ?? ''}
                        onChange={e => setHoDraft(d => d ? { ...d, [field.key]: e.target.value } : d)}
                        rows={5} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder={field.placeholder} />
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {(hoView as unknown as Record<string, string>)?.[field.key] || <span className="text-gray-400">내용 없음</span>}
                      </p>
                    )}
                  </CollapsibleSection>
                ))}
              </div>
            )}

            {/* === 인수인계 메모 === */}
            {tab === 'memo' && (
              <div className="max-w-2xl">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                  <p className="text-xs font-bold text-amber-700 mb-1">💌 인수인계 메모 작성 안내</p>
                  <p className="text-xs text-amber-600 leading-relaxed">
                    새로운 담당자가 이 업체를 맡았을 때 꼭 알아야 할 정보, 팁, 주의사항을 자유롭게 작성해주세요.
                    공식 가이드라인에 없는 실무적인 내용일수록 가치 있습니다.
                  </p>
                </div>
                {hoEditing ? (
                  <textarea
                    value={hoDraft?.managerMemo ?? ''}
                    onChange={e => setHoDraft(d => d ? { ...d, managerMemo: e.target.value } : d)}
                    rows={18}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="예: 이 클라이언트에서 가장 중요한 건..., 담당자 연락 시 주의할 점은..., 성과를 낼 수 있었던 비결은..." />
                ) : (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    {hoView?.managerMemo ? (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{hoView.managerMemo}</p>
                    ) : (
                      <p className="text-gray-400 text-sm text-center py-8">인수인계 메모가 없습니다. '인수인계 작성'을 눌러 작성해주세요.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === AI 기획 결과 === */}
            {tab === 'ai' && (
              <div className="max-w-2xl space-y-3">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-purple-700 mb-1">🔗 연계된 AI 기획 결과</p>
                  <p className="text-xs text-purple-600 leading-relaxed">
                    이 업체로 생성된 AI 기획 리포트가 자동으로 모입니다. 인수인계 시 함께 참고하세요.
                  </p>
                </div>
                {(() => {
                  const linked = aiHistory.filter(p => p.clientId === selected.id);
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

            {/* === AI 프롬프트 === */}
            {tab === 'prompt' && (
              <div className="max-w-2xl space-y-4">
                <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Sparkles size={20} /></div>
                    <div>
                      <p className="font-bold">AI 통합 프롬프트</p>
                      <p className="text-purple-200 text-sm">이 업체의 모든 정보를 AI가 이해할 수 있는 형태로 정리합니다</p>
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
        ) : (
          /* === Client List === */
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                {['all', 'active', 'pending', 'inactive'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {s === 'all' ? '전체' : s === 'active' ? '활성' : s === 'pending' ? '대기' : '비활성'}
                    <span className="ml-1.5 text-xs opacity-75">
                      ({s === 'all' ? clients.length : clients.filter(c => c.status === s).length})
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus size={16} /> 클라이언트 추가
              </button>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(client => {
                const hasHandover = handoverDocs.some(d => d.clientId === client.id);
                return (
                  <div key={client.id} onClick={() => openClient(client)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
                          {client.name[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{client.name}</h3>
                          <p className="text-xs text-gray-400">{client.industry}</p>
                        </div>
                      </div>
                      <StatusDot status={client.status} />
                    </div>

                    <div className="flex gap-1 flex-wrap mb-4">
                      {client.categories.map(c => <CategoryBadge key={c} category={c} />)}
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-50 pt-3">
                      <div className="flex items-center gap-2"><Mail size={12} /> {client.email}</div>
                      <div className="flex items-center gap-2"><Calendar size={12} /> 계약 시작: {client.startDate}</div>
                      <div className="flex items-center justify-between">
                        {client.monthlyBudget ? <span className="font-medium text-blue-600">월 {client.monthlyBudget}</span> : <span />}
                        <span className={`inline-flex items-center gap-1 text-xs ${hasHandover ? 'text-emerald-600' : 'text-gray-300'}`}>
                          <FileText size={12} /> {hasHandover ? '인수인계 있음' : '인수인계 없음'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editClient ? '클라이언트 수정' : '클라이언트 추가'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '업체명 *', key: 'name', placeholder: '스타벅스 코리아' },
                  { label: '업종', key: 'industry', placeholder: '식음료' },
                  { label: '담당자 이름', key: 'contactPerson', placeholder: '홍길동' },
                  { label: '이메일 *', key: 'email', placeholder: 'contact@company.com' },
                  { label: '연락처', key: 'phone', placeholder: '02-1234-5678' },
                  { label: '계약 시작일', key: 'startDate', type: 'date', placeholder: '' },
                  { label: '계약 종료일', key: 'contractEnd', type: 'date', placeholder: '' },
                  { label: '월 예산', key: 'monthlyBudget', placeholder: '500만원' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type ?? 'text'}
                      value={(form as Record<string, unknown>)[f.key] as string ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {ALL_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        form.categories.includes(cat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}>{cat}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상태</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as Client['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="active">활성</option>
                  <option value="pending">대기</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">설명</label>
                <textarea value={form.description ?? ''} rows={2}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="클라이언트 설명 또는 계약 내용" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                {editClient ? '수정하기' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

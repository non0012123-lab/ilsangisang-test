import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, Phone, Mail, PhoneCall, AlertCircle, CalendarClock, Copy, Check, CornerDownRight, MessageSquarePlus } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { SalesEntry, SalesChannel, SalesSentiment, SalesStatus } from '../types';
import { toNasForOS } from '../utils/nasPath';
import { dateTimeMs } from '../utils/today';

// 기간 필터(오늘 기준 과거) — 미래 상담은 없으므로 오늘까지만. 기본값 7일.
type RangeKey = 'today' | '7' | '30' | 'all';
const RANGES: { v: RangeKey; label: string; days: number }[] = [
  { v: 'today', label: '당일', days: 1 },
  { v: '7', label: '7일', days: 7 },
  { v: '30', label: '30일', days: 30 },
  { v: 'all', label: '전체', days: 0 },
];
// consultedAt 날짜(YYYY-MM-DD)가 "오늘로부터 며칠 전"인지 (오늘=0, 어제=1 …, 미래=음수)
const daysAgo = (consultedAt: string | undefined, today: string): number => {
  const ds = (consultedAt ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return Infinity;
  const [y, m, d] = ds.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(y, m - 1, d).getTime()) / 86400000);
};

// 라벨·색상 정의 ─────────────────────────────────────────
const CHANNELS: { v: SalesChannel; label: string }[] = [
  { v: 'phone', label: '전화' },
  { v: 'inquiry', label: '이메일' },
  { v: 'referral', label: '소개' },
  { v: 'etc', label: '기타' },
];
const SENTIMENTS: { v: SalesSentiment; label: string; cls: string }[] = [
  { v: 'very_positive', label: '매우긍정', cls: 'bg-emerald-100 text-emerald-700' },
  { v: 'positive', label: '긍정', cls: 'bg-green-100 text-green-700' },
  { v: 'neutral', label: '보통', cls: 'bg-gray-100 text-gray-600' },
  { v: 'negative', label: '부정', cls: 'bg-orange-100 text-orange-700' },
  { v: 'very_negative', label: '매우부정', cls: 'bg-red-100 text-red-700' },
];
const STATUSES: { v: SalesStatus; label: string; cls: string }[] = [
  { v: 'new', label: '신규(미처리)', cls: 'bg-blue-100 text-blue-700' },
  { v: 'absent', label: '부재', cls: 'bg-slate-100 text-slate-500' },
  { v: 'prospect', label: '가망', cls: 'bg-teal-100 text-teal-700' },
  { v: 'in_progress', label: '진행중', cls: 'bg-amber-100 text-amber-700' },
  { v: 'done', label: '완료', cls: 'bg-green-100 text-green-700' },
  { v: 'hold', label: '보류', cls: 'bg-gray-100 text-gray-600' },
];
const clsOf =(arr: { v: string; label: string; cls: string }[], v: string) => arr.find(x => x.v === v)?.cls ?? 'bg-gray-100 text-gray-600';

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtDateTime = (s: string) => s ? s.replace('T', ' ').slice(0, 16) : '-';

type Form = Omit<SalesEntry, 'id' | 'handlerId' | 'handlerName' | 'createdAt' | 'updatedAt'>;
const emptyForm = (): Form => ({
  consultedAt: nowLocal(), channel: 'phone', phone: '', email: '', customerName: '',
  content: '', sentiment: 'neutral', status: 'new', followUpDate: '', nasLink: '', result: '', tags: [],
});

export default function SalesPage() {
  const { salesEntries, saveSalesEntry, removeSalesEntry, addSalesReply, removeSalesReply } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState<SalesStatus | '전체'>('전체');
  const [fSent, setFSent] = useState<SalesSentiment | '전체'>('전체');
  const [fRange, setFRange] = useState<RangeKey>('7'); // 기본 7일
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<string | null>(null); // 답글 입력창이 열린 상담 id
  const [replyText, setReplyText] = useState('');

  const submitReply = (entryId: string) => {
    const text = replyText.trim();
    if (!text) return;
    addSalesReply(entryId, {
      id: `slr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: text, handlerId: user?.id ?? '', handlerName: user?.name ?? '',
      consultedAt: nowLocal(), createdAt: Date.now(),
    });
    setReplyText(''); setReplyOpen(null);
  };

  // NAS 링크 복사(바로가기 X — 폴더경로라 탐색기에 붙여넣는 용도)
  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(toNasForOS(link)).catch(() => {}); // NAS 면 보는 OS 방언으로 복사
    setCopiedId(id);
    setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
  };
  // 표에서 척도·상태를 모달 없이 바로 변경
  const patchSales = (e: SalesEntry, patch: Partial<SalesEntry>) =>
    saveSalesEntry({ ...e, ...patch, updatedAt: Date.now() });

  // 요약 카드 지표
  const stats = useMemo(() => {
    const t = todayStr();
    return {
      today: salesEntries.filter(e => (e.consultedAt ?? '').slice(0, 10) === t).length,
      pending: salesEntries.filter(e => e.status === 'new').length,
      followToday: salesEntries.filter(e => e.followUpDate === t && e.status !== 'done').length,
      negative: salesEntries.filter(e => e.sentiment === 'negative' || e.sentiment === 'very_negative').length,
    };
  }, [salesEntries]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const t = todayStr();
    const days = RANGES.find(r => r.v === fRange)?.days ?? 0;
    return salesEntries
      .filter(e => fStatus === '전체' || e.status === fStatus)
      .filter(e => fSent === '전체' || e.sentiment === fSent)
      // 기간: '전체'면 전부, 아니면 오늘 기준 과거 days일 이내(미래 제외)
      .filter(e => { if (fRange === 'all') return true; const d = daysAgo(e.consultedAt, t); return d >= 0 && d < days; })
      .filter(e => !q || [e.content, e.customerName, e.phone, e.email, e.handlerName, ...(e.replies ?? []).map(r => r.content)].some(v => (v ?? '').toLowerCase().includes(q)))
      // 최신순: 상담 일시(시·분 포함)로 정렬. 'T'/공백/날짜만 섞여도 안정 정렬, 동률이면 등록순.
      .sort((a, b) => dateTimeMs(b.consultedAt) - dateTimeMs(a.consultedAt) || (b.createdAt - a.createdAt));
  }, [salesEntries, fStatus, fSent, fRange, q]);

  const openAdd = () => { setForm(emptyForm()); setEditId(null); setShowForm(true); };
  const openEdit = (e: SalesEntry) => {
    setForm({
      consultedAt: e.consultedAt, channel: e.channel, phone: e.phone ?? '', email: e.email ?? '',
      customerName: e.customerName ?? '', content: e.content, sentiment: e.sentiment, status: e.status,
      followUpDate: e.followUpDate ?? '', nasLink: e.nasLink ?? '', result: e.result ?? '', tags: e.tags ?? [],
    });
    setEditId(e.id); setShowForm(true);
  };
  const save = () => {
    if (!form.content.trim()) { alert('상담 내용은 필수입니다.'); return; }
    const prev = editId ? salesEntries.find(e => e.id === editId) : undefined;
    const now = Date.now();
    saveSalesEntry({
      ...form,
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      customerName: form.customerName?.trim() || undefined,
      followUpDate: form.followUpDate || undefined,
      nasLink: form.nasLink?.trim() || undefined,
      result: form.result?.trim() || undefined,
      replies: prev?.replies, // ★ 수정 시 기존 답글 스레드 보존(form 에는 replies 가 없어 덮어쓰면 소실됨)
      id: editId ?? `sl-${now}-${Math.random().toString(36).slice(2, 6)}`,
      handlerId: prev?.handlerId ?? user?.id ?? '',
      handlerName: prev?.handlerName ?? user?.name ?? '',
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
    setShowForm(false);
  };
  const del = (e: SalesEntry) => { if (window.confirm('이 상담 기록을 삭제할까요? (되돌릴 수 없음)')) removeSalesEntry(e.id); };

  return (
    <Layout>
      <Header title="영업관리" subtitle="공용 전화·문의폼 상담을 기록하고 응대 여부를 관리합니다 (권한자 전용)" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<PhoneCall size={18} />} color="text-blue-600 bg-blue-50" label="오늘 상담" value={stats.today} />
          <StatCard icon={<AlertCircle size={18} />} color="text-amber-600 bg-amber-50" label="미처리(신규)" value={stats.pending} />
          <StatCard icon={<CalendarClock size={18} />} color="text-violet-600 bg-violet-50" label="오늘 후속예정" value={stats.followToday} />
          <StatCard icon={<AlertCircle size={18} />} color="text-red-600 bg-red-50" label="부정 상담(누적)" value={stats.negative} />
        </div>

        {/* 필터 + 추가 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 기간 필터(오늘 기준 과거) — 세그먼트 버튼, 기본 7일 */}
            <div className="inline-flex items-center bg-gray-100 rounded-xl p-0.5">
              {RANGES.map(r => (
                <button key={r.v} onClick={() => setFRange(r.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${fRange === r.v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="내용·고객·연락처 검색"
                className="border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={fStatus} onChange={e => setFStatus(e.target.value as SalesStatus | '전체')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="전체">상태 전체</option>
              {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
            <select value={fSent} onChange={e => setFSent(e.target.value as SalesSentiment | '전체')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="전체">척도 전체</option>
              {SENTIMENTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl">
            <Plus size={16} /> 상담 기록
          </button>
        </div>

        {/* 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            {salesEntries.length === 0 ? '아직 상담 기록이 없습니다. ‘상담 기록’으로 추가하세요.' : '조건에 맞는 상담이 없습니다.'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase">
                  {['날짜', '고객사', '연락처', '채널', '내용', '담당자', '척도', '상태', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDateTime(e.consultedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{e.customerName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {e.phone && <div className="flex items-center gap-1"><Phone size={11} className="text-gray-400" />{e.phone}</div>}
                      {e.email && <div className="flex items-center gap-1"><Mail size={11} className="text-gray-400" />{e.email}</div>}
                      {!e.phone && !e.email && '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select value={e.channel} onChange={ev => patchSales(e, { channel: ev.target.value as SalesChannel })}
                        className="text-xs font-medium rounded-lg px-1.5 py-1 border border-gray-200 text-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {CHANNELS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 max-w-md min-w-[160px]">
                      <span className="block whitespace-pre-line break-words text-gray-700">{e.content}</span>
                      {e.nasLink && (
                        <button onClick={() => copyLink(e.id, e.nasLink!)}
                          className={`mt-0.5 ml-2 inline-flex items-center gap-1 text-xs transition-colors ${copiedId === e.id ? 'text-green-600' : 'text-gray-500 hover:text-blue-600'}`}
                          title={toNasForOS(e.nasLink)}>
                          {copiedId === e.id ? <Check size={11} /> : <Copy size={11} />}
                          {copiedId === e.id ? '복사됨' : 'NAS 링크 복사'}
                        </button>
                      )}
                      {/* 답글 스레드(후속 상담) — 수정에 들어가지 않고 그 밑에 이어 기록 */}
                      {(e.replies ?? []).map(r => (
                        <div key={r.id} className="mt-1.5 flex items-start gap-1.5 border-l-2 border-gray-200 pl-2 group/reply">
                          <CornerDownRight size={12} className="text-gray-300 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-gray-400">
                              {r.handlerName || '담당자'} · {fmtDateTime(r.consultedAt || '')}
                            </div>
                            <div className="whitespace-pre-line break-words text-gray-600 text-[13px]">{r.content}</div>
                          </div>
                          <button onClick={() => { if (window.confirm('이 답글을 삭제할까요?')) removeSalesReply(e.id, r.id); }}
                            className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover/reply:opacity-100 transition-opacity" title="답글 삭제">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {/* 답글 입력창 / 답글 달기 버튼 */}
                      {replyOpen === e.id ? (
                        <div className="mt-2 flex items-start gap-1.5">
                          <textarea value={replyText} onChange={ev => setReplyText(ev.target.value)} rows={2} autoFocus
                            onKeyDown={ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') submitReply(e.id); }}
                            placeholder="후속 상담 내용 (Ctrl/⌘+Enter 등록)"
                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <div className="flex flex-col gap-1">
                            <button onClick={() => submitReply(e.id)} className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white">등록</button>
                            <button onClick={() => { setReplyOpen(null); setReplyText(''); }} className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setReplyOpen(e.id); setReplyText(''); }}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600">
                          <MessageSquarePlus size={12} /> 답글
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{e.handlerName || '-'}</td>
                    <td className="px-4 py-3">
                      <select value={e.sentiment} onChange={ev => patchSales(e, { sentiment: ev.target.value as SalesSentiment })}
                        className={`text-xs font-semibold rounded-full pl-2 pr-1 py-0.5 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${clsOf(SENTIMENTS, e.sentiment)}`}>
                        {SENTIMENTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={e.status} onChange={ev => patchSales(e, { status: ev.target.value as SalesStatus })}
                        className={`text-xs font-semibold rounded-full pl-2 pr-1 py-0.5 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${clsOf(STATUSES, e.status)}`}>
                        {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600" title="수정"><Pencil size={15} /></button>
                        <button onClick={() => del(e)} className="p-1.5 text-gray-400 hover:text-red-500" title="삭제"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editId ? '상담 수정' : '상담 기록'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="상담 일시">
                <input type="datetime-local" value={form.consultedAt} onChange={e => setForm(f => ({ ...f, consultedAt: e.target.value }))} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="채널">
                  <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as SalesChannel }))} className={inputCls}>
                    {CHANNELS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="고객/업체명"><input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="전화번호"><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" className={inputCls} /></Field>
                <Field label="이메일"><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" className={inputCls} /></Field>
              </div>
              <Field label="상담 내용 *">
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="척도">
                  <select value={form.sentiment} onChange={e => setForm(f => ({ ...f, sentiment: e.target.value as SalesSentiment }))} className={inputCls}>
                    {SENTIMENTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="처리 상태">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SalesStatus }))} className={inputCls}>
                    {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="후속 예정일 (선택)"><input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} className={inputCls} /></Field>
              <Field label="NAS 링크 (선택)"><input value={form.nasLink} onChange={e => setForm(f => ({ ...f, nasLink: e.target.value }))} placeholder="https://… (녹취·문의폼 캡처 등)" className={inputCls} /></Field>
              <Field label="결과/메모 (선택)"><textarea value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} rows={2} className={inputCls} /></Field>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white">{editId ? '저장' : '등록'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-extrabold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

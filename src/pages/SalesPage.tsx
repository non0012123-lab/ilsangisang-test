import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, Phone, Mail, PhoneCall, AlertCircle, CalendarClock } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { SalesEntry, SalesChannel, SalesSentiment, SalesStatus } from '../types';

// 라벨·색상 정의 ─────────────────────────────────────────
const CHANNELS: { v: SalesChannel; label: string }[] = [
  { v: 'phone', label: '전화' },
  { v: 'inquiry', label: '문의폼(이메일)' },
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
  { v: 'in_progress', label: '진행중', cls: 'bg-amber-100 text-amber-700' },
  { v: 'done', label: '완료', cls: 'bg-green-100 text-green-700' },
  { v: 'hold', label: '보류', cls: 'bg-gray-100 text-gray-600' },
];
const labelOf = <T extends string>(arr: { v: T; label: string }[], v: T) => arr.find(x => x.v === v)?.label ?? v;
const clsOf = (arr: { v: string; label: string; cls: string }[], v: string) => arr.find(x => x.v === v)?.cls ?? 'bg-gray-100 text-gray-600';

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
  const { salesEntries, saveSalesEntry, removeSalesEntry } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState<SalesStatus | '전체'>('전체');
  const [fSent, setFSent] = useState<SalesSentiment | '전체'>('전체');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

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
  const filtered = useMemo(() => salesEntries
    .filter(e => fStatus === '전체' || e.status === fStatus)
    .filter(e => fSent === '전체' || e.sentiment === fSent)
    .filter(e => !q || [e.content, e.customerName, e.phone, e.email, e.handlerName].some(v => (v ?? '').toLowerCase().includes(q)))
    .sort((a, b) => (b.consultedAt ?? '').localeCompare(a.consultedAt ?? '')), [salesEntries, fStatus, fSent, q]);

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
                  {['일시', '응대자', '채널', '연락처/이메일', '고객', '내용', '척도', '상태', ''].map(h => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDateTime(e.consultedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{e.handlerName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{labelOf(CHANNELS, e.channel)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {e.phone && <div className="flex items-center gap-1"><Phone size={11} className="text-gray-400" />{e.phone}</div>}
                      {e.email && <div className="flex items-center gap-1"><Mail size={11} className="text-gray-400" />{e.email}</div>}
                      {!e.phone && !e.email && '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{e.customerName || '-'}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="line-clamp-2 text-gray-600">{e.content}</span>
                      {e.nasLink && <a href={e.nasLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">🔗 NAS 링크</a>}
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${clsOf(SENTIMENTS, e.sentiment)}`}>{labelOf(SENTIMENTS, e.sentiment)}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${clsOf(STATUSES, e.status)}`}>{labelOf(STATUSES, e.status)}</span></td>
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

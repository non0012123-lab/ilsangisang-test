import { useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, Wand2, Loader2, Check, Phone, Mail, Boxes, User, Wallet } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Vendor } from '../types';

const EMPTY_VENDOR: Omit<Vendor, 'id'> = {
  name: '', services: '', contactPerson: '', phone: '', email: '', pricing: '', notes: '', status: 'active',
};

const STATUS_ORDER: Record<string, number> = { active: 0, inactive: 1 };

interface AiVendorResult {
  summary: string;
  name: string; services: string; contactPerson: string; phone: string; email: string; pricing: string; notes: string;
}

export default function VendorManagementPage() {
  const { vendors, saveVendor, removeVendor } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Omit<Vendor, 'id'>>(EMPTY_VENDOR);

  // AI 외주사 추가 모달
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiVendorResult | null>(null);

  const q = search.trim().toLowerCase();
  const sorted = [...vendors].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const filtered = sorted.filter(v =>
    (filterStatus === 'all' || v.status === filterStatus) &&
    (!q || v.name.toLowerCase().includes(q) || v.services.toLowerCase().includes(q) || (v.notes ?? '').toLowerCase().includes(q))
  );

  const openAdd = () => { setForm(EMPTY_VENDOR); setEditVendor(null); setShowForm(true); };
  const openEdit = (v: Vendor) => { setForm({ ...v }); setEditVendor(v); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim()) { alert('외주사명은 필수입니다.'); return; }
    if (editVendor) saveVendor({ ...form, id: editVendor.id });
    else saveVendor({ ...form, id: `vd-${Date.now()}` });
    setShowForm(false);
  };

  const handleDelete = (v: Vendor) => {
    if (!isAdmin) return;
    if (!window.confirm(`'${v.name}' 외주사를 삭제할까요? (되돌릴 수 없음)`)) return;
    removeVendor(v.id);
  };

  const openAi = () => { setAiOpen(true); setAiText(''); setAiInstruction(''); setAiError(''); setAiResult(null); };
  const closeAi = () => { setAiOpen(false); setAiText(''); setAiInstruction(''); setAiError(''); setAiResult(null); };

  const runAiVendor = async () => {
    if (!aiText.trim() && !aiInstruction.trim()) return;
    setAiLoading(true); setAiError(''); setAiResult(null);
    try {
      const res = await fetch('/api/ai-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: aiText, instruction: aiInstruction, knownVendors: vendors.map(v => v.name) }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-vendor)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      setAiResult({
        summary: data.summary ?? '', name: data.name ?? '', services: data.services ?? '',
        contactPerson: data.contactPerson ?? '', phone: data.phone ?? '', email: data.email ?? '',
        pricing: data.pricing ?? '', notes: data.notes ?? '',
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  // AI 결과로 추가 폼을 채워 사용자가 검토 후 저장 (기존 동일 이름이 있으면 그 외주사 수정으로)
  const applyAiVendor = () => {
    if (!aiResult) return;
    if (!aiResult.name.trim()) { setAiError('외주사명을 추출하지 못했습니다. 설명에 외주사명을 포함해 다시 시도하세요.'); return; }
    const existing = vendors.find(v => v.name === aiResult.name.trim());
    setForm({
      name: aiResult.name, services: aiResult.services, contactPerson: aiResult.contactPerson,
      phone: aiResult.phone, email: aiResult.email, pricing: aiResult.pricing,
      notes: aiResult.notes, status: existing?.status ?? 'active',
    });
    setEditVendor(existing ?? null);
    closeAi();
    setShowForm(true);
  };

  return (
    <Layout>
      <Header title="외주사 관리" subtitle="영수증리뷰·앱설치·앱후기 등 외주 파트너를 관리합니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="외주사명·서비스 검색 (예: 영수증리뷰)"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={openAi}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Wand2 size={16} /> AI로 외주사 추가
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={16} /> 외주사 추가
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'inactive'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === 'all' ? '전체' : s === 'active' ? '활성' : '비활성'}
              <span className="ml-1.5 text-xs opacity-75">({s === 'all' ? vendors.length : vendors.filter(v => v.status === s).length})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            {q ? `'${search}'에 해당하는 외주사가 없습니다.` : '등록된 외주사가 없습니다. ‘외주사 추가’ 또는 ‘AI로 외주사 추가’로 등록하세요.'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(v => (
              <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                      <Boxes size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{v.name}</h3>
                      <span className={`inline-flex items-center gap-1 text-xs ${v.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`} />
                        {v.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="수정"><Pencil size={15} /></button>
                    {isAdmin && <button onClick={() => handleDelete(v)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={15} /></button>}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">제공 서비스</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{v.services || <span className="text-gray-300">미입력</span>}</p>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-50 pt-3 mt-auto">
                  {v.contactPerson && <div className="flex items-center gap-2"><User size={12} /> {v.contactPerson}</div>}
                  {v.phone && <div className="flex items-center gap-2"><Phone size={12} /> {v.phone}</div>}
                  {v.email && <div className="flex items-center gap-2"><Mail size={12} /> {v.email}</div>}
                  {v.pricing && <div className="flex items-center gap-2 text-blue-600 font-medium"><Wallet size={12} /> {v.pricing}</div>}
                  {v.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-1">💡 {v.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editVendor ? '외주사 수정' : '외주사 추가'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">외주사명 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: OO마케팅, 리뷰팩토리"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">제공 서비스 *</label>
                <textarea value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} rows={3}
                  placeholder="자유롭게 작성하세요. 예: 영수증리뷰, 앱설치, 앱후기, 체험단 모집"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <p className="text-[11px] text-gray-400 mt-1">서비스는 정해진 목록이 아니라 자유 서술입니다. 어떤 작업을 맡길 수 있는지 구체적으로 적어주세요.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">담당자</label>
                  <input value={form.contactPerson ?? ''} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="홍길동"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">연락처</label>
                  <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-1234-5678"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">이메일</label>
                  <input value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@vendor.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">단가/정산</label>
                  <input value={form.pricing ?? ''} onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))} placeholder="예: 건당 3,000원"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">특이사항/메모</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="예: 주말 작업 가능, 최소 물량 50건, 정산은 월말"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상태</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Vendor['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                {editVendor ? '수정하기' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 외주사 추가 모달 */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white"><Wand2 size={16} /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">AI로 외주사 추가</h2>
                  <p className="text-xs text-gray-400">외주사 정보를 자연어로 설명하면 정리해 등록 폼을 채워줍니다</p>
                </div>
              </div>
              <button onClick={closeAi} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">외주사 설명 (붙여넣기/대화형)</label>
                <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={7}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder={'예) 리뷰팩토리라는 곳인데 영수증리뷰랑 앱설치, 앱후기 다 가능해. 담당자는 김대리 010-9876-5432, 건당 3천원이고 최소 50건부터. 주말도 작업 돼.'} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">추가 지시 (선택)</label>
                <input value={aiInstruction} onChange={e => setAiInstruction(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 서비스 위주로 자세히 정리해줘" />
              </div>

              {aiError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{aiError}</p>}

              {aiResult && (
                <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-4 space-y-2 text-xs text-gray-700">
                  <p className="text-xs font-bold text-purple-700">정리 결과 미리보기</p>
                  {aiResult.summary && <p className="text-gray-600">{aiResult.summary}</p>}
                  <div><span className="font-semibold text-gray-500">외주사:</span> {aiResult.name || <span className="text-red-500">미추출</span>}{vendors.some(v => v.name === aiResult.name) ? ' (이미 존재 — 기존 항목 수정)' : ''}</div>
                  {aiResult.services && <div><span className="font-semibold text-gray-500">서비스:</span> <span className="whitespace-pre-wrap">{aiResult.services}</span></div>}
                  {(aiResult.contactPerson || aiResult.phone) && <div><span className="font-semibold text-gray-500">담당:</span> {[aiResult.contactPerson, aiResult.phone].filter(Boolean).join(' / ')}</div>}
                  {aiResult.pricing && <div><span className="font-semibold text-gray-500">단가:</span> {aiResult.pricing}</div>}
                  {aiResult.notes && <div><span className="font-semibold text-gray-500">메모:</span> {aiResult.notes}</div>}
                  <p className="text-[11px] text-gray-400">적용하면 등록 폼에 채워집니다. 검토 후 ‘추가하기’를 눌러야 최종 저장됩니다.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={closeAi} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">닫기</button>
              {aiResult ? (
                <>
                  <button onClick={runAiVendor} disabled={aiLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 다시 분석
                  </button>
                  <button onClick={applyAiVendor}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                    <Check size={14} /> 폼에 채우기
                  </button>
                </>
              ) : (
                <button onClick={runAiVendor} disabled={aiLoading || (!aiText.trim() && !aiInstruction.trim())}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-lg transition-colors">
                  {aiLoading ? <><Loader2 size={14} className="animate-spin" /> 분석 중...</> : <><Wand2 size={14} /> AI로 정리</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

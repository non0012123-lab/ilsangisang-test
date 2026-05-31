import { useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, Globe, ExternalLink } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import type { SiteEntry } from '../types';

const EMPTY: Omit<SiteEntry, 'id'> = { name: '', url: '', username: '', password: '', description: '' };

export default function SiteListPage() {
  const { siteEntries, saveSite, removeSite } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SiteEntry, 'id'>>(EMPTY);

  const q = search.trim().toLowerCase();
  const filtered = siteEntries.filter(s =>
    !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q) || (s.url ?? '').toLowerCase().includes(q) || (s.username ?? '').toLowerCase().includes(q)
  );

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (s: SiteEntry) => { setForm({ name: s.name, url: s.url ?? '', username: s.username ?? '', password: s.password ?? '', description: s.description ?? '' }); setEditId(s.id); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim()) { alert('홈페이지 이름은 필수입니다.'); return; }
    saveSite({ ...form, id: editId ?? `st-${Date.now()}` });
    setShowForm(false);
  };
  const handleDelete = (s: SiteEntry) => {
    if (!window.confirm(`'${s.name}' 홈페이지를 삭제할까요? (되돌릴 수 없음)`)) return;
    removeSite(s.id);
  };
  const href = (url?: string) => url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : '';

  return (
    <Layout>
      <Header title="홈페이지 목록" subtitle="문자발송·외주 주문 등 회사가 사용하는 사이트와 사내 계정을 관리합니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="홈페이지·용도·주소·아이디 검색"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> 홈페이지 추가
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            {q ? `'${search}'에 해당하는 홈페이지가 없습니다.` : '등록된 홈페이지가 없습니다. ‘홈페이지 추가’로 등록하세요.'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shrink-0"><Globe size={18} /></div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{s.name}</h3>
                      {s.url && <a href={href(s.url)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex items-center gap-1"><ExternalLink size={11} /> {s.url}</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="수정"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(s)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={15} /></button>
                  </div>
                </div>
                {s.description && <p className="text-xs text-gray-500 mb-3">{s.description}</p>}
                <div className="space-y-1.5 text-xs border-t border-gray-50 pt-3 mt-auto">
                  <div className="flex gap-2"><span className="text-gray-400 w-10 shrink-0">아이디</span><span className="font-mono text-gray-700 truncate">{s.username || '-'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-10 shrink-0">비번</span><span className="font-mono text-gray-700 truncate">{s.password || '-'}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white"><Globe size={16} /></div>
                <h2 className="text-base font-bold text-gray-900">{editId ? '홈페이지 수정' : '홈페이지 추가'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">홈페이지 이름 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: OO문자, 리뷰주문사이트"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">주소(URL)</label>
                <input value={form.url ?? ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">사내 아이디</label>
                  <input value={form.username ?? ''} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="회사 계정 아이디"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
                  <input value={form.password ?? ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder=""
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">용도/설명</label>
                <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="예: 고객 문자 발송용 / 외주사 리뷰 주문"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">{editId ? '수정하기' : '추가하기'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

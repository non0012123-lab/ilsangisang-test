import { useState } from 'react';
import { Plus, Mail, Calendar, X, Pencil, Users, Phone } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import { useApp } from '../context/AppContext';
import type { Client, Category } from '../types';

const ALL_CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업'];
const STATUS_ORDER: Record<string, number> = { active: 0, pending: 1, inactive: 2 };

const EMPTY_CLIENT: Omit<Client, 'id'> = {
  name: '', industry: '', contactPerson: '', email: '', phone: '',
  startDate: '', categories: [], status: 'active', description: '', monthlyBudget: '',
};

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
  const { entries, clients, setClients } = useApp();
  const [selected, setSelected] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<Omit<Client, 'id'>>(EMPTY_CLIENT);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Sort: active → pending → inactive
  const sorted = [...clients].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const filtered = sorted.filter(c => filterStatus === 'all' || c.status === filterStatus);

  const openAdd = () => { setForm(EMPTY_CLIENT); setEditClient(null); setShowForm(true); };
  const openEdit = (c: Client) => { setForm({ ...c }); setEditClient(c); setShowForm(true); };

  const handleSave = () => {
    if (!form.name || !form.email) { alert('업체명과 이메일은 필수입니다.'); return; }
    if (editClient) {
      const updated = { ...form, id: editClient.id };
      setClients(prev => prev.map(c => c.id === editClient.id ? updated : c));
      if (selected?.id === editClient.id) setSelected(updated);
    } else {
      setClients(prev => [...prev, { ...form, id: Date.now().toString() }]);
    }
    setShowForm(false);
  };

  const handleStatusChange = (clientId: string, status: Client['status']) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status } : c));
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

  const clientEntries = selected ? entries.filter(e => e.clientId === selected.id) : [];

  return (
    <Layout>
      <Header title="클라이언트 관리" subtitle="클라이언트를 추가하고 계약 현황을 관리합니다" />
      <div className="flex-1 p-6">
        {selected ? (
          /* === Client Detail View === */
          <div className="space-y-5">
            <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              ← 목록으로
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                    {selected.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                      <StatusDot status={selected.status} />
                    </div>
                    <p className="text-gray-500 text-sm">{selected.industry}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {selected.categories.map(c => <CategoryBadge key={c} category={c} />)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                    <Pencil size={14} /> 수정
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-gray-100">
                {[
                  { label: '담당자', value: selected.contactPerson, icon: <Users size={14} /> },
                  { label: '이메일', value: selected.email, icon: <Mail size={14} /> },
                  { label: '연락처', value: selected.phone, icon: <Phone size={14} /> },
                  { label: '계약 시작', value: selected.startDate, icon: <Calendar size={14} /> },
                ].map(info => (
                  <div key={info.label}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1">{info.icon} {info.label}</div>
                    <p className="text-sm text-gray-800 font-medium">{info.value || '-'}</p>
                  </div>
                ))}
              </div>
              {selected.description && (
                <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">{selected.description}</p>
              )}
            </div>

            {/* Recent Schedule */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-50">
                <h3 className="font-bold text-gray-900">스케줄 현황 ({clientEntries.length}건)</h3>
              </div>
              {clientEntries.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">등록된 스케줄이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['날짜', '담당자', '카테고리', '키워드/제목', '링크', '순위', '상태'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {clientEntries.slice(0, 10).map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.date}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{entry.managerName}</td>
                          <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{entry.opinionTitle ?? entry.keyword ?? '-'}</td>
                          <td className="px-4 py-3 max-w-[180px]">
                            {entry.link
                              ? <a href={entry.link} target="_blank" rel="noopener noreferrer" className="table-link link-cell" title={entry.link}>{entry.link}</a>
                              : <span className="text-gray-300 text-xs">-</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.rank ? <span className="text-blue-700 font-bold">{entry.rank}</span> : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              entry.status === 'completed' ? 'bg-green-50 text-green-700' :
                              entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>
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
        ) : (
          /* === Client List === */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
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
              {filtered.map(client => (
                <div key={client.id} onClick={() => setSelected(client)}
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
                    {client.monthlyBudget && (
                      <div className="font-medium text-blue-600">월 {client.monthlyBudget}</div>
                    )}
                  </div>
                </div>
              ))}
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

import { useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, Copy, Check, KeyRound, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import type { AccountEntry } from '../types';

const EMPTY: Omit<AccountEntry, 'id'> = { name: '', platform: '', grade: '', ownership: undefined, username: '', password: '', category: '', ip: '' };

const PLATFORMS = ['블로그', 'SNS', '유튜브', '기타'];
// 블로그 등급: 준최2~준최6, 최적1~최적4
const BLOG_GRADES = ['준최2', '준최3', '준최4', '준최5', '준최6', '최적1', '최적2', '최적3', '최적4'];
const OWNERSHIP_LABEL: Record<string, string> = { client: '업체 소유', inhouse: '사내' };
const platformBadge: Record<string, string> = { '블로그': 'bg-green-50 text-green-700', 'SNS': 'bg-pink-50 text-pink-700', '유튜브': 'bg-red-50 text-red-700', '기타': 'bg-gray-100 text-gray-600' };
const gradeBadge = (g: string) => g.startsWith('최적') ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700';

// 프로그램 메모장 양식: 아이디,비밀번호,카테고리,아이피 (4칸 순번 고정)
// 카테고리가 비어 있어도 3번째 칸에는 '카테고리(생략가능)' 문자가 그대로 들어간다.
const CATEGORY_PLACEHOLDER = '카테고리(생략가능)';
function memoFormat(a: { username?: string; password?: string; category?: string; ip?: string }): string {
  const cat = (a.category ?? '').trim();
  return [(a.username ?? '').trim(), (a.password ?? '').trim(), cat || CATEGORY_PLACEHOLDER, (a.ip ?? '').trim()].join(',');
}

export default function AccountListPage() {
  const { accounts, saveAccount, removeAccount } = useApp();
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterOwnership, setFilterOwnership] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AccountEntry, 'id'>>(EMPTY);
  const [sortKey, setSortKey] = useState<'name' | 'platform' | 'ownership' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: 'name' | 'platform' | 'ownership') => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortIcon = (key: 'name' | 'platform' | 'ownership') =>
    sortKey !== key ? <ArrowUpDown size={12} className="text-gray-300" />
      : sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(c => (c === key ? null : c)), 1500);
  };

  const q = search.trim().toLowerCase();
  const filtered = accounts.filter(a =>
    (filterPlatform === 'all' || (a.platform || '기타') === filterPlatform) &&
    (filterOwnership === 'all' || (a.ownership ?? '') === filterOwnership) &&
    (filterGrade === 'all' || (a.grade ?? '') === filterGrade) &&
    (!q || a.name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q) || (a.category ?? '').toLowerCase().includes(q) || (a.ip ?? '').toLowerCase().includes(q))
  );

  const platformRank = (p?: string) => { const i = PLATFORMS.indexOf(p || ''); return i === -1 ? 99 : i; };
  const ownRank = (o?: string) => (o === 'client' ? 0 : o === 'inhouse' ? 1 : 99);
  const display = sortKey ? [...filtered].sort((a, b) => {
    let d: number;
    if (sortKey === 'name') d = (a.name || '').localeCompare(b.name || '', 'ko');
    else if (sortKey === 'platform') d = platformRank(a.platform) - platformRank(b.platform);
    else d = ownRank(a.ownership) - ownRank(b.ownership);
    return sortDir === 'asc' ? d : -d;
  }) : filtered;

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (a: AccountEntry) => { setForm({ name: a.name, platform: a.platform ?? '', grade: a.grade ?? '', ownership: a.ownership, username: a.username, password: a.password, category: a.category ?? '', ip: a.ip ?? '' }); setEditId(a.id); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim() && !form.username.trim()) { alert('이름 또는 아이디는 입력해야 합니다.'); return; }
    saveAccount({ ...form, id: editId ?? `ac-${Date.now()}` });
    setShowForm(false);
  };
  const handleDelete = (a: AccountEntry) => {
    if (!window.confirm(`'${a.name || a.username}' 계정을 삭제할까요? (되돌릴 수 없음)`)) return;
    removeAccount(a.id);
  };
  // 값 + 클릭 복사 버튼 셀
  const copyCell = (value: string | undefined, key: string, mono = true) => (
    <div className="flex items-center gap-1.5">
      <span className={`text-gray-700 ${mono ? 'font-mono text-xs' : ''} truncate`}>{value || '-'}</span>
      {value && (
        <button onClick={() => copy(value, key)} className={`shrink-0 p-0.5 rounded transition-colors ${copiedKey === key ? 'text-green-600' : 'text-gray-300 hover:text-blue-600'}`} title="복사">
          {copiedKey === key ? <Check size={12} /> : <Copy size={12} />}
        </button>
      )}
    </div>
  );

  return (
    <Layout>
      <Header title="아이디 목록" subtitle="블로그·SNS·유튜브 등 계정과 프록시 IP를 관리합니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름·아이디·카테고리·IP 검색"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> 아이디 추가
          </button>
        </div>

        {/* 구분/소유 필터 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-semibold text-gray-400 mr-0.5">구분</span>
            {['all', ...PLATFORMS].map(p => (
              <button key={p} onClick={() => setFilterPlatform(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterPlatform === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {p === 'all' ? '전체' : p}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-semibold text-gray-400 mr-0.5">소유</span>
            {[['all', '전체'], ['client', '업체 소유'], ['inhouse', '사내']].map(([v, label]) => (
              <button key={v} onClick={() => setFilterOwnership(v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterOwnership === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          {(filterPlatform === '블로그' || accounts.some(a => a.grade)) && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs font-semibold text-gray-400 mr-0.5">블로그 등급</span>
              <button onClick={() => setFilterGrade('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterGrade === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>전체</button>
              {BLOG_GRADES.map(g => (
                <button key={g} onClick={() => setFilterGrade(g)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterGrade === g ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{g}</button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">메모장 양식은 <strong>아이디,비밀번호,(카테고리),아이피</strong> 순으로 자동 생성됩니다. 셀의 복사 버튼으로 바로 복사하세요.</p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            {q ? `'${search}'에 해당하는 계정이 없습니다.` : '등록된 계정이 없습니다. ‘아이디 추가’로 등록하세요.'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {([
                      ['이름', 'name'], ['구분', 'platform'], ['소유', 'ownership'],
                    ] as ['이름' | '구분' | '소유', 'name' | 'platform' | 'ownership'][]).map(([label, key]) => (
                      <th key={key} className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 whitespace-nowrap">
                        <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors">
                          {label} {sortIcon(key)}
                        </button>
                      </th>
                    ))}
                    {['아이디', '비밀번호', '카테고리', '아이피', '메모장 양식', ''].map((h, i) => (
                      <th key={i} className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {display.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{a.name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {a.platform ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${platformBadge[a.platform] ?? 'bg-gray-100 text-gray-600'}`}>{a.platform}</span> : <span className="text-gray-300 text-xs">-</span>}
                          {a.grade && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gradeBadge(a.grade)}`}>{a.grade}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {a.ownership ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.ownership === 'client' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{OWNERSHIP_LABEL[a.ownership]}</span> : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{copyCell(a.username, `${a.id}:user`)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{copyCell(a.password, `${a.id}:pw`)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{a.category || <span className="text-gray-300">생략</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{copyCell(a.ip, `${a.id}:ip`)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => copy(memoFormat(a), `${a.id}:memo`)}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${copiedKey === `${a.id}:memo` ? 'border-green-200 bg-green-50 text-green-600' : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200'}`}
                          title={`메모장 양식 복사: ${memoFormat(a)}`}>
                          {copiedKey === `${a.id}:memo` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="수정"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(a)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white"><KeyRound size={16} /></div>
                <h2 className="text-base font-bold text-gray-900">{editId ? '계정 수정' : '아이디 추가'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">이름</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 우리본병원"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">구분</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, platform: f.platform === p ? '' : p }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.platform === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">소유</label>
                  <select value={form.ownership ?? ''} onChange={e => setForm(f => ({ ...f, ownership: (e.target.value || undefined) as AccountEntry['ownership'] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">선택 안 함</option>
                    <option value="client">업체 소유</option>
                    <option value="inhouse">사내</option>
                  </select>
                </div>
              </div>
              {form.platform === '블로그' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">블로그 등급</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BLOG_GRADES.map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, grade: f.grade === g ? '' : g }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.grade === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{g}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">아이디</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="sudden13641"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
                  <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="adbal1234"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">카테고리 <span className="text-gray-400 font-normal">(없으면 생략)</span></label>
                  <input value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder=""
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">아이피 (프록시)</label>
                  <input value={form.ip ?? ''} onChange={e => setForm(f => ({ ...f, ip: e.target.value }))} placeholder="121.126.146.85:5078"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-500 mb-0.5">메모장 양식 미리보기</p>
                <code className="text-xs text-gray-800 break-all">{memoFormat(form) || '(아이디·비밀번호 입력 시 자동 생성)'}</code>
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

import { useMemo, useState } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Target, ListChecks, RotateCw, CheckCircle2, PlayCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { todayStr } from '../utils/today';
import { countAchieved, thresholdOf, isAchieved, STATUS_LABEL } from '../utils/rankGuarantee';
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus } from '../types';

const genId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// "4위"·"3등"·" 5 " 같은 표기에서도 순위 숫자를 뽑는다. 빈 값이면 undefined(= 미반영, 카운트 제외).
const parseRank = (v: string): number | undefined => {
  const s = v.trim();
  if (!s) return undefined;
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const STATUS_CHIP: Record<RankGuaranteeStatus, string> = {
  active: 'bg-slate-100 text-slate-600',
  due_soon: 'bg-amber-100 text-amber-700',
  reached: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-400',
};

// 진행률 막대 색 — 임박은 주황, 도달은 초록, 그 외 파랑.
const barColor = (s: RankGuaranteeStatus) =>
  s === 'reached' ? 'bg-green-500' : s === 'due_soon' ? 'bg-amber-500' : s === 'closed' ? 'bg-gray-300' : 'bg-blue-500';

interface FormState {
  clientId: string;
  title: string;
  guaranteedCount: number;
  alertOffset: number;
}
const EMPTY_FORM: FormState = { clientId: '', title: '', guaranteedCount: 20, alertOffset: 2 };

const STATUS_FILTERS: { key: 'all' | RankGuaranteeStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'due_soon', label: '임박' },
  { key: 'reached', label: '도달' },
  { key: 'closed', label: '종료' },
];

export default function RankGuaranteePage() {
  const { rankGuarantees, saveRankGuarantee, removeRankGuarantee, clients } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | RankGuaranteeStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeClients = useMemo(() => clients.filter(c => c.status !== 'inactive'), [clients]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const ORDER: Record<RankGuaranteeStatus, number> = { reached: 0, due_soon: 1, active: 2, closed: 3 };
    return [...rankGuarantees]
      .filter(rg => (filter === 'all' || rg.status === filter)
        && (!q || rg.clientName.toLowerCase().includes(q) || rg.title.toLowerCase().includes(q)))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt - a.updatedAt);
  }, [rankGuarantees, filter, q]);

  const detail = detailId ? rankGuarantees.find(r => r.id === detailId) ?? null : null;

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); };
  const openEdit = (rg: RankGuarantee) => {
    setForm({ clientId: rg.clientId, title: rg.title, guaranteedCount: rg.guaranteedCount, alertOffset: rg.alertOffset });
    setEditId(rg.id);
    setShowForm(true);
  };

  const handleSaveForm = () => {
    const client = activeClients.find(c => c.id === form.clientId);
    if (!client) { alert('클라이언트를 선택하세요.'); return; }
    if (!form.title.trim()) { alert('상품/캠페인명을 입력하세요.'); return; }
    const guaranteedCount = Math.max(1, Math.floor(form.guaranteedCount) || 1);
    const alertOffset = Math.min(guaranteedCount, Math.max(0, Math.floor(form.alertOffset) || 0));
    if (editId) {
      const cur = rankGuarantees.find(r => r.id === editId);
      if (!cur) return;
      // 설정만 바꾼다(items·cycle 보존). saveRankGuarantee 가 status 를 다시 파생한다.
      saveRankGuarantee({ ...cur, clientId: client.id, clientName: client.name, title: form.title.trim(), guaranteedCount, alertOffset });
    } else {
      saveRankGuarantee({
        id: genId('rg'), clientId: client.id, clientName: client.name, title: form.title.trim(),
        guaranteedCount, alertOffset, cycle: 1, closed: false, status: 'active', items: [],
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
    setShowForm(false);
  };

  const handleDelete = (rg: RankGuarantee) => {
    if (!isAdmin) return;
    if (!window.confirm(`'${rg.clientName} · ${rg.title}' 순위 보장을 삭제할까요? (되돌릴 수 없음)`)) return;
    removeRankGuarantee(rg.id);
    if (detailId === rg.id) setDetailId(null);
  };

  return (
    <Layout>
      <Header title="순위 보장" subtitle="순위가 잡힌 건만 카운트해 보장 건수에 도달하면 연장 여부를 알려드립니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="클라이언트·상품명 검색"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            )}
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> 보장 추가
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
              <span className="ml-1.5 text-xs opacity-75">({f.key === 'all' ? rankGuarantees.length : rankGuarantees.filter(r => r.status === f.key).length})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            {q ? `'${search}'에 해당하는 순위 보장이 없습니다.` : '등록된 순위 보장이 없습니다. ‘보장 추가’로 등록하세요.'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(rg => {
              const n = countAchieved(rg);
              const pct = Math.min(100, Math.round((n / rg.guaranteedCount) * 100));
              return (
                <div key={rg.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0">
                        <Target size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{rg.clientName}</h3>
                        <p className="text-xs text-gray-500 truncate">{rg.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(rg)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="설정 수정"><Pencil size={15} /></button>
                      {isAdmin && <button onClick={() => handleDelete(rg)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={15} /></button>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP[rg.status]}`}>
                      {STATUS_LABEL[rg.status]}
                    </span>
                    <span className="text-xs text-gray-400">{rg.cycle > 1 ? `${rg.cycle}차` : '1차'} · 임박 {thresholdOf(rg)}건</span>
                  </div>

                  <div className="flex items-end justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">{n}<span className="text-gray-400 font-medium"> / {rg.guaranteedCount}건</span></span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                    <div className={`h-full rounded-full transition-all ${barColor(rg.status)}`} style={{ width: `${pct}%` }} />
                  </div>

                  <button onClick={() => setDetailId(rg.id)}
                    className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <ListChecks size={15} /> 항목 관리 ({rg.items.filter(it => it.cycle === rg.cycle).length})
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 보장 추가/설정 수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? '순위 보장 설정 수정' : '순위 보장 추가'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">클라이언트 *</label>
                <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">선택하세요</option>
                  {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상품/캠페인명 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 네이버 자동완성 보장"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">보장 건수</label>
                  <input type="number" min={1} value={form.guaranteedCount}
                    onChange={e => setForm(f => ({ ...f, guaranteedCount: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">알림(몇 건 전)</label>
                  <input type="number" min={0} value={form.alertOffset}
                    onChange={e => setForm(f => ({ ...f, alertOffset: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                순위가 잡힌(순위 값이 입력된) 항목만 카운트됩니다. 목표 {Math.max(1, Math.floor(form.guaranteedCount) || 1)}건 중
                {' '}{Math.max(0, Math.floor(form.guaranteedCount) || 1) - Math.min(Math.floor(form.guaranteedCount) || 1, Math.max(0, Math.floor(form.alertOffset) || 0))}건째에 ‘임박’ 알림이 갑니다.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSaveForm} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                {editId ? '저장' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 항목 관리(상세) 모달 */}
      {detail && (
        <DetailModal rg={detail} onClose={() => setDetailId(null)} onChange={saveRankGuarantee} />
      )}
    </Layout>
  );
}

// ── 항목 관리 모달 ──────────────────────────────────────
// 현재 회차 항목을 표로 보여주고, 순위 입력 시 즉시 저장(카운트·알림 재계산). 연장/종료 액션 포함.
function DetailModal({ rg, onClose, onChange }: { rg: RankGuarantee; onClose: () => void; onChange: (rg: RankGuarantee) => void }) {
  const [newKeyword, setNewKeyword] = useState('');
  const items = rg.items.filter(it => it.cycle === rg.cycle);
  const n = countAchieved(rg);
  const reached = rg.status === 'reached';

  const commitItems = (nextItems: RankGuaranteeItem[]) => onChange({ ...rg, items: nextItems });

  const addItem = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    commitItems([...rg.items, { id: genId('rgi'), cycle: rg.cycle, keyword: kw }]);
    setNewKeyword('');
  };
  const patchItem = (id: string, patch: Partial<RankGuaranteeItem>) =>
    commitItems(rg.items.map(it => it.id === id ? { ...it, ...patch } : it));
  const setRank = (it: RankGuaranteeItem, raw: string) => {
    const rank = parseRank(raw);
    if (rank === it.rank) return; // 값 변화 없으면 저장 안 함(불필요한 알림·쓰기 방지)
    patchItem(it.id, { rank, rankedAt: rank != null && it.rankedAt == null ? todayStr() : it.rankedAt });
  };
  const removeItem = (id: string) => commitItems(rg.items.filter(it => it.id !== id));

  // 연장: 회차 +1, 종료 해제. 과거 회차 항목은 보존(이력). 새 회차는 빈 상태로 시작.
  const extend = () => {
    if (!window.confirm(`${rg.cycle + 1}차로 연장할까요? 현재 회차 기록은 보존되고 새 회차가 시작됩니다.`)) return;
    onChange({ ...rg, cycle: rg.cycle + 1, closed: false });
  };
  const close = () => {
    if (!window.confirm('이 순위 보장을 종료할까요? 카운팅과 알림이 멈춥니다. (다시 재개할 수 있습니다)')) return;
    onChange({ ...rg, closed: true });
  };
  const reopen = () => onChange({ ...rg, closed: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{rg.clientName} · {rg.title}</h2>
            <p className="text-xs text-gray-500">
              {rg.cycle > 1 ? `${rg.cycle}차 · ` : ''}달성 <span className="font-bold text-gray-800">{n}</span> / {rg.guaranteedCount}건
              {' '}· 임박 {thresholdOf(rg)}건 · <span className={STATUS_CHIP[rg.status].replace(/bg-[a-z]+-100/, '') + ' font-semibold'}>{STATUS_LABEL[rg.status]}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"><X size={18} /></button>
        </div>

        {/* 도달 시 연장/종료 안내 배너 */}
        {reached && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-2.5">
            <CheckCircle2 size={16} className="shrink-0" />
            보장 건수에 도달했습니다. 연장 또는 종료를 결정하세요.
          </div>
        )}
        {rg.closed && (
          <div className="mx-6 mt-4 flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 text-gray-500 text-sm rounded-xl px-4 py-2.5">
            <span>종료된 보장입니다. 카운팅·알림이 멈춰 있습니다.</span>
            <button onClick={reopen} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
              <PlayCircle size={15} /> 재개
            </button>
          </div>
        )}

        {/* 항목 추가 */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              placeholder="키워드(항목) 추가 — 예: 강남 임플란트"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={addItem} className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Plus size={15} /> 추가
            </button>
          </div>
        </div>

        {/* 항목 표 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">항목이 없습니다. 위에서 키워드를 추가하세요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-2 pl-1">키워드</th>
                  <th className="text-left font-medium py-2 w-24">순위</th>
                  <th className="text-left font-medium py-2 w-28">기재일</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-2 pl-1">
                      <input defaultValue={it.keyword} onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.keyword) patchItem(it.id, { keyword: v }); }}
                        className="w-full bg-transparent focus:outline-none focus:bg-blue-50/50 rounded px-1 py-0.5" />
                    </td>
                    <td className="py-2">
                      <input defaultValue={it.rank != null ? String(it.rank) : ''} onBlur={e => setRank(it, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="미반영"
                        className={`w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAchieved(it) ? 'border-green-300 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-400'}`} />
                    </td>
                    <td className="py-2 text-xs text-gray-400">{it.rankedAt ?? '—'}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => removeItem(it.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="항목 삭제"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 하단 액션: 연장/종료 */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">순위 값이 채워진 항목만 카운트됩니다.</p>
          <div className="flex gap-2">
            {!rg.closed && (
              <button onClick={close} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">종료</button>
            )}
            <button onClick={extend} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <RotateCw size={15} /> 연장 ({rg.cycle + 1}차)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

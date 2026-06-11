import { useMemo, useState } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Target, ListChecks, RotateCw, CheckCircle2, PlayCircle,
  CalendarPlus, ExternalLink, Link2, Lock, Unlink, FileSpreadsheet,
} from 'lucide-react';
import { downloadCsv } from '../utils/exportCsv';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { todayStr } from '../utils/today';
import { countAchieved, thresholdOf, isAchieved, STATUS_LABEL } from '../utils/rankGuarantee';
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus, ScheduleEntry } from '../types';

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
  const { rankGuarantees, saveRankGuarantee, removeRankGuarantee, clients, entries } = useApp();
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
      // 백필: 이 캠페인이 그 업체의 첫 진행중 캠페인이면, 이미 순위가 잡힌 기존 일정을 자동으로 항목에 담는다.
      //  (이후 일정은 AppContext.syncEntriesToGuarantees 가 저장 시점에 자동 편입한다.)
      const soleActive = !rankGuarantees.some(r => r.clientId === client.id && !r.closed);
      const seed: RankGuaranteeItem[] = soleActive
        ? entries.filter(e => e.clientId === client.id && e.rank != null).map(e => ({
            id: genId('rgi'), cycle: 1, entryId: e.id,
            keyword: e.keyword || '(키워드 없음)', link: e.link, rank: e.rank, rankedAt: todayStr(),
          }))
        : [];
      saveRankGuarantee({
        id: genId('rg'), clientId: client.id, clientName: client.name, title: form.title.trim(),
        guaranteedCount, alertOffset, cycle: 1, closed: false, status: 'active', items: seed,
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
        <DetailModal rg={detail} entries={entries} onClose={() => setDetailId(null)} onChange={saveRankGuarantee} />
      )}
    </Layout>
  );
}

// ── 항목 관리 모달 ──────────────────────────────────────
// 현재 회차 항목을 표로 보여주고, 순위 입력 시 즉시 저장(카운트·알림 재계산). 연장/종료 액션 포함.
//  • 연동 항목(entryId): 일정이 원천이라 키워드·순위 읽기전용. 순위는 일정에서 바뀌면 자동 동기화됨.
//  • 동결 항목(frozen): 원본 일정이 삭제돼 끊긴 항목 — 마지막 순위를 보존하며 다시 수동 편집 가능.
//  • 수동 항목: 보장함에서 직접 입력.
function DetailModal({ rg, entries, onClose, onChange }: { rg: RankGuarantee; entries: ScheduleEntry[]; onClose: () => void; onChange: (rg: RankGuarantee) => void }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [picking, setPicking] = useState(false);
  const [extendMenu, setExtendMenu] = useState(false); // '연장' 클릭 시 진행/종료 선택 노출
  const items = rg.items.filter(it => it.cycle === rg.cycle);
  const n = countAchieved(rg);
  const reached = rg.status === 'reached';
  const linkedEntryIds = new Set(rg.items.filter(it => it.entryId).map(it => it.entryId));

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
  // 항목 삭제 — 일정 연동 항목이면 그 일정 id 를 제외 목록에 넣어 자동 보정(reconcile)이 되살리지 않게 한다.
  const withExcluded = (entryId: string | undefined) =>
    entryId ? Array.from(new Set([...(rg.excludedEntryIds ?? []), entryId])) : rg.excludedEntryIds;
  const removeItem = (id: string) => {
    const it = rg.items.find(x => x.id === id);
    onChange({ ...rg, items: rg.items.filter(x => x.id !== id), excludedEntryIds: withExcluded(it?.entryId) });
  };
  // 연동 항목을 수동으로 전환(연동 해제) — 일정과의 연결만 끊고 스냅샷은 보존. 같은 일정의 '쌍둥이' 재편입을 막기 위해 제외 목록에 등록.
  const unlinkItem = (id: string) => {
    const it = rg.items.find(x => x.id === id);
    onChange({
      ...rg,
      items: rg.items.map(x => x.id === id ? { ...x, entryId: undefined, frozen: true } : x),
      excludedEntryIds: withExcluded(it?.entryId),
    });
  };

  // 일정에서 선택한 항목들을 연동 항목으로 생성(키워드·링크·순위 스냅샷). 이미 연결된 일정은 picker 에서 제외됨.
  const addFromEntries = (picked: ScheduleEntry[]) => {
    if (!picked.length) return;
    const created: RankGuaranteeItem[] = picked.map(e => ({
      id: genId('rgi'), cycle: rg.cycle, entryId: e.id,
      keyword: e.keyword || '(키워드 없음)', link: e.link,
      rank: e.rank, rankedAt: e.rank != null ? todayStr() : undefined,
    }));
    // 수동으로 다시 불러온 일정은 제외 목록에서 해제(이전에 삭제/연동해제했더라도 사용자가 명시적으로 다시 담음).
    const pickedIds = new Set(picked.map(e => e.id));
    onChange({
      ...rg,
      items: [...rg.items, ...created],
      excludedEntryIds: (rg.excludedEntryIds ?? []).filter(id => !pickedIds.has(id)),
    });
    setPicking(false);
  };

  // 연장 진행: 회차 +1, 종료 해제. 과거 회차 항목은 보존(이력). 새 회차는 빈 상태로 시작.
  const extend = () => { setExtendMenu(false); onChange({ ...rg, cycle: rg.cycle + 1, closed: false }); };
  // 연장 종료: 더 연장하지 않고 이 보장을 종료(카운팅·알림 멈춤, 재개 가능).
  const endGuarantee = () => { setExtendMenu(false); onChange({ ...rg, closed: true }); };
  const reopen = () => onChange({ ...rg, closed: false });

  // 순위가 잡힌 항목만 엑셀(CSV)로 내보낸다 — 보장 건수 도달 시 전달용. 순위 오름차순 정렬.
  const exportCsv = () => {
    const ranked = items.filter(isAchieved).sort((a, b) => (a.rank! - b.rank!));
    if (ranked.length === 0) { alert('순위가 잡힌 항목이 없습니다.'); return; }
    const rows = ranked.map((it, i) => [i + 1, it.keyword, `${it.rank}위`, it.link ?? '', it.rankedAt ?? '']);
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim();
    downloadCsv(`${safe(rg.clientName)}_${safe(rg.title)}_순위보장_${todayStr()}`,
      ['번호', '키워드', '순위', '링크', '순위기재일'], rows);
  };

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

        {/* 항목 추가 — 일정에서 불러오기(연동) + 수동 추가 */}
        <div className="px-6 pt-4 space-y-2">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            이 업체의 일정에 <b className="text-gray-500">순위를 입력하면 자동으로 여기에 편입</b>됩니다(순위는 일정에서 관리).
            순위 없는 일정을 미리 담거나 직접 입력하려면 아래에서 추가하세요.
          </p>
          <button onClick={() => setPicking(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            <CalendarPlus size={15} /> 일정에서 불러오기 (키워드·링크·순위 연동)
          </button>
          <div className="flex gap-2">
            <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              placeholder="또는 수동 키워드 추가 — 예: 강남 임플란트"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={addItem} className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Plus size={15} /> 추가
            </button>
          </div>
        </div>

        {/* 항목 표 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">항목이 없습니다. ‘일정에서 불러오기’ 또는 수동으로 추가하세요.</p>
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
                {items.map(it => {
                  const linked = !!it.entryId;
                  return (
                    <tr key={it.id} className="border-b border-gray-50">
                      <td className="py-2 pl-1">
                        <div className="flex items-center gap-1.5">
                          {linked && <Link2 size={13} className="text-blue-500 shrink-0" />}
                          {it.frozen && <Lock size={12} className="text-gray-400 shrink-0" />}
                          {linked ? (
                            <span className="px-1 py-0.5 text-gray-800">{it.keyword}</span>
                          ) : (
                            <input defaultValue={it.keyword} onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.keyword) patchItem(it.id, { keyword: v }); }}
                              className="w-full bg-transparent focus:outline-none focus:bg-blue-50/50 rounded px-1 py-0.5" />
                          )}
                          {it.link && (
                            <a href={it.link} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-600 shrink-0" title={it.link}><ExternalLink size={13} /></a>
                          )}
                        </div>
                        {it.frozen && <span className="ml-[18px] text-[10px] text-gray-400">원본 일정 삭제됨</span>}
                      </td>
                      <td className="py-2">
                        {linked ? (
                          <span className={`inline-block w-20 text-center border rounded-lg px-2 py-1 text-sm ${isAchieved(it) ? 'border-green-200 bg-green-50 text-green-700 font-semibold' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                            title="순위는 일정에서 수정됩니다">{it.rank != null ? it.rank : '미반영'}</span>
                        ) : (
                          <input defaultValue={it.rank != null ? String(it.rank) : ''} onBlur={e => setRank(it, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            placeholder="미반영"
                            className={`w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAchieved(it) ? 'border-green-300 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-400'}`} />
                        )}
                      </td>
                      <td className="py-2 text-xs text-gray-400">{it.rankedAt ?? '—'}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {linked && (
                          <button onClick={() => unlinkItem(it.id)} className="p-1 text-gray-300 hover:text-amber-500 transition-colors" title="연동 해제(수동 전환)"><Unlink size={13} /></button>
                        )}
                        <button onClick={() => removeItem(it.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="항목 삭제"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 하단 액션: 내보내기 / 연장·종료 */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={exportCsv} title="순위가 잡힌 항목을 엑셀(CSV)로 내보내기"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
            <FileSpreadsheet size={15} /> 엑셀 내보내기 ({n}건)
          </button>
          {extendMenu ? (
            // '연장' 클릭 후: 다음 회차로 진행할지, 여기서 종료할지 선택
            <div className="flex items-center gap-2">
              <button onClick={extend} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                <RotateCw size={15} /> 연장 진행 ({rg.cycle + 1}차)
              </button>
              <button onClick={endGuarantee} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                연장 종료
              </button>
              <button onClick={() => setExtendMenu(false)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">닫기</button>
              {!rg.closed && (
                <button onClick={() => setExtendMenu(true)} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  <RotateCw size={15} /> 연장
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {picking && (
        <EntryPicker
          clientId={rg.clientId}
          entries={entries}
          excludeIds={linkedEntryIds}
          onClose={() => setPicking(false)}
          onConfirm={addFromEntries}
        />
      )}
    </div>
  );
}

// ── 일정 선택기 ─────────────────────────────────────────
// 해당 클라이언트의 일정 중 이미 연결되지 않은 건을 보여주고, 다중선택해 연동 항목으로 추가한다.
function EntryPicker({ clientId, entries, excludeIds, onClose, onConfirm }: {
  clientId: string; entries: ScheduleEntry[]; excludeIds: Set<string | undefined>;
  onClose: () => void; onConfirm: (picked: ScheduleEntry[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [onlyRanked, setOnlyRanked] = useState(false);
  const candidates = useMemo(() => entries
    .filter(e => e.clientId === clientId && !excludeIds.has(e.id) && (!onlyRanked || e.rank != null))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [entries, clientId, excludeIds, onlyRanked]);

  const toggle = (id: string) => setSel(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">일정에서 불러오기</h3>
            <p className="text-xs text-gray-400">선택한 일정의 키워드·링크·순위가 연동됩니다(순위는 일정에서 관리)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="px-6 py-3 border-b border-gray-50">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={onlyRanked} onChange={e => setOnlyRanked(e.target.checked)} className="rounded" />
            순위가 있는 일정만 보기
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {candidates.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">연결할 수 있는 일정이 없습니다.</p>
          ) : candidates.map(e => (
            <button key={e.id} onClick={() => toggle(e.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${sel.has(e.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel.has(e.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                {sel.has(e.id) && <CheckCircle2 size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">{e.keyword || <span className="text-gray-400">(키워드 없음)</span>}</span>
                  {e.rank != null && <span className="text-xs font-semibold text-green-600 shrink-0">{e.rank}위</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{e.date} · {e.category}{e.link ? ' · 링크 있음' : ''}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
          <button onClick={() => onConfirm(candidates.filter(e => sel.has(e.id)))} disabled={sel.size === 0}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors">
            {sel.size > 0 ? `${sel.size}건 연동` : '연동'}
          </button>
        </div>
      </div>
    </div>
  );
}

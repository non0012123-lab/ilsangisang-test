import { useMemo, useState } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Target, ListChecks, RotateCw, CheckCircle2, PlayCircle,
  ExternalLink, Link2, Lock, Unlink, FileSpreadsheet, Radar, Loader2,
} from 'lucide-react';
import { downloadCsv } from '../utils/exportCsv';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRankCollect } from '../hooks/useRankCollect';
import { todayStr } from '../utils/today';
import {
  thresholdOf, isRanked, STATUS_LABEL, TYPE_LABEL, guaranteeType, progress,
  appendSample, coveredDays, currentWindow, addDays, judgeOf, bestJudged, sampleJudged,
  JUDGE_PRESETS, judgePresetKey, DEFAULT_GUARANTEED_DAYS, DEFAULT_WINDOW_DAYS, DEFAULT_TARGET_RANK,
  type Judge,
} from '../utils/rankGuarantee';
import { SEARCH_TAB_SHORT, foundRanks, isRankTrackedCategory, effectiveSearchTabs } from '../utils/searchTabs';
import ClientCombobox from '../components/ClientCombobox';
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus, RankGuaranteeType, RankSample, ScheduleEntry } from '../types';

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
  type: RankGuaranteeType;
  guaranteedCount: number;   // count / count_monthly
  guaranteedDays: number;    // keyword_coverage
  windowDays: number;        // keyword_coverage / count_monthly
  targetRank: number;        // 기본 목표순위 (모든 방식)
  judgeKey: string;          // 판정탭 프리셋 키 (any/integrated/blog/cafe)
  alertOffset: number;
}
const EMPTY_FORM: FormState = {
  clientId: '', title: '', type: 'count_monthly',
  guaranteedCount: 20, guaranteedDays: DEFAULT_GUARANTEED_DAYS, windowDays: DEFAULT_WINDOW_DAYS,
  targetRank: DEFAULT_TARGET_RANK, judgeKey: 'any', alertOffset: 2,
};

// 방식 선택지(생성 폼). 레거시 count 는 신규 생성에선 노출하지 않는다(기존 데이터만 유지).
const TYPE_OPTIONS: { key: RankGuaranteeType; label: string; desc: string }[] = [
  { key: 'count_monthly', label: '월 건바이건', desc: '이번 달(30일) 순위 잡힌 건수 목표' },
  { key: 'keyword_coverage', label: '키워드 월보장', desc: '키워드가 30일 중 N일 목표순위 유지' },
  { key: 'monitor', label: '키워드 모니터링', desc: '목표 없이 주요 키워드 순위 추이만' },
];

const TYPE_CHIP: Record<RankGuaranteeType, string> = {
  count: 'bg-slate-100 text-slate-600',
  count_monthly: 'bg-blue-100 text-blue-700',
  keyword_coverage: 'bg-violet-100 text-violet-700',
  monitor: 'bg-teal-100 text-teal-700',
};

const STATUS_FILTERS: { key: 'all' | RankGuaranteeStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'due_soon', label: '임박' },
  { key: 'reached', label: '도달' },
  { key: 'closed', label: '종료' },
];

export default function RankGuaranteePage() {
  const { rankGuarantees, saveRankGuarantee, removeRankGuarantee, clients, entries, favoriteClientIds } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // 방식별 윈도우를 업체 보고 기준일(reportAnchorDate)에 정렬하기 위한 조회.
  const anchorOf = (clientId: string) => clients.find(c => c.id === clientId)?.reportAnchorDate;

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
    setForm({
      clientId: rg.clientId, title: rg.title, type: guaranteeType(rg),
      guaranteedCount: rg.guaranteedCount, guaranteedDays: rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS,
      windowDays: rg.windowDays ?? DEFAULT_WINDOW_DAYS, targetRank: rg.targetRank ?? DEFAULT_TARGET_RANK,
      judgeKey: judgePresetKey(rg.judgeTabs), alertOffset: rg.alertOffset,
    });
    setEditId(rg.id);
    setShowForm(true);
  };

  const handleSaveForm = () => {
    const client = activeClients.find(c => c.id === form.clientId);
    if (!client) { alert('클라이언트를 선택하세요.'); return; }
    if (!form.title.trim()) { alert('상품/캠페인명을 입력하세요.'); return; }
    const type = form.type;
    const guaranteedCount = Math.max(1, Math.floor(form.guaranteedCount) || 1);
    const guaranteedDays = Math.max(1, Math.floor(form.guaranteedDays) || 1);
    const windowDays = Math.max(1, Math.floor(form.windowDays) || DEFAULT_WINDOW_DAYS);
    const alertMax = type === 'keyword_coverage' ? guaranteedDays : guaranteedCount;
    const alertOffset = Math.min(alertMax, Math.max(0, Math.floor(form.alertOffset) || 0));
    const targetRank = Math.max(1, Math.floor(form.targetRank) || DEFAULT_TARGET_RANK);
    const judgeTabs = JUDGE_PRESETS.find(p => p.key === form.judgeKey)?.tabs ?? JUDGE_PRESETS[0].tabs;
    const patch = { clientId: client.id, clientName: client.name, title: form.title.trim(), type, guaranteedCount, guaranteedDays, windowDays, targetRank, judgeTabs, alertOffset };
    if (editId) {
      const cur = rankGuarantees.find(r => r.id === editId);
      if (!cur) return;
      // 설정만 바꾼다(items·cycle 보존). saveRankGuarantee 가 status 를 다시 파생한다.
      saveRankGuarantee({ ...cur, ...patch });
    } else {
      // 건수형만 백필: 그 업체의 순위추적 일정을 (순위 없어도) 전량 자동 편입. 키워드 월보장·모니터링은 후보에서 골라 담는다.
      const soleActiveCount = (type === 'count' || type === 'count_monthly')
        && !rankGuarantees.some(r => r.clientId === client.id && !r.closed && (guaranteeType(r) === 'count' || guaranteeType(r) === 'count_monthly'));
      const seed: RankGuaranteeItem[] = soleActiveCount
        ? entries.filter(e => e.clientId === client.id && isRankTrackedCategory(e.category) && effectiveSearchTabs(e).length > 0 && !!e.keyword)
            .map(e => ({
              id: genId('rgi'), cycle: 1, entryId: e.id,
              keyword: e.keyword || '(키워드 없음)', link: e.link,
              rank: e.rank, rankByTab: e.rankByTab, postDate: e.date,
              rankedAt: e.rank != null ? todayStr() : undefined,
            }))
        : [];
      saveRankGuarantee({
        id: genId('rg'), ...patch, cycle: 1, closed: false, status: 'active', items: seed,
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
              const type = guaranteeType(rg);
              const { n, target, unit } = progress(rg, { anchorDate: anchorOf(rg.clientId) });
              const isMonitor = type === 'monitor';
              const pct = target > 0 ? Math.min(100, Math.round((n / target) * 100)) : 0;
              const sub = type === 'keyword_coverage'
                ? `30일 중 ${rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS}일 보장`
                : type === 'count_monthly'
                  ? `이번 달 · 임박 ${thresholdOf(rg.guaranteedCount, rg.alertOffset)}건`
                  : isMonitor ? '추이 모니터링' : `${rg.cycle > 1 ? `${rg.cycle}차 · ` : ''}임박 ${thresholdOf(rg.guaranteedCount, rg.alertOffset)}건`;
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

                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_CHIP[type]}`}>{TYPE_LABEL[type]}</span>
                      {!isMonitor && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP[rg.status]}`}>{STATUS_LABEL[rg.status]}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 truncate shrink-0">{sub}</span>
                  </div>

                  {isMonitor ? (
                    <div className="flex items-end justify-between mb-4">
                      <span className="text-sm font-bold text-gray-900">{n}<span className="text-gray-400 font-medium"> 개 키워드</span></span>
                      <span className="text-xs text-gray-400">순위 추적</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end justify-between mb-1">
                        <span className="text-sm font-bold text-gray-900">{n}<span className="text-gray-400 font-medium"> / {target}{unit}</span></span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                        <div className={`h-full rounded-full transition-all ${barColor(rg.status)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}

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
                <ClientCombobox clients={activeClients} value={form.clientId} favIds={favoriteClientIds}
                  onChange={c => setForm(f => ({ ...f, clientId: c.id }))} placeholder="업체 검색·선택" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">방식 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(t => (
                    <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, type: t.key }))}
                      className={`px-2 py-2 rounded-lg border text-center transition-colors ${form.type === t.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <span className="block text-xs font-semibold">{t.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{TYPE_OPTIONS.find(t => t.key === form.type)?.desc}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">상품/캠페인명 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 네이버 자동완성 보장"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 목표순위 + 판정탭 — 모든 방식 공통(항목별로 덮어쓰기 가능) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">목표 순위(이내)</label>
                  <input type="number" min={1} value={form.targetRank}
                    onChange={e => setForm(f => ({ ...f, targetRank: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">판정 기준(노출 탭)</label>
                  <select value={form.judgeKey} onChange={e => setForm(f => ({ ...f, judgeKey: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {JUDGE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 -mt-1">
                {form.judgeKey === 'any' ? '통합검색·블로그탭 중 아무데나' : JUDGE_PRESETS.find(p => p.key === form.judgeKey)?.label}에서 <b className="text-gray-500">{form.targetRank || 10}위 이내</b>면 달성으로 봅니다. (항목별 조정 가능)
              </p>

              {(form.type === 'count' || form.type === 'count_monthly') && (
                <>
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
                    등록 시 그 업체의 <b className="text-gray-500">순위추적 작업이 전량 편입</b>됩니다(미수집 포함). 목표순위 이내로 잡힌 건수를{form.type === 'count_monthly' ? ' 이번 30일 윈도우(보고 기준일 정렬) 안에서' : ''} 셉니다.
                  </p>
                </>
              )}

              {form.type === 'keyword_coverage' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">보장 일수</label>
                      <input type="number" min={1} value={form.guaranteedDays}
                        onChange={e => setForm(f => ({ ...f, guaranteedDays: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">윈도우(일)</label>
                      <input type="number" min={1} value={form.windowDays}
                        onChange={e => setForm(f => ({ ...f, windowDays: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    각 키워드가 {form.windowDays || 30}일 중 <b className="text-gray-500">{form.guaranteedDays || 25}일 이상</b> 목표순위를 유지하면 충족. 항목 관리에서 키워드를 검색해 담으세요.
                  </p>
                </>
              )}

              {form.type === 'monitor' && (
                <p className="text-[11px] text-gray-400">목표 없이 주요 키워드의 순위 추이만 추적합니다. 항목 관리에서 키워드를 검색해 담으세요.</p>
              )}
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
        <DetailModal rg={detail} entries={entries} anchorDate={anchorOf(detail.clientId)} onClose={() => setDetailId(null)} onChange={saveRankGuarantee} />
      )}
    </Layout>
  );
}

// ── 항목 관리 모달 ──────────────────────────────────────
// 현재 회차 항목을 표로 보여주고, 순위 입력 시 즉시 저장(카운트·알림 재계산). 연장/종료 액션 포함.
//  • 연동 항목(entryId): 일정이 원천이라 키워드·순위 읽기전용. 순위는 일정에서 바뀌면 자동 동기화됨.
//  • 동결 항목(frozen): 원본 일정이 삭제돼 끊긴 항목 — 마지막 순위를 보존하며 다시 수동 편집 가능.
//  • 수동 항목: 보장함에서 직접 입력.
function DetailModal({ rg, entries, anchorDate, onClose, onChange }: { rg: RankGuarantee; entries: ScheduleEntry[]; anchorDate?: string; onClose: () => void; onChange: (rg: RankGuarantee) => void }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null); // 내보내기 완료 등 일시 안내
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 4000); };
  const [viewCycle, setViewCycle] = useState(rg.cycle); // 보고 있는 회차(기본=현재). 과거 회차는 읽기전용 이력.
  const isCurrent = viewCycle === rg.cycle;             // 현재 회차만 편집/추가 가능
  const items = rg.items.filter(it => it.cycle === viewCycle);
  const viewAchieved = items.filter(isRanked).length; // 보는 회차의 순위 잡힌 건수(내보내기 라벨/대상)
  const type = guaranteeType(rg);
  const isCoverage = type === 'keyword_coverage';
  const isMonitor = type === 'monitor';
  const gDays = rg.guaranteedDays ?? DEFAULT_GUARANTEED_DAYS;
  const win = currentWindow(anchorDate, rg.windowDays ?? DEFAULT_WINDOW_DAYS);
  const pr = progress(rg, { anchorDate });
  const reached = rg.status === 'reached';
  const linkedEntryIds = new Set(rg.items.filter(it => it.entryId).map(it => it.entryId));
  const entriesById = useMemo(() => new Map(entries.map(e => [e.id, e])), [entries]);
  const judge = (it: RankGuaranteeItem): Judge => judgeOf(it, rg);

  // 순위 수집 — 현재 회차 연동 항목의 일정을 수집 큐에 넣는다(진행 현황은 좌하단 위젯). 미수집 항목도 포함.
  const { collect, busy: collecting } = useRankCollect();
  const collectEntryIds = items.map(it => it.entryId).filter((x): x is string => !!x);
  const runCollect = async () => {
    if (!collectEntryIds.length) { flash('수집할 연동 일정이 없습니다. 일정에서 불러온 항목이 있어야 합니다.'); return; }
    await collect({ entryIds: collectEntryIds, mode: 'all' });
    flash(`✓ ${collectEntryIds.length}건 순위 수집을 요청했어요 — 진행 현황은 좌하단에 표시됩니다.`);
  };

  const enterBlur = (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); };
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
    const patch: Partial<RankGuaranteeItem> = { rank, rankedAt: rank != null && it.rankedAt == null ? todayStr() : it.rankedAt };
    // 이력형(월보장·모니터링) 수동 입력은 '오늘 순위' 단일 샘플로 남긴다(수집기 없이도 동작).
    if ((isCoverage || isMonitor) && rank != null) patch.samples = appendSample(it.samples, { date: todayStr(), rank });
    else if (rank === it.rank) return; // 건수형: 값 변화 없으면 저장 안 함(불필요한 알림·쓰기 방지)
    patchItem(it.id, patch);
  };
  const setTargetRank = (it: RankGuaranteeItem, raw: string) => {
    const t = parseRank(raw);
    if (t === it.targetRank) return;
    patchItem(it.id, { targetRank: t });
  };
  const setItemJudge = (it: RankGuaranteeItem, key: string) => {
    // ''(기본) = 보장 판정탭 따름(undefined). 그 외 프리셋 탭 저장.
    const tabs = key ? JUDGE_PRESETS.find(p => p.key === key)?.tabs : undefined;
    patchItem(it.id, { judgeTabs: tabs, targetTab: undefined });
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
      rank: e.rank, rankByTab: e.rankByTab, postDate: e.date,
      rankedAt: e.rank != null ? todayStr() : undefined,
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
  const extend = () => {
    if (!window.confirm(`${rg.cycle + 1}차로 연장할까요?\n현재 회차 기록은 이력으로 보존되고, 새 회차가 빈 상태로 시작됩니다.`)) return;
    const next = rg.cycle + 1;
    onChange({ ...rg, cycle: next, closed: false });
    setViewCycle(next);
  };
  // 연장 종료: 더 연장하지 않고 이 보장을 종료(카운팅·알림 멈춤, 재개 가능).
  const endGuarantee = () => {
    if (!window.confirm('이 순위 보장을 종료할까요?\n카운팅과 알림이 멈춥니다. (나중에 재개할 수 있습니다)')) return;
    onChange({ ...rg, closed: true });
  };
  const reopen = () => onChange({ ...rg, closed: false });
  // 되돌리기: 잘못 연장했거나 이전 회차로 돌아갈 때 — 현재 회차를 한 단계 낮춘다(상위 회차 항목은 데이터에 보존돼 재연장 시 복원).
  const revertCycle = () => {
    if (rg.cycle <= 1) return;
    const hasItems = rg.items.some(it => it.cycle === rg.cycle);
    const msg = hasItems
      ? `${rg.cycle}차를 접고 ${rg.cycle - 1}차로 되돌릴까요?\n${rg.cycle}차에 입력한 항목은 보존되며, 다시 연장하면 복원됩니다.`
      : `${rg.cycle - 1}차로 되돌릴까요? (잘못 누른 연장 취소)`;
    if (!window.confirm(msg)) return;
    const prev = rg.cycle - 1;
    onChange({ ...rg, cycle: prev, closed: false });
    setViewCycle(prev);
  };

  // 순위가 잡힌 항목만 엑셀(CSV)로 내보낸다 — 보장 건수 도달 시 전달용. 보고 있는 회차 기준, 판정순위 오름차순.
  const exportCsv = async () => {
    const ranked = items.filter(isRanked)
      .map(it => ({ it, jr: bestJudged(it, judge(it)) }))
      .filter(x => x.jr != null)
      .sort((a, b) => (a.jr as number) - (b.jr as number));
    if (ranked.length === 0) { alert('이 회차에 순위가 잡힌 항목이 없습니다.'); return; }
    const tabStr = (it: RankGuaranteeItem) => foundRanks(it.bestByTab ?? it.rankByTab).map(r => `${SEARCH_TAB_SHORT[r.tab]} ${r.rank}위`).join(', ') || (it.rank != null ? `${it.rank}위` : '');
    const rows = ranked.map((x, i) => [i + 1, x.it.keyword, `${x.jr}위`, tabStr(x.it), x.it.link ?? '', (x.it.postDate ?? (x.it.entryId ? entriesById.get(x.it.entryId)?.date : '') ?? '')]);
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim();
    const cyc = rg.cycle > 1 ? `_${viewCycle}차` : '';
    const res = await downloadCsv(`${safe(rg.clientName)}_${safe(rg.title)}${cyc}_순위보장_${todayStr()}`,
      ['번호', '키워드', '판정순위', '탭별순위', '링크', '포스팅일자'], rows);
    if (res.kind === 'saved') flash(`✓ 다운로드 폴더에 저장했어요 (${ranked.length}건)\n${res.path}`);
    else if (res.kind === 'downloaded') flash(`✓ 다운로드를 시작했어요 — 다운로드 폴더를 확인하세요 (${ranked.length}건)`);
    else if (res.kind === 'shared') flash(`✓ 공유로 내보냈어요 (${ranked.length}건)`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-md bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg whitespace-pre-line text-center break-all">
          {toast}
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{rg.clientName} · {rg.title}</h2>
            <p className="text-xs text-gray-500">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mr-1.5 ${TYPE_CHIP[type]}`}>{TYPE_LABEL[type]}</span>
              {isMonitor ? (
                <>{pr.n}개 키워드 추적</>
              ) : isCoverage ? (
                <>충족 <span className="font-bold text-gray-800">{pr.n}</span> / {pr.target}키워드 · 30일 중 {gDays}일 · <span className={STATUS_CHIP[rg.status].replace(/bg-[a-z]+-100/, '') + ' font-semibold'}>{STATUS_LABEL[rg.status]}</span></>
              ) : (
                <>{rg.cycle > 1 ? `${rg.cycle}차 · ` : ''}달성 <span className="font-bold text-gray-800">{pr.n}</span> / {pr.target}{pr.unit}
                {' '}· 임박 {thresholdOf(rg.guaranteedCount, rg.alertOffset)}건 · <span className={STATUS_CHIP[rg.status].replace(/bg-[a-z]+-100/, '') + ' font-semibold'}>{STATUS_LABEL[rg.status]}</span></>
              )}
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

        {/* 회차 기록 — 탭으로 지난 회차를 '보기'(읽기전용). 현재 회차는 그대로 유지되며 버리지 않는다.
            '되돌리기'(롤백)는 보기와 구분해 별도 링크로 둔다(잘못 누른 연장 취소용). */}
        {rg.cycle > 1 && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500">회차 기록</span>
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {Array.from({ length: rg.cycle }, (_, i) => i + 1).map(c => (
                  <button key={c} onClick={() => setViewCycle(c)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${c === viewCycle ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                    {c}차{c === rg.cycle ? ' · 현재' : ''}
                  </button>
                ))}
              </div>
              {!isCurrent && (
                <button onClick={() => setViewCycle(rg.cycle)} className="text-xs font-medium text-blue-600 hover:underline">현재 회차로 →</button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              탭을 눌러 지난 회차 기록을 봅니다(읽기전용). 현재 회차는 그대로 유지돼요.
              {' '}잘못 연장했다면{' '}
              <button onClick={revertCycle} className="text-amber-600 hover:underline font-medium">현재 회차를 이전으로 되돌리기</button>.
            </p>
          </div>
        )}

        {/* 순위 수집 — 이 보장의 연동 일정을 수집 큐에 넣는다(진행은 좌하단 위젯). 항상 노출. */}
        {isCurrent && (
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-800">순위 수집</p>
                <p className="text-[11px] text-blue-500/80 truncate">연동 일정 {collectEntryIds.length}건의 탭별 순위를 지금 수집합니다.</p>
              </div>
              <button onClick={runCollect} disabled={collecting || collectEntryIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
                {collecting ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
                {collecting ? '요청 중…' : '수집'}
              </button>
            </div>
          </div>
        )}

        {/* 항목 추가 — 현재 회차에서만(과거 회차는 이력 열람 전용) */}
        {isCurrent ? (
          <div className="px-6 pt-3 space-y-2">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {isCoverage || isMonitor ? (
                <>{isCoverage ? '보장' : '모니터링'}할 <b className="text-gray-500">키워드를 검색해 그 업체의 작업내역을 담으세요.</b>
                  수집하면 그날 탭별 순위가 쌓여 {isCoverage ? '커버리지 일수' : '추이'}가 계산됩니다.</>
              ) : (
                <>등록 시 이 업체의 <b className="text-gray-500">순위추적 작업이 전량 편입</b>됩니다.
                  빠진 게 있으면 키워드로 검색해 담거나 수동 추가하세요.</>
              )}
            </p>
            <button onClick={() => setPicking(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <Search size={15} /> 키워드로 작업내역 검색해 담기
            </button>
            <div className="flex gap-2">
              <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
                placeholder="또는 수동 키워드 추가 — 예: 위편장쾌한의원"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={addItem} className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                <Plus size={15} /> 추가
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-6 mt-4 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
            {viewCycle}차 이력입니다(읽기전용). 편집은 현재 회차에서만 가능합니다.
          </div>
        )}

        {/* 항목 표 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">항목이 없습니다. ‘일정에서 불러오기’ 또는 수동으로 추가하세요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-2 pl-1">키워드 · 포스팅일</th>
                  <th className="text-left font-medium py-2">탭별 순위</th>
                  {isCurrent && <th className="text-left font-medium py-2 w-24">목표·판정</th>}
                  {isCoverage ? <th className="text-left font-medium py-2">커버리지 ({gDays}일)</th>
                    : isMonitor ? <th className="text-left font-medium py-2">추이 (30일)</th>
                    : <th className="text-left font-medium py-2 w-12">달성</th>}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const linked = !!it.entryId;
                  const editable = isCurrent && !linked;          // 수동 항목만 키워드 직접 편집
                  const jd = judge(it);
                  const jr = bestJudged(it, jd);                  // 역대 최고 판정순위(밀려도 유지)
                  const hit = jr != null && jr <= jd.targetRank;  // 목표순위 이내 달성?
                  const tabs = foundRanks(it.bestByTab ?? it.rankByTab); // 탭별 역대 최고 순위(증빙)
                  const cov = isCoverage ? coveredDays(it, win, jd) : 0;
                  const itemJudgeKey = it.judgeTabs ? judgePresetKey(it.judgeTabs) : '';
                  const postDate = it.postDate ?? (it.entryId ? entriesById.get(it.entryId)?.date : undefined);
                  return (
                    <tr key={it.id} className="border-b border-gray-50 align-top">
                      {/* 키워드 · 포스팅일 */}
                      <td className="py-2 pl-1">
                        <div className="flex items-center gap-1.5">
                          {linked && <Link2 size={13} className="text-blue-500 shrink-0" />}
                          {it.frozen && <Lock size={12} className="text-gray-400 shrink-0" />}
                          {editable ? (
                            <input defaultValue={it.keyword} onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.keyword) patchItem(it.id, { keyword: v }); }}
                              className="w-full bg-transparent focus:outline-none focus:bg-blue-50/50 rounded px-1 py-0.5 font-medium" />
                          ) : (
                            <span className="px-1 py-0.5 text-gray-800 font-medium">{it.keyword}</span>
                          )}
                          {it.link && (
                            <a href={it.link} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-600 shrink-0" title={it.link}><ExternalLink size={13} /></a>
                          )}
                        </div>
                        <span className="ml-[18px] text-[10px] text-gray-400">
                          {postDate ? `포스팅 ${postDate}` : '포스팅일 미상'}{it.frozen ? ' · 원본 삭제됨' : ''}
                        </span>
                      </td>

                      {/* 탭별 순위 (+ 이력형 오늘 수동입력) */}
                      <td className="py-2">
                        {tabs.length ? (
                          <div className="flex flex-wrap gap-1">
                            {tabs.map(r => {
                              const inJudge = jd.judgeTabs.includes(r.tab);
                              const cls = inJudge && r.rank <= jd.targetRank ? 'bg-green-100 text-green-700'
                                : inJudge ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';
                              return <span key={r.tab} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`} title={inJudge ? '판정 대상 탭' : '참고(판정 제외)'}>{SEARCH_TAB_SHORT[r.tab]} {r.rank}</span>;
                            })}
                          </div>
                        ) : it.rank != null ? (
                          <span className="text-xs text-gray-600">{it.rank}위</span>
                        ) : <span className="text-[11px] text-gray-300">미수집</span>}
                        {(isCoverage || isMonitor) && isCurrent && (
                          <input defaultValue="" onBlur={e => setRank(it, e.target.value)} onKeyDown={enterBlur} placeholder="오늘 수동"
                            className="mt-1 block w-20 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        )}
                      </td>

                      {/* 목표·판정 (항목 덮어쓰기 — 비우면 보장 기본값) */}
                      {isCurrent && (
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <input defaultValue={it.targetRank != null ? String(it.targetRank) : ''} onBlur={e => setTargetRank(it, e.target.value)} onKeyDown={enterBlur}
                              placeholder={String(jd.targetRank)} title="목표순위(비우면 보장 기본값)"
                              className="w-11 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <select value={itemJudgeKey} onChange={e => setItemJudge(it, e.target.value)} title="판정탭(기본=보장 설정)"
                              className="border border-gray-200 rounded px-1 py-1 text-[11px] bg-white focus:outline-none max-w-[74px]">
                              <option value="">기본</option>
                              {JUDGE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                          </div>
                        </td>
                      )}

                      {/* 타입별 지표 */}
                      {isCoverage ? (
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold shrink-0 ${cov >= gDays ? 'text-green-600' : 'text-gray-500'}`}>{cov}/{gDays}일</span>
                            <CoverageStrip item={it} win={win} judge={jd} today={todayStr()} />
                          </div>
                        </td>
                      ) : isMonitor ? (
                        <td className="py-2"><Sparkline samples={it.samples ?? []} win={win} judge={jd} /></td>
                      ) : (
                        <td className="py-2">
                          {jr == null ? <span className="text-[11px] text-gray-300">—</span>
                            : hit ? <CheckCircle2 size={16} className="text-green-600" />
                            : <span className="text-[11px] text-gray-400">{jr}위</span>}
                        </td>
                      )}

                      <td className="py-2 text-right whitespace-nowrap">
                        {isCurrent && linked && (
                          <button onClick={() => unlinkItem(it.id)} className="p-1 text-gray-300 hover:text-amber-500 transition-colors" title="연동 해제(수동 전환)"><Unlink size={13} /></button>
                        )}
                        {isCurrent && (
                          <button onClick={() => removeItem(it.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="항목 삭제"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 하단 액션: 내보내기 · 닫기 · 연장 진행/종료 (항상 노출) */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 flex-wrap">
          <button onClick={exportCsv} title="순위가 잡힌 항목을 엑셀(CSV)로 내보내기"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
            <FileSpreadsheet size={15} /> 엑셀 내보내기 ({viewAchieved}건)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">닫기</button>
            {rg.closed ? (
              <button onClick={reopen} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                <PlayCircle size={15} /> 재개
              </button>
            ) : (
              <>
                <button onClick={extend} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  <RotateCw size={15} /> 연장 진행 ({rg.cycle + 1}차)
                </button>
                <button onClick={endGuarantee} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                  연장 종료
                </button>
              </>
            )}
          </div>
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
  const [kw, setKw] = useState('');
  // 키워드 검색으로 그 업체의 순위추적 작업내역을 좁힌다(키워드·카테고리 매칭).
  const q = kw.trim().toLowerCase();
  const candidates = useMemo(() => entries
    .filter(e => e.clientId === clientId && !excludeIds.has(e.id)
      && isRankTrackedCategory(e.category) && !!e.keyword
      && (!q || (e.keyword ?? '').toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [entries, clientId, excludeIds, q]);

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
            <h3 className="text-base font-bold text-gray-900">키워드로 작업내역 검색</h3>
            <p className="text-xs text-gray-400">보장·모니터링할 키워드를 검색해 그 업체의 순위추적 작업을 담습니다(수집 대상 연동)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="px-6 py-3 border-b border-gray-50">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={kw} onChange={e => setKw(e.target.value)} placeholder="키워드 검색 — 예: 위편장쾌한의원"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {candidates.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">{q ? `'${kw}'에 맞는 작업내역이 없습니다.` : '검색어를 입력하면 그 업체의 작업내역이 나옵니다.'}</p>
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

// ── 커버리지 스트립 ─────────────────────────────────────
// 윈도우의 각 날짜를 한 칸으로: 초록=판정순위 목표 이내 충족, 회색=미충족, 옅은=미래(오늘 이후).
function CoverageStrip({ item, win, judge, today }: { item: RankGuaranteeItem; win: { start: string; end: string }; judge: Judge; today: string }) {
  const covered = new Set<string>();
  for (const s of item.samples ?? []) {
    if (s.date < win.start || s.date > win.end) continue;
    const r = sampleJudged(s, judge.judgeTabs);
    if (r != null && r <= judge.targetRank) covered.add(s.date);
  }
  const days: string[] = [];
  for (let d = win.start; d <= win.end; d = addDays(d, 1)) days.push(d);
  return (
    <div className="flex gap-[2px] flex-wrap max-w-[240px]">
      {days.map(d => {
        const future = d > today;
        const ok = covered.has(d);
        return <span key={d} title={`${d}${ok ? ' · 충족' : future ? '' : ' · 미충족'}`}
          className={`w-1.5 h-3.5 rounded-[1px] ${future ? 'bg-gray-100' : ok ? 'bg-green-500' : 'bg-gray-300'}`} />;
      })}
    </div>
  );
}

// ── 순위 추이 스파크라인 ────────────────────────────────
// 윈도우 안 샘플의 '판정순위'를 선으로. 낮은 순위(=좋음)를 위로 그린다.
function Sparkline({ samples, win, judge }: { samples: RankSample[]; win: { start: string; end: string }; judge: Judge }) {
  const pts = (samples ?? []).filter(s => s.date >= win.start && s.date <= win.end)
    .map(s => ({ date: s.date, rank: sampleJudged(s, judge.judgeTabs) }))
    .filter((p): p is { date: string; rank: number } => p.rank != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length === 0) return <span className="text-xs text-gray-300">데이터 없음</span>;
  const W = 120, H = 26, pad = 3;
  const ranks = pts.map(p => p.rank);
  const min = Math.min(...ranks), max = Math.max(...ranks);
  const span = Math.max(1, max - min);
  const n = pts.length;
  const x = (i: number) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (r: number) => pad + ((r - min) / span) * (H - 2 * pad); // 좋은 순위(작음) → 위
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ');
  const last = pts[n - 1];
  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H}>
        <path d={d} fill="none" stroke="#14b8a6" strokeWidth={1.5} strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.rank)} r={1.6} fill="#14b8a6" />)}
      </svg>
      <span className="text-xs font-semibold text-teal-600 shrink-0">{last.rank}위</span>
    </div>
  );
}

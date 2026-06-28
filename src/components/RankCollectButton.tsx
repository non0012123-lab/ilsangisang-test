// 스케줄표 헤더의 "순위 수집" 버튼 + 범위·모드 선택.
//  - 대상 = 이 화면에 보이는 순위추적 일정(부모 페이지가 필터한 entries) 안에서
//    범위(본인/담당자/전체)로 한 번 더 거른 것. → 페이지 컨텍스트(날짜/필터) + 빠른 범위 단축.
//  - 모드: 전체수집(all, 기본) / 미수집(uncollected, 아직 안 돌린 탭만) / 미노출(unexposed, 돌렸으나 못 찾은 탭만).
//  - 트리거만 한다. 진행 현황은 전역 RankCollectWidget(어느 탭에서나 보임)이 표시.
import { useMemo, useState } from 'react';
import { Radar, Loader2 } from 'lucide-react';
import type { ScheduleEntry } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isRankTrackedCategory } from '../utils/searchTabs';
import { useRankCollect, type RankMode } from '../hooks/useRankCollect';

type Scope = 'mine' | 'manager' | 'all';

// 모드 기준으로 '실제 수집할 탭 수'를 센다 (서버 rank_job_targets 의 탭 필터와 동일 기준).
//  all=전탭 / uncollected=rankByTab 에 키 없는 탭 / unexposed=키 있고 숫자 아닌(null) 탭.
function matchTabs(tabs: string[] | undefined, rbt: Record<string, number | null | undefined> | undefined, mode: RankMode): number {
  const list = tabs ?? [];
  if (mode === 'all') return list.length;
  const r = rbt ?? {};
  if (mode === 'uncollected') return list.filter(t => !(t in r)).length;
  return list.filter(t => (t in r) && typeof r[t] !== 'number').length; // unexposed
}

export default function RankCollectButton({ entries }: { entries: ScheduleEntry[] }) {
  const { members } = useApp();
  const { user } = useAuth();
  const { collect, busy } = useRankCollect();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [scope, setScope] = useState<Scope>('mine');     // 기본=본인
  const [managerId, setManagerId] = useState(user?.id ?? '');
  const [mode, setMode] = useState<RankMode>('all');     // 기본=전체수집

  const MODE_LABEL: Record<RankMode, string> = { all: '전체수집', uncollected: '미수집', unexposed: '미노출' };

  // 이 화면의 순위추적 대상(범위 필터까지) = 모드 무관 '전체 모집단'
  const scoped = useMemo(() => {
    const rt = entries.filter(e => isRankTrackedCategory(e.category) && (e.searchTabs?.length ?? 0) > 0 && e.keyword);
    if (scope === 'all') return rt;
    const mid = scope === 'manager' ? managerId : (user?.id ?? '');
    return rt.filter(e => e.managerId === mid);
  }, [entries, scope, managerId, user]);

  // 모드 기준 실제 수집량: 메인탭 + 기존 롱테일탭에서 '이 모드 대상 탭'을 센다.
  //  → 전체/미수집/미노출이 서로 다른 건수·탭수로 표시되게.
  const stat = useMemo(() => {
    let ents = 0, tabsN = 0;
    const ids: string[] = [];
    for (const e of scoped) {
      let n = matchTabs(e.searchTabs, e.rankByTab, mode);
      for (const s of e.subKeywords ?? []) n += matchTabs(e.searchTabs, s.rankByTab, mode);
      if (n > 0) { ents++; tabsN += n; ids.push(e.id); }
    }
    return { ents, tabsN, ids };
  }, [scoped, mode]);

  const scopeLabel = scope === 'all' ? '전체' : scope === 'manager' ? (members.find(m => m.id === managerId)?.name ?? '담당자') : '내 담당';

  const run = async () => {
    const modeDesc = mode === 'all' ? '전체수집 + 롱테일 발굴' : mode === 'uncollected' ? '미수집 탭만' : '미노출 탭만';
    if (!window.confirm(`[${scopeLabel}] ${MODE_LABEL[mode]} 대상 ${stat.ents}건(${stat.tabsN}탭)을 수집 요청합니다.\n(${modeDesc})\n계속할까요?`)) return;
    await collect({ entryIds: stat.ids, mode });
    setOpen(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        title="이 화면에 보이는 순위추적 일정을 범위별로 수집 요청합니다 (진행 현황은 좌하단)"
        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors ${
          done ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
        {busy ? '요청 중…' : done ? '요청됨' : '순위 수집'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-20 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1">범위 <span className="font-normal text-gray-400">(이 화면 안에서)</span></p>
              <div className="flex gap-1">
                {([['mine', '본인'], ['manager', '담당자'], ['all', '전체']] as [Scope, string][]).map(([v, lb]) => (
                  <button key={v} onClick={() => setScope(v)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition ${scope === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {lb}
                  </button>
                ))}
              </div>
              {scope === 'manager' && (
                <select value={managerId} onChange={e => setManagerId(e.target.value)}
                  className="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1">모드</p>
              <div className="flex gap-1">
                {(['all', 'uncollected', 'unexposed'] as RankMode[]).map(v => (
                  <button key={v} onClick={() => setMode(v)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition ${mode === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {MODE_LABEL[v]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-400 leading-snug">
                {mode === 'all'
                  ? '모든 탭을 다시 수집 + 롱테일 재발굴(순위 변동 확인용). 기본값.'
                  : mode === 'uncollected'
                  ? '아직 한 번도 안 돌린 탭만 수집(신규 등록·새 탭 채우기). 이미 확인한 탭은 건너뜀(프록시 절약).'
                  : '수집은 했지만 순위를 못 찾은 탭만 재확인(2주 뒤 잡히는 케이스 추적). 미수집 탭은 건너뜀.'}
              </p>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              <span className="font-semibold text-gray-700">{scopeLabel}</span> · {MODE_LABEL[mode]} 수집 대상 <span className="font-semibold text-blue-600">{stat.ents}건</span> · <span className="font-semibold text-blue-600">{stat.tabsN}탭</span>
              <div className="text-[10px] text-gray-400">(이 화면 순위추적 {scoped.length}건 중)</div>
            </div>
            <button onClick={run} disabled={busy || stat.ents === 0}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              수집 요청
            </button>
          </div>
        </>
      )}
    </div>
  );
}

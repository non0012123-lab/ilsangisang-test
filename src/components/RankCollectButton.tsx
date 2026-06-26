// 스케줄표 헤더의 "순위 수집" 버튼 + 범위·모드 선택.
//  - 대상 = 이 화면에 보이는 순위추적 일정(부모 페이지가 필터한 entries) 안에서
//    범위(본인/담당자/전체)로 한 번 더 거른 것. → 페이지 컨텍스트(날짜/필터) + 빠른 범위 단축.
//  - 모드: 전체 수집(all, 기본) / 미발견만(pending).
//  - 트리거만 한다. 진행 현황은 전역 RankCollectWidget(어느 탭에서나 보임)이 표시.
import { useMemo, useState } from 'react';
import { Radar, Loader2 } from 'lucide-react';
import type { ScheduleEntry } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isRankTrackedCategory } from '../utils/searchTabs';
import { useRankCollect, type RankMode } from '../hooks/useRankCollect';

type Scope = 'mine' | 'manager' | 'all';

export default function RankCollectButton({ entries }: { entries: ScheduleEntry[] }) {
  const { members } = useApp();
  const { user } = useAuth();
  const { collect, busy } = useRankCollect();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [scope, setScope] = useState<Scope>('mine');     // 기본=본인
  const [managerId, setManagerId] = useState(user?.id ?? '');
  const [mode, setMode] = useState<RankMode>('all');     // 기본=전체 수집

  // 이 화면의 순위추적 대상 → 범위(본인/담당자/전체)로 한 번 더 필터
  const targets = useMemo(() => {
    const rt = entries.filter(e => isRankTrackedCategory(e.category) && (e.searchTabs?.length ?? 0) > 0 && e.keyword);
    if (scope === 'all') return rt;
    const mid = scope === 'manager' ? managerId : (user?.id ?? '');
    return rt.filter(e => e.managerId === mid);
  }, [entries, scope, managerId, user]);

  const scopeLabel = scope === 'all' ? '전체' : scope === 'manager' ? (members.find(m => m.id === managerId)?.name ?? '담당자') : '내 담당';

  const run = async () => {
    if (!window.confirm(`[${scopeLabel}] 이 화면 순위추적 ${targets.length}건을 수집 요청합니다.\n(${mode === 'all' ? '전체 수집 + 롱테일 발굴' : '미발견만'})\n계속할까요?`)) return;
    await collect({ entryIds: targets.map(e => e.id), mode });
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
                {([['all', '전체 수집'], ['pending', '미발견만']] as [RankMode, string][]).map(([v, lb]) => (
                  <button key={v} onClick={() => setMode(v)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition ${mode === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {lb}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-400 leading-snug">
                {mode === 'all'
                  ? '모든 탭을 다시 수집 + 롱테일 재발굴(순위 변동 확인용). 기본값.'
                  : '아직 안 잡힌 것만: 미발견 메인/롱테일 탭 재확인, 롱테일이 없던 글은 새로 발굴(프록시 절약).'}
              </p>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              <span className="font-semibold text-gray-700">{scopeLabel}</span> · 이 화면 순위추적 <span className="font-semibold text-blue-600">{targets.length}건</span>
            </div>
            <button onClick={run} disabled={busy || targets.length === 0}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              수집 요청
            </button>
          </div>
        </>
      )}
    </div>
  );
}

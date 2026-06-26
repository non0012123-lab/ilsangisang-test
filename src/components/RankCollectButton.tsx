// 스케줄표 헤더의 "순위 수집" 버튼 + 범위/모드 선택 팝오버.
//  - 범위: 본인(mine, 기본) / 특정 담당자(manager) / 전체(all)
//  - 모드: 미발견만(pending, 기본 · 이미 잡힌 탭은 건너뜀) / 전체 재수집(all)
//  - 트리거만 한다. 진행 현황은 전역 RankCollectWidget(어느 탭에서나 보임)이 표시.
import { useState } from 'react';
import { Radar, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRankCollect, type RankScope, type RankMode } from '../hooks/useRankCollect';

export default function RankCollectButton() {
  const { members } = useApp();
  const { user } = useAuth();
  const { collect, busy } = useRankCollect();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [scope, setScope] = useState<RankScope>('mine');
  const [managerId, setManagerId] = useState(user?.id ?? '');
  const [mode, setMode] = useState<RankMode>('pending');

  const run = async () => {
    const m = members.find(x => x.id === managerId);
    await collect({
      scope,
      managerId: scope === 'manager' ? managerId : user?.id,
      managerName: scope === 'manager' ? m?.name : (user?.name ?? undefined),
      mode,
    });
    setOpen(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        title="선택한 범위의 순위를 수집기에 요청합니다 (진행 현황은 화면 좌하단에 표시)"
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
              <p className="text-[11px] font-semibold text-gray-500 mb-1">범위</p>
              <div className="flex gap-1">
                {([['mine', '본인'], ['manager', '담당자'], ['all', '전체']] as [RankScope, string][]).map(([v, lb]) => (
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
                {([['pending', '미발견만'], ['all', '전체 재수집']] as [RankMode, string][]).map(([v, lb]) => (
                  <button key={v} onClick={() => setMode(v)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition ${mode === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {lb}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-400 leading-snug">
                {mode === 'pending' ? '이미 순위가 잡힌 탭은 건너뛰고 미발견·미수집만 수집(프록시 절약).' : '범위 내 모든 탭을 다시 수집 + 롱테일 재발굴(순위 변동 확인용).'}
              </p>
            </div>

            <button onClick={run} disabled={busy}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              수집 요청
            </button>
          </div>
        </>
      )}
    </div>
  );
}

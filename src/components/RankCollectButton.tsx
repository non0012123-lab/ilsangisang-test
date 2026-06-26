// 스케줄표 헤더의 "순위 수집" 버튼 + 범위/모드 선택 + 진행/결과 카드.
//  - 범위: 본인(mine, 기본) / 특정 담당자(manager) / 전체(all)
//  - 모드: 미발견만(pending, 기본 · 이미 잡힌 탭은 건너뜀) / 전체 재수집(all)
//  - 진행 바(done/total) + 결과 집계: 성공(발견) / 미노출(1p·블로그탭에 링크 없음) / 실패(HTML 못 불러옴)
import { useState } from 'react';
import { Radar, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRankCollect, type RankScope, type RankMode } from '../hooks/useRankCollect';

export default function RankCollectButton() {
  const { members } = useApp();
  const { user } = useAuth();
  const { job, busy, collect } = useRankCollect();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [scope, setScope] = useState<RankScope>('mine');
  const [managerId, setManagerId] = useState(user?.id ?? '');
  const [mode, setMode] = useState<RankMode>('pending');

  const running = !!job && (job.status === 'queued' || job.status === 'running');
  const showCard = !!job && !dismissed;

  const label = (() => {
    if (busy) return '요청 중…';
    if (running) return job!.total ? `수집 중 ${job!.done}/${job!.total}` : '수집 대기…';
    if (job?.status === 'done') return '수집 완료';
    if (job?.status === 'empty') return '대상 없음';
    if (job?.status === 'error') return '수집 오류';
    return '순위 수집';
  })();

  const run = () => {
    const m = members.find(x => x.id === managerId);
    setDismissed(false);
    collect({
      scope,
      managerId: scope === 'manager' ? managerId : user?.id,
      managerName: scope === 'manager' ? m?.name : (user?.name ?? undefined),
      mode,
    });
    setOpen(false);
  };

  const Icon = busy || running ? Loader2 : job?.status === 'done' ? Check : job?.status === 'error' ? AlertCircle : Radar;
  const pct = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;

  const statusText = (() => {
    if (!job) return '';
    if (job.status === 'queued') return '대기열 등록됨 · 수집기 응답 대기 중';
    if (job.status === 'running') return '수집 중';
    if (job.status === 'done') return '수집 완료';
    if (job.status === 'empty') return '수집할 대상이 없습니다';
    if (job.status === 'error') return `오류: ${job.error ?? '알 수 없음'}`;
    return job.status;
  })();

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        title="선택한 범위의 순위를 수집기에 요청합니다"
        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors ${
          running ? 'border-blue-600 bg-blue-50 text-blue-700'
          : job?.status === 'error' ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
        <Icon size={14} className={busy || running ? 'animate-spin' : ''} /> {label}
      </button>

      {/* 옵션 팝오버 */}
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
                {mode === 'pending' ? '이미 순위가 잡힌 탭은 건너뛰고 미발견·미수집만 수집(프록시 절약).' : '범위 내 모든 탭을 다시 수집(순위 변동 확인용).'}
              </p>
            </div>

            <button onClick={run}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
              수집 요청
            </button>
          </div>
        </>
      )}

      {/* 진행/결과 카드 */}
      {showCard && !open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              {running ? <Loader2 size={13} className="animate-spin text-blue-600" /> : job!.status === 'error' ? <AlertCircle size={13} className="text-red-500" /> : <Check size={13} className="text-green-600" />}
              {statusText}
            </span>
            {!running && <button onClick={() => setDismissed(true)} className="p-1 -m-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>

          {/* 진행 바 */}
          {job!.total > 0 && (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-gray-400 text-right">{job!.done}/{job!.total} 탭 ({pct}%)</p>
            </div>
          )}

          {/* 결과 집계 */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-green-50 py-1.5">
              <p className="text-sm font-bold text-green-600">{job!.success}</p>
              <p className="text-[10px] text-green-700/70">성공</p>
            </div>
            <div className="rounded-lg bg-amber-50 py-1.5">
              <p className="text-sm font-bold text-amber-600">{job!.not_found}</p>
              <p className="text-[10px] text-amber-700/70">미노출</p>
            </div>
            <div className="rounded-lg bg-red-50 py-1.5">
              <p className="text-sm font-bold text-red-600">{job!.failed}</p>
              <p className="text-[10px] text-red-700/70">실패</p>
            </div>
          </div>

          {job!.status === 'queued' && (
            <p className="text-[10px] text-gray-400 leading-snug">수집 프로그램이 켜져 있어야 진행됩니다. 연동 전에는 대기 상태로 남습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

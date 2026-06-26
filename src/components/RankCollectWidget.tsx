// 순위 수집 진행 현황 전역 위젯 (Layout 에 상주 → 어느 탭/새로고침에도 좌하단에 표시).
//  - rank_jobs 를 전역 구독해 '최근 작업'의 진행을 보여준다(단일 수집기라 활성 작업은 1개).
//  - 메인 키워드 개수 + 진행 바(탭 done/total) + 성공/미노출/실패.
//  - 실행 중이거나 '최근(10분 내) 완료' 면 표시, 완료건은 닫기로 숨김.
import { useEffect, useState } from 'react';
import { Loader2, Check, AlertCircle, X, Radar, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Job {
  id: string; status: string; mode: string;
  total: number; done: number; success: number; not_found: number; failed: number;
  main_count: number; error?: string | null; finished_at?: string | null;
}

const DISMISS_KEY = 'rankWidgetDismissedJob';
const loadDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) || ''; } catch { return ''; } };

export default function RankCollectWidget() {
  const { user } = useAuth();
  const me = user?.id ?? '';
  const [job, setJob] = useState<Job | null>(null);
  // 닫힘 상태는 localStorage 에 보관 — Layout 리마운트(페이지 이동)에도 유지
  const [dismissed, setDismissed] = useState(loadDismissed);
  const dismiss = (id: string) => { try { localStorage.setItem(DISMISS_KEY, id); } catch { /* ignore */ } setDismissed(id); };

  useEffect(() => {
    if (!supabase || !me) return;
    let active = true;
    // 내가 요청한 작업만 추적/표시 — 멀티유저에서 남의 작업은 안 보이고 중단도 내 것만
    supabase.from('rank_jobs').select('*').eq('requested_by', me).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (active && data && data[0]) setJob(data[0] as Job); });
    const ch = supabase
      .channel('rank_jobs_widget_' + me)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rank_jobs', filter: `requested_by=eq.${me}` }, payload => {
        const r = payload.new as Job | undefined;
        if (r && r.id) setJob(r);
      })
      .subscribe();
    return () => { active = false; ch.unsubscribe(); };
  }, [me]);

  if (!job) return null;
  const running = job.status === 'queued' || job.status === 'running';
  const recent = job.finished_at ? Date.now() - new Date(job.finished_at).getTime() < 10 * 60 * 1000 : false;
  if (!running && (!recent || dismissed === job.id)) return null;

  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const statusText =
    job.status === 'queued' ? '대기 중 · 수집기 응답 대기'
    : job.status === 'running' ? '순위 수집 중'
    : job.status === 'done' ? '수집 완료'
    : job.status === 'empty' ? '수집할 대상 없음'
    : job.status === 'cancelled' ? '수집 중단됨'
    : job.status === 'error' ? `오류: ${job.error ?? '알 수 없음'}` : job.status;

  const cancel = () => {
    if (!supabase || !window.confirm('수집을 중단할까요? 진행 중인 작업이 종료됩니다.')) return;
    void supabase.rpc('cancel_rank_job', { p_job_id: job.id });
  };

  return (
    <div className="fixed bottom-4 left-4 lg:left-[16rem] z-40 w-[18rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-gray-200 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
          {running ? <Loader2 size={13} className="animate-spin text-blue-600" />
            : job.status === 'error' ? <AlertCircle size={13} className="text-red-500" />
            : job.status === 'cancelled' ? <Ban size={13} className="text-gray-400" />
            : job.status === 'empty' ? <Radar size={13} className="text-gray-400" />
            : <Check size={13} className="text-green-600" />}
          순위 수집 · {statusText}
        </span>
        {running
          ? <button onClick={cancel} title="수집 중단"
              className="flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded-md text-[11px] font-semibold text-red-600 hover:bg-red-50"><Ban size={12} /> 중단</button>
          : <button onClick={() => dismiss(job.id)} className="p-1 -m-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
      </div>

      {/* 메인 키워드 개수 */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">메인 키워드</span>
        <span className="font-semibold text-gray-800">{job.main_count}개{job.mode === 'all' ? ' · 롱테일 포함' : ''}</span>
      </div>

      {/* 진행 바(탭 단위) */}
      {job.total > 0 && (
        <div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-gray-400 text-right">{job.done}/{job.total} 키워드·탭 ({pct}%)</p>
        </div>
      )}

      {/* 결과 집계 */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-green-50 py-1"><p className="text-sm font-bold text-green-600">{job.success}</p><p className="text-[10px] text-green-700/70">성공</p></div>
        <div className="rounded-lg bg-amber-50 py-1"><p className="text-sm font-bold text-amber-600">{job.not_found}</p><p className="text-[10px] text-amber-700/70">미노출</p></div>
        <div className="rounded-lg bg-red-50 py-1"><p className="text-sm font-bold text-red-600">{job.failed}</p><p className="text-[10px] text-red-700/70">실패</p></div>
      </div>
    </div>
  );
}

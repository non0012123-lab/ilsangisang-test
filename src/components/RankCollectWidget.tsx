// 순위 수집 진행 현황 전역 위젯 (Layout 에 상주 → 어느 탭/새로고침에도 좌하단에 표시).
//  - rank_jobs 를 전역 구독해 '최근 작업'의 진행을 보여준다(단일 수집기라 활성 작업은 1개).
//  - 메인 키워드 개수 + 진행 바(탭 done/total) + 성공/미노출/실패.
//  - 실행 중이거나 '최근(10분 내) 완료' 면 표시, 완료건은 닫기로 숨김.
//  - ★ 진행/종료 시 대상 일정을 서버에서 다시 읽어 순위를 반영한다(refreshEntries).
//    realtime UPDATE 는 이미지가 큰 일정에서 페이로드 초과(413)로 유실될 수 있어,
//    "수집기는 순위를 찾았는데 몇 건만 계속 미수집"으로 보이던 문제를 이 재조회가 메운다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Check, AlertCircle, X, Radar, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

interface Job {
  id: string; status: string; mode: string; include_longtail?: boolean;
  total: number; done: number; success: number; not_found: number; failed: number;
  main_count: number; error?: string | null; finished_at?: string | null;
  entry_ids?: string[] | null;   // 이 작업의 대상 일정(재동기화 범위). 구버전 scope 작업은 null
}

const DISMISS_KEY = 'rankWidgetDismissedJob';
const loadDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) || ''; } catch { return ''; } };
// 종료 후 재동기화를 이미 끝낸 작업 id — 페이지 이동(위젯 리마운트)·새로고침에도 중복 조회하지 않도록 보관.
const SYNCED_KEY = 'rankWidgetSyncedJob';
const loadSynced = () => { try { return localStorage.getItem(SYNCED_KEY) || ''; } catch { return ''; } };
const RUNNING_SYNC_MS = 30_000;   // 수집 중에는 30초마다 중간 결과 반영
const isTerminal = (s: string) => s === 'done' || s === 'error' || s === 'cancelled' || s === 'empty';

export default function RankCollectWidget() {
  const { user } = useAuth();
  const { refreshEntries } = useApp();
  const me = user?.id ?? '';
  const [job, setJob] = useState<Job | null>(null);
  // 닫힘 상태는 localStorage 에 보관 — Layout 리마운트(페이지 이동)에도 유지
  const [dismissed, setDismissed] = useState(loadDismissed);
  const dismiss = (id: string) => { try { localStorage.setItem(DISMISS_KEY, id); } catch { /* ignore */ } setDismissed(id); };

  // 이 작업의 대상 일정을 서버에서 다시 읽어 순위를 화면에 반영한다.
  //  final=true 면 '이 작업은 재동기화 완료'로 표시해 리마운트/새로고침 때 다시 돌지 않게 한다.
  const syncedRef = useRef(loadSynced());
  const syncJobEntries = useCallback(async (j: Job, final: boolean) => {
    if (final) {
      if (syncedRef.current === j.id) return;
      syncedRef.current = j.id;
      try { localStorage.setItem(SYNCED_KEY, j.id); } catch { /* ignore */ }
    }
    await refreshEntries(Array.isArray(j.entry_ids) ? j.entry_ids : undefined);
  }, [refreshEntries]);

  useEffect(() => {
    if (!supabase || !me) return;
    const sb = supabase;
    let active = true;
    // 표시 우선순위: 내 '활성(queued/running)' 작업 → 없으면 최신(완료/취소 10분 표시용).
    //  작업이 연달아 생겨도 '지금 도는' 작업을 잡아, 중단이 엉뚱한 최신 작업을 취소하지 않게.
    const loadJob = async () => {
      const act = await sb.from('rank_jobs').select('*').eq('requested_by', me)
        .in('status', ['queued', 'running']).order('created_at', { ascending: false }).limit(1);
      let row = act.data?.[0];
      if (!row) {
        const last = await sb.from('rank_jobs').select('*').eq('requested_by', me)
          .order('created_at', { ascending: false }).limit(1);
        row = last.data?.[0];
      }
      if (!active || !row) return;
      const j = row as Job;
      setJob(j);
      // 이미 끝난 작업을 뒤늦게 발견한 경우(새로고침 등)에도 결과를 한 번 확실히 끌어온다.
      if (isTerminal(j.status)) void syncJobEntries(j, true);
    };
    void loadJob();
    const ch = sb
      .channel('rank_jobs_widget_' + me)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rank_jobs', filter: `requested_by=eq.${me}` }, payload => {
        const r = payload.new as Job | undefined;
        if (!r || !r.id) return;
        // 활성 변화는 그대로 반영, 끝난(완료/오류/취소) 변화면 아직 도는 다른 작업을 우선 재탐색
        if (r.status === 'queued' || r.status === 'running') { setJob(r); return; }
        void syncJobEntries(r, true);   // ★ 종료 시 대상 일정 재조회 — realtime 유실분을 여기서 메움
        void loadJob();
      })
      .subscribe();
    return () => { active = false; ch.unsubscribe(); };
  }, [me, syncJobEntries]);

  // 수집 중에는 주기적으로도 반영 — 20분짜리 작업에서 끝날 때까지 순위가 하나도 안 뜨는 걸 막는다.
  //  (final=false 라 '완료 처리'로 기록하지 않음 → 종료 시 최종 재조회는 그대로 한 번 더 돈다)
  //  ★ 의존성은 '작업 id' 만 — job 객체를 쓰면 진행도 UPDATE 마다 타이머가 리셋돼 영영 안 돈다.
  const jobRef = useRef<Job | null>(null);
  useEffect(() => { jobRef.current = job; }, [job]);
  const runningId = job && (job.status === 'queued' || job.status === 'running') ? job.id : '';
  useEffect(() => {
    if (!runningId) return;
    const t = setInterval(() => {
      const j = jobRef.current;
      if (j && j.id === runningId) void syncJobEntries(j, false);
    }, RUNNING_SYNC_MS);
    return () => clearInterval(t);
  }, [runningId, syncJobEntries]);

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

  const cancel = async () => {
    if (!supabase || !window.confirm('수집을 중단할까요? 진행 중인 작업이 종료됩니다.')) return;
    // 표시 중 1건이 최신이 아닐 수 있어, 내 '활성(queued/running)' 작업을 모두 취소(단일 수집기라 보통 1건).
    const { data } = await supabase.from('rank_jobs').select('id').eq('requested_by', me).in('status', ['queued', 'running']);
    for (const r of (data ?? []) as { id: string }[]) await supabase.rpc('cancel_rank_job', { p_job_id: r.id });
    void supabase.rpc('cancel_rank_job', { p_job_id: job.id });   // 표시 작업도 멱등 처리
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
        <span className="font-semibold text-gray-800">{job.main_count}개{job.include_longtail === false ? ' · 메인만' : ' · 롱테일 포함'}</span>
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

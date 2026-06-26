// 순위 수집 작업(rank_jobs)을 enqueue 하고, 그 작업의 진행도를 realtime 으로 추적하는 훅.
//  - 버튼 트리거 방식: 여기서 enqueue_rank_job 만 호출하고, 실제 수집은 그쪽 수집기가 큐를 비운다.
//  - 진행도(total/done/status)는 rank_jobs UPDATE 를 구독해 실시간 반영(0027: FULL).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type RankScope = 'mine' | 'manager' | 'all';
export type RankMode = 'pending' | 'all';
export interface RankJob {
  id: string; status: string; total: number; done: number;
  success: number; not_found: number; failed: number;
  error?: string | null;
}
const EMPTY_COUNTS = { total: 0, done: 0, success: 0, not_found: 0, failed: 0 };

export function useRankCollect() {
  const { user } = useAuth();
  const [job, setJob] = useState<RankJob | null>(null);
  const [busy, setBusy] = useState(false);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  const subscribe = useCallback((id: string) => {
    if (!supabase) return;
    subRef.current?.unsubscribe();
    subRef.current = supabase
      .channel('rank_job_' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rank_jobs', filter: `id=eq.${id}` },
        payload => {
          const r = payload.new as RankJob | undefined;
          if (r && r.id) setJob({
            id: r.id, status: r.status, total: r.total ?? 0, done: r.done ?? 0,
            success: r.success ?? 0, not_found: r.not_found ?? 0, failed: r.failed ?? 0, error: r.error,
          });
        })
      .subscribe();
  }, []);

  const collect = useCallback(async (opts: { scope: RankScope; managerId?: string; managerName?: string; mode: RankMode }) => {
    if (!supabase || !user) return;
    setBusy(true);
    try {
      const all = opts.scope === 'all';
      const { data, error } = await supabase.rpc('enqueue_rank_job', {
        p_scope_type: opts.scope,
        p_manager_id: all ? null : (opts.managerId ?? user.id),
        p_manager_name: all ? null : (opts.managerName ?? user.name ?? ''),
        p_mode: opts.mode,
        p_requested_by: user.id,
        p_requested_by_name: user.name ?? '',
      });
      if (error) throw error;
      const id = data as string;
      setJob({ id, status: 'queued', ...EMPTY_COUNTS });
      subscribe(id);
    } catch (e) {
      setJob({ id: '', status: 'error', ...EMPTY_COUNTS, error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [user, subscribe]);

  useEffect(() => () => { subRef.current?.unsubscribe(); }, []);

  return { job, busy, collect };
}

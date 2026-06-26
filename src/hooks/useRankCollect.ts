// 순위 수집 작업을 큐에 적재(enqueue)만 하는 훅. 진행 표시는 전역 RankCollectWidget 가 담당.
//  - 버튼은 트리거만 하고, 다른 페이지로 가도 진행 현황은 전역 위젯에서 계속 보인다.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type RankScope = 'mine' | 'manager' | 'all';
export type RankMode = 'pending' | 'all';

export function useRankCollect() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const collect = useCallback(async (opts: { scope: RankScope; managerId?: string; managerName?: string; mode: RankMode }) => {
    if (!supabase || !user) return;
    setBusy(true); setError('');
    try {
      const all = opts.scope === 'all';
      const { error: e } = await supabase.rpc('enqueue_rank_job', {
        p_scope_type: opts.scope,
        p_manager_id: all ? null : (opts.managerId ?? user.id),
        p_manager_name: all ? null : (opts.managerName ?? user.name ?? ''),
        p_mode: opts.mode,
        p_requested_by: user.id,
        p_requested_by_name: user.name ?? '',
      });
      if (e) throw e;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [user]);

  return { collect, busy, error };
}

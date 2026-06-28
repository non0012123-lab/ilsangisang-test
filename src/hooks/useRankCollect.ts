// 순위 수집 작업을 큐에 적재(enqueue). 대상은 '화면에 보이는 일정 id 목록'.
//  - 버튼은 트리거만, 진행 현황은 전역 RankCollectWidget 가 담당.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// all=전체 재수집, uncollected=미수집(아예 안 돌린 탭만), unexposed=미노출(돌렸으나 못 찾은 탭만).
//  ('pending' 은 구버전 합집합 — 서버 호환용으로만 존재, UI 에선 미사용)
export type RankMode = 'all' | 'uncollected' | 'unexposed';

export function useRankCollect() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // entryIds = 이 화면의 순위추적 일정 id 들. 그 일정만 수집한다.
  const collect = useCallback(async (opts: { entryIds: string[]; mode: RankMode }) => {
    if (!supabase || !user || opts.entryIds.length === 0) return;
    setBusy(true); setError('');
    try {
      const { error: e } = await supabase.rpc('enqueue_rank_job', {
        p_scope_type: 'all',          // entry_ids 가 실제 대상을 정함(scope 무관)
        p_manager_id: null,
        p_manager_name: null,
        p_mode: opts.mode,
        p_requested_by: user.id,
        p_requested_by_name: user.name ?? '',
        p_entry_ids: opts.entryIds,
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

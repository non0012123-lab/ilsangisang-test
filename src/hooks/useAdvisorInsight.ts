// 광고주(Client)의 크리에이터 어드바이저 인사이트 — 기간(period)별 로드 + realtime + 수집 트리거.
//  - advisor_insights 는 (client_id, period) 단위(0036) → 어제(1d)/7일(7d)/30일(30d)을 각각 따로 보관.
//    기간 버튼은 '재수집' 없이 해당 기간 스냅샷만 보여준다(서로 안 덮음).
//  - 수집기는 service_role 로 patch_advisor_insight(client_id, period, payload) 되써넣음. 앱은 enqueue 만.
//  계약: spike-rank/ADVISOR-CONTRACT.md / 마이그레이션 0034·0036
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type AdvisorPeriod = '1d' | '7d' | '30d';

export interface InflowKeyword { keyword: string; count: number; }
export interface TrendPoint { date: string; views: number; visitors: number; }
export interface AdvisorDemographics {
  gender?: { male?: number; female?: number };
  age?: { bucket: string; ratio: number }[];
}
export interface AdvisorPayload {
  inflowKeywords?: InflowKeyword[];
  viewsTrend?: { period: string; points: TrendPoint[] };
  demographics?: AdvisorDemographics;
}
export interface AdvisorJob {
  id: string; status: string; period?: string;
  total: number; done: number; error?: string | null; finished_at?: string | null;
}
interface PeriodSnap { data: AdvisorPayload; collectedAt: string | null; }
type ByPeriod = Partial<Record<string, PeriodSnap>>;

const cacheKey = (id: string) => `ilsangisang.advisorInsight.${id}.v2`;
const loadCache = (id: string): ByPeriod => {
  try { const raw = localStorage.getItem(cacheKey(id)); return raw ? JSON.parse(raw) as ByPeriod : {}; }
  catch { return {}; }
};
const saveCache = (id: string, map: ByPeriod) => {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(map)); } catch { /* 용량초과 무시 */ }
};

export function useAdvisorInsight(clientId: string | null, clientName?: string) {
  const { user } = useAuth();
  const [byPeriod, setByPeriod] = useState<ByPeriod>({});
  const [job, setJob] = useState<AdvisorJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!clientId) { setByPeriod({}); setJob(null); return; }
    setByPeriod(loadCache(clientId));  // 캐시로 즉시 렌더
    if (!supabase) return;
    const sb = supabase;
    let active = true;

    const applyRow = (row: { period?: string; data?: AdvisorPayload; collected_at?: string | null } | undefined) => {
      if (!active || !row?.period) return;
      setByPeriod(prev => {
        const next = { ...prev, [row.period as string]: { data: (row.data ?? {}) as AdvisorPayload, collectedAt: row.collected_at ?? null } };
        saveCache(clientId, next);
        return next;
      });
    };

    void sb.from('advisor_insights').select('period, data, collected_at').eq('client_id', clientId)
      .then(({ data: rows }) => {
        if (!active || !rows) return;
        const map: ByPeriod = {};
        for (const r of rows as { period: string; data: AdvisorPayload; collected_at: string | null }[]) {
          map[r.period] = { data: r.data ?? {}, collectedAt: r.collected_at ?? null };
        }
        setByPeriod(map);
        saveCache(clientId, map);
      });

    const loadJob = async () => {
      const { data: rows } = await sb.from('advisor_jobs').select('*')
        .eq('client_id', clientId).order('created_at', { ascending: false }).limit(1);
      if (active) setJob((rows?.[0] as AdvisorJob) ?? null);
    };
    void loadJob();

    const ch = sb.channel('advisor_' + clientId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisor_insights', filter: `client_id=eq.${clientId}` },
        payload => applyRow(payload.new as { period?: string; data?: AdvisorPayload; collected_at?: string | null }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisor_jobs', filter: `client_id=eq.${clientId}` },
        payload => { const r = payload.new as AdvisorJob | undefined; if (r?.id) setJob(r); })
      .subscribe();

    return () => { active = false; ch.unsubscribe(); };
  }, [clientId]);

  // 수집하기 — 그 기간 작업을 큐에 적재(같은 광고주+같은 기간 진행중이면 서버가 재사용)
  const collect = useCallback(async (period: AdvisorPeriod) => {
    if (!supabase || !user || !clientId) return;
    setBusy(true); setError('');
    try {
      const { error: e } = await supabase.rpc('enqueue_advisor_job', {
        p_client_id: clientId,
        p_client_name: clientName ?? '',
        p_period: period,
        p_requested_by: user.id,
        p_requested_by_name: user.name ?? '',
      });
      if (e) throw e;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [user, clientId, clientName]);

  return { byPeriod, job, collect, busy, error };
}

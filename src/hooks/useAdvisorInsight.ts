// 광고주(Client) 1곳의 크리에이터 어드바이저 인사이트 — 로드 + realtime + 수집 트리거.
//  - advisor_insights(스냅샷 1행)을 로컬 캐시로 즉시 그리고 Supabase/realtime 으로 갱신.
//  - advisor_jobs(이 광고주 작업)을 구독해 수집 진행/상태(need_login 등) 표시.
//  - 수집기는 service_role 로 patch_advisor_insight 되써넣음. 앱은 enqueue_advisor_job 트리거만.
//  계약: spike-rank/ADVISOR-CONTRACT.md / 마이그레이션 0034_advisor_jobs.sql
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

const cacheKey = (id: string) => `ilsangisang.advisorInsight.${id}.v1`;

interface Cached { data: AdvisorPayload; collectedAt: string | null; }
const loadCache = (id: string): Cached | null => {
  try { const raw = localStorage.getItem(cacheKey(id)); return raw ? JSON.parse(raw) as Cached : null; }
  catch { return null; }
};
const saveCache = (id: string, c: Cached) => {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(c)); } catch { /* 용량초과 시 무시(메모리로 동작) */ }
};

export function useAdvisorInsight(clientId: string | null, clientName?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<AdvisorPayload>({});
  const [collectedAt, setCollectedAt] = useState<string | null>(null);
  const [job, setJob] = useState<AdvisorJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 캐시로 즉시 렌더 + Supabase 응답으로 갱신 + realtime 구독
  useEffect(() => {
    setError('');
    if (!clientId) { setData({}); setCollectedAt(null); setJob(null); return; }
    const cached = loadCache(clientId);
    setData(cached?.data ?? {});
    setCollectedAt(cached?.collectedAt ?? null);
    if (!supabase) return;
    const sb = supabase;
    let active = true;

    const applyInsight = (row: { data?: AdvisorPayload; collected_at?: string | null } | undefined) => {
      if (!active || !row) return;
      const next = (row.data ?? {}) as AdvisorPayload;
      setData(next);
      setCollectedAt(row.collected_at ?? null);
      saveCache(clientId, { data: next, collectedAt: row.collected_at ?? null });
    };

    void sb.from('advisor_insights').select('data, collected_at').eq('client_id', clientId).maybeSingle()
      .then(({ data: row }) => applyInsight(row ?? undefined));

    // 이 광고주의 최근 작업 1건(진행/상태 표시)
    const loadJob = async () => {
      const { data: rows } = await sb.from('advisor_jobs').select('*')
        .eq('client_id', clientId).order('created_at', { ascending: false }).limit(1);
      if (active) setJob((rows?.[0] as AdvisorJob) ?? null);
    };
    void loadJob();

    const ch = sb.channel('advisor_' + clientId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisor_insights', filter: `client_id=eq.${clientId}` },
        payload => applyInsight(payload.new as { data?: AdvisorPayload; collected_at?: string | null }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisor_jobs', filter: `client_id=eq.${clientId}` },
        payload => { const r = payload.new as AdvisorJob | undefined; if (r?.id) setJob(r); })
      .subscribe();

    return () => { active = false; ch.unsubscribe(); };
  }, [clientId]);

  // 수집하기 버튼 → 작업 큐 적재(같은 광고주 진행중 작업 있으면 서버가 재사용)
  const collect = useCallback(async (period: '7d' | '30d' = '30d') => {
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

  const collecting = job?.status === 'queued' || job?.status === 'running';
  return { data, collectedAt, job, collecting, collect, busy, error };
}

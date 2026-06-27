// 광고주 상세 — 크리에이터 어드바이저 인사이트.
//  개요 탭엔 요약(조회수·방문자 숫자 + 미니 그래프) + '자세히 보기' → 펼침 모달에서 전체 표시.
//  데이터 묶음: viewsTrend(조회수·방문자 추이) / inflowKeywords(유입검색어 Top20) / demographics(성별·연령).
//  "수집하기" → enqueue_advisor_job, 진행/상태(need_login)는 realtime 으로 useAdvisorInsight 가 추적.
//  계약: spike-rank/ADVISOR-CONTRACT.md
import { useState, type ReactNode } from 'react';
import {
  Loader2, BarChart3, Search, TrendingUp, Users2, AlertCircle, KeyRound, RefreshCw,
  Copy, Check, X, Eye, Maximize2,
} from 'lucide-react';
import { useAdvisorInsight, type AdvisorPayload, type AdvisorPeriod, type TrendPoint } from '../hooks/useAdvisorInsight';

const PERIODS: { key: AdvisorPeriod; label: string }[] = [
  { key: '1d', label: '어제' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (r: number) => `${Math.round(r * 100)}%`;
const freshness = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 수집` : '아직 수집 안 됨';

const sumViews = (pts: TrendPoint[]) => pts.reduce((s, p) => s + (p.views || 0), 0);
const sumVisitors = (pts: TrendPoint[]) => pts.reduce((s, p) => s + (p.visitors || 0), 0);

// 조회수·방문자 2계열 미니 스파크라인(의존성 0, 인라인 SVG)
function Sparkline({ points, height = 90 }: { points: TrendPoint[]; height?: number }) {
  if (points.length < 2) return <p className="text-xs text-gray-400">데이터 포인트가 부족합니다.</p>;
  const W = 520, H = height, P = 4;
  const max = Math.max(1, ...points.map(p => Math.max(p.views, p.visitors)));
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (key: 'views' | 'visitors') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <path d={path('views')} fill="none" stroke="#3b82f6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={path('visitors')} fill="none" stroke="#a855f7" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Bar({ label, ratio, color }: { label: string; ratio: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-10 text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: pct(Math.max(0, Math.min(1, ratio))) }} />
      </div>
      <span className="w-9 text-right font-semibold text-gray-700 shrink-0">{pct(ratio)}</span>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 mb-0.5">{icon} {label}</div>
      <p className="text-base font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TrendLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] font-medium">
      <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> 조회수</span>
      <span className="flex items-center gap-1 text-purple-600"><span className="w-2 h-2 rounded-full bg-purple-500" /> 방문자</span>
    </div>
  );
}

const SectionEmpty = ({ msg }: { msg: string }) => (
  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-4 text-center">{msg}</p>
);

// 수집기에 붙여넣을 client_id 복사 배지 (수집기 세션 매핑용)
function ClientIdBadge({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(clientId); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* 클립보드 차단 환경: 무시 */ }
  };
  return (
    <button onClick={copy} title="수집기에 입력할 광고주 ID 복사"
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-600 hover:bg-gray-100 transition-colors">
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-gray-400" />}
      <span className="truncate max-w-[12rem]">ID: {clientId}</span>
    </button>
  );
}

// 전체 인사이트(모달 본문) — 모든 묶음을 풀로, 없는 묶음은 '아직 수집 안 됨' 안내
function FullInsight({ data, basis }: { data: AdvisorPayload; basis: string }) {
  const inflow = (data.inflowKeywords ?? []).slice(0, 20);
  const trend = data.viewsTrend?.points ?? [];
  const gender = data.demographics?.gender;
  const ages = data.demographics?.age ?? [];

  return (
    <div className="space-y-6">
      {/* 조회수·방문자 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><TrendingUp size={14} /> 조회수·방문자 추이{data.viewsTrend?.period ? ` (${data.viewsTrend.period})` : ''}</div>
          {trend.length > 0 && <TrendLegend />}
        </div>
        {trend.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Stat label="기간 조회수" value={fmt(sumViews(trend))} icon={<Eye size={12} />} />
              <Stat label="기간 방문자" value={fmt(sumVisitors(trend))} icon={<Users2 size={12} />} />
            </div>
            <Sparkline points={trend} height={140} />
          </>
        ) : <SectionEmpty msg="조회수 추이가 아직 수집되지 않았습니다." />}
      </section>

      {/* 유입 검색어 */}
      <section>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
          <Search size={14} /> 유입 검색어 {inflow.length > 0 ? `Top ${inflow.length}` : ''}
          <span className="font-normal text-[10px] text-gray-400">· {basis}</span>
        </div>
        {inflow.length > 0 ? (
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {inflow.map((k, i) => (
              <li key={k.keyword + i} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-[11px] font-bold text-gray-300 text-right shrink-0">{i + 1}</span>
                <span className="flex-1 text-gray-800 truncate">{k.keyword}</span>
                <span className="text-xs font-semibold text-gray-500 shrink-0">{fmt(k.count)}</span>
              </li>
            ))}
          </ol>
        ) : <SectionEmpty msg="유입 검색어가 아직 수집되지 않았습니다." />}
      </section>

      {/* 성별·연령 */}
      <section>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
          <Users2 size={14} /> 방문자 성별·연령
          <span className="font-normal text-[10px] text-gray-400">· {basis}</span>
        </div>
        {(gender || ages.length > 0) ? (
          <div className="space-y-1.5 max-w-md">
            {gender && (
              <>
                {typeof gender.male === 'number' && <Bar label="남성" ratio={gender.male} color="bg-blue-500" />}
                {typeof gender.female === 'number' && <Bar label="여성" ratio={gender.female} color="bg-pink-500" />}
                {ages.length > 0 && <div className="h-1" />}
              </>
            )}
            {ages.map(a => <Bar key={a.bucket} label={`${a.bucket}대`} ratio={a.ratio} color="bg-indigo-400" />)}
          </div>
        ) : <SectionEmpty msg="성별·연령은 아직 수집되지 않았습니다(글 조회수 5 미만이면 네이버가 제공하지 않음)." />}
      </section>
    </div>
  );
}

export default function AdvisorInsightCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { byPeriod, job, collect, busy, error } = useAdvisorInsight(clientId, clientName);
  const [period, setPeriod] = useState<AdvisorPeriod>('30d');
  const [open, setOpen] = useState(false);

  // 선택한 기간의 스냅샷만 표시(기간끼리 서로 안 덮음)
  const snap = byPeriod[period];
  const data = snap?.data ?? {};
  const collectedAt = snap?.collectedAt ?? null;
  // '수집 중'은 이 기간 작업일 때만(다른 기간 수집 중이어도 이 버튼은 멀쩡)
  const jobActive = job?.status === 'queued' || job?.status === 'running';
  const collecting = jobActive && (job?.period ?? '30d') === period;

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? '';
  // 유입검색어·성별/연령은 네이버가 일·주·월 집계로만 줌(수집기 안내): 1d=어제 / 7d=최근 주간 / 30d=이번 달 기준
  const aggBasis = period === '1d' ? '어제 기준' : period === '7d' ? '최근 주간 기준' : '이번 달 기준';
  const inflow = data.inflowKeywords ?? [];
  const trend = data.viewsTrend?.points ?? [];
  const hasAny = inflow.length > 0 || trend.length > 0 || !!data.demographics?.gender || (data.demographics?.age?.length ?? 0) > 0;

  // 종료 상태(need_login/empty/error)는 그 작업의 기간이 지금 보는 기간과 같을 때만 표시(혼동 방지)
  const jobMatchesPeriod = (job?.period ?? '30d') === period;
  const statusMsg =
    collecting ? (job?.status === 'queued' ? '대기 중 · 수집기 응답 대기' : `수집 중${job && job.total > 0 ? ` ${job.done}/${job.total}` : ''}`)
    : !jobMatchesPeriod ? ''
    : job?.status === 'need_login' ? '수집기에서 이 광고주 네이버 로그인이 필요합니다'
    : job?.status === 'empty' ? '수집할 광고주를 찾지 못했습니다'
    : job?.status === 'error' ? `오류: ${job.error ?? '알 수 없음'}`
    : '';
  const statusTone = job?.status === 'need_login' ? 'text-amber-600' : job?.status === 'error' ? 'text-red-600' : 'text-blue-600';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <BarChart3 size={16} className="text-blue-600 shrink-0" />
          <h3 className="text-sm font-bold text-gray-900">어드바이저 인사이트</h3>
          <span className="text-[11px] text-gray-400">· {freshness(collectedAt)}</span>
          <ClientIdBadge clientId={clientId} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold">
            {PERIODS.map(p => {
              const has = !!byPeriod[p.key]?.collectedAt;
              return (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  title={has ? '' : '이 기간은 아직 수집 안 됨'}
                  className={`px-2.5 py-1.5 ${period === p.key ? 'bg-blue-600 text-white' : `${has ? 'text-gray-600' : 'text-gray-300'} hover:bg-gray-50`}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => collect(period)} disabled={busy || collecting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
            {busy || collecting ? <Loader2 size={13} className="animate-spin" /> : collectedAt ? <RefreshCw size={13} /> : <BarChart3 size={13} />}
            {collecting ? '수집 중' : collectedAt ? '다시 수집' : '수집하기'}
          </button>
        </div>
      </div>

      {/* 상태 줄 */}
      {statusMsg && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${statusTone}`}>
          {collecting ? <Loader2 size={13} className="animate-spin" />
            : job?.status === 'need_login' ? <KeyRound size={13} />
            : <AlertCircle size={13} />}
          {statusMsg}
        </div>
      )}

      {!hasAny && !statusMsg && (
        <p className="text-xs text-gray-400 py-4 text-center">
          ‘{periodLabel}’ 기간은 아직 수집된 인사이트가 없습니다. ‘수집하기’를 누르면 이 기간 데이터를 가져옵니다.
        </p>
      )}

      {/* 요약(개요 탭) — 조회수·방문자 숫자 + 미니 그래프 + 자세히 보기 */}
      {hasAny && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="기간 조회수" value={trend.length ? fmt(sumViews(trend)) : '-'} icon={<Eye size={12} />} />
            <Stat label="기간 방문자" value={trend.length ? fmt(sumVisitors(trend)) : '-'} icon={<Users2 size={12} />} />
            <Stat label="유입 검색어" value={inflow.length ? `${inflow.length}개` : '-'} icon={<Search size={12} />} />
          </div>
          {trend.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-gray-400">조회수·방문자 추이</span>
                <TrendLegend />
              </div>
              <Sparkline points={trend} height={70} />
            </div>
          )}
          <button onClick={() => setOpen(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <Maximize2 size={13} /> 자세히 보기 (유입검색어·성별·연령 전체)
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">요청 실패: {error}</p>}

      {/* 펼침 모달 — 전체 인사이트 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 size={16} className="text-blue-600 shrink-0" />
                <h2 className="text-base font-bold text-gray-900 truncate">{clientName} · 어드바이저 인사이트</h2>
                <span className="text-[11px] text-gray-400 shrink-0">· {freshness(collectedAt)}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <FullInsight data={data} basis={aggBasis} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

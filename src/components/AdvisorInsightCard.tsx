// 광고주 상세 — 크리에이터 어드바이저 인사이트 카드.
//  유입검색어 Top20 + 조회수·방문자 트렌드(미니 스파크라인) + 성별·연령.
//  "수집하기" 버튼 → enqueue_advisor_job, 진행/상태(need_login)는 realtime 으로 useAdvisorInsight 가 추적.
//  계약: spike-rank/ADVISOR-CONTRACT.md
import { useState } from 'react';
import { Loader2, BarChart3, Search, TrendingUp, Users2, AlertCircle, KeyRound, RefreshCw, Copy, Check } from 'lucide-react';
import { useAdvisorInsight, type TrendPoint } from '../hooks/useAdvisorInsight';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const pct = (r: number) => `${Math.round(r * 100)}%`;
const freshness = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 수집` : '아직 수집 안 됨';

// 조회수·방문자 2계열 미니 스파크라인(의존성 0, 인라인 SVG)
function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return <p className="text-xs text-gray-400">데이터 포인트가 부족합니다.</p>;
  const W = 520, H = 90, P = 4;
  const max = Math.max(1, ...points.map(p => Math.max(p.views, p.visitors)));
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (key: 'views' | 'visitors') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]" preserveAspectRatio="none">
      <path d={path('views')} fill="none" stroke="#3b82f6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={path('visitors')} fill="none" stroke="#a855f7" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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

export default function AdvisorInsightCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data, collectedAt, job, collecting, collect, busy, error } = useAdvisorInsight(clientId, clientName);
  const [period, setPeriod] = useState<'7d' | '30d'>('30d');

  const inflow = (data.inflowKeywords ?? []).slice(0, 20);
  const trend = data.viewsTrend?.points ?? [];
  const gender = data.demographics?.gender;
  const ages = data.demographics?.age ?? [];
  const hasAny = inflow.length > 0 || trend.length > 0 || !!gender || ages.length > 0;

  const statusMsg =
    collecting ? (job?.status === 'queued' ? '대기 중 · 수집기 응답 대기' : `수집 중${job && job.total > 0 ? ` ${job.done}/${job.total}` : ''}`)
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
            {(['7d', '30d'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} disabled={collecting}
                className={`px-2.5 py-1.5 ${period === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {p === '7d' ? '7일' : '30일'}
              </button>
            ))}
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
          아직 수집된 인사이트가 없습니다. ‘수집하기’를 누르면 수집기가 광고주 어드바이저 데이터를 가져옵니다.
        </p>
      )}

      {hasAny && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* 유입 검색어 Top20 */}
          {inflow.length > 0 && (
            <div className="lg:row-span-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2"><Search size={13} /> 유입 검색어 Top {inflow.length}</div>
              <ol className="space-y-1">
                {inflow.map((k, i) => (
                  <li key={k.keyword + i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-[11px] font-bold text-gray-300 text-right shrink-0">{i + 1}</span>
                    <span className="flex-1 text-gray-800 truncate">{k.keyword}</span>
                    <span className="text-xs font-semibold text-gray-500 shrink-0">{fmt(k.count)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 조회수·방문자 트렌드 */}
          {trend.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400"><TrendingUp size={13} /> 조회수·방문자 추이</div>
                <div className="flex items-center gap-3 text-[10px] font-medium">
                  <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> 조회수</span>
                  <span className="flex items-center gap-1 text-purple-600"><span className="w-2 h-2 rounded-full bg-purple-500" /> 방문자</span>
                </div>
              </div>
              <Sparkline points={trend} />
            </div>
          )}

          {/* 성별·연령 */}
          {(gender || ages.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2"><Users2 size={13} /> 방문자 성별·연령</div>
              <div className="space-y-1.5">
                {gender && (
                  <>
                    {typeof gender.male === 'number' && <Bar label="남성" ratio={gender.male} color="bg-blue-500" />}
                    {typeof gender.female === 'number' && <Bar label="여성" ratio={gender.female} color="bg-pink-500" />}
                    {ages.length > 0 && <div className="h-1" />}
                  </>
                )}
                {ages.map(a => <Bar key={a.bucket} label={`${a.bucket}대`} ratio={a.ratio} color="bg-indigo-400" />)}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">요청 실패: {error}</p>}
    </div>
  );
}

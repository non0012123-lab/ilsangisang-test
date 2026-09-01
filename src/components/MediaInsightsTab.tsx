// 클라이언트 포털 '매체 인사이트' 탭 — 수집기가 가져온 매체 인사이트를 "데이터가 있는 매체만" 표시.
//  • Phase 1: 네이버 블로그(어드바이저 인사이트 — 조회수·방문자·유입검색어·성별/연령).
//  • 읽기전용: 수집(enqueue)은 담당자(내부)가 트리거하고, 클라이언트는 본인 스냅샷만 열람(RLS 0040).
//  • 이후 인스타/유튜브가 붙으면 각 매체 섹션을 같은 방식(데이터 있을 때만)으로 추가한다.
import { useState } from 'react';
import { BarChart3, Eye } from 'lucide-react';
import { useAdvisorInsight, type AdvisorPeriod, type AdvisorPayload } from '../hooks/useAdvisorInsight';
import { FullInsight } from './AdvisorInsightCard';

// 데모(쇼케이스) 주입용 — 넘기면 DB 조회 없이 이 스냅샷을 그대로 보여준다.
type Snapshots = Partial<Record<AdvisorPeriod, { data: AdvisorPayload; collectedAt: string }>>;

const PERIODS: { key: AdvisorPeriod; label: string }[] = [
  { key: '1d', label: '어제' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];
const freshness = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 수집` : '';

export default function MediaInsightsTab({ clientId, clientName, snapshots }: { clientId: string; clientName: string; snapshots?: Snapshots }) {
  // snapshots 가 오면(데모) clientId 를 null 로 넘겨 조회·realtime 구독을 아예 걸지 않는다.
  const { byPeriod: live } = useAdvisorInsight(snapshots ? null : clientId, clientName);
  const byPeriod = snapshots ?? live;
  const [period, setPeriod] = useState<AdvisorPeriod>('30d');

  // 데이터(수집됨)가 있는 기간만 활성. 선택 기간에 데이터가 없으면 있는 기간 중 가장 긴 것으로 대체.
  const avail = PERIODS.filter(p => !!byPeriod[p.key]?.collectedAt);
  const hasNaver = avail.length > 0;
  const effPeriod: AdvisorPeriod = byPeriod[period]?.collectedAt ? period : (avail[avail.length - 1]?.key ?? period);
  const snap = byPeriod[effPeriod];
  const data = snap?.data ?? {};
  const basis = effPeriod === '1d' ? '어제 기준' : effPeriod === '7d' ? '최근 주간 기준' : '이번 달 기준';

  if (!hasNaver) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <BarChart3 size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">아직 수집된 매체 인사이트가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">인사이트를 수집한 매체가 생기면 이곳에 매체별로 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 네이버 블로그 매체 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center text-green-700 shrink-0"><Eye size={14} /></span>
            <h3 className="font-bold text-gray-900 text-sm">네이버 블로그 인사이트</h3>
            {snap?.collectedAt && <span className="text-[11px] text-gray-400">· {freshness(snap.collectedAt)}</span>}
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold">
            {PERIODS.map(p => {
              const has = !!byPeriod[p.key]?.collectedAt;
              return (
                <button key={p.key} onClick={() => has && setPeriod(p.key)} disabled={!has}
                  title={has ? '' : '이 기간은 아직 수집되지 않았습니다'}
                  className={`px-2.5 py-1.5 ${effPeriod === p.key ? 'bg-blue-600 text-white' : has ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-5">
          <FullInsight data={data} basis={basis} />
        </div>
      </div>
    </div>
  );
}

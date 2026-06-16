// 마케팅 현황 시각화 — 외부 차트 라이브러리 없이 인라인 SVG 로 그린다(기존 달력과 동일 기조).
// 입력: 선택 기간의 업무 목록(rangeEntries). 내부 시스템에서 순위/조회수를 입력하면
//       같은 데이터가 다시 계산되어 그래프가 자동으로 움직인다.
import { useMemo } from 'react';
import type { ScheduleEntry } from '../types';

// 채널(카테고리) 색상 — ClientPortalPage 의 범례(CAT_COLOR)와 동일 팔레트
const CHANNEL_COLORS: Record<string, string> = {
  'SNS': '#ec4899', '유튜브': '#ef4444', '네이버': '#22c55e',
  '영상제작': '#a855f7', '디자인제작': '#f97316', '네이버 여론작업': '#0ea5e9', '기타': '#6b7280',
};
const colorOf = (c: string) => CHANNEL_COLORS[c] ?? '#6b7280';

// 업무에서 PV(조회수) 추출 — views 우선, 없으면 블로그/카페 조회 합산
function pvOf(e: ScheduleEntry): number {
  const m = e.metrics;
  if (!m) return 0;
  return m.views ?? ((m.blogViews ?? 0) + (m.cafeViews ?? 0));
}

const nf = (n: number) => n.toLocaleString();

// ── 도넛: 채널별 비중 ──
function Donut({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 60, SW = 22, C = 2 * Math.PI * R, CX = 80, CY = 80;
  let acc = 0;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {total === 0 ? (
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
        ) : data.map(d => {
          const frac = d.value / total;
          const dash = frac * C;
          const seg = (
            <circle key={d.label} cx={CX} cy={CY} r={R} fill="none"
              stroke={colorOf(d.label)} strokeWidth={SW}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc * C}
              transform={`rotate(-90 ${CX} ${CY})`} />
          );
          acc += frac;
          return seg;
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" className="fill-gray-900" style={{ fontSize: 22, fontWeight: 700 }}>{nf(total)}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 11 }}>{unit}</text>
      </svg>
      <div className="space-y-1.5 min-w-[120px]">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorOf(d.label) }} />
            <span className="text-gray-600 flex-1 truncate">{d.label}</span>
            <span className="font-semibold text-gray-900">{nf(d.value)}</span>
            <span className="text-gray-400 w-9 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 가로 막대: 키워드별 현재 순위(낮을수록 좋음) ──
function RankBars({ items }: { items: { label: string; rank: number; channel: string }[] }) {
  if (items.length === 0) return <Empty msg="순위가 입력된 작업이 없습니다." />;
  const worst = Math.max(...items.map(i => i.rank), 10);
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const pct = Math.max(8, ((worst - it.rank + 1) / worst) * 100); // 순위 높을수록(1위) 막대 길게
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-28 truncate" title={it.label}>{it.label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
              <div className="h-full rounded-md flex items-center justify-end pr-2" style={{ width: `${pct}%`, backgroundColor: colorOf(it.channel) }}>
                <span className="text-[10px] font-bold text-white">{it.rank}위</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 세로 막대: 채널별 PV 합계 ──
function PvBars({ data }: { data: { label: string; value: number }[] }) {
  const filtered = data.filter(d => d.value > 0);
  if (filtered.length === 0) return <Empty msg="조회수(PV) 데이터가 없습니다." />;
  const max = Math.max(...filtered.map(d => d.value));
  return (
    <div className="flex items-end justify-around gap-2 h-40 pt-4">
      {filtered.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
          <span className="text-[10px] font-semibold text-gray-700">{nf(d.value)}</span>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: colorOf(d.label), minHeight: 4 }} />
          <span className="text-[10px] text-gray-500 truncate w-full text-center" title={d.label}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-32 text-xs text-gray-400">{msg}</div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h4 className="text-sm font-bold text-gray-900 mb-4">{title}</h4>
      {children}
    </div>
  );
}

export default function MarketingCharts({ entries }: { entries: ScheduleEntry[] }) {
  const charts = useMemo(() => {
    // 채널별 건수
    const countByCh: Record<string, number> = {};
    const pvByCh: Record<string, number> = {};
    entries.forEach(e => {
      countByCh[e.category] = (countByCh[e.category] ?? 0) + 1;
      const pv = pvOf(e);
      if (pv > 0) pvByCh[e.category] = (pvByCh[e.category] ?? 0) + pv;
    });
    const channelCount = Object.entries(countByCh).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const channelPv = Object.entries(pvByCh).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    // 순위 — rank 있는 것만, 좋은 순위(작은 값) 상위 8
    const rankItems = entries
      .filter(e => e.rank != null)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .slice(0, 8)
      .map(e => ({ label: e.keyword ?? e.category, rank: e.rank as number, channel: e.category }));

    const totalPv = entries.reduce((s, e) => s + pvOf(e), 0);
    return { channelCount, channelPv, rankItems, totalPv };
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="채널별 작업 비중">
          <Donut data={charts.channelCount} unit="건" />
        </Card>
        <Card title={`채널별 조회수(PV) · 총 ${nf(charts.totalPv)}`}>
          <PvBars data={charts.channelPv} />
        </Card>
      </div>

      <Card title="키워드 순위 현황 (상위 8)">
        <RankBars items={charts.rankItems} />
      </Card>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Download, FileText, TrendingUp, CheckCircle2, Clock, Calendar, LogOut, BarChart3, ExternalLink, MessageSquare, CalendarRange, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { duePeriods, reportIdFor, aggregateForPeriod, periodLabel, fallbackSummary, fallbackHighlights } from '../utils/monthlyReports';
import CategoryBadge from '../components/CategoryBadge';
import ImageGallery from '../components/ImageGallery';
import KeywordTool from '../components/KeywordTool';
import MarketingCharts from '../components/MarketingCharts';
import DemoInsight from '../components/DemoInsight';
import { DEMO_CLIENT_ID, DEMO_CLIENT, DEMO_ENTRIES, DEMO_REPORTS } from '../data/demoData';
import { downloadReportPdf } from '../utils/reportPdf';
import { enumerateDays, isMultiDay, overlapsRange, coversDate, entryEnd, fmtLocal } from '../utils/dateRange';
import { todayStr } from '../utils/today';
import type { ScheduleEntry } from '../types';
import { CATEGORIES, catHex } from '../data/categories';

type Tab = 'dashboard' | 'timetable' | 'reports' | 'keywords';

const CAT_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c, catHex(c)]));
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getCalDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const cnt = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let i = 1; i <= cnt; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function ClientCalendar({ entries, hiddenCategories = [] }: { entries: ScheduleEntry[]; hiddenCategories?: string[] }) {
  const [curDate, setCurDate] = useState(new Date());
  const [selDay, setSelDay] = useState<number | null>(null);

  const year = curDate.getFullYear();
  const month = curDate.getMonth();
  const calDays = getCalDays(year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const mStart = `${prefix}-01`;
  const mEnd = `${prefix}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
  const monthEntries = entries.filter(e => overlapsRange(e, mStart, mEnd));

  const byDay: Record<number, ScheduleEntry[]> = {};
  monthEntries.forEach(e => {
    enumerateDays(e, prefix).forEach(ds => {
      const d = parseInt(ds.split('-')[2]);
      (byDay[d] ??= []).push(e);
    });
  });

  // 주(7칸) 단위 분할 + 기간 작업을 한 줄 막대로 배치
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));

  const placeWeek = (week: (number | null)[]) => {
    const colDate = week.map(d => (d ? padDate(year, month, d) : null));
    const items = monthEntries
      .map(e => {
        let startCol = -1, endCol = -1;
        for (let c = 0; c < 7; c++) {
          const ds = colDate[c];
          if (ds && coversDate(e, ds)) { if (startCol === -1) startCol = c; endCol = c; }
        }
        return startCol === -1 ? null : { entry: e, startCol, endCol, span: endCol - startCol + 1, colDate };
      })
      .filter(Boolean) as { entry: ScheduleEntry; startCol: number; endCol: number; span: number; colDate: (string | null)[] }[];
    items.sort((a, b) => b.span - a.span || a.startCol - b.startCol);
    const laneEnds: number[] = [];
    return items.map(it => {
      let lane = laneEnds.findIndex(end => end < it.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endCol); }
      else laneEnds[lane] = it.endCol;
      return { ...it, lane };
    });
  };

  const MAX_LANES = 3, BAR_H = 16, BAR_GAP = 2, NUM_AREA = 26;

  const today = new Date();
  const todayDay = (year === today.getFullYear() && month === today.getMonth()) ? today.getDate() : -1;
  const selEntries = selDay ? (byDay[selDay] ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
          <span className="text-base font-bold text-gray-900 min-w-[110px] text-center">{year}년 {month + 1}월</span>
          <button onClick={() => setCurDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
        </div>
        <span className="text-sm text-gray-400">총 {monthEntries.length}건</span>
      </div>

      {/* 달력 그리드 — 데스크톱(md+) 전용. 모바일은 아래 어젠다 리스트로 대체(가로 스크롤 제거). */}
      <div className="hidden md:flex flex-col lg:flex-row gap-4">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl overflow-x-auto">
          <div className="grid grid-cols-7 border-b border-gray-200 min-w-[640px]">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2.5 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          <div>
            {weeks.map((week, wi) => {
              const placed = placeWeek(week);
              const shown = placed.filter(p => p.lane < MAX_LANES);
              const usedLanes = Math.min(MAX_LANES, placed.reduce((m, p) => Math.max(m, p.lane + 1), 0));
              const weekMinH = Math.max(NUM_AREA + usedLanes * (BAR_H + BAR_GAP) + 8, 72);
              return (
                <div key={wi} className="relative grid grid-cols-7 border-b border-gray-200 last:border-b-0 min-w-[640px]" style={{ minHeight: weekMinH }}>
                  {/* 날짜 셀 */}
                  {week.map((day, ci) => {
                    const isToday = day === todayDay;
                    const isSel = day === selDay;
                    const isSun = ci === 0;
                    const isSat = ci === 6;
                    const total = day ? placed.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                    const over = day ? total - shown.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                    return (
                      <div key={ci}
                        onClick={() => day && setSelDay(day === selDay ? null : day)}
                        className={`relative border-r border-gray-100 last:border-r-0 transition-colors ${
                          !day ? 'bg-gray-50/50' : isSel ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'bg-white hover:bg-slate-50 cursor-pointer'
                        }`}>
                        {day && (
                          <span className={`m-1.5 w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                            isToday ? 'bg-blue-600 text-white' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'
                          }`}>{day}</span>
                        )}
                        {over > 0 && <div className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-gray-400">+{over}</div>}
                      </div>
                    );
                  })}
                  {/* 작업 막대 오버레이 */}
                  <div className="absolute inset-0 pointer-events-none">
                    {shown.map(p => {
                      const e = p.entry;
                      const contPrev = e.date < (p.colDate[p.startCol] ?? '');
                      const contNext = entryEnd(e) > (p.colDate[p.endCol] ?? '');
                      const padL = contPrev ? 0 : 2, padR = contNext ? 0 : 2;
                      return (
                        <div key={e.id + '-' + wi}
                          title={`${e.opinionTitle ?? e.keyword ?? e.category}${isMultiDay(e) ? ` (${e.date}~${e.endDate})` : ''}`}
                          className={`absolute flex items-center gap-0.5 px-1 text-white text-[10px] font-medium leading-none overflow-hidden ${contPrev ? '' : 'rounded-l'} ${contNext ? '' : 'rounded-r'}`}
                          style={{
                            left: `calc(${p.startCol} * 100% / 7 + ${padL}px)`,
                            width: `calc(${p.span} * 100% / 7 - ${padL + padR}px)`,
                            top: NUM_AREA + p.lane * (BAR_H + BAR_GAP),
                            height: BAR_H,
                            backgroundColor: CAT_COLOR[e.category] ?? '#6b7280',
                          }}>
                          {contPrev ? <span className="shrink-0 opacity-80">↩</span> : isMultiDay(e) && <CalendarRange size={8} className="shrink-0" />}
                          <span className="truncate">{e.opinionTitle ?? e.keyword ?? e.category}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        {selDay && (
          <div className="w-full lg:w-56 bg-white border border-gray-100 rounded-2xl p-3 space-y-2">
            <p className="font-bold text-gray-900 text-sm">{month + 1}월 {selDay}일</p>
            {selEntries.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">일정 없음</p>
            ) : (
              selEntries.map(e => (
                <div key={e.id} className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: CAT_COLOR[e.category] ?? '#6b7280' }}>{e.category}</span>
                  <p className="text-xs font-semibold text-gray-900 mt-1.5 truncate">{e.opinionTitle ?? e.keyword ?? '-'}</p>
                  <p className="text-xs text-gray-400">{e.managerName}</p>
                  {isMultiDay(e) && <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5"><CalendarRange size={10} />{e.date}~{e.endDate}</p>}
                  {e.link && (
                    <a href={e.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                      <ExternalLink size={10} className="shrink-0" /><span className="truncate">바로가기</span>
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 모바일 어젠다 — 날짜별 일정 목록(달력 가로 스크롤 대체). 일정 있는 날만 표시. */}
      <div className="md:hidden space-y-3">
        {Object.keys(byDay).length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8 bg-gray-50 rounded-2xl">이번 달 일정이 없습니다.</p>
        ) : (
          Object.keys(byDay).map(Number).sort((a, b) => a - b).map(d => {
            const wd = WEEKDAYS[new Date(year, month, d).getDay()];
            const isToday = d === todayDay;
            return (
              <div key={d} className="bg-white border border-gray-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{d}</span>
                  <span className="text-sm font-semibold text-gray-700">{month + 1}월 {d}일 ({wd})</span>
                  <span className="ml-auto text-xs text-gray-400">{byDay[d].length}건</span>
                </div>
                <div className="space-y-2">
                  {byDay[d].map(e => (
                    <div key={e.id} className="p-2.5 bg-gray-50 rounded-xl">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: CAT_COLOR[e.category] ?? '#6b7280' }}>{e.category}</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1.5 break-keep">{e.opinionTitle ?? e.keyword ?? '-'}</p>
                      <p className="text-xs text-gray-400">{e.managerName}</p>
                      {isMultiDay(e) && <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5"><CalendarRange size={10} />{e.date}~{e.endDate}</p>}
                      {e.link && (
                        <a href={e.link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                          <ExternalLink size={10} className="shrink-0" /><span className="truncate">바로가기</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(CAT_COLOR).filter(([cat]) => !hiddenCategories.includes(cat)).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} /> {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const { user, logout } = useAuth();
  const { entries: allEntries, clients, reports: allReports, saveReport } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');

  const clientId = user?.clientId ?? '';
  // 데모(쇼케이스) 계정 — Supabase 공유 데이터 대신 코드 내장 정적 데이터를 주입한다.
  // DB 에 아무것도 쓰지 않으므로 내부 시스템(관리/대시보드/보고서)에 절대 노출되지 않는다.
  const isDemo = clientId === DEMO_CLIENT_ID;
  const client = isDemo ? DEMO_CLIENT : clients.find(c => c.id === clientId);
  const entries = isDemo ? DEMO_ENTRIES : allEntries.filter(e => e.clientId === clientId);
  const TODAY = todayStr();

  // 전송일이 지난 월간 보고서를 자동 생성(+AI 요약, 1회 후 저장)하고, 클라이언트에게 노출
  const clientReports = isDemo
    ? DEMO_REPORTS
    : allReports
        .filter(r => r.clientId === clientId && (r.releaseDate ?? r.date) <= TODAY)
        .sort((a, b) => (b.periodEnd ?? b.date).localeCompare(a.periodEnd ?? a.date));
  const genRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!client || isDemo) return; // 데모는 DB 저장(saveReport)을 하지 않는다
    duePeriods(client, TODAY).forEach(p => {
      const id = reportIdFor(client.id, p.start);
      if (allReports.some(r => r.id === id) || genRef.current.has(id)) return;
      genRef.current.add(id);
      (async () => {
        const agg = aggregateForPeriod(allEntries, client.id, p.start, p.end);
        const label = periodLabel(p.start, p.end);
        let summary = '', highlights: string[] = [], aiGenerated = false;
        try {
          const res = await fetch('/api/ai-monthly-summary', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName: client.name, industry: client.industry, period: label,
              total: agg.total, completed: agg.completed, totalViews: agg.totalViews, totalLikes: agg.totalLikes, totalSaves: agg.totalSaves,
              byCategory: agg.byCategory,
              entries: agg.entries.map(e => ({ date: e.date, category: e.category, title: e.opinionTitle ?? e.keyword ?? '', status: e.status, rank: e.rank, views: e.metrics?.views })),
            }),
          });
          if ((res.headers.get('content-type') ?? '').includes('application/json')) {
            const data = await res.json();
            if (res.ok && !data.error && data.summary) {
              summary = data.summary;
              highlights = Array.isArray(data.highlights) ? data.highlights : [];
              aiGenerated = true;
            }
          }
        } catch { /* AI 실패 → 규칙기반 폴백 */ }
        if (!summary) { summary = fallbackSummary(label, agg); highlights = fallbackHighlights(agg); }
        saveReport({
          id, clientId: client.id, clientName: client.name,
          title: `${client.name} ${label} 보고서`, date: p.releaseDate, period: label, type: 'monthly',
          summary, highlights, periodStart: p.start, periodEnd: p.end, releaseDate: p.releaseDate,
          aiGenerated, createdAt: Date.now(),
        });
      })();
    });
  }, [client, isDemo, allReports, allEntries, TODAY, saveReport]);

  // 마케팅 현황 기간 — 기본은 '당일'(오늘 작업 기준), 지난 7일/30일/기간 지정으로 전환 가능
  const [preset, setPreset] = useState<'day' | '7d' | '30d' | 'custom'>('day');
  const [customFrom, setCustomFrom] = useState(TODAY);
  const [customTo, setCustomTo] = useState(TODAY);

  const range = (() => {
    const back = (n: number) => { const d = new Date(TODAY + 'T00:00:00'); d.setDate(d.getDate() - n); return fmtLocal(d); };
    if (preset === '7d') return { from: back(6), to: TODAY };   // 오늘 포함 지난 7일
    if (preset === '30d') return { from: back(29), to: TODAY }; // 오늘 포함 지난 30일
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return { from: TODAY, to: TODAY };
  })();
  const rangeLabel = preset === 'day' ? '오늘' : preset === '7d' ? '지난 7일' : preset === '30d' ? '지난 30일' : `${range.from} ~ ${range.to}`;

  // 선택 기간에 걸치는(기간 작업 포함) 작업
  const rangeEntries = entries.filter(e => overlapsRange(e, range.from, range.to));
  const completed = rangeEntries.filter(e => e.status === 'completed').length;
  const inProgress = rangeEntries.filter(e => e.status === 'in-progress').length;
  const pending = rangeEntries.filter(e => e.status === 'pending').length;

  const recentEntries = rangeEntries
    .filter(e => e.category !== '네이버 여론작업')
    .sort((a, b) => b.date.localeCompare(a.date));

  const opinionEntries = rangeEntries
    .filter(e => e.category === '네이버 여론작업')
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">클라이언트 정보를 찾을 수 없습니다.</p>
          <button onClick={logout} className="mt-4 text-blue-600 hover:underline text-sm">로그아웃</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-clip">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">일상이상커뮤니케이션</span>
              <span className="text-gray-300 mx-2">|</span>
              <span className="text-gray-600 text-sm">{client.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:block">{user?.name} 님</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">안녕하세요, {client.name} 님 👋</h1>
              <p className="text-blue-200 text-sm">{parseInt(TODAY.slice(5, 7), 10)}월 마케팅 현황을 확인하세요</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs">계약 기간</p>
              <p className="text-white font-medium text-sm">{client.startDate} ~ {client.contractEnd ?? '계속'}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            {client.categories.map(c => (
              <span key={c} className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white">{c}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 gap-1">
          {([
            { key: 'dashboard', icon: <TrendingUp size={15} />, label: '마케팅 현황' },
            { key: 'timetable', icon: <CalendarRange size={15} />, label: '타임테이블' },
            { key: 'reports', icon: <FileText size={15} />, label: '보고서' },
            { key: 'keywords', icon: <Search size={15} />, label: '키워드 조회' },
          ] as { key: Tab; icon: React.ReactNode; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}>
              <span className="shrink-0">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Dashboard */}
        {tab === 'dashboard' && (
          <>
            {/* 기간 선택 — 기본 당일(오늘 작업 기준) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 mr-1">기간</span>
              {([['day', '당일'], ['7d', '지난 7일'], ['30d', '지난 30일'], ['custom', '기간 지정']] as [typeof preset, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setPreset(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{label}</button>
              ))}
              {preset === 'custom' && (
                <div className="flex items-center gap-1.5 ml-1">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-gray-400 text-xs">~</span>
                  <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <span className="ml-auto text-xs text-gray-400">{rangeLabel} · {rangeEntries.length}건</span>
            </div>

            {/* AI 인사이트 — 데모 한정. 전문 마케터 브리핑 톤 요약 */}
            {isDemo && <DemoInsight entries={rangeEntries} rangeLabel={rangeLabel} />}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '완료', value: completed, icon: <CheckCircle2 size={18} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                { label: '진행중', value: inProgress, icon: <Clock size={18} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: '예정', value: pending, icon: <Calendar size={18} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
              ].map(s => (
                <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-5`}>
                  <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>{s.icon}</div>
                  <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{rangeLabel} {s.label}</p>
                </div>
              ))}
            </div>

            {/* 통계 시각화 — 채널·순위·PV. 내부 시스템 입력이 그대로 반영된다 */}
            <MarketingCharts entries={rangeEntries} />

            {/* Recent Tasks */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">{rangeLabel} 마케팅 현황</h3>
                <TrendingUp size={16} className="text-gray-400" />
              </div>
              {/* 데스크톱: 표 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['날짜', '카테고리', '키워드', '링크', '순위', '상태'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentEntries.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">작업 내역이 없습니다.</td></tr>
                    ) : (
                      recentEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{entry.date}</td>
                          <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                          <td className="px-4 py-3 text-gray-800 max-w-[100px]">
                            <span className="truncate block text-xs" title={entry.keyword}>{entry.keyword}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            {entry.link ? (
                              <div className="flex items-center gap-1">
                                <a href={entry.link} target="_blank" rel="noopener noreferrer"
                                  className="table-link link-cell text-xs" title={entry.link}>{entry.link}</a>
                                <a href={entry.link} target="_blank" rel="noopener noreferrer"
                                  className="shrink-0 p-0.5 text-gray-300 hover:text-blue-500"><ExternalLink size={11} /></a>
                              </div>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.rank ? <span className="text-blue-700 font-bold text-xs">{entry.rank}위</span> : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              entry.status === 'completed' ? 'bg-green-50 text-green-700' :
                              entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {entry.status === 'completed' ? '완료' : entry.status === 'in-progress' ? '진행중' : '대기중'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 모바일: 카드(가로 스크롤 없이 한 눈에) */}
              <div className="md:hidden divide-y divide-gray-50">
                {recentEntries.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">작업 내역이 없습니다.</p>
                ) : recentEntries.map(entry => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryBadge category={entry.category} />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{entry.date}</span>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        entry.status === 'completed' ? 'bg-green-50 text-green-700' :
                        entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {entry.status === 'completed' ? '완료' : entry.status === 'in-progress' ? '진행중' : '대기중'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 break-keep">
                      {entry.keyword || '-'}
                      {entry.rank ? <span className="ml-1.5 text-blue-700 font-bold text-xs">{entry.rank}위</span> : null}
                    </p>
                    {entry.link && (
                      <a href={entry.link} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline max-w-full">
                        <ExternalLink size={11} className="shrink-0" /><span className="truncate">{entry.link}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Opinion */}
            {opinionEntries.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                  <MessageSquare size={16} className="text-sky-600" />
                  <h3 className="font-bold text-gray-900">네이버 여론작업 현황</h3>
                  <span className="ml-auto text-xs text-gray-400">{opinionEntries.length}건</span>
                </div>
                <div className="p-4 space-y-3">
                  {opinionEntries.map(entry => (
                    <div key={entry.id} className="border border-sky-100 rounded-xl p-4 bg-sky-50/50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{entry.opinionTitle}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{entry.date} · {entry.managerName}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          entry.status === 'completed' ? 'bg-green-50 text-green-700' :
                          entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {entry.status === 'completed' ? '완료' : entry.status === 'in-progress' ? '진행중' : '대기중'}
                        </span>
                      </div>
                      {entry.opinionContent && <p className="text-sm text-gray-700 leading-relaxed mb-2">{entry.opinionContent}</p>}
                      {entry.opinionComments && (
                        <div className="bg-white rounded-lg px-3 py-2 border border-sky-100">
                          <p className="text-xs font-semibold text-gray-500 mb-1">주요 반응</p>
                          <p className="text-xs text-gray-600 italic">"{entry.opinionComments}"</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {entry.metrics?.views && <span className="text-xs text-gray-500">👁 {entry.metrics.views.toLocaleString()} 조회</span>}
                        {entry.metrics?.comments && <span className="text-xs text-gray-500">💬 {entry.metrics.comments.toLocaleString()} 댓글</span>}
                        {entry.link && (
                          <a href={entry.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
                            <ExternalLink size={11} /> 링크 바로가기
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 매체별 첨부 이미지 (시안/인사이트 분리) — 선택 기간 기준 */}
            <ImageGallery entries={rangeEntries} title="첨부 이미지 (시안·인사이트)" />
          </>
        )}

        {/* Tab: Timetable */}
        {tab === 'timetable' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <CalendarRange size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">월별 타임테이블</h3>
              <span className="ml-auto text-xs text-gray-400">클릭하면 해당 날짜 일정을 확인할 수 있습니다</span>
            </div>
            <ClientCalendar entries={entries} hiddenCategories={isDemo ? ['네이버 여론작업'] : []} />
          </div>
        )}

        {/* Tab: Reports */}
        {tab === 'reports' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">보고서</h3>
              <FileText size={16} className="text-gray-400" />
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              {clientReports.length === 0 ? (
                <p className="col-span-2 text-center py-10 text-gray-400 text-sm">아직 공개된 보고서가 없습니다. 전송일이 지나면 월간 보고서가 자동으로 표시됩니다.</p>
              ) : (
                clientReports.map(report => (
                  <div key={report.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${report.type === 'monthly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {report.type === 'monthly' ? '월간' : report.type === 'weekly' ? '주간' : '커스텀'}
                      </span>
                      <span className="text-xs text-gray-400">{report.fileSize}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{report.title}</h4>
                    <p className="text-xs text-gray-500 mb-2">{report.period}</p>
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{report.summary}</p>
                    {report.highlights && report.highlights.slice(0, 2).map((h, i) => (
                      <p key={i} className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                        <span className="w-1 h-1 bg-blue-400 rounded-full shrink-0" /> {h}
                      </p>
                    ))}
                    <button
                      onClick={() => downloadReportPdf(report, client, entries)}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                      <Download size={13} /> PDF 보고서 다운로드
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab: Keywords */}
        {tab === 'keywords' && <KeywordTool />}
      </div>
    </div>
  );
}

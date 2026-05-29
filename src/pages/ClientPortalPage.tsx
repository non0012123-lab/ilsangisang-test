import { useState } from 'react';
import { Download, FileText, TrendingUp, CheckCircle2, Clock, Calendar, LogOut, BarChart3, ExternalLink, MessageSquare, CalendarRange, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { REPORTS } from '../data/mockData';
import { useApp } from '../context/AppContext';
import CategoryBadge from '../components/CategoryBadge';
import KeywordTool from '../components/KeywordTool';
import { downloadReportPdf } from '../utils/reportPdf';
import { enumerateDays, isMultiDay, overlapsRange, coversDate, entryEnd } from '../utils/dateRange';
import type { ScheduleEntry } from '../types';

type Tab = 'dashboard' | 'timetable' | 'reports' | 'keywords';

const CAT_COLOR: Record<string, string> = {
  'SNS': '#ec4899', '유튜브': '#ef4444', '네이버': '#22c55e',
  '영상제작': '#a855f7', '디자인제작': '#f97316', '네이버 여론작업': '#0ea5e9', '기타': '#6b7280',
};
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

function ClientCalendar({ entries }: { entries: ScheduleEntry[] }) {
  const [curDate, setCurDate] = useState(new Date(2026, 4, 1));
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

  const today = new Date('2026-05-29');
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

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 bg-gray-50 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
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
                <div key={wi} className="relative grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: weekMinH }}>
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
          <div className="w-56 bg-white border border-gray-100 rounded-2xl p-3 space-y-2">
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(CAT_COLOR).map(([cat, color]) => (
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
  const { entries: allEntries, clients } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');

  const clientId = user?.clientId ?? '';
  const client = clients.find(c => c.id === clientId);
  const reports = REPORTS.filter(r => r.clientId === clientId);
  const entries = allEntries.filter(e => e.clientId === clientId);
  const TODAY = '2026-05-29';
  const currentMonth = entries.filter(e => e.date.startsWith('2026-05'));

  const completed = currentMonth.filter(e => e.status === 'completed').length;
  const inProgress = currentMonth.filter(e => e.status === 'in-progress').length;
  const pending = currentMonth.filter(e => e.status === 'pending').length;

  const recentEntries = entries
    .filter(e => e.date <= TODAY && e.category !== '네이버 여론작업')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const opinionEntries = entries
    .filter(e => e.category === '네이버 여론작업' && e.date <= TODAY)
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">안녕하세요, {client.name} 님 👋</h1>
              <p className="text-blue-200 text-sm">5월 마케팅 현황을 확인하세요</p>
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
            { key: 'dashboard', icon: <TrendingUp size={15} />, label: '작업 현황' },
            { key: 'timetable', icon: <CalendarRange size={15} />, label: '타임테이블' },
            { key: 'reports', icon: <FileText size={15} />, label: '보고서' },
            { key: 'keywords', icon: <Search size={15} />, label: '키워드 조회' },
          ] as { key: Tab; icon: React.ReactNode; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Dashboard */}
        {tab === 'dashboard' && (
          <>
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
                  <p className="text-sm text-gray-500 mt-0.5">5월 {s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Tasks */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">최근 작업 현황</h3>
                <TrendingUp size={16} className="text-gray-400" />
              </div>
              <div className="overflow-x-auto">
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
            <ClientCalendar entries={entries} />
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
              {reports.length === 0 ? (
                <p className="col-span-2 text-center py-10 text-gray-400 text-sm">보고서가 없습니다.</p>
              ) : (
                reports.map(report => (
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
                      onClick={() => downloadReportPdf(report, client, allEntries)}
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

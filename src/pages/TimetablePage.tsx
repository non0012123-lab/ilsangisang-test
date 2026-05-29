import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, Calendar, X, CalendarRange, ExternalLink } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import ScheduleModal from '../components/ScheduleModal';
import AIScheduleModal from '../components/AIScheduleModal';
import type { ScheduleEntry } from '../types';
import { enumerateDays, isMultiDay, overlapsRange, coversDate, entryEnd } from '../utils/dateRange';

const CAT_COLOR: Record<string, string> = {
  'SNS': '#ec4899',
  '유튜브': '#ef4444',
  '네이버': '#22c55e',
  '영상제작': '#a855f7',
  '디자인제작': '#f97316',
  '네이버 여론작업': '#0ea5e9',
  '기타': '#6b7280',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-50 text-green-600',
  'in-progress': 'bg-blue-50 text-blue-600',
  pending: 'bg-amber-50 text-amber-600',
};
const STATUS_LABEL: Record<string, string> = { completed: '완료', 'in-progress': '진행중', pending: '대기' };

export default function TimetablePage() {
  const { entries, saveEntry, saveEntries, clients } = useApp();
  const [clientId, setClientId] = useState('all');
  const [curDate, setCurDate] = useState(new Date(2026, 4, 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(29);
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null; date?: string }>({ open: false });
  const [aiOpen, setAiOpen] = useState(false);

  const year = curDate.getFullYear();
  const month = curDate.getMonth();
  const calDays = getCalendarDays(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStart = padDate(year, month, 1);
  const monthEnd = padDate(year, month, new Date(year, month + 1, 0).getDate());

  // 이번 달과 겹치는(기간 작업 포함) 모든 작업
  const visible = entries.filter(e =>
    overlapsRange(e, monthStart, monthEnd) &&
    (clientId === 'all' || e.clientId === clientId)
  );

  // 기간 작업은 걸쳐 있는 모든 날짜 칸에 표시 (우측 패널/통계용)
  const byDay: Record<number, ScheduleEntry[]> = {};
  visible.forEach(e => {
    enumerateDays(e, monthPrefix).forEach(ds => {
      const d = parseInt(ds.split('-')[2]);
      (byDay[d] ??= []).push(e);
    });
  });

  // 캘린더를 주(7칸) 단위로 분할
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));

  // 한 주 안에서 각 작업의 시작열/길이/레인(겹침 방지 줄)을 계산
  //  → 기간 작업이 같은 주에서는 하나의 연속 막대로 그려짐
  const placeWeek = (week: (number | null)[]) => {
    const colDate = week.map(d => (d ? padDate(year, month, d) : null));
    const items = visible
      .map(e => {
        let startCol = -1, endCol = -1;
        for (let c = 0; c < 7; c++) {
          const ds = colDate[c];
          if (ds && coversDate(e, ds)) { if (startCol === -1) startCol = c; endCol = c; }
        }
        return startCol === -1 ? null : { entry: e, startCol, endCol, span: endCol - startCol + 1, colDate };
      })
      .filter(Boolean) as { entry: ScheduleEntry; startCol: number; endCol: number; span: number; colDate: (string | null)[] }[];
    // 기간이 긴 작업을 먼저 배치(위쪽 레인 고정) → 시작열 순
    items.sort((a, b) => b.span - a.span || a.startCol - b.startCol);
    const laneEnds: number[] = []; // 레인별 마지막 점유 열
    return items.map(it => {
      let lane = laneEnds.findIndex(end => end < it.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endCol); }
      else laneEnds[lane] = it.endCol;
      return { ...it, lane };
    });
  };

  const MAX_LANES = 4;   // 한 칸에 보여줄 최대 막대 줄 수
  const BAR_H = 19;      // 막대 높이(px)
  const BAR_GAP = 3;     // 막대 간격(px)
  const NUM_AREA = 32;   // 날짜 숫자 영역 높이(px)

  const handleSave = (entry: ScheduleEntry) => {
    saveEntry(entry);
    setModal({ open: false });
  };

  const openAdd = (day: number) => setModal({ open: true, entry: null, date: padDate(year, month, day) });

  const addAiEntries = (newEntries: ScheduleEntry[]) => {
    saveEntries(newEntries);
    setAiOpen(false);
  };

  const today = new Date('2026-05-29');
  const todayDay = (year === today.getFullYear() && month === today.getMonth()) ? today.getDate() : -1;
  const selectedDayEntries = selectedDay ? (byDay[selectedDay] ?? []) : [];

  const activeClients = clients.filter(c => c.status !== 'inactive');

  return (
    <Layout>
      <Header title="타임테이블" subtitle="업체별 콘텐츠 캘린더를 확인하고 관리합니다" />
      <div className="flex-1 p-6 space-y-4">

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="all">전체 업체</option>
                {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurDate(new Date(year, month - 1, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <span className="text-base font-bold text-gray-900 min-w-[110px] text-center">
                  {year}년 {month + 1}월
                </span>
                <button onClick={() => setCurDate(new Date(year, month + 1, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={() => setCurDate(new Date(2026, 4, 1))}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                이번 달
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAiOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white">
                <Sparkles size={15} /> AI 자동 완성
              </button>
              <button onClick={() => setModal({ open: true, entry: null, date: padDate(year, month, selectedDay ?? 1) })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus size={16} /> 일정 추가
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 min-w-[680px]">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`py-3 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                  {d}
                </div>
              ))}
            </div>
            {/* Days grid - 주 단위, 기간 작업은 한 줄 막대로 연결 */}
            <div>
              {weeks.map((week, wi) => {
                const placed = placeWeek(week);
                const shown = placed.filter(p => p.lane < MAX_LANES);
                const usedLanes = Math.min(MAX_LANES, placed.reduce((m, p) => Math.max(m, p.lane + 1), 0));
                const weekMinH = Math.max(NUM_AREA + usedLanes * (BAR_H + BAR_GAP) + 10, 96);
                return (
                  <div key={wi} className="relative grid grid-cols-7 border-b border-gray-200 last:border-b-0 min-w-[680px]"
                    style={{ minHeight: weekMinH }}>
                    {/* 날짜 셀 (배경 · 숫자 · 선택/추가 · 초과 표시) */}
                    {week.map((day, ci) => {
                      const isToday = day === todayDay;
                      const isSel = day === selectedDay;
                      const isSun = ci === 0;
                      const isSat = ci === 6;
                      const total = day ? placed.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                      const over = day ? total - shown.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                      return (
                        <div key={ci}
                          onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                          className={`relative border-r border-gray-200 last:border-r-0 transition-colors ${
                            !day ? 'bg-gray-50/50' :
                            isSel ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-200' :
                            'hover:bg-slate-50 cursor-pointer'
                          }`}>
                          {day && (
                            <div className="flex items-center justify-between p-1.5">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                                isToday ? 'bg-blue-600 text-white' :
                                isSun ? 'text-red-500' :
                                isSat ? 'text-blue-500' :
                                'text-gray-700'
                              }`}>
                                {day}
                              </span>
                              {isSel && (
                                <button onClick={e => { e.stopPropagation(); openAdd(day); }}
                                  className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700">
                                  <Plus size={11} />
                                </button>
                              )}
                            </div>
                          )}
                          {over > 0 && (
                            <div className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-gray-400 font-medium">
                              +{over}건 더
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 작업 막대 오버레이 (기간 작업은 시작~마감 한 줄로 연결) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {shown.map(p => {
                        const e = p.entry;
                        const contPrev = e.date < (p.colDate[p.startCol] ?? '');     // 지난 주에서 이어짐
                        const contNext = entryEnd(e) > (p.colDate[p.endCol] ?? '');  // 다음 주로 이어짐
                        const padL = contPrev ? 0 : 3;
                        const padR = contNext ? 0 : 3;
                        return (
                          <div key={e.id + '-' + wi}
                            onClick={ev => { ev.stopPropagation(); setModal({ open: true, entry: e }); }}
                            title={`${e.opinionTitle ?? e.keyword ?? e.category}${isMultiDay(e) ? ` (${e.date}~${e.endDate})` : ''}`}
                            className={`pointer-events-auto absolute flex items-center gap-1 px-1.5 text-white text-[11px] font-medium leading-none cursor-pointer hover:brightness-110 transition-all ${
                              contPrev ? '' : 'rounded-l'
                            } ${contNext ? '' : 'rounded-r'}`}
                            style={{
                              left: `calc(${p.startCol} * 100% / 7 + ${padL}px)`,
                              width: `calc(${p.span} * 100% / 7 - ${padL + padR}px)`,
                              top: NUM_AREA + p.lane * (BAR_H + BAR_GAP),
                              height: BAR_H,
                              backgroundColor: CAT_COLOR[e.category] ?? '#6b7280',
                            }}>
                            {contPrev
                              ? <span className="shrink-0 opacity-80">↩</span>
                              : isMultiDay(e) && <CalendarRange size={9} className="shrink-0" />}
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

          {/* Day Detail Panel */}
          {selectedDay ? (
            <div className="w-full lg:w-72 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{month + 1}월 {selectedDay}일</p>
                  <p className="text-xs text-gray-400">{selectedDayEntries.length}개 일정</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openAdd(selectedDay)}
                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                    <Plus size={15} />
                  </button>
                  <button onClick={() => setSelectedDay(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedDayEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Calendar size={28} className="mb-2 text-gray-200" />
                    <p className="text-sm text-gray-400">일정이 없습니다</p>
                    <button onClick={() => openAdd(selectedDay)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      + 일정 추가하기
                    </button>
                  </div>
                ) : (
                  selectedDayEntries.map(entry => (
                    <div key={entry.id}
                      className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
                      onClick={() => setModal({ open: true, entry })}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: CAT_COLOR[entry.category] ?? '#6b7280' }}>
                          {entry.category}
                        </span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
                          {STATUS_LABEL[entry.status]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-0.5 truncate">
                        {entry.opinionTitle ?? entry.keyword ?? entry.category}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{entry.managerName} · {entry.clientName}</p>
                      {isMultiDay(entry) && (
                        <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                          <CalendarRange size={11} /> {entry.date} ~ {entry.endDate}
                        </p>
                      )}
                      {entry.link && (
                        <a href={entry.link} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                          <ExternalLink size={10} className="shrink-0" />
                          <span className="truncate">{entry.link}</span>
                        </a>
                      )}
                      {entry.metrics && Object.values(entry.metrics).some(v => v) && (
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {entry.metrics.views && <span className="text-xs text-gray-400">👁{entry.metrics.views.toLocaleString()}</span>}
                          {entry.metrics.likes && <span className="text-xs text-gray-400">❤️{entry.metrics.likes.toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Mini stats when no day selected */
            <div className="w-full lg:w-64 space-y-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{month + 1}월 현황</p>
                <div className="space-y-2">
                  {[
                    { label: '전체 일정', count: visible.length, color: 'text-gray-900' },
                    { label: '완료', count: visible.filter(e => e.status === 'completed').length, color: 'text-green-600' },
                    { label: '진행중', count: visible.filter(e => e.status === 'in-progress').length, color: 'text-blue-600' },
                    { label: '대기중', count: visible.filter(e => e.status === 'pending').length, color: 'text-amber-600' },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{s.label}</span>
                      <span className={`text-sm font-bold ${s.color}`}>{s.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">카테고리별</p>
                <div className="space-y-1.5">
                  {Object.entries(CAT_COLOR).map(([cat, color]) => {
                    const cnt = visible.filter(e => e.category === cat).length;
                    if (!cnt) return null;
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{cat}</span>
                        <span className="text-xs font-semibold text-gray-700">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-purple-500" />
                  <p className="text-xs font-semibold text-purple-700">AI 자동 완성</p>
                </div>
                <p className="text-xs text-purple-600 leading-relaxed mb-3">
                  담당자·날짜·업체·종류를 채팅으로 적으면 AI가 일정을 만들어 미리보기로 보여줍니다. 확인 후 등록하세요.
                </p>
                <button onClick={() => setAiOpen(true)}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                  <Sparkles size={12} /> AI로 일정 만들기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3">
          <div className="flex items-center gap-5 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">범례</span>
            {Object.entries(CAT_COLOR).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {modal.open && (
        <ScheduleModal
          entry={modal.entry}
          defaultDate={modal.date}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      {aiOpen && (
        <AIScheduleModal onAdd={addAiEntries} onClose={() => setAiOpen(false)} />
      )}
    </Layout>
  );
}

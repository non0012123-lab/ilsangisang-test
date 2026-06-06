import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, CalendarRange, MapPin, Clock, Users, Tag, Trash2, Settings2 } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_COLORS, REMINDER_OPTIONS } from '../data/internalCategories';
import type { InternalEvent, InternalCategory, ReminderOption } from '../types';
import { enumerateDays, isMultiDay, overlapsRange, coversDate, entryEnd } from '../utils/dateRange';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const FALLBACK_COLOR = '#6b7280';

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}
const padDate = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const EMPTY_FORM = {
  title: '', category: '', date: '', endDate: '', startTime: '', endTime: '',
  participantIds: [] as string[], location: '', notes: '', reminder: 'off' as ReminderOption,
};

export default function InternalSchedulePage() {
  const { internalEvents, internalCategories, members, saveInternalEvent, removeInternalEvent, saveInternalCategory, removeInternalCategory } = useApp();
  const { user } = useAuth();
  const [curDate, setCurDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [catFilter, setCatFilter] = useState('all');
  const [form, setForm] = useState<typeof EMPTY_FORM & { id?: string } | null>(null);
  const [catMgrOpen, setCatMgrOpen] = useState(false);

  const year = curDate.getFullYear();
  const month = curDate.getMonth();
  const calDays = getCalendarDays(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStart = padDate(year, month, 1);
  const monthEnd = padDate(year, month, new Date(year, month + 1, 0).getDate());

  const colorOf = (cat: string) => internalCategories.find(c => c.name === cat)?.color ?? FALLBACK_COLOR;

  const visible = internalEvents.filter(e =>
    overlapsRange(e, monthStart, monthEnd) && (catFilter === 'all' || e.category === catFilter));

  const byDay: Record<number, InternalEvent[]> = {};
  visible.forEach(e => enumerateDays(e, monthPrefix).forEach(ds => {
    const d = parseInt(ds.split('-')[2]); (byDay[d] ??= []).push(e);
  }));

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));

  const placeWeek = (week: (number | null)[]) => {
    const colDate = week.map(d => (d ? padDate(year, month, d) : null));
    const items = visible.map(e => {
      let startCol = -1, endCol = -1;
      for (let c = 0; c < 7; c++) { const ds = colDate[c]; if (ds && coversDate(e, ds)) { if (startCol === -1) startCol = c; endCol = c; } }
      return startCol === -1 ? null : { entry: e, startCol, endCol, span: endCol - startCol + 1, colDate };
    }).filter(Boolean) as { entry: InternalEvent; startCol: number; endCol: number; span: number; colDate: (string | null)[] }[];
    items.sort((a, b) => b.span - a.span || a.startCol - b.startCol);
    const laneEnds: number[] = [];
    return items.map(it => {
      let lane = laneEnds.findIndex(end => end < it.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endCol); } else laneEnds[lane] = it.endCol;
      return { ...it, lane };
    });
  };

  const MAX_LANES = 6, BAR_H = 14, BAR_GAP = 2, NUM_AREA = 34, WEEK_MIN_H = 130;
  const today = new Date();
  const todayDay = (year === today.getFullYear() && month === today.getMonth()) ? today.getDate() : -1;
  const selectedEvents = selectedDay ? (byDay[selectedDay] ?? []) : [];

  const openAdd = (day?: number) => setForm({ ...EMPTY_FORM, category: internalCategories[0]?.name ?? '', date: padDate(year, month, day ?? selectedDay ?? 1) });
  const openEdit = (e: InternalEvent) => setForm({
    id: e.id, title: e.title, category: e.category, date: e.date, endDate: e.endDate ?? '',
    startTime: e.startTime ?? '', endTime: e.endTime ?? '', participantIds: [...e.participantIds],
    location: e.location ?? '', notes: e.notes ?? '', reminder: e.reminder ?? 'off',
  });

  const saveForm = () => {
    if (!form) return;
    if (!form.title.trim()) { alert('일정 제목을 입력하세요.'); return; }
    if (!form.date) { alert('날짜를 선택하세요.'); return; }
    const endDate = form.endDate && form.endDate > form.date ? form.endDate : undefined;
    saveInternalEvent({
      id: form.id ?? `ie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: form.title.trim(),
      category: form.category || internalCategories[0]?.name || '기타',
      date: form.date, endDate,
      startTime: form.startTime || undefined, endTime: form.endTime || undefined,
      participantIds: form.participantIds,
      participantNames: form.participantIds.map(id => members.find(m => m.id === id)?.name ?? '').filter(Boolean),
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
      reminder: form.reminder,
      createdAt: form.id ? (internalEvents.find(e => e.id === form.id)?.createdAt ?? Date.now()) : Date.now(),
    });
    setForm(null);
  };
  const toggleParticipant = (id: string) => setForm(f => f && ({ ...f, participantIds: f.participantIds.includes(id) ? f.participantIds.filter(x => x !== id) : [...f.participantIds, id] }));

  const timeLabel = (e: InternalEvent) => e.startTime ? `${e.startTime}${e.endTime ? `~${e.endTime}` : ''}` : '';

  return (
    <Layout>
      <Header title="내부 일정" subtitle="회의·미팅·면접·촬영·휴가 등 사내 전용 일정 (클라이언트에 노출되지 않음)" />
      <div className="flex-1 p-6 space-y-4">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="all">전체 종류</option>
                {internalCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
                <span className="text-base font-bold text-gray-900 min-w-[110px] text-center">{year}년 {month + 1}월</span>
                <button onClick={() => setCurDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
              </div>
              <button onClick={() => setCurDate(new Date())} className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">이번 달</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCatMgrOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                <Settings2 size={15} /> 종류 관리
              </button>
              <button onClick={() => openAdd()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus size={16} /> 일정 추가
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 min-w-[680px]">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`py-3 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
              ))}
            </div>
            <div>
              {weeks.map((week, wi) => {
                const placed = placeWeek(week);
                const shown = placed.filter(p => p.lane < MAX_LANES);
                const usedLanes = Math.min(MAX_LANES, placed.reduce((m, p) => Math.max(m, p.lane + 1), 0));
                const weekMinH = Math.max(NUM_AREA + usedLanes * (BAR_H + BAR_GAP) + 10, WEEK_MIN_H);
                return (
                  <div key={wi} className="relative grid grid-cols-7 border-b border-gray-200 last:border-b-0 min-w-[680px]" style={{ minHeight: weekMinH }}>
                    {week.map((day, ci) => {
                      const isToday = day === todayDay, isSel = day === selectedDay, isSun = ci === 0, isSat = ci === 6;
                      const total = day ? placed.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                      const over = day ? total - shown.filter(p => ci >= p.startCol && ci <= p.endCol).length : 0;
                      return (
                        <div key={ci} onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                          className={`relative border-r border-gray-200 last:border-r-0 transition-colors ${!day ? 'bg-gray-50/50' : isSel ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50 cursor-pointer'}`}>
                          {day && (
                            <div className="flex items-center justify-between p-1.5">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-blue-600 text-white' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                              {isSel && <button onClick={e => { e.stopPropagation(); openAdd(day); }} className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700"><Plus size={11} /></button>}
                            </div>
                          )}
                          {over > 0 && <div className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-gray-400 font-medium">+{over}건 더</div>}
                        </div>
                      );
                    })}
                    <div className="absolute inset-0 pointer-events-none">
                      {shown.map(p => {
                        const e = p.entry;
                        const contPrev = e.date < (p.colDate[p.startCol] ?? '');
                        const contNext = entryEnd(e) > (p.colDate[p.endCol] ?? '');
                        const padL = contPrev ? 0 : 3, padR = contNext ? 0 : 3;
                        return (
                          <div key={e.id + '-' + wi} onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                            title={`${e.title}${timeLabel(e) ? ` ${timeLabel(e)}` : ''}${isMultiDay(e) ? ` (${e.date}~${e.endDate})` : ''}`}
                            className={`pointer-events-auto absolute flex items-center gap-1 px-1.5 text-white text-[10px] font-medium leading-none cursor-pointer hover:brightness-110 transition-all ${contPrev ? '' : 'rounded-l'} ${contNext ? '' : 'rounded-r'}`}
                            style={{ left: `calc(${p.startCol} * 100% / 7 + ${padL}px)`, width: `calc(${p.span} * 100% / 7 - ${padL + padR}px)`, top: NUM_AREA + p.lane * (BAR_H + BAR_GAP), height: BAR_H, backgroundColor: colorOf(e.category) }}>
                            {contPrev ? <span className="shrink-0 opacity-80">↩</span> : isMultiDay(e) && <CalendarRange size={9} className="shrink-0" />}
                            <span className="truncate">{e.startTime ? `${e.startTime} ` : ''}{e.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Detail */}
          <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{selectedDay ? `${month + 1}월 ${selectedDay}일` : '날짜 선택'}</p>
                <p className="text-xs text-gray-400">{selectedEvents.length}개 일정</p>
              </div>
              {selectedDay && (
                <button onClick={() => openAdd(selectedDay)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"><Plus size={15} /></button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[60vh]">
              {!selectedDay ? (
                <p className="text-center py-10 text-sm text-gray-400">날짜를 선택하세요.</p>
              ) : selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Calendar size={28} className="mb-2 text-gray-200" />
                  <p className="text-sm">일정이 없습니다</p>
                  <button onClick={() => openAdd(selectedDay)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">+ 일정 추가하기</button>
                </div>
              ) : selectedEvents.map(e => (
                <div key={e.id} onClick={() => openEdit(e)} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: colorOf(e.category) }}>{e.category}</span>
                    {timeLabel(e) && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} /> {timeLabel(e)}</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{e.title}</p>
                  {isMultiDay(e) && <p className="text-xs text-blue-600 flex items-center gap-1"><CalendarRange size={11} /> {e.date} ~ {e.endDate}</p>}
                  {e.location && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={11} /> {e.location}</p>}
                  {e.participantNames.length > 0 && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Users size={11} /> {e.participantNames.join(', ')}</p>}
                  {e.notes && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{e.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3">
          <div className="flex items-center gap-5 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">범례</span>
            {internalCategories.map(c => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />{c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 일정 추가/수정 모달 */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-base font-bold text-gray-900">{form.id ? '내부 일정 수정' : '내부 일정 추가'}</h2>
              <div className="flex items-center gap-1">
                {form.id && (
                  <button onClick={() => { if (window.confirm('이 일정을 삭제할까요?')) { removeInternalEvent(form.id!); setForm(null); } }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" title="삭제"><Trash2 size={17} /></button>
                )}
                <button onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">제목 *</label>
                <input value={form.title} onChange={e => setForm(f => f && ({ ...f, title: e.target.value }))} placeholder="예: 디자인팀 주간 회의"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">종류</label>
                  <select value={form.category} onChange={e => setForm(f => f && ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {internalCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">장소</label>
                  <input value={form.location} onChange={e => setForm(f => f && ({ ...f, location: e.target.value }))} placeholder="예: 3층 회의실"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">시작일 *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => f && ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">종료일 (기간일 때)</label>
                  <input type="date" value={form.endDate} min={form.date} onChange={e => setForm(f => f && ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">시작 시간</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => f && ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">종료 시간</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => f && ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Clock size={12} /> 사전 알림 <span className="text-gray-400 font-normal">(시작 시간 필요)</span></label>
                <select value={form.reminder} onChange={e => setForm(f => f && ({ ...f, reminder: e.target.value as ReminderOption }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">설정 시 시작 전에 참여자 전원에게 PC·스티커 알림이 떠요(앱이 켜져 있어야 함).</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Users size={12} /> 참여자</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto border border-gray-100 rounded-lg p-2">
                  {members.length === 0 ? <span className="text-xs text-gray-400">담당자가 없습니다.</span> : members.map(m => {
                    const on = form.participantIds.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => toggleParticipant(m.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        {m.name}{m.id === user?.id ? ' (나)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
                <textarea value={form.notes} onChange={e => setForm(f => f && ({ ...f, notes: e.target.value }))} rows={2} placeholder="안건·준비물 등"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={saveForm} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">{form.id ? '수정' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      {catMgrOpen && (
        <CategoryManager categories={internalCategories} onSave={saveInternalCategory} onRemove={removeInternalCategory} onClose={() => setCatMgrOpen(false)} usedCount={(name) => internalEvents.filter(e => e.category === name).length} />
      )}
    </Layout>
  );
}

// 일정 종류(카테고리) 관리 모달
function CategoryManager({ categories, onSave, onRemove, onClose, usedCount }: {
  categories: InternalCategory[];
  onSave: (c: InternalCategory) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  usedCount: (name: string) => number;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (categories.some(c => c.name === n)) { alert('이미 있는 종류입니다.'); return; }
    onSave({ id: `ic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: n, color });
    setName('');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Tag size={16} className="text-blue-600" /><h2 className="text-base font-bold text-gray-900">일정 종류 관리</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {categories.map(c => {
              const used = usedCount(c.name);
              return (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-gray-700 flex-1">{c.name}</span>
                  <span className="text-xs text-gray-400">{used > 0 ? `${used}건` : '미사용'}</span>
                  <button onClick={() => { if (window.confirm(`'${c.name}' 종류를 삭제할까요?${used > 0 ? ` (${used}건은 색만 사라지고 일정은 유지됩니다)` : ''}`)) onRemove(c.id); }}
                    className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">새 종류 추가</label>
            <div className="flex items-center gap-2">
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="예: 외부미팅, 워크숍"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={add} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">추가</button>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {CATEGORY_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, Clock, Calendar, ArrowUpRight, Plus, TrendingUp, Users, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import InlineStatus from '../components/InlineStatus';
import DashboardAssistant from '../components/DashboardAssistant';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { coversDate, overlapsRange, isMultiDay } from '../utils/dateRange';
import { todayStr, currentMonthStr, monthStartStr, monthEndStr } from '../utils/today';

const TODAY = todayStr();
const THIS_MONTH = currentMonthStr();
const MONTH_START = monthStartStr();
const MONTH_END = monthEndStr();

// 로컬 날짜 기준 YYYY-MM-DD 포맷 (toISOString의 UTC 변환 오프바이원 방지)
function fmtLocal(x: Date) {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function getWeekRange(base: string) {
  const d = new Date(base + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: fmtLocal(mon), end: fmtLocal(sun) };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries: allEntries, patchEntry } = useApp();
  const isAdmin = user?.role === 'admin';

  // 내 작업: admin은 전체, 일반 담당자는 본인 것만
  const myEntries = isAdmin ? allEntries : allEntries.filter(e => e.managerId === user?.id);

  // 오늘 할 일: 기간 작업이 오늘에 걸쳐 있으면 포함
  const todayTasks = [...myEntries.filter(e => coversDate(e, TODAY))]
    .sort((a, b) => {
      const ord = { pending: 0, 'in-progress': 1, completed: 2 };
      return ord[a.status] - ord[b.status];
    });

  const monthEntries = myEntries.filter(e => e.date.startsWith(THIS_MONTH) || overlapsRange(e, MONTH_START, MONTH_END));
  const monthDone = monthEntries.filter(e => e.status === 'completed').length;
  const monthProg = monthEntries.filter(e => e.status === 'in-progress').length;
  const monthPend = monthEntries.filter(e => e.status === 'pending').length;

  const week = getWeekRange(TODAY);
  const weekEntries = myEntries
    .filter(e => overlapsRange(e, week.start, week.end))
    .sort((a, b) => a.date.localeCompare(b.date));

  const upcoming = myEntries
    .filter(e => e.date > TODAY && e.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const myClients = [...new Set(myEntries.map(e => e.clientId))];

  // Team stats (admin only)
  const teamToday = allEntries.filter(e => coversDate(e, TODAY));

  const updateEntry = (id: string, patch: Partial<typeof allEntries[0]>) =>
    patchEntry(id, patch);

  const greet = () => {
    const h = 10; // fixed for demo
    if (h < 12) return '좋은 아침이에요';
    if (h < 18) return '안녕하세요';
    return '오늘도 수고하셨어요';
  };

  return (
    <Layout>
      <Header title="내 대시보드" subtitle={`${user?.name}님의 작업 현황`} />
      <div className="flex-1 p-6 space-y-5">

        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-200 text-sm mb-1">{greet()},</p>
            <h2 className="text-xl sm:text-2xl font-bold truncate">{user?.name} 님 👋</h2>
            {user?.department && <p className="text-blue-200 text-sm mt-1 truncate">{user.department}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-blue-200 text-xs mb-1">오늘의 작업</p>
            <p className="text-4xl font-bold">{todayTasks.length}<span className="text-xl font-normal text-blue-200 ml-1">건</span></p>
            {todayTasks.filter(e => e.status === 'completed').length > 0 && (
              <p className="text-blue-200 text-xs mt-1">
                {todayTasks.filter(e => e.status === 'completed').length}건 완료 ✓
              </p>
            )}
          </div>
        </div>

        {/* Month Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '이번달 완료', value: monthDone, icon: <CheckCircle2 size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '진행중', value: monthProg, icon: <Clock size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '예정', value: monthPend, icon: <Calendar size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '담당 클라이언트', value: myClients.length, icon: <Users size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-2`}>{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* AI 어시스턴트 */}
        <DashboardAssistant />

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Today's Tasks */}
          <div className="lg:col-span-3 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                오늘 할 일
                {todayTasks.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">{todayTasks.length}건</span>
                )}
              </h3>
              <button onClick={() => navigate('/schedule/daily')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                일일 스케줄 <ArrowUpRight size={14} />
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="font-semibold text-gray-700">오늘 예정된 작업이 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">여유로운 하루 보내세요!</p>
                <button onClick={() => navigate('/schedule/daily')}
                  className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                  <Plus size={14} /> 스케줄 추가
                </button>
              </div>
            ) : (
              <>
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {[
                        { h: '카테고리', w: 'w-[116px]' },
                        { h: '클라이언트', w: 'w-auto' },
                        { h: '키워드/제목', w: 'w-auto' },
                        { h: '상태', w: 'w-[120px]' },
                      ].map(c => (
                        <th key={c.h} className={`text-left text-xs font-semibold text-gray-500 px-4 py-2.5 whitespace-nowrap ${c.w}`}>{c.h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {todayTasks.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          <span className="truncate block" title={entry.clientName}>{entry.clientName}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          <span className="truncate block text-xs" title={entry.opinionTitle ?? entry.keyword}>
                            {entry.opinionTitle ?? entry.keyword ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <InlineStatus
                            status={entry.status}
                            onChange={s => updateEntry(entry.id, { status: s })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 모바일 카드 */}
              <div className="md:hidden space-y-2">
                {todayTasks.map(entry => (
                  <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
                    <CategoryBadge category={entry.category} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.opinionTitle ?? entry.keyword ?? '-'}</p>
                      <p className="text-xs text-gray-400 truncate">{entry.clientName}</p>
                    </div>
                    <InlineStatus status={entry.status} onChange={s => updateEntry(entry.id, { status: s })} />
                  </div>
                ))}
              </div>
              </>
            )}

            {/* This Week */}
            <div className="flex items-center justify-between mt-2">
              <h3 className="font-bold text-gray-900">이번 주 일정</h3>
              <span className="text-xs text-gray-400">{week.start} ~ {week.end}</span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {weekEntries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">이번 주 일정이 없습니다.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {weekEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      <span className="text-xs text-gray-400 w-16 shrink-0 font-medium">
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                      </span>
                      <CategoryBadge category={entry.category} />
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate flex items-center gap-1.5">
                        <span className="truncate">{entry.opinionTitle ?? entry.keyword ?? entry.category}</span>
                        {isMultiDay(entry) && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full shrink-0">기간</span>}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0 truncate max-w-[84px] hidden sm:block">{entry.clientName}</span>
                      <InlineStatus status={entry.status} onChange={s => updateEntry(entry.id, { status: s })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2 min-w-0 space-y-4">
            {/* Upcoming */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="font-bold text-gray-900">예정된 작업</h3>
                <TrendingUp size={15} className="text-gray-400" />
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">예정된 작업이 없습니다.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcoming.map(entry => (
                    <div key={entry.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="text-center shrink-0">
                        <p className="text-xs font-bold text-blue-600">
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{entry.opinionTitle ?? entry.keyword ?? entry.category}</p>
                        <p className="text-xs text-gray-400 truncate">{entry.clientName} · {entry.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">빠른 실행</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '스케줄 추가', path: '/schedule/daily', emoji: '📋' },
                  { label: '전체 스케줄', path: '/schedule/full', emoji: '📅' },
                  { label: '타임테이블', path: '/timetable', emoji: '🗓️' },
                  { label: 'AI 기획', path: '/ai-planning', emoji: '🤖' },
                ].map(a => (
                  <button key={a.path} onClick={() => navigate(a.path)}
                    className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700 transition-colors font-medium">
                    <span>{a.emoji}</span> {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin: Team overview */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-gray-900 text-sm">팀 오늘 현황</h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { label: '전체 오늘 작업', value: teamToday.length },
                    { label: '완료', value: teamToday.filter(e => e.status === 'completed').length },
                    { label: '진행중', value: teamToday.filter(e => e.status === 'in-progress').length },
                    { label: '대기중', value: teamToday.filter(e => e.status === 'pending').length },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{s.label}</span>
                      <span className="font-bold text-gray-900">{s.value}건</span>
                    </div>
                  ))}
                  <button onClick={() => navigate('/schedule/full')}
                    className="w-full mt-2 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    전체 스케줄 보기 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

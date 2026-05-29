import { CheckCircle2, Clock, Users, TrendingUp, ArrowUpRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import StatusBadge from '../components/StatusBadge';
import { useApp } from '../context/AppContext';

const TODAY = '2026-05-29';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { entries: SCHEDULE_ENTRIES, clients: CLIENTS } = useApp();
  const todayEntries = SCHEDULE_ENTRIES.filter(e => e.date === TODAY);
  const completed = SCHEDULE_ENTRIES.filter(e => e.status === 'completed').length;
  const inProgress = SCHEDULE_ENTRIES.filter(e => e.status === 'in-progress').length;
  const activeClients = CLIENTS.filter(c => c.status === 'active').length;

  const stats = [
    { label: '오늘 작업', value: todayEntries.length, icon: <TrendingUp size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', change: '+2' },
    { label: '완료된 작업', value: completed, icon: <CheckCircle2 size={20} />, color: 'text-green-600', bg: 'bg-green-50', change: '+5' },
    { label: '진행중', value: inProgress, icon: <Clock size={20} />, color: 'text-amber-600', bg: 'bg-amber-50', change: '' },
    { label: '활성 클라이언트', value: activeClients, icon: <Users size={20} />, color: 'text-purple-600', bg: 'bg-purple-50', change: '' },
  ];

  const recentEntries = SCHEDULE_ENTRIES
    .filter(e => e.date <= TODAY)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <Layout>
      <Header title="대시보드" subtitle="일상이상커뮤니케이션 마케팅 현황" />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  {stat.icon}
                </div>
                {stat.change && (
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-3">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Schedule */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h3 className="font-bold text-gray-900">최근 스케줄</h3>
              <button
                onClick={() => navigate('/schedule/full')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                전체보기 <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">날짜</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">담당자</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">카테고리</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">키워드</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.managerName}</td>
                      <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{entry.keyword}</td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h3 className="font-bold text-gray-900">클라이언트 현황</h3>
              <button
                onClick={() => navigate('/clients')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                관리 <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {CLIENTS.filter(c => c.status === 'active').map(client => (
                <div key={client.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/clients')}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {client.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{client.name}</p>
                    <p className="text-xs text-gray-400 truncate">{client.industry}</p>
                  </div>
                  <span className="w-2 h-2 bg-green-400 rounded-full shrink-0" />
                </div>
              ))}
              <button
                onClick={() => navigate('/clients')}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <Plus size={14} />
                클라이언트 추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

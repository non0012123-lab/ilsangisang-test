import { Download, FileText, TrendingUp, CheckCircle2, Clock, Calendar, LogOut, BarChart3, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CLIENTS, SCHEDULE_ENTRIES, REPORTS } from '../data/mockData';
import CategoryBadge from '../components/CategoryBadge';

function downloadReport(title: string, summary: string, highlights: string[] = []) {
  const content = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `  일상이상커뮤니케이션 - 성과 보고서`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `제목: ${title}`,
    `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
    '',
    '■ 요약',
    summary,
    '',
    ...(highlights.length > 0 ? ['■ 주요 성과', ...highlights.map(h => `  • ${h}`), ''] : []),
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  © 2026 일상이상커뮤니케이션',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientPortalPage() {
  const { user, logout } = useAuth();
  const clientId = user?.clientId ?? '';
  const client = CLIENTS.find(c => c.id === clientId);
  const reports = REPORTS.filter(r => r.clientId === clientId);
  const entries = SCHEDULE_ENTRIES.filter(e => e.clientId === clientId);
  const TODAY = '2026-05-29';
  const currentMonth = entries.filter(e => e.date.startsWith('2026-05'));

  const completed = currentMonth.filter(e => e.status === 'completed').length;
  const inProgress = currentMonth.filter(e => e.status === 'in-progress').length;
  const pending = currentMonth.filter(e => e.status === 'pending').length;

  const recentEntries = entries
    .filter(e => e.date <= TODAY)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

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
            <button onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
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
          <div className="mt-5 flex gap-2 flex-wrap">
            {client.categories.map(c => (
              <span key={c} className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white">{c}</span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '완료', value: completed, icon: <CheckCircle2 size={18} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
            { label: '진행중', value: inProgress, icon: <Clock size={18} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: '예정', value: pending, icon: <Calendar size={18} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-5`}>
              <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
                {s.icon}
              </div>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">5월 {s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Recent Tasks */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100">
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
                        <td className="px-4 py-3 text-gray-800 max-w-[120px]">
                          <span className="truncate block text-xs" title={entry.keyword}>{entry.keyword}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <div className="flex items-center gap-1">
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="table-link link-cell text-xs"
                              title={entry.link}>{entry.link}</a>
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 p-0.5 text-gray-300 hover:text-blue-500">
                              <ExternalLink size={11} />
                            </a>
                          </div>
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

          {/* Reports */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">보고서</h3>
              <FileText size={16} className="text-gray-400" />
            </div>
            <div className="p-4 space-y-3">
              {reports.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">보고서가 없습니다.</p>
              ) : (
                reports.map(report => (
                  <div key={report.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        report.type === 'monthly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {report.type === 'monthly' ? '월간' : report.type === 'weekly' ? '주간' : '커스텀'}
                      </span>
                      <span className="text-xs text-gray-400">{report.fileSize}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{report.title}</h4>
                    <p className="text-xs text-gray-500 mb-2">{report.period}</p>
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{report.summary}</p>
                    {report.highlights && report.highlights.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {report.highlights.slice(0, 2).map((h, i) => (
                          <p key={i} className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-1 h-1 bg-blue-400 rounded-full shrink-0" />
                            {h}
                          </p>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => downloadReport(report.title, report.summary, report.highlights)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Download size={13} />
                      보고서 다운로드
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Copy, Image, Hash, PlayCircle, Globe, Video, Paintbrush } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import ScheduleModal from '../components/ScheduleModal';
import type { ScheduleEntry, Category } from '../types';
import { SCHEDULE_ENTRIES } from '../data/mockData';

const CATEGORY_CONFIG: Record<string, { label: Category; color: string; icon: React.ReactNode; gradient: string }> = {
  sns:      { label: 'SNS',      color: 'text-pink-600',   icon: <Hash size={20} />,        gradient: 'from-pink-500 to-rose-500' },
  youtube:  { label: '유튜브',   color: 'text-red-600',    icon: <PlayCircle size={20} />,  gradient: 'from-red-500 to-orange-500' },
  naver:    { label: '네이버',   color: 'text-green-600',  icon: <Globe size={20} />,     gradient: 'from-green-500 to-emerald-500' },
  video:    { label: '영상제작', color: 'text-purple-600', icon: <Video size={20} />,     gradient: 'from-purple-500 to-violet-500' },
  design:   { label: '디자인제작',color: 'text-orange-600',icon: <Paintbrush size={20} />,gradient: 'from-orange-500 to-amber-500' },
};

const TABS = [
  { to: '/category/sns',     icon: <Hash size={14} />,        label: 'SNS' },
  { to: '/category/youtube', icon: <PlayCircle size={14} />, label: '유튜브' },
  { to: '/category/naver',   icon: <Globe size={14} />,     label: '네이버' },
  { to: '/category/video',   icon: <Video size={14} />,     label: '영상제작' },
  { to: '/category/design',  icon: <Paintbrush size={14} />,label: '디자인제작' },
];

export default function CategoryPage() {
  const { category = 'sns' } = useParams<{ category: string }>();
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.sns;
  const [entries, setEntries] = useState<ScheduleEntry[]>(SCHEDULE_ENTRIES);
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const filtered = entries
    .filter(e => e.category === config.label)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (entry: ScheduleEntry) => {
    setEntries(prev =>
      prev.some(e => e.id === entry.id)
        ? prev.map(e => (e.id === entry.id ? entry : e))
        : [...prev, entry]
    );
    setModal({ open: false });
  };

  const handleDelete = (id: string) => {
    if (confirm('삭제하시겠습니까?')) setEntries(prev => prev.filter(e => e.id !== id));
  };

  const completed = filtered.filter(e => e.status === 'completed').length;
  const inProg = filtered.filter(e => e.status === 'in-progress').length;
  const pending = filtered.filter(e => e.status === 'pending').length;

  return (
    <Layout>
      <Header title="카테고리별 스케줄" subtitle="채널별 작업 현황을 확인합니다" />
      <div className="flex-1 p-6 space-y-4">
        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </div>

        {/* Category Header */}
        <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                {config.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold">{config.label}</h2>
                <p className="text-white/80 text-sm">총 {filtered.length}개 작업</p>
              </div>
            </div>
            <button
              onClick={() => setModal({ open: true, entry: null })}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors backdrop-blur-sm"
            >
              <Plus size={16} />
              스케줄 추가
            </button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              { label: '완료', value: completed },
              { label: '진행중', value: inProg },
              { label: '대기중', value: pending },
            ].map(s => (
              <div key={s.label} className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-white/80 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                {config.icon}
              </div>
              <p className="font-medium text-gray-500">{config.label} 카테고리에 등록된 스케줄이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', '날짜', '담당자', '클라이언트', '키워드', '링크', '순위', '캡처본', '상태', '작업'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((entry, i) => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{entry.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.managerName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.clientName}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[160px]">
                        <span className="truncate block" title={entry.keyword}>{entry.keyword}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="flex items-center gap-1">
                          <a href={entry.link} target="_blank" rel="noopener noreferrer"
                            className="table-link link-cell" title={entry.link}>{entry.link}</a>
                          <div className="flex gap-0.5 shrink-0">
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"><ExternalLink size={12} /></a>
                            <button onClick={() => navigator.clipboard.writeText(entry.link)}
                              className="p-1 text-gray-300 hover:text-gray-600 transition-colors"><Copy size={12} /></button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.rank ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {entry.screenshot ? (
                          <button onClick={() => setPreviewImg(entry.screenshot!)}>
                            <img src={entry.screenshot} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200 hover:opacity-80" />
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300"><Image size={14} /></div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setModal({ open: true, entry })}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal.open && (
        <ScheduleModal entry={modal.entry} onSave={handleSave} onClose={() => setModal({ open: false })} />
      )}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="캡처본" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </Layout>
  );
}

import { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Pencil, Trash2, Hash, PlayCircle, Globe, Video, Paintbrush, MessageSquare, CalendarRange } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import InlineStatus from '../components/InlineStatus';
import InlineScreenshot from '../components/InlineScreenshot';
import InlineLink from '../components/InlineLink';
import ScheduleModal from '../components/ScheduleModal';
import type { ScheduleEntry, Category } from '../types';
import { useApp } from '../context/AppContext';
import { useCopyToast } from '../hooks/useCopyToast';
import { isMultiDay } from '../utils/dateRange';

const CATEGORY_CONFIG: Record<string, { label: Category; color: string; icon: React.ReactNode; gradient: string }> = {
  sns:            { label: 'SNS',           color: 'text-pink-600',   icon: <Hash size={20} />,          gradient: 'from-pink-500 to-rose-500' },
  youtube:        { label: '유튜브',        color: 'text-red-600',    icon: <PlayCircle size={20} />,    gradient: 'from-red-500 to-orange-500' },
  naver:          { label: '네이버',        color: 'text-green-600',  icon: <Globe size={20} />,         gradient: 'from-green-500 to-emerald-500' },
  video:          { label: '영상제작',      color: 'text-purple-600', icon: <Video size={20} />,         gradient: 'from-purple-500 to-violet-500' },
  design:         { label: '디자인제작',    color: 'text-orange-600', icon: <Paintbrush size={20} />,    gradient: 'from-orange-500 to-amber-500' },
  'naver-opinion':{ label: '네이버 여론작업',color: 'text-sky-600',  icon: <MessageSquare size={20} />, gradient: 'from-sky-500 to-blue-500' },
};

const TABS = [
  { to: '/category/sns',           icon: <Hash size={14} />,          label: 'SNS' },
  { to: '/category/youtube',       icon: <PlayCircle size={14} />,    label: '유튜브' },
  { to: '/category/naver',         icon: <Globe size={14} />,         label: '네이버' },
  { to: '/category/video',         icon: <Video size={14} />,         label: '영상제작' },
  { to: '/category/design',        icon: <Paintbrush size={14} />,    label: '디자인제작' },
  { to: '/category/naver-opinion', icon: <MessageSquare size={14} />, label: '네이버 여론작업' },
];

export default function CategoryPage() {
  const { category = 'sns' } = useParams<{ category: string }>();
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.sns;
  const { entries, setEntries } = useApp();
  const { notify, show: showToast } = useCopyToast();
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const filtered = entries
    .filter(e => e.category === config.label)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (entry: ScheduleEntry) => {
    setEntries(prev => prev.some(e => e.id === entry.id) ? prev.map(e => e.id === entry.id ? entry : e) : [entry, ...prev]);
    setModal({ open: false });
  };
  const handleDelete = (id: string) => { if (confirm('삭제하시겠습니까?')) setEntries(prev => prev.filter(e => e.id !== id)); };
  const updateEntry = (id: string, patch: Partial<ScheduleEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const completed = filtered.filter(e => e.status === 'completed').length;
  const inProg = filtered.filter(e => e.status === 'in-progress').length;
  const pending = filtered.filter(e => e.status === 'pending').length;
  const isOpinion = config.label === '네이버 여론작업';

  return (
    <Layout>
      <Header title="카테고리별 스케줄" subtitle="채널별 작업 현황을 확인합니다" />
      <div className="flex-1 p-6 space-y-4">
        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <NavLink key={tab.to} to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'}`
              }>{tab.icon}{tab.label}</NavLink>
          ))}
        </div>

        {/* Category Header */}
        <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">{config.icon}</div>
              <div>
                <h2 className="text-xl font-bold">{config.label}</h2>
                <p className="text-white/80 text-sm">총 {filtered.length}개 작업</p>
              </div>
            </div>
            <button onClick={() => setModal({ open: true, entry: null })}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={16} /> 스케줄 추가
            </button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[{ label: '완료', value: completed }, { label: '진행중', value: inProg }, { label: '대기중', value: pending }].map(s => (
              <div key={s.label} className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-white/80 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Opinion Table */}
        {isOpinion ? (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400">네이버 여론작업 항목이 없습니다.</div>
            ) : (
              filtered.map((entry, i) => (
                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-sky-200 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 font-mono mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm mb-0.5">{entry.opinionTitle}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                          <span>{isMultiDay(entry) ? `${entry.date} ~ ${entry.endDate}` : entry.date}</span>
                          {isMultiDay(entry) && <CalendarRange size={11} className="text-blue-500" />}
                          <span>·</span>
                          <span>{entry.managerName}</span>
                          <span>·</span>
                          <span>{entry.clientName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <InlineStatus status={entry.status} onChange={s => updateEntry(entry.id, { status: s })} />
                      <button onClick={() => setModal({ open: true, entry })}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {entry.opinionContent && (
                    <div className="bg-sky-50 rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-sky-700 mb-1">내용</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{entry.opinionContent}</p>
                    </div>
                  )}

                  {entry.opinionComments && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">댓글</p>
                      <p className="text-sm text-gray-600 italic">"{entry.opinionComments}"</p>
                    </div>
                  )}

                  {/* 링크 */}
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-500 block mb-1">링크</span>
                    <InlineLink link={entry.link} onChange={v => updateEntry(entry.id, { link: v })} onCopied={notify} />
                  </div>

                  <div className="flex items-center gap-4">
                    {entry.metrics?.views && <span className="text-xs text-gray-500">👁 {entry.metrics.views.toLocaleString()} 조회</span>}
                    {entry.metrics?.comments && <span className="text-xs text-gray-500">💬 {entry.metrics.comments.toLocaleString()} 댓글</span>}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">캡처본:</span>
                      <InlineScreenshot
                        screenshot={entry.screenshot}
                        onChange={v => updateEntry(entry.id, { screenshot: v })}
                        onPreview={setPreviewImg}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Regular Table */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">{config.icon}</div>
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
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">
                          {isMultiDay(entry) ? (
                            <span className="inline-flex items-center gap-1 text-blue-600" title={`${entry.date} ~ ${entry.endDate}`}>
                              <CalendarRange size={12} /> {entry.date}<span className="text-gray-300">~</span>{entry.endDate?.slice(5)}
                            </span>
                          ) : entry.date}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.managerName}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.clientName}</td>
                        <td className="px-4 py-3 text-gray-800 max-w-[160px]">
                          <span className="truncate block" title={entry.keyword}>{entry.keyword}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <InlineLink link={entry.link} onChange={v => updateEntry(entry.id, { link: v })} onCopied={notify} />
                        </td>
                        <td className="px-4 py-3">
                          {entry.rank ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <InlineScreenshot
                            screenshot={entry.screenshot}
                            onChange={v => updateEntry(entry.id, { screenshot: v })}
                            onPreview={setPreviewImg}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <InlineStatus status={entry.status} onChange={s => updateEntry(entry.id, { status: s })} />
                        </td>
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
        )}
      </div>

      {modal.open && <ScheduleModal entry={modal.entry} onSave={handleSave} onClose={() => setModal({ open: false })} />}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="캡처본" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-xl">
          링크가 복사되었습니다.
        </div>
      )}
    </Layout>
  );
}

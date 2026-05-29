import { useState } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, Copy, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import StatusBadge from '../components/StatusBadge';
import ScheduleModal from '../components/ScheduleModal';
import type { ScheduleEntry } from '../types';
import { SCHEDULE_ENTRIES } from '../data/mockData';

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function DailySchedulePage() {
  const [date, setDate] = useState(toDateStr(new Date('2026-05-29')));
  const [entries, setEntries] = useState<ScheduleEntry[]>(SCHEDULE_ENTRIES);
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const dayEntries = entries.filter(e => e.date === date);

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(toDateStr(d));
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(toDateStr(d));
  };

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

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
  };

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  return (
    <Layout>
      <Header title="일일 스케줄" subtitle="오늘의 작업 현황을 확인하고 관리하세요" />
      <div className="flex-1 p-6 space-y-4">
        {/* Date Navigator */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={nextDay} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronRight size={18} />
              </button>
              <span className="text-gray-600 font-medium text-sm">{displayDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{dayEntries.length}건</span>
              <button
                onClick={() => setModal({ open: true, entry: null })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus size={16} />
                스케줄 추가
              </button>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '완료', count: dayEntries.filter(e => e.status === 'completed').length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '진행중', count: dayEntries.filter(e => e.status === 'in-progress').length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '대기중', count: dayEntries.filter(e => e.status === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-2`}>
              <span className={`text-2xl font-bold ${s.color}`}>{s.count}</span>
              <span className="text-sm text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {dayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">이 날짜에 등록된 스케줄이 없습니다</p>
              <button
                onClick={() => setModal({ open: true, entry: null })}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                스케줄 추가하기
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', '담당자', '클라이언트', '카테고리', '키워드', '링크', '순위', '캡처본', '상태', '작업'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dayEntries.map((entry, i) => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.managerName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.clientName}</td>
                      <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                      <td className="px-4 py-3 text-gray-800 max-w-[140px]">
                        <span className="truncate block" title={entry.keyword}>{entry.keyword}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="flex items-center gap-1">
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-link link-cell"
                            title={entry.link}
                          >
                            {entry.link}
                          </a>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-gray-300 hover:text-blue-500 transition-colors" title="새 탭으로 열기">
                              <ExternalLink size={12} />
                            </a>
                            <button onClick={() => copyLink(entry.link)}
                              className="p-1 text-gray-300 hover:text-gray-600 transition-colors" title="링크 복사">
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.rank ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">
                            {entry.rank}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.screenshot ? (
                          <button onClick={() => setPreviewImg(entry.screenshot!)}>
                            <img src={entry.screenshot} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                            <Image size={14} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModal({ open: true, entry })}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
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
        <ScheduleModal
          entry={modal.entry}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="캡처본" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </Layout>
  );
}

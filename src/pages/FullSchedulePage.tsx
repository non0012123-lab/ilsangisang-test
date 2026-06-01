import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Filter, CalendarRange } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import InlineStatus from '../components/InlineStatus';
import InlineScreenshot from '../components/InlineScreenshot';
import { entryImages } from '../utils/entryImages';
import InlineLink from '../components/InlineLink';
import ScheduleModal from '../components/ScheduleModal';
import type { ScheduleEntry, Category, ScheduleStatus } from '../types';
import { useApp } from '../context/AppContext';
import { useCopyToast } from '../hooks/useCopyToast';
import { overlapsRange, isMultiDay } from '../utils/dateRange';

const ALL_CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];

export default function FullSchedulePage() {
  const { entries, saveEntry, removeEntry, patchEntry, clients, members } = useApp();
  const { notify, show: showToast } = useCopyToast();
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState('all');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | 'all'>('all');
  const [filterManager, setFilterManager] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 담당자 필터는 실제 가입·승인된 담당자(Supabase profiles)를 사용 (스케줄 등록 모달과 동일 소스)
  const managers = members;

  const filtered = entries
    .filter(e => filterClient === 'all' || e.clientId === filterClient)
    .filter(e => filterCategory === 'all' || e.category === filterCategory)
    .filter(e => filterStatus === 'all' || e.status === filterStatus)
    .filter(e => filterManager === 'all' || e.managerId === filterManager)
    .filter(e => overlapsRange(e, dateFrom || undefined, dateTo || undefined))
    .filter(e => !search || (e.keyword ?? '').includes(search) || (e.opinionTitle ?? '').includes(search) || e.managerName.includes(search) || e.clientName.includes(search) || (e.link ?? '').includes(search))
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (entry: ScheduleEntry) => {
    saveEntry(entry);
    setModal({ open: false });
  };
  const handleDelete = (id: string) => { if (confirm('삭제하시겠습니까?')) removeEntry(id); };
  const updateEntry = (id: string, patch: Partial<ScheduleEntry>) => patchEntry(id, patch);

  return (
    <Layout>
      <Header title="전체 스케줄" subtitle="모든 날짜의 스케줄을 확인합니다" />
      <div className="flex-1 p-6 space-y-4">
        {/* Search & Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="키워드, 제목, 담당자, 클라이언트, 링크 검색..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm transition-colors ${showFilters ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Filter size={14} /> 필터
            </button>
            <button onClick={() => setModal({ open: true, entry: null })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={16} /> 추가
            </button>
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">시작일</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">종료일</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">담당자</label>
                <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체</option>
                  {managers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">클라이언트</label>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">카테고리</label>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as Category | 'all')}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체</option>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">상태</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ScheduleStatus | 'all')}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체</option>
                  <option value="pending">대기중</option>
                  <option value="in-progress">진행중</option>
                  <option value="completed">완료</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">총 <span className="font-semibold text-gray-900">{filtered.length}</span>건</div>

        {/* Table (md 이상) */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', '날짜', '담당자', '클라이언트', '카테고리', '키워드/제목', '링크/내용', '순위', '이미지', '상태', '작업'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-400">조건에 맞는 스케줄이 없습니다.</td></tr>
                ) : (
                  filtered.map((entry, i) => (
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
                      <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                      <td className="px-4 py-3 text-gray-800 max-w-[140px]">
                        <span className="truncate block" title={entry.opinionTitle ?? entry.keyword}>
                          {entry.opinionTitle ?? entry.keyword ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {entry.category === '네이버 여론작업' && entry.opinionContent && (
                          <span className="text-xs text-gray-500 line-clamp-1 mb-1 block">{entry.opinionContent.slice(0, 45)}…</span>
                        )}
                        <InlineLink link={entry.link} onChange={v => updateEntry(entry.id, { link: v })} onCopied={notify} />
                      </td>
                      <td className="px-4 py-3">
                        {entry.category === '네이버 여론작업' ? (
                          entry.metrics?.comments ? <span className="text-xs text-sky-600 font-medium">💬{entry.metrics.comments}</span> : <span className="text-gray-300">-</span>
                        ) : entry.rank ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <InlineScreenshot
                          images={entryImages(entry)}
                          onImagesChange={imgs => updateEntry(entry.id, { images: imgs, screenshot: undefined })}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cards (md 미만 · 모바일) */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-10 text-center text-gray-400 text-sm">조건에 맞는 스케줄이 없습니다.</div>
          ) : filtered.map(entry => (
            <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                  {isMultiDay(entry)
                    ? <><CalendarRange size={13} className="text-blue-600" /> {entry.date}<span className="text-gray-300">~</span>{entry.endDate?.slice(5)}</>
                    : entry.date}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ open: true, entry })}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(entry.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <CategoryBadge category={entry.category} />
                <InlineStatus status={entry.status} onChange={s => updateEntry(entry.id, { status: s })} />
                {entry.rank ? <span className="inline-flex items-center justify-center px-2 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}위</span> : null}
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5 break-words">{entry.opinionTitle ?? entry.keyword ?? '-'}</p>
              <p className="text-xs text-gray-500 mb-2">{entry.managerName} · {entry.clientName}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <InlineLink link={entry.link} onChange={v => updateEntry(entry.id, { link: v })} onCopied={notify} />
                <InlineScreenshot images={entryImages(entry)} onImagesChange={imgs => updateEntry(entry.id, { images: imgs, screenshot: undefined })} onPreview={setPreviewImg} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal.open && <ScheduleModal entry={modal.entry} onSave={handleSave} onClose={() => setModal({ open: false })} />}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="이미지" className="max-w-full max-h-full rounded-xl shadow-2xl" />
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

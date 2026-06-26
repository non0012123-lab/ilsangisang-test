import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, Filter, CalendarRange, User } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import TeamFilter from '../components/TeamFilter';
import { orderedTeams } from '../data/org';
import { useAuth } from '../context/AuthContext';
import CategoryBadge from '../components/CategoryBadge';
import InlineStatus from '../components/InlineStatus';
import InlineScreenshot from '../components/InlineScreenshot';
import { entryImages } from '../utils/entryImages';
import InlineLink from '../components/InlineLink';
import ScheduleModal from '../components/ScheduleModal';
import RankCollectButton from '../components/RankCollectButton';
import RankTabsBadge from '../components/RankTabsBadge';
import ScheduleCardList from '../components/ScheduleCardList';
import { useApp } from '../context/AppContext';
import { useCopyToast } from '../hooks/useCopyToast';
import { coversDate, isMultiDay, fmtLocal } from '../utils/dateRange';
import type { ScheduleEntry, Category, ScheduleStatus } from '../types';
import { CATEGORY_GROUPS, catLabel } from '../data/categories';

function toDateStr(d: Date) { return fmtLocal(d); }

export default function DailySchedulePage() {
  const { entries, saveEntry, removeEntry, patchEntry, clients, members } = useApp();
  const { notify, show: showToast } = useCopyToast();

  const [date, setDate] = useState(toDateStr(new Date()));
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState('all');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | 'all'>('all');
  const [filterManager, setFilterManager] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');

  // 담당자 필터는 실제 가입·승인된 담당자(Supabase profiles)를 사용 (스케줄 등록 모달과 동일 소스)
  const managers = members;
  // 팀(department)별 보기 — 담당자 id → 팀 매핑. 칩 목록은 실제 존재하는 팀만 표준 순서로.
  const teamById = useMemo(() => new Map(members.map(m => [m.id, m.department])), [members]);
  const teams = useMemo(() => orderedTeams(members.map(m => m.department)), [members]);
  // "내 일정" 빠른 버튼 — 로그인 본인을 담당자 필터로 토글(기존 filterManager 재사용)
  const { user } = useAuth();
  const selfId = user?.id && members.some(m => m.id === user.id) ? user.id : '';
  const myView = !!selfId && filterManager === selfId;
  const toggleMine = () => setFilterManager(myView ? 'all' : selfId);

  const prevDay = () => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - 1); setDate(toDateStr(d)); };
  const nextDay = () => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 1); setDate(toDateStr(d)); };

  // All entries covering this day (기간 작업 포함) - newest first, 기간 작업은 맨 아래
  const allDayEntries = entries
    .filter(e => coversDate(e, date))
    .sort((a, b) => {
      // 마감기간(기간 작업)이 있는 스케줄은 항상 목록 맨 아래로
      const aMulti = isMultiDay(a) ? 1 : 0, bMulti = isMultiDay(b) ? 1 : 0;
      if (aMulti !== bMulti) return aMulti - bMulti;
      const aTs = Number(a.id), bTs = Number(b.id);
      if (!isNaN(aTs) && !isNaN(bTs)) return bTs - aTs; // both new: desc
      if (!isNaN(aTs)) return -1; // a is newer
      if (!isNaN(bTs)) return 1;
      return 0;
    });

  const dayEntries = allDayEntries
    .filter(e => filterClient === 'all' || e.clientId === filterClient)
    .filter(e => filterCategory === 'all' || e.category === filterCategory)
    .filter(e => filterStatus === 'all' || e.status === filterStatus)
    .filter(e => filterManager === 'all' || e.managerId === filterManager)
    .filter(e => filterTeam === 'all' || teamById.get(e.managerId) === filterTeam)
    .filter(e => !search ||
      (e.keyword ?? '').includes(search) || (e.opinionTitle ?? '').includes(search) ||
      e.managerName.includes(search) || e.clientName.includes(search) || (e.link ?? '').includes(search));

  const handleSave = (entry: ScheduleEntry) => {
    saveEntry(entry);
    setModal({ open: false });
  };
  const handleDelete = (id: string) => { if (confirm('삭제하시겠습니까?')) removeEntry(id); };

  const updateEntry = (id: string, patch: Partial<ScheduleEntry>) => patchEntry(id, patch);

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <Layout>
      <Header title="일일 스케줄" subtitle="오늘의 작업 현황을 확인하고 관리하세요" />
      <div className="flex-1 p-6 space-y-4">
        {/* Date Navigator + Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={nextDay} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={18} /></button>
              <span className="text-gray-600 font-medium text-sm hidden md:block">{displayDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{dayEntries.length}/{allDayEntries.length}건</span>
              {selfId && (
                <button onClick={toggleMine} title="내 담당 일정만 보기"
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-semibold transition-colors ${myView ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
                  <User size={14} /> 내 일정
                </button>
              )}
              <RankCollectButton />
              <button onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm transition-colors ${showFilters ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Filter size={14} /> 필터
              </button>
              <button onClick={() => setModal({ open: true, entry: null })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus size={16} /> 스케줄 추가
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="키워드, 제목, 담당자, 클라이언트, 링크 검색..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <TeamFilter teams={teams} value={filterTeam} onChange={setFilterTeam} />

          {showFilters && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  {CATEGORY_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                    </optgroup>
                  ))}
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

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '완료', count: allDayEntries.filter(e => e.status === 'completed').length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '진행중', count: allDayEntries.filter(e => e.status === 'in-progress').length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '대기중', count: allDayEntries.filter(e => e.status === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-2`}>
              <span className={`text-2xl font-bold ${s.color}`}>{s.count}</span>
              <span className="text-sm text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Table (md 이상) */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {dayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">조건에 맞는 스케줄이 없습니다</p>
              <button onClick={() => setModal({ open: true, entry: null })} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">스케줄 추가하기</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', '담당자', '클라이언트', '카테고리', '키워드/제목', '링크/내용', '순위', '이미지', '상태', '작업'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
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
                        <span className="truncate block" title={entry.opinionTitle ?? entry.keyword}>
                          {entry.opinionTitle ?? entry.keyword ?? '-'}
                        </span>
                        {isMultiDay(entry) && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            <CalendarRange size={10} /> {entry.date}~{entry.endDate}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {entry.category === '네이버 여론작업' && entry.opinionContent && (
                          <span className="text-xs text-gray-500 line-clamp-1 mb-1 block">{entry.opinionContent.slice(0, 50)}…</span>
                        )}
                        <InlineLink
                          link={entry.link}
                          onChange={v => updateEntry(entry.id, { link: v })}
                          onCopied={notify}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {entry.category === '네이버 여론작업' ? (
                          entry.metrics?.comments
                            ? <span className="text-xs text-sky-600 font-medium">💬{entry.metrics.comments}</span>
                            : <span className="text-gray-300 text-xs">-</span>
                        ) : <RankTabsBadge entry={entry} />}
                      </td>
                      <td className="px-4 py-3">
                        <InlineScreenshot
                          images={entryImages(entry)}
                          onImagesChange={imgs => updateEntry(entry.id, { images: imgs, screenshot: undefined })}
                          onPreview={setPreviewImg}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineStatus
                          status={entry.status}
                          onChange={s => updateEntry(entry.id, { status: s })}
                        />
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

        {/* Cards (모바일) */}
        <ScheduleCardList entries={dayEntries} onPatch={updateEntry} onPreview={setPreviewImg}
          onEdit={e => setModal({ open: true, entry: e })} onDelete={handleDelete} onCopied={notify}
          emptyText="조건에 맞는 스케줄이 없습니다." />
      </div>

      {modal.open && <ScheduleModal entry={modal.entry} onSave={handleSave} onClose={() => setModal({ open: false })} />}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="이미지" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      {/* Copy Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-xl">
          링크가 복사되었습니다.
        </div>
      )}
    </Layout>
  );
}

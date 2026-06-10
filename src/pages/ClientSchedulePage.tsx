import { useMemo, useState } from 'react';
import { useParams, NavLink, Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, CalendarRange, Building2, Search } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CategoryBadge from '../components/CategoryBadge';
import InlineStatus from '../components/InlineStatus';
import InlineScreenshot from '../components/InlineScreenshot';
import { entryImages } from '../utils/entryImages';
import InlineLink from '../components/InlineLink';
import ScheduleModal from '../components/ScheduleModal';
import ScheduleCardList from '../components/ScheduleCardList';
import type { ScheduleEntry } from '../types';
import { useApp } from '../context/AppContext';
import { useCopyToast } from '../hooks/useCopyToast';
import { isMultiDay } from '../utils/dateRange';

export default function ClientSchedulePage() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const { entries, saveEntry, removeEntry, patchEntry, clients } = useApp();
  const { notify, show: showToast } = useCopyToast();
  const [modal, setModal] = useState<{ open: boolean; entry?: ScheduleEntry | null }>({ open: false });
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');

  const client = clients.find(c => c.id === clientId);
  // 활성 클라이언트 (사이드바 목록 소스)
  const tabClients = clients.filter(c => c.status !== 'inactive');
  // 업체별 작업 수 — 사이드바에 표시
  const countByClient = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.clientId, (m.get(e.clientId) ?? 0) + 1);
    return m;
  }, [entries]);
  // 검색어로 사이드바 목록 추리기(업체명·업종)
  const q = clientSearch.trim().toLowerCase();
  const sidebarClients = q
    ? tabClients.filter(c => c.name.toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q))
    : tabClients;

  // 등록되지 않은 클라이언트면 첫 활성 클라이언트로 이동
  if (!client) {
    return tabClients[0]
      ? <Navigate to={`/client/${tabClients[0].id}`} replace />
      : (
        <Layout>
          <Header title="클라이언트별 스케줄" subtitle="업체별 작업 현황을 확인합니다" />
          <div className="flex-1 p-6">
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400">등록된 클라이언트가 없습니다.</div>
          </div>
        </Layout>
      );
  }

  const filtered = entries
    .filter(e => e.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (entry: ScheduleEntry) => {
    saveEntry(entry);
    setModal({ open: false });
  };
  const handleDelete = (id: string) => { if (confirm('삭제하시겠습니까?')) removeEntry(id); };
  const updateEntry = (id: string, patch: Partial<ScheduleEntry>) => patchEntry(id, patch);

  const completed = filtered.filter(e => e.status === 'completed').length;
  const inProg = filtered.filter(e => e.status === 'in-progress').length;
  const pending = filtered.filter(e => e.status === 'pending').length;

  return (
    <Layout>
      <Header title="클라이언트별 스케줄" subtitle="업체별 작업 현황을 확인합니다" />
      <div className="flex-1 p-6">
       <div className="flex flex-col lg:flex-row gap-4">
        {/* 업체 검색 사이드바 */}
        <aside className="lg:w-72 lg:shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 lg:sticky lg:top-6">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                placeholder="업체 검색…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1 max-h-[40vh] lg:max-h-[calc(100vh-180px)] overflow-y-auto pr-0.5">
              {sidebarClients.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다</p>
              ) : sidebarClients.map(c => (
                <NavLink key={c.id} to={`/client/${c.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'}`
                  }>
                  {({ isActive }) => (
                    <>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{c.name[0]}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate leading-tight">{c.name}</p>
                        <p className={`text-[11px] truncate leading-tight ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{c.industry || '업종 미지정'} · {countByClient.get(c.id) ?? 0}건</p>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </aside>

        {/* 선택 업체 상세 */}
        <div className="flex-1 min-w-0 space-y-4">
        {/* Client Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl font-bold">{client.name[0]}</div>
              <div>
                <h2 className="text-xl font-bold">{client.name}</h2>
                <p className="text-white/80 text-sm">{client.industry || '업종 미지정'} · 총 {filtered.length}개 작업</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {client.categories.map(c => (
                    <span key={c} className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
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

        {/* Schedule Table (md 이상) */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3"><Building2 size={22} /></div>
              <p className="font-medium text-gray-500">{client.name}에 등록된 스케줄이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', '날짜', '담당자', '카테고리', '키워드/제목', '링크', '순위', '이미지', '상태', '작업'].map(h => (
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
                      <td className="px-4 py-3"><CategoryBadge category={entry.category} /></td>
                      <td className="px-4 py-3 text-gray-800 max-w-[180px]">
                        <span className="truncate block" title={entry.opinionTitle ?? entry.keyword}>{entry.opinionTitle ?? entry.keyword ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <InlineLink link={entry.link} onChange={v => updateEntry(entry.id, { link: v })} onCopied={notify} />
                      </td>
                      <td className="px-4 py-3">
                        {entry.rank ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">{entry.rank}</span> : <span className="text-gray-300">-</span>}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cards (모바일) */}
        <ScheduleCardList entries={filtered} onPatch={updateEntry} onPreview={setPreviewImg}
          onEdit={e => setModal({ open: true, entry: e })} onDelete={handleDelete} onCopied={notify}
          emptyText={`${client.name}에 등록된 스케줄이 없습니다`} />
        </div>{/* 상세 끝 */}
       </div>{/* flex 행 끝 */}
      </div>

      {modal.open && (
        <ScheduleModal
          entry={modal.entry}
          defaultClientId={clientId}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
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

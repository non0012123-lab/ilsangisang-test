import { useMemo, useState } from 'react';
import { X, Sparkles, ChevronDown, ChevronUp, Repeat, Plus } from 'lucide-react';
import type { ScheduleEntry, Category, ScheduleStatus, AIMetrics, Recurrence, SearchTab } from '../types';
import { useApp } from '../context/AppContext';
import ImageDropzone from './ImageDropzone';
import ImageThumb from './ImageThumb';
import { MAX_IMAGES, entryImages } from '../utils/entryImages';
import { openExternal } from '../utils/openExternal';
import { recurrenceOccurrences } from '../utils/recurrence';
import { CATEGORY_GROUPS, CATEGORY_METRICS, catLabel } from '../data/categories';
import { SEARCH_TAB_ORDER, SEARCH_TAB_LABEL, SEARCH_TAB_SHORT, isRankTrackedCategory, isMultiLinkCategory, entryLinks, defaultSearchTabs, foundRanks } from '../utils/searchTabs';

// 반복 옵션(UI) → Recurrence 규칙 매핑. 'none' 이면 반복 없음(단건).
type RecurOpt = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
const RECUR_OPTS: { v: RecurOpt; label: string }[] = [
  { v: 'none', label: '반복 없음' },
  { v: 'daily', label: '매일' },
  { v: 'weekly', label: '매주(같은 요일)' },
  { v: 'biweekly', label: '격주' },
  { v: 'monthly', label: '매월(같은 일자)' },
];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
// 'YYYY-MM-DD' → 요일(0~6), 로컬 기준(UTC 파싱 오차 방지)
const wdOf = (s?: string): number => { if (!s) return 0; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
// UI 옵션 + 시작일 → Recurrence 규칙
const buildRecurrence = (opt: RecurOpt, startStr: string, count: number, until?: string): Recurrence | null => {
  if (opt === 'none') return null;
  const [y, m, d] = startStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const base = { count: Math.max(1, count), until: until || undefined };
  if (opt === 'daily') return { freq: 'daily', interval: 1, ...base };
  if (opt === 'weekly') return { freq: 'weekly', interval: 1, weekday: wd, ...base };
  if (opt === 'biweekly') return { freq: 'weekly', interval: 2, weekday: wd, ...base };
  return { freq: 'monthly', interval: 1, day: d, ...base }; // monthly
};

const STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in-progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

const IS_OPINION = (cat: Category) => cat === '네이버 여론작업';

interface Props {
  entry?: ScheduleEntry | null;
  defaultDate?: string;
  defaultClientId?: string;
  prefill?: Partial<ScheduleEntry>;   // 신규 등록 시 초기값 주입(요청함→일정 등록 등). entry(수정)와 동시 사용 안 함.
  onSave: (entry: ScheduleEntry) => void;
  onCreated?: (entries: ScheduleEntry[]) => void;  // 단건/반복 모두 생성 직후 호출(요청 연결 등 후처리용)
  onClose: () => void;
}

export default function ScheduleModal({ entry, defaultDate, defaultClientId, prefill, onSave, onCreated, onClose }: Props) {
  const { clients, members, saveEntries } = useApp();
  const activeClients = clients.filter(c => c.status !== 'inactive');
  const defaultClient = activeClients.find(c => c.id === defaultClientId) ?? activeClients[0];
  const isEdit = !!entry; // 반복은 신규 등록에서만 (수정은 단건)

  const [form, setForm] = useState<Partial<ScheduleEntry>>(() => {
    if (entry) {
      // 다건(여론작업·배포성) 편집 시 레거시 호환: links 없으면 단일 link 에서, 주제는 keyword(없으면 옛 opinionTitle)로.
      const e: Partial<ScheduleEntry> = { ...entry };
      if (isMultiLinkCategory(e.category)) {
        e.links = entryLinks(e); // 붙어있던 레거시 링크도 URL 단위로 분리해 편집
        if (!e.keyword && e.opinionTitle) e.keyword = e.opinionTitle;
      }
      return e;
    }
    return {
      date: defaultDate ?? new Date().toISOString().split('T')[0],
      status: 'pending',
      category: 'SNS',
      clientId: defaultClient?.id ?? '',
      clientName: defaultClient?.name ?? '',
      managerId: members[0]?.id ?? '',
      managerName: members[0]?.name ?? '',
      ...prefill,   // 요청함 등에서 추론한 값으로 기본값 덮어쓰기(값 있는 키만)
    };
  });
  const [metrics, setMetrics] = useState<AIMetrics>(entry?.metrics ?? {});
  const [showMetrics, setShowMetrics] = useState(!!entry?.metrics);
  const [aiLoading, setAiLoading] = useState(false);
  // 반복 설정(신규 등록 전용)
  const [recurOpt, setRecurOpt] = useState<RecurOpt>('none');
  const [recurCount, setRecurCount] = useState(12);
  const [recurUntil, setRecurUntil] = useState('');

  // 반복 미리보기 — 생성될 발생일 목록(최대 몇 개만 보여주고 총 개수 표기)
  const recurPreview = useMemo(() => {
    if (isEdit || recurOpt === 'none' || !form.date) return null;
    const rec = buildRecurrence(recurOpt, form.date, recurCount, recurUntil || undefined);
    if (!rec) return null;
    const endDate = form.endDate && form.endDate > form.date ? form.endDate : undefined;
    return recurrenceOccurrences(form.date, endDate, rec).map(o => o.date);
  }, [isEdit, recurOpt, recurCount, recurUntil, form.date, form.endDate]);

  const set = (key: keyof ScheduleEntry, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // 다건(여론작업·배포성) — 링크 여러 개(=건수). 주제는 keyword.
  const isMulti = isMultiLinkCategory(form.category);
  const links = form.links ?? [];
  const addLink = () => set('links', [...links, '']);
  const updateLink = (i: number, v: string) => set('links', links.map((l, idx) => idx === i ? v : l));
  const removeLink = (i: number) => set('links', links.filter((_, idx) => idx !== i));

  // 순위 수집 탭(다중). 미설정이면 카테고리 기본값을 보여주고, 토글하면 명시 저장.
  const searchTabs = form.searchTabs ?? defaultSearchTabs(form.category);
  const toggleTab = (t: SearchTab) => {
    const next = searchTabs.includes(t) ? searchTabs.filter(x => x !== t) : [...searchTabs, t];
    set('searchTabs', SEARCH_TAB_ORDER.filter(x => next.includes(x)));  // 표준 순서로 정규화 저장
  };
  // 롱테일은 '순위 잡힌 탭이 있는 것'만 표시(둘 다 미노출이면 애초에 없어야 함 — 안전망).
  const rankedSubs = (form.subKeywords ?? []).filter(s => foundRanks(s.rankByTab).length > 0);

  // 이미지(시안/인사이트) — 레거시 screenshot/문자열 호환 + 신규 {url,kind} 배열, 최대 MAX_IMAGES 장
  const images = entryImages(form);
  const setImages = (imgs: typeof images) => setForm(prev => ({ ...prev, images: imgs, screenshot: undefined }));
  const addImage = (url: string) => { setImages([...images, { url, kind: 'design' as const }].slice(0, MAX_IMAGES)); setShowMetrics(true); };
  const removeImage = (i: number) => setImages(images.filter((_, idx) => idx !== i));
  const toggleKind = (i: number) => setImages(images.map((im, idx) => idx === i ? { ...im, kind: im.kind === 'insight' ? 'design' : 'insight' } : im));

  const setMetric = (key: keyof AIMetrics, value: string) => {
    const num = Number(value.replace(/,/g, ''));
    setMetrics(prev => ({ ...prev, [key]: isNaN(num) ? value : (value === '' ? undefined : num) }));
  };

  const handleClient = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    if (c) setForm(prev => ({ ...prev, clientId: c.id, clientName: c.name }));
  };

  const handleManager = (id: string) => {
    const u = members.find(u => u.id === id);
    if (u) setForm(prev => ({ ...prev, managerId: u.id, managerName: u.name }));
  };

  const handleAiAnalyze = () => {
    // AI 분석 기능 준비 중 - 실제 구현 시 백엔드 API 호출
    setAiLoading(true);
    setTimeout(() => {
      setAiLoading(false);
      alert('AI 자동 분석 기능은 백엔드 연동 후 사용 가능합니다.\n현재는 수동으로 수치를 입력해주세요.');
    }, 1200);
  };

  const handleSubmit = () => {
    if (!form.date || !form.clientId || !form.managerId) { alert('필수 항목을 입력해주세요.'); return; }
    if (!form.keyword) { alert(isMulti ? '주제(키워드)를 입력해주세요.' : '키워드를 입력해주세요.'); return; }
    // 다건: 빈 링크 제거. link 는 첫 링크로(단일 링크만 읽는 화면 호환).
    const cleanLinks = isMulti ? links.map(l => l.trim()).filter(Boolean) : [];
    // 마감일이 시작일보다 앞서면 무효 처리
    const endDate = form.endDate && form.endDate > form.date! ? form.endDate : undefined;

    const hasMetrics = Object.values(metrics).some(v => v !== undefined && v !== '');
    // 순위 수집 대상 카테고리면 선택 탭(미설정 시 기본값)을 저장. 그 외엔 탭 없음.
    const tabsForSave = isRankTrackedCategory(form.category)
      ? (form.searchTabs ?? defaultSearchTabs(form.category))
      : undefined;
    const common = {
      managerId: form.managerId!, managerName: form.managerName!,
      category: form.category!, clientId: form.clientId!, clientName: form.clientName!,
      status: form.status!,
      keyword: form.keyword,
      link: isMulti ? (cleanLinks[0] ?? undefined) : form.link,
      links: isMulti && cleanLinks.length ? cleanLinks : undefined,
      rank: form.rank,
      searchTabs: tabsForSave, rankByTab: form.rankByTab, rankCheckedAt: form.rankCheckedAt,
      postTitle: form.postTitle, subKeywords: form.subKeywords,
      // 레거시 여론작업 필드는 신규 입력에서 제거(기존 데이터가 있으면 편집 시 그대로 보존)
      opinionTitle: form.opinionTitle, opinionContent: form.opinionContent, opinionComments: form.opinionComments,
      images: images.length ? images : undefined, screenshot: undefined,
      metrics: hasMetrics ? { ...metrics, aiAnalyzed: false } : undefined,
      notes: form.notes,
    };

    // 반복 설정이 있으면(신규 등록) 해당 날짜마다 실제 일정 N개를 한 번에 생성하고 seriesId 로 묶는다.
    const rec = isEdit ? null : buildRecurrence(recurOpt, form.date!, recurCount, recurUntil || undefined);
    if (rec) {
      const occ = recurrenceOccurrences(form.date!, endDate, rec);
      if (occ.length === 0) { alert('생성할 반복 일정이 없습니다. 횟수/종료일을 확인해주세요.'); return; }
      const seriesId = `srs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const series: ScheduleEntry[] = occ.map((o, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date: o.date, endDate: o.endDate, seriesId,
        recurrence: i === 0 ? rec : undefined, // 시리즈 대표 정보는 첫 회차에만
        ...common,
      }));
      saveEntries(series);
      onCreated?.(series);
      onClose();
      return;
    }

    const newEntry: ScheduleEntry = { id: entry?.id ?? Date.now().toString(), date: form.date!, endDate, ...common };
    onSave(newEntry);
    onCreated?.([newEntry]);
  };

  const managers = members;
  const isOpinion = IS_OPINION(form.category as Category);
  const metricFields = CATEGORY_METRICS[form.category ?? 'SNS'] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{entry ? '스케줄 수정' : '스케줄 추가'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* 날짜: 시작일 / 마감일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">시작일 *</label>
              <input type="date" value={form.date ?? ''} onChange={e => set('date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                마감일 <span className="text-gray-400 font-normal">(선택 · 기간 작업)</span>
              </label>
              <input type="date" value={form.endDate ?? ''} min={form.date}
                onChange={e => set('endDate', e.target.value || undefined)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {form.endDate && form.date && form.endDate > form.date && (
            <p className="-mt-2 text-xs text-blue-600">
              📅 {form.date} ~ {form.endDate} 기간 작업으로 타임테이블에 자동 표시됩니다.
            </p>
          )}

          {/* 반복 설정 — 신규 등록에서만. 선택 시 해당 날짜마다 실제 일정이 생성됨 */}
          {!isEdit && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-3 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <Repeat size={14} className="text-blue-600" />
                <label className="text-xs font-semibold text-gray-700">반복</label>
                <select value={recurOpt} onChange={e => setRecurOpt(e.target.value as RecurOpt)}
                  className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {RECUR_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              {recurOpt !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">횟수</label>
                      <input type="number" min={1} max={366} value={recurCount} disabled={!!recurUntil}
                        onChange={e => setRecurCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">또는 종료일(선택)</label>
                      <input type="date" value={recurUntil} min={form.date}
                        onChange={e => setRecurUntil(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {recurUntil && <button type="button" onClick={() => setRecurUntil('')} className="text-[11px] text-gray-400 hover:text-gray-600">종료일 지우고 횟수로</button>}
                  {recurPreview && (
                    <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2.5 py-2 leading-relaxed">
                      🔁 {recurOpt === 'monthly' ? `매월 ${Number(form.date?.split('-')[2])}일` : recurOpt === 'weekly' ? `매주 ${WD[wdOf(form.date)]}요일` : recurOpt === 'biweekly' ? `격주 ${WD[wdOf(form.date)]}요일` : '매일'}
                      {' · '}총 <strong>{recurPreview.length}</strong>개 생성
                      <br />
                      <span className="text-blue-600/80">{recurPreview.slice(0, 5).join(', ')}{recurPreview.length > 5 ? ` … ${recurPreview[recurPreview.length - 1]}` : ''}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">상태 *</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">담당자 *</label>
              <select value={form.managerId} onChange={e => handleManager(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {managers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">클라이언트 *</label>
              <select value={form.clientId} onChange={e => handleClient(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">카테고리 *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORY_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {!isMulti && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">순위</label>
                <input type="number" min={1} value={form.rank ?? ''} onChange={e => set('rank', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="예: 3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          {/* 순위 수집 탭 — 블로그/카페 상위노출·블로그관리에서만, 다중 선택 */}
          {!isOpinion && isRankTrackedCategory(form.category) && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                순위 수집 탭 <span className="text-gray-400 font-normal">(다중 선택 · 선택한 탭에서 자동 수집, 대표 순위는 최고값)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SEARCH_TAB_ORDER.map(t => {
                  const sel = searchTabs.includes(t);
                  const r = form.rankByTab?.[t];
                  return (
                    <button type="button" key={t} onClick={() => toggleTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {SEARCH_TAB_LABEL[t]}{sel && r != null ? ` · ${r}위` : ''}
                    </button>
                  );
                })}
              </div>
              {searchTabs.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">탭을 1개 이상 선택해야 순위를 수집합니다.</p>
              )}
            </div>
          )}

          {/* 롱테일(발굴된 것만 읽기전용) — 수집기가 순위 잡힌 롱테일만 자동 기입 */}
          {!isOpinion && isRankTrackedCategory(form.category) && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/60">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  글 제목 <span className="text-gray-400 font-normal">(선택 · 롱테일 발굴 입력 · 수집 시 자동 채워짐)</span>
                </label>
                <input type="text" value={form.postTitle ?? ''} onChange={e => set('postTitle', e.target.value)}
                  placeholder="예: 신도림 술집 추천 가성비로 2차하기 좋은 곳"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500">발굴된 롱테일 <span className="text-gray-400 font-normal">(순위 잡힌 것만 · 수집기 자동)</span></span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{rankedSubs.length}개</span>
                  {rankedSubs.length > 0 && (
                    <button type="button" onClick={() => set('subKeywords', [])} className="text-[11px] text-red-500 hover:text-red-600 hover:underline">모두 삭제</button>
                  )}
                </span>
              </div>
              {rankedSubs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rankedSubs.map(s => (
                    <span key={s.keyword} title={s.source}
                      className="inline-flex items-center gap-1.5 px-2 h-6 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-700">
                      {s.keyword}
                      {foundRanks(s.rankByTab).map(f => <span key={f.tab} className="font-semibold text-blue-600">{SEARCH_TAB_SHORT[f.tab]} {f.rank}위</span>)}
                      <button type="button" onClick={() => set('subKeywords', (form.subKeywords ?? []).filter(x => x.keyword !== s.keyword))}
                        className="text-gray-300 hover:text-red-500"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">아직 발굴된 롱테일이 없습니다. 순위 수집 시 자동으로 채워집니다.</p>
              )}
            </div>
          )}

          {/* Dynamic fields — 모든 카테고리 공통: 키워드(주제). 다건(여론작업·배포성)은 링크 여러 개(=건수). */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{isMulti ? '주제 (키워드) *' : '키워드 *'}</label>
            <input type="text" value={form.keyword ?? ''} onChange={e => set('keyword', e.target.value)}
              placeholder={isMulti ? '예: 탈모이식' : '검색 키워드 입력'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {isMulti ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600">
                  링크 <span className="text-gray-400 font-normal">· 한 건당 링크 하나 (링크 수 = 건수)</span>
                </label>
                <span className="text-[11px] font-semibold text-sky-600">{links.filter(l => l.trim()).length}건</span>
              </div>
              <div className="space-y-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <input type="url" value={l} onChange={e => updateLink(i, e.target.value)}
                      placeholder="https://cafe.naver.com/..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={() => removeLink(i)} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={addLink}
                  className="flex items-center justify-center gap-1.5 w-full py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-sky-300 hover:text-sky-500 transition-colors">
                  <Plus size={13} /> 링크 추가
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                링크 <span className="text-gray-400 font-normal">(선택 · 작업 후 입력 가능)</span>
              </label>
              <input type="url" value={form.link ?? ''} onChange={e => set('link', e.target.value)}
                placeholder="https://example.com (나중에 표에서 바로 추가 가능)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {/* 이미지 (시안/결과물) — 최대 MAX_IMAGES 장, 드래그앤드롭 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              이미지 <span className="text-gray-400 font-normal">(최대 {MAX_IMAGES}장 · 배지로 시안/인사이트 전환 — 인사이트는 보고서에 크게 표시)</span>
            </label>
            {images.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
                {images.map((img, i) => (
                  <ImageThumb key={i} img={img} onClick={() => openExternal(img.url)} onToggleKind={() => toggleKind(i)} onRemove={() => removeImage(i)} />
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES
              ? <ImageDropzone className="w-full h-32" onImage={addImage} />
              : <p className="text-xs text-amber-600 py-1">최대 {MAX_IMAGES}장까지 첨부할 수 있습니다.</p>}
          </div>

          {/* AI Metrics Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setShowMetrics(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-blue-500" />
                <span className="text-sm font-semibold text-gray-700">인사이트 데이터 (AI 분석 연동)</span>
                {metrics && Object.values(metrics).some(v => v !== undefined) && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">입력됨</span>
                )}
              </div>
              {showMetrics ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {showMetrics && (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">
                    이미지의 인사이트 수치를 입력하세요. 향후 AI 자동 분석이 지원됩니다.
                  </p>
                  <button onClick={handleAiAnalyze} disabled={images.length === 0 || aiLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      images.length > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}>
                    <Sparkles size={12} />
                    {aiLoading ? 'AI 분석 중...' : 'AI 자동 분석'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {metricFields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                      <input
                        type={f.key === 'watchTime' ? 'text' : 'number'}
                        value={(metrics[f.key] as string | number | undefined) ?? ''}
                        onChange={e => setMetric(f.key, e.target.value)}
                        placeholder={f.key === 'watchTime' ? '예: 4:22' : '0'}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="추가 메모 사항"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
          <button onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            {entry ? '수정하기' : '추가하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

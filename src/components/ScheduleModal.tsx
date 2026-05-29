import { useState, useRef, type ChangeEvent } from 'react';
import { X, Upload, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { ScheduleEntry, Category, ScheduleStatus, AIMetrics } from '../types';
import { USERS } from '../data/mockData';
import { useApp } from '../context/AppContext';

const CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];
const STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in-progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

// Category → relevant AI metrics
const METRIC_FIELDS: Record<string, { key: keyof AIMetrics; label: string }[]> = {
  SNS:            [{ key: 'impressions', label: '노출수' }, { key: 'reach', label: '도달수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }, { key: 'saves', label: '저장수' }, { key: 'shares', label: '공유수' }, { key: 'followers', label: '팔로워 증가' }],
  유튜브:         [{ key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }, { key: 'subscribers', label: '구독자 증가' }, { key: 'watchTime', label: '평균 시청시간' }],
  네이버:         [{ key: 'blogViews', label: '블로그 조회수' }, { key: 'cafeViews', label: '카페 조회수' }, { key: 'clicks', label: '클릭수' }, { key: 'comments', label: '댓글수' }],
  영상제작:       [{ key: 'views', label: '조회수' }, { key: 'likes', label: '좋아요' }, { key: 'comments', label: '댓글수' }],
  디자인제작:     [{ key: 'impressions', label: '노출수' }, { key: 'saves', label: '저장수' }, { key: 'clicks', label: '클릭수' }],
  '네이버 여론작업': [{ key: 'views', label: '조회수' }, { key: 'comments', label: '댓글수' }],
  기타:           [{ key: 'views', label: '조회수' }, { key: 'clicks', label: '클릭수' }],
};

const IS_OPINION = (cat: Category) => cat === '네이버 여론작업';

interface Props {
  entry?: ScheduleEntry | null;
  defaultDate?: string;
  onSave: (entry: ScheduleEntry) => void;
  onClose: () => void;
}

export default function ScheduleModal({ entry, defaultDate, onSave, onClose }: Props) {
  const { clients } = useApp();
  const activeClients = clients.filter(c => c.status !== 'inactive');
  const defaultClient = activeClients[0];

  const [form, setForm] = useState<Partial<ScheduleEntry>>(
    entry ?? {
      date: defaultDate ?? new Date().toISOString().split('T')[0],
      status: 'pending',
      category: 'SNS',
      clientId: defaultClient?.id ?? '',
      clientName: defaultClient?.name ?? '',
      managerId: USERS.find(u => u.role !== 'client')?.id ?? '',
      managerName: USERS.find(u => u.role !== 'client')?.name ?? '',
    }
  );
  const [metrics, setMetrics] = useState<AIMetrics>(entry?.metrics ?? {});
  const [showMetrics, setShowMetrics] = useState(!!entry?.metrics);
  const [aiLoading, setAiLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof ScheduleEntry, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setMetric = (key: keyof AIMetrics, value: string) => {
    const num = Number(value.replace(/,/g, ''));
    setMetrics(prev => ({ ...prev, [key]: isNaN(num) ? value : (value === '' ? undefined : num) }));
  };

  const handleClient = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    if (c) setForm(prev => ({ ...prev, clientId: c.id, clientName: c.name }));
  };

  const handleManager = (id: string) => {
    const u = USERS.find(u => u.id === id);
    if (u) setForm(prev => ({ ...prev, managerId: u.id, managerName: u.name }));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      set('screenshot', ev.target?.result as string);
      setShowMetrics(true);
    };
    reader.readAsDataURL(file);
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
    const opinion = IS_OPINION(form.category as Category);
    if (!form.date || !form.clientId || !form.managerId) { alert('필수 항목을 입력해주세요.'); return; }
    if (opinion && !form.opinionTitle) { alert('제목을 입력해주세요.'); return; }
    if (!opinion && !form.keyword) { alert('키워드를 입력해주세요.'); return; }
    // 마감일이 시작일보다 앞서면 무효 처리
    const endDate = form.endDate && form.endDate > form.date! ? form.endDate : undefined;

    const hasMetrics = Object.values(metrics).some(v => v !== undefined && v !== '');
    onSave({
      id: entry?.id ?? Date.now().toString(),
      date: form.date!, endDate, managerId: form.managerId!, managerName: form.managerName!,
      category: form.category!, clientId: form.clientId!, clientName: form.clientName!,
      status: form.status!,
      keyword: form.keyword, link: form.link, rank: form.rank,
      opinionTitle: form.opinionTitle, opinionContent: form.opinionContent, opinionComments: form.opinionComments,
      screenshot: form.screenshot,
      metrics: hasMetrics ? { ...metrics, aiAnalyzed: false } : undefined,
      notes: form.notes,
    });
  };

  const managers = USERS.filter(u => u.role !== 'client');
  const isOpinion = IS_OPINION(form.category as Category);
  const metricFields = METRIC_FIELDS[form.category ?? 'SNS'] ?? [];

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
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {!isOpinion && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">순위</label>
                <input type="number" min={1} value={form.rank ?? ''} onChange={e => set('rank', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="예: 3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          {/* Dynamic fields */}
          {isOpinion ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">제목 *</label>
                <input type="text" value={form.opinionTitle ?? ''} onChange={e => set('opinionTitle', e.target.value)}
                  placeholder="여론 분석 제목"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">내용</label>
                <textarea value={form.opinionContent ?? ''} onChange={e => set('opinionContent', e.target.value)} rows={3}
                  placeholder="분석 내용 및 여론 요약"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">댓글</label>
                <textarea value={form.opinionComments ?? ''} onChange={e => set('opinionComments', e.target.value)} rows={2}
                  placeholder="주요 댓글 내용 (예: &quot;좋아요~&quot; / &quot;별로에요&quot;)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  링크 <span className="text-gray-400 font-normal">(선택 · 해당 게시물/검색결과 바로가기)</span>
                </label>
                <input type="url" value={form.link ?? ''} onChange={e => set('link', e.target.value)}
                  placeholder="https://cafe.naver.com/..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">키워드 *</label>
                <input type="text" value={form.keyword ?? ''} onChange={e => set('keyword', e.target.value)}
                  placeholder="검색 키워드 입력"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  링크 <span className="text-gray-400 font-normal">(선택 · 작업 후 입력 가능)</span>
                </label>
                <input type="url" value={form.link ?? ''} onChange={e => set('link', e.target.value)}
                  placeholder="https://example.com (나중에 표에서 바로 추가 가능)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {/* Screenshot */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">캡처본</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {form.screenshot ? (
              <div className="flex items-start gap-3">
                <div className="relative inline-block">
                  <img src={form.screenshot} alt="캡처본" className="h-20 rounded-lg border border-gray-200 object-cover cursor-pointer"
                    onClick={() => window.open(form.screenshot, '_blank')} />
                  <button onClick={() => { set('screenshot', undefined); setShowMetrics(false); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    <X size={10} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                    <Upload size={12} /> 교체
                  </button>
                  <p className="text-xs text-gray-400">클릭 시 원본 보기</p>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors w-full justify-center">
                <Upload size={14} /> 캡처본 업로드
              </button>
            )}
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
                    캡처본의 인사이트 수치를 입력하세요. 향후 AI 자동 분석이 지원됩니다.
                  </p>
                  <button onClick={handleAiAnalyze} disabled={!form.screenshot || aiLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      form.screenshot
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

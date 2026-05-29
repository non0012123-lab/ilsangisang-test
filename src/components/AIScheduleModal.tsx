import { useState } from 'react';
import { X, Sparkles, AlertTriangle, Trash2, CalendarPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ScheduleEntry, Category, ScheduleStatus } from '../types';

const CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];
const STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in-progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

interface Draft {
  tempId: string;
  date: string;
  endDate: string;
  managerId: string;
  clientId: string;
  category: string;
  keyword: string;
  status: ScheduleStatus;
}

interface Props {
  onClose: () => void;
  onAdd: (entries: ScheduleEntry[]) => void;
}

export default function AIScheduleModal({ onClose, onAdd }: Props) {
  const { members, clients } = useApp();
  const activeClients = clients.filter(c => c.status !== 'inactive');

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  const matchManager = (name: string) => {
    if (!name) return '';
    const exact = members.find(m => m.name === name);
    if (exact) return exact.id;
    const part = members.find(m => name.includes(m.name) || m.name.includes(name));
    return part?.id ?? '';
  };
  const matchClient = (name: string) => {
    if (!name) return '';
    const exact = activeClients.find(c => c.name === name);
    if (exact) return exact.id;
    const part = activeClients.find(c => name.includes(c.name) || c.name.includes(name));
    return part?.id ?? '';
  };
  const matchCategory = (name: string): string =>
    (CATEGORIES as string[]).includes(name) ? name : (CATEGORIES.find(c => name?.includes(c)) ?? '기타');

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          today: new Date().toISOString().slice(0, 10),
          managers: members.map(m => m.name),
          clients: activeClients.map(c => c.name),
          categories: CATEGORIES,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-schedule)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      const parsed: Draft[] = (Array.isArray(data.entries) ? data.entries : []).map((e: Record<string, unknown>, i: number) => ({
        tempId: `${Date.now()}-${i}`,
        date: (e.date as string) ?? '',
        endDate: (e.endDate as string) && (e.endDate as string) !== 'null' ? (e.endDate as string) : '',
        managerId: matchManager((e.managerName as string) ?? ''),
        clientId: matchClient((e.clientName as string) ?? ''),
        category: matchCategory((e.category as string) ?? ''),
        keyword: (e.keyword as string) ?? '',
        status: (['pending', 'in-progress', 'completed'].includes(e.status as string) ? e.status : 'pending') as ScheduleStatus,
      }));
      if (parsed.length === 0) throw new Error('일정을 추출하지 못했습니다. 담당자·날짜·업체·종류를 좀 더 명확히 적어주세요.');
      setDrafts(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts(prev => prev?.map(d => d.tempId === id ? { ...d, ...patch } : d) ?? null);
  const remove = (id: string) => setDrafts(prev => prev?.filter(d => d.tempId !== id) ?? null);

  const isValid = (d: Draft) => d.date && d.managerId && d.clientId && d.category;
  const canRegister = !!drafts && drafts.length > 0 && drafts.every(isValid);

  const register = () => {
    if (!drafts) return;
    const entries: ScheduleEntry[] = drafts.map((d, i) => {
      const m = members.find(x => x.id === d.managerId);
      const c = activeClients.find(x => x.id === d.clientId);
      const endDate = d.endDate && d.endDate > d.date ? d.endDate : undefined;
      return {
        id: `${Date.now()}-${i}`,
        date: d.date,
        endDate,
        managerId: d.managerId,
        managerName: m?.name ?? '',
        category: d.category as Category,
        keyword: d.keyword || undefined,
        clientId: d.clientId,
        clientName: c?.name ?? '',
        status: d.status,
      };
    });
    onAdd(entries);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            <h2 className="text-lg font-bold text-gray-900">AI 자동 완성 · 채팅으로 일정 등록</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* 입력 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">무엇을, 언제, 누가 할지 자유롭게 적어주세요</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="예: 이수연 6월 3일 스타벅스 SNS 신메뉴 키워드, 박지훈 다음주 월요일 현대차 네이버 블로그"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex justify-end mt-2">
              <button onClick={analyze} disabled={loading || !text.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  loading || !text.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white'
                }`}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 분석 중...</>
                  : <><Sparkles size={14} /> AI로 분석</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {/* 미리보기 */}
          {drafts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">미리보기 ({drafts.length}건) · 확인 후 등록하세요</p>
                <p className="text-xs text-gray-400">빨간 항목은 매칭이 안 됐어요. 직접 골라주세요.</p>
              </div>

              {drafts.map(d => {
                const need = (ok: unknown) => ok ? 'border-gray-200' : 'border-red-300 bg-red-50';
                return (
                  <div key={d.tempId} className="border border-gray-100 rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 gap-2 relative">
                    <button onClick={() => remove(d.tempId)}
                      className="absolute top-2 right-2 p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">시작일</label>
                      <input type="date" value={d.date} onChange={e => update(d.tempId, { date: e.target.value })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${need(d.date)}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">마감일 <span className="text-gray-300 font-normal">(선택)</span></label>
                      <input type="date" value={d.endDate} min={d.date} onChange={e => update(d.tempId, { endDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">담당자</label>
                      <select value={d.managerId} onChange={e => update(d.tempId, { managerId: e.target.value })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${need(d.managerId)}`}>
                        <option value="">선택</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">업체</label>
                      <select value={d.clientId} onChange={e => update(d.tempId, { clientId: e.target.value })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${need(d.clientId)}`}>
                        <option value="">선택</option>
                        {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">카테고리</label>
                      <select value={d.category} onChange={e => update(d.tempId, { category: e.target.value })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${need(d.category)}`}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">상태</label>
                      <select value={d.status} onChange={e => update(d.tempId, { status: e.target.value as ScheduleStatus })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">키워드/주제</label>
                      <input type="text" value={d.keyword} onChange={e => update(d.tempId, { keyword: e.target.value })}
                        placeholder="작업 핵심 키워드"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
          <button onClick={register} disabled={!canRegister}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              canRegister ? 'text-white bg-blue-600 hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            <CalendarPlus size={15} /> {drafts ? `${drafts.length}건 타임테이블에 등록` : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, CalendarPlus, Check, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { ScheduleEntry, Category, ScheduleStatus } from '../types';

const CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];
const STATUS_LABEL: Record<string, string> = { pending: '대기중', 'in-progress': '진행중', completed: '완료' };

const EXAMPLES = [
  '오늘 스케줄 시간 분배는 어떻게 하는 게 효율적일까?',
  '내일 스타벅스 SNS 신메뉴 키워드 작업 등록해줘',
  '6월 2일부터 6월 6일까지 네이버 블로그 5건 담당자별로 배분해줘',
];

interface ProposedEntry {
  date?: string; endDate?: string | null; managerName?: string; clientName?: string;
  category?: string; keyword?: string; status?: string;
}
interface ProposedUpdate {
  id?: string; date?: string | null; endDate?: string | null; managerName?: string | null; status?: string | null;
}
interface Msg {
  role: 'user' | 'assistant';
  text: string;
  entries?: ProposedEntry[];
  updates?: ProposedUpdate[];
  applied?: number; // 적용한 건수 (적용 후 표시)
}

export default function DashboardAssistant() {
  const { entries, members, clients, saveEntries, patchEntry } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeClients = clients.filter(c => c.status !== 'inactive');
  const selfId = user?.id && members.some(m => m.id === user.id) ? user.id : '';
  // 어시스턴트가 참고할 일정: admin 은 전체, 담당자는 본인 것
  const scopedEntries = isAdmin ? entries : entries.filter(e => e.managerId === user?.id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const matchManager = (name?: string) => {
    if (!name) return '';
    const exact = members.find(m => m.name === name);
    if (exact) return exact.id;
    return members.find(m => name.includes(m.name) || m.name.includes(name))?.id ?? '';
  };
  const matchClient = (name?: string) => {
    if (!name) return '';
    const exact = activeClients.find(c => c.name === name);
    if (exact) return exact.id;
    return activeClients.find(c => name.includes(c.name) || c.name.includes(name))?.id ?? '';
  };
  const matchCategory = (name?: string): Category =>
    (CATEGORIES as string[]).includes(name ?? '') ? (name as Category) : (CATEGORIES.find(c => name?.includes(c)) ?? '기타');

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          today: new Date().toISOString().slice(0, 10),
          managers: members.map(m => m.name),
          clients: activeClients.map(c => c.name),
          categories: CATEGORIES,
          entries: scopedEntries.map(e => ({
            id: e.id, date: e.date, endDate: e.endDate ?? null,
            managerName: e.managerName, clientName: e.clientName,
            category: e.category, keyword: e.keyword, status: e.status,
          })),
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-assistant)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || '(응답이 비어 있습니다)',
        entries: Array.isArray(data.entries) ? data.entries : [],
        updates: Array.isArray(data.updates) ? data.updates : [],
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : '오류가 발생했습니다.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  // 제안된 일정/변경을 실제 시스템에 반영 (일일·전체 스케줄·타임테이블에 즉시 연동됨)
  const apply = (idx: number) => {
    const msg = messages[idx];
    if (!msg) return;
    let count = 0;

    // 새 일정 생성
    const newEntries: ScheduleEntry[] = [];
    (msg.entries ?? []).forEach((e, i) => {
      const managerId = matchManager(e.managerName) || selfId;
      const clientId = matchClient(e.clientName);
      const category = matchCategory(e.category);
      if (!e.date || !managerId || !clientId) return; // 필수값 없으면 건너뜀
      const endDate = e.endDate && e.endDate !== 'null' && e.endDate > e.date ? e.endDate : undefined;
      newEntries.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date: e.date, endDate, managerId,
        managerName: members.find(m => m.id === managerId)?.name ?? '',
        category, keyword: e.keyword || undefined,
        clientId, clientName: activeClients.find(c => c.id === clientId)?.name ?? '',
        status: (['pending', 'in-progress', 'completed'].includes(e.status ?? '') ? e.status : 'pending') as ScheduleStatus,
      });
    });
    if (newEntries.length) { saveEntries(newEntries); count += newEntries.length; }

    // 기존 일정 변경 (배분/재배치)
    (msg.updates ?? []).forEach(u => {
      if (!u.id) return;
      const cur = entries.find(en => en.id === u.id);
      if (!cur) return;
      const patch: Partial<ScheduleEntry> = {};
      if (u.date && u.date !== 'null') patch.date = u.date;
      if (u.endDate && u.endDate !== 'null') patch.endDate = u.endDate;
      if (u.managerName && u.managerName !== 'null') {
        const mid = matchManager(u.managerName);
        if (mid) { patch.managerId = mid; patch.managerName = members.find(m => m.id === mid)?.name ?? cur.managerName; }
      }
      if (u.status && ['pending', 'in-progress', 'completed'].includes(u.status)) patch.status = u.status as ScheduleStatus;
      if (Object.keys(patch).length) { patchEntry(u.id, patch); count += 1; }
    });

    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, applied: count } : m));
  };

  const proposalCount = (m: Msg) => (m.entries?.length ?? 0) + (m.updates?.length ?? 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
          <Sparkles size={15} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-tight">AI 어시스턴트</h3>
          <p className="text-xs text-gray-400">일정 등록·배분·시간 분배 조언을 대화로 처리합니다</p>
        </div>
      </div>

      {/* 대화 영역 */}
      <div ref={scrollRef} className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '24rem', minHeight: '8rem' }}>
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">무엇을 도와드릴까요? 예를 들어:</p>
            <div className="flex flex-col gap-2 max-w-xl mx-auto">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => send(ex)} disabled={loading}
                  className="text-left text-xs text-gray-600 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 border border-gray-100 rounded-xl px-3 py-2 transition-colors disabled:opacity-50">
                  💬 {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${m.role === 'user' ? 'order-2' : ''}`}>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  {m.text}
                </div>

                {/* 제안된 액션 (일정 생성/변경) */}
                {m.role === 'assistant' && proposalCount(m) > 0 && (
                  <div className="mt-2 border border-purple-100 bg-purple-50/50 rounded-xl p-3 space-y-2">
                    {(m.entries ?? []).map((e, i) => (
                      <div key={`e${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                        <CalendarPlus size={13} className="text-purple-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>신규</strong> {e.date}{e.endDate && e.endDate !== 'null' ? `~${e.endDate}` : ''} · {e.managerName || '담당자?'} · {e.clientName || '업체?'} · {e.category || '기타'}
                          {e.keyword ? ` · ${e.keyword}` : ''}{e.status && e.status !== 'pending' ? ` (${STATUS_LABEL[e.status] ?? e.status})` : ''}
                        </span>
                      </div>
                    ))}
                    {(m.updates ?? []).map((u, i) => {
                      const cur = entries.find(en => en.id === u.id);
                      return (
                        <div key={`u${i}`} className="flex items-start gap-2 text-xs text-gray-700">
                          <Pencil size={13} className="text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>변경</strong> {cur ? `${cur.clientName} ${cur.category}${cur.keyword ? ` (${cur.keyword})` : ''}` : u.id}
                            {' → '}
                            {[u.date && u.date !== 'null' ? `날짜 ${u.date}` : '', u.managerName && u.managerName !== 'null' ? `담당 ${u.managerName}` : '', u.status && u.status !== 'null' ? STATUS_LABEL[u.status] ?? u.status : ''].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      );
                    })}

                    {m.applied != null ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 pt-1">
                        <Check size={13} /> {m.applied}건 적용됨 — 일일·전체 스케줄·타임테이블에 반영되었습니다.
                      </div>
                    ) : (
                      <button onClick={() => apply(idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                        <Check size={12} /> 적용하기 ({proposalCount(m)}건)
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400">적용 후 스케줄 화면에서 세부 내용을 수정할 수 있습니다.</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              생각 중...
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="border-t border-gray-50 p-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="예: 오늘 스케줄 시간 분배 어떻게 하면 좋을까? (Enter 전송, Shift+Enter 줄바꿈)"
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-28" />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-colors shrink-0">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

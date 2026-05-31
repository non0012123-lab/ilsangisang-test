import { useState } from 'react';
import { FileText, Send, X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { coversDate } from '../utils/dateRange';
import { todayStr } from '../utils/today';
import { buildDailyReportHtml, renderHtmlToPdfBase64, type DailyReportRow } from '../utils/dailyReportPdf';

const toRow = (e: { date: string; clientName: string; category: string; opinionTitle?: string; keyword?: string }): DailyReportRow => ({
  date: e.date, clientName: e.clientName, category: e.category, title: e.opinionTitle ?? e.keyword ?? '',
});

export default function DailyReportButton() {
  const { entries } = useApp();
  const { user } = useAuth();
  const today = todayStr();

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<'' | 'summary' | 'pdf' | 'send'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // 내 하루 업무: 오늘에 걸친 일정 + 진행 중(작업중) 전체
  const mine = entries.filter(e => e.managerId === user?.id && (coversDate(e, today) || e.status === 'in-progress'));
  const groups = {
    pending: mine.filter(e => e.status === 'pending').map(toRow),
    inProgress: mine.filter(e => e.status === 'in-progress').map(toRow),
    completed: mine.filter(e => e.status === 'completed').map(toRow),
  };
  const total = groups.pending.length + groups.inProgress.length + groups.completed.length;

  const sending = stage !== '';
  const stageText = stage === 'summary' ? 'AI 요약 생성 중...' : stage === 'pdf' ? 'PDF 생성 중...' : stage === 'send' ? '관리자에게 발송 중...' : '';

  const reset = () => { setNote(''); setStage(''); setError(''); setDone(''); };

  const send = async () => {
    if (sending) return;
    setError(''); setDone('');
    try {
      // 1) 관리자 이메일 조회
      if (!supabase) throw new Error('Supabase 가 연결되지 않아 관리자 이메일을 찾을 수 없습니다.');
      const { data, error: qErr } = await supabase.from('profiles').select('email, status, role').eq('role', 'admin');
      if (qErr) throw new Error(`관리자 조회 실패: ${qErr.message}`);
      const admins = Array.from(new Set((data ?? [])
        .filter(p => (p as { email?: string }).email && (p as { status?: string }).status !== 'suspended')
        .map(p => (p as { email: string }).email)));
      if (admins.length === 0) throw new Error('등록된 관리자(admin) 이메일이 없습니다.');

      // 2) AI 요약
      setStage('summary');
      const sres = await fetch('/api/ai-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerName: user?.name, date: today, note, ...groups }),
      });
      if (!(sres.headers.get('content-type') ?? '').includes('application/json')) {
        throw new Error('AI 서버(/api/ai-summary)에 연결할 수 없습니다. 배포 환경에서 동작합니다.');
      }
      const sdata = await sres.json();
      if (!sres.ok || sdata.error) throw new Error(sdata.error ?? 'AI 요약 실패');

      // 3) PDF 생성
      setStage('pdf');
      const html = buildDailyReportHtml({
        managerName: user?.name ?? '담당자', department: user?.department,
        date: today, summary: sdata.summary ?? '', note, groups,
      });
      const pdfBase64 = await renderHtmlToPdfBase64(html);

      // 4) 발송
      setStage('send');
      const rres = await fetch('/api/send-daily-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: admins,
          subject: `[일일보고서] ${user?.name ?? '담당자'} · ${today}`,
          html, pdfBase64, filename: `일일보고서_${user?.name ?? 'report'}_${today}.pdf`,
        }),
      });
      if (!(rres.headers.get('content-type') ?? '').includes('application/json')) {
        throw new Error('메일 서버(/api/send-daily-report)에 연결할 수 없습니다. 배포 환경에서 동작합니다.');
      }
      const rdata = await rres.json();
      if (!rres.ok || rdata.error) throw new Error(rdata.detail ? `${rdata.error} — ${rdata.detail}` : (rdata.error ?? '발송 실패'));

      setStage('');
      setDone(`관리자 ${admins.length}명에게 일일보고서를 발송했습니다.`);
    } catch (e) {
      setStage('');
      setError(e instanceof Error ? e.message : '발송 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }}
        className="w-full flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-3.5 hover:border-blue-200 hover:shadow-md transition-all group">
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
            <FileText size={17} />
          </span>
          <span className="text-left min-w-0">
            <span className="block font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">일일보고서 보내기</span>
            <span className="block text-xs text-gray-400">오늘 업무(대기/작업중/완료) + AI 요약을 PDF로 관리자에게 메일 발송</span>
          </span>
        </span>
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">오늘 {total}건</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><FileText size={16} /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">일일보고서 보내기</h2>
                  <p className="text-xs text-gray-400">{user?.name} · {today} · 관리자에게 발송</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} disabled={sending} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: '완료', value: groups.completed.length, color: 'text-green-600 bg-green-50' },
                  { label: '작업중', value: groups.inProgress.length, color: 'text-blue-600 bg-blue-50' },
                  { label: '대기중', value: groups.pending.length, color: 'text-amber-600 bg-amber-50' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl py-2.5 ${s.color}`}>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">특이사항 (선택)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} disabled={sending}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50"
                  placeholder="오늘 업무 중 공유할 특이사항, 이슈, 요청 등을 적어주세요. (AI 요약에도 반영됩니다)" />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}</p>}
              {done && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-start gap-1.5"><Check size={13} className="mt-0.5 shrink-0" /> {done}</p>}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              {done ? (
                <button onClick={() => setOpen(false)} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">닫기</button>
              ) : (
                <>
                  <button onClick={() => setOpen(false)} disabled={sending} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40">취소</button>
                  <button onClick={send} disabled={sending}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                    {sending ? <><Loader2 size={14} className="animate-spin" /> {stageText}</> : <><Send size={14} /> 보내기</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

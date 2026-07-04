// 담당자용 클라이언트 보고서 관리 탭 — 기간 선택 → 초안 생성 → 검토·수정 → 발행.
//  • 보고 기준일(30일 주기) 도래 구간은 탭 진입 시 '초안'이 자동 준비된다(발행 전까지 클라이언트에 안 보임).
//  • '발행' 해야 클라이언트 페이지(status='published')에 노출된다.
import { useState, useEffect, useRef } from 'react';
import { Pencil, Save, X, Send, EyeOff, Trash2, RotateCw, Download, Loader2, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { duePeriods, reportIdFor, generateReportForPeriod } from '../utils/monthlyReports';
import { downloadReportPdf } from '../utils/reportPdf';
import { todayStr } from '../utils/today';
import type { Client, Report } from '../types';

const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40';

export default function ClientReportsTab({ client }: { client: Client }) {
  const { reports, entries, saveReport, removeReport } = useApp();
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [draftSummary, setDraftSummary] = useState('');
  const [draftHighlights, setDraftHighlights] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customBusy, setCustomBusy] = useState(false);

  const clientReports = reports
    .filter(r => r.clientId === client.id)
    .sort((a, b) => (b.periodStart ?? b.date).localeCompare(a.periodStart ?? a.date));

  const mark = (id: string, on: boolean) =>
    setGenerating(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  // 탭 진입 시: 공개일이 지난(스케줄 도래) 구간 중 보고서가 아직 없는 것에 '초안'을 자동 생성한다.
  const genRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    duePeriods(client, todayStr()).forEach(p => {
      const id = reportIdFor(client.id, p.start);
      if (reports.some(r => r.id === id) || genRef.current.has(id)) return;
      genRef.current.add(id);
      mark(id, true);
      generateReportForPeriod({ client, allEntries: entries, start: p.start, end: p.end, releaseDate: p.releaseDate, status: 'draft' })
        .then(saveReport)
        .finally(() => mark(id, false));
    });
    // client 변경 시에만 재판단(중복 생성은 genRef + reports.some 로 차단)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const startEdit = (r: Report) => { setEditId(r.id); setDraftSummary(r.summary); setDraftHighlights((r.highlights ?? []).join('\n')); };
  const saveEdit = (r: Report) => {
    saveReport({ ...r, summary: draftSummary.trim(), highlights: draftHighlights.split('\n').map(s => s.trim()).filter(Boolean) });
    setEditId(null);
  };
  const publish = (r: Report) => saveReport({ ...r, status: 'published', date: todayStr() });
  const unpublish = (r: Report) => saveReport({ ...r, status: 'draft' });
  const del = (r: Report) => { if (window.confirm(`'${r.period}' 보고서를 삭제할까요? 되돌릴 수 없습니다.`)) removeReport(r.id); };

  const regenerate = async (r: Report) => {
    if (!r.periodStart || !r.periodEnd) return;
    mark(r.id, true);
    try {
      saveReport(await generateReportForPeriod({ client, allEntries: entries, start: r.periodStart, end: r.periodEnd, releaseDate: r.releaseDate, status: r.status ?? 'draft' }));
    } finally { mark(r.id, false); }
  };

  const createCustom = async () => {
    if (!customFrom || !customTo) return;
    setCustomBusy(true);
    try {
      saveReport(await generateReportForPeriod({ client, allEntries: entries, start: customFrom, end: customTo, status: 'draft' }));
      setCustomFrom(''); setCustomTo('');
    } finally { setCustomBusy(false); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-blue-700 mb-1">📄 클라이언트 보고서</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          보고 기준일(30일 주기)이 도래한 구간은 <b>초안</b>이 자동 준비됩니다. 내용을 검토·수정한 뒤 <b>발행</b>하면 클라이언트 페이지에 표시됩니다. 원하는 기간으로 직접 만들 수도 있어요.
        </p>
      </div>

      {/* 기간 지정 생성 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">기간 지정 보고서 만들기</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={createCustom} disabled={!customFrom || !customTo || customBusy}
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
            {customBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 초안 생성
          </button>
        </div>
      </div>

      {/* 목록 */}
      {clientReports.length === 0 && generating.size === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm bg-white border border-gray-100 rounded-2xl">
          보고서가 없습니다. 위에서 기간을 지정하거나, 보고 기준일이 도래하면 초안이 자동 생성됩니다.
        </p>
      ) : (
        <div className="space-y-3">
          {clientReports.map(r => {
            const busy = generating.has(r.id);
            const published = r.status !== 'draft'; // status 없는 레거시=발행 간주
            const editing = editId === r.id;
            return (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${published ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {published ? '발행됨' : '초안'}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 truncate">{r.title}</h4>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.period}
                      {r.aiGenerated === false ? ' · 규칙기반' : r.aiGenerated ? ' · AI 요약' : ''}
                      {busy ? ' · 생성 중…' : ''}
                    </p>
                  </div>
                  {busy && <Loader2 size={16} className="animate-spin text-gray-300 shrink-0" />}
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <textarea value={draftSummary} onChange={e => setDraftSummary(e.target.value)} rows={4}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="요약" />
                    <textarea value={draftHighlights} onChange={e => setDraftHighlights(e.target.value)} rows={4}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="핵심 성과 (한 줄에 하나씩)" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditId(null)} className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}><X size={13} /> 취소</button>
                      <button onClick={() => saveEdit(r)} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}><Save size={13} /> 저장</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap mb-2">{r.summary}</p>
                    {r.highlights && r.highlights.length > 0 && (
                      <ul className="mb-3 space-y-1">
                        {r.highlights.map((h, i) => (
                          <li key={i} className="text-xs text-gray-500 flex gap-1.5"><span className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 shrink-0" />{h}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button onClick={() => startEdit(r)} disabled={busy} className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}><Pencil size={12} /> 편집</button>
                      <button onClick={() => regenerate(r)} disabled={busy} className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}><RotateCw size={12} /> 재생성</button>
                      <button onClick={() => downloadReportPdf(r, client, entries)} className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}><Download size={12} /> PDF</button>
                      {published
                        ? <button onClick={() => unpublish(r)} className={`${btn} border border-amber-200 text-amber-600 hover:bg-amber-50`}><EyeOff size={12} /> 발행취소</button>
                        : <button onClick={() => publish(r)} disabled={busy} className={`${btn} bg-green-600 text-white hover:bg-green-700`}><Send size={12} /> 발행</button>}
                      <button onClick={() => del(r)} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50 ml-auto`}><Trash2 size={12} /> 삭제</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

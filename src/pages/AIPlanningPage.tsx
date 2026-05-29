import { useState, useRef, type ReactNode } from 'react';
import { Upload, Sparkles, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Copy, Check, ImageIcon, Download, History, Clock } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import type { AiPlanResult } from '../types';

type Step = 1 | 2;

const CAMPAIGN_TYPES = ['브랜드 인지도', '신제품 출시', '시즌 프로모션', '이벤트/캠페인', '커뮤니티 활성화', '위기 관리', '기타'];

// ── 아주 가벼운 마크다운 렌더러 (제목/목록/굵게) ──
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function ReportMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="list-disc pl-5 space-y-1 my-2">
          {bullets.map((li, i) => <li key={i} className="text-sm text-gray-700 leading-relaxed">{renderInline(li)}</li>)}
        </ul>
      );
      bullets = [];
    }
  };

  text.split('\n').forEach(raw => {
    const line = raw.trimEnd();
    if (/^#{1,6}\s/.test(line)) {
      flush();
      const level = line.match(/^#+/)![0].length;
      const content = line.replace(/^#{1,6}\s/, '');
      const cls = level <= 1 ? 'text-lg font-bold mt-5 mb-2 text-gray-900'
        : level === 2 ? 'text-base font-bold mt-4 mb-1.5 text-gray-900'
        : 'text-sm font-semibold mt-3 mb-1 text-gray-800';
      blocks.push(<p key={`h${blocks.length}`} className={cls}>{renderInline(content)}</p>);
    } else if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flush();
      blocks.push(<div key={`s${blocks.length}`} className="h-2" />);
    } else {
      flush();
      blocks.push(<p key={`p${blocks.length}`} className="text-sm text-gray-700 leading-relaxed my-1">{renderInline(line)}</p>);
    }
  });
  flush();
  return <div>{blocks}</div>;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AIPlanningPage() {
  const { clients, aiHistory, setAiHistory } = useApp();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [campaignType, setCampaignType] = useState('');
  const [goal, setGoal] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeClients = clients.filter(c => c.status !== 'inactive');
  const selectedClient = activeClients.find(c => c.id === clientId);
  const viewing = aiHistory.find(h => h.id === viewingId) ?? null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError('');
    try {
      // CSV/텍스트 가이드라인은 본문을 함께 전달 (xlsx/pdf 등 바이너리는 생략됨)
      let guideline = '';
      try { guideline = (await file.text()).slice(0, 12000); } catch { /* 바이너리 파일은 건너뜀 */ }

      const res = await fetch('/api/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: selectedClient?.name,
          industry: selectedClient?.industry,
          period, campaignType, goal, guideline,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-plan)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      if (!data.report) throw new Error('리포트가 비어 있습니다.');

      const result: AiPlanResult = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        clientName: selectedClient?.name ?? '클라이언트',
        campaignType,
        period: { ...period },
        guideline,
        report: data.report as string,
        images: [],
      };
      setAiHistory(prev => [result, ...prev].slice(0, 30));   // 최근 30건 보관
      setViewingId(result.id);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyReport = async () => {
    if (!viewing) return;
    try {
      await navigator.clipboard.writeText(viewing.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* 클립보드 권한 없음 */ }
  };

  const generateImages = async () => {
    if (!viewing) return;
    setImgLoading(true);
    setImgError('');
    try {
      const res = await fetch('/api/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: viewing.clientName, guideline: viewing.guideline }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-image)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      const imgs = Array.isArray(data.images) ? data.images : [];
      setAiHistory(prev => prev.map(h => h.id === viewing.id ? { ...h, images: imgs } : h));
    } catch (e) {
      setImgError(e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setImgLoading(false);
    }
  };

  const openHistory = (id: string) => { setViewingId(id); setImgError(''); setStep(2); };
  const startNew = () => { setStep(1); };

  const canAnalyze = file && clientId && period.start && period.end && campaignType;

  return (
    <Layout>
      <Header title="AI 기획 어시스턴트" subtitle="가이드라인을 업로드하고 설정하면 AI가 업체를 분석해 기획 리포트를 작성합니다" />
      <div className="flex-1 p-6 space-y-5">

        {/* Step indicator (2단계) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            {[
              { n: 1, label: '가이드라인 · 기획 설정' },
              { n: 2, label: 'AI 기획 리포트' },
            ].map((s) => (
              <button key={s.n} onClick={() => (s.n === 1 ? startNew() : viewing && setStep(2))}
                className="flex items-center gap-2 disabled:cursor-default" disabled={s.n === 2 && !viewing}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s.n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                </div>
                <span className={`text-sm font-medium ${step === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── STEP 1: 가이드라인 업로드 + 기획 설정 (통합) ── */}
        {step === 1 && (
          <>
            {/* 이전 기획 내역 */}
            {aiHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <History size={16} className="text-blue-600" />
                  <h3 className="font-bold text-gray-900 text-sm">이전 기획 내역</h3>
                  <span className="text-xs text-gray-400">{aiHistory.length}건 · 클릭하면 재생성 없이 다시 볼 수 있어요</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                  {aiHistory.map(h => (
                    <button key={h.id} onClick={() => openHistory(h.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                      <Clock size={14} className="text-gray-300 shrink-0" />
                      <span className="font-medium text-gray-900 text-sm">{h.clientName}</span>
                      <span className="text-xs text-gray-500">{h.campaignType}</span>
                      {h.images.length > 0 && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">이미지 {h.images.length}</span>}
                      <span className="ml-auto text-xs text-gray-400">{fmtTime(h.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-5">
              {/* 가이드라인 업로드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-1">가이드라인 파일 업로드</h3>
                <p className="text-sm text-gray-500 mb-5">회사 양식의 가이드라인 파일을 업로드하세요. (.xlsx / .xls / .csv / .txt / .pdf)</p>

                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" className="hidden" onChange={handleFile} />

                {file ? (
                  <div className="border-2 border-green-200 bg-green-50 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={24} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={() => setFile(null)} className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors group">
                    <div className="w-14 h-14 bg-gray-100 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                      <Upload size={24} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="font-semibold text-gray-700 mb-1">파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="text-sm text-gray-400">.xlsx / .xls / .csv / .txt / .pdf 지원</p>
                  </div>
                )}

                <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 mb-1.5">포함하면 좋은 내용</p>
                  <ul className="space-y-1">
                    {['업체명·업종 및 핵심 소개', '진행할 마케팅 채널(블로그/카페/SNS/유튜브)', '브랜드 톤앤매너 및 금지 표현', '타겟 고객층 정보'].map(t => (
                      <li key={t} className="text-xs text-blue-600 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-blue-400 rounded-full" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 기획 설정 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h3 className="font-bold text-gray-900">기획 설정</h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">대상 클라이언트 *</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">클라이언트 선택</option>
                    {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작일 *</label>
                    <input type="date" value={period.start} onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료일 *</label>
                    <input type="date" value={period.end} onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">캠페인 유형 *</label>
                  <div className="flex flex-wrap gap-2">
                    {CAMPAIGN_TYPES.map(t => (
                      <button key={t} onClick={() => setCampaignType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          campaignType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">캠페인 목표 (선택)</label>
                  <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3}
                    placeholder="예: 여름 신제품 출시에 맞춰 20-30대 여성 대상 SNS 인지도를 높이고 유튜브 조회수 50만을 목표로 합니다."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-600 leading-relaxed">
                    AI 리포트는 참고용 제안입니다. 사실관계는 담당자가 다시 확인해주세요. 추론 과정으로 응답에 시간이 걸릴 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleAnalyze} disabled={!canAnalyze || isAnalyzing}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  canAnalyze && !isAnalyzing
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {isAnalyzing
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 분석 중...</>
                  : <><Sparkles size={16} /> AI 기획 분석 시작</>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: 결과 ── */}
        {step === 2 && viewing && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={28} className="text-purple-200" />
                <div>
                  <p className="font-bold text-lg">AI 기획 리포트</p>
                  <p className="text-purple-200 text-sm">
                    {viewing.clientName} · {viewing.campaignType} · {viewing.period.start} ~ {viewing.period.end} · {fmtTime(viewing.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={startNew}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
                  새 기획
                </button>
                <button onClick={copyReport}
                  className="px-4 py-2 bg-white text-purple-700 text-sm font-semibold rounded-xl hover:bg-purple-50 transition-colors flex items-center gap-2">
                  {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 리포트 복사</>}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">AI 기획 리포트</h3>
                <span className="text-xs bg-purple-50 text-purple-600 font-semibold px-2.5 py-1 rounded-full">AI 생성</span>
              </div>
              <ReportMarkdown text={viewing.report} />
            </div>

            {/* 이미지 시안 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-purple-500" />
                  <h3 className="font-bold text-gray-900">이미지 시안</h3>
                  <span className="text-xs text-gray-400">블로그·SNS 각 2개</span>
                </div>
                <button onClick={generateImages} disabled={imgLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 text-white">
                  {imgLoading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 생성 중... (최대 1~2분)</>
                    : <><Sparkles size={14} /> {viewing.images.length ? '다시 생성' : '이미지 시안 생성'}</>}
                </button>
              </div>

              {imgError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                  <AlertTriangle size={16} className="shrink-0" /> {imgError}
                </div>
              )}

              {viewing.images.length === 0 && !imgLoading && !imgError ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  가이드라인을 바탕으로 블로그·SNS 광고 이미지 초안을 생성합니다. 위 버튼을 눌러주세요.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {viewing.images.map((img, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">{img.channel} 시안 #{(i % 2) + 1}</span>
                        <a href={img.url} download={`${img.channel}_시안_${(i % 2) + 1}.png`}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 transition-colors">
                          <Download size={12} /> 저장
                        </a>
                      </div>
                      <img src={img.url} alt={`${img.channel} 시안 ${i + 1}`} className="w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

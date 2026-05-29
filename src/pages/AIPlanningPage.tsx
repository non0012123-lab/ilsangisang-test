import { useState, useRef, type ReactNode } from 'react';
import { Upload, Sparkles, FileSpreadsheet, X, ChevronRight, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';

type Step = 1 | 2 | 3;

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

export default function AIPlanningPage() {
  const { clients } = useApp();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [campaignType, setCampaignType] = useState('');
  const [goal, setGoal] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeClients = clients.filter(c => c.status !== 'inactive');
  const selectedClient = activeClients.find(c => c.id === clientId);

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
    setIsAnalyzing(true);
    setError('');
    try {
      // CSV/텍스트 가이드라인은 본문을 함께 전달 (xlsx/pdf 등 바이너리는 생략됨)
      let guideline = '';
      if (file) {
        try { guideline = (await file.text()).slice(0, 12000); } catch { /* 바이너리 파일은 건너뜀 */ }
      }
      const res = await fetch('/api/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: selectedClient?.name,
          industry: selectedClient?.industry,
          period,
          campaignType,
          goal,
          guideline,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        // 함수가 없는 환경(GitHub Pages 등)에서는 SPA fallback(HTML)이 돌아옴
        throw new Error('AI 서버(/api/ai-plan)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      if (!data.report) throw new Error('리포트가 비어 있습니다.');
      setReport(data.report as string);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* 클립보드 권한 없음 */ }
  };

  const canAnalyze = clientId && period.start && period.end && campaignType;

  return (
    <Layout>
      <Header title="AI 기획 어시스턴트" subtitle="가이드라인을 업로드하면 AI가 업체를 검색·분석해 기획 리포트를 작성합니다" />
      <div className="flex-1 p-6 space-y-5">

        {/* Step indicator */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            {[
              { n: 1, label: '가이드라인 업로드' },
              { n: 2, label: '기획 설정' },
              { n: 3, label: 'AI 기획 리포트' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step > s.n ? 'bg-green-500 text-white' :
                    step === s.n ? 'bg-blue-600 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                  </div>
                  <span className={`text-sm font-medium ${step === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
                </div>
                {i < 2 && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">가이드라인 파일 업로드</h3>
              <p className="text-sm text-gray-500 mb-5">엑셀(.xlsx, .xls) 또는 CSV 파일을 업로드해주세요.<br />브랜드 가이드라인, 캠페인 기획안, 콘텐츠 방향성 등을 포함하세요.</p>

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
                  {['업체명·업종 및 핵심 소개', '진행할 마케팅 채널(블로그/카페/SNS/유튜브)', '브랜드 톤앤매너 및 금지 표현', '타겟 고객층 정보', '참고 경쟁사 및 벤치마킹 사례'].map(t => (
                    <li key={t} className="text-xs text-blue-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-blue-400 rounded-full" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">AI 기획 어시스턴트</p>
                    <p className="text-purple-200 text-sm">웹 검색 기반 기획 리포트</p>
                  </div>
                </div>
                <p className="text-purple-100 text-sm leading-relaxed mb-4">
                  가이드라인에 명시된 채널만 골라, 업체명을 직접 검색·분석하여 채널별 실행 기획 리포트를 작성합니다.
                </p>
                <div className="space-y-2">
                  {['블로그 메인·롱테일 키워드 추천', '네이버 카페 여론 작업 기획', 'SNS 디자인 방향성 제안', '유튜브 유형별 기획·대본 흐름'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-purple-100">
                      <CheckCircle2 size={14} className="text-purple-300 shrink-0" /> {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">샘플 가이드라인 다운로드</p>
                <p className="text-xs text-gray-500 mb-4">어떤 형식으로 작성해야 할지 모르겠다면 샘플을 참고하세요.</p>
                <button
                  onClick={() => {
                    const content = '항목,내용\n업체명,예시 브랜드\n업종,카페/디저트\n진행 채널,블로그,SNS\n타겟층,20-35세 여성\n톤앤매너,친근하고 감성적인\n금지표현,할인,최저가\n';
                    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = '가이드라인_샘플.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <FileSpreadsheet size={16} className="text-green-600" />
                  샘플 CSV 다운로드
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 Next button */}
        {step === 1 && (
          <div className="flex justify-end">
            <button onClick={() => setStep(2)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                file
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!file}>
              다음 단계 <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="grid lg:grid-cols-2 gap-5">
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
            </div>

            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">설정 요약</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">가이드라인</span>
                    <span className="font-medium text-gray-900 truncate max-w-[180px]">{file?.name ?? '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">클라이언트</span>
                    <span className="font-medium text-gray-900">{selectedClient?.name ?? '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">기간</span>
                    <span className="font-medium text-gray-900">{period.start && period.end ? `${period.start} ~ ${period.end}` : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">유형</span>
                    <span className="font-medium text-gray-900">{campaignType || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-amber-700 mb-1.5">⚠️ 안내</p>
                <p className="text-xs text-amber-600 leading-relaxed">
                  AI 리포트는 참고용 제안입니다. 업체명을 웹에서 검색해 작성하므로 사실관계는 담당자가 다시 확인하고 보완해주세요. 웹 검색·추론으로 1~2분 정도 걸릴 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {step === 2 && (
          <div className="flex justify-between">
            <button onClick={() => setStep(1)}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              이전
            </button>
            <button onClick={handleAnalyze} disabled={!canAnalyze || isAnalyzing}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                canAnalyze && !isAnalyzing
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}>
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 분석 중... (웹 검색·추론, 최대 1~2분)
                </>
              ) : (
                <><Sparkles size={16} /> AI 기획 분석 시작</>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Report */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={28} className="text-purple-200" />
                <div>
                  <p className="font-bold text-lg">AI 기획 리포트 완료!</p>
                  <p className="text-purple-200 text-sm">
                    {selectedClient?.name ?? '클라이언트'} · {campaignType} · {period.start} ~ {period.end}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
                  다시 생성
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
              <ReportMarkdown text={report} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

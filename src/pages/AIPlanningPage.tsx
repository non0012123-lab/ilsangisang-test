import { useState, useRef, type ReactNode } from 'react';
import { Upload, Sparkles, FileSpreadsheet, X, ChevronRight, Calendar, Hash, PlayCircle, Globe, Video, Paintbrush, MessageSquare, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';

type Step = 1 | 2 | 3;

interface PlanTask { category: string; content: string; status: string }
interface PlanWeek { week: string; date: string; tasks: PlanTask[] }
interface AIPlan { weeks: PlanWeek[]; memo?: string }

const CAMPAIGN_TYPES = ['브랜드 인지도', '신제품 출시', '시즌 프로모션', '이벤트/캠페인', '커뮤니티 활성화', '위기 관리', '기타'];

// 카테고리 → 표시용 색상/아이콘 (AI 결과·샘플 공통)
const CATEGORY_META: Record<string, { color: string; icon: ReactNode }> = {
  'SNS': { color: '#ec4899', icon: <Hash size={12} /> },
  '유튜브': { color: '#ef4444', icon: <PlayCircle size={12} /> },
  '네이버': { color: '#22c55e', icon: <Globe size={12} /> },
  '영상제작': { color: '#a855f7', icon: <Video size={12} /> },
  '디자인제작': { color: '#f97316', icon: <Paintbrush size={12} /> },
  '네이버 여론작업': { color: '#0ea5e9', icon: <MessageSquare size={12} /> },
  '기타': { color: '#6b7280', icon: <Hash size={12} /> },
};
const metaFor = (category: string) => CATEGORY_META[category] ?? CATEGORY_META['기타'];

const SAMPLE_PLAN: AIPlan = {
  weeks: [
    { week: '1주차', date: '06.01 ~ 06.07', tasks: [
      { category: 'SNS', content: '캠페인 론칭 예고 포스팅 (인스타그램 스토리 × 3)', status: '예정' },
      { category: '디자인제작', content: '메인 배너 디자인 및 SNS 템플릿 제작', status: '예정' },
      { category: '네이버', content: '키워드 리서치 및 블로그 포스팅 기획 (3건)', status: '예정' },
    ]},
    { week: '2주차', date: '06.08 ~ 06.14', tasks: [
      { category: 'SNS', content: '메인 콘텐츠 피드 게시 + 해시태그 캠페인 시작', status: '예정' },
      { category: '유튜브', content: '브랜드 스토리 영상 업로드 (5분 내외)', status: '예정' },
      { category: '네이버 여론작업', content: '커뮤니티 반응 모니터링 및 여론 분석', status: '예정' },
    ]},
    { week: '3주차', date: '06.15 ~ 06.21', tasks: [
      { category: 'SNS', content: '중간 성과 체크 + 리타겟팅 콘텐츠 게시', status: '예정' },
      { category: '영상제작', content: '숏폼 리뷰 영상 편집 및 릴스/쇼츠 배포', status: '예정' },
      { category: '네이버', content: '블로그 2차 포스팅 및 검색 노출 최적화', status: '예정' },
    ]},
    { week: '4주차', date: '06.22 ~ 06.30', tasks: [
      { category: 'SNS', content: '클로징 이벤트 게시 및 성과 공유 콘텐츠', status: '예정' },
      { category: '네이버 여론작업', content: '최종 여론 분석 리포트 작성', status: '예정' },
      { category: '디자인제작', content: '성과 인포그래픽 및 결과 카드뉴스 제작', status: '예정' },
    ]},
  ],
};

export default function AIPlanningPage() {
  const { clients } = useApp();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [campaignType, setCampaignType] = useState('');
  const [goal, setGoal] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [error, setError] = useState('');
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
        try { guideline = (await file.text()).slice(0, 8000); } catch { /* 바이너리 파일은 건너뜀 */ }
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
        // GitHub Pages 등 함수가 없는 환경에서는 SPA fallback(HTML)이 돌아옴
        throw new Error('AI 서버(/api/ai-plan)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      setPlan({ weeks: Array.isArray(data.weeks) ? data.weeks : [], memo: data.memo });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = clientId && period.start && period.end && campaignType;
  const result = plan ?? SAMPLE_PLAN;   // AI 결과가 없으면 샘플 표시

  return (
    <Layout>
      <Header title="AI 기획 어시스턴트" subtitle="가이드라인을 업로드하면 AI가 최적의 콘텐츠 플랜을 제안합니다" />
      <div className="flex-1 p-6 space-y-5">

        {/* Step indicator */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            {[
              { n: 1, label: '가이드라인 업로드' },
              { n: 2, label: '기획 설정' },
              { n: 3, label: 'AI 플랜 결과' },
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

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFile} />

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
                  <p className="text-sm text-gray-400">.xlsx / .xls / .csv / .pdf 지원</p>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">포함하면 좋은 내용</p>
                <ul className="space-y-1">
                  {['브랜드 톤앤매너 및 금지 표현', '타겟 고객층 정보', '캠페인 키 메시지', '참고 경쟁사 및 벤치마킹 사례', '예산 및 채널 우선순위'].map(t => (
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
                    <p className="text-purple-200 text-sm">GPT 기반 콘텐츠 플래너</p>
                  </div>
                </div>
                <p className="text-purple-100 text-sm leading-relaxed mb-4">
                  가이드라인 파일을 분석하여 클라이언트 업종, 타겟층, 캠페인 목표에 맞는 최적의 월간 콘텐츠 플랜을 자동으로 생성합니다.
                </p>
                <div className="space-y-2">
                  {['가이드라인 자동 분석', '채널별 최적 콘텐츠 제안', '주간 타임테이블 자동 생성', '스케줄 자동 반영'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-purple-100">
                      <CheckCircle2 size={14} className="text-purple-300 shrink-0" /> {f}
                    </div>
                  ))}
                </div>
                <div className="mt-4 px-3 py-2 bg-white/10 rounded-lg text-xs text-purple-200 text-center">
                  🚀 백엔드 연동 후 정식 서비스 예정
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">샘플 가이드라인 다운로드</p>
                <p className="text-xs text-gray-500 mb-4">어떤 형식으로 작성해야 할지 모르겠다면 샘플을 참고하세요.</p>
                <button
                  onClick={() => {
                    const content = '항목,내용\n브랜드명,예시 브랜드\n타겟층,20-35세 여성\n톤앤매너,친근하고 감성적인\n금지표현,할인,최저가\n주력 채널,인스타그램/유튜브\n월 게시 횟수,SNS 20회 유튜브 4회\n';
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
                  AI 분석 결과는 참고용 제안입니다. 실제 적용 전 담당자가 검토하고 수정해주세요. 생성된 일정은 타임테이블에 자동으로 반영됩니다.
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
                  AI 분석 중... (약 10~30초 소요)
                </>
              ) : (
                <><Sparkles size={16} /> AI 기획 분석 시작</>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={28} className="text-purple-200" />
                <div>
                  <p className="font-bold text-lg">AI 기획 완료!</p>
                  <p className="text-purple-200 text-sm">
                    {selectedClient?.name ?? '클라이언트'} · {campaignType} · {period.start} ~ {period.end}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
                  다시 생성
                </button>
                <button
                  onClick={() => alert('타임테이블 자동 반영 기능은 백엔드 연동 후 사용 가능합니다.')}
                  className="px-4 py-2 bg-white text-purple-700 text-sm font-semibold rounded-xl hover:bg-purple-50 transition-colors flex items-center gap-2">
                  <Calendar size={14} /> 타임테이블에 반영
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">AI 추천 월간 콘텐츠 플랜</h3>
                <span className="text-xs bg-purple-50 text-purple-600 font-semibold px-2.5 py-1 rounded-full">
                  {plan ? 'AI 생성' : '샘플'}
                </span>
              </div>

              <div className="space-y-4">
                {result.weeks.map((week, wi) => (
                  <div key={wi} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">{week.week}</span>
                      <span className="text-xs text-gray-400">{week.date}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {week.tasks.map((task, ti) => (
                        <div key={ti} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full text-white shrink-0"
                            style={{ backgroundColor: metaFor(task.category).color }}>
                            {metaFor(task.category).icon} {task.category}
                          </span>
                          <span className="text-sm text-gray-700 flex-1">{task.content}</span>
                          <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <Clock size={10} /> {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-1">💡 AI 추천 메모</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  {result.memo ??
                    `${campaignType} 캠페인의 경우 1~2주차에 인지도 확보에 집중하고, 3~4주차에 전환 유도 콘텐츠를 배치하는 전략이 효과적입니다. 특히 SNS 릴스와 유튜브 쇼츠의 시너지 효과를 노리면 노출수를 극대화할 수 있습니다.`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

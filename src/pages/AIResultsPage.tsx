import { useState } from 'react';
import { FileText, Clock, ArrowLeft, Copy, Check, Trash2, Sparkles, Building2, ImageIcon, Download } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import ReportDocument from '../components/ReportDocument';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { openAiPlanPrint } from '../utils/aiPlanPdf';

const fmt = (ts: number) => new Date(ts).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AIResultsPage() {
  const { aiHistory, removeAiPlan, clients } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState('all');
  const [copied, setCopied] = useState(false);

  const selected = aiHistory.find(p => p.id === selectedId) ?? null;
  const list = aiHistory.filter(p => filterClient === 'all' || p.clientId === filterClient);
  // 생성된 이미지 시안은 모두 영속화되므로 그대로 표시(삭제는 기획 페이지의 X 버튼)
  const savedImages = selected ? selected.images : [];
  const savedCount = (p: typeof aiHistory[number]) => p.images.length;

  const copy = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.report); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  };

  return (
    <Layout>
      <Header title="AI 기획 결과" subtitle="생성된 AI 기획 리포트를 모두가 조회하고 PDF로 저장할 수 있습니다" />
      <div className="flex-1 p-6">
        {selected ? (
          /* ── 상세 보기 ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft size={16} /> 목록으로
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => openAiPlanPrint(selected)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  <FileText size={14} /> PDF로 저장
                </button>
                <button onClick={copy}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-xl transition-colors">
                  {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
              <p className="font-bold text-gray-900">{selected.clientName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {selected.campaignType} · {selected.period.start} ~ {selected.period.end} · {fmt(selected.createdAt)}
                {selected.authorName ? ` · 작성: ${selected.authorName}` : ''}
              </p>
            </div>

            <ReportDocument text={selected.report} />

            {savedImages.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon size={18} className="text-purple-500" />
                  <h3 className="font-bold text-gray-900">이미지 시안</h3>
                  <span className="text-xs text-gray-400">{savedImages.length}개</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {savedImages.map(img => (
                    <div key={img.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 gap-2">
                        <span className="text-xs font-semibold text-gray-600 truncate">{img.channel} · {img.cols}×{img.cols} 시안</span>
                        <a href={img.url} download={`${img.channel}_시안.png`}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 transition-colors shrink-0">
                          <Download size={12} /> 다운로드
                        </a>
                      </div>
                      <img src={img.url} alt={`${img.channel} 시안`} className="w-full object-contain bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── 목록 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-400" />
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="all">전체 업체</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="text-sm text-gray-400 ml-auto">{list.length}건</span>
            </div>

            {list.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 flex flex-col items-center text-gray-400">
                <Sparkles size={28} className="mb-2 text-gray-200" />
                <p className="text-sm">아직 생성된 AI 기획 결과가 없습니다.</p>
                <p className="text-xs mt-1">AI 기획 메뉴에서 리포트를 생성하면 여기에 모입니다.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {list.map(p => (
                  <div key={p.id} onClick={() => setSelectedId(p.id)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:border-purple-200 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors leading-tight">{p.clientName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            {p.campaignType}
                            {savedCount(p) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                                <ImageIcon size={9} /> {savedCount(p)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); if (confirm('이 기획 결과를 삭제할까요?')) removeAiPlan(p.id); }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-3">
                      {p.report.replace(/[#*]/g, '').slice(0, 140)}…
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-50 pt-2">
                      <Clock size={12} /> {fmt(p.createdAt)}
                      {p.authorName && <span className="ml-auto">· {p.authorName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

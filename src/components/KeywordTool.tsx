import { useState, useMemo } from 'react';
import { Search, AlertTriangle, TrendingUp, ArrowLeft, Link2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface KeywordRow {
  keyword: string;
  pc: number | string;
  mobile: number | string;
  total: number;
  pcClick: number | string;
  mobileClick: number | string;
  pcCtr: number | string;
  mobileCtr: number | string;
  compIdx: string;
  found?: boolean;
}

const fmt = (v: number | string) => typeof v === 'number' ? v.toLocaleString('ko-KR') : v;
const fmtCtr = (v: number | string) => typeof v === 'number' ? `${v}%` : v;
const compColor = (c: string) =>
  c === '높음' ? 'bg-red-50 text-red-600' : c === '중간' ? 'bg-amber-50 text-amber-600' : c === '낮음' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400';

// 정렬용 숫자값 ("< 10"→10, "-"→-1, "0.04"→0.04)
const sortNum = (v: number | string): number => {
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '-' || s === '') return -1;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? -1 : n;
};

// 쉼표/줄바꿈으로 구분, 중복 제거, 최대 50개
function parseKeywords(input: string): string[] {
  return Array.from(new Set(input.split(/[\n,]/).map(s => s.trim()).filter(Boolean))).slice(0, 50);
}

type NumCol = 'pc' | 'mobile' | 'total' | 'pcClick' | 'mobileClick' | 'pcCtr' | 'mobileCtr';
const COLUMNS: { key: NumCol; label: string }[] = [
  { key: 'pc', label: 'PC 조회' },
  { key: 'mobile', label: '모바일 조회' },
  { key: 'total', label: '월간 합계' },
  { key: 'pcClick', label: 'PC 클릭' },
  { key: 'mobileClick', label: '모바일 클릭' },
  { key: 'pcCtr', label: 'PC 클릭률' },
  { key: 'mobileCtr', label: '모바일 클릭률' },
];

function ResultTable({ rows, onRelated }: { rows: KeywordRow[]; onRelated: (kw: string) => void }) {
  const [sortCol, setSortCol] = useState<NumCol | null>(null);
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');

  const clickSort = (col: NumCol) => {
    if (sortCol === col) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setDir('desc'); }
  };

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const f = dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => (sortNum(a[sortCol]) - sortNum(b[sortCol])) * f);
  }, [rows, sortCol, dir]);

  const cell = (v: number | string, isCtr = false, strong = false) =>
    <td className={`px-3 py-2.5 text-right tabular-nums ${strong ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{isCtr ? fmtCtr(v) : fmt(v)}</td>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap">키워드</th>
            {COLUMNS.map(c => (
              <th key={c.key} onClick={() => clickSort(c.key)}
                className="px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors">
                <span className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {c.label}
                  {sortCol === c.key
                    ? (dir === 'desc' ? <ChevronDown size={13} className="text-blue-600" /> : <ChevronUp size={13} className="text-blue-600" />)
                    : <ChevronsUpDown size={13} className="text-gray-300" />}
                </span>
              </th>
            ))}
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap">경쟁</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.keyword}</td>
              {cell(r.pc)}
              {cell(r.mobile)}
              {cell(r.found === false ? '-' : r.total, false, true)}
              {cell(r.pcClick)}
              {cell(r.mobileClick)}
              {cell(r.pcCtr, true)}
              {cell(r.mobileCtr, true)}
              <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${compColor(r.compIdx)}`}>{r.compIdx}</span></td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <button onClick={() => onRelated(r.keyword)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  <Link2 size={12} /> 연관
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KeywordTool() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [related, setRelated] = useState<{ seed: string; rows: KeywordRow[] } | null>(null);
  const [relLoading, setRelLoading] = useState(false);

  const parsed = parseKeywords(input);

  const search = async () => {
    if (parsed.length === 0 || loading) return;
    setLoading(true); setError(''); setRelated(null);
    try {
      const res = await fetch('/api/naver-keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: parsed }),
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) throw new Error('키워드 조회 서버(/api/naver-keywords)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      setRows(Array.isArray(data.keywords) ? data.keywords : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
      setRows([]);
    } finally { setLoading(false); }
  };

  const loadRelated = async (kw: string) => {
    setRelLoading(true); setError('');
    setRelated({ seed: kw, rows: [] });
    try {
      const res = await fetch('/api/naver-keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ related: kw }),
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) throw new Error('키워드 조회 서버에 연결할 수 없습니다. (Cloudflare Pages 환경 필요)');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      setRelated({ seed: kw, rows: Array.isArray(data.related) ? data.related : [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : '연관 키워드 조회 중 오류가 발생했습니다.');
      setRelated(null);
    } finally { setRelLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">키워드 (쉼표 또는 줄바꿈으로 구분 · 최대 50개)</label>
        <textarea value={input} onChange={e => setInput(e.target.value)} rows={3}
          placeholder="예: 스타벅스, 스타벅스 신메뉴, 아메리카노"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${parsed.length > 50 ? 'text-red-500' : 'text-gray-400'}`}>{parsed.length}개 입력됨 {parsed.length >= 50 && '(최대 50)'}</span>
          <button onClick={search} disabled={loading || parsed.length === 0}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              loading || parsed.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
            {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 조회 중</> : <><Search size={15} /> 조회</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* 연관키워드 뷰 */}
      {related ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
            <button onClick={() => setRelated(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
              <ArrowLeft size={15} /> 내 키워드
            </button>
            <span className="text-gray-300">|</span>
            <Link2 size={16} className="text-blue-600" />
            <h3 className="font-bold text-gray-900 text-sm">"{related.seed}" 연관 키워드</h3>
            <span className="ml-auto text-xs text-gray-400">{related.rows.length}개 · 월간 합계 순</span>
          </div>
          {relLoading
            ? <p className="text-center py-10 text-gray-400 text-sm">불러오는 중...</p>
            : related.rows.length === 0
              ? <p className="text-center py-10 text-gray-400 text-sm">연관 키워드가 없습니다.</p>
              : <ResultTable rows={related.rows} onRelated={loadRelated} />}
        </div>
      ) : rows.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="font-bold text-gray-900 text-sm">내 키워드 조회 결과</h3>
            <span className="ml-auto text-xs text-gray-400">{rows.length}개 · 헤더 화살표로 정렬 · "연관"으로 확장</span>
          </div>
          <ResultTable rows={rows} onRelated={loadRelated} />
        </div>
      ) : null}
    </div>
  );
}

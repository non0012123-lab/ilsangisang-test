import { useState } from 'react';
import { Search, AlertTriangle, TrendingUp } from 'lucide-react';

interface KeywordRow {
  keyword: string;
  pc: number | string;
  mobile: number | string;
  total: number;
  compIdx: string;
}

const fmt = (v: number | string) => typeof v === 'number' ? v.toLocaleString('ko-KR') : v;
const compColor = (c: string) =>
  c === '높음' ? 'bg-red-50 text-red-600' : c === '중간' ? 'bg-amber-50 text-amber-600' : c === '낮음' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500';

export default function KeywordTool() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<KeywordRow[]>([]);

  const search = async () => {
    if (!keyword.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/naver-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        throw new Error('키워드 조회 서버(/api/naver-keywords)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      setQuery(data.query ?? keyword);
      setRows(Array.isArray(data.keywords) ? data.keywords : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="키워드를 입력하세요 (예: 스타벅스)"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={search} disabled={loading || !keyword.trim()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              loading || !keyword.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
            {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 조회 중</> : <><Search size={15} /> 조회</>}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">네이버 검색광고 기준 PC·모바일 월간 검색수와 연관 키워드를 보여줍니다.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* 결과 */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="font-bold text-gray-900 text-sm">"{query}" 연관 키워드</h3>
            <span className="ml-auto text-xs text-gray-400">{rows.length}개 · 월간 검색수 순</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['키워드', 'PC 월간', '모바일 월간', '합계', '경쟁정도'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50/50 ${i === 0 ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.keyword}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-right tabular-nums">{fmt(r.pc)}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-right tabular-nums">{fmt(r.mobile)}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-semibold text-right tabular-nums">{r.total.toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${compColor(r.compIdx)}`}>{r.compIdx}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

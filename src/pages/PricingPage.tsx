import { useMemo, useState } from 'react';
import { Search, X, RefreshCw, ExternalLink, Package, Tag, AlertCircle, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import type { PriceProduct, PriceGroup, PriceOption } from '../types';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const fmtUpdated = (ms: number | null): string => {
  if (!ms) return '아직 수집 안 됨';
  const d = new Date(ms);
  return `${d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
};

// 그룹의 옵션을 가격 오름차순으로 — 단가표는 싼 것부터 보는 게 자연스럽다.
const sortedOptions = (g: PriceGroup) => [...g.options].sort((a, b) => a.price - b.price);

export default function PricingPage() {
  const { priceTable, priceRefreshing, priceProgress, priceUpdatedAt, refreshPriceTable } = useApp();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('전체');

  const categories = useMemo(
    () => ['전체', ...[...new Set(priceTable.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'ko'))],
    [priceTable],
  );

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => priceTable.filter(p => {
    if (cat !== '전체' && p.category !== cat) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) return true;
    // 옵션명까지 검색(예: "알림받기")
    return p.groups.some(g => g.title.toLowerCase().includes(q) || g.options.some(o => o.name.toLowerCase().includes(q)));
  }), [priceTable, cat, q]);

  const totalOptions = useMemo(
    () => priceTable.reduce((s, p) => s + p.groups.reduce((t, g) => t + g.options.length, 0), 0),
    [priceTable],
  );

  const handleRefresh = async () => {
    try {
      const res = await refreshPriceTable();
      if (res) alert(`단가표 새로고침 완료 — 상품 ${res.count}개를 가져왔습니다.`);
    } catch (e) {
      alert(`단가표 새로고침 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  };

  const progressPct = priceProgress && priceProgress.total
    ? Math.round((priceProgress.done / priceProgress.total) * 100)
    : 0;

  return (
    <Layout>
      <Header title="단가표" subtitle="외부 마케팅 쇼핑몰의 패키지·단일 상품 가격을 수집해 보여줍니다 (옵션 클릭 시 설명 펼침)" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* 상단: 검색 + 새로고침 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상품·옵션·카테고리 검색"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">업데이트: {fmtUpdated(priceUpdatedAt)}</span>
            <button onClick={handleRefresh} disabled={priceRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              <RefreshCw size={16} className={priceRefreshing ? 'animate-spin' : ''} />
              {priceRefreshing
                ? (priceProgress ? `수집 중 ${priceProgress.done}/${priceProgress.total}` : '수집 중…')
                : '단가표 새로고침'}
            </button>
          </div>
        </div>

        {/* 진행률 바 */}
        {priceRefreshing && (
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        {/* 카테고리 필터 + 요약 */}
        {priceTable.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    cat === c ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>{c}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400">상품 {priceTable.length}개 · 옵션 {totalOptions.toLocaleString('ko-KR')}개</span>
          </div>
        )}

        {/* 본문 */}
        {priceTable.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <AlertCircle size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">아직 수집된 단가표가 없습니다.</p>
            <p className="text-xs text-gray-400">‘단가표 새로고침’을 누르면 외부 쇼핑몰의 패키지·단일 상품 가격을 가져옵니다.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
            ‘{search || cat}’에 해당하는 상품이 없습니다.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ProductCard({ product: p }: { product: PriceProduct }) {
  const packages = p.groups.filter(g => g.isPackage);
  const singles = p.groups.filter(g => !g.isPackage);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{p.category}</span>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500" title="원본 보기"><ExternalLink size={13} /></a>
        </div>
        <h3 className="font-bold text-gray-900 leading-snug">{p.name}</h3>
      </div>

      <div className="space-y-3">
        {packages.length > 0 && <GroupList groups={packages} isPackage />}
        {singles.length > 0 && <GroupList groups={singles} isPackage={false} />}
      </div>
    </div>
  );
}

// 옵션 한 줄 — 설명(desc)이 있으면 클릭해 펼친다(소스의 드롭다운 상세처럼).
function OptionRow({ option: o }: { option: PriceOption }) {
  const [open, setOpen] = useState(false);
  const hasDesc = !!o.desc;
  return (
    <li className="py-1 text-xs">
      <button type="button" disabled={!hasDesc} onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-3 text-left ${hasDesc ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}>
        <span className="text-gray-600 min-w-0 flex items-center gap-1">
          {hasDesc && <ChevronRight size={12} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />}
          <span className="truncate">{o.name}</span>
        </span>
        <span className="font-bold text-gray-900 shrink-0">{won(o.price)}</span>
      </button>
      {open && hasDesc && (
        <p className="mt-1 ml-4 whitespace-pre-wrap text-[11px] text-gray-500 leading-relaxed border-l-2 border-gray-200 pl-2">{o.desc}</p>
      )}
    </li>
  );
}

function GroupList({ groups, isPackage }: { groups: PriceGroup[]; isPackage: boolean }) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isPackage ? 'text-violet-600' : 'text-gray-500'}`}>
        {isPackage ? <Package size={13} /> : <Tag size={13} />}
        {isPackage ? '패키지' : '단일 상품'}
      </div>
      <div className="space-y-2">
        {groups.map((g, gi) => (
          <div key={gi} className={`rounded-xl border ${isPackage ? 'border-violet-100 bg-violet-50/40' : 'border-gray-100 bg-gray-50/50'} px-3 py-2`}>
            <p className="text-xs font-semibold text-gray-700 mb-1">{g.title}</p>
            <ul className="divide-y divide-gray-100/80">
              {sortedOptions(g).map((o, oi) => <OptionRow key={oi} option={o} />)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

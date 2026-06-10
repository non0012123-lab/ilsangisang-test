import { Users } from 'lucide-react';

// 팀(department)별 보기 칩 바. 일일/전체/타임테이블/내부 일정 상단에 공통으로 쓴다.
//  • teams: 화면에 노출할 팀 목록(orderedTeams 로 만든 것). 비어 있으면 아무것도 렌더하지 않는다.
//  • value: 'all' 또는 팀명. onChange 로 선택을 올린다.
export default function TeamFilter({ teams, value, onChange, className = '' }: {
  teams: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  if (teams.length === 0) return null;
  const chip = (v: string, label: string) => {
    const active = value === v;
    return (
      <button key={v} onClick={() => onChange(v)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
          active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
        }`}>
        {label}
      </button>
    );
  };
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 pr-0.5"><Users size={13} /> 팀</span>
      {chip('all', '전체')}
      {teams.map(t => chip(t, t))}
    </div>
  );
}

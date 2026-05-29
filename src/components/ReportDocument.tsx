import { type ReactNode } from 'react';

// 마크다운 인라인(**굵게**) 처리
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

// AI 리포트(마크다운)를 문서처럼 렌더 — 흰 종이 느낌의 카드 안에서 사용
export default function ReportDocument({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="list-disc pl-6 space-y-1.5 my-3">
          {bullets.map((li, i) => <li key={i} className="text-[15px] text-gray-700 leading-7">{renderInline(li)}</li>)}
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
      if (level <= 1) {
        blocks.push(<h2 key={`h${blocks.length}`} className="text-2xl font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200">{renderInline(content)}</h2>);
      } else if (level === 2) {
        blocks.push(<h3 key={`h${blocks.length}`} className="text-lg font-bold text-gray-900 mt-6 mb-2">{renderInline(content)}</h3>);
      } else {
        blocks.push(<h4 key={`h${blocks.length}`} className="text-base font-semibold text-gray-800 mt-4 mb-1.5">{renderInline(content)}</h4>);
      }
    } else if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flush();
      blocks.push(<div key={`s${blocks.length}`} className="h-3" />);
    } else {
      flush();
      blocks.push(<p key={`p${blocks.length}`} className="text-[15px] text-gray-700 leading-7 my-2">{renderInline(line)}</p>);
    }
  });
  flush();

  return (
    <div className="mx-auto max-w-[820px] bg-white border border-gray-200 rounded-xl shadow-sm px-10 py-9 leading-relaxed">
      {blocks}
    </div>
  );
}

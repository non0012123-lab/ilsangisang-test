import { useState, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { toNasForOS } from '../utils/nasPath';

// 자유 텍스트 속 링크를 인식해 렌더한다.
//  • 웹 링크(http/https/www): 클릭 가능한 <a>
//  • NAS 경로(\\…, smb://…): 브라우저에선 클릭으로 안 열리므로 텍스트 + 복사 버튼.
//    보는 사람 OS 방언으로 변환해 표시·복사한다(toNasForOS).
const TRAIL_RE = /[)\]}.,;:!?]+$/; // 문장부호가 링크 끝에 붙은 경우 분리

export default function LinkifiedText({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (s: string, i: number) => {
    navigator.clipboard?.writeText(s).catch(() => {});
    setCopied(i);
    setTimeout(() => setCopied(c => (c === i ? null : c)), 1500);
  };

  // 매 렌더마다 새 인스턴스(lastIndex=0) — 모듈 전역 상태 변경을 피한다.
  const linkRe = /(https?:\/\/[^\s]+|www\.[^\s]+|smb:\/\/[^\s]+|\\\\[^\s]+)/gi;
  const nodes: ReactNode[] = [];
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    let url = m[0];
    let trail = '';
    const tm = url.match(TRAIL_RE);
    if (tm) { trail = tm[0]; url = url.slice(0, -trail.length); }
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const web = /^(https?:\/\/|www\.)/i.test(url);
    const display = toNasForOS(url);           // NAS 면 보는 OS 방언으로, 웹이면 원문 그대로
    const href = url.startsWith('www.') ? `https://${url}` : url;
    nodes.push(
      <span key={`l${i}`} className="inline-flex items-baseline gap-0.5 max-w-full align-baseline">
        {web
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{display}</a>
          : <span className="break-all underline decoration-dotted decoration-gray-400" title={display}>{display}</span>}
        <button onClick={() => copy(display, i)} title="복사"
          className={`shrink-0 self-center p-0.5 rounded transition-colors ${copied === i ? 'text-green-600' : 'text-gray-400 hover:text-blue-600'}`}>
          {copied === i ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </span>
    );
    if (trail) nodes.push(trail);
    last = m.index + m[0].length;
    i++;
  }
  if (i === 0) return <span className={className}>{text}</span>;
  if (last < text.length) nodes.push(text.slice(last));
  return <span className={className}>{nodes}</span>;
}

import type { AiPlanResult } from '../types';

// HTML 이스케이프
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 인라인 **굵게** → <strong>
function inline(s: string): string {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// 마크다운 리포트 → HTML 문서 본문
function markdownToHtml(text: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  text.split('\n').forEach(raw => {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const tag = level <= 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${inline(h[2])}</${tag}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  });
  closeList();
  return out.join('\n');
}

// AI 기획 리포트를 PDF처럼 보이는 인쇄 창으로 연다 (브라우저 "PDF로 저장")
export function openAiPlanPrint(plan: AiPlanResult) {
  const created = new Date(plan.createdAt).toLocaleString('ko-KR');
  const body = markdownToHtml(plan.report);
  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(plan.clientName)} AI 기획 리포트</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .no-print { display: none !important; } }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2937; margin: 0; background: #f1f5f9; }
  .page { max-width: 820px; margin: 24px auto; background: #fff; padding: 48px 56px; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .meta { border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
  .meta .title { font-size: 22px; font-weight: 800; color: #111827; }
  .meta .sub { font-size: 13px; color: #6b7280; margin-top: 6px; }
  h2 { font-size: 20px; font-weight: 700; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  h3 { font-size: 16px; font-weight: 700; margin: 18px 0 6px; }
  h4 { font-size: 14px; font-weight: 600; margin: 14px 0 4px; color: #374151; }
  p { font-size: 14px; line-height: 1.8; margin: 8px 0; }
  ul { margin: 8px 0; padding-left: 22px; }
  li { font-size: 14px; line-height: 1.8; }
  strong { font-weight: 700; color: #111827; }
  @page { margin: 16mm; }
</style></head>
<body>
  <div class="page">
    <div class="meta">
      <div class="title">AI 기획 리포트 — ${esc(plan.clientName)}</div>
      <div class="sub">${esc(plan.campaignType)} · ${esc(plan.period.start)} ~ ${esc(plan.period.end)} · ${esc(created)}${plan.authorName ? ` · 작성: ${esc(plan.authorName)}` : ''}</div>
    </div>
    ${body}
  </div>
  <div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:10px;">
    <button onclick="window.print()" style="background:#7c3aed;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.4);">PDF로 저장 / 인쇄</button>
    <button onclick="window.close()" style="background:#f1f5f9;color:#64748b;border:none;padding:12px 20px;border-radius:10px;font-size:14px;cursor:pointer;">닫기</button>
  </div>
</body></html>`;

  const win = window.open('', '_blank', 'width=960,height=900');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

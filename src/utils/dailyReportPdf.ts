// html2canvas·jsPDF 는 무거우므로(합쳐 ~600KB) 정적 import 하지 않는다.
//  → 실제 PDF 생성(renderHtmlToPdfBase64) 시점에만 동적 로드해, 대시보드 등 초기 화면을 가볍게 유지.

export interface DailyReportRow {
  date: string;
  clientName: string;
  category: string;
  title: string;
}
export interface DailyReportData {
  managerName: string;
  department?: string;
  date: string;        // YYYY-MM-DD
  summary: string;     // AI 요약
  note: string;        // 특이사항
  groups: { pending: DailyReportRow[]; inProgress: DailyReportRow[]; completed: DailyReportRow[] };
}

import { catHex } from '../data/categories';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function section(title: string, accent: string, rows: DailyReportRow[]): string {
  const body = rows.length === 0
    ? `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:12px;text-align:center;">해당 항목이 없습니다.</td></tr>`
    : rows.map(r => `
      <tr style="border-top:1px solid #f1f5f9;">
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">${esc(r.date)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#111827;">
          <span style="display:inline-block;font-size:11px;font-weight:600;color:#fff;background:${catHex(r.category)};padding:1px 7px;border-radius:9px;margin-right:6px;">${esc(r.category)}</span>
          <strong>${esc(r.clientName)}</strong>
        </td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;">${esc(r.title) || '-'}</td>
      </tr>`).join('');
  return `
    <div style="margin-top:18px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${accent};display:inline-block;"></span>
        <span style="font-size:14px;font-weight:700;color:#111827;">${esc(title)}</span>
        <span style="font-size:12px;color:#9ca3af;">${rows.length}건</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${body}
      </table>
    </div>`;
}

// 일일보고서 HTML (이메일 본문 + PDF 렌더링 공용). 인라인 hex 스타일만 사용(html2canvas 호환).
export function buildDailyReportHtml(d: DailyReportData): string {
  const total = d.groups.pending.length + d.groups.inProgress.length + d.groups.completed.length;
  return `
  <div style="width:760px;max-width:760px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1f2937;padding:32px 36px;box-sizing:border-box;">
    <div style="border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px;">
      <div style="font-size:20px;font-weight:800;color:#111827;">일일 업무 보고서</div>
      <div style="font-size:13px;color:#6b7280;margin-top:5px;">
        ${esc(d.managerName)}${d.department ? ` · ${esc(d.department)}` : ''} · ${esc(d.date)} · 총 ${total}건
        (완료 ${d.groups.completed.length} / 작업중 ${d.groups.inProgress.length} / 대기 ${d.groups.pending.length})
      </div>
    </div>

    <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 16px;">
      <div style="font-size:12px;font-weight:700;color:#4338ca;margin-bottom:5px;">🤖 AI 요약</div>
      <div style="font-size:13px;line-height:1.7;color:#374151;white-space:pre-wrap;">${esc(d.summary) || '요약이 없습니다.'}</div>
    </div>

    ${d.note ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-top:12px;">
      <div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:5px;">📌 특이사항</div>
      <div style="font-size:13px;line-height:1.7;color:#374151;white-space:pre-wrap;">${esc(d.note)}</div>
    </div>` : ''}

    ${section('완료', '#16a34a', d.groups.completed)}
    ${section('작업중', '#2563eb', d.groups.inProgress)}
    ${section('대기중', '#d97706', d.groups.pending)}

    <div style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:right;">일상이상커뮤니케이션 · 자동 생성 보고서</div>
  </div>`;
}

// HTML 문자열을 화면 밖에서 렌더링 → html2canvas → jsPDF 로 PDF base64(접두사 없음) 반환.
// 한글은 이미지로 렌더되므로 폰트 임베딩 없이도 정상 출력된다.
export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  // 무거운 PDF 라이브러리는 여기서만 동적 로드(초기 번들에서 제외).
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '760px';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    const dataUri = pdf.output('datauristring');
    return dataUri.split(',')[1] ?? '';
  } finally {
    document.body.removeChild(container);
  }
}

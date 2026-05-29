import type { Report, Client, ScheduleEntry } from '../types';

function num(n: number | undefined) {
  if (!n) return '-';
  return n.toLocaleString('ko-KR');
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    'SNS': '#ec4899', '유튜브': '#ef4444', '네이버': '#22c55e',
    '영상제작': '#a855f7', '디자인제작': '#f97316', '네이버 여론작업': '#0ea5e9', '기타': '#6b7280',
  };
  return map[cat] ?? '#6b7280';
}

function statusLabel(s: string) {
  return s === 'completed' ? '완료' : s === 'in-progress' ? '진행중' : '대기중';
}
function statusColor(s: string) {
  return s === 'completed' ? '#16a34a' : s === 'in-progress' ? '#2563eb' : '#d97706';
}

export function downloadReportPdf(report: Report, client: Client, entries: ScheduleEntry[]) {
  const clientEntries = entries.filter(e => e.clientId === client.id && e.date <= report.date);
  const recent = clientEntries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  const opinionEntries = clientEntries.filter(e => e.category === '네이버 여론작업');
  const completedCount = clientEntries.filter(e => e.status === 'completed').length;
  const totalCount = clientEntries.length;

  // Aggregate metrics
  const totalViews = clientEntries.reduce((s, e) => s + (e.metrics?.views ?? 0) + (e.metrics?.blogViews ?? 0), 0);
  const totalLikes = clientEntries.reduce((s, e) => s + (e.metrics?.likes ?? 0), 0);
  const totalImpressions = clientEntries.reduce((s, e) => s + (e.metrics?.impressions ?? 0), 0);

  const highlightRows = (report.highlights ?? []).map(h =>
    `<li style="margin:6px 0;color:#374151;font-size:13px;display:flex;align-items:flex-start;gap:8px;">
      <span style="color:#2563eb;font-weight:700;margin-top:1px;">✓</span>
      <span>${h}</span>
    </li>`
  ).join('');

  const entryRows = recent.map((e, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">
      <td style="padding:8px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${e.date}</td>
      <td style="padding:8px 10px;font-size:12px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${e.managerName}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">
        <span style="background:${categoryColor(e.category)}22;color:${categoryColor(e.category)};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;">${e.category}</span>
      </td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;max-width:160px;">
        ${e.opinionTitle ?? e.keyword ?? '-'}
      </td>
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #f3f4f6;">
        <span style="background:${statusColor(e.status)}22;color:${statusColor(e.status)};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;">${statusLabel(e.status)}</span>
      </td>
      <td style="padding:8px 10px;font-size:12px;color:#2563eb;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:center;">
        ${e.rank ? `${e.rank}위` : (e.metrics?.views ? num(e.metrics.views) + ' 회' : '-')}
      </td>
    </tr>
  `).join('');

  const opinionRows = opinionEntries.slice(0, 5).map(e => `
    <div style="border:1px solid #e0f2fe;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#f0f9ff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <p style="font-size:13px;font-weight:700;color:#0369a1;margin:0;">${e.opinionTitle ?? ''}</p>
        <span style="font-size:11px;color:#64748b;">${e.date}</span>
      </div>
      <p style="font-size:12px;color:#374151;margin:0 0 8px;line-height:1.6;">${e.opinionContent ?? ''}</p>
      ${e.opinionComments ? `<p style="font-size:11px;color:#64748b;margin:0;font-style:italic;">"${e.opinionComments.slice(0, 120)}${e.opinionComments.length > 120 ? '...' : ''}"</p>` : ''}
      ${e.metrics ? `<div style="margin-top:8px;display:flex;gap:12px;">
        ${e.metrics.views ? `<span style="font-size:11px;color:#0369a1;">👁 ${num(e.metrics.views)} 조회</span>` : ''}
        ${e.metrics.comments ? `<span style="font-size:11px;color:#0369a1;">💬 ${num(e.metrics.comments)} 댓글</span>` : ''}
      </div>` : ''}
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
    @page { size: A4; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background: #f8fafc; }
    .page { width: 210mm; min-height: 297mm; background: white; margin: 0 auto; position: relative; overflow: hidden; }
  </style>
</head>
<body>

<!-- Page 1 -->
<div class="page">
  <!-- Header Bar -->
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:40px 50px 36px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p style="color:#93c5fd;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">MARKETING REPORT</p>
        <h1 style="color:white;font-size:26px;font-weight:700;line-height:1.3;margin-bottom:4px;">${report.title}</h1>
        <p style="color:#bfdbfe;font-size:14px;">보고 기간: ${report.period}</p>
      </div>
      <div style="text-align:right;">
        <p style="color:white;font-size:18px;font-weight:700;">일상이상커뮤니케이션</p>
        <p style="color:#93c5fd;font-size:12px;margin-top:4px;">ILSANGISANG COMMUNICATIONS</p>
        <p style="color:#bfdbfe;font-size:11px;margin-top:2px;">발행일: ${report.date}</p>
      </div>
    </div>
  </div>

  <!-- Client Info Bar -->
  <div style="background:#1e293b;padding:14px 50px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;">${client.name[0]}</div>
      <div>
        <p style="color:white;font-size:14px;font-weight:600;">${client.name}</p>
        <p style="color:#94a3b8;font-size:11px;">${client.industry} · ${client.contactPerson} 담당자</p>
      </div>
    </div>
    <div style="display:flex;gap:20px;">
      ${client.categories.slice(0, 4).map(c => `<span style="background:${categoryColor(c)}33;color:${categoryColor(c)};font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${c}</span>`).join('')}
    </div>
  </div>

  <div style="padding:30px 50px;">
    <!-- Summary -->
    <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:6px;letter-spacing:1px;">EXECUTIVE SUMMARY</p>
      <p style="font-size:13px;color:#374151;line-height:1.7;">${report.summary}</p>
    </div>

    <!-- Metrics Cards -->
    <p style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:2px;margin-bottom:14px;">주요 수치</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
      ${[
        { label: '완료 작업', value: completedCount + '건 / ' + totalCount + '건', icon: '✅', bg: '#f0fdf4', color: '#16a34a' },
        { label: '총 조회수', value: num(totalViews) + '회', icon: '👁', bg: '#eff6ff', color: '#2563eb' },
        { label: '좋아요 합계', value: num(totalLikes) + '건', icon: '❤️', bg: '#fdf4ff', color: '#9333ea' },
        { label: '총 노출수', value: num(totalImpressions) + '회', icon: '📡', bg: '#fff7ed', color: '#ea580c' },
      ].map(m => `
        <div style="background:${m.bg};border-radius:12px;padding:14px;text-align:center;">
          <p style="font-size:22px;margin-bottom:4px;">${m.icon}</p>
          <p style="font-size:18px;font-weight:700;color:${m.color};margin-bottom:2px;">${m.value}</p>
          <p style="font-size:11px;color:#6b7280;">${m.label}</p>
        </div>
      `).join('')}
    </div>

    <!-- Highlights -->
    ${highlightRows ? `
    <p style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:2px;margin-bottom:14px;">이번 달 주요 성과</p>
    <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <ul style="list-style:none;padding:0;">
        ${highlightRows}
      </ul>
    </div>` : ''}

    <!-- Opinion Work -->
    ${opinionRows ? `
    <p style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:2px;margin-bottom:14px;">네이버 여론작업 현황</p>
    <div style="margin-bottom:28px;">${opinionRows}</div>` : ''}
  </div>
</div>

<!-- Page 2: Activity Table -->
<div class="page page-break">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:22px 50px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="color:white;font-size:18px;font-weight:700;">작업 내역</h2>
      <p style="color:#bfdbfe;font-size:12px;">${report.period} · ${client.name}</p>
    </div>
  </div>

  <div style="padding:28px 50px;">
    <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <thead>
        <tr style="background:#1e293b;">
          ${['날짜', '담당자', '카테고리', '키워드/제목', '상태', '순위/조회수'].map(h =>
            `<th style="padding:10px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;letter-spacing:0.5px;">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>${entryRows || '<tr><td colspan="6" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px;">작업 내역이 없습니다.</td></tr>'}</tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <p style="font-size:12px;font-weight:700;color:#1e293b;">일상이상커뮤니케이션</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:2px;">ILSANGISANG COMMUNICATIONS</p>
      </div>
      <div style="text-align:center;">
        <p style="font-size:11px;color:#9ca3af;">본 보고서는 내부 참고용으로 제작되었습니다.</p>
        <p style="font-size:11px;color:#9ca3af;">© 2026 일상이상커뮤니케이션. All rights reserved.</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:11px;color:#9ca3af;">발행: ${report.date}</p>
        <p style="font-size:11px;color:#9ca3af;">기간: ${report.period}</p>
      </div>
    </div>
  </div>
</div>

<!-- Print Button (hidden when printing) -->
<div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.4);">
    🖨️ PDF로 저장 / 인쇄
  </button>
  <button onclick="window.close()" style="background:#f1f5f9;color:#64748b;border:none;padding:12px 20px;border-radius:10px;font-size:14px;cursor:pointer;">
    닫기
  </button>
</div>

<script>
  // Auto-trigger print after fonts load
  window.addEventListener('load', () => setTimeout(() => window.print(), 1000));
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

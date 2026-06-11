// 의존성 없이 CSV 파일을 만들어 브라우저에서 바로 내려받는다.
// 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM(﻿)을 앞에 붙이고, 줄바꿈은 CRLF(엑셀 호환)를 쓴다.
type Cell = string | number | undefined | null;

const escapeCell = (v: Cell): string => {
  const s = v == null ? '' : String(v);
  // 따옴표·콤마·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 두 번으로 이스케이프
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, headers: Cell[], rows: Cell[][]) {
  const body = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

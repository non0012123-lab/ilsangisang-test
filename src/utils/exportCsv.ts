// 의존성 없이 CSV 를 만들어 내려받는다. 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM(﻿)을 앞에 붙이고
// 줄바꿈은 CRLF(엑셀 호환)를 쓴다. 데스크톱은 앵커 다운로드, 모바일/PWA(특히 iOS)는 공유 시트로 저장한다.
type Cell = string | number | undefined | null;

const escapeCell = (v: Cell): string => {
  const s = v == null ? '' : String(v);
  // 따옴표·콤마·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 두 번으로 이스케이프
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function downloadCsv(filename: string, headers: Cell[], rows: Cell[][]) {
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const body = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });

  // 1) 모바일/PWA: 파일 공유가 가능하면 공유 시트로(→ '파일에 저장' 등). 앵커 download 가 막히는 iOS 대응.
  const file = new File([blob], name, { type: 'text/csv' });
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name } as ShareData);
      return;
    } catch (err) {
      // 사용자가 공유를 취소한 경우엔 그대로 종료(다운로드 재시도하지 않음)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // 그 외 오류는 아래 앵커 다운로드로 폴백
    }
  }

  // 2) 데스크톱 등: 앵커 + Blob URL 다운로드
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 의존성 없이 CSV 를 만들어 내려받는다. 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 앞에 붙이고
// 줄바꿈은 CRLF(엑셀 호환)를 쓴다. PC(데스크톱 앱 포함)는 일반 다운로드, 모바일/태블릿만 공유 시트로 저장.
type Cell = string | number | undefined | null;

const escapeCell = (v: Cell): string => {
  const s = v == null ? '' : String(v);
  // 따옴표·콤마·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 두 번으로 이스케이프
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 손가락 입력(모바일/태블릿)인지 — PC(데스크톱 앱 포함)는 false. 공유 시트 대신 일반 다운로드를 쓰기 위한 판별.
const isTouchDevice = (): boolean => {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
};

export async function downloadCsv(filename: string, headers: Cell[], rows: Cell[][]) {
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const body = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
  const text = '\uFEFF' + body; // 엑셀 한글용 BOM 포함 본문
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });

  // 0) 데스크톱 앱(Tauri WebView): 앵커 다운로드가 막혀 있어 네이티브 저장 명령으로 다운로드 폴더에 저장.
  //    (구버전 앱엔 명령이 없어 실패 → 아래 일반 경로로 폴백. 새 앱 버전부터 동작)
  const tauri = (window as unknown as { __TAURI__?: { core?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } } }).__TAURI__;
  if (tauri?.core?.invoke) {
    try {
      const savedPath = await tauri.core.invoke('save_text_file', { filename: name, contents: text });
      alert(`다운로드 폴더에 저장되었습니다.\n${savedPath}`);
      return;
    } catch {
      // 명령 미존재(구버전) 등 → 아래 웹 표준 경로로 폴백
    }
  }

  // 1) 모바일/태블릿에서만 공유 시트로 저장(앵커 download 가 막히는 iOS 등 대응). PC 는 건너뛴다.
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  if (isTouchDevice() && typeof nav.canShare === 'function') {
    const file = new File([blob], name, { type: 'text/csv' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name } as ShareData);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return; // 사용자가 취소 → 종료
        // 그 외 오류는 아래 앵커 다운로드로 폴백
      }
    }
  }

  // 2) PC(데스크톱 앱 포함): 앵커 + Blob URL 일반 다운로드
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

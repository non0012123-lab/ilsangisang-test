// 화면 캡처 브리지 (데스크톱 앱 전용).
//  • 실제 동작은 Tauri(Rust) 의 capture::* 명령/이벤트가 한다. 여기선 호출·구독만.
//  • 웹(브라우저)에서는 Tauri 가 없으므로 isCaptureAvailable()=false → UI 가 "데스크톱 앱 전용" 안내.

export function isCaptureAvailable(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// 현재 모니터 전체 캡처 → base64 PNG(접두사 없음). 전체/영역 캡처가 공통으로 사용.
export async function captureScreen(): Promise<string> {
  return invoke<string>('capture_primary_screen');
}

// base64 PNG 를 기본 저장 폴더에 주어진 파일명으로 저장. 저장된 경로를 돌려준다.
export async function saveCapture(dataB64: string, name: string): Promise<string> {
  return invoke<string>('save_capture', { dataB64, name });
}

export async function getSaveDir(): Promise<string> {
  return invoke<string>('get_save_dir');
}

// 네이티브 폴더 선택 대화상자 → 선택 시 기본 저장 폴더로 설정. 선택한 경로(취소 시 null) 반환.
export async function pickSaveDir(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir === 'string' && dir) {
    await invoke('set_save_dir', { dir });
    return dir;
  }
  return null;
}

// 전역 단축키(Ctrl+Shift+S) 캡처 결과를 구독. cb 에 data URL(혹은 에러)을 넘긴다. 해제 함수 반환.
export async function onCaptureEvents(
  onTaken: (dataUrl: string) => void,
  onError: (msg: string) => void,
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  const un1 = await listen<string>('capture-taken', e => onTaken(`data:image/png;base64,${e.payload}`));
  const un2 = await listen<string>('capture-error', e => onError(String(e.payload)));
  return () => { un1(); un2(); };
}

// 자동 파일명: "라벨_YYYY-MM-DD_HHMMSS.png" (라벨 없으면 '캡처')
export function autoFileName(label?: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const base = (label ?? '').trim() || '캡처';
  return `${base}_${stamp}.png`;
}

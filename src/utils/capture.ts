// 내장 브라우저 + 화면 캡처 브리지 (데스크톱 앱 전용).
//  • 실제 동작은 Tauri(Rust) 의 capture::* 명령이 한다. 여기선 그걸 호출만 한다.
//  • 웹(브라우저)에서는 Tauri 가 없으므로 isCaptureAvailable()=false → UI 가 "데스크톱 앱 전용" 안내.

export function isCaptureAvailable(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// 외부 URL 을 별도 네이티브 창에 연다(이미 열려 있으면 그 주소로 이동).
export async function openInternalBrowser(url: string): Promise<void> {
  await invoke('open_internal_browser', { url });
}

// 현재 보이는 화면 캡처 → base64 PNG(접두사 없음). 전체/영역 캡처가 공통으로 사용.
export async function captureBrowser(): Promise<string> {
  return invoke<string>('capture_browser');
}

// 자동 스크롤하며 전체 페이지를 이어붙인 캡처 → base64 PNG.
export async function captureBrowserScroll(): Promise<string> {
  return invoke<string>('capture_browser_scroll');
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

// 자동 파일명: "라벨_YYYY-MM-DD_HHMM.png" (라벨 없으면 '캡처')
export function autoFileName(label?: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const base = (label ?? '').trim() || '캡처';
  return `${base}_${stamp}.png`;
}

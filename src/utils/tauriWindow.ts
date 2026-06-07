// 데스크톱 셸(Tauri) 창 제어 헬퍼.
//  • 어시스턴트 퀵바(별도 webview 창)에서 Esc/닫기 시 자기 창을 트레이로 숨길 때 사용.
//  • 브라우저(웹)에서는 Tauri 가 없으므로 아무것도 하지 않는다(번들에 import 도 안 됨).

function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// 현재 창을 숨긴다(데스크톱 앱에서만). 셸이 단축키로 다시 보여준다.
export async function hideCurrentWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().hide();
  } catch (e) {
    console.warn('[tauri] 창 숨기기 실패:', e);
  }
}

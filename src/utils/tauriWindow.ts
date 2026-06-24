// 데스크톱 셸(Tauri) 창 제어 헬퍼.
//  • 어시스턴트 퀵바(별도 webview 창)에서 Esc/닫기 시 자기 창을 트레이로 숨길 때 사용.
//  • 브라우저(웹)에서는 Tauri 가 없으므로 아무것도 하지 않는다(번들에 import 도 안 됨).

function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// 현재 webview 창의 라벨(데스크톱 앱). 웹/비-Tauri 면 null.
//  • 어시스턴트 퀵바 창은 라벨이 'assistant' — 이 창을 항상 /widget 에 고정하기 위한 식별용.
export async function getWindowLabel(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().label;
  } catch {
    return null;
  }
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

// 현재 창을 최소화한다(데스크톱 앱에서만) — 작업표시줄에 남도록.
//  • 퀵바는 평소 skipTaskbar=true(오버레이)라, 최소화 전에 false 로 바꿔야 작업표시줄에 아이콘이 남는다.
//  • 작업표시줄 아이콘을 클릭하면 복원된다. 단축키로 다시 띄우면 셸이 skipTaskbar 를 true 로 되돌린다.
export async function minimizeCurrentWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    await w.setSkipTaskbar(false);
    await w.minimize();
  } catch (e) {
    console.warn('[tauri] 창 최소화 실패:', e);
  }
}

// 어시스턴트 퀵바 기본 크기(tauri.conf.json 의 assistant 창과 동일하게 유지)
export const ASSISTANT_DEFAULT_SIZE = { width: 560, height: 540 };

// 현재 창을 기본 크기로 되돌린다(어시스턴트 퀵바 "원래 크기" 버튼용).
export async function resetCurrentWindowSize(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setSize(new LogicalSize(ASSISTANT_DEFAULT_SIZE.width, ASSISTANT_DEFAULT_SIZE.height));
  } catch (e) {
    console.warn('[tauri] 창 크기 초기화 실패:', e);
  }
}

// 현재 창을 앞으로 가져온다(트레이/최소화 상태에서 복원 + 포커스) — 알림 클릭 시 앱이 위로 뜨게.
export async function focusCurrentWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    try { await w.unminimize(); } catch { /* noop */ }
    await w.show();
    await w.setFocus();
  } catch (e) {
    console.warn('[tauri] 창 포커스 실패:', e);
  }
}

// 데스크톱 네이티브 알림 클릭(activation) 구독. 콜백에 알림에 실린 link(extra.link)를 넘긴다.
//  • 반환값은 해제 함수. 웹/비-Tauri 면 아무것도 하지 않고 no-op 해제 함수를 돌려준다.
export async function onNotificationActivated(cb: (link?: string) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { onAction } = await import('@tauri-apps/plugin-notification');
    const listener = await onAction(notif => {
      const extra = (notif as { extra?: Record<string, unknown> }).extra;
      const link = extra && typeof extra.link === 'string' ? extra.link : undefined;
      cb(link);
    });
    return () => { void listener.unregister(); };
  } catch (e) {
    console.warn('[tauri] 알림 클릭 구독 실패:', e);
    return () => {};
  }
}

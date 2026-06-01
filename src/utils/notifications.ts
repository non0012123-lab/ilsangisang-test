// 데스크톱(브라우저) 알림 헬퍼.
//  • 브라우저 Notification API는 사용자가 권한을 허용해야만 OS 알림 센터에 토스트를 띄울 수 있다.
//  • 정책: 권한이 granted 이고 "다른 탭/창을 보고 있을 때"(document.visibilityState === 'hidden')에만 실제로 띄운다.
//    현재 앱 화면을 보고 있을 땐 인앱(종 아이콘) 알림으로 충분하므로 OS 토스트는 생략한다.

export function isNotifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// 현재 권한 상태. 미지원이면 'denied' 취급.
export function notifyPermission(): NotificationPermission {
  return isNotifySupported() ? Notification.permission : 'denied';
}

// 권한 요청(사용자 제스처에서 호출). 결과 권한 상태를 반환.
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!isNotifySupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

// OS 데스크톱 알림을 띄운다. 권한이 없거나, 미지원이거나, 탭을 보고 있는 중이면 아무것도 하지 않는다.
export function fireDesktop(title: string, body?: string, tag?: string): void {
  if (!isNotifySupported() || Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return;
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.ico' });
    n.onclick = () => { try { window.focus(); } catch { /* noop */ } n.close(); };
  } catch {
    /* 일부 브라우저는 ServiceWorker 없이는 생성자 호출이 막힐 수 있음 — 무시 */
  }
}

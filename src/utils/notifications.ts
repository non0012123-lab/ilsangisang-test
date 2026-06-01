// 데스크톱(브라우저) 알림 헬퍼.
//  • 브라우저 Notification API는 사용자가 권한을 허용해야만 OS 알림 센터에 토스트를 띄울 수 있다.
//  • 정책: 권한이 granted 이면 현재 앱 화면을 보고 있든 다른 탭을 보고 있든 "항상" OS 토스트를 띄운다.

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

// OS 데스크톱 알림을 띄운다. 권한이 없거나 미지원이면 아무것도 하지 않는다(탭 포커스 여부와 무관하게 항상 표시).
// 실제로 알림을 생성했으면 true, (권한 없음/미지원/생성 실패) 면 false 를 반환한다.
export function fireDesktop(title: string, body?: string, tag?: string): boolean {
  if (!isNotifySupported() || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.ico' });
    n.onclick = () => { try { window.focus(); } catch { /* noop */ } n.close(); };
    return true;
  } catch (e) {
    // 일부 브라우저(예: Android Chrome)는 ServiceWorker 없이는 생성자 호출이 막힘
    console.warn('[notify] 데스크톱 알림 생성 실패:', e);
    return false;
  }
}

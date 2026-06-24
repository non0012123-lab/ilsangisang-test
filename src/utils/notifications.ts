// 데스크톱(브라우저) 알림 헬퍼.
//  • 브라우저: Notification API (사용자가 권한 허용해야 OS 토스트).
//  • Tauri 데스크톱 앱(WebView2): 웹 Notification 은 미지원/권한 불가라, Tauri 네이티브 알림 플러그인으로 띄운다.
//  • 정책: 권한이 granted 이면 화면 포커스 여부와 무관하게 "항상" OS 토스트를 띄운다.

// Tauri(데스크톱 셸) 안에서 실행 중인지
function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}
// 데스크톱 앱에서만 동적 로드(브라우저 번들에선 isTauri=false 라 import 자체가 실행되지 않음)
async function tauriNotif() {
  return await import('@tauri-apps/plugin-notification');
}

export function isNotifySupported(): boolean {
  if (isTauri()) return true; // 네이티브 알림 사용
  return typeof window !== 'undefined' && 'Notification' in window;
}

// 현재 권한 상태. Tauri 에선 OS 가 직접 표시하므로 granted 로 취급(권한 안내 메시지·자물쇠 문구 숨김).
export function notifyPermission(): NotificationPermission {
  if (isTauri()) return 'granted';
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
}

// 권한 요청(사용자 제스처에서 호출). 결과 권한 상태를 반환.
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (isTauri()) {
    try {
      const n = await tauriNotif();
      let granted = await n.isPermissionGranted();
      if (!granted) granted = (await n.requestPermission()) === 'granted';
      return granted ? 'granted' : 'denied';
    } catch { return 'granted'; }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

// OS 데스크톱 알림을 띄운다. 권한이 없거나 미지원이면 아무것도 하지 않는다(탭 포커스 여부와 무관하게 항상 표시).
// 실제로 알림을 생성했으면 true, (권한 없음/미지원/생성 실패) 면 false 를 반환한다.
// requireInteraction: 자동으로 사라지지 않고 사용자가 클릭/닫을 때까지 화면에 유지 — 담당자가
//   자리를 비웠다 돌아와도 놓치지 않도록(데스크톱 Chrome/Edge에서 동작, macOS/모바일은 OS 정책상 제한).
export function fireDesktop(title: string, body?: string, tag?: string, link?: string): boolean {
  // Tauri 데스크톱: 네이티브 알림(권한 프롬프트 없이 OS 가 표시). 비동기지만 fire-and-forget.
  if (isTauri()) {
    (async () => {
      try {
        const n = await tauriNotif();
        if (!(await n.isPermissionGranted())) { if ((await n.requestPermission()) !== 'granted') return; }
        // extra.link 를 실어 보내면, 알림 클릭(onAction) 시 그 화면(요청함/공지 등 특정 게시글)으로 이동한다.
        n.sendNotification({ title, body, extra: link ? { link } : undefined });
      } catch (e) { console.warn('[notify] Tauri 알림 실패:', e); }
    })();
    return true;
  }
  // 브라우저
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  // ★ 모바일(Android Chrome·설치형 PWA·iOS 16.4+)은 new Notification() 이 막혀 있어
  //    반드시 서비스워커의 showNotification 을 써야 한다. SW 가 있으면 그쪽으로 띄운다.
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body, tag, icon: '/icon.svg', badge: '/icon.svg',
          data: { link: link || '/' }, requireInteraction: true,
        }).catch(() => fallbackNotification(title, body, tag, link));
      }).catch(() => fallbackNotification(title, body, tag, link));
      return true;
    } catch { /* 아래 생성자 폴백 */ }
  }
  return fallbackNotification(title, body, tag, link);
}

// 서비스워커가 없는 데스크톱 브라우저용 폴백(구형/SW 미등록).
function fallbackNotification(title: string, body?: string, tag?: string, link?: string): boolean {
  try {
    const n = new Notification(title, { body, tag, icon: '/icon.svg', requireInteraction: true });
    n.onclick = () => {
      try {
        window.focus();
        // 알림 클릭 → 해당 화면(요청함/공지 등 특정 게시글)으로 이동. 이미 같은 주소면 그대로.
        if (link && link !== '/' && window.location.pathname + window.location.search !== link) window.location.assign(link);
      } catch { /* noop */ }
      n.close();
    };
    return true;
  } catch (e) {
    console.warn('[notify] 알림 생성 실패:', e);
    return false;
  }
}

/* 일상이상 PWA 서비스워커
 *  • 설치 가능(installable) + 푸시 알림 표시 + 알림 클릭 처리.
 *  • ★ SPA 본체는 절대 캐시하지 않는다 — Cloudflare 자동배포가 즉시 반영되도록(오래된 화면 방지).
 *    fetch 는 네트워크 패스스루만 한다(오프라인 캐시 없음).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// fetch 핸들러 존재 자체가 일부 브라우저의 설치 조건 — 단, 가로채지 않고 네트워크 그대로 사용.
self.addEventListener('fetch', () => { /* 기본 네트워크 사용(캐시 없음) */ });

// 서버 푸시 수신(앱이 닫혀 있어도 OS가 깨움) → 시스템 알림. payload: { title, body, link, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: event.data && event.data.text() }; }
  const title = data.title || '일상이상';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag,
    data: { link: data.link || '/' },
    renotify: !!data.tag,
  }));
});

// 알림 클릭 → 열린 앱이 있으면 포커스(+해당 링크로 이동), 없으면 새 창으로 링크 열기.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) {
        await c.focus();
        if (link && 'navigate' in c) { try { await c.navigate(link); } catch { /* noop */ } }
        return;
      }
    }
    await self.clients.openWindow(link);
  })());
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 배포로 청크 해시가 바뀌어 옛 청크(.js)를 못 받으면(동적 import 실패) 화면이 백지가 된다.
//  → 새 index.html 로 1회 새로고침해 최신 청크를 받게 한다(무한루프 방지 세션가드).
const hardReloadOnce = (why: string) => {
  try {
    if (sessionStorage.getItem('chunk-reloaded')) return;
    sessionStorage.setItem('chunk-reloaded', '1');
    console.warn(`[app] 청크 로드 실패 → 새로고침(${why})`);
    location.reload();
  } catch { /* noop */ }
};
window.addEventListener('vite:preloadError', e => { e.preventDefault(); hardReloadOnce('vite:preloadError'); });
// 스크립트 자체 로드 실패(캐시된 옛 index.html이 삭제된 청크를 참조 등)도 커버.
window.addEventListener('error', e => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) hardReloadOnce('asset-load-error');
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA 서비스워커 등록 — 웹에서만(데스크톱 Tauri 셸은 네이티브 알림 사용).
//  설치 가능(홈 화면에 추가) + 모바일 시스템 알림(showNotification) + 향후 서버 푸시 수신.
const isTauriShell = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
if (!isTauriShell && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[pwa] SW 등록 실패:', err));
  });
}

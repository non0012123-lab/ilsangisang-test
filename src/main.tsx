import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

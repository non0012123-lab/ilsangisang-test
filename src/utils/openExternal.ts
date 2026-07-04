// 외부 링크(및 이미지 등)를 여는 공용 헬퍼.
//  • 웹: 새 탭(window.open).
//  • 데스크톱 앱(Tauri): 웹뷰는 target="_blank"/window.open 으로 새 창·시스템 브라우저를 못 여므로
//    opener 플러그인으로 OS 기본 브라우저에서 연다.
//    (동작하려면 desktop 셸에 tauri-plugin-opener 등록 + capability 'opener:default' 필요)
import { isTauri } from './tauriWindow';

export async function openExternal(url: string): Promise<void> {
  const u = (url ?? '').trim();
  if (!u) return;
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(u);
      return;
    } catch {
      // 플러그인 미등록/권한 없음 → 웹 방식으로 폴백(앱에선 무동작일 수 있음)
    }
  }
  window.open(u, '_blank', 'noopener,noreferrer');
}

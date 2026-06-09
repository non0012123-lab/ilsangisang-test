// 데스크톱 셸(Tauri) 자동 업데이트.
//  • 이 앱의 화면은 원격 URL에서 로드되므로 웹/UI 변경은 이미 자동 반영된다.
//    여기서 갱신하는 것은 "네이티브 셸 바이너리"(권한·Rust·창설정 등) — 평소엔 거의 안 바뀌지만,
//    바뀌면 예전엔 사용자가 새 exe 를 직접 받아 재설치해야 했다. 이걸 자동화한다.
//  • 동작: 앱 시작 시 GitHub Release 의 latest.json 을 확인 → 새 버전이 있으면 조용히
//    다운로드·설치하고 재실행한다(사용자 개입 없음). 브라우저(웹)에서는 아무것도 하지 않는다.
//  • 업데이트는 드물고 시작 시점에만 일어나므로 작업 중단 위험이 작다.

function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

let started = false; // 한 세션에 한 번만

// 앱 시작 시 1회 호출. 실패해도 앱 동작에는 영향 없음(조용히 무시).
export async function runSilentUpdate(): Promise<void> {
  if (started || !isTauri()) return;
  started = true;
  try {
    // 트레이 메인 창에서만 수행 — 어시스턴트 퀵바 등 보조 창이 동시에 재실행을 트리거하지 않도록.
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    if (getCurrentWindow().label !== 'main') return;

    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update?.available) return;

    await update.downloadAndInstall(); // 다운로드 + 설치(서명 검증은 플러그인이 pubkey 로 수행)

    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch(); // 설치 적용을 위해 재실행
  } catch (e) {
    console.warn('[tauri] 자동 업데이트 확인 실패:', e);
  }
}

// 일상이상 커뮤니케이션 데스크톱 셸 (Tauri v2)
//  • 창은 배포된 웹사이트를 그대로 띄운다(웹 콘텐츠/AI/API 는 Cloudflare 가 자동 업데이트).
//  • 네이티브 기능만 여기서 처리: 트레이 상주 · PC 시작 시 자동실행(기본 ON) · 단일 인스턴스 · 자동 업데이트.
//  • 자동 로그인은 웹뷰가 세션(localStorage)을 보존하므로 추가 코드 없이 유지된다.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::{ManagerExt, MacosLauncher};

// 메인 창을 보이고 포커스
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 이미 실행 중이면 새 창을 띄우지 않고 기존 창을 보여줌
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        // PC 시작 시 자동 실행 플러그인
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // 셸 자동 업데이트
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 자동 실행 기본값 ON (사용자가 OS 설정에서 끄기 전까지)
            let _ = app.autolaunch().enable();

            // 트레이 아이콘 + 우클릭 메뉴
            let show_i = MenuItem::with_id(app, "show", "열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("일상이상 커뮤니케이션")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 트레이 아이콘 좌클릭 → 창 열기
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // 창 닫기(X) = 종료가 아니라 트레이로 숨김 → 백그라운드 상주(알림·리마인더 유지)
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

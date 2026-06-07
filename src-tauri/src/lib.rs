// 일상이상 커뮤니케이션 데스크톱 셸 (Tauri v2)
//  • 창은 배포된 웹사이트를 그대로 띄운다(웹 콘텐츠/AI/API 는 Cloudflare 가 자동 업데이트).
//  • 네이티브 기능만 여기서 처리: 트레이 상주 · PC 시작 시 자동실행(기본 ON) · 단일 인스턴스 · 자동 업데이트
//    · AI 어시스턴트 퀵바(Ctrl+Shift+Space 로 소환하는 별도 창).
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

// 어시스턴트 퀵바 창을 화면 중앙에 보이고 포커스(트레이 메뉴/소환 시)
fn show_assistant(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("assistant") {
        let _ = w.center();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

// 어시스턴트 퀵바 토글: 보이는 중이면 숨기고, 아니면 띄운다(전역 단축키용)
fn toggle_assistant(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("assistant") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_assistant(app);
        }
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
        // 네이티브 알림(웹뷰 웹알림 대신 OS 알림) — 원격 웹 페이지가 IPC 로 호출
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 자동 실행 기본값 ON (사용자가 OS 설정에서 끄기 전까지)
            let _ = app.autolaunch().enable();

            // 전역 단축키(Ctrl+Shift+Space) → 어시스턴트 퀵바 토글
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };
                let toggle_sc = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                let sc_for_handler = toggle_sc.clone(); // 핸들러로 move, 등록엔 원본 사용
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, sc, event| {
                            // 눌렀을 때(Pressed)만 처리 — 떼는 이벤트(Released)는 무시
                            if sc == &sc_for_handler && event.state() == ShortcutState::Pressed {
                                toggle_assistant(app);
                            }
                        })
                        .build(),
                )?;
                app.global_shortcut().register(toggle_sc)?;
            }

            // 트레이 아이콘 + 우클릭 메뉴
            let assistant_i = MenuItem::with_id(app, "assistant", "AI 어시스턴트 (Ctrl+Shift+Space)", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&assistant_i, &show_i, &quit_i])?;
            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("일상이상 커뮤니케이션")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "assistant" => show_assistant(app),
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
        .on_window_event(|window, event| match event {
            // 창 닫기(X/Alt+F4) = 종료가 아니라 트레이로 숨김 → 백그라운드 상주(알림·리마인더 유지)
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            // 어시스턴트 퀵바는 포커스를 잃으면(다른 창 클릭) 자동으로 숨김 — 작업에 안 거슬리게
            WindowEvent::Focused(false) if window.label() == "assistant" => {
                let _ = window.hide();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

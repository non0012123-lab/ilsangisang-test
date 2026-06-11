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

// 어시스턴트 퀵바 창을 보이고 포커스(트레이 메뉴/소환 시).
//  • 위치는 사용자가 드래그해둔 마지막 자리를 그대로 사용(window-state 플러그인이 기억) — 중앙 강제 X.
fn show_assistant(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("assistant") {
        // 최소화 버튼으로 작업표시줄에 내려갔던 경우(skipTaskbar=false) → 단축키로 다시 부르면
        // 깔끔한 오버레이로 복귀하도록 작업표시줄에서 다시 숨긴다.
        let _ = w.unminimize();
        let _ = w.set_skip_taskbar(true);
        let _ = w.show();
        let _ = w.set_focus();
        // 이중 안전: 절전 후 webview 가 루트로 리로드돼 대시보드로 튕긴 경우, 보일 때
        // /widget 으로 되돌린다(웹의 AssistantWindowGuard 와 함께 작동, full reload 없이 react-router 이동).
        let _ = w.eval(
            "if(location.pathname!=='/widget'){history.replaceState(null,'','/widget');window.dispatchEvent(new PopStateEvent('popstate'));}",
        );
    }
}

// 어시스턴트 퀵바 토글(전역 단축키용).
//  • 퀵바는 alwaysOnTop 이라 대시보드를 클릭하면 "보이지만 포커스 없음" 상태가 흔하다.
//    이때 단축키를 누르면 사용자는 "퀵바로 가기"를 원하므로, 보이기만 해선 숨기면 안 된다.
//  • 그래서 "보이고 + 포커스까지 있을 때"만 숨기고, 그 외(숨김/보이지만 비포커스)는 띄우고 포커스.
fn toggle_assistant(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("assistant") {
        let visible = w.is_visible().unwrap_or(false);
        let focused = w.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = w.hide();
        } else {
            show_assistant(app);
        }
    }
}

// 원격 웹에서 호출하는 파일 저장 명령 — 데스크톱 앱은 WebView 의 <a download> 가 막혀 있어
// 엑셀(CSV) 같은 다운로드를 여기서 처리한다. 다운로드 폴더에 저장하고, 같은 이름이 있으면 (1),(2)… 를 붙여 덮어쓰지 않는다.
#[tauri::command]
fn save_text_file(app: tauri::AppHandle, filename: String, contents: String) -> Result<String, String> {
    let dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("다운로드 폴더를 찾지 못했습니다: {e}"))?;
    // 경로 조작 방지: 전달된 값에서 파일명만 사용
    let base = std::path::Path::new(&filename)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("download.csv")
        .to_string();
    let mut path = dir.join(&base);
    if path.exists() {
        let p = std::path::Path::new(&base);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("download").to_string();
        let ext = p
            .extension()
            .and_then(|s| s.to_str())
            .map(|e| format!(".{e}"))
            .unwrap_or_default();
        let mut i = 1;
        loop {
            let cand = dir.join(format!("{stem} ({i}){ext}"));
            if !cand.exists() {
                path = cand;
                break;
            }
            i += 1;
        }
    }
    std::fs::write(&path, contents.as_bytes()).map_err(|e| format!("저장 실패: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 원격 웹(배포 사이트)이 IPC 로 호출하는 네이티브 명령
        .invoke_handler(tauri::generate_handler![save_text_file])
        // 이미 실행 중이면 새 창을 띄우지 않고 기존 창을 보여줌
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        // PC 시작 시 자동 실행 플러그인
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // 셸 자동 업데이트
        .plugin(tauri_plugin_updater::Builder::new().build())
        // 업데이트 설치 후 재실행(relaunch) — 원격 웹의 자동 업데이트 코드가 IPC 로 호출
        .plugin(tauri_plugin_process::init())
        // 네이티브 알림(웹뷰 웹알림 대신 OS 알림) — 원격 웹 페이지가 IPC 로 호출
        .plugin(tauri_plugin_notification::init())
        // 창 위치/크기 기억 — 어시스턴트 퀵바를 듀얼모니터 원하는 자리에 두면 다음에도 그 자리.
        //  VISIBLE 은 저장하지 않음(퀵바는 항상 숨김 상태로 시작 → 단축키로 소환).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::SIZE)
                .build(),
        )
        .setup(|app| {
            // 자동 실행 기본값 ON (사용자가 OS 설정에서 끄기 전까지)
            let _ = app.autolaunch().enable();

            // 전역 단축키: Ctrl+Shift+Space → 어시스턴트 퀵바 토글 / Ctrl+Shift+S → 화면 캡처
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
        // 창 닫기(X/Alt+F4) = 종료가 아니라 트레이로 숨김 → 백그라운드 상주(알림·리마인더 유지).
        //  어시스턴트 퀵바는 포커스를 잃어도 안 꺼짐 — 드래그해둔 자리에 계속 떠 있음(Ctrl+Shift+Space/Esc/X 로 닫기).
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

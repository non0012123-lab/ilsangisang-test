// 화면 캡처(전체/영역) — 데스크톱 전용 네이티브 기능.
//
// 흐름
//  • 전역 단축키(Ctrl+Shift+S)를 누르면(인사이트가 화면 앞에 있는 상태에서) Rust 가 먼저 모니터를 캡처한다.
//    → 그 다음에야 우리 메인 창을 띄우고, 캡처 이미지(PNG base64)를 프런트로 emit 한다(capture-taken).
//    → 프런트가 크롭 오버레이를 띄워 [전체 저장] 또는 [영역 드래그 저장] → save_capture 로 폴더에 저장.
//  • 단축키를 먼저 캡처하고 나중에 창을 띄우므로, 우리 창이 인사이트를 가리지 않는다.
//  • 영역 캡처는 전체 캡처본을 프런트 캔버스에서 잘라 저장한다(네이티브 오버레이 불필요 → 안정적).
//
// ⚠️ xcap/image API 는 버전 차이가 있어 실제 Windows 빌드에서 컴파일 검증이 필요하다.

use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder, RgbaImage};
use tauri::{Emitter, Manager};

// ── 저장 폴더 ────────────────────────────────────────────────
fn save_dir_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("save_dir.txt"))
}

fn default_save_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    let base = app
        .path()
        .picture_dir()
        .or_else(|_| app.path().home_dir())
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    base.join("일상이상캡처")
}

fn resolve_save_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    if let Ok(p) = save_dir_config_path(app) {
        if let Ok(s) = std::fs::read_to_string(&p) {
            let s = s.trim();
            if !s.is_empty() {
                return std::path::PathBuf::from(s);
            }
        }
    }
    default_save_dir(app)
}

#[tauri::command]
pub fn get_save_dir(app: tauri::AppHandle) -> String {
    resolve_save_dir(&app).to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_save_dir(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    let path = save_dir_config_path(&app)?;
    std::fs::write(path, dir.trim()).map_err(|e| e.to_string())
}

// ── 캡처 ─────────────────────────────────────────────────────
// 주 모니터(없으면 첫 모니터)를 캡처한다.
fn capture_primary() -> Result<RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let primary = monitors.iter().find(|m| m.is_primary()).or_else(|| monitors.first());
    let m = primary.ok_or_else(|| "캡처할 모니터를 찾지 못했습니다.".to_string())?;
    m.capture_image().map_err(|e| e.to_string())
}

fn png_base64(img: &RgbaImage) -> Result<String, String> {
    let mut bytes: Vec<u8> = Vec::new();
    PngEncoder::new(&mut bytes)
        .write_image(img.as_raw(), img.width(), img.height(), ColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

// 프런트 버튼용: 현재 모니터 전체를 캡처해 PNG base64 로 돌려준다(영역은 프런트에서 크롭).
#[tauri::command]
pub fn capture_primary_screen() -> Result<String, String> {
    png_base64(&capture_primary()?)
}

// 전역 단축키 핸들러에서 호출: 캡처 → 메인 창 표시 → 프런트로 이미지 전달.
pub fn capture_and_emit(app: &tauri::AppHandle) {
    match capture_primary().and_then(|img| png_base64(&img)) {
        Ok(b64) => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("capture-taken", b64);
        }
        Err(e) => {
            let _ = app.emit("capture-error", e);
        }
    }
}

// ── 저장 ─────────────────────────────────────────────────────
#[tauri::command]
pub fn save_capture(app: tauri::AppHandle, data_b64: String, name: String) -> Result<String, String> {
    let bytes = STANDARD.decode(data_b64.as_bytes()).map_err(|e| e.to_string())?;
    let dir = resolve_save_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(sanitize_filename(&name));
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn sanitize_filename(name: &str) -> String {
    let base: String = name
        .trim()
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    if base.to_lowercase().ends_with(".png") {
        base
    } else {
        format!("{}.png", base)
    }
}

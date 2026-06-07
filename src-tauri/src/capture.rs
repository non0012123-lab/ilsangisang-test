// 내장 브라우저 + 화면 캡처(전체/영역/스크롤) — 데스크톱 전용 네이티브 기능.
//
// 흐름
//  • 프런트(우리 웹앱의 /browser 페이지)가 invoke 로 이 명령들을 부른다.
//  • open_internal_browser: 외부 URL(네이버 블로그/인스타 인사이트 등)을 별도 네이티브 창에 띄운다.
//    └ 사용자가 그 창 안에서 직접 로그인 → 세션 유지(웹뷰가 보존).
//  • capture_browser: 그 창의 "현재 보이는 화면"을 캡처해 PNG(base64)로 돌려준다(전체 캡처).
//    └ 영역 캡처는 이 결과를 프런트 캔버스에서 드래그로 잘라 저장(네이티브 오버레이 불필요 → 안정적).
//  • capture_browser_scroll: 창의 웹뷰를 위에서 아래로 자동 스크롤하며 프레임을 모아 세로로 이어붙인다.
//  • save_capture: 받은 PNG(base64)를 "기본 저장 폴더"에 자동 파일명으로 저장(앱 안엔 안 들어감).
//  • get/set_save_dir: 기본 저장 폴더 조회/변경(앱 설정 디렉터리에 경로를 보관).
//
// ⚠️ 캡처 라이브러리(xcap)·이미지(image)·Tauri 멀티스레드 API 는 버전별 차이가 있어,
//    실제 Windows 빌드에서 컴파일/동작 검증이 필요하다(개발 환경에 Rust 가 없어 사전 검증 불가).

use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder, RgbaImage};
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const BROWSER_LABEL: &str = "browser";
const BROWSER_TITLE: &str = "일상이상 내장 브라우저";

// ── 저장 폴더 ────────────────────────────────────────────────
// 기본 저장 폴더 경로를 앱 설정 디렉터리의 save_dir.txt 에 보관한다(없으면 사진폴더/일상이상캡처).
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

// ── 내장 브라우저 ────────────────────────────────────────────
#[tauri::command]
pub fn open_internal_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let target = normalize_url(&url);
    if let Some(win) = app.get_webview_window(BROWSER_LABEL) {
        // 이미 열려 있으면 주소만 이동 + 앞으로
        let parsed = target.parse().map_err(|_| "주소 형식이 올바르지 않습니다.".to_string())?;
        win.navigate(parsed).map_err(|e| e.to_string())?;
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let parsed = target.parse().map_err(|_| "주소 형식이 올바르지 않습니다.".to_string())?;
    WebviewWindowBuilder::new(&app, BROWSER_LABEL, WebviewUrl::External(parsed))
        .title(BROWSER_TITLE)
        .inner_size(1100.0, 820.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_url(url: &str) -> String {
    let u = url.trim();
    if u.starts_with("http://") || u.starts_with("https://") {
        u.to_string()
    } else {
        format!("https://{}", u)
    }
}

// ── 캡처 공통 ────────────────────────────────────────────────
// 내장 브라우저 창을 OS 창 목록에서 찾아 현재 보이는 화면을 캡처한다.
fn capture_browser_image() -> Result<RgbaImage, String> {
    let windows = xcap::Window::all().map_err(|e| e.to_string())?;
    let win = windows
        .into_iter()
        .find(|w| w.title().contains("내장 브라우저"))
        .ok_or_else(|| "내장 브라우저 창을 찾지 못했습니다. 먼저 페이지를 열어주세요.".to_string())?;
    win.capture_image().map_err(|e| e.to_string())
}

fn png_base64(img: &RgbaImage) -> Result<String, String> {
    // PngEncoder 로 직접 인코딩 — write_to/ImageFormat 은 image 버전마다 시그니처가 달라 회피.
    let mut bytes: Vec<u8> = Vec::new();
    PngEncoder::new(&mut bytes)
        .write_image(img.as_raw(), img.width(), img.height(), ColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

// 전체 캡처(현재 보이는 화면) → PNG base64. 영역 캡처는 프런트에서 이 결과를 크롭한다.
#[tauri::command]
pub fn capture_browser(app: tauri::AppHandle) -> Result<String, String> {
    // 캡처 직전 메인/어시스턴트 창이 가리지 않도록 브라우저 창을 앞으로.
    if let Some(win) = app.get_webview_window(BROWSER_LABEL) {
        let _ = win.set_focus();
        std::thread::sleep(Duration::from_millis(120));
    }
    let img = capture_browser_image()?;
    png_base64(&img)
}

// ── 스크롤 캡처 ──────────────────────────────────────────────
// 웹뷰를 한 화면씩 내리며 캡처해 세로로 이어붙인다.
//  • 메인 루프(웹뷰 렌더링)를 막지 않도록 blocking 스레드에서 돈다(eval 은 메인 루프가 처리).
//  • 페이지 높이를 JS 에서 되돌려받기 어려워, "직전 프레임과 같아지면(=바닥 도달) 멈춤" 방식 사용.
#[tauri::command]
pub async fn capture_browser_scroll(app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let win = app
            .get_webview_window(BROWSER_LABEL)
            .ok_or_else(|| "내장 브라우저 창이 없습니다.".to_string())?;
        let _ = win.set_focus();
        // 맨 위로 이동 후 잠시 대기
        let _ = win.eval("window.scrollTo(0, 0);");
        std::thread::sleep(Duration::from_millis(400));

        let mut frames: Vec<RgbaImage> = Vec::new();
        let mut prev_bytes: Option<Vec<u8>> = None;
        for _ in 0..40 {
            std::thread::sleep(Duration::from_millis(120));
            let img = capture_browser_image()?;
            let bytes = img.as_raw().clone();
            // 직전 프레임과 동일 = 더 안 내려감(바닥) → 중복 추가하지 않고 종료
            if prev_bytes.as_ref() == Some(&bytes) {
                break;
            }
            prev_bytes = Some(bytes);
            frames.push(img);
            // 한 화면(뷰포트)만큼 내림 — 스크롤 양 = 프레임 높이라 겹침 없이 이어붙는다.
            let _ = win.eval("window.scrollBy(0, Math.round(window.innerHeight));");
            std::thread::sleep(Duration::from_millis(350));
        }
        if frames.is_empty() {
            return Err("캡처된 화면이 없습니다.".to_string());
        }
        let stitched = stitch_vertical(&frames);
        png_base64(&stitched)
    })
    .await
    .map_err(|e| e.to_string())?
}

// 프레임들을 세로로 이어붙인다(폭은 가장 넓은 프레임 기준).
//  픽셀을 직접 복사 — imageops::replace 는 image 버전마다 좌표 타입(u32/i64)이 달라 회피.
fn stitch_vertical(frames: &[RgbaImage]) -> RgbaImage {
    let width = frames.iter().map(|f| f.width()).max().unwrap_or(0);
    let total_h: u32 = frames.iter().map(|f| f.height()).sum();
    let mut canvas = RgbaImage::new(width, total_h);
    let mut y_off: u32 = 0;
    for f in frames {
        for (px, py, pixel) in f.enumerate_pixels() {
            canvas.put_pixel(px, py + y_off, *pixel);
        }
        y_off += f.height();
    }
    canvas
}

// ── 저장 ─────────────────────────────────────────────────────
// PNG(base64)를 기본 저장 폴더에 주어진 파일명으로 쓴다. 저장된 전체 경로를 돌려준다.
#[tauri::command]
pub fn save_capture(app: tauri::AppHandle, data_b64: String, name: String) -> Result<String, String> {
    let bytes = STANDARD.decode(data_b64.as_bytes()).map_err(|e| e.to_string())?;
    let dir = resolve_save_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe = sanitize_filename(&name);
    let path = dir.join(safe);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    let base: String = trimmed
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    if base.to_lowercase().ends_with(".png") {
        base
    } else {
        format!("{}.png", base)
    }
}

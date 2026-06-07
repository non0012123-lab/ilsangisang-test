import { useEffect, useRef, useState } from 'react';
import { Globe, Camera, Crop, ScrollText, FolderOpen, Loader2, X, Check, ExternalLink } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import {
  isCaptureAvailable, openInternalBrowser, captureBrowser, captureBrowserScroll,
  saveCapture, getSaveDir, pickSaveDir, autoFileName,
} from '../utils/capture';

export default function BrowserCapturePage() {
  const available = isCaptureAvailable();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // '전체'|'영역'|'스크롤'|null
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  // 영역 캡처: 캡처본을 띄우고 드래그로 자를 영역을 고른다.
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    getSaveDir().then(setSaveDir).catch(() => {});
  }, [available]);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), 4000);
  };

  const open = async () => {
    if (!url.trim()) return;
    try { await openInternalBrowser(url.trim()); }
    catch (e) { flash('err', `브라우저 열기 실패: ${msg(e)}`); }
  };

  const doFull = async () => {
    setBusy('전체');
    try {
      const b64 = await captureBrowser();
      const path = await saveCapture(b64, autoFileName(label));
      flash('ok', `저장됨: ${path}`);
    } catch (e) { flash('err', `전체 캡처 실패: ${msg(e)}`); }
    finally { setBusy(null); }
  };

  const doRegion = async () => {
    setBusy('영역');
    try {
      const b64 = await captureBrowser();
      setCropSrc(`data:image/png;base64,${b64}`); // 크롭 UI 열기
    } catch (e) { flash('err', `영역 캡처 실패: ${msg(e)}`); }
    finally { setBusy(null); }
  };

  const doScroll = async () => {
    setBusy('스크롤');
    try {
      const b64 = await captureBrowserScroll();
      const path = await saveCapture(b64, autoFileName(label));
      flash('ok', `저장됨: ${path}`);
    } catch (e) { flash('err', `스크롤 캡처 실패: ${msg(e)}`); }
    finally { setBusy(null); }
  };

  const changeFolder = async () => {
    try {
      const dir = await pickSaveDir();
      if (dir) { setSaveDir(dir); flash('ok', `저장 폴더 변경: ${dir}`); }
    } catch (e) { flash('err', `폴더 변경 실패: ${msg(e)}`); }
  };

  const onCropSave = async (croppedB64: string) => {
    setCropSrc(null);
    try {
      const path = await saveCapture(croppedB64, autoFileName(label));
      flash('ok', `저장됨: ${path}`);
    } catch (e) { flash('err', `영역 저장 실패: ${msg(e)}`); }
  };

  return (
    <Layout>
      <Header title="내장 브라우저 · 캡처" subtitle="외부 페이지(블로그/인스타 인사이트 등)를 열어 전체·영역·스크롤로 캡처하고 폴더에 저장합니다" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {!available ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
            이 기능은 <b>데스크톱 앱에서만</b> 동작합니다. (웹 브라우저에서는 외부 화면 캡처가 제한됩니다.)
          </div>
        ) : (
          <>
            {/* 주소 + 열기 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-gray-400 shrink-0" />
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') open(); }}
                  placeholder="주소 입력 (예: blog.naver.com, instagram.com)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={open}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl">
                  <ExternalLink size={15} /> 열기
                </button>
              </div>
              <p className="text-xs text-gray-400">열린 별도 창에서 직접 로그인하면 인사이트 화면을 띄울 수 있습니다(세션 유지).</p>
            </div>

            {/* 캡처 툴바 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="파일 이름표 (예: 블로그인사이트)"
                  className="w-48 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <CaptureBtn icon={<Camera size={15} />} label="전체 캡처" onClick={doFull} busy={busy === '전체'} disabled={!!busy} />
                <CaptureBtn icon={<Crop size={15} />} label="영역 캡처" onClick={doRegion} busy={busy === '영역'} disabled={!!busy} />
                <CaptureBtn icon={<ScrollText size={15} />} label="스크롤 캡처" onClick={doScroll} busy={busy === '스크롤'} disabled={!!busy} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-50 pt-3">
                <FolderOpen size={14} className="text-gray-400 shrink-0" />
                <span className="truncate flex-1">저장 폴더: <span className="font-mono text-gray-700">{saveDir || '(기본 폴더)'}</span></span>
                <button onClick={changeFolder} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0">폴더 변경</button>
              </div>
              <p className="text-xs text-gray-400">파일명은 “이름표_날짜_시간.png”로 자동 저장됩니다. 영역 캡처는 캡처 후 자를 범위를 직접 드래그합니다.</p>
            </div>
          </>
        )}

        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-xl px-4 py-3 text-sm shadow-lg border ${
            toast.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.msg}
          </div>
        )}
      </div>

      {cropSrc && <CropOverlay src={cropSrc} onCancel={() => setCropSrc(null)} onSave={onCropSave} />}
    </Layout>
  );
}

function msg(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : '알 수 없는 오류';
}

function CaptureBtn({ icon, label, onClick, busy, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; busy: boolean; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon}{label}
    </button>
  );
}

// 영역 캡처용: 캡처본 위에서 사각형을 드래그해 그 부분만 잘라 저장한다.
function CropOverlay({ src, onCancel, onSave }: { src: string; onCancel: () => void; onSave: (b64: string) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const rel = (e: React.MouseEvent) => {
    const box = imgRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(e.clientX - box.left, box.width)), y: Math.max(0, Math.min(e.clientY - box.top, box.height)) };
  };
  const onDown = (e: React.MouseEvent) => { const p = rel(e); setStart(p); setRect({ x: p.x, y: p.y, w: 0, h: 0 }); };
  const onMove = (e: React.MouseEvent) => {
    if (!start) return;
    const p = rel(e);
    setRect({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
  };
  const onUp = () => setStart(null);

  const save = () => {
    const img = imgRef.current!;
    if (!rect || rect.w < 4 || rect.h < 4) return;
    const scale = img.naturalWidth / img.getBoundingClientRect().width; // 표시→원본 픽셀 비율
    const sx = rect.x * scale, sy = rect.y * scale, sw = rect.w * scale, sh = rect.h * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw); canvas.height = Math.round(sh);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onSave(canvas.toDataURL('image/png').split(',')[1]);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white text-sm">
        <span>자를 영역을 드래그하세요</span>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!rect || rect.w < 4} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg font-semibold"><Check size={14} /> 이 영역 저장</button>
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg"><X size={14} /> 취소</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <div className="relative inline-block select-none" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <img ref={imgRef} src={src} alt="capture" className="max-w-full block" draggable={false} />
          {rect && rect.w > 0 && (
            <div className="absolute border-2 border-emerald-400 bg-emerald-400/15 pointer-events-none"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
          )}
        </div>
      </div>
    </div>
  );
}

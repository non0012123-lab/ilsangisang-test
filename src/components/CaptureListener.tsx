import { useEffect, useState } from 'react';
import CropOverlay from './CropOverlay';
import { isCaptureAvailable, onCaptureEvents, saveCapture } from '../utils/capture';

// 전역 단축키(Ctrl+Shift+S) 캡처 결과를 항상 듣고, 크롭 오버레이를 띄워 저장한다.
//  • 데스크톱 앱에서만 동작(웹에선 isCaptureAvailable=false → 아무것도 안 함).
//  • 어느 화면에 있든 동작하도록 App 최상단에 한 번 마운트한다.
export default function CaptureListener() {
  const [src, setSrc] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), 4000);
  };

  useEffect(() => {
    if (!isCaptureAvailable()) return;
    let dispose: (() => void) | undefined;
    onCaptureEvents(
      dataUrl => setSrc(dataUrl),
      msg => flash('err', `캡처 실패: ${msg}`),
    ).then(un => { dispose = un; }).catch(() => {});
    return () => dispose?.();
  }, []);

  const onSave = async (b64: string, name: string) => {
    setSrc(null);
    try {
      const path = await saveCapture(b64, name);
      flash('ok', `저장됨: ${path}`);
    } catch (e) {
      flash('err', `저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    }
  };

  return (
    <>
      {src && <CropOverlay src={src} onSave={onSave} onCancel={() => setSrc(null)} />}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[80] max-w-md rounded-xl px-4 py-3 text-sm shadow-lg border ${
          toast.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

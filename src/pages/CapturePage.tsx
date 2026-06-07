import { useEffect, useState } from 'react';
import { Camera, FolderOpen, Loader2, Keyboard, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import CropOverlay from '../components/CropOverlay';
import { isCaptureAvailable, captureScreen, saveCapture, getSaveDir, pickSaveDir } from '../utils/capture';

export default function CapturePage() {
  const available = isCaptureAvailable();
  const [saveDir, setSaveDir] = useState('');
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => { if (available) getSaveDir().then(setSaveDir).catch(() => {}); }, [available]);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), 4000);
  };
  const msg = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : '오류');

  const captureNow = async () => {
    setBusy(true);
    try { setSrc(`data:image/png;base64,${await captureScreen()}`); }
    catch (e) { flash('err', `캡처 실패: ${msg(e)}`); }
    finally { setBusy(false); }
  };
  const onSave = async (b64: string, name: string) => {
    setSrc(null);
    try { flash('ok', `저장됨: ${await saveCapture(b64, name)}`); }
    catch (e) { flash('err', `저장 실패: ${msg(e)}`); }
  };
  const changeFolder = async () => {
    try { const d = await pickSaveDir(); if (d) { setSaveDir(d); flash('ok', `저장 폴더 변경: ${d}`); } }
    catch (e) { flash('err', `폴더 변경 실패: ${msg(e)}`); }
  };

  return (
    <Layout>
      <Header title="화면 캡처" subtitle="인사이트 등 화면을 캡처해 폴더에 저장합니다 (전체·영역)" />
      <div className="flex-1 p-4 lg:p-6 space-y-4 max-w-2xl">
        {!available ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
            이 기능은 <b>데스크톱 앱에서만</b> 동작합니다. (웹 브라우저에서는 화면 캡처가 제한됩니다.)
          </div>
        ) : (
          <>
            {/* 단축키 안내 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0"><Keyboard size={18} /></div>
                <div className="text-sm text-gray-700">
                  <p className="font-semibold mb-1">캡처 단축키 <kbd className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200 text-xs font-mono">Ctrl</kbd> + <kbd className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200 text-xs font-mono">Shift</kbd> + <kbd className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200 text-xs font-mono">S</kbd></p>
                  <p className="text-gray-500 text-xs leading-relaxed">인사이트 화면을 띄워둔 상태에서 단축키를 누르면 그 화면이 캡처됩니다(우리 앱 창이 인사이트를 가리지 않습니다). 이후 전체 저장 또는 영역을 드래그해 저장하세요.</p>
                </div>
              </div>
            </div>

            {/* 저장 폴더 + 수동 캡처 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FolderOpen size={16} className="text-gray-400 shrink-0" />
                <span className="truncate flex-1">저장 폴더: <span className="font-mono text-gray-700">{saveDir || '(기본 폴더)'}</span></span>
                <button onClick={changeFolder} className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0 text-xs">폴더 변경</button>
              </div>
              <button onClick={captureNow} disabled={busy}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} 지금 화면 캡처
              </button>
              <p className="text-xs text-gray-400 flex items-center gap-1"><AlertCircle size={12} /> ‘지금 화면 캡처’는 이 앱 창도 화면에 포함됩니다. 다른 화면을 찍으려면 단축키를 쓰세요.</p>
            </div>
          </>
        )}

        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-xl px-4 py-3 text-sm shadow-lg border ${
            toast.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>{toast.msg}</div>
        )}
      </div>

      {src && <CropOverlay src={src} onSave={onSave} onCancel={() => setSrc(null)} />}
    </Layout>
  );
}

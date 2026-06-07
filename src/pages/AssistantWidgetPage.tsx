import { useEffect } from 'react';
import { Sparkles, X, Minimize2 } from 'lucide-react';
import DashboardAssistant from '../components/DashboardAssistant';
import { hideCurrentWindow, resetCurrentWindowSize } from '../utils/tauriWindow';

// 데스크톱 앱 트레이용 어시스턴트 퀵바(별도 webview 창, ?widget=assistant 로 진입).
//  • 네비/헤더/사이드바 없이 어시스턴트만 풀스크린.
//  • Esc 또는 닫기 버튼 → 창을 트레이로 숨김(셸이 Ctrl+Shift+Space 로 다시 띄움).
//  • 상단 바는 프레임리스 창 드래그 영역(data-tauri-drag-region).
export default function AssistantWidgetPage() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 입력창에서 IME 조합 중 Esc 는 무시(글자 지움 우선) — 빈/완료 상태에서만 창 숨김
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault();
        void hideCurrentWindow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* 드래그 핸들 + 닫기 */}
      <div data-tauri-drag-region
        className="flex items-center gap-2 px-3 py-2 shrink-0 select-none cursor-default">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shrink-0 pointer-events-none">
          <Sparkles size={12} />
        </div>
        <span className="text-xs font-semibold text-gray-500 pointer-events-none">AI 어시스턴트</span>
        <span className="ml-auto text-[10px] text-gray-300 pointer-events-none">Esc 닫기</span>
        <button onClick={() => void resetCurrentWindowSize()} title="원래 크기로"
          className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
          <Minimize2 size={14} />
        </button>
        <button onClick={() => void hideCurrentWindow()} title="닫기 (Esc)"
          className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* 어시스턴트 본체 — 남은 높이 꽉 채움 */}
      <div className="flex-1 min-h-0 px-2 pb-2 [&>div]:h-full [&>div]:rounded-xl">
        <DashboardAssistant variant="widget" />
      </div>
    </div>
  );
}

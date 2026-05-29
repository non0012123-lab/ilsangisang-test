import { useState } from 'react';
import { Ban, LogOut, RefreshCw, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SuspendedPage() {
  const { user, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
    // 복구되면 AuthContext의 status가 'active'로 바뀌어 라우팅이 자동 전환됨
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">일상이상커뮤니케이션</span>
        </div>

        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <Ban size={30} className="text-red-500" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">계정이 중지되었습니다</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          <span className="font-semibold text-gray-700">{user?.name}</span>님의 계정이 관리자에 의해 중지되어
          현재 서비스를 이용하실 수 없습니다. 문의 사항이 있으시면 관리자에게 연락해주세요.
        </p>

        <div className="bg-gray-50 rounded-xl px-4 py-3 text-left text-xs text-gray-500 mb-6">
          <p><span className="font-semibold text-gray-600">이메일</span> · {user?.email}</p>
          <p className="mt-1"><span className="font-semibold text-gray-600">상태</span> · <span className="text-red-600 font-medium">중지됨</span></p>
        </div>

        <button onClick={check} disabled={checking}
          className="w-full mb-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl transition-colors">
          <RefreshCw size={15} className={checking ? 'animate-spin' : ''} /> {checking ? '확인 중...' : '상태 다시 확인'}
        </button>
        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors">
          <LogOut size={14} /> 로그아웃
        </button>
      </div>
    </div>
  );
}

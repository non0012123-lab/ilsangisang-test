import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, configured } = useAuth();
  const navigate = useNavigate();

  const doLogin = async () => {
    if (busy) return;
    setError('');
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setBusy(true);
    const { error } = await login(email, password);
    setBusy(false);
    if (error) { setError(error); return; }
    navigate('/'); // 루트에서 역할에 따라 대시보드/포털로 분기
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white/30"
              style={{ width: `${(i + 1) * 200}px`, height: `${(i + 1) * 200}px`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          ))}
        </div>
        <div className="relative flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">일상이상</p>
            <p className="text-blue-300 text-sm">커뮤니케이션</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">마케팅 성과를<br />한눈에 관리하세요</h1>
          <p className="text-blue-200 text-lg leading-relaxed">SNS, 유튜브, 네이버까지<br />모든 채널의 일정을 체계적으로 관리합니다.</p>
          <div className="flex gap-6">
            {[{ label: '관리 클라이언트', value: '5+' }, { label: '월 평균 콘텐츠', value: '120+' }, { label: '담당 채널', value: '15+' }].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="text-blue-300 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-slate-500 text-sm">© 2026 일상이상커뮤니케이션</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">일상이상커뮤니케이션</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">로그인</h2>
          <p className="text-gray-500 mb-8">이메일과 비밀번호로 로그인하세요.</p>

          {!configured && (
            <div className="mb-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Supabase가 아직 연결되지 않았습니다. <code className="font-mono">.env</code>에 <code className="font-mono">VITE_SUPABASE_URL</code>·<code className="font-mono">VITE_SUPABASE_ANON_KEY</code>를 설정해주세요.</span>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="이메일 주소 입력"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                onKeyDown={e => e.key === 'Enter' && doLogin()} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-11"
                  onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={doLogin} disabled={busy || !configured}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              {busy ? '로그인 중...' : <>로그인 <ArrowRight size={16} /></>}
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            아직 계정이 없으신가요?{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

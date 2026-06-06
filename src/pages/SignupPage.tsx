import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, ArrowRight, AlertTriangle, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS } from '../data/org';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();

  const doSignup = async () => {
    if (busy) return;
    setError('');
    if (!name || !email || !password) { setError('이름, 이메일, 비밀번호를 모두 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setBusy(true);
    const { error } = await signUp({ name, email, password, department });
    setBusy(false);
    if (error) { setError(error); return; }
    // 이메일 인증 off → 가입 즉시 세션 생성, 루트에서 역할에 따라 분기
    navigate('/');
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
          <h1 className="text-4xl font-bold text-white leading-tight">계정을<br />만들어보세요</h1>
          <p className="text-blue-200 text-lg leading-relaxed">직원과 클라이언트 모두 가입할 수 있습니다.<br />가입 후 관리자 승인을 거쳐 담당자 또는 클라이언트로 이용하실 수 있습니다.</p>
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

          <div className="flex items-center gap-2 mb-2">
            <UserPlus size={22} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">회원가입</h2>
          </div>
          <p className="text-gray-500 mb-8">계정을 생성합니다. 가입 후 관리자 승인을 거쳐 담당자(직원) 또는 클라이언트로 이용하실 수 있습니다.</p>

          {!configured && (
            <div className="mb-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Supabase가 아직 연결되지 않았습니다. <code className="font-mono">.env</code>에 <code className="font-mono">VITE_SUPABASE_URL</code>·<code className="font-mono">VITE_SUPABASE_ANON_KEY</code>를 설정해주세요.</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름 *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">팀 <span className="text-gray-400 font-normal">(선택)</span></label>
                <select value={department} onChange={e => setDepartment(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">팀 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일 *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호 * <span className="text-gray-400 font-normal">(6자 이상)</span></label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-11" />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호 확인 *</label>
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="비밀번호 재입력"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                onKeyDown={e => e.key === 'Enter' && doSignup()} />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={doSignup} disabled={busy || !configured}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              {busy ? '가입 중...' : <>가입하기 <ArrowRight size={16} /></>}
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

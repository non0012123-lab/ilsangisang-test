import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Tab = 'employee' | 'client';

// 직원 탭: 두 번째를 클라이언트 체험 계정으로 변경
const DEMO_USERS = {
  employee: [
    { label: '관리자 (김민준)', email: 'admin@ilsangisang.com', password: 'admin123', badge: '관리자' },
    { label: '스타벅스 클라이언트 체험', email: 'starbucks@client.com', password: 'client123', badge: '클라이언트' },
  ],
  client: [
    { label: '스타벅스 코리아', email: 'starbucks@client.com', password: 'client123', badge: '' },
    { label: '현대자동차', email: 'hyundai@client.com', password: 'client123', badge: '' },
    { label: '올리브영', email: 'oliveyoung@client.com', password: 'client123', badge: '' },
  ],
};

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const doLogin = (e: string, p: string) => {
    setError('');
    const ok = login(e, p);
    if (ok) {
      const saved = localStorage.getItem('currentUser');
      const user = saved ? JSON.parse(saved) : null;
      navigate(user?.role === 'client' ? '/client-portal' : '/dashboard');
    } else {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
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
          <p className="text-gray-500 mb-8">계정 유형을 선택하고 로그인하세요.</p>

          {/* Tab */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(['employee', 'client'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setEmail(''); setPassword(''); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'employee' ? '직원 로그인' : '클라이언트 로그인'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="이메일 주소 입력"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                onKeyDown={e => e.key === 'Enter' && doLogin(email, password)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-11"
                  onKeyDown={e => e.key === 'Enter' && doLogin(email, password)} />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={() => doLogin(email, password)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              로그인 <ArrowRight size={16} />
            </button>
          </div>

          {/* Quick Login */}
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">데모 계정으로 빠른 접속</p>
            <div className="space-y-2">
              {DEMO_USERS[tab].map(u => (
                <button key={u.email} onClick={() => doLogin(u.email, u.password)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{u.label}</span>
                    {u.badge && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${u.badge === '클라이언트' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>
                        {u.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs group-hover:text-blue-500 flex items-center gap-1">
                    {u.email} <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

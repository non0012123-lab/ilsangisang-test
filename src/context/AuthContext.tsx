import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthUser, UserRole, AccountStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SignUpParams {
  name: string;
  email: string;
  password: string;
  department?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (params: SignUpParams) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// profiles 행 → 앱에서 쓰는 AuthUser 형태로 변환
interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  title: string | null;
  position: string | null;
  client_id: string | null;
  status: string | null;
}

function toAuthUser(row: ProfileRow, fallbackEmail?: string): AuthUser {
  return {
    id: row.id,
    name: row.name ?? fallbackEmail ?? '사용자',
    email: row.email ?? fallbackEmail ?? '',
    role: (row.role as UserRole) ?? 'pending',
    department: row.department ?? undefined,
    title: row.title ?? undefined,
    position: row.position ?? undefined,
    clientId: row.client_id ?? undefined,
    status: (row.status as AccountStatus) ?? 'active',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 세션의 사용자에 대응하는 profiles 행을 읽어 상태에 반영
  const loadProfile = async (session: Session | null) => {
    if (!supabase || !session?.user) { setUser(null); return; }
    const { data, error } = await supabase
      .from('profiles')
      .select('*') // '*' 로 조회해 title/position 컬럼이 아직 없어도(마이그레이션 전) 쿼리가 실패하지 않게 함
      .eq('id', session.user.id)
      .single();
    if (error || !data) {
      // 프로필이 아직 없으면 승인 대기로 취급 (안전 기본값)
      setUser({
        id: session.user.id,
        name: (session.user.user_metadata?.name as string) ?? session.user.email ?? '사용자',
        email: session.user.email ?? '',
        role: 'pending',
        department: (session.user.user_metadata?.department as string) ?? undefined,
      });
      return;
    }
    setUser(toAuthUser(data as ProfileRow, session.user.email ?? undefined));
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase가 설정되지 않았습니다. 환경변수를 확인해주세요.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    return {};
  };

  const signUp = async ({ name, email, password, department }: SignUpParams): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase가 설정되지 않았습니다. 환경변수를 확인해주세요.' };
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // 트리거가 이 메타데이터로 profiles 행을 생성 (기본 role = manager)
      options: { data: { name: name.trim(), department: department?.trim() || null } },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered'))
        return { error: '이미 가입된 이메일입니다.' };
      if (error.message.toLowerCase().includes('password'))
        return { error: '비밀번호는 6자 이상이어야 합니다.' };
      return { error: error.message };
    }
    return {};
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  // 승인 상태가 바뀌었을 수 있으니 프로필을 다시 읽음 (승인 대기 화면의 '상태 확인'용)
  const refreshProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  };

  return (
    <AuthContext.Provider value={{ user, loading, configured: isSupabaseConfigured, login, signUp, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, UserCheck, Clock, RefreshCw, AlertTriangle, Ban, RotateCcw, Trash2, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, TITLES, POSITIONS } from '../data/org';
import type { UserRole } from '../types';

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  department: string | null;
  title: string | null;
  position: string | null;
  client_id: string | null;
  status: 'active' | 'suspended';
  created_at: string;
}

// 부서/직함/직책 편집용 작은 드롭다운
function OrgSelect({ value, options, onChange, disabled, placeholder }: {
  value: string | null; options: readonly string[]; onChange: (v: string | null) => void; disabled?: boolean; placeholder: string;
}) {
  return (
    <select value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value || null)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const ROLE_STYLE: Record<UserRole, string> = {
  pending: 'bg-amber-50 text-amber-700',
  manager: 'bg-emerald-50 text-emerald-700',
  client: 'bg-sky-50 text-sky-700',
  admin: 'bg-purple-50 text-purple-700',
};

export default function ApprovalsPage() {
  const { clients, reloadMembers } = useApp();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*') // '*' 로 조회 — title/position 컬럼이 아직 없어도(마이그레이션 전) 실패하지 않음
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (id: string, role: UserRole, clientId?: string | null) => {
    if (!supabase) return;
    setBusyId(id); setError('');
    const patch: { role: UserRole; client_id: string | null } = {
      role,
      client_id: role === 'client' ? (clientId ?? null) : null,
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) setError(`수정 실패: ${error.message}`);
    else {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
      // 담당자 드롭다운(스케줄 등록)에 즉시 반영
      await reloadMembers();
    }
    setBusyId(null);
  };

  // 부서/직함/직책 지정 (role 이 아니므로 권한변경 트리거 영향 없음)
  const updateField = async (id: string, patch: Partial<Pick<Profile, 'department' | 'title' | 'position'>>) => {
    if (!supabase) return;
    setBusyId(id); setError('');
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) setError(`수정 실패: ${error.message}`);
    else {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
      await reloadMembers(); // 어시스턴트·드롭다운에 즉시 반영
    }
    setBusyId(null);
  };

  // 가입 거절 (승인 대기자의 프로필 삭제 → 더 이상 접근/목록 노출 안 됨)
  const rejectUser = async (p: Profile) => {
    if (!supabase) return;
    if (!window.confirm(`'${p.name ?? p.email}' 님의 가입을 거절할까요?\n프로필이 삭제되어 더 이상 접근할 수 없습니다. (되돌릴 수 없음)`)) return;
    setBusyId(p.id); setError('');
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) setError(`거절 실패: ${error.message}`);
    else setProfiles(prev => prev.filter(x => x.id !== p.id));
    setBusyId(null);
  };

  // 계정 중지 / 복구
  const setStatus = async (id: string, status: 'active' | 'suspended') => {
    if (!supabase) return;
    setBusyId(id); setError('');
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) setError(`상태 변경 실패: ${error.message}`);
    else {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      await reloadMembers();
    }
    setBusyId(null);
  };

  // 탈퇴 (프로필 삭제) — 되돌릴 수 없음
  const removeUser = async (p: Profile) => {
    if (!supabase) return;
    if (!window.confirm(`'${p.name ?? p.email}' 계정을 탈퇴 처리할까요?\n프로필이 삭제되며 더 이상 서비스에 접근할 수 없습니다. (되돌릴 수 없음)`)) return;
    setBusyId(p.id); setError('');
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) setError(`탈퇴 실패: ${error.message}`);
    else {
      setProfiles(prev => prev.filter(x => x.id !== p.id));
      await reloadMembers();
    }
    setBusyId(null);
  };

  const pending = profiles.filter(p => p.role === 'pending');
  const others = profiles.filter(p => p.role !== 'pending');
  const activeClients = clients.filter(c => c.status !== 'inactive');

  return (
    <Layout>
      <Header title="가입 승인 / 권한 관리" subtitle="신규 가입자를 검토하고 담당자·클라이언트로 승인합니다" />
      <div className="flex-1 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck size={16} className="text-blue-600" />
            관리자 <span className="font-semibold text-gray-700">{user?.name}</span> 님으로 로그인됨
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> 새로고침
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* 승인 대기 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h3 className="font-bold text-gray-900">승인 대기</h3>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pending.length}명</span>
          </div>
          {loading ? (
            <p className="text-center py-10 text-gray-400 text-sm">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">승인 대기 중인 가입자가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {pending.map(p => (
                <ApprovalRow key={p.id} profile={p} clients={activeClients} busy={busyId === p.id} onUpdate={updateRole} onReject={rejectUser} />
              ))}
            </div>
          )}
        </div>

        {/* 전체 사용자 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            <h3 className="font-bold text-gray-900">전체 사용자</h3>
            <span className="ml-auto text-xs text-gray-400">{others.length}명</span>
          </div>
          {others.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">사용자가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['이름', '이메일', '팀', '직함', '직책', '역할', '연결 클라이언트', '상태', '관리'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {others.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.name ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.email}</td>
                      <td className="px-4 py-3">
                        <OrgSelect value={p.department} options={DEPARTMENTS} placeholder="팀 선택" disabled={busyId === p.id}
                          onChange={v => updateField(p.id, { department: v })} />
                      </td>
                      <td className="px-4 py-3">
                        <OrgSelect value={p.title} options={TITLES} placeholder="직함" disabled={busyId === p.id}
                          onChange={v => updateField(p.id, { title: v })} />
                      </td>
                      <td className="px-4 py-3">
                        <OrgSelect value={p.position} options={POSITIONS} placeholder="직책" disabled={busyId === p.id}
                          onChange={v => updateField(p.id, { position: v })} />
                      </td>
                      <td className="px-4 py-3">
                        <select value={p.role} disabled={busyId === p.id || p.id === user?.id}
                          onChange={e => updateRole(p.id, e.target.value as UserRole, p.client_id)}
                          className={`text-xs font-semibold rounded-lg px-2 py-1 border-0 focus:ring-2 focus:ring-blue-500 ${ROLE_STYLE[p.role]} disabled:opacity-60`}>
                          <option value="pending">승인 대기</option>
                          <option value="manager">담당자</option>
                          <option value="client">클라이언트</option>
                          <option value="admin">관리자</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {p.role === 'client' ? (
                          <select value={p.client_id ?? ''} disabled={busyId === p.id}
                            onChange={e => updateRole(p.id, 'client', e.target.value || null)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">(미지정)</option>
                            {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'suspended'
                          ? <span className="text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">중지됨</span>
                          : <span className="text-xs font-semibold bg-green-50 text-green-600 px-2 py-0.5 rounded-full">활성</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.role === 'admin' || p.id === user?.id ? (
                          <span className="text-gray-300 text-xs">-</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {p.status === 'suspended' ? (
                              <button onClick={() => setStatus(p.id, 'active')} disabled={busyId === p.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                                <RotateCcw size={12} /> 복구
                              </button>
                            ) : (
                              <button onClick={() => setStatus(p.id, 'suspended')} disabled={busyId === p.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                                <Ban size={12} /> 중지
                              </button>
                            )}
                            <button onClick={() => removeUser(p)} disabled={busyId === p.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                              <Trash2 size={12} /> 탈퇴
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ApprovalRow({ profile, clients, busy, onUpdate, onReject }: {
  profile: Profile;
  clients: { id: string; name: string }[];
  busy: boolean;
  onUpdate: (id: string, role: UserRole, clientId?: string | null) => void;
  onReject: (p: Profile) => void;
}) {
  const [clientId, setClientId] = useState('');
  return (
    <div className="px-6 py-4 flex flex-wrap items-center gap-3">
      <div className="min-w-[180px] flex-1">
        <p className="font-semibold text-gray-900">{profile.name ?? '-'}</p>
        <p className="text-xs text-gray-400">{profile.email}{profile.department ? ` · ${profile.department}` : ''}</p>
      </div>
      <button onClick={() => onUpdate(profile.id, 'manager')} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
        <UserCheck size={14} /> 담당자로 승인
      </button>
      <button onClick={() => onReject(profile)} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-semibold rounded-lg transition-colors">
        <XCircle size={14} /> 거절
      </button>
      <div className="flex items-center gap-1.5">
        <select value={clientId} onChange={e => setClientId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">클라이언트 선택</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => onUpdate(profile.id, 'client', clientId)} disabled={busy || !clientId}
          className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
          클라이언트로 승인
        </button>
      </div>
    </div>
  );
}

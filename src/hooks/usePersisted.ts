// 새로고침/배포(앱 리로드)에도 '보던 화면'을 유지하기 위한 localStorage 영속 상태 훅.
//  - 스케줄 페이지의 날짜·월·필터 등을 저장해, 리로드 후에도 오늘로 튕기지 않게 한다.
//  - 키는 'ilsangisang.' 프리픽스(앱 캐시 규약과 동일).
import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'ilsangisang.';
const readRaw = (full: string) => { try { return localStorage.getItem(full); } catch { return null; } };

// 일반 영속 상태(날짜/월/선택일 등). JSON 직렬화 가능한 값만.
export function usePersistedState<T>(key: string, initial: T) {
  const full = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    const raw = readRaw(full);
    if (raw != null) { try { return JSON.parse(raw) as T; } catch { /* 손상 캐시 무시 */ } }
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(full, JSON.stringify(value)); } catch { /* 용량초과 등 무시 */ }
  }, [full, value]);
  return [value, setValue] as const;
}

// 세션 한정 영속 상태(sessionStorage). 새로고침·라우트 이동엔 유지, 탭/브라우저 닫으면 초기화.
//  - 용도: "보던 상세 화면을 다른 메뉴 갔다 와도 유지"(예: 클라이언트 관리에서 선택한 광고주).
//  - localStorage(=usePersistedState)와 달리 '껐다 키면 첫 화면'이 됨.
export function useSessionState<T>(key: string, initial: T) {
  const full = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(full); if (raw != null) return JSON.parse(raw) as T; } catch { /* 무시 */ }
    return initial;
  });
  useEffect(() => {
    try { sessionStorage.setItem(full, JSON.stringify(value)); } catch { /* 무시 */ }
  }, [full, value]);
  return [value, setValue] as const;
}

// 담당자 필터: 저장된 선택이 있으면 그걸, 없으면 selfId(로그인 본인)가 준비되는 즉시 '내 일정'으로 기본 설정.
//  - user/members 는 비동기 로딩 → selfId 가 처음엔 ''(빈값)이라 effect 로 늦게 적용.
//  - 사용자가 명시적으로 바꾸면(set 호출) 그 선택을 저장해 다음 로드에도 유지.
//  - 한 번도 안 건드리면 매 로드 '내 일정'이 기본(저장 안 함).
export function usePersistedManagerFilter(key: string, selfId: string) {
  const full = PREFIX + key;
  const [value, setValue] = useState<string>(() => readRaw(full) ?? 'all');
  const [decided, setDecided] = useState<boolean>(() => readRaw(full) != null);

  useEffect(() => {
    if (decided) return;          // 저장된 선택이 있거나 이미 기본 적용됨
    if (selfId) { setValue(selfId); setDecided(true); }  // 본인 id 준비되면 '내 일정' 기본
  }, [selfId, decided]);

  const set = useCallback((v: string) => {
    setValue(v); setDecided(true);
    try { localStorage.setItem(full, v); } catch { /* 무시 */ }
  }, [full]);

  return [value, set] as const;
}

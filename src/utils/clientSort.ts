import type { Client } from '../types';

// 상태 정렬 우선순위: 진행중(active) → 대기(pending) → 종료(inactive)
const STATUS_ORDER: Record<Client['status'], number> = { active: 0, pending: 1, inactive: 2 };

// 한글 가나다 비교기(숫자는 자연 정렬). 업체명 정렬의 단일 소스.
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
export const byName = (a: Client, b: Client) => collator.compare(a.name ?? '', b.name ?? '');

// 클라이언트 목록 정렬: 즐겨찾기 → 상태 → 가나다.
//  • favIds 를 넘기면 별표한 업체가 맨 위로. 안 넘기면(빈 Set) 상태 → 가나다만 적용.
//  • 원본 배열을 건드리지 않도록 복제 후 정렬한다.
export function sortClients(clients: Client[], favIds: Set<string> = new Set()): Client[] {
  return [...clients].sort((a, b) => {
    const fa = favIds.has(a.id) ? 0 : 1;
    const fb = favIds.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = STATUS_ORDER[a.status] ?? 9;
    const sb = STATUS_ORDER[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return byName(a, b);
  });
}

// 순위 보장 카운팅/상태 파생 헬퍼 — 페이지(표시)와 AppContext(저장/알림)가 함께 쓴다.
//  • 카운트는 저장값이 아니라 items 에서 매번 센다(수정·삭제에도 자동 정확).
//  • "유효(카운트 대상)" 기준은 여기 한 곳에서만 정의 → 정책 변경(예: 1~N위 제한) 시 여기만 고친다.
import type { RankGuarantee, RankGuaranteeItem, RankGuaranteeStatus } from '../types';

// 순위 값이 채워져 있으면 유효(카운트). 현재 정책: 값 존재만 보면 됨(1순위 제한 없음).
export const isAchieved = (it: RankGuaranteeItem): boolean =>
  it.rank != null && String(it.rank).trim() !== '';

// 현재 회차에서 순위가 잡힌 항목 수(=달성 건수).
export const countAchieved = (rg: Pick<RankGuarantee, 'items' | 'cycle'>): number =>
  rg.items.filter(it => it.cycle === rg.cycle && isAchieved(it)).length;

// 임박 임계 = 목표 - 알림오프셋 (예: 20 - 2 = 18). 음수 방지.
export const thresholdOf = (rg: Pick<RankGuarantee, 'guaranteedCount' | 'alertOffset'>): number =>
  Math.max(0, rg.guaranteedCount - rg.alertOffset);

// items·설정으로부터 상태를 파생한다. closed 면 무조건 'closed'(카운팅/알림 멈춤).
export const deriveStatus = (
  rg: Pick<RankGuarantee, 'items' | 'cycle' | 'guaranteedCount' | 'alertOffset' | 'closed'>,
): RankGuaranteeStatus => {
  if (rg.closed) return 'closed';
  const n = countAchieved(rg);
  if (n >= rg.guaranteedCount) return 'reached';
  if (n >= thresholdOf(rg)) return 'due_soon';
  return 'active';
};

export const STATUS_LABEL: Record<RankGuaranteeStatus, string> = {
  active: '진행중', due_soon: '임박', reached: '도달', closed: '종료',
};

import type { InternalCategory } from '../types';

// 내부 일정 기본 종류 — 테이블이 비어 있을 때 1회 시드된다. 이후 사용자가 추가/삭제 가능.
export const DEFAULT_INTERNAL_CATEGORIES: InternalCategory[] = [
  { id: 'ic-meeting-room', name: '회의실', color: '#0ea5e9' },
  { id: 'ic-meeting',      name: '미팅',   color: '#a855f7' },
  { id: 'ic-interview',    name: '면접',   color: '#f59e0b' },
  { id: 'ic-shoot',        name: '촬영',   color: '#ef4444' },
  { id: 'ic-vacation',     name: '휴가',   color: '#22c55e' },
];

// 카테고리 색상 팔레트 (새 종류 추가 시 선택)
export const CATEGORY_COLORS = [
  '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#22c55e',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#6b7280',
];

import type { ReminderOption } from '../types';
// 사전 알림 옵션 (시작 시각 기준)
export const REMINDER_OPTIONS: { value: ReminderOption; label: string }[] = [
  { value: 'off', label: '알림 끔' },
  { value: '1h', label: '1시간 전' },
  { value: '30m', label: '30분 전' },
  { value: '10m', label: '10분 전' },
  { value: 'onTime', label: '정각' },
];
// 옵션 → 시작 전 분(min). onTime=0, off 는 알림 없음(여기 없음)
export const REMINDER_OFFSET_MIN: Record<Exclude<ReminderOption, 'off'>, number> = {
  '1h': 60, '30m': 30, '10m': 10, onTime: 0,
};
export const REMINDER_LABEL: Record<Exclude<ReminderOption, 'off'>, string> = {
  '1h': '1시간 후', '30m': '30분 후', '10m': '10분 후', onTime: '지금 시작',
};

// 반복 일정 규칙 → 실제 발생일 목록으로 펼치는 공유 유틸.
//  • 수동 등록(ScheduleModal)과 AI 적용(AppContext)이 같은 로직을 쓰도록 한 곳에 모음.
//  • 없는 날짜(매월 31일 → 2월)는 그 달 말일로 당긴다(clamp).
import type { Recurrence } from '../types';
import { fmtLocal } from './dateRange';

const MAX = 366; // 한 번에 생성할 수 있는 안전 상한(무한 루프·폭주 방지)

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return fmtLocal(dt);
};
const dayDiff = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
};

// 반복 규칙 → 시작일 목록(YYYY-MM-DD, 오름차순)
export function recurrenceDates(startStr: string, rec: Recurrence): string[] {
  const interval = Math.max(1, Math.round(rec.interval || 1));
  const until = rec.until && rec.until >= startStr ? rec.until : undefined;
  const count = until ? MAX : Math.max(1, Math.min(Math.round(rec.count || 1), MAX));
  const [y, m, d] = startStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const out: string[] = [];

  if (rec.freq === 'monthly') {
    const anchor = rec.day && rec.day >= 1 && rec.day <= 31 ? rec.day : start.getDate();
    let baseY = start.getFullYear();
    let baseM = start.getMonth();
    // 이번 달의 해당 일자가 시작일보다 이전이면(이미 지남) 다음 간격 달부터 시작
    if (Math.min(anchor, daysInMonth(baseY, baseM)) < start.getDate()) baseM += interval;
    for (let i = 0; i < count; i++) {
      const mi = baseM + i * interval;
      const yy = baseY + Math.floor(mi / 12);
      const mm = ((mi % 12) + 12) % 12;
      const dd = Math.min(anchor, daysInMonth(yy, mm)); // 없는 날짜 → 말일로 당김
      const s = fmtLocal(new Date(yy, mm, dd));
      if (until && s > until) break;
      out.push(s);
    }
  } else {
    const step = rec.freq === 'weekly' ? interval * 7 : interval;
    const cur = new Date(start);
    if (rec.freq === 'weekly' && rec.weekday != null) {
      const wd = ((rec.weekday % 7) + 7) % 7;
      while (cur.getDay() !== wd) cur.setDate(cur.getDate() + 1); // 시작일 이후 첫 해당 요일로 정렬
    }
    for (let i = 0; i < count; i++) {
      const dt = new Date(cur); dt.setDate(cur.getDate() + i * step);
      const s = fmtLocal(dt);
      if (until && s > until) break;
      out.push(s);
    }
  }
  return out;
}

// 시작/마감(기간 작업) 길이를 보존하며 각 회차의 {date, endDate} 를 계산
export function recurrenceOccurrences(
  startStr: string, endStr: string | undefined, rec: Recurrence,
): { date: string; endDate?: string }[] {
  const dur = endStr && endStr > startStr ? dayDiff(startStr, endStr) : 0;
  return recurrenceDates(startStr, rec).map(date => ({ date, endDate: dur > 0 ? addDays(date, dur) : undefined }));
}

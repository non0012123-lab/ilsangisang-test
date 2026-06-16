// 데모(쇼케이스) 전용 데이터 — 클라이언트에게 포털을 시연할 때 사용.
// ⚠️ 이 데이터는 Supabase 에 절대 저장되지 않는다(내부 시스템 미유입).
//    ClientPortalPage 가 user.clientId === DEMO_CLIENT_ID 일 때만 메모리로 주입한다.
//    날짜는 '오늘' 기준 상대값으로 생성해, 시연 시점과 무관하게 항상 최근 데이터처럼 보인다.
import type { Client, ScheduleEntry, Report, Category } from '../types';
import { todayStr } from '../utils/today';

export const DEMO_CLIENT_ID = 'demo';

// 오늘로부터 n일 전 날짜(YYYY-MM-DD)
function daysAgo(n: number): string {
  const d = new Date(todayStr() + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DEMO_CLIENT: Client = {
  id: DEMO_CLIENT_ID,
  name: '데모 브랜드',
  industry: '뷰티 · 코스메틱',
  contactPerson: '김데모',
  email: 'demo-client@example.com',
  phone: '010-0000-0000',
  startDate: daysAgo(120),
  contractEnd: daysAgo(-240),
  categories: ['SNS', '유튜브', '네이버', '영상제작', '디자인제작'],
  status: 'active',
  description: '포털 시연용 가상 클라이언트입니다. 모든 수치는 예시입니다.',
  monthlyBudget: '500',
};

// 데모 업무 생성 헬퍼
let seq = 0;
function entry(
  dayOffset: number,
  category: Category,
  keyword: string,
  opts: { rank?: number; views?: number; link?: string; status?: ScheduleEntry['status']; metrics?: ScheduleEntry['metrics'] } = {},
): ScheduleEntry {
  seq += 1;
  return {
    id: `demo-entry-${seq}`,
    date: daysAgo(dayOffset),
    managerId: 'demo-manager',
    managerName: '담당자',
    category,
    keyword,
    link: opts.link,
    rank: opts.rank,
    metrics: opts.metrics ?? (opts.views != null ? { views: opts.views } : undefined),
    clientId: DEMO_CLIENT_ID,
    clientName: DEMO_CLIENT.name,
    status: opts.status ?? 'completed',
  };
}

// 채널·순위·PV 가 골고루 분포하도록 최근 30일에 걸쳐 생성
export const DEMO_ENTRIES: ScheduleEntry[] = [
  // 네이버 (블로그/플레이스 상위노출) — 순위 데이터 풍부
  entry(0, '네이버', '데모 브랜드 수분크림', { rank: 1, views: 4200, link: 'https://example.com/blog1' }),
  entry(1, '네이버', '여름 수분크림 추천', { rank: 2, views: 3100, link: 'https://example.com/blog2' }),
  entry(3, '네이버', '민감성 진정크림', { rank: 3, views: 2600, link: 'https://example.com/blog3' }),
  entry(6, '네이버', '데모 브랜드 세럼', { rank: 5, views: 1900, link: 'https://example.com/blog4' }),
  entry(9, '네이버', '비건 코스메틱', { rank: 4, views: 2200, link: 'https://example.com/blog5' }),
  entry(13, '네이버', '저자극 선크림', { rank: 7, views: 1500, link: 'https://example.com/blog6' }),
  entry(18, '네이버', '데모 브랜드 토너', { rank: 6, views: 1700, link: 'https://example.com/blog7' }),
  entry(24, '네이버', '여름 클렌징', { rank: 9, views: 1200, link: 'https://example.com/blog8' }),
  entry(2, '네이버', '신상 앰플 출시', { status: 'in-progress', link: 'https://example.com/blog9' }),

  // SNS (인스타/릴스)
  entry(0, 'SNS', '신상 앰플 인스타 릴스', { views: 18500, link: 'https://example.com/sns1', metrics: { views: 18500, likes: 1240, saves: 320, reach: 22000 } }),
  entry(4, 'SNS', '여름 메이크업 캐러셀', { views: 9400, link: 'https://example.com/sns2', metrics: { views: 9400, likes: 760, saves: 150 } }),
  entry(8, 'SNS', '뷰티 인플루언서 협업', { views: 26000, link: 'https://example.com/sns3', metrics: { views: 26000, likes: 2100, saves: 540 } }),
  entry(15, 'SNS', '브랜드 데이 이벤트', { views: 12300, link: 'https://example.com/sns4', metrics: { views: 12300, likes: 980, saves: 210 } }),
  entry(22, 'SNS', '사용 전후 비교 릴스', { views: 15800, link: 'https://example.com/sns5', metrics: { views: 15800, likes: 1320, saves: 410 } }),
  entry(1, 'SNS', '신상 티저', { status: 'in-progress' }),

  // 유튜브
  entry(2, '유튜브', '수분크림 리뷰 영상', { views: 32000, link: 'https://example.com/yt1', metrics: { views: 32000, likes: 1450, comments: 210, watchTime: '4분 12초' } }),
  entry(11, '유튜브', '겟레디윗미 협찬', { views: 58000, link: 'https://example.com/yt2', metrics: { views: 58000, likes: 3200, comments: 480 } }),
  entry(20, '유튜브', '브랜드 스토리 영상', { views: 21000, link: 'https://example.com/yt3', metrics: { views: 21000, likes: 890, comments: 120 } }),
  entry(5, '유튜브', '신상 언박싱', { status: 'pending' }),

  // 영상/디자인 제작
  entry(7, '영상제작', '6월 캠페인 메인 영상', { status: 'completed', link: 'https://example.com/video1' }),
  entry(3, '디자인제작', '여름 프로모션 상세페이지', { status: 'completed' }),
  entry(12, '디자인제작', '신상 앰플 패키지 키비주얼', { status: 'completed' }),
  entry(1, '영상제작', '7월 캠페인 콘티', { status: 'in-progress' }),

  // 네이버 콘텐츠(후기·신뢰도)
  entry(2, '네이버', '신상 앰플 실사용 후기', { rank: 8, views: 5400, link: 'https://example.com/c1' }),
  entry(10, '네이버', '브랜드 신뢰도 콘텐츠', { rank: 10, views: 3900, link: 'https://example.com/c2' }),
];

export const DEMO_REPORTS: Report[] = [
  {
    id: 'demo-report-1',
    clientId: DEMO_CLIENT_ID,
    clientName: DEMO_CLIENT.name,
    title: `데모 브랜드 ${daysAgo(30).slice(0, 7)} 월간 보고서`,
    date: daysAgo(2),
    period: `${daysAgo(32).slice(0, 7)} ~ ${daysAgo(2).slice(0, 7)}`,
    type: 'monthly',
    summary: '이번 달은 신상 앰플 출시에 맞춰 SNS·유튜브 인플루언서 협업을 집중했고, 네이버 상위노출 키워드 8건 중 5건이 5위 이내에 진입했습니다. 총 노출(PV)은 전월 대비 약 32% 증가했습니다.',
    highlights: [
      '네이버 핵심 키워드 5건 5위 이내 달성',
      '유튜브 협찬 영상 누적 조회 58,000회',
      'SNS 총 도달 8.3만, 저장수 전월比 +41%',
    ],
    periodStart: daysAgo(32),
    periodEnd: daysAgo(2),
    releaseDate: daysAgo(2),
    aiGenerated: true,
    createdAt: Date.now(),
  },
];

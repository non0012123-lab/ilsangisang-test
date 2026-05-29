import type { User, Client, ScheduleEntry, Report, HandoverDoc } from '../types';

export const USERS: User[] = [
  { id: 'u1', name: '김민준', email: 'admin@ilsangisang.com', role: 'admin', department: '전략팀', password: 'admin123' },
  { id: 'u2', name: '이수연', email: 'lee@ilsangisang.com', role: 'manager', department: 'SNS팀', password: 'pass123' },
  { id: 'u3', name: '박지훈', email: 'park@ilsangisang.com', role: 'manager', department: '네이버팀', password: 'pass123' },
  { id: 'u4', name: '최예진', email: 'choi@ilsangisang.com', role: 'manager', department: '디자인팀', password: 'pass123' },
  { id: 'u5', name: '정호성', email: 'jung@ilsangisang.com', role: 'manager', department: '영상팀', password: 'pass123' },
  { id: 'c1', name: '스타벅스 담당자', email: 'starbucks@client.com', role: 'client', clientId: 'cl1', password: 'client123' },
  { id: 'c2', name: '현대자동차 담당자', email: 'hyundai@client.com', role: 'client', clientId: 'cl2', password: 'client123' },
  { id: 'c3', name: '올리브영 담당자', email: 'oliveyoung@client.com', role: 'client', clientId: 'cl3', password: 'client123' },
];

export const CLIENTS: Client[] = [
  {
    id: 'cl1', name: '스타벅스 코리아', industry: '식음료',
    contactPerson: '박현수', email: 'starbucks@client.com', phone: '02-1234-5678',
    startDate: '2025-01-01', contractEnd: '2026-12-31',
    categories: ['SNS', '유튜브', '네이버', '네이버 여론작업'],
    status: 'active', description: '스타벅스 코리아 브랜드 마케팅 및 SNS 운영', monthlyBudget: '500만원',
  },
  {
    id: 'cl2', name: '현대자동차', industry: '자동차',
    contactPerson: '김지영', email: 'hyundai@client.com', phone: '02-2345-6789',
    startDate: '2025-03-01', contractEnd: '2026-02-28',
    categories: ['유튜브', '영상제작', '네이버', '네이버 여론작업'],
    status: 'active', description: '현대자동차 신차 출시 캠페인 및 유튜브 채널 관리', monthlyBudget: '800만원',
  },
  {
    id: 'cl3', name: '올리브영', industry: '뷰티/유통',
    contactPerson: '이민정', email: 'oliveyoung@client.com', phone: '02-3456-7890',
    startDate: '2025-02-01', contractEnd: '2026-01-31',
    categories: ['SNS', '디자인제작', '네이버', '네이버 여론작업'],
    status: 'active', description: '올리브영 SNS 채널 운영 및 신상품 프로모션', monthlyBudget: '400만원',
  },
  {
    id: 'cl4', name: '배달의민족', industry: 'IT/플랫폼',
    contactPerson: '최준혁', email: 'baemin@client.com', phone: '02-4567-8901',
    startDate: '2025-05-01', contractEnd: '2025-11-30',
    categories: ['SNS', '디자인제작', '영상제작'],
    status: 'active', description: '배민 시즌 캠페인 기획 및 콘텐츠 제작', monthlyBudget: '600만원',
  },
  {
    id: 'cl5', name: '아모레퍼시픽', industry: '뷰티/화장품',
    contactPerson: '강수진', email: 'amorepacific@client.com', phone: '02-5678-9012',
    startDate: '2024-06-01', contractEnd: '2025-05-31',
    categories: ['네이버', '디자인제작'],
    status: 'inactive', description: '아모레퍼시픽 브랜드사이트 SEO 및 블로그 관리', monthlyBudget: '300만원',
  },
];

const TODAY = '2026-05-29';
const YESTERDAY = '2026-05-28';
const TWO_DAYS_AGO = '2026-05-27';
const TOMORROW = '2026-05-30';
const NEXT_WEEK = '2026-06-05';

export const SCHEDULE_ENTRIES: ScheduleEntry[] = [
  // 기간 작업 (시작일~마감일) - 타임테이블에 여러 날 걸쳐 표시
  { id: 's_range1', date: '2026-05-25', endDate: '2026-05-31', managerId: 'u5', managerName: '정호성', category: '영상제작', keyword: '스타벅스 여름 브랜드 필름 제작', link: '', clientId: 'cl1', clientName: '스타벅스 코리아', status: 'in-progress', notes: '기획~촬영~편집 1주 일정' },
  { id: 's_range2', date: '2026-05-28', endDate: '2026-06-03', managerId: 'u4', managerName: '최예진', category: '디자인제작', keyword: '현대차 EV 캠페인 비주얼 시리즈', clientId: 'cl2', clientName: '현대자동차', status: 'pending', notes: '배너 5종 + 카드뉴스 3종' },
  // Today
  { id: 's1', date: TODAY, managerId: 'u2', managerName: '이수연', category: 'SNS', keyword: '스타벅스 신메뉴 여름음료', link: 'https://www.instagram.com/starbuckskorea/', rank: 2, clientId: 'cl1', clientName: '스타벅스 코리아', status: 'completed', metrics: { likes: 8420, comments: 312, saves: 1540, reach: 124000, impressions: 210000 } },
  { id: 's2', date: TODAY, managerId: 'u3', managerName: '박지훈', category: '네이버', keyword: '현대 아이오닉6 연비', link: 'https://search.naver.com/search.naver?query=현대+아이오닉6+연비', rank: 5, clientId: 'cl2', clientName: '현대자동차', status: 'in-progress', metrics: { blogViews: 23400, cafeViews: 8900 } },
  { id: 's3', date: TODAY, managerId: 'u2', managerName: '이수연', category: 'SNS', keyword: '올리브영 세일 추천', link: 'https://www.instagram.com/oliveyoung_official/', rank: 3, clientId: 'cl3', clientName: '올리브영', status: 'in-progress', metrics: { likes: 5200, saves: 890, impressions: 98000 } },
  { id: 's4', date: TODAY, managerId: 'u5', managerName: '정호성', category: '영상제작', keyword: '배민 여름 캠페인 영상', link: 'https://www.youtube.com/@baemin', clientId: 'cl4', clientName: '배달의민족', status: 'pending', notes: '스크립트 검토 중' },
  { id: 's5', date: TODAY, managerId: 'u4', managerName: '최예진', category: '디자인제작', keyword: '올리브영 6월 배너', link: 'https://www.oliveyoung.co.kr', clientId: 'cl3', clientName: '올리브영', status: 'pending' },
  { id: 's6', date: TODAY, managerId: 'u5', managerName: '정호성', category: '유튜브', keyword: '현대차 아이오닉6 리뷰', link: 'https://www.youtube.com/@HyundaiWorldwide', rank: 8, clientId: 'cl2', clientName: '현대자동차', status: 'completed', metrics: { views: 142000, likes: 4300, comments: 218, subscribers: 280 } },
  // 네이버 여론작업 entries
  { id: 's_op1', date: TODAY, managerId: 'u3', managerName: '박지훈', category: '네이버 여론작업', opinionTitle: '스타벅스 여름 신메뉴 출시 반응 모니터링', opinionContent: '여름 신메뉴 출시 관련 커뮤니티 및 카페 여론 분석. 전반적으로 긍정적 반응이 우세하며 특히 2030 여성층에서 높은 관심도를 보임.', opinionComments: '진짜 맛있어요~ / 이번 메뉴 역대급 / 가격이 좀 높긴 하지만 맛은 인정 / 인스타 올리려고 주문했어요', clientId: 'cl1', clientName: '스타벅스 코리아', status: 'completed', metrics: { views: 15600, comments: 89 } },
  { id: 's_op2', date: TODAY, managerId: 'u3', managerName: '박지훈', category: '네이버 여론작업', opinionTitle: '현대 아이오닉6 실구매자 후기 모음', opinionContent: '네이버 카페 및 블로그에서 실구매자 후기 수집 및 분석. 연비와 주행감에 대한 긍정 후기가 다수. 충전 인프라에 대한 우려도 일부 있음.', opinionComments: '연비 진짜 좋아요 / 디자인이 제일 예뻐요 / 충전하러 다니기 불편한 게 단점 / 강추합니다 진짜', clientId: 'cl2', clientName: '현대자동차', status: 'in-progress', metrics: { views: 8900, comments: 47 } },
  // Yesterday
  { id: 's7', date: YESTERDAY, managerId: 'u2', managerName: '이수연', category: 'SNS', keyword: '스타벅스 시즌음료 출시', link: 'https://www.instagram.com/starbuckskorea/', rank: 1, clientId: 'cl1', clientName: '스타벅스 코리아', status: 'completed', metrics: { likes: 12800, saves: 2100, reach: 186000, impressions: 340000 } },
  { id: 's8', date: YESTERDAY, managerId: 'u3', managerName: '박지훈', category: '네이버', keyword: '배달의민족 쿠폰 이벤트', link: 'https://blog.naver.com/baemin', rank: 4, clientId: 'cl4', clientName: '배달의민족', status: 'completed', metrics: { blogViews: 31200, cafeViews: 5600 } },
  { id: 's9', date: YESTERDAY, managerId: 'u4', managerName: '최예진', category: '디자인제작', keyword: '스타벅스 여름 포스터', link: 'https://www.starbucks.co.kr', clientId: 'cl1', clientName: '스타벅스 코리아', status: 'completed' },
  { id: 's10', date: YESTERDAY, managerId: 'u5', managerName: '정호성', category: '영상제작', keyword: '올리브영 언박싱 콘텐츠', link: 'https://www.youtube.com/@oliveyoung', rank: 6, clientId: 'cl3', clientName: '올리브영', status: 'completed', metrics: { views: 87400, likes: 2100, comments: 156 } },
  { id: 's_op3', date: YESTERDAY, managerId: 'u3', managerName: '박지훈', category: '네이버 여론작업', opinionTitle: '올리브영 여름 세일 기간 고객 반응 분석', opinionContent: '여름 세일 기간 동안 온라인 커뮤니티에서의 올리브영 언급량 급증. 특히 선케어 제품 관련 긍정 반응 높음.', opinionComments: '올영 세일 진짜 기다렸어 / 이번에 선크림 왕창 샀음 / 적립금 쌓으면 거의 공짜 / 앱 너무 느려요', clientId: 'cl3', clientName: '올리브영', status: 'completed', metrics: { views: 22100, comments: 134 } },
  // Two days ago
  { id: 's11', date: TWO_DAYS_AGO, managerId: 'u2', managerName: '이수연', category: 'SNS', keyword: '현대차 전기차 이벤트', link: 'https://www.instagram.com/hyundai_korea/', rank: 7, clientId: 'cl2', clientName: '현대자동차', status: 'completed', metrics: { likes: 6700, shares: 890, reach: 95000 } },
  { id: 's12', date: TWO_DAYS_AGO, managerId: 'u3', managerName: '박지훈', category: '네이버', keyword: '올리브영 신상 쿠션 후기', link: 'https://search.naver.com/search.naver?query=올리브영+쿠션', rank: 3, clientId: 'cl3', clientName: '올리브영', status: 'completed', metrics: { blogViews: 18700 } },
  { id: 's13', date: TWO_DAYS_AGO, managerId: 'u4', managerName: '최예진', category: '디자인제작', keyword: '배민 이벤트 카드뉴스', link: 'https://www.baemin.com', clientId: 'cl4', clientName: '배달의민족', status: 'completed' },
  // Upcoming
  { id: 's14', date: TOMORROW, managerId: 'u2', managerName: '이수연', category: 'SNS', keyword: '스타벅스 MD 신상품', link: 'https://www.instagram.com/starbuckskorea/', rank: 2, clientId: 'cl1', clientName: '스타벅스 코리아', status: 'pending' },
  { id: 's15', date: TOMORROW, managerId: 'u5', managerName: '정호성', category: '유튜브', keyword: '배민 치킨 맛집 탐방', link: 'https://www.youtube.com/@baemin', rank: 10, clientId: 'cl4', clientName: '배달의민족', status: 'pending' },
  { id: 's16', date: NEXT_WEEK, managerId: 'u3', managerName: '박지훈', category: '네이버', keyword: '스타벅스 프리퀀시 이벤트', link: 'https://www.starbucks.co.kr/event', rank: 1, clientId: 'cl1', clientName: '스타벅스 코리아', status: 'pending' },
  { id: 's17', date: NEXT_WEEK, managerId: 'u4', managerName: '최예진', category: '디자인제작', keyword: '현대차 EV 인포그래픽', link: 'https://www.hyundai.com/kr/ko/e/vehicles/ioniq6', clientId: 'cl2', clientName: '현대자동차', status: 'pending' },
  { id: 's_op4', date: NEXT_WEEK, managerId: 'u3', managerName: '박지훈', category: '네이버 여론작업', opinionTitle: '현대 EV 신모델 사전 여론 분석 예정', opinionContent: '신모델 출시 전 온라인 여론 사전 분석 및 모니터링 예정', opinionComments: '', clientId: 'cl2', clientName: '현대자동차', status: 'pending' },
];

export const REPORTS: Report[] = [
  {
    id: 'r1', clientId: 'cl1', title: '스타벅스 코리아 5월 성과 보고서', date: '2026-05-25',
    period: '2026년 5월', type: 'monthly',
    summary: 'SNS 팔로워 12% 증가, 인스타그램 도달률 전월 대비 23% 향상. 네이버 블로그 검색 순위 평균 3위 유지. 여론 모니터링 결과 긍정 반응 78%.',
    highlights: ['인스타그램 팔로워 +15,400명', '유튜브 조회수 총 234,000회', '네이버 키워드 TOP3 달성 12건', '여론작업 모니터링 42건 완료', '브랜드 긍정 언급률 78%'],
    fileSize: '2.4 MB',
  },
  {
    id: 'r2', clientId: 'cl1', title: '스타벅스 코리아 4월 성과 보고서', date: '2026-04-28',
    period: '2026년 4월', type: 'monthly',
    summary: '벚꽃 시즌 기획 콘텐츠 높은 바이럴 달성. SNS 게시물 평균 좋아요 8,200건 기록.',
    highlights: ['시즌 캠페인 도달률 2.1M', '해시태그 노출 5.6M', '저장수 전월 대비 +45%'],
    fileSize: '1.8 MB',
  },
  {
    id: 'r3', clientId: 'cl1', title: '스타벅스 코리아 4월 주간 보고서', date: '2026-04-07',
    period: '2026.04.01 ~ 04.07', type: 'weekly',
    summary: '신메뉴 론칭 첫 주 SNS 반응 분석. 인스타그램 릴스 조회수 512,000회 달성.',
    highlights: ['릴스 노출수 1.2M', '저장수 12,400건', '댓글 참여율 4.8%'],
    fileSize: '980 KB',
  },
  {
    id: 'r4', clientId: 'cl2', title: '현대자동차 5월 성과 보고서', date: '2026-05-26',
    period: '2026년 5월', type: 'monthly',
    summary: '아이오닉6 신차 출시 캠페인 성공적 진행. 유튜브 구독자 8,200명 증가. 온라인 여론 긍정 반응 81%.',
    highlights: ['유튜브 신규 구독자 +8,200명', '영상 총 조회수 1.4M', '네이버 검색 순위 1위 (아이오닉6)', '여론 모니터링 29건', '시승 신청 트래픽 +67%'],
    fileSize: '3.1 MB',
  },
  {
    id: 'r5', clientId: 'cl2', title: '현대자동차 4월 성과 보고서', date: '2026-04-29',
    period: '2026년 4월', type: 'monthly',
    summary: '전기차 라인업 콘텐츠 전략 강화. 유튜브 평균 시청 시간 4분 22초 기록.',
    highlights: ['유튜브 조회수 +890,000', '댓글 참여율 3.2%', '공유수 전월 대비 +28%'],
    fileSize: '2.7 MB',
  },
  {
    id: 'r6', clientId: 'cl3', title: '올리브영 5월 성과 보고서', date: '2026-05-27',
    period: '2026년 5월', type: 'monthly',
    summary: '여름 시즌 선케어 제품 집중 프로모션. 네이버 쇼핑 검색 노출 41% 증가. 여론 긍정 반응 84%.',
    highlights: ['인스타그램 쇼핑 태그 클릭수 34,200회', '네이버 블로그 방문자 +22%', '신상품 출시 저장수 9,800건', '여론작업 38건 완료', '브랜드 해시태그 누적 2.8M'],
    fileSize: '2.0 MB',
  },
  {
    id: 'r7', clientId: 'cl4', title: '배달의민족 5월 성과 보고서', date: '2026-05-28',
    period: '2026년 5월', type: 'monthly',
    summary: '여름 치킨 캠페인 기획 완료. 카드뉴스 콘텐츠 높은 공유율 기록.',
    highlights: ['SNS 총 도달수 4.2M', '카드뉴스 공유수 18,600건', '이벤트 페이지 방문자 +43%', '앱 연동 트래픽 +11%'],
    fileSize: '1.5 MB',
  },
];

export const HANDOVER_DOCS: HandoverDoc[] = [
  {
    id: 'hd1',
    clientId: 'cl1',
    clientName: '스타벅스 코리아',
    authorId: 'u2',
    authorName: '이수연',
    updatedAt: '2026-05-28',
    overview: '스타벅스 코리아 SNS 및 온라인 마케팅 전담. 주력 채널은 인스타그램(@starbuckskorea, 팔로워 약 200만)이며 매주 3-4건 피드, 매일 스토리 운영 중. 시즌 음료 출시마다 대규모 캠페인 진행.',
    keyContacts: [
      { id: 'kc1', name: '박현수', role: '마케팅 팀장', phone: '010-1234-5678', email: 'park@starbucks.co.kr', notes: '최종 컨펌 담당. 오전 중 연락하면 빠르게 응답. 카카오톡 선호.' },
      { id: 'kc2', name: '김소영', role: '콘텐츠 담당자', phone: '010-2345-6789', email: 'kim.sy@starbucks.co.kr', notes: '실무 담당자. 소재 요청 및 수정사항 여기로 연락. 매우 꼼꼼함.' },
    ],
    importantLinks: [
      { id: 'il1', title: '인스타그램 공식 채널', url: 'https://www.instagram.com/starbuckskorea/', category: 'SNS', notes: '주 3-4회 피드 게시 중' },
      { id: 'il2', title: '스타벅스 공식 홈페이지', url: 'https://www.starbucks.co.kr', category: '웹사이트', notes: '신메뉴·이벤트 정보 확인 필수' },
      { id: 'il3', title: '네이버 브랜드 블로그', url: 'https://blog.naver.com/starbuckskorea', category: '네이버', notes: '월 2회 이상 포스팅 유지' },
    ],
    guidelines: '1. 게시물 최소 2일 전 클라이언트 컨펌 필수\n2. 해시태그 최대 15개, 핵심 3-5개 포함\n3. 스타벅스 공식 브랜드 컬러(#00704A) 사용\n4. 매월 1일 전월 성과보고서 전달\n5. 신메뉴 출시 시 3일 전부터 예고 콘텐츠 제작\n6. 사진은 반드시 고해상도(최소 1080px) 사용',
    tone: '친근하고 따뜻한 톤. "~해요" "~입니다" 혼용 가능. 이모지는 적절히 사용(과도 지양). 20-35세 청년층 대상이나 전 연령 공감 가능한 내용. 영어 단어 과도 사용 금지.',
    dontDo: '- 경쟁사(이디야, 투썸 등) 직접 언급 절대 금지\n- "최저가", "할인" 등 가격 강조 금지\n- 확인되지 않은 출시 정보 게시 금지\n- 정치/사회적 민감 이슈 관련 콘텐츠 금지\n- 로고 변형 또는 배경색 임의 변경 금지',
    specialNotes: '- 시즌 음료 출시 2주 전부터 협의 시작\n- 연말·크리스마스 캠페인은 3개월 전 기획\n- 인스타 알고리즘상 화요일~목요일 오전 11시-오후 1시 게시 효율 높음\n- 팔로워 이벤트 진행 시 반드시 법무팀 검토 거친 약관 사용',
    managerMemo: '담당하면서 가장 중요한 건 속도입니다. 시즌 음료나 이벤트 정보가 나오면 경쟁사보다 빠르게 콘텐츠를 올리는 게 핵심이에요. 박현수 팀장님은 항상 바쁘시니 카카오톡으로 먼저 연락드리고, 정식 수정 요청은 이메일로 하는 게 좋아요. 김소영 담당자님은 오탈자, 해시태그 하나하나 체크하시니 게시 전 최종 확인 꼭 받으세요. 11-1월 크리스마스 시즌이 가장 바쁜 시기로 이때 리소스를 집중 배분해야 합니다.',
  },
  {
    id: 'hd2',
    clientId: 'cl2',
    clientName: '현대자동차',
    authorId: 'u5',
    authorName: '정호성',
    updatedAt: '2026-05-25',
    overview: '현대자동차 신차 출시 캠페인 및 유튜브 채널 관리 담당. 아이오닉 시리즈(전기차) 중심으로 콘텐츠 제작. 유튜브 구독자 100만+ 채널 운영.',
    keyContacts: [
      { id: 'kc3', name: '김지영', role: '디지털마케팅 팀장', phone: '010-3456-7890', email: 'kim.jy@hyundai.com', notes: '전체 방향성 결정. 월간 회의 주관. 신차 정보 가장 먼저 공유해줌.' },
      { id: 'kc4', name: '이현준', role: '영상콘텐츠 담당', phone: '010-4567-8901', email: 'lee.hj@hyundai.com', notes: '영상 소재 및 편집 방향 협의 담당. 빠른 피드백.' },
    ],
    importantLinks: [
      { id: 'il4', title: '유튜브 공식 채널', url: 'https://www.youtube.com/@HyundaiWorldwide', category: '유튜브', notes: '주 1-2회 영상 업로드 목표' },
      { id: 'il5', title: '아이오닉 6 공식 페이지', url: 'https://www.hyundai.com/kr/ko/e/vehicles/ioniq6', category: '웹사이트', notes: '신차 스펙 및 가격 확인' },
      { id: 'il6', title: '현대 인스타그램', url: 'https://www.instagram.com/hyundai_korea/', category: 'SNS', notes: '유튜브 영상 연계 쇼츠 배포' },
    ],
    guidelines: '1. 영상 업로드 최소 3일 전 클라이언트 시사회 진행\n2. 자동차 스펙/가격 수치는 반드시 확인 후 기재\n3. 경쟁사 차량 직접 비교 금지\n4. 시승 영상은 반드시 전문 드라이버 동반\n5. 배경음악은 저작권 클리어된 것만 사용',
    tone: '신뢰감 있고 전문적인 톤. 전기차 기술력과 혁신성 강조. 환경 친화적 이미지 부각. 영어 기술 용어는 한글 설명 병기. 지나치게 딱딱하지 않게 스토리텔링 방식 선호.',
    dontDo: '- 타 자동차 브랜드 직접 비교 금지\n- 확인되지 않은 기술 스펙 언급 금지\n- 정치적 이슈와 연결 금지\n- 사고/결함 관련 민감한 내용 절대 금지',
    specialNotes: '- 신차 출시 1개월 전부터 티저 콘텐츠 기획\n- 유튜브 쇼츠는 세로형 9:16 비율 필수\n- 자동차 특성상 날씨·조명이 영상 퀄리티에 직결됨. 야외 촬영은 맑은 날씨 확보 필수\n- 전기차 관련 충전 인프라 언급 시 민감할 수 있으니 긍정적 방향으로만 서술',
    managerMemo: '현대차 담당은 촬영 일정 조율이 가장 까다롭습니다. 차량 대여, 촬영 장소, 날씨를 모두 맞춰야 하므로 최소 2주 전부터 준비하세요. 김지영 팀장님은 데이터 기반 보고를 매우 중요시하시니 조회수, CTR, 시청 시간 등 구체적인 수치로 보고하는 습관을 들이세요. 아이오닉 시리즈가 핵심 라인업이므로 이 차종 관련 콘텐츠 우선순위 높게 잡으세요.',
  },
  {
    id: 'hd3',
    clientId: 'cl3',
    clientName: '올리브영',
    authorId: 'u2',
    authorName: '이수연',
    updatedAt: '2026-05-20',
    overview: '올리브영 SNS 운영 및 신상품 프로모션 담당. 인스타그램(@oliveyoung_official) 중심으로 뷰티 제품 리뷰 및 시즌 프로모션 콘텐츠 제작.',
    keyContacts: [
      { id: 'kc5', name: '이민정', role: '소셜미디어 담당자', phone: '010-5678-9012', email: 'lee.mj@oliveyoung.com', notes: '모든 SNS 관련 커뮤니케이션 담당. 빠른 응답. 카카오톡 선호.' },
    ],
    importantLinks: [
      { id: 'il7', title: '올리브영 인스타그램', url: 'https://www.instagram.com/oliveyoung_official/', category: 'SNS', notes: '주 4-5회 피드 게시' },
      { id: 'il8', title: '올리브영 공식 앱', url: 'https://www.oliveyoung.co.kr', category: '웹사이트', notes: '신상품·프로모션 정보 확인' },
    ],
    guidelines: '1. 제품 리뷰 시 반드시 실제 사용 사진 포함\n2. 가격 표기 시 할인가 기준 (정가 병기)\n3. #올리브영 #oliveyoung 해시태그 필수\n4. 신상품 출시일 맞춰 게시 (출시 당일 오전 10시)',
    tone: '트렌디하고 활기찬 톤. 뷰티에 관심 많은 20대 여성 타겟. 제품 성분, 효능 강조. 친구에게 알려주는 듯한 자연스러운 문체.',
    dontDo: '- 경쟁사(CJ 올리브마트, 랄라블라) 비교 금지\n- 의학적 효능 과장 광고 금지\n- 미성년자 대상 화장품 콘텐츠 지양\n- 인플루언서 협찬 시 #광고 표기 필수',
    specialNotes: '- 연 2회 메가세일(봄/여름, 가을/겨울)이 가장 중요한 시기\n- 올영어워즈 시즌에 콘텐츠 집중\n- MZ세대 트렌드에 민감한 클라이언트이므로 유행어, 밈 활용 적극 권장\n- 뷰티 인플루언서 협업 콘텐츠 반응 매우 좋음',
    managerMemo: '올리브영 담당에서 가장 중요한 건 트렌드 캐치입니다. SNS에서 뜨는 제품/성분/트렌드를 누구보다 빠르게 캐치해서 콘텐츠화하는 게 핵심이에요. 이민정 담당자님은 밤에도 카톡 주시는 분이라 소통 속도는 빠른데, 그만큼 빠른 응답이 기대됩니다. 메가세일 시즌에는 리소스를 2-3배 잡아야 할 정도로 업무량이 급증하니 미리 준비하세요.',
  },
];


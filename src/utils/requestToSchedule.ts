import type { WorkRequest, ScheduleEntry, Client, TeamMember, Category } from '../types';
import { normalizeNaverCategory } from '../data/categories';

// 요청함(WorkRequest) 문구 → 일정(ScheduleEntry) 초기값 추론.
//  • 요청은 자유 텍스트(예: "초이스 피부과 이미지 제작")라 업체·카테고리를 제목에서 추론하고,
//    담당자는 요청 담당자(toUid)를 그대로 쓴다. 날짜는 의도적으로 비워(=모달 기본 '오늘') 사용자가 고른다.
//  • 추론은 "미리 채우기"일 뿐, 사용자가 모달에서 검토·수정 후 저장한다.

// 비-네이버 업무 종류(키워드 → 카테고리). 네이버 계열(블로그/카페/상위노출/배포/관리/클립/여론)은
// normalizeNaverCategory 가 줄임말·신호어 정리까지 담당하므로 여기선 다루지 않는다.
const OTHER_CATEGORY_RULES: { re: RegExp; category: Category }[] = [
  { re: /이미지|시안|디자인|배너|상세\s*페이지|상세페이지|썸네일|썸네|포스터|카드뉴스|로고/, category: '디자인제작' },
  { re: /영상|편집|촬영|릴스|숏폼|쇼츠|모션|모먼트/, category: '영상제작' },
  { re: /유튜브|youtube/i, category: '유튜브' },
  { re: /sns|인스타그램|인스타|페이스북|페북|틱톡|쓰레드|스레드/i, category: 'SNS' },
];

export function inferScheduleFromRequest(req: WorkRequest, clients: Client[], members: TeamMember[]): Partial<ScheduleEntry> {
  const text = `${req.title ?? ''} ${req.body ?? ''}`;

  // 담당자: toUid(=members id) 우선, 없으면 이름 매칭
  const mgr = members.find(m => m.id === req.toUid) ?? members.find(m => m.name === req.toName);

  // 업체: 제목/본문에 등록 업체명이 포함되면 그 업체(가장 긴 이름 우선 = 가장 구체적)
  const client = clients
    .filter(c => c.name && text.includes(c.name))
    .sort((a, b) => b.name.length - a.name.length)[0];

  // 제목에서 업체명을 떼어내 키워드/카테고리 추론 기준 문구로 사용
  const titleNoClient = (client ? (req.title ?? '').split(client.name).join(' ') : (req.title ?? '')).replace(/\s+/g, ' ').trim();

  // 1) 네이버 계열(줄임말·키워드 신호어 정리 포함) → 2) 비-네이버 업무 종류 → 3) 기타
  const nav = normalizeNaverCategory('', titleNoClient);
  let category: Category = '기타';
  // 기본 키워드 = 업체명 뺀 제목(예: "이미지 제작", "영상 편집"). 네이버 계열만 신호어를 정리한 키워드로 대체.
  let keyword: string | undefined = titleNoClient || req.title || undefined;
  if (nav.category) {
    category = nav.category as Category;
    keyword = nav.keyword;  // 신호어("상노"/"카상노" 등) 제거된 순수 키워드(없으면 undefined)
  } else {
    const rule = OTHER_CATEGORY_RULES.find(r => r.re.test(text));
    if (rule) category = rule.category;  // 디자인/영상 등은 "이미지 제작" 같은 설명을 키워드로 보존
  }

  // 값이 있는 키만 채워 모달 기본값(첫 업체·담당자·오늘 날짜)을 덮어쓰지 않게 한다.
  const prefill: Partial<ScheduleEntry> = { category, status: 'pending' };
  if (mgr) { prefill.managerId = mgr.id; prefill.managerName = mgr.name; }
  if (client) { prefill.clientId = client.id; prefill.clientName = client.name; }
  if (keyword) prefill.keyword = keyword;
  if (req.body) prefill.notes = req.body;
  return prefill;
}

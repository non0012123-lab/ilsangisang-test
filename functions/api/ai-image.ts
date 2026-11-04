// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-image
//  • AI 기획 결과 화면의 "이미지 시안 생성" 이 호출한다.
//  • OpenAI Images API (gpt-image-2) 로 가이드라인 기반 광고 시안을 만든다.
//  • 토큰 절약: 플랫폼마다 낱장 여러 개가 아니라, 2×2(4안)/3×3(9안)
//    "그리드 시안" 한 장을 생성한다. (요청한 플랫폼만 병렬 생성)
//  • platforms 에 'thumbnail-bg' 를 주면 글자 없는 정사각 배경 1장을 만든다(썸네일용, 글자는 호출 쪽이 얹음).
//  • cols=1 이면 그리드 대신 "단일 시안" 한 장(캔버스 전체가 시안 하나)을 만든다.
//    한글 카피가 그리드보다 크고 또렷하게 나온다. 비용·시간은 장당 동일.
//  • 프롬프트는 「플랫폼별 고효율 클릭 유도 이미지 연구 보고서」의
//    공통 원칙 + 플랫폼별 권장안을 반영한다.
//
// 환경변수:
//  • OPENAI_API_KEY      (필수, Secret)
//  • OPENAI_IMAGE_MODEL  (선택, 기본 gpt-image-2)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_IMAGE_MODEL?: string;
}

interface ImageRequest {
  clientName?: string;
  guideline?: string;   // 업로드한 가이드라인 텍스트
  platforms?: string[]; // 생성할 플랫폼 키 목록
  cols?: number;        // 1 = 단일 시안(그리드 없음), 2 = 2×2, 3 = 3×3 (기본 2)
  labels?: boolean;     // false 면 칸 번호 라벨을 넣지 않음 (기본 true = 기존 동작)
}

// OpenAI Images API 의 size 는 정해진 값만 허용 → 플랫폼 방향에 맞춰 매핑
type ImgSize = '1024x1024' | '1024x1536' | '1536x1024';

interface Platform {
  key: string;
  label: string;
  ratio: string;   // 셀(각 시안)의 권장 비율
  size: ImgSize;   // 그리드 전체 캔버스 크기(셀 방향과 맞춤)
  guidance: string; // 연구 보고서 기반 플랫폼별 디자인 지침
}

const PLATFORMS: Record<string, Platform> = {
  // 네이버 블로그 홍보카드 — 정사각(1:1). 디자인 지침은 SNS 세로형과 같고 비율만 다르다 (AIagent 2026-11-04 요청: 블로그/SNS 분리)
  'blog': {
    key: 'blog', label: '네이버 블로그 홍보카드', ratio: '정사각(1:1)', size: '1024x1024',
    guidance: [
      '네이버 블로그 본문에 들어가는 정사각 홍보카드 시안.',
      '풀블리드 비주얼 + 크고 굵은 한국어 후킹 헤드라인 + 핵심 혜택/이유 카피를 결합한다. 정사각이므로 헤드라인은 위쪽 또는 가운데, 비주얼은 한가운데 안전영역에.',
      '스크롤에서 시선을 멈추게 하도록 강한 색 대비와 임팩트 있는 구도로. 브랜드 톤·색감을 일관되게.',
    ].join(' '),
  },
  // 네이버 블로그 & SNS 피드 — 스토리/릴스 스타일의 강렬한 세로형 결과값으로 통합
  'blog-sns': {
    key: 'blog-sns', label: 'SNS 피드 (세로형)', ratio: '세로형', size: '1024x1536',
    guidance: [
      '인스타/페북 SNS 피드·스토리에 쓰는 세로형 광고 시안.',
      '스토리/릴스처럼 강렬한 풀세로(풀블리드) 비주얼 + 크고 굵은 한국어 후킹 헤드라인 + 핵심 혜택/이유 카피를 결합한다.',
      '스크롤·검색에서 시선을 멈추게 하도록 강한 색 대비와 임팩트 있는 구도로. 핵심 카피와 요소는 중앙 안전영역 안에 모으고 브랜드 톤·색감을 일관되게.',
    ].join(' '),
  },
  'youtube': {
    key: 'youtube', label: '유튜브 썸네일', ratio: '16:9 가로', size: '1536x1024',
    guidance: [
      '유튜브 썸네일 16:9 — 시청자의 "궁금증"을 자극해 클릭하게 만드는 후킹이 핵심.',
      '정보를 다 드러내지 않고 "어? 왜지? 뭐지?" 하게 만드는 호기심형 카피(질문형·반전형·의외의 사실·결과 암시)를 2~6단어로 아주 크고 굵게.',
      '중요: "정밀 검사·전문의 진료·1:1 맞춤진료·예약·상담·할인" 같은 직접적인 홍보/서비스 나열 문구는 절대 넣지 말 것. 병원 광고처럼 보이면 안 된다.',
      '고대비 색상으로 작은 화면에서도 확 들어오게, 표정이 살아있는 큰 얼굴 또는 강한 상황/결과 비주얼과 결합. 밋밋한 스톡 사진 금지.',
    ].join(' '),
  },
  // 블로그 썸네일 배경 — 글자 없는 정사각 배경. 호출 쪽(AIagent)이 키워드·업체명·로고를 정확한 글자로 얹는다.
  'thumbnail-bg': {
    key: 'thumbnail-bg', label: '블로그 썸네일 배경(글자 없음)', ratio: '정사각(1:1)', size: '1024x1024',
    guidance: [
      '네이버 블로그 대표 썸네일의 배경으로 쓸 정사각 이미지. 글자는 나중에 따로 얹으므로 이미지 안에는 어떤 텍스트도 넣지 않는다.',
      '밝은 톤: 흰색·연회색·파스텔 배경에 자연광, 실제 사진처럼(스튜디오 촬영이나 현장 사진 느낌). 어두운 배경, 네온, 과한 렌더링·광택 느낌은 금지.',
      '업종을 상징하는 피사체(사람·제품·공간) 하나를 위쪽~가운데에 크게 두고, 아래쪽 35% 는 단순한 여백이나 흐린 배경(글자가 올라갈 자리).',
      '밋밋한 스톡 사진 금지. 사람이 나오면 자연스러운 표정과 포즈, 한국인.',
    ].join(' '),
  },
  // 네이버 GFA / 디스플레이 / 웹·앱 배너 — 배너 스타일의 가로형 결과값으로 통합
  'gfa-banner': {
    key: 'gfa-banner', label: '네이버 GFA / 디스플레이 / 배너', ratio: '가로형', size: '1536x1024',
    guidance: [
      '네이버 GFA·디스플레이·웹/앱 배너에 함께 쓰는 가로형 광고 시안.',
      '굵은 후킹 헤드라인 1줄 + 짧은 혜택/행동 유도 카피 + 제품·서비스(또는 핵심 상황) 히어로 비주얼을 가로 레이아웃에 명료하게 배치.',
      '한눈에 메시지가 전달되도록 군더더기 없이 깔끔한 고대비로. 브랜드 톤을 유지하고, 가짜 시스템 알림·가짜 입력창처럼 사용자를 속이는 요소는 금지.',
    ].join(' '),
  },
};

const COMMON_ITEMS = [
  '가장 중요한 원칙: 각 칸은 단순한 사진이 아니라, 한눈에 시선을 사로잡는 "완성형 광고 시안"이어야 한다.',
  '① 강하고 굵은 한국어 후킹 헤드라인을 크고 또렷하게 넣을 것(궁금증·혜택·결과·공감을 자극). 필요하면 짧은 보조 카피 1줄 추가.',
  '② 단일 핵심 피사체 + 강한 색 대비로 주목도를 극대화하고, 배경은 카피가 잘 읽히도록 정리.',
  '③ 실제 성과형 퍼포먼스 광고처럼 전문적이고 브랜드 톤에 맞게. 밋밋한 스톡 사진이나 "그냥 아픈 부위를 잡고 있는" 단순 질환 사진은 금지.',
  '④ 칸마다 헤드라인 카피·구도·배경·강조 포인트가 서로 분명히 다른 변형으로 구성.',
  '⑤ 이미지 속 한국어 텍스트는 정확한 맞춤법으로, 깨지지 않고 또렷하게 렌더링할 것.',
  '의료/병원 광고라면 의료법상 과장·허위·치료 보장성 표현은 피하되, 공감·혜택·신뢰 기반의 강한 후킹 카피는 적극적으로 사용할 것.',
];
const COMMON = COMMON_ITEMS.join(' ');
// 단일 시안용: "칸" 표현을 "시안"으로 바꾸고, 칸끼리 달라야 한다는 ④ 항목은 제외
const COMMON_SINGLE = COMMON_ITEMS.filter(t => !t.startsWith('④')).map(t => t.replace(/각 칸은/g, '이 시안은')).join(' ');

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** cols=1: 그리드 없이 캔버스 전체를 하나의 완성형 시안으로 */
function buildSinglePrompt(p: Platform, clientName: string, guideline: string): string {
  return [
    '너는 한국 최고 수준의 퍼포먼스 광고 크리에이티브 디렉터다. 아래 조건으로 완성형 광고 시안을 1장 만들어줘.',
    `대상 업체: "${clientName}".`,
    '출력은 그리드·콘택트 시트가 아니라 단일 광고 시안 한 장이다. 캔버스 전체를 하나의 시안으로 채우고, 칸 나누기·번호·라벨·워터마크·테두리 글자는 일절 넣지 않는다.',
    '그 자체로 바로 집행 가능한 완성된 광고여야 한다 — 강한 후킹 헤드라인 카피 + 임팩트 있는 비주얼이 함께 들어가야 하며, 카피 없는 맨 사진은 안 된다.',
    `${p.ratio} 비율의 ${p.label} 시안으로 구성한다. 헤드라인은 캔버스 폭에 맞춰 크고 굵게, 한 글자도 잘리거나 뭉개지지 않게.`,
    '구성 규칙(매우 중요): 그리드 시안의 한 칸을 그대로 확대한 것처럼 단순하게. 메시지는 딱 하나 — 헤드라인 1개 + 보조 카피 최대 1줄 + 핵심 비주얼 1개. 섹션 나누기·목록·체크리스트·아이콘 나열·다단 구성·하단 정보띠·연락처 블록·여러 정보 박스는 금지. 전단지나 인포그래픽이 아니라 한 컷짜리 광고다. 이미지 속 글자는 전부 합쳐 20자 안팎으로.',
    '가이드라인에 [이 장의 초점] 이 있으면 그 한 가지만 표현하고, 가이드라인의 다른 사실·포인트는 이 장에 넣지 않는다(다른 장에서 다룬다).',
    '',
    `[플랫폼: ${p.label}] ${p.guidance}`,
    '',
    COMMON_SINGLE,
    '',
    '── 업체 가이드라인(업종·톤앤매너·금지표현·타깃을 반영해 카피와 비주얼에 녹일 것) ──',
    (guideline || '(가이드라인 텍스트 없음)').slice(0, 4000),
  ].join('\n');
}

/** thumbnail-bg: 글자 없는 정사각 배경 한 장 (cols 무시) */
function buildBackgroundPrompt(p: Platform, clientName: string, guideline: string): string {
  return [
    '너는 한국 최고 수준의 퍼포먼스 광고 아트 디렉터다. 아래 조건으로 "글자가 전혀 없는" 배경 이미지 1장을 만들어줘.',
    `대상 업체: "${clientName}".`,
    '절대 규칙: 이미지 안에 글자·숫자·로고·워터마크·말풍선·간판 글씨·라벨·테두리 글자를 단 하나도 넣지 않는다. 텍스트가 있으면 실패다.',
    `[플랫폼: ${p.label}] ${p.guidance}`,
    '',
    '── 업체 가이드라인(업종·톤앤매너·타깃을 비주얼에만 반영할 것. 문구는 쓰지 말 것) ──',
    (guideline || '(가이드라인 텍스트 없음)').slice(0, 4000),
  ].join(String.fromCharCode(10));
}

function buildPrompt(p: Platform, cols: number, clientName: string, guideline: string, labels = true): string {
  if (p.key === 'thumbnail-bg') return buildBackgroundPrompt(p, clientName, guideline);
  if (cols === 1) return buildSinglePrompt(p, clientName, guideline);
  const n = cols * cols;
  return [
    '너는 한국 최고 수준의 퍼포먼스 광고 크리에이티브 디렉터다. 아래 조건으로 광고 "시안 시트(콘택트 시트)"를 1장 만들어줘.',
    `대상 업체: "${clientName}".`,
    `출력은 ${cols}×${cols} 그리드 한 장으로, 서로 다른 ${n}개의 완성형 광고 시안을 배치한다.`,
    `각 칸(셀)은 그 자체로 바로 집행 가능한 완성된 광고여야 한다 — 즉 강한 후킹 헤드라인 카피 + 임팩트 있는 비주얼이 함께 들어가야 하며, 카피 없는 맨 사진은 안 된다.`,
    `각 칸은 ${p.ratio} 비율 느낌으로 구성하고, 칸 사이에는 얇은 흰색 여백(거터)을 둔다.`,
    labels
      ? `각 칸 좌상단에 1부터 ${n}까지의 작은 번호 라벨만 식별용으로 넣고(번호 외 워터마크는 금지), 헤드라인 카피는 번호와 별개로 크게 넣는다.`
      : '칸에 번호·라벨·워터마크·테두리 글자를 일절 넣지 않는다. 각 칸은 그대로 잘라 써도 되는 완성본이어야 한다.',
    `${n}개 시안은 헤드라인 문구·구도·배경·강조 포인트가 실제로 서로 다른 변형이어야 한다.`,
    '',
    `[플랫폼: ${p.label}] ${p.guidance}`,
    '',
    COMMON,
    '',
    '── 업체 가이드라인(업종·톤앤매너·금지표현·타깃을 반영해 카피와 비주얼에 녹일 것) ──',
    (guideline || '(가이드라인 텍스트 없음)').slice(0, 4000),
  ].join('\n');
}

interface OpenAIImageItem { b64_json?: string }

async function generate(env: Env, p: Platform, cols: number, clientName: string, guideline: string, labels = true): Promise<AiImage[]> {
  const res = await openaiFetch(env, '/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt: buildPrompt(p, cols, clientName, guideline, labels),
      n: 1, // 그리드 1장 = 여러 시안. 토큰/비용 절약.
      size: p.size,
      quality: 'auto',
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${p.label} 이미지 생성 실패 (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = await res.json() as { data?: OpenAIImageItem[] };
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map(d => d?.b64_json)
    .filter((b): b is string => typeof b === 'string')
    .map((b64, i) => ({
      id: `${p.key}-${Date.now()}-${i}`,
      platform: p.key,
      channel: p.label,
      cols,
      url: `data:image/png;base64,${b64}`,
    }));
}

interface AiImage { id: string; platform: string; channel: string; cols: number; url: string }

import { openaiFetch } from './_openai';

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: ImageRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }

  const clientName = req.clientName || '해당 업체';
  const guideline = req.guideline || '';
  const cols = req.cols === 3 ? 3 : req.cols === 1 ? 1 : 2; // 1(단일 시안) / 2×2(기본) / 3×3
  const labels = req.labels !== false;  // 기본 true (기존 동작). false 면 번호 라벨 없이 생성
  const keys = (Array.isArray(req.platforms) ? req.platforms : [])
    .filter(k => k in PLATFORMS);
  const targets = (keys.length > 0 ? keys : ['blog-sns']).map(k => PLATFORMS[k]);

  try {
    const results = await Promise.all(targets.map(p => generate(env, p, cols, clientName, guideline, labels)));
    const images = results.flat();
    if (images.length === 0) return json({ error: '생성된 이미지가 없습니다.' }, 502);
    return json({ images });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.' }, 502);
  }
};

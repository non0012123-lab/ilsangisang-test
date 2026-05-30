// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-image
//  • AI 기획 결과 화면의 "이미지 시안 생성" 이 호출한다.
//  • OpenAI Images API (gpt-image-2) 로 가이드라인 기반 광고 시안을 만든다.
//  • 토큰 절약: 플랫폼마다 낱장 여러 개가 아니라, 2×2(4안)/3×3(9안)
//    "그리드 시안" 한 장을 생성한다. (요청한 플랫폼만 병렬 생성)
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
  cols?: number;        // 그리드 열 수 (2 또는 3)
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
  'naver-blog': {
    key: 'naver-blog', label: '네이버 블로그', ratio: '1:1 정방형', size: '1024x1024',
    guidance: [
      '네이버 블로그 "홍보카드". 클릭을 부르는 정방형 홍보카드 디자인으로,',
      '굵고 큰 한국어 후킹 헤드라인 + 핵심 혜택/이유 카피를 잘 보이게 넣고, 시선을 끄는 메인 비주얼(인물/상황/제품)을 크게 배치.',
      '카피와 핵심은 정방형 중앙 안전영역 안에 모으고, 브랜드 톤·색감을 일관되게.',
    ].join(' '),
  },
  'sns-feed': {
    key: 'sns-feed', label: 'SNS 피드(인스타/페북)', ratio: '4:5 세로', size: '1024x1536',
    guidance: [
      '인스타그램/페이스북 피드 광고. 스크롤을 멈추게 하는 강한 후킹 헤드라인을 크고 굵게 넣은 4:5 세로 광고 시안.',
      '핵심 카피와 비주얼은 중앙 80% 안쪽에 모으고, 한눈에 메시지가 꽂히도록 강한 대비와 임팩트 있는 구도로.',
    ].join(' '),
  },
  'sns-story': {
    key: 'sns-story', label: '스토리/릴스', ratio: '9:16 세로', size: '1024x1536',
    guidance: [
      '인스타/페북 스토리·릴스용 9:16 풀세로 광고. 큰 후킹 카피를 화면 중앙에 강렬하게 배치.',
      '단, 상단 약 14%·하단 약 20% 영역은 플랫폼 UI가 가리므로 핵심 카피/요소는 그 바깥 안전영역에 둘 것. 풀블리드 비주얼 + 굵은 헤드라인.',
    ].join(' '),
  },
  'youtube': {
    key: 'youtube', label: '유튜브 썸네일', ratio: '16:9 가로', size: '1536x1024',
    guidance: [
      '유튜브 썸네일 16:9 — 후킹이 가장 중요하다. 아주 크고 굵은 한국어 후킹 문구(궁금증·충격·결과·혜택 자극)를 2~6단어로 강렬하게 넣고,',
      '고대비 색상으로 작은 화면에서도 한눈에 확 들어오게. 표정이 살아있는 큰 얼굴 또는 강한 상황/결과 비주얼과 결합해 클릭 욕구를 극대화.',
      '밋밋한 스톡 사진이 아니라 "썸네일 장인"이 만든 듯한 임팩트 있는 디자인으로.',
    ].join(' '),
  },
  'gfa': {
    key: 'gfa', label: '네이버 GFA / 디스플레이', ratio: '1:1 정방형', size: '1024x1024',
    guidance: [
      '네이버 GFA / 디스플레이 광고. 제품·서비스(또는 핵심 상황) 히어로 비주얼을 크게 두고,',
      '간결하고 강한 혜택형 후킹 헤드라인 1줄을 또렷하게 결합. 깔끔한 고대비 레이아웃, 브랜드 톤 유지.',
    ].join(' '),
  },
  'banner': {
    key: 'banner', label: '웹/앱 배너', ratio: '가로형(약 1.9:1)', size: '1536x1024',
    guidance: [
      '웹·앱 디스플레이 배너(가로형). 굵은 후킹 헤드라인 1줄 + 짧은 혜택/행동 유도 카피 + 핵심 비주얼을 가로 레이아웃에 명료하게 배치.',
      '한눈에 메시지가 전달되도록 군더더기 없이. 가짜 시스템 알림·가짜 입력창처럼 사용자를 속이는 요소는 금지.',
    ].join(' '),
  },
};

const COMMON = [
  '가장 중요한 원칙: 각 칸은 단순한 사진이 아니라, 한눈에 시선을 사로잡는 "완성형 광고 시안"이어야 한다.',
  '① 강하고 굵은 한국어 후킹 헤드라인을 크고 또렷하게 넣을 것(궁금증·혜택·결과·공감을 자극). 필요하면 짧은 보조 카피 1줄 추가.',
  '② 단일 핵심 피사체 + 강한 색 대비로 주목도를 극대화하고, 배경은 카피가 잘 읽히도록 정리.',
  '③ 실제 성과형 퍼포먼스 광고처럼 전문적이고 브랜드 톤에 맞게. 밋밋한 스톡 사진이나 "그냥 아픈 부위를 잡고 있는" 단순 질환 사진은 금지.',
  '④ 칸마다 헤드라인 카피·구도·배경·강조 포인트가 서로 분명히 다른 변형으로 구성.',
  '⑤ 이미지 속 한국어 텍스트는 정확한 맞춤법으로, 깨지지 않고 또렷하게 렌더링할 것.',
  '의료/병원 광고라면 의료법상 과장·허위·치료 보장성 표현은 피하되, 공감·혜택·신뢰 기반의 강한 후킹 카피는 적극적으로 사용할 것.',
].join(' ');

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function buildPrompt(p: Platform, cols: number, clientName: string, guideline: string): string {
  const n = cols * cols;
  return [
    '너는 한국 최고 수준의 퍼포먼스 광고 크리에이티브 디렉터다. 아래 조건으로 광고 "시안 시트(콘택트 시트)"를 1장 만들어줘.',
    `대상 업체: "${clientName}".`,
    `출력은 ${cols}×${cols} 그리드 한 장으로, 서로 다른 ${n}개의 완성형 광고 시안을 배치한다.`,
    `각 칸(셀)은 그 자체로 바로 집행 가능한 완성된 광고여야 한다 — 즉 강한 후킹 헤드라인 카피 + 임팩트 있는 비주얼이 함께 들어가야 하며, 카피 없는 맨 사진은 안 된다.`,
    `각 칸은 ${p.ratio} 비율 느낌으로 구성하고, 칸 사이에는 얇은 흰색 여백(거터)을 둔다.`,
    `각 칸 좌상단에 1부터 ${n}까지의 작은 번호 라벨만 식별용으로 넣고(번호 외 워터마크는 금지), 헤드라인 카피는 번호와 별개로 크게 넣는다.`,
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

async function generate(env: Env, p: Platform, cols: number, clientName: string, guideline: string): Promise<AiImage[]> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt: buildPrompt(p, cols, clientName, guideline),
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
  const cols = req.cols === 3 ? 3 : 2; // 2×2(기본) 또는 3×3
  const keys = (Array.isArray(req.platforms) ? req.platforms : [])
    .filter(k => k in PLATFORMS);
  const targets = (keys.length > 0 ? keys : ['naver-blog', 'sns-feed']).map(k => PLATFORMS[k]);

  try {
    const results = await Promise.all(targets.map(p => generate(env, p, cols, clientName, guideline)));
    const images = results.flat();
    if (images.length === 0) return json({ error: '생성된 이미지가 없습니다.' }, 502);
    return json({ images });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.' }, 502);
  }
};

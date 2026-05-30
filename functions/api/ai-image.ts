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
      '네이버 블로그 대표 이미지(홍보카드). 광고 배너처럼 보이면 검색 대표 이미지로 채택되지 않으므로,',
      '잡지 기사 커버처럼 자연스럽고 고유한 에디토리얼 컷으로. 주인공(사람 얼굴/제품/장소) 하나를 크게,',
      '배경 정보량은 최소화. 텍스트는 가능하면 없애고, 넣더라도 한 줄의 짧은 가치/혜택 문구만(예: "실사용 후기", "비교 정리").',
      '정방형 중앙 안전영역 안에 핵심을 배치. "지금 구매" 같은 직접 광고형 버튼·문구는 넣지 말 것.',
    ].join(' '),
  },
  'sns-feed': {
    key: 'sns-feed', label: 'SNS 피드(인스타/페북)', ratio: '4:5 세로', size: '1024x1536',
    guidance: [
      '인스타그램/페이스북 피드 단일 이미지 광고. 모바일 세로 점유율이 높은 4:5 구도.',
      '핵심 요소는 중앙 80% 안쪽에 모으고, 텍스트는 이미지 면적의 10~15% 이내로 짧고 중앙 정렬된 정보성 문구만.',
      'CTA 버튼은 이미지에 그리지 말고(플랫폼 UI가 담당), 이미지는 강한 단일 비주얼과 가치 제안에 집중.',
    ].join(' '),
  },
  'sns-story': {
    key: 'sns-story', label: '스토리/릴스', ratio: '9:16 세로', size: '1024x1536',
    guidance: [
      '인스타/페북 스토리·릴스용 9:16 풀세로. 상단 약 14%, 하단 약 20~35% 영역은 플랫폼 UI가 덮으므로',
      '텍스트·로고·핵심 요소를 넣지 말고 비워둘 것. 텍스트는 0~10%로 극소량, 큰 글자·높은 대비.',
      '시선을 끄는 단일 비주얼과 시각적 방향성 위주로.',
    ].join(' '),
  },
  'youtube': {
    key: 'youtube', label: '유튜브 썸네일', ratio: '16:9 가로', size: '1536x1024',
    guidance: [
      '유튜브 커스텀 썸네일 16:9. 작은 화면에서도 한눈에 읽히는 축소 가독성이 최우선.',
      '표정이 분명히 읽히는 큰 얼굴 또는 결과물/증거 오브젝트를 크게. 강한 감정·결과·호기심 신호.',
      '텍스트는 정말 필요할 때만 한글 4~12자(1~3단어). 자극적·허위 과장(미끼성)은 금지.',
    ].join(' '),
  },
  'gfa': {
    key: 'gfa', label: '네이버 GFA / 디스플레이', ratio: '1:1 정방형', size: '1024x1024',
    guidance: [
      'Google Display/네이티브(및 네이버 GFA)용 이미지. 이미지 위에 텍스트·로고·버튼 오버레이를 넣지 말 것(0%에 가깝게).',
      '제품/서비스 자체를 주인공으로 크게. 어둡고 단순한 배경, 약간 오프셋된 중앙 배치, 블러 처리된 배경으로 피사체를 분리.',
      '콜라주·인위적인 디지털 합성 배경은 피하고, AI 티가 강하지 않은 자연스러운 고품질로.',
    ].join(' '),
  },
  'banner': {
    key: 'banner', label: '웹/앱 배너', ratio: '가로형(약 1.9:1)', size: '1536x1024',
    guidance: [
      '웹·앱 디스플레이 배너. 인지 부하를 최소화 — 오브젝트 1개 + 핵심 키워드 1개 정도로 압축.',
      '제품 중심, 배경 단순, 명확한 피사체 분리. 가짜 버튼·가짜 입력창·가짜 시스템 알림·가짜 화살표는 금지.',
      'CTA가 필요하면 우측 또는 우하단에 절제된 형태로(시스템 UI를 흉내내지 말 것).',
    ].join(' '),
  },
};

const COMMON = [
  '플랫폼이 달라도 클릭률이 높은 이미지의 공통 원칙을 반드시 지킬 것:',
  '① 하나의 큰 피사체(단일 포인트)로 한눈에 이해되게, ② 배경을 단순화해 시각적 잡음을 줄이고,',
  '③ 강한 국소 대비를 주되 과포화·인위적인 "AI 같은" 느낌은 피하고, ④ 텍스트는 최대한 절제(넣으면 짧고 자연스러운 한국어),',
  '⑤ 플랫폼 UI가 덮는 영역을 피한 안전영역 설계, ⑥ 브랜드 일관성은 유지하되 각 시안은 콘셉트(배경/구도/카피/크롭)가 서로 분명히 다르게.',
  '의료법 등 규제 위반 소지가 있는 과장·허위 표현은 절대 넣지 말 것.',
].join(' ');

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function buildPrompt(p: Platform, cols: number, clientName: string, guideline: string): string {
  const n = cols * cols;
  return [
    '너는 한국 광고 크리에이티브 디렉터다. 아래 조건으로 광고 이미지 "시안 시트(콘택트 시트)"를 1장 만들어줘.',
    `대상 업체: "${clientName}".`,
    `출력은 ${cols}×${cols} 그리드 한 장으로, 서로 다른 ${n}개의 광고 시안을 배치한다.`,
    `각 칸(셀)은 ${p.ratio} 비율 느낌으로 구성하고, 칸 사이에는 얇은 흰색 여백(거터)을 둔다.`,
    `각 칸 좌상단에 1부터 ${n}까지 작은 번호 라벨을 넣어 구분한다(이 번호 외의 불필요한 텍스트·워터마크는 넣지 말 것).`,
    `${n}개 시안은 배경·구도·샷 스케일·강조 포인트가 실제로 서로 다른 변형이어야 한다.`,
    '',
    `[플랫폼: ${p.label}] ${p.guidance}`,
    '',
    COMMON,
    '',
    '── 업체 가이드라인(톤앤매너·금지표현 반영) ──',
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

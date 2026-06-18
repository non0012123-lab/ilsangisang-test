// 버전 감지 자동 새로고침
//  • 서버의 /version.json(배포 최신 버전)과 실행 중 번들의 __APP_VERSION__ 을 비교해
//    다르면 location.reload() → 오래 떠 있는 창(특히 트레이 AI 위젯)도 최신 코드로 전환된다.
//  • 채팅·일정 등은 Supabase 에 저장되므로 새로고침해도 데이터 손실 없음.
//  • 재로드 직후엔 새 번들의 __APP_VERSION__ 이 version.json 과 같아져 루프가 생기지 않는다.
//    (배포 전파 지연 등으로 어긋날 때를 대비해 짧은 쿨다운으로 무한 새로고침을 방지.)

const RUNNING = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
const COOLDOWN_KEY = 'ilsangisang.lastVersionReload';
const COOLDOWN_MS = 60_000; // 60초 내 재새로고침 금지(전파 지연 시 루프 방지)

let checking = false;

async function checkForUpdate(): Promise<void> {
  if (checking || !RUNNING) return;
  checking = true;
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { v?: string };
    const latest = data?.v;
    if (!latest || latest === RUNNING) return;
    // 새 버전 감지 — 쿨다운 확인 후 새로고침
    const last = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    location.reload();
  } catch {
    /* 네트워크 오류 등은 조용히 무시 — 다음 기회에 다시 시도 */
  } finally {
    checking = false;
  }
}

let started = false;

// 앱 시작 시 1회 호출. 포커스/가시성 전환 + 주기적으로 새 버전을 확인한다.
//  데스크톱 위젯은 트레이에서 띄울 때 포커스가 잡혀 즉시 확인된다(네이티브에서 __checkAppUpdate 호출도 병행).
export function startVersionWatch(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // 네이티브(데스크톱 셸)에서 위젯 소환 시 직접 호출할 수 있도록 노출
  (window as unknown as { __checkAppUpdate?: () => void }).__checkAppUpdate = () => { void checkForUpdate(); };
  const run = () => { void checkForUpdate(); };
  window.addEventListener('focus', run);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  window.setInterval(run, 5 * 60_000); // 5분마다
  run(); // 시작 직후 1회
}

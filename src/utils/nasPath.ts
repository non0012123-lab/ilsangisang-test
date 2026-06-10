// NAS(사내 공유 폴더) 경로를 "보는 사람의 OS 방언"으로 변환한다.
//  • 저장값은 그대로 두고, 표시·복사 시점에만 변환한다(윈도우 다수 + 맥 1명 혼용 대응).
//  • 윈도우 UNC :  \\192.168.123.13\marketing\프로그램
//  • macOS SMB :  smb://192.168.123.13/marketing/프로그램
//  • host/세그먼트만 뽑아 보는 OS 방언으로 재조립 → 어느 형식으로 저장돼 있든 양방향 호환.
//  • http(s)·www 등 일반 웹 링크는 NAS 경로가 아니므로 건드리지 않는다.

// 이 기기가 macOS 인가? (웹뷰의 navigator 로 판별 — 웹·Tauri 데스크톱 모두 동작)
//  iPhone/iPad 는 사내 공유폴더 대상이 아니므로 제외.
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const s = `${navigator.platform || ''} ${navigator.userAgent || ''}`;
  return /Mac/i.test(s) && !/iPhone|iPad|iPod/i.test(s);
}

const UNC_RE = /^\\\\[^\\/]+/;                      // \\host  (공유 경로는 선택: \\host\share\...)
const SMB_RE = /^smb:\/\/[^/]+/i;                   // smb://host (경로 선택)
const BARE_IP_RE = /^\d{1,3}(?:\.\d{1,3}){3}\\.+/;  // 192.168.0.1\share\...  (앞 \\ 누락 입력 보정)

// NAS 공유 경로처럼 보이는가? (일반 웹 링크는 false)
export function isNasPath(raw?: string): boolean {
  if (!raw) return false;
  const s = raw.trim();
  return UNC_RE.test(s) || SMB_RE.test(s) || BARE_IP_RE.test(s);
}

// host + 경로 세그먼트로 분해(구분자 차이를 흡수)
function parseNas(raw: string): { host: string; segs: string[] } | null {
  const s = raw.trim();
  if (SMB_RE.test(s)) {
    const parts = s.slice('smb://'.length).split('/').filter(Boolean);
    return parts.length ? { host: parts[0], segs: parts.slice(1) } : null;
  }
  if (UNC_RE.test(s)) {
    const parts = s.replace(/^\\\\/, '').split('\\').filter(Boolean);
    return parts.length ? { host: parts[0], segs: parts.slice(1) } : null;
  }
  if (BARE_IP_RE.test(s)) {
    const parts = s.split('\\').filter(Boolean);
    return parts.length ? { host: parts[0], segs: parts.slice(1) } : null;
  }
  return null;
}

// 보는 사람 OS 방언으로 변환. NAS 경로가 아니면 원문 그대로 반환.
//  mac 인자를 명시하지 않으면 이 기기의 OS(isMacOS)로 자동 판단.
export function toNasForOS(raw?: string, mac: boolean = isMacOS()): string {
  if (!raw) return raw ?? '';
  if (!isNasPath(raw)) return raw;
  const p = parseNas(raw);
  if (!p) return raw;
  const all = [p.host, ...p.segs];
  return mac ? `smb://${all.join('/')}` : `\\\\${all.join('\\')}`;
}

// 자유 텍스트(메모·완료 노트 등) 안에 섞인 NAS 경로 토큰만 골라 보는 OS 방언으로 치환.
//  웹 링크·일반 텍스트는 그대로 둔다.
const NAS_TOKEN_RE = /(smb:\/\/[^\s]+|\\\\[^\s]+)/gi;
export function convertNasInText(text?: string, mac: boolean = isMacOS()): string {
  if (!text) return text ?? '';
  return text.replace(NAS_TOKEN_RE, t => toNasForOS(t, mac));
}

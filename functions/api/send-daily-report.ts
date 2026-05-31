// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/send-daily-report
//  • 일일보고서를 Resend 로 발송한다(HTML 본문 + PDF 첨부).
//
// 환경변수:
//   RESEND_API_KEY (필수)  — Resend API 키 (re_...)
//   RESEND_FROM    (선택)  — 발신 주소. 기본 'report@12sang.com'
//                            (Resend 에서 인증한 도메인과 일치해야 함)
// ───────────────────────────────────────────────────────────────

interface Env {
  RESEND_API_KEY: string;
  RESEND_FROM?: string;
}

interface SendRequest {
  to?: string[];
  cc?: string[];
  subject?: string;
  html?: string;
  pdfBase64?: string; // data: 접두사 없는 base64
  filename?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const cleanEmails = (arr?: string[]) =>
  Array.from(new Set((arr ?? []).map(e => (e || '').trim()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))));

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: SendRequest;
  try { req = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  const to = cleanEmails(req.to);
  const cc = cleanEmails(req.cc);
  if (to.length === 0) return json({ error: '받는 사람(관리자) 이메일이 없습니다.' }, 400);
  if (!req.subject || !req.html) return json({ error: '제목 또는 본문이 비어 있습니다.' }, 400);

  const from = env.RESEND_FROM || 'report@12sang.com';
  const attachments = req.pdfBase64
    ? [{ filename: req.filename || 'daily-report.pdf', content: req.pdfBase64 }]
    : undefined;

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from,
        to,
        ...(cc.length ? { cc } : {}),
        subject: req.subject,
        html: req.html,
        ...(attachments ? { attachments } : {}),
      }),
    });
  } catch (e) {
    return json({ error: `Resend 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { message?: string }).message || JSON.stringify(data).slice(0, 300);
    return json({ error: `메일 발송 실패 (${res.status})`, detail }, 502);
  }
  return json({ ok: true, id: (data as { id?: string }).id ?? null, to });
};

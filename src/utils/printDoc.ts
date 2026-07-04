// 팝업(window.open) 없이 HTML 문서를 인쇄/PDF 저장하는 공용 유틸.
//  • 기존에는 window.open('', '_blank') 로 새 창을 열고 그 안에서 window.print() 했는데,
//    Tauri 데스크톱 웹뷰(및 팝업 차단 브라우저)에서는 새 창이 안 열려 "팝업 차단" 으로 실패했다.
//  • 화면에 보이지 않는 iframe 에 HTML 을 심고 그 안에서 print() 를 호출하면 팝업이 필요 없다.
//    결과는 동일: 브라우저/웹뷰의 인쇄 대화상자 → 'PDF로 저장'.
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden',
  } as CSSStyleDeclaration);
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  const doc = cw?.document;
  if (!cw || !doc) { iframe.remove(); alert('인쇄를 시작하지 못했습니다.'); return; }

  let printed = false;
  const run = () => {
    if (printed) return;
    printed = true;
    try { cw.focus(); cw.print(); } catch { /* 웹뷰가 print 미지원이면 무시 */ }
    // 인쇄 대화상자가 뜬 뒤 정리(afterprint 미발화 환경 대비 타이머).
    setTimeout(() => iframe.remove(), 1500);
  };
  cw.addEventListener?.('afterprint', () => setTimeout(() => iframe.remove(), 300));

  // 이미지·폰트 로드 완료(onload) 후 인쇄. onload 가 안 오는 경우를 대비해 타이머 폴백도 건다.
  iframe.onload = () => setTimeout(run, 300);
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(run, 1200);
}

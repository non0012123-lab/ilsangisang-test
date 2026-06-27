-- ───────────────────────────────────────────────────────────────
-- 어드바이저 게시글 단위(per-post) 모드 — 케이스 B(일반 블로그에 여러 광고주 글이 섞임).
--  • 계정 단위(0034)는 브랜드 블로그(광고주1=블로그1)용. 일반 블로그는 계정 통계가 광고주별로 무의미 →
--    광고주의 '글 URL 목록'을 수집기에 내려, 게시글별 통계를 긁어 광고주별로 합산한다.
--  • 글 목록 = 앱이 이미 가진 순위추적 대상(schedule_entries.link) 재활용. 네이버 블로그 글만.
--  • 수집기: URL→blogId/logNo 추출 → blogId별 세션으로 게시글 통계 → 합산 → patch_advisor_insight(0034)로
--           광고주 스냅샷에 되써넣음(카드 재사용). 세션 키가 client_id 가 아니라 'blogId'(URL에 들어있음).
--  • 계약: spike-rank/ADVISOR-CONTRACT.md §8(per-post 모드)
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- ── 광고주의 게시글 URL 목록(네이버 블로그 글, link 중복 제거 — 글 1개당 1행) ──
create or replace function public.advisor_post_targets(p_client_id text)
returns table (entry_id text, link text, keyword text)
language sql security definer set search_path = public
as $$
  -- 같은 link 가 여러 일정(키워드)에 걸쳐 있어도 글은 하나 → link 기준 distinct, 최신 일정 대표로.
  select distinct on (e.data->>'link')
         e.id                 as entry_id,
         e.data->>'link'      as link,
         e.data->>'keyword'   as keyword
    from public.schedule_entries e
   where e.data->>'clientId' = p_client_id
     and coalesce(e.data->>'link', '') <> ''
     and e.data->>'link' like '%blog.naver.com%'
   order by e.data->>'link', e.date desc;
$$;
grant execute on function public.advisor_post_targets(text) to authenticated;

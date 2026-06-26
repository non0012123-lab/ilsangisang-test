-- ───────────────────────────────────────────────────────────────
-- 순위 수집 작업에 결과 집계(성공/미노출/실패) 추가. 진행 바 + 결과 요약 표시용.
--  • success   = 발견(순위 숫자 잡힘)
--  • not_found = 미노출 (파서 정상이나 통합 1p/블로그탭에 링크 없음 = rank null)
--  • failed    = 실패 (IP/차단 등으로 HTML 자체를 못 불러옴 = 그 탭 omit)
--  • done = success + not_found + failed (처리한 탭 수). 진행 바 = done/total.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0027 다음)
-- ───────────────────────────────────────────────────────────────

alter table public.rank_jobs
  add column if not exists success   int not null default 0,
  add column if not exists not_found int not null default 0,
  add column if not exists failed    int not null default 0;

-- 진행도 함수에 집계 인자 추가. (기존 3-인자 버전은 제거하고 6-인자 + 기본값으로 대체)
drop function if exists public.set_rank_job_progress(text, int, int);

create or replace function public.set_rank_job_progress(
  p_job_id text, p_total int, p_done int,
  p_success int default null, p_not_found int default null, p_failed int default null)
returns void
language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set total     = coalesce(p_total, total),
         done      = coalesce(p_done, done),
         success   = coalesce(p_success, success),
         not_found = coalesce(p_not_found, not_found),
         failed    = coalesce(p_failed, failed)
   where id = p_job_id;
$$;
grant execute on function public.set_rank_job_progress(text, int, int, int, int, int) to authenticated;

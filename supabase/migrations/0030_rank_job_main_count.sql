-- ───────────────────────────────────────────────────────────────
-- 순위 수집 진행 현황에 "메인 키워드 개수" 추가 (롱테일 때문에 탭 수만으로는 규모 파악이 어려움).
--  • main_count = 이번 작업이 다루는 메인 키워드(일정) 수. 수집기가 rank_job_targets 길이로 보고.
--  • set_rank_job_progress 에 p_main_count 추가(생략 가능).
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0029 다음)
-- ───────────────────────────────────────────────────────────────

alter table public.rank_jobs add column if not exists main_count int not null default 0;

drop function if exists public.set_rank_job_progress(text, int, int, int, int, int);

create or replace function public.set_rank_job_progress(
  p_job_id text, p_total int, p_done int,
  p_success int default null, p_not_found int default null, p_failed int default null,
  p_main_count int default null)
returns void
language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set total      = coalesce(p_total, total),
         done       = coalesce(p_done, done),
         success    = coalesce(p_success, success),
         not_found  = coalesce(p_not_found, not_found),
         failed     = coalesce(p_failed, failed),
         main_count = coalesce(p_main_count, main_count)
   where id = p_job_id;
$$;
grant execute on function public.set_rank_job_progress(text, int, int, int, int, int, int) to authenticated;

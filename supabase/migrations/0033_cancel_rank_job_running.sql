-- ───────────────────────────────────────────────────────────────
-- 0033 · "중단" 이 running 작업도 확실히 취소하도록 보강
--
-- 증상: 위젯 "중단"을 눌러도 running 작업이 계속 running. (수집기 로그엔 [cancel] job=<id>)
-- 원인: 프로드 DB 에 옛 cancel_rank_job 이 떠 있거나(status='queued' 만 취소),
--       in-flight 상태가 queued/running 외 값일 수 있음.
-- 해결: '완료(done)·이미 취소(cancelled)' 가 아닌 모든 상태를 취소 → running 포함 확실히 취소.
--       (done 은 정상 완료라 덮어쓰지 않음, cancelled 는 멱등 처리)
--
-- ★대시보드 → SQL Editor 에 붙여넣어 '실행'하세요. (이 실행 자체가 핵심 — 프로드 함수 교체)
-- ───────────────────────────────────────────────────────────────

create or replace function public.cancel_rank_job(p_job_id text)
returns void
language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set status = 'cancelled', finished_at = now()
   where id = p_job_id
     and status not in ('done', 'cancelled');   -- running/queued/error/empty 등 미완료 전부 취소
$$;

grant execute on function public.cancel_rank_job(text) to authenticated;

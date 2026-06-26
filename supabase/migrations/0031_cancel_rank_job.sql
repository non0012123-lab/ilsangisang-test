-- ───────────────────────────────────────────────────────────────
-- 순위 수집 작업 중단(취소). 잘못된 범위/담당자로 돌렸거나 테스트 중단 시 사용.
--  • 앱 위젯의 "중단" 버튼이 호출 → status='cancelled'.
--  • 수집기는 키워드/탭 사이마다 status 를 조회해 'cancelled' 면 즉시 멈춘다(수집기 측 구현).
--    수집기가 이미 꺼진 경우에도 이 호출만으로 위젯의 '수집 중' 표시가 풀린다.
--
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요. (0030 다음)
-- ───────────────────────────────────────────────────────────────

create or replace function public.cancel_rank_job(p_job_id text)
returns void
language sql security definer set search_path = public
as $$
  update public.rank_jobs
     set status = 'cancelled', finished_at = now()
   where id = p_job_id and status in ('queued', 'running');
$$;
grant execute on function public.cancel_rank_job(text) to authenticated;

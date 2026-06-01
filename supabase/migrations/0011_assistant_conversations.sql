-- ───────────────────────────────────────────────────────────────
-- AI 어시스턴트 대화(채팅) 기록 저장
--  • 사용자가 여러 대화를 만들어 기록을 관리한다(대화목록 + 새 채팅).
--  • 개인 대화이므로 다른 업무 데이터(전체 공유)와 달리 본인 것만 보이도록
--    소유자(user_id) 기반 RLS 를 적용한다.
--  • 앱 객체(AssistantConversation)를 그대로 jsonb(data)로 저장.
-- 대시보드 → SQL Editor 에 붙여 실행하세요.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.assistant_conversations (
  id         text primary key,
  user_id    uuid not null default auth.uid(),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.assistant_conversations enable row level security;

-- 본인(user_id = 로그인 사용자)만 조회/생성/수정/삭제 가능 (개인 대화)
drop policy if exists "assistant_conversations_own" on public.assistant_conversations;
create policy "assistant_conversations_own" on public.assistant_conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 본인 대화만 빠르게 조회
create index if not exists assistant_conversations_user_idx
  on public.assistant_conversations (user_id);

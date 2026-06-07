-- ───────────────────────────────────────────────────────────────
-- 영업관리 (상담 로그) + 접근 권한
--  • 회사 공용 전화/문의폼 상담 기록. 고객 전화·이메일이 들어가 민감 → 권한자만 접근.
--  • 권한: profiles.sales_access = true 인 사람 또는 관리자(role='admin')만.
--  • 진짜 보안 경계는 RLS — 권한 없는 사용자는 SELECT 자체가 빈 결과(데이터를 못 받음).
--  • 다른 업무 데이터와 동일하게 앱 객체(SalesEntry)를 jsonb(data)로 저장.
-- 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- ───────────────────────────────────────────────────────────────

-- 1) 사람별 접근 권한 컬럼 (관리자가 가입승인/권한관리 화면에서 체크로 부여)
alter table public.profiles add column if not exists sales_access boolean not null default false;

-- 2) 권한 판별 함수 — SECURITY DEFINER 로 profiles 의 RLS 를 우회해 안전하게 판별
--    (RLS 정책 안에서 profiles 를 직접 조회하면 재귀/권한 문제가 생길 수 있어 함수로 분리)
create or replace function public.has_sales_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or p.sales_access = true)
  );
$$;

-- 3) 상담 로그 테이블
create table if not exists public.sales_entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sales_entries enable row level security;

-- 권한자(또는 관리자)만 읽기·쓰기 가능
drop policy if exists "sales_entries_access" on public.sales_entries;
create policy "sales_entries_access" on public.sales_entries
  for all to authenticated
  using (public.has_sales_access())
  with check (public.has_sales_access());

-- 다른 권한자가 등록/수정/삭제한 상담을 새로고침 없이 반영(realtime) — 선택사항.
--  UPDATE/DELETE 전달을 위해 REPLICA IDENTITY FULL (참고: 0012/0014 와 동일 이유).
-- (이미 발행에 있으면 "already member of publication" 에러 — 무시하세요.)
alter publication supabase_realtime add table public.sales_entries;
alter table public.sales_entries replica identity full;

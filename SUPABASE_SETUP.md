# Supabase 인증 연동 가이드

회원가입/로그인은 Supabase Auth(이메일+비밀번호)로 동작합니다.
아래 순서대로 한 번만 설정하면 됩니다.

## 1. 프로젝트 생성
1. https://supabase.com 에서 로그인 → **New project**
2. 프로젝트 이름/DB 비밀번호/리전(서울 권장: `ap-northeast-2`) 입력 후 생성 (약 2분 소요)

## 2. 환경변수 설정
1. 대시보드 → **Project Settings → API** 에서 값 복사
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
2. 프로젝트 루트에서:
   ```bash
   cp .env.example .env
   ```
   `.env` 를 열어 위 두 값을 붙여넣습니다. (`.env` 는 git에 커밋되지 않습니다)

## 3. DB 스키마 적용 (profiles 테이블 + 가입 트리거)
대시보드 → **SQL Editor** 에 `supabase/migrations/0001_init_profiles.sql` 내용을
붙여넣고 **Run**.

> CLI를 쓴다면: `supabase link --project-ref <ref>` 후 `supabase db push`

이 스크립트가 하는 일:
- `profiles` 테이블 생성 (역할/이름/부서/클라이언트 연결)
- RLS 정책: 로그인 사용자는 프로필 조회 가능, 본인 것만 수정 가능
- **가입 시 자동으로 profiles 행 생성** (기본 권한 `manager`)

## 4. 이메일 인증 끄기 (가입 즉시 로그인)
대시보드 → **Authentication → Sign In / Providers → Email**
→ **Confirm email** 옵션을 **끄기(off)** 로 저장.

## 5. 실행
```bash
npm run dev
```
- `/signup` 에서 직원 가입 → 즉시 로그인되어 대시보드로 이동
- 가입 계정은 기본 **담당자(manager)** 권한

## 관리자 / 클라이언트 권한 부여
가입은 직원(manager)만 가능합니다. 권한 변경은 SQL Editor에서:
```sql
-- 관리자로 승격
update public.profiles set role = 'admin' where email = 'admin@ilsangisang.com';

-- 클라이언트 계정: Authentication에서 사용자 추가 후 연결
update public.profiles set role = 'client', client_id = 'cl1'
where email = 'starbucks@client.com';
```

## 배포(GitHub Pages / Cloudflare 등)
빌드 시점에 환경변수가 주입되어야 하므로, CI/배포 환경에도
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 설정한 뒤 빌드하세요.
(로컬에서 `npm run deploy` 로 배포한다면 로컬 `.env` 값이 사용됩니다.)

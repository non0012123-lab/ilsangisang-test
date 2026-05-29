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

## 가입 승인제 (중요)
보안을 위해 **신규 가입자는 'pending'(승인 대기) 상태**로 시작하며, 승인 전에는
내부 화면에 접근할 수 없습니다(승인 대기 화면만 표시). 관리자가 **담당자/클라이언트**로
승인해야 이용 가능합니다.

### 적용 절차
1. SQL Editor에 **`supabase/migrations/0002_approval.sql`** 실행
2. **최초 관리자 지정** (필수 — 안 하면 아무도 승인할 수 없음):
   ```sql
   update public.profiles set role = 'admin' where email = '본인이메일@example.com';
   ```
3. (권장) 이미 manager로 가입돼 있던 계정들을 다시 승인 대기로 되돌리기:
   ```sql
   update public.profiles set role = 'pending'
   where role = 'manager' and email <> '본인이메일@example.com';
   ```

### 승인 방법
관리자로 로그인 → 좌측 **가입 승인** 메뉴 → 대기자를 **담당자로 승인** 또는
**클라이언트로 승인**(연결 업체 선택). 기존 사용자 역할도 여기서 변경할 수 있습니다.

> SQL로 직접 부여도 가능:
> ```sql
> update public.profiles set role = 'client', client_id = 'cl1'
> where email = 'starbucks@client.com';
> ```

## 배포(GitHub Pages / Cloudflare 등)
빌드 시점에 환경변수가 주입되어야 하므로, CI/배포 환경에도
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 설정한 뒤 빌드하세요.
(로컬에서 `npm run deploy` 로 배포한다면 로컬 `.env` 값이 사용됩니다.)

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string; // 레거시 호환
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 빌드 시 vite define 으로 주입되는 현재 번들의 버전 식별자(버전 감지 자동 새로고침용)
declare const __APP_VERSION__: string;

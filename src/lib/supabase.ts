import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// publishable key는 브라우저 노출이 안전(이미 클라이언트 번들에 포함)하고 RLS로 보호됨.
// .env가 없는 환경(클론한 PC, CI 등)에서도 동작하도록 커밋된 기본값을 둠 — .env가 있으면 그쪽이 우선.
const DEFAULT_URL = 'https://gonttqjvnjmenvnsaokx.supabase.co';
const DEFAULT_KEY = 'sb_publishable_cl2lhT0jMk6wyga4FrYE_g_kHIoi1S9';

const url = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_URL;
// 최신 publishable key(sb_publishable_...) 우선, 없으면 레거시 anon key, 그래도 없으면 기본값
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? DEFAULT_KEY;

// URL/키가 모두 있으면 연결됨 (기본값 덕분에 항상 true)
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

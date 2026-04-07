import { createClient } from '@supabase/supabase-js'

// 서버 전용 Admin 클라이언트 (RLS 우회)
// 매 호출 시 환경변수에서 직접 읽어 캐시 문제 방지
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !key) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
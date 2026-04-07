import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 클라이언트용 Supabase 인스턴스 (브라우저에서 사용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 서버용 Supabase 인스턴스 (관리자 권한, RLS 우회)
// 서버 사이드에서만 사용 가능 (SUPABASE_SERVICE_ROLE_KEY는 NEXT_PUBLIC이 아님)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null
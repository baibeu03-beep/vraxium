import { createAdminClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// 김팔녀 데이터 테스트용
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', '054bd63d-d6b4-434c-a40d-06521b9c2a95')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      birth_date_check: {
        value: data.birth_date,
        type: typeof data.birth_date,
        is_null: data.birth_date === null,
        is_undefined: data.birth_date === undefined
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    )
  }
}

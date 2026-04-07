import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// Output Link 타입
interface OutputLink {
  desc: string;
  url: string;
}

// GET: 특정 유저의 특정 주차 2차 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const weekId = searchParams.get('week_id')
    const activityTypeId = searchParams.get('activity_type_id')

    if (!userId || !weekId) {
      return NextResponse.json({ error: 'user_id and week_id are required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('user_activity_details')
      .select('*')
      .eq('user_id', userId)
      .eq('week_id', weekId)

    // 특정 activity_type만 조회
    if (activityTypeId) {
      query = query.eq('activity_type_id', activityTypeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activity details:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Activity details GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 2차 정보 저장 (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { user_id, week_id, activity_type_id, sub_title, output_links } = body

    // 필수 필드 검증
    if (!user_id || !week_id || !activity_type_id) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // sub_title 길이 검증 (150자)
    if (sub_title && sub_title.length > 150) {
      return NextResponse.json(
        { error: 'sub_title must be 150 characters or less' },
        { status: 400 }
      )
    }

    // output_links 검증 (최대 5개, 각 desc 20자 이내)
    if (output_links) {
      if (!Array.isArray(output_links) || output_links.length > 5) {
        return NextResponse.json(
          { error: 'output_links must be an array with max 5 items' },
          { status: 400 }
        )
      }

      for (const link of output_links as OutputLink[]) {
        if (link.desc && link.desc.length > 20) {
          return NextResponse.json(
            { error: 'Each link description must be 20 characters or less' },
            { status: 400 }
          )
        }
      }
    }

    // Upsert (있으면 업데이트, 없으면 삽입)
    const { data, error } = await supabaseAdmin
      .from('user_activity_details')
      .upsert(
        {
          user_id,
          week_id,
          activity_type_id,
          sub_title: sub_title || null,
          output_links: output_links || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,week_id,activity_type_id',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error saving activity details:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Activity details POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 2차 정보 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const weekId = searchParams.get('week_id')
    const activityTypeId = searchParams.get('activity_type_id')

    if (!userId || !weekId || !activityTypeId) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_activity_details')
      .delete()
      .eq('user_id', userId)
      .eq('week_id', weekId)
      .eq('activity_type_id', activityTypeId)

    if (error) {
      console.error('Error deleting activity details:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Activity details DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { user_id, week_id, activity_type_id, sub_title, output_links, growth_point, image_urls, image_captions } = body

    // 필수 필드 검증
    if (!user_id || !week_id || !activity_type_id) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // sub_title 길이 검증 (300자)
    if (sub_title && sub_title.length > 300) {
      return NextResponse.json(
        { error: 'sub_title must be 300 characters or less' },
        { status: 400 }
      )
    }

    // growth_point 길이 검증 (500자)
    if (growth_point && typeof growth_point === 'string' && growth_point.length > 500) {
      return NextResponse.json(
        { error: 'growth_point must be 500 characters or less' },
        { status: 400 }
      )
    }

    // image_urls 검증 (최대 4개, 각 string)
    if (image_urls !== undefined && image_urls !== null) {
      if (!Array.isArray(image_urls) || image_urls.length > 4) {
        return NextResponse.json(
          { error: 'image_urls must be an array with max 4 items' },
          { status: 400 }
        )
      }
      if (image_urls.some((u: unknown) => u !== null && typeof u !== 'string')) {
        return NextResponse.json(
          { error: 'image_urls items must be string or null' },
          { status: 400 }
        )
      }
    }

    // image_captions 검증 (최대 4개, 각 200자)
    if (image_captions !== undefined && image_captions !== null) {
      if (!Array.isArray(image_captions) || image_captions.length > 4) {
        return NextResponse.json(
          { error: 'image_captions must be an array with max 4 items' },
          { status: 400 }
        )
      }
      for (const cap of image_captions) {
        if (typeof cap === 'string' && cap.length > 200) {
          return NextResponse.json(
            { error: 'Each image caption must be 200 characters or less' },
            { status: 400 }
          )
        }
      }
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

    // 권한 체크: 마감 시간 이내 OR 어드민 개별 grant
    // 실무경험은 team_id 별로 weekly_activities 가 분리되어 있어서, 유저 팀에 해당하는 행을 골라야 한다.
    const [weeklyActivitiesResult, userTeamResult, grantResult] = await Promise.all([
      supabaseAdmin
        .from('weekly_activities')
        .select('is_active, opened_at, deadline, team_id')
        .eq('week_id', week_id)
        .eq('activity_type_id', activity_type_id),
      supabaseAdmin
        .from('user_team_parts')
        .select('team_id, left_at')
        .eq('user_id', user_id)
        .is('left_at', null)
        .maybeSingle(),
      supabaseAdmin
        .from('secondary_info_grants')
        .select('deadline')
        .eq('user_id', user_id)
        .eq('week_id', week_id)
        .eq('activity_type_id', activity_type_id)
        .maybeSingle(),
    ])

    const userTeamId: string | null = userTeamResult.data?.team_id || null
    const candidateRows = weeklyActivitiesResult.data || []
    // 클럽 공통(NULL) 행 우선, 없으면 유저 팀 매칭 행
    const wa = candidateRows.find((r) => r.team_id == null)
      || candidateRows.find((r) => r.team_id === userTeamId)
      || null
    // deadline 컬럼 우선, 없으면 opened_at+48h 폴백
    const isBeforeDeadline = wa?.is_active && (
      wa?.deadline
        ? Date.now() < new Date(wa.deadline).getTime()
        : wa?.opened_at && (Date.now() - new Date(wa.opened_at).getTime()) < 48 * 60 * 60 * 1000
    )

    const grant = grantResult.data
    const hasActiveGrant = grant && new Date(grant.deadline).getTime() > Date.now()

    if (!isBeforeDeadline && !hasActiveGrant) {
      return NextResponse.json(
        { error: '2차 정보 입력 권한이 없습니다. (마감 시간 경과 또는 권한 미부여)' },
        { status: 403 }
      )
    }

    // Upsert (있으면 업데이트, 없으면 삽입)
    // 미전달 필드는 기존 값 유지: undefined → 페이로드에서 제외
    const upsertPayload: Record<string, unknown> = {
      user_id,
      week_id,
      activity_type_id,
      updated_at: new Date().toISOString(),
    }
    if (sub_title !== undefined) upsertPayload.sub_title = sub_title || null
    if (output_links !== undefined) upsertPayload.output_links = output_links || null
    if (growth_point !== undefined) upsertPayload.growth_point = growth_point || null
    if (image_urls !== undefined) upsertPayload.image_urls = image_urls ?? []
    if (image_captions !== undefined) upsertPayload.image_captions = image_captions ?? []

    const { data, error } = await supabaseAdmin
      .from('user_activity_details')
      .upsert(upsertPayload, {
        onConflict: 'user_id,week_id,activity_type_id',
      })
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

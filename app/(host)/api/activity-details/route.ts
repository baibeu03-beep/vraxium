import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireOwnerOrAdmin } from '@/lib/api-auth'
import { hasOpenEditWindowAny } from '@/lib/editWindow'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  CLUSTER4_EDIT_RESOURCE_KEYS,
  CLUSTER4_ACTIVITY_DETAILS_KEY_GROUP,
  type Cluster4EditResourceKey,
} from '@/lib/cluster4EditWindow'
import { EDIT_WINDOW_LOCKED_MESSAGE } from '@/lib/editWindowMessages'

// 프론트가 보낸 resource_key 가 4개 모달 신규 키 중 하나라면 그 키를 우선 검사하고,
// 닫혀 있어도 legacy activity_details 가 열려 있으면 통과시킨다 (legacy fallback).
// 미전달(undefined) 이면 legacy activity_details 만 검사 — 구 프론트 호환.
function resolveCluster4GateKeys(
  hint: unknown,
): readonly Cluster4EditResourceKey[] {
  const allowed = new Set<string>(CLUSTER4_ACTIVITY_DETAILS_KEY_GROUP)
  if (typeof hint === 'string' && allowed.has(hint)) {
    // 신규 키 우선, legacy 폴백 1개를 OR 로 묶어서 본다.
    if (hint === CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails) {
      return [CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails]
    }
    return [
      hint as Cluster4EditResourceKey,
      CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails,
    ]
  }
  // hint 없음 → legacy 단독 검사
  return [CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails]
}

// Output Link 타입
interface OutputLink {
  desc: string;
  url: string;
}

// GET: 특정 유저의 특정 주차 2차 정보 조회.
//
// 권한 정책 (2026-05-22 변경):
//   - cluster-4-card peer-view 가시화를 위해 owner-or-admin 게이트 제거 → "로그인만".
//   - 응답에 PII 없음 — user_activity_details 컬럼은 sub_title/output_links/
//     growth_point/image_urls/image_captions 등 콘텐츠/관계키만 (schema 확인됨).
//   - POST/DELETE (mutation) / 작성기간 게이트는 그대로 유지 (line 115, 323).
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

    // 로그인만 검증 — peer-view 허용.
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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
    const {
      user_id,
      week_id,
      activity_type_id,
      sub_title,
      output_links,
      growth_point,
      image_urls,
      image_captions,
      rating, // Work Exp 라인 평점 (0~10 정수 또는 null). undefined 면 미전달 → 기존 값 유지.
      resource_key, // optional — cluster4 모달 신규 키 (work_info/ability/exp/career). 없으면 legacy
    } = body

    // 필수 필드 검증
    if (!user_id || !week_id || !activity_type_id) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // owner 본인 또는 관리자만 write 허용
    const gate = await requireOwnerOrAdmin(user_id)
    if (!gate.ok) return gate.response

    // 작성 기간 게이트 — admin 우회. owner 본인은 user_edit_windows row 가 열려 있어야 함.
    // 프론트가 보낸 resource_key 가 신규 모달 키이면 (신규 키 OR legacy activity_details) 로,
    // 없으면 legacy activity_details 단독 키로 검사한다.
    // 통과 결과(hasOpenWindow)는 하단 weekly_activities/secondary_info_grants 게이트와
    // OR 결합되어 "어드민이 작성기간을 명시적으로 열어줬다 = secondary_info_grants 와 동등 권한"
    // 으로 처리된다.
    let hasOpenWindow = false
    if (!gate.context.isAdmin) {
      const gateKeys = resolveCluster4GateKeys(resource_key)
      hasOpenWindow = await hasOpenEditWindowAny({
        userId: gate.context.targetUserId,
        resourceKeys: gateKeys,
      })
      if (!hasOpenWindow) {
        return NextResponse.json(
          {
            success: false,
            error: 'EDIT_WINDOW_CLOSED',
            message: EDIT_WINDOW_LOCKED_MESSAGE,
          },
          { status: 403 }
        )
      }
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

    // rating 검증 (0~10 정수 또는 null). undefined 면 미전달로 간주.
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 10) {
        return NextResponse.json(
          { error: 'rating must be an integer between 0 and 10, or null' },
          { status: 400 }
        )
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

    // 관리자는 마감 시간 게이트 우회 가능 (운영상 복구/보강용).
    // user_edit_windows row 가 열려 있는 사용자도 같은 의미적 등급으로 우회 허용:
    // 어드민이 명시적으로 작성기간을 열어줬다 = secondary_info_grants 와 동등 권한 부여.
    // weekly_activities 테이블 부재 / 마감 시간 미설정 환경에서 신규 키 정책으로 통일.
    if (
      !gate.context.isAdmin &&
      !hasOpenWindow &&
      !isBeforeDeadline &&
      !hasActiveGrant
    ) {
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
    // output_links 는 DB NOT NULL — null/undefined 는 빈 배열로 정규화 (image_urls/captions 와 동일 패턴).
    if (output_links !== undefined) upsertPayload.output_links = output_links ?? []
    if (growth_point !== undefined) upsertPayload.growth_point = growth_point || null
    if (image_urls !== undefined) upsertPayload.image_urls = image_urls ?? []
    if (image_captions !== undefined) upsertPayload.image_captions = image_captions ?? []
    if (rating !== undefined) upsertPayload.rating = rating === null ? null : Number(rating)

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
    const resourceKeyHint = searchParams.get('resource_key') // optional — 신규 모달 키 hint

    if (!userId || !weekId || !activityTypeId) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // owner 본인 또는 관리자만 delete 허용
    const gate = await requireOwnerOrAdmin(userId)
    if (!gate.ok) return gate.response

    // 작성 기간 게이트 — admin 우회. 신규 키 hint 가 있으면 (신규 키 OR legacy) 로,
    // 없으면 legacy activity_details 단독으로 검사 (POST 와 동일 규칙).
    if (!gate.context.isAdmin) {
      const gateKeys = resolveCluster4GateKeys(resourceKeyHint)
      const open = await hasOpenEditWindowAny({
        userId: gate.context.targetUserId,
        resourceKeys: gateKeys,
      })
      if (!open) {
        return NextResponse.json(
          {
            success: false,
            error: 'EDIT_WINDOW_CLOSED',
            message: EDIT_WINDOW_LOCKED_MESSAGE,
          },
          { status: 403 }
        )
      }
    }

    const { error } = await supabaseAdmin
      .from('user_activity_details')
      .delete()
      .eq('user_id', gate.context.targetUserId)
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

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
import { DemoModeError, resolveDemoProfileUserId } from '@/lib/demoMode'
import { triggerAdminSnapshotRecompute } from '@/lib/triggerAdminSnapshotRecompute'

// cluster4 라인 저장 분기에서 line_target_id 형식 검증용.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    // 테스트 유저(데모) 모드 — query demoUserId 가 유효한 테스트 유저면 조회 대상을 그 id 로 고정.
    let demoProfileUserId: string | null = null
    try {
      demoProfileUserId = await resolveDemoProfileUserId(searchParams.get('demoUserId'))
    } catch (error) {
      if (error instanceof DemoModeError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }
    const effectiveUserId = demoProfileUserId ?? userId

    if (!effectiveUserId || !weekId) {
      return NextResponse.json({ error: 'user_id and week_id are required' }, { status: 400 })
    }

    // 로그인만 검증 — peer-view 허용. 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과.
    const session = await getServerSession(authOptions)
    if (!session?.user?.email && !demoProfileUserId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    let query = supabaseAdmin
      .from('user_activity_details')
      .select('*')
      .eq('user_id', effectiveUserId)
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
      // cluster4 "라인" 저장 식별자. 값이 있으면 user_activity_details 와 더불어 canonical
      // store(cluster4_line_submissions)에도 동기화한다. (없으면 legacy activity_type 단위 저장만)
      line_target_id,
      // 신규 outputLinks([{url,label}]) 단일 출처. 라인 submission output_links jsonb 로 매핑.
      outputLinks,
    } = body

    // 진입 진단 로그 — 저장 대상/요청 본문 식별값.
    console.log('[activity-details POST] entry', {
      user_id,
      week_id,
      activity_type_id,
      line_target_id: line_target_id ?? null,
      resource_key: resource_key ?? null,
      outputLinksCount: Array.isArray(outputLinks) ? outputLinks.length : 0,
      imageCount: Array.isArray(image_urls) ? image_urls.filter(Boolean).length : 0,
      body,
    })

    // 테스트 유저(데모) 모드 주체 해소 — body.demoUserId 우선, 없으면 query demoUserId.
    //   - 없음 → null (일반 세션 인증 경로, 기존 흐름 그대로)
    //   - 데모 모드 on + test_user_markers 등재 유저 → 그 profile.user_id
    //   - 데모 모드 on + 미등재(운영 일반) user_id → DemoModeError(403)
    //   - 데모 모드 off → null (무시, 일반 경로)
    const { searchParams: postSearchParams } = new URL(request.url)
    let demoProfileUserId: string | null = null
    try {
      demoProfileUserId = await resolveDemoProfileUserId(
        body?.demoUserId ?? postSearchParams.get('demoUserId'),
      )
    } catch (error) {
      if (error instanceof DemoModeError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }
    const isDemo = demoProfileUserId !== null
    // 데모 모드면 저장 대상 user_id 를 테스트 유저로 강제 고정 (body.user_id 가 관리자 id 여도 무시).
    const effectiveUserId = isDemo ? demoProfileUserId : user_id

    // 필수 필드 검증
    if (!effectiveUserId || !week_id || !activity_type_id) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // owner 본인 또는 관리자만 write 허용. 데모(테스트 유저) 모드면 세션 없이 그 테스트 유저 id 로 진행.
    // 데모는 admin 우회 없이(canBypassAsAdmin=false) 작성기간을 일반 고객과 동일하게 강제한다.
    let ownerUserId: string
    let canBypassAsAdmin: boolean
    if (isDemo) {
      ownerUserId = effectiveUserId as string
      canBypassAsAdmin = false
    } else {
      const gate = await requireOwnerOrAdmin(effectiveUserId)
      if (!gate.ok) return gate.response
      ownerUserId = gate.context.targetUserId
      canBypassAsAdmin = gate.context.isAdmin
    }

    // 작성 기간 게이트 — admin 우회. owner 본인은 user_edit_windows row 가 열려 있어야 함.
    // 프론트가 보낸 resource_key 가 신규 모달 키이면 (신규 키 OR legacy activity_details) 로,
    // 없으면 legacy activity_details 단독 키로 검사한다.
    // 통과 결과(hasOpenWindow)는 하단 weekly_activities/secondary_info_grants 게이트와
    // OR 결합되어 "어드민이 작성기간을 명시적으로 열어줬다 = secondary_info_grants 와 동등 권한"
    // 으로 처리된다.
    let hasOpenWindow = false
    if (!canBypassAsAdmin) {
      const gateKeys = resolveCluster4GateKeys(resource_key)
      hasOpenWindow = await hasOpenEditWindowAny({
        userId: ownerUserId,
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
        .eq('user_id', ownerUserId)
        .is('left_at', null)
        .maybeSingle(),
      supabaseAdmin
        .from('secondary_info_grants')
        .select('deadline')
        .eq('user_id', ownerUserId)
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
      !canBypassAsAdmin &&
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
      user_id: ownerUserId,
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

    // ─────────────────────────────────────────────────────────────────────────
    // Cluster4 "라인" 저장 동기화 (line_target_id 가 있을 때만).
    //
    // 배경(과거 버그): 고객 앱 라인 모달은 line_target_id 를 함께 보냈지만, 이 라우트는
    //   user_activity_details 에만 upsert 하고 line_target_id 를 무시했다. 어드민 상세와
    //   고객 주차 카드(/api/cluster4/weekly-cards)는 cluster4_line_submissions 만 읽으므로
    //   "저장 완료" 안내는 떠도 양쪽 어디에도 값이 보이지 않았다 (잘못된 테이블에 성공 저장).
    //
    // 수정: line_target_id 가 유효하면 canonical store 인 cluster4_line_submissions 에도
    //   upsert 한다. 두 테이블을 함께 갱신해 legacy(detail-first) 표시와 submission 표시를
    //   정합 유지하고, 이 write 가 실패하면 500 을 반환한다 → 프론트가 throw → "저장 완료"
    //   안내가 실제 DB 저장 성공 이후에만 뜬다.
    if (typeof line_target_id === 'string' && UUID_RE.test(line_target_id)) {
      // 1) 대상 라인 소유/활성 검증 (validate_cluster4_line_submission 트리거의 사전 친절 에러).
      //    트리거가 submission.user_id = target_user_id 를 강제하므로, 여기서 미리 확인해
      //    혼동스러운 500 대신 명확한 403/404 를 돌려준다.
      const { data: targetRow, error: targetErr } = await supabaseAdmin
        .from('cluster4_line_targets')
        .select('id, target_mode, target_user_id, cluster4_lines!inner(is_active)')
        .eq('id', line_target_id)
        .maybeSingle()

      if (targetErr) {
        console.error('[activity-details POST][cluster4-line] target lookup error', targetErr)
        return NextResponse.json({ error: targetErr.message }, { status: 500 })
      }

      const tRow = targetRow as unknown as {
        id: string
        target_mode: 'user' | 'rule'
        target_user_id: string | null
        cluster4_lines: { is_active: boolean } | null
      } | null

      if (!tRow || tRow.cluster4_lines?.is_active !== true) {
        return NextResponse.json({ error: '개설된 라인을 찾을 수 없습니다.' }, { status: 404 })
      }
      if (tRow.target_mode !== 'user' || tRow.target_user_id !== ownerUserId) {
        return NextResponse.json(
          { error: '이 라인에 대한 저장 권한이 없습니다.' },
          { status: 403 },
        )
      }

      // 2) 페이로드 매핑 — cluster4_line_submissions 컬럼 형태로 변환.
      //    subtitle CHECK: NULL 또는 공백 아님. growth_point: NULL 또는 text.
      const subSubtitle =
        typeof sub_title === 'string' && sub_title.trim() ? sub_title.trim() : null
      const subGrowthPoint =
        typeof growth_point === 'string' && growth_point.trim() ? growth_point.trim() : null
      // output_links jsonb: 신규 outputLinks([{url,label}]) 우선, 없으면 legacy output_links([{desc,url}]).
      //    URL 없는 슬롯은 제외 (read 모델 resolveOutputLinks 와 동일 규칙).
      const subOutputLinks = Array.isArray(outputLinks)
        ? (outputLinks as Array<{ url?: unknown; label?: unknown }>)
            .map((l) => ({
              url: typeof l?.url === 'string' ? l.url.trim() : '',
              label: typeof l?.label === 'string' && l.label.trim() ? l.label.trim() : null,
            }))
            .filter((l) => l.url !== '')
        : Array.isArray(output_links)
          ? (output_links as Array<{ url?: unknown; desc?: unknown }>)
              .map((l) => ({
                url: typeof l?.url === 'string' ? l.url.trim() : '',
                label: typeof l?.desc === 'string' && l.desc.trim() ? l.desc.trim() : null,
              }))
              .filter((l) => l.url !== '')
          : []
      // output_images jsonb: image_urls(null 슬롯 포함) ↔ image_captions 1:1 → [{url,caption}].
      //    url 없는 슬롯 제외. cluster4_lines.output_images 와 동일 구조 [{url,caption}].
      const imgUrls = Array.isArray(image_urls) ? image_urls : []
      const imgCaps = Array.isArray(image_captions) ? image_captions : []
      const subOutputImages = imgUrls
        .map((u: unknown, i: number) => ({
          url: typeof u === 'string' ? u.trim() : '',
          caption:
            typeof imgCaps[i] === 'string' && imgCaps[i].trim() ? imgCaps[i].trim() : null,
        }))
        .filter((x) => x.url !== '')

      const subPayload = {
        line_target_id,
        user_id: ownerUserId,
        subtitle: subSubtitle,
        growth_point: subGrowthPoint,
        output_links: subOutputLinks,
        output_images: subOutputImages,
      }

      // 진단 로그 — write 대상 table / where(onConflict) / payload.
      console.log('[activity-details POST][cluster4-line] write', {
        ownerUserId,
        weekId: week_id,
        activityTypeId: activity_type_id,
        lineTargetId: line_target_id,
        table: 'cluster4_line_submissions',
        onConflict: 'line_target_id,user_id',
        payload: subPayload,
      })

      const SUB_SELECT =
        'id,line_target_id,user_id,subtitle,growth_point,output_links,output_images,updated_at'

      const { data: subData, error: subErr } = await supabaseAdmin
        .from('cluster4_line_submissions')
        .upsert(subPayload, { onConflict: 'line_target_id,user_id' })
        .select(SUB_SELECT)
        .single()

      if (subErr || !subData) {
        console.error('[activity-details POST][cluster4-line] submission upsert FAILED', subErr)
        return NextResponse.json(
          { error: subErr?.message ?? '라인 저장에 실패했습니다.' },
          { status: 500 },
        )
      }

      // 저장 직후 동일 조건 재조회 — 실제 반영 확인용 로그.
      const { data: verifyRow } = await supabaseAdmin
        .from('cluster4_line_submissions')
        .select(SUB_SELECT)
        .eq('line_target_id', line_target_id)
        .eq('user_id', ownerUserId)
        .maybeSingle()
      console.log('[activity-details POST][cluster4-line] post-write select', verifyRow)

      // 어드민 주차 카드 스냅샷 재계산 트리거 (best-effort, 실패해도 저장은 성공).
      await triggerAdminSnapshotRecompute([ownerUserId])

      return NextResponse.json({ success: true, data, submission: subData })
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

    // 테스트 유저(데모) 모드 — query demoUserId 가 유효한 테스트 유저면 삭제 대상을 그 id 로 고정.
    let demoProfileUserId: string | null = null
    try {
      demoProfileUserId = await resolveDemoProfileUserId(searchParams.get('demoUserId'))
    } catch (error) {
      if (error instanceof DemoModeError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }
    const isDemo = demoProfileUserId !== null
    const effectiveUserId = isDemo ? demoProfileUserId : userId

    if (!effectiveUserId || !weekId || !activityTypeId) {
      return NextResponse.json(
        { error: 'user_id, week_id, and activity_type_id are required' },
        { status: 400 }
      )
    }

    // owner 본인 또는 관리자만 delete 허용. 데모(테스트 유저) 모드면 세션 없이 그 테스트 유저 id 로 진행.
    let ownerUserId: string
    let canBypassAsAdmin: boolean
    if (isDemo) {
      ownerUserId = effectiveUserId as string
      canBypassAsAdmin = false
    } else {
      const gate = await requireOwnerOrAdmin(effectiveUserId)
      if (!gate.ok) return gate.response
      ownerUserId = gate.context.targetUserId
      canBypassAsAdmin = gate.context.isAdmin
    }

    // 작성 기간 게이트 — admin 우회. 신규 키 hint 가 있으면 (신규 키 OR legacy) 로,
    // 없으면 legacy activity_details 단독으로 검사 (POST 와 동일 규칙).
    if (!canBypassAsAdmin) {
      const gateKeys = resolveCluster4GateKeys(resourceKeyHint)
      const open = await hasOpenEditWindowAny({
        userId: ownerUserId,
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
      .eq('user_id', ownerUserId)
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

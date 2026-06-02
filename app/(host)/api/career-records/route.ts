import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from '@/lib/demoMode'

export const dynamic = "force-dynamic"

// GET: 사용자의 경력 기록 조회 (프로젝트 정보 포함)
//
// 권한 정책 (2026-05-22 변경):
//   - cluster-4-card peer-view 가시화를 위해 owner-or-admin 게이트를 제거하고
//     "로그인 사용자면 누구나 조회 가능" 으로 완화. season-reputations GET 패턴과 동일.
//   - 응답에 PII (email/phone/auth_email 등) 가 노출되지 않음을 사전 점검 후 적용.
//   - mutation (없음 — 이 라우트는 GET 전용) / 작성기간 게이트는 무관.
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const weekId = searchParams.get('week_id')
    const seasonKey = searchParams.get('season_key') || searchParams.get('season_id')

    // 로그인만 검증 — 타 크루 카드 진입(peer-view) 허용.
    // 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과(데모 UX 읽기). season-reputations GET 과 동일 패턴.
    let demoBypass: string | null = null
    try {
      demoBypass = await resolveDemoProfileUserIdFromRequest(request)
    } catch (e) {
      if (e instanceof DemoModeError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      throw e
    }
    const session = await getServerSession(authOptions)
    if (!session?.user?.email && !demoBypass) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // user_id 가 주어졌으면 그 유저 기준으로 조회, 없으면 프로젝트 마스터만 반환.
    const effectiveUserId: string | null = userId || null

    // 주차별 프로젝트와 사용자 기록을 함께 조회
    if (weekId) {
      // 1. junction 으로 해당 주차에 개설된 라인 ID 조회 (is_active=true 만)
      const { data: junctionRows, error: junctionError } = await supabaseAdmin
        .from('career_project_weeks')
        .select('project_id')
        .eq('week_id', weekId)
        .eq('is_active', true)

      if (junctionError) {
        console.error('Error fetching career_project_weeks:', junctionError)
        return NextResponse.json({ error: junctionError.message }, { status: 500 })
      }

      const activeProjectIds = (junctionRows || []).map(r => r.project_id)

      // 2. 해당 라인들 본문 조회
      const { data: projects, error: projectsError } = activeProjectIds.length > 0
        ? await supabaseAdmin
            .from('career_projects')
            .select('*')
            .in('id', activeProjectIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null }

      console.log('[career-records API] weekId:', weekId, 'projects found:', projects?.length, 'error:', projectsError)

      if (projectsError) {
        console.error('Error fetching career projects:', projectsError)
        return NextResponse.json({ error: projectsError.message }, { status: 500 })
      }

      // 2. 해당 사용자의 해당 주차 경력 기록 조회 (effectiveUserId가 있는 경우만)
      let records: any[] = []
      if (effectiveUserId) {
        const { data, error: recordsError } = await supabaseAdmin
          .from('career_records')
          .select('*')
          .eq('user_id', effectiveUserId)
          .eq('week_id', weekId)

        if (recordsError) {
          console.error('Error fetching career records:', recordsError)
          return NextResponse.json({ error: recordsError.message }, { status: 500 })
        }
        records = data || []
      }

      // 3. 프로젝트와 기록을 매핑
      const recordsByProjectId = new Map()
      records?.forEach(record => {
        if (record.project_id) {
          recordsByProjectId.set(record.project_id, record)
        }
      })

      // 4. 결과 조합 (프로젝트 + 사용자 기록 상태)
      const combinedData = projects?.map(project => {
        const userRecord = recordsByProjectId.get(project.id)
        return {
          // 프로젝트 정보 — week_id 는 junction 기반이라 요청 파라미터를 그대로 사용
          id: project.id,
          project_id: project.id,
          week_id: weekId,
          company_name: project.company_name,
          company_logo_url: project.company_logo_url,
          job_position: project.job_position,
          project_name: project.project_name,
          project_description: project.project_description,
          line_code: project.line_code,
          line_name: project.line_name,
          output_links: project.output_links,
          output_images: project.output_images || null,
          company_homepage_links: project.company_homepage_links || null,
          secondary_info_deadline: project.secondary_info_deadline || null,
          weeks: null,
          created_at: project.created_at,

          // 사용자 기록 상태
          record_id: userRecord?.id || null,
          user_id: effectiveUserId,
          enhancement_status: userRecord?.enhancement_status || 'not_applicable',
          grade: userRecord?.grade || null,
          grade_points: userRecord?.grade_points || null,
          career_code: userRecord?.career_code || null,

          // 감독자 정보 — 어드민이 career_projects 레벨에서 지정한 값을 우선,
          // 없으면 기존 career_records 의 값을 폴백 (구 데이터 호환)
          supervisor_name: project.supervisor_name || userRecord?.supervisor_name || null,
          supervisor_position: project.supervisor_position || userRecord?.supervisor_position || null,
          supervisor_department: project.supervisor_department || userRecord?.supervisor_department || null,
          supervisor_company: project.supervisor_company || userRecord?.supervisor_company || null,
          supervisor_profile_img: project.supervisor_profile_img || userRecord?.supervisor_profile_img || null,
        }
      }) || []

      return NextResponse.json({
        success: true,
        data: combinedData,
        count: combinedData.length,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    // 시즌별 또는 전체 조회 (userId 필수)
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'user_id is required for non-week queries' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('career_records')
      .select(`
        id,
        user_id,
        week_id,
        project_id,
        company_name,
        company_logo_url,
        job_position,
        project_name,
        project_description,
        grade,
        grade_points,
        supervisor_name,
        supervisor_position,
        supervisor_department,
        supervisor_company,
        supervisor_profile_img,
        enhancement_status,
        career_code,
        created_at,
        career_projects!career_records_project_id_fkey (
          id,
          line_code,
          line_name,
          output_links,
          output_images,
          supervisor_name,
          supervisor_position,
          supervisor_department,
          supervisor_company,
          supervisor_profile_img
        ),
        weeks!career_records_week_id_fkey (
          id,
          week_number,
          start_date,
          end_date,
          season_key,
          season_definitions (
            season_key,
            season_label,
            season_type,
            year
          )
        )
      `)
      .eq('user_id', effectiveUserId)
      .in('enhancement_status', ['pending', 'enhanced'])  // 참여한 경력만
      .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching career records:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 시즌별 필터링 (post-query)
    let filteredData = data || []
    if (seasonKey && filteredData.length > 0) {
      filteredData = filteredData.filter(record => {
        const weeks = record.weeks as { season_key?: string } | null
        return weeks?.season_key === seasonKey
      })
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Career records GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

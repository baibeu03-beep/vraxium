import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"

// GET: 사용자의 경력 기록 조회 (프로젝트 정보 포함)
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const weekId = searchParams.get('week_id')
    const seasonId = searchParams.get('season_id')

    // 주차별 프로젝트와 사용자 기록을 함께 조회
    if (weekId) {
      // 1. 해당 주차의 모든 프로젝트 조회
      const { data: projects, error: projectsError } = await supabaseAdmin
        .from('career_projects')
        .select('*')
        .eq('week_id', weekId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      console.log('[career-records API] weekId:', weekId, 'projects found:', projects?.length, 'error:', projectsError)

      if (projectsError) {
        console.error('Error fetching career projects:', projectsError)
        return NextResponse.json({ error: projectsError.message }, { status: 500 })
      }

      // 2. 해당 사용자의 해당 주차 경력 기록 조회 (userId가 있는 경우만)
      let records: any[] = []
      if (userId) {
        const { data, error: recordsError } = await supabaseAdmin
          .from('career_records')
          .select('*')
          .eq('user_id', userId)
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
          // 프로젝트 정보
          id: project.id,
          project_id: project.id,
          week_id: project.week_id,
          company_name: project.company_name,
          company_logo_url: project.company_logo_url,
          job_position: project.job_position,
          project_name: project.project_name,
          project_description: project.project_description,
          line_code: project.line_code,
          line_name: project.line_name,
          output_links: project.output_links,
          secondary_info_deadline: project.secondary_info_deadline || null,
          weeks: null,
          created_at: project.created_at,

          // 사용자 기록 상태
          record_id: userRecord?.id || null,
          user_id: userId,
          enhancement_status: userRecord?.enhancement_status || 'not_applicable',
          grade: userRecord?.grade || null,
          grade_points: userRecord?.grade_points || null,
          career_code: userRecord?.career_code || null,

          // 감독자 정보 (기록이 있는 경우)
          supervisor_name: userRecord?.supervisor_name || null,
          supervisor_position: userRecord?.supervisor_position || null,
          supervisor_department: userRecord?.supervisor_department || null,
          supervisor_company: userRecord?.supervisor_company || null,
          supervisor_profile_img: userRecord?.supervisor_profile_img || null,
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
    if (!userId) {
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
          output_links
        ),
        weeks!career_records_week_id_fkey (
          id,
          week_number,
          start_date,
          end_date,
          season_id,
          seasons (
            id,
            year,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .in('enhancement_status', ['pending', 'enhanced'])  // 참여한 경력만
      .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching career records:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 시즌별 필터링 (post-query)
    let filteredData = data || []
    if (seasonId && filteredData.length > 0) {
      filteredData = filteredData.filter(record => {
        const weeks = record.weeks as { season_id?: string } | null
        return weeks?.season_id === seasonId
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

import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const userId = (await params).id

    console.log('Fetching profile for userId:', userId)

    // user_profiles 조회
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() // single 대신 maybeSingle 사용

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json(
        { error: '사용자 정보를 가져오는데 실패했습니다.', details: profileError.message },
        { status: 500 }
      )
    }

    if (!profileData) {
      console.error('User profile not found for userId:', userId)
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.', details: 'User profile not found' },
        { status: 404 }
      )
    }

    console.log('Profile data found:', profileData.id, profileData.display_name)

    // user_growth_stats 조회 (reliability_rate 포함, 데이터가 없어도 에러 처리 안함)
    const { data: growthStatsData } = await supabase
      .from('user_growth_stats')
      .select('reliability_rate')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('Growth stats data:', growthStatsData)

    // user_cumulative_points 조회 (데이터가 없어도 에러 처리 안함)
    const { data: pointsData } = await supabase
      .from('user_cumulative_points')
      .select('total_stars, total_shields, total_lightnings')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('Points data:', pointsData)

    // user_cumulative_compliance_rates 조회 (데이터가 없어도 에러 처리 안함)
    const { data: complianceData } = await supabase
      .from('user_cumulative_compliance_rates')
      .select('practical_info_participated, practical_competency_participated, practical_experience_participated, practical_career_participated')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('Compliance data:', complianceData)

    // 모든 데이터를 합치기 (데이터가 없으면 null)
    const responseData = {
      ...profileData,
      reliability_rate: growthStatsData?.reliability_rate ? parseFloat(growthStatsData.reliability_rate) : null,
      total_stars: pointsData?.total_stars ?? null,
      total_shields: pointsData?.total_shields ?? null,
      total_lightnings: pointsData?.total_lightnings ?? null,
      practical_info_participated: complianceData?.practical_info_participated ?? 0,
      practical_competency_participated: complianceData?.practical_competency_participated ?? 0,
      practical_experience_participated: complianceData?.practical_experience_participated ?? 0,
      practical_career_participated: complianceData?.practical_career_participated ?? 0
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Error in user profile API:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
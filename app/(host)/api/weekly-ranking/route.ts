import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 시즌 이름 한글 매핑
const seasonNameKorean: { [key: string]: string } = {
  'spring': '봄',
  'summer': '여름',
  'fall': '가을',
  'winter': '겨울'
}

// 관계형 필드를 안전하게 추출하는 헬퍼 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSeason(seasons: any): { id: string; year: number; name: string } | null {
  if (!seasons) return null
  if (Array.isArray(seasons)) return seasons[0] || null
  return seasons
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRelated(data: any): { name: string } | null {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const weekId = searchParams.get('weekId')

    // 1. 사용 가능한 모든 주차 목록 조회 (break 시즌 제외)
    const { data: weeksData, error: weeksError } = await supabase
      .from('weeks')
      .select(`
        id,
        week_number,
        start_date,
        end_date,
        is_club_break,
        seasons (
          id,
          year,
          name
        )
      `)
      .lte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: false })

    if (weeksError) {
      console.error('Error fetching weeks:', weeksError)
      return NextResponse.json(
        { success: false, error: '주차 정보를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // break 시즌 필터링 및 유효한 시즌만
    const validWeeks = (weeksData || []).filter(week => {
      if (!week.seasons) return false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonData = week.seasons as any
      const seasonName = Array.isArray(seasonData) ? seasonData[0]?.name : seasonData?.name
      if (!seasonName || seasonName.includes('break')) return false
      return true
    })

    if (validWeeks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          rankings: [],
          week: null,
          availableWeeks: []
        }
      })
    }

    // 2. 선택된 주차 결정 (없으면 가장 최근 주차)
    let selectedWeekId = weekId
    if (!selectedWeekId) {
      selectedWeekId = validWeeks[0].id
    }

    const selectedWeek = validWeeks.find(w => w.id === selectedWeekId) || validWeeks[0]
    selectedWeekId = selectedWeek.id

    // 3. 해당 주차의 모든 포인트 조회 (star, lightning, shield)
    const { data: allPointsData, error: pointsError } = await supabase
      .from('points')
      .select('user_id, point_type, points')
      .eq('week_id', selectedWeekId)

    if (pointsError) {
      console.error('Error fetching points:', pointsError)
      return NextResponse.json(
        { success: false, error: '포인트 정보를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 4. 유저별 포인트 집계 (star, lightning, shield)
    const userPointsMap: { [userId: string]: { stars: number; lightnings: number; shields: number } } = {}

    for (const point of (allPointsData || [])) {
      if (!userPointsMap[point.user_id]) {
        userPointsMap[point.user_id] = { stars: 0, lightnings: 0, shields: 0 }
      }
      if (point.point_type === 'star') {
        userPointsMap[point.user_id].stars += point.points || 0
      } else if (point.point_type === 'lightning') {
        userPointsMap[point.user_id].lightnings += point.points || 0
      } else if (point.point_type === 'shield') {
        userPointsMap[point.user_id].shields += point.points || 0
      }
    }

    // star > 0인 유저만 필터링
    const userIdsWithStars = Object.entries(userPointsMap)
      .filter(([_, pts]) => pts.stars > 0)
      .map(([userId]) => userId)

    if (userIdsWithStars.length === 0) {
      const selectedSeason = getSeason(selectedWeek.seasons)
      return NextResponse.json({
        success: true,
        data: {
          rankings: [],
          week: {
            id: selectedWeek.id,
            week_number: selectedWeek.week_number,
            start_date: selectedWeek.start_date,
            end_date: selectedWeek.end_date,
            season: selectedSeason ? {
              id: selectedSeason.id,
              year: selectedSeason.year,
              name: selectedSeason.name,
              name_korean: seasonNameKorean[selectedSeason.name] || selectedSeason.name
            } : null
          },
          availableWeeks: validWeeks.map(week => {
            const season = getSeason(week.seasons)
            return {
              id: week.id,
              week_number: week.week_number,
              season_year: season?.year || 0,
              season_name: season?.name || '',
              label: `${season?.year || ''} ${seasonNameKorean[season?.name || ''] || season?.name || ''} ${week.week_number}주차`
            }
          })
        }
      })
    }

    // 5. 유저 프로필 조회
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('id, display_name, profile_photo_url, status')
      .in('id', userIdsWithStars)

    const profilesMap: { [userId: string]: { display_name: string; profile_photo_url: string | null; status: string } } = {}
    for (const profile of (profilesData || [])) {
      profilesMap[profile.id] = {
        display_name: profile.display_name || '이름 없음',
        profile_photo_url: profile.profile_photo_url,
        status: profile.status
      }
    }

    // 6. 유저 팀/파트 조회 (현재 활성인 것)
    const { data: teamPartsData } = await supabase
      .from('user_team_parts')
      .select(`
        user_id,
        teams (id, name),
        parts (id, name)
      `)
      .in('user_id', userIdsWithStars)
      .eq('is_current', true)

    const teamPartsMap: { [userId: string]: { team_name: string; part_name: string } } = {}
    for (const tp of (teamPartsData || [])) {
      teamPartsMap[tp.user_id] = {
        team_name: getRelated(tp.teams)?.name || '-',
        part_name: getRelated(tp.parts)?.name || '-'
      }
    }

    // 7. 누적 포인트 조회
    const { data: cumulativeData } = await supabase
      .from('user_cumulative_points')
      .select('user_id, total_stars, total_lightnings, total_shields')
      .in('user_id', userIdsWithStars)

    const cumulativeMap: { [userId: string]: { total_stars: number; total_lightnings: number; total_shields: number } } = {}
    for (const cp of (cumulativeData || [])) {
      cumulativeMap[cp.user_id] = {
        total_stars: cp.total_stars || 0,
        total_lightnings: cp.total_lightnings || 0,
        total_shields: cp.total_shields || 0
      }
    }

    // 8. 랭킹 데이터 구성 (stars 내림차순 정렬)
    const rankings = userIdsWithStars
      .filter(userId => profilesMap[userId] && profilesMap[userId].status !== 'suspended')
      .map(userId => ({
        user_id: userId,
        display_name: profilesMap[userId]?.display_name || '이름 없음',
        profile_photo_url: profilesMap[userId]?.profile_photo_url || null,
        team_name: teamPartsMap[userId]?.team_name || '-',
        part_name: teamPartsMap[userId]?.part_name || '-',
        stars: userPointsMap[userId]?.stars || 0,
        lightnings: userPointsMap[userId]?.lightnings || 0,
        shields: userPointsMap[userId]?.shields || 0,
        total_stars: cumulativeMap[userId]?.total_stars || 0,
        total_lightnings: cumulativeMap[userId]?.total_lightnings || 0,
        total_shields: cumulativeMap[userId]?.total_shields || 0,
      }))
      .sort((a, b) => b.stars - a.stars)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, 100)

    // 9. 사용 가능한 주차 목록 구성
    const availableWeeks = validWeeks.map(week => {
      const season = getSeason(week.seasons)
      return {
        id: week.id,
        week_number: week.week_number,
        season_year: season?.year || 0,
        season_name: season?.name || '',
        label: `${season?.year || ''} ${seasonNameKorean[season?.name || ''] || season?.name || ''} ${week.week_number}주차`
      }
    })

    // 10. 응답 구성
    const selectedSeason = getSeason(selectedWeek.seasons)
    return NextResponse.json({
      success: true,
      data: {
        rankings,
        week: {
          id: selectedWeek.id,
          week_number: selectedWeek.week_number,
          start_date: selectedWeek.start_date,
          end_date: selectedWeek.end_date,
          season: selectedSeason ? {
            id: selectedSeason.id,
            year: selectedSeason.year,
            name: selectedSeason.name,
            name_korean: seasonNameKorean[selectedSeason.name] || selectedSeason.name
          } : null
        },
        availableWeeks
      }
    })

  } catch (error) {
    console.error('Error in weekly-ranking API:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

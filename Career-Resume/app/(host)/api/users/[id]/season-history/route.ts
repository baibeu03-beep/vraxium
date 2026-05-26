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

    console.log('Fetching season history for userId:', userId)

    // user_season_histories와 seasons를 JOIN해서 조회
    const { data: historyData, error: historyError } = await supabase
      .from('user_season_histories')
      .select(`
        *,
        seasons (
          id,
          year,
          name,
          start_date
        )
      `)
      .eq('user_id', userId)

    console.log('Query result - data:', JSON.stringify(historyData, null, 2))
    console.log('Query result - error:', historyError)

    if (historyError) {
      console.error('Error fetching season history:', historyError)
      return NextResponse.json(
        { error: '시즌 히스토리를 가져오는데 실패했습니다.', details: historyError.message },
        { status: 500 }
      )
    }

    if (!historyData || historyData.length === 0) {
      console.log('No season history found for userId:', userId)
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // 시즌 이름에서 순서 매핑 (겨울 시작: winter=1, spring=2, summer=3, fall=4)
    const seasonOrderMap: { [key: string]: number } = {
      'winter': 1,
      'spring': 2,
      'summer': 3,
      'fall': 4
    }

    // seasons 데이터가 없는 항목 필터링 후 정렬 (년도 내림차순, 시즌 순서 내림차순)
    const validData = historyData.filter(item => item.seasons !== null)
    const sortedData = validData.sort((a, b) => {
      const yearDiff = b.seasons.year - a.seasons.year
      if (yearDiff !== 0) return yearDiff
      return (seasonOrderMap[b.seasons.name] || 0) - (seasonOrderMap[a.seasons.name] || 0)
    })

    console.log('Season history data found:', sortedData.length, 'records')

    return NextResponse.json({
      success: true,
      data: sortedData
    })

  } catch (error) {
    console.error('Error in season history API:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
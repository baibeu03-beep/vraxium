import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 3600;

// 키워드 데이터 (5개 군락, 총 100개)
const KEYWORDS_DATA = [
  // 군락 1: 도구·기술·시스템 활용 역량 (36개)
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "노션 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "노션 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "인스타 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "인스타 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "유튜브 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "유튜브 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "AI 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "AI 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "블로그 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "블로그 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "미드저니 일반" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "미드저니 숙련" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "깃업 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "깃업 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "노코드 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "노코드 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "옵시디언 일반" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "옵시디언 숙련" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "파워포인트" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "엑셀 유망주" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "엑셀 마스터" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "카카오 생태계" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "네이버 생태계" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "구글 생태계" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "퍼블리싱" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "UI / UX 기획" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "웹 develop" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "앱 develop" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "서버 관리" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "데이터 처리" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "데이터 분석" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "데이터 해석" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "AI 프롬프트" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "업무 자동화" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "도구 사용력" },
  { cluster_number: 1, cluster_name: "도구·기술·시스템 활용 역량", cluster_color: "#3B82F6", keyword: "기술 습득력" },

  // 군락 2: 콘텐츠·표현·메시지 생산 역량 (16개)
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "콘텐츠" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "카드 콘텐츠" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "텍스트 콘텐츠" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "스토리텔링" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "동영상 숏폼" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "동영상 롱폼" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "릴스 특화" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "쇼츠 특화" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "캐치프레이즈" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "슬로건" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "표현력" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "언어 능력" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "설득력" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "상상력" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "유머와 재미" },
  { cluster_number: 2, cluster_name: "콘텐츠·표현·메시지 생산 역량", cluster_color: "#22C55E", keyword: "창의성" },

  // 군락 3: 마케팅·확산·영향력 설계 (10개)
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "퍼포먼스" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "브랜딩 마케팅" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "바이럴 마케팅" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "커뮤니티" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "연관 검색어" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "구글 트렌드" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "정보력" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "사회성" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "소통력" },
  { cluster_number: 3, cluster_name: "마케팅·확산·영향력 설계", cluster_color: "#EAB308", keyword: "공감력" },

  // 군락 4: 사고·분석·구조화 역량 (16개)
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "인지력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "관찰력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "이해력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "논리력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "상황 추론력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "문제 정의력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "연구력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "업무 분석력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "업무 기획력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "계획력" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "구조화" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "도식화" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "범위화" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "항목화" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "자료화" },
  { cluster_number: 4, cluster_name: "사고·분석·구조화 역량", cluster_color: "#F97316", keyword: "변칙성" },

  // 군락 5: 태도·실행·지속성 기반 역량 (22개)
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "지속성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "기민성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "신뢰성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "성장성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "유연성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "안정성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "위기 대응성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "학습력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "지도력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "소속감" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "적극성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "자신감" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "헌신성" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "행동력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "회복력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "몰입력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "잠재력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "업무 진행력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "업무 관리력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "수용력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "지구력" },
  { cluster_number: 5, cluster_name: "태도·실행·지속성 기반 역량", cluster_color: "#EF4444", keyword: "강인한 체력" },
];

// GET: 키워드 목록 조회
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // DB에서 키워드 조회
    const { data, error } = await supabaseAdmin
      .from("reputation_keywords")
      .select("*")
      .order("cluster_number", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("키워드 조회 오류:", error);
      // 테이블이 없거나 오류 시 하드코딩된 데이터 반환
      return NextResponse.json({
        success: true,
        data: KEYWORDS_DATA.map((k, i) => ({ id: i + 1, ...k })),
        source: "hardcoded",
      });
    }

    // DB에 데이터가 없으면 하드코딩된 데이터 반환
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: KEYWORDS_DATA.map((k, i) => ({ id: i + 1, ...k })),
        source: "hardcoded",
      });
    }

    return NextResponse.json({
      success: true,
      data,
      source: "database",
    });
  } catch (error) {
    console.error("키워드 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 키워드 DB에 시드 (관리자용)
export async function POST() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // 기존 데이터 삭제
    await supabaseAdmin.from("reputation_keywords").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 새 데이터 삽입
    const insertData = KEYWORDS_DATA.map((k) => ({
      id: crypto.randomUUID(),
      ...k,
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("reputation_keywords")
      .insert(insertData);

    if (insertError) {
      console.error("키워드 시드 오류:", insertError);
      return NextResponse.json(
        { error: "키워드 시드에 실패했습니다.", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${insertData.length}개의 키워드가 성공적으로 저장되었습니다.`,
    });
  } catch (error) {
    console.error("키워드 시드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

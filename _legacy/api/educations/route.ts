import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 한글 → 영문 변환 매핑
const eduLevelToDb: { [key: string]: string } = {
  '대학원': 'graduate',
  '대학교': 'university',
  '전문대학': 'college',
  '고등학교': 'high',
  '중학교': 'middle',
  '초등학교': 'elementary',
  '기타': 'other',
};

const statusToDb: { [key: string]: string } = {
  '재학': 'enrolled',
  '졸업': 'graduated',
  '졸예': 'expected',
  '졸업예정': 'expected',
  '휴학': 'on_leave',
  '중퇴': 'dropped',
  '자퇴': 'dropped',
};

const categoryToDb: { [key: string]: string } = {
  '인문': 'humanities',
  '사회': 'social_science',
  '자연': 'natural_science',
  '공학': 'engineering',
  '경영': 'business',
  '상경': 'business',
  '예체능': 'arts_physical',
  '기타': 'other',
};

const gradeMaxToDb: { [key: string]: string } = {
  '4.5': '4.5',
  '4.3': '4.3',
  '100%': '100%',
  '9등급': '9grade',
  '기타': 'other',
};

// 영문 → 한글 변환 매핑
const eduLevelFromDb: { [key: string]: string } = {
  'graduate': '대학원',
  'university': '대학교',
  'college': '전문대학',
  'high': '고등학교',
  'middle': '중학교',
  'elementary': '초등학교',
  'other': '기타',
};

const statusFromDb: { [key: string]: string } = {
  'enrolled': '재학',
  'graduated': '졸업',
  'expected': '졸예',
  'on_leave': '휴학',
  'dropped': '중퇴',
};

const categoryFromDb: { [key: string]: string } = {
  'humanities': '인문',
  'social_science': '사회',
  'natural_science': '자연',
  'engineering': '공학',
  'business': '상경',
  'arts_physical': '예체능',
  'other': '기타',
};

const gradeMaxFromDb: { [key: string]: string } = {
  '4.5': '4.5',
  '4.3': '4.3',
  '100%': '100%',
  '9grade': '9등급',
  'other': '기타',
};

// GET: 학력 조회
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    let userId: string;

    if (targetUserId) {
      // targetUserId가 있으면 해당 유저의 학력 조회 (로그인 불필요)
      userId = targetUserId;
    } else {
      // 본인 학력 조회 시에는 로그인 필요
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }

      // user_profiles에서 사용자 ID 조회
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: "프로필을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      userId = profile.id;
    }

    // user_educations에서 학력 조회 (sort_order 기준 정렬)
    const { data: educations, error: eduError } = await supabaseAdmin
      .from("user_educations")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (eduError) {
      console.error("학력 조회 오류:", eduError);
      return NextResponse.json(
        { error: "학력 정보를 불러오는데 실패했습니다." },
        { status: 500 }
      );
    }

    // DB 데이터를 프론트엔드 형식으로 변환 (영문 → 한글)
    const formattedEducations = (educations || []).map((edu) => {
      // admission_year, graduation_year에서 년/월 추출
      const admissionParts = edu.admission_year?.split(".") || [];
      const graduationParts = edu.graduation_year?.split(".") || [];

      // period 문자열 생성 (상태에 따라 다르게)
      // - 재학/졸예/휴학: 종료시기는 ~ing (종료시기 기재 안됨)
      // - 졸업/중퇴: 종료시기는 반드시 년/월 기재
      const startStr = edu.admission_year || "";
      const endStr = edu.graduation_year || "";
      const isOngoing = ['enrolled', 'expected', 'on_leave'].includes(edu.status);

      let period = "";
      if (startStr) {
        if (isOngoing) {
          period = `${startStr} - ~ing`;
        } else if (endStr) {
          period = `${startStr} ~ ${endStr}`;
        } else {
          period = `${startStr}`;
        }
      }

      return {
        id: edu.id,
        eduLevel: eduLevelFromDb[edu.education_level] || edu.education_level || "",
        school: edu.school_name || "",
        status: statusFromDb[edu.status] || edu.status || "",
        category: edu.major_category ? (categoryFromDb[edu.major_category] || edu.major_category) : "-",
        major1: edu.major_name_1 || "-",
        major2: edu.major_name_2 || "-",
        major3: edu.major_name_3 || "-",
        period: period,
        startYear: admissionParts[0] || "",
        startMonth: admissionParts[1] || "",
        endYear: graduationParts[0] || "",
        endMonth: graduationParts[1] || "",
        gradeMax: edu.grade_max_type ? (gradeMaxFromDb[edu.grade_max_type] || edu.grade_max_type) : "-",
        gradeValue: edu.grade_value || "-",
        description: edu.note || "",
        isFinal: edu.sort_order === 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedEducations,
    });
  } catch (error) {
    console.error("학력 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 학력 저장
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { educations } = body;

    if (!Array.isArray(educations)) {
      return NextResponse.json(
        { error: "학력 데이터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 졸업 상태일 때 졸업년도 필수 검증
    for (let i = 0; i < educations.length; i++) {
      const edu = educations[i];
      const status = edu.status;
      // 졸업 또는 중퇴/자퇴 상태일 때 졸업년도 필수
      if ((status === '졸업' || status === '중퇴' || status === '자퇴') && !edu.endYear) {
        return NextResponse.json(
          { error: `${i + 1}번째 학력: '${status}' 상태에서는 종료년도를 입력해야 합니다.` },
          { status: 400 }
        );
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // user_profiles에서 사용자 ID 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기존 학력 데이터 삭제
    const { error: deleteError } = await supabaseAdmin
      .from("user_educations")
      .delete()
      .eq("user_id", profile.id);

    if (deleteError) {
      console.error("기존 학력 삭제 오류:", deleteError);
      return NextResponse.json(
        { error: `학력 저장에 실패했습니다: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // 새 학력 데이터 삽입
    if (educations.length > 0) {
      const eduRecords = educations.map((edu: {
        eduLevel?: string;
        school?: string;
        status?: string;
        category?: string;
        major1?: string;
        major2?: string;
        major3?: string;
        startYear?: string;
        startMonth?: string;
        endYear?: string;
        endMonth?: string;
        gradeMax?: string;
        gradeValue?: string;
        description?: string;
        isFinal?: boolean;
      }, index: number) => {
        // admission_year, graduation_year 형식: "2020.03"
        const admissionYear = edu.startYear && edu.startMonth
          ? `${edu.startYear}.${edu.startMonth}`
          : edu.startYear || null;
        const graduationYear = edu.endYear && edu.endMonth
          ? `${edu.endYear}.${edu.endMonth}`
          : edu.endYear || null;

        // 한글 → 영문 변환 ('-' 값은 null 처리)
        const rawEduLevel = edu.eduLevel === '-' ? '' : edu.eduLevel || '';
        const rawStatus = edu.status === '-' ? '' : edu.status || '';
        const rawCategory = edu.category === '-' ? '' : edu.category || '';
        const educationLevel = eduLevelToDb[rawEduLevel] || rawEduLevel || null;
        const status = statusToDb[rawStatus] || rawStatus || null;
        const majorCategory = categoryToDb[rawCategory] || rawCategory || null;

        return {
          user_id: profile.id,
          education_level: educationLevel,
          school_name: edu.school || null,
          status: status,
          major_category: majorCategory,
          major_name_1: edu.major1 || null,
          major_name_2: edu.major2 || null,
          major_name_3: edu.major3 || null,
          admission_year: admissionYear,
          graduation_year: graduationYear,
          grade_max_type: edu.gradeMax === '-' ? null : (gradeMaxToDb[edu.gradeMax || ''] || edu.gradeMax || null),
          grade_value: edu.gradeValue === '-' ? null : (edu.gradeValue || null),
          note: edu.description || null,
          sort_order: edu.isFinal ? 0 : index + 1,
        };
      });

      const { error: insertError } = await supabaseAdmin
        .from("user_educations")
        .insert(eduRecords);

      if (insertError) {
        console.error("학력 저장 오류:", insertError);
        return NextResponse.json(
          { error: `학력 저장에 실패했습니다: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "학력이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("학력 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

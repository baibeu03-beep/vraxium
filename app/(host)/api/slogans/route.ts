import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
import { maskDisplayName } from "@/lib/dataMasking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 슬로건 조회 (userId 파라미터로 다른 유저 조회 가능)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    let profile;

    if (targetUserId) {
      // 특정 유저의 슬로건 조회 (공개 접근 가능)
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("id, eng_name")
        .eq("id", targetUserId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: "프로필을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      profile = data;
    } else {
      // 현재 로그인 유저의 슬로건 조회 (로그인 필요)
      const session = await getServerSession(authOptions);

      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }

      // 1차: email
      const { data } = await supabaseAdmin
        .from("user_profiles")
        .select("id, eng_name")
        .eq("email", session.user.email)
        .maybeSingle();

      if (data) {
        profile = data;
      }

      // 2차: auth_email
      if (!profile) {
        const { data: profileByAuth } = await supabaseAdmin
          .from("user_profiles")
          .select("id, eng_name")
          .eq("auth_email", session.user.email)
          .maybeSingle();

        if (profileByAuth) {
          profile = profileByAuth;
        }
      }

      // 3차: session UUID
      if (!profile && session.user?.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(session.user.id)) {
          const { data: profileById } = await supabaseAdmin
            .from("user_profiles")
            .select("id, eng_name")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profileById) {
            profile = profileById;
          }
        }
      }

      if (!profile) {
        return NextResponse.json(
          { error: "프로필을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
    }

    // user_introductions에서 슬로건 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select("slogan_1, slogan_2, slogan_3, slogan_1_tag, slogan_2_tag, slogan_3_tag, slogan_1_rating, slogan_2_rating, slogan_3_rating")
      .eq("user_id", profile.id)
      .maybeSingle();

    // engName 마스킹: 어드민/로그인 → raw, 비로그인 → 알파벳 마스킹
    const session = await getServerSession(authOptions);
    const sessionIsAdmin = !!session?.user?.isAdmin || isAdminEmail(session?.user?.email);
    const sessionIsLoggedIn = !!session;
    const rawEngName = profile.eng_name || null;
    const engNameDisplay = !rawEngName
      ? null
      : sessionIsAdmin || sessionIsLoggedIn
        ? rawEngName
        : maskDisplayName(rawEngName);

    return NextResponse.json({
      success: true,
      data: {
        slogan1: {
          content: introduction?.slogan_1 || null,
          option: introduction?.slogan_1_tag || null,
          rating: introduction?.slogan_1_rating ?? 0,
        },
        slogan2: {
          content: introduction?.slogan_2 || null,
          option: introduction?.slogan_2_tag || null,
          rating: introduction?.slogan_2_rating ?? 0,
        },
        slogan3: {
          content: introduction?.slogan_3 || null,
          option: introduction?.slogan_3_tag || null,
          rating: introduction?.slogan_3_rating ?? 0,
        },
        engName: engNameDisplay,
      },
    });
  } catch (error) {
    console.error("슬로건 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 슬로건 저장
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { slogan1, slogan2, slogan3 } = body;

    // 글자수 검증 (최대 86자)
    const MAX_SLOGAN_LENGTH = 86;
    if (slogan1?.content && slogan1.content.length > MAX_SLOGAN_LENGTH) {
      return NextResponse.json(
        { error: `슬로건 1이 ${MAX_SLOGAN_LENGTH}자를 초과했습니다. (현재 ${slogan1.content.length}자)` },
        { status: 400 }
      );
    }
    if (slogan2?.content && slogan2.content.length > MAX_SLOGAN_LENGTH) {
      return NextResponse.json(
        { error: `슬로건 2가 ${MAX_SLOGAN_LENGTH}자를 초과했습니다. (현재 ${slogan2.content.length}자)` },
        { status: 400 }
      );
    }
    if (slogan3?.content && slogan3.content.length > MAX_SLOGAN_LENGTH) {
      return NextResponse.json(
        { error: `슬로건 3이 ${MAX_SLOGAN_LENGTH}자를 초과했습니다. (현재 ${slogan3.content.length}자)` },
        { status: 400 }
      );
    }

    // 어드민이 다른 유저를 대상으로 편집하는 경우
    const targetUserId = extractTargetUserId(request);
    let profile: { id: string } | null = null;

    if (targetUserId && isAdminEmail(session.user.email)) {
      const { data: targetProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("id", targetUserId)
        .maybeSingle();
      profile = targetProfile;
    } else {
      // user_profiles에서 사용자 ID 조회 (1차: email, 2차: auth_email, 3차: session UUID)
      const { data: profileByEmail } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle();

      if (profileByEmail) {
        profile = profileByEmail;
      }

      if (!profile) {
        const { data: profileByAuth } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("auth_email", session.user.email)
          .maybeSingle();

        if (profileByAuth) {
          profile = profileByAuth;
        }
      }

      if (!profile && session.user?.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(session.user.id)) {
          const { data: profileById } = await supabaseAdmin
            .from("user_profiles")
            .select("id")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profileById) {
            profile = profileById;
          }
        }
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    // rating 범위 검증 (0~10 자연수)
    const clampRating = (val: unknown): number => {
      const n = typeof val === 'number' ? val : 0;
      return Math.max(0, Math.min(10, Math.round(n)));
    };

    const sloganData = {
      slogan_1: slogan1?.content || null,
      slogan_1_tag: slogan1?.option || null,
      slogan_1_rating: clampRating(slogan1?.rating),
      slogan_2: slogan2?.content || null,
      slogan_2_tag: slogan2?.option || null,
      slogan_2_rating: clampRating(slogan2?.rating),
      slogan_3: slogan3?.content || null,
      slogan_3_tag: slogan3?.option || null,
      slogan_3_rating: clampRating(slogan3?.rating),
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(sloganData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("슬로건 업데이트 오류:", updateError);
        return NextResponse.json(
          { error: "슬로건 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    } else {
      // 새로 생성
      const { error: insertError } = await supabaseAdmin
        .from("user_introductions")
        .insert({
          id: crypto.randomUUID(),
          user_id: profile.id,
          ...sloganData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("슬로건 생성 오류:", insertError);
        return NextResponse.json(
          { error: "슬로건 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "슬로건이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("슬로건 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

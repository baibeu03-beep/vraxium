import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { isAdminEmail } from "@/lib/admin";
import { resolveWriteUserId } from "@/lib/api-auth";
import { hasOpenTopCardEditWindow } from "@/lib/topCardsEditWindow";
import { enforceQaMode } from "@/lib/qaModeGate";
import {
  canEditCluster3TopCard,
  CLUSTER3_QA_OWNER_EDIT_ENABLED,
} from "@/lib/cluster3-top-card-edit-permission";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CARD_TYPES = ["output", "detail"] as const;
type CardType = (typeof CARD_TYPES)[number];

const MAX_INDEX: Record<CardType, number> = { output: 5, detail: 10 };

const isCardType = (v: unknown): v is CardType =>
  typeof v === "string" && (CARD_TYPES as readonly string[]).includes(v);

const sanitizeStringArray = (raw: unknown, fixedLen?: number): string[] => {
  const arr = Array.isArray(raw) ? raw.map((v) => (typeof v === "string" ? v : "")) : [];
  if (fixedLen != null) {
    const out = arr.slice(0, fixedLen);
    while (out.length < fixedLen) out.push("");
    return out;
  }
  return arr;
};

const sanitizeNullableUrlArray = (raw: unknown, fixedLen: number): (string | null)[] => {
  const arr = Array.isArray(raw) ? raw : [];
  const out = arr.slice(0, fixedLen).map((v) => (typeof v === "string" && v.length > 0 ? v : null));
  while (out.length < fixedLen) out.push(null);
  return out;
};

const toIntOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

type Row = {
  card_type: string;
  card_index: number;
  main_title: string | null;
  sub_title: string | null;
  role_description: string | null;
  report: string | null;
  insight: string | null;
  platform: string | null;
  contribution: number | null;
  period_start_year: number | null;
  period_start_month: number | null;
  period_start_day: number | null;
  period_end_year: number | null;
  period_end_month: number | null;
  period_end_day: number | null;
  roles: string[] | null;
  tools: string[] | null;
  main_image_url: string | null;
  sub_image_urls: (string | null)[] | null;
  main_image_caption: string | null;
  sub_image_captions: string[] | null;
  metrics: string[] | null;
  links: string[] | null;
};

// GET: 대상 유저 + 카드 타입의 모든 카드. cardType 미지정 시 둘 다.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");
    const cardTypeParam = searchParams.get("cardType");

    const qaBlock = await enforceQaMode(request, { targetUserId: queryUserId });
    if (qaBlock) return qaBlock;

    let targetUserId: string;
    if (queryUserId) {
      targetUserId = queryUserId;
    } else {
      const { profile, error } = await getUserProfile();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      targetUserId = profile.id;
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    let q = supabaseAdmin
      .from("portfolio_top_cards")
      .select(
        "card_type, card_index, main_title, sub_title, role_description, report, insight, platform, contribution, period_start_year, period_start_month, period_start_day, period_end_year, period_end_month, period_end_day, roles, tools, main_image_url, sub_image_urls, main_image_caption, sub_image_captions, metrics, links"
      )
      .eq("user_id", targetUserId);

    if (cardTypeParam && isCardType(cardTypeParam)) {
      q = q.eq("card_type", cardTypeParam);
    }

    const { data, error: dbError } = await q.order("card_type", { ascending: true }).order("card_index", { ascending: true });

    if (dbError) {
      console.error("탑 카드 조회 오류:", dbError);
      return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
    }

    const cards = ((data || []) as Row[]).map((row) => ({
      cardType: row.card_type,
      cardIndex: row.card_index,
      mainTitle: row.main_title || "",
      subTitle: row.sub_title || "",
      roleDescription: row.role_description || "",
      report: row.report || "",
      insight: row.insight || "",
      platform: row.platform || "",
      contribution: row.contribution ?? 0,
      periodStartYear: row.period_start_year,
      periodStartMonth: row.period_start_month,
      periodStartDay: row.period_start_day,
      periodEndYear: row.period_end_year,
      periodEndMonth: row.period_end_month,
      periodEndDay: row.period_end_day,
      roles: sanitizeStringArray(row.roles),
      tools: sanitizeStringArray(row.tools),
      mainImage: row.main_image_url || null,
      subImages: sanitizeNullableUrlArray(row.sub_image_urls, 2),
      mainImageCaption: row.main_image_caption || "",
      subImageCaptions: sanitizeStringArray(row.sub_image_captions, 2),
      metrics: sanitizeStringArray(row.metrics, 6),
      links: sanitizeStringArray(row.links, 3),
    }));

    return NextResponse.json({ success: true, cards });
  } catch (error) {
    console.error("탑 카드 GET API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// PUT: 단일 카드 upsert
export async function PUT(request: Request) {
  try {
    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 저장 대상을 그 유저로 고정(세션 없이).
    // 데모 off/미전달 → 기존 세션 게이트. 미등재 user_id → 403.
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.message }, { status: actor.status });
    }
    const isDemo = actor.isDemo;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const cardType = body.cardType;
    const cardIndex = Number(body.cardIndex);

    if (!isCardType(cardType)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CARD_TYPE",
          message: "Invalid card type.",
        },
        { status: 400 },
      );
    }
    if (!Number.isInteger(cardIndex) || cardIndex < 1 || cardIndex > MAX_INDEX[cardType]) {
      return NextResponse.json({ error: "잘못된 카드 인덱스입니다." }, { status: 400 });
    }

    // === 작성 기간 권한 체크 (SoT: lib/cluster3-top-card-edit-permission) ===
    // 클라이언트 버튼 활성화와 반드시 동일한 판정을 쓰도록 공통 함수를 통과시킨다.
    //   - 어드민(마더)은 작성 기간과 무관하게 항상 허용(타인 카드 편집 포함).
    //   - QA 기간(CLUSTER3_QA_OWNER_EDIT_ENABLED)에는 로그인/데모 "본인 소유자"가
    //     작성 기간 허가 없이도 허용된다.
    //   - QA 종료 후엔 평시 정책(작성 기간 허가)만으로 복귀.
    //   - cluster3.output_cards / cluster3.detail_cards 는 admin repo 의
    //     작성 기간 관리에서 별개 row 로 운영되므로 cardType 별로 독립 체크.
    //   - 프론트의 ?unlockCluster3* QA 쿼리는 UI 테스트용일 뿐이며 서버 권한 무관.
    // isOwner: resolveWriteUserId 특성상 비-어드민 actor 는 항상 본인(세션 self /
    //   유효 데모 테스트유저) 행에만 쓴다 → 비-어드민 = 소유자. 어드민 타인 편집은
    //   isAdmin=true 로 별도 통과(actor.userId=대상 유저). 데모 모드는 admin 미부여.
    const session = await getServerSession(authOptions);
    const isAdmin =
      !isDemo && (!!session?.user?.isAdmin || isAdminEmail(session?.user?.email));
    const isOwner = !isAdmin;
    // QA 오버라이드/어드민이 이미 허용하는 경우 불필요한 edit-window 조회를 생략한다.
    const needsEditWindow =
      !isAdmin && !(CLUSTER3_QA_OWNER_EDIT_ENABLED && isOwner);
    const hasEditWindow = needsEditWindow
      ? await hasOpenTopCardEditWindow({ userId: actor.userId, cardType })
      : false;
    const canEdit = canEditCluster3TopCard({
      isAdmin,
      isAuthenticated: true, // resolveWriteUserId.ok = 세션 또는 유효 데모 테스트유저
      isOwner,
      hasEditWindow,
    });
    if (!canEdit) {
      return NextResponse.json(
        {
          success: false,
          error: "EDIT_WINDOW_CLOSED",
          message: "관리자 허가를 받은 기간에만 작성할 수 있습니다.",
        },
        { status: 403 },
      );
    }

    const row = {
      user_id: actor.userId,
      card_type: cardType,
      card_index: cardIndex,
      main_title: typeof body.mainTitle === "string" ? body.mainTitle : null,
      sub_title: typeof body.subTitle === "string" ? body.subTitle : null,
      role_description: typeof body.roleDescription === "string" ? body.roleDescription : null,
      report: typeof body.report === "string" ? body.report : null,
      insight: typeof body.insight === "string" ? body.insight : null,
      platform: typeof body.platform === "string" ? body.platform : null,
      contribution: toIntOrNull(body.contribution),
      period_start_year: toIntOrNull(body.periodStartYear),
      period_start_month: toIntOrNull(body.periodStartMonth),
      period_start_day: toIntOrNull(body.periodStartDay),
      period_end_year: toIntOrNull(body.periodEndYear),
      period_end_month: toIntOrNull(body.periodEndMonth),
      period_end_day: toIntOrNull(body.periodEndDay),
      roles: sanitizeStringArray(body.roles),
      tools: sanitizeStringArray(body.tools),
      main_image_url: typeof body.mainImage === "string" && body.mainImage.length > 0 ? body.mainImage : null,
      sub_image_urls: sanitizeNullableUrlArray(body.subImages, 2),
      main_image_caption: typeof body.mainImageCaption === "string" ? body.mainImageCaption : null,
      sub_image_captions: sanitizeStringArray(body.subImageCaptions, 2),
      metrics: sanitizeStringArray(body.metrics, 6),
      links: sanitizeStringArray(body.links, 3),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("portfolio_top_cards")
      .upsert(row, { onConflict: "user_id,card_type,card_index" });

    if (upsertError) {
      console.error("탑 카드 저장 오류:", upsertError);
      return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "저장되었습니다." });
  } catch (error) {
    console.error("탑 카드 PUT API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

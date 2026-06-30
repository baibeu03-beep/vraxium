import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { resolveWriteUserId } from "@/lib/api-auth";
import { enforceQaMode } from "@/lib/qaModeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CARD_INDEX = 16;
const IMAGE_SLOTS = 5;

type ChannelCardRow = {
  card_index: number;
  channel_name: string | null;
  platform: string | null;
  management: string | null;
  start_year: string | null;
  start_month: string | null;
  start_day: string | null;
  rating: string | null;
  status: string | null;
  link: string | null;
  image_urls: (string | null)[] | null;
  insight: string | null;
  experience: string | null;
  metrics: string | null;
};

const sanitizeImages = (raw: unknown): (string | null)[] => {
  const arr = Array.isArray(raw) ? raw : [];
  const normalized = arr.slice(0, IMAGE_SLOTS).map((v) =>
    typeof v === "string" && v.length > 0 ? v : null
  );
  while (normalized.length < IMAGE_SLOTS) normalized.push(null);
  return normalized;
};

// firstCard sample marker. constants/dummyData/cluster3-section-default.ts 의
// CLUSTER3_CHANNEL_DEFAULTS.firstCard 와 동일 값을 hardcoded — 서버 사이드
// guard 가 클라이언트 코드 dependency 없이 독립적으로 동작해야 하므로 의도적 중복.
// 어떤 클라이언트가 보내든 (front, admin, 외부) 이 marker 가 매칭되면 거절.
const FIRST_CARD_SAMPLE_MARKER = {
  channelName: "@ Discovery_Korea",
  platform: "유튜브",
  link: "https://www.youtube.com/@Discovery_Korea",
} as const;

const isFirstCardSamplePayload = (body: {
  channelName?: unknown;
  platform?: unknown;
  link?: unknown;
}): boolean => {
  return (
    body.channelName === FIRST_CARD_SAMPLE_MARKER.channelName &&
    body.platform === FIRST_CARD_SAMPLE_MARKER.platform &&
    body.link === FIRST_CARD_SAMPLE_MARKER.link
  );
};

// GET: 대상 유저의 채널 카드 16개 (저장된 카드만 반환, 나머지는 클라가 default로 채움)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");

    const qaBlock = await enforceQaMode(request, { targetUserId: queryUserId });
    if (qaBlock) return qaBlock;

    let targetUserId: string;

    if (queryUserId) {
      // 공개 조회: 다른 크루 페이지 방문 시 (로그인 불필요)
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

    const { data, error: dbError } = await supabaseAdmin
      .from("portfolio_channel_cards")
      .select(
        "card_index, channel_name, platform, management, start_year, start_month, start_day, rating, status, link, image_urls, insight, experience, metrics"
      )
      .eq("user_id", targetUserId)
      .order("card_index", { ascending: true });

    if (dbError) {
      console.error("채널 카드 조회 오류:", dbError);
      return NextResponse.json(
        { error: "채널 카드 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const cards = ((data || []) as ChannelCardRow[]).map((row) => ({
      cardIndex: row.card_index,
      channelName: row.channel_name || "",
      platform: row.platform || "",
      management: row.management || "",
      startYear: row.start_year || "",
      startMonth: row.start_month || "",
      startDay: row.start_day || "",
      rating: row.rating || "",
      status: row.status || "",
      link: row.link || "",
      images: sanitizeImages(row.image_urls),
      insight: row.insight || "",
      experience: row.experience || "",
      metrics: row.metrics || "",
    }));

    return NextResponse.json({ success: true, cards });
  } catch (error) {
    console.error("채널 카드 GET API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 단일 카드 upsert (전체 필드)
export async function PUT(request: Request) {
  try {
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.message }, { status: actor.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const cardIndex = Number(body.cardIndex);

    if (!Number.isInteger(cardIndex) || cardIndex < 1 || cardIndex > MAX_CARD_INDEX) {
      return NextResponse.json(
        { error: "잘못된 카드 인덱스입니다." },
        { status: 400 }
      );
    }

    // 회귀 진단용 — 어떤 페이로드가 PUT 으로 들어오는지 추적.
    // 2026-05-18 사고 (canonical row 가 sample 로 덮어써짐) 재발 시
    // 원인 클라이언트/타임라인 식별. 본 endpoint 는 single-card upsert 이므로
    // count 는 항상 1 — 형태 일관성을 위해 명시.
    const incomingChannelName =
      typeof body.channelName === "string" ? body.channelName : null;
    console.log("[portfolio-channel-cards PUT]", {
      userId: actor.userId,
      count: 1,
      first: { card_index: cardIndex, channel_name: incomingChannelName },
      ua: request.headers.get("user-agent")?.slice(0, 120) ?? null,
    });

    // 방어: firstCard sample 페이로드는 production DB 에 절대 upsert 하지 않는다.
    if (isFirstCardSamplePayload(body)) {
      console.warn("[portfolio-channel-cards PUT] firstCard sample 차단", {
        userId: actor.userId,
        cardIndex,
      });
      return NextResponse.json(
        { error: "샘플 데이터는 저장할 수 없습니다. 실제 채널 정보를 입력해주세요." },
        { status: 400 },
      );
    }

    const row = {
      user_id: actor.userId,
      card_index: cardIndex,
      channel_name: typeof body.channelName === "string" ? body.channelName : null,
      platform: typeof body.platform === "string" ? body.platform : null,
      management: typeof body.management === "string" ? body.management : null,
      start_year: typeof body.startYear === "string" ? body.startYear : null,
      start_month: typeof body.startMonth === "string" ? body.startMonth : null,
      start_day: typeof body.startDay === "string" ? body.startDay : null,
      rating: typeof body.rating === "string" ? body.rating : null,
      status: typeof body.status === "string" ? body.status : null,
      link: typeof body.link === "string" ? body.link : null,
      image_urls: sanitizeImages(body.images),
      insight: typeof body.insight === "string" ? body.insight : null,
      experience: typeof body.experience === "string" ? body.experience : null,
      metrics: typeof body.metrics === "string" ? body.metrics : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("portfolio_channel_cards")
      .upsert(row, { onConflict: "user_id,card_index" });

    if (upsertError) {
      console.error("채널 카드 저장 오류:", upsertError);
      return NextResponse.json(
        { error: "채널 카드 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "저장되었습니다.",
    });
  } catch (error) {
    console.error("채널 카드 PUT API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

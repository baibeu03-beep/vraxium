import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { readScopeMode } from "@/lib/userScopeShared";
import { isTestUserId } from "@/lib/weekResultState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────
// /api/cluster4/week-confirmations
//
// /cluster-4-card 상단 "주차 확인(확인 완료)" 버튼의 서버 단일 출처.
// 종전엔 버튼이 로컬 state 만 바꿨고(새로고침하면 사라짐) 서버 검증이 존재하지 않았다.
//
// 권한 정책 (요구사항 표 그대로 — UI disabled 와 무관하게 서버가 최종 판정):
//   | 사용자   | 본인 카드 | 타인 카드 |
//   | 비로그인 |   401    |   401    |
//   | 로그인   |   성공   |   403    |
//
//   · 클라이언트가 보낸 user_id 는 "누구의 카드에서 눌렀는가"(대상)일 뿐 신원이 아니다.
//     신원은 항상 서버가 세션/테스트유저 마커에서 도출한 actor 이며, actor ≠ 대상이면 403.
//   · **어드민 우회 없음**: 주차 확인은 카드 주인 본인의 확인 행위다. requireOwnerOrAdmin /
//     resolveWriteActor 를 쓰지 않는 이유가 이것 — 그쪽은 admin 이 targetUserId 로 타인을
//     대상으로 삼는 것을 허용하므로 이 라우트의 정책과 어긋난다.
//   · 일반 / demoUserId / actAsTestUserId 세 경로는 actor 를 뽑는 방식만 다르고,
//     그 뒤의 소유권 검증·저장·응답 DTO 는 완전히 동일한 코드 경로를 탄다.
//   · enforceQaMode(QA 스코프 게이트)는 걸지 않는다 — 쓰기 라우트 관례(/api/weekly-reviews POST 등)와
//     같고, "테스트 모드와 일반 모드가 동일 API·동일 DTO" 라는 요구를 지키기 위함이다. 응답은
//     uuid 2개 + boolean + timestamp 뿐이라 스코프 간 데이터 노출 문제가 없다. 모집단 스코프
//     (누가 화면에 보이는가)는 종전대로 조회 라우트들이 담당한다.
//
// 저장: public.week_confirmations (user_id, week_id) UNIQUE.
//   재확인 요청은 새 행을 만들지 않고 기존 행(최초 confirmed_at)을 그대로 반환한다(idempotent).
//   마이그레이션: backend/database/schema/week_confirmations.sql
// ─────────────────────────────────────────────────────────────────────────

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export type WeekConfirmationDto = {
  userId: string;
  weekId: string;
  confirmed: boolean;
  confirmedAt: string | null;
};

const toDto = (
  userId: string,
  weekId: string,
  row: { confirmed_at: string } | null,
): WeekConfirmationDto => ({
  userId,
  weekId,
  confirmed: !!row,
  confirmedAt: row?.confirmed_at ?? null,
});

type ActorResult =
  | { ok: true; userId: string; source: "session" | "demo" | "actAsTestUser" }
  | { ok: false; response: NextResponse };

const errorResponse = (status: number, error: string) =>
  NextResponse.json({ success: false, error }, { status });

/**
 * 요청의 "행위자(actor)" 를 서버에서 단독으로 결정한다.
 * 우선순위: demoUserId(검증된 테스트 유저) → actAsTestUserId(검증된 테스트 유저) → 로그인 세션.
 * 어느 것도 없으면 401. 클라이언트가 보낸 userId 는 여기서 절대 쓰지 않는다.
 */
async function resolveActor(request: Request, body: unknown): Promise<ActorResult> {
  // 1) 테스트 유저(데모) 모드 — test_user_markers 등재 + 데모 게이트 통과 시에만 인정(미등재 → 403).
  let demoUserId: string | null = null;
  try {
    demoUserId = await resolveDemoProfileUserIdFromRequest(request, body);
  } catch (e) {
    if (e instanceof DemoModeError) return { ok: false, response: errorResponse(e.status, e.message) };
    throw e;
  }
  if (demoUserId) return { ok: true, userId: demoUserId, source: "demo" };

  // 2) QA 스코프의 actAsTestUserId — lib/api-auth.validateActAsTestUserId 와 동일한 검증 기준
  //    (스코프가 test 일 때만 읽고, test_user_markers 등재 유저만 인정).
  let actAsTestUserId: string | null = null;
  try {
    const url = new URL(request.url);
    if (readScopeMode(url.searchParams) === "test") {
      actAsTestUserId = url.searchParams.get("actAsTestUserId")?.trim() || null;
    }
  } catch {
    actAsTestUserId = null;
  }
  if (actAsTestUserId) {
    if (!supabaseAdmin) return { ok: false, response: errorResponse(500, "서버 설정 오류") };
    if (!(await isTestUserId(supabaseAdmin, actAsTestUserId))) {
      return { ok: false, response: errorResponse(403, "actAsTestUserId is not a registered test user.") };
    }
    return { ok: true, userId: actAsTestUserId, source: "actAsTestUser" };
  }

  // 3) 일반 로그인 세션 — 세션 없음이면 401(비로그인은 여기서 끝난다).
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false, response: errorResponse(401, "로그인이 필요합니다.") };

  const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", null);
  if (error) return { ok: false, response: errorResponse(error.status, error.message) };
  return { ok: true, userId: profile.user_id, source: "session" };
}

const readWeekId = (raw: unknown): string | null => {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value && isValidUUID(value) ? value : null;
};

async function findConfirmation(userId: string, weekId: string) {
  const supabase = createAdminClient();
  return supabase
    .from("week_confirmations")
    .select("confirmed_at")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .maybeSingle();
}

// GET: 주차 확인 상태 조회. 화면의 초기 "확인 완료" 표시는 이 응답만을 근거로 한다.
//   ?weekId=<weeks.id> (필수)
//   ?userId=<카드 주인> (선택 — 없으면 actor 본인)
// 읽기는 peer-view(타 크루 카드 열람)에서도 필요하므로 명시 userId 가 있으면 공개 조회를 허용한다.
//   응답에 PII 없음(uuid 2개 + boolean + timestamp). 쓰기(POST)만 소유자로 제한된다.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = readWeekId(searchParams.get("weekId"));
    const explicitUserId = searchParams.get("userId")?.trim() || null;

    if (!weekId) return errorResponse(400, "유효한 weekId가 필요합니다.");
    if (explicitUserId && !isValidUUID(explicitUserId)) {
      return errorResponse(400, "유효한 userId가 필요합니다.");
    }

    let targetUserId = explicitUserId;
    if (!targetUserId) {
      const actor = await resolveActor(request, null);
      if (!actor.ok) return actor.response;
      targetUserId = actor.userId;
    }

    const { data, error } = await findConfirmation(targetUserId, weekId);
    if (error) {
      console.error("[week-confirmations] 조회 오류:", error);
      return errorResponse(500, "주차 확인 상태 조회에 실패했습니다.");
    }

    return NextResponse.json({
      success: true,
      data: toDto(targetUserId, weekId, data as { confirmed_at: string } | null),
    });
  } catch (err) {
    console.error("[week-confirmations] 조회 API 오류:", err);
    return errorResponse(500, "서버 오류가 발생했습니다.");
  }
}

// POST: 주차 확인 완료 기록. body { weekId, userId? }
//   userId 는 "이 카드의 주인" 이며 신원이 아니다 — actor 와 다르면 403.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { weekId?: unknown; userId?: unknown }
      | null;

    const { searchParams } = new URL(request.url);
    const weekId = readWeekId(body?.weekId ?? searchParams.get("weekId"));
    if (!weekId) return errorResponse(400, "유효한 weekId가 필요합니다.");

    const rawTarget =
      (typeof body?.userId === "string" ? body.userId.trim() : "") ||
      searchParams.get("userId")?.trim() ||
      null;
    if (rawTarget && !isValidUUID(rawTarget)) {
      return errorResponse(400, "유효한 userId가 필요합니다.");
    }

    // 비로그인 → 401 이 QA 게이트보다 먼저 나와야 하므로 actor 를 먼저 확정한다.
    const actor = await resolveActor(request, body);
    if (!actor.ok) return actor.response;

    // 소유권: 서버가 도출한 actor 만이 자기 주차를 확인할 수 있다. 어드민 우회 없음.
    if (rawTarget && rawTarget !== actor.userId) {
      return errorResponse(403, "본인의 주차 카드만 확인할 수 있습니다.");
    }
    const ownerUserId = actor.userId;

    const supabase = createAdminClient();

    // 존재하지 않는 주차로의 기록 방지(FK 위반을 500 대신 명확한 404 로).
    const { data: week, error: weekError } = await supabase
      .from("weeks")
      .select("id")
      .eq("id", weekId)
      .maybeSingle();
    if (weekError) {
      console.error("[week-confirmations] 주차 조회 오류:", weekError);
      return errorResponse(500, "주차 정보를 확인하지 못했습니다.");
    }
    if (!week) return errorResponse(404, "존재하지 않는 주차입니다.");

    // 이미 확인했으면 그대로 반환 — 중복 행도, confirmed_at 덮어쓰기도 없다.
    const { data: existing, error: existingError } = await findConfirmation(ownerUserId, weekId);
    if (existingError) {
      console.error("[week-confirmations] 기존 확인 조회 오류:", existingError);
      return errorResponse(500, "주차 확인 상태 조회에 실패했습니다.");
    }
    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        data: toDto(ownerUserId, weekId, existing as { confirmed_at: string }),
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("week_confirmations")
      .insert({ user_id: ownerUserId, week_id: weekId })
      .select("confirmed_at")
      .single();

    if (insertError) {
      // 동시 클릭 경합 — UNIQUE(user_id, week_id) 가 두 번째를 막는다. 기존 행을 읽어 성공 처리.
      if (insertError.code === "23505") {
        const { data: raced } = await findConfirmation(ownerUserId, weekId);
        if (raced) {
          return NextResponse.json({
            success: true,
            alreadyConfirmed: true,
            data: toDto(ownerUserId, weekId, raced as { confirmed_at: string }),
          });
        }
      }
      console.error("[week-confirmations] 저장 오류:", insertError);
      return errorResponse(500, "주차 확인 저장에 실패했습니다.");
    }

    return NextResponse.json({
      success: true,
      alreadyConfirmed: false,
      data: toDto(ownerUserId, weekId, inserted as { confirmed_at: string }),
    });
  } catch (err) {
    console.error("[week-confirmations] 저장 API 오류:", err);
    return errorResponse(500, "서버 오류가 발생했습니다.");
  }
}

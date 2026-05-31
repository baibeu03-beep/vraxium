import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// 고객 페이지 테스트 유저(데모) 모드.
// ─────────────────────────────────────────────────────────────────────
// `demoUserId`(body 또는 query) 가 있으면, 로그인 세션(보통 관리자) 대신 지정한
// 테스트 유저 기준으로 저장/조회 흐름을 처리한다. 안전장치:
//   1) 환경 게이트: NODE_ENV === 'production' 이면 기본 비활성. 단 ENABLE_DEMO_MODE
//      ='true' 가 명시되면(스테이징 등) 강제 활성화.
//   2) 대상 제한: demoUserId 는 test_user_markers 에 등재된 테스트 유저만 허용.
//      실 운영 사용자 id 를 넣으면 403.
//   3) 쓰기 주체/기간: 데모 쓰기는 demoUserId 기준으로 저장되고, 작성 기간/edit
//      window 검증은 "관리자라도" 우회하지 않고 테스트 유저 기준으로 적용한다.
// 데모 모드가 꺼져 있으면 demoUserId 는 조용히 무시되고 일반 세션 인증으로 폴백한다.
// (vraxium-admin 의 lib/demoMode.ts / lib/testUsers.ts 와 동일 정책 — 고객 front 용 포팅)
// ─────────────────────────────────────────────────────────────────────

export class DemoModeError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DemoModeError";
    this.status = status;
  }
}

export function isDemoModeEnabled(): boolean {
  if (process.env.ENABLE_DEMO_MODE === "true") return true;
  return process.env.NODE_ENV !== "production";
}

// 단건 판정: profileUserId 가 데모 대상(test_user_markers 등재)인가.
async function isTestUser(profileUserId: string): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[demoMode] supabaseAdmin not configured");
    return false;
  }
  const id = String(profileUserId ?? "").trim();
  if (!id) return false;

  const { data, error } = await supabaseAdmin
    .from("test_user_markers")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle();

  if (error) {
    console.error("[demoMode] isTestUser lookup failed", {
      userId: id,
      error: error.message,
    });
    return false;
  }
  return Boolean(data);
}

// raw demoUserId(body.demoUserId 또는 query demoUserId) → 검증된 테스트 유저 profile.user_id | null
//   - demoUserId 없음 → null (일반 인증 경로 진행)
//   - 데모 모드 off → null (demoUserId 무시, 일반 인증 경로 진행)
//   - 데모 모드 on + demoUserId 가 테스트 유저 아님 → DemoModeError(403)
export async function resolveDemoProfileUserId(
  rawDemoUserId: unknown,
): Promise<string | null> {
  const demoUserId =
    typeof rawDemoUserId === "string" ? rawDemoUserId.trim() : "";
  if (!demoUserId) return null;
  if (!isDemoModeEnabled()) return null;

  const allowed = await isTestUser(demoUserId);
  if (!allowed) {
    throw new DemoModeError(403, "demoUserId is not a registered test user.");
  }
  return demoUserId;
}

// 요청 단위 편의 래퍼 — 모든 API 라우트가 동일 규칙으로 demoUserId 를 읽도록 일원화한다.
//   우선순위: body.demoUserId → query(?demoUserId=).
//   반환/throw 정책은 resolveDemoProfileUserId 와 동일(미존재 → null, 미등재 → DemoModeError(403)).
// body 는 이미 파싱된 객체를 넘긴다(GET 등 body 없는 경우 생략 가능 → query 만 검사).
export async function resolveDemoProfileUserIdFromRequest(
  request: Request,
  body?: unknown,
): Promise<string | null> {
  let raw: unknown = null;
  if (body && typeof body === "object" && "demoUserId" in (body as Record<string, unknown>)) {
    raw = (body as Record<string, unknown>).demoUserId;
  }
  if (raw == null) {
    try {
      raw = new URL(request.url).searchParams.get("demoUserId");
    } catch {
      raw = null;
    }
  }
  return resolveDemoProfileUserId(raw);
}

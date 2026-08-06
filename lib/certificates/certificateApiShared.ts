import "server-only";
import { NextResponse } from "next/server";
import { resolveEffectiveUserId } from "@/lib/api-auth";
import { enforceQaMode } from "@/lib/qaModeGate";

// 증명서 API 공통 진입 로직 — 활동 증명서 · 경력 증명서가 함께 쓴다.
// (context/preview/issue 세 라우트 × 두 증명서 종류가 서로 다른 인증 코드를
//  타지 않도록 한 곳에 모은다.)

export function certificateErrorPayload(
  step: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return { success: false as const, step, error: message, ...(details ?? {}) };
}

/** 신원·발급 대상·템플릿 경로를 바꾸려는 시도 — 두 증명서 공통 차단 키. */
export const IDENTITY_FORBIDDEN_BODY_KEYS = [
  "userId",
  "userID",
  "user_id",
  "targetUserId",
  "target_user_id",
  "actAsTestUserId",
  "profileId",
  "templatePath",
  "templateId",
] as const;

/**
 * 값이 본인 것이든 아니든 "존재 자체"를 400 으로 거부한다 — 조용히 무시하면
 * 클라이언트 버그와 권한 탐색을 둘 다 놓친다.
 * (demoUserId 는 예외: resolveDemoProfileUserIdFromRequest 가 body 에서 읽어
 *  test_user_markers 로 검증하는 정상 경로다.)
 */
export function findForbiddenBodyKey(body: unknown, forbiddenKeys: readonly string[]): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of forbiddenKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return key;
  }
  return null;
}

export type ActorResolution =
  | { ok: true; userId: string; source: "demo" | "actAs" | "session" }
  | { ok: false; response: NextResponse };

/**
 * 세 라우트 공통 진입: 실사용자 결정 → QA 모드 게이트.
 * 일반/테스트/데모 경로가 갈라지는 유일한 지점이며, 이후 로직은 완전히 동일하다.
 */
export async function resolveCertificateActor(
  request: Request,
  body?: unknown,
): Promise<ActorResolution> {
  const actor = await resolveEffectiveUserId(request, body);
  if (!actor.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload("actor", actor.message, { code: actor.code }),
        { status: actor.status },
      ),
    };
  }
  const qaBlock = await enforceQaMode(request, { targetUserId: actor.userId });
  if (qaBlock) return { ok: false, response: qaBlock };
  return { ok: true, userId: actor.userId, source: actor.source };
}

/** JSON body 안전 파싱 — 잘못된 JSON 이 500 이 되지 않게 한다. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

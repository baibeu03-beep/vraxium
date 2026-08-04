import "server-only";
import { NextResponse } from "next/server";
import { resolveEffectiveUserId } from "@/lib/api-auth";
import { enforceQaMode } from "@/lib/qaModeGate";
import {
  ELIGIBLE_ORG_NAME,
  loadActivityCertificateUserContext,
  type ActivityCertificateUserContext,
} from "./activityCertificateContext";
import { CertificateAssetError, CERTIFICATE_ASSET_MESSAGES } from "./activityCertificateAssets";
import {
  CertificateLayoutError,
  CertificateRenderError,
  renderActivityCertificatePng,
  type RenderedCertificate,
} from "./activityCertificateRenderer";
import { buildResumeUrl, renderResumeQrPng } from "./activityCertificateQr";
import {
  validateActivityCertificateInput,
  type ActivityCertificateInput,
} from "./activityCertificateValidation";

// 증명 발급 API 3종(context · preview · issue)이 공유하는 진입 로직.
// context/preview/issue 가 서로 다른 인증·검증·생성 코드를 타지 않도록 한 곳에 모은다.

export function certificateErrorPayload(
  step: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return { success: false as const, step, error: message, ...(details ?? {}) };
}

/**
 * 요청 본문으로 발급 대상·목적지·자격을 바꾸려는 시도를 차단.
 * 값이 본인 것이든 아니든 "존재 자체"를 400 으로 거부한다 — 조용히 무시하면 클라이언트
 * 버그와 권한 탐색을 둘 다 놓친다.
 * (demoUserId 는 예외: resolveDemoProfileUserIdFromRequest 가 body 에서 읽어
 *  test_user_markers 로 검증하는 정상 경로다.)
 */
const FORBIDDEN_BODY_KEYS = [
  "userId",
  "userID",
  "user_id",
  "targetUserId",
  "target_user_id",
  "actAsTestUserId",
  "profileId",
  // QR 목적지는 서버가 effectiveUserId 로만 만든다.
  "resumeUrl",
  "resume_url",
  "qrUrl",
  "origin",
  // 발급 자격(조직)도 서버 판정 전용.
  "organizationSlug",
  "organization_slug",
  "org",
  // 템플릿 경로 주입 차단.
  "templatePath",
  "templateId",
] as const;

export function findForbiddenBodyKey(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of FORBIDDEN_BODY_KEYS) {
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

/** 렌더 계열 예외 → 구조화 응답. 500 으로 새지 않게 한다. */
export function certificateErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof CertificateAssetError) {
    return NextResponse.json(
      certificateErrorPayload("assets", CERTIFICATE_ASSET_MESSAGES[e.code], {
        code: e.code,
        detail: e.message,
      }),
      { status: e.status },
    );
  }
  if (e instanceof CertificateLayoutError) {
    return NextResponse.json(
      certificateErrorPayload("layout", e.message, {
        code: "VALIDATION_FAILED",
        fieldErrors: e.errors,
      }),
      { status: e.status },
    );
  }
  if (e instanceof CertificateRenderError) {
    return NextResponse.json(
      certificateErrorPayload("render", "증명서를 생성하지 못했습니다.", {
        code: "RENDER_FAILED",
        detail: e.message,
      }),
      { status: 500 },
    );
  }
  return null;
}

export interface PreparedCertificate {
  userId: string;
  context: ActivityCertificateUserContext;
  input: ActivityCertificateInput;
  rendered: RenderedCertificate;
  resumeUrl: string;
}

/**
 * preview 와 issue 가 **동일하게** 호출하는 준비 파이프라인.
 * 두 엔드포인트가 서로 다른 검증/생성/QR 코드를 타는 일이 구조적으로 불가능해진다.
 */
export async function prepareCertificate(
  request: Request,
  body: unknown,
): Promise<{ ok: true; value: PreparedCertificate } | { ok: false; response: NextResponse }> {
  const forbiddenKey = findForbiddenBodyKey(body);
  if (forbiddenKey) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload(
          "body",
          "요청 본문에 사용자 식별자·발급 대상·목적지 정보를 포함할 수 없습니다.",
          { code: "BODY_FIELD_FORBIDDEN", key: forbiddenKey },
        ),
        { status: 400 },
      ),
    };
  }

  const actor = await resolveCertificateActor(request, body);
  if (!actor.ok) return { ok: false, response: actor.response };

  // 발급 자격(조직)은 서버가 프로필로만 판정한다 — 요청으로 바꿀 수 없다.
  const context = await loadActivityCertificateUserContext(actor.userId);
  if (!context.eligible) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload(
          "eligibility",
          `현재 활동 증명서는 ${ELIGIBLE_ORG_NAME} 소속 크루만 발급할 수 있습니다.`,
          { code: "ORG_NOT_ELIGIBLE", requiredOrganizationName: ELIGIBLE_ORG_NAME },
        ),
        { status: 403 },
      ),
    };
  }

  const validation = validateActivityCertificateInput(body);
  if (!validation.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload("validation", "입력값을 다시 확인해주세요.", {
          code: "VALIDATION_FAILED",
          fieldErrors: validation.errors,
        }),
        { status: 422 },
      ),
    };
  }

  // QR 목적지 = 서버가 effectiveUserId 로만 만든 절대 URL.
  const resumeUrl = buildResumeUrl(request, actor.userId);

  try {
    const qrPng = await renderResumeQrPng(resumeUrl);
    const rendered = await renderActivityCertificatePng(validation.value, { qrPng });
    return {
      ok: true,
      value: { userId: actor.userId, context, input: validation.value, rendered, resumeUrl },
    };
  } catch (e) {
    const mapped = certificateErrorResponse(e);
    if (mapped) return { ok: false, response: mapped };
    throw e;
  }
}

/** JSON body 안전 파싱 — 잘못된 JSON 이 500 이 되지 않게 한다. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

import "server-only";
import { NextResponse } from "next/server";
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
import {
  certificateErrorPayload,
  findForbiddenBodyKey,
  IDENTITY_FORBIDDEN_BODY_KEYS,
  readJsonBody,
  resolveCertificateActor,
  type ActorResolution,
} from "./certificateApiShared";

export { certificateErrorPayload, readJsonBody, resolveCertificateActor, type ActorResolution };

// 활동 증명 발급 API 3종(context · preview · issue)이 공유하는 진입 로직.
// context/preview/issue 가 서로 다른 인증·검증·생성 코드를 타지 않도록 한 곳에 모은다.
// 신원 관련 공통 차단 키(userId 등)는 certificateApiShared.ts 를 그대로 쓰고, 여기서는
// 활동 증명서 고유의 차단 키(QR 목적지·조직)만 더한다.

const FORBIDDEN_BODY_KEYS = [
  ...IDENTITY_FORBIDDEN_BODY_KEYS,
  // QR 목적지는 서버가 effectiveUserId 로만 만든다.
  "resumeUrl",
  "resume_url",
  "qrUrl",
  "origin",
  // 발급 자격(조직)도 서버 판정 전용.
  "organizationSlug",
  "organization_slug",
  "org",
] as const;

export function findForbiddenBodyKeyForActivity(body: unknown): string | null {
  return findForbiddenBodyKey(body, FORBIDDEN_BODY_KEYS);
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
  const forbiddenKey = findForbiddenBodyKeyForActivity(body);
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

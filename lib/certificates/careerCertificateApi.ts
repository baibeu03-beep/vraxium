import "server-only";
import { NextResponse } from "next/server";
import {
  loadCareerCertificateUserContext,
  resolveCareerCertificateOrg,
  type CareerCertificateUserContext,
} from "./careerCertificateContext";
import { CertificateAssetError, CERTIFICATE_ASSET_MESSAGES } from "./careerCertificateAssets";
import {
  CertificateLayoutError,
  CertificateRenderError,
  renderCareerCertificatePng,
  type RenderedCertificate,
} from "./careerCertificateRenderer";
import {
  validateCareerCertificateInput,
  type CareerCertificateInput,
} from "./careerCertificateValidation";
import type { Organization } from "./careerCertificateTemplate";
import {
  certificateErrorPayload,
  findForbiddenBodyKey,
  IDENTITY_FORBIDDEN_BODY_KEYS,
  readJsonBody,
  resolveCertificateActor,
  type ActorResolution,
} from "./certificateApiShared";

export { certificateErrorPayload, readJsonBody, resolveCertificateActor, type ActorResolution };

// 경력 증명 발급 API 3종(context · preview · issue)이 공유하는 진입 로직.
// activityCertificateApi.ts 와 동일 구조 — 공통 부분(신원 차단 키·actor 해석)은
// certificateApiShared.ts 를 그대로 쓰고, 여기서는 경력 증명서 고유의 차단 키(조직)만
// 더한다.
//
// ⚠️ "affiliation" 은 여기서 막지 않는다 — 인적 사항 표의 "소속" 칸에 들어가는
//    정상 동적 입력 필드다(careerCertificateTemplate.ts 의 CareerCertificateInputField
//    참고). 하단 증명 문구의 조직 표기는 이 값을 전혀 참조하지 않고 서버가 확정한
//    org(쿼리, 아래)로만 CAREER_CERTIFICATE_ORGANIZATION_COPY 를 조회해 만들므로,
//    body.affiliation 을 아무리 조작해도 증명 문구의 조직 표기는 바뀌지 않는다 —
//    막아야 할 것은 "org/organization/organizationSlug" 자체다.

const FORBIDDEN_BODY_KEYS = [
  ...IDENTITY_FORBIDDEN_BODY_KEYS,
  // 조직 컨텍스트는 서버가 URL 쿼리(?org=)로만 확정한다 — body 로는 절대 받지 않는다.
  "organization",
  "organizationSlug",
  "organization_slug",
  "org",
] as const;

function findForbiddenBodyKeyForCareer(body: unknown): string | null {
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

export interface PreparedCareerCertificate {
  userId: string;
  org: Organization;
  context: CareerCertificateUserContext;
  input: CareerCertificateInput;
  rendered: RenderedCertificate;
}

/**
 * preview 와 issue 가 **동일하게** 호출하는 준비 파이프라인.
 * org 는 요청 URL(?org=)에서만 읽는다 — body 는 findForbiddenBodyKeyForCareer 가
 * org 계열 키 존재 자체를 400 으로 거부하므로 여기 도달한 시점엔 body 에 없다.
 */
export async function prepareCareerCertificate(
  request: Request,
  body: unknown,
): Promise<{ ok: true; value: PreparedCareerCertificate } | { ok: false; response: NextResponse }> {
  const forbiddenKey = findForbiddenBodyKeyForCareer(body);
  if (forbiddenKey) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload(
          "body",
          "요청 본문에 사용자 식별자·발급 대상·조직 정보를 포함할 수 없습니다.",
          { code: "BODY_FIELD_FORBIDDEN", key: forbiddenKey },
        ),
        { status: 400 },
      ),
    };
  }

  const actor = await resolveCertificateActor(request, body);
  if (!actor.ok) return { ok: false, response: actor.response };

  // 조직 컨텍스트 — 세 경로(session/actAs/demo) 모두 동일하게 URL 쿼리로만 확정.
  const org = resolveCareerCertificateOrg(request);
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload(
          "eligibility",
          "올바른 조직 경로(엥크레/오랑캐/팔랑크스)로 접속해야 경력 증명서를 발급할 수 있습니다.",
          { code: "ORG_NOT_ELIGIBLE" },
        ),
        { status: 403 },
      ),
    };
  }

  const context = await loadCareerCertificateUserContext(actor.userId);

  const validation = validateCareerCertificateInput(body);
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

  try {
    const rendered = await renderCareerCertificatePng(validation.value, org);
    return {
      ok: true,
      value: { userId: actor.userId, org, context, input: validation.value, rendered },
    };
  } catch (e) {
    const mapped = certificateErrorResponse(e);
    if (mapped) return { ok: false, response: mapped };
    throw e;
  }
}

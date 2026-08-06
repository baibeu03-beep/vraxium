import "server-only";
import { NextResponse } from "next/server";
import {
  buildCareerOrgInfo,
  loadCareerAcademicRecord,
  loadCareerCertificateUserContext,
  missingAcademicFields,
  resolveCareerCertificateOrg,
  type CareerCertificateOrgInfo,
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
// certificateApiShared.ts 를 그대로 쓰고, 여기서는 경력 증명서 고유의 차단 키(조직·
// 소속·학적사항)만 더한다.
//
// ⚠️ affiliation/education 은 더 이상 정상 입력 필드가 아니다(이전 버전에서는 소속을
//    사용자가 직접 입력했으나, 지금은 신청 조직 컨텍스트에서 서버가 확정한다 — 이제
//    body 에 affiliation/education/academicRecord/organizationDisplayName 이 오면
//    무시하지 않고 존재 자체를 400 으로 거부한다. CareerCertificateInput 타입 자체에도
//    이 키들이 없으므로, 설령 차단을 깜빡해도 값이 반영될 코드 경로가 없다(이중 방어).

const FORBIDDEN_BODY_KEYS = [
  ...IDENTITY_FORBIDDEN_BODY_KEYS,
  // 조직 컨텍스트는 서버가 URL 쿼리(?org=)로만 확정한다 — body 로는 절대 받지 않는다.
  "organization",
  "organizationSlug",
  "organization_slug",
  "org",
  // 소속·학적사항은 더 이상 사용자 입력이 아니다 — 서버가 조직 컨텍스트/학력 정보로
  // 확정한다. body 로 스푸핑을 시도하면 전부 400.
  "affiliation",
  "education",
  "academicRecord",
  "academic_record",
  "organizationDisplayName",
  "university",
  "department",
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
  orgInfo: CareerCertificateOrgInfo;
  context: CareerCertificateUserContext;
  academicRecord: string;
  input: CareerCertificateInput;
  rendered: RenderedCertificate;
}

/**
 * preview 와 issue 가 **동일하게** 호출하는 준비 파이프라인.
 * org 는 요청 URL(?org=)에서만 읽는다. 소속(표시명)과 학적사항은 요청 body 를 전혀
 * 참조하지 않고 이 함수 안에서 서버가 새로 확정한다 — 클라이언트가 이전 preview 응답의
 * 값을 그대로 돌려보내도(혹은 조작해도) 결과에 영향을 주지 않는다.
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
          "요청 본문에 사용자 식별자·발급 대상·조직·소속·학적사항 정보를 포함할 수 없습니다.",
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
  const orgInfo = buildCareerOrgInfo(org);

  // 학적사항 — 세 경로 모두 동일하게 서버가 재조회(요청으로 절대 대체 불가).
  const [context, academic] = await Promise.all([
    loadCareerCertificateUserContext(actor.userId),
    loadCareerAcademicRecord(actor.userId),
  ]);
  const missingFields = missingAcademicFields(academic.university, academic.department);
  if (missingFields.length > 0 || !academic.formatted) {
    return {
      ok: false,
      response: NextResponse.json(
        certificateErrorPayload(
          "academicRecord",
          "학적사항 정보가 등록되지 않았습니다. /cluster-2 에서 학력 정보를 먼저 등록해주세요.",
          { code: "ACADEMIC_RECORD_MISSING", missingFields },
        ),
        { status: 422 },
      ),
    };
  }

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
    const rendered = await renderCareerCertificatePng(
      validation.value,
      org,
      orgInfo.displayName,
      academic.formatted,
    );
    return {
      ok: true,
      value: {
        userId: actor.userId,
        org,
        orgInfo,
        context,
        academicRecord: academic.formatted,
        input: validation.value,
        rendered,
      },
    };
  } catch (e) {
    const mapped = certificateErrorResponse(e);
    if (mapped) return { ok: false, response: mapped };
    throw e;
  }
}

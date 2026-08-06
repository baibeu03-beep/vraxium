import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import {
  CAREER_CERTIFICATE_TEMPLATE,
  ORGANIZATION_CONFIG,
  resolveOrgFromLocation,
  type Organization,
} from "./careerCertificateTemplate";
import {
  buildCareerCertificateLimits,
  todayIsoKst,
  type CareerCertificateLimits,
} from "./careerCertificateValidation";
import { probeCareerCertificateAssets } from "./careerCertificateAssets";

// 경력 증명서 발급 페이지 컨텍스트 — 일반/actAsTestUserId/demoUserId 가 **공유하는
// 유일한** 조회 함수.
// ─────────────────────────────────────────────────────────────────────────────
// 조직 판정 원천: URL 쿼리 ?org= (요청 body 아님) — "현재 증명 발급 페이지"가 어느
//   조직 경로에서 열렸는지를 뜻한다. 사용자의 현재 프로필 소속을 자동 추론하지
//   않는다(activityCertificateContext.ts 와의 핵심 차이 — 그쪽은 발급 자격을
//   user_profiles.organization_slug 로 판정하지만, 경력 증명서는 "어느 조직
//   컨텍스트에서 신청했는가" 만 본다. alumni 등 현재 소속이 다른 사용자도 과거
//   협업한 조직을 지정해 발급받을 수 있어야 하기 때문이다).
//
// ⚠️ org 판정 로직을 여기서 새로 만들지 않는다. 크루 페이지 전체(사이드바 링크·
//   /crews·/weekly-ranking·/vacation·헤더 테마)가 공유하는 단일 resolver
//   lib/cluster-route.ts 의 resolveOrgFromLocation(pathname, orgQuery) 를 그대로
//   호출한다 — API 라우트는 pathname 이 항상 "/api/certificates/career/..." 라
//   의미가 없으므로 null 을 넘겨 orgQuery 기반 분기만 태운다(pathname 있는
//   페이지에서 넘어온 값이라 이미 유효한 slug 다). 반환값은 canonical
//   Organization("entertainment"/"marketing"/"planning")이며, 그 외 문자열/누락은
//   즉시 null(자격 없음)로 처리한다 — DB 조회 없이도 스푸핑 여지가 없다(하단 문구는
//   서버 고정 매핑표 CAREER_CERTIFICATE_ORGANIZATION_COPY 에서만 나온다).
//
// 이름/생년월일 기본값 원천: user_profiles.display_name / birth_date (활동증명서와
//   동일 테이블·컬럼). 그 외 필드(소속·학과사항·업무명·경력기간·해당 사항)는 권위
//   원천이 없어 전부 사용자 직접 입력이다.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerCertificateUserContext {
  userId: string;
  name: string | null;
  birthDate: string | null;
}

export interface CareerCertificateOrgInfo {
  /** canonical — lib/cluster-route.ts 의 Organization. */
  organization: Organization;
  /** URL 표시용 slug(encre/oranke/phalanx) — ORGANIZATION_CONFIG 파생, 재정의 아님. */
  orgSlug: "encre" | "oranke" | "phalanx";
  displayNameKo: string;
}

export interface CareerCertificatePageDto {
  success: true;
  user: {
    userId: string;
    name: string | null;
    birthDate: string | null;
  };
  /** 서버가 확정한 조직 컨텍스트. 요청 쿼리의 ?org= 가 유효할 때만 채워진다. */
  org: CareerCertificateOrgInfo | null;
  defaults: {
    name: string | null;
    birthDate: string | null;
    affiliation: string | null;
    education: string | null;
    taskName: string | null;
    careerStartDate: string | null;
    careerEndDate: string | null;
    careerDescription: string | null;
    issueDate: string;
  };
  sources: Record<string, "db" | "manual">;
  eligibility: {
    allowed: boolean;
    reason: "ok" | "ORG_PARAM_INVALID";
    message: string | null;
  };
  template: {
    templateId: string;
    previewUrl: string;
    width: number;
    height: number;
    available: boolean;
    reason: string;
    message: string | null;
    templateAvailable: boolean;
    fontAvailable: boolean;
  };
  limits: CareerCertificateLimits;
}

/**
 * 요청 URL 의 ?org= 에서 조직 컨텍스트를 확정한다. 요청 body 는 절대 읽지 않는다
 * (careerCertificateApi.ts 의 FORBIDDEN_BODY_KEYS 가 body.org 계열 키 자체를 400 으로
 * 거부하므로, 이 함수가 유일한 조직 판정 경로가 된다).
 *
 * 크루 페이지와 완전히 동일한 resolveOrgFromLocation 을 그대로 호출한다 — 별도
 * encre/oranke/phalanx 파서를 여기서 다시 만들지 않는다.
 */
export function resolveCareerCertificateOrg(request: Request): Organization | null {
  let raw: string | null = null;
  try {
    raw = new URL(request.url).searchParams.get("org");
  } catch {
    return null;
  }
  return resolveOrgFromLocation(null, raw);
}

/** user_profiles 한 줄 → 컨텍스트(이름/생년월일만 — 소속/조직 자격과 무관). */
export async function loadCareerCertificateUserContext(
  userId: string,
): Promise<CareerCertificateUserContext> {
  const base: CareerCertificateUserContext = { userId, name: null, birthDate: null };
  if (!supabaseAdmin) return base;

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("display_name, birth_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return base;

  const row = data as { display_name?: string | null; birth_date?: string | null };
  const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
  const birthDate =
    typeof row.birth_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(row.birth_date)
      ? row.birth_date.slice(0, 10)
      : null;

  return { userId, name: name.length > 0 ? name : null, birthDate };
}

/** 모든 모드가 공유하는 유일한 DTO 생성기. */
export async function buildCareerCertificatePageDto(
  ctx: CareerCertificateUserContext,
  org: Organization | null,
): Promise<CareerCertificatePageDto> {
  const probe = await probeCareerCertificateAssets();
  const tpl = CAREER_CERTIFICATE_TEMPLATE;

  const orgInfo: CareerCertificateOrgInfo | null = org
    ? {
        organization: org,
        orgSlug: ORGANIZATION_CONFIG[org].orgSlug,
        displayNameKo: ORGANIZATION_CONFIG[org].displayNameKo,
      }
    : null;

  return {
    success: true,
    user: { userId: ctx.userId, name: ctx.name, birthDate: ctx.birthDate },
    org: orgInfo,
    defaults: {
      name: ctx.name,
      birthDate: ctx.birthDate,
      affiliation: null,
      education: null,
      taskName: null,
      careerStartDate: null,
      careerEndDate: null,
      careerDescription: null,
      issueDate: todayIsoKst(),
    },
    sources: {
      name: ctx.name ? "db" : "manual",
      birthDate: ctx.birthDate ? "db" : "manual",
      affiliation: "manual",
      education: "manual",
      taskName: "manual",
      careerStartDate: "manual",
      careerEndDate: "manual",
      careerDescription: "manual",
      issueDate: "db",
    },
    eligibility: {
      allowed: org !== null,
      reason: org !== null ? "ok" : "ORG_PARAM_INVALID",
      message:
        org !== null
          ? null
          : "올바른 조직 경로(엥크레/오랑캐/팔랑크스)로 접속해야 경력 증명서를 발급할 수 있습니다.",
    },
    template: {
      templateId: tpl.templateId,
      previewUrl: tpl.publicUrl,
      width: tpl.width,
      height: tpl.height,
      available: probe.available,
      reason: probe.reason,
      message: probe.message,
      templateAvailable: probe.templateAvailable,
      fontAvailable: probe.fontAvailable,
    },
    limits: buildCareerCertificateLimits(),
  };
}

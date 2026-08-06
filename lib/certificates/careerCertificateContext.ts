import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPersonProfileMap } from "@/lib/personProfiles";
import {
  CAREER_CERTIFICATE_TEMPLATE,
  CAREER_CERTIFICATE_ORGANIZATION_COPY,
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
// 조직 판정 원천: URL 쿼리 ?org= (요청 body 아님) — activityCertificateContext.ts 와의
//   핵심 차이는 그대로다(자세한 설명은 resolveCareerCertificateOrg 주석 참고).
//
// 소속(affiliation) 원천: 사용자 입력이 아니다. 서버가 확정한 조직 컨텍스트 →
//   ORGANIZATION_CONFIG[organization].displayNameKo (예: "엥크레") 를 표의 소속 칸에,
//   CAREER_CERTIFICATE_ORGANIZATION_COPY[organization].affiliation (예: "엔터테인먼트/
//   미디어 클럽, 엥크레 소속") 을 하단 증명 문구에 각각 쓴다 — 같은 canonical org 에서
//   나오지만 서로 다른 표시 필드로 관리한다(표 소속 ≠ 하단 문구).
//
// 학적사항(academicRecord) 원천: 사용자 입력이 아니다. lib/personProfiles.ts 의
//   buildPersonProfileMap() 을 그대로 재사용한다 — /api/weekly-reputations 등과 동일한
//   canonical 조회(school = user_educations 대표 학력.school_name → user_profiles 폴백,
//   department = user_educations.major_name_1 → user_profiles 폴백). 이 값들은 저장
//   시점에 lib/schoolNormalize.js 가 이미 "대학교"/"학과" 등 접미사를 붙여두므로
//   여기서 추가로 접미사를 붙이지 않는다 — 단순히 "{학교} {학과}" 로 합친다(공백 join,
//   app/(host)/api/crews/route.ts 의 universityMajor 빌더와 동일 규칙).
//   둘 중 하나라도 없으면 학적사항은 null(미등록) — "-"/"미등록" 같은 합성값을 만들지
//   않는다(발급 자체를 막는다).
//
// 이름/생년월일 기본값 원천: user_profiles.display_name / birth_date (활동증명서와
//   동일 테이블·컬럼, 변경 없음).
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerCertificateUserContext {
  userId: string;
  name: string | null;
  birthDate: string | null;
  /** user_educations(대표 학력) 우선 → user_profiles 폴백. 접미사는 저장 시점에 이미 포함됨. */
  university: string | null;
  department: string | null;
}

export interface CareerCertificateOrgInfo {
  /** canonical — lib/cluster-route.ts 의 Organization. */
  key: Organization;
  /** URL 표시용 slug(encre/oranke/phalanx) — ORGANIZATION_CONFIG 파생, 재정의 아님. */
  orgSlug: "encre" | "oranke" | "phalanx";
  /** 표의 "소속" 칸에 찍히는 짧은 표시명(예: "엥크레"). */
  displayName: string;
  /** 하단 증명 문구에 포함되는 긴 소속 표기(예: "엔터테인먼트/미디어 클럽, 엥크레 소속"). */
  verificationAffiliation: string;
}

/** context 시점에 이미 확보되지 못한 필수 학적 정보. */
export type CareerCertificateMissingField = "university" | "department";

export interface CareerCertificatePageDto {
  success: true;
  user: {
    userId: string;
    name: string | null;
    birthDate: string | null;
    /** "{대학교명} {학과명}" — 둘 다 있을 때만 값이 있고, 그 외엔 null(합성값 금지). */
    academicRecord: string | null;
  };
  /** 서버가 확정한 조직 컨텍스트. 요청 쿼리의 ?org= 가 유효할 때만 채워진다. */
  organization: CareerCertificateOrgInfo | null;
  defaults: {
    name: string | null;
    birthDate: string | null;
    taskName: string | null;
    careerStartDate: string | null;
    careerEndDate: string | null;
    careerDescription: string | null;
    issueDate: string;
  };
  sources: Record<string, "db" | "manual">;
  /** 학적사항 중 등록되지 않은 항목. 빈 배열이면 완전히 등록됨. org 유효성과 독립적으로 항상 반영된다. */
  missingFields: CareerCertificateMissingField[];
  eligibility: {
    /** org 유효 && 학적사항 완전 등록 — preview/issue 버튼 활성화 기준. */
    allowed: boolean;
    reason: "ok" | "ORG_PARAM_INVALID" | "ACADEMIC_RECORD_MISSING";
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

/** canonical Organization → 표/문구에 쓰는 두 표시 필드(짧은 소속명 · 긴 증명 문구용 소속). */
export function buildCareerOrgInfo(org: Organization): CareerCertificateOrgInfo {
  const cfg = ORGANIZATION_CONFIG[org];
  return {
    key: org,
    orgSlug: cfg.orgSlug,
    displayName: cfg.displayNameKo,
    verificationAffiliation: CAREER_CERTIFICATE_ORGANIZATION_COPY[org].affiliation,
  };
}

/**
 * "{대학교명} {학과명}" — lib/personProfiles.ts 의 buildPersonProfileMap 을 그대로
 * 재사용한다(/api/weekly-reputations 등과 동일 canonical 조회, 새 쿼리를 만들지 않는다).
 * 학교/학과 각각 저장 시점에 이미 접미사가 붙어있으므로(lib/schoolNormalize.js) 여기서
 * 추가로 붙이지 않는다 — 단순 공백 join(app/(host)/api/crews/route.ts 의 universityMajor
 * 와 동일 규칙). 둘 중 하나라도 없으면 formatted=null(빈 값·"-"·"미등록" 합성 금지).
 */
export async function loadCareerAcademicRecord(
  userId: string,
): Promise<{ university: string | null; department: string | null; formatted: string | null }> {
  const map = await buildPersonProfileMap([userId]);
  const profile = map.get(userId);
  const university = profile?.school ?? null;
  const department = profile?.department ?? null;
  const formatted = university && department ? `${university} ${department}` : null;
  return { university, department, formatted };
}

export function missingAcademicFields(
  university: string | null,
  department: string | null,
): CareerCertificateMissingField[] {
  const missing: CareerCertificateMissingField[] = [];
  if (!university) missing.push("university");
  if (!department) missing.push("department");
  return missing;
}

/** user_profiles + 학적사항 한 줄 → 컨텍스트. */
export async function loadCareerCertificateUserContext(
  userId: string,
): Promise<CareerCertificateUserContext> {
  const base: CareerCertificateUserContext = {
    userId,
    name: null,
    birthDate: null,
    university: null,
    department: null,
  };
  if (!supabaseAdmin) return base;

  const [profileRes, academic] = await Promise.all([
    supabaseAdmin.from("user_profiles").select("display_name, birth_date").eq("user_id", userId).maybeSingle(),
    loadCareerAcademicRecord(userId),
  ]);

  const row = profileRes.data as { display_name?: string | null; birth_date?: string | null } | null;
  const name = typeof row?.display_name === "string" ? row.display_name.trim() : "";
  const birthDate =
    typeof row?.birth_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(row.birth_date)
      ? row.birth_date.slice(0, 10)
      : null;

  return {
    userId,
    name: name.length > 0 ? name : null,
    birthDate,
    university: academic.university,
    department: academic.department,
  };
}

/** 모든 모드가 공유하는 유일한 DTO 생성기. */
export async function buildCareerCertificatePageDto(
  ctx: CareerCertificateUserContext,
  org: Organization | null,
): Promise<CareerCertificatePageDto> {
  const probe = await probeCareerCertificateAssets();
  const tpl = CAREER_CERTIFICATE_TEMPLATE;

  const organization = org ? buildCareerOrgInfo(org) : null;
  const missingFields = missingAcademicFields(ctx.university, ctx.department);
  const academicRecord =
    missingFields.length === 0 ? `${ctx.university} ${ctx.department}` : null;

  const orgOk = org !== null;
  const academicOk = missingFields.length === 0;
  const eligibilityReason: CareerCertificatePageDto["eligibility"]["reason"] = !orgOk
    ? "ORG_PARAM_INVALID"
    : !academicOk
      ? "ACADEMIC_RECORD_MISSING"
      : "ok";

  const eligibilityMessage = !orgOk
    ? "올바른 조직 경로(엥크레/오랑캐/팔랑크스)로 접속해야 경력 증명서를 발급할 수 있습니다."
    : !academicOk
      ? "학적사항 정보가 등록되지 않았습니다. /cluster-2 에서 학력 정보를 먼저 등록해주세요."
      : null;

  return {
    success: true,
    user: { userId: ctx.userId, name: ctx.name, birthDate: ctx.birthDate, academicRecord },
    organization,
    defaults: {
      name: ctx.name,
      birthDate: ctx.birthDate,
      taskName: null,
      careerStartDate: null,
      careerEndDate: null,
      careerDescription: null,
      issueDate: todayIsoKst(),
    },
    sources: {
      name: ctx.name ? "db" : "manual",
      birthDate: ctx.birthDate ? "db" : "manual",
      taskName: "manual",
      careerStartDate: "manual",
      careerEndDate: "manual",
      careerDescription: "manual",
      issueDate: "db",
    },
    missingFields,
    eligibility: { allowed: orgOk && academicOk, reason: eligibilityReason, message: eligibilityMessage },
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

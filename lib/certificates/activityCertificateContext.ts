import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { ORGANIZATION_CONFIG } from "@/lib/cluster-route";
import {
  countConfirmedSuccessWeeks,
  type ConfirmedWeekMeta,
} from "@/lib/confirmed-success-weeks";
import { resolveWeekResultStates, statesByStartDate } from "@/lib/weekResultState";
import {
  ACTIVITY_CERTIFICATE_TEMPLATE,
  ORG_SLUG_TO_ORGANIZATION,
  isCertificateEligibleOrg,
  isCertificateOrgSlug,
  type CertificateOrgSlug,
} from "./activityCertificateTemplate";
import {
  buildCertificateLimits,
  todayIsoKst,
  type CertificateLimits,
} from "./activityCertificateValidation";
import { isFutureDate } from "./certificateDatePolicy";
import { probeCertificateAssets } from "./activityCertificateAssets";

// 증명 발급 페이지 컨텍스트 — 일반/actAsTestUserId/demoUserId 가 **공유하는 유일한** 조회 함수.
// ─────────────────────────────────────────────────────────────────────────────
// 모드별 mock DTO 나 분기는 없다. 세 경로의 차이는 호출부가 넘기는 userId 하나뿐이고,
// 여기서부터 DTO·null 처리 규칙까지 완전히 동일하다.
//
// 각 필드의 권위 원천(2026-08-04 실측):
//   이름           user_profiles.display_name
//   생년월일        user_profiles.birth_date
//   조직/클럽명     user_profiles.organization_slug → ORGANIZATION_CONFIG.displayNameKo
//   Club Elite Code user_profiles.crew_code          ← crew_unique_number 컬럼은 미적용
//   활동 시작일     user_profiles.activity_started_at
//   활동 종료일     user_profiles.activity_ended_at  ← 대부분 NULL(재직 중)
//   활동 주차 수    user_week_statuses + weeks(공표) → 공용 countConfirmedSuccessWeeks
//   졸업 품계       ❌ 권위 원천 없음(application_grade 전량 NULL) → 사용자 입력
//   활동 형태       ❌ 권위 원천 없음 → 사용자 입력
//   산업/직무 분야  ❌ DB 원천 없음 → 템플릿 고정 문구 기반 프리셋(사용자 수정 가능)
// ─────────────────────────────────────────────────────────────────────────────

/** 값의 출처 — 화면에서 "자동 조회"와 "직접 입력"을 구분해 보여주기 위한 표시용. */
export type CertificateValueSource = "db" | "preset" | "manual";

export interface ActivityCertificateUserContext {
  userId: string;
  name: string | null;
  birthDate: string | null;
  organizationSlug: CertificateOrgSlug | null;
  organizationName: string | null;
  clubEliteCode: string | null;
  activityStartDate: string | null;
  activityEndDate: string | null;
  activityWeeks: number | null;
  eligible: boolean;
}

export interface ActivityCertificatePageDto {
  success: true;
  user: {
    userId: string;
    name: string | null;
    birthDate: string | null;
    organizationName: string | null;
    organizationSlug: CertificateOrgSlug | null;
  };
  /** 서버가 자동으로 채워 내려주는 폼 초기값. null 이면 사용자가 직접 입력해야 한다. */
  defaults: {
    clubName: string | null;
    industryField: string | null;
    name: string | null;
    birthDate: string | null;
    clubEliteCode: string | null;
    graduationGrade: string | null;
    activityStartDate: string | null;
    activityEndDate: string | null;
    activityWeeks: string | null;
    activityForm: string | null;
    issueDate: string;
  };
  /** 필드별 값 출처 — 화면이 "자동 조회 / 직접 입력" 배지를 붙이는 데 쓴다. */
  sources: Record<string, CertificateValueSource>;
  /** 발급 자격(현재 단계: 엥크레 전용). */
  eligibility: {
    allowed: boolean;
    requiredOrganizationName: string;
    reason: "ok" | "ORG_NOT_ELIGIBLE" | "PROFILE_NOT_FOUND";
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
  limits: CertificateLimits;
}

const ELIGIBLE_ORG_NAME =
  ORGANIZATION_CONFIG[ORG_SLUG_TO_ORGANIZATION[ACTIVITY_CERTIFICATE_TEMPLATE.organizationSlug]]
    .displayNameKo;

/** "2025-09-29T00:00:00+00:00" → "2025-09-29". 유효하지 않으면 null. */
function toIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const head = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/**
 * 누적 인정 주차 — 공용 countConfirmedSuccessWeeks SoT.
 * /api/crews · /api/profile 과 동일 규칙(공표 완료 ∧ 비-break ∧ 비-전환 주차)을 쓴다.
 * ⚠️ 비즈니스 정책값이므로 항상 operating baseline(QA 워크백 규칙).
 * 조회 실패는 치명적이지 않다 — null 을 돌려 사용자가 직접 입력하게 한다.
 */
async function loadConfirmedWeeks(userId: string): Promise<number | null> {
  if (!supabaseAdmin) return null;
  try {
    const weekStates = await resolveWeekResultStates(supabaseAdmin, { scope: "operating" });
    const publishedByStart = statesByStartDate(weekStates);

    const { data: weekRows, error: weekErr } = await supabaseAdmin
      .from("weeks")
      .select("start_date, week_number, season_definitions(season_type)")
      .returns<
        Array<{
          start_date: string | null;
          week_number: number | null;
          season_definitions: { season_type: string | null } | null;
        }>
      >();
    if (weekErr || !weekRows) return null;

    const metaByStart = new Map<string, ConfirmedWeekMeta>();
    for (const w of weekRows) {
      if (!w.start_date) continue;
      metaByStart.set(w.start_date, {
        resultPublishedAt: publishedByStart.get(w.start_date)?.resultPublishedAt ?? null,
        seasonType: w.season_definitions?.season_type ?? null,
        weekNumber: w.week_number ?? null,
      });
    }

    const { data: statusRows, error: statusErr } = await supabaseAdmin
      .from("user_week_statuses")
      .select("week_start_date, status")
      .eq("user_id", userId)
      .eq("status", "success")
      .returns<Array<{ week_start_date: string | null; status: string }>>();
    if (statusErr || !statusRows) return null;

    return countConfirmedSuccessWeeks(statusRows, metaByStart);
  } catch {
    return null;
  }
}

/** user_profiles 한 줄 + 파생값 → 컨텍스트. 일반/테스트/데모 모두 이 함수만 통과한다. */
export async function loadActivityCertificateUserContext(
  userId: string,
): Promise<ActivityCertificateUserContext> {
  const base: ActivityCertificateUserContext = {
    userId,
    name: null,
    birthDate: null,
    organizationSlug: null,
    organizationName: null,
    clubEliteCode: null,
    activityStartDate: null,
    activityEndDate: null,
    activityWeeks: null,
    eligible: false,
  };
  if (!supabaseAdmin) return base;

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "display_name, birth_date, organization_slug, crew_code, activity_started_at, activity_ended_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return base;

  const row = data as {
    display_name?: string | null;
    birth_date?: string | null;
    organization_slug?: string | null;
    crew_code?: string | null;
    activity_started_at?: string | null;
    activity_ended_at?: string | null;
  };

  const slug = isCertificateOrgSlug(row.organization_slug) ? row.organization_slug : null;
  const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
  const code = typeof row.crew_code === "string" ? row.crew_code.trim() : "";
  const eligible = isCertificateEligibleOrg(slug);

  // 자격이 없는 조직이면 주차 집계 쿼리를 돌리지 않는다(불필요한 부하 + 데이터 노출 방지).
  const activityWeeks = eligible ? await loadConfirmedWeeks(userId) : null;

  return {
    userId,
    name: name.length > 0 ? name : null,
    birthDate: toIsoDate(row.birth_date),
    organizationSlug: slug,
    organizationName: slug
      ? ORGANIZATION_CONFIG[ORG_SLUG_TO_ORGANIZATION[slug]].displayNameKo
      : null,
    clubEliteCode: code.length > 0 ? code : null,
    activityStartDate: toIsoDate(row.activity_started_at),
    activityEndDate: toIsoDate(row.activity_ended_at),
    activityWeeks,
    eligible,
  };
}

/** 모든 모드가 공유하는 유일한 DTO 생성기. */
export async function buildActivityCertificatePageDto(
  ctx: ActivityCertificateUserContext,
): Promise<ActivityCertificatePageDto> {
  const probe = await probeCertificateAssets();
  const tpl = ACTIVITY_CERTIFICATE_TEMPLATE;

  const eligibilityReason: ActivityCertificatePageDto["eligibility"]["reason"] = ctx.eligible
    ? "ok"
    : ctx.organizationSlug === null
      ? "PROFILE_NOT_FOUND"
      : "ORG_NOT_ELIGIBLE";

  // ⚠️ 미래 날짜 금지 정책(2026-08-06 추가): DB 에 이미 저장된 activity_started_at/
  //    activity_ended_at 이 데이터 이상 등으로 미래 날짜라면, 그 값을 그대로 기본값으로
  //    내려 "발급 가능한 정상값"처럼 보여주지 않는다 — null 로 감춰 사용자가 직접 올바른
  //    날짜를 입력하게 하고 sources 도 "manual"로 내린다(자동 조회 배지를 달지 않는다).
  const today = todayIsoKst();
  const safeActivityStartDate =
    ctx.activityStartDate && !isFutureDate(ctx.activityStartDate, today) ? ctx.activityStartDate : null;
  const safeActivityEndDate =
    ctx.activityEndDate && !isFutureDate(ctx.activityEndDate, today) ? ctx.activityEndDate : null;

  return {
    success: true,
    user: {
      userId: ctx.userId,
      name: ctx.name,
      birthDate: ctx.birthDate,
      organizationName: ctx.organizationName,
      organizationSlug: ctx.organizationSlug,
    },
    defaults: {
      // 클럽명은 사용자의 실제 조직명을 우선(자격 통과 시 곧 "엥크레")하고,
      // 조회 실패 시에만 템플릿 프리셋으로 떨어진다.
      clubName: ctx.organizationName ?? tpl.presets.clubName,
      industryField: tpl.presets.industryField,
      name: ctx.name,
      birthDate: ctx.birthDate,
      clubEliteCode: ctx.clubEliteCode,
      graduationGrade: null, // 권위 원천 없음 — 사용자 입력
      activityStartDate: safeActivityStartDate,
      activityEndDate: safeActivityEndDate,
      activityWeeks: ctx.activityWeeks === null ? null : String(ctx.activityWeeks),
      activityForm: null, // 권위 원천 없음 — 사용자 입력
      issueDate: today,
    },
    sources: {
      clubName: ctx.organizationName ? "db" : "preset",
      industryField: "preset",
      name: ctx.name ? "db" : "manual",
      birthDate: ctx.birthDate ? "db" : "manual",
      clubEliteCode: ctx.clubEliteCode ? "db" : "manual",
      graduationGrade: "manual",
      activityStartDate: safeActivityStartDate ? "db" : "manual",
      activityEndDate: safeActivityEndDate ? "db" : "manual",
      activityWeeks: ctx.activityWeeks === null ? "manual" : "db",
      activityForm: "manual",
      issueDate: "db",
    },
    eligibility: {
      allowed: ctx.eligible,
      requiredOrganizationName: ELIGIBLE_ORG_NAME,
      reason: eligibilityReason,
      message: ctx.eligible
        ? null
        : `현재 활동 증명서는 ${ELIGIBLE_ORG_NAME} 소속 크루만 발급할 수 있습니다.`,
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
    limits: buildCertificateLimits(),
  };
}

export { ELIGIBLE_ORG_NAME };

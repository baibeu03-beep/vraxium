"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";
import { useModalScroll } from "@/utils/useModalScroll";
import { useDebugLayout } from "@/utils/debugLayout";
import { usePopup } from "@/components/ui/popup";
import { supabase } from "@/lib/supabase";
// QA(mode=test) API/write routing is temporarily disabled. Keep for future QA deployment reuse.
// import { parseScopeMode } from "@/lib/userScopeShared";
import { useDataMasking } from "@/hooks/useDataMasking";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import TestUserBanner from "@/components/test-user-banner/TestUserBanner";
import { DUMMY_WEEKLY_LIST, DUMMY_WEEK_EXTRA, DUMMY_WEEK_CARD } from "@/constants/dummyData";
import { isPxRoute, isEcRoute, withPxRoute, getThemeClass, getGraduationWeeksFromPathname, getRouteOrg, getCurrentOrganizationFromPathname, getOrganizationConfig } from "@/lib/cluster-route";
import { formatSeasonLabel, formatSeasonWeekTitle, resolveSeasonWeekText } from "@/lib/cluster4-types";
import { isTransitionWeek, isTransitionWeekDto, isOfficialRestWeek, weekNumberLabel, TRANSITION_WEEK_LABEL } from "@/lib/cluster4-transition-week";
import { isFadedCardStatus } from "@/lib/cluster4-faded-card";
// 클래스(직책) 표시 — 주차 당시 position_code → 라벨 단일 변환기(admin 미러 공통 모듈).
import { positionCodeToClassLabel } from "@/shared/crewClassPosition";
import { formatCrewClassDisplayLabel, toCrewClassDisplayLabel, CREW_CLASS_REGULAR, CREW_CLASS_AMBASSADOR } from "@/lib/crewClassDisplayLabel";
import { normalizePointACriterion } from "@/lib/pointACriterionLabel";
import { clampAdminOutputs, ADMIN_OUTPUT_IMAGE_MAX, ADMIN_OUTPUT_LINK_MAX } from "@/lib/cluster4-admin-output-clamp";
import { RESERVED_ADMIN_IMAGE_SLOTS } from "@/lib/cluster4OutputImages";
import { REPUTATION_KEYWORD_GROUPS } from "@/lib/reputation-keywords";
import { isAdminEmail } from "@/lib/admin";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";
import { ApiRequestError, apiErrorMessage, readJsonSafe } from "@/lib/api-response";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import DetailLogModal, { type DetailLogData, type DetailLogCondition, type DetailLogActRow, type DetailLogLineEnhancementState } from "./DetailLogModal";
import confetti from "canvas-confetti";
import HelpModalBody from "@/components/shared/HelpModalBody";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import type { AdminCluster4WeeklyCardDto, Cluster4ActLogDto, Cluster4RateDto, Cluster4WeeklyCardsResponseDto, Cluster4WeeklyLineDto, CrewWeekLineEnhancementDetailDto } from "@/shared/cluster4.contracts";
// 액트 종류(필수/선별/전원/부분) 판정 = 관리자 액트 탭과 공유하는 단일 SoT(두 repo 미러링).
import { resolveCrewActKind } from "@/shared/crewActSummary";

// 주차 결과 결정 시점 = N+1주(목) 12:01 KST = N(월) 00:00 + 10일 12시간 1분
// 이 시점에 동시에 확정:
//   - 라인 카드: '강화 대기' → '강화 성공' (이행자) — 미이행자는 진행 중 phase 부터 즉시 '강화 실패'
//   - 주차 카드: '집계 중' → '성장 성공' / '성장 실패' / '휴식(개인)' / '휴식(공식)'
// 2차 정보 / weekly_activities.deadline / opened_at+48h 는 영향을 주지 않는다 (2026 정책).
// startDate: 'YYYY-MM-DD' (KST 기준 주차 시작일, 월요일).
const computeResultDecidedMs = (startDate: string): number => {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + (10 * 24 + 12) * 3600 * 1000 + 60 * 1000;
};

// 실무 정보/라인 강화 상태·집계 마감 = 해당 주차 수요일 22:00 KST.
// = N(월) 00:00 KST + 2일 + 22시간 = weekStart + 70h.
// 백엔드 cluster4_lines.submission_closes_at(수 22:00) 정책과 동일 — 프론트 fallback 정합용.
// ※ 목요일 12:01(computeResultDecidedMs)은 주차 카드 phase·실무 경력 승격 전용이며,
//    실무 정보 상태/집계 판정에는 사용하지 않는다.
const computeLineDeadlineMs = (startDate: string): number => {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + (2 * 24 + 22) * 3600 * 1000; // 수 22:00 KST
};

interface Cluster4CardContentProps {
  weekId: string;
}

// DB에서 가져온 주차 데이터 타입
interface DBWeekData {
  id: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
  seasonLabel?: string | null;
  seasonType?: string | null;
  isBreakSeason: boolean;
  toSeasonName: string | null;
  startDate: string;
  endDate: string;
  isClubBreak: boolean;
  holidayName: string | null;
  growthStatus: string;
  // 활동 라인 단위 판정에서 사용. growthStatus 는 phase 기반(진행 중/집계 중/...)이라
  // 결과 결정 phase 이전에는 휴식 여부가 묻혀버림. 이 플래그는 phase 와 무관하게
  // '운영진이 정해둔' 휴식 여부를 그대로 유지한다.
  isPersonalRest: boolean;
  isOfficialRest: boolean;
}

interface SelectedColleague {
  id: number;
  name: string;
  gender: string;
  age: number;
  profileImg: string;
  university: string;
  major: string;
  team: string;
  part: string;
  nickname: string;
  role?: string;
  // 멤버십 등급(일반/심화) — DTO colleagueProfile.membershipLevel 와 동일 source.
  // PMS 이관 사용자는 role 이 NULL 이라, 상태칩은 membershipLevel 을 우선해야 "-" 로 비지 않는다.
  membershipLevel?: string | null;
  rank: number;
  message: string;
  createdAt?: string;
}

// 학교/학과 표시값에서 suffix 제거 함수 (라벨과 중복 방지)
const formatSchool = (value: string) => {
  if (!value || value === "-") return "-";
  if (value.endsWith("대학교")) return value.slice(0, -2); // "냥멍대학교" → "냥멍대" (+ 학교 라벨)
  if (value.endsWith("대학")) return value.slice(0, -1); // "서울대학" → "서울대" (+ 학교 라벨)
  if (value.endsWith("학교")) return value.slice(0, -2); // "OO학교" → "OO" (+ 학교 라벨)
  return value;
};

const formatMajor = (value: string) => {
  if (!value) return "-";
  const v = value.trim(); // 원본 유지, 표시 직전 공백 제거 — "법무학 " 같은 패딩값도 suffix 매칭되게
  if (!v || v === "-") return "-";
  if (v.endsWith("학과")) return v.slice(0, -2) || "-"; // "법무학과" → "법무" (+ 학과 라벨 = "법무 학과")
  if (v.endsWith("학부")) return v.slice(0, -2) || "-"; // "소프트웨어학부" → "소프트웨어" (+ 학과 라벨)
  if (v.endsWith("학")) return v.slice(0, -1) || "-"; // "법무학" → "법무" (+ 학과 라벨 = "법무 학과")
  return v;
};

// ──────────────────────────────────────────────────────────────────────────
// 인적사항 공통 표시 헬퍼 — cluster-4-card 의 "모든" 모달이 동일한 fallback 규칙으로
// 인적사항(이름/성별/나이/학교/학과/팀/파트/일반·심화/프로필이미지/태그라인)을 표시하도록
// 단일 출처로 통일한다. 각 모달이 개별 fallback 체인을 두지 않는다.
//
// source bag 한 곳에 가용한 모든 출처(계약 DTO / legacy alias / 세션 user / 주차 카드 메타)를
// 넣어주면 필드별 우선순위대로 첫 "유효값"을 고른다. "유효값"은 null/undefined/공백 및
// placeholder("-"·"—") 가 아닌 값. 값이 없으면 null 을 반환하고, placeholder 글리프(— vs -)는
// 각 렌더 사이트가 기존 디자인 그대로 결정한다(시각 회귀 방지).
type PersonalInfoSourceBag = {
  // 1순위 프로필류: Cluster4PersonProfileDto / reviewerProfile-like / 카드 객체 등
  profile?: Record<string, any> | null;
  // 2순위 user 류: session.user / legacy reviewer 행 등
  user?: Record<string, any> | null;
  // team/part alias 보강용
  weeklyCardMeta?: Record<string, any> | null;
  headerExtras?: Record<string, any> | null;
};

export type ResolvedPersonalInfo = {
  name: string | null;
  gender: string | null;
  age: number | string | null;
  school: string | null;
  department: string | null;
  team: string | null;
  part: string | null;
  membershipLevel: string | null;
  profileImageUrl: string | null;
  tagline: string | null;
};

// 첫 "유효값" 선택 — null/undefined/공백/placeholder("-"·"—") 는 건너뛴다.
const pickPersonalValue = (...candidates: Array<unknown>): string | null => {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = typeof c === "string" ? c.trim() : String(c).trim();
    if (s === "" || s === "-" || s === "—") continue;
    return s;
  }
  return null;
};

const resolvePersonalInfo = (sources: PersonalInfoSourceBag): ResolvedPersonalInfo => {
  const p = sources.profile ?? {};
  const u = sources.user ?? {};
  const meta = sources.weeklyCardMeta ?? {};
  const extras = sources.headerExtras ?? {};

  // 나이: 명시값 우선, 없으면 birthDate/birth_date 로 계산
  let age: number | string | null = pickPersonalValue(p.age, u.age);
  if (age === null) {
    const birth = pickPersonalValue(p.birthDate, p.birth_date, u.birthDate, u.birth_date);
    if (birth) {
      const birthYear = new Date(birth).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!Number.isNaN(birthYear)) age = currentYear - birthYear;
    }
  }

  return {
    name: pickPersonalValue(p.name, p.displayName, p.display_name, u.displayName, u.display_name, u.name),
    gender: pickPersonalValue(p.gender, u.gender),
    age,
    school: pickPersonalValue(p.school, p.schoolName, p.school_name, p.university, u.school, u.schoolName, u.school_name, u.university),
    department: pickPersonalValue(
      p.department, p.departmentName, p.department_name, p.major, p.major1, p.major_first,
      u.department, u.departmentName, u.department_name, u.major, u.major1, u.major_first,
    ),
    // 소속(팀/파트) = 그 카드 "주차 당시" 소속. membershipLevel(바로 아래)과 동일하게
    //   weeklyCardMeta(주차 핀 snapshot SoT)를 **최우선**으로 둔다.
    //   종전에는 profile(현재 소속)이 먼저라, 관리자가 팀 상세 [B]에서 그 주차의 소속 파트를 바꿔도
    //   카드에는 영원히 현재 파트가 보였다(2026-07-22 실측: 클래스는 반영, 소속만 미반영).
    //   meta 를 넘기지 않는 모달(연계동료/평판)은 meta={} 라 종전 profile 폴백 그대로 동작한다.
    team: pickPersonalValue(
      meta.teamName,
      p.team, p.teamName, p.team_name, u.team, u.teamName, u.team_name,
      p.currentTeamName, p.current_team_name, u.currentTeamName, u.current_team_name,
      extras.teamName,
    ),
    part: pickPersonalValue(
      meta.partName,
      p.part, p.partName, p.part_name, u.part, u.partName, u.part_name,
      p.currentPartName, p.current_part_name, u.currentPartName, u.current_part_name,
      extras.partName,
    ),
    // 멤버십 등급(badge-status) = 그 카드 "주차 당시 단계"(meta.roleLabel = 백엔드 snapshot SoT,
    //   user_position_histories 주차단위). 과거 주차 카드가 최신 profile 등급으로 덮이면 안 되므로
    //   weeklyCardMeta(주차 핀)를 최우선으로 둔다. 카드 메타가 없을 때만(레거시/미수신·타 크루 모달은
    //   meta 미전달) 기존 profile/role 폴백. (연계동료/평판 모달은 weeklyCardMeta 를 넘기지 않으므로
    //   meta={} → 이 우선분기 무영향.)
    membershipLevel: pickPersonalValue(meta.roleLabel, p.membershipLevel, p.membership_level, u.membershipLevel, u.membership_level, p.role, u.role),
    profileImageUrl: pickPersonalValue(
      p.profileImageUrl, p.profile_photo_url, p.profileImg, p.avatarUrl, p.profilePhotoUrl,
      u.profileImageUrl, u.profile_photo_url, u.profileImg, u.avatarUrl, u.image,
    ),
    tagline: pickPersonalValue(
      p.profileTagline, p.profile_tagline, u.profileTagline, u.profile_tagline,
      p.profileKeyword, p.profile_keyword, u.profileKeyword, u.profile_keyword,
      p.nickname, u.nickname, p.vision, u.vision,
    ),
  };
};

// ──────────────────────────────────────────────────────────────────────────
// 멤버십/역할/상태 라벨 공통 표시 헬퍼 — DB 원본값(membership_level / role 코드 등)을
// 화면 친화적 한글 라벨로 변환한다. cluster-4-card 의 "모든" 모달 인적사항 카드의
// badge(tag-role)·역할 표시는 이 단일 헬퍼만 사용한다.
//   ⚠ DB 원본은 변경하지 않으며(표시 시점에만 변환) 한다.
//   ⚠ 표시 어휘 SoT = lib/crewClassDisplayLabel — 화면에는 정규 / 심화(에이전트) /
//     심화(파트장) / 운영진(…) 만 나간다("일반"·홑겹 "심화" 는 내부 어휘라 노출 금지).
//     종전의 로컬 MEMBERSHIP_ROLE_LABEL_MAP 은 "일반"/"심화" 를 그대로 뱉어 폐기했다.
const formatMembershipRoleLabel = (value: string | null | undefined): string =>
  formatCrewClassDisplayLabel(value, "-");

const WORKINFO_IMAGE_SLOT_COUNT = 4;

const createEmptyWorkInfoImages = (): (string | null)[] => Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, () => null);
const createEmptyWorkInfoCaptions = (): string[] => Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, () => "");

const normalizeWorkInfoImages = (images?: (string | null)[]): (string | null)[] => Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, index) => images?.[index] || null);
const normalizeWorkInfoCaptions = (captions?: string[]): string[] => Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, index) => captions?.[index] || "");

// workCareer 전용: 이미지 3장 + 후원사 카드 1칸 (2×2 그리드 유지, index 3은 4단계에서 후원사)
const WORKCAREER_IMAGE_SLOT_COUNT = 3;
const createEmptyWorkCareerImages = (): (string | null)[] => Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }, () => null);
const createEmptyWorkCareerCaptions = (): string[] => Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }, () => "");
const normalizeWorkCareerImages = (images?: (string | null)[]): (string | null)[] => Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }, (_, index) => images?.[index] || null);
const normalizeWorkCareerCaptions = (captions?: string[]): string[] => Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }, (_, index) => captions?.[index] || "");

// 운영진 output images 정규화 — 단일 출처(weekly-cards matchedLine.outputImages)는 string[] 로 내려오고,
// legacy(weeklyActivities/careerRecords)는 { url, caption }[] 로 들어온다. 두 형태를 { url, caption } 로 통일한다.
// caption 은 어드민이 저장하지 않으므로 string URL 입력 시 빈 문자열로 둔다 (추후 백엔드 확장 시 객체 형태가 그대로 보존됨).
const normalizeOutputImages = (
  images?: ReadonlyArray<string | { url?: string | null; caption?: string | null } | null> | null,
): Array<{ url: string; caption: string }> =>
  (images ?? [])
    .map((image) =>
      typeof image === "string"
        ? { url: image, caption: "" }
        : { url: image?.url ?? "", caption: image?.caption ?? "" },
    )
    .filter((image) => image.url.trim() !== "");

// ── 예약 슬롯 조립/분리 헬퍼 (2026-07-18 예약 슬롯 모델 · lib/cluster4OutputImages 규칙의 캡션 동반 버전) ──
// 화면 슬롯 = [운영진(admin) 앞쪽 reserved 슬롯] + [크루(crew) 연속 슬롯]. 운영진 이미지가 없어도 reserved 만큼은
// 항상 예약되어 크루 이미지가 슬롯 0(1번)으로 당겨지지 않는다("크루는 2번 슬롯부터"). admin/crew URL·캡션을
// 무손실 병합/분리한다(빈 슬롯 null/"" 보존, filter/compact 로 위치 정보를 잃지 않음).
//   reserved   = 예약된 운영진 슬롯 수(개설 라인 존재 시 항상 RESERVED_ADMIN_IMAGE_SLOTS=1, 미개설 0).
//   totalSlots = 카드 유형별 화면 슬롯 수(정보/역량/경험 4, 경력 3).
// ⚠️ UI 절대 슬롯 번호(0=1번 …)와 submission 내부 배열 인덱스(크루 0=화면 2번)를 명확히 분리하기 위한 단일 경유점.
const assembleReservedImageSlots = (
  adminImages: ReadonlyArray<{ url?: string | null; caption?: string | null }>,
  crewImages: ReadonlyArray<string | null>,
  crewCaptions: ReadonlyArray<string | null>,
  reserved: number,
  totalSlots: number,
): { images: (string | null)[]; captions: string[] } => {
  const images: (string | null)[] = [];
  const captions: string[] = [];
  for (let i = 0; i < totalSlots; i++) {
    if (i < reserved) {
      images.push(adminImages[i]?.url ?? null);
      captions.push(adminImages[i]?.caption ?? "");
    } else {
      const c = i - reserved;
      images.push(crewImages[c] ?? null);
      captions.push(crewCaptions[c] ?? "");
    }
  }
  return { images, captions };
};

// 화면 슬롯 배열(admin@0..reserved-1, crew 뒤) → 저장용 크루 전용 배열. 운영진 예약 슬롯은 payload 에서 제외한다.
//   반환값이 곧 submission.outputImages(크루 제출 이미지)로 저장된다 — 운영진/빈 운영진 슬롯을 절대 포함하지 않는다.
const splitReservedImageSlots = (
  slotImages: ReadonlyArray<string | null>,
  slotCaptions: ReadonlyArray<string | null>,
  reserved: number,
): { crewImages: (string | null)[]; crewCaptions: string[] } => ({
  crewImages: slotImages.slice(reserved).map((u) => u ?? null),
  crewCaptions: slotCaptions.slice(reserved).map((c) => c ?? ""),
});

// workCareer 데모 모드 폴백 이미지 (DB 값 없을 때만 사용 — 일반 모드는 폴백 없음)
// 실제 파일: public/images/0/cluster4/icon/실무 경력/
const DEMO_COMPANY_LOGOS = ["/images/0/cluster4/icon/실무 경력/네이버 웹툰.png", "/images/0/cluster4/icon/실무 경력/씨제이.png", "/images/0/cluster4/icon/실무 경력/에스엠엔터테인먼트.png", "/images/0/cluster4/icon/실무 경력/우아한형제들.png", "/images/0/cluster4/icon/실무 경력/티비엔.png"];
const DEMO_SUPERVISOR_PHOTOS = ["/images/0/cluster4/icon/실무 경력/감독자.jpg", "/images/0/cluster4/icon/실무 경력/감독자2.png", "/images/0/cluster4/icon/실무 경력/감독자3.png", "/images/0/cluster4/icon/실무 경력/감독자4.png"];

const WORK_ABILITY_ICON_FILES = [
  "실무 역량 - default.png",
  "실무 역량 - [Job]브랜딩 마케팅.png",
  "실무 역량 - [Job]콘텐츠 마케팅.png",
  "실무 역량 - [Job]퍼포먼스 마케팅.png",
  "실무 역량 - [Reference]자유 선택.png",
  "실무 역량 - [실무 Info]마케팅 용어 & 개념.png",
  "실무 역량 - [실무 Info]인하우스 & 에이전시.png",
  "실무 역량 - [실무 기획] 온라인 마케팅.png",
  "실무 역량 - [콘텐츠] 바이럴 마케팅.png",
  "실무 역량 - [콘텐츠]시리즈_기획.png",
  "실무 역량 - [콘텐츠]시리즈_발행.png",
  "실무 역량 - [콘텐츠]시리즈_이해.png",
  "실무 역량 - [콘텐츠]시리즈_제작.png",
  "실무 역량 - 구글.png",
  "실무 역량 - 네이버.png",
  "실무 역량 - 리스틀리.png",
  "실무 역량 - 아이보스.png",
  "실무 역량 - 오픈애즈.png",
  "실무 역량 - 인스타그램.png",
  "실무 역량 - 카카오.png",
];

const stripFieldLabel = (value: string | null | undefined, labels: string[]) => {
  const text = value?.trim();
  if (!text || text === "-") return "-";
  const matchedLabel = labels.find((label) => text.endsWith(label));
  return matchedLabel ? text.slice(0, -matchedLabel.length).trim() || text : text;
};

// ============================================================================
// reputation-form 중첩 모달 — 키워드 선택 (5군락 100개)
// TODO: [백엔드 작업 필요] reputationKeywords DB를 5군락 구조로 매핑 후 대체
// ============================================================================
interface KeywordGroup {
  id: string;
  color: "blue" | "green" | "yellow" | "orange" | "red";
  emoji: string;
  title: string;
  count: number;
  keywords: string[];
}

const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: "group1",
    color: "blue",
    emoji: "🔵",
    title: "도구 · 기술 · 시스템 활용 역량",
    count: 36,
    keywords: [
      "노션 유망주",
      "노션 마스터",
      "인스타 유망주",
      "인스타 마스터",
      "유튜브 유망주",
      "유튜브 마스터",
      "AI 유망주",
      "AI 마스터",
      "블로그 유망주",
      "블로그 마스터",
      "미드저니 유망주",
      "미드저니 마스터",
      "깃업 유망주",
      "깃업 마스터",
      "노코드 유망주",
      "노코드 마스터",
      "옵시디언 유망주",
      "옵시디언 마스터",
      "파워포인트",
      "엑셀 유망주",
      "엑셀 마스터",
      "카카오 생태계",
      "네이버 생태계",
      "구글 생태계",
      "퍼블리싱",
      "UI / UX 기획",
      "웹 develop",
      "앱 develop",
      "서버 관리",
      "데이터 처리",
      "데이터 분석",
      "데이터 해석",
      "AI 프롬프트",
      "시스템 구축력",
      "도구 사용력",
      "기술 습득력",
    ],
  },
  {
    id: "group2",
    color: "green",
    emoji: "🟢",
    title: "콘텐츠 · 표현 · 메시지 생산 역량",
    count: 16,
    keywords: ["콘텐츠", "카드 콘텐츠", "텍스트 콘텐츠", "스토리텔링", "동영상 숏폼", "동영상 롱폼", "릴스 특화", "쇼츠 특화", "캐치프레이즈", "슬로건", "표현력", "언어 능력", "설득력", "상상력", "유머와 재미", "창의성"],
  },
  {
    id: "group3",
    color: "yellow",
    emoji: "🟡",
    title: "마케팅 · 확산 · 영향력 설계",
    count: 10,
    keywords: ["퍼포먼스", "브랜딩 마케팅", "바이럴 마케팅", "커뮤니티", "연관 검색어", "구글 트렌드", "정보력", "사회성", "소통력", "공감력"],
  },
  {
    id: "group4",
    color: "orange",
    emoji: "🟠",
    title: "사고 · 분석 · 구조화 역량",
    count: 16,
    keywords: ["인지력", "관찰력", "이해력", "논리력", "상황 추론력", "문제 정의력", "연구력", "업무 분석력", "업무 기획력", "계획력", "구조화", "도식화", "범위화", "항목화", "자료화", "변칙성"],
  },
  {
    id: "group5",
    color: "red",
    emoji: "🔴",
    title: "태도 · 실행 · 지속성 기반 역량",
    count: 22,
    keywords: ["지속성", "기민성", "신뢰성", "성장성", "유연성", "안정성", "위기 대응성", "학습력", "지도력", "소속감", "적극성", "자신감", "헌신성", "행동력", "회복력", "몰입력", "잠재력", "업무 진행력", "업무 관리력", "수용력", "지구력", "강인한 체력"],
  },
];

// 기업 로고 클릭 → 기업 홈페이지 1번 링크 새 탭. URL 없으면 동작 안 함.
const handleCompanyLogoClick = (e: React.MouseEvent, url: string | null | undefined) => {
  if (!url) return;
  e.stopPropagation();
  window.open(url, "_blank", "noopener,noreferrer");
};

const Cluster4CardContent = ({ weekId }: Cluster4CardContentProps) => {
  // 세션 및 본인 프로필 여부 확인
  const { data: session } = useSession();
  const { mask } = useDataMasking();
  const searchParams = useSearchParams();
  const popup = usePopup();
  // 테스트 유저 모드: ?demoUserId={userId} 가 있으면 해당 테스트 유저 기준으로 카드/저장 흐름을 렌더한다.
  const demoUserId = searchParams.get("demoUserId");
  // 표시 대상 유저: admin-view(userId) → 없으면 테스트 유저(demoUserId).
  // urlUserId 는 모든 사용자 기준 조회(프로필/career-records/평판/동료/weekly-cards)의 타깃이므로,
  // 여기서 demoUserId 로 fallback 시키면 페이지 전체가 테스트 유저 데이터로 일관되게 표시된다(혼합 방지).
  const urlUserId = searchParams.get("userId") || searchParams.get("userID") || demoUserId;
  // 조회 API 에 붙일 demoUserId 쿼리 suffix (백엔드 테스트 유저 판정용).
  const demoQS = demoUserId ? `&demoUserId=${encodeURIComponent(demoUserId)}` : "";
  // weekly-cards 모집단 스코프 suffix — mode=test 면 admin 이 테스트 모드(여름 시뮬레이션) 정책으로
  // 카드/라인을 내려준다. operating(미지정)이면 빈 문자열 → 요청 byte-identical.
  // QA(mode=test) API suffix disabled.
  // const modeQS = parseScopeMode(searchParams.get("mode")) === "test" ? "&mode=test" : "";
  const modeQS = "";
  // ── /admin/test-users 무세션 진입 시 "저장"을 테스트 유저(demoUserId) 경로로 연결 ──
  // 증상: admin test-users → 고객앱(?userId=<testUser>&mode=test, demoUserId 없음, 세션 없음) 진입 시
  //   weekly-cards 조회는 공개 프록시(userId)라 성공하지만, /api/activity-details POST 는 세션/owner 게이트
  //   (requireOwnerOrAdmin)에 걸려 401("로그인이 필요합니다") 이 떴다.
  // 해결: 테스트 스코프 + 명시적 대상 userId + 세션 없음(=test-users 진입 시그니처)일 때만, 저장 body 에
  //   demoUserId 를 그 대상 유저로 실어 백엔드의 기존 demo 경로(resolveDemoProfileUserId)로 인가한다.
  // 안전장치(백엔드 단일 출처): demoUserId 는 test_user_markers 등재 + ENABLE_DEMO_MODE 게이트를 통과해야만
  //   인정되므로(미등재 실사용자 id → 403), 실사용자 데이터로의 우회 저장은 불가능하다.
  // 세션이 있으면(일반/운영·로그인 어드민) 건드리지 않는다 → 기존 owner/admin 저장 게이트 그대로.
  const testScopeTargetUserId = searchParams.get("userId") || searchParams.get("userID");
  // QA(mode=test) write routing disabled.
  // const testScopeWriteUserId =
  //   parseScopeMode(searchParams.get("mode")) === "test" &&
  //   !demoUserId &&
  //   !session?.user?.id &&
  //   testScopeTargetUserId
  //     ? testScopeTargetUserId
  //     : null;
  const testScopeWriteUserId = null;
  // 쓰기(POST/DELETE) 시 백엔드 demo 경로로 넘길 유효 demoUserId — 명시 demoUserId 우선, 없으면 위 테스트 스코프 값.
  const effectiveDemoUserId = demoUserId || testScopeWriteUserId;
  // 네비게이션 쿼리: target(userId)·actor(demoUserId)·org 를 모두 보존한다.
  // ⚠️ 과거엔 테스트 모드에서 demoUserId 만 싣고 userId(대상자)를 떨궈, 타 크루 카드에서
  //    주차 이동/탭 전환 시 urlUserId 가 demoUserId 로 폴백되어 "내 카드로 복귀"하는 버그가 있었다.
  //    target(userId)은 항상 유지하고, demoUserId 는 actor 로만 덧붙인다(분리 유지).
  const demoUserName = searchParams.get("demoUserName");
  const userLinkQuery = (() => {
    const params = new URLSearchParams();
    if (urlUserId) params.set("userId", urlUserId);
    if (demoUserId) {
      params.set("demoUserId", demoUserId);
      params.set("admin", "true");
      if (demoUserName) params.set("demoUserName", demoUserName);
    }
    const org = searchParams.get("org");
    if (org) params.set("org", org);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();
  // EC(encre) 라우트(/cluster-4-card-ec/...) 판정 — section1-header info-group right
  // 의 단감/인절미/어흥 라벨·아이콘을 별/방패/번개로 치환할 때만 사용.
  // 숫자 값(headerDangam 등)·className·PX/default 분기는 미터치.
  const pathname = usePathname();
  const isEC = isEcRoute(pathname);
  // 조직 대표색(hex) — 오랑캐 #FAAB07 / 엥크레 #FF4B70 / 팔랑크스 #1E9503.
  // 인라인 스타일에서 org 분기 없이 골드로 박혀 있던 accent 를 본 값으로 치환한다.
  const orgAccentColor = getOrganizationConfig(getCurrentOrganizationFromPathname(pathname)).themeColor;
  // base key → EC 전용 라벨/아이콘 매핑 (Cluster4Content 의 ecIconSrcMap 과 동일 경로).
  const EC_HEADER_POINT: Record<"단감" | "인절미" | "어흥", { label: string; icon: string }> = {
    단감: { label: "별", icon: "/images/0/Graphic10.png" },
    인절미: { label: "방패", icon: "/images/0/Shield.png" },
    어흥: { label: "번개", icon: "/images/0/Graphic13.png" },
  };
  // section1-header info-group right 의 포인트 용어/아이콘은 ?org= 쿼리 기준으로 치환.
  // 라벨은 utils/orgLabelAlias 의 ORG_LABEL_ALIAS 와 동일(투구/방패/화살, 별/방패/번개),
  // 아이콘은 헤더가 <img src> 를 쓰므로 동일 의미의 PNG 경로로 매핑한다.
  // phalanx → PX 아이콘, encre → EC 아이콘, oranke·미지정 → 기본 단감/인절미/어흥.
  type HeaderPointKey = "단감" | "인절미" | "어흥";
  const ORG_HEADER_POINT: Record<string, Record<HeaderPointKey, { label: string; icon: string }>> = {
    phalanx: {
      단감: { label: "투구", icon: "/images/0/cluster 1/PX01.png" },
      인절미: { label: "방패", icon: "/images/0/cluster 1/pX02.png" },
      어흥: { label: "화살", icon: "/images/0/cluster 1/PX03.png" },
    },
    encre: EC_HEADER_POINT,
  };
  const headerOrg = searchParams.get("org");
  // pathname suffix 기반 org 폴백 — 일반 모드(쿼리 ?org= 없음)에서도
  // /cluster-4-card-planning(-px) → phalanx, -entertainment(-ec) → encre 로 치환되도록.
  // 테스트 모드(demoUserId)는 appendDemoQuery 가 ?org= 를 실어 1순위로 동작 — 양쪽 동일 결과.
  const routeOrgSlug = getRouteOrg(pathname);
  // 1순위 ?org= 쿼리(phalanx/encre) → 2순위 라우트 suffix 폴백 → 기본(단감/인절미/어흥).
  const resolveHeaderPoint = (key: HeaderPointKey): { label: string; icon: string } => {
    const byOrg =
      (headerOrg ? ORG_HEADER_POINT[headerOrg] : undefined) ??
      (routeOrgSlug ? ORG_HEADER_POINT[routeOrgSlug] : undefined);
    if (byOrg) return byOrg[key];
    if (isEC) return EC_HEADER_POINT[key];
    return { label: key, icon: `/images/0/cluster4/icon/icon - ${key}.png` };
  };
  // ?admin=true — Output Link 2차 모달 UI 테스트용 프론트 전용 override (DB/API/권한 변경 없음)
  const isAdminPreview = searchParams.get("admin") === "true";
  // SSR/client hydration 일관성을 위해 stateful — 첫 렌더 SSR=client=false, 마운트 후 localStorage 값 반영
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  // NICKNAME_COLOR_OFFSET도 Math.random() 호출이 SSR/client 다른 값을 만들어 hydration mismatch 발생 → stateful
  const [nicknameColorOffset, setNicknameColorOffset] = useState(0);
  useEffect(() => {
    // 로컬 더미(localStorage demoMode)는 테스트 유저(?demoUserId=) 모드에서는 끈다 —
    // 테스트 모드는 실제 DB 를 source of truth 로 읽어야 하므로 더미가 응답을 덮으면 안 된다.
    const demo = checkDemoMode() && !demoUserId;
    setIsDemoMode(demo);
    setIsMounted(true);
    setNicknameColorOffset(Math.floor(Math.random() * 4));
    // 번들 적용 여부 확정용 마운트 로그 — 이 로그가 안 보이면 현재 페이지가
    // 이 컴포넌트(또는 최신 빌드)를 렌더링하지 않는 것이다.
    console.log("[cluster4-canEdit] Cluster4CardContent 마운트", {
      buildMarker: "weekly-cards-canEdit-diag-v2",
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
      weekId,
      urlUserId,
      isDemoMode: demo,
      sessionUserId: session?.user?.id ?? null,
    });
  }, []);
  const NICKNAME_COLORS = ["rgba(101, 227, 255, 1)", "rgba(255, 97, 97, 1)", "rgba(157, 250, 7, 1)", "rgba(255, 234, 72, 1)"];
  const NICKNAME_COLOR_OFFSET = nicknameColorOffset;

  const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
    const t = text || "-";
    return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
  };
  // 어드민(마더) 계정은 모든 프로필 편집 가능
  // 테스트 유저(데모) 모드는 "demoUserId 유저로 로그인한 일반 고객"과 동일하게 동작해야 하므로,
  // 본인 카드(urlUserId === demoUserId)일 때만 owner 로 취급한다. userId 로 타 크루 카드를
  // 열람 중(urlUserId !== demoUserId)이면 owner 가 아니어야 위클리 평판(= 타 크루 전용 작성)
  // 흐름이 정상 동작한다. (demoUserId 만으로 무조건 owner 처리하면 타 크루 카드에서도 본인으로
  //  오인해 "주차 평판은 타 크루만이 작성할 수 있습니다" 로 잘못 막혔다.)
  const isOwner = session?.user?.isAdmin
    || (demoUserId ? urlUserId === demoUserId : (!urlUserId || session?.user?.id === urlUserId));
  // session(로그인 viewer)이 "이 페이지의 주인"인가 — 인적사항 폴백에 viewer 데이터를 쓸지 결정.
  //   본인 카드(urlUserId 없음 또는 viewer.id 와 동일)면 true. 타 크루 카드 열람이면 false →
  //   페이지 주인 프로필 로딩 전 viewer 이름이 모달에 잠깐 노출되는 것을 막는다(테스트/더미 방지).
  const sessionIsPageOwner = !urlUserId || session?.user?.id === urlUserId;
  const isAdmin = !!session?.user?.isAdmin;
  // 순수 어드민 프리뷰(admin=true 이면서 demoUserId 없음)에만 적용되는 단일 기준 플래그.
  // 테스트 유저 모드(demoUserId)는 "특정 테스트 유저로 로그인한 일반 고객 모드"와 100% 동일 경로를 타야 하므로,
  // admin=true 분기는 반드시 isAdminPreview 가 아니라 isPureAdminPreview 로만 판정한다.
  // (운영진 output image/caption 표시, 강제 편집 언락, 저장 스킵 등 모든 어드민 전용 동작의 단일 출처.)
  const isPureAdminPreview = isAdminPreview && !demoUserId;
  // 4허브 수정 버튼 강제 활성(권한 우회)은 (1) localStorage 더미 데모 모드(isDemoMode: 실제 DTO 없음),
  // (2) 순수 어드민 프리뷰(demoUserId 없는 admin=true) 에만 적용한다.
  // 테스트 유저 모드(demoUserId)는 weekly-cards DTO 의 canEdit/lineTargetId/owner 단일 기준을 그대로 따른다.
  const forceEditUnlock = isDemoMode || isPureAdminPreview;

  // ── 뷰어 ↔ 페이지 주인 분리 (테스트 유저 모드 권한 단일 기준) ──
  // 테스트 모드에서 demoUserId 는 "지금 접속한 사용자(viewer/current user)", urlUserId 는
  // "보고 있는 페이지의 주인(page owner/target)" 이다. 둘이 다르면 타 크루 카드를 열람 중인
  // 상태이므로, 정책상 위클리 평판(= 타 크루 전용 작성) 외 4허브 입력/수정은 전면 차단해야 한다.
  // ⚠️ admin=true 가 붙어도 demoUserId 가 있으면 isPureAdminPreview=false → forceEditUnlock 로
  //    우회되지 않으므로 이 가드가 admin 우회보다 우선한다(정책: admin 으로도 못 깬다).
  const viewerUserId = demoUserId || session?.user?.id || null;
  // ── 수정 권한 owner 게이트 (비로그인 / 타인 로그인 누수 차단) ──
  // 기존 isForeignViewer 는 `!!demoUserId` 를 전제로 해 "테스트 유저가 타 크루 카드를 열람"한
  // 경우만 막았다. 그 결과 다음 두 경로가 게이트를 그대로 통과했다:
  //   (1) 비로그인 뷰어(session 없음, demoUserId 없음)
  //   (2) 로그인했지만 남의 카드를 보는 실유저(session.id ≠ urlUserId, demoUserId 없음)
  // 4허브 라인 canEdit 는 "카드 주인의 submission window" 기준으로 내려오므로(뷰어와 무관),
  // 주인의 창이 열려 있으면 위 두 뷰어에게도 backendEditable=true → "수정" 버튼이 켜졌다(이번 버그).
  //
  // 정책: 수정은 "인증된(로그인 또는 테스트 유저) 뷰어가 카드 주인 본인일 때"만 가능.
  //   · 인증 = demoUserId(테스트 유저) 또는 세션 로그인이 존재.
  //   · 카드 주인 = 이 페이지 데이터가 조회된 대상 user = urlUserId, 없으면 로그인 본인(session.id).
  //   · 둘 다 non-null 이고 정확히 일치해야 함(옵셔널끼리 undefined===undefined 오탐 금지).
  //   · 세션 로딩 중에는 viewerUserId=null → 자동으로 false(수정 버튼 flash 없음).
  const isAuthenticatedViewer = !!demoUserId || !!session?.user?.id;
  const cardOwnerUserId = urlUserId || session?.user?.id || null;
  const viewerIsCardOwner =
    isAuthenticatedViewer &&
    viewerUserId != null &&
    cardOwnerUserId != null &&
    viewerUserId === cardOwnerUserId;
  // 어드민(마더) 계정은 종전 정책(line 547: "모든 프로필 편집 가능")대로 전 유저 4허브 편집 허용.
  // 단 데모(테스트 유저) 모드에선 "admin 으로도 못 깬다"(기존 정책)를 유지하려 demoUserId 없을 때만 인정.
  const adminCanEditAny = isAdmin && !demoUserId;
  // isForeignViewer = "이 뷰어는 이 카드를 소유자로서 수정할 수 없다".
  // 비로그인·타 유저 로그인·테스트 유저의 타인 카드를 모두 포함(누수 0).
  // forceEditUnlock(더미 데모 / 순수 어드민 프리뷰)은 모든 가드가 이 값보다 먼저 검사하므로
  // 종전대로 우회한다(정책 불변).
  const isForeignViewer = !(viewerIsCardOwner || adminCanEditAny);

  // ── 4허브 편집/저장/초기화 권한 단일 게이트 (weekly-cards DTO 라인 기준) ──
  // 편집 진입·수정 버튼은 이미 matchedLine.canEdit + lineTargetId(DTO)로 판정하는데,
  // 저장/초기화만 legacy canEditWork*(checkApprovalStatus && isOwner) state 를 봐서 비대칭이 있었다.
  // 그 결과 mode=test 처럼 demoUserId 가 없는 경로에서 DTO 가 canEdit:true + lineTargetId 를 내려도
  // "편집은 열리는데 저장만 막히는"(승인 팝업) 회귀가 발생했다.
  // 원칙(mode 무관, 하드코딩 우회 금지): DTO 가 canEdit:true + lineTargetId 를 주면 저장 가능.
  //  · forceEditUnlock(localStorage 더미 / 순수 어드민 프리뷰)은 백엔드 게이팅 우회 — 기존 동작 유지.
  //  · isForeignViewer(demoUserId 로 타 크루 카드 열람)는 정책상 전면 차단 — 기존 동작 유지.
  // 최종 권한 검증은 저장 API(백엔드)가 그대로 수행한다(프론트는 단일 출처 정렬만).
  const isLineEditableByDto = (matchedLine: Cluster4WeeklyLineDto | null | undefined): boolean => {
    if (forceEditUnlock) return true;
    if (isForeignViewer) return false;
    const lineTargetId = (matchedLine?.lineTargetId as string | null | undefined) ?? null;
    return matchedLine?.canEdit === true && !!lineTargetId;
  };

  // [진단] 테스트 유저 모드 위클리 리뷰 버튼 활성화 추적 — 콘솔에서 런타임 값 확인용.
  // 버튼 disabled 는 `!isOwner` 단일 조건이므로 isOwner=true 면 활성이어야 한다.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[weekly-review-button-diag]", {
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
      rawQuery: typeof window !== "undefined" ? window.location.search : null,
      demoUserId,
      urlUserId,
      sessionUserId: session?.user?.id ?? null,
      sessionIsAdmin: !!session?.user?.isAdmin,
      isOwner,
      weeklyReviewEditButtonDisabled: !isOwner,
      weekId,
      permissionUrl: apiUrl(
        `/api/edit-windows/permission?resource_key=cluster4.weekly_reviews` +
          (weekId ? `&week_id=${encodeURIComponent(weekId)}` : ""),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoUserId, urlUserId, session?.user?.id, session?.user?.isAdmin, isOwner, weekId]);

  // 로그인한 본인의 display_name (From 라벨 등에 사용)
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  // 주차 리뷰 모달 인적사항 카드용 프로필 (페이지 주인 기준 — urlUserId 우선, 없으면 본인)
  const [reviewerProfile, setReviewerProfile] = useState<{
    displayName: string;
    profilePhotoUrl: string;
    gender: string;
    age: number | null;
    school: string;
    major: string;
    vision: string;
    tagline: string;
  }>({ displayName: "", profilePhotoUrl: "", gender: "", age: null, school: "", major: "", vision: "", tagline: "" });

  useEffect(() => {
    // urlUserId 가 있으면 비로그인이라도 공개 프로필을 표시할 수 있도록 fetch.
    // (서버에서 비로그인이면 자동 마스킹되므로 안전.)
    const targetId = urlUserId || session?.user?.id;
    if (!targetId) return;
    // 페이지 주인(targetId)이 바뀌면 직전 크루의 프로필을 즉시 비운다 — 새 프로필 도착 전까지
    // 모달/인적사항 카드가 "이전에 보던 크루(예: 테스트 계정) 이름"을 잠깐 노출하지 않도록 한다.
    // (빈 값이면 화면은 "—" placeholder 로 떨어지고, 실제 데이터 도착 시에만 채워진다.)
    setReviewerProfile({ displayName: "", profilePhotoUrl: "", gender: "", age: null, school: "", major: "", vision: "", tagline: "" });
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, eduRes] = await Promise.all([fetch(`/api/profile/?userId=${targetId}${demoQS}`), fetch(`/api/educations?userId=${targetId}`)]);
        const profileJson = await profileRes.json().catch(() => null);
        const eduJson = await eduRes.json().catch(() => null);
        if (cancelled) return;

        const p = profileJson?.data;
        if (p?.display_name) setMyDisplayName(p.display_name);

        const eduFirst = Array.isArray(eduJson?.data) && eduJson.data.length > 0 ? eduJson.data[0] : null;

        let age: number | null = null;
        if (p?.birth_date) {
          const birthYear = new Date(p.birth_date).getFullYear();
          const currentYear = new Date().getFullYear();
          if (!Number.isNaN(birthYear)) age = currentYear - birthYear;
        }

        setReviewerProfile({
          displayName: p?.display_name || "",
          profilePhotoUrl: p?.profile_photo_url || "",
          gender: p?.gender || "",
          age,
          school: eduFirst?.school || "",
          major: eduFirst?.major1 && eduFirst.major1 !== "-" ? eduFirst.major1 : "",
          vision: p?.vision || "",
          // 태그라인: 계약 키(profile_tagline) → keyword(legacy) → nickname → vision 순으로 보강.
          // (실제 표시 우선순위는 resolvePersonalInfo 가 결정 — 여기서는 source 확보용으로 모은다.)
          tagline: p?.profile_tagline || p?.profileTagline || p?.profile_keyword || p?.profileKeyword || p?.nickname || p?.vision || "",
        });
      } catch {
        // 무시 — fallback으로 session.user.name 사용
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, urlUserId]);

  // 어드민이 다른 유저 편집 시 targetUserId를, 테스트 유저 모드면 demoUserId를 API URL에 추가
  const apiUrl = (path: string) => {
    const separator = path.includes("?") ? "&" : "?";
    if (demoUserId) {
      return `${path}${separator}demoUserId=${encodeURIComponent(demoUserId)}`;
    }
    if (urlUserId && session?.user?.isAdmin) {
      return `${path}${separator}targetUserId=${urlUserId}`;
    }
    return path;
  };

  // 승인 상태 확인 함수
  const checkApprovalStatus = async () => {
    if (!session) return false;

    try {
      const response = await fetch("/api/auth/check-status");
      const result = await response.json();

      if (result.success && result.status === "approved") {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("승인 상태 확인 오류:", error);
      return false;
    }
  };

  // 수정 버튼 클릭 핸들러 (승인 상태 체크)
  const handleEditClick = async (openModalFn: () => void) => {
    if (isDemoMode || demoUserId) {
      openModalFn();
      return;
    } // 더미 모드 / 테스트 유저(데모) 모드: 세션 체크 스킵 (저장은 demoUserId 로 백엔드 검증)
    if (!session) {
      await popup.alert("로그인이 필요합니다.");
      return;
    }

    // 어드민(마더) 계정은 승인 체크 건너뛰기
    if (session.user?.isAdmin) {
      openModalFn();
      return;
    }

    const approved = await checkApprovalStatus();

    if (!approved) {
      await popup.alert("아직 회원 상태가 어드민 승인 대기 중입니다.");
      return;
    }

    openModalFn();
  };

  // DB에서 가져온 주차 데이터 상태
  const [weekData, setWeekData] = useState<DBWeekData | null>(null);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);

  // 주차 결과 결정 시점 (N+1주(목) 12:01 KST) 도달 여부.
  // 라인 카드 '강화 대기 → 강화 성공' 과 주차 카드 '집계 중 → 성장 성공/실패/휴식' 이 동시에 확정.
  // 2차 정보 작성 여부는 강화 판정에 영향을 주지 않는다 (2026 정책).
  const resultsDecided = !!(weekData?.startDate && Date.now() >= computeResultDecidedMs(weekData.startDate));

  // 실무 정보/라인 강화 마감(해당 주차 수 22:00 KST) 도달 여부.
  // 실무 정보 상태(getEnhancementStatus) / 강화 성공 집계(isEnhancementSuccess·recalculateStats)는
  // resultsDecided(목 12:01)가 아니라 이 플래그를 기준으로 success/fail 을 가른다.
  const lineDeadlinePassed = !!(weekData?.startDate && Date.now() >= computeLineDeadlineMs(weekData.startDate));

  // 팀/파트/역할/포인트 데이터 상태
  const [teamName, setTeamName] = useState<string | null>(null);
  const [partName, setPartName] = useState<string | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [managedTeamName, setManagedTeamName] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  // 해당 주차 시점의 raw 역할 코드 (예: crew_partleader / crew_agent / crew_regular ...) — 매니징 라인 적용 여부 판단용
  const [userWeekRole, setUserWeekRole] = useState<string | null>(null);
  // 멤버십 등급 (profile.membership_level) — 이력서 카드 "심화/일반/운영진" 표시와 동일 source.
  // 실무 경험 관리(5번) 슬롯 잠금 판단을 이력서 표시와 일치시키기 위해 사용.
  const [membershipLevel, setMembershipLevel] = useState<string | null>(null);
  const [weekPoints, setWeekPoints] = useState<{ star: number; lightning: number; shield: number }>({ star: 0, lightning: 0, shield: 0 });
  const [cumulativeApprovedWeeks, setCumulativeApprovedWeeks] = useState<number>(0);

  // 이전/다음 주차 ID
  const [prevWeekId, setPrevWeekId] = useState<string | null>(null);
  const [nextWeekId, setNextWeekId] = useState<string | null>(null);

  // 현재 유저 ID (저장 시 사용)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // 카드 소유자(현재 보고 있는 프로필)의 조직 slug — 연계동료 후보를 동일 조직으로 제한하는
  // 필터 기준. 로그인 사용자가 아니라 "이 카드의 주인" 기준이다(어드민이 타 크루 카드를 봐도
  // 그 크루의 조직 후보만 노출). /api/profile?context=card 응답의 data.organization_slug.
  // 내부 slug(phalanx/encre/oranke) 이며 /api/crews?org= 가 그대로 받는 값이다.
  const [cardOwnerOrg, setCardOwnerOrg] = useState<string | null>(null);

  // 주간 활동 데이터 (실무정보 모달용)
  interface WeeklyActivity {
    id: string;
    activity_type_id: string;
    title: string | null;
    is_active: boolean;
    opened_at: string | null;
    deadline?: string | null; // 어드민 직접 지정 마감 (옵션 — 없으면 시스템 기본 N+1주(목) 12:00 KST)
    output_links: OutputLink[] | null; // 운영진이 입력한 output links
    output_images?: Array<{ url: string; caption: string }> | null; // 운영진이 업로드한 이미지 (정책: 최대 1)
    team_id?: string | null; // 실무경험만 NOT NULL
  }
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>([]);

  // 유저 활동 데이터 (강화 성공 집계용)
  interface UserActivity {
    id: string;
    weekly_activity_id: string;
    status: string;
    activity_type_id?: string;
  }
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);

  // 파트별 강화 집계 (P: 열린 총 활동 수, R: 강화 성공 수)
  interface PracticalStats {
    total: number; // P
    success: number; // R
  }
  const [infoStats, setInfoStats] = useState<PracticalStats>({ total: 0, success: 0 });
  const [competencyStats, setCompetencyStats] = useState<PracticalStats>({ total: 0, success: 0 });
  const [experienceStats, setExperienceStats] = useState<PracticalStats>({ total: 0, success: 0 });
  const [careerStats, setCareerStats] = useState<PracticalStats>({ total: 0, success: 0 });

  // 강화 상태 판단용 (해당 주차 데이터)
  interface ActivityRecord {
    week_id: string;
    activity_type_id: string;
    is_completed: boolean;
  }
  const [weekActivityRecords, setWeekActivityRecords] = useState<ActivityRecord[]>([]);
  const [weekApprovedTypes, setWeekApprovedTypes] = useState<Set<string>>(new Set());

  // 2차 정보 (서브타이틀, 아웃풋링크) - 해당 주차 데이터
  interface OutputLink {
    desc: string;
    url: string;
  }
  interface ActivityDetail {
    week_id: string;
    activity_type_id: string;
    sub_title: string | null;
    output_links: OutputLink[] | null;
    growth_point?: string | null;
    image_urls?: (string | null)[] | null;
    image_captions?: string[] | null;
  }
  const [weekActivityDetails, setWeekActivityDetails] = useState<ActivityDetail[]>([]);

  // 활동별 평점 (activity_type_id → points)
  const [activityRatings, setActivityRatings] = useState<Map<string, number>>(new Map());

  // 어드민 개별 권한 부여 (secondary_info_grants)
  interface SecondaryInfoGrant {
    activity_type_id: string;
    deadline: string;
  }
  const [secondaryInfoGrants, setSecondaryInfoGrants] = useState<SecondaryInfoGrant[]>([]);

  // DB에서 가져온 activity_types 정보
  interface ActivityTypeInfo {
    id: string;
    name: string;
    line_code: string;
    cluster_id: string;
    description: string | null;
    reward_star?: number; // 라인 이행 시 기본 보상 — 평점 표시 시 차감용
  }
  const [activityTypesMap, setActivityTypesMap] = useState<Map<string, ActivityTypeInfo>>(new Map());
  const [competencyTypeIds, setCompetencyTypeIds] = useState<string[]>([]);
  const [experienceTypeIds, setExperienceTypeIds] = useState<string[]>([]);
  const [careerTypeIds, setCareerTypeIds] = useState<string[]>([]);

  // 실무 경험 활동 타입 상세 정보 (주차별 eligible 조건 포함) - cluster-4-1과 동일
  interface ExperienceTypeInfo {
    id: string;
    eligible_min_approved_weeks: number | null;
    eligible_max_approved_weeks: number | null;
    count_once_in_total: boolean;
  }
  const [experienceTypeInfos, setExperienceTypeInfos] = useState<ExperienceTypeInfo[]>([]);

  // 유저의 모든 완료된 활동 기록 (experience eligible 체크용) - cluster-4-1과 동일
  const [allUserCompletedActivities, setAllUserCompletedActivities] = useState<{ week_id: string; activity_type_id: string }[]>([]);

  // 온보딩 주차 여부 (1주차는 클럽 온보딩 주차로 강화 해당 없음)
  const [isOnboardingWeek, setIsOnboardingWeek] = useState<boolean>(false);

  // DB에서 가져온 실무 경력 데이터 (프로젝트 기반)
  interface CareerRecord {
    // 프로젝트 정보
    id: string;
    project_id: string;
    week_id: string;
    company_name: string;
    company_logo_url: string | null;
    job_position: string;
    project_name: string | null;
    project_description: string | null;
    line_code: string | null;
    line_name: string | null;
    output_links: { desc: string; url: string }[] | null;
    output_images?: { url: string; caption: string }[] | null;
    company_homepage_links?: string[] | null;
    secondary_info_deadline: string | null;
    created_at: string;
    weeks?: {
      id: string;
      week_number: number;
      start_date: string;
      end_date: string;
      season_id: string;
      seasons?: {
        id: string;
        year: number;
        name: string;
      };
    };
    // 사용자 기록 상태
    record_id: string | null;
    user_id: string;
    enhancement_status: "not_applicable" | "pending" | "enhanced" | "failed";
    grade: string | null;
    grade_points: number | null;
    career_code: string | null;
    // 감독자 정보
    supervisor_name: string | null;
    supervisor_position: string | null;
    supervisor_department: string | null;
    supervisor_company: string | null;
    supervisor_profile_img: string | null;
  }

  const makeDemoCareer = (index: number, company: string, status: string, grade: string, participated: boolean): CareerRecord => ({
    id: `cr-demo-${index}`,
    project_id: `p-demo-${index}`,
    week_id: "demo",
    company_name: company,
    company_logo_url: `/images/0/cluster4/icon/실무 경력/감독자${index % 2 === 0 ? "" : "2"}.${index % 2 === 0 ? "jpg" : "png"}`,
    job_position: `${company} 마케팅`,
    project_name: `${company} ${participated ? "마케팅 캠페인 기획 및 실행 프로젝트" : "해당 프로젝트"}`,
    project_description: participated
      ? ["짧은 설명", "마케팅 캠페인 전략", "소셜미디어 채널별 바이럴 콘텐츠 전략 수립 및 성과 분석", "브랜드 스토리텔링의 핵심 요소와 소비자 인식 변화에 대한 에세이 작성 및 결과물 정리 보고서 작성까지", "퍼포먼스 마케팅 ROAS 분석", `${company}에서 진행한 마케팅 프로젝트의 상세 설명입니다`][
          index % 6
        ]
      : null,
    line_code: `${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index + 1) % 26))}${10 + index}-${10000 + index}`,
    line_name: `${company} 마케팅`,
    output_links: [],
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: `r-demo-${index}`,
    user_id: "u1",
    enhancement_status: status as CareerRecord["enhancement_status"],
    grade: grade || null,
    grade_points: participated ? Math.floor(Math.random() * 100) : 0,
    career_code: `${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index + 1) % 26))}${10 + index}-${10000 + index}`,
    supervisor_name: ["김민지", "박서연", "조워싱턴", "이지은", "최수현"][index % 5],
    supervisor_position: ["대리", "과장", "팀장", "차장", "부장"][index % 5],
    supervisor_department: `${company} 마케팅팀`,
    supervisor_company: company,
    supervisor_profile_img: `/images/0/cluster4/icon/실무 경력/감독자${index % 2 === 0 ? "" : "2"}.${index % 2 === 0 ? "jpg" : "png"}`,
  });

  const getDemoCareerRecords = (wId: string): CareerRecord[] => {
    const weekNum = parseInt(wId.replace(/\D/g, "")) || 0;
    const caseNum = weekNum % 6;
    switch (caseNum) {
      case 0:
        return [];
      case 1:
        return [makeDemoCareer(1, "네이버", "enhanced", "S", true), makeDemoCareer(2, "일이삼사오육칠팔구십일이삼사오육칠팔구십일이삼사오육칠팔구십", "enhanced", "A", true), makeDemoCareer(3, "라인", "not_applicable", "", false), makeDemoCareer(4, "쿠팡", "not_applicable", "", false)];
      case 2:
        return [
          makeDemoCareer(1, "삼성전자", "not_applicable", "", false),
          makeDemoCareer(2, "LG전자", "not_applicable", "", false),
          makeDemoCareer(3, "SK하이닉스", "not_applicable", "", false),
          makeDemoCareer(4, "현대자동차", "not_applicable", "", false),
          makeDemoCareer(5, "KT", "not_applicable", "", false),
          makeDemoCareer(6, "POSCO", "not_applicable", "", false),
        ];
      case 3:
        return [
          makeDemoCareer(1, "구글코리아", "enhanced", "S", true),
          makeDemoCareer(2, "애플코리아", "enhanced", "A", true),
          makeDemoCareer(3, "마이크로소프트", "enhanced", "B", true),
          makeDemoCareer(4, "아마존웹서비스", "pending", "C", true),
          makeDemoCareer(5, "메타코리아", "enhanced", "A", true),
          makeDemoCareer(6, "테슬라코리아", "not_applicable", "", false),
          makeDemoCareer(7, "엔비디아", "not_applicable", "", false),
        ];
      case 4:
        return Array.from({ length: 15 }, (_, i) => {
          const companies = ["우아한형제들", "토스", "당근마켓", "비바리퍼블리카", "야놀자", "NHN", "넷마블", "엔씨소프트", "크래프톤", "스마일게이트", "하이브", "JYP", "YG", "CJ ENM", "롯데이노베이트"];
          const isP = i < 10;
          return makeDemoCareer(i + 1, companies[i], isP ? (i % 3 === 0 ? "enhanced" : i % 3 === 1 ? "pending" : "failed") : "not_applicable", isP ? ["S", "A", "B", "C", "D"][i % 5] : "", isP);
        });
      case 5:
        return [makeDemoCareer(1, "스타벅스코리아", "enhanced", "S", true)];
      default:
        return [];
    }
  };

  const getDemoSectionStates = (wId: string) => {
    const weekNum = parseInt(wId.replace(/\D/g, "")) || 0;
    const caseNum = weekNum % 10;
    return {
      competencyParticipated: ![3, 0].includes(caseNum),
      isRestWeek: [5, 7, 9].includes(caseNum),
      careerCase: caseNum,
    };
  };

  // 데모 모드 — 주차별 활동 레코드 (역량/경험 강화실패 분산)
  const getDemoActivityRecords = (wId: string): ActivityRecord[] => {
    const weekNum = parseInt(wId.replace(/\D/g, "")) || 0;
    const caseNum = weekNum % 10;
    const infoTypes = ["wisdom", "essay", "infodesk", "calendar", "forum", "session", "practical_lecture", "community", "etc_a"];

    // 실무 정보 레코드 — 전 주차 공통 (기본 is_completed: true)
    const infoRecords: ActivityRecord[] = infoTypes.map((t) => ({ week_id: wId, activity_type_id: t, is_completed: true }));

    // 실무 역량 — 주차별 분기
    const compCompleted = (() => {
      if ([3, 0].includes(caseNum)) return false; // 미참여 → 강화 실패
      if ([6].includes(caseNum)) return false; // 참여했지만 강화 실패
      return true;
    })();
    const compRecords: ActivityRecord[] = ["comp-1", "comp-2", "comp-3", "comp-4"].map((t) => ({
      week_id: wId,
      activity_type_id: t,
      is_completed: compCompleted,
    }));
    // comp-5는 보이드 (레코드 없음)

    // 실무 경험 — 주차별 분기
    const expStatuses: boolean[] = (() => {
      if ([3, 0].includes(caseNum)) return [false, false, false, false]; // 전부 실패
      if ([2].includes(caseNum)) return [true, true, false, false]; // 일부 성공, 일부 실패
      if ([6].includes(caseNum)) return [true, false, true, false]; // 일부 대기, 일부 실패
      return [true, true, true, true]; // 전부 성공
    })();
    const expRecords: ActivityRecord[] = ["exp-1", "exp-2", "exp-3", "exp-4"].map((t, i) => ({
      week_id: wId,
      activity_type_id: t,
      is_completed: expStatuses[i] ?? true,
    }));

    return [...infoRecords, ...compRecords, ...expRecords];
  };

  // 운영 데이터: /api/career-records 응답으로 채워진다. 로딩 전에는 빈 배열 →
  //   화면은 빈 상태(careerRecords.length > 0 ? ... : empty)를 렌더. 더미 초기값 금지.
  //   (데모 모드에서는 isDemoMode 분기에서 DUMMY_WEEK_CARD/getDemoCareerRecords 로 주입)
  const [careerRecords, setCareerRecords] = useState<CareerRecord[]>([]);
  const [isLoadingCareerRecords, setIsLoadingCareerRecords] = useState(false);
  const [careerPage, setCareerPage] = useState(0);

  // 모달 편집 상태 (activity_type_id별로 관리)
  const [editingDetails, setEditingDetails] = useState<{
    [activityType: string]: {
      subTitle: string;
      outputLinks: OutputLink[];
    };
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  // activity_type_id별 파트 분류 (기본값 - DB에서 가져온 후 업데이트됨)
  const infoTypes = ["calendar", "essay", "forum", "infodesk", "session", "wisdom", "practical_lecture", "community", "etc_a"];
  // competencyTypes, experienceTypes, careerTypes는 이제 state로 관리됨

  // 역할/멤버십 라벨 매핑은 모듈 레벨 formatMembershipRoleLabel 단일 헬퍼로 통일.

  // 실무 역량 아이콘 매핑 (activity_type_id → 이미지 파일명)
  const competencyIconMap: { [key: string]: string } = {
    contents_series_understanding: "실무 역량 - [콘텐츠]시리즈_이해.png",
    contents_series_planning: "실무 역량 - [콘텐츠]시리즈_기획.png",
    contents_series_production: "실무 역량 - [콘텐츠]시리즈_제작.png",
    contents_series_publish: "실무 역량 - [콘텐츠]시리즈_발행.png",
    contents_viral_marketing: "실무 역량 - [콘텐츠] 바이럴 마케팅.png",
    job_contents_marketing: "실무 역량 - [Job]콘텐츠 마케팅.png",
    job_performance_marketing: "실무 역량 - [Job]퍼포먼스 마케팅.png",
    job_branding_marketing: "실무 역량 - [Job]브랜딩 마케팅.png",
    practical_info_inhouse_agency: "실무 역량 - [실무 Info]인하우스 & 에이전시.png",
    practical_info_marketing_terms: "실무 역량 - [실무 Info]마케팅 용어 & 개념.png",
    practical_resource_iboss: "실무 역량 - 아이보스.png",
    work_resource_openads: "실무 역량 - 오픈애즈.png",
    work_resource_free_choice: "실무 역량 - [Reference]자유 선택.png",
    practical_skill_google: "실무 역량 - 구글.png",
    practical_skill_listly: "실무 역량 - 리스틀리.png",
    practical_skill_kakao: "실무 역량 - 카카오.png",
    practical_skill_naver: "실무 역량 - 네이버.png",
    reference_instagram: "실무 역량 - 인스타그램.png",
    reference_naver: "실무 역량 - 네이버.png",
    reference_free_choice: "실무 역량 - [Reference]자유 선택.png",
    practical_planning_online_marketing: "실무 역량 - [실무 기획] 온라인 마케팅.png",
    "comp-1": "실무 역량 - [실무 Info]인하우스 & 에이전시.png",
  };

  // 실무 역량 아이콘 경로 가져오기 헬퍼 함수
  const getCompetencyIconPath = (activityTypeId: string): string => {
    const fileName = competencyIconMap[activityTypeId];
    if (fileName) {
      return `/images/0/cluster4/icon/실무 역량/${fileName}`;
    }
    return "/images/0/cluster4/icon/실무 역량/실무 역량 - default.png";
  };

  // 실무 경험 아이콘 매핑 (activity_type_id → 이미지 파일명)
  const experienceIconMap: { [key: string]: string } = {
    career_marketer_launch: "실무 경험 - [커리어]마케터 Launch.png",
    productivity_feedback: "실무 경험 - [생산성]상호 피드백.png",
    contents_marketing_practical: "실무 경험 - [콘텐츠]마케팅 실무.png",
    performance_marketing_practical: "실무 경험 - [퍼포먼스]마케팅 실무.png",
    "exp-1": "실무 경험 - [커리어]마케터 Launch.png",
    "exp-2": "실무 경험 - [생산성]상호 피드백.png",
    "exp-3": "실무 경험 - [콘텐츠]마케팅 실무.png",
    "exp-4": "실무 경험 - [퍼포먼스]마케팅 실무.png", // TODO: 더미 데이터 — DB 연동 후 제거
  };

  // 실무 경험 아이콘 경로 가져오기 헬퍼 함수
  const getExperienceIconPath = (activityTypeId: string): string => {
    const fileName = experienceIconMap[activityTypeId];
    if (fileName) {
      return `/images/0/cluster4/icon/실무 경험/${fileName}`;
    }
    return "/images/0/cluster4/icon/2 실무 경험.png";
  };

  // workExp 모달 전용: 라인명 → 아이콘 파일 매칭 (부분 키워드 매칭)
  // 실제 파일: [매니징] 파트장.png / [매니징] 에이전트.png / 실무 경험 - [커리어|생산성|콘텐츠|퍼포먼스]...png
  const getWorkExpIcon = (lineName: string): string => {
    const basePath = "/images/0/cluster4/icon/실무 경험/";
    const fallbackIcon = "/images/0/cluster4/icon/2 실무 경험.png";
    if (!lineName) return fallbackIcon;

    // 매니징 라인은 파트장/에이전트로 세부 분기 (파일명 네이밍이 다름)
    if (lineName.includes("매니징")) {
      if (lineName.includes("파트장")) return basePath + "[매니징] 파트장.png";
      if (lineName.includes("에이전트")) return basePath + "[매니징] 에이전트.png";
    }

    // 카테고리 키워드 → 실제 파일명 매칭
    const keywordMap: Record<string, string> = {
      커리어: "실무 경험 - [커리어]마케터 Launch.png",
      생산성: "실무 경험 - [생산성]상호 피드백.png",
      콘텐츠: "실무 경험 - [콘텐츠]마케팅 실무.png",
      퍼포먼스: "실무 경험 - [퍼포먼스]마케팅 실무.png",
    };
    for (const [keyword, file] of Object.entries(keywordMap)) {
      if (lineName.includes(keyword)) return basePath + file;
    }

    return fallbackIcon;
  };

  // 시즌 이름 변환 맵
  const seasonNameMap: { [key: string]: string } = {
    spring: "봄",
    summer: "여름",
    fall: "가을",
    winter: "겨울",
  };

  // 날짜 포맷 함수 (2026-01-05 → 2026 - 01 - 05 (월))
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dayOfWeek = days[date.getDay()];
    return `${year} - ${month} - ${day} (${dayOfWeek})`;
  };

  const compactPersonalTag = (value: string | null | undefined, fallback: string): string => {
    return (value || fallback).replace(/\s+/g, "");
  };

  // reputation-view-modal 최하단 타임스탬프 — YY. MM. DD(요일)  HH:MM
  // TODO: [백엔드 작업 필요] weeklyReputations에 created_at 필드 추가 시 자동 동작
  const formatReputationTime = (timestamp: string | undefined | null): string => {
    const placeholder = "00. 00. 00(0)  00:00"; // 사용자 요청: 데이터 없을 때 공간 유지
    if (!timestamp) return placeholder;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return placeholder;
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const day = days[d.getDay()];
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}. ${mm}. ${dd}(${day})  ${hh}:${mi}`;
  };

  // DB에서 주차 데이터 및 관련 정보 가져오기
  useEffect(() => {
    // 마운트 전엔 isDemoMode가 확정되지 않았으므로 아무것도 안 함 (SSR/client hydration 일관성)
    if (!isMounted) return;
    if (isDemoMode) {
      // weekId로 공유 더미 데이터 조회 (cluster-4 시즌 페이지와 동기화)
      const dummyWeek = DUMMY_WEEKLY_LIST.find((w) => w.id === weekId);
      const dummyExtra = DUMMY_WEEK_EXTRA[weekId];

      if (dummyWeek) {
        setWeekData({
          id: dummyWeek.id,
          weekNumber: dummyWeek.weekNumber,
          seasonYear: dummyWeek.seasonYear,
          seasonName: dummyWeek.seasonName,
          isBreakSeason: dummyWeek.isBreakSeason,
          toSeasonName: dummyWeek.toSeason,
          startDate: dummyWeek.startDate,
          endDate: dummyWeek.endDate,
          isClubBreak: dummyWeek.isClubBreak,
          holidayName: dummyWeek.holidayName,
          growthStatus: dummyWeek.growthStatus,
          isPersonalRest: dummyWeek.growthStatus === "휴식(개인)",
          isOfficialRest: dummyWeek.growthStatus === "휴식(공식)" || dummyWeek.isBreakSeason,
        });
      } else {
        setWeekData({
          id: "demo-week",
          weekNumber: 3,
          seasonYear: 2025,
          seasonName: "여름",
          isBreakSeason: false,
          toSeasonName: null,
          startDate: "2025-03-23",
          endDate: "2025-03-30",
          isClubBreak: false,
          holidayName: null,
          growthStatus: "성공",
          isPersonalRest: false,
          isOfficialRest: false,
        });
      }

      if (dummyExtra) {
        setTeamName(dummyExtra.teamPart.teamName);
        setPartName(dummyExtra.teamPart.partName);
        setRoleLabel(dummyExtra.roleLabel);
        setWeekPoints(dummyExtra.points);
      }

      // Phase 1 (dw-01 외부 파일 이관): DUMMY_WEEK_CARD에 해당 주차가 있으면 외부 데이터 사용.
      // 없으면 기존 getDemoCareerRecords/getDemoActivityRecords로 fallback.
      const cardData = DUMMY_WEEK_CARD[weekId];
      if (cardData) {
        setWeeklyActivities(cardData.weeklyActivities);
        setWeekActivityDetails(cardData.weekActivityDetails);
        setWeekActivityRecords(cardData.weekActivityRecords);
        setCareerRecords(cardData.careerRecords);
      } else {
        // fallback: 기존 로직
        setCareerRecords(getDemoCareerRecords(weekId));
        setWeekActivityRecords(getDemoActivityRecords(weekId));
      }

      // 데모 모드: activity_types 관련 state (DB 경로에서만 조회되므로 데모 모드에서 수동 세팅)
      setCompetencyTypeIds(["comp-1", "comp-2", "comp-3", "comp-4", "comp-5"]);
      setExperienceTypeIds(["exp-1", "exp-2", "exp-3", "exp-4"]);
      setActivityTypesMap(
        new Map<string, ActivityTypeInfo>([
          ["comp-1", { id: "comp-1", name: "[실무 Info]일이삼사오육칠팔구십일이삼사오육칠팔구십일이삼사오육칠팔구십일이삼사오육칠팔구십일이삼사오육칠팔구십", line_code: "CP09 - UN010", cluster_id: "practical_competency", description: null }],
          ["comp-2", { id: "comp-2", name: "[실무 Info]마케팅", line_code: "CP02 - MK001", cluster_id: "practical_competency", description: null }],
          ["comp-3", { id: "comp-3", name: "[실무 Info]인하우스 & 에이전시 [실무 Info]인하우스 & 에이전시 [실무 Info]인하우스 & 에이전시 [실무 Info]인하우스 & 에이전시", line_code: "CP03 - HA001", cluster_id: "practical_competency", description: null }],
          ["comp-4", { id: "comp-4", name: "[실무 Info]가나다라마바사아자차카타파하가나다라마바사", line_code: "CP04 - LG001", cluster_id: "practical_competency", description: null }],
          ["comp-5", { id: "comp-5", name: "-", line_code: "-", cluster_id: "practical_competency", description: null }],
          ["exp-1", { id: "exp-1", name: "[커리어]일이삼사오육칠팔구십 일이삼사오육칠팔구십", line_code: "EX01 - SFA01", cluster_id: "practical_experience", description: null }],
          ["exp-2", { id: "exp-2", name: "[생산성]상호 피드백", line_code: "EX02 - RUA99", cluster_id: "practical_experience", description: null }],
          ["exp-3", { id: "exp-3", name: "[콘텐츠]", line_code: "EX03 - RUA99", cluster_id: "practical_experience", description: null }],
          ["exp-4", { id: "exp-4", name: "[퍼포먼스]마케팅 실무", line_code: "EX04 - PMP01", cluster_id: "practical_experience", description: null }],
        ]),
      );
      setExperienceTypeInfos([
        { id: "exp-1", eligible_min_approved_weeks: null, eligible_max_approved_weeks: null, count_once_in_total: false },
        { id: "exp-2", eligible_min_approved_weeks: null, eligible_max_approved_weeks: null, count_once_in_total: false },
        { id: "exp-3", eligible_min_approved_weeks: null, eligible_max_approved_weeks: null, count_once_in_total: false },
        { id: "exp-4", eligible_min_approved_weeks: null, eligible_max_approved_weeks: null, count_once_in_total: false },
      ]);

      setCareerPage(0);

      // 이전/다음 주차 ID 설정 (내림차순: index-1 = 더 최근(다음), index+1 = 더 과거(이전))
      const weekIndex = DUMMY_WEEKLY_LIST.findIndex((w) => w.id === weekId);
      if (weekIndex >= 0) {
        if (weekIndex > 0) setNextWeekId(DUMMY_WEEKLY_LIST[weekIndex - 1].id);
        if (weekIndex < DUMMY_WEEKLY_LIST.length - 1) setPrevWeekId(DUMMY_WEEKLY_LIST[weekIndex + 1].id);
      }

      // 데모 모드: urlUserId → API로 이름 조회 → 이름별 고정 competency 매핑
      if (urlUserId) {
        (async () => {
          try {
            const res = await fetch(`/api/profile/?userId=${urlUserId}${demoQS}`);
            const json = await res.json();
            const name = json.data?.display_name || null;
            const compMap: Record<string, string[]> = {
              윤재윤: ["comp-3"],
              전민경: ["comp-2"],
              곽예원: ["comp-5"],
              안지혜: ["comp-4"],
              김의환: ["comp-1"],
            };
            // 이름에서 매칭 (부분 일치도 허용)
            const matched = Object.entries(compMap).find(([key]) => name?.includes(key));
            if (matched) {
              setCompetencyTypeIds(matched[1]);
            }
          } catch (e) {
            // API 실패 시 기본값 유지
          }
        })();
      }

      return;
    }
    // ── stale 응답 가드 (2026-06-05) ──
    // weekId/urlUserId/demoUserId 가 바뀌면 이전 fetch 의 응답이 늦게 도착해도 상태를
    // 덮어쓰지 않는다(위클리 평판이 주차/유저 전환 시 "됐다/안됐다" 랜덤으로 보이던 원인:
    // ① 미취소 병렬 fetch 의 응답 순서 역전 ② 실패 시 이전 주차 데이터 잔존).
    let cancelled = false;
    const fetchWeekData = async () => {
      if (!weekId) return;

      // 상태 리셋
      setPrevWeekId(null);
      setNextWeekId(null);
      // 주차/유저 전환 시 이전 컨텍스트의 평판/동료 데이터가 남아 보이지 않게 즉시 비운다.
      // (fetch 실패·지연 시 이전 주차 데이터가 그대로 노출되던 문제 방지)
      setWeeklyReputations([]);
      setSelectedColleagues([]);

      try {
        setIsLoadingWeek(true);

        // ========== 1단계: 프로필 API (weekId 번들) + 보조 API 최대 병렬 로드 ==========
        const profileUrl = urlUserId ? `/api/profile?userId=${urlUserId}${demoQS}&context=card&weekId=${weekId}` : `/api/profile?context=card&weekId=${weekId}`;
        const earlyUserId = urlUserId || null;

        // 프로필 API (주차 번들 포함) + 보조 API 동시 시작
        const earlyApiPromise = earlyUserId
          ? Promise.all([
              fetch(`/api/career-records?week_id=${weekId}&user_id=${earlyUserId}${demoQS}`, { cache: "no-store" })
                .then((r) => r.json())
                .catch(() => null),
              fetch(`/api/weekly-reputations?targetUserId=${earlyUserId}&weekCardId=${weekId}${demoQS}`)
                .then((r) => r.json())
                .catch(() => null),
              fetch(`/api/weekly-colleagues?userId=${earlyUserId}&weekCardId=${weekId}${demoQS}`)
                .then((r) => r.json())
                .catch(() => null),
            ])
          : Promise.resolve([null, null, null] as const);

        // 모든 병렬 요청 동시 대기
        const [profileResponse, earlyApiResults] = await Promise.all([fetch(profileUrl), earlyApiPromise]);
        const [earlyCareerResult, earlyReputationsResult, earlyColleaguesResult] = earlyApiResults;

        // 프로필 정보 처리 (weekBundle 포함)
        const profileResult = await profileResponse.json();
        // 주차/유저 전환으로 superseded 된 응답은 새 화면 state 를 덮어쓰지 않는다.
        if (cancelled) return;
        if (!profileResponse.ok || !profileResult.data?.id) {
          console.error("Failed to fetch profile");
          return;
        }

        const userId = profileResult.data.id;
        setCurrentUserId(userId);
        // 카드 소유자 조직 — 연계동료 후보를 동일 조직으로 제한하는 필터 기준.
        setCardOwnerOrg(profileResult.data.organization_slug ?? null);
        const apiRestWeekIds = profileResult.restWeekIds || [];
        const apiApprovedActivities = profileResult.approvedActivities || [];
        const apiActivityRecords = profileResult.activityRecords || [];
        const apiActivityDetails = profileResult.activityDetails || [];
        const apiActivityPoints = profileResult.activityPoints || [];

        // profile API에서 제공하는 teams, parts 사용
        const apiTeams = profileResult.teams || [];
        const apiParts = profileResult.parts || [];
        const apiUserTeamParts = profileResult.userTeamParts || [];

        // ========== weekBundle에서 주차 관련 데이터 추출 (서버 사이드 번들) ==========
        const wb = profileResult.weekBundle;
        if (!wb || !wb.currentWeek) throw new Error("Week not found");

        const activityTypesData = wb.activityTypes;
        const currentWeek = wb.currentWeek;

        // activity_types 처리
        const typesMap = new Map<string, ActivityTypeInfo>();
        const competencyIds: string[] = [];
        const experienceIds: string[] = [];
        const careerIds: string[] = [];
        const experienceInfos: ExperienceTypeInfo[] = [];

        if (activityTypesData) {
          activityTypesData.forEach((at: any) => {
            typesMap.set(at.id, at);
            if (at.cluster_id === "practical_competency") {
              competencyIds.push(at.id);
            } else if (at.cluster_id === "practical_experience") {
              experienceIds.push(at.id);
              experienceInfos.push({
                id: at.id,
                eligible_min_approved_weeks: at.eligible_min_approved_weeks,
                eligible_max_approved_weeks: at.eligible_max_approved_weeks,
                count_once_in_total: at.count_once_in_total || false,
              });
            } else if (at.cluster_id === "practical_career") {
              careerIds.push(at.id);
            }
          });
          setActivityTypesMap(typesMap);
          setCompetencyTypeIds(competencyIds);
          setExperienceTypeIds(experienceIds);
          setCareerTypeIds(careerIds);
          setExperienceTypeInfos(experienceInfos);
        }

        // 현재 주차 정보 처리
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonData = currentWeek.seasons as any;
        const rawSeasonName = seasonData?.name || "";
        const isBreakSeason = rawSeasonName.toLowerCase().includes("break");
        let seasonName = seasonNameMap[rawSeasonName] || rawSeasonName;
        let toSeasonName: string | null = null;

        if (isBreakSeason) {
          const parts = rawSeasonName.replace("_break", "").split("_");
          if (parts.length >= 2) {
            toSeasonName = seasonNameMap[parts[1]] || parts[1];
          }
          seasonName = "시즌 전환";
        }

        const today = new Date().toISOString().split("T")[0];
        const userStartDate = profileResult.growthInfo?.startDate || "1900-01-01";

        // weekBundle에서 직접 사용 (클라이언트 Supabase 쿼리 제거)
        const weeklyGrowthData = wb.weeklyGrowth;
        const allPointsData = wb.allPoints || [];
        const successWeeksData = wb.successWeeks || [];
        const allUserWeeksData = wb.allWeeks || [];

        // 누적 주차 필터
        const allWeeksForCumulative = allUserWeeksData.filter((w: any) => w.end_date && w.end_date <= currentWeek.end_date);
        const allWeeksResult = { data: allWeeksForCumulative };

        const weeklyGrowth = weeklyGrowthData;
        const onboardingWeekId = profileResult.onboardingWeekId;
        const isCurrentWeekOnboarding = weekId === onboardingWeekId;

        // phase(진행 중/집계 중) 와 무관하게 운영진이 마킹한 휴식 여부.
        // 활동 라인 단위(실무 정보/역량/경험/경력) 판정에서 사용.
        // ⚠️ 스키마 마이그레이션: 구 weeks.is_club_break → weeks.is_official_rest.
        //    /api/profile(adaptedCurrentWeek/adaptedWeeklyGrowth)·데모 경로는 이미 is_official_rest 로 내려준다.
        // 공식 휴식 SoT = 주차 단위 weeks.is_official_rest(=currentWeek.is_official_rest) 최우선 (정책 개정 2026-06-03).
        //   per-user user_week_statuses(weeklyGrowth.status='success' 등)와 충돌해도 주차 휴식 플래그가 우선한다
        //   — 즉 weeks.is_official_rest=true 면 그 주차는 전원 휴식으로 본다.
        // ⚠️ per-user uws 파생 weeklyGrowth.is_official_rest 는 휴식 판정에 쓰지 않는다 (2026-06-05 수정).
        //   비휴식 주차(예: 봄 12주차)에 stale uws(status='official_rest')가 남아 있으면 휴식(공식)으로
        //   오표시되던 버그. admin 판정(growthCore.resolveWeekResultStatus)도 "uws=official_rest 인데
        //   주차가 공식 휴식이 아니면 활동 주차로 재판정"하므로, 주차 단위 플래그만 따라야 admin DTO
        //   (statusLabel/isRestWeek)와 일치한다. demo/일반 모두 동일 경로.
        const baseOfficialRestForWeek = !isCurrentWeekOnboarding && (isBreakSeason || !!currentWeek.is_official_rest);
        // 전환 주차(봄·가을 17주차 / 여름·겨울 9주차)는 휴식(공식)으로 계산·표시하지 않는다.
        const isTransitionForWeek = isTransitionWeek(rawSeasonName, currentWeek.week_number);
        const userIsOnOfficialRestForWeek = isOfficialRestWeek(rawSeasonName, currentWeek.week_number, baseOfficialRestForWeek);
        // 개인 휴식 판정: per-user uws(weeklyGrowth.is_resting) 또는 승인된 휴식 주차(apiRestWeekIds).
        //   apiRestWeekIds 는 /api/profile 이 vacation_requests(status='approved') 공통 SoT 로부터 내려주는
        //   승인된 휴식 주차(week_id) 집합이다. 과거엔 rest_requests(현재 DB 부재) 기반이라 stale 우려로
        //   weeklyGrowth 부재 시에만 폴백했지만, 이제 승인 SoT 가 권위값이므로 uws 유무와 무관하게 항상
        //   반영한다 — admin 판정 코어(승인 휴식→personal_rest 강제, uws 상태 무시)와 정합. official rest 우선.
        const userIsOnPersonalRestForWeek = !isCurrentWeekOnboarding && (!!weeklyGrowth?.is_resting || apiRestWeekIds.includes(currentWeek.id));

        // 상태 phase(진행 중/집계 중/성공/실패)는 프론트에서 날짜(Date.now/weekStart/144h·252h)로 계산하지 않는다.
        // 상태 배지의 단일 출처는 어드민 weekly-cards DTO(weeklyCardMeta.statusLabel/statusTone)이며,
        // DTO 미수신 시에도 날짜로 상태를 추정하지 않고 중립 placeholder 로 표시한다(헤더 배지 fallback 참조).
        // 여기서는 DTO 와 무관하게 보존이 필요한 phase-독립 플래그(전환/휴식)만 라벨로 둔다(미해당 시 빈 값 → 중립).
        let growthStatus = "";
        if (isTransitionForWeek && baseOfficialRestForWeek) {
          growthStatus = TRANSITION_WEEK_LABEL;
        } else if (userIsOnOfficialRestForWeek) {
          growthStatus = "휴식(공식)";
        } else if (userIsOnPersonalRestForWeek) {
          growthStatus = "휴식(개인)";
        }

        setWeekData({
          id: currentWeek.id,
          weekNumber: currentWeek.week_number,
          seasonYear: seasonData?.year || 0,
          seasonName,
          seasonLabel: seasonData?.season_label || null,
          seasonType: seasonData?.season_type || rawSeasonName || null,
          isBreakSeason,
          toSeasonName,
          startDate: currentWeek.start_date,
          endDate: currentWeek.end_date,
          isClubBreak: currentWeek.is_official_rest || false,
          holidayName: currentWeek.holiday_name,
          growthStatus,
          isPersonalRest: userIsOnPersonalRestForWeek,
          isOfficialRest: userIsOnOfficialRestForWeek,
        });

        // 팀/파트 정보 처리 (profile API 데이터 활용)
        // left_at은 떠난 날이므로 그 날짜에는 이미 해당 팀/파트에 속하지 않음
        const userTeamPart = apiUserTeamParts.find((utp: any) => {
          const joinedAt = new Date(utp.joined_at);
          const leftAt = utp.left_at ? new Date(utp.left_at) : null;
          const weekStart = new Date(currentWeek.start_date);
          return joinedAt <= weekStart && (!leftAt || leftAt > weekStart);
        });

        if (userTeamPart) {
          setGeneration(userTeamPart.generation || null);
          const team = apiTeams.find((t: any) => t.id === userTeamPart.team_id);
          const part = apiParts.find((p: any) => p.id === userTeamPart.part_id);
          const managedTeam = apiTeams.find((t: any) => t.id === userTeamPart.managed_team_id);
          setTeamName(team?.name || null);
          setPartName(part?.name || null);
          setManagedTeamName(managedTeam?.name || null);
        }

        // 역할 정보 (profile API에서 제공하는 userRoleHistory 활용)
        // ended_at은 종료 날이므로 그 날짜에는 이미 해당 역할이 아님
        const apiUserRoleHistory = profileResult.userRoleHistory || [];
        const userRole = apiUserRoleHistory.find((urh: any) => {
          const startedAt = new Date(urh.started_at);
          const endedAt = urh.ended_at ? new Date(urh.ended_at) : null;
          const weekStart = new Date(currentWeek.start_date);
          return startedAt <= weekStart && (!endedAt || endedAt > weekStart);
        });

        if (userRole) {
          setRoleLabel(formatMembershipRoleLabel(userRole.role));
          setUserWeekRole(userRole.role || null);
        } else if (profileResult.data?.role) {
          setRoleLabel(formatMembershipRoleLabel(profileResult.data.role));
          setUserWeekRole(profileResult.data.role || null);
        }
        // 멤버십 등급(membership_level) — ⚠ 현재(최신) 등급이다. 주차 카드의 단계 표시(역할 배지·관리
        //   슬롯 잠금·인적사항 등급)는 weeklyCardMeta.roleLabel(주차 핀 snapshot SoT)을 최우선으로 쓰며,
        //   이 state 는 카드 메타 미수신 시의 폴백으로만 소비된다(과거 주차를 최신값으로 덮지 않음).
        setMembershipLevel((profileResult.data?.membership_level as string | null | undefined) ?? null);

        // 포인트 정보 처리
        const weekPointsData = allPointsData.filter((p: any) => p.week_id === weekId);
        if (weekPointsData.length > 0) {
          const star = weekPointsData.filter((p: any) => p.point_type === "star").reduce((sum: number, p: any) => sum + p.points, 0);
          const lightning = weekPointsData.filter((p: any) => p.point_type === "lightning").reduce((sum: number, p: any) => sum + p.points, 0);
          const shield = weekPointsData.filter((p: any) => p.point_type === "shield").reduce((sum: number, p: any) => sum + p.points, 0);
          setWeekPoints({ star, lightning, shield });
        }

        // 누적 성공 주차 수 계산
        let currentApprovedCount = 0;
        if (successWeeksData.length > 0) {
          // 온보딩 주차 이전의 성공 주차는 제외 (크루가 합류하기 전 주차)
          currentApprovedCount = successWeeksData.filter((sw: any) => {
            const weekEndDate = sw.weeks?.end_date;
            return weekEndDate && weekEndDate <= currentWeek.end_date && weekEndDate >= userStartDate;
          }).length;
        }

        // 온보딩 주차(무적 주차)는 성공 주차에 포함 (user_weekly_growth에 레코드가 없어도)
        const onboardingWeekIdForCount = profileResult.onboardingWeekId;
        if (onboardingWeekIdForCount) {
          // 온보딩 주차가 이미 successWeeksData에 포함되어 있는지 확인
          const onboardingAlreadyCounted = successWeeksData.some((sw: any) => sw.week_id === onboardingWeekIdForCount);
          if (!onboardingAlreadyCounted) {
            // allWeeksResult에서 온보딩 주차의 end_date 찾기
            const onboardingWeekInfo = allWeeksResult.data?.find((w: any) => w.id === onboardingWeekIdForCount);
            if (onboardingWeekInfo && onboardingWeekInfo.end_date <= currentWeek.end_date) {
              currentApprovedCount += 1;
            }
          }
        }
        // 현재 주차가 활동 주차이면 eligible 체크에 포함 (+1)
        const currentWeekIsActive = !currentWeek.is_official_rest && weekId !== onboardingWeekIdForCount;
        const currentWeekAlreadyInSuccess = successWeeksData.some((sw: any) => sw.week_id === weekId);
        const cumulativeForEligible = currentApprovedCount + (currentWeekIsActive && !currentWeekAlreadyInSuccess ? 1 : 0);
        setCumulativeApprovedWeeks(cumulativeForEligible);

        // 이전/다음 주차 ID 가져오기
        const allUserWeeks = allUserWeeksData;

        if (allUserWeeks && allUserWeeks.length > 0) {
          // 클라이언트에서 날짜 필터링 + break 시즌 제외
          const filteredWeeks = allUserWeeks.filter((w: any) => {
            const sName = (w.seasons as any)?.name || "";
            const isBreakSeason = sName.toLowerCase().includes("break");
            return w.start_date >= userStartDate && w.start_date <= today && !isBreakSeason;
          });

          const currentIndex = filteredWeeks.findIndex((w: any) => w.id === weekId);

          if (currentIndex !== -1) {
            // 내림차순 정렬이므로: index-1 = 더 최근(다음), index+1 = 더 과거(이전)
            if (currentIndex > 0) {
              setNextWeekId(filteredWeeks[currentIndex - 1].id);
            }
            if (currentIndex < filteredWeeks.length - 1) {
              setPrevWeekId(filteredWeeks[currentIndex + 1].id);
            }
          }
        }

        // 9. 주간 활동 데이터 처리 (weekBundle에서 가져옴)
        const activitiesData = wb.weeklyActivities;

        if (activitiesData) {
          setWeeklyActivities(activitiesData);

          // 11. 파트별 강화 집계 계산
          // activity_type_id별 파트 분류 (DB에서 가져온 데이터 사용)
          const infoTypesList = ["calendar", "essay", "forum", "infodesk", "session", "wisdom", "practical_lecture", "community", "etc_a"];
          const competencyTypesList = competencyIds.length > 0 ? competencyIds : [];
          const experienceTypesList = experienceIds.length > 0 ? experienceIds : [];
          const careerTypesList = careerIds.length > 0 ? careerIds : ["practical_project"];

          // P (열린 총 활동 수): is_active=true인 weekly_activities
          const activeActivities = activitiesData.filter((a) => a.is_active);

          // 10. 유저 활동 데이터 (profile API에서 가져온 데이터 활용 - RLS 우회)
          // 해당 주차의 approved activity_type_id 목록 추출
          const weekApprovedActivities = apiApprovedActivities.filter((a: { week_id: string; activity_type_id: string }) => a.week_id === weekId);

          const approvedActivityTypes = new Set<string>(weekApprovedActivities.map((a: { activity_type_id: string }) => a.activity_type_id));

          // 11. 강화 상태 판단용 데이터 설정
          // 해당 주차의 activity_records 필터링
          const filteredActivityRecords = apiActivityRecords.filter((ar: { week_id: string }) => ar.week_id === weekId);
          setWeekActivityRecords(filteredActivityRecords);
          setWeekApprovedTypes(approvedActivityTypes);

          // 12. 2차 정보 (서브타이틀, 아웃풋링크) 필터링
          const filteredActivityDetails = apiActivityDetails.filter((ad: { week_id: string }) => ad.week_id === weekId);
          setWeekActivityDetails(filteredActivityDetails);

          // 12-1. 어드민 개별 권한 (secondary_info_grants) - weekBundle에서 가져옴
          if (wb.secondaryInfoGrants) {
            setSecondaryInfoGrants(wb.secondaryInfoGrants as SecondaryInfoGrant[]);
          }

          // 13. 평점 매핑 — points.line_id (= activity_types.id) + 현재 주차 매칭.
          //   어드민(compliance-manage)은 (reward_star + 보너스 평점) 을 한 행에 합산해 저장하므로,
          //   화면 표시는 라인의 reward_star 만큼 차감해 실제 평점(0~10) 만 노출.
          //   (예: 26봄 9주차부터 실무 경험 reward_star=10 → 저장 20 = 평점 10 으로 환산)
          //   apiActivityPoints 는 given_at desc 정렬이므로 동일 키 중복 시 최신 값이 우선.
          const ratingsMap = new Map<string, number>();
          apiActivityPoints.forEach((p: { line_id: string | null; week_id: string | null; points: number }) => {
            if (p.line_id && p.week_id === weekId && !ratingsMap.has(p.line_id)) {
              const baseStar = typesMap.get(p.line_id)?.reward_star || 0;
              const rating = Math.max(0, (p.points || 0) - baseStar);
              ratingsMap.set(p.line_id, rating);
            }
          });
          setActivityRatings(ratingsMap);

          // cluster-4-1과 동일한 로직으로 해당 주차 데이터 계산
          // 온보딩 주차 확인
          const onboardingWeekId = profileResult.onboardingWeekId;
          const isOnboardingWeekLocal = weekId === onboardingWeekId;
          setIsOnboardingWeek(isOnboardingWeekLocal);

          // 유저의 모든 완료 활동 저장 (experience eligible 체크용)
          const allCompletedActivities = apiActivityRecords
            .filter((ar: { is_completed: boolean }) => ar.is_completed)
            .map((ar: { week_id: string; activity_type_id: string }) => ({
              week_id: ar.week_id,
              activity_type_id: ar.activity_type_id,
            }));
          setAllUserCompletedActivities(allCompletedActivities);

          // 누적 성공 주차 수 (현재 주차 포함) - 위에서 계산된 값 사용
          const currentCumulativeApproved = cumulativeForEligible;

          // 실무 정보: 해당 주차의 활성화된 활동 수 (온보딩 주차도 정상 계산)
          const infoTotal = activeActivities.filter((a) => infoTypesList.includes(a.activity_type_id)).length;

          // 실무 역량: 평소 매주 최대 1개. 공식 휴식 주차는 기본 0이지만, 예외적으로 개설된 활동이 있으면 1.
          const hasActiveCompetency = activeActivities.some((a) => competencyTypesList.includes(a.activity_type_id));
          const competencyTotal = currentWeek.is_official_rest || isBreakSeason ? (hasActiveCompetency ? 1 : 0) : 1;

          // 실무 경험: 해당 주차에 개설된 experience 활동 중 eligible 조건 체크
          // eligible_min/max 룰 적용 시점: 2026년 봄 시즌 9주차부터
          // 그 이전에는 개설된 모든 실무 경험 활동이 적격 (룰 없이 전부 카운트)
          const isEligibilityRuleActive = seasonData && (seasonData.year > 2026 || (seasonData.year === 2026 && seasonData.name !== "spring") || (seasonData.year === 2026 && seasonData.name === "spring" && currentWeek.week_number >= 9));
          let experienceTotal = 0;
          // 해당 주차에 개설된(is_active) experience 활동만 대상으로 함 (온보딩 주차도 정상 계산)
          const activeExperienceActivities = activeActivities.filter((a) => experienceTypesList.includes(a.activity_type_id));
          activeExperienceActivities.forEach((a) => {
            const typeInfo = experienceInfos.find((info) => info.id === a.activity_type_id);

            if (!typeInfo) {
              experienceTotal++;
              return;
            }

            if (isEligibilityRuleActive) {
              const minWeek = typeInfo.eligible_min_approved_weeks ?? 1;
              const maxWeek = typeInfo.eligible_max_approved_weeks ?? 999;

              if (currentCumulativeApproved >= minWeek && currentCumulativeApproved <= maxWeek) {
                if (typeInfo.count_once_in_total) {
                  const previouslyCompleted = allCompletedActivities.some((ca: { week_id: string; activity_type_id: string }) => ca.activity_type_id === a.activity_type_id && ca.week_id !== weekId);
                  if (!previouslyCompleted) {
                    experienceTotal++;
                  }
                } else {
                  experienceTotal++;
                }
              }
            } else {
              // 룰 적용 이전: 개설된 모든 실무 경험 활동 카운트
              experienceTotal++;
            }
          });

          // 실무 경력: career_records 기반으로 계산됨 (별도 useEffect에서 처리)
          // 여기서는 초기값 0으로 설정, career_records 로드 후 덮어씀

          // 강화 성공 집계 기준 = '라인 개설(is_active) + 마감(해당 주차 수 22:00 KST) 도달'.
          // 기입/이행(is_completed) 여부는 보지 않는다 — getEnhancementStatus 와 동일 기준.
          const isLineDeadlinePassedHere = currentWeek?.start_date ? Date.now() >= computeLineDeadlineMs(currentWeek.start_date) : false;
          const openActivityTypeIds = new Set(activeActivities.map((a) => a.activity_type_id));

          // 마감 전 → success 미집계(false), 마감 후 → 열린 라인을 success 로 집계.
          const isEnhancementSuccess = (activityTypeId: string): boolean => {
            if (!isLineDeadlinePassedHere) return false;
            return openActivityTypeIds.has(activityTypeId);
          };

          const infoSuccess = infoTypesList.filter((activityTypeId) => isEnhancementSuccess(activityTypeId)).length;
          // 실무 역량 success (온보딩 주차도 정상 계산)
          const competencySuccess = competencyTypesList.some((activityTypeId) => isEnhancementSuccess(activityTypeId)) ? 1 : 0;
          // 실무 경험 success: 개설된 활동 중 eligible한 타입의 강화 성공만 카운트
          const eligibleExperienceTypes: string[] = [];
          {
            activeExperienceActivities.forEach((a) => {
              const typeInfo = experienceInfos.find((info) => info.id === a.activity_type_id);
              if (!typeInfo) {
                eligibleExperienceTypes.push(a.activity_type_id);
                return;
              }
              if (isEligibilityRuleActive) {
                const minWeek = typeInfo.eligible_min_approved_weeks ?? 1;
                const maxWeek = typeInfo.eligible_max_approved_weeks ?? 999;
                if (currentCumulativeApproved >= minWeek && currentCumulativeApproved <= maxWeek) {
                  if (typeInfo.count_once_in_total) {
                    const previouslyCompleted = allCompletedActivities.some((ca: { week_id: string; activity_type_id: string }) => ca.activity_type_id === a.activity_type_id && ca.week_id !== weekId);
                    if (!previouslyCompleted) eligibleExperienceTypes.push(typeInfo.id);
                  } else {
                    eligibleExperienceTypes.push(typeInfo.id);
                  }
                }
              } else {
                eligibleExperienceTypes.push(a.activity_type_id);
              }
            });
          }
          const experienceSuccess = eligibleExperienceTypes.filter((activityTypeId) => isEnhancementSuccess(activityTypeId)).length;
          // 실무 경력 success: career_records 기반으로 계산됨 (별도 useEffect에서 처리)

          // 개인 휴식 크루는 통계를 0으로 강제 (해당 주차에 활동 자체가 없는 게 정상).
          // 공식 휴식 주차는 강제로 0 처리하지 않음 — 예외적으로 개설된 활동이 있으면 자연스럽게 반영.
          // phase(집계 중/진행 중)에 가려지지 않도록 phase-독립 플래그를 사용.
          const isPersonalRest = userIsOnPersonalRestForWeek;
          if (isPersonalRest) {
            setInfoStats({ total: 0, success: 0 });
            setCompetencyStats({ total: 0, success: 0 });
            setExperienceStats({ total: 0, success: 0 });
            setCareerStats({ total: 0, success: 0 });
          } else {
            setInfoStats({ total: infoTotal, success: infoSuccess });
            setCompetencyStats({ total: competencyTotal, success: competencySuccess });
            setExperienceStats({ total: experienceTotal, success: experienceSuccess });
          }
          // careerStats는 career_records useEffect에서 설정됨
        }

        // Stage 1에서 선행 로드된 데이터 적용 — effect 가 이미 교체(cancelled)됐으면 적용하지 않는다.
        if (cancelled) return;
        if (earlyCareerResult?.success && earlyCareerResult.data) {
          setCareerRecords(earlyCareerResult.data);
        }
        if (earlyReputationsResult?.success && earlyReputationsResult.data) {
          setWeeklyReputations(earlyReputationsResult.data);
        }
        if (earlyColleaguesResult?.success && earlyColleaguesResult.data) {
          const colleagues = earlyColleaguesResult.data.map((item: any) => ({
            id: item.colleague?.id || item.colleague_id,
            name: item.colleague?.name || "-",
            gender: item.colleague?.gender || "-",
            age: item.colleague?.age || "-",
            profileImg: item.colleague?.profileImg || "",
            university: item.colleague?.university || "-",
            major: item.colleague?.major || "-",
            team: item.colleague?.team || "-",
            part: item.colleague?.part || "-",
            nickname: item.colleague?.nickname || "-",
            role: item.colleague?.role || "",
            membershipLevel: item.colleague?.membershipLevel ?? null,
            rank: item.rank,
            message: item.message || "",
            createdAt: item.created_at || "",
          }));
          setSelectedColleagues(colleagues);
        }
      } catch (error) {
        console.error("주차 데이터 로드 오류:", error);
      } finally {
        // 주차/유저 전환으로 superseded 된 이전 fetch 의 finally 가 새 로딩의
        // Skeleton 게이트(isLoadingWeek)를 조기 해제하지 못하게 한다.
        if (!cancelled) setIsLoadingWeek(false);
      }
    };

    fetchWeekData();
    return () => {
      cancelled = true;
    };
    // demoUserId: demoQS(평판/동료/경력 fetch 의 인증 컨텍스트)가 바뀌면 재조회 필요.
  }, [weekId, urlUserId, isDemoMode, isMounted, demoUserId]);

  // DB에서 실무 경력 데이터 가져오기
  // career-records는 urlUserId가 있으면 Stage 1에서 이미 로드됨 (earlyCareerResult)
  // currentUserId만 있는 경우(본인 조회)에만 별도 fetch
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    const fetchCareerRecords = async () => {
      if (!weekId) return;
      // urlUserId가 있으면 Stage 1에서 이미 처리됨
      if (urlUserId) return;
      if (!currentUserId) return;

      setIsLoadingCareerRecords(true);
      try {
        const params = new URLSearchParams({ week_id: weekId, user_id: currentUserId });
        const response = await fetch(`/api/career-records?${params.toString()}`, { cache: "no-store" });
        const result = await response.json();
        if (result.success && result.data) {
          setCareerRecords(result.data);
        }
      } catch (error) {
        console.error("Error fetching career records:", error);
      } finally {
        setIsLoadingCareerRecords(false);
      }
    };

    fetchCareerRecords();
  }, [currentUserId, weekId, urlUserId]);

  // 실무 경력 통계 업데이트 (computed status 기반) — cluster-4-1 / ranking API 와 정합.
  // total: 해당 주차에 어드민이 개설한 career_projects 수 (cap 5).
  //   ※ careerRecords 는 /api/career-records 응답 = 그 주차 모든 projects + 유저 레코드 머지.
  //      따라서 careerRecords.length 자체가 career_projects 수와 같음.
  // success: 강화 성공한 프로젝트 수 (computed enhanced) — 최대 total 까지 cap.
  // 운영 정책: 크루는 한 주에 최대 5개까지 참여 가능 → 분모/분자 모두 5 cap.
  useEffect(() => {
    // 개인 휴식 → 경력 통계 0 으로 강제. phase(집계 중) 와 무관하게 적용.
    if (weekData?.isPersonalRest) {
      setCareerStats({ total: 0, success: 0 });
      return;
    }
    const total = Math.min(careerRecords.length, 5);
    // computed status: pending → 결정 시점(N+1 목 12:01 KST) 이후에만 enhanced 로 승격.
    //   2차 정보 / secondary_info_deadline 은 강화 성공/실패 판정에 영향 없음 (2026 정책).
    const enhancedCount = careerRecords.filter((r) => {
      if (r.enhancement_status === "enhanced") return true;
      if (r.enhancement_status === "pending") return resultsDecided;
      return false;
    }).length;
    const success = Math.min(enhancedCount, total);
    setCareerStats({ total, success });
  }, [careerRecords, weekData, resultsDecided]);

  // 키워드 목록 가져오기 (모달 열릴 때 lazy load)
  const fetchKeywordsIfNeeded = async () => {
    if (isDemoMode) return; // 더미 모드: API 스킵
    if (reputationKeywords.length > 0) return;
    try {
      const res = await fetch("/api/reputation-keywords");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setReputationKeywords(json.data);
        }
      }
    } catch (error) {
      console.error("키워드 목록 가져오기 오류:", error);
    }
  };

  // 주차 평판 데이터 가져오기 함수
  const fetchWeeklyReputations = async () => {
    if (!urlUserId || !weekId) return;
    try {
      const res = await fetch(`/api/weekly-reputations?targetUserId=${urlUserId}&weekCardId=${weekId}${demoQS}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWeeklyReputations(json.data);
        }
      }
    } catch (error) {
      console.error("주차 평판 데이터 가져오기 오류:", error);
    }
  };

  // 주차 평판 데이터 초기 로드 (urlUserId가 없는 경우만 - 있으면 Stage 1에서 이미 로드됨)
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    if (!urlUserId) fetchWeeklyReputations();
  }, [urlUserId, weekId]);

  // 크루 목록 가져오기 (모달 열릴 때 lazy load) — 데모 모드에서도 실제 API 호출
  const fetchCrewListIfNeeded = async () => {
    if (allCrewList.length > 0) return; // 이미 로드됨
    // 정책 A: 연계동료 후보는 카드 소유자와 같은 조직만 노출. org 가 없으면 전체 조직이
    // 섞여 나오므로 후보 조회 자체를 막고 진단 로그를 남긴다(잘못된 cross-org 노출 방지).
    if (!cardOwnerOrg) {
      console.warn("[colleague-org-filter] 카드 소유자 org 미확정 — 후보 조회 차단", {
        cardOwnerOrg,
        urlUserId,
        sessionUserId: session?.user?.id ?? null,
        weekId,
      });
      return;
    }
    try {
      const excludeId = urlUserId || session?.user?.id || "";
      // &org=<카드 소유자 organization_slug> — 서버(user_profiles.organization_slug)에서 1차 필터.
      const res = await fetch(`/api/crews?excludeUserId=${encodeURIComponent(excludeId)}&org=${encodeURIComponent(cardOwnerOrg)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAllCrewList(json.data);
          // [진단] 카드 소유자 org vs 후보 org/name 샘플 10건 — cross-org 혼입 여부 확인용.
          console.log("[colleague-org-filter] 후보 로드", {
            "currentUser.org (카드 소유자)": cardOwnerOrg,
            총후보수: json.data.length,
            샘플10: (json.data as any[]).slice(0, 10).map((c) => ({
              userId: c.id,
              name: c.name,
              org: c.organizationSlug ?? null,
            })),
            "다른 조직 혼입": (json.data as any[]).some((c) => (c.organizationSlug ?? null) !== cardOwnerOrg),
          });
        }
      }
    } catch (error) {
      console.error("크루 목록 가져오기 오류:", error);
    }
  };

  // 연계 동료 데이터 가져오기
  const fetchWeeklyColleagues = async () => {
    const targetUserId = urlUserId || session?.user?.id;
    if (!targetUserId || !weekId) return;
    try {
      const res = await fetch(`/api/weekly-colleagues?userId=${targetUserId}&weekCardId=${weekId}${demoQS}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          // API 데이터를 selectedColleagues 형식으로 변환
          const colleagues = json.data.map((item: any) => ({
            id: item.colleague?.id || item.colleague_id,
            name: item.colleague?.name || "-",
            gender: item.colleague?.gender || "-",
            age: item.colleague?.age || "-",
            profileImg: item.colleague?.profileImg || "",
            university: item.colleague?.university || "-",
            major: item.colleague?.major || "-",
            team: item.colleague?.team || "-",
            part: item.colleague?.part || "-",
            nickname: item.colleague?.nickname || "-",
            role: item.colleague?.role || "",
            membershipLevel: item.colleague?.membershipLevel ?? null,
            rank: item.rank,
            message: item.message || "",
            createdAt: item.created_at || "",
          }));
          setSelectedColleagues(colleagues);
        }
      }
    } catch (error) {
      console.error("연계 동료 데이터 가져오기 오류:", error);
    }
  };

  // 연계 동료 초기 로드 (urlUserId가 없는 경우만 - 있으면 Stage 1에서 이미 로드됨)
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    if (!urlUserId) fetchWeeklyColleagues();
  }, [urlUserId, weekId, session?.user?.id]);

  // 모달 상태 관리
  const [workInfoModalOpen, setWorkInfoModalOpen] = useState(false);
  const [workAbilityModalOpen, setWorkAbilityModalOpen] = useState(false);
  const [workExpModalOpen, setWorkExpModalOpen] = useState(false);
  const [workCareerModalOpen, setWorkCareerModalOpen] = useState(false);

  // 탭 팝오버 상태
  const [showWeeklyGrowthBadge, setShowWeeklyGrowthBadge] = useState(false);

  // 탭 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!showWeeklyGrowthBadge) return;
    const handleClickOutside = () => setShowWeeklyGrowthBadge(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showWeeklyGrowthBadge]);

  // 상단 섹션 모달 상태
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [headerModalType, setHeaderModalType] = useState<"본인" | "타크루" | null>(null);

  // 연계 동료 선택 상태 (1st, 2nd, 3rd 각각 별도 저장)
  const [selectedColleagues, setSelectedColleagues] = useState<SelectedColleague[]>([]);

  // 크루 검색어 상태
  const [crewSearchQuery, setCrewSearchQuery] = useState("");

  // 타크루 모달 상태 (주차 평판 카드 편집)
  const [selectedCrewForReputation, setSelectedCrewForReputation] = useState<number | null>(null);
  const [reputationEditData, setReputationEditData] = useState<{
    rating: number;
    content: string;
    keyword: string;
  }>({ rating: 0, content: "", keyword: "" });
  const [otherCrewSearchQuery, setOtherCrewSearchQuery] = useState("");

  // 주차 평판 키워드 목록 및 저장 상태
  const [reputationKeywords, setReputationKeywords] = useState<
    {
      id: string;
      cluster_number: number;
      cluster_name: string;
      cluster_color: string;
      keyword: string;
    }[]
  >([]);
  const [reputationSaving, setReputationSaving] = useState(false);
  const [reputationSaveSuccess, setReputationSaveSuccess] = useState(false);
  const [reputationSaveError, setReputationSaveError] = useState<string | null>(null);

  // reputation-form 리디자인 2단계 — UI 상태 관리용 신규 state (DB 전송 X)
  const [formKeywordMode, setFormKeywordMode] = useState<"select" | "write">("select");
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [selectedKeywordTemp, setSelectedKeywordTemp] = useState<string>("");
  const [formSnapshot, setFormSnapshot] = useState<{ rating: number; content: string; keyword: string } | null>(null);
  const [isReputationFormEditing, setIsReputationFormEditing] = useState(false);
  const [saveAttemptFailed, setSaveAttemptFailed] = useState(false);
  const [fieldErrorFlash, setFieldErrorFlash] = useState(false); // 필수필드 미입력 시 테두리 깜빡임 트리거

  // 커스텀 별점 드롭다운 (reputation-form)
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
  const [ratingDropdownPos, setRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const ratingDropdownTriggerRef = useRef<HTMLDivElement>(null);

  // Detail Log 모달 (좌측 image-badges 아래 버튼)
  const [showDetailLogModal, setShowDetailLogModal] = useState(false);

  // 주차 확인 상태 머신 (pending → confirming → confirmed)
  type WeekConfirmStatus = "pending" | "confirming" | "confirmed";
  const [weekStatus, setWeekStatus] = useState<WeekConfirmStatus>("pending");
  const isWeekConfirmed = weekStatus === "confirmed";
  const weekConfirmBtnRef = useRef<HTMLButtonElement>(null);

  // 주차 리뷰 모달 (신규)
  const [weeklyReviewModalOpen, setWeeklyReviewModalOpen] = useState(false);
  const [weeklyReviewData, setWeeklyReviewData] = useState({ rating: 0, content: "" });
  const [isWeeklyReviewEditing, setIsWeeklyReviewEditing] = useState(false);
  const [reviewRatingDropdownOpen, setReviewRatingDropdownOpen] = useState(false);
  const [reviewRatingDropdownPos, setReviewRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const reviewRatingDropdownTriggerRef = useRef<HTMLDivElement>(null);
  const [weeklyReviewSaving, setWeeklyReviewSaving] = useState(false);
  const [weeklyReviewSaveAttemptFailed, setWeeklyReviewSaveAttemptFailed] = useState(false);
  const [weeklyReviewFormSnapshot, setWeeklyReviewFormSnapshot] = useState<{ rating: number; content: string } | null>(null);
  const [weeklyReviewFieldErrorFlash, setWeeklyReviewFieldErrorFlash] = useState(false);
  const [weeklyReviewFromDB, setWeeklyReviewFromDB] = useState<{
    id?: string;
    weekCardId?: string;
    rating: number;
    content: string;
    created_at?: string;
    updated_at?: string;
  } | null>(null);

  // reputation-view-modal [수정] 버튼 승인 상태 — 4개 모달 canEditWorkInfo 패턴 동기화
  // 데모 모드 = true(수정 가능), 일반 = false(관리자 승인 필요)
  // 테스트 유저(데모) 모드도 owner 기준 활성 — 실제 작성기간은 클릭 시 demoUserId 권한으로 검증.
  const [canEditReputation, setCanEditReputation] = useState<boolean>(isDemoMode || !!demoUserId);
  useEffect(() => {
    setCanEditReputation(isDemoMode || !!demoUserId);
  }, [isDemoMode, demoUserId]);

  // 연계 동료 작성 창 열림 여부 — 모달 오픈 게이트(requireWeeklyColleaguesWriteAccess)와 동일 판정을
  // "버튼 disabled / 안내 표시" 용으로 reactive 하게 캐시한 값. 단일 출처 = 서버 POST 와 동일한
  // /api/edit-windows/permission(cluster4.weekly_colleagues, week_id).canEdit.
  //   true=열림, false=닫힘(버튼 비활성+안내), null=조회 전(로딩 — 비활성화하지 않음).
  const [colleagueWindowOpen, setColleagueWindowOpen] = useState<boolean | null>(null);
  useEffect(() => {
    // demo/admin 은 게이트와 동일하게 항상 열림으로 본다.
    if (isDemoMode) { setColleagueWindowOpen(true); return; }
    if (session?.user?.isAdmin && !demoUserId) { setColleagueWindowOpen(true); return; }
    if (!weekId) { setColleagueWindowOpen(null); return; } // 주차 미확정 → 로딩
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiUrl(
            `/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.weeklyColleagues)}&week_id=${encodeURIComponent(weekId)}`,
          ),
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        const data = json as { success?: boolean; data?: { canEdit?: boolean } } | null;
        setColleagueWindowOpen(!!(res.ok && data?.success && data?.data?.canEdit === true));
      } catch {
        if (!cancelled) setColleagueWindowOpen(false); // 보수적 닫힘
      }
    })();
    return () => { cancelled = true; };
  }, [isDemoMode, demoUserId, session?.user?.isAdmin, weekId]);

  // 연계 동료 — 평판/주차 리뷰와 동일하게 데모/테스트 유저 모드에서 활성, 일반 모드에서 승인 상태 따름
  const [canEditColleague, setCanEditColleague] = useState<boolean>(isDemoMode || !!demoUserId);
  useEffect(() => {
    setCanEditColleague(isDemoMode || !!demoUserId);
  }, [isDemoMode, demoUserId]);

  // Weekly Review / 연계동료 작성 시간 윈도우
  // 앵커 = weekData.startDate (= N주차 월요일 00:00 KST)
  //   144h(=6d 0h)  → N주차 일요일 00:00 KST  → +1min = 일 00:01 (오픈)
  //   252h(=10d 12h) → N+1주차 목요일 12:00 KST (마감, 시스템 여유분)
  // 데모/어드민은 우회.
  const requireWriteWindow = async (): Promise<boolean> => {
    if (isDemoMode) return true;
    if (session?.user?.isAdmin && !demoUserId) return true;
    if (!weekData?.startDate) {
      await popup.alert("주차 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return false;
    }
    const anchorMs = new Date(`${weekData.startDate}T00:00:00+09:00`).getTime();
    const openMs = anchorMs + 144 * 3600 * 1000 + 60 * 1000;
    const closeMs = anchorMs + 252 * 3600 * 1000;
    const now = Date.now();
    if (now < openMs || now >= closeMs) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return false;
    }
    return true;
  };

  // 일반 모드 백엔드 승인 상태 → 모든 canEdit* 플래그에 일괄 반영
  // 다른 크루 카드 열람 시(isOwner=false)에는 승인됐어도 수정 비활성화
  // 어드민(마더) 계정은 승인/소유 무관하게 모든 라인 카드 수정 가능
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드는 위 useEffect들이 true로 셋업
    // 테스트 유저(데모) 모드: rep/colleague 는 위 init effect 가 owner 기준 활성으로 셋업했고,
    // 4hub canEdit* 는 weekly-cards DTO(데모 스코프)가 단일 출처이므로 세션/승인 기반 override 를 하지 않는다.
    if (demoUserId) return;
    if (session?.user?.isAdmin) {
      setCanEditReputation(true);
      setCanEditColleague(true);
      setCanEditWorkInfo(true);
      setCanEditWorkAbility(true);
      setCanEditWorkExp(true);
      setCanEditWorkCareer(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const approved = await checkApprovalStatus();
      if (cancelled) return;
      const editable = approved && isOwner;
      setCanEditReputation(editable);
      setCanEditColleague(editable);
      setCanEditWorkInfo(editable);
      setCanEditWorkAbility(editable);
      setCanEditWorkExp(editable);
      setCanEditWorkCareer(editable);
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, session, isOwner]);

  // ── Cluster4 weekly-cards 라인 단일 출처 (canEdit/editReason 등) ──
  // 기존 list/card query 는 변경하지 않는다. 추가 fetch 만 수행.
  // 백엔드가 lines[] 를 실제 lineTarget 단위로 내려주므로, partType 만으로 line 을
  // 찾으면 안 된다. 전체 카드의 lines 를 weekId 태그와 함께 평탄화하여 보관하고,
  // findCluster4Line(weekId + partType + sub-line key) 로만 매칭한다.
  const [cluster4Lines, setCluster4Lines] = useState<Cluster4WeeklyLineDto[]>([]);
  // section1-header 단일 출처(어드민 DTO) — 현재 주차 카드 메타. 같은 weekly-cards 응답에서
  // 이미 받아온 matchedCard 를 그대로 보관. 없으면(데모/미매칭/실패) 기존 로컬 계산값 fallback.
  const [weeklyCardMeta, setWeeklyCardMeta] = useState<AdminCluster4WeeklyCardDto | null>(null);
  // 평판/연계동료 저장 직후 weekly-cards DTO 재조회 트리거 — 저장 API 가 snapshot 재계산을
  // await 하므로(triggerAdminSnapshotRecompute) 응답 후 재조회하면 fresh DTO 가 온다.
  // 재조회 없이는 화면이 legacy fallback(selectedColleagues/weeklyReputations)과 섞여
  // 미리보기/모달 간 DTO 분기가 생긴다 — 단일 출처(DTO) 유지를 위해 저장 성공 시 bump.
  const [weeklyCardsRefreshKey, setWeeklyCardsRefreshKey] = useState(0);

  useEffect(() => {
    // fetch 실행 여부/차단 사유를 항상 로깅 (early-return 진단)
    const targetUserId = urlUserId || session?.user?.id || null;
    // 단일 출처 우선: targetUserId + weekId 가 있으면 데모/테스트 모드여도 weekly-cards DTO 를 받아
    // reputationSummary/weeklyReputations[]/weeklyColleagues[] 등 신규 필드를 채운다(demoQS 동봉).
    // 순수 더미(localStorage demoMode + target 없음)일 때만 targetUserId 부재로 자연 skip 된다.
    if (!weekId || !targetUserId) {
      console.log("[cluster4-canEdit] weekly-cards fetch 스킵", {
        reason: !weekId ? "NO_WEEK_ID" : "NO_TARGET_USER_ID",
        isDemoMode,
        weekId,
        urlUserId,
        sessionUserId: session?.user?.id ?? null,
      });
      return;
    }

    const fetchUrl = `/api/cluster4/weekly-cards?userId=${targetUserId}${demoQS}${modeQS}`;
    const controller = new AbortController();
    (async () => {
      try {
        console.log("[cluster4-canEdit] weekly-cards fetch 시작", { fetchUrl, weekId, targetUserId });
        const res = await fetch(fetchUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
        console.log("[cluster4-canEdit] weekly-cards fetch 응답", {
          status: res.status,
          ok: res.ok,
          fetchUrl,
          weekId,
        });
        const json = (await res.json()) as Cluster4WeeklyCardsResponseDto;
        if (controller.signal.aborted) return;

        const cards = Array.isArray(json?.data) ? json.data : [];
        console.log("[cluster4-canEdit] weekly-cards 데이터", {
          dataLength: cards.length,
          weekId,
          weekIdsInData: cards.map((c) => c.weekId ?? null),
        });
        // 전체 카드의 lines 평탄화 — 각 line 에 소속 카드의 weekId 를 보존
        // (line.weekId 가 이미 있으면 그대로, 없으면 카드 weekId 로 채움)
        // admin(top-level) 이미지 캡션 coalesce — admin DTO 는 outputImages(URL string[]) 와
        // outputImageCaptions(string[]) 를 분리해 내려준다(submission.* 와 동일 형태). 하지만 프론트의
        // 모든 운영진 이미지 소비처는 normalizeOutputImages(line.outputImages)[i].caption 만 읽으므로,
        // 분리 배열인 채로는 캡션이 유실된다. ingestion 단계에서 [{url,caption}] 단일 형태로 합쳐
        // 다운스트림(4 part 카드/모달 + N-1 gap-fill spread)이 캡션을 그대로 표시하도록 한다.
        // 이미 객체({url,caption}) 형태로 온 경우(레거시/호환)는 caption 이 비어있을 때만 별도 배열로 보강.
        const coalesceAdminOutputImages = (
          line: Cluster4WeeklyLineDto,
        ): Cluster4WeeklyLineDto["outputImages"] => {
          const imgs = line.outputImages as
            | ReadonlyArray<string | { url?: string | null; caption?: string | null } | null>
            | null
            | undefined;
          if (!Array.isArray(imgs)) return line.outputImages;
          const caps = Array.isArray(line.outputImageCaptions) ? line.outputImageCaptions : [];
          return imgs.map((img, i) => {
            if (typeof img === "string") return { url: img, caption: caps[i] ?? null };
            const url = (img?.url as string | null | undefined) ?? "";
            const caption = (img?.caption as string | null | undefined) ?? caps[i] ?? null;
            return { url, caption };
          });
        };
        const allLines: Cluster4WeeklyLineDto[] = [];
        cards.forEach((c) => {
          const cardLines = Array.isArray(c?.lines) ? c.lines! : [];
          cardLines.forEach((line) => {
            // 운영진 output image/link 정책 클램프(≤1) — HTTP 프록시와 동일 함수로 렌더 단계에서도
            // 안전하게 제한(direct == HTTP 패리티). 클램프 후 캡션 coalesce 순서 유지.
            const clampedLine = clampAdminOutputs(line as unknown as Record<string, unknown>) as unknown as Cluster4WeeklyLineDto;
            allLines.push({
              ...clampedLine,
              outputImages: coalesceAdminOutputImages(clampedLine),
              weekId: (clampedLine.weekId as string | null | undefined) ?? c.weekId ?? null,
            });
          });
        });

        // ── 라인 칸 N-1 노출 정책 (어드민 N-1 개설 ↔ 고객 현재 주차 카드 즉시 노출) ──
        // 운영 정책상 라인은 현재 주차 N 의 직전 주차(N-1)에 개설될 수 있다(admin: cluster4WeekPolicy).
        // 그 경우 라인 타깃 week_id 는 N-1 이라 N 카드의 라인 칸이 비어 보인다.
        // 대상자가 현재 주차(N) 카드에서 즉시 보도록, "N 에 해당 part 의 실제 라인이 없고 N-1 에
        // 실제 라인이 있으면" 그 라인을 N 으로 끌어와(weekId 재태깅) 라인 칸에 노출한다.
        //   - N 에 실제 라인이 있으면 그대로 유지 → 현재 주차(N)로 개설된 라인은 영향 없음.
        //   - 집계(infoRate/careerRate 등)는 카드 DTO(현재 주차) 단일 출처라 영향 없음(라인 칸만 보정).
        //   - canEdit/제출기간은 끌어온 라인(N-1) 값 그대로 → N-1 마감이면 읽기 전용으로 보인다.
        const normPart = (p: unknown): string => {
          const r = String(p ?? "").toLowerCase();
          return (
            { info: "information", information: "information", comp: "competency", competency: "competency", exp: "experience", experience: "experience", career: "career" } as Record<string, string>
          )[r] ?? r;
        };
        const orderedWeekIds = cards
          .filter((c) => c.weekId && c.startDate)
          .slice()
          .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
          .map((c) => c.weekId as string);
        const curIdx = weekId ? orderedWeekIds.indexOf(weekId) : -1;
        const prevWeekId = curIdx > 0 ? orderedWeekIds[curIdx - 1] : null;
        // ── 휴식(공식) 주차 가드 — 라인 귀속 주차(line.weekId) ≠ 현재 기입 가능 상태 분리 ──
        // N-1 carry-forward 는 "현재 주차로 개설된 라인이 직전 주차(N-1)에 있을 때" 그 라인을
        // 현재 카드로 끌어와 즉시 기입하게 하는 정상 운영 정책이다. 하지만 현재 주차가
        // 휴식(공식) 주차(예: 14~16주차)라면, 직전 주차(13주차) 라인이 아직 기입 가능하다는
        // 이유만으로 휴식 카드에 끌려와 "섞여 보이는" 버그가 된다. 휴식(공식) 주차에는 carry-forward 를
        // 수행하지 않아, 직전 주차 라인이 그 주차 카드에만 남게 한다(전환 주차는 휴식(공식) 아님 → isOfficialRestWeek 가 제외).
        // 어드민 weekly-cards DTO(AdminCluster4WeeklyCardDto)의 상태 SoT 는 statusLabel("휴식(공식)" 등)이다
        // (로컬 빌더 DTO 의 resultStatus 가 아님). 시즌은 seasonName 우선, 없으면 displayTitle/weekLabel 에서
        // 봄·여름·가을·겨울 추출 — section1-header 의 metaIsTransitionRest 판정과 동일 규칙. 전환 주차는
        // isOfficialRestWeek 가 false 로 강등하므로 이번 가드 영향 없음.
        const currentCardMeta = cards.find((c) => c.weekId === weekId) as Record<string, unknown> | undefined;
        const currentIsOfficialRest = (() => {
          if (!currentCardMeta) return false;
          const statusLabel = typeof currentCardMeta.statusLabel === "string" ? (currentCardMeta.statusLabel as string) : "";
          const baseOfficialRest = statusLabel.includes("공식"); // "휴식(공식)" → rest-official
          const seasonRaw =
            typeof currentCardMeta.seasonName === "string" && (currentCardMeta.seasonName as string).trim()
              ? (currentCardMeta.seasonName as string)
              : (`${currentCardMeta.displayTitle ?? ""} ${currentCardMeta.weekLabel ?? ""}`.match(/(봄|여름|가을|겨울)/)?.[1] ?? null);
          const weekNumber = typeof currentCardMeta.weekNumber === "number" ? (currentCardMeta.weekNumber as number) : null;
          return isOfficialRestWeek(seasonRaw, weekNumber, baseOfficialRest);
        })();
        if (weekId && prevWeekId && !currentIsOfficialRest) {
          // ── 개설 라인 content 보유 판정 ──
          // (정책) career 미선발 / info·experience synthetic fail 라인은 lineTargetId=null 이어도
          //   개설 라인 content(mainTitle/lineName/projectCode/companyName/outputLinks/outputImages)를
          //   채워 내려온다. 이런 라인은 "빈 placeholder"가 아니라 표시해야 할 실제 개설 라인이다.
          //   ⚠️ competency 만 void(빈) 허용 → competency 는 content 예외에서 제외(기존 보이드 유지).
          const hasLineContent = (l: Cluster4WeeklyLineDto): boolean =>
            !!(
              (typeof l.mainTitle === "string" && l.mainTitle.trim()) ||
              (typeof l.lineName === "string" && l.lineName.trim()) ||
              (typeof l.projectCode === "string" && l.projectCode.trim()) ||
              (typeof l.companyName === "string" && l.companyName.trim()) ||
              (Array.isArray(l.outputLinks) && l.outputLinks.some((o) => (((o?.url as string | null | undefined) ?? "")).trim())) ||
              (Array.isArray(l.outputImages) &&
                (l.outputImages as ReadonlyArray<{ url?: string | null } | null>).some((img) => ((img?.url ?? "")).trim()))
            );
          // 실제 라인 = lineTargetId 보유 OR (competency 제외) content 보유.
          const isContentLine = (l: Cluster4WeeklyLineDto, part: string): boolean =>
            !!l.lineTargetId || (part !== "competency" && hasLineContent(l));
          const hasRealLine = (wid: string, part: string) =>
            allLines.some((l) => (l.weekId ?? null) === wid && normPart(l.partType) === part && isContentLine(l, part));
          for (const part of ["information", "competency", "experience", "career"]) {
            if (hasRealLine(weekId, part)) continue; // 현재 주차에 실제 라인/개설 content 존재 → 직전 주차 끌어오지 않음
            const carried = allLines.filter(
              (l) =>
                (l.weekId ?? null) === prevWeekId &&
                !!l.lineTargetId &&
                normPart(l.partType) === part &&
                // ⚠️ 이미 평가 확정된(강화 성공/실패) N-1 라인은 그 주차 소유이므로 현재 주차로 끌어오지 않는다.
                //   carry-forward 의 대상은 "N-1 에 개설됐지만 아직 미평가(look-ahead)"인 라인뿐.
                //   (버그: v33 로 과거 주차 experience 가 내용 없는 not_applicable 이 되자, 직전 주차의
                //    fail 라인이 빈 현재 주차로 잘못 carry 되어 '강화 실패'로 오표시됐다. 백엔드 DTO 는 정상.)
                !["fail", "failed", "success"].includes(String(l.enhancementStatus ?? "").toLowerCase()),
            );
            if (carried.length === 0) continue;
            // 현재 주차의 빈 placeholder(lineTargetId 없음 + content 없음)는 제거한다.
            // (placeholder 가 남으면 careerLinesForWeek 등 "weekId 일치 라인 전체 map" 소비처에서
            //  끌어온 실제 라인과 함께 빈 카드가 렌더되거나 placeholder 가 실제 라인을 가린다.)
            // ⚠️ content 보유 개설 라인(career 미선발 등)은 제거하지 않는다 — 위 hasRealLine 가 true 라
            //    이 블록에 진입조차 안 하지만, 혼재 케이스 방어를 위해 조건에도 명시한다.
            for (let i = allLines.length - 1; i >= 0; i--) {
              const l = allLines[i];
              if ((l.weekId ?? null) === weekId && !l.lineTargetId && normPart(l.partType) === part && !isContentLine(l, part)) {
                allLines.splice(i, 1);
              }
            }
            for (const l of carried) {
              console.log("[cluster4-canEdit] N-1 라인 현재 주차로 노출", {
                part,
                fromWeekId: prevWeekId,
                toWeekId: weekId,
                lineTargetId: l.lineTargetId ?? null,
              });
              allLines.push({ ...l, weekId });
            }
          }
        }
        setCluster4Lines(allLines);

        // 진단: 현재 주차 카드/라인 가시성
        const matchedCard = cards.find((c) => c.weekId === weekId);
        const currentWeekLines = allLines.filter((l) => (l.weekId ?? null) === weekId);
        // section1-header 단일 출처: 현재 주차 카드 메타 보관 (미매칭 시 null → 로컬 fallback)
        setWeeklyCardMeta(matchedCard ?? null);
        // 진단: 신규 위클리 평판/연계 동료 DTO 필드가 실제로 내려오는지 확인 (백엔드 누락 시 즉시 식별용)
        if (matchedCard) {
          const mc = matchedCard as AdminCluster4WeeklyCardDto;
          console.log("[weekly-cards] 신규 평판/동료 DTO 필드 점검", {
            weekId,
            reputationSummary: mc.reputationSummary ?? null,
            colleagueSummary: mc.colleagueSummary ?? null,
            weeklyReputationsLen: Array.isArray(mc.weeklyReputations) ? mc.weeklyReputations.length : null,
            firstReputationFromProfile: mc.weeklyReputations?.[0]?.fromProfile ?? null,
            weeklyColleaguesLen: Array.isArray(mc.weeklyColleagues) ? mc.weeklyColleagues.length : null,
          });
        }
        if (!matchedCard) {
          console.warn("[cluster4-canEdit] weekly-cards 응답에 weekId 일치 카드 없음", {
            weekId,
            targetUserId,
            cardsCount: cards.length,
          });
        } else {
          console.log("[cluster4-canEdit] 현재 주차 라인 적재", {
            weekId,
            targetUserId,
            lineCount: currentWeekLines.length,
            lines: currentWeekLines.map((l) => ({
              partType: l.partType,
              activityTypeKey: l.activityTypeKey ?? null,
              lineCode: l.lineCode ?? null,
              lineTargetId: l.lineTargetId ?? null,
              canEdit: typeof l.canEdit === "boolean" ? l.canEdit : null,
            })),
          });
          // information part 라인만 따로 — 에세이 등 workInfo 매칭 진단용
          const infoLines = currentWeekLines.filter((l) => {
            const p = String(l.partType ?? "").toLowerCase();
            return p === "information" || p === "info";
          });
          console.log("[cluster4-canEdit] 현재 주차 information 라인", {
            weekId,
            infoLineCount: infoLines.length,
            informationLines: infoLines.map((l) => ({
              activityTypeKey: l.activityTypeKey ?? null,
              lineCode: l.lineCode ?? null,
              lineTargetId: l.lineTargetId ?? null,
              canEdit: typeof l.canEdit === "boolean" ? l.canEdit : null,
              editReason: (l.editReason as string | null | undefined) ?? null,
            })),
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("[cluster4-canEdit] /api/cluster4/weekly-cards fetch 실패", err);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isDemoMode, weekId, urlUserId, session?.user?.id, weeklyCardsRefreshKey]);

  // ── canEdit 매칭 helper ──
  // 반드시 weekId === 현재 주차 + partType 일치 + lineTargetId 존재 + sub-line key 일치
  // 로만 line 을 찾는다. partType-only 매칭은 금지.
  const normLineKey = (v: unknown) => String(v ?? "").replace(/\s+/g, "").toUpperCase();
  // partType 별칭 정규화 — 백엔드가 "exp"/"comp" 등 축약형으로 내려줘도 매칭되도록.
  const PART_ALIAS: Record<string, string> = {
    info: "information",
    information: "information",
    comp: "competency",
    competency: "competency",
    exp: "experience",
    experience: "experience",
    career: "career",
  };
  const normalizePartType = (p: unknown): string => {
    const raw = String(p ?? "").toLowerCase();
    return PART_ALIAS[raw] ?? raw;
  };
  // activityTypeId(카드) ↔ DTO activityTypeId/activityTypeKey 비교 (대소문자/공백 무시).
  const sameActivityKey = (a: unknown, b: unknown) =>
    a != null && b != null && String(a).replace(/\s+/g, "").toLowerCase() === String(b).replace(/\s+/g, "").toLowerCase();
  const findCluster4Line = (criteria: {
    partType: "information" | "competency" | "experience" | "career";
    activityTypeKey?: string | null;
    activityTypeId?: string | null;
    competencyLineMasterId?: string | null;
    experienceLineMasterId?: string | null;
    careerProjectId?: string | null;
    lineCode?: string | null;
    projectCode?: string | null;
  }, opts?: { requireLineTargetId?: boolean }): Cluster4WeeklyLineDto | undefined => {
    if (!weekId) return undefined;
    // 기본값 true → 기존 모달 canEdit 매칭 동작과 동일 (모달 호출부 변경 없음).
    // 미리보기 강화 상태 뱃지는 lineTargetId 없는 not_applicable 라인도 매칭해야 하므로 false 로 호출.
    const requireLineTargetId = opts?.requireLineTargetId !== false;
    return cluster4Lines.find((l) => {
      // 공통 조건
      if ((l.weekId ?? null) !== weekId) return false;
      const rawPart = String(l.partType ?? "").toLowerCase();
      const part = PART_ALIAS[rawPart] ?? rawPart;
      if (part !== criteria.partType) return false;
      if (requireLineTargetId && !l.lineTargetId) return false; // lineTargetId 존재 필수 (모달 canEdit 기준)
      // activityTypeId/activityTypeKey 기준 공통 fallback — 카드가 항상 들고 있는
      // activityTypeId 로 DTO 의 activityTypeId 또는 activityTypeKey 와 매칭한다.
      const activityIdMatch =
        criteria.activityTypeId != null &&
        (sameActivityKey(l.activityTypeId, criteria.activityTypeId) || sameActivityKey(l.activityTypeKey, criteria.activityTypeId));
      // sub-line key 매칭
      switch (criteria.partType) {
        case "information":
          return (
            (criteria.activityTypeKey != null &&
              String(l.activityTypeKey ?? "").toLowerCase() === String(criteria.activityTypeKey).toLowerCase()) ||
            activityIdMatch
          );
        case "competency":
          return (
            (criteria.competencyLineMasterId != null && l.competencyLineMasterId === criteria.competencyLineMasterId) ||
            (criteria.lineCode != null && normLineKey(l.lineCode) === normLineKey(criteria.lineCode)) ||
            activityIdMatch
          );
        case "experience":
          // 우선순위: experienceLineMasterId → lineCode → activityTypeId/activityTypeKey.
          // 카드에 experienceLineMasterId 가 없고 DTO lineCode 가 비어도
          // activityTypeId fallback 으로 매칭되도록 한다 (정보 카드와 동일한 신뢰 키).
          return (
            (criteria.experienceLineMasterId != null && l.experienceLineMasterId === criteria.experienceLineMasterId) ||
            (criteria.lineCode != null && normLineKey(l.lineCode) === normLineKey(criteria.lineCode)) ||
            activityIdMatch
          );
        case "career":
          return (
            (criteria.careerProjectId != null && l.careerProjectId === criteria.careerProjectId) ||
            (criteria.projectCode != null && normLineKey(l.projectCode) === normLineKey(criteria.projectCode)) ||
            activityIdMatch
          );
        default:
          return false;
      }
    });
  };

  // 작업 3: 이번 주 내가 보낸 평판 리스트 (중복 방지 + 7명 제한 체크용 — best-effort)
  // TODO: [백엔드 작업 필요]
  //   1. GET /api/weekly-reputations/sent-by-me?weekCardId=... 엔드포인트 추가
  //   2. 현재 로컬 state는 페이지 새로고침 시 리셋됨 (한계)
  //   3. 엔드포인트 생성 후 마운트 시점 fetch 로직 추가 → setSentReputationsThisWeek로 교체
  //   4. 받기 4명 제한은 서버 POST 시 검증 (프론트는 slice(0,4)만)
  const [sentReputationsThisWeek, setSentReputationsThisWeek] = useState<Array<{ targetUserId: string; weekCardId: string; createdAt: string }>>([]);
  // 주차 변경 시 로컬 리스트 리셋 (주차별 독립 카운터)
  useEffect(() => {
    setSentReputationsThisWeek([]);
  }, [weekId]);

  // 주차 평판 데이터 (API에서 가져옴)
  const [weeklyReputations, setWeeklyReputations] = useState<any[]>([]);

  // 크루 목록 (API에서 가져옴)
  const [allCrewList, setAllCrewList] = useState<any[]>([]);

  // 연계 동료 저장 상태
  const [colleagueSaving, setColleagueSaving] = useState(false);
  const [colleagueSaveSuccess, setColleagueSaveSuccess] = useState(false);
  const [colleagueSaveError, setColleagueSaveError] = useState<string | null>(null);

  // 연계 동료 편집 모달 — 1명 선택 + 코멘트 (자동완성 패턴)
  const [colleagueEditData, setColleagueEditData] = useState<{ selectedColleague: any | null; content: string }>({
    selectedColleague: null,
    content: "",
  });
  const [colleagueSearchQuery, setColleagueSearchQuery] = useState<string>("");
  const [colleagueFormSnapshot, setColleagueFormSnapshot] = useState<{ selectedColleague: any | null; content: string } | null>(null);
  const [colleagueSaveAttemptFailed, setColleagueSaveAttemptFailed] = useState(false);
  const [colleagueFieldErrorFlash, setColleagueFieldErrorFlash] = useState(false);
  const [isColleagueEditing, setIsColleagueEditing] = useState(false);

  // 주차 평판 카드 상세보기 모달 상태
  const [reputationViewModalOpen, setReputationViewModalOpen] = useState(false);
  const [selectedReputationCard, setSelectedReputationCard] = useState<any>(null);
  // 어드민 평판 수정 시 사용하는 평판 ID
  const [editingWeeklyReputationId, setEditingWeeklyReputationId] = useState<string | null>(null);

  // 연계 동료 카드 상세보기 모달 상태
  const [colleagueViewModalOpen, setColleagueViewModalOpen] = useState(false);
  const [selectedColleagueCard, setSelectedColleagueCard] = useState<any>(null);
  const [selectedColleagueIndex, setSelectedColleagueIndex] = useState<number>(0);

  const handleDeleteColleague = async () => {
    // 삭제도 동일 POST(주차 전체 교체) 엔드포인트를 쓰므로 저장과 같은 게이트를 적용.
    if (!(await requireWeeklyColleaguesWriteAccess())) return;
    if (!selectedColleagueCard) return;

    const remaining = selectedColleagues.filter((c) => c.id !== selectedColleagueCard.id);

    // 일반 모드: API로 동기화 (POST가 주차 단위로 전체 교체)
    if (!isDemoMode) {
      try {
        const payload = remaining.map((c) => ({ colleagueId: c.id, rank: c.rank, message: c.message || "" }));
        const res = await fetch(apiUrl("/api/weekly-colleagues"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekCardId: weekId, colleagues: payload }),
        });
        if (!res.ok) throw new Error("삭제 실패");
      } catch (err) {
        console.error("[colleague] 삭제 API 실패:", err);
        await popup.alert("삭제에 실패했습니다.");
        return;
      }
    }

    setSelectedColleagues(remaining);
    setColleagueViewModalOpen(false);
    setSelectedColleagueCard(null);
  };

  // 실무 정보 카드 상세보기 모달 상태
  const [workInfoViewModalOpen, setWorkInfoViewModalOpen] = useState(false);
  const [selectedWorkInfoCard, setSelectedWorkInfoCard] = useState<any>(null);

  // 도움말 모달 (workInfo 푸터 🔎 공용)
  const [helpModalKind, setHelpModalKind] = useState<"colleague" | "workInfo" | "reputation" | "weeklyReview" | null>(null);

  // 실무 역량 카드 상세보기 모달 상태
  const [workAbilityViewModalOpen, setWorkAbilityViewModalOpen] = useState(false);
  const [selectedWorkAbilityCard, setSelectedWorkAbilityCard] = useState<any>(null);

  // 실무 경험 카드 상세보기 모달 상태
  const [workExpViewModalOpen, setWorkExpViewModalOpen] = useState(false);
  const [selectedWorkExpCard, setSelectedWorkExpCard] = useState<any>(null);

  // 실무 경력 카드 상세보기 모달 상태
  const [workCareerViewModalOpen, setWorkCareerViewModalOpen] = useState(false);
  const [selectedWorkCareerCard, setSelectedWorkCareerCard] = useState<any>(null);

  // View 모달 편집 모드 상태
  const [workInfoViewIsEditing, setWorkInfoViewIsEditing] = useState(false);
  const [workAbilityViewIsEditing, setWorkAbilityViewIsEditing] = useState(false);
  const [workExpViewIsEditing, setWorkExpViewIsEditing] = useState(false);
  const [workCareerViewIsEditing, setWorkCareerViewIsEditing] = useState(false);

  // ── 4허브 표시 데이터 단일 출처(matchedLine) ──
  // canEdit 뿐 아니라 mainTitle / lineCode / projectCode / activityTypeName / outputLinks 까지
  // 모두 weekly-cards DTO 의 matchedLine 에서 가져온다. matchedLine 이 존재하면 backend 값 우선,
  // 없을 때만 legacy/dummy fallback 허용 (혼합 구조 금지).
  // findCluster4Line / 4개 카드 state 만 참조하므로 여기서 안전하게 derive 가능
  // (lineCodeMap 등 legacy 맵은 함수 본문 뒤쪽에 선언되므로 JSX 시점에 inline 참조한다).
  // ── 모달 표시 단일 출처 = DTO information 라인 ──
  // (정책) information/experience/career 는 synthetic fail / lineTargetId=null 이어도 DTO line 의
  //   mainTitle/outputLinks/outputImages 를 표시해야 한다(competency 만 void 허용).
  // strict(requireLineTargetId:true) 를 먼저 시도해 편집 가능 라인을 우선 잡고(= canEdit 회귀 방지),
  // 없을 때만 relaxed(requireLineTargetId:false) 로 synthetic fail 라인까지 매칭해 표시값을 살린다.
  // canEdit/저장 게이트는 별도 `!!lineTargetId` 검사를 사용하므로(2728/2890/3070) relaxed 매칭이어도
  // synthetic fail(lineTargetId=null)에서는 편집/저장이 활성화되지 않는다.
  const workInfoMatchedLine = selectedWorkInfoCard
    ? (findCluster4Line({
        partType: "information",
        activityTypeKey: (selectedWorkInfoCard.activityType as string | null | undefined) ?? null,
      }) ??
      findCluster4Line(
        {
          partType: "information",
          activityTypeKey: (selectedWorkInfoCard.activityType as string | null | undefined) ?? null,
        },
        { requireLineTargetId: false },
      ))
    : undefined;
  // 실무 역량 matchedLine — 카드가 들고 있는 실제 lineTargetId 로 직접 매칭(가장 신뢰 가능한 키).
  // 카드가 DTO competency 라인에서 생성되므로 lineTargetId 가 곧 selected line. lineTargetId 가 없을
  // 때만 legacy key(competencyLineMasterId/lineCode) 매칭으로 fallback. submission=null 은 라인 없음이 아님.
  const workAbilityMatchedLine = selectedWorkAbilityCard
    ? (() => {
        const ltid = (selectedWorkAbilityCard.lineTargetId as string | null | undefined) ?? null;
        if (ltid) {
          const byId = cluster4Lines.find(
            (l) => (l.weekId ?? null) === weekId && l.lineTargetId === ltid && normalizePartType(l.partType) === "competency",
          );
          if (byId) return byId;
        }
        const criteria = {
          partType: "competency" as const,
          competencyLineMasterId: (selectedWorkAbilityCard.competencyLineMasterId as string | null | undefined) ?? null,
          lineCode:
            (selectedWorkAbilityCard.lineCode as string | null | undefined) ??
            (selectedWorkAbilityCard.code as string | null | undefined) ??
            null,
        };
        // strict(배정 라인=lineTargetId 보유) 우선 → canEdit 회귀 방지. 없으면 미배정(lineTargetId=null)
        // 개설 라인도 매칭한다 — Step2 "강화 실패(미배정)" 카드의 개설 라인 메타(mainTitle/lineCode/
        // outputLinks/outputImages)를 모달에서 읽기 전용으로 보여주기 위함. (수정은 canEdit=false 로 차단.)
        return findCluster4Line(criteria) ?? findCluster4Line(criteria, { requireLineTargetId: false });
      })()
    : undefined;
  // ── 실무 경험 matchedLine (preview·modal 공유 resolver) ──
  // 카드 key(experienceLineMasterId/lineCode/activityTypeId)가 null·"-"·빈값으로 내려오는
  // 경우가 많아 key 기반 매칭이 구조적으로 실패한다. 따라서 "현재 주차의 experience DTO 라인"을
  // 직접 source 로 사용한다. preview(카드 빌드)와 modal 이 반드시 같은 matchedLine 을 보도록
  // 단일 resolver 로 통일한다. (정보 카드와 달리 카드 key 를 신뢰하지 않음)
  type ExpSelectedBy = "card.matchedLine" | "lineTargetId" | "lineKey" | "positional" | "canEdit" | "firstExperienceLine" | "none";
  const experienceLinesInWeek: Cluster4WeeklyLineDto[] = weekId
    ? cluster4Lines.filter((l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "experience")
    : [];

  // ── 실무 정보 카운트/달성률 단일 출처(어드민 weekly-cards DTO lines) ──
  // 앞 숫자(total) = 현재 주차에 개설된 information 라인 총 개수.
  // 뒤 숫자(success) = 그중 "강화 성공" 라인 개수.
  // 강화 성공 판정 기준 = line.enhancementStatus === "success" (백엔드 SoT — enhancementStatusBadge 와 동일 기준).
  //   pending(강화 대기) / fail(강화 실패) / not_applicable(해당 없음) 은 success 에서 제외.
  // 어드민 information 라인이 1개라도 수신되면 그것을 SoT 로 사용, 전혀 없으면 기존 로컬 infoStats 로 fallback(회귀 방지).
  const infoLinesInWeek: Cluster4WeeklyLineDto[] = weekId
    ? cluster4Lines.filter((l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "information")
    : [];
  const infoStatsAdmin = (() => {
    // 1) 백엔드 집계 단일 출처 우선 — weekly-cards 카드 DTO 에 info 집계(infoRate{rate,count,total})가
    //    내려오면 그대로 사용한다(프론트 재계산 금지). count=success(B), total=배정 라인 수(A).
    const infoRate = (weeklyCardMeta as (AdminCluster4WeeklyCardDto & { infoRate?: Cluster4RateDto | null }) | null)?.infoRate ?? null;
    if (infoRate && typeof infoRate.total === "number" && typeof infoRate.count === "number") {
      return {
        total: Number(infoRate.total) || 0,
        success: Number(infoRate.count) || 0,
        rate: typeof infoRate.rate === "number" ? infoRate.rate : null,
      };
    }
    // 2) fallback — DTO 라인의 numerator/denominator(백엔드 breakdownFromLines SoT, not_applicable
    //    제외 보정 완료)를 그대로 읽는다(careerStatsAdmin 동일 패턴 — 프론트 재계산 금지).
    //    (구버그) lines.length 를 세면 not_applicable placeholder(미개설 주차 UI 완결용 보이드)까지
    //    분모에 포함돼 "실제 개설 카드 0개인데 총 1개" + 주차 성장률 분모(합산)와 불일치가 났다.
    if (infoLinesInWeek.length === 0) {
      // 어드민 라인도 미수신 → 기존 로컬 계산값 유지
      return { total: Number(infoStats.total) || 0, success: Number(infoStats.success) || 0, rate: null };
    }
    const den = infoLinesInWeek.map((l) => l.denominator).find((d) => typeof d === "number") ?? null;
    const num = infoLinesInWeek.map((l) => l.numerator).find((n) => typeof n === "number") ?? null;
    const lineRate = infoLinesInWeek.map((l) => l.rate).find((r) => typeof r === "number") ?? null;
    // denominator null = 백엔드 A=0(미개설/휴식) → 0/0 (placeholder 를 세지 않는다)
    return { total: Number(den) || 0, success: Number(num) || 0, rate: typeof lineRate === "number" ? lineRate : null };
  })();
  // 강화율: 백엔드 rate 가 있으면 그대로, 없으면 프론트 fallback 재계산(Math.round((B/A)*100)).
  // 총 개수 0 → 0 (NaN/Infinity 방지). 소수점 없이 정수 반올림.
  const infoSuccessRate =
    typeof infoStatsAdmin.rate === "number"
      ? infoStatsAdmin.rate
      : infoStatsAdmin.total > 0
        ? Math.round((infoStatsAdmin.success / infoStatsAdmin.total) * 100)
        : 0;

  // ── 실무 역량 카운트/달성률 단일 출처(어드민 weekly-cards DTO) — infoStatsAdmin 와 동일 패턴 ──
  // A(total) = 해당 주차 해당 사용자에게 배정된 competency 라인 수, B(success) = 그중 강화 성공 라인 수.
  // 기준은 백엔드에서 이미 보정 완료(A=0→0). 프론트 재계산 금지.
  // 1) weeklyCardMeta.competencyRate{rate,count,total} 우선(count=B, total=A).
  // 2) 미수신 시에만 DTO competency 라인 배열(enhancementStatus==="success")로 재계산.
  // 3) 라인도 미수신 시에만 기존 로컬 competencyStats 로 fallback(회귀 방지).
  const competencyLinesForStats: Cluster4WeeklyLineDto[] = weekId
    ? cluster4Lines.filter((l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "competency")
    : [];
  // 실제 개설된 역량 라인 = 어드민 DTO 의 enhancementStatus 가 not_applicable 이 아닌 라인
  //   (= breakdownFromLines 분모 A: success/pending/fail. den>0). 어드민 강화 집계와 동일 SoT.
  // ⚠ (2026-07 수정) 기존엔 lineTargetId 보유로 걸렀는데, 그러면 "라인은 개설됐지만 내가 대상이 아닌"
  //   비대상 synthetic fail(enhancementStatus="fail", lineTargetId=null, denominator=1)이 집계에서
  //   빠져 "강화 실패(표시) + 총 0개(집계)" 모순이 났다. 실무 역량은 그 주차에 라인이 누군가에게 개설됐으면
  //   비대상자도 분모에 포함(총 1개 중 0개)해야 한다 — enhancementStatus 기준으로 통일해 표시축(강화 상태)과
  //   집계축(총/중)이 항상 같은 SoT 를 쓰게 한다. not_applicable(그 주차 미개설)만 제외 → 총 0개.
  const realCompetencyLines = competencyLinesForStats.filter(
    (l) => (l.enhancementStatus ?? "not_applicable") !== "not_applicable",
  );
  const competencyStatsAdmin = (() => {
    // 실제 개설된 역량 라인이 0개면 집계도 0 — 빈 placeholder/legacy 하드코딩(competencyStats=1) 미포함.
    if (realCompetencyLines.length === 0) {
      return { total: 0, success: 0, rate: null };
    }
    const competencyRate =
      (weeklyCardMeta as (AdminCluster4WeeklyCardDto & { competencyRate?: Cluster4RateDto | null }) | null)?.competencyRate ?? null;
    if (competencyRate && typeof competencyRate.total === "number" && typeof competencyRate.count === "number") {
      return {
        total: Number(competencyRate.total) || 0,
        success: Number(competencyRate.count) || 0,
        rate: typeof competencyRate.rate === "number" ? competencyRate.rate : null,
      };
    }
    if (competencyLinesForStats.length === 0) {
      return { total: Number(competencyStats.total) || 0, success: Number(competencyStats.success) || 0, rate: null };
    }
    // DTO 라인 numerator/denominator(백엔드 SoT, na 제외 보정 완료) 직접 사용 — infoStatsAdmin 와 동일.
    // (구버그) lines.length 카운트는 na placeholder 포함 → "개설 0개인데 총 1개" 불일치.
    const den = competencyLinesForStats.map((l) => l.denominator).find((d) => typeof d === "number") ?? null;
    const num = competencyLinesForStats.map((l) => l.numerator).find((n) => typeof n === "number") ?? null;
    const lineRate = competencyLinesForStats.map((l) => l.rate).find((r) => typeof r === "number") ?? null;
    return { total: Number(den) || 0, success: Number(num) || 0, rate: typeof lineRate === "number" ? lineRate : null };
  })();
  const competencySuccessRate =
    typeof competencyStatsAdmin.rate === "number"
      ? competencyStatsAdmin.rate
      : competencyStatsAdmin.total > 0
        ? Math.round((competencyStatsAdmin.success / competencyStatsAdmin.total) * 100)
        : 0;
  // 카드(legacy or built) 1개 → matchedLine 결정. cardIndex 가 주어지면(빌드 시) 위치 기반 fallback 사용.
  const resolveExpMatchedLine = (card: any, cardIndex?: number): { line: Cluster4WeeklyLineDto | undefined; by: ExpSelectedBy } => {
    if (!card) return { line: undefined, by: "none" };
    // 이미 해석된 matchedLine 을 들고 있으면(빌드에서 주입) 그대로 사용 → preview·modal 동일 source 보장
    if (card.matchedLine) return { line: card.matchedLine as Cluster4WeeklyLineDto, by: "card.matchedLine" };

    const cardLineTargetId = (card.lineTargetId as string | null | undefined) ?? null;
    const cardExpMasterId = (card.experienceLineMasterId as string | null | undefined) ?? null;
    const cardCodeRaw = (card.code as string | null | undefined) ?? null;
    const cardCode = cardCodeRaw && cardCodeRaw !== "-" ? cardCodeRaw : null; // "-" 는 비신뢰
    const cardActivityTypeId = (card.activityTypeId as string | null | undefined) ?? null;

    // 1) lineTargetId 직접 매칭 (가장 신뢰)
    if (cardLineTargetId) {
      const l = experienceLinesInWeek.find((x) => x.lineTargetId === cardLineTargetId);
      if (l) return { line: l, by: "lineTargetId" };
    }
    // 2) 신뢰 가능한 key 가 있을 때만 key 기반 매칭 (여러 라인 구분 보존)
    if (cardExpMasterId != null || cardCode != null || cardActivityTypeId != null) {
      const l = findCluster4Line({
        partType: "experience",
        experienceLineMasterId: cardExpMasterId,
        lineCode: cardCode,
        activityTypeId: cardActivityTypeId,
      });
      if (l) return { line: l, by: "lineKey" };
    }
    // 3) 위치(index) 기반 — 빌드 시 카드 순서 ↔ DTO 라인 순서 대응 (여러 라인 구분).
    //    빌드(cardIndex 명시) 경로에서만 사용. 모달 경로(cardIndex 없음)는 타지 않음.
    if (typeof cardIndex === "number" && experienceLinesInWeek[cardIndex]) {
      return { line: experienceLinesInWeek[cardIndex], by: "positional" };
    }
    // ── 매칭 실패 → 해당 슬롯에 라인 없음(undefined) ──
    // [버그 수정] 이전엔 여기서 canEdit=true 라인 / 첫 experience 라인을 임의로 가져왔다.
    // 그 결과 미개설(빈) 슬롯의 placeholder 카드를 클릭해도 1번 슬롯 라인이 matchedLine 으로
    // 잡혀 모달에 1번 값이 그대로 표시되는 누수가 발생했다.
    // → 정확한 슬롯 라인은 card.matchedLine(빌드 시 슬롯 라인 주입) / lineTargetId / 신뢰 key /
    //   (빌드 한정) positional 로만 결정한다. 매칭 없으면 라인 없음으로 반환.
    return { line: undefined, by: "none" };
  };
  const { line: workExpMatchedLine, by: workExpSelectedBy } = resolveExpMatchedLine(selectedWorkExpCard);
  const workCareerMatchedLine = selectedWorkCareerCard
    ? findCluster4Line({
        partType: "career",
        careerProjectId: (selectedWorkCareerCard.careerProjectId as string | null | undefined) ?? null,
        projectCode:
          (selectedWorkCareerCard.projectCode as string | null | undefined) ??
          (selectedWorkCareerCard.lineCode as string | null | undefined) ??
          (selectedWorkCareerCard.code as string | null | undefined) ??
          null,
      })
    : undefined;

  // ── 모달 강화 뱃지 전용 라인 (카드 미리보기와 동일 매칭) ──
  // 위 *MatchedLine 들은 모달 canEdit 기준이라 requireLineTargetId=true 로 매칭한다.
  // 그 결과 lineTargetId 가 없는 라인(not_applicable / synthetic fail 등)은 모달에서 매칭
  // 실패 → enhancementStatusBadge 가 null → 뱃지가 기존 legacy(로컬 카드값) stale 로 떨어진다.
  // 카드 미리보기 뱃지는 requireLineTargetId:false 로 매칭하므로(8516/8716/8857/8937),
  // 모달 뱃지도 동일 기준의 relaxed 라인을 두고 strict 미매칭 시 이 라인으로 fallback 한다.
  // (canEdit/저장 게이트는 그대로 strict *MatchedLine + 별도 !!lineTargetId 검사를 사용 → 회귀 없음.)
  const workInfoBadgeLine = selectedWorkInfoCard
    ? findCluster4Line(
        { partType: "information", activityTypeKey: (selectedWorkInfoCard.activityType as string | null | undefined) ?? null },
        { requireLineTargetId: false },
      )
    : undefined;
  const workAbilityBadgeLine = selectedWorkAbilityCard
    ? findCluster4Line(
        {
          partType: "competency",
          competencyLineMasterId: (selectedWorkAbilityCard.competencyLineMasterId as string | null | undefined) ?? null,
          lineCode:
            (selectedWorkAbilityCard.lineCode as string | null | undefined) ??
            (selectedWorkAbilityCard.code as string | null | undefined) ??
            null,
        },
        { requireLineTargetId: false },
      )
    : undefined;
  const workExpBadgeLine = selectedWorkExpCard
    ? findCluster4Line(
        {
          partType: "experience",
          experienceLineMasterId: (selectedWorkExpCard.experienceLineMasterId as string | null | undefined) ?? null,
          lineCode: (selectedWorkExpCard.code as string | null | undefined) ?? null,
        },
        { requireLineTargetId: false },
      )
    : undefined;
  const workCareerBadgeLine = selectedWorkCareerCard
    ? findCluster4Line(
        {
          partType: "career",
          careerProjectId: (selectedWorkCareerCard.careerProjectId as string | null | undefined) ?? null,
          projectCode:
            (selectedWorkCareerCard.projectCode as string | null | undefined) ??
            (selectedWorkCareerCard.lineCode as string | null | undefined) ??
            (selectedWorkCareerCard.code as string | null | undefined) ??
            null,
        },
        { requireLineTargetId: false },
      )
    : undefined;

  // matchedLine.outputLinks[idx] → {desc,url} 안전 추출 (legacy outputLinks 와 동일 형태로 정규화).
  // 순수 함수 — later-declared 맵을 참조하지 않으므로 위치 무관하게 안전.
  const lineOutputLinkAt = (line: Cluster4WeeklyLineDto | undefined, idx: number): { desc: string; url: string } | null => {
    if (!line || !Array.isArray(line.outputLinks)) return null;
    const l = line.outputLinks[idx];
    if (!l) return null;
    // 표시 라벨 단일 출처: desc ?? label (업스트림이 label 로 줄 수 있어 별칭 수용). 둘 다 없으면 표시단에서 url fallback.
    const label = (l.desc as string | null | undefined) ?? (l.label as string | null | undefined) ?? "";
    return { desc: label, url: (l.url as string | null | undefined) ?? "" };
  };
  // 사용자 제출 Output Link 단일 출처 — submission.outputLinks[idx] (사용자분만, 어드민 슬롯 제외 후의 인덱스).
  // ⚠️ top-level outputLinks(어드민 개설값)와 구분 — competency 사용자 슬롯 표시에만 사용한다.
  const lineSubmissionOutputLinkAt = (line: Cluster4WeeklyLineDto | undefined, idx: number): { desc: string; url: string } | null => {
    if (idx < 0) return null;
    const links = (line?.submission as { outputLinks?: Array<{ desc?: string | null; label?: string | null; url?: string | null }> | null } | null | undefined)?.outputLinks;
    if (!Array.isArray(links)) return null;
    const l = links[idx];
    if (!l) return null;
    // 표시 라벨 단일 출처: desc ?? label (업스트림 별칭 수용). 둘 다 없으면 표시단에서 url fallback.
    return { desc: l.desc ?? l.label ?? "", url: l.url ?? "" };
  };
  // 실무 역량(competency) 어드민 Output Link 슬롯 수 — adminOutputLinkCount(SoT) → top-level outputLinks 유효
  // 개수 → legacy(getAdminOutputLinksCount) 순. legacy 헬퍼는 weeklyActivities 만 보므로, 운영진이 DTO 라인
  // 으로만 개설한 링크(weeklyActivities 미존재)를 0 으로 세어 admin 링크가 누락된다 — 그 회귀를 막는다.
  const getAbilityAdminLinkCount = (matchedLine: Cluster4WeeklyLineDto | undefined, activityTypeId?: string | null): number => {
    const raw = (() => {
      if (matchedLine?.adminOutputLinkCount != null) return matchedLine.adminOutputLinkCount;
      if (Array.isArray(matchedLine?.outputLinks)) {
        const n = matchedLine!.outputLinks!.filter((l) => (l?.url as string | null | undefined)?.trim()).length;
        if (n > 0) return n;
      }
      return activityTypeId ? getAdminOutputLinksCount(activityTypeId, matchedLine) : 0;
    })();
    return Math.min(raw, ADMIN_OUTPUT_LINK_MAX); // 운영진 output link 정책: 최대 1
  };
  // 실무 역량(competency) 어드민 Output Image (top-level outputImages → legacy) — { url, caption }[]. (정책: 최대 1)
  const getAbilityAdminImages = (matchedLine: Cluster4WeeklyLineDto | undefined, activityTypeId?: string | null): Array<{ url: string; caption: string }> => {
    const lineImages = normalizeOutputImages(
      matchedLine?.outputImages as ReadonlyArray<string | { url?: string | null; caption?: string | null } | null> | null | undefined,
    );
    if (lineImages.length > 0) return lineImages.slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    return (activityTypeId ? getAdminOutputImages(activityTypeId, matchedLine) : []).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
  };
  const getAbilityAdminImageCount = (matchedLine: Cluster4WeeklyLineDto | undefined, activityTypeId?: string | null): number => {
    const raw = matchedLine?.adminOutputImageCount != null ? matchedLine.adminOutputImageCount : getAbilityAdminImages(matchedLine, activityTypeId).length;
    // 예약 슬롯 모델(2026-07-18): 운영진 슬롯 0 은 이미지 유무·라인 매칭 성패와 무관하게 **항상 예약**(크루는 2번
    //   슬롯부터). admin DTO(v47)가 adminOutputImageCount=RESERVED_ADMIN_IMAGE_SLOTS 를 무조건 보내는 계약과 동일.
    //   ⚠️ fail-safe: matchedLine 부재/DTO 불완전/stale snapshot(구 count=0)에서도 0 으로 떨어지지 않게 무조건 floor
    //   한다. 라인 조회 실패를 "운영진 슬롯 없음"으로 해석하면 크루 첫 이미지가 1번 슬롯으로 밀린다.
    const reserved = Math.max(raw, RESERVED_ADMIN_IMAGE_SLOTS);
    return Math.min(reserved, ADMIN_OUTPUT_IMAGE_MAX); // 운영진 output image 정책: 최대 1
  };

  // ── 강화 상태 status-badge 이미지/라벨 (백엔드 DTO 단일 출처) ──
  // 프론트 재계산 금지: line.enhancementStatus / line.enhancementReason 값만 사용한다.
  // 기존 status-badge(line-enhance-icon) DOM/className 을 그대로 두고 img src/alt 만 이 매핑으로 결정.
  // 매핑되는 값이 없으면 null → 호출부는 기존 legacy fallback 을 사용한다.
  const enhancementStatusBadge = (
    line: Cluster4WeeklyLineDto | undefined,
  ): { src: string; alt: string; text: string; toneClass: string } | null => {
    const s = (line?.enhancementStatus as string | null | undefined) ?? null;
    // (정책 2026-06-04 v14 개정) 강화 상태 뱃지는 백엔드 enhancementStatus 를 그대로 사용한다.
    // 역량은 1인·1주차 단일 칸 정규화 — 백엔드가 success/pending/fail 을 항상 내려주고,
    // 선택 과제 미수행(라인 0개 포함)은 pending("강화 대기")이다. 구 2026-06-02 보이드 정책의
    // "미배정 competency pending → 해당 없음" 강등은 폐기 — 활동 주차 역량에 해당 없음 금지.
    if (process.env.NODE_ENV !== "production" && line) {
      console.log("[cluster4-enhancement]", {
        partType: line.partType,
        lineTargetId: line.lineTargetId,
        status: line.status,
        submissionStatus: line.submissionStatus,
        enhancementStatus: line.enhancementStatus,
        enhancementReason: line.enhancementReason,
        canEdit: line.canEdit,
        editReason: line.editReason,
      });
    }
    if (s === "success") return { src: "/images/0/cluster4/icon/5 강화 성공.png", alt: "success", text: "강화 성공", toneClass: "success" };
    if (s === "pending") return { src: "/images/0/cluster4/icon/6 강화 대기.png", alt: "pending", text: "강화 대기", toneClass: "waiting" };
    if (s === "fail") return { src: "/images/0/cluster4/icon/7 강화 실패.png", alt: "fail", text: "강화 실패", toneClass: "failed" };
    if (s === "not_applicable") {
      const reason = (line?.enhancementReason as string | null | undefined) ?? null;
      // 이미지는 항상 "8 해당 없음.png", 라벨만 reason 으로 세분화 (non_career → 미배정).
      const text = reason === "target_missing_not_required_non_career" ? "미배정" : "해당 없음";
      return { src: "/images/0/cluster4/icon/8 해당 없음.png", alt: "not_applicable", text, toneClass: "not_applicable" };
    }
    return null;
  };

  // ── 라인 카드 모달 오픈 게이트 (2026-06-04 정책) ──
  // not_applicable / void / empty(placeholder) 카드는 화면에 그대로 표시하되 클릭해도 모달을 열지 않는다.
  // 오픈 가능 = pending(=waiting) / success / fail(=failed) 만. 판정 입력값은 각 카드의 "표시 상태"
  // (enhancementStatusBadge toneClass 우선 → legacy 카드 enum) — 뱃지와 게이트가 항상 같은 기준을 본다.
  // ※ 모달 금지 상태(not_applicable/void/empty)는 곧 비활성 카드(Faded Card) 빛바램 대상 —
  //   컨테이너 .faded-card 부착 판정 SoT 는 lib/cluster4-faded-card.ts isFadedCardStatus (동일 표시 상태 입력).
  const MODAL_OPENABLE_STATUSES = new Set(["pending", "waiting", "success", "fail", "failed"]);
  const canOpenLineModal = (status: string | null | undefined): boolean =>
    MODAL_OPENABLE_STATUSES.has(String(status ?? "").trim().toLowerCase());

  // ── 실무 경력(career) 등급/점수/평가 상태 표시 (백엔드 DTO 단일 출처) ──
  // 프론트 재계산 금지: line.careerGrade / careerGradePoints / careerRatingStatus / enhancementReason 값만 사용한다.
  // DTO 라인이 없을 때만 careerRecords 기반 카드(legacy: card.grade / card.gradePoints)로 fallback 한다.
  // 어떤 상태(fail/미제출 포함)에서도 라인 내용은 계속 표시되며, 이 헬퍼는 표시 값만 결정한다.
  const careerGradeInfo = (
    line: Cluster4WeeklyLineDto | undefined,
    card?: { grade?: string | null; gradePoints?: number | null } | null,
  ): {
    grade: string | null; // "S"|"A"|"B"|"C"|"D" | null(미평가 → 활성 등급 없음)
    points: number | null; // 10/8/6/4/2 | null
    ratingStatus: string | null; // "success"|"fail"|"unevaluated"|null
    ratingLabel: string | null; // 평가 성공/평가 실패/평가 대기
    reasonLabel: string | null; // 미제출/D등급/평가 통과/평가 대기
  } => {
    // DTO careerGrade 우선, "" / null 이면 legacy card.grade fallback (그래도 없으면 null = 미평가)
    const grade = (line?.careerGrade as string | null | undefined) || (card?.grade ?? null) || null;
    // 점수: DTO careerGradePoints 우선. 부재 시 등급 고정 환산표(S=10/A=8/B=6/C=4/D=2)로 fallback —
    // legacy card.gradePoints 는 스케일이 불명확(데모는 랜덤)하므로 등급 기준 환산을 사용한다. 미평가 → null.
    const GRADE_POINTS: Record<string, number> = { S: 10, A: 8, B: 6, C: 4, D: 2 };
    const points =
      typeof line?.careerGradePoints === "number"
        ? line.careerGradePoints
        : grade && GRADE_POINTS[grade] != null
          ? GRADE_POINTS[grade]
          : null;
    const ratingStatus = (line?.careerRatingStatus as string | null | undefined) ?? null;
    const ratingLabel =
      ratingStatus === "success" ? "평가 성공" : ratingStatus === "fail" ? "평가 실패" : ratingStatus === "unevaluated" ? "평가 대기" : null;
    const reason = (line?.enhancementReason as string | null | undefined) ?? null;
    const reasonLabel =
      reason === "career_not_submitted"
        ? "미제출"
        : reason === "career_grade_fail"
          ? "D등급"
          : reason === "career_grade_success"
            ? "평가 통과"
            : reason === "career_unevaluated_after_deadline"
              ? "평가 대기"
              : null;
    return { grade, points, ratingStatus, ratingLabel, reasonLabel };
  };

  // workInfo 푸터 안내문 상태 (cluster2/cluster3 표준 — 필수필드 누락 시 error)
  const [workInfoFooterNotice, setWorkInfoFooterNotice] = useState<"default" | "error">("default");

  // workInfo View 모달 — 편집 진입 시 스냅샷 (취소/초기화/isDirty 비교용)
  const workInfoSnapshot = useRef<any>(null);

  // workInfo View 모달 — 편집 모드 입력 state (보기 모드에서는 selectedWorkInfoCard 직접 표시)
  const [editingSubTitle, setEditingSubTitle] = useState<string>("");
  const [editingGrowthPoint, setEditingGrowthPoint] = useState<string>("");
  const [editingOutputLinks, setEditingOutputLinks] = useState<{ desc: string; url: string }[]>(Array(5).fill({ desc: "", url: "" }));
  // Output Link 2차 모달 (URL/설명 분리 입력)
  const [outputLinkEditModal, setOutputLinkEditModal] = useState<{
    modalType: "workInfo" | "workExp" | "workAbility" | "workCareer";
    linkIdx: number;
    url: string;
    desc: string;
    error: string;
  } | null>(null);
  // admin preview 저장 값 — edit mode가 false로 돌아가도 유지 (새로고침 시 초기화)
  const [adminSavedOutputLinks, setAdminSavedOutputLinks] = useState<Record<string, { desc: string; url: string }[]>>({});
  // Output Link 커스텀 툴팁 (보기 모드 hover)
  const [olTooltip, setOlTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const olTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOlTooltip = (e: React.MouseEvent, text: string) => {
    if (!text) return;
    const el = e.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth) return;
    if (olTooltipTimer.current) clearTimeout(olTooltipTimer.current);
    const rect = el.getBoundingClientRect();
    setOlTooltip({ text, x: rect.left + rect.width / 2, y: rect.top - 6 });
  };
  const hideOlTooltip = () => {
    if (olTooltipTimer.current) clearTimeout(olTooltipTimer.current);
    olTooltipTimer.current = setTimeout(() => setOlTooltip(null), 80);
  };
  const [editingImages, setEditingImages] = useState<(string | null)[]>(createEmptyWorkInfoImages);
  const imageFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [editingImageCaptions, setEditingImageCaptions] = useState<string[]>(createEmptyWorkInfoCaptions);
  // cluster3 captionOpenIndex 패턴 — 활성 슬롯 idx(null=비활성)
  const [activeCaptionIdx, setActiveCaptionIdx] = useState<number | null>(null);
  // cluster3 패턴: 편집 모드 종료 시 캡션 토글 리셋
  useEffect(() => {
    if (!workInfoViewIsEditing) setActiveCaptionIdx(null);
  }, [workInfoViewIsEditing]);
  // 데모 모드: true (수정 가능 — UI 테스트용) / 일반 모드: weekly-cards DTO 의 canEdit 단일 출처.
  const [canEditWorkInfo, setCanEditWorkInfo] = useState<boolean>(isDemoMode);
  useEffect(() => {
    // 편집 진입(handleEditWorkInfo)·수정 버튼 disabled·저장 핸들러(handleSaveWorkInfo) 차단 기준을
    // 단일 기준으로 통일한다: 더미/순수 어드민 프리뷰(forceEditUnlock)는 항상 true, 그 외(일반·테스트 유저)는
    // workInfoMatchedLine.canEdit === true && lineTargetId 존재 (백엔드 단일 출처, 프론트 재계산 금지).
    if (forceEditUnlock) {
      setCanEditWorkInfo(true);
      return;
    }
    // 타 크루 카드 열람(viewer ≠ page owner)에서는 4허브 수정 불가.
    if (isForeignViewer) {
      setCanEditWorkInfo(false);
      return;
    }
    const lineTargetId = (workInfoMatchedLine?.lineTargetId as string | null | undefined) ?? null;
    setCanEditWorkInfo(workInfoMatchedLine?.canEdit === true && !!lineTargetId);
  }, [forceEditUnlock, isForeignViewer, workInfoMatchedLine]);

  // ========== workAbility View 모달 전용 state (workInfo 패턴 복제, 완전 독립) ==========
  const [workAbilityFooterNotice, setWorkAbilityFooterNotice] = useState<"default" | "error">("default");
  const workAbilitySnapshot = useRef<any>(null);
  const [editingAbilitySubTitle, setEditingAbilitySubTitle] = useState<string>("");
  const [editingAbilityGrowthPoint, setEditingAbilityGrowthPoint] = useState<string>("");
  const [editingAbilityOutputLinks, setEditingAbilityOutputLinks] = useState<{ desc: string; url: string }[]>(Array(5).fill({ desc: "", url: "" }));
  const abilityImageFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editingAbilityImages, setEditingAbilityImages] = useState<(string | null)[]>(createEmptyWorkInfoImages);
  const [previewAbilityImageUrl, setPreviewAbilityImageUrl] = useState<string | null>(null);
  const [editingAbilityImageCaptions, setEditingAbilityImageCaptions] = useState<string[]>(createEmptyWorkInfoCaptions);
  const [activeAbilityCaptionIdx, setActiveAbilityCaptionIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!workAbilityViewIsEditing) setActiveAbilityCaptionIdx(null);
  }, [workAbilityViewIsEditing]);
  const [showAbilityHelpModal, setShowAbilityHelpModal] = useState(false);
  const [canEditWorkAbility, setCanEditWorkAbility] = useState<boolean>(isDemoMode);
  useEffect(() => {
    // 강제 활성(더미/순수 어드민 프리뷰)은 true. 테스트 유저(demoUserId)는 일반 모드와 동일하게
    // workAbilityMatchedLine.canEdit + lineTargetId 단일 출처. 일반 모드는 상위 통합 effect(승인 기준)가 셋업.
    if (forceEditUnlock) { setCanEditWorkAbility(true); return; }
    if (isForeignViewer) { setCanEditWorkAbility(false); return; }
    if (demoUserId) {
      const lineTargetId = (workAbilityMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      setCanEditWorkAbility(workAbilityMatchedLine?.canEdit === true && !!lineTargetId);
    }
  }, [forceEditUnlock, isForeignViewer, demoUserId, workAbilityMatchedLine]);

  // ========== workExp View 모달 전용 state (workInfo 패턴 복제, 완전 독립) ==========
  const [workExpFooterNotice, setWorkExpFooterNotice] = useState<"default" | "error">("default");
  const workExpSnapshot = useRef<any>(null);
  const [editingExpSubTitle, setEditingExpSubTitle] = useState<string>("");
  const [editingExpGrowthPoint, setEditingExpGrowthPoint] = useState<string>("");
  const [editingExpOutputLinks, setEditingExpOutputLinks] = useState<{ desc: string; url: string }[]>(Array(5).fill({ desc: "", url: "" }));
  const expImageFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editingExpImages, setEditingExpImages] = useState<(string | null)[]>(createEmptyWorkInfoImages);
  const [previewExpImageUrl, setPreviewExpImageUrl] = useState<string | null>(null);
  const [editingExpImageCaptions, setEditingExpImageCaptions] = useState<string[]>(createEmptyWorkInfoCaptions);
  const [activeExpCaptionIdx, setActiveExpCaptionIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!workExpViewIsEditing) setActiveExpCaptionIdx(null);
  }, [workExpViewIsEditing]);
  const [showExpHelpModal, setShowExpHelpModal] = useState(false);
  const [canEditWorkExp, setCanEditWorkExp] = useState<boolean>(isDemoMode);
  useEffect(() => {
    // 강제 활성(더미/순수 어드민 프리뷰)은 true. 테스트 유저(demoUserId)는 일반 모드와 동일하게
    // workExpMatchedLine.canEdit + lineTargetId 단일 출처. 일반 모드는 상위 통합 effect(승인 기준)가 셋업.
    if (forceEditUnlock) { setCanEditWorkExp(true); return; }
    if (isForeignViewer) { setCanEditWorkExp(false); return; }
    if (demoUserId) {
      const lineTargetId = (workExpMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      setCanEditWorkExp(workExpMatchedLine?.canEdit === true && !!lineTargetId);
    }
  }, [forceEditUnlock, isForeignViewer, demoUserId, workExpMatchedLine]);
  // workExp 전용: 라인 평점 (0~10, 0=미입력)
  const [editingExpRating, setEditingExpRating] = useState<number>(0);

  // ========== workCareer View 모달 전용 state (workExp 패턴 복제, 3장 이미지, 평점 없음) ==========
  const [workCareerFooterNotice, setWorkCareerFooterNotice] = useState<"default" | "error">("default");
  const workCareerSnapshot = useRef<any>(null);
  const [editingCareerSubTitle, setEditingCareerSubTitle] = useState<string>("");
  const [editingCareerGrowthPoint, setEditingCareerGrowthPoint] = useState<string>("");
  const [editingCareerOutputLinks, setEditingCareerOutputLinks] = useState<{ desc: string; url: string }[]>(Array(5).fill({ desc: "", url: "" }));
  const careerImageFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // TODO: [백엔드 작업 필요] 이미지 저장 DB 컬럼 확정 후 editingCareerImages를 record 필드와 연동
  const [editingCareerImages, setEditingCareerImages] = useState<(string | null)[]>(createEmptyWorkCareerImages);
  const [previewCareerImageUrl, setPreviewCareerImageUrl] = useState<string | null>(null);
  const [editingCareerImageCaptions, setEditingCareerImageCaptions] = useState<string[]>(createEmptyWorkCareerCaptions);
  const [activeCareerCaptionIdx, setActiveCareerCaptionIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!workCareerViewIsEditing) setActiveCareerCaptionIdx(null);
  }, [workCareerViewIsEditing]);
  const [showCareerHelpModal, setShowCareerHelpModal] = useState(false);

  // Weekly Review 박스 — unfurl 애니메이션 (작업 0~2)
  // [Fix] 초기값을 true로: viewport 감지 트리거 실패 케이스 회피 — 박스가 항상 보이도록
  const weeklyReviewRef = useRef<HTMLDivElement>(null);
  const [isReviewUnfurled, setIsReviewUnfurled] = useState(true);

  const [canEditWorkCareer, setCanEditWorkCareer] = useState<boolean>(isDemoMode);
  useEffect(() => {
    // 강제 활성(더미/순수 어드민 프리뷰)은 true. 테스트 유저(demoUserId)는 일반 모드와 동일하게
    // workCareerMatchedLine.canEdit + lineTargetId 단일 출처. 일반 모드는 상위 통합 effect(승인 기준)가 셋업.
    if (forceEditUnlock) { setCanEditWorkCareer(true); return; }
    if (isForeignViewer) { setCanEditWorkCareer(false); return; }
    if (demoUserId) {
      const lineTargetId = (workCareerMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      setCanEditWorkCareer(workCareerMatchedLine?.canEdit === true && !!lineTargetId);
    }
  }, [forceEditUnlock, isForeignViewer, demoUserId, workCareerMatchedLine]);

  // Weekly Review 박스 — scroll + getBoundingClientRect (1회성 unfurl)
  // clip-path: inset(0 100% 0 0)로 IntersectionObserver dead-lock 회피
  // [Fix] window 스크롤이 박스 영역을 못 닿으면 unfurl이 영원히 안 일어나는 문제 — 마운트 후 200ms 안에 무조건 unfurl
  useEffect(() => {
    const target = weeklyReviewRef.current;
    if (!target) return;
    if (isReviewUnfurled) return;

    const checkVisible = () => {
      const r = target.getBoundingClientRect();
      const isVisible = r.top < window.innerHeight && r.bottom > 0;
      if (isVisible) {
        setIsReviewUnfurled(true);
        window.removeEventListener("scroll", checkVisible);
        window.removeEventListener("resize", checkVisible);
      }
    };

    const initialTimer = setTimeout(checkVisible, 100);
    // viewport 감지 실패해도 마운트 후 일정 시간 뒤 무조건 unfurl
    const fallbackTimer = setTimeout(() => setIsReviewUnfurled(true), 200);

    window.addEventListener("scroll", checkVisible, { passive: true });
    window.addEventListener("resize", checkVisible, { passive: true });

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(fallbackTimer);
      window.removeEventListener("scroll", checkVisible);
      window.removeEventListener("resize", checkVisible);
    };
  }, [isReviewUnfurled]);

  // workInfo View 모달 — 스냅샷 vs 현재값 비교 (정밀 isDirty)
  const isWorkInfoDirty = (): boolean => {
    const snap = workInfoSnapshot.current;
    if (!snap) return false;
    if (editingSubTitle !== (snap.subTitle || "")) return true;
    if (editingGrowthPoint !== (snap.growthPoint || "")) return true;
    const snapLinks: { desc: string; url: string }[] = snap.outputLinks || [];
    for (let i = 0; i < 5; i++) {
      const sUrl = snapLinks[i]?.url || "";
      const sDesc = snapLinks[i]?.desc || "";
      const eUrl = editingOutputLinks[i]?.url || "";
      const eDesc = editingOutputLinks[i]?.desc || "";
      if (sUrl !== eUrl || sDesc !== eDesc) return true;
    }
    const snapImages = normalizeWorkInfoImages(snap.images);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapImages[i] || null) !== (editingImages[i] || null)) return true;
    }
    const snapCaptions = normalizeWorkInfoCaptions(snap.imageCaptions);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapCaptions[i] || "") !== (editingImageCaptions[i] || "")) return true;
    }
    return false;
  };

  // 4개 view 모달 공용 — 카드의 강화 상태를 enum으로 정규화
  // 우선순위: card.status (workInfo) → card.enhancementStatus (workExp/workAbility) → boolean 3개 (workCareer)
  // ⚠️ verified는 workInfo 카드에 항상 true로 들어있는 신뢰성 플래그 → 강화 상태로 사용 금지
  //    enum 필드가 없는 workCareer에서만 fallback으로 평가
  // (제거됨) getEnhanceStatus / isLineLocked / LINE_LOCKED_TITLE —
  // 4허브 수정 버튼이 matchedLine.canEdit 단일 기준으로 통일되면서 legacy lock 분기가 사라져 dead code 가 됨.

  // workInfo View 모달 — 보기/편집 토글 핸들러 (Type B 푸터 규칙 + 관리자 승인)
  const handleEditWorkInfo = async () => {
    // 버튼 활성화와 동일 기준: matchedLine.canEdit + lineTargetId (legacy canEdit fallback 제거).
    // demo / adminPreview 는 backend 게이팅 예외.
    {
      const lineTargetId = (workInfoMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      const backendEditable = workInfoMatchedLine?.canEdit === true && !!lineTargetId;
      if (!forceEditUnlock && (!backendEditable || isForeignViewer)) {
        await popup.alert(!workInfoMatchedLine ? "개설된 라인이 없습니다." : ((workInfoMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
        return;
      }
    }
    const card = selectedWorkInfoCard;
    // 스냅샷: 비교 대상 필드만 (subTitle/growthPoint/outputLinks/images)
    // 초기 outputLinks 는 matchedLine.outputLinks 우선 (backend 단일 출처), 없을 때만 legacy card.outputLinks.
    const infoLineLinks = Array.isArray(workInfoMatchedLine?.outputLinks) ? workInfoMatchedLine!.outputLinks! : null;
    const infoSrcLinks = infoLineLinks && infoLineLinks.length > 0 ? infoLineLinks : card?.outputLinks;
    const initialOutputLinks = infoSrcLinks && infoSrcLinks.length > 0 ? infoSrcLinks.map((l: { desc?: string | null; url?: string | null }) => ({ desc: l?.desc || "", url: l?.url || "" })) : Array(5).fill({ desc: "", url: "" });
    let initialImages = normalizeWorkInfoImages(card?.images);
    let initialCaptions = normalizeWorkInfoCaptions(card?.imageCaptions);
    if (isPureAdminPreview) {
      const adminImgs = card?.activityType ? getAdminOutputImages(card.activityType, workInfoMatchedLine) : [];
      const adminImgCount = Math.min(getAdminOutputImagesCount(card?.activityType ?? "", workInfoMatchedLine), WORKINFO_IMAGE_SLOT_COUNT);
      const crewImages = normalizeWorkInfoImages(card?.images);
      const crewCaptions = normalizeWorkInfoCaptions(card?.imageCaptions);
      initialImages = Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, i) => (i < adminImgCount ? adminImgs[i]?.url || null : crewImages[i - adminImgCount] || null));
      initialCaptions = Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, i) => (i < adminImgCount ? adminImgs[i]?.caption || "" : crewCaptions[i - adminImgCount] || ""));
    }
    workInfoSnapshot.current = {
      subTitle: card?.subTitle || "",
      growthPoint: card?.growthPoint || "",
      outputLinks: JSON.parse(JSON.stringify(initialOutputLinks)),
      images: [...initialImages],
      imageCaptions: [...initialCaptions],
    };
    setEditingSubTitle(card?.subTitle || "");
    setEditingGrowthPoint(card?.growthPoint || "");
    setEditingOutputLinks(initialOutputLinks);
    setEditingImages(initialImages);
    setEditingImageCaptions(initialCaptions);
    setWorkInfoViewIsEditing(true);
  };

  const handleCancelWorkInfo = async () => {
    // Type B + isDirty: 변경 있으면 confirm. "아니오"면 편집 모드 유지.
    if (isWorkInfoDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    const snap = workInfoSnapshot.current;
    if (snap) {
      setEditingSubTitle(snap.subTitle || "");
      setEditingGrowthPoint(snap.growthPoint || "");
      setEditingOutputLinks(snap.outputLinks && snap.outputLinks.length > 0 ? snap.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" }));
      setEditingImages(normalizeWorkInfoImages(snap.images));
      setEditingImageCaptions(normalizeWorkInfoCaptions(snap.imageCaptions));
    }
    setWorkInfoViewIsEditing(false);
  };

  const handleResetWorkInfo = async () => {
    if (!isLineEditableByDto(workInfoMatchedLine)) {
      await popup.alert(!workInfoMatchedLine ? "개설된 라인이 없습니다." : ((workInfoMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 초기화 = 모든 필드를 빈 값으로 (Weekly Review 와 동일 패턴 — "초기화" 라벨대로 비우기)
    if (!(await popup.confirm("내용을 모두 초기화하시겠어요?"))) return;
    setEditingSubTitle("");
    setEditingGrowthPoint("");
    setEditingOutputLinks(Array(5).fill({ desc: "", url: "" }));
    setEditingImages(createEmptyWorkInfoImages());
    setEditingImageCaptions(createEmptyWorkInfoCaptions());
  };

  // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 — 한쪽만 채워진 첫 슬롯과 종류 반환, 모두 정상이면 null
  const findImageCaptionMismatch = (images: (string | null)[], captions: string[], startIdx: number = 0): { slot: number; type: "missing-caption" | "missing-image" } | null => {
    for (let i = startIdx; i < images.length; i++) {
      const hasImage = !!images[i];
      const hasCaption = !!(captions[i] && captions[i].trim());
      if (hasImage && !hasCaption) return { slot: i + 1, type: "missing-caption" };
      if (!hasImage && hasCaption) return { slot: i + 1, type: "missing-image" };
    }
    return null;
  };

  const captionMismatchMessage = (m: { slot: number; type: "missing-caption" | "missing-image" }) =>
    m.type === "missing-caption" ? `아웃풋 이미지 ${m.slot}번의 캡션을 입력해주세요.\n이미지와 캡션은 한 쌍이에요. 😊` : `아웃풋 ${m.slot}번에 이미지를 올려주세요.\n캡션만 입력할 수 없어요. 이미지와 캡션은 한 쌍이에요. 😊`;

  // blob: URL 배열을 Supabase Storage로 업로드 → 영구 URL 배열 반환. http(s)/data URL은 그대로 통과.
  // storageKey: 스토리지 경로 구분자. 보통 activity_type_id, 라인 단위 저장(activity_type_id 없음)에서는 line_target_id.
  const persistImageUrls = async (images: (string | null)[], storageKey: string): Promise<(string | null)[]> => {
    const result: (string | null)[] = [];
    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      if (!url) {
        result.push(null);
        continue;
      }
      if (!url.startsWith("blob:")) {
        result.push(url);
        continue;
      }
      const blob = await (await fetch(url)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const file = new File([blob], `slot-${i}.${ext}`, { type: blob.type });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("week_id", weekId);
      formData.append("activity_type_id", storageKey);
      formData.append("slot_index", String(i));
      const res = await fetch(apiUrl("/api/activity-details/upload-image"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `이미지 업로드 실패 (slot ${i + 1})`);
      }
      const data = await res.json();
      result.push(data.url as string);
    }
    return result;
  };

  // user_activity_details 저장 (모달 저장 공용 헬퍼). 데모 모드에서는 API 호출 스킵.
  const persistActivityDetailToServer = async (params: { activityTypeId: string | null; lineTargetId?: string | null; subTitle: string | null; outputLinks: { desc: string; url: string }[] | null; growthPoint: string | null; images: (string | null)[]; imageCaptions: string[]; adminLinkCount?: number }): Promise<{ images: (string | null)[] }> => {
    // [SAVE] persist 함수 진입 — 호출부에서 실제 저장 함수까지 도달했는지 확정.
    console.log("[SAVE] persistActivityDetailToServer 시작", {
      activityTypeId: params.activityTypeId,
      lineTargetId: params.lineTargetId ?? null,
    });
    // [진단] 저장 분기 추적 — 어느 경로로 빠지는지 콘솔로 확정 (isDemoMode/스킵/currentUserId/lineTargetId).
    console.log("[cluster4-save-diag] persist 진입", {
      isDemoMode,
      isPureAdminPreview,
      forceEditUnlock,
      currentUserId,
      demoUserId,
      weekId,
      activityTypeId: params.activityTypeId,
      lineTargetId: params.lineTargetId ?? null,
    });
    // localStorage 더미 데모(실제 DTO 없음)만 저장 스킵 — 의도된 동작. demoUserId 테스트유저 모드는 여기 안 걸림.
    if (isDemoMode) {
      console.warn("[cluster4-save-diag] SKIP: isDemoMode(localStorage 더미)=true → API 호출 생략");
      return { images: params.images };
    }
    // 저장 대상(currentUserId)·주차(weekId)가 없으면 실제 저장 불가.
    // (과거엔 조용히 success 처럼 return → "저장되었습니다"만 뜨고 DB 미반영. 이제 throw 로 false-success 차단.)
    if (!currentUserId || !weekId) {
      console.error("[cluster4-save-diag] ABORT: currentUserId/weekId 없음 — 저장 불가", { currentUserId, weekId });
      throw new Error("저장 대상 사용자를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
    }
    // 이미지 스토리지 경로 키 — activity_type_id 가 없으면(라인 단위 저장) line_target_id 로 폴백.
    // 업로드 라우트의 activity_type_id 패턴(/^[a-zA-Z0-9_-]{1,40}$/)에 UUID(line_target_id)도 매칭된다.
    const imageStorageKey = params.activityTypeId || params.lineTargetId || "";
    const hasBlobImages = params.images.some((u) => typeof u === "string" && u.startsWith("blob:"));
    if (hasBlobImages && !imageStorageKey) {
      throw new Error("이미지 저장 대상을 식별하지 못했습니다. 새로고침 후 다시 시도해주세요.");
    }
    const persistedImages = await persistImageUrls(params.images, imageStorageKey);
    // 렌더/가드와 동일한 adminLinkCount 사용 — 호출부가 matchedLine 기준 값을 넘기면 그걸 쓰고,
    // 없을 때만 legacy(local) getAdminOutputLinksCount 로 fallback. (관리자 prefix 만큼 slice 후 크루 슬롯만 저장)
    // activity_type_id 가 없으면 legacy adminLinkCount 산출 불가 → 0 (라인 저장은 호출부가 명시값 전달).
    const adminCount = params.adminLinkCount ?? (params.activityTypeId ? getAdminOutputLinksCount(params.activityTypeId) : 0);
    // 운영진 링크(앞쪽 adminCount 개)는 라인 소유 — 재저장하지 않고 크루 슬롯만 저장한다.
    const userSlots = (params.outputLinks || []).slice(adminCount);
    // label-only 검증: URL 없이 설명만 입력된 슬롯은 저장 불가 (경고 후 중단).
    const labelOnly = userSlots.find((l) => (l.desc?.trim() ?? "") !== "" && (l.url?.trim() ?? "") === "");
    if (labelOnly) {
      throw new Error("URL 없이 설명만 입력된 Output Link 가 있습니다.\nURL 을 입력하거나 설명을 비워주세요.");
    }
    // url 없는 빈 슬롯 제외 (source of truth = outputLinks).
    const userLinks = userSlots.filter((l) => (l.url?.trim() ?? "") !== "");
    // 신규 단일 출처 shape — { url, label }. label 은 desc 매핑, 없으면 null.
    const outputLinksPayload = userLinks.map((l) => ({
      url: (l.url ?? "").trim(),
      label: l.desc?.trim() ? l.desc.trim() : null,
    }));
    const postUrl = apiUrl("/api/activity-details");
    console.log("[cluster4-save-diag] POST 발사", {
      url: postUrl,
      user_id: currentUserId,
      demoUserId: effectiveDemoUserId ?? null,
      demoUserIdSource: demoUserId ? "explicit" : testScopeWriteUserId ? "test-scope" : null,
      week_id: weekId,
      activity_type_id: params.activityTypeId,
      line_target_id: params.lineTargetId ?? null,
    });
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserId,
        // 테스트 유저 모드: demoUserId 가 있으면 백엔드가 이 id 로 저장 대상/작성기간을 고정한다.
        // (admin /test-users 무세션 진입은 effectiveDemoUserId 가 mode=test 대상 userId 로 채워진다.)
        ...(effectiveDemoUserId ? { demoUserId: effectiveDemoUserId } : {}),
        week_id: weekId,
        // activity_type_id 는 null 가능 — competency/experience/career 라인은 line_target_id 가 canonical.
        // 백엔드는 line_target_id 가 유효하면 activity_type_id 없이 cluster4_line_submissions 에만 저장한다.
        activity_type_id: params.activityTypeId || null,
        // 실제 lineTarget 단위 저장 — 백엔드가 line_target_id 로 라인을 식별한다.
        // (매칭되는 백엔드 line 이 없는 part 는 null → 기존 activity_type_id 기준 저장)
        line_target_id: params.lineTargetId ?? null,
        sub_title: params.subTitle,
        // 신규: outputLinks[] ({ url, label }) 단일 출처.
        outputLinks: outputLinksPayload,
        // backward compat: 기존 /api/activity-details 가 읽는 output_links ({ desc, url }) 키 유지.
        output_links: userLinks.length > 0 ? userLinks : null,
        growth_point: params.growthPoint,
        image_urls: persistedImages,
        image_captions: params.imageCaptions,
      }),
    });
    // res.ok 뿐 아니라 body.success === false 도 실패로 처리 (백엔드가 200+success:false 를 내도 안내 오인 방지).
    const body = (await readJsonSafe(res)) as { success?: boolean; error?: string; message?: string } | null;
    console.log("[cluster4-save-diag] POST 응답", {
      status: res.status,
      ok: res.ok,
      success: (body as { success?: boolean })?.success,
      hasSubmission: !!(body as { submission?: unknown })?.submission,
      error: (body as { error?: string })?.error ?? null,
    });
    if (body?.success === false) {
      // HTTP 200 + success:false 인 legacy 응답도 동일 DTO 우선순위로 처리한다.
      const message = body.message || (body.error && !/^[A-Z][A-Z0-9_]+$/.test(body.error) ? body.error : null);
      throw new ApiRequestError(message || "저장에 실패했습니다. 다시 시도해주세요.", res.status, {
        code: body.error && /^[A-Z][A-Z0-9_]+$/.test(body.error) ? body.error : undefined,
        payload: body,
      });
    }
    return { images: persistedImages };
  };

  const handleSaveWorkInfo = async () => {
    if (!isLineEditableByDto(workInfoMatchedLine)) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkInfo", canEdit: workInfoMatchedLine?.canEdit ?? null, lineTargetId: (workInfoMatchedLine?.lineTargetId as string | null | undefined) ?? null });
      await popup.alert(!workInfoMatchedLine ? "개설된 라인이 없습니다." : ((workInfoMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 백엔드 lineTarget 단위 저장 — weekId + information + activityTypeKey 로 라인을 찾고
    // lineTargetId 가 없으면 저장 차단 (legacy 저장 API / partType 단위 저장 fallback 금지).
    const infoActivityTypeKey = (selectedWorkInfoCard?.activityType as string | null | undefined) ?? null;
    const infoSaveLine = findCluster4Line({ partType: "information", activityTypeKey: infoActivityTypeKey });
    const infoSaveLineTargetId = (infoSaveLine?.lineTargetId as string | null | undefined) ?? null;
    if (!forceEditUnlock && !infoSaveLineTargetId) {
      console.warn("[cluster4-canEdit] workInfo 저장 차단 — lineTargetId 없음", {
        weekId,
        activityTypeKey: infoActivityTypeKey,
      });
      await popup.alert("개설된 라인이 없습니다.");
      return;
    }
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 (이미지 1개 = 캡션 1개, 한쪽만 입력 불가)
    {
      const mismatch = findImageCaptionMismatch(editingImages, editingImageCaptions);
      if (mismatch) {
        setWorkInfoFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능
    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    if (selectedWorkInfoCard?.activityType) {
      const newSubTitle = editingSubTitle.trim() || null;
      const newOutputLinks = editingOutputLinks;
      const newGrowthPoint = editingGrowthPoint.trim() || null;
      let persistedImages: (string | null)[] = editingImages;
      if (isPureAdminPreview) {
        // 일반 어드민 미리보기(admin=true, demoUserId 없음)만 저장 스킵.
        // 테스트 유저 모드(admin=true + demoUserId)는 실제 저장 API 를 호출한다.
        console.log("[AdminPreview] workInfo 저장 — API 호출 생략, local state만 반영");
      } else {
        try {
          const persisted = await persistActivityDetailToServer({
            activityTypeId: selectedWorkInfoCard.activityType,
            lineTargetId: infoSaveLineTargetId as string,
            subTitle: newSubTitle,
            outputLinks: newOutputLinks,
            growthPoint: newGrowthPoint,
            images: editingImages,
            imageCaptions: editingImageCaptions,
            adminLinkCount: getAdminOutputLinksCount(selectedWorkInfoCard.activityType, workInfoMatchedLine),
          });
          persistedImages = persisted.images;
        } catch (err) {
          console.error("workInfo 저장 실패:", err);
          await popup.alert(apiErrorMessage(err));
          return;
        }
      }
      setEditingImages(persistedImages);
      setWeekActivityDetails((prev) => {
        const next = {
          week_id: weekId,
          activity_type_id: selectedWorkInfoCard.activityType,
          sub_title: newSubTitle,
          output_links: newOutputLinks,
          growth_point: newGrowthPoint,
          image_urls: persistedImages,
          image_captions: editingImageCaptions,
        };
        const idx = prev.findIndex((d) => d.activity_type_id === selectedWorkInfoCard.activityType);
        if (idx < 0) return [...prev, next];
        return prev.map((d) => (d.activity_type_id === selectedWorkInfoCard.activityType ? { ...d, ...next } : d));
      });
      setSelectedWorkInfoCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingGrowthPoint,
              images: persistedImages,
              imageCaptions: editingImageCaptions,
            }
          : prev,
      );
      // 저장 완료 → 스냅샷 갱신 (isDirty 초기화)
      workInfoSnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...persistedImages],
        imageCaptions: [...editingImageCaptions],
      };
      // 저장 직후 미리보기 단일 출처(cluster4Lines[].submission) 패치 — canonical 우선 표시(buildWorkInfoCard)와
      // 정합. info 미리보기는 submission.subtitle/growthPoint 만 읽으므로(links/images 는 detail) 두 필드만 갱신해
      // 새로고침 없이 새 값이 보이게 한다. (competency 패턴과 동일)
      if (infoSaveLineTargetId) {
        setCluster4Lines((prev) =>
          prev.map((l) =>
            l.lineTargetId === infoSaveLineTargetId && normalizePartType(l.partType) === "information"
              ? {
                  ...l,
                  submission: {
                    ...((l.submission as Record<string, unknown> | null | undefined) || {}),
                    subtitle: newSubTitle,
                    growthPoint: newGrowthPoint,
                  },
                }
              : l,
          ),
        );
      }
    }
    await popup.alert("저장되었습니다.");
    setWorkInfoFooterNotice("default");
    setWorkInfoViewIsEditing(false);
  };

  const handleCloseWorkInfo = async () => {
    // 편집 모드에서만 isDirty 체크 (보기 모드는 변경 없음)
    if (workInfoViewIsEditing && isWorkInfoDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    setWorkInfoViewModalOpen(false);
    setWorkInfoViewIsEditing(false);
  };

  // workInfo View 모달 — Output Link 편집 핸들러 (운영진 링크 보호 + 순차 입력 + 삭제 시 뒤가 앞으로)
  const handleOutputLinkChange = (idx: number, field: "desc" | "url", value: string) => {
    if (!selectedWorkInfoCard?.activityType) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkInfoCard.activityType, workInfoMatchedLine);
    if (idx < adminCount) return; // 운영진 링크는 수정 불가
    setEditingOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleOutputLinkDelete = (idx: number) => {
    if (!selectedWorkInfoCard?.activityType) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkInfoCard.activityType, workInfoMatchedLine);
    if (idx < adminCount) return; // 운영진 링크는 삭제 불가
    setEditingOutputLinks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < 5) next.push({ desc: "", url: "" });
      return next;
    });
  };

  // Output Link 2차 모달 — 열기
  const openOutputLinkEditModal = (modalType: "workInfo" | "workExp" | "workAbility" | "workCareer", idx: number) => {
    // 관리자 슬롯 진입 차단 (defense-in-depth): index < adminLinkCount 슬롯은 편집 모달을 열지 않고 안내만.
    // 순수 어드민 프리뷰(관리자 본인 편집)에서만 차단하지 않는다.
    // 테스트 유저 모드(demoUserId)는 일반 고객과 동일하게 관리자 슬롯 편집을 차단한다.
    if (!isPureAdminPreview) {
      const activityTypeForModal =
        modalType === "workInfo"
          ? (selectedWorkInfoCard?.activityType as string | undefined)
          : modalType === "workExp"
          ? (selectedWorkExpCard?.activityTypeId as string | undefined)
          : modalType === "workAbility"
          ? (selectedWorkAbilityCard?.activityTypeId as string | undefined)
          : workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1];
      // 렌더/저장과 동일한 adminLinkCount 를 쓰도록 동일 modalType 의 matchedLine 을 함께 전달.
      const matchedLineForModal =
        modalType === "workInfo"
          ? workInfoMatchedLine
          : modalType === "workExp"
          ? workExpMatchedLine
          : modalType === "workAbility"
          ? workAbilityMatchedLine
          : workCareerMatchedLine;
      const adminLinkCount = activityTypeForModal ? getAdminOutputLinksCount(activityTypeForModal, matchedLineForModal) : 0;
      if (idx < adminLinkCount) {
        void popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다.");
        return;
      }
    }
    let link = { desc: "", url: "" };
    switch (modalType) {
      case "workInfo":
        link = editingOutputLinks[idx] || { desc: "", url: "" };
        break;
      case "workExp":
        link = editingExpOutputLinks[idx] || { desc: "", url: "" };
        break;
      case "workAbility":
        link = editingAbilityOutputLinks[idx] || { desc: "", url: "" };
        break;
      case "workCareer":
        link = editingCareerOutputLinks[idx] || { desc: "", url: "" };
        break;
    }
    setOutputLinkEditModal({ modalType, linkIdx: idx, url: link.url || "", desc: link.desc || "", error: "" });
  };

  // Output Link 2차 모달 — 저장
  const saveOutputLinkEdit = () => {
    if (!outputLinkEditModal) return;
    const { modalType, linkIdx, url, desc } = outputLinkEditModal;
    const trimmedUrl = url.trim();
    console.log("[OutputLinkSave]", { isAdminPreview, modalType, linkIdx, url: trimmedUrl, desc: desc.trim() });
    if (trimmedUrl && !trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setOutputLinkEditModal((prev) => (prev ? { ...prev, error: "URL은 http:// 또는 https://로 시작해야 합니다." } : null));
      return;
    }
    const newLink = { desc: desc.trim(), url: trimmedUrl };
    if (isPureAdminPreview) {
      // 프론트 테스트용: API/권한 체크 우회, editing state에만 직접 저장.
      // 테스트 유저 모드(demoUserId)는 일반 사용자 경로(handleOutputLinkChange)로 흘려 실제 저장에 반영한다.
      const directSet = (setter: React.Dispatch<React.SetStateAction<{ desc: string; url: string }[]>>) => {
        setter((prev) => {
          const next = [...prev];
          next[linkIdx] = newLink;
          return next;
        });
      };
      switch (modalType) {
        case "workInfo":
          directSet(setEditingOutputLinks);
          break;
        case "workExp":
          directSet(setEditingExpOutputLinks);
          break;
        case "workAbility":
          directSet(setEditingAbilityOutputLinks);
          break;
        case "workCareer":
          directSet(setEditingCareerOutputLinks);
          break;
      }
      // edit mode가 false로 돌아가도 값이 유지되도록 별도 state에도 저장
      setAdminSavedOutputLinks((prev) => {
        const arr = [...(prev[modalType] || createEmptyOutputLinks())];
        arr[linkIdx] = newLink;
        return { ...prev, [modalType]: arr };
      });
      console.log("[OutputLinkSave:AdminPreview] saved to local state:", { modalType, linkIdx, newLink });
      setOutputLinkEditModal(null);
      return;
    }
    switch (modalType) {
      case "workInfo":
        handleOutputLinkChange(linkIdx, "url", trimmedUrl);
        handleOutputLinkChange(linkIdx, "desc", desc.trim());
        break;
      case "workExp":
        handleExpOutputLinkChange(linkIdx, "url", trimmedUrl);
        handleExpOutputLinkChange(linkIdx, "desc", desc.trim());
        break;
      case "workAbility":
        handleAbilityOutputLinkChange(linkIdx, "url", trimmedUrl);
        handleAbilityOutputLinkChange(linkIdx, "desc", desc.trim());
        break;
      case "workCareer":
        handleCareerOutputLinkChange(linkIdx, "url", trimmedUrl);
        handleCareerOutputLinkChange(linkIdx, "desc", desc.trim());
        break;
    }
    setOutputLinkEditModal(null);
  };

  // workInfo View 모달 — 이미지 업로드/삭제/확대 핸들러
  const triggerImageUpload = (idx: number) => {
    imageFileInputRefs.current[idx]?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 미리보기는 blob: URL로, 실제 업로드는 저장 시점(persistImageUrls)에서 일괄 처리.
    const url = URL.createObjectURL(file);
    setEditingImages((prev) => {
      const next = [...prev];
      next[idx] = url;
      return next;
    });
    e.target.value = ""; // 같은 파일 재선택 허용
  };

  const handleImageDelete = (idx: number) => {
    setEditingImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push(null);
      return next;
    });
    // 캡션도 동일 인덱스 삭제 + 빈 슬롯 push (이미지와 1:1 매핑 유지)
    setEditingImageCaptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push("");
      return next;
    });
  };

  const handleCaptionChange = (idx: number, value: string) => {
    setEditingImageCaptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleImagePreview = (idx: number) => {
    const image = editingImages[idx] || selectedWorkInfoCard?.images?.[idx];
    if (image) setPreviewImageUrl(image);
  };

  // ========== workAbility View 모달 전용 핸들러 (workInfo 패턴 복제) ==========
  const isWorkAbilityDirty = (): boolean => {
    const snap = workAbilitySnapshot.current;
    if (!snap) return false;
    if (editingAbilitySubTitle !== (snap.subTitle || "")) return true;
    if (editingAbilityGrowthPoint !== (snap.growthPoint || "")) return true;
    const snapLinks: { desc: string; url: string }[] = snap.outputLinks || [];
    for (let i = 0; i < 5; i++) {
      const sUrl = snapLinks[i]?.url || "";
      const sDesc = snapLinks[i]?.desc || "";
      const eUrl = editingAbilityOutputLinks[i]?.url || "";
      const eDesc = editingAbilityOutputLinks[i]?.desc || "";
      if (sUrl !== eUrl || sDesc !== eDesc) return true;
    }
    const snapImages = normalizeWorkInfoImages(snap.images);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapImages[i] || null) !== (editingAbilityImages[i] || null)) return true;
    }
    const snapCaptions = normalizeWorkInfoCaptions(snap.imageCaptions);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapCaptions[i] || "") !== (editingAbilityImageCaptions[i] || "")) return true;
    }
    return false;
  };

  const handleEditWorkAbility = async () => {
    if (selectedWorkAbilityCard?.isEmpty) {
      await popup.alert("해당 카드는 비어있습니다");
      return;
    }
    // 버튼 활성화와 동일 기준: matchedLine.canEdit + lineTargetId (legacy canEdit fallback 제거).
    {
      const lineTargetId = (workAbilityMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      const backendEditable = workAbilityMatchedLine?.canEdit === true && !!lineTargetId;
      if (!forceEditUnlock && (!backendEditable || isForeignViewer)) {
        await popup.alert(!workAbilityMatchedLine ? "개설된 라인이 없습니다." : ((workAbilityMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
        return;
      }
    }
    const card = selectedWorkAbilityCard;
    // 편집 초기값 = 카드 병합 outputLinks (어드민 top-level + 사용자 submission). 어드민 top-level 만 쓰면
    // 사용자가 제출한 링크가 편집 진입 시 사라지므로, submission 까지 병합된 card.outputLinks 를 단일 출처로 사용.
    const abilitySrcLinks = card?.outputLinks;
    const initialOutputLinks = abilitySrcLinks && abilitySrcLinks.length > 0 ? abilitySrcLinks.map((l: { desc?: string | null; url?: string | null }) => ({ desc: l?.desc || "", url: l?.url || "" })) : Array(5).fill({ desc: "", url: "" });
    // 예약 슬롯 모델(2026-07-18): card.images 는 크루 전용 배열. 편집 상태(editingAbilityImages)는 보기 모드
    //   viewImages(운영진@0 + 크루 뒤)와 동일한 절대 슬롯 병합 배열로 초기화해야 render(절대 인덱스)가 정합한다.
    //   (초기화가 크루 전용이면 크루 첫 이미지가 운영진 슬롯 0(1번)에 표시되는 버그 발생.)
    const abilityInitReserved = Math.min(
      getAbilityAdminImageCount(workAbilityMatchedLine, card?.activityTypeId),
      WORKINFO_IMAGE_SLOT_COUNT,
    );
    const abilityInitAdminImgs = getAbilityAdminImages(workAbilityMatchedLine, card?.activityTypeId);
    const { images: initialImages, captions: initialCaptions } = assembleReservedImageSlots(
      abilityInitAdminImgs,
      normalizeWorkInfoImages(card?.images),
      normalizeWorkInfoCaptions(card?.imageCaptions),
      abilityInitReserved,
      WORKINFO_IMAGE_SLOT_COUNT,
    );
    workAbilitySnapshot.current = {
      subTitle: card?.subTitle || "",
      growthPoint: card?.growthPoint || "",
      outputLinks: JSON.parse(JSON.stringify(initialOutputLinks)),
      images: [...initialImages],
      imageCaptions: [...initialCaptions],
    };
    setEditingAbilitySubTitle(card?.subTitle || "");
    setEditingAbilityGrowthPoint(card?.growthPoint || "");
    setEditingAbilityOutputLinks(initialOutputLinks);
    setEditingAbilityImages(initialImages);
    setEditingAbilityImageCaptions(initialCaptions);
    setWorkAbilityViewIsEditing(true);
  };

  const handleCancelWorkAbility = async () => {
    if (isWorkAbilityDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    const snap = workAbilitySnapshot.current;
    if (snap) {
      setEditingAbilitySubTitle(snap.subTitle || "");
      setEditingAbilityGrowthPoint(snap.growthPoint || "");
      setEditingAbilityOutputLinks(snap.outputLinks && snap.outputLinks.length > 0 ? snap.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" }));
      setEditingAbilityImages(normalizeWorkInfoImages(snap.images));
      setEditingAbilityImageCaptions(normalizeWorkInfoCaptions(snap.imageCaptions));
    }
    setWorkAbilityViewIsEditing(false);
  };

  const handleResetWorkAbility = async () => {
    if (!isLineEditableByDto(workAbilityMatchedLine)) {
      await popup.alert(!workAbilityMatchedLine ? "개설된 라인이 없습니다." : ((workAbilityMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 초기화 = 모든 필드를 빈 값으로
    if (!(await popup.confirm("내용을 모두 초기화하시겠어요?"))) return;
    setEditingAbilitySubTitle("");
    setEditingAbilityGrowthPoint("");
    setEditingAbilityOutputLinks(Array(5).fill({ desc: "", url: "" }));
    setEditingAbilityImages(createEmptyWorkInfoImages());
    setEditingAbilityImageCaptions(createEmptyWorkInfoCaptions());
  };

  const handleSaveWorkAbility = async () => {
    // [SAVE] 핸들러 진입 — 클릭이 실제 저장 함수까지 도달했는지 + 모든 게이트 상태를 한 번에 확인.
    console.log("[SAVE] handleSaveWorkAbility 시작", {
      canEditWorkAbility,
      forceEditUnlock,
      isPureAdminPreview,
      isForeignViewer,
      activityTypeId: (selectedWorkAbilityCard?.activityTypeId as string | null | undefined) ?? null,
      lineTargetId: (workAbilityMatchedLine?.lineTargetId as string | null | undefined) ?? null,
    });
    if (!isLineEditableByDto(workAbilityMatchedLine)) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkAbility", canEdit: workAbilityMatchedLine?.canEdit ?? null, lineTargetId: (workAbilityMatchedLine?.lineTargetId as string | null | undefined) ?? null });
      await popup.alert(!workAbilityMatchedLine ? "개설된 라인이 없습니다." : ((workAbilityMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 백엔드 lineTarget 단위 저장 — matchedLine.lineTargetId 없으면 저장 차단 (legacy fallback 금지).
    const abilitySaveLineTargetId = (workAbilityMatchedLine?.lineTargetId as string | null | undefined) ?? null;
    if (!forceEditUnlock && !abilitySaveLineTargetId) {
      console.warn("[cluster4-canEdit] workAbility 저장 차단 — lineTargetId 없음", {
        weekId,
        competencyLineMasterId: (selectedWorkAbilityCard?.competencyLineMasterId as string | null | undefined) ?? null,
        lineCode: (selectedWorkAbilityCard?.lineCode as string | null | undefined) ?? (selectedWorkAbilityCard?.code as string | null | undefined) ?? null,
      });
      await popup.alert("개설된 라인이 없습니다.");
      return;
    }
    // 예약 슬롯 모델(2026-07-18): editingAbilityImages 는 화면 슬롯(운영진@0 + 크루 뒤) 병합 배열이다.
    const abilityReserved = Math.min(
      getAbilityAdminImageCount(workAbilityMatchedLine, (selectedWorkAbilityCard?.activityTypeId as string | null | undefined) ?? null),
      WORKINFO_IMAGE_SLOT_COUNT,
    );
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 (이미지 1개 = 캡션 1개, 한쪽만 입력 불가). 운영진 예약 슬롯은 제외.
    {
      const mismatch = findImageCaptionMismatch(editingAbilityImages, editingAbilityImageCaptions, abilityReserved);
      if (mismatch) {
        setWorkAbilityFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    // competency 라인 저장의 canonical key = line_target_id. competency 라인은 activity_type_id 가
    // null/"" 인 경우가 많으므로(part_type!=info), activityTypeId 없음 = 저장 불가가 아니다.
    // → lineTargetId 가 있으면 activityTypeId 없이도 저장한다(백엔드가 cluster4_line_submissions 에 저장).
    // 단 둘 다 없으면 진짜 식별 불가 → false-success 대신 명확한 에러.
    const abilityActivityTypeId = (selectedWorkAbilityCard?.activityTypeId as string | null | undefined) ?? "";
    const abilityCanPersist = !!abilityActivityTypeId || !!abilitySaveLineTargetId;
    console.log("[SAVE] handleSaveWorkAbility persist 분기", {
      activityTypeId: abilityActivityTypeId || null,
      lineTargetId: abilitySaveLineTargetId,
      canPersist: abilityCanPersist,
      willCallApi: abilityCanPersist && !isPureAdminPreview,
    });
    if (!abilityCanPersist && !forceEditUnlock) {
      console.error("[SAVE] workAbility 저장 차단 — activityTypeId/lineTargetId 모두 없음", {
        weekId,
        lineCode: (selectedWorkAbilityCard?.lineCode as string | null | undefined) ?? (selectedWorkAbilityCard?.code as string | null | undefined) ?? null,
      });
      setWorkAbilityFooterNotice("error");
      await popup.alert("저장 대상 라인을 식별하지 못했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }
    {
      const newSubTitle = editingAbilitySubTitle.trim() || null;
      const newOutputLinks = editingAbilityOutputLinks;
      const newGrowthPoint = editingAbilityGrowthPoint.trim() || null;
      // 저장 payload = 운영진 예약 슬롯을 제외한 크루 전용 배열(운영진/빈 운영진 슬롯을 submission 에 넣지 않는다).
      const { crewImages: abilityCrewImagesToSave, crewCaptions: abilityCrewCaptionsToSave } = splitReservedImageSlots(
        editingAbilityImages,
        editingAbilityImageCaptions,
        abilityReserved,
      );
      const abilityAdminImgsForMerge = getAbilityAdminImages(workAbilityMatchedLine, abilityActivityTypeId || null);
      let persistedCrewImages: (string | null)[] = abilityCrewImagesToSave;
      if (isPureAdminPreview) {
        // 일반 어드민 미리보기만 저장 스킵. 테스트 유저 모드는 실제 저장.
        console.log("[AdminPreview] workAbility 저장 — API 호출 생략, local state만 반영");
      } else {
        try {
          const persisted = await persistActivityDetailToServer({
            // activity_type_id 는 null 가능 — line_target_id 가 canonical.
            activityTypeId: abilityActivityTypeId || null,
            // 가드(abilitySaveLineTargetId) 와 동일 출처 — persist 에 다른 값을 넘기면 가드 통과 후
            // line_target_id:null 전송 → submission 미반영인데 "저장됨" 안내가 뜨는 회귀를 막는다.
            lineTargetId: abilitySaveLineTargetId,
            subTitle: newSubTitle,
            outputLinks: newOutputLinks,
            growthPoint: newGrowthPoint,
            // 크루 전용(운영진 예약 슬롯 제외) — whole 로 넘기면 운영진 슬롯이 submission 에 누수된다.
            images: abilityCrewImagesToSave,
            imageCaptions: abilityCrewCaptionsToSave,
            adminLinkCount: getAbilityAdminLinkCount(workAbilityMatchedLine, abilityActivityTypeId || null),
          });
          persistedCrewImages = persisted.images;
        } catch (err) {
          console.error("workAbility 저장 실패:", err);
          await popup.alert(apiErrorMessage(err));
          return;
        }
      }
      // 화면 상태(편집/미리보기/스냅샷)는 운영진 예약 슬롯 + 크루 슬롯 병합 배열로 복원(render 절대 인덱스와 정합).
      const { images: abilityMergedImages, captions: abilityMergedCaptions } = assembleReservedImageSlots(
        abilityAdminImgsForMerge,
        persistedCrewImages,
        abilityCrewCaptionsToSave,
        abilityReserved,
        WORKINFO_IMAGE_SLOT_COUNT,
      );
      setEditingAbilityImages(abilityMergedImages);
      setEditingAbilityImageCaptions(abilityMergedCaptions);
      // legacy weekActivityDetails 미러는 activity_type_id 가 있을 때만 갱신한다. competency 표시는
      // cluster4Lines[].submission 단일 출처라 이 미러는 비표시용이며, "" 키로 쓰면 라인 간 충돌
      // (findIndex 가 첫 빈 키 행에 매칭)이 날 수 있어 빈 키일 땐 건너뛴다.
      //   image_urls 는 크루 전용(운영진 슬롯 제외).
      if (abilityActivityTypeId) {
        setWeekActivityDetails((prev) => {
          const nextDetail = {
            week_id: weekId,
            activity_type_id: abilityActivityTypeId,
            sub_title: newSubTitle,
            output_links: newOutputLinks,
            growth_point: newGrowthPoint,
            image_urls: persistedCrewImages,
            image_captions: abilityCrewCaptionsToSave,
          };
          const existingIndex = prev.findIndex((d) => d.activity_type_id === abilityActivityTypeId);
          if (existingIndex < 0) return [...prev, nextDetail];
          return prev.map((d) => (d.activity_type_id === abilityActivityTypeId ? { ...d, ...nextDetail } : d));
        });
      }
      setSelectedWorkAbilityCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingAbilityGrowthPoint,
              // card.images 는 크루 전용 SoT 유지(보기 render 가 운영진과 재병합) — 편집 상태만 병합 배열.
              images: normalizeWorkInfoImages(persistedCrewImages),
              imageCaptions: normalizeWorkInfoCaptions(abilityCrewCaptionsToSave),
            }
          : prev,
      );
      // ── 미리보기 카드/재파생 matchedLine 도 submission 단일 출처로 동기화 (저장 직후 = 새로고침 후 동일) ──
      // 실무 역량 카드는 user_activity_details 가 아닌 weekly-cards lines[].submission 에서 사용자 제출값을
      // 읽으므로, 저장 직후 cluster4Lines 의 해당 라인 submission 을 패치해 미리보기가 즉시 갱신되게 한다.
      // submission.outputLinks 는 "사용자분만" — 어드민 슬롯(adminCount) 을 제외한 뒤쪽 슬롯만 저장.
      // submission.outputImages/outputImageCaptions 는 비어있지 않은 이미지와 그 캡션만 1:1 정렬해 저장.
      if (abilitySaveLineTargetId) {
        const savedAdminCount = getAbilityAdminLinkCount(workAbilityMatchedLine, abilityActivityTypeId || null);
        const savedUserLinks = newOutputLinks
          .slice(savedAdminCount)
          .map((l: { desc?: string | null; url?: string | null }) => ({ desc: l?.desc || "", url: l?.url || "" }))
          .filter((l: { url: string }) => l.url.trim() !== "");
        const savedUserImages: string[] = [];
        const savedUserCaptions: Array<string | null> = [];
        // 크루 전용 배열(persistedCrewImages)만 순회 — 운영진 슬롯은 submission 에 포함하지 않는다.
        (persistedCrewImages || []).forEach((u, i) => {
          if (u && u.trim()) {
            savedUserImages.push(u);
            savedUserCaptions.push(abilityCrewCaptionsToSave[i] || "");
          }
        });
        setCluster4Lines((prev) =>
          prev.map((l) =>
            l.lineTargetId === abilitySaveLineTargetId && normalizePartType(l.partType) === "competency"
              ? {
                  ...l,
                  submission: {
                    ...((l.submission as Record<string, unknown> | null | undefined) || {}),
                    subtitle: newSubTitle,
                    growthPoint: newGrowthPoint,
                    outputLinks: savedUserLinks,
                    outputImages: savedUserImages,
                    outputImageCaptions: savedUserCaptions,
                  },
                }
              : l,
          ),
        );
      }
      workAbilitySnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingAbilityGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...abilityMergedImages],
        imageCaptions: [...abilityMergedCaptions],
      };
    }
    await popup.alert("저장되었습니다.");
    setWorkAbilityFooterNotice("default");
    setWorkAbilityViewIsEditing(false);
  };

  const handleCloseWorkAbility = async () => {
    if (workAbilityViewIsEditing && isWorkAbilityDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    setWorkAbilityViewModalOpen(false);
    setWorkAbilityViewIsEditing(false);
  };

  const handleAbilityOutputLinkChange = (idx: number, field: "desc" | "url", value: string) => {
    if (!selectedWorkAbilityCard?.activityTypeId) return;
    const adminCount = getAbilityAdminLinkCount(workAbilityMatchedLine, selectedWorkAbilityCard.activityTypeId);
    if (idx < adminCount) return;
    setEditingAbilityOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || { desc: "", url: "" }), [field]: value };
      return next;
    });
  };

  const handleAbilityOutputLinkDelete = (idx: number) => {
    if (!selectedWorkAbilityCard?.activityTypeId) return;
    const adminCount = getAbilityAdminLinkCount(workAbilityMatchedLine, selectedWorkAbilityCard.activityTypeId);
    if (idx < adminCount) return;
    setEditingAbilityOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { desc: "", url: "" };
      return next;
    });
  };

  const triggerAbilityImageUpload = (idx: number) => {
    abilityImageFileInputRefs.current[idx]?.click();
  };

  const handleAbilityImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEditingAbilityImages((prev) => {
      const next = [...prev];
      next[idx] = url;
      return next;
    });
    e.target.value = "";
  };

  const handleAbilityImageDelete = (idx: number) => {
    setEditingAbilityImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push(null);
      return next;
    });
    setEditingAbilityImageCaptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push("");
      return next;
    });
  };

  const handleAbilityCaptionChange = (idx: number, value: string) => {
    setEditingAbilityImageCaptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleAbilityCaptionToggle = (idx: number) => {
    setActiveAbilityCaptionIdx((prev) => (prev === idx ? null : idx));
  };

  const handleAbilityImagePreview = (idx: number) => {
    const image = editingAbilityImages[idx] || selectedWorkAbilityCard?.images?.[idx];
    if (image) setPreviewAbilityImageUrl(image);
  };

  // ========== workExp View 모달 전용 핸들러 (workInfo 패턴 복제, 필드 매핑: activityType→activityTypeId / category→badge / status→enhancementStatus) ==========
  const isWorkExpDirty = (): boolean => {
    const snap = workExpSnapshot.current;
    if (!snap) return false;
    if (editingExpSubTitle !== (snap.subTitle || "")) return true;
    if (editingExpGrowthPoint !== (snap.growthPoint || "")) return true;
    const snapLinks: { desc: string; url: string }[] = snap.outputLinks || [];
    for (let i = 0; i < 5; i++) {
      const sUrl = snapLinks[i]?.url || "";
      const sDesc = snapLinks[i]?.desc || "";
      const eUrl = editingExpOutputLinks[i]?.url || "";
      const eDesc = editingExpOutputLinks[i]?.desc || "";
      if (sUrl !== eUrl || sDesc !== eDesc) return true;
    }
    const snapImages = normalizeWorkInfoImages(snap.images);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapImages[i] || null) !== (editingExpImages[i] || null)) return true;
    }
    const snapCaptions = normalizeWorkInfoCaptions(snap.imageCaptions);
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if ((snapCaptions[i] || "") !== (editingExpImageCaptions[i] || "")) return true;
    }
    // 라인 평점은 어드민 전용 — dirty 판단 대상 아님
    return false;
  };

  const handleEditWorkExp = async () => {
    if (selectedWorkExpCard?.isEmpty) {
      await popup.alert("해당 카드는 비어있습니다");
      return;
    }
    // 버튼 활성화와 동일 기준: matchedLine.canEdit + lineTargetId (legacy canEdit fallback 제거).
    {
      const lineTargetId = (workExpMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      const backendEditable = workExpMatchedLine?.canEdit === true && !!lineTargetId;
      if (!forceEditUnlock && (!backendEditable || isForeignViewer)) {
        await popup.alert(!workExpMatchedLine ? "개설된 라인이 없습니다." : ((workExpMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
        return;
      }
    }
    const card = selectedWorkExpCard;
    const expLineLinks = Array.isArray(workExpMatchedLine?.outputLinks) ? workExpMatchedLine!.outputLinks! : null;
    const expSrcLinks = expLineLinks && expLineLinks.length > 0 ? expLineLinks : card?.outputLinks;
    const initialOutputLinks = expSrcLinks && expSrcLinks.length > 0 ? expSrcLinks.map((l: { desc?: string | null; url?: string | null }) => ({ desc: l?.desc || "", url: l?.url || "" })) : Array(5).fill({ desc: "", url: "" });
    const initialImages = normalizeWorkInfoImages(card?.images);
    const initialCaptions = normalizeWorkInfoCaptions(card?.imageCaptions);
    workExpSnapshot.current = {
      subTitle: card?.subTitle || "",
      growthPoint: card?.growthPoint || "",
      outputLinks: JSON.parse(JSON.stringify(initialOutputLinks)),
      images: [...initialImages],
      imageCaptions: [...initialCaptions],
      rating: (card?.rating ?? 0) * 2, // card.rating은 5점 만점(half) — 10점으로 역변환
    };
    setEditingExpSubTitle(card?.subTitle || "");
    setEditingExpGrowthPoint(card?.growthPoint || "");
    setEditingExpOutputLinks(initialOutputLinks);
    setEditingExpImages(initialImages);
    setEditingExpImageCaptions(initialCaptions);
    setEditingExpRating((card?.rating ?? 0) * 2);
    setWorkExpViewIsEditing(true);
  };

  const handleCancelWorkExp = async () => {
    if (isWorkExpDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    const snap = workExpSnapshot.current;
    if (snap) {
      setEditingExpSubTitle(snap.subTitle || "");
      setEditingExpGrowthPoint(snap.growthPoint || "");
      setEditingExpOutputLinks(snap.outputLinks && snap.outputLinks.length > 0 ? snap.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" }));
      setEditingExpImages(normalizeWorkInfoImages(snap.images));
      setEditingExpImageCaptions(normalizeWorkInfoCaptions(snap.imageCaptions));
      setEditingExpRating(snap.rating || 0);
    }
    setWorkExpViewIsEditing(false);
  };

  const handleResetWorkExp = async () => {
    if (!isLineEditableByDto(workExpMatchedLine)) {
      await popup.alert(!workExpMatchedLine ? "개설된 라인이 없습니다." : ((workExpMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 초기화 = 크루 입력 필드만 빈 값으로 (라인 평점은 어드민 전용 → 손 대지 않음)
    if (!(await popup.confirm("내용을 모두 초기화하시겠어요?"))) return;
    setEditingExpSubTitle("");
    setEditingExpGrowthPoint("");
    setEditingExpOutputLinks(Array(5).fill({ desc: "", url: "" }));
    setEditingExpImages(createEmptyWorkInfoImages());
    setEditingExpImageCaptions(createEmptyWorkInfoCaptions());
  };

  const handleSaveWorkExp = async () => {
    if (!isLineEditableByDto(workExpMatchedLine)) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkExp", canEdit: workExpMatchedLine?.canEdit ?? null, lineTargetId: (workExpMatchedLine?.lineTargetId as string | null | undefined) ?? null });
      await popup.alert(!workExpMatchedLine ? "개설된 라인이 없습니다." : ((workExpMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 백엔드 lineTarget 단위 저장 — matchedLine.lineTargetId 없으면 저장 차단 (legacy fallback 금지).
    const expSaveLineTargetId = (workExpMatchedLine?.lineTargetId as string | null | undefined) ?? null;
    if (!forceEditUnlock && !expSaveLineTargetId) {
      console.warn("[cluster4-canEdit] workExp 저장 차단 — lineTargetId 없음", {
        weekId,
        experienceLineMasterId: (selectedWorkExpCard?.experienceLineMasterId as string | null | undefined) ?? null,
        lineCode: (selectedWorkExpCard?.code as string | null | undefined) ?? null,
      });
      await popup.alert("개설된 라인이 없습니다.");
      return;
    }
    // 예약 슬롯 모델(2026-07-18): editingExpImages 는 화면 슬롯(운영진@0 + 크루 뒤) 병합 배열이다.
    //   운영진 예약 슬롯 수 = **항상 RESERVED_ADMIN_IMAGE_SLOTS(1)** (fail-safe — 매칭 실패에서도 0 으로 안 떨어짐).
    //   build 단계 expAdminSlots 와 동일 계약이라야 저장 payload(slice)·읽기(assemble)가 정합한다.
    const expReserved = Math.min(RESERVED_ADMIN_IMAGE_SLOTS, WORKINFO_IMAGE_SLOT_COUNT);
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 (이미지 1개 = 캡션 1개, 한쪽만 입력 불가). 운영진 예약 슬롯은 제외.
    {
      const mismatch = findImageCaptionMismatch(editingExpImages, editingExpImageCaptions, expReserved);
      if (mismatch) {
        setWorkExpFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능 (라인 평점은 어드민 전용)
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    // experience 라인 저장의 canonical key = line_target_id. experience 라인은 activity_type_id 가
    // null/"" 인 경우가 많으므로, lineTargetId 가 있으면 activityTypeId 없이도 저장한다.
    const expActivityTypeId = (selectedWorkExpCard?.activityTypeId as string | null | undefined) ?? "";
    const expCanPersist = !!expActivityTypeId || !!expSaveLineTargetId;
    console.log("[SAVE] handleSaveWorkExp persist 분기", {
      activityTypeId: expActivityTypeId || null,
      lineTargetId: expSaveLineTargetId,
      canPersist: expCanPersist,
      willCallApi: expCanPersist && !isPureAdminPreview,
    });
    if (!expCanPersist && !forceEditUnlock) {
      console.error("[SAVE] workExp 저장 차단 — activityTypeId/lineTargetId 모두 없음", { weekId });
      setWorkExpFooterNotice("error");
      await popup.alert("저장 대상 라인을 식별하지 못했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }
    {
      const newSubTitle = editingExpSubTitle.trim() || null;
      const newOutputLinks = editingExpOutputLinks;
      const newGrowthPoint = editingExpGrowthPoint.trim() || null;
      // 저장 payload = 운영진 예약 슬롯을 제외한 크루 전용 배열(운영진/빈 운영진 슬롯을 submission 에 넣지 않는다).
      const { crewImages: expCrewImagesToSave, crewCaptions: expCrewCaptionsToSave } = splitReservedImageSlots(
        editingExpImages,
        editingExpImageCaptions,
        expReserved,
      );
      // 화면 복원용 운영진 슬롯 = 저장 직전 편집 배열의 앞 reserved 슬롯 그대로(크루 저장은 운영진 슬롯을 바꾸지
      //   않는다). line.outputImages 재유도 대신 표시값을 보존해 legacy activity fallback 소스 불일치를 피한다.
      const expAdminSlotsForMerge = editingExpImages
        .slice(0, expReserved)
        .map((url, i) => ({ url: url ?? null, caption: editingExpImageCaptions[i] ?? "" }));
      let persistedCrewImages: (string | null)[] = expCrewImagesToSave;
      if (isPureAdminPreview) {
        // 일반 어드민 미리보기만 저장 스킵. 테스트 유저 모드는 실제 저장.
        console.log("[AdminPreview] workExp 저장 — API 호출 생략, local state만 반영");
      } else {
        try {
          const persisted = await persistActivityDetailToServer({
            // activity_type_id 는 null 가능 — line_target_id 가 canonical.
            activityTypeId: expActivityTypeId || null,
            // 가드(expSaveLineTargetId) 와 동일 출처 — persist 에 다른 값을 넘기면 가드 통과 후
            // line_target_id:null 전송 → submission 미반영인데 "저장됨" 안내가 뜨는 회귀를 막는다.
            lineTargetId: expSaveLineTargetId,
            subTitle: newSubTitle,
            outputLinks: newOutputLinks,
            growthPoint: newGrowthPoint,
            // 크루 전용(운영진 예약 슬롯 제외) — 이걸 whole 로 넘기면 운영진 슬롯이 image_urls 에 누수되어
            // 읽기 단계 예약 슬롯 floor 와 겹쳐 크루 이미지가 한 칸씩 밀린다(빈 운영진 슬롯일 때).
            images: expCrewImagesToSave,
            imageCaptions: expCrewCaptionsToSave,
            adminLinkCount: getAdminOutputLinksCount(expActivityTypeId, workExpMatchedLine),
          });
          persistedCrewImages = persisted.images;
        } catch (err) {
          console.error("workExp 저장 실패:", err);
          await popup.alert(apiErrorMessage(err));
          return;
        }
      }
      // 화면 상태(편집/미리보기/스냅샷)는 운영진 예약 슬롯 + 크루 슬롯 병합 배열로 복원.
      const { images: expMergedImages, captions: expMergedCaptions } = assembleReservedImageSlots(
        expAdminSlotsForMerge,
        persistedCrewImages,
        expCrewCaptionsToSave,
        expReserved,
        WORKINFO_IMAGE_SLOT_COUNT,
      );
      setEditingExpImages(expMergedImages);
      setEditingExpImageCaptions(expMergedCaptions);
      // legacy weekActivityDetails 미러는 activity_type_id 가 있을 때만 (competency 와 동일 — "" 키 충돌 방지).
      //   image_urls 는 크루 전용(운영진 슬롯 제외) — 읽기 단계 병합에서 운영진 슬롯을 다시 앞에 붙인다.
      if (expActivityTypeId) {
        setWeekActivityDetails((prev) => {
          const nextDetail = {
            week_id: weekId,
            activity_type_id: expActivityTypeId,
            sub_title: newSubTitle,
            output_links: newOutputLinks,
            growth_point: newGrowthPoint,
            image_urls: persistedCrewImages,
            image_captions: expCrewCaptionsToSave,
          };
          const existingIndex = prev.findIndex((d) => d.activity_type_id === expActivityTypeId);
          if (existingIndex < 0) return [...prev, nextDetail];
          return prev.map((d) => (d.activity_type_id === expActivityTypeId ? { ...d, ...nextDetail } : d));
        });
      }
      setSelectedWorkExpCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingExpGrowthPoint,
              images: expMergedImages,
              imageCaptions: expMergedCaptions,
              // rating은 어드민(compliance-manage)에서만 갱신 — 크루 저장 시 건드리지 않음
            }
          : prev,
      );
      workExpSnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingExpGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...expMergedImages],
        imageCaptions: [...expMergedCaptions],
        rating: editingExpRating,
      };
      // 저장 직후 미리보기 단일 출처(cluster4Lines[].submission) 패치 — canonical 우선 표시(buildExpCard)와
      // 정합. exp 미리보기는 submission.subtitle/growthPoint 만 읽으므로(links/images 는 detail) 두 필드만 갱신해
      // 새로고침 없이 새 값이 보이게 한다. (competency 패턴과 동일)
      if (expSaveLineTargetId) {
        setCluster4Lines((prev) =>
          prev.map((l) =>
            l.lineTargetId === expSaveLineTargetId && normalizePartType(l.partType) === "experience"
              ? {
                  ...l,
                  submission: {
                    ...((l.submission as Record<string, unknown> | null | undefined) || {}),
                    subtitle: newSubTitle,
                    growthPoint: newGrowthPoint,
                  },
                }
              : l,
          ),
        );
      }
    }
    await popup.alert("저장되었습니다.");
    setWorkExpFooterNotice("default");
    setWorkExpViewIsEditing(false);
  };

  const handleCloseWorkExp = async () => {
    if (workExpViewIsEditing && isWorkExpDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    setWorkExpViewModalOpen(false);
    setWorkExpViewIsEditing(false);
    // 선택값 누수 방지: 모달 닫을 때 선택 카드 초기화 (다음 슬롯 클릭 시 잔존값 재사용 금지).
    setSelectedWorkExpCard(null);
  };

  const handleExpOutputLinkChange = (idx: number, field: "desc" | "url", value: string) => {
    if (!selectedWorkExpCard?.activityTypeId) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId, workExpMatchedLine);
    if (idx < adminCount) return;
    setEditingExpOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleExpOutputLinkDelete = (idx: number) => {
    if (!selectedWorkExpCard?.activityTypeId) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId, workExpMatchedLine);
    if (idx < adminCount) return;
    setEditingExpOutputLinks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < 5) next.push({ desc: "", url: "" });
      return next;
    });
  };

  const triggerExpImageUpload = (idx: number) => {
    expImageFileInputRefs.current[idx]?.click();
  };

  const handleExpImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEditingExpImages((prev) => {
      const next = [...prev];
      next[idx] = url;
      return next;
    });
    e.target.value = "";
  };

  const handleExpImageDelete = (idx: number) => {
    setEditingExpImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push(null);
      return next;
    });
    setEditingExpImageCaptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKINFO_IMAGE_SLOT_COUNT) next.push("");
      return next;
    });
  };

  const handleExpCaptionChange = (idx: number, value: string) => {
    setEditingExpImageCaptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleExpImagePreview = (idx: number) => {
    const image = editingExpImages[idx] || selectedWorkExpCard?.images?.[idx];
    if (image) setPreviewExpImageUrl(image);
  };

  // ========== workCareer View 모달 전용 핸들러 (workExp 패턴 복제, 평점/rating 로직 제외) ==========
  const isWorkCareerDirty = (): boolean => {
    const snap = workCareerSnapshot.current;
    if (!snap) return false;
    if (editingCareerSubTitle !== (snap.subTitle || "")) return true;
    if (editingCareerGrowthPoint !== (snap.growthPoint || "")) return true;
    const snapLinks: { desc: string; url: string }[] = snap.outputLinks || [];
    for (let i = 0; i < 5; i++) {
      const sUrl = snapLinks[i]?.url || "";
      const sDesc = snapLinks[i]?.desc || "";
      const eUrl = editingCareerOutputLinks[i]?.url || "";
      const eDesc = editingCareerOutputLinks[i]?.desc || "";
      if (sUrl !== eUrl || sDesc !== eDesc) return true;
    }
    const snapImages = normalizeWorkCareerImages(snap.images);
    for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
      if ((snapImages[i] || null) !== (editingCareerImages[i] || null)) return true;
    }
    const snapCaptions = normalizeWorkCareerCaptions(snap.imageCaptions);
    for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
      if ((snapCaptions[i] || "") !== (editingCareerImageCaptions[i] || "")) return true;
    }
    return false;
  };

  const handleEditWorkCareer = async () => {
    if (selectedWorkCareerCard?.isEmpty) {
      await popup.alert("해당 카드는 비어있습니다");
      return;
    }
    // 버튼 활성화와 동일 기준: matchedLine.canEdit + lineTargetId (legacy canEdit fallback 제거).
    {
      const lineTargetId = (workCareerMatchedLine?.lineTargetId as string | null | undefined) ?? null;
      const backendEditable = workCareerMatchedLine?.canEdit === true && !!lineTargetId;
      if (!forceEditUnlock && (!backendEditable || isForeignViewer)) {
        await popup.alert(!workCareerMatchedLine ? "개설된 라인이 없습니다." : ((workCareerMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
        return;
      }
    }
    const card = selectedWorkCareerCard;
    const careerLineLinks = Array.isArray(workCareerMatchedLine?.outputLinks) ? workCareerMatchedLine!.outputLinks! : null;
    const careerSrcLinks = careerLineLinks && careerLineLinks.length > 0 ? careerLineLinks : card?.outputLinks;
    const initialOutputLinks = careerSrcLinks && careerSrcLinks.length > 0 ? careerSrcLinks.map((l: { desc?: string | null; url?: string | null }) => ({ desc: l?.desc || "", url: l?.url || "" })) : Array(5).fill({ desc: "", url: "" });
    const initialImages = normalizeWorkCareerImages(card?.images);
    const initialCaptions = normalizeWorkCareerCaptions(card?.imageCaptions);
    workCareerSnapshot.current = {
      subTitle: card?.subTitle || card?.projectDescription || "",
      growthPoint: card?.growthPoint || "",
      outputLinks: JSON.parse(JSON.stringify(initialOutputLinks)),
      images: [...initialImages],
      imageCaptions: [...initialCaptions],
    };
    setEditingCareerSubTitle(card?.subTitle || card?.projectDescription || "");
    setEditingCareerGrowthPoint(card?.growthPoint || "");
    setEditingCareerOutputLinks(initialOutputLinks);
    setEditingCareerImages(initialImages);
    setEditingCareerImageCaptions(initialCaptions);
    setWorkCareerViewIsEditing(true);
  };

  const handleCancelWorkCareer = async () => {
    if (isWorkCareerDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    const snap = workCareerSnapshot.current;
    if (snap) {
      setEditingCareerSubTitle(snap.subTitle || "");
      setEditingCareerGrowthPoint(snap.growthPoint || "");
      setEditingCareerOutputLinks(snap.outputLinks && snap.outputLinks.length > 0 ? snap.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" }));
      setEditingCareerImages(normalizeWorkCareerImages(snap.images));
      setEditingCareerImageCaptions(normalizeWorkCareerCaptions(snap.imageCaptions));
    }
    setWorkCareerViewIsEditing(false);
  };

  const handleResetWorkCareer = async () => {
    if (!isLineEditableByDto(workCareerMatchedLine)) {
      await popup.alert(!workCareerMatchedLine ? "개설된 라인이 없습니다." : ((workCareerMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 초기화 = 크루가 입력한 값만 비움. 어드민이 등록한 슬롯(output_images, output_links 앞쪽)은 유지.
    if (!(await popup.confirm("내용을 모두 초기화하시겠어요?"))) return;
    const careerIdx = (selectedWorkCareerCard?.id || 1) - 1;
    const careerRecord = careerRecords[careerIdx];
    // 운영진 output 정책: 최대 1 — 초기화 시 유지할 어드민 슬롯도 1개로 제한.
    const adminImgs = (careerRecord?.output_images || []).filter((i) => i?.url?.trim()).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    const adminLinks = (careerRecord?.output_links || []).filter((l) => l?.url?.trim()).slice(0, ADMIN_OUTPUT_LINK_MAX);
    setEditingCareerSubTitle("");
    setEditingCareerGrowthPoint("");
    const resetLinks: { desc: string; url: string }[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < adminLinks.length) {
        resetLinks.push({ desc: adminLinks[i].desc || "", url: adminLinks[i].url || "" });
      } else {
        resetLinks.push({ desc: "", url: "" });
      }
    }
    setEditingCareerOutputLinks(resetLinks);
    const resetImages: (string | null)[] = [];
    const resetCaptions: string[] = [];
    for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
      if (i < adminImgs.length) {
        resetImages.push(adminImgs[i].url);
        resetCaptions.push(adminImgs[i].caption || "");
      } else {
        resetImages.push(null);
        resetCaptions.push("");
      }
    }
    setEditingCareerImages(resetImages);
    setEditingCareerImageCaptions(resetCaptions);
  };

  const handleSaveWorkCareer = async () => {
    if (!isLineEditableByDto(workCareerMatchedLine)) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkCareer", canEdit: workCareerMatchedLine?.canEdit ?? null, lineTargetId: (workCareerMatchedLine?.lineTargetId as string | null | undefined) ?? null });
      await popup.alert(!workCareerMatchedLine ? "개설된 라인이 없습니다." : ((workCareerMatchedLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊"));
      return;
    }
    // 백엔드 lineTarget 단위 저장 — matchedLine.lineTargetId 없으면 저장 차단 (legacy fallback 금지).
    const careerSaveLineTargetId = (workCareerMatchedLine?.lineTargetId as string | null | undefined) ?? null;
    if (!forceEditUnlock && !careerSaveLineTargetId) {
      console.warn("[cluster4-canEdit] workCareer 저장 차단 — lineTargetId 없음", {
        weekId,
        careerProjectId: (selectedWorkCareerCard?.careerProjectId as string | null | undefined) ?? null,
        projectCode: (selectedWorkCareerCard?.projectCode as string | null | undefined) ?? (selectedWorkCareerCard?.lineCode as string | null | undefined) ?? (selectedWorkCareerCard?.code as string | null | undefined) ?? null,
      });
      await popup.alert("개설된 라인이 없습니다.");
      return;
    }
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 — 어드민 슬롯은 크루가 편집 불가하므로 제외 (한쪽만 입력 불가)
    {
      const careerIdxForCheck = (selectedWorkCareerCard?.id || 1) - 1;
      const adminImgCountForCheck = getAdminOutputImagesCount(workCareerActivityTypes[careerIdxForCheck], workCareerMatchedLine);
      const mismatch = findImageCaptionMismatch(editingCareerImages, editingCareerImageCaptions, adminImgCountForCheck);
      if (mismatch) {
        setWorkCareerFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    // career 라인 저장의 canonical key = line_target_id. career 라인은 activity_type_id(legacy
    // workCareerActivityTypes 매핑)가 없을 수 있으므로, lineTargetId 가 있으면 activityType 없이도 저장.
    const activityType = workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1] || "";
    const careerCanPersist = !!activityType || !!careerSaveLineTargetId;
    console.log("[SAVE] handleSaveWorkCareer persist 분기", {
      activityType: activityType || null,
      lineTargetId: careerSaveLineTargetId,
      canPersist: careerCanPersist,
      willCallApi: careerCanPersist && !isPureAdminPreview,
    });
    if (!careerCanPersist && !forceEditUnlock) {
      console.error("[SAVE] workCareer 저장 차단 — activityType/lineTargetId 모두 없음", { weekId });
      setWorkCareerFooterNotice("error");
      await popup.alert("저장 대상 라인을 식별하지 못했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }
    {
      const newSubTitle = editingCareerSubTitle.trim() || null;
      const newOutputLinks = editingCareerOutputLinks;
      const newGrowthPoint = editingCareerGrowthPoint.trim() || null;
      // 어드민 output_images 가 차지한 슬롯은 user_activity_details 에 저장하지 않음 (출처 분리)
      const careerIdx = (selectedWorkCareerCard?.id || 1) - 1;
      // 관리자 이미지 값은 getAdminOutputImages(표시/머지용), 슬롯 수는 getAdminOutputImagesCount(백엔드 SoT).
      const adminImgsForSave = getAdminOutputImages(workCareerActivityTypes[careerIdx], workCareerMatchedLine);
      const adminImgCount = getAdminOutputImagesCount(workCareerActivityTypes[careerIdx], workCareerMatchedLine);
      const crewImagesToSave = editingCareerImages.slice(adminImgCount);
      const crewCaptionsToSave = editingCareerImageCaptions.slice(adminImgCount);
      let persistedCrewImages: (string | null)[] = crewImagesToSave;
      if (isPureAdminPreview) {
        // 일반 어드민 미리보기만 저장 스킵. 테스트 유저 모드는 실제 저장.
        console.log("[AdminPreview] workCareer 저장 — API 호출 생략, local state만 반영");
      } else {
        try {
          const persisted = await persistActivityDetailToServer({
            // activity_type_id 는 null 가능 — line_target_id 가 canonical.
            activityTypeId: activityType || null,
            // 가드(careerSaveLineTargetId) 와 동일 출처 — persist 에 다른 값을 넘기면 가드 통과 후
            // line_target_id:null 전송 → submission 미반영인데 "저장됨" 안내가 뜨는 회귀를 막는다.
            lineTargetId: careerSaveLineTargetId,
            subTitle: newSubTitle,
            outputLinks: newOutputLinks,
            growthPoint: newGrowthPoint,
            images: crewImagesToSave,
            imageCaptions: crewCaptionsToSave,
            adminLinkCount: getAdminOutputLinksCount(activityType, workCareerMatchedLine),
          });
          persistedCrewImages = persisted.images;
        } catch (err) {
          console.error("workCareer 저장 실패:", err);
          await popup.alert(apiErrorMessage(err));
          return;
        }
      }
      // 화면 상태는 어드민 + 크루 머지 결과로 복원
      const mergedImages: (string | null)[] = [];
      const mergedCaptions: string[] = [];
      for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
        if (i < adminImgCount) {
          mergedImages.push(adminImgsForSave[i]?.url ?? null);
          mergedCaptions.push(adminImgsForSave[i]?.caption || "");
        } else {
          const crewIdx = i - adminImgCount;
          mergedImages.push(persistedCrewImages[crewIdx] || null);
          mergedCaptions.push(crewCaptionsToSave[crewIdx] || "");
        }
      }
      setEditingCareerImages(mergedImages);
      setEditingCareerImageCaptions(mergedCaptions);
      // legacy weekActivityDetails 미러는 activityType 이 있을 때만 (competency/exp 와 동일 — "" 키 충돌 방지).
      if (activityType) {
        setWeekActivityDetails((prev) => {
          const nextDetail = {
            week_id: weekId,
            activity_type_id: activityType,
            sub_title: newSubTitle,
            output_links: newOutputLinks,
            growth_point: newGrowthPoint,
            image_urls: persistedCrewImages,
            image_captions: crewCaptionsToSave,
          };
          const existingIndex = prev.findIndex((d) => d.activity_type_id === activityType);
          if (existingIndex < 0) return [...prev, nextDetail];
          return prev.map((d) => (d.activity_type_id === activityType ? { ...d, ...nextDetail } : d));
        });
      }
      setSelectedWorkCareerCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingCareerGrowthPoint,
              images: mergedImages,
              imageCaptions: mergedCaptions,
            }
          : prev,
      );
      workCareerSnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingCareerGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...mergedImages],
        imageCaptions: [...mergedCaptions],
      };
      // 저장 직후 미리보기 단일 출처(cluster4Lines[].submission) 패치 — career 미리보기(buildCareerCardFromLine)는
      // subtitle/growthPoint 와 outputImages/outputImageCaptions(크루 슬롯)를 submission 에서 읽으므로 함께 갱신해
      // 새로고침 없이 새 값이 보이게 한다. (어드민 top-level 이미지는 build 가 별도 머지 — 크루분만 저장)
      if (careerSaveLineTargetId) {
        const savedUserImages: string[] = [];
        const savedUserCaptions: Array<string | null> = [];
        (persistedCrewImages || []).forEach((u, i) => {
          if (u && u.trim()) {
            savedUserImages.push(u);
            savedUserCaptions.push(crewCaptionsToSave[i] || "");
          }
        });
        setCluster4Lines((prev) =>
          prev.map((l) =>
            l.lineTargetId === careerSaveLineTargetId && normalizePartType(l.partType) === "career"
              ? {
                  ...l,
                  submission: {
                    ...((l.submission as Record<string, unknown> | null | undefined) || {}),
                    subtitle: newSubTitle,
                    growthPoint: newGrowthPoint,
                    outputImages: savedUserImages,
                    outputImageCaptions: savedUserCaptions,
                  },
                }
              : l,
          ),
        );
      }
    }
    await popup.alert("저장되었습니다.");
    setWorkCareerFooterNotice("default");
    setWorkCareerViewIsEditing(false);
  };

  const handleCloseWorkCareer = async () => {
    if (workCareerViewIsEditing && isWorkCareerDirty()) {
      if (!(await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))) {
        return;
      }
    }
    setWorkCareerViewModalOpen(false);
    setWorkCareerViewIsEditing(false);
  };

  const handleCareerOutputLinkChange = (idx: number, field: "desc" | "url", value: string) => {
    const activityType = workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1];
    if (!activityType) return;
    const adminCount = getAdminOutputLinksCount(activityType, workCareerMatchedLine);
    if (idx < adminCount) return;
    setEditingCareerOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleCareerOutputLinkDelete = (idx: number) => {
    const activityType = workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1];
    if (!activityType) return;
    const adminCount = getAdminOutputLinksCount(activityType, workCareerMatchedLine);
    if (idx < adminCount) return;
    setEditingCareerOutputLinks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < 5) next.push({ desc: "", url: "" });
      return next;
    });
  };

  // 어드민 output_images 가 차지한 앞쪽 슬롯 수 (이 인덱스 미만은 크루 편집 불가)
  const getCareerAdminSlotCount = (): number => {
    const careerIdx = (selectedWorkCareerCard?.id || 1) - 1;
    return getAdminOutputImagesCount(workCareerActivityTypes[careerIdx], workCareerMatchedLine);
  };

  const triggerCareerImageUpload = (idx: number) => {
    if (idx < getCareerAdminSlotCount()) return;
    careerImageFileInputRefs.current[idx]?.click();
  };

  const handleCareerImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    if (idx < getCareerAdminSlotCount()) {
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEditingCareerImages((prev) => {
      const next = [...prev];
      next[idx] = url;
      return next;
    });
    e.target.value = "";
  };

  const handleCareerImageDelete = (idx: number) => {
    if (idx < getCareerAdminSlotCount()) return;
    setEditingCareerImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKCAREER_IMAGE_SLOT_COUNT) next.push(null);
      return next;
    });
    setEditingCareerImageCaptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < WORKCAREER_IMAGE_SLOT_COUNT) next.push("");
      return next;
    });
  };

  const handleCareerCaptionChange = (idx: number, value: string) => {
    if (idx < getCareerAdminSlotCount()) return;
    setEditingCareerImageCaptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleCareerImagePreview = (idx: number) => {
    const image = editingCareerImages[idx] || selectedWorkCareerCard?.images?.[idx];
    if (image) setPreviewCareerImageUrl(image);
  };

  // 모달 열릴 때 배경 스크롤 잠금
  const anyModalOpen = workInfoModalOpen || workAbilityModalOpen || workExpModalOpen || workCareerModalOpen || headerModalOpen || reputationViewModalOpen || colleagueViewModalOpen || workInfoViewModalOpen || workAbilityViewModalOpen || workExpViewModalOpen || workCareerViewModalOpen;
  useModalScroll(anyModalOpen);

  // [임시 진단] cluster-4 work-view-modal 깨짐 원인 추적 — ?debugLayout=1 일 때만 콘솔 로그.
  // 사용자 환경(zoom/DPR/viewport)에서 재현 시 정보 수집용. 검증 후 호출부 제거할 것.
  useDebugLayout(workInfoViewModalOpen, "workinfo-view-modal");
  useDebugLayout(workExpViewModalOpen, "workexp-view-modal");
  useDebugLayout(workAbilityViewModalOpen, "workability-view-modal");
  useDebugLayout(workCareerViewModalOpen, "workcareer-view-modal");

  // card-desc의 … → .. 교체 (line-clamp 렌더링 완료 후)
  useEffect(() => {
    const replaceDots = () => {
      const descs = document.querySelectorAll(".work-info-section .card-desc");
      descs.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.scrollHeight > htmlEl.clientHeight + 1) {
          const text = htmlEl.innerText;
          if (text.endsWith("…")) {
            htmlEl.innerText = text.slice(0, -1) + "..";
          } else if (text.endsWith("...")) {
            htmlEl.innerText = text.slice(0, -3) + "..";
          }
        }
      });
    };
    const timer = setTimeout(replaceDots, 100);
    return () => clearTimeout(timer);
  });

  // ─── 연계 동료 편집 모달 — 한글 초성 매칭 + 자동완성 (스펙 작업 3) ───
  const CHOSUNG_LIST = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  const getInitialConsonant = (char: string): string => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return char;
    const idx = Math.floor(code / 588);
    return CHOSUNG_LIST[idx];
  };

  const isJamoConsonant = (ch: string): boolean => /[ㄱ-ㅎ]/.test(ch);

  // 한 글자 매칭: 쿼리 문자가 이름 문자와 정확히 같거나(대소문자 무시·NFC 후),
  // 쿼리 문자가 단독 자음(ㄱ-ㅎ)이면 이름 문자의 초성과 같으면 매칭.
  const charMatches = (queryChar: string, nameChar: string): boolean => {
    if (queryChar === nameChar) return true;
    if (isJamoConsonant(queryChar)) return getInitialConsonant(nameChar) === queryChar;
    return false;
  };

  // 이름 "내부" 부분문자열 매칭 (스펙: 맨 앞 글자만이 아니라 중간 문자열도 매칭).
  // 슬라이딩 윈도우로 모든 시작 위치를 검사 — 각 위치에서 쿼리 문자열이
  // charMatches 로 연속 매칭되면 true. 일반 부분문자열 + 내부 초성 + 혼합("김ㅎ") 모두 처리.
  //   normalize("NFC"): mac/iOS 가 만드는 분해형(NFD) 한글을 합성형으로 보정해
  //   getInitialConsonant(0xAC00 기반)과 정확 비교가 깨지지 않게 한다.
  //   toLowerCase(): 라틴 문자(T) 대소문자 무시 — 한글에는 영향 없음.
  // 예) "T강지아" ← "T","강","강지","지아","ㄱ","ㄱㅈ" 모두 노출.
  const matchesNameQuery = (rawName: string, rawQuery: string): boolean => {
    const name = (rawName || "").normalize("NFC").toLowerCase();
    const query = (rawQuery || "").normalize("NFC").toLowerCase();
    if (!query || query.length > name.length) return false;
    for (let i = 0; i + query.length <= name.length; i++) {
      let ok = true;
      for (let j = 0; j < query.length; j++) {
        if (!charMatches(query[j], name[i + j])) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  };

  // 스펙: 이름 내부 부분문자열 매칭(+초성). 숫자 차단. 가나다 순. 최대 5개. 본인 및 이미 선택된 동료 제외.
  const searchColleagueCandidates = (query: string, pool: any[]): any[] => {
    const q = (query || "").trim();
    if (!q) return [];
    if (/^\d+$/.test(q)) return [];

    const excludedIds = new Set(selectedColleagues.map((c) => c.id));

    const filtered = pool.filter((crew) => {
      if (!crew || !crew.name) return false;
      if (excludedIds.has(crew.id)) return false;
      // 정책 A 방어선: 서버(/api/crews?org=)가 이미 동일 조직만 내려주지만, 풀이 어떤 경로로
      // 오염되더라도 다른 조직 후보가 새지 않도록 클라이언트에서도 한 번 더 막는다.
      if (cardOwnerOrg && crew.organizationSlug && crew.organizationSlug !== cardOwnerOrg) return false;
      return matchesNameQuery(crew.name, q);
    });

    return filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko")).slice(0, 5);
  };

  const colleagueSearchResults = useMemo(() => searchColleagueCandidates(colleagueSearchQuery, allCrewList).slice(0, 5), [colleagueSearchQuery, allCrewList, selectedColleagues]);

  // 편집 모달 오픈 — 빈 상태로 초기화 + 스냅샷 캡처 + 크루 리스트 fetch
  const handleOpenColleagueEdit = async () => {
    setColleagueEditData({ selectedColleague: null, content: "" });
    setColleagueSearchQuery("");
    setColleagueSaveAttemptFailed(false);
    setColleagueFormSnapshot({ selectedColleague: null, content: "" });
    await fetchCrewListIfNeeded();
    setHeaderModalType("본인");
    setHeaderModalOpen(true);
    // 이 모달은 게이트(requireWeeklyColleaguesWriteAccess)를 통과한 편집 진입에서만 열린다.
    // 곧바로 편집 모드로 둬야 검색창(disabled={!isColleagueEditing})이 열린다 — 평판의
    // handleReputationEditClick(setIsReputationFormEditing(true)) 와 동일 패턴.
    setIsColleagueEditing(true);
  };

  const handleSelectColleagueCandidate = (crew: any) => {
    setColleagueEditData((prev) => ({ ...prev, selectedColleague: crew }));
    setColleagueSearchQuery("");
    if (colleagueSaveAttemptFailed) setColleagueSaveAttemptFailed(false);
  };

  const handleDeselectColleague = () => {
    setColleagueEditData((prev) => ({ ...prev, selectedColleague: null }));
    setColleagueSearchQuery("");
  };

  // ── 연계동료 쓰기 권한 게이트 (서버 POST 와 "동일 판정") ──────────────────────
  // 판정 source = GET /api/edit-windows/permission?resource_key=cluster4.weekly_colleagues&week_id=...
  //   의 canEdit. 이 값은 서버 POST /api/weekly-colleagues 가 쓰는 hasOpenEditWindow 와
  //   "동일 테이블(user_edit_windows) · 동일 (user_id, resource_key, week_id, opened_at<=now<expires_at)"
  //   판정이므로 프론트(모달 오픈)와 서버(저장)가 절대 어긋나지 않는다.
  // ⚠ 과거엔 canEdit!==true 일 때 requireWriteWindow(고정 시간창)로 fallback 했다. 그러나 서버 POST 엔
  //   그 시간창 fallback 이 없어(오직 hasOpenEditWindow), "고정 시간창엔 들지만 어드민 창은 닫힘" 구간에서
  //   모달은 열리고 저장만 403 EDIT_WINDOW_CLOSED 가 났다 → fallback 제거(판정 기준 일치).
  //   창이 닫혔으면 모달 오픈 단계에서 조용히 막는다(저장까지 못 가게 — 안내 팝업은 정책상 미노출).
  // demo/admin 정책: 기존과 동일(데모는 로컬 작성 허용, 비데모 어드민은 항상 허용).
  const requireWeeklyColleaguesWriteAccess = async (): Promise<boolean> => {
    if (isDemoMode) return true;
    if (session?.user?.isAdmin && !demoUserId) return true;

    let canEdit = false;
    let permissionForLog: unknown = null;
    try {
      const res = await fetch(
        apiUrl(
          `/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.weeklyColleagues)}` +
            (weekId ? `&week_id=${encodeURIComponent(weekId)}` : ""),
        ),
        { cache: "no-store" },
      );
      permissionForLog = await res.json().catch(() => null);
      const data = (permissionForLog as { success?: boolean; data?: { canEdit?: boolean } } | null);
      canEdit = !!(res.ok && data?.success && data?.data?.canEdit === true);
    } catch (err) {
      // 권한 API 실패 → 보수적으로 "닫힘" 처리(서버도 저장을 막으므로 일관).
      console.error("[weekly-colleagues-gate] 권한 조회 실패 — 작성 불가 처리", err);
      canEdit = false;
    }

    if (!canEdit) {
      // 정책(2026-06-04): 작성 창 닫힘 안내 팝업 제거 — 별도 alert 없이 조용히 차단만 한다.
      //   (백엔드 hasOpenEditWindow 판정/저장 403 차단은 그대로 유지)
      console.log("[weekly-colleagues-gate] 작성 창 닫힘 — 모달 오픈/저장 차단", {
        weekId,
        weekNumber: weekData?.weekNumber ?? null,
        permission: permissionForLog,
      });
      return false;
    }
    console.log("[weekly-colleagues-gate] 작성 창 열림 — 허용", {
      weekId,
      weekNumber: weekData?.weekNumber ?? null,
      permission: permissionForLog,
    });
    return true;
  };

  // colleague-view-modal [수정] — 어드민 부여 권한(week_id) OR 기본 시간창 검증 후 편집 진입
  const handleColleagueEditClick = async () => {
    if (!(await requireWeeklyColleaguesWriteAccess())) return;
    setColleagueViewModalOpen(false);
    handleOpenColleagueEdit();
  };

  const handleColleagueEditCancel = async () => {
    // X / 취소 공용 — 편집 모드에서 dirty 시 confirm
    if (isColleagueEditing) {
      const dirty = colleagueFormSnapshot ? colleagueEditData.selectedColleague?.id !== colleagueFormSnapshot.selectedColleague?.id || colleagueEditData.content !== colleagueFormSnapshot.content : !!colleagueEditData.selectedColleague || colleagueEditData.content.trim().length > 0;
      if (dirty && !(await popup.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?"))) return;
    }
    setIsColleagueEditing(false);
    setHeaderModalOpen(false);
  };

  const handleColleagueEditReset = async () => {
    // 초기화는 이미 게이트(requireWeeklyColleaguesWriteAccess)를 통과해 편집 모달이 열린
    // 상태에서만 도달하므로 weekly-review 초기화와 동일하게 확인만 받는다.
    const ok = await popup.confirm("입력하신 내용을 모두 초기화하시겠습니까?");
    if (!ok) return;
    if (colleagueFormSnapshot) {
      setColleagueEditData(colleagueFormSnapshot);
    } else {
      setColleagueEditData({ selectedColleague: null, content: "" });
    }
    setColleagueSearchQuery("");
    setColleagueSaveAttemptFailed(false);
  };

  const isColleagueEditFormValid = (): boolean => {
    return !!colleagueEditData.selectedColleague && colleagueEditData.content.trim().length > 0;
  };

  const handleColleagueEditSave = async () => {
    // 모달 진입과 동일 게이트 — 어드민 부여 권한(week_id) OR 기본 시간창. 모달은 열렸는데
    // 저장에서만 막히는 불일치를 방지하기 위해 클릭/저장이 같은 함수를 본다.
    if (!(await requireWeeklyColleaguesWriteAccess())) return;
    if (!isColleagueEditFormValid()) {
      setColleagueSaveAttemptFailed(true);
      setColleagueFieldErrorFlash(true);
      setTimeout(() => setColleagueFieldErrorFlash(false), 600);
      return;
    }

    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;

    const picked = colleagueEditData.selectedColleague!;
    // 다음 rank 할당 (기존 selectedColleagues의 빈 rank 자리를 채움)
    const usedRanks = new Set(selectedColleagues.map((c) => c.rank));
    let nextRank = 1;
    for (let r = 1; r <= 3; r++) {
      if (!usedRanks.has(r)) {
        nextRank = r;
        break;
      }
    }

    const newEntry = {
      id: picked.id,
      name: picked.name || "-",
      gender: picked.gender || "-",
      age: picked.age || "-",
      profileImg: picked.profileImg || "",
      university: picked.university || "-",
      major: picked.major || "-",
      team: picked.team || "-",
      part: picked.part || "-",
      // "닉네임" 칸 = 한줄소개 체인(profile_tagline → profile_keyword → vision) —
      // weekly-cards DTO(colleagueProfile.profileTagline)와 동일 규칙. /api/crews 가
      // profileTagline 을 내려주며, 구버전 응답 호환으로 nickname(vision) 폴백 유지.
      nickname: (picked as any).profileTagline || picked.nickname || "-",
      role: picked.role || "",
      membershipLevel: (picked as any).membershipLevel ?? null,
      rank: nextRank,
      message: colleagueEditData.content.trim(),
      createdAt: new Date().toISOString(),
    };

    // ⚠️ optimistic update 금지 — 여기서 setSelectedColleagues 를 미리 호출하면 API 실패(403 등)
    //   시에도 화면에 동료가 남고(새로고침하면 사라짐) count 가 잘못 1/3 로 오른다.
    //   따라서 로컬 state(selectedColleagues)는 "데모 성공" 또는 "API 200" 이후에만 반영한다.
    const updatedList = [...selectedColleagues, newEntry].sort((a, b) => a.rank - b.rank);

    // 데모(테스트 유저) 모드: API 미호출 성공 경로 — 이때만 로컬 반영.
    if (isDemoMode) {
      setSelectedColleagues(updatedList);
      await popup.alert("저장되었습니다.");
      setIsColleagueEditing(false);
      setHeaderModalOpen(false);
      return;
    }

    setColleagueSaving(true);
    try {
      const payload = updatedList.map((c) => ({ colleagueId: c.id, rank: c.rank, message: c.message || "" }));
      const res = await fetch(apiUrl("/api/weekly-colleagues"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekCardId: weekId, colleagues: payload }),
      });
      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        // 실패: 로컬 state 절대 미반영(추가/수정/rollback 모두 불필요 — 애초에 안 건드림).
        console.error("[연계동료 저장] 실패 — 화면 미반영", {
          status: res.status,
          error: json?.error ?? null,
          message: json?.message ?? null,
          weekCardId: weekId,
          payload,
        });
        await popup.alert(json?.message || json?.error || "저장에 실패했습니다.");
        return;
      }

      // ✅ 성공 시에만 화면 반영. 서버 재조회(fetchWeeklyColleagues)로 canonical state 동기화 →
      //    selectedColleagues 갱신 → displayedColleagues/colleagueData/count(N/3) 즉시 반영.
      setSelectedColleagues(updatedList);
      fetchWeeklyColleagues();
      // weekly-cards DTO(스냅샷) 재조회 — 저장 API 가 snapshot 재계산을 끝낸 뒤 응답하므로
      // 여기서 bump 하면 미리보기/모달이 legacy 가 아닌 동일 DTO(colleagueProfile)로 갱신된다.
      setWeeklyCardsRefreshKey((k) => k + 1);
      await popup.alert("저장되었습니다.");
      setIsColleagueEditing(false);
      setHeaderModalOpen(false);
    } catch (err) {
      // 네트워크/파싱 예외 — 역시 로컬 state 미반영.
      console.error("연계 동료 저장 실패:", err);
      await popup.alert("저장에 실패했습니다.");
    } finally {
      setColleagueSaving(false);
    }
  };

  useEffect(() => {
    if (!headerModalOpen) setIsColleagueEditing(false);
  }, [headerModalOpen]);

  // [임시 진단 — 검색창 disabled 원인 확인용. 확인 후 제거 가능]
  // search-input 의 disabled 는 오직 !isColleagueEditing 에만 연결돼 있다.
  // (canEdit*/isLoading/isSaving/권한 플래그와는 무관 — 아래 로그로 확인 가능)
  useEffect(() => {
    if (!(headerModalOpen && headerModalType === "본인")) return;
    console.log("[colleague-search-disabled] 연계동료 모달 열림 — disabled 계산값/플래그", {
      "disabled (= !isColleagueEditing)": !isColleagueEditing,
      isColleagueEditing,
      colleagueSaving, // (= isSaving 역할)
      canEditColleague, // week 권한 플래그 — disabled 와 연결돼 있지 않음
      isOwner,
      isAdmin: session?.user?.isAdmin ?? false,
      weekId, // (= selectedWeekId)
      selectedColleagueId: colleagueEditData.selectedColleague?.id ?? null, // (= selectedCrewId)
      headerModalOpen,
      headerModalType,
    });
  }, [headerModalOpen, headerModalType, isColleagueEditing, colleagueSaving, canEditColleague, isOwner, session?.user?.isAdmin, weekId, colleagueEditData.selectedColleague?.id]);

  // 동료 삭제 함수
  const removeColleague = (id: number) => {
    setSelectedColleagues((prev) => prev.filter((c) => c.id !== id));
  };

  // 동료 추가 함수 (순위 지정)
  const addColleague = (user: any, rank: number) => {
    if (selectedColleagues.length >= 3) return;
    if (selectedColleagues.find((c) => c.id === user.id)) return;
    // 해당 순위가 이미 사용중인지 확인
    if (selectedColleagues.find((c) => c.rank === rank)) return;

    const newColleague = { ...user, message: "", rank };
    const newList = [...selectedColleagues, newColleague];

    // rank 순서대로 정렬
    newList.sort((a, b) => a.rank - b.rank);

    setSelectedColleagues(newList);
  };

  // 메시지 업데이트 함수
  const updateColleagueMessage = (id: number, message: string) => {
    setSelectedColleagues((prev) => prev.map((c) => (c.id === id ? { ...c, message } : c)));
  };

  // 타크루 선택 함수 (주차 평판 편집용)
  const selectCrewForReputation = (crewId: number) => {
    const crew = reputationData.find((u) => u.id === crewId);
    if (crew && !crew.isEmpty) {
      setSelectedCrewForReputation(crewId);
      setReputationEditData({
        rating: crew.rating,
        content: crew.description,
        keyword: crew.tagText.replace("#", ""),
      });
    }
  };

  // 타크루 편집 뒤로가기
  const backToCrewList = () => {
    setSelectedCrewForReputation(null);
    setReputationEditData({ rating: 0, content: "", keyword: "" });
  };

  // 연계 동료 저장 함수
  const saveWeeklyColleagues = async () => {
    if (selectedColleagues.length === 0) {
      const el = document.querySelector(".selected-colleagues, .add-colleague-card");
      if (el) {
        (el as HTMLElement).style.border = "1px solid #ff4444";
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (isDemoMode) {
      console.log("Demo: 연계 동료 저장", selectedColleagues);
      await popup.alert("저장되었습니다.");
      setHeaderModalOpen(false);
      return;
    }
    if (!weekId) {
      await popup.alert("주차 정보를 찾을 수 없습니다.");
      return;
    }

    setColleagueSaving(true);
    setColleagueSaveError(null);
    setColleagueSaveSuccess(false);

    try {
      const colleagues = selectedColleagues.map((c) => ({
        colleagueId: c.id,
        rank: c.rank,
        message: c.message || "",
      }));

      const res = await fetch(apiUrl("/api/weekly-colleagues"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekCardId: weekId,
          colleagues,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        await popup.alert(json.error || "저장에 실패했습니다.");
        return;
      }

      // 연계 동료 데이터 새로고침
      fetchWeeklyColleagues();
      await popup.alert("저장되었습니다.");
      setHeaderModalOpen(false);
    } catch (error) {
      console.error("연계 동료 저장 오류:", error);
      await popup.alert("서버 오류가 발생했습니다.");
    } finally {
      setColleagueSaving(false);
    }
  };

  // ========================================================================
  // reputation-form 리디자인 2단계 — 핸들러
  // ========================================================================

  // 별 클릭 → 평점 업데이트 (1~10 자연수, 반개 가능)
  const handleRatingClick = (value: number) => {
    setReputationEditData((prev) => ({ ...prev, rating: value }));
    if (saveAttemptFailed) setSaveAttemptFailed(false); // 사용자 요청: 입력 시작 시 에러 자동 해제
  };

  // 안내문 자동 복원 — cluster3 패턴 (모든 필드 유효해지면 에러 해제)
  useEffect(() => {
    if (!isReputationFormEditing || !saveAttemptFailed) return;
    if (isFormValid()) setSaveAttemptFailed(false);
  }, [reputationEditData, isReputationFormEditing, saveAttemptFailed]);

  // 키워드 모드 전환 (select ↔ write) — 사용자 요청: 브라우저 기본 confirm 사용
  const handleKeywordModeChange = async (mode: "select" | "write") => {
    if (mode === "select") {
      setSelectedKeywordTemp("");
      setKeywordModalOpen(true);
    } else if (mode === "write") {
      const ok = await popup.confirm("키워드를 직접 작성하시겠습니까?");
      if (ok) {
        setReputationEditData((prev) => ({ ...prev, keyword: "" }));
        setFormKeywordMode("write");
      }
    }
  };

  // 중첩 모달 내 임시 선택
  const handleKeywordSelect = (keyword: string) => {
    if (!isReputationFormEditing) return;
    setSelectedKeywordTemp(keyword);
  };

  // 중첩 모달 [선택] 버튼 → window.confirm으로 최종 선택 확인
  const handleKeywordSelectConfirm = async () => {
    if (!selectedKeywordTemp) return;
    const ok = await popup.confirm(`"${selectedKeywordTemp}"을(를) 선택하시겠습니까?`);
    if (ok) {
      handleKeywordSelectFinal();
    }
  };

  // 선택 확인 후 최종 저장 + 중첩 모달 닫기
  const handleKeywordSelectFinal = () => {
    setReputationEditData((prev) => ({ ...prev, keyword: selectedKeywordTemp }));
    setFormKeywordMode("select");
    setKeywordModalOpen(false);
    setSaveAttemptFailed(false);
  };

  // 취소 — cluster3 패턴: 편집 → 보기 전환 (스냅샷 복원, 모달 닫기 아님)
  const handleFormCancel = () => {
    if (!isReputationFormEditing) return;
    if (formSnapshot) {
      setReputationEditData({
        rating: formSnapshot.rating,
        content: formSnapshot.content,
        keyword: formSnapshot.keyword,
      });
    }
    setIsReputationFormEditing(false);
    setKeywordModalOpen(false);
    setReputationSaveError(null);
    setReputationSaveSuccess(false);
    setSaveAttemptFailed(false);
  };

  // 커스텀 별점 드롭다운 — 외부 클릭 + ESC 닫기
  useEffect(() => {
    if (!ratingDropdownOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".dropdown-selected") && !target.closest(".dropdown-options-fixed")) {
        setRatingDropdownOpen(false);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRatingDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ratingDropdownOpen]);

  const openRatingDropdown = () => {
    if (!isReputationFormEditing) return;
    if (ratingDropdownOpen) {
      setRatingDropdownOpen(false);
      return;
    }
    const trigger = ratingDropdownTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setRatingDropdownPos(getFixedDropdownPosition(rect, 4));
    setRatingDropdownOpen(true);
  };

  const handleRatingSelect = (value: number) => {
    setReputationEditData((prev) => ({ ...prev, rating: value }));
    setRatingDropdownOpen(false);
    if (saveAttemptFailed) setSaveAttemptFailed(false);
  };

  // 주차 리뷰 — 평점 드롭다운 핸들러
  const openReviewRatingDropdown = () => {
    if (!isWeeklyReviewEditing) return;
    if (reviewRatingDropdownOpen) {
      setReviewRatingDropdownOpen(false);
      return;
    }
    const trigger = reviewRatingDropdownTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setReviewRatingDropdownPos(getFixedDropdownPosition(rect, 4));
    setReviewRatingDropdownOpen(true);
  };

  const handleReviewRatingSelect = (value: number) => {
    setWeeklyReviewData((prev) => ({ ...prev, rating: value }));
    setReviewRatingDropdownOpen(false);
  };

  useEffect(() => {
    if (!reviewRatingDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".review-rating-section .dropdown-selected") && !target.closest(".review-rating-dropdown-options")) {
        setReviewRatingDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewRatingDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [reviewRatingDropdownOpen]);

  // 주차 리뷰 — 페이지 로드 시 데이터 초기화
  const fetchWeeklyReview = async () => {
    if (isDemoMode) {
      setWeeklyReviewFromDB({
        id: "demo-weekly-review-init",
        weekCardId: weekId,
        rating: 8,
        content: "이번 주차에는 새로운 프로젝트를 시작하면서 팀워크의 중요성을 다시 한번 느꼈습니다. 협업 도구를 적극 활용하여 효율적으로 진행했고, 동료들의 피드백을 통해 많이 성장할 수 있었습니다.",
        created_at: new Date().toISOString(),
      });
      return;
    }

    try {
      // 페이지 주인의 리뷰를 가져와야 함 — urlUserId 우선, 없으면 본인
      const ownerId = urlUserId || session?.user?.id;
      const params = new URLSearchParams({ weekCardId: weekId });
      if (ownerId) params.set("userId", ownerId);
      // apiUrl: demoUserId 테스트 모드에서 세션 없이 demo bypass 인증을 태운다 (2026-06-05).
      //   종전엔 demoQS 없이 호출해 401 → 데모에서 기존 리뷰가 안 보이고, 저장 시
      //   POST(신규)로 흘러 이미 리뷰가 있으면 409 가 나는 일반/데모 분기가 있었다.
      const res = await fetch(apiUrl(`/api/weekly-reviews?${params.toString()}`));
      if (!res.ok) {
        setWeeklyReviewFromDB(null);
        return;
      }
      const json = await res.json();
      const record = json?.success && json?.data ? json.data : null;
      if (record) {
        setWeeklyReviewFromDB({
          id: record.id,
          weekCardId: record.weekCardId || weekId,
          rating: record.rating,
          content: record.content,
          created_at: record.created_at,
          updated_at: record.updated_at,
        });
      } else {
        setWeeklyReviewFromDB(null);
      }
    } catch (err) {
      console.error("[weekly-review] fetch 예외:", err);
      setWeeklyReviewFromDB(null);
    }
  };

  useEffect(() => {
    if (!weekId) return;
    fetchWeeklyReview();
    // urlUserId / session 변경 시에도 재조회 (페이지 주인이 바뀌면 다른 리뷰)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId, isDemoMode, urlUserId, session?.user?.id]);

  // 주차 리뷰 — 검증 함수
  const isWeeklyReviewValid = (): boolean => {
    return weeklyReviewData.rating > 0 && weeklyReviewData.content.trim().length > 0;
  };

  const isWeeklyReviewDirty = (): boolean => {
    if (!weeklyReviewFormSnapshot) {
      return weeklyReviewData.rating > 0 || weeklyReviewData.content.length > 0;
    }
    return weeklyReviewData.rating !== weeklyReviewFormSnapshot.rating || weeklyReviewData.content !== weeklyReviewFormSnapshot.content;
  };

  // 주차 리뷰 — 저장 함수
  const saveWeeklyReview = async (): Promise<{ id: string; weekCardId?: string; created_at: string; updated_at?: string } | null> => {
    const isUpdate = !!weeklyReviewFromDB?.id;

    if (isDemoMode) {
      const now = new Date().toISOString();
      if (isUpdate && weeklyReviewFromDB) {
        return { id: weeklyReviewFromDB.id!, weekCardId: weeklyReviewFromDB.weekCardId, created_at: weeklyReviewFromDB.created_at || now, updated_at: now };
      }
      return { id: `demo-weekly-review-${Date.now()}`, weekCardId: weekId, created_at: now };
    }

    try {
      const endpoint = isUpdate ? `/api/weekly-reviews/${weeklyReviewFromDB?.id}` : "/api/weekly-reviews";
      const method = isUpdate ? "PUT" : "POST";
      // 테스트 유저(데모) 모드면 demoUserId 부착 → 저장 대상이 테스트 유저로 고정되어 GET(userId) 과 일치.
      const res = await fetch(apiUrl(endpoint), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekCardId: weekId, rating: weeklyReviewData.rating, content: weeklyReviewData.content }),
      });
      const json = (await readJsonSafe(res)) as {
        success?: boolean;
        data?: { id: string; weekCardId?: string; rating: number; content: string; created_at: string; updated_at?: string };
      } | null;
      const record = json?.success && json?.data ? json.data : null;
      if (!record) return null;
      return { id: record.id, weekCardId: record.weekCardId, created_at: record.created_at, updated_at: record.updated_at };
    } catch (err) {
      console.error("[weekly-review] API 저장 실패:", err);
      throw err;
    }
  };

  // 주차 리뷰 — 모달 열릴 때 초기화
  useEffect(() => {
    if (!weeklyReviewModalOpen) return;
    if (weeklyReviewFromDB) {
      setWeeklyReviewData({ rating: weeklyReviewFromDB.rating, content: weeklyReviewFromDB.content });
    } else {
      setWeeklyReviewData({ rating: 0, content: "" });
    }
    setIsWeeklyReviewEditing(false);
    setWeeklyReviewFormSnapshot(null);
    setWeeklyReviewSaveAttemptFailed(false);
    setWeeklyReviewFieldErrorFlash(false);
  }, [weeklyReviewModalOpen, weeklyReviewFromDB]);

  // 주차 확인 버튼 — 클릭 핸들러 (공용 popup.confirm 사용)
  const fireConfettiAtButton = () => {
    const btn = weekConfirmBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const originX = (rect.left + rect.width / 2) / window.innerWidth;
    const originY = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 35,
      origin: { x: originX, y: originY },
      colors: ["#FFD87A", "#FFC040", "#A8E6A8", "#7DD89F", "#FFFFFF"],
      scalar: 0.9,
      ticks: 120,
    });
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        startVelocity: 25,
        origin: { x: originX, y: originY - 0.02 },
        colors: ["#FFD87A", "#A8E6A8", "#FFFFFF"],
        scalar: 0.7,
        ticks: 100,
      });
    }, 180);
  };

  const handleWeekConfirmClick = async () => {
    if (weekStatus !== "pending") return;
    const ok = await popup.confirm("주차 내역을 모두 확인하셨나요? 확인 이후에는 해당 주차 내역은 변동되지 않습니다.");
    if (!ok) return;
    setWeekStatus("confirming");
    fireConfettiAtButton();
    setTimeout(() => {
      setWeekStatus("confirmed");
      // 데모/실제 모두 클라이언트 상태만 변경 (백엔드 연동은 추후)
    }, 900);
  };

  // 주차 리뷰 — 모달 닫기 (isDirty 체크)
  const handleWeeklyReviewClose = async () => {
    if (isWeeklyReviewEditing && isWeeklyReviewDirty()) {
      if (!(await popup.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?"))) return;
    }
    setWeeklyReviewModalOpen(false);
  };

  // ── 주차 리뷰 쓰기 권한 게이트 (어드민 부여 권한 OR 기본 시간창) ──────────────
  // 문제였던 점: 기존엔 requireWriteWindow(고정 시간창)만 검사해서, 어드민이
  //   user_edit_windows(cluster4.weekly_reviews) 를 열어줘도 프론트가 이를 보지 않아
  //   시간창 밖이면 "작성할 수 있는 기간이 아닙니다" 로 막혔다.
  // 수정: 먼저 /api/edit-windows/permission?resource_key=cluster4.weekly_reviews 를 조회해
  //   canEdit===true 면 시간창과 무관하게 허용. 그 외(권한 없음/조회 실패)는 기존
  //   requireWriteWindow 시간창 검사로 fallback (실패 시 팝업도 그쪽에서 처리).
  //   결과: (어드민 권한 있음) OR (기본 작성기간 안) → 허용.
  // 서버 /api/weekly-reviews 도 동일 resource_key 를 enforce 하므로 프론트/서버 정렬됨.
  //   ⚠ 시즌 리뷰 키(cluster4.season_review)와 혼동 금지 — 여기서는 weeklyReviews 만 본다.
  const requireWeeklyReviewWriteAccess = async (): Promise<boolean> => {
    if (isDemoMode) return true;
    if (session?.user?.isAdmin && !demoUserId) return true;

    let grantCanEdit = false;
    let permissionForLog: unknown = null;
    try {
      const res = await fetch(
        apiUrl(
          `/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReviews)}` +
            (weekId ? `&week_id=${encodeURIComponent(weekId)}` : ""),
        ),
        { cache: "no-store" },
      );
      permissionForLog = await res.json().catch(() => null);
      const data = (permissionForLog as { success?: boolean; data?: { canEdit?: boolean } } | null);
      if (res.ok && data?.success && data?.data?.canEdit === true) {
        grantCanEdit = true;
      }
    } catch (err) {
      // 권한 API 실패 → 보수적으로 시간창 fallback (아래)
      console.error("[weekly-review-gate] 권한 조회 실패 — 시간창 fallback", err);
    }

    if (grantCanEdit) {
      // 어드민이 작성기간을 열어준 케이스 — 고정 시간창 무관 허용
      console.log("[weekly-review-gate] 어드민 부여 권한(cluster4.weekly_reviews) 으로 허용", {
        weekId,
        weekNumber: weekData?.weekNumber ?? null,
        permission: permissionForLog,
      });
      return true;
    }

    // 권한 없음/조회 실패 → 기존 고정 시간창 게이트로 판정 (실패 시 팝업은 requireWriteWindow 가 처리)
    const withinWindow = await requireWriteWindow();
    console.log("[weekly-review-gate] 권한 없음 → 기본 시간창 fallback", {
      weekId,
      weekNumber: weekData?.weekNumber ?? null,
      withinDefaultWindow: withinWindow,
      permission: permissionForLog,
    });
    return withinWindow;
  };

  // 주차 리뷰 — 푸터 핸들러
  // 본인 페이지(또는 어드민)에서만 수정 가능 — 타 크루 페이지에서는 열람만.
  // 게이트: requireWeeklyReviewWriteAccess = (어드민 부여 권한 cluster4.weekly_reviews) OR (기본 시간창).
  const handleWeeklyReviewEditClick = async () => {
    if (!isOwner) {
      await popup.alert("본인 주차 리뷰만 수정할 수 있습니다.");
      return;
    }
    if (!(await requireWeeklyReviewWriteAccess())) return;
    setWeeklyReviewFormSnapshot({ rating: weeklyReviewData.rating, content: weeklyReviewData.content });
    setWeeklyReviewSaveAttemptFailed(false);
    setWeeklyReviewFieldErrorFlash(false);
    setIsWeeklyReviewEditing(true);
  };

  const handleWeeklyReviewCancel = async () => {
    if (isWeeklyReviewDirty()) {
      if (!(await popup.confirm("작성 중인 내용이 있습니다. 취소하시겠습니까?"))) return;
    }
    if (weeklyReviewFormSnapshot) {
      setWeeklyReviewData({ rating: weeklyReviewFormSnapshot.rating, content: weeklyReviewFormSnapshot.content });
    } else if (weeklyReviewFromDB) {
      setWeeklyReviewData({ rating: weeklyReviewFromDB.rating, content: weeklyReviewFromDB.content });
    } else {
      setWeeklyReviewData({ rating: 0, content: "" });
    }
    setIsWeeklyReviewEditing(false);
    setWeeklyReviewSaveAttemptFailed(false);
    setWeeklyReviewFieldErrorFlash(false);
    setWeeklyReviewFormSnapshot(null);
  };

  const handleWeeklyReviewHelp = () => {
    setHelpModalKind("weeklyReview");
  };

  const handleWeeklyReviewReset = async () => {
    if (!(await popup.confirm("작성 내용을 모두 초기화하시겠습니까?"))) return;
    // 초기화 = snapshot 복원이 아니라 모든 필드를 빈 값으로 (사용자 기대치: "초기화" 라벨대로 비우기)
    setWeeklyReviewData({ rating: 0, content: "" });
    setWeeklyReviewSaveAttemptFailed(false);
    setWeeklyReviewFieldErrorFlash(false);
  };

  const handleWeeklyReviewSave = async () => {
    if (!isOwner) {
      await popup.alert("본인 주차 리뷰만 저장할 수 있습니다.");
      return;
    }
    if (!(await requireWeeklyReviewWriteAccess())) return;
    if (!isWeeklyReviewValid()) {
      setWeeklyReviewSaveAttemptFailed(true);
      setWeeklyReviewFieldErrorFlash(true);
      setTimeout(() => setWeeklyReviewFieldErrorFlash(false), 600);
      return;
    }
    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    setWeeklyReviewSaving(true);
    try {
      const savedRecord = await saveWeeklyReview();
      if (!savedRecord) throw new Error("invalid-save-response");
      setWeeklyReviewFromDB({
        id: savedRecord.id,
        weekCardId: savedRecord.weekCardId,
        rating: weeklyReviewData.rating,
        content: weeklyReviewData.content,
        created_at: savedRecord.created_at,
        updated_at: savedRecord.updated_at,
      });
      await popup.alert("저장되었습니다.");
      setWeeklyReviewModalOpen(false);
      setIsWeeklyReviewEditing(false);
      setWeeklyReviewSaveAttemptFailed(false);
      setWeeklyReviewFieldErrorFlash(false);
      setWeeklyReviewFormSnapshot(null);
    } catch (err) {
      console.error("[weekly-review] 저장 실패:", err);
      await popup.alert(apiErrorMessage(err));
    } finally {
      setWeeklyReviewSaving(false);
    }
  };

  const handleReputationHelp = () => {
    setHelpModalKind("reputation");
  };

  // ── 위클리 평판 쓰기 권한 게이트 (어드민 부여 권한 OR 기본 시간창) ──────────────
  // requireWeeklyReviewWriteAccess / requireWeeklyColleaguesWriteAccess 와 동일 패턴 —
  //   resource_key 만 weeklyReputation 으로. 먼저
  //   /api/edit-windows/permission?resource_key=cluster4.weekly_reputation&week_id=...
  //   를 조회해 canEdit===true 면 시간창과 무관하게 허용. 그 외(권한 없음/조회 실패)는
  //   기존 requireWriteWindow 시간창 게이트로 fallback (실패 팝업도 그쪽에서 처리).
  // 서버 POST/PUT /api/weekly-reputations 도 동일 (user_id, resource_key, week_id) enforce.
  //   window 는 작성자(reviewer = session user) 기준 — 반드시 week_id 를 포함해 정렬한다.
  const requireWeeklyReputationWriteAccess = async (): Promise<boolean> => {
    if (isDemoMode) return true;
    if (session?.user?.isAdmin && !demoUserId) return true;

    let grantCanEdit = false;
    let permissionForLog: unknown = null;
    try {
      const res = await fetch(
        apiUrl(
          `/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReputation)}` +
            (weekId ? `&week_id=${encodeURIComponent(weekId)}` : ""),
        ),
        { cache: "no-store" },
      );
      permissionForLog = await res.json().catch(() => null);
      const data = (permissionForLog as { success?: boolean; data?: { canEdit?: boolean } } | null);
      if (res.ok && data?.success && data?.data?.canEdit === true) {
        grantCanEdit = true;
      }
    } catch (err) {
      // 권한 API 실패 → 보수적으로 시간창 fallback (아래)
      console.error("[weekly-reputation-gate] 권한 조회 실패 — 시간창 fallback", err);
    }

    if (grantCanEdit) {
      // 어드민이 작성기간을 열어준 케이스 — 고정 시간창 무관 허용
      console.log("[weekly-reputation-gate] 어드민 부여 권한(cluster4.weekly_reputation) 으로 허용", {
        weekId,
        weekNumber: weekData?.weekNumber ?? null,
        permission: permissionForLog,
      });
      return true;
    }

    // 권한 없음/조회 실패 → 기존 고정 시간창 게이트로 판정 (실패 시 팝업은 requireWriteWindow 가 처리)
    const withinWindow = await requireWriteWindow();
    console.log("[weekly-reputation-gate] 권한 없음 → 기본 시간창 fallback", {
      weekId,
      weekNumber: weekData?.weekNumber ?? null,
      withinDefaultWindow: withinWindow,
      permission: permissionForLog,
    });
    return withinWindow;
  };

  // 편집 진입 — 보기 → 편집 전환 + 현재값으로 스냅샷 업데이트 (롤백 기준점)
  const handleEditMode = async () => {
    // 어드민 부여 권한(week_id) OR 기본 시간창 — review/colleague 와 동일 게이트
    if (!(await requireWeeklyReputationWriteAccess())) return;

    setFormSnapshot({
      rating: reputationEditData.rating,
      content: reputationEditData.content,
      keyword: reputationEditData.keyword,
    });
    setIsReputationFormEditing(true);
    setReputationSaveError(null);
    setReputationSaveSuccess(false);
    setSaveAttemptFailed(false);
  };

  // 구형 별칭 — 기존 참조 호환 (제거 대비)
  const handleFormEditStart = handleEditMode;

  // 초기화 버튼 → 사용자 요청: window.confirm 사용 (cluster3 동일 패턴)
  const handleFormReset = async () => {
    // 초기화는 이미 게이트(requireWeeklyReputationWriteAccess)를 통과해 편집 모달이 열린
    // 상태에서만 도달한다. canEditReputation 은 (approved && isOwner) 라 평판 작성자(타 크루)
    // 에게는 항상 false 라 잘못 차단했었음 — weekly-review 초기화와 동일하게 확인만 받는다.
    const ok = await popup.confirm("입력하신 내용을 모두 초기화하시겠습니까?");
    if (!ok) return;
    if (formSnapshot) {
      setReputationEditData({
        rating: formSnapshot.rating,
        content: formSnapshot.content,
        keyword: formSnapshot.keyword,
      });
    } else {
      setReputationEditData({ rating: 0, content: "", keyword: "" });
    }
    setSaveAttemptFailed(false);
  };

  // 초기화 확인 (구 팝업 연동용 — window.confirm 전환 후 미사용, 호환성 유지)
  const handleResetConfirm = () => {
    if (formSnapshot) {
      setReputationEditData({
        rating: formSnapshot.rating,
        content: formSnapshot.content,
        keyword: formSnapshot.keyword,
      });
    } else {
      setReputationEditData({ rating: 0, content: "", keyword: "" });
    }
    setSaveAttemptFailed(false);
  };

  // ========================================================================
  // reputation-view-modal [수정] / [삭제] 핸들러 (작업 1 — 관리자 승인)
  // ========================================================================

  // [수정] — 어드민 부여 권한(week_id) OR 기본 시간창 검증 후 편집 모달 진입
  const handleReputationEditClick = async () => {
    if (!(await requireWeeklyReputationWriteAccess())) return;
    if (!selectedReputationCard) return;

    // selectedReputationCard에서 reputation-form 데이터로 역매핑
    // reputationData useMemo: rating /= 2, tagText = `#${keyword}`, description = content
    const restoredRating = Math.round((selectedReputationCard.rating || 0) * 2); // 5점 만점 → 10점 만점 복원
    const restoredContent = selectedReputationCard.description && selectedReputationCard.description !== "-" ? selectedReputationCard.description : "";
    const restoredKeyword = selectedReputationCard.tagText ? String(selectedReputationCard.tagText).replace(/^#/, "") : "";

    const initial = {
      rating: restoredRating,
      content: restoredContent,
      keyword: restoredKeyword,
    };
    setReputationEditData(initial);
    setFormSnapshot(initial);
    // 키워드가 있으면 기본 select 모드(MD 스펙: readonly) — 신규 작성이 아닌 수정이므로
    setFormKeywordMode(restoredKeyword ? "select" : "select");
    setSelectedKeywordTemp("");
    setIsReputationFormEditing(true); // [수정] 진입 시 바로 편집 모드
    setSaveAttemptFailed(false);

    // view 모달 닫고 form 모달 오픈
    setReputationViewModalOpen(false);
    setHeaderModalType("타크루");
    setHeaderModalOpen(true);
  };

  // [삭제] — 작업 5: 확인 팝업 → 데모/일반 분기 → 성공 시 view 닫기 + 자동 재정렬(useMemo 재계산)
  // TODO: [백엔드 작업 필요] DELETE /api/weekly-reputations/:id 엔드포인트 확인/생성
  const handleReputationDeleteClick = async () => {
    if (!selectedReputationCard) return;

    // 편집/저장과 동일 게이트 — 어드민 부여 권한(week_id) OR 기본 시간창.
    // (서버 DELETE 는 작성기간 게이트가 없으므로 프론트 정책으로 통일한다.)
    if (!(await requireWeeklyReputationWriteAccess())) return;

    const ok = await popup.confirm("이 평판을 삭제하시겠습니까?");
    if (!ok) return;

    const repId = selectedReputationCard.id;

    try {
      if (isDemoMode) {
        // 데모 모드: 로컬 filter로 weeklyReputations에서 제거
        setWeeklyReputations((prev) => prev.filter((r) => r.id !== repId));
      } else {
        // 일반 모드: DELETE API 호출 후 재조회.
        //   - 엔드포인트는 ?id= 쿼리 형태(=[repId] 서브라우트 없음).
        //   - 테스트 유저(데모) 모드면 apiUrl 이 demoUserId 를 부착해 세션 없이 대상 유저 기준 삭제.
        const res = await fetch(
          apiUrl(`/api/weekly-reputations?id=${encodeURIComponent(repId)}`),
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchWeeklyReputations();
        // weekly-cards DTO(스냅샷) 재조회 — DELETE 가 snapshot 재계산을 끝낸 뒤 응답하므로
        // bump 로 카드 그리드(dtoWeeklyReputations)도 동일 DTO 기준으로 즉시 갱신.
        setWeeklyCardsRefreshKey((k) => k + 1);
      }

      // sentReputationsThisWeek 정합성 — 타인 페이지(isOwner=false)에서 내가 보낸 평판 삭제 시
      // 로컬 state에서 제거하여 재작성 가능하도록 (best-effort)
      if (!isOwner && urlUserId && weekId) {
        setSentReputationsThisWeek((prev) => prev.filter((r) => !(r.targetUserId === urlUserId && r.weekCardId === weekId)));
      }

      // view 모달 닫기 — 재정렬은 reputationData useMemo 자동 재계산(작업 4 연계)
      setReputationViewModalOpen(false);
      setSelectedReputationCard(null);
    } catch (err) {
      console.error("평판 삭제 실패:", err);
      await popup.alert("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  // isDirty — 스냅샷 대비 변경 여부
  const isFormDirty = (): boolean => {
    if (!formSnapshot) {
      return reputationEditData.rating !== 0 || reputationEditData.content.trim() !== "" || reputationEditData.keyword !== "";
    }
    return reputationEditData.rating !== formSnapshot.rating || reputationEditData.content !== formSnapshot.content || reputationEditData.keyword !== formSnapshot.keyword;
  };

  // 필수필드 유효성 검사 — 평점>0 + 키워드 1~10자 (UI 힌트 "최대 10자" 와 일치, 최소값 1로 완화) + 내용>0
  const isFormValid = (): boolean => {
    const keywordLen = reputationEditData.keyword.trim().length;
    return reputationEditData.rating > 0 && keywordLen >= 1 && keywordLen <= 10 && reputationEditData.content.trim().length > 0;
  };

  // 작업 3: 같은 주차 + 같은 대상에게 이미 보냈는지 체크 (best-effort, 로컬 state 기반)
  const checkAlreadySent = (targetUserId: string, weekCardId: string): boolean => {
    return sentReputationsThisWeek.some((r) => r.targetUserId === targetUserId && r.weekCardId === weekCardId);
  };

  // 작업 3: 해당 주차에 내가 보낸 평판 수 (최대 7명 제한 체크용)
  const getSentCountThisWeek = (weekCardId: string): number => {
    return sentReputationsThisWeek.filter((r) => r.weekCardId === weekCardId).length;
  };

  // 저장 — 작업 2+3: 검증 → 중복/제한 체크 → 저장 → view 갱신/재조회 → 편집 경로면 view 복귀
  const handleFormSave = async () => {
    // 모달 진입과 동일 게이트 — 어드민 부여 권한(week_id) OR 기본 시간창. 모달은 열렸는데
    // 저장에서만 막히는 불일치를 방지하기 위해 클릭/저장이 같은 함수를 본다.
    if (!(await requireWeeklyReputationWriteAccess())) return;
    // 1. 필수필드 검증
    if (!isFormValid()) {
      setSaveAttemptFailed(true);
      setFieldErrorFlash(true);
      setTimeout(() => setFieldErrorFlash(false), 600);
      return;
    }
    setSaveAttemptFailed(false);

    // 수정 모드 — 기존 평판 PUT (어드민 전체 / 일반 유저는 본인 작성분)
    if (editingWeeklyReputationId) {
      if (!(await popup.confirm("저장하시겠습니까?"))) return;
      setReputationSaving(true);
      try {
        const res = await fetch(apiUrl("/api/weekly-reputations"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingWeeklyReputationId,
            rating: reputationEditData.rating,
            content: reputationEditData.content.trim(),
            keyword: reputationEditData.keyword,
          }),
        });
        await readJsonSafe(res);
        await fetchWeeklyReputations();
        if (selectedReputationCard) {
          setSelectedReputationCard({
            ...selectedReputationCard,
            rating: reputationEditData.rating / 2,
            ratingCount: `${reputationEditData.rating} / 10`,
            description: reputationEditData.content,
            tagText: `#${reputationEditData.keyword}`,
          });
        }
        await popup.alert("수정되었습니다.");
        setHeaderModalOpen(false);
        setReputationEditData({ rating: 0, content: "", keyword: "" });
        setEditingWeeklyReputationId(null);
        if (selectedReputationCard) setReputationViewModalOpen(true);
      } catch (error) {
        console.error("주차 평판 수정 오류:", error);
        await popup.alert(apiErrorMessage(error));
      } finally {
        setReputationSaving(false);
      }
      return;
    }

    // 편집 진입 경로 여부 — view에서 [수정] 클릭 시 selectedReputationCard 유지됨, 신규 진입 시 null
    const wasEditEntry = !!selectedReputationCard;

    // 2. 작업 3: 신규 작성 경로에서만 중복/7명 제한 체크 (편집은 기존 수정이므로 skip)
    if (!wasEditEntry) {
      // 데모 모드는 URL(userId/weekId) 가드 스킵 — UI 테스트 시 자기 프로필 보기 등에서 신규 저장 가능하도록
      if (!isDemoMode) {
        const targetUid = urlUserId || "";
        const wkId = weekId || "";
        if (!targetUid || !wkId) {
          await popup.alert("대상 사용자 또는 주차 정보를 찾을 수 없습니다.");
          return;
        }
        // 2-a. 중복 체크 — 같은 대상에게 이미 보냈는지
        if (checkAlreadySent(targetUid, wkId)) {
          await popup.alert("해당 크루에게 이미 평판을 드렸습니다.");
          return;
        }
        // 2-b. 최대 7명 체크
        if (getSentCountThisWeek(wkId) >= 7) {
          await popup.alert("한 주에 최대 7명까지만 평판을 보낼 수 있습니다.");
          return;
        }
      }
    }

    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;

    // 3. 저장
    const saved = await saveWeeklyReputation();
    if (!saved) return; // 저장 실패 — 폼 유지

    // 4. 작업 3: 신규 작성 성공 시 로컬 sentReputationsThisWeek에 append (다음 중복 체크 대비)
    if (!wasEditEntry) {
      const targetUid = urlUserId || "";
      const wkId = weekId || "";
      setSentReputationsThisWeek((prev) => [
        ...prev,
        {
          targetUserId: targetUid,
          weekCardId: wkId,
          createdAt: saved.created_at,
        },
      ]);
    }

    // 5. 편집 진입 경로에서만 view 데이터 즉시 갱신 (낙관적 업데이트)
    if (wasEditEntry && selectedReputationCard) {
      setSelectedReputationCard({
        ...selectedReputationCard,
        rating: reputationEditData.rating / 2, // 10점 만점 → 5점 만점 역변환 (별 표시용)
        ratingCount: `${reputationEditData.rating} / 10`,
        description: reputationEditData.content,
        tagText: `#${reputationEditData.keyword}`,
        createdAt: saved.created_at || selectedReputationCard.createdAt,
      });
    }

    // 6. 일반 모드: DB 재조회로 reputation-section 최신화 (데모는 saveWeeklyReputation에서 이미 로컬 append)
    if (!isDemoMode) {
      await fetchWeeklyReputations();
      // weekly-cards DTO(스냅샷) 재조회 — 저장 API 가 snapshot 재계산을 끝낸 뒤 응답하므로
      // bump 로 카드 그리드(dtoWeeklyReputations)도 동일 DTO 기준으로 즉시 갱신.
      setWeeklyCardsRefreshKey((k) => k + 1);
    }

    // 7. 스냅샷 업데이트 — 저장 직후 isDirty false 보장
    setFormSnapshot({
      rating: reputationEditData.rating,
      content: reputationEditData.content,
      keyword: reputationEditData.keyword,
    });

    await popup.alert("저장되었습니다.");
    setHeaderModalOpen(false);

    if (wasEditEntry) {
      // 편집 진입 경로: 갱신된 데이터로 view 모달 재오픈 (사용자가 결과 확인)
      setReputationViewModalOpen(true);
    } else {
      // 신규 작성 경로: 폼 데이터 리셋
      setReputationEditData({ rating: 0, content: "", keyword: "" });
    }
  };

  // 주차 평판 저장 함수 — 결과 반환 형태로 리팩토링 (post-save 처리는 handleFormSave에서)
  // 성공 시 { id, created_at } 반환, 실패 시 null. 모달/폼 상태 변경은 호출부에서 담당.
  const saveWeeklyReputation = async (): Promise<{ id: string; created_at: string } | null> => {
    if (isDemoMode) {
      const now = new Date().toISOString();
      const demoId = `demo-${Date.now()}`;
      const newRecord = {
        id: demoId,
        rating: reputationEditData.rating,
        content: reputationEditData.content.trim(),
        keyword: reputationEditData.keyword,
        created_at: now,
        reviewer: {
          display_name: session?.user?.name || "데모 유저",
          gender: "-",
          birth_date: null,
          profile_photo_url: session?.user?.image || "",
          university: "-",
          major_first: "-",
          teamName: "-",
          partName: "-",
          vision: "-",
          role: "",
        },
      };
      setWeeklyReputations((prev) => [...prev, newRecord]);
      return { id: demoId, created_at: now };
    }

    if (!urlUserId || !weekId) {
      await popup.alert("대상 사용자 또는 주차 정보를 찾을 수 없습니다.");
      return null;
    }

    setReputationSaving(true);
    setReputationSaveError(null);
    setReputationSaveSuccess(false);

    try {
      const res = await fetch(apiUrl("/api/weekly-reputations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: urlUserId,
          weekCardId: weekId,
          rating: reputationEditData.rating,
          content: reputationEditData.content.trim(),
          keyword: reputationEditData.keyword,
        }),
      });

      const json = (await readJsonSafe(res)) as { data?: { id?: string; created_at?: string } } | null;
      setReputationSaveSuccess(true);
      return {
        id: json?.data?.id || "",
        created_at: json?.data?.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error("주차 평판 저장 오류:", error);
      setReputationSaveError((error as Error)?.message || "서버 오류");
      await popup.alert(apiErrorMessage(error));
      return null;
    } finally {
      setReputationSaving(false);
    }
  };

  // 서브 타이틀 글자수 관리
  const [subTitleText, setSubTitleText] = useState("");

  // 기본값 설정
  const restImage = "/images/0/cluster4/주차%20이미지/휴식(개인,공식).png";

  // ── 상태배지·휴식 판정 공용 헬퍼 (헤더 배지와 본문 4파트 단일 출처) ──
  // 카드 목록(weekly-card-status-badge)과 "동일 규칙": statusTone→톤, statusLabel(라벨) 우선→className.
  // (휴식 판정 isRestMode 와 헤더 배지 양쪽에서 쓰므로 이 위치에서 1회 정의한다.)
  const cardStatusToneClass = (tone: unknown): string => {
    switch (String(tone ?? "").toLowerCase()) {
      case "success": return "success";
      case "fail": return "fail";
      case "progress": return "in-progress";
      case "rest": return "rest";
      case "counting": return "counting";
      default: return "";
    }
  };
  const cardBadgeClassFromLabel = (label: string, fallback: string): string => {
    if (label.includes("실패")) return "fail";
    if (label.includes("성공")) return "success";
    if (label.includes("진행")) return "in-progress";
    if (label.includes("집계")) return "counting";
    if (label.includes("개인")) return "rest-personal";
    if (label.includes("공식")) return "rest-official";
    return fallback || "";
  };
  // weeklyCardMeta 에서 시즌(봄/여름/가을/겨울) 추출 — 전환 주차 판정용.
  const metaSeasonRaw = (() => {
    const card = weeklyCardMeta as Record<string, unknown> | null;
    if (!card) return null;
    if (typeof card.seasonName === "string" && (card.seasonName as string).trim()) return card.seasonName as string;
    const label = `${weeklyCardMeta?.displayTitle ?? ""} ${weeklyCardMeta?.weekLabel ?? ""}`;
    const m = label.match(/(봄|여름|가을|겨울)/);
    return m ? m[1] : null;
  })();
  // 전환 주차는 어드민 DTO 가 '휴식(공식)'으로 와도 휴식으로 보지 않는다.
  //   판정 SoT = isTransitionWeekDto (DTO isTransition 플래그 우선 + DB raw 0주차 / admin 17·9주차).
  const metaIsTransitionRest = !!weeklyCardMeta
    && cardBadgeClassFromLabel(weeklyCardMeta.statusLabel ?? "", cardStatusToneClass(weeklyCardMeta.statusTone)) === "rest-official"
    && isTransitionWeekDto(weeklyCardMeta as unknown as Record<string, unknown>, metaSeasonRaw, typeof weeklyCardMeta.weekNumber === "number" ? weeklyCardMeta.weekNumber : null);

  // ── 휴식 모드 체크 — 휴식(공식) SoT = 로컬 weeks.is_official_rest 최우선 (정책 개정 2026-06-03) ──
  // weekData.isOfficialRest = isOfficialRestWeek(...) 결과(전환 주차 제외 + weeks.is_official_rest 반영).
  // 충돌 시 official_rest 우선: admin DTO statusLabel 이 '성장(성공)' 등으로 와도 로컬이 휴식이면 휴식으로 본다.
  // admin DTO statusLabel 은 진행/성공/실패 등 "상태(헤더)" 표시용으로만 쓰고, 휴식 여부 판정에는 쓰지 않는다.
  // 전환 주차는 weekData.isOfficialRest=false(isOfficialRestWeek 가 제외) → 휴식 아님.
  // 본문 4파트(정보/경험/역량/경력)는 isRestMode 일 때 기본 not_applicable, 단 그 주차 귀속 라인이 있으면
  // 본문(라인 내용)만 예외적으로 노출(상태는 여전히 not_applicable) — 기존 effective*/matchedAbilityCard 로직 유지.
  const isOfficialRestLocal = !!weekData?.isOfficialRest;
  // 공통 weekly-cards DTO 가 '휴식(개인)'으로 판정하면 본문도 반드시 휴식 모드로 둔다.
  //   헤더 배지는 DTO(weeklyCardMeta.statusLabel)에서, 본문 휴식여부는 로컬(weekData.isPersonalRest,
  //   승인 vacation_requests 파생)에서 오는 이중 소스라 이론상 desync 가능(공식 휴식만 헤더 보정이
  //   있고 개인 휴식엔 없었음). DTO 판정을 additive(OR)로 신뢰해 본문이 항상 공통 판정과 일치하게
  //   한다 — 개인 휴식은 주차단위 override 우려가 없어(공식 휴식과 달리) DTO 신뢰가 안전하고,
  //   OR 결합이라 휴식 모드를 끄는 방향으로는 절대 작용하지 않는다. label 규약은 badge helper와 동일.
  const metaSaysPersonalRest = (weeklyCardMeta?.statusLabel ?? "").includes("개인");
  const isRestMode = !!(weekData?.isPersonalRest || isOfficialRestLocal || metaSaysPersonalRest);

  // 시즌명과 주차번호로 월/주차 계산하여 이미지 경로 생성
  // primary 는 holiday_name 접미사를 포함한 1차 경로, stripped 는 holiday 없는 폴백.
  // (holiday_name 에 '시험 기간' 같이 디스크 파일에 없는 값이 들어와도 stripped 로 자동 복구)
  const getWeekImagePath = (data: DBWeekData): { primary: string; stripped: string } => {
    const seasonStartMonth: { [key: string]: number } = {
      겨울: 1,
      봄: 3,
      여름: 7,
      가을: 9,
    };

    const startMonth = seasonStartMonth[data.seasonName] || 1;
    const monthOffset = Math.floor((data.weekNumber - 1) / 4);
    const month = startMonth + monthOffset;
    const weekOfMonth = ((data.weekNumber - 1) % 4) + 1;

    const holidaySuffix = data.holidayName ? ` ${data.holidayName}` : "";
    const base = `/images/0/cluster4/주차 이미지/${data.seasonName} ${data.weekNumber}주차 (${month}월 ${weekOfMonth}주차`;
    return {
      primary: `${base}${holidaySuffix}).png`,
      stripped: `${base}).png`,
    };
  };

  // 휴식 모드일 때는 휴식 전용 이미지 사용, 아닐 때는 시즌/주차에 맞는 이미지
  const computedWeekPaths = weekData ? getWeekImagePath(weekData) : null;
  const currentImage = isRestMode ? restImage : computedWeekPaths ? computedWeekPaths.primary : "/images/0/cluster4/주차 이미지/겨울 1주차 (1월 1주차).png";
  const currentImageStripped = !isRestMode && computedWeekPaths && computedWeekPaths.stripped !== computedWeekPaths.primary ? computedWeekPaths.stripped : null;
  const currentTitle = weekData ? (weekData.isBreakSeason ? `${formatSeasonLabel({ seasonLabel: weekData.seasonLabel, seasonName: weekData.toSeasonName || weekData.seasonName, seasonType: weekData.seasonType, year: weekData.seasonYear })}, 전환 주차` : formatSeasonWeekTitle({ seasonLabel: weekData.seasonLabel, seasonName: weekData.seasonName, seasonType: weekData.seasonType, year: weekData.seasonYear, weekNumber: weekData.weekNumber })) : "로딩 중...";

  // 날짜 포맷팅 함수 (2025 - 01 - 06 (월) 형식)
  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[date.getDay()];
    return `${year} - ${month} - ${day} (${dayName})`;
  };

  // 주차 기간 문자열 생성
  const weekDateRange = weekData ? `${formatDateWithDay(weekData.startDate)} ~ ${formatDateWithDay(weekData.endDate)}` : "날짜 로딩 중...";

  // 기입(작성 가능) 기간 표기는 고객 앱에 노출하지 않는다(어드민 UI 전용).
  // 작성 가능 여부 제어는 기존 canEdit·작성기간 검증 로직을 그대로 따르며, 고객 앱은
  // 시즌/주차/주차 기간(weekDateRange)만 표시한다.

  // 상태 배지는 어드민 weekly-cards DTO(weeklyCardMeta.statusLabel/statusTone)만을 단일 출처로 쓴다.
  // 과거의 getStatusBadgeInfo(날짜 기반 growthStatus → 라벨/색) 로컬 계산은 제거됨:
  // DTO 가 없을 때는 날짜로 상태를 추정하지 않고 중립 placeholder 로 표시한다(아래 headerStatus* 참조).

  // ── section1-header 단일 출처: 어드민 weekly-cards DTO(weeklyCardMeta) 우선, 없으면 중립 placeholder ──
  // 백엔드 미수정 — 이미 fetch 중인 /api/cluster4/weekly-cards 의 matchedCard(AdminCluster4WeeklyCardDto) 재사용.
  // 값이 null/undefined 면 로컬 계산값으로 폴백하고, 표시 단계에서 "-"/0 으로 안전 처리.

  // 제목: 주차 카드 목록(Cluster41Content.parseWeekTitle)과 "동일 규칙"으로 weeklyCardMeta 에서 파싱.
  //   카드 목록 표기 = "{year}년, {season} 시즌, {weekText}주차"(전환 주차면 "{weekText} 주차").
  //   기존(raw displayTitle 직출력)은 카드 목록과 표기 체계가 달라 같은 주차인데 제목 문자열이 어긋났다.
  //   → weeklyCardMeta(= 카드 목록과 동일 DTO 객체)에 같은 파서를 적용해 표기를 통일한다.
  const headerTitle = (() => {
    if (!weeklyCardMeta) return currentTitle;
    const card = weeklyCardMeta as Record<string, unknown>;
    const label = `${weeklyCardMeta.displayTitle ?? ""} ${weeklyCardMeta.weekLabel ?? ""}`;
    let year: number | null = null;
    if (typeof card.seasonYear === "number") year = card.seasonYear as number;
    else if (typeof card.year === "number") year = card.year as number;
    else {
      const m = label.match(/(\d{4})\s*(?:년|년도)?/);
      if (m) year = parseInt(m[1], 10);
      else if (typeof weeklyCardMeta.startDate === "string" && /^\d{4}/.test(weeklyCardMeta.startDate)) year = parseInt(weeklyCardMeta.startDate.slice(0, 4), 10);
    }
    let season = "";
    if (typeof card.seasonName === "string" && (card.seasonName as string).trim()) season = card.seasonName as string;
    else { const m = label.match(/(봄|여름|가을|겨울)/); if (m) season = m[1]; }
    // 전환 주차 판정: DTO 플래그(isTransition/isBreakSeason/isRestSeason)/라벨 + 공용 번호 SoT.
    const isBreak =
      card.isBreakSeason === true ||
      card.isRestSeason === true ||
      /전환|break/i.test(label) ||
      isTransitionWeekDto(card, season, typeof weeklyCardMeta.weekNumber === "number" ? weeklyCardMeta.weekNumber : null);
    // 시즌 내 주차만 표시 — 카드 목록(Cluster41Content.parseWeekTitle)과 동일한 공용
    // resolveSeasonWeekText 사용: seasonWeek/weekInSeason 우선, 시즌 범위(봄/가을 1~16,
    // 여름/겨울 1~8) 밖 누적 주차 값은 다음 출처로 폴백.
    const weekText = isBreak
      ? "전환"
      : resolveSeasonWeekText({ card, weekNumber: weeklyCardMeta.weekNumber, label, seasonName: season });
    return `${year ?? "-"}년, ${season || "-"} 시즌, ${weekText}${isBreak ? " 주차" : "주차"}`;
  })();

  // 상태 배지: 주차 카드 목록(weekly-card-status-badge)과 "동일 source/규칙".
  //   - 텍스트  = statusLabel (카드 목록과 동일 필드).
  //   - className(톤) = badgeClassFromLabel(statusLabel, statusToneClass(statusTone)) — 카드 목록과 "동일 규칙".
  //       기존(statusIconKey>statusTone 직매핑)은 카드 목록의 label-우선 분기와 달라 rest-personal/official 등에서
  //       톤이 갈릴 수 있었다. 카드 목록과 같은 함수 규칙으로 통일한다.
  //   - 아이콘 = 위 className → ASCII 정적자산 맵. 카드 목록(statusIconPath)은 한글 경로라 일부 환경에서 404 가
  //       나므로, "동일 상태 → 동일 아이콘"을 유지하되 경로만 ASCII 로 통일(404 면역)한다.
  // cardStatusToneClass / cardBadgeClassFromLabel / metaSeasonRaw / metaIsTransitionRest 는
  // 휴식 판정(isRestMode)과 공유하기 위해 위쪽(휴식 모드 체크 직전)에서 1회 정의한다.
  // 상태 텍스트/톤 = DTO statusLabel/statusTone 단일 출처. DTO 가 없으면 날짜로 추정하지 않고
  // 중립 placeholder("상태 확인 중", .is-pending)로 표시한다('집계 중' 등 실제 상태처럼 보이는 문구 금지).
  const NEUTRAL_STATUS_TEXT = "상태 확인 중";
  // 헤더 우선순위(정책 개정 2026-06-03): ① 전환 주차 → ② 로컬 공식 휴식 보정 → ③ DTO statusLabel → ④ 중립.
  // ②: 로컬 weeks.is_official_rest(=isOfficialRestLocal)가 true 면 admin DTO statusLabel 이 '성장(성공)' 등으로
  //    와도 헤더를 '휴식(공식)'으로 보정한다(본문 isRestMode 와 충돌 방지 — official_rest 우선 정책).
  const headerStatusText = metaIsTransitionRest
    ? TRANSITION_WEEK_LABEL
    : isOfficialRestLocal
    ? "휴식(공식)"
    : (weeklyCardMeta?.statusLabel ?? NEUTRAL_STATUS_TEXT);
  const headerStatusClass = metaIsTransitionRest
    ? ""
    : isOfficialRestLocal
    ? "rest-official"
    : weeklyCardMeta
    ? cardBadgeClassFromLabel(weeklyCardMeta.statusLabel ?? "", cardStatusToneClass(weeklyCardMeta.statusTone))
    : "is-pending";
  // className → ASCII 아이콘 (카드 목록 statusIconPath 의 시각적 대응; 경로만 ASCII 로 통일해 404 면역).
  const STATUS_CLASS_ICON_URL: Record<string, string> = {
    "in-progress": "/images/0/cluster4/icon/icon-growth-running.png",
    counting: "/images/0/cluster4/icon/icon-growth-tallying.png",
    success: "/images/0/cluster4/icon/icon-growth-success.png",
    fail: "/images/0/cluster4/icon/icon-growth-fail.png",
    "rest-personal": "/images/0/cluster4/icon/icon-rest-personal.png",
    "rest-official": "/images/0/cluster4/icon/icon-rest-official.png",
  };
  // className 매칭 아이콘이 없으면(중립 is-pending / 전환 "") 빈 문자열 → 아이콘 미표시(아래 markup 에서 가드).
  // 로컬 공식 휴식 보정(rest-official)은 DTO 미수신이어도 휴식 아이콘을 노출해야 하므로 weeklyCardMeta 게이트 제거.
  const headerStatusIcon = STATUS_CLASS_ICON_URL[headerStatusClass] ?? "";

  // 날짜 배지
  const headerStartDate = weeklyCardMeta?.startDate ?? weekData?.startDate ?? null;
  const headerEndDate = weeklyCardMeta?.endDate ?? weekData?.endDate ?? null;

  // 역할 배지: 주차 카드 목록(membership)과 동일 규칙 = roleLabel || membershipStatusLabel || "-".
  //   기존(roleLabel 만, ?? 로 폴백)은 roleLabel 이 빈 문자열("")이면 membershipStatusLabel 로 못 넘어가
  //   카드 목록과 어긋났다. 카드 목록처럼 truthy 검사 + membershipStatusLabel 폴백을 둔다.
  //   ⚠ 표시 어휘는 반드시 lib/crewClassDisplayLabel 를 경유한다 — 어드민 weekly-cards 스냅샷은
  //     과거에 baking 된 "일반"(내부 어휘)을 그대로 들고 있을 수 있어(2026-07-22 실측: 같은 유저의
  //     주차별 roleLabel 이 "정규"/"일반" 혼재) 소비 측이 마지막 게이트가 되어야 한다.
  const headerRoleLabel = weeklyCardMeta
    ? (toCrewClassDisplayLabel(weeklyCardMeta.roleLabel) ??
       toCrewClassDisplayLabel(weeklyCardMeta.membershipStatusLabel) ??
       "-")
    : formatCrewClassDisplayLabel(roleLabel, "-");

  // 팀/파트
  const headerTeamName = weeklyCardMeta?.teamName ?? teamName;
  const headerPartName = weeklyCardMeta?.partName ?? partName;

  // ── 페이지 주인(본인) 인적사항 — 모든 모달 인적사항 카드의 단일 출처 ──
  // reviewerProfile(/api/profile + /api/educations) + 팀/파트/멤버십 state + weeklyCardMeta 를
  // 한 source bag 으로 모아 resolvePersonalInfo 로 통일 해석. 데모 모드는 고정 placeholder.
  // (role 배지는 spec 10필드 밖이라 기존 roleLabel 을 그대로 둠.)
  const ownerPersonalInfo: ResolvedPersonalInfo = useMemo(() => {
    if (isDemoMode) {
      return {
        name: "홍길동",
        gender: "남",
        age: 22,
        school: "서울대",
        department: "경영",
        team: "마케팅",
        part: "바이럴",
        membershipLevel: "심화(에이전트)",
        profileImageUrl: null,
        tagline: "엔비디아 구글 테슬라",
      };
    }
    return resolvePersonalInfo({
      profile: {
        name: reviewerProfile.displayName,
        gender: reviewerProfile.gender,
        age: reviewerProfile.age,
        school: reviewerProfile.school,
        department: reviewerProfile.major,
        team: teamName,
        part: partName,
        membershipLevel,
        profileImageUrl: reviewerProfile.profilePhotoUrl,
        profileTagline: reviewerProfile.tagline,
        vision: reviewerProfile.vision,
      },
      // 타 크루 카드 열람(urlUserId 가 viewer 본인이 아님) 시에는 session(=viewer) 을 인적사항
      // 폴백으로 쓰지 않는다. 쓰면 페이지 주인 프로필(reviewerProfile)이 도착하기 전에 viewer
      // 이름(예: 어드민/테스트 계정)이 모달에 잠깐 노출된다. 본인 카드(urlUserId 없음 또는
      // == viewer)일 때만 session 폴백을 사용한다(본인=정확한 데이터, 즉시 표시 OK). 타 크루
      // 카드는 reviewerProfile 도착 전까지 빈 값("—")으로 둔다.
      user: sessionIsPageOwner ? (session?.user ?? null) : null,
      weeklyCardMeta,
    });
  }, [isDemoMode, reviewerProfile, teamName, partName, membershipLevel, sessionIsPageOwner, session?.user, weeklyCardMeta]);

  // 인적사항(이름/성별/나이/학교/학과) 준비 여부 — 비로그인/타크루 카드는 reviewerProfile(/api/profile)
  // 도착 전까지 ownerPersonalInfo.name 이 null 이라 모달이 '-'/'—' 를 오래 노출한다. 준비 전에는
  // 값 대신 Skeleton 을 보여주고(아래 모달들), 도착 후 마스킹값/원문을 렌더한다. 데모는 즉시 ready.
  const ownerInfoReady = isDemoMode || ownerPersonalInfo.name != null;

  // 페이지 주인 역할 배지(tag-role) 단일 출처.
  //   우선순위: 명시 role(roleLabel: user_role_history/profile.role) → 멤버십 등급
  //   (ownerPersonalInfo.membershipLevel = user_memberships.membership_level) → 최종 "정규".
  //   이관 실사용자는 role 이 NULL 이라 roleLabel 이 비어 "—" 로 떨어지던 문제를, 등급(전원 보유)으로
  //   폴백해 메운다. badge 등급 SoT = membership_level 정책(연계동료/평판 카드와 동일)과 일치.
  //   빈 문자열·"-"·"—" 는 무효로 보고 다음 후보로 넘어간다(placeholder 노출 방지).
  const ownerRoleBadge = useMemo(() => {
    if (isDemoMode) return CREW_CLASS_AMBASSADOR;
    // 카드(시즌) 기준 단계 우선 — weeklyCardMeta.roleLabel 은 백엔드 snapshot SoT
    //   (user_position_histories, 이력서 resume-activities 와 동일 SoT). 그 카드 시즌 "당시 단계"를
    //   담으므로 현재 role/membership(roleLabel·membershipLevel)보다 우선해야 과거 주차 카드가
    //   현재 단계로 덮이지 않는다. 헤더 배지(headerRoleLabel)와 동일 source.
    // 각 후보는 표시 어휘(lib/crewClassDisplayLabel)로 정규화한 뒤 첫 유효값을 고른다.
    const candidates = [
      weeklyCardMeta?.roleLabel,
      roleLabel,
      ownerPersonalInfo.membershipLevel,
    ];
    for (const c of candidates) {
      const s = toCrewClassDisplayLabel(c);
      if (s) return s;
    }
    return CREW_CLASS_REGULAR;
  }, [isDemoMode, weeklyCardMeta, roleLabel, ownerPersonalInfo.membershipLevel]);

  // 팀/파트 특수 표기(운영진·온보딩·팀장(managedTeam)) 분기 입력값: 어드민 DTO 우선, null/undefined 면 로컬 상태 fallback.
  const headerIsOnboarding = weeklyCardMeta?.isOnboarding ?? isOnboardingWeek;
  const headerGeneration = weeklyCardMeta?.generation ?? generation;
  const headerManagedTeamName = weeklyCardMeta?.managedTeamName ?? managedTeamName;

  // 현재/전체 주차: 주차 카드 목록과 "동일 계산식"으로 통일.
  //   카드 목록(Cluster41Content): 분자 = numberField(week,["approvedWeeks","currentCumulative","cumulative","accumulatedApprovedWeeks"]),
  //                               분모 = numberField(week,["totalWeeks","totalWeekCount","totalRequiredWeeks","baseWeekCount"], org정책값),
  //                               진행/집계 주차(badgeToneClass∈{in-progress,counting})면 분자 표기를 "+1" 로.
  //   기존 header 는 (1) displayWeekProgressLabel 우선, (2) 분모 = totalRequiredWeeks??baseWeekCount,
  //   (3) +1 판정 = weekData.growthStatus 라 카드 목록과 계산식이 모두 달랐다(보고 #5 참조).
  //   → 카드 목록과 동일한 키 우선순위/판정으로 맞춘다. displayWeekProgressLabel 우선은 제거(카드 목록은 미사용).
  const headerNumberField = (keys: string[], fallback = 0): number => {
    const rec = (weeklyCardMeta ?? {}) as Record<string, unknown>;
    for (const key of keys) {
      const v = rec[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    }
    return fallback;
  };
  // 분모: 카드 목록과 동일하게 totalWeeks/totalWeekCount → totalRequiredWeeks/baseWeekCount 순으로 읽고,
  //   모두 없을 때만 org 정책값으로 폴백(marketing 25 / encre·phalanx 30). 25 는 조직별 정책값이지 버그가
  //   아니므로 하드코딩하지 않고 getGraduationWeeksFromPathname 으로 org 기준 폴백한다(카드 목록과 동일 규칙).
  const headerWeekTotal = weeklyCardMeta
    ? headerNumberField(["totalWeeks", "totalWeekCount", "totalRequiredWeeks", "baseWeekCount"], getGraduationWeeksFromPathname(pathname))
    : getGraduationWeeksFromPathname(pathname);
  // 분자: 카드 목록과 동일 키 우선순위(앞 3키는 contract 미정의 → 보통 accumulatedApprovedWeeks 로 귀결).
  const headerWeekApproved = weeklyCardMeta
    ? headerNumberField(["approvedWeeks", "currentCumulative", "cumulative", "accumulatedApprovedWeeks"], cumulativeApprovedWeeks)
    : cumulativeApprovedWeeks;
  // 진행/집계 주차 판정: 카드 목록과 동일하게 status className(badgeToneClass) 기준으로 +1 표기.
  const isCountingWeek = headerStatusClass === "in-progress" || headerStatusClass === "counting";
  // 기존 .highlight DOM 구조 유지를 위해 강조 토큰과 접미사로 분리.
  const headerWeekHighlight: string | number = isCountingWeek ? "+1" : headerWeekApproved;
  const headerWeekSuffix = ` / ${headerWeekTotal} 주차`;

  // 단감/인절미/어흥: 주차 카드 목록과 "동일 source/규칙" — 모두 "해당 주차(per-week)" 값.
  //   카드 목록(Cluster41Content): 단감 = points.star, 인절미 = points.shield, 어흥 = points.lightning.
  //   한 카드 안에서 세 포인트의 기준(per-week)을 통일한다. 누적(cumulativeInjeolmi=Σadvantages)은
  //   '누적 방패'가 아니며 주차 칸에 쓰지 않는다(과거 보고 #7 의 누적 표기를 되돌림). 누적 방패가
  //   필요한 자리는 별도 영역에서 net(Σshield-Σlightning) 기준으로만 표기.
  // 포인트 표시 정책(2026-07 통일): 단감(A)=check · 인절미(B)=net(adv−pen) · 어흥(C)=양수 magnitude(빨강).
  //   DTO(points.*)는 서버 표시 최종값 — 그대로 렌더(C 는 pointC 양수 우선, 레거시 lightning(−n) 은 -부호로 복원).
  //   legacy fallback(weekPoints — raw point_type 합산)도 동일 정책으로 변환(방패=raw−penalty(net), C=Math.abs(penalty)).
  const headerCardPoints = weeklyCardMeta?.points ?? null;
  const headerDangam = headerCardPoints?.star ?? weekPoints.star ?? 0;
  const headerInjeolmi =
    typeof headerCardPoints?.shield === "number" && Number.isFinite(headerCardPoints.shield)
      ? headerCardPoints.shield
      : (typeof weekPoints.shield === "number" && Number.isFinite(weekPoints.shield)
          ? weekPoints.shield - Math.abs(weekPoints.lightning || 0)
          : 0);
  // 어흥(Point C) = 패널티 양수 magnitude(부호없음, 빨강). pointC 우선 → 레거시 lightning(−n) 은 부호 반전.
  const headerEoheung = headerCardPoints
    ? (typeof headerCardPoints.pointC === "number" && Number.isFinite(headerCardPoints.pointC)
        ? headerCardPoints.pointC
        : typeof headerCardPoints.lightning === "number" && Number.isFinite(headerCardPoints.lightning)
          ? -headerCardPoints.lightning
          : 0)
    : Math.abs(weekPoints.lightning || 0);

  // ── Detail Log 모달 데이터 (단일 출처 — header* 계산값 재사용, 순수 표시) ──
  // 누적 성공 주차: DTO accumulatedApprovedWeeks 우선, 없으면 로컬 state.
  const detailLogCumulativeWeeks =
    (weeklyCardMeta as { accumulatedApprovedWeeks?: number | null } | null)?.accumulatedApprovedWeeks ??
    cumulativeApprovedWeeks ??
    0;
  // status-badge 토큰과 동일 클래스. 중립 placeholder(is-pending 등)는 in-progress 톤으로 폴백.
  const detailLogStatusClass = (() => {
    const c = headerStatusClass || "";
    if (c.includes("success") || c.includes("fail") || c.startsWith("rest")) return c;
    return "in-progress";
  })();
  // dl-alert 결과 메시지: 백엔드 DTO detailLogMessageMeta(v29) 단일 출처로 4분기.
  //   프론트에서 cards 배열을 훑어 지난 주/연속 주차를 계산하지 않는다. 메타가 없을 때만 기존 문구로 fallback.
  //   demoUserId/일반 사용자 모두 동일 DTO(weeklyCardMeta)를 소비하므로 경로 분기 없이 동작한다.
  const detailLogMessageMeta =
    (weeklyCardMeta as
      | (AdminCluster4WeeklyCardDto & {
          detailLogMessageMeta?: {
            previousWeekStatus?: "success" | "fail" | "none" | "rest";
            currentWeekStatus?: "success" | "fail";
            successStreakWeeks?: number;
          } | null;
        })
      | null)?.detailLogMessageMeta ?? null;
  const detailLogResultMessage = (() => {
    // 신규 성공: 이번 주 성공 + 지난 주 비성공(또는 streak 비정상 시 fallback 표시)
    const NEW_SUCCESS =
      "이번 주, <성장 성공> 달성하셨어요! 열심히 달려온 당신께 찬사를!!";
    // 성공 후 실패
    const SUCCESS_THEN_FAIL =
      "앗..! 지난 주에 성장 성공하셨는데, 이번 주에 성장이 실패했다면, 이번 주에는 잠깐 컨디션이 안 좋았을 수 있어요! 다시 가다듬자구요!";
    // 연속 실패 또는 실패 유지
    const FAIL_STREAK =
      "앗, 연속해서 주차 성장을 실패하셨다면.. 혹시 클럽의 규정이나 프로세스를 잘 인지하지 못하고 있을 가능성이 있어요! 지피지기면 백전백승! 한번 살펴보자구요!";

    if (detailLogMessageMeta && detailLogMessageMeta.currentWeekStatus) {
      const { currentWeekStatus, previousWeekStatus, successStreakWeeks } = detailLogMessageMeta;
      if (currentWeekStatus === "success") {
        if (previousWeekStatus === "success") {
          // 연속 성공: {n} = successStreakWeeks(최대 10). 값이 없거나 이상하면 신규 성공으로 fallback.
          const n =
            typeof successStreakWeeks === "number" && Number.isFinite(successStreakWeeks) && successStreakWeeks >= 2
              ? Math.min(successStreakWeeks, 10)
              : null;
          return n === null
            ? NEW_SUCCESS
            : `지난 주에 이어, 이번주도 역시! 성장 흐름이 ${n}주 째 이어지고 있어요!!`;
        }
        // 신규 성공: 이번 주 성공 + 지난 주 비성공
        return NEW_SUCCESS;
      }
      // currentWeekStatus === "fail"
      return previousWeekStatus === "success" ? SUCCESS_THEN_FAIL : FAIL_STREAK;
    }

    // detailLogMessageMeta 미수신 시에만 기존 status 기반 문구로 fallback.
    return detailLogStatusClass.includes("success")
      ? "이번 주 성장 목표를 멋지게 달성하셨어요! 꾸준함이 곧 실력입니다. 다음 주에도 이 페이스 그대로 함께 달려봐요! 🎉"
      : detailLogStatusClass.includes("fail")
        ? "앗, 이번 주 성장 목표에는 조금 못 미쳤어요. 혹시 클럽의 규정이나 프로세스가 아직 익숙하지 않으셨다면, 한번 천천히 살펴보면 다음 주엔 분명 더 수월할 거예요! 지피지기면 백전백승! 💪"
        : "이번 주 성장 결과를 집계하고 있어요. 잠시 후 다시 확인해 주세요!";
  })();
  // ── Detail Log: 조직별 포인트 명칭(Po.A/B/C → 별/단감/투구 …) ──
  // 우선순위: ?org= 쿼리(slug 또는 organization 표기) → pathname org. 항상 oranke/encre/phalanx 로 해석.
  const detailLogOrgSlug: "oranke" | "encre" | "phalanx" =
    (headerOrg === "encre" || headerOrg === "phalanx" || headerOrg === "oranke"
      ? headerOrg
      : headerOrg === "entertainment"
        ? "encre"
        : headerOrg === "planning"
          ? "phalanx"
          : headerOrg === "marketing"
            ? "oranke"
            : null) ?? getOrganizationConfig(getCurrentOrganizationFromPathname(pathname)).orgSlug;
  const DL_ORG_POINT_NAMES: Record<string, [string, string, string]> = {
    encre: ["별", "방패", "번개"],
    oranke: ["단감", "인절미", "어흥"],
    phalanx: ["투구", "방패", "화살"],
  };
  // 조직값을 알 수 없을 때만 Po.A/B/C fallback.
  const detailLogPointNames: [string, string, string] =
    DL_ORG_POINT_NAMES[detailLogOrgSlug] ?? ["Po.A", "Po.B", "Po.C"];
  const detailLogPoaName = detailLogPointNames[0];

  // 실무 경험 오픈 라인 수: 카드 표시(experienceStatsAdmin)와 동일한 단일 출처
  // (어드민 weekly-cards DTO experienceRate{count,total})를 사용한다. '봄 시즌까지 통합 임시 라인을
  // 오픈 라인으로 인정'하는 정책은 백엔드 스냅샷(experienceRate.total)에서 보정되며, 프론트는 그 값을
  // 그대로 소비한다 → 프론트 experienceStats state(activeActivities 기반)는 DTO 미수신 시 폴백으로만 사용.
  const detailLogExpRate =
    (weeklyCardMeta as (AdminCluster4WeeklyCardDto & { experienceRate?: Cluster4RateDto | null }) | null)
      ?.experienceRate ?? null;
  const detailLogExpHasDto =
    !!detailLogExpRate && typeof detailLogExpRate.total === "number" && typeof detailLogExpRate.count === "number";
  const detailLogExpTotal = detailLogExpHasDto ? Number(detailLogExpRate!.total) || 0 : experienceStats.total;
  const detailLogExpSuccess = detailLogExpHasDto ? Number(detailLogExpRate!.count) || 0 : experienceStats.success;
  // 두 성장 조건 충족 여부 — [성장 성공 조건 체크]·[이번 주 도움말 4분기] 공통 단일 출처.
  //   ① 투구(Point.A) 기준 달성 — checkGate 있으면 그 게이트 passed(획득>=기준)로, 없으면 주차 성공으로 판정(아래).
  //   ② [실무 경험] 필수 라인 강화 완료 = 오픈 라인 전부 강화(total>0 && success>=total)
  const detailLogExpAllEnhanced = detailLogExpTotal > 0 && detailLogExpSuccess >= detailLogExpTotal;
  // ── Point.A 기준값/획득량 — 판정과 동일 SoT(어드민 checkGate) 표시 전용 ──
  // 이 카드의 success/fail 을 실제로 결정한 게이트를 그대로 읽는다(프론트 재계산·하드코딩 없음).
  // 기준값은 조직·주차마다 다르다(recognition_count_n: 예 phalanx W2=68 / encre W2=75).
  // 조직/mode=test/actAsTestUserId/demoUserId 무분기 — 모두 같은 DTO 필드를 읽는다.
  const detailLogCheckGate = weeklyCardMeta?.experienceGrowth?.checkGate ?? null;
  // 문구에 기준값을 노출할 수 있는 주차인가:
  //   · enforced=false 또는 required=0 → 그 주차엔 Point.A 기준이 적용되지 않았다(레거시 미이관/N 부재).
  //   · checkGate=null → 게이트가 부착되지 않았다(pending=현재주 미판정 / not_applicable=미오픈·휴식).
  //     ⚠ DTO v45+ 부터 실패 카드(슬롯 fail)에도 checkGate 가 채워진다 — 실패 카드도 기준값을 노출한다.
  //   · 이름 미도착 → "-님" 노출 방지.
  // 위 경우는 기존 문구로 폴백한다. (검증: earned===points.star, required===recognition_count_n.)
  const detailLogShowGate =
    !!detailLogCheckGate &&
    detailLogCheckGate.enforced &&
    detailLogCheckGate.required > 0;
  // 팝업 상단에 노출할 "주차 성장 성공 A 기준 개수" — **주차×조직 단위 단일 값**.
  //   SoT = weekly-cards 프록시가 주입한 card.pointACriterion
  //        (= cluster4_week_opening_configs.recognition_count_n, 위클리 리그 두 화면과 같은 컬럼).
  //   ⚠ checkGate.required 를 쓰지 않는다 — 그건 사용자별 스냅샷이라 같은 주차인데도 스냅샷
  //     재계산 시점에 따라 유저마다 값이 갈린다(2026-07-22 실측: encre 여름 W1 = 81/45 공존).
  //     판정(detailLogPoaMet)은 종전대로 checkGate 로 하고, **표시 숫자만** 이 필드에서 온다.
  //   미확정(설정 없음/org 미상/조회 실패) → null → 팝업이 "0개"가 아니라 "-" 로 표시.
  const detailLogPointACriterion = normalizePointACriterion(
    (weeklyCardMeta as { pointACriterion?: number | null } | null)?.pointACriterion,
  );
  // ① 투구(Point.A) 달성 여부. checkGate 가 있으면 그 게이트 passed(=투구 획득>=기준)로 판정한다 —
  //   주차가 실무경험 슬롯 미달로 실패했어도 투구 자체는 달성했을 수 있으므로, 조건 ①(투구)과 주차
  //   성공을 분리한다(그 경우 ①=✓ 투구 달성, ②=✗ 실무경험). checkGate 부재(레거시/미강제/현재주 등)면
  //   종전대로 주차 성공 여부로 폴백. 주차 판정(success/fail 배지)은 이와 무관하게 불변(표시 전용).
  const detailLogPoaMet = detailLogShowGate
    ? detailLogCheckGate!.passed
    : detailLogStatusClass.includes("success");
  const detailLogConditions: DetailLogCondition[] = [
    {
      checked: detailLogPoaMet,
      // 기준 개수(N)는 **팝업 상단 [주차 성장 성공 A 기준]** 에서만 노출한다 —
      //   여기서 다시 "…기준은 N개였으며" 로 반복하지 않는다(2026-07-22 중복 제거).
      //   획득 수·성공 여부 안내는 그대로 유지하며, 판정(detailLogPoaMet)은 종전 게이트 로직 불변.
      text: detailLogPoaMet
        ? `이번 주 ${detailLogPoaName} ${headerDangam}개를 획득해 성장 성공 기준을 달성하셨어요!`
        : `이번 주 ${detailLogPoaName} ${headerDangam}개를 획득하셨어요. 성장 성공 기준에는 조금 더 필요해요!`,
    },
    {
      checked: detailLogExpAllEnhanced,
      text:
        detailLogExpTotal > 0
          ? `이번 주 [실무 경험] 허브에서 오픈된 라인 ${detailLogExpTotal}개 중 ${detailLogExpSuccess}개를 강화하셨어요!`
          : "이번 주 [실무 경험] 허브에서 오픈된 라인이 없어요.",
    },
  ];
  // 이번 주 도움말 — 성장 결과 badge 가 아니라 위 두 조건(detailLogPoaMet/detailLogExpAllEnhanced) 결과로 4분기.
  const detailLogWeeklyHelp =
    detailLogPoaMet && detailLogExpAllEnhanced
      ? `이번 주 ${detailLogPoaName} 기준을 모두 달성하고, [실무 경험]의 필수 라인들을 모두 강화하셨어요! 주차 성장에 성공한 만큼, 실무 정보, 실무 역량, 실무 경력 허브의 라인들도 놓치지 않으셨겠죠? 너무 멋져요! 😊`
      : !detailLogPoaMet && detailLogExpAllEnhanced
        ? `이번 주 ${detailLogPoaName} 기준을 넘지 못했어요! ${detailLogPoaName}은 클럽 활동에 필수적인 프로세스들을 잘 챙기고, 공지들을 확인하면 아주 쉽게 얻을 수 있으니 놓치지 말아주세요! 😊`
        : detailLogPoaMet && !detailLogExpAllEnhanced
          ? `이번 주 [실무 경험] 허브 라인을 강화하지 못했어요! [실무 경험]의 허브는 클럽 활동에서 크루분이 자신의 포트폴리오를 한 주 한 주 누적해나가는 핵심 활동이기 때문에 놓치면 안된답니다! 😊`
          : `이번 주 ${detailLogPoaName} 기준이 미달되고, [실무 경험] 허브의 라인들도 강화하지 못했어요. 😂 혹시 규정이나 클럽 프로세스에 대한 이해가 부족하시다면, 팀장, 앰배서더 등 운영진 분들에게 도움을 요청해주세요! 알고나면 너무 쉽게 쑥쑥 성장할 수 있답니다! 😊`;
  // Detail Log 기간 표기 — 공통 압축 포맷(YYYY.MM.DD(요일)). header 의 formatDate(YYYY - MM - DD)와 별도.
  const formatDetailLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}.${m}.${day}(${days[d.getDay()]})`;
  };
  // ── Detail Log 액트 내역(actLogs, DTO v30) → 표시용 행 가공 (snapshot-only, 순수 매핑) ──
  // 1차 범위 = "수행/적립된 액트 내역"만(미스/미수행/체크 가능 전체 미구현). actLogs 부재 시 빈 배열 → empty state.
  // 프론트는 임의 row 생성/대상자 재판정/별도 API 호출을 하지 않는다(변동>부분 대상자 필터는 원장 단계에서 이미 적용됨).
  const DL_ACT_HUB_LABEL: Record<string, string> = {
    info: "실무 정보",
    experience: "실무 경험",
    competency: "실무 역량",
    career: "실무 경력",
  };
  // hub 키("info"|"experience"|"competency"|"career"|"info-line"…) → 한글 허브 급. club/비귀속/미상 → "-".
  const dlActHubLabel = (hub: string | null | undefined): string => {
    if (!hub) return "-";
    const base = String(hub).replace(/-line$/, "");
    return DL_ACT_HUB_LABEL[base] ?? "-";
  };
  // 종류 — 정규: required/basic→필수, selection/optional→선별 / 변동: all→전원, partial→부분.
  //   판정 = 공통 SoT `shared/crewActSummary.resolveCrewActKind`(관리자 액트 탭과 동일 · 두 repo 미러링).
  //   ⚠ 여기서 자체 매핑을 다시 만들지 말 것 — kindKey 가 갈라지면 요약의 필수/선별 수가 어긋난다.
  const dlActKind = (
    source: string,
    kind: string | null | undefined,
  ): { label: string; key: DetailLogActRow["kindKey"] } => resolveCrewActKind(source, kind);
  // 발생 시점(=체크 신청 시점) — regular requestedAt 우선, 없으면(변동 등) occurredAt.
  //   테이블 정렬용 압축 포맷 "YYYY.MM.DD HH:mm"(tabular-nums 로 자릿수 정렬).
  const dlActTimeText = (iso: string | null): string => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  // 소요 시간 — 구분=변동이면 "-"(스펙), 정규는 등록 분(0이면 "-").
  const dlActDurationText = (source: string, durationMinutes: number): string =>
    source === "regular" && durationMinutes > 0 ? `${durationMinutes}m` : "-";
  // actLogs 단일 출처 = 백엔드 weekly-cards snapshot(card.actLogs). 없으면 빈 배열 → empty state.
  const sourceActLogs: Cluster4ActLogDto[] = weeklyCardMeta?.actLogs ?? [];
  const detailLogActs: DetailLogActRow[] = sourceActLogs.map((a, i) => {
    const source: "regular" | "irregular" = a.source === "irregular" ? "irregular" : "regular";
    const kind = dlActKind(source, a.kind);
    // 발생 시점 정렬 원천 = 표시 문자열의 원천(requestedAt 우선, 없으면 occurredAt)과 동일 값.
    const occurredAt = a.requestedAt ?? a.occurredAt ?? null;
    // 소요 시간 정렬 원천 = 표시("-" 여부)와 일치 — 변동/0 은 null 로 최하단 처리.
    const durationMinutes = source === "regular" && (a.durationMinutes ?? 0) > 0 ? (a.durationMinutes ?? 0) : null;
    // 허브 정렬 원천 = 라벨 파생과 동일 base 코드("-line" 제거). 미상/club → null → 최하단.
    const hubBase = a.hub ? String(a.hub).replace(/-line$/, "") : null;
    return {
      result: a.result === "checked" ? "checked" : "miss",
      actName: a.actName ?? "",
      occurredText: dlActTimeText(occurredAt),
      hubLabel: dlActHubLabel(a.hub),
      lineLabel: a.lineGroupName && String(a.lineGroupName).trim() ? a.lineGroupName : "-",
      durationText: dlActDurationText(source, a.durationMinutes ?? 0),
      pointA: a.pointA ?? 0,
      pointB: a.pointB ?? 0,
      pointC: a.pointC ?? 0,
      // 획득 가능(available) — 업스트림이 내려주면 그대로, 없으면 undefined → 요약이 pointX(획득=가능)로 폴백.
      availableA: typeof a.availableA === "number" ? a.availableA : undefined,
      availableB: typeof a.availableB === "number" ? a.availableB : undefined,
      availableC: typeof a.availableC === "number" ? a.availableC : undefined,
      source,
      kindLabel: kind.label,
      kindKey: kind.key,
      // 정렬용 원본값(표시 문자열 재파싱 금지) + 결정적 tie-breaker(snapshot 순서 파생 index).
      stableKey: `act:${i}`,
      occurredAt,
      hubToken: hubBase,
      durationMinutes,
    };
  });

  const detailLogData: DetailLogData = {
    seasonWeekTitle: headerTitle || "-",
    periodText:
      headerStartDate && headerEndDate
        ? `${formatDetailLogDate(headerStartDate)} ~ ${formatDetailLogDate(headerEndDate)}`
        : "-",
    // 주차 성장 성공 기준 개수 — 주차×조직 SoT 값. 미확정이면 null("-").
    pointACriterion: detailLogPointACriterion,
    // 기준 문구의 포인트 명칭·아이콘 해석용 org — 위클리 리그 두 화면과 같은 메타를 타게 한다.
    org: detailLogOrgSlug,
    crew: {
      // 비로그인 열람 시 이름 마스킹 — 크루 이름 공통 규칙(useDataMasking.mask.crewName = 마지막 글자만).
      //   로그인/데모(localStorage) 시 원문, 비로그인만 마스킹. ownerPersonalInfo.name 은 raw 라 1회 적용(멱등이라 이중 마스킹 무해).
      name: mask.crewName(ownerPersonalInfo.name),
      team: headerTeamName ? `${headerTeamName} 팀` : "-",
      part: headerPartName ? `${headerPartName} 파트` : "-",
      // 클래스(직책) = 그 카드 "주차 당시" position_code(신규 SoT: weeklyCardMeta.crewClassPositionCode)를
      //   공통 변환기로 라벨화(운영진(팀장)/심화(파트장)/… ). 이 필드가 없는 기존 스냅샷(=null)에서만
      //   과도기로 기존 roleLabel(멤버십 등급) 기반 표기로 폴백한다.
      //   ⚠ roleLabel(등급)을 클래스로 쓰지 않는다 — 팀장이 "정규"로 표시되던 회귀 방지.
      //   ⚠ 폴백도 표시 어휘 SoT 를 경유한다. 종전엔 "등급(역할)" 을 문자열 연결해
      //     "일반(정규)" 같은 금지 어휘 혼합 문구가 나왔다.
      level:
        positionCodeToClassLabel(weeklyCardMeta?.crewClassPositionCode ?? null) ??
        toCrewClassDisplayLabel(ownerPersonalInfo.membershipLevel) ??
        formatCrewClassDisplayLabel(headerRoleLabel, "-"),
    },
    statusText: headerStatusText || "-",
    statusClass: detailLogStatusClass,
    cumulativeWeeks: detailLogCumulativeWeeks,
    resultMessage: detailLogResultMessage,
    // 조직별 명칭 적용(아이콘은 기존 유지). 조직 미상 시 Po.A/B/C.
    points: [
      { label: detailLogPointNames[0], icon: resolveHeaderPoint("단감").icon, value: headerDangam },
      { label: detailLogPointNames[1], icon: resolveHeaderPoint("인절미").icon, value: headerInjeolmi },
      { label: detailLogPointNames[2], icon: resolveHeaderPoint("어흥").icon, value: headerEoheung },
    ],
    conditions: detailLogConditions,
    weeklyHelp: detailLogWeeklyHelp,
    acts: detailLogActs,
    // Po.A/B/C 컬럼 헤더 조직별 명칭(별/방패/번개 등) — 포인트 카드와 동일 단일 출처.
    actPointNames: detailLogPointNames,
  };
  // ── Detail Log "라인 강화 내역" 탭 — lazy 조회(탭 최초 진입 1회) + (userId, weekId) 캐시 ──
  // SoT = /api/cluster4/weekly-line-enhancement(서버 proxy → admin getCrewWeekLineSummary).
  //   · 팝업 최초 진입은 액트 탭만 표시하므로 여기서 미리 받지 않는다(주차 카드 응답 비대화 방지).
  //   · 같은 (userId, weekId) 면 탭 전환/재오픈 시 캐시 재사용 — 탭 전환마다 재요청하지 않는다.
  //   · user/week 가 바뀌면 캐시를 버린다(다른 사람·다른 주차 데이터 잔존 금지).
  //   · 일반/데모(demoUserId) 모두 동일 endpoint·동일 DTO — 대상 userId 만 다르다.
  const lineTargetUserId = urlUserId || session?.user?.id || null;
  const lineCacheKey = lineTargetUserId && weekId ? `${lineTargetUserId}|${weekId}` : null;
  const [lineEnhancement, setLineEnhancement] = useState<DetailLogLineEnhancementState>({
    status: "idle",
  });
  const lineEnhancementCacheRef = useRef<{
    key: string;
    data: CrewWeekLineEnhancementDetailDto;
  } | null>(null);
  const lineEnhancementInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    // 대상(userId/weekId) 변경 → 캐시 무효화 + idle 복귀.
    lineEnhancementCacheRef.current = null;
    lineEnhancementInFlightRef.current = null;
    setLineEnhancement({ status: "idle" });
  }, [lineCacheKey]);

  const fetchLineEnhancement = useCallback(
    async (force = false) => {
      if (!lineCacheKey || !lineTargetUserId || !weekId) {
        setLineEnhancement({
          status: "error",
          message: "라인 강화 내역을 불러올 대상을 찾지 못했어요.",
        });
        return;
      }
      // 캐시 히트 → 재요청 없음.
      const cached = lineEnhancementCacheRef.current;
      if (!force && cached?.key === lineCacheKey) {
        setLineEnhancement({ status: "ready", data: cached.data });
        return;
      }
      // 동일 키 in-flight 중복 요청 방지.
      if (!force && lineEnhancementInFlightRef.current === lineCacheKey) return;
      lineEnhancementInFlightRef.current = lineCacheKey;
      setLineEnhancement({ status: "loading" });

      try {
        // ⚠ 끝 슬래시 필수 — next.config trailingSlash:true 라 슬래시가 없으면 308 → 재요청으로
        //   매 조회가 2 왕복이 된다(기존 weekly-cards 호출이 그 상태). 여기선 1 왕복으로 맞춘다.
        const url =
          `/api/cluster4/weekly-line-enhancement/?userId=${encodeURIComponent(lineTargetUserId)}` +
          `&weekId=${encodeURIComponent(weekId)}${demoQS}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: CrewWeekLineEnhancementDetailDto | null;
          error?: { message?: string; code?: string } | null;
        } | null;

        if (!res.ok || !json?.success || !json?.data) {
          // 업스트림 원문(호스트/코드)은 사용자에게 노출하지 않고 로그로만 남긴다.
          console.warn("[line-enhancement] 조회 실패", {
            status: res.status,
            code: json?.error?.code ?? null,
            detail: json?.error?.message ?? null,
          });
          setLineEnhancement({
            status: "error",
            message: "라인 강화 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
          });
          return;
        }

        lineEnhancementCacheRef.current = { key: lineCacheKey, data: json.data };
        setLineEnhancement({ status: "ready", data: json.data });
      } catch (e) {
        console.warn("[line-enhancement] 조회 예외", (e as Error)?.message);
        setLineEnhancement({
          status: "error",
          message: "라인 강화 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        });
      } finally {
        if (lineEnhancementInFlightRef.current === lineCacheKey) {
          lineEnhancementInFlightRef.current = null;
        }
      }
    },
    [lineCacheKey, lineTargetUserId, weekId, demoQS],
  );

  const handleLineTabOpen = useCallback(() => {
    void fetchLineEnhancement(false);
  }, [fetchLineEnhancement]);
  const handleLineRetry = useCallback(() => {
    void fetchLineEnhancement(true);
  }, [fetchLineEnhancement]);

  // 휴식(개인/공식)·전환 주차는 Detail Log 대신 안내 팝업(기존 Popup 시스템).
  const handleDetailLogOpen = () => {
    if (isRestMode || metaIsTransitionRest) {
      const msg = isOfficialRestLocal
        ? "이번 주는 클럽 공식 휴식 주차예요.\n휴식 주차에는 Detail Log가 제공되지 않습니다.\n푹 쉬고 다음 주에 만나요! 😊"
        : metaIsTransitionRest
          ? "이번 주는 시즌 전환(휴식) 주차예요.\n휴식 주차에는 Detail Log가 제공되지 않습니다."
          : "이번 주는 개인 휴식 주차예요.\n휴식 주차에는 Detail Log가 제공되지 않습니다.\n푹 쉬고 다음 주에 만나요! 😊";
      popup.showAlert(msg);
      return;
    }
    setShowDetailLogModal(true);
  };

  // 태그 색상 배열
  const tagColors = ["tag--pink", "tag--red", "tag--yellow", "tag--purple", "tag--green", "tag--cyan", "tag--mint", "tag--dark"];

  // ── 위클리 평판 / 연계 동료 단일 출처: weekly-cards DTO(weeklyCardMeta) 신규 요약/배열 필드 ──
  // 명성도(FM)는 reputationSummary.fm 단일 출처 — 누적 포인트(fameScore/fmScore) 사용 금지.
  // 신규 배열(weeklyReputations[]/weeklyColleagues[]) 존재 시 표시 우선, 없으면 기존 legacy state fallback.
  const reputationSummary = weeklyCardMeta?.reputationSummary ?? null;
  const colleagueSummary = weeklyCardMeta?.colleagueSummary ?? null;
  const dtoWeeklyReputations = weeklyCardMeta?.weeklyReputations ?? null;
  const dtoWeeklyColleagues = weeklyCardMeta?.weeklyColleagues ?? null;

  // ── 표시 중인 평판(주차 최대 4건) 단일 source ──
  // dtoWeeklyReputations(weekly-cards DTO) 우선, 없으면 legacy state(weeklyReputations).
  // 별점(stars) · 명성도(FM) · section-count 분자가 전부 이 동일 source 에서 나오도록 맞춰
  // "카드는 보이는데 수치만 어긋나는" desync(snapshot stale)를 구조적으로 제거한다.
  const displayedReputations: any[] = (
    dtoWeeklyReputations && dtoWeeklyReputations.length > 0
      ? dtoWeeklyReputations
      : weeklyReputations
  ).slice(0, 4); // 정책: 주차 최대 4건 반영

  // 상단 통계: section-count 분자 = "표시 중인 평판" 개수와 반드시 동일 source.
  // ⚠️ precomputed reputationSummary.receivedCount 는 평판 추가 직전(0)으로 stale 일 수 있다.
  //   스냅샷이 stale 이면 "카드 1개 표시인데 0/4" 로 어긋났다(별점·FM 과 동일한 desync).
  //   → 표시할 평판이 1건이라도 있으면 그 개수(displayedReputations.length)를 분자로 쓰고,
  //     표시할 평판이 전혀 없을 때만 precomputed receivedCount, 그것도 없으면 legacy length 로 보강.
  //   (하드코딩 0 / 대기카드(빈 슬롯) 개수 / stale precomputed 우선사용 모두 금지.)
  const reputationReceivedCount =
    displayedReputations.length > 0
      ? displayedReputations.length
      : reputationSummary && typeof reputationSummary.receivedCount === "number" && Number.isFinite(reputationSummary.receivedCount)
        ? reputationSummary.receivedCount
        : weeklyReputations.length;
  // 분모: receivedLimit 우선, 없으면 정책 분모 4.
  const reputationReceivedLimit =
    reputationSummary && typeof reputationSummary.receivedLimit === "number" && Number.isFinite(reputationSummary.receivedLimit)
      ? reputationSummary.receivedLimit
      : 4;
  // 명성도(FM) = 해당 주차 받은 평판(최대 4개) rating 합계.
  // ⚠️ 별점(stars)과 반드시 "같은 source(표시 중인 평판)"에서 FM 이 나오도록 맞춘다.
  //   별점은 reputationData(= dtoWeeklyReputations 우선, 없으면 legacy weeklyReputations)의 rating 으로
  //   그려지는데, 과거 reputationFm 은 reputationSummary.fm 을 무조건 1순위로 썼다. 스냅샷이 평판 추가
  //   직전 값(fm=0)으로 잠깐 stale 이면 "별점 9/10 인데 FM 0" 으로 어긋났다(요구: desync 제거).
  //   → 표시 중인 평판이 1건이라도 있으면 그 rating 합(별점과 동일 흐름)을 FM 으로 사용하고,
  //     표시할 평판이 전혀 없을 때만 백엔드 precomputed reputationSummary.fm 으로 보강한다.
  //   단일 평판이면 별점 rating == 카드 FM == 상단 FM == 모달 FM (전부 reputationFm 단일값).
  // ⚠️ count/length/receivedCount/fameScore/fmScore 는 FM 으로 절대 사용하지 않음 (정의상 rating 합계만).
  const reputationRatingsSum = displayedReputations.reduce(
    (s: number, r: any) => s + (typeof r?.rating === "number" ? r.rating : Number(r?.rating) || 0),
    0,
  );
  const reputationFm =
    reputationRatingsSum > 0
      ? reputationRatingsSum
      : reputationSummary && typeof reputationSummary.fm === "number" && Number.isFinite(reputationSummary.fm)
        ? reputationSummary.fm
        : 0;
  // ── 표시 중인 연계 동료(주차 최대 3건) 단일 source ──
  // dtoWeeklyColleagues(weekly-cards DTO) 우선, 없으면 legacy state(selectedColleagues).
  // 카드 렌더(colleagueData)와 section-count 분자가 전부 이 동일 source 에서 나오도록 맞춰
  // "카드는 보이는데 count만 0/3" desync(snapshot stale)를 평판 섹션과 동일하게 제거한다.
  const displayedColleagues: any[] = (
    dtoWeeklyColleagues && dtoWeeklyColleagues.length > 0
      ? dtoWeeklyColleagues
      : selectedColleagues
  ).slice(0, 3); // 정책: 주차 최대 3건 반영
  // section-count 분자 = "표시 중인 연계 동료" 개수와 반드시 동일 source.
  //   precomputed colleagueSummary.writtenCount 는 저장 직전(0)으로 stale 일 수 있다.
  //   → 표시할 동료가 1명이라도 있으면 그 개수(displayedColleagues.length)를 분자로 쓰고,
  //     전혀 없을 때만 precomputed writtenCount, 그것도 없으면 legacy length 로 보강. (하드코딩 0 금지.)
  const colleagueWrittenCount =
    displayedColleagues.length > 0
      ? displayedColleagues.length
      : colleagueSummary && typeof colleagueSummary.writtenCount === "number" && Number.isFinite(colleagueSummary.writtenCount)
        ? colleagueSummary.writtenCount
        : selectedColleagues.length;
  // 분모: writtenLimit 우선, 없으면 정책 분모 3.
  const colleagueWrittenLimit =
    colleagueSummary && typeof colleagueSummary.writtenLimit === "number" && Number.isFinite(colleagueSummary.writtenLimit)
      ? colleagueSummary.writtenLimit
      : 3;

  // 주차 평판 데이터 (API 데이터 기반)
  // 주차 평판 더미 데이터 (비로그인 / 데이터 미입력 시 폴백)
  const dummyReputations = [
    { id: "dummy-rep-1", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", rating: 0, ratingCount: "- / 10", description: "-", rawRating: 0, rawKeyword: "-", fm: 0, tagColor: "tag--pink", tagText: "#-", isEmpty: true },
    { id: "dummy-rep-2", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", rating: 0, ratingCount: "- / 10", description: "-", rawRating: 0, rawKeyword: "-", fm: 0, tagColor: "tag--red", tagText: "#-", isEmpty: true },
    { id: "dummy-rep-3", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", rating: 0, ratingCount: "- / 10", description: "-", rawRating: 0, rawKeyword: "-", fm: 0, tagColor: "tag--yellow", tagText: "#-", isEmpty: true },
  ];

  const reputationData = useMemo(() => {
    // 태그 색상 배열
    const colors = ["tag--pink", "tag--red", "tag--yellow", "tag--purple", "tag--green", "tag--cyan", "tag--mint"];

    // API에서 가져온 데이터를 UI 형식으로 변환
    // 1순위: weekly-cards DTO weeklyReputations[] — "타인이 내 카드에 작성" → 표시 프로필 = fromProfile(작성자).
    // 인적사항은 fromProfile 우선, fromProfile 부재 시에만 같은 행의 legacy reviewer(/api/weekly-reputations)로 보강.
    // (rating/comment/keyword/createdAt 은 항상 DTO 행 값 사용 — DTO 단일 출처 유지.)
    const legacyRepById = new Map<string, any>();
    weeklyReputations.forEach((r: any) => {
      if (r?.id != null) legacyRepById.set(String(r.id), r);
    });
    const apiData =
      dtoWeeklyReputations && dtoWeeklyReputations.length > 0
        ? dtoWeeklyReputations.map((rep, index) => {
            const fp: any = rep.fromProfile || {};
            // fromProfile 이 비어있을 때만 legacy reviewer 로 보강 — 반드시 "동일 id" 행만 사용한다.
            // (종전 index 기반 폴백은 정렬/개수 차이 시 다른 평판의 작성자 인적사항·이미지가
            //  섞일 수 있어 제거 — 표시 대상은 항상 해당 행의 reviewer 여야 한다.)
            const legacy: any = (rep.id != null ? legacyRepById.get(String(rep.id)) : null) || {};
            const rv: any = legacy.reviewer || (rep as any).reviewer || {};
            // 나이: fromProfile.age 우선, 없으면 legacy birth_date 로 계산
            let age: string | number = "-";
            if (fp.age !== undefined && fp.age !== null && fp.age !== "") age = fp.age;
            else if (rv.birth_date) age = new Date().getFullYear() - new Date(rv.birth_date).getFullYear();
            // 인적사항(이름/성별/학교/학과/팀/파트/이미지/태그라인)은 공통 헬퍼로 통일 해석.
            // fromProfile(Cluster4PersonProfileDto 계약 + legacy alias) 1순위, legacy reviewer(rv) 보강.
            const pi = resolvePersonalInfo({ profile: fp, user: rv });
            return {
              id: rep.id ?? legacy.id ?? `wr-${index}`,
              name: pi.name ?? "-",
              gender: pi.gender ?? "-",
              age,
              profileImg: pi.profileImageUrl ?? "",
              university: pi.school ?? "-",
              major: pi.department ?? "-",
              team: pi.team ?? "-",
              part: pi.part ?? "-",
              nickname: pi.tagline ?? "-",
              role: formatMembershipRoleLabel(fp.membershipLevel || rv.role),
              rating: (rep.rating ?? 0) / 2, // 10점 만점 → 5점 만점(별 표시용)
              ratingCount: `${rep.rating ?? 0} / 10`,
              description: rep.comment || "-",
              rawRating: rep.rating ?? 0,
              rawKeyword: rep.keyword ?? "",
              fm: reputationFm, // 명성도(FM)는 reputationSummary.fm 단일 출처
              tagColor: colors[index % colors.length],
              tagText: `#${rep.keyword || "-"}`,
              createdAt: rep.createdAt ?? legacy.created_at ?? null,
              isEmpty: false,
            };
          })
        : weeklyReputations.length > 0
        ? weeklyReputations.map((rep, index) => {
            const reviewer = rep.reviewer;
            // 나이 계산
            let age: string | number = "-";
            if (reviewer?.birth_date) {
              const birthYear = new Date(reviewer.birth_date).getFullYear();
              const currentYear = new Date().getFullYear();
              age = currentYear - birthYear;
            }

            const pi = resolvePersonalInfo({ profile: reviewer });
            return {
              id: rep.id,
              name: pi.name ?? "-",
              gender: pi.gender ?? "-",
              age: age,
              profileImg: pi.profileImageUrl ?? "",
              university: pi.school ?? "-",
              major: pi.department ?? "-",
              team: pi.team ?? "-",
              part: pi.part ?? "-",
              nickname: pi.tagline ?? "-",
              role: formatMembershipRoleLabel(reviewer?.role),
              rating: rep.rating / 2, // 10점 만점 → 5점 만점 변환 (별 표시용)
              ratingCount: `${rep.rating} / 10`,
              description: rep.content || "-",
              fm: reputationFm, // 카드 내부 FM = reputationSummary.fm(없으면 rating 합계) 단일 출처
              tagColor: colors[index % colors.length],
              tagText: `#${rep.keyword || "-"}`,
              // TODO: [백엔드 작업 필요] weeklyReputations 테이블에 created_at 필드 추가 후
              // formatReputationTime(createdAt)으로 "YY. MM. DD(요일) HH:MM" 표시
              createdAt: rep.created_at || null,
              isEmpty: false,
            };
          })
        : (() => {
            // 테스트용: ?admin=true&repCount=N (N: 0~4) — 데모 모드에서만 더미 개수 조절
            if (isDemoMode && searchParams.get("admin") === "true") {
              const raw = searchParams.get("repCount");
              if (raw !== null) {
                const n = Math.max(0, Math.min(4, parseInt(raw, 10) || 0));
                return dummyReputations.slice(0, n);
              }
            }
            return dummyReputations;
          })(); // 데이터 없으면 더미 데이터 폴백

    // 작업 4: created_at 오름차순 정렬 (오래된 것이 1번 슬롯 → 가장 최신이 4번)
    // null/undefined createdAt는 Infinity로 취급해 뒤로 밀어냄 (안정 정렬로 원래 순서 보존)
    const sorted = [...apiData].sort((a, b) => {
      const timeA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : Infinity;
      const timeB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : Infinity;
      return timeA - timeB;
    });

    // 최대 4개까지, 빈 슬롯 채우기 (삭제 시 재정렬은 useMemo 재계산으로 자연 달성)
    const result = [...sorted];
    while (result.length < 4) {
      result.push({
        id: `empty-${result.length}`,
        name: "-",
        gender: "",
        age: "",
        profileImg: "",
        university: "",
        major: "",
        team: "",
        part: "",
        nickname: "",
        role: "",
        rating: 0,
        ratingCount: "- / 10",
        description: "-",
        fm: 0,
        tagColor: "tag--dark",
        tagText: "-",
        createdAt: null,
        isEmpty: true,
      });
    }

    return result.slice(0, 4); // 최대 4개만 반환
  }, [dtoWeeklyReputations, reputationFm, weeklyReputations, isDemoMode, searchParams]);

  // 검색 필터링된 크루 목록 (이름과 닉네임으로만 검색)
  const filteredCrewData = allCrewList
    .filter((user) => {
      if (!crewSearchQuery) return true;
      const query = crewSearchQuery.toLowerCase();
      return (user.name?.toLowerCase() || "").includes(query) || (user.nickname?.toLowerCase() || "").includes(query);
    })
    .filter((user) => !selectedColleagues.find((c) => c.id === user.id));

  // 연계 동료 더미 데이터 (비로그인 / 데이터 미입력 시 폴백)
  const dummyColleagues = [
    { id: "dummy-col-1", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", date: "-", message: "", isEmpty: true },
    { id: "dummy-col-2", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", date: "-", message: "", isEmpty: true },
    { id: "dummy-col-3", name: "-", gender: "-", age: "-", profileImg: "", university: "-", major: "-", team: "-", part: "-", nickname: "-", role: "", date: "-", message: "", isEmpty: true },
  ];

  // 연계 동료 데이터 (API 데이터 기반)
  const colleagueData = useMemo(() => {
    // 휴식 모드일 때 빈 카드 3개 반환
    if (isRestMode) {
      return Array.from({ length: 3 }, (_, i) => ({
        id: `empty-colleague-${i}` as any,
        name: "-",
        gender: "-",
        age: "-",
        profileImg: "",
        university: "-",
        major: "-",
        team: "-",
        part: "-",
        nickname: "-",
        role: "",
        date: "-",
        message: "",
        created_at: null as string | null,
        isEmpty: true,
      }));
    }

    // API에서 가져온 데이터를 UI 형식으로 변환
    // 1순위: weekly-cards DTO weeklyColleagues[] — "본인이 본인 카드에 타인을 작성" → 표시 프로필 = colleagueProfile.
    const apiData =
      dtoWeeklyColleagues && dtoWeeklyColleagues.length > 0
        ? dtoWeeklyColleagues.map((c, index) => {
            const p: any = c.colleagueProfile || {};
            // 인적사항은 공통 헬퍼로 통일 해석 (계약 키 + legacy alias 동시 지원).
            const pi = resolvePersonalInfo({ profile: p });
            return {
              id: (p.id ?? c.id ?? `wc-${c.rank ?? index}`) as any,
              name: pi.name ?? "-",
              gender: pi.gender ?? "-",
              age: ((pi.age ?? "-") as any),
              profileImg: pi.profileImageUrl ?? "",
              university: pi.school ?? "-",
              major: pi.department ?? "-",
              team: pi.team ?? "-",
              part: pi.part ?? "-",
              nickname: pi.tagline ?? "-",
              role: formatMembershipRoleLabel(p.membershipLevel),
              date: c.createdAt ? formatDate(c.createdAt) : "-",
              message: c.message || "",
              created_at: c.createdAt || null,
              rank: c.rank ?? null,
              isEmpty: false,
            };
          })
        : selectedColleagues.length > 0
        ? selectedColleagues.map((c) => {
            const pi = resolvePersonalInfo({ profile: c });
            return {
              id: c.id,
              name: pi.name ?? "-",
              gender: pi.gender ?? "-",
              age: (pi.age ?? "-") as any,
              profileImg: pi.profileImageUrl ?? "",
              university: pi.school ?? "-",
              major: pi.department ?? "-",
              team: pi.team ?? "-",
              part: pi.part ?? "-",
              nickname: pi.tagline ?? "-",
              // 상태칩(일반/심화): DTO branch 와 동일하게 멤버십 등급을 우선(role 은 이관 사용자에서 NULL).
              role: formatMembershipRoleLabel((c as any).membershipLevel || c.role),
              date: c.createdAt ? formatDate(c.createdAt) : "-",
              message: c.message || "",
              created_at: c.createdAt || null, // 작업 6에서 reputation-timestamp 표시용
              isEmpty: false,
            };
          })
        : (() => {
            // 테스트용: ?admin=true&colCount=N (N: 0~3) — 데모 모드에서만 더미 개수 조절
            if (isDemoMode && searchParams.get("admin") === "true") {
              const raw = searchParams.get("colCount");
              if (raw !== null) {
                const n = Math.max(0, Math.min(3, parseInt(raw, 10) || 0));
                return dummyColleagues.slice(0, n);
              }
            }
            return dummyColleagues;
          })(); // 데이터 없으면 더미 데이터 폴백

    // rank(1~3) 우선 정렬, 없으면 createdAt 오름차순 (reputation 패턴 동일)
    apiData.sort((a: any, b: any) => {
      if (typeof a.rank === "number" && typeof b.rank === "number") return a.rank - b.rank;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : Infinity;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : Infinity;
      return timeA - timeB;
    });

    // 최대 3개까지, 빈 슬롯 채우기
    const result = [...apiData];
    while (result.length < 3) {
      result.push({
        id: `empty-colleague-${result.length}` as any,
        name: "-",
        gender: "-",
        age: "-",
        profileImg: "",
        university: "-",
        major: "-",
        team: "-",
        part: "-",
        nickname: "-",
        role: "",
        date: "-",
        message: "",
        created_at: null,
        isEmpty: true,
      });
    }

    return result.slice(0, 3); // 최대 3개만 반환
  }, [dtoWeeklyColleagues, selectedColleagues, isRestMode, isDemoMode, searchParams]);

  // 실무 정보 activity_type_id → UI 매핑
  const activityTypeConfig: { [key: string]: { category: string; tagColor: string; icon: string; isFruit: boolean } } = {
    wisdom: { category: "위즈덤", tagColor: "tag--red", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 위즈덤.png", isFruit: true },
    essay: { category: "에세이", tagColor: "tag--yellow", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 에세이.png", isFruit: true },
    infodesk: { category: "인포데스크", tagColor: "tag--purple", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 인포데스크.png", isFruit: true },
    calendar: { category: "캘린더", tagColor: "tag--dark", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 캘린더.png", isFruit: true },
    forum: { category: "포럼", tagColor: "tag--green", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 포럼.png", isFruit: true },
    session: { category: "세션", tagColor: "tag--cyan", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 세션.png", isFruit: true },
    practical_lecture: { category: "아카데미", tagColor: "tag--mint", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 아카데미.png", isFruit: true },
    community: { category: "커뮤니티", tagColor: "tag--dark", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 커뮤니티.png", isFruit: true },
    etc_a: { category: "기타a", tagColor: "tag--mint", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 기타a.png", isFruit: true },
  };

  // 실무 정보 activity_type_id → 라인코드 매핑
  const lineCodeMap: Record<string, string> = {
    wisdom: "IF99A - NR0001",
    essay: "IF99A - NR0002",
    infodesk: "IF99A - NR0003",
    calendar: "IF99A - NR0004",
    session: "IF99A - NR0005",
    forum: "IF99A - NR0006",
    practical_lecture: "IF99A - NR0007",
    community: "IF99A - NR0008",
    etc_a: "IF99A - NR9999",
  };

  const workAbilityLineMap: Record<string, { lineName: string; lineCode: string; mainTitle: string }> = {
    "CP00A-NS0001": { lineName: "[콘텐츠]시리즈_이해", lineCode: "CP00A - NS0001", mainTitle: "[콘텐츠 마케팅] 방송/광고/마케팅 의 모든 시장에서 마케팅 콘텐츠의 핵심 원리인 시리즈 라인! 나만 모르면 안되잖아!" },
    "CP00A-NS0002": { lineName: "[콘텐츠]시리즈_기획", lineCode: "CP00A - NS0002", mainTitle: "[콘텐츠 마케팅] 실무 마케팅 기획자가 구상한 '콘텐츠' 의 구체적인 모습! 현장을 모르고 펜대만 굴리는 기획자는 되어선 안되지!" },
    "CP00A-NS0003": { lineName: "[콘텐츠]시리즈_제작", lineCode: "CP00A - NS0003", mainTitle: "[콘텐츠 마케팅] 기획은 실제 제작과 현장에서 완성되는 법! 기획서만 주구장창 쓸 줄 아는 마케터는 허울 좋은 바보가 될지도 몰라!" },
    "CP00A-NS0004": { lineName: "[콘텐츠]시리즈_발행", lineCode: "CP00A - NS0004", mainTitle: "[콘텐츠 마케팅] 두근두근.. 마케터로서 나의 결과물을 실제 세상에 던지는 것은, 언제나 떨리는 일이지! 우물 안에 갇히지 말자구!" },
    "CP00A-NS0005": { lineName: "[콘텐츠]바이럴 마케팅", lineCode: "CP00A - NS0005", mainTitle: "[콘텐츠 마케팅] 언제 어디서 어떻게 공격할지 모르는 게릴라와 같아! 단숨에 승패를 바꿔버리는 바이럴 콘텐츠를 나의 무기로!" },
    "CP00A-NS0006": { lineName: "[Job]콘텐츠 마케팅", lineCode: "CP00A - NS0006", mainTitle: "[콘텐츠 마케팅] 훌륭한 마케팅 콘텐츠는 무엇을 가지고 있으며, 어떤 도구와 지점에서 출발하는가?" },
    "CP00A-NS0007": { lineName: "[Job]퍼포먼스 마케팅", lineCode: "CP00A - NS0007", mainTitle: "[퍼포먼스 마케팅] 훌륭한 마케팅 퍼포먼스는 어떤 것으로 이루어져 있으며, 어떻게 도출, 접근하는가?" },
    "CP00A-NS0008": { lineName: "[Job]브랜딩 마케팅", lineCode: "CP00A - NS0008", mainTitle: "[브랜딩 마케팅] 마케팅에서 브랜딩이란 무엇을 의미하며, 이것은 어떻게 마케터의 무기가 될 수 있는가?" },
    "CP00A-NS0009": { lineName: "[실무 Info]인하우스 & 에이전시", lineCode: "CP00A - NS0009", mainTitle: "[마케팅 실무] 현업에서 마케팅 업계를 구성하고 있는 인하우스 와 에이전시 의 개념, 그리고 내부 속성을 알아보자구!" },
    "CP00A-NS0010": { lineName: "[실무 Info]마케팅 용어 & 개념", lineCode: "CP00A - NS0010", mainTitle: "[마케팅 실무] 현업에서 마구마구 쏟아지는, 마케팅 용어와 개념을 익혀서 효과적인 실무 커뮤니케이션을 정복해보자." },
    "CP00A-NS0011": { lineName: "[실무 Resource]아이보스", lineCode: "CP00A - NS0011", mainTitle: "[마케팅 리소스] 뭐니뭐니해도 사람들이 모여야 정보가 유통되는 법! 마케팅 커뮤니티 아이보스를 알아보자!" },
    "CP00A-NS0012": { lineName: "[업무 Resource]오픈애즈", lineCode: "CP00A - NS0012", mainTitle: "[마케팅 리소스] 전세계의 광고, 마케팅의 세상이 넓은 만큼, 오픈애즈에서 큐레이팅된 마케팅 정보를 잡자!" },
    "CP00A-NS0013": { lineName: "[업무 Resource]자유 선택", lineCode: "CP00A - NS0013", mainTitle: "[마케팅 리소스] 아는 만큼 보이는 법! AI 시대에 나에게 필요한 마케팅 리소스들을 탐구, 확보해보자구!" },
    "CP00A-NS0014": { lineName: "[실무 Skill]구글", lineCode: "CP00A - NS0014", mainTitle: "[마케팅 기술] 전 지구상 최대의 포탈, 구글! 전 세계 실무 마케터들이 필수적으로 올라타있는 구글 생태계를 정복해보자구!" },
    "CP00A-NS0015": { lineName: "[실무 Skill]리스틀리", lineCode: "CP00A - NS0015", mainTitle: "[마케팅 기술] 정보란 곧, 데이터. 데이터를 확보하지 못하면, 진정한 마케터라 할 수 있는가? 데이터 크롤링의 기초, 리스틀리!" },
    "CP00A-NS0016": { lineName: "[실무 Skill]카카오", lineCode: "CP00A - NS0016", mainTitle: "[마케팅 기술] 우리 중 90% 는 domestic 시장으로 가잖아? 국내 시장을 장악한 카카오 생태계가, 내 마케팅 기술이 되게 하자구!" },
    "CP00A-NS0017": { lineName: "[실무 Skill]네이버", lineCode: "CP00A - NS0017", mainTitle: "[마케팅 기술] 국내 1위 포탈! 국내 기업에서 놓칠 수 없는, 압도적인 시장 장악력을 가진 네이버 생태계에 올라타보자!" },
    "CP00A-NS0018": { lineName: "[Reference]인스타그램", lineCode: "CP00A - NS0018", mainTitle: "[실무 레퍼런스] 인스타..안하는 사람도 있니? 세계 최대의 마케팅 채널은 곧 살아있는 벤치마킹 기출문제!" },
    "CP00A-NS0019": { lineName: "[Reference]네이버", lineCode: "CP00A - NS0019", mainTitle: "[실무 레퍼런스] 국내에서는 네이버를 외면할 수 있어? 네이버 안의 값진 레퍼런스를 찾아 나의 것으로 만들어 보자구!" },
    "CP00A-NS0020": { lineName: "[Reference]자유 선택", lineCode: "CP00A - NS0020", mainTitle: "[실무 레퍼런스] 세상은 넓고, 앞서나간 훌륭한 선례들은 무궁무진하지! 거인의 어깨 위에 올라타자. 청춘의 강점!" },
    "CP00A-NS0021": { lineName: "[실무 기획]온라인 마케팅", lineCode: "CP00A - NS0021", mainTitle: "[실무 기획] 온라인 마케팅 안하는 서비스는 있을 수 없어! IT 환경의 플랫폼, SNS 등으로 구성된 진법을 기획해보자구!" },
  };
  const workAbilityCardLineCodes = Object.keys(workAbilityLineMap);
  const lookupWorkAbilityMapping = (code?: string | null) => {
    if (!code) return undefined;
    const noSpace = code.replace(/\s+/g, "");
    return workAbilityLineMap[noSpace] || workAbilityLineMap[code];
  };
  const getWorkAbilityIcon = (lineName: string): string => {
    const basePath = "/images/0/cluster4/icon/실무 역량/";
    const normalizedLineName = lineName.replace(/\s+/g, "").toLowerCase();
    const matched = WORK_ABILITY_ICON_FILES.find((file) => {
      if (file === "실무 역량 - default.png") return false;
      const keyword = file
        .replace(/^실무 역량\s*-\s*/, "")
        .replace(/\.png$/, "")
        .replace(/\s+/g, "")
        .toLowerCase();
      return normalizedLineName.includes(keyword) || keyword.includes(normalizedLineName);
    });
    return basePath + (matched || "실무 역량 - default.png");
  };

  // workExp 전용 매핑 — card.code(line_code) 기준. 공백 제거한 key로 lookup
  const workExpLineMap: Record<string, { lineName: string; lineCode: string; mainTitle: string }> = {
    "EX02A-ES0001": {
      lineName: "[커리어] 마케터 Launch",
      lineCode: "EX02A - ES0001",
      mainTitle: '[역량 파악 & 성장점 분석] "백날 말로만 떠드는 마케팅 커리어가 아니라, 지금 당장 어느 정도로 준비되었는지 그 현실을 뼈저리게 느껴보자구!"',
    },
    "EX99A-ER0002": {
      lineName: "[생산성] 상호 피드백",
      lineCode: "EX99A - ER0002",
      mainTitle: '[상호 피드백] "100명의 사람이 있으면, 100개의 시각과 관점이 있다고 하지. 과연 내 마케팅은, 내가 의도한대로 전달되고 있는 것이 맞을까?"',
    },
    "EX99A-ER0003": {
      lineName: "[콘텐츠] 마케팅 실무",
      lineCode: "EX99A - ER0003",
      mainTitle: "[콘텐츠 마케팅] \"어떤 제품/서비스더라도, 마케터가 제대로 '표현' 하지 못한다면, 그저 '낙서' 에 불과해. 어떻게 내 제품/서비스를 표현할 수 있을까?\"",
    },
    "EX99A-ER0004": {
      lineName: "[퍼포먼스] 마케팅 실무",
      lineCode: "EX99A - ER0004",
      mainTitle: "[퍼포먼스 마케팅] \"마케팅 효과가 좋더라도, 결과를 제대로 '인지' 하지 못한다면, 운 좋은 '우연' 에 지나지 않아. 이 마케팅.. 계속 나아갈 수 있어?\"",
    },
    "EX99L-ER0005": {
      lineName: "[매니징] 마케팅 팀/조직 관리_파트장",
      lineCode: "EX99L - ER0005",
      mainTitle: "[매니징 실무] 다수의 팀원을 리딩하는 '파트' 의 장(將)은 무엇을 고려하며, 정기적인 일정과 개별적인 적용은 어떻게 조화시키는가?",
    },
    "EX99L-ER0006": {
      lineName: "[매니징] 마케팅 팀/조직 관리_에이전트",
      lineCode: "EX99L - ER0006",
      mainTitle: "[매니징 실무] 다수의 팀원들이 따라올 수 있는 가이드라인과 자료 체계는 어떻게 구성하며, 이는 팀 전체의 퍼포먼스에 어떤 영향을 미치는가?",
    },
  };
  // code(with/without space) → map entry 조회 헬퍼
  const lookupWorkExpMapping = (code?: string | null) => {
    if (!code) return undefined;
    const noSpace = code.replace(/\s+/g, "");
    return workExpLineMap[noSpace] || workExpLineMap[code];
  };

  // ── [cluster4-line-display] 진단 로그 ──
  // 각 허브 모달이 열릴 때 matchedLine 과 실제 표시값을 출력해 backend DTO 일치 여부를 검증한다.
  // activityTypeId / activityTypeKey / activityTypeName 3개 필드가 응답에 실제로 존재하는지 확인용.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (workInfoViewModalOpen && selectedWorkInfoCard) {
      const m = workInfoMatchedLine;
      console.log("[cluster4-line-display]", {
        hub: "information",
        currentWeekId: weekId,
        matchedLine: m ?? null,
        displayTitle: m?.mainTitle ?? (selectedWorkInfoCard.title ?? null),
        displayCode: m?.lineCode ?? (lineCodeMap[selectedWorkInfoCard.activityType] || selectedWorkInfoCard.activityType || null),
        displayActivityName: m?.activityTypeName ?? (selectedWorkInfoCard.category ?? null),
        displayOutputLink1: lineOutputLinkAt(m, 0),
        displayOutputLink2: lineOutputLinkAt(m, 1),
        lineTargetId: m?.lineTargetId ?? null,
        activityTypeId: m?.activityTypeId ?? null,
        activityTypeKey: m?.activityTypeKey ?? null,
        activityTypeName: m?.activityTypeName ?? null,
        canEdit: typeof m?.canEdit === "boolean" ? m.canEdit : null,
      });
    }
  }, [workInfoViewModalOpen, selectedWorkInfoCard, workInfoMatchedLine, weekId]);

  useEffect(() => {
    if (workAbilityViewModalOpen && selectedWorkAbilityCard) {
      const m = workAbilityMatchedLine;
      console.log("[cluster4-line-display]", {
        hub: "competency",
        currentWeekId: weekId,
        matchedLine: m ?? null,
        displayTitle: m?.mainTitle ?? (selectedWorkAbilityCard.title ?? null),
        displayCode: m?.lineCode ?? (selectedWorkAbilityCard.lineCode || selectedWorkAbilityCard.code || null),
        displayOutputLink1: lineOutputLinkAt(m, 0),
        displayOutputLink2: lineOutputLinkAt(m, 1),
        lineTargetId: m?.lineTargetId ?? null,
        activityTypeId: m?.activityTypeId ?? null,
        activityTypeKey: m?.activityTypeKey ?? null,
        activityTypeName: m?.activityTypeName ?? null,
        canEdit: typeof m?.canEdit === "boolean" ? m.canEdit : null,
      });
    }
  }, [workAbilityViewModalOpen, selectedWorkAbilityCard, workAbilityMatchedLine, weekId]);

  useEffect(() => {
    if (workExpViewModalOpen && selectedWorkExpCard) {
      const m = workExpMatchedLine;
      // 현재 주차의 experience partType DTO 라인 후보 전체 (매칭 실패 진단용)
      const expCandidates = cluster4Lines
        .filter((l) => {
          if ((l.weekId ?? null) !== weekId) return false;
          const rawPart = String(l.partType ?? "").toLowerCase();
          return rawPart === "experience" || rawPart === "exp";
        })
        .map((l) => ({
          partType: l.partType ?? null,
          lineTargetId: l.lineTargetId ?? null,
          lineCode: l.lineCode ?? null,
          experienceLineMasterId: l.experienceLineMasterId ?? null,
          activityTypeId: l.activityTypeId ?? null,
          activityTypeKey: l.activityTypeKey ?? null,
          mainTitle: l.mainTitle ?? null,
          canEdit: typeof l.canEdit === "boolean" ? l.canEdit : null,
          hasOutputLinks: Array.isArray(l.outputLinks) ? l.outputLinks.length : null,
          hasOutputImages: Array.isArray(l.outputImages) ? l.outputImages.length : null,
        }));
      console.log("[cluster4-line-display]", {
        hub: "experience",
        currentWeekId: weekId,
        // 매칭에 사용한 카드(legacy) key
        cardKeys: {
          activityTypeId: selectedWorkExpCard.activityTypeId ?? null,
          code: selectedWorkExpCard.code ?? null,
          experienceLineMasterId: selectedWorkExpCard.experienceLineMasterId ?? null,
        },
        matchedLineExists: !!m,
        selectedBy: workExpSelectedBy,
        matchedLine: m ?? null,
        expCandidatesInWeek: expCandidates,
        displayTitle: m?.mainTitle ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.mainTitle || selectedWorkExpCard.title || null),
        displayCode: m?.lineCode ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.lineCode || selectedWorkExpCard.code || null),
        displayOutputLink1: lineOutputLinkAt(m, 0),
        displayOutputLink2: lineOutputLinkAt(m, 1),
        displayOutputImages: Array.isArray(m?.outputImages) ? m!.outputImages!.length : null,
        lineTargetId: m?.lineTargetId ?? null,
        activityTypeId: m?.activityTypeId ?? null,
        activityTypeKey: m?.activityTypeKey ?? null,
        activityTypeName: m?.activityTypeName ?? null,
        canEdit: typeof m?.canEdit === "boolean" ? m.canEdit : null,
      });
      // 요청된 진단 로그 — 주차 단위 experience 라인 직접 사용 방식 검증용
      console.log("[cluster4-exp-match]", {
        currentWeekId: weekId,
        selectedWorkExpCard,
        experienceLinesInWeek,
        selectedBy: workExpSelectedBy,
        matchedLine: m ?? null,
      });
      // 라인명/라인평점 매핑 검증용 — experienceRating(DTO=cluster4_experience_line_evaluations.rating) 확인
      const modalLineName = (m?.lineName as string | null | undefined) ?? m?.activityTypeName ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || null);
      const dtoExperienceRating = typeof m?.experienceRating === "number" ? m.experienceRating : null;
      console.log("[cluster4-exp-modal-display]", {
        matchedLine: m ?? null,
        modalLineName,
        modalExperienceRating: dtoExperienceRating,
        modalRatingCount: dtoExperienceRating !== null ? `${dtoExperienceRating} / 10` : "- / 10",
        modalRatingSource: "matchedLine.experienceRating(DTO=cluster4_experience_line_evaluations.rating)",
        mainTitle: m?.mainTitle ?? null,
        activityTypeName: m?.activityTypeName ?? null,
        experienceRating: m?.experienceRating ?? null,
      });
    }
  }, [workExpViewModalOpen, selectedWorkExpCard, workExpMatchedLine, workExpSelectedBy, experienceLinesInWeek, weekId, cluster4Lines]);

  useEffect(() => {
    if (workCareerViewModalOpen && selectedWorkCareerCard) {
      const m = workCareerMatchedLine;
      console.log("[cluster4-line-display]", {
        hub: "career",
        currentWeekId: weekId,
        matchedLine: m ?? null,
        displayTitle: m?.mainTitle ?? (selectedWorkCareerCard.title ?? null),
        displayCode: m?.projectCode ?? (selectedWorkCareerCard.lineCode || selectedWorkCareerCard.code || null),
        displayOutputLink1: lineOutputLinkAt(m, 0),
        displayOutputLink2: lineOutputLinkAt(m, 1),
        lineTargetId: m?.lineTargetId ?? null,
        activityTypeId: m?.activityTypeId ?? null,
        activityTypeKey: m?.activityTypeKey ?? null,
        activityTypeName: m?.activityTypeName ?? null,
        canEdit: typeof m?.canEdit === "boolean" ? m.canEdit : null,
      });
    }
  }, [workCareerViewModalOpen, selectedWorkCareerCard, workCareerMatchedLine, weekId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // 실무 정보에 해당하는 activity types
  const workInfoActivityTypes = ["wisdom", "essay", "infodesk", "calendar", "forum", "session", "practical_lecture", "community", "etc_a"];
  // 실무 역량 activity types - DB에서 가져온 practical_competency 클러스터
  const workAbilityActivityTypes = competencyTypeIds;
  // 실무 경험 activity types - DB에서 가져온 practical_experience 클러스터
  const workExpActivityTypes = experienceTypeIds;
  // 실무 경력 activity types - DB에서 가져온 practical_career 클러스터
  const workCareerActivityTypes = careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"];
  // 전체 activity types (2차 정보 저장용)
  const allActivityTypes = [...workInfoActivityTypes, ...workAbilityActivityTypes, ...workExpActivityTypes, ...workCareerActivityTypes];

  // 실무 역량: 유저가 완료한 활동 찾기 (is_completed = true인 것 중 첫 번째)
  // activity_record가 있으면 weekly_activities.is_active 여부와 관계없이 표시
  const findFirstCompletedAbilityActivity = () => {
    for (const actType of workAbilityActivityTypes) {
      const record = weekActivityRecords.find((ar) => ar.activity_type_id === actType);
      if (record?.is_completed) {
        const activity = weeklyActivities.find((a) => a.activity_type_id === actType);
        if (activity) return activity;
        // weekly_activities에 없어도 activity_types 정보로 대체
        const typeInfo = activityTypesMap.get(actType);
        if (typeInfo) return { activity_type_id: actType, title: typeInfo.name, is_active: false, week_id: weekId } as any;
      }
    }
    return null;
  };

  // 실무 역량: 첫 번째 개설된 활동 찾기 헬퍼
  const findFirstAbilityActivity = () => {
    for (const actType of workAbilityActivityTypes) {
      const activity = weeklyActivities.find((a) => a.activity_type_id === actType && a.is_active);
      if (activity) return activity;
    }
    return null;
  };

  // 실무 역량: 유저가 선택한(record가 있는) 활동 찾기
  const findFirstSelectedAbilityActivity = () => {
    for (const actType of workAbilityActivityTypes) {
      const record = weekActivityRecords.find((ar) => ar.activity_type_id === actType);
      if (record) {
        const activity = weeklyActivities.find((a) => a.activity_type_id === actType);
        if (activity) return activity;
        const typeInfo = activityTypesMap.get(actType);
        if (typeInfo) return { activity_type_id: actType, title: typeInfo.name, is_active: false, week_id: weekId } as any;
      }
    }
    return null;
  };

  // 실무 역량: 첫 번째 존재하는 활동 타입 ID 가져오기
  const getFirstAbilityActivityType = (): string => {
    const activity = findFirstAbilityActivity();
    return activity?.activity_type_id || workAbilityActivityTypes[0] || "";
  };

  // activity_type 정보 가져오기 헬퍼
  const getActivityTypeInfo = (activityTypeId: string): ActivityTypeInfo | undefined => {
    return activityTypesMap.get(activityTypeId);
  };

  // 매니징 라인은 사용자 역할에 따라 적용 여부가 갈림 — 라인명에 _파트장/_에이전트 표기.
  // 라인이 사용자의 역할과 맞지 않으면 강화 실패가 아니라 '해당 없음' 처리해야 함
  // (활동이 애초에 그 역할에게 개설되지 않으므로).
  const isLineForOtherRole = (activityTypeId: string): boolean => {
    const lineName = activityTypesMap.get(activityTypeId)?.name || workExpLineMap[activityTypeId.replace(/\s+/g, "")]?.lineName || "";
    if (!lineName) return false;
    const role = userWeekRole || "";
    if (lineName.includes("파트장")) {
      return !role.includes("partleader") && !role.includes("part_leader");
    }
    if (lineName.includes("에이전트")) {
      return !role.includes("agent");
    }
    return false;
  };

  // 강화 상태 판단 함수 (마감 기준: 해당 주차 수요일 22:00 KST = computeLineDeadlineMs)
  // - 해당 없음: 활동 미개설(is_active=false) / 온보딩 주차(무적 주차) / 개인 휴식 / 역할 미스매치 / 누적 주차 외
  // - 강화 대기: 활동 개설됨 + 마감(수 22:00 KST) 이전
  // - 강화 성공: 활동 개설됨 + 마감(수 22:00 KST) 이후 — 기입/이행 여부와 무관하게 success
  // - empty: 더미데이터의 sentinel 플래그 (record.is_empty)
  // ※ SoT 는 백엔드 line.enhancementStatus 이며 이 함수는 백엔드 값이 없을 때의 fallback 이다.
  // ※ 제출/이행(record.is_completed) 여부는 enhancementStatus 가 아니라 입력 여부 표시용으로만 쓴다.
  // ※ failed 는 이 레거시 경로에서는 쓰지 않는다(미개설은 not_applicable). 목요일 12:01(resultsDecided) 기준도 쓰지 않는다.
  type EnhancementStatus = "success" | "waiting" | "failed" | "not_applicable" | "empty";
  const getEnhancementStatus = (activityType: string): EnhancementStatus => {
    // 클럽 온보딩 주차(무적 주차)는 모든 활동이 해당 없음
    if (isOnboardingWeek) return "not_applicable";

    // 개인 휴식 크루는 모든 활동이 해당 없음. 공식 휴식이라도 예외적으로 개설된 활동은 정상 평가.
    // phase(집계 중/진행 중) 와 무관하게 적용 — growthStatus 가 phase 로 가려져도 휴식 플래그를 본다.
    if (weekData?.isPersonalRest) return "not_applicable";

    // 매니징 라인 — 사용자 역할이 다른 역할용 라인이면 '해당 없음'
    // 단, 실제 이행 기록이 있으면 운영진이 예외 부여한 케이스이므로 일반 흐름 유지
    if (isLineForOtherRole(activityType)) {
      const hasRecord = weekActivityRecords.some((ar) => ar.activity_type_id === activityType);
      if (!hasRecord) return "not_applicable";
    }

    // 실무 경험 활동의 eligible 조건 체크 (누적 주차 범위 밖이면 해당 없음)
    // 단, 실제 이행 기록이 있으면 운영진이 진행 주차 외 라인을 예외 처리한 케이스이므로
    // 일반 흐름을 타도록 폴백 (예: 진행 2주차 크루의 [생산성] 상호 피드백)
    const expInfo = experienceTypeInfos.find((info) => info.id === activityType);
    if (expInfo) {
      const minWeek = expInfo.eligible_min_approved_weeks ?? 1;
      const maxWeek = expInfo.eligible_max_approved_weeks ?? 999;
      if (cumulativeApprovedWeeks < minWeek || cumulativeApprovedWeeks > maxWeek) {
        const hasRecord = weekActivityRecords.some((ar) => ar.activity_type_id === activityType);
        if (!hasRecord) return "not_applicable";
      }
    }

    // 해당 활동 정보 가져오기
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);

    // activity_records에서 해당 activity_type의 이행 여부 확인
    const record = weekActivityRecords.find((ar) => ar.activity_type_id === activityType);

    // 0. '빈 카드(empty)': 더미데이터의 sentinel 플래그 — 가장 우선 처리
    //    (운영 데이터에는 is_empty 필드가 없으므로 항상 falsy → 기존 분기 영향 없음)
    if ((record as { is_empty?: boolean } | undefined)?.is_empty) return "empty";

    // 활동이 개설되지 않음(is_active=false) → 그 주차에 요구되지 않는 라인 → '해당 없음'.
    // (cluster-4-1 / cluster-4-ranking 통계와 정합 — 양쪽 모두 is_active=true 라인만 분모에 포함.)
    // expInfo 가 있어도 "운영진 개설 누락 시그널" 로 강화 실패 처리하지 않음:
    // 운영진의 개설 결정이 곧 그 주차에 라인이 요구되는지의 source of truth.
    if (!activity?.is_active) {
      return "not_applicable";
    }

    // 라인 개설(is_active) 상태에서 마감(해당 주차 수 22:00 KST) 전 = '강화 대기'(waiting),
    // 마감 후 = '강화 성공'(success). 기입/이행(record.is_completed) 여부는 enhancementStatus 에
    // 영향을 주지 않는다 — 입력 여부는 별도(기입/미기입)로만 표시한다.
    return lineDeadlinePassed ? "success" : "waiting";
  };

  // 강화 상태별 아이콘
  // 'empty'는 뱃지/아이콘을 렌더링하지 않으므로 빈 문자열 (타입 exhaustiveness 보장용)
  const enhancementStatusIcons: { [key in EnhancementStatus]: string } = {
    success: "/images/0/cluster4/icon/5 강화 성공.png",
    waiting: "/images/0/cluster4/icon/6 강화 대기.png",
    failed: "/images/0/cluster4/icon/7 강화 실패.png",
    not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
    empty: "",
  };

  // 특정 activity_type의 2차 정보 가져오기
  const getActivityDetail = (activityType: string) => {
    return weekActivityDetails.find((ad) => ad.activity_type_id === activityType);
  };

  // 2차 정보 작성 마감 시간 이내인지 확인.
  // - 어드민이 weekly_activities.deadline 을 직접 지정한 경우 우선 적용 (옛날 주차 보정 등 특수 오버라이드)
  // - 그 외 기본 시스템 마감: N+1주(목) 12:00 KST = weekStart(월 00:00) + 252h
  //   (= requireWriteWindow / 라인 강화 결정(목 12:01)과 페어인 마감점 — 12:00 닫고 1분 뒤 결과 확정)
  const isBeforeDeadline = (activity: { opened_at: string | null; deadline?: string | null } | null): boolean => {
    if (!activity) return false;
    if (activity.deadline) {
      return Date.now() < new Date(activity.deadline).getTime();
    }
    if (!weekData?.startDate) return false;
    const closeMs = new Date(`${weekData.startDate}T00:00:00+09:00`).getTime() + 252 * 3600 * 1000;
    return Date.now() < closeMs;
  };

  // 어드민 개별 권한(grant)이 활성 상태인지 확인
  const hasActiveGrant = (activityType: string): boolean => {
    const grant = secondaryInfoGrants.find((g) => g.activity_type_id === activityType);
    if (!grant) return false;
    return new Date(grant.deadline).getTime() > Date.now();
  };

  // 활동이 개설되었고 마감 전인지 확인, 또는 어드민 개별 grant가 있는지 확인
  const isActivityActive = (activityType: string): boolean => {
    // Path 1: 기존 플로우 — 파트 개설 + 마감 전
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    if (activity?.is_active && isBeforeDeadline(activity)) return true;
    // Path 2: 어드민 개별 권한 부여 (예외 메커니즘)
    if (hasActiveGrant(activityType)) return true;
    return false;
  };

  // 활동이 개설되었지만 마감 시간이 지났는지 확인 (마감 표시용)
  const isActivityExpired = (activityType: string): boolean => {
    // 어드민 grant가 활성이면 만료 아님
    if (hasActiveGrant(activityType)) return false;
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    if (!activity?.is_active) {
      // 파트 개설 안 됐지만, 만료된 grant가 있으면 만료로 표시
      const grant = secondaryInfoGrants.find((g) => g.activity_type_id === activityType);
      if (grant && new Date(grant.deadline).getTime() <= Date.now()) return true;
      return false;
    }
    // 개설은 되었지만 마감 시간이 지남
    return !isBeforeDeadline(activity);
  };

  // 실무 역량: 아무 activity type이나 개설되었는지 확인
  const isAnyAbilityActivityActive = (): boolean => {
    return workAbilityActivityTypes.some((actType) => isActivityActive(actType));
  };

  // 실무 역량: 모든 activity type이 만료되었는지 확인
  const isAnyAbilityActivityExpired = (): boolean => {
    return workAbilityActivityTypes.some((actType) => isActivityExpired(actType));
  };

  // 실무 역량: 첫 번째 활성화된 activity type ID 가져오기 (모달/저장용)
  const getActiveAbilityActivityType = (): string => {
    const activeType = workAbilityActivityTypes.find((actType) => isActivityActive(actType));
    if (activeType) return activeType;
    // 활성화된 것이 없으면 개설된 것(만료 포함) 찾기
    const openedType = workAbilityActivityTypes.find((actType) => {
      const activity = weeklyActivities.find((a) => a.activity_type_id === actType);
      return activity?.is_active;
    });
    return openedType || workAbilityActivityTypes[0];
  };

  // 남은 시간 계산 (표시용)
  // - 어드민 deadline 직접 지정 시 그것 기준
  // - 그 외 기본: N+1주(목) 12:00 KST = weekStart + 252h
  const getRemainingTime = (activityType: string): { hours: number; minutes: number } | null => {
    const now = Date.now();

    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    if (activity?.is_active) {
      let deadlineTime: number | null = null;
      if (activity.deadline) {
        deadlineTime = new Date(activity.deadline).getTime();
      } else if (weekData?.startDate) {
        deadlineTime = new Date(`${weekData.startDate}T00:00:00+09:00`).getTime() + 252 * 3600 * 1000;
      }
      if (deadlineTime) {
        const remaining = deadlineTime - now;
        if (remaining > 0) {
          return {
            hours: Math.floor(remaining / (60 * 60 * 1000)),
            minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
          };
        }
      }
    }

    // 어드민 grant 확인
    const grant = secondaryInfoGrants.find((g) => g.activity_type_id === activityType);
    if (grant) {
      const deadlineTime = new Date(grant.deadline).getTime();
      const remaining = deadlineTime - now;
      if (remaining > 0) {
        return {
          hours: Math.floor(remaining / (60 * 60 * 1000)),
          minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
        };
      }
    }

    return null;
  };

  // 특정 activity types 중 하나라도 개설되었는지 확인
  const isAnyActivityActive = (activityTypes: string[]): boolean => {
    return activityTypes.some((type) => isActivityActive(type));
  };

  // 빈 output links 배열 생성 헬퍼
  const createEmptyOutputLinks = (): OutputLink[] => {
    return [0, 1, 2, 3, 4].map(() => ({ desc: "", url: "" }));
  };

  // URL에 프로토콜이 없으면 https:// 추가
  const ensureProtocol = (url: string): string => {
    if (!url) return url;
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  // 관리자 점유 링크 슬롯 수.
  // 단일 출처: weekly-cards DTO 의 matchedLine.adminOutputLinkCount (백엔드 SoT).
  // ⚠️ outputLinks.length 추론 금지 (통합 배열이 될 수 있음). 필드가 없을(undefined/null) 때만 legacy fallback.
  const getAdminOutputLinksCount = (activityType: string, matchedLine?: Cluster4WeeklyLineDto): number => {
    const raw = (() => {
      if (matchedLine?.adminOutputLinkCount != null) return matchedLine.adminOutputLinkCount;
      // 실무 경력: career_projects의 output_links에서 가져옴
      const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
      if (careerIndex >= 0 && careerRecords[careerIndex]) {
        return careerRecords[careerIndex].output_links?.filter((l: { url?: string }) => l.url?.trim())?.length || 0;
      }
      const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
      return activity?.output_links?.filter((l) => l.url?.trim())?.length || 0;
    })();
    return Math.min(raw, ADMIN_OUTPUT_LINK_MAX); // 운영진 output link 정책: 최대 1
  };

  // 운영진이 입력한 output links 가져오기 (정책: 최대 1)
  const getAdminOutputLinks = (activityType: string): OutputLink[] => {
    // 실무 경력: career_projects의 output_links에서 가져옴
    const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
    if (careerIndex >= 0 && careerRecords[careerIndex]) {
      return ((careerRecords[careerIndex].output_links || []) as OutputLink[]).slice(0, ADMIN_OUTPUT_LINK_MAX);
    }
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    return (activity?.output_links || []).slice(0, ADMIN_OUTPUT_LINK_MAX);
  };

  // 운영진이 업로드한 output images 가져오기 (정책: 최대 1)
  // 단일 출처: weekly-cards DTO 의 matchedLine.outputImages 가 존재하면 무조건 우선 사용한다 (outputLinks 와 동일 정책).
  // matchedLine 이 없거나 이미지가 비어 있을 때만 legacy(careerRecords/weeklyActivities) fallback.
  const getAdminOutputImages = (
    activityType: string,
    matchedLine?: Cluster4WeeklyLineDto,
  ): Array<{ url: string; caption: string }> => {
    const lineImages = normalizeOutputImages(
      matchedLine?.outputImages as
        | ReadonlyArray<string | { url?: string | null; caption?: string | null } | null>
        | null
        | undefined,
    );
    if (lineImages.length > 0) return lineImages.slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    // 실무 경력: career_projects.output_images (career_records API 가 project 정보 같이 반환)
    const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
    if (careerIndex >= 0 && careerRecords[careerIndex]) {
      return normalizeOutputImages(careerRecords[careerIndex].output_images).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    }
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    return normalizeOutputImages(activity?.output_images).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
  };
  // 관리자 점유 이미지 슬롯 수. (정책: 최대 1)
  // 단일 출처: matchedLine.adminOutputImageCount (백엔드 SoT). ⚠️ outputImages.length 추론 금지.
  // 필드가 없을(undefined/null) 때만 legacy(getAdminOutputImages 길이) fallback.
  const getAdminOutputImagesCount = (activityType: string, matchedLine?: Cluster4WeeklyLineDto): number => {
    const base =
      matchedLine?.adminOutputImageCount != null
        ? matchedLine.adminOutputImageCount
        : getAdminOutputImages(activityType, matchedLine).length;
    // 예약 슬롯 모델(2026-07-18): 운영진 슬롯 0 은 이미지 유무·라인 매칭 성패와 무관하게 **항상 예약** — 크루는
    //   2번 슬롯부터. admin DTO(v47) adminOutputImageCount=RESERVED_ADMIN_IMAGE_SLOTS 무조건 송신 계약과 동일.
    //   ⚠️ fail-safe: matchedLine 부재/DTO 불완전/stale snapshot(구 count=0)에서도 무조건 floor(라인 조회 실패를
    //   "운영진 슬롯 없음"으로 해석하지 않는다 — 크루 첫 이미지가 1번으로 밀리는 걸 막는다).
    const reserved = Math.max(base, RESERVED_ADMIN_IMAGE_SLOTS);
    return Math.min(reserved, ADMIN_OUTPUT_IMAGE_MAX); // 운영진 output image 정책: 최대 1
  };

  // 편집 모달 열 때 초기화
  const initializeEditingDetails = () => {
    const newEditingDetails: { [key: string]: { subTitle: string; outputLinks: OutputLink[] } } = {};

    // 모든 activity types에 대해 초기화 (실무 정보 + 실무 역량 + 실무 경험 + 실무 경력)
    allActivityTypes.forEach((activityType) => {
      const detail = getActivityDetail(activityType);
      const adminLinks = getAdminOutputLinks(activityType);
      const userLinks = detail?.output_links || [];

      // 5개 슬롯 생성: 운영진 링크 → 사용자 링크 → 빈 슬롯
      const paddedLinks: OutputLink[] = [];
      const adminCount = adminLinks.filter((l) => l.url?.trim()).length;

      for (let i = 0; i < 5; i++) {
        if (i < adminCount && adminLinks[i]?.url?.trim()) {
          // 운영진 링크 (수정 불가)
          paddedLinks.push({ ...adminLinks[i] });
        } else {
          // 사용자 링크 (수정 가능)
          const userLinkIndex = i - adminCount;
          if (userLinks[userLinkIndex]?.url?.trim()) {
            paddedLinks.push({ ...userLinks[userLinkIndex] });
          } else {
            paddedLinks.push({ desc: "", url: "" });
          }
        }
      }

      newEditingDetails[activityType] = {
        subTitle: detail?.sub_title || "",
        outputLinks: paddedLinks,
      };
    });

    setEditingDetails(newEditingDetails);
  };

  // 2차 정보 저장 (운영진 링크 제외, 사용자 링크만 저장)
  const saveActivityDetail = async (activityType: string) => {
    if (isDemoMode) {
      console.log("Demo: 활동 상세 저장", activityType, editingDetails[activityType]);
      return;
    }
    if (!currentUserId || !weekId) return;

    setIsSaving(true);
    try {
      const detail = editingDetails[activityType];
      if (!detail) return;

      // 운영진 링크 개수 확인
      const adminCount = getAdminOutputLinksCount(activityType);

      // 운영진 링크 이후의 사용자 링크만 필터링 (빈 링크 제외)
      const userLinks = detail.outputLinks.slice(adminCount).filter((link) => link.url.trim() !== "");

      // 기존 DB 데이터와 비교하여 변경이 없으면 스킵
      const existing = getActivityDetail(activityType);
      const newSubTitle = detail.subTitle || null;
      const newOutputLinks = userLinks.length > 0 ? userLinks : null;
      const existingSubTitle = existing?.sub_title || null;
      const existingOutputLinks = existing?.output_links && existing.output_links.length > 0 ? existing.output_links : null;

      if (newSubTitle === existingSubTitle && JSON.stringify(newOutputLinks) === JSON.stringify(existingOutputLinks)) {
        setIsSaving(false);
        return; // 변경 없음 — API 호출 스킵
      }

      const response = await fetch(apiUrl("/api/activity-details"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          // 테스트 유저 모드: demoUserId 가 있으면 백엔드가 이 id 로 저장 대상/작성기간을 고정한다.
          // (admin /test-users 무세션 진입은 effectiveDemoUserId 가 mode=test 대상 userId 로 채워진다.)
          ...(effectiveDemoUserId ? { demoUserId: effectiveDemoUserId } : {}),
          week_id: weekId,
          activity_type_id: activityType,
          sub_title: newSubTitle,
          output_links: newOutputLinks,
        }),
      });

      await readJsonSafe(response);
    } catch (error) {
      console.error("Error saving activity detail:", error);
      await popup.alert(apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  // 통계 재계산 함수 (저장 후 즉시 업데이트용 - 강화 성공 기준: is_completed + 마감 도달)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recalculateStats = (_updatedDetails: ActivityDetail[]) => {
    const activeActivities = weeklyActivities.filter((a) => a.is_active);

    // 강화 성공 = '라인 개설(is_active) + 마감(수 22:00 KST) 도달'. 기입/이행 여부는 보지 않는다.
    // 마감 전 → success 미집계, 마감 후 → 열린 라인을 success 로 집계 (getEnhancementStatus 와 동일).
    const openActivityTypeIds = new Set(activeActivities.map((a) => a.activity_type_id));
    const isEnhancementSuccessLocal = (activityTypeId: string): boolean => {
      if (!lineDeadlinePassed) return false;
      return openActivityTypeIds.has(activityTypeId);
    };

    const calcStats = (types: string[]) => {
      const total = activeActivities.filter((a) => types.includes(a.activity_type_id)).length;
      const success = types.filter((activityTypeId) => isEnhancementSuccessLocal(activityTypeId)).length;

      return { total, success };
    };

    const infoTypes = ["calendar", "essay", "forum", "infodesk", "session", "wisdom", "practical_lecture", "community", "etc_a"];
    // 온보딩 주차 / 개인 휴식이면 강화율 0. 공식 휴식은 예외 활동 있으면 자연스럽게 반영.
    // phase(집계 중) 에 가려지지 않도록 phase-독립 플래그 사용.
    if (isOnboardingWeek || weekData?.isPersonalRest) {
      setInfoStats({ total: 0, success: 0 });
      setCompetencyStats({ total: 0, success: 0 });
      setExperienceStats({ total: 0, success: 0 });
      setCareerStats({ total: 0, success: 0 });
    } else {
      setInfoStats(calcStats(infoTypes));
      const competencyCalc = calcStats(competencyTypeIds);
      // 평소 매주 최대 1개. 공식 휴식 주차는 예외 개설 있을 때만 1.
      const isClubBreakNow = !!weekData?.isOfficialRest;
      const competencyTotalNow = isClubBreakNow ? (competencyCalc.total > 0 ? 1 : 0) : 1;
      setCompetencyStats({ total: competencyTotalNow, success: competencyCalc.success > 0 ? 1 : 0 });
      setExperienceStats(calcStats(experienceTypeIds));
      setCareerStats(calcStats(careerTypeIds));
    }
  };

  // 저장 후 weekActivityDetails 상태 즉시 업데이트 (공통 함수)
  const updateWeekActivityDetailsAfterSave = (activityTypes: string[]) => {
    setWeekActivityDetails((prev) => {
      const updatedDetails = [...prev];
      activityTypes.forEach((activityType) => {
        const detail = editingDetails[activityType];
        // 운영진 링크 제외, 사용자 링크만 로컬 상태에 저장 (DB 저장과 동일하게)
        const adminCount = getAdminOutputLinksCount(activityType);
        const validLinks = detail?.outputLinks.slice(adminCount).filter((link) => link.url.trim() !== "") || [];
        const newDetail = {
          week_id: weekId,
          activity_type_id: activityType,
          sub_title: detail?.subTitle || null,
          output_links: validLinks.length > 0 ? validLinks : null,
        };
        const existingIndex = updatedDetails.findIndex((d) => d.activity_type_id === activityType);
        if (existingIndex >= 0) {
          updatedDetails[existingIndex] = newDetail;
        } else {
          updatedDetails.push(newDetail);
        }
      });

      // 통계 즉시 재계산
      recalculateStats(updatedDetails);

      return updatedDetails;
    });
  };

  // 모든 실무 정보 카드 저장
  const saveAllActivityDetails = async () => {
    setIsSaving(true);
    try {
      for (const activityType of workInfoActivityTypes) {
        await saveActivityDetail(activityType);
      }

      // 저장 후 weekActivityDetails 상태 즉시 업데이트
      updateWeekActivityDetailsAfterSave(workInfoActivityTypes);

      await popup.alert("저장되었습니다.");
      setWorkInfoModalOpen(false);
    } catch (error) {
      console.error("Error saving all activity details:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 실무 정보 카드 데이터 (DB 데이터 기반 + 빈 카드 2개)
  // DTO enhancementStatus("success"|"pending"|"fail"|"not_applicable") → 카드 enum 매핑.
  // (experience 의 mapExpEnhancementStatus 와 동일 정책 — 프론트 재계산 금지, DTO 값만 사용.)
  // 휴식/온보딩 특수 주차 또는 DTO 라인 부재 시에만 legacy getEnhancementStatus 로 fallback.
  const mapInfoEnhancementStatus = (line: Cluster4WeeklyLineDto | null | undefined, activityType: string): EnhancementStatus => {
    if (isOnboardingWeek || weekData?.isPersonalRest || isRestMode) return getEnhancementStatus(activityType);
    const raw = String(line?.enhancementStatus ?? "").toLowerCase();
    if (raw === "success") return "success";
    if (raw === "pending") return "waiting";
    if (raw === "fail" || raw === "failed") return "failed";
    if (raw === "not_applicable") return "not_applicable";
    // DTO 라인이 존재하나 강화 상태가 비어있으면(미평가) '강화 대기'로 표시 — 개설된 라인이므로 숨기지 않는다.
    if (line) return "waiting";
    return getEnhancementStatus(activityType);
  };

  // ── 카드 source = DTO information 라인(infoLinesInWeek) 우선, legacy(weeklyActivities/weekActivityDetails) fallback ──
  // career(buildCareerCardFromLine) 패턴 이식: synthetic fail / lineTargetId=null 라인도 line.* top-level 표시.
  // mainTitle/outputLinks/outputImages 는 submission 이 아니라 DTO line top-level 에서 읽는다.
  // 편집 가능 라인(lineTargetId 보유)이 있으면 strict 우선 매칭 → canEdit/저장 게이트 회귀 방지.
  const workInfoCards = [
    ...workInfoActivityTypes.map((activityType, index) => {
      const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
      const detail = weekActivityDetails.find((d) => d.activity_type_id === activityType);
      const config = activityTypeConfig[activityType];
      const matchedLine =
        findCluster4Line({ partType: "information", activityTypeKey: activityType }) ??
        findCluster4Line({ partType: "information", activityTypeKey: activityType }, { requireLineTargetId: false });
      // 강화 상태: DTO enhancementStatus 단일 출처(매핑) → legacy fallback.
      const enhancementStatus = mapInfoEnhancementStatus(matchedLine, activityType);

      // Output Links 병합: 운영진 = matchedLine.outputLinks(DTO) 우선, 비었을 때만 legacy activity.output_links.
      //   사용자 = legacy detail.output_links (어드민 개수만큼 오프셋).
      const adminLinks: { desc: string; url: string }[] =
        Array.isArray(matchedLine?.outputLinks) && matchedLine!.outputLinks!.length > 0
          ? matchedLine!.outputLinks!.map((l) => ({
              desc: ((l?.desc as string | null | undefined) ?? (l?.label as string | null | undefined) ?? ""),
              url: ((l?.url as string | null | undefined) ?? ""),
            }))
          : (activity?.output_links || []).map((l: { desc?: string | null; url?: string | null }) => ({ desc: l.desc || "", url: l.url || "" }));
      const userLinks = detail?.output_links || [];
      const adminCount = adminLinks.filter((l) => l.url?.trim()).length;
      const mergedOutputLinks: { desc: string; url: string }[] = [];
      for (let i = 0; i < 5; i++) {
        if (i < adminCount && adminLinks[i]?.url?.trim()) {
          // 운영진 링크
          mergedOutputLinks.push({ desc: adminLinks[i].desc || "", url: adminLinks[i].url || "" });
        } else {
          // 사용자 링크 (운영진 링크 개수만큼 오프셋)
          const userLinkIndex = i - adminCount;
          if (userLinks[userLinkIndex]?.url?.trim()) {
            mergedOutputLinks.push({ desc: userLinks[userLinkIndex].desc || "", url: userLinks[userLinkIndex].url || "" });
          } else {
            mergedOutputLinks.push({ desc: "", url: "" });
          }
        }
      }

      // 이미지: 운영진 = matchedLine.outputImages(DTO) 우선, 없으면 legacy activity.output_images.
      //   크루 = legacy detail.image_urls (어드민 URL 중복 제거). experience 병합 패턴과 동일.
      const lineImgs = normalizeOutputImages(
        matchedLine?.outputImages as ReadonlyArray<string | { url?: string | null; caption?: string | null } | null> | null | undefined,
      );
      const adminImgs = lineImgs.length > 0 ? lineImgs : normalizeOutputImages(activity?.output_images);
      const adminUrlSet = new Set(adminImgs.map((i) => i.url));
      const rawCrewImgs: (string | null | undefined)[] = detail?.image_urls || [];
      const rawCrewCaps: string[] = detail?.image_captions || [];
      const crewImgs: (string | null)[] = [];
      const crewCaps: string[] = [];
      for (let i = 0; i < rawCrewImgs.length; i++) {
        const u = rawCrewImgs[i];
        if (u && adminUrlSet.has(u)) continue;
        crewImgs.push(u || null);
        crewCaps.push(rawCrewCaps[i] || "");
      }
      // card.images/imageCaptions = 크루(사용자) 제출 이미지 전용. 모달 그리드는 어드민 슬롯을
      // getAdminOutputImages 로 별도 렌더하므로, 여기서 admin 을 prepend(merged)하면 첫 크루 슬롯이
      // card.images[0](=admin URL)을 다시 읽어 동일 이미지가 large+small 두 번 렌더된다.
      // (2026-06-09 정책: output image 1장 = 화면 1회 렌더.) → crew-only 로 유지.

      return {
        id: index + 1,
        activityType,
        // Main Title: DTO line.mainTitle 우선 → legacy activity.title → '-' (submission 아님)
        title: (matchedLine?.mainTitle as string | null | undefined) || activity?.title || "-",
        // subtitle/growthPoint 는 사용자 제출값 — canonical submission 우선 → legacy detail 폴백 → "".
        // (cluster4_line_submissions 가 line 단위 SoT. detail 은 activity_type 단위라 멀티라인/stale 시 가림)
        subTitle: ((matchedLine?.submission as { subtitle?: string | null } | null | undefined)?.subtitle ?? null) ?? detail?.sub_title ?? "",
        growthPoint: ((matchedLine?.submission as { growthPoint?: string | null } | null | undefined)?.growthPoint ?? null) ?? detail?.growth_point ?? "",
        verified: true,
        category: config?.category || activityType,
        tagColor: config?.tagColor || "",
        status: enhancementStatus,
        statusIcon: enhancementStatusIcons[enhancementStatus],
        icon: config?.icon || "",
        isFruit: config?.isFruit || false,
        isFailed: enhancementStatus === "failed",
        isEmpty: false,
        outputLinks: mergedOutputLinks,
        images: normalizeWorkInfoImages(crewImgs),
        imageCaptions: normalizeWorkInfoCaptions(crewCaps),
        // preview·modal 단일 source — 모달이 동일 객체를 그대로 사용. lineTargetId=null 이면 canEdit 게이트가 차단.
        matchedLine: matchedLine ?? null,
        lineTargetId: (matchedLine?.lineTargetId as string | null | undefined) ?? null,
      };
    }),
  ];

  // 휴식 모드(공식/개인) — 카드 전부 '해당 없음' 상태로, Main Title 도 강제로 '-'.
  // 본문 중 카테고리/아이콘 등은 보존하고 Main Title 만 차폐. 라인 개설 여부와 무관.
  const effectiveWorkInfoCards = isRestMode
    ? workInfoCards.map((card) => ({
        ...card,
        title: "",
        status: "not_applicable" as EnhancementStatus,
        statusIcon: enhancementStatusIcons["not_applicable"],
        verified: false,
        isFailed: false,
      }))
    : workInfoCards;

  // ── 미리보기/모달 카드 SoT = 모달과 동일한 DTO competency 라인 ──
  // (버그 수정) 기존엔 하드코딩 workAbilityLineMap(CP00A-NS00xx)의 lineCode 로만 DTO 라인을 findCluster4Line
  // 매칭해서, 운영진이 실제 개설한 라인코드(예: CPBS-NN0007)가 맵에 없으면 매칭이 전부 실패 → 카드가 void 로
  // 표시됐다. → DTO competency 라인(partType==="competency")을 카드 source 로 직접 사용한다.
  // ⚠️ submission=null 은 '미제출'일 뿐 '라인 없음'이 아니므로 제외하지 않는다(admin 개설값은 그대로 표시).
  const competencyLinesInWeek: Cluster4WeeklyLineDto[] = weekId
    ? cluster4Lines.filter((l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "competency")
    : [];

  // DTO enhancementStatus("success"|"pending"|"fail"|"not_applicable") → 카드 enum 매핑(experience 와 동일 규칙).
  // 프론트 재계산 금지 — DTO 값만 사용. 휴식/온보딩 특수 주차 또는 DTO 값 부재 시에만 legacy getEnhancementStatus.
  const mapAbilityEnhancementStatus = (line: Cluster4WeeklyLineDto | null | undefined, activityTypeId: string): EnhancementStatus => {
    if (isOnboardingWeek || weekData?.isPersonalRest || isRestMode) return getEnhancementStatus(activityTypeId);
    // (정책 2026-06-04 v14 개정) 백엔드 enhancementStatus 를 그대로 반영한다 — 역량은 1인·1주차
    // 단일 칸 정규화로 백엔드가 success/pending/fail 중 하나를 항상 내려주며(미수행·미개설=pending
    // "강화 대기" placeholder), 활동 주차에 '해당 없음'은 존재할 수 없다.
    //   - pending 은 lineTargetId 유무와 무관하게 '강화 대기'로 렌더한다 (구 2026-06-02 보이드
    //     정책의 "미배정 pending → 해당 없음" 강등 폐기 — 선택 과제 미수행=대기).
    //   - not_applicable 은 휴식/전환 주차 placeholder 에서만 내려온다(그대로 반영).
    const raw = String(line?.enhancementStatus ?? "").toLowerCase();
    if (raw === "success") return "success";
    if (raw === "fail" || raw === "failed") return "failed";
    if (raw === "not_applicable") return "not_applicable";
    if (raw === "pending") return "waiting";
    // enhancementStatus 미상/빈 값: 라인이 있으면 미평가 → 강화 대기 (해당 없음 금지).
    if (line) return "waiting";
    return getEnhancementStatus(activityTypeId);
  };

  // 어드민 개설값(top-level) + 사용자 제출값(submission.*) 병합으로 Output Link 5슬롯 구성.
  const buildAbilityOutputLinks = (
    adminSrc: Array<{ desc?: string | null; url?: string | null }>,
    adminCount: number,
    userSrc: Array<{ desc?: string | null; url?: string | null }>,
  ): { desc: string; url: string }[] => {
    const merged: { desc: string; url: string }[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < adminCount && adminSrc[i]?.url?.trim()) {
        merged.push({ desc: adminSrc[i].desc || "", url: adminSrc[i].url || "" });
      } else {
        const userIdx = i - adminCount;
        merged.push(userSrc[userIdx]?.url?.trim() ? { desc: userSrc[userIdx].desc || "", url: userSrc[userIdx].url || "" } : { desc: "", url: "" });
      }
    }
    return merged;
  };

  type WorkAbilityCard = {
    id: number;
    lineTargetId: string | null;
    competencyLineMasterId: string | null;
    activityTypeId: string;
    code: string;
    lineCode: string;
    // 고객 표시용 공식 코드(DTO displayLineCode). 없으면 null → code-tag 숨김(내부 code fallback 금지).
    displayCode: string | null;
    lineName: string;
    badge: string;
    title: string;
    subTitle: string;
    growthPoint: string;
    outputLinks: { desc: string; url: string }[];
    images: (string | null)[] | null;
    imageCaptions: string[] | null;
    icon: string;
    status: EnhancementStatus;
    statusIcon: string;
    enhancementStatus: EnhancementStatus;
    isFailed: boolean;
    isEmpty: boolean;
    hasActivity: boolean;
  };

  // 카드 1개를 DTO competency 라인에서 생성. admin 개설값은 top-level(line.*), 사용자 제출값은 submission.*.
  const buildAbilityCardFromLine = (line: Cluster4WeeklyLineDto, index: number): WorkAbilityCard => {
    const lineCode = (line.lineCode as string | null | undefined) ?? null;
    const mapping = lookupWorkAbilityMapping(lineCode);
    // activityTypeId: DTO 우선, 없으면 lineCode 로 competency activity type 역추적(저장 경로용 best-effort).
    const activityTypeId =
      (line.activityTypeId as string | null | undefined) ??
      (line.activityTypeKey as string | null | undefined) ??
      workAbilityActivityTypes.find((typeId) => {
        const lc = activityTypesMap.get(typeId)?.line_code || typeId;
        return lc.replace(/\s+/g, "") === String(lineCode ?? "").replace(/\s+/g, "");
      }) ??
      "";
    const activity = activityTypeId ? weeklyActivities.find((a) => a.activity_type_id === activityTypeId) : undefined;
    const enhancementStatus = isRestMode ? ("not_applicable" as EnhancementStatus) : mapAbilityEnhancementStatus(line, activityTypeId);

    const submission = (line.submission as
      | {
          subtitle?: string | null;
          growthPoint?: string | null;
          outputLinks?: Array<{ desc?: string | null; url?: string | null }> | null;
          outputImages?: Array<string | null> | null;
          outputImageCaptions?: Array<string | null> | null;
        }
      | null
      | undefined) ?? null;

    // Output Link 병합: 어드민 개설값(top-level line.outputLinks) + 사용자 제출값(submission.outputLinks).
    // 어드민 슬롯 수 = adminOutputLinkCount(백엔드 SoT), 없으면 top-level outputLinks 유효 개수 fallback.
    const adminLinks: Array<{ desc?: string | null; url?: string | null }> = Array.isArray(line.outputLinks)
      ? line.outputLinks.map((l) => ({ desc: (l?.desc as string | null | undefined) ?? "", url: (l?.url as string | null | undefined) ?? "" }))
      : [];
    const adminCount = line.adminOutputLinkCount != null ? line.adminOutputLinkCount : adminLinks.filter((l) => l.url?.trim()).length;
    const userLinks: Array<{ desc?: string | null; url?: string | null }> = Array.isArray(submission?.outputLinks)
      ? submission!.outputLinks!.map((l) => ({ desc: l?.desc ?? "", url: l?.url ?? "" }))
      : [];
    // 라인명: 백엔드 lineName(master.line_name) 1순위 → legacy mapping → activityTypeName.
    const lineName =
      (line.lineName as string | null | undefined) ||
      mapping?.lineName ||
      (line.activityTypeName as string | null | undefined) ||
      "";
    const card: WorkAbilityCard = {
      id: index + 1,
      lineTargetId: (line.lineTargetId as string | null | undefined) ?? null,
      competencyLineMasterId: (line.competencyLineMasterId as string | null | undefined) ?? null,
      activityTypeId,
      code: lineCode ?? mapping?.lineCode ?? "",
      lineCode: lineCode ?? mapping?.lineCode ?? "",
      // 고객 표시용 공식 코드 — DTO displayLineCode 단일 출처. 없으면 null(숨김).
      displayCode: (line.displayLineCode as string | null | undefined) ?? null,
      lineName,
      badge: lineName,
      // admin 개설값 — top-level mainTitle 우선.
      title: (line.mainTitle as string | null | undefined) ?? activity?.title ?? mapping?.mainTitle ?? "",
      // 사용자 제출값 — submission.* 단일 출처. 미제출(submission=null) 시 빈 값 → 화면에서 "-" fallback.
      subTitle: submission?.subtitle ?? "",
      growthPoint: submission?.growthPoint ?? "",
      outputLinks: buildAbilityOutputLinks(adminLinks, adminCount, userLinks),
      images: normalizeWorkInfoImages((submission?.outputImages as (string | null)[] | undefined) || undefined) as (string | null)[] | null,
      imageCaptions: normalizeWorkInfoCaptions((submission?.outputImageCaptions as string[] | undefined) || undefined) as string[] | null,
      icon: getWorkAbilityIcon(lineName),
      status: enhancementStatus,
      statusIcon: enhancementStatusIcons[enhancementStatus],
      enhancementStatus,
      isFailed: enhancementStatus === "failed",
      isEmpty: false,
      hasActivity: true,
    };
    // 실패 시 내용 차폐는 공용 voidAbilityCardOnFail(아래)에서 일괄 적용 — 역량 실패=보이드 최종 정책.
    return card;
  };

  // legacy 하드코딩 맵 기반 카드 빌더 — DTO competency 라인이 전혀 없을 때만 fallback(데모/회귀 방지).
  const buildLegacyAbilityCard = (lineCodeKey: string, index: number): WorkAbilityCard => {
    const mapping = workAbilityLineMap[lineCodeKey];
    const matchedActivityTypeId = workAbilityActivityTypes.find((typeId) => {
      const lineCode = activityTypesMap.get(typeId)?.line_code || typeId;
      return lineCode.replace(/\s+/g, "") === lineCodeKey;
    });
    const activityTypeId = matchedActivityTypeId || lineCodeKey;
    const activityTypeInfo = matchedActivityTypeId ? activityTypesMap.get(matchedActivityTypeId) : undefined;
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityTypeId);
    const enhancementStatus = isRestMode ? ("not_applicable" as EnhancementStatus) : getEnhancementStatus(activityTypeId);

    const abilityMatchedLine = findCluster4Line(
      { partType: "competency", competencyLineMasterId: null, lineCode: mapping.lineCode, activityTypeId },
      { requireLineTargetId: false },
    );
    const abilitySubmission = (abilityMatchedLine?.submission as
      | { subtitle?: string | null; growthPoint?: string | null; outputLinks?: Array<{ desc?: string | null; url?: string | null }> | null; outputImages?: Array<string | null> | null; outputImageCaptions?: Array<string | null> | null }
      | null
      | undefined) ?? null;
    const adminLinks: Array<{ desc?: string | null; url?: string | null }> = Array.isArray(abilityMatchedLine?.outputLinks)
      ? abilityMatchedLine!.outputLinks!.map((l) => ({ desc: (l?.desc as string | null | undefined) ?? "", url: (l?.url as string | null | undefined) ?? "" }))
      : (activity?.output_links || []);
    const adminCount = abilityMatchedLine?.adminOutputLinkCount != null ? abilityMatchedLine.adminOutputLinkCount : adminLinks.filter((l) => l.url?.trim()).length;
    const userLinks: Array<{ desc?: string | null; url?: string | null }> = Array.isArray(abilitySubmission?.outputLinks)
      ? abilitySubmission!.outputLinks!.map((l) => ({ desc: l?.desc ?? "", url: l?.url ?? "" }))
      : [];
    return {
      id: index + 1,
      lineTargetId: (abilityMatchedLine?.lineTargetId as string | null | undefined) ?? null,
      competencyLineMasterId: (abilityMatchedLine?.competencyLineMasterId as string | null | undefined) ?? null,
      activityTypeId,
      code: mapping.lineCode,
      lineCode: mapping.lineCode,
      // legacy 하드코딩 fallback(DTO competency 라인이 0개일 때만 — 데모/회귀). mapping.lineCode 는
      // 큐레이션된 표시용 친화 코드(내부 생성 코드 아님)이므로 그대로 표시한다.
      displayCode: mapping.lineCode,
      lineName: mapping.lineName,
      badge: mapping.lineName,
      title: activity?.title || mapping.mainTitle,
      subTitle: abilitySubmission?.subtitle ?? "",
      growthPoint: abilitySubmission?.growthPoint ?? "",
      outputLinks: buildAbilityOutputLinks(adminLinks, adminCount, userLinks),
      images: normalizeWorkInfoImages((abilitySubmission?.outputImages as (string | null)[] | undefined) || undefined) as (string | null)[] | null,
      imageCaptions: normalizeWorkInfoCaptions((abilitySubmission?.outputImageCaptions as string[] | undefined) || undefined) as string[] | null,
      icon: getWorkAbilityIcon(mapping.lineName),
      status: enhancementStatus,
      statusIcon: enhancementStatusIcons[enhancementStatus],
      enhancementStatus,
      isFailed: enhancementStatus === "failed",
      isEmpty: false,
      hasActivity: !!activity || !!activityTypeInfo,
    };
  };

  // 역량 실패 = 보이드 내용 차폐 (역량 전용 최종 정책 — DTO/legacy 빌더 공통 적용).
  const voidAbilityCardOnFail = (card: WorkAbilityCard): WorkAbilityCard =>
    card.enhancementStatus === "failed"
      ? { ...card, code: "-", lineCode: "-", lineName: "-", badge: "-", title: "", subTitle: "", growthPoint: "", outputLinks: [], images: null, imageCaptions: null, icon: "" }
      : card;

  const workAbilityCards: WorkAbilityCard[] = (
    competencyLinesInWeek.length > 0
      ? competencyLinesInWeek.map((line, index) => buildAbilityCardFromLine(line, index))
      : workAbilityCardLineCodes.map((lineCodeKey, index) => buildLegacyAbilityCard(lineCodeKey, index))
  ).map(voidAbilityCardOnFail);

  // 휴식 모드(공식/개인) — 본문(Main Title, lineCode, lineName, Sub Title) 모두 강제 '-'.
  // 휴식 주차에는 실무 역량 라인이 의미 없으므로 본문 전부 차폐, 상태도 '해당 없음'.
  const effectiveWorkAbilityCards = isRestMode
    ? workAbilityCards.map((card) => ({
        ...card,
        title: "",
        subTitle: "",
        lineCode: "-",
        lineName: "-",
        code: "-",
        badge: "-",
        status: "not_applicable" as EnhancementStatus,
        statusIcon: enhancementStatusIcons.not_applicable,
        enhancementStatus: "not_applicable" as EnhancementStatus,
        isFailed: false,
      }))
    : workAbilityCards;

  // 실무 역량: 단일 표시 카드 — 강화 성공/실패/대기인 카드 우선, 모두 not_applicable이면 보이드.
  // 크루가 활동 중(휴식/온보딩 아님)이면 매칭 실패 시 '강화 실패'로 폴백.
  // 휴식 주차 — 모든 카드가 not_applicable 이라 status 기반 매칭이 안 되므로, 운영진이 실제
  // 개설한 라인(hasActivity) 을 우선 찾아 본문(Main Title 등) 을 보여주고 상태만 '해당 없음'.
  // 실제 개설된 역량 라인(realCompetencyLines)이 0개면 매칭 카드 없음 → 빈 상태(empty) 강제.
  // legacy 하드코딩 카드 synthesis(workAbilityCardLineCodes)는 '실제 DTO 라인'이 아니므로
  // 표시 기준에서 제외한다 (2026-06-09: snapshot DTO 실제 line 목록만 표시 기준).
  const matchedAbilityCard = isRestMode
    ? effectiveWorkAbilityCards.find((c) => c.hasActivity)
    : realCompetencyLines.length === 0
      ? undefined
      : effectiveWorkAbilityCards.find((c) => c.enhancementStatus !== "not_applicable");
  // void 폴백 상태: 휴식/온보딩이면 '해당 없음'. 활동 주차에서 실제 개설된 역량 라인이 없으면
  // '강화 대기'가 아니라 빈 상태('empty') — empty 는 뱃지/아이콘 미렌더(강화 대기 표시 안 함),
  // 카운트도 0 (competencyStatsAdmin 와 동일 realCompetencyLines 기준). (2026-06-09 정책:
  //  구 v14 "미수행=강화 대기 placeholder" 폐기 — 실제 라인 0개 = 빈 상태 안내만 표시.)
  // (2026-07 정책 정정 — 기존 2026-06-26 정책 D 철회) 역량 라인이 그 주차에 하나도 개설되지 않은
  //   (realCompetencyLines=0 → 집계 총 0) 확정 주차를 '강화 실패'로 표시하던 것을 '해당 없음'으로 바꾼다.
  //   기존 policy D 는 "강화 실패(표시) + 총 0개(집계)" 모순을 만들었다(집계·표시 SoT 불일치). '강화 실패'는
  //   반드시 분모에 잡히는(총≥1) 경우에만 쓴다 — 비대상 synthetic fail 은 어드민 DTO 에
  //   enhancementStatus="fail"·den=1 로 내려오므로 realCompetencyLines>0 → 위 matchedAbilityCard 로 정상
  //   표시·집계된다. 라인 자체가 없는(총 0) 폴백은 '해당 없음(not_applicable)' — not_applicable 만 집계
  //   제외(총 0)라는 규칙과 정합해 "강화 실패 + 총 0" 조합을 제거한다. 미확정 주차는 기존대로 빈 상태('empty',
  //   뱃지 없음) 유지(섣부른 상태 표시 금지). 휴식/온보딩(not_applicable) 불변.
  const abilityWeekResultClass = cardBadgeClassFromLabel(
    weeklyCardMeta?.statusLabel ?? "",
    cardStatusToneClass(weeklyCardMeta?.statusTone),
  );
  const isAbilityWeekResultConfirmed =
    abilityWeekResultClass === "success" || abilityWeekResultClass === "fail";
  const abilityVoidFallbackStatus: EnhancementStatus =
    isRestMode || isOnboardingWeek
      ? "not_applicable"
      : isAbilityWeekResultConfirmed
        ? "not_applicable" // 확정 무-라인(총 0) → '해당 없음'(기존 'failed' 철회 — 강화 실패+총0 모순 제거)
        : "empty"; // 미확정 무-라인 → 빈 상태(뱃지 없음) 유지
  const displayedAbilityCard: WorkAbilityCard = matchedAbilityCard ?? {
    id: 0,
    lineTargetId: null,
    competencyLineMasterId: null,
    activityTypeId: "",
    code: "-",
    lineCode: "-",
    displayCode: null,
    lineName: "-",
    badge: "-",
    title: "",
    subTitle: "",
    growthPoint: "",
    outputLinks: [] as { desc: string; url: string }[],
    images: null as (string | null)[] | null,
    imageCaptions: null as string[] | null,
    icon: "",
    status: abilityVoidFallbackStatus,
    statusIcon: enhancementStatusIcons[abilityVoidFallbackStatus],
    enhancementStatus: abilityVoidFallbackStatus,
    // 폴백 상태: 휴식/온보딩·확정 무-라인=해당없음(not_applicable), 미확정 무-라인=빈 상태('empty').
    //   (2026-07: 확정 무-라인 'failed' 철회 — 강화 실패+총0 모순 제거. 폴백은 더 이상 'failed' 가 아니다.)
    isFailed: abilityVoidFallbackStatus === "failed",
    isEmpty: true,
    hasActivity: false,
  };
  // 실무 역량 = 1인·1주차 단일 카드 정규화. 실제 개설된 라인이 1개 이상이면 그 카드를 렌더하고,
  // 0개면(realCompetencyLines.length===0) 빈 상태 placeholder('empty', 강화 대기 아님)만 렌더한다.
  // section-count·강화율도 동일 realCompetencyLines 기준 → 카드 표시와 카운트가 항상 일치(2026-06-09).
  // section-count(총 1) == 표시 카드 1 == 주차 성장률 분모 기여 1.
  const displayedAbilityCards: WorkAbilityCard[] = [displayedAbilityCard];

  // 실무 경험 카드 데이터 — 이 크루에게 어드민/시스템이 실제로 처리한 라인만 동적 생성.
  // 운영진이 크루별로 실무 경험 라인을 임의 대체/지정 가능 → hardcoded workExpLineMap 6 라인을
  // 기준으로 띄우면 운영진 결정과 무관한 카드가 강제로 노출됨.
  // weeklyActivities.is_active=true (전체 일괄 개설) 만으로는 부족 — 어드민이 그 주차에
  // 이 크루에게 라인을 적용 안 했어도 is_active 가 true 일 수 있음. source of truth 는
  // user_activity_records 존재 여부 (크루 이행 인증 시 또는 어드민이 강화 성공/실패 마크 시 생성).
  // workExpLineMap 은 라인 본문이 비어있을 때 표시용 fallback 으로만 사용.
  const adminProcessedExpTypeIds: string[] = [];
  const seenExpTypeIds = new Set<string>();
  weekActivityRecords.forEach((ar) => {
    if (experienceTypeIds.includes(ar.activity_type_id) && !seenExpTypeIds.has(ar.activity_type_id)) {
      seenExpTypeIds.add(ar.activity_type_id);
      adminProcessedExpTypeIds.push(ar.activity_type_id);
    }
  });

  // ── 미리보기 카드 SoT = 모달과 동일한 DTO experience 라인 ──
  // (버그) 기존엔 user_activity_records(adminProcessedExpTypeIds) 존재 여부로만 카드를 만들어,
  // 백엔드가 DTO 로 experience 라인을 내려도 user_activity_records 가 없으면 카드가 비어
  // 미리보기가 전부 void("-")로 보였다(모달은 firstExperienceLine fallback 으로 우연히 표시됨).
  // → DTO experience 라인(experienceLinesInWeek = 모달이 쓰는 동일 source)을 카드 source 로 우선
  //   사용하고, DTO 에 없는 legacy 라인만 user_activity_records 로 보강한다(회귀 방지).
  type ExpCardSeed = { line: Cluster4WeeklyLineDto | null; activityTypeId: string };
  const expCardSeeds: ExpCardSeed[] = (() => {
    const seeds: ExpCardSeed[] = [];
    const seenKeys = new Set<string>();
    // 1) DTO experience 라인 — 모달과 동일 source
    for (const line of experienceLinesInWeek) {
      const activityTypeId = (line.activityTypeId as string | null | undefined) ?? "";
      const lineTargetId = (line.lineTargetId as string | null | undefined) ?? null;
      const key = lineTargetId || activityTypeId;
      if (key && seenKeys.has(key)) continue;
      if (key) seenKeys.add(key);
      if (activityTypeId) seenKeys.add(activityTypeId);
      seeds.push({ line, activityTypeId });
    }
    // 2) legacy user_activity_records — DTO 에 없던 라인만 보강
    for (const activityTypeId of adminProcessedExpTypeIds) {
      if (activityTypeId && seenKeys.has(activityTypeId)) continue;
      if (activityTypeId) seenKeys.add(activityTypeId);
      seeds.push({ line: null, activityTypeId });
    }
    return seeds;
  })();

  // DTO enhancementStatus("success"|"pending"|"fail"|"not_applicable") → 카드 enum 매핑.
  // 프론트 재계산 금지 — DTO 값만 사용. 휴식/온보딩 특수 주차 또는 DTO 값 부재 시에만 legacy getEnhancementStatus.
  const mapExpEnhancementStatus = (line: Cluster4WeeklyLineDto | null | undefined, activityTypeId: string): EnhancementStatus => {
    if (isOnboardingWeek || weekData?.isPersonalRest || isRestMode) return getEnhancementStatus(activityTypeId);
    const raw = String(line?.enhancementStatus ?? "").toLowerCase();
    if (raw === "success") return "success";
    if (raw === "pending") return "waiting";
    if (raw === "fail" || raw === "failed") return "failed";
    if (raw === "not_applicable") return "not_applicable";
    // DTO 라인이 존재하나 강화 상태가 비어있으면(미평가) '강화 대기'로 표시 —
    // 이 크루에게 개설된 라인이므로 not_applicable 로 숨기지 않는다(미리보기 void 재발 방지).
    if (line) return "waiting";
    return getEnhancementStatus(activityTypeId);
  };

  const workExpCards = expCardSeeds.map((seed, index) => {
    const activityTypeId = seed.activityTypeId;
    const activityType = activityTypeId ? activityTypesMap.get(activityTypeId) : undefined;
    const activity = activityTypeId ? weeklyActivities.find((a) => a.activity_type_id === activityTypeId) : undefined;
    const detail = activityTypeId ? weekActivityDetails.find((d) => d.activity_type_id === activityTypeId) : undefined;
    const lineCodeKey = (activityType?.line_code || (seed.line?.lineCode as string | null | undefined) || "").replace(/\s+/g, "");
    const fallbackMapping = workExpLineMap[lineCodeKey];

    // 기존 index === 3 보이드 강제 제거 — workExpLineMap 6개 항목 전부 유효 카드로 처리

    // matchedLine 먼저 해석 — outputLinks/이미지 병합이 DTO line.* 를 우선 참조하기 위함.
    // preview·modal 공유 resolver 로 matchedLine 을 결정 (key → 위치(index) → canEdit → [0]).
    // 카드 key(lineCode/activityTypeId)가 비신뢰여도 DTO 라인을 카드에 연결하기 위함.
    // matchedLine: DTO 라인(seed.line)이 있으면 그대로 사용 → 모달과 동일 객체(값 일치 보장).
    // 없을 때만 legacy 카드 키(code/activityTypeId)로 재해석한다.
    const { line: expMatchedLine } = seed.line
      ? { line: seed.line as Cluster4WeeklyLineDto }
      : resolveExpMatchedLine(
          { lineTargetId: null, experienceLineMasterId: null, code: activityType?.line_code || fallbackMapping?.lineCode || null, activityTypeId },
          index,
        );

    // outputLinks 병합: 운영진 = expMatchedLine.outputLinks(DTO) 우선, 비었을 때만 legacy activity.output_links.
    //   (이미지 정책과 동일 — synthetic fail / lineTargetId=null 라인의 운영진 링크도 표시.)
    //   사용자 = legacy detail.output_links (어드민 개수만큼 오프셋).
    const adminLinks: { desc: string; url: string }[] =
      Array.isArray(expMatchedLine?.outputLinks) && expMatchedLine!.outputLinks!.length > 0
        ? expMatchedLine!.outputLinks!.map((l) => ({
            desc: ((l?.desc as string | null | undefined) ?? (l?.label as string | null | undefined) ?? ""),
            url: ((l?.url as string | null | undefined) ?? ""),
          }))
        : (activity?.output_links || []).map((l: { desc?: string | null; url?: string | null }) => ({ desc: l.desc || "", url: l.url || "" }));
    const userLinks = detail?.output_links || [];
    const adminCount = adminLinks.filter((l) => l.url?.trim()).length;
    const mergedOutputLinks: { desc: string; url: string }[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < adminCount && adminLinks[i]?.url?.trim()) {
        mergedOutputLinks.push({ desc: adminLinks[i].desc || "", url: adminLinks[i].url || "" });
      } else {
        const userIdx = i - adminCount;
        if (userLinks[userIdx]?.url?.trim()) {
          mergedOutputLinks.push({ desc: userLinks[userIdx].desc || "", url: userLinks[userIdx].url || "" });
        } else {
          mergedOutputLinks.push({ desc: "", url: "" });
        }
      }
    }

    // 어드민 output_images 와 크루 image_urls 병합 — workInfo/workCareer 와 동일 패턴.
    // 단일 출처: weekly-cards matchedLine.outputImages 우선(lineCode 매칭), 없을 때만 legacy weeklyActivities fallback.
    // 어드민 슬롯 우선, 그 다음 크루 슬롯. 레거시로 image_urls 에 어드민 URL 이 같이 저장된 경우 중복 제거.
    // 강화 상태: DTO enhancementStatus 단일 출처(매핑), 부재 시 legacy. hasActivity: 활동/매칭 라인 존재.
    const enhStatus = mapExpEnhancementStatus(expMatchedLine, activityTypeId);
    const hasActivity = !!activity || !!expMatchedLine;
    // 라인 평점: weekly-cards DTO 의 experienceRating(SoT=cluster4_experience_line_evaluations.rating) 단일 출처.
    // 프론트 재계산 금지 — number 면 그대로(0 포함), null/undefined 면 미입력("- / 10").
    const experienceRatingDto = typeof expMatchedLine?.experienceRating === "number" ? expMatchedLine.experienceRating : null;
    const hasExperienceRating = experienceRatingDto !== null;
    const effectiveRatingScore = experienceRatingDto ?? 0;
    const effectiveRating = effectiveRatingScore / 2; // 별 표시용 (0~5)
    const expLineImages = normalizeOutputImages(
      expMatchedLine?.outputImages as
        | ReadonlyArray<string | { url?: string | null; caption?: string | null } | null>
        | null
        | undefined,
    );
    // 운영진 output image 정책: 최대 1 (병합 card.images 에 반영되므로 여기서 클램프).
    const adminImgs = (expLineImages.length > 0 ? expLineImages : normalizeOutputImages(activity?.output_images)).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    const adminUrlSet = new Set(adminImgs.map((i) => i.url));
    const rawCrewImgs: (string | null | undefined)[] = detail?.image_urls || [];
    const rawCrewCaps: string[] = detail?.image_captions || [];
    const filteredCrewImgs: (string | null)[] = [];
    const filteredCrewCaps: string[] = [];
    for (let i = 0; i < rawCrewImgs.length; i++) {
      const u = rawCrewImgs[i];
      if (u && adminUrlSet.has(u)) continue;
      filteredCrewImgs.push(u || null);
      filteredCrewCaps.push(rawCrewCaps[i] || "");
    }
    // 예약 슬롯 모델(2026-07-18): 운영진 슬롯 0 은 이미지 유무·라인 매칭 성패와 무관하게 **항상 예약**(크루는 2번
    //   슬롯부터). fail-safe 로 무조건 floor — expMatchedLine 부재(매칭 실패)에서도 크루가 1번으로 밀리지 않는다.
    const expAdminSlots = Math.min(
      Math.max(adminImgs.length, RESERVED_ADMIN_IMAGE_SLOTS),
      WORKINFO_IMAGE_SLOT_COUNT,
    );
    const mergedImages: (string | null)[] = [];
    const mergedCaptions: string[] = [];
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if (i < expAdminSlots) {
        mergedImages.push(adminImgs[i]?.url ?? null);
        mergedCaptions.push(adminImgs[i]?.caption || "");
      } else {
        const crewIdx = i - expAdminSlots;
        mergedImages.push(filteredCrewImgs[crewIdx] || null);
        mergedCaptions.push(filteredCrewCaps[crewIdx] || "");
      }
    }

    if (workExpViewModalOpen) {
      console.log("[cluster4-exp-preview-display]", {
        currentWeekId: weekId,
        cardIndex: index,
        matchedLine: expMatchedLine ?? null,
        previewTitle: expMatchedLine?.mainTitle || activity?.title || fallbackMapping?.mainTitle || "-",
        previewCode: expMatchedLine?.lineCode || activityType?.line_code || fallbackMapping?.lineCode || "-",
        previewOutputLink1: expMatchedLine?.outputLinks?.[0]?.url ?? null,
        previewOutputImages: Array.isArray(expMatchedLine?.outputImages) ? expMatchedLine!.outputImages!.length : null,
        previewExperienceRating: hasExperienceRating ? experienceRatingDto : null,
        previewRatingCount: hasExperienceRating ? `${experienceRatingDto} / 10` : "- / 10",
        previewRatingSource: "matchedLine.experienceRating(DTO=cluster4_experience_line_evaluations.rating)",
      });
    }

    return {
      id: index + 1,
      activityTypeId,
      // 해석된 matchedLine 객체 자체를 카드에 실어, 모달이 동일 객체를 그대로 사용하게 한다
      // (preview·modal 단일 source — request #4). null 이면 modal 에서 재해석 fallback.
      matchedLine: expMatchedLine ?? null,
      lineTargetId: (expMatchedLine?.lineTargetId as string | null | undefined) ?? null,
      experienceLineMasterId: (expMatchedLine?.experienceLineMasterId as string | null | undefined) ?? null,
      // 고정 슬롯(1~5) 매핑 키 — 배열 순서가 아니라 이 값으로 슬롯 위치를 결정한다 (백엔드 SoT).
      experienceCategory: (expMatchedLine?.experienceCategory as string | null | undefined) ?? null,
      experienceSlotOrder: typeof expMatchedLine?.experienceSlotOrder === "number" ? expMatchedLine.experienceSlotOrder : null,
      canEdit: typeof expMatchedLine?.canEdit === "boolean" ? expMatchedLine.canEdit : null,
      code: expMatchedLine?.lineCode || activityType?.line_code || fallbackMapping?.lineCode || "-",
      // 고객 표시용 공식 코드 — DTO displayLineCode 단일 출처(내부 code fallback 금지). 없으면 null(숨김).
      displayCode: (expMatchedLine?.displayLineCode as string | null | undefined) ?? null,
      // 라인명(badge): matchedLine.lineName(master.line_name) → activityTypeName → legacy → "-". (mainTitle 금지)
      badge:
        (expMatchedLine?.lineName as string | null | undefined) ||
        (expMatchedLine?.activityTypeName as string | null | undefined) ||
        activityType?.name ||
        fallbackMapping?.lineName ||
        "-",
      title: expMatchedLine?.mainTitle || activity?.title || fallbackMapping?.mainTitle || "-",
      // subtitle/growthPoint: canonical submission(line 단위 SoT) 우선 → legacy detail 폴백 → "".
      subTitle: ((expMatchedLine?.submission as { subtitle?: string | null } | null | undefined)?.subtitle ?? null) ?? detail?.sub_title ?? "",
      growthPoint: ((expMatchedLine?.submission as { growthPoint?: string | null } | null | undefined)?.growthPoint ?? null) ?? detail?.growth_point ?? "",
      outputLinks: mergedOutputLinks,
      images: normalizeWorkInfoImages(mergedImages),
      imageCaptions: normalizeWorkInfoCaptions(mergedCaptions),
      verified: enhStatus === "success",
      // 평점: DTO experienceRating 단일 출처. number → "n / 10", null/undefined → "- / 10".
      rating: effectiveRating,
      ratingCount: hasExperienceRating ? `${experienceRatingDto} / 10` : "- / 10",
      hasWeb: (detail?.output_links?.length || 0) > 0,
      icon: getWorkExpIcon((expMatchedLine?.activityTypeName as string | null | undefined) || fallbackMapping?.lineName || activityType?.name || ""),
      isEmpty: false,
      enhancementStatus: enhStatus,
      hasActivity,
    };
  });

  // 4칸 슬롯 규칙: 해당되는(=not_applicable이 아닌) 라인만 좌측부터 채우고,
  // 부족한 칸은 보이드 '-' 카드로 패딩한다. 어드민이 한 주에 적용 가능한 실무 경험 라인은
  // 운영 정책상 최대 4개로 가정하므로 slice(0, 4) 로 자른다.
  const buildVoidWorkExpCard = (n: number) => ({
    id: 1000 + n,
    activityTypeId: "",
    experienceCategory: null as string | null,
    experienceSlotOrder: null as number | null,
    experienceLineMasterId: null as string | null,
    code: "-",
    badge: "-",
    title: "-",
    subTitle: "",
    growthPoint: "",
    outputLinks: [] as { desc: string; url: string }[],
    images: normalizeWorkInfoImages(undefined),
    imageCaptions: normalizeWorkInfoCaptions(undefined),
    verified: false,
    rating: 0,
    ratingCount: "- / 10",
    hasWeb: false,
    icon: "",
    isEmpty: true,
    enhancementStatus: "not_applicable" as EnhancementStatus,
    hasActivity: false,
  });

  // 미개설(빈) 슬롯 모달 전용 placeholder — 실제 line/card 를 복사하지 않는 독립 객체.
  // (버그: 빈 슬롯이 1번 슬롯 카드/ matchedLine 을 공유하던 문제 → 매 클릭마다 새 placeholder 로 분리)
  // mainTitle/subtitle/growthPoint "-", outputs empty, rating null("- / 10"), canEdit false,
  // matchedLine/lineTargetId 없음(resolveExpMatchedLine 이 라인 없음으로 처리),
  // enhancementStatus = DTO 있으면 그대로(slotStatus) 없으면 not_applicable.
  const buildExpPlaceholderCard = (slotIndex: number, slotStatus?: EnhancementStatus) => ({
    ...buildVoidWorkExpCard(slotIndex),
    matchedLine: null as Cluster4WeeklyLineDto | null,
    lineTargetId: null as string | null,
    canEdit: false as boolean,
    isPlaceholder: true as boolean,
    enhancementStatus: (slotStatus ?? "not_applicable") as EnhancementStatus,
  });

  // ── 실무 경험 고정 슬롯(1~5) 구조 ──
  // 요구사항: 데이터 배열 순서가 아니라 experienceSlotOrder(없으면 experienceCategory)를 기준으로
  // 항상 같은 위치(1 도출 → 2 분석 → 3 평가 → 4 확장 → 5 관리)에 카드를 배치한다.
  // 라인이 없는 슬롯은 빈/해당없음(void 카드)으로 표시한다. (미리보기 void 문제 해결)
  const EXPERIENCE_SLOT_DEFS = [
    { order: 1, category: "derivation", label: "도출" },
    { order: 2, category: "analysis", label: "분석" },
    { order: 3, category: "evaluation", label: "평가" },
    { order: 4, category: "extension", label: "확장" },
    { order: 5, category: "management", label: "관리" },
  ] as const;
  const EXP_CATEGORY_TO_ORDER: Record<string, number> = {
    derivation: 1,
    analysis: 2,
    evaluation: 3,
    extension: 4,
    management: 5,
  };
  // 카드 → 슬롯 순서(1~5). experienceSlotOrder 우선, 없으면 experienceCategory→order.
  // 둘 다 없으면 null(슬롯 미배치). 프론트 추론 금지 — 백엔드 SoT 값만 사용.
  const resolveExpSlotOrder = (card: { experienceSlotOrder?: number | null; experienceCategory?: string | null }): number | null => {
    const so = card.experienceSlotOrder;
    if (typeof so === "number" && so >= 1 && so <= 5) return so;
    const cat = String(card.experienceCategory ?? "").trim().toLowerCase();
    if (cat && EXP_CATEGORY_TO_ORDER[cat]) return EXP_CATEGORY_TO_ORDER[cat];
    return null;
  };

  // ── 현재 단계(일반/심화/운영진) 판정 — 이력서 카드 "심화" 표시와 동일 source/매핑 ──
  // 이력서(home-career/Sidebar.tsx)는 profile.membership_level 을 roleKorean 으로 매핑한 뒤
  // "(" 앞부분("일반"|"심화"|"운영진")만 잘라 표시한다. 관리 슬롯 잠금도 정확히 같은 기준을 쓴다.
  // (버그: 기존엔 userWeekRole(주차별 역할 history) 기준이라, membership_level 이 "심화"여도
  //  본 주차 role 이 null/일반이면 이력서는 "심화"인데 관리 슬롯은 잠겨 불일치가 났다.)
  //  - "심화" / "운영진" → 관리 슬롯 open
  //  - "일반" / 미확정(membership_level 없음) → 관리 슬롯 locked (보수적)
  //   ⚠ 매핑 SoT = lib/crewClassDisplayLabel(표시 어휘와 동일 테이블). 종전의 로컬 사본은
  //     "일반"/"심화" 흡수 규칙이 달라 판정이 갈릴 수 있었다 — 단일화한다(판정 결과 동일).
  // 관리(5) 슬롯 단계 판정 = 그 카드 "주차 당시 단계". SoT = weeklyCardMeta.roleLabel(백엔드 snapshot,
  //   user_position_histories 주차단위 — 이력서 resume-activities 와 동일). 과거 주차 카드가 최신 profile
  //   membershipLevel 로 덮이면 안 되므로 주차 핀 값을 최우선으로 쓴다. 카드 메타 미수신(레거시/오류) 시에만
  //   로컬 membershipLevel state(현재값) 폴백 — 무회귀.
  const weekStageLabel = (weeklyCardMeta?.roleLabel && weeklyCardMeta.roleLabel.trim()) || "";
  const expMembershipRaw = weekStageLabel || (membershipLevel ?? "");
  const expStageFull = toCrewClassDisplayLabel(expMembershipRaw) ?? "";
  const expStagePrefix = expStageFull.split("(")[0] || ""; // "정규" | "심화" | "운영진" | ""
  const isExpAdvancedStage = expStagePrefix === "심화" || expStagePrefix === "운영진"; // class-label-allow (표시 아님 — 라벨 접두 비교)
  // 관리 아이콘(에이전트/파트장) 분기 — 매핑된 라벨에 "에이전트"가 포함되면 에이전트 대상.
  const isExpAgentRole = expStageFull.includes("에이전트");
  const managementSlotLocked = !isExpAdvancedStage;

  // 슬롯 카테고리 → 고정 아이콘. extension 은 미정 → ""(placeholder), management 는 역할별 분기.
  const EXP_SLOT_ICON_BASE = "/images/0/cluster4/icon/실무 경험/";
  const getExperienceSlotIcon = (category: string): string => {
    switch (category) {
      case "derivation":
        return EXP_SLOT_ICON_BASE + "실무 경험 - [커리어]마케터 Launch.png";
      case "analysis":
        return EXP_SLOT_ICON_BASE + "실무 경험 - [퍼포먼스]마케팅 실무.png";
      case "evaluation":
        return EXP_SLOT_ICON_BASE + "실무 경험 - [생산성]상호 피드백.png";
      case "management":
        return EXP_SLOT_ICON_BASE + (isExpAgentRole ? "[매니징] 에이전트.png" : "[매니징] 파트장.png");
      case "extension":
      default:
        return ""; // 아직 미정 — placeholder 유지
    }
  };

  // 휴식 모드: Main Title 차폐 + 강화 상태 not_applicable. 슬롯 배치 기준은 동일하게 유지.
  const slottableWorkExpCards = isRestMode
    ? workExpCards.map((card) => ({ ...card, title: "", enhancementStatus: "not_applicable" as EnhancementStatus, isFailed: false }))
    : workExpCards;

  // 슬롯 내부 정렬: 같은 슬롯에 여러 라인이 있으면
  //  1) master 연결(lineName 보유) 라인을 대표로 우선 — master-less(line_name=null) 라인이
  //     code 알파벳 순(예: "EX02A…" < "EXBS…")으로 cards[0] 가 되어 라인명이 "-" 로 떨어지는 것을 방지.
  //  2) 소유자 배정(lineTargetId 보유) 라인 우선 — weekly-cards DTO 는 이미 카드 소유자(userId)
  //     스코프라 lineTargetId 가 있으면 = 이 크루원에게 실제 배정/평가된 라인. 같은 카테고리(예: 도출)에
  //     개설만 되고 이 크루원 타깃이 없는 형제 라인(lineTargetId=null, 예: "1/4 라인")이 아래 code
  //     알파벳 tiebreak 으로 대표(cards[0]) 를 가로채 "본인 배정 2/4 · 강화 성공" 대신 "1/4 · 강화 실패"
  //     를 보여주던 버그 방지(2026 여름 W1 T유지민 도출 사례). lineName tie 일 때만 개입 — lineName 없는
  //     타깃 라인을 lineName 있는 라인 위로 올리지 않는다(위 (1) 우선 유지).
  //  3) 그다음 lineCode(code) → mainTitle(title) 순.
  const hasResolvedLineName = (c: { matchedLine?: Cluster4WeeklyLineDto | null }): boolean => {
    const ln = (c.matchedLine?.lineName as string | null | undefined) ?? null;
    return !!ln && ln.trim() !== "" && ln.trim() !== "-";
  };
  const hasOwnerLineTarget = (c: { lineTargetId?: string | null; matchedLine?: Cluster4WeeklyLineDto | null }): boolean => {
    const lt = ((c.lineTargetId as string | null | undefined) ?? (c.matchedLine?.lineTargetId as string | null | undefined)) ?? null;
    return typeof lt === "string" && lt.trim() !== "";
  };
  const sortWithinExpSlot = (
    a: { code?: string | null; title?: string | null; lineTargetId?: string | null; matchedLine?: Cluster4WeeklyLineDto | null },
    b: { code?: string | null; title?: string | null; lineTargetId?: string | null; matchedLine?: Cluster4WeeklyLineDto | null },
  ) => {
    const an = hasResolvedLineName(a) ? 1 : 0;
    const bn = hasResolvedLineName(b) ? 1 : 0;
    if (an !== bn) return bn - an; // lineName 보유 라인 먼저
    const at = hasOwnerLineTarget(a) ? 1 : 0;
    const bt = hasOwnerLineTarget(b) ? 1 : 0;
    if (at !== bt) return bt - at; // 소유자 배정(lineTargetId) 라인 먼저
    const ca = String(a.code ?? ""),
      cb = String(b.code ?? "");
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a.title ?? "").localeCompare(String(b.title ?? ""));
  };

  // 고정 5슬롯 빌드. 각 슬롯: 카테고리 라인들(정렬) + 대표(primary) + 잠금/아이콘.
  const workExpSlots = EXPERIENCE_SLOT_DEFS.map((def, slotIndex) => {
    const cards = slottableWorkExpCards.filter((c) => resolveExpSlotOrder(c) === def.order).sort(sortWithinExpSlot);
    const primary = cards[0] ?? null;
    const isLocked = def.category === "management" && managementSlotLocked;
    return {
      slotIndex,
      order: def.order,
      category: def.category,
      label: def.label,
      cards,
      lineCount: cards.length,
      // 실제 라인 대표 카드(없으면 null). 클릭 시 이 값이 있을 때만 selectedWorkExpCard 로 세팅.
      primary,
      // 대표 카드(없으면 void). 잠금 슬롯은 본문을 가리므로 void 로 둔다.
      card: isLocked || !primary ? buildVoidWorkExpCard(slotIndex) : primary,
      // 라인 없음/잠금 → 빈(해당없음) 슬롯. 라인 있으면 정상 표시.
      isEmpty: isLocked || !primary,
      isLocked,
      // 카테고리 고정 아이콘("" = placeholder). 잠금/빈 슬롯에서는 placeholder.
      slotIcon: getExperienceSlotIcon(def.category),
    };
  });

  // ── [cluster4-exp-linename-diag] 실무 경험 라인명 매핑 전수 진단 ──
  // weekly-cards 응답 → DTO 원본 line → 빌드된 card → 슬롯 대표(primary) 까지 lineName 흐름을 추적.
  // (req#1) DTO line 의 lineCode/lineName/mainTitle/activityTypeName 출력
  // (req#2) 화면 슬롯에 실제 렌더되는 대표 카드가 어떤 lineCode/lineName 인지
  // (req#3) 슬롯 대표가 master-less 라인(lineName=null)을 잡고 있는지(primaryIsMasterLess)
  // (req#4,5) 원본 line ↔ card.badge ↔ slot.primary.badge 일치 여부
  if (typeof window !== "undefined" && experienceLinesInWeek.length > 0) {
    console.log("[cluster4-exp-linename-diag]", {
      currentWeekId: weekId,
      // 1) 백엔드 DTO 원본 experience 라인 (렌더링 변환 전)
      dtoLines: experienceLinesInWeek.map((l) => ({
        lineCode: (l.lineCode as string | null | undefined) ?? null,
        lineName: (l.lineName as string | null | undefined) ?? null,
        mainTitle: (l.mainTitle as string | null | undefined) ?? null,
        activityTypeName: (l.activityTypeName as string | null | undefined) ?? null,
        experienceCategory: (l.experienceCategory as string | null | undefined) ?? null,
        experienceSlotOrder: typeof l.experienceSlotOrder === "number" ? l.experienceSlotOrder : null,
        lineTargetId: (l.lineTargetId as string | null | undefined) ?? null,
        hasLineNameKey: Object.prototype.hasOwnProperty.call(l, "lineName"),
      })),
      // 2) 빌드된 미리보기 카드 (badge = 화면 라인명 슬롯 source)
      builtCards: workExpCards.map((c) => ({
        code: c.code,
        badge: c.badge, // 미리보기 badge-tag 에 렌더되는 값
        title: c.title,
        matchedLineName: (c.matchedLine?.lineName as string | null | undefined) ?? null,
        slotOrder: resolveExpSlotOrder(c),
      })),
      // 3) 고정 5슬롯에 실제 렌더되는 대표 카드 (isEmpty=true 면 화면엔 "-")
      slots: workExpSlots.map((s) => ({
        order: s.order,
        category: s.category,
        isEmpty: s.isEmpty,
        isLocked: s.isLocked,
        lineCount: s.lineCount,
        primaryCode: s.primary?.code ?? null,
        primaryBadge: s.primary?.badge ?? null,
        primaryLineName: (s.primary?.matchedLine?.lineName as string | null | undefined) ?? null,
        primaryIsMasterLess: s.primary ? !((s.primary.matchedLine?.lineName as string | null | undefined) ?? null) : null,
      })),
    });
  }

  // 실무 경험 통계 — 카드 표시 기준(getEnhancementStatus 결과)에 맞춰 derive.
  // 운영진이 개설한 활동 중 이 크루에게 해당 없음(역할/이력 외)인 라인은 카운트에서 제외.
  const experienceStatsDisplay = {
    total: workExpCards.filter((c) => c.enhancementStatus !== "not_applicable").length,
    success: workExpCards.filter((c) => c.enhancementStatus === "success").length,
  };

  // ── 실무 경험/경력 카운트·달성률 단일 출처(어드민 weekly-cards DTO) — infoStatsAdmin/competencyStatsAdmin 와 동일 패턴 ──
  // DTO experienceRate/careerRate{rate,count,total} 가 있으면 우선 사용(count=B, total=A, 백엔드 보정 완료).
  // careerRate 미수신 시에는 legacy careerStats 가 아니라 weekly-cards career line 의 denominator/numerator/rate 를 사용한다.
  const experienceStatsAdmin = (() => {
    const r = (weeklyCardMeta as (AdminCluster4WeeklyCardDto & { experienceRate?: Cluster4RateDto | null }) | null)?.experienceRate ?? null;
    if (r && typeof r.total === "number" && typeof r.count === "number") {
      return { total: Number(r.total) || 0, success: Number(r.count) || 0, rate: typeof r.rate === "number" ? r.rate : null };
    }
    // DTO 라인 numerator/denominator(백엔드 breakdownFromLines SoT) 직접 사용 — info/competency/career
    // 와 동일 단일 산식(주차 성장률 분모 = 4허브 합산 보장). 라인 미수신 시에만 카드 파생값 fallback.
    if (experienceLinesInWeek.length > 0) {
      const den = experienceLinesInWeek.map((l) => l.denominator).find((d) => typeof d === "number") ?? null;
      const num = experienceLinesInWeek.map((l) => l.numerator).find((n) => typeof n === "number") ?? null;
      const lineRate = experienceLinesInWeek.map((l) => l.rate).find((x) => typeof x === "number") ?? null;
      return { total: Number(den) || 0, success: Number(num) || 0, rate: typeof lineRate === "number" ? lineRate : null };
    }
    return { total: Number(experienceStatsDisplay.total) || 0, success: Number(experienceStatsDisplay.success) || 0, rate: null };
  })();
  const experienceSuccessRate =
    typeof experienceStatsAdmin.rate === "number"
      ? experienceStatsAdmin.rate
      : experienceStatsAdmin.total > 0
        ? Math.round((experienceStatsAdmin.success / experienceStatsAdmin.total) * 100)
        : 0;
  const careerStatsAdmin = (() => {
    const r = (weeklyCardMeta as (AdminCluster4WeeklyCardDto & { careerRate?: Cluster4RateDto | null }) | null)?.careerRate ?? null;
    if (r && typeof r.total === "number" && typeof r.count === "number") {
      return { total: Number(r.total) || 0, success: Number(r.count) || 0, rate: typeof r.rate === "number" ? r.rate : null };
    }
    const careerLines = cluster4Lines.filter(
      (l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "career",
    );
    if (careerLines.length > 0) {
      // line.numerator/denominator 는 part 단위 집계값이 모든 라인에 동일하게 실린 것 — 첫 값만 읽는다.
      // (구버그) 라인별 합산(reduce)은 v11 career 6칸 패딩에서 분모가 칸 수만큼 곱으로 부풀었다(A=1 → 총 6).
      const den = careerLines.map((l) => l.denominator).find((d) => typeof d === "number") ?? null;
      const num = careerLines.map((l) => l.numerator).find((n) => typeof n === "number") ?? null;
      const lineRate = careerLines.map((l) => l.rate).find((x) => typeof x === "number") ?? null;
      const total = Number(den) || 0;
      const success = Number(num) || 0;
      return {
        total,
        success,
        rate: typeof lineRate === "number" ? lineRate : total > 0 ? Math.round((success / total) * 100) : 0,
      };
    }
    return { total: 0, success: 0, rate: 0 };
  })();
  const careerSuccessRate =
    typeof careerStatsAdmin.rate === "number"
      ? careerStatsAdmin.rate
      : careerStatsAdmin.total > 0
        ? Math.round((careerStatsAdmin.success / careerStatsAdmin.total) * 100)
        : 0;

  // ── 상단 주차 성장률(성장 허브) 단일 출처 = 아래 4개 허브 section-count 합산 ──
  // (2026-07-01) 이전엔 별도 growthRate{rate,count,total} DTO(백엔드 재집계값)를 상단에 그대로 썼다.
  //   그런데 하단 허브 카운트(infoStatsAdmin/experienceStatsAdmin/competencyStatsAdmin/careerStatsAdmin)에는
  //   프론트 표시 보정 — 특히 competency 의 empty-zero 게이트(realCompetencyLines 0 → total 0),
  //   info 의 placeholder 제외 등 — 이 반영되지만 growthRate DTO 에는 반영되지 않아
  //   "상단 총 N개" ≠ "하단 허브 합" 이 발생했다(예: 하단 0+1+0=1 인데 상단 growthRate=... 로 어긋남).
  // 이제 상단은 화면에 실제로 렌더되는 4개 허브 stat 을 그대로 합산한다 → top == Σsection 이 구조적으로 보장.
  //   - 별도 source(growthRate/growthDenominator/lines 재합산) 제거: stale snapshot·산식 차이로 인한 괴리 원천 차단.
  //   - onboarding 주차엔 경험/역량/경력 섹션이 "-"(값 미포함)로 표시되므로 합산에서도 동일하게 제외한다
  //     (info 는 onboarding 에서도 값 표시 → 항상 포함). rest 주차는 상단·하단 모두 "-" 라 합산값과 무관.
  //   - rate(퍼센트·progress bar)도 합산 total/success 로 재계산해 헤더 3값이 내부적으로 일치하게 한다.
  //   - demo/일반 모드 동일: 4개 허브 stat 자체가 이미 동일 DTO 필드(infoRate 등)에서 나오므로 경로 무관 동일값.
  const growthStatsAdmin = (() => {
    const gateExpCompCareer = isOnboardingWeek; // 온보딩: 경험/역량/경력 섹션 "-" → 합산 제외(info 만 포함)
    const total =
      infoStatsAdmin.total +
      (gateExpCompCareer ? 0 : experienceStatsAdmin.total) +
      (gateExpCompCareer ? 0 : competencyStatsAdmin.total) +
      (gateExpCompCareer ? 0 : careerStatsAdmin.total);
    const success =
      infoStatsAdmin.success +
      (gateExpCompCareer ? 0 : experienceStatsAdmin.success) +
      (gateExpCompCareer ? 0 : competencyStatsAdmin.success) +
      (gateExpCompCareer ? 0 : careerStatsAdmin.success);
    // 라운딩은 admin roundGrowthRate(Math.round)와 일치(Math.ceil 금지).
    return { total, success, rate: total > 0 ? Math.round((success / total) * 100) : 0 };
  })();
  const growthSuccessRate = growthStatsAdmin.rate;

  // 실무 경력 카드 데이터 (DB에서 가져온 프로젝트 기반 데이터 변환)
  // ── 실무 경력(career) 카드 단일 출처 = weekly-cards lines[] (partType==="career", weekId 일치) ──
  // (원인) 이전엔 careerRecords(/api/career-records)만 source 였다. 백엔드가 career 를 cluster4_lines
  //   (weekly-cards DTO lines[])로 내려주는 사용자는 careerRecords 가 비어 카드가 전부 empty 로 떨어졌다.
  // (수정) 현재 주차 career 라인이 있으면 그 라인을 카드 source 로 사용한다.
  //   - 매칭은 weekId 기준(주차 번호 금지 — weekNumber 중복 가능).
  //   - submission=null 은 "미제출"일 뿐 라인 없음이 아니다. top-level(mainTitle/projectCode/careerGrade/
  //     enhancementStatus/outputLinks/outputImages)은 그대로 표시한다.
  //   - status / enhancementStatus === "fail" 이어도 카드를 숨기지 않는다(강화 실패도 내용 표시).
  //   - company/supervisor 등 DTO 에 없는 legacy 필드는 매칭되는 careerRecord 가 있으면 보강, 없으면 "-".
  const careerLinesForWeek = cluster4Lines.filter(
    (l) => (l.weekId ?? null) === weekId && normalizePartType(l.partType) === "career",
  );
  // ── 실무 경력 void(미개설) vs not_applicable(개설+미배정) 분리 (2026-06-04 정책) ──
  // 백엔드 placeholder 라인(미개설 빈 슬롯: status="void", statusLabel="미개설",
  // enhancementReason="target_missing_not_required_career")도 enhancementStatus="not_applicable" 로
  // 내려온다. 이 라인을 그대로 카드로 만들면 "해당 없음" 카드로 잘못 표시됨 → 라인 개설 데이터
  // (open/close 시각 또는 타깃/프로젝트/코드/타이틀/기업 실데이터)가 하나라도 있어야 "개설된 라인"으로
  // 카드화하고, 전부 없는 placeholder 는 6슬롯 패딩과 동일한 void(emptyCareerCard) 슬롯으로 처리한다.
  //  - not_applicable(해당 없음) = 개설 데이터 존재 + 본인 미배정/미선발 (개설 라인은 미선발이어도
  //    projectCode/companyName 등 content 를 채워 내려옴 — 위 N-1 carry 블록 isContentLine 과 동일 전제)
  //  - void(보이드) = 개설 데이터 자체가 없음 (placeholder 카드: Main/Sub Title "-", 기본 기업 이미지)
  // ※ career 전용 판정 — information/experience/competency 의 기존 상태 판정에는 사용하지 않는다.
  const hasCareerLineOpenData = (l: Cluster4WeeklyLineDto): boolean =>
    !!(
      l.submissionOpensAt ||
      l.submissionClosesAt ||
      l.lineTargetId ||
      (typeof l.careerProjectId === "string" && l.careerProjectId.trim()) ||
      (typeof l.projectCode === "string" && l.projectCode.trim()) ||
      (typeof l.lineCode === "string" && l.lineCode.trim()) ||
      (typeof l.mainTitle === "string" && l.mainTitle.trim()) ||
      (typeof l.companyName === "string" && l.companyName.trim())
    );
  const openedCareerLinesForWeek = careerLinesForWeek.filter(hasCareerLineOpenData);
  const findCareerRecordForLine = (line: Cluster4WeeklyLineDto): CareerRecord | null =>
    careerRecords.find(
      (r) =>
        (line.careerProjectId != null && r.project_id === line.careerProjectId) ||
        (line.projectCode != null && r.line_code != null && normLineKey(r.line_code) === normLineKey(line.projectCode)) ||
        (line.lineCode != null && r.line_code != null && normLineKey(r.line_code) === normLineKey(line.lineCode)),
    ) ?? null;
  const buildCareerCardFromLine = (line: Cluster4WeeklyLineDto, index: number, record: CareerRecord | null) => {
    const enh = (line.enhancementStatus as string | null | undefined) ?? null;
    // statusBadge 는 미리보기 enhancementStatusBadge() 가 null 일 때만 쓰는 fallback. enh 값 그대로 매핑.
    const statusBadge =
      enh === "success"
        ? "/images/0/cluster4/icon/5 강화 성공.png"
        : enh === "pending"
          ? "/images/0/cluster4/icon/6 강화 대기.png"
          : enh === "fail"
            ? "/images/0/cluster4/icon/7 강화 실패.png"
            : "/images/0/cluster4/icon/8 해당 없음.png";
    // 이미지 3슬롯: 어드민(top-level outputImages) 우선 + 크루(submission.outputImages) 이어붙임.
    // 운영진 output image 정책: 최대 1 (병합 card.images 에 반영되므로 여기서 클램프).
    const adminImgs = normalizeOutputImages(line.outputImages).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
    const adminUrlSet = new Set(adminImgs.map((i) => i.url));
    const sub = line.submission ?? null;
    const subImgsRaw = (sub?.outputImages ?? []) as Array<string | null>;
    const subCapsRaw = (sub?.outputImageCaptions ?? []) as Array<string | null>;
    const crewImgs: (string | null)[] = [];
    const crewCaps: string[] = [];
    for (let i = 0; i < subImgsRaw.length; i++) {
      const u = subImgsRaw[i];
      if (u && adminUrlSet.has(u)) continue;
      crewImgs.push(u || null);
      crewCaps.push(subCapsRaw[i] || "");
    }
    // 예약 슬롯 모델(2026-07-18): 개설된 라인은 운영진 슬롯 0 을 항상 예약(이미지 없어도) — 크루는 2번 슬롯부터.
    const careerAdminSlots = Math.min(
      Math.max(adminImgs.length, RESERVED_ADMIN_IMAGE_SLOTS),
      WORKCAREER_IMAGE_SLOT_COUNT,
    );
    const mergedImages: (string | null)[] = [];
    const mergedCaptions: string[] = [];
    for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
      if (i < careerAdminSlots) {
        mergedImages.push(adminImgs[i]?.url ?? null);
        mergedCaptions.push(adminImgs[i]?.caption || "");
      } else {
        const c = i - careerAdminSlots;
        mergedImages.push(crewImgs[c] || null);
        mergedCaptions.push(crewCaps[c] || "");
      }
    }
    const cardOutputLinks = Array.isArray(line.outputLinks)
      ? line.outputLinks.map((l) => ({ desc: (l?.desc as string | null | undefined) ?? "", url: (l?.url as string | null | undefined) ?? "" }))
      : [];
    const dateSrc =
      (line.submissionOpensAt as string | null | undefined) ??
      (line.submissionClosesAt as string | null | undefined) ??
      weekData?.startDate ??
      null;
    return {
      id: index + 1,
      // code-tag: projectCode ?? lineCode
      code: line.projectCode ?? line.lineCode ?? "-",
      // 고객 표시용 공식 코드 — DTO displayLineCode 단일 출처(내부 code fallback 금지). 없으면 null(숨김).
      displayCode: (line.displayLineCode as string | null | undefined) ?? null,
      // ── sponsor-card 기업/감독자: DTO line 필드 1순위, 부재 시 legacy careerRecord 보강 (2026-06-01 v2) ──
      // badge(=기업명)/icon(=로고)/supervisor* 의 "기업명"/"-"/placeholder 최종 fallback 은 UI 단에서 적용.
      badge: (line.companyName as string | null | undefined) || record?.company_name || "",
      // main-desc-white: mainTitle
      title: line.mainTitle ?? "-",
      verified: enh === "success",
      // 날짜: submissionOpensAt → submissionClosesAt → 주차 시작일 순.
      date: dateSrc ? formatDate(dateSrc) : "0000-00-00 (일)",
      likes: "0,99",
      hasWeb: cardOutputLinks.some((l) => l.url.trim() !== "") || (Array.isArray(sub?.outputLinks) && (sub!.outputLinks!.length || 0) > 0),
      icon: (line.companyLogoUrl as string | null | undefined) || record?.company_logo_url || "/images/0/cluster4/icon/default-company.png",
      companyHomepageUrl: (record?.company_homepage_links && record.company_homepage_links[0]) || null,
      supervisorImg: (line.supervisorPhotoUrl as string | null | undefined) || record?.supervisor_profile_img || "/images/0/cluster4/icon/실무 경력/감독자.jpg",
      supervisorName: (line.supervisorName as string | null | undefined) || record?.supervisor_name || "-",
      supervisorDept: (line.supervisorDepartment as string | null | undefined) || record?.supervisor_department || "",
      supervisorCompany: (line.companyName as string | null | undefined) || record?.company_name || record?.supervisor_company || "",
      supervisorPosition: (line.supervisorPosition as string | null | undefined) || record?.supervisor_position || "",
      statusBadge,
      // grade active: careerGrade
      grade: (line.careerGrade as string | null | undefined) || "",
      isNotApplicable: enh === "not_applicable",
      isEmpty: false,
      // status/enhancementStatus=fail 이어도 카드는 표시 — isFailed 는 오버레이 표기용일 뿐 숨김 아님.
      isFailed: enh === "fail",
      // sub-desc 미리보기 = 사용자 제출 subtitle (없으면 record.project_description fallback).
      projectDescription: (sub?.subtitle as string | null | undefined) ?? record?.project_description ?? null,
      subTitle: (sub?.subtitle as string | null | undefined) ?? "",
      growthPoint: (sub?.growthPoint as string | null | undefined) ?? "",
      // grade-points: careerGradePoints
      gradePoints: (line.careerGradePoints as number | null | undefined) ?? null,
      recordId: record?.record_id ?? null,
      projectId: (line.careerProjectId as string | null | undefined) ?? record?.project_id ?? null,
      // ── 매칭 키 보존 — findCluster4Line / workCareerMatchedLine 이 동일 라인을 재해석하도록 ──
      careerProjectId: (line.careerProjectId as string | null | undefined) ?? null,
      projectCode: (line.projectCode as string | null | undefined) ?? null,
      lineTargetId: (line.lineTargetId as string | null | undefined) ?? null,
      lineCode: (line.lineCode as string | null | undefined) ?? null,
      // 라인명 = 백엔드 lineName(master.line_name) → legacy record.line_name. mainTitle(main_title)와 별개.
      lineName: (line.lineName as string | null | undefined) ?? record?.line_name ?? null,
      outputLinks: cardOutputLinks,
      secondaryInfoDeadline: record?.secondary_info_deadline ?? null,
      images: mergedImages,
      imageCaptions: mergedCaptions,
      // 미리보기/모달 resolver 가 곧바로 쓸 수 있도록 라인 직접 첨부(단일 출처 보장).
      matchedLine: line,
    };
  };

  // source 선택은 careerLinesForWeek(주차 career 라인 존재 여부) 기준 유지 — placeholder-only 주차에서
  // legacy careerRecords 로 폴백하지 않는다(lines[] 가 SoT). 카드화는 개설 라인만.
  const workCareerCards =
    careerLinesForWeek.length > 0
      ? openedCareerLinesForWeek.map((line, index) => buildCareerCardFromLine(line, index, findCareerRecordForLine(line)))
      : careerRecords.length > 0
      ? careerRecords.map((record, index) => {
          // 강화 상태 계산: pending → 결정 시점(N+1 목 12:01 KST) 이후에만 enhanced 로 승격.
          // 2차 정보 / secondary_info_deadline 은 강화 성공/실패 판정에 영향 없음 (2026 정책).
          let computedStatus = record.enhancement_status;
          if (record.enhancement_status === "pending" && resultsDecided) {
            computedStatus = "enhanced";
          }

          // 강화 상태에 따른 배지 결정
          const getStatusBadge = (enhStatus: string) => {
            if (enhStatus === "enhanced") return "/images/0/cluster4/icon/5 강화 성공.png";
            if (enhStatus === "failed") return "/images/0/cluster4/icon/7 강화 실패.png";
            if (enhStatus === "pending") return "/images/0/cluster4/icon/6 강화 대기.png";
            return "/images/0/cluster4/icon/8 해당 없음.png";
          };

          // 어드민 output_images 와 크루 user_activity_details.image_urls 를 합쳐 3슬롯 채움.
          // 레거시 데이터(과거 저장 로직이 어드민 URL 까지 image_urls 에 함께 저장한 케이스)
          // 중복 노출 방지를 위해, 크루 슬롯에서 어드민 URL 과 동일한 항목은 걸러냄.
          // 운영진 output image 정책: 최대 1 (병합 card.images 에 반영되므로 여기서 클램프).
          const adminImgs = (record.output_images || []).filter((i) => i?.url?.trim()).slice(0, ADMIN_OUTPUT_IMAGE_MAX);
          const adminUrlSet = new Set(adminImgs.map((i) => i.url));
          const careerActivityType = workCareerActivityTypes[index];
          const careerDetail = careerActivityType ? weekActivityDetails.find((d) => d.activity_type_id === careerActivityType) : null;
          const rawCrewImgs = careerDetail?.image_urls || [];
          const rawCrewCaps = careerDetail?.image_captions || [];
          const crewImgs: (string | null)[] = [];
          const crewCaps: string[] = [];
          for (let i = 0; i < rawCrewImgs.length; i++) {
            const u = rawCrewImgs[i];
            if (u && adminUrlSet.has(u)) continue;
            crewImgs.push(u || null);
            crewCaps.push(rawCrewCaps[i] || "");
          }
          // 예약 슬롯 모델(2026-07-18): 등록된 경력 라인은 운영진 슬롯 0 을 이미지 유무와 무관하게 예약(크루는 2번 슬롯부터).
          //   운영진 이미지가 없어도(adminImgs.length===0) 크루 이미지가 슬롯 0 으로 당겨지지 않도록 floor 한다.
          const careerReserved = Math.min(Math.max(adminImgs.length, RESERVED_ADMIN_IMAGE_SLOTS), WORKCAREER_IMAGE_SLOT_COUNT);
          const { images: mergedImages, captions: mergedCaptions } = assembleReservedImageSlots(
            adminImgs,
            crewImgs,
            crewCaps,
            careerReserved,
            WORKCAREER_IMAGE_SLOT_COUNT,
          );
          return {
            id: index + 1,
            code: record.line_code || record.career_code || "-",
            badge: record.company_name,
            title: record.project_name || record.job_position,
            verified: computedStatus === "enhanced",
            date: weekData?.startDate ? formatDate(weekData.startDate) : formatDate(record.created_at),
            likes: "0,99",
            hasWeb: (record.output_links?.length || 0) > 0,
            icon: record.company_logo_url || "/images/0/cluster4/icon/default-company.png",
            companyHomepageUrl: (record.company_homepage_links && record.company_homepage_links[0]) || null,
            supervisorImg: record.supervisor_profile_img || "/images/0/cluster4/icon/실무 경력/감독자.jpg",
            supervisorName: record.supervisor_name || "-",
            supervisorDept: record.supervisor_department || "",
            supervisorCompany: record.company_name || record.supervisor_company || "",
            supervisorPosition: record.supervisor_position || "",
            statusBadge: getStatusBadge(computedStatus),
            grade: record.grade || "",
            isNotApplicable: computedStatus === "not_applicable",
            isEmpty: false,
            isFailed: computedStatus === "failed",
            // 추가 정보 (상세 보기용)
            projectDescription: (() => {
              const activityType = workCareerActivityTypes[index];
              const detail = activityType ? weekActivityDetails.find((d) => d.activity_type_id === activityType) : null;
              return detail?.sub_title && detail.sub_title.trim() !== "" ? detail.sub_title : record.project_description || null;
            })(),
            gradePoints: record.grade_points,
            recordId: record.record_id,
            projectId: record.project_id,
            lineCode: record.line_code,
            lineName: record.line_name,
            outputLinks: record.output_links,
            secondaryInfoDeadline: record.secondary_info_deadline || null,
            // 어드민 output_images 우선, 남은 슬롯은 크루 user_activity_details.image_urls 로 채움
            images: mergedImages,
            imageCaptions: mergedCaptions,
          };
        })
      : [];

  // 참여한 경력이 없으면 빈 카드 1개 표시
  // 빈 카드 템플릿
  const emptyCareerCard = (id: number) => ({
    id,
    code: "",
    badge: "",
    title: "",
    verified: false,
    date: "0000-00-00 (일)",
    likes: "0,99",
    hasWeb: false,
    isEmpty: true,
    icon: "",
    supervisorImg: "",
    supervisorName: "",
    supervisorDept: "",
    supervisorCompany: "",
    supervisorPosition: "",
    statusBadge: "",
    grade: "",
    isNotApplicable: false,
    isFailed: false,
    projectDescription: null as string | null,
    gradePoints: null as number | null,
    recordId: null as string | null,
    projectId: null as string | null,
    lineCode: null as string | null,
    lineName: null as string | null,
    outputLinks: null as { desc: string; url: string }[] | null,
    secondaryInfoDeadline: null as string | null,
  });

  // 휴식 모드일 때 실무 경력 카드 전부 '해당 없음'으로 강제. 본문(프로젝트명 등)은 보존.
  const effectiveWorkCareerCards = isRestMode
    ? workCareerCards.map((card) => ({
        ...card,
        statusBadge: "/images/0/cluster4/icon/8 해당 없음.png",
        isNotApplicable: true,
        isFailed: false,
        verified: false,
      }))
    : workCareerCards;

  // 참여한 카드(a)를 앞으로, 해당 없음 카드(b)를 뒤로 정렬
  const sortedWorkCareerCards = [...effectiveWorkCareerCards].sort((a, b) => {
    if (a.isNotApplicable !== b.isNotApplicable) {
      return a.isNotApplicable ? 1 : -1;
    }
    const nameA = (a.badge || "").trim();
    const nameB = (b.badge || "").trim();
    return nameA.localeCompare(nameB, "ko", { sensitivity: "base" });
  });

  // ── 실무 경력 고정 6슬롯 (2026-06-04 정책) ──
  // 어떤 주차든 카드 수 = 6의 배수(최소 6). 개설된 라인(실카드)을 앞에 채우고 나머지는
  // void(미개설 빈 슬롯 = emptyCareerCard, isEmpty=true)로 패딩한다.
  //  - void(미개설): 표시만, 모달 금지 (canOpenLineModal 게이트)
  //  - not_applicable(개설 + 미지원/미선발): 표시만, 모달 금지
  //  - pending/success/fail(선발자): 모달 가능
  const CAREER_CARDS_PER_PAGE = 6;
  const displayWorkCareerCards = (() => {
    const cards: ((typeof sortedWorkCareerCards)[number] | ReturnType<typeof emptyCareerCard>)[] = [...sortedWorkCareerCards];
    const target = Math.max(CAREER_CARDS_PER_PAGE, Math.ceil(cards.length / CAREER_CARDS_PER_PAGE) * CAREER_CARDS_PER_PAGE);
    for (let i = cards.length; i < target; i++) cards.push(emptyCareerCard(1001 + i));
    return cards;
  })();
  const totalCareerPages = Math.ceil(displayWorkCareerCards.length / CAREER_CARDS_PER_PAGE);
  const currentCareerCards = displayWorkCareerCards.slice(careerPage * CAREER_CARDS_PER_PAGE, (careerPage + 1) * CAREER_CARDS_PER_PAGE);

  // 별점 렌더링 함수 (반개 지원)
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        // 채워진 별
        stars.push(<img key={i} src="/images/0/cluster4/icon/icon - star.png" alt="star" className="star filled" />);
      } else if (i === fullStars && hasHalfStar) {
        // 반개 별
        stars.push(
          <span key={i} className="star half">
            <img src="/images/0/cluster4/icon/icon - star.png" alt="star" className="star-half-filled" />
            <img src="/images/0/cluster4/icon/icon - empty star.png" alt="star" className="star-half-empty" />
          </span>,
        );
      } else {
        // 빈 별
        stars.push(<img key={i} src="/images/0/cluster4/icon/icon - empty star.png" alt="star" className="star empty" />);
      }
    }
    return stars;
  };

  if (isLoadingWeek) {
    // 로딩 중에는 빈 화면/0값 대신 카드 상세 레이아웃을 모사한 Skeleton 을 노출한다.
    // (org 강조색·실제 값은 데이터 도착 후에만 렌더 → "빈 화면→데이터 등장" 점프 제거)
    return (
      <div className="cluster4-card-content weekly-card-detail" style={{ marginRight: "27px", minHeight: "400px" }} aria-busy="true">
        {/* 상단 탭/네비 바 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Skeleton width={44} height={44} radius={10} />
          <Skeleton width={44} height={44} radius={10} />
          <div style={{ flex: 1 }} />
          <Skeleton width={96} height={36} radius={8} />
          <Skeleton width={96} height={36} radius={8} />
          <Skeleton width={180} height={36} radius={8} />
        </div>

        {/* 섹션1: 좌측 큰 주차 이미지 + 우측 헤더/평판 영역 */}
        <div style={{ display: "flex", gap: 24, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 340px", minWidth: 280 }}>
            <Skeleton width="100%" height={320} radius={16} style={{ display: "block" }} />
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>
            <Skeleton width="60%" height={26} radius={6} style={{ display: "block" }} />
            <Skeleton width="40%" height={16} radius={4} style={{ display: "block" }} />
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              <Skeleton width={72} height={72} circle />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                <Skeleton width="80%" height={15} radius={4} style={{ display: "block" }} />
                <Skeleton width="65%" height={15} radius={4} style={{ display: "block" }} />
                <Skeleton width="50%" height={15} radius={4} style={{ display: "block" }} />
              </div>
            </div>
            <Skeleton width="100%" height={88} radius={12} style={{ display: "block", marginTop: 8 }} />
          </div>
        </div>

        {/* 하단 섹션: 4허브/통계 카드 자리 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 28 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`card-skeleton-${i}`} width="100%" height={140} radius={14} style={{ display: "block" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cluster4-card-content weekly-card-detail" style={{ marginRight: "27px" }}>
      {demoUserId ? <TestUserBanner /> : null}
      {/* 탭 영역 */}
      <div className="top-tabs-wrapper">
        <div className="top-tabs">
          <div
            className={`tab active${showWeeklyGrowthBadge ? " badge-visible" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowWeeklyGrowthBadge(!showWeeklyGrowthBadge);
            }}
            style={{ cursor: "pointer", width: "44px", height: "44px" }}
          >
            <img src="/images/0/cluster4/icon/icon%20-%20%EC%A0%84%EA%B5%AC.png" alt="전구" className="tab-icon" />
            <Link href={withPxRoute(`/cluster-4${userLinkQuery}`, pathname)} className="tab-badge" onClick={(e) => e.stopPropagation()}>
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </Link>
          </div>
          <Link href={withPxRoute(`/cluster-4-1${userLinkQuery}`, pathname)} className="tab" style={{ width: "44px", height: "44px" }}>
            <img src="/images/0/cluster4/icon/icon%20-%20book.png" alt="book" className="tab-icon" />
            <div className="tab-badge">
              <span className="badge-text">Season Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </Link>
        </div>
        {/* 디버그 정보 (개발 중 임시) */}
        <div style={{ fontSize: "10px", color: "#666", marginBottom: "5px" }}>
          [DEBUG] weekId: {weekId} | prevWeekId: {prevWeekId || "null"} | nextWeekId: {nextWeekId || "null"}
        </div>
        <div className="nav-buttons">
          {prevWeekId ? (
            <Link href={withPxRoute(`/cluster-4-card/${prevWeekId}${userLinkQuery}`, pathname)} className="nav-btn-prev">
              <span>이전 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20left.png" alt="left" className="arrow-icon" />
            </Link>
          ) : (
            <button className="nav-btn-prev disabled" disabled>
              <span>이전 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20left.png" alt="left" className="arrow-icon" />
            </button>
          )}
          {nextWeekId ? (
            <Link href={withPxRoute(`/cluster-4-card/${nextWeekId}${userLinkQuery}`, pathname)} className="nav-btn-next">
              <span>다음 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20right.png" alt="right" className="arrow-icon" />
            </Link>
          ) : (
            <button className="nav-btn-next disabled" disabled>
              <span>다음 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20right.png" alt="right" className="arrow-icon" />
            </button>
          )}
          <Link href={withPxRoute(`/cluster-4${userLinkQuery}#weekly-filter-bar`, pathname)} className="nav-btn-filled">
            <img src="/images/0/cluster4/icon/icon%20-%201.png" alt="list" className="list-icon" />
            <span>전체 목록으로 돌아가기</span>
          </Link>
        </div>
      </div>

      {/* ========== 섹션 1: 주차 이미지 + 헤더 + 평판 + 동료 ========== */}
      <div className="section1-layout">
        {/* 주차 평판 남기기 버튼 */}
        {
          <div className="floating-icons" style={{ display: "flex" }}>
            <div
              className="edit-icon"
              onClick={async () => {
                // 주차 평판은 타 크루만 작성 가능 (본인 카드에는 작성 불가) — 업무 규칙 유지
                if (!isDemoMode && isOwner && !session?.user?.isAdmin) {
                  await popup.alert("주차 평판은 타 크루만이 작성할 수 있습니다.");
                  return;
                }
                // 어드민 부여 권한(week_id) OR 기본 시간창 — weekly-review 와 동일 게이트.
                // (기존 "어드민 외 비활성화" 고정 차단 + canEditReputation 잔재 팝업 제거)
                if (!(await requireWeeklyReputationWriteAccess())) return;
                handleEditClick(() => {
                  // 이미 작성한 평판이 있는지 확인 (편집 경로 진입)
                  // 테스트 유저(데모) 모드는 세션이 없으므로 reviewer = demoUserId 로 본다(백엔드가
                  // reviewer 를 demoUserId 로 고정 저장 → 기존 평판 reviewer_id 도 demoUserId). 빠뜨리면
                  // 항상 신규(POST)로 진입해 중복 작성 409 로 저장이 막힌다.
                  const reviewerId = session?.user?.id || demoUserId || null;
                  const myExistingRep = !isDemoMode && reviewerId ? weeklyReputations.find((r: any) => r.reviewer_id === reviewerId) : null;

                  setHeaderModalType("타크루");
                  setHeaderModalOpen(true);
                  setFormKeywordMode(myExistingRep ? "select" : "select");
                  setSelectedKeywordTemp("");
                  setSaveAttemptFailed(false);
                  fetchCrewListIfNeeded();
                  fetchKeywordsIfNeeded();

                  if (myExistingRep) {
                    // 편집 모드: 기존 데이터 로드
                    const existing = {
                      rating: myExistingRep.rating || 0,
                      content: myExistingRep.content || "",
                      keyword: myExistingRep.keyword || "",
                    };
                    setReputationEditData(existing);
                    setFormSnapshot(existing);
                    setEditingWeeklyReputationId(myExistingRep.id);
                    // reviewer 프로필 + 평판 데이터 모두 포함 (reputationData useMemo와 동일 매핑)
                    const reviewer = myExistingRep.reviewer;
                    let age: string | number = "-";
                    if (reviewer?.birth_date) {
                      const birthYear = new Date(reviewer.birth_date).getFullYear();
                      const currentYear = new Date().getFullYear();
                      age = currentYear - birthYear;
                    }
                    const pi = resolvePersonalInfo({ profile: reviewer });
                    setSelectedReputationCard({
                      id: myExistingRep.id,
                      name: pi.name ?? "-",
                      gender: pi.gender ?? "-",
                      age,
                      profileImg: pi.profileImageUrl ?? "",
                      university: pi.school ?? "-",
                      major: pi.department ?? "-",
                      team: pi.team ?? "-",
                      part: pi.part ?? "-",
                      nickname: pi.tagline ?? "-",
                      role: formatMembershipRoleLabel(reviewer?.role),
                      rating: (myExistingRep.rating || 0) / 2,
                      ratingCount: `${myExistingRep.rating || 0} / 10`,
                      description: myExistingRep.content || "",
                      fm: reputationFm,
                      tagColor: "tag--pink",
                      tagText: `#${myExistingRep.keyword || "-"}`,
                      createdAt: myExistingRep.created_at || null,
                      isEmpty: false,
                    });
                    setIsReputationFormEditing(true);
                  } else {
                    // 신규 작성 경로
                    const initial = { rating: 0, content: "", keyword: "" };
                    setReputationEditData(initial);
                    setFormSnapshot(initial);
                    setEditingWeeklyReputationId(null);
                    setIsReputationFormEditing(true);
                    setSelectedReputationCard(null);
                  }
                });
              }}
              style={{ cursor: "pointer" }}
              title="주차 평판 남기기"
            >
              <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
            </div>
          </div>
        }
        {/* 왼쪽: 큰 주차 이미지 */}
        <div className="section1-left">
          <div className="main-image-container">
            <img
              src={currentImage}
              alt={currentTitle}
              className="main-week-image"
              data-stripped-src={currentImageStripped || undefined}
              onError={(e) => {
                const img = e.currentTarget;
                const stripped = img.dataset.strippedSrc;
                if (img.dataset.fallbackStep !== "1" && stripped) {
                  img.dataset.fallbackStep = "1";
                  img.src = stripped;
                } else {
                  img.src = "/images/0/cluster4/주차 이미지/휴식(개인,공식).png";
                }
              }}
            />
            {/* 뱃지 두 개 */}
            <div className="image-badges">
              <div className="badge-item heart-badge">
                <span className="badge-count">99</span>
                <i className="ti ti-heart"></i>
              </div>
            </div>

            {/* Weekly Review 박스 (작업 0~2: 정적 더미 + unfurl 애니메이션) */}
            <div ref={weeklyReviewRef} className={`weekly-review-box ${isReviewUnfurled ? "unfurled" : ""}`}>
              <div className="weekly-review-header">
                <img src="/images/0/book.png" alt="book" className="review-book-icon" />
                <h3 className="review-title">Weekly Review</h3>
                <button className="review-view-btn" onClick={() => setWeeklyReviewModalOpen(true)} aria-label="더보기">
                  <img src="/images/0/cluster4/icon/icon - 7 - eye.png" alt="view" className="view-icon" />
                </button>
              </div>
              <div className="weekly-review-mid">
                <p className="review-content">{weeklyReviewFromDB?.content || "아직 작성된 리뷰가 없습니다. 클릭하여 작성해보세요. 😊"}</p>
              </div>
              <div className="weekly-review-footer">
                <div className="review-rating-group">
                  {(() => {
                    const rating = weeklyReviewFromDB?.rating || 0;
                    const STAR_SIZE = 16;
                    const STAR_GAP = 2;
                    const visibleGaps = rating > 0 ? Math.floor((rating - 1) / 2) : 0;
                    const fillWidthPx = rating * (STAR_SIZE / 2) + Math.max(0, visibleGaps) * STAR_GAP;
                    return (
                      <div className="review-stars">
                        <div className="review-stars__base">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i key={`empty-${i}`} className="ti ti-star"></i>
                          ))}
                        </div>
                        <div className="review-stars__fill" style={{ width: `${fillWidthPx}px` }} aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i key={`filled-${i}`} className="ti ti-star-filled"></i>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <span className="review-score">{weeklyReviewFromDB?.rating || 0} / 10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 정보 영역 */}
        <div className="section1-right">
          {/* 헤더 */}
          <div className="section1-header">
            <div className="header-title-row">
              <h1 className="section1-title">{headerTitle || "-"}</h1>
              <div className={`status-badge ${headerStatusClass}`}>
                <span>{headerStatusText || "-"}</span>
                {headerStatusIcon ? <img src={headerStatusIcon} alt={headerStatusText || "-"} /> : null}
              </div>
            </div>
            <div className="header-info-row">
              <div className="info-badge date" style={{ alignSelf: "flex-start" }}>
                <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" />
                <span>{headerStartDate && headerEndDate ? `${formatDate(headerStartDate)} ~ ${formatDate(headerEndDate)}` : "로딩 중..."}</span>
              </div>
              <div className="info-badge role" style={{ width: "fit-content", minWidth: "auto", maxWidth: "200px", fontFamily: "'Pretendard', sans-serif", alignSelf: "flex-start" }}>
                <img src="/images/0/cluster4/icon/Interface/Star-3.png" alt="role" />
                <span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>{truncate(headerRoleLabel ?? "-", 8)}</span>
              </div>
              <div
                className="week-info-wrapper"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "6px",
                  width: "fit-content",
                  minWidth: "120px",
                  zIndex: 1,
                }}
              >
                <div className="info-badge week" style={{ alignSelf: "flex-end" }}>
                  <img src="/images/0/cluster4/icon/icon - 7.png" alt="week" />
                  <span>
                    <span className="highlight">{headerWeekHighlight}</span>{headerWeekSuffix}
                  </span>
                </div>
                <button ref={weekConfirmBtnRef} type="button" className={`week-confirm-btn status-${weekStatus}${isWeekConfirmed ? " is-confirmed" : ""}`} onClick={handleWeekConfirmClick} disabled={weekStatus !== "pending"} aria-label={isWeekConfirmed ? "주차 확인 완료" : "주차 확인 필요"}>
                  <span className="icon-shift">
                    <i className={isWeekConfirmed ? "ti ti-circle-check-filled" : "ti ti-circle-check"}></i>
                  </span>
                  <span>{isWeekConfirmed ? "확인 완료" : "확인 필요"}</span>
                </button>
                <button type="button" className="detail-log-btn" onClick={handleDetailLogOpen} aria-label="Detail Log 열기">
                  <i className="ti ti-list-details"></i>
                  <span>Detail Log</span>
                </button>
              </div>
            </div>
            <div className="header-info-row2" style={{ gap: "11px" }}>
              <div className="info-group left" style={{ flexShrink: 0 }}>
                <span className="info-item team" style={{ display: "inline-flex", minWidth: "245px", maxWidth: "245px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif" }}>
                  <strong>[팀]&nbsp;</strong>
                  <span className="text-gray">{headerIsOnboarding ? "클럽 온보딩" : headerTeamName === "운영진" && headerGeneration ? `운영진(${headerGeneration}기)` : (headerTeamName || "-").length > 10 ? (headerTeamName || "-").slice(0, 10) + ".." : headerTeamName || "-"}</span>
                </span>
                <span className="info-divider" style={{ marginLeft: "-63px" }}>
                  |
                </span>
                <span className="info-item part" style={{ display: "inline-flex", minWidth: "245px", maxWidth: "245px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", marginLeft: "-4px" }}>
                  <strong>[파트]&nbsp;</strong>
                  <span className="text-gray">
                    {headerIsOnboarding
                      ? "신입OT"
                      : headerTeamName === "운영진" && headerPartName === "팀장" && headerManagedTeamName
                        ? `팀장(${headerManagedTeamName})`.length > 10
                          ? `팀장(${headerManagedTeamName})`.slice(0, 10) + ".."
                          : `팀장(${headerManagedTeamName})`
                        : (headerPartName || "-").length > 10
                          ? (headerPartName || "-").slice(0, 10) + ".."
                          : headerPartName || "-"}
                  </span>
                </span>
              </div>
              <div className="info-group right" style={{ gap: "8px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", marginLeft: "0px" }}>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  {resolveHeaderPoint("단감").label}
                  <img src={resolveHeaderPoint("단감").icon} alt={resolveHeaderPoint("단감").label} className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right", color: "#9dfa07" }}>
                    {headerDangam}
                  </strong>
                  <span className="unit-text">개</span>
                </span>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  {resolveHeaderPoint("인절미").label}
                  <img src={resolveHeaderPoint("인절미").icon} alt={resolveHeaderPoint("인절미").label} className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right", color: "#9dfa07" }}>
                    {headerInjeolmi}
                  </strong>
                  <span className="unit-text">개</span>
                </span>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  {resolveHeaderPoint("어흥").label}
                  <img src={resolveHeaderPoint("어흥").icon} alt={resolveHeaderPoint("어흥").label} className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right", color: "#ff6b6b" }}>
                    {headerEoheung}
                  </strong>
                  <span className="unit-text">개</span>
                </span>
              </div>
            </div>
          </div>

          {/* 주차 평판 */}
          <div className="reputation-section">
            <div className="section-title-row">
              <img src="/images/0/cluster4/icon/icon - 주차 평판.png" alt="주차 평판" className="section-icon" />
              <span className="section-label" style={{ fontSize: "20px" }}>
                주차 평판
              </span>
              <span className="section-count" style={{ fontSize: "17px" }}>
                <span className="count-num">{reputationReceivedCount}</span>/{reputationReceivedLimit}
              </span>
              <span className="fm-badge">
                <img src="/images/0/cluster4/wifi new.png" alt="wifi" className="wifi-icon" />
                <span className="fm-label">FM :</span>
                <span className="fm-value">{reputationFm}</span>
              </span>
            </div>
            {(() => {
              // 카드 0개(또는 휴식 주차): 4슬롯 전체 영역을 통합 대기 영역으로 표시
              const filledCount = isRestMode ? 0 : reputationData.filter((c: any) => c && !c.isEmpty).length;
              if (false && filledCount === 0) {
                return (
                  <div className="reputation-cards-grid reputation-all-empty">
                    <div className="reputation-waiting-full">
                      <img src="/images/0/waiting.png" alt="waiting" />
                      <p>주차 평판 카드 작성 대기 중.. 😊</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="reputation-cards-grid">
                  {reputationData.map((user, index) => {
                    const isEmpty = user.isEmpty || isRestMode;
                    if (isEmpty) {
                      return (
                        <div key={user.id} className="reputation-card reputation-waiting-card">
                          <div className="reputation-waiting-content">
                            <div className="rep-wait__orb">
                              <span className="rep-wait__glyph">⏳</span>
                            </div>
                            <p className="rep-wait__title">주차 평판 대기 중</p>
                            <p className="rep-wait__desc">동료 크루의 평가를 기다리고 있어요</p>
                            <div className="rep-wait__dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // 1~3개 상태의 빈 슬롯: 카드 골격 + 내부 자리(프로필/별/코멘트/FM) 유지 + 각 자리의 값만 placeholder
                    // (pre-6단계 원래 구조: 같은 .reputation-card에 isEmpty 조건부 "-" 값)
                    return (
                      <div
                        key={user.id}
                        className={`reputation-card ${isEmpty ? "empty" : ""}`}
                        onClick={async () => {
                          if (!isEmpty) {
                            setSelectedReputationCard(user);
                            setReputationViewModalOpen(true);
                          }
                        }}
                        style={{ cursor: isEmpty ? "default" : "pointer" }}
                      >
                        <div className="card-profile">
                          <div className="profile-image">{!isEmpty && user.profileImg ? <img src={user.profileImg} alt={mask.crewName(user.name)} loading="lazy" decoding="async" /> : <div className="profile-placeholder"></div>}</div>
                          <div className="profile-info">
                            <div className="profile-name">
                              {isEmpty ? (
                                <>
                                  <span className="text">-</span> | <span className="text">-</span> | <span className="text">-</span>
                                </>
                              ) : (
                                <>
                                  <span className="text">{mask.crewName(user.name)}</span> | <span className="text">{user.gender}</span> | <span className="text">{mask.age(user.age)}세</span>
                                </>
                              )}
                            </div>
                            <div className="profile-details" style={{ fontSize: "16px" }}>
                              {isEmpty ? (
                                <>
                                  <div className="detail-line">
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", paddingRight: "4px" }}>
                                      -
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      학교
                                    </span>{" "}
                                    |{" "}
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", paddingRight: "4px" }}>
                                      -
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      학과
                                    </span>
                                  </div>
                                  <div className="detail-line">
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", paddingRight: "4px" }}>
                                      -
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      팀
                                    </span>{" "}
                                    |{" "}
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", paddingRight: "4px" }}>
                                      -
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      파트
                                    </span>
                                  </div>
                                  <div className="detail-line">
                                    <span className="text">&nbsp;</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="detail-line">
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right" }}>
                                      {truncate(formatSchool(mask.school(user.university)), 6)}
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      학교
                                    </span>{" "}
                                    |{" "}
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right" }}>
                                      {truncate(formatMajor(mask.major(user.major)), 6)}
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      학과
                                    </span>
                                  </div>
                                  <div className="detail-line">
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right" }}>
                                      {truncate(user.team || "-", 6)}
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      팀
                                    </span>{" "}
                                    |{" "}
                                    <span className="text" style={{ flex: 1, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right" }}>
                                      {truncate(user.part || "-", 6)}
                                    </span>
                                    <span className="label" style={{ fontSize: "16px" }}>
                                      파트
                                    </span>
                                  </div>
                                  <div className="detail-line" style={{ display: "flex", alignItems: "center" }}>
                                    <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", overflow: "hidden", textOverflow: "clip", whiteSpace: "nowrap" }}>
                                      <span
                                        className="badge-status yellow"
                                        style={{
                                          padding: "4px 7.2px",
                                          background: "rgba(250, 171, 7, 0.1)",
                                          borderRadius: 4,
                                          fontSize: 15,
                                          fontFamily: "'Pretendard', sans-serif",
                                          fontWeight: 600,
                                          lineHeight: "15px",
                                          color: "#faab07",
                                          whiteSpace: "nowrap",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {(() => { const v = formatCrewClassDisplayLabel(user.role, CREW_CLASS_REGULAR); return v.length > 7 ? v.slice(0, 7) + ".." : v; })()}
                                      </span>
                                    </span>
                                    <span style={{ width: "3px", flexShrink: 0 }}></span>
                                    <span className="nickname" style={{ flex: 1, fontSize: "16px", textAlign: "right", overflow: "hidden", whiteSpace: "nowrap", color: NICKNAME_COLORS[(index + NICKNAME_COLOR_OFFSET) % 4] }}>
                                      {(user.nickname || "-").length > 8 ? (user.nickname || "-").slice(0, 8) + ".." : user.nickname || "-"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="profile-divider"></div>
                        <div className="card-rating">
                          <div className="stars">{renderStars(isEmpty ? 0 : user.rating)}</div>
                          <span className="rating-count" style={{ fontSize: "14px" }}>
                            {isEmpty ? "- / 10" : user.ratingCount}
                          </span>
                        </div>
                        <div className="card-description" style={{ fontSize: "15px" }}>
                          {isEmpty ? (
                            "-"
                          ) : (
                            <>
                              {user.description.length > 20 ? `${user.description.slice(0, 20)}..` : user.description} <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="more-icon" />
                            </>
                          )}
                        </div>
                        <div className="card-footer">
                          <span className="fm-badge" style={{ fontSize: "17px" }}>
                            <img src="/images/0/cluster4/wifi new.png" alt="wifi" className="wifi-icon" /> FM : <span style={{ display: "inline-block", minWidth: "4ch", textAlign: "right" }}>{isEmpty ? "-" : user.fm}</span>
                          </span>
                          <span className="footer-divider">|</span>
                          <span className={`tag ${isEmpty ? "tag--dark" : user.tagColor}`} style={{ fontSize: "11.6px" }}>
                            {isEmpty ? "-" : truncate(user.tagText, 10)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* 연계 동료 */}
          <div className="colleague-section">
            {/* 플로팅 아이콘 - 연계 동료 편집 */}
            {
              <div className="floating-icons" style={{ display: "flex", alignItems: "flex-start" }}>
                <div
                  className="edit-icon"
                  onClick={async () => {
                    if (!isDemoMode && !isOwner) {
                      await popup.alert("연계 크루는 본인만이 작성할 수 있습니다.");
                      return;
                    }
                    // 모달 오픈 시점 작성 창 체크 — 서버 POST hasOpenEditWindow 와 동일 판정.
                    // 닫혀 있으면 게이트가 조용히 false 반환(안내 팝업 미노출 정책) → 모달(검색/입력 UI) 미오픈.
                    if (!(await requireWeeklyColleaguesWriteAccess())) return;
                    handleEditClick(() => {
                      handleOpenColleagueEdit();
                    });
                  }}
                  style={{ cursor: "pointer", marginTop: "8px" }}
                >
                  <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
                </div>
              </div>
            }
            <div className="section-title-row">
              <img src="/images/0/cluster4/icon/icon - 연계 동료.png" alt="연계 동료" className="section-icon" />
              <span className="section-label" style={{ fontSize: "20px" }}>
                연계 동료
              </span>
              <span className="section-count" style={{ fontSize: "17px" }}>
                <span className="count-num">{colleagueWrittenCount}</span>/{colleagueWrittenLimit}
              </span>
            </div>
            <div className="colleague-cards">
              {colleagueData.map((user, index) => {
                const isEmpty = user.isEmpty;
                if (isEmpty) {
                  return (
                    <div key={user.id} className="colleague-card colleague-card-empty">
                      <img src="/images/0/colleague.png" alt="동료 대기" className="empty-colleague-image" />
                      <p className="empty-colleague-message">나의 동료가 되어줄래..? (수줍)😍</p>
                    </div>
                  );
                }
                return (
                  <div
                    key={user.id}
                    className={`colleague-card ${isEmpty ? "empty" : ""}`}
                    onClick={async () => {
                      if (!isEmpty) {
                        setSelectedColleagueCard(user);
                        setSelectedColleagueIndex(index);
                        setColleagueViewModalOpen(true);
                      }
                    }}
                    style={{ cursor: isEmpty ? "default" : "pointer" }}
                  >
                    <div className="card-profile">
                      <div className="profile-image">{!isEmpty && user.profileImg ? <img src={user.profileImg} alt={mask.crewName(user.name)} loading="lazy" decoding="async" /> : <div className="profile-placeholder"></div>}</div>
                      <div className="profile-info">
                        <div className="profile-name-row">
                          <div className="profile-name">
                            {isEmpty ? (
                              <>
                                <span className="text">-</span> | <span className="text">-</span> | <span className="text">-</span>
                              </>
                            ) : (
                              <>
                                <span className="text">{mask.crewName(user.name)}</span> | <span className="text">{user.gender}</span> | <span className="text">{mask.age(user.age)}세</span>
                              </>
                            )}
                          </div>
                          <div className="date-view">
                            {!isEmpty && (
                              <span
                                className="badge-status yellow"
                                style={{
                                  padding: "4px 7.2px",
                                  background: "rgba(250, 171, 7, 0.1)",
                                  borderRadius: 4,
                                  fontSize: 15,
                                  fontFamily: "'Pretendard', sans-serif",
                                  fontWeight: 600,
                                  lineHeight: "15px",
                                  color: "#faab07",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                  marginRight: "8px",
                                }}
                              >
                                {(() => { const v = formatCrewClassDisplayLabel(user.role, CREW_CLASS_REGULAR); return v.length > 10 ? v.slice(0, 10) + ".." : v; })()}
                              </span>
                            )}
                            <span className="date">{isEmpty ? "0000 - 00 - 00 (일)" : user.date}</span>
                            <img src="/images/0/cluster4/icon/icon - 7 - eye.png" alt="view" className="view-icon" />
                          </div>
                        </div>
                        <div className="profile-details" style={{ fontSize: "16px" }}>
                          {isEmpty ? (
                            <>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                -
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                학교
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                -
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                학과
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                -
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                팀
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                -
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                파트
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                {truncate(formatSchool(mask.school(user.university)), 5)}
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                학교
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                {truncate(formatMajor(mask.major(user.major)), 5)}
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                학과
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                {truncate(user.team || "-", 5)}
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                팀
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="text" style={{ width: "88px", flexShrink: 0, overflow: "hidden", textOverflow: "clip", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", whiteSpace: "nowrap", textAlign: "right", display: "inline-block" }}>
                                {truncate(user.part || "-", 5)}
                              </span>
                              <span className="label" style={{ fontSize: "16px" }}>
                                파트
                              </span>
                              <span className="profile-divider" style={{ margin: "0 4px" }}>
                                |
                              </span>
                              <span className="nickname" style={{ fontSize: "16px", display: "inline-block", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "120px", textAlign: "right", marginLeft: "auto", color: NICKNAME_COLORS[(index + NICKNAME_COLOR_OFFSET) % 4] }}>
                                {truncate(user.nickname, 5)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========== 섹션 2: 주차 성장률 + 실무 정보 + 실무 역량 ========== */}
      <div className="section2-layout">
        {/* 주차 성장률 */}
        <div className="growth-rate-header">
          <div className="growth-left">
            <div className="progress-header">
              <span className="growth-title">주차 성장률</span>
              <span className="growth-count">
                <img src="/images/0/cluster4/icon/icon - 0 - 3star.png" alt="star" className="star-icon" /> 총{" "}
                <span style={{ display: "inline-block", minWidth: "2ch", textAlign: "right", color: "white", fontSize: 19, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>
                  {isRestMode ? "-" : growthStatsAdmin.total}
                </span>{" "}
                개 중{" "}
                <span className="highlight" style={{ display: "inline-block", minWidth: "2ch", textAlign: "right" }}>
                  {isRestMode ? "-" : growthStatsAdmin.success}
                </span>
                개
              </span>
            </div>
            <div className={`progress-bar-container ${isRestMode ? "rest-dimmed" : ""}`}>
              <div
                className="progress-bar"
                style={{
                  width: isRestMode
                    ? "100%"
                    : `${growthSuccessRate}%`,
                }}
              ></div>
              {isRestMode && <span className="rest-message">휴식주차로서 집계되지 않습니다</span>}
            </div>
          </div>
          <div className="growth-center">
            <span className="progress-percent">
              <span className="number">
                {isRestMode ? "-" : growthSuccessRate}
              </span>
              <span className="percent">%</span>
            </span>
          </div>
          <div className="growth-right">
            <span className="growth-label">라인별 강화 결과</span>
            <div className="legend-items">
              <span className="legend-item">
                <img src="/images/0/cluster4/icon/5 강화 성공.png" alt="강화 성공" className="legend-icon" />
                강화 성공
              </span>
              <span className="legend-item">
                <img src="/images/0/cluster4/icon/6 강화 대기.png" alt="강화 대기" className="legend-icon" />
                강화 대기
              </span>
              <span className="legend-item">
                <img src="/images/0/cluster4/icon/7 강화 실패.png" alt="강화 실패" className="legend-icon" />
                강화 실패
              </span>
              <span className="legend-item">
                <img src="/images/0/cluster4/icon/8 해당 없음.png" alt="해당 없음" className="legend-icon glow" />
                해당 없음
              </span>
            </div>
          </div>
        </div>

        {/* 실무 정보 */}
        <div className="work-info-section">
          {/* 플로팅 아이콘 - 로그인한 본인만 표시 */}
          {
            <div className="floating-icons" style={{ display: "flex" }}>
              {/* <div
                className="edit-icon"
                style={{ cursor: "default", opacity: 0.4 }}
              >
                <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
              </div> */}
              <div className="edit-icon search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <div className="tooltip">등록된 도움말이 없습니다</div>
              </div>
            </div>
          }
          <div className="section-header-row">
            <div className="section-title-left">
              <img src="/images/0/cluster4/icon/1 실무 정보.png" alt="실무 정보" className="section-icon" />
              <span className="section-name">
                실무 <span className="keyword-highlight">정보</span>
              </span>
            </div>
            <span className="section-count">
              총 <span style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right", color: "white", fontSize: 24, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>{isRestMode ? "-" : infoStatsAdmin.total}</span> 개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isRestMode ? "-" : infoStatsAdmin.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">허브 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isRestMode ? "-" : infoSuccessRate}
                </span>
                <span className="percent-sign">%</span>
              </span>
            </div>
          </div>
          <div className="work-info-cards">
            {effectiveWorkInfoCards.map((card) => {
              const isEmpty = card.isEmpty;
              // 라인명/뱃지 단일 출처 = 백엔드 matchedLine (프론트 재계산 금지).
              // 미리보기 라인명도 모달과 동일하게 lineName(master.line_name) 우선, null 이면 activityTypeName → legacy card.title.
              // (mainTitle 은 라인명이 아니라 "Main Title" 영역 전용 — 여기서 쓰지 않음)
              const matchedLine = isEmpty
                ? undefined
                : findCluster4Line(
                    { partType: "information", activityTypeKey: (card.activityType as string | null | undefined) ?? null },
                    { requireLineTargetId: false },
                  );
              const lineName =
                (matchedLine?.lineName as string | null | undefined) ||
                (matchedLine?.activityTypeName as string | null | undefined) ||
                (card.title as string | null | undefined) ||
                "-";
              // 강화 상태 단일 출처 = 백엔드 matchedLine (뱃지와 동일). 로컬 card.status 는 fallback.
              const enh = isEmpty ? null : enhancementStatusBadge(matchedLine);
              const effectiveStatus = (enh?.toneClass as string | null | undefined) ?? (card.status as string | null | undefined) ?? "not_applicable";
              // 미리보기 뱃지(강화 상태): 경험/역량 카드와 동일 패턴 — 컨테이너 위에서 1회 계산해
              // '해당 없음' 빛바램 클래스와 toneClass 를 공유한다(렌더된 뱃지 == 클래스 기준, drift 방지).
              const infoBadge =
                !isEmpty && card.status !== "empty"
                  ? (() => {
                      const src = enh?.src ?? (card.statusIcon as string | null | undefined);
                      const alt = enh?.alt ?? ((card.status as string | null | undefined) ?? "강화 상태");
                      if (!src) return null;
                      return { src, alt, toneClass: effectiveStatus };
                    })()
                  : null;
              // 비활성 카드(Faded Card) — not_applicable / void 통합 정책(2026-06-04, isFadedCardStatus SoT).
              // 카드 컨테이너 .faded-card(빛바램)로만 표현 — 실무 경력 카드와 동일 패턴.
              // void(isEmpty/empty placeholder)는 "void" 로 환산해 동일 판정. 성공/대기/실패는 영향 없음.
              const isFadedCard = isFadedCardStatus(isEmpty || card.status === "empty" ? "void" : effectiveStatus);
              // 모달 오픈 게이트: void(isEmpty/empty placeholder)·해당없음 카드는 클릭해도 모달 금지 (표시는 유지).
              const canOpenModal = !isEmpty && card.status !== "empty" && canOpenLineModal(effectiveStatus);
              return (
                <div
                  key={card.id}
                  className={`work-info-card ${isEmpty ? "empty" : ""} ${card.status === "empty" ? "is-empty-card" : ""} ${isFadedCard ? "faded-card" : ""}`}
                  onClick={
                    canOpenModal
                      ? async () => {
                          setSelectedWorkInfoCard(card);
                          setWorkInfoViewModalOpen(true);
                        }
                      : undefined
                  }
                  style={{ cursor: canOpenModal ? "pointer" : "default" }}
                  aria-disabled={canOpenModal ? undefined : true}
                >
                  <div className="card-content-area">
                    <div className="card-title-row">
                      <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="title-icon" />
                      <span className="card-title">Main Title</span>
                      <img src="/images/0/cluster4/icon/icon - 10 - clock.png" alt="verified" className="verified-icon" />
                      <span className="verified-text">Verified</span>
                      {!isEmpty && card.category && <span className={`tag ${card.tagColor}`}>{card.category}</span>}
                    </div>
                    <div className="card-body-row">
                      {/* '해당 없음' 빛바램은 카드 컨테이너 .not-applicable 로 일괄 처리 — 아이콘 단독 흐림(opacity 0.3) 제거. */}
                      <div className={`card-icon-area ${!isEmpty && card.isFruit ? "fruit" : ""}`}>
                        {!isEmpty && card.icon ? <img src={card.icon} alt={card.category} /> : <div className="icon-placeholder"></div>}
                      </div>
                      <span className="card-desc">{isEmpty ? "-" : lineName}</span>
                      {!isEmpty && <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />}
                    </div>
                  </div>
                  {/* 뱃지(강화 상태)는 위에서 계산한 infoBadge(백엔드 단일 출처) 재사용 — 컨테이너 .not-applicable 와 동일 기준. */}
                  {infoBadge && (
                    <div className="status-badge">
                      <img src={infoBadge.src} alt={infoBadge.alt} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 실무 경험 */}
        <div className="work-exp-section">
          {/* 플로팅 아이콘 - 본인 프로필일 때만 표시 */}
          {
            <div className="floating-icons" style={{ display: "flex" }}>
              {/* <div
                className="edit-icon"
                style={{ cursor: "default", opacity: 0.4 }}
              >
                <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
              </div> */}
              <div className="edit-icon search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <div className="tooltip">등록된 도움말이 없습니다</div>
              </div>
            </div>
          }
          <div className="section-header-row">
            <div className="section-title-left">
              <img src="/images/0/cluster4/icon/2 실무 경험.png" alt="실무 경험" className="section-icon" />
              <span className="section-name">
                실무 <span className="keyword-highlight">경험</span>
              </span>
            </div>
            <span className="section-count">
              총{" "}
              <span style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right", color: "white", fontSize: 24, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>
                {isOnboardingWeek || isRestMode ? "-" : experienceStatsAdmin.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : experienceStatsAdmin.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">허브 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : experienceSuccessRate}
                </span>
                <span className="percent-sign">%</span>
              </span>
            </div>
          </div>
          <div className="work-exp-cards">
            {workExpSlots.map((slot) => {
              // 고정 슬롯 기반 렌더링: 배열 순서가 아니라 카테고리(experienceSlotOrder)로 위치 고정.
              //  - 슬롯 0~4 = 1 도출 / 2 분석 / 3 평가 / 4 확장 / 5 관리 (항상 동일 위치)
              //  - 라인이 있는 슬롯 → 대표 카드(slot.card) 표시, 없으면 빈/해당없음
              //  - 관리(5) 슬롯 = 일반 단계 잠금(slot.isLocked), 심화 이상은 정상 표시
              const card = slot.card;
              const isEmpty = slot.isEmpty;
              const isLocked = slot.isLocked;
              // 미리보기 뱃지(강화 상태): weekId+partType(experience)+experienceLineMasterId/lineCode 로 matchedLine 매칭 후
              // enhancementStatusBadge 헬퍼 재사용 → img src/alt 결정 (프론트 재계산 금지). matchedLine 없으면 legacy fallback.
              // ※ 뱃지는 카드 본문(void/내용)과 무관하게 enhancementStatus 기준으로 표시한다.
              //   라인 status="void"(미개설/빈 슬롯)여도 enhancementStatus="not_applicable" 이면 '해당 없음' 뱃지를 보인다(숨김 금지).
              // 컨테이너 '해당 없음' 빛바램 클래스와 toneClass 를 공유하기 위해 여기(컨테이너 위)서 1회만 계산한다.
              const expBadge =
                !isLocked && card.enhancementStatus !== "empty"
                  ? (() => {
                      const matchedLine = findCluster4Line(
                        {
                          partType: "experience",
                          experienceLineMasterId: (card as { experienceLineMasterId?: string | null }).experienceLineMasterId ?? null,
                          lineCode: (card.code as string | null | undefined) ?? null,
                        },
                        { requireLineTargetId: false },
                      );
                      const enh = enhancementStatusBadge(matchedLine);
                      const legacy = (() => {
                        const statusImages: Record<string, string> = {
                          success: "/images/0/cluster4/icon/5 강화 성공.png",
                          waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                          failed: "/images/0/cluster4/icon/7 강화 실패.png",
                          not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                        };
                        // void(빈 슬롯) 카드는 card.enhancementStatus="not_applicable" → '해당 없음'.
                        // 내용 있는 카드인데 활동/라인이 없으면(이론상) '강화 실패'로만 폴백한다.
                        const fallbackStatus: EnhancementStatus =
                          isRestMode || isOnboardingWeek ? "not_applicable" : !isEmpty && !card.hasActivity ? "failed" : card.enhancementStatus;
                        return { src: statusImages[fallbackStatus] || statusImages["not_applicable"], alt: fallbackStatus, tone: fallbackStatus };
                      })();
                      return { toneClass: enh?.toneClass ?? legacy.tone, src: enh?.src ?? legacy.src, alt: enh?.alt ?? legacy.alt };
                    })()
                  : null;
              // 비활성 카드(Faded Card) — not_applicable / void 통합 정책(2026-06-04, isFadedCardStatus SoT).
              // 뱃지와 동일 toneClass 기준, 빈 슬롯(.empty)은 badge 부재 시 "void" 환산으로 동일 판정.
              // 잠금(.locked) 슬롯은 명시 가드로 제외(lock-overlay 가 카드를 덮음). 성공/대기/실패는 영향 없음.
              const expEffectiveStatus = expBadge?.toneClass ?? (isEmpty ? "void" : (card.enhancementStatus as string));
              const isExpFadedCard = !isLocked && isFadedCardStatus(expEffectiveStatus);
              // 모달 오픈 게이트: 잠금/void(empty)/해당없음 슬롯은 모달 금지. 뱃지와 동일 기준
              // (expBadge.toneClass = 백엔드 enhancementStatus 우선, 부재 시 legacy 카드 enum).
              const canOpenExpModal = !isLocked && canOpenLineModal(expEffectiveStatus);
              return (
                <div
                  key={`work-exp-slot-${slot.order}-${slot.category}`}
                  className={`work-exp-card ${isEmpty ? "empty" : ""}${isLocked ? " locked" : ""}${isExpFadedCard ? " faded-card" : ""}`}
                  onClick={
                    !canOpenExpModal
                      ? undefined
                      : async () => {
                          // 실제 라인이 있는 슬롯(slot.primary)만 그 슬롯의 카드를 세팅한다.
                          // 미개설(빈) 슬롯은 이전 선택값 누수 방지를 위해 매번 새 placeholder 로 초기화
                          // (1번 슬롯 line/matchedLine 공유 금지). placeholder 는 키/ matchedLine 이 없어
                          // resolveExpMatchedLine 이 라인 없음(undefined)으로 처리 → 모달이 "-"/해당없음 표시.
                          if (slot.primary) {
                            setSelectedWorkExpCard(slot.primary);
                          } else {
                            setSelectedWorkExpCard(buildExpPlaceholderCard(slot.slotIndex, slot.card.enhancementStatus));
                          }
                          setWorkExpViewModalOpen(true);
                        }
                  }
                  style={{ cursor: canOpenExpModal ? "pointer" : isLocked ? "not-allowed" : "default" }}
                  aria-disabled={canOpenExpModal ? undefined : true}
                >
                  <div className="card-top-row">
                    <div className={`card-icon-area ${!isEmpty && card.enhancementStatus === "failed" ? "failed" : ""}`}>
                      {/* 아이콘은 슬롯 카테고리 고정값(slot.slotIcon) 사용. extension("")·잠금·빈 슬롯은 placeholder. */}
                      {!isEmpty && slot.slotIcon ? <img src={slot.slotIcon} alt={card.badge} style={{ opacity: card.enhancementStatus === "failed" ? 0.3 : 1 }} /> : <div className="icon-placeholder"></div>}
                      {!isRestMode && !isEmpty && card.enhancementStatus === "failed" && (
                        <div className="failed-overlay" style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span className="failed-text" style={{ whiteSpace: "nowrap", width: "auto", color: "#ff4444", fontWeight: "800" }}>
                            강화 실패
                          </span>
                          <span className="failed-emoji">😿</span>
                        </div>
                      )}
                    </div>
                    <div className="card-header-area">
                      <div className="card-header-row">
                        <span className="code-tag">{isEmpty ? "-" : ((card as { displayCode?: string | null }).displayCode ?? "")}</span>
                        <span className="badge-tag">{isEmpty ? "-" : card.badge}</span>
                      </div>
                      <div className="card-rating-row">
                        <div className="stars">{renderStars(isEmpty ? 0 : card.rating)}</div>
                        <span className="rating-count">{isEmpty ? "- / 10" : card.ratingCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="card-bottom-area">
                    <div className="card-title-row">
                      <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="title-icon" />
                      <span className="card-title">Main Title</span>
                      {!isEmpty && card.verified && (
                        <>
                          <img src="/images/0/cluster4/icon/icon - 10 - clock.png" alt="verified" className="verified-icon" />
                          <span className="verified-text">Verified</span>
                        </>
                      )}
                    </div>
                    <p className="main-desc">
                      {isEmpty
                        ? "-"
                        : (() => {
                            const text = card.title || "-";
                            return text;
                          })()}
                    </p>
                    <div className="sub-title-row">
                      <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="sub-icon" />
                      <span className="sub-label">Sub Title</span>
                    </div>
                    <span className="sub-desc">
                      {isEmpty
                        ? "-"
                        : (() => {
                            // card.subTitle = 사용자 제출값(detail) → matchedLine.submission fallback (모달과 동일 source).
                            const text = card.subTitle || "-";
                            return text;
                          })()}
                    </span>
                    {!isEmpty && <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />}
                  </div>
                  {expBadge && (
                    <div className={`status-badge ${expBadge.toneClass}`}>
                      <img src={expBadge.src} alt={expBadge.alt} />
                    </div>
                  )}
                  {isLocked && (
                    <div className="lock-overlay" aria-hidden="true">
                      <img src="/images/0/cluster4/icon/lock.png" alt="" className="lock-overlay-icon" />
                      <span className="lock-overlay-label">잠금 중</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========== 섹션 3: 실무 경험 + 실무 경력 ========== */}
      <div className="section3-layout">
        {/* 실무 역량 */}
        <div className="work-ability-section">
          {/* 플로팅 아이콘 - 로그인한 본인만 표시 */}
          {
            <div className="floating-icons" style={{ display: "flex" }}>
              {/* <div
                className="edit-icon"
                style={{ cursor: "default", opacity: 0.4 }}
              >
                <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
              </div> */}
              <div className="edit-icon search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <div className="tooltip">등록된 도움말이 없습니다</div>
              </div>
            </div>
          }
          <div className="section-header-row">
            <div className="section-title-left">
              <img src="/images/0/cluster4/icon/3 실무 역량.png" alt="실무 역량" className="section-icon" />
              <span className="section-name">
                실무 <span className="keyword-highlight">역량</span>
              </span>
            </div>
            <span className="section-count">
              총{" "}
              <span style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right", color: "white", fontSize: 24, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>
                {isOnboardingWeek || isRestMode ? "-" : competencyStatsAdmin.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : competencyStatsAdmin.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">허브 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : competencySuccessRate}
                </span>
                <span className="percent-sign">%</span>
              </span>
            </div>
          </div>
          <div className="work-ability-cards">
            {displayedAbilityCards.map((card, abilityCardIdx) => {
              const isFailedCard = card.enhancementStatus === "failed";
              // void placeholder 는 displayedAbilityCards 가 단일 fallback 카드일 때만 (isEmpty 표식).
              const usePlaceholder = !!card.isEmpty;
              // 미리보기 뱃지(강화 상태): weekId+partType(competency)+competencyLineMasterId/lineCode 로 matchedLine 매칭 후
              // enhancementStatusBadge 헬퍼 재사용 → img src/alt 결정 (프론트 재계산 금지). matchedLine 없으면 legacy fallback.
              // 컨테이너 '해당 없음' 빛바램 클래스와 toneClass 를 공유하기 위해 여기(컨테이너 위)서 1회만 계산한다.
              const abilityBadge =
                card.enhancementStatus !== "empty"
                  ? (() => {
                      const matchedLine = findCluster4Line(
                        {
                          partType: "competency",
                          competencyLineMasterId: (card as { competencyLineMasterId?: string | null }).competencyLineMasterId ?? null,
                          lineCode: ((card.lineCode as string | null | undefined) ?? (card.code as string | null | undefined)) ?? null,
                        },
                        { requireLineTargetId: false },
                      );
                      const enh = enhancementStatusBadge(matchedLine);
                      const src = enh?.src ?? (card.statusIcon as string | null | undefined);
                      const alt = enh?.alt ?? "강화 상태";
                      if (!src) return null;
                      return { src, alt, toneClass: enh?.toneClass ?? (card.enhancementStatus as string) };
                    })()
                  : null;
              // 비활성 카드(Faded Card) — not_applicable / void 통합 정책(2026-06-04, isFadedCardStatus SoT).
              // 뱃지와 동일 toneClass 기준, void placeholder 는 badge 부재 시 "void" 환산으로 동일 판정.
              // 성공/대기/실패는 영향 없음.
              const abilityEffectiveStatus = abilityBadge?.toneClass ?? (usePlaceholder ? "void" : (card.enhancementStatus as string));
              const isAbilityFadedCard = isFadedCardStatus(abilityEffectiveStatus);
              // 모달 오픈 게이트: void placeholder·해당없음 카드는 모달 금지. 뱃지와 동일 기준
              // (abilityBadge.toneClass = 백엔드 enhancementStatus 우선, 부재 시 legacy 카드 enum).
              // ── 역량 전용 예외(2026-06-04 최종 정책): 강화 실패 = 보이드 — 내용 차폐 + 모달 금지.
              //    (정보/경험/경력은 실패여도 내용 표시·모달 오픈 — 기존 동작 유지, canOpenLineModal 공용 게이트 불변.)
              const abilityFailedVoid =
                abilityEffectiveStatus === "failed" || abilityEffectiveStatus === "fail";
              const canOpenAbilityModal =
                !usePlaceholder && !abilityFailedVoid && canOpenLineModal(abilityEffectiveStatus);
              return (
                <div
                  key={usePlaceholder ? "void" : `${card.code}-${abilityCardIdx}`}
                  className={`work-ability-card ${usePlaceholder ? "empty" : ""}${isAbilityFadedCard ? " faded-card" : ""}`}
                  onClick={
                    canOpenAbilityModal
                      ? async () => {
                          setSelectedWorkAbilityCard(card);
                          setWorkAbilityViewModalOpen(true);
                        }
                      : undefined
                  }
                  style={{ cursor: canOpenAbilityModal ? "pointer" : "default" }}
                  aria-disabled={canOpenAbilityModal ? undefined : true}
                >
                  <div className={`card-icon-area ${isFailedCard ? "failed" : ""}`}>
                    {card.icon ? <img src={card.icon} alt={card.lineName} style={{ opacity: isFailedCard ? 0.3 : 1 }} /> : <div className="icon-placeholder"></div>}
                    {!isRestMode && isFailedCard && (
                      <div className="failed-overlay" style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span className="failed-text" style={{ whiteSpace: "nowrap", width: "auto", color: "#ff4444", fontWeight: "800" }}>
                          강화 실패
                        </span>
                        <span className="failed-emoji">😿</span>
                      </div>
                    )}
                  </div>
                  <div className="card-content-area">
                    <div className="card-title-row">
                      <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="title-icon" />
                      <span className="card-title">Main Title</span>
                      {card.enhancementStatus === "success" && (
                        <>
                          <img src="/images/0/cluster4/icon/icon - 10 - clock.png" alt="verified" className="verified-icon" />
                          <span className="verified-text">Verified</span>
                        </>
                      )}
                      <span className="code-tag">{(card as { displayCode?: string | null }).displayCode ?? ""}</span>
                      <span className="info-tag">{card.lineName}</span>
                    </div>
                    <p className="main-desc">{usePlaceholder ? "-" : card.title || "-"}</p>
                    <div className="sub-title-row">
                      <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="sub-icon" />
                      <span className="sub-label">Sub Title</span>
                    </div>
                    <span className="sub-desc">{usePlaceholder ? "-" : card.subTitle || "-"}</span>
                    <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />
                  </div>
                  {abilityBadge && (
                    <div className="status-badge">
                      <img src={abilityBadge.src} alt={abilityBadge.alt} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="character-image">
            <img src="/images/0/cluster4/bg img 2.png" alt="character" />
          </div>
        </div>

        {/* 실무 경력 */}
        <div className="work-career-section">
          {/* 플로팅 아이콘 - 본인 프로필일 때만 표시 */}
          {
            <div className="floating-icons" style={{ display: "flex" }}>
              {/* <div
                className="edit-icon"
                style={{ cursor: "default", opacity: 0.4 }}
              >
                <i className="ti ti-pencil" style={{ fontSize: "16px", color: "#1a1a1a" }}></i>
              </div> */}
              <div className="edit-icon search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <div className="tooltip">등록된 도움말이 없습니다</div>
              </div>
            </div>
          }
          <div className="section-header-row">
            <div className="section-title-left">
              <img src="/images/0/cluster4/icon/4 실무 경력.png" alt="실무 경력" className="section-icon" />
              <span className="section-name">
                실무 <span className="keyword-highlight">경력</span>
              </span>
            </div>
            <span className="section-count">
              총{" "}
              <span style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right", color: "white", fontSize: 24, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>
                {isOnboardingWeek || isRestMode ? "-" : careerStatsAdmin.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : careerStatsAdmin.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">허브 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : careerSuccessRate}
                </span>
                <span className="percent-sign">%</span>
              </span>
            </div>
          </div>
          <div className="work-career-cards">
            {currentCareerCards.map((card, cardIndex) => {
              const isEmpty = card.isEmpty;
              // 실무 경력 등급/점수/강화 — 백엔드 DTO 라인 단일 출처 (부재 시 careerRecords legacy fallback).
              // grade-row 와 아래 status-badge 가 동일 matchedLine 을 공유하도록 여기서 1회만 매칭한다.
              const careerLine = isEmpty
                ? undefined
                : findCluster4Line(
                    {
                      partType: "career",
                      careerProjectId: (card as { careerProjectId?: string | null }).careerProjectId ?? null,
                      projectCode:
                        ((card as { projectCode?: string | null }).projectCode ??
                          (card as { lineCode?: string | null }).lineCode ??
                          (card.code as string | null | undefined)) ?? null,
                    },
                    { requireLineTargetId: false },
                  );
              const careerInfo = careerGradeInfo(careerLine, card);
              // 모달 오픈 게이트: void(미개설 빈 슬롯=isEmpty)·해당없음 카드는 모달 금지. 뱃지와 동일 기준
              // (careerLine enhancementStatus 우선, 부재 시 legacy 카드 플래그로 환산).
              const careerEffectiveStatus = isEmpty
                ? "void"
                : (enhancementStatusBadge(careerLine)?.toneClass ??
                    (card.isNotApplicable ? "not_applicable" : card.isFailed ? "failed" : card.verified ? "success" : "waiting"));
              const canOpenCareerModal = canOpenLineModal(careerEffectiveStatus);
              // 비활성 카드(Faded Card) — not_applicable / void 통합 정책(2026-06-04, isFadedCardStatus SoT).
              // careerEffectiveStatus(isEmpty → "void", 그 외 뱃지 toneClass 우선) 그대로 판정 — 게이트와 동일 기준.
              const isCareerFadedCard = isFadedCardStatus(careerEffectiveStatus);
              return (
                <div key={card.id} className="work-career-card-wrapper">
                  <div
                    className={`work-career-card ${isEmpty ? "empty" : ""} ${card.isFailed ? "failed" : ""} ${isCareerFadedCard ? "faded-card" : ""}`}
                    onClick={
                      canOpenCareerModal
                        ? async () => {
                            setSelectedWorkCareerCard(card);
                            setWorkCareerViewModalOpen(true);
                          }
                        : undefined
                    }
                    style={{ cursor: canOpenCareerModal ? "pointer" : "default" }}
                    aria-disabled={canOpenCareerModal ? undefined : true}
                  >
                    {card.isFailed && <div className="card-overlay failed"></div>}
                    <div className="card-top-row">
                      <div className="card-icon-area" style={{ position: "relative" }}>
                        {!isEmpty && card.icon ? <img src={card.icon} alt={card.badge} style={{ opacity: card.isFailed ? 0.3 : 1 }} /> : <div className="icon-placeholder"></div>}
                        {!isEmpty && card.isFailed && (
                          <div className="failed-overlay" style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span className="failed-text" style={{ whiteSpace: "nowrap", width: "auto", color: "#ff4444", fontWeight: "800" }}>
                              강화 실패
                            </span>
                            <span className="failed-emoji">😿</span>
                          </div>
                        )}
                      </div>
                      <div className="card-header-area">
                        <div className="card-header-row">
                          <img src="/images/0/cluster4/icon/icon - 10 - clock.png" alt="verified" className="verified-icon" />
                          <span className="verified-text">Verified</span>
                          <span className="code-tag">{isEmpty ? "-" : ((card as { displayCode?: string | null }).displayCode ?? "")}</span>
                        </div>
                        <div className="grade-row">
                          {["S", "A", "B", "C", "D"].map((g) => (
                            <span key={g} className={`grade ${!isEmpty && careerInfo.grade === g ? "active" : ""}`}>
                              {g}
                            </span>
                          ))}
                          {/* 점수: DTO careerGradePoints 단일 출처(10/8/6/4/2). 미평가(null) → "-". */}
                          <span className="grade-points" aria-label="라인 평점 점수">
                            {!isEmpty && careerInfo.points != null ? `${careerInfo.points}점` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="card-bottom-area">
                      <p className="category-text">
                        {isEmpty
                          ? "-"
                          : (() => {
                              const t = card.badge.replace("|", " - ");
                              return t;
                            })()}
                      </p>
                      <div className="card-title-row">
                        <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="title-icon" />
                        <span className="card-title">Main Title</span>
                      </div>
                      <p className="main-desc-white">
                        {isEmpty
                          ? "-"
                          : (() => {
                              const text = card.title || "-";
                              return text;
                            })()}
                      </p>
                      <div className="sub-title-row">
                        <img src="/images/0/cluster4/icon/icon - 11 - file.png" alt="icon" className="sub-icon" />
                        <span className="sub-label">Sub Title</span>
                      </div>
                      <span className="sub-desc">
                        {isEmpty
                          ? "-"
                          : (() => {
                              const text = card.projectDescription || "-";
                              return text;
                            })()}
                      </span>
                      {!isEmpty && <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />}
                      <div className="supervisor-section">
                        <span className="supervisor-label">실무 기업 감독자</span>
                        <div className="supervisor-info">
                          <div className="supervisor-profile">
                            <div className={`profile-avatar ${isEmpty ? "empty" : ""}`}>{!isEmpty && card.supervisorImg && <img src={card.supervisorImg} alt="supervisor" />}</div>
                            <div className="profile-text">
                              <span className="supervised-text">Supervised by:</span>
                              <span className="profile-name" style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                                {isEmpty ? (
                                  "-"
                                ) : (
                                  <>
                                    <span style={{ display: "inline-block", minWidth: "54px", maxWidth: "54px", textAlign: "left", overflow: "hidden" }}>
                                      <strong>{(card.supervisorName || "").length > 3 ? (card.supervisorName || "").slice(0, 3) + ".." : card.supervisorName}</strong>
                                    </span>
                                    <span style={{ flexShrink: 0 }}> | </span>
                                    <span style={{ display: "inline-block", minWidth: "112px", maxWidth: "112px", textAlign: "left", overflow: "hidden", paddingLeft: "4px", boxSizing: "border-box" }}>
                                      {(card.supervisorDept || "-").length > 7 ? (card.supervisorDept || "-").slice(0, 7) + ".." : card.supervisorDept || "-"}
                                    </span>
                                    <span style={{ flexShrink: 0 }}> | </span>
                                    <span style={{ display: "inline-block", minWidth: "100px", maxWidth: "100px", textAlign: "left", overflow: "hidden", paddingLeft: "4px", boxSizing: "border-box" }}>
                                      {(card.supervisorCompany || "-").length > 6 ? (card.supervisorCompany || "-").slice(0, 6) + ".." : card.supervisorCompany || "-"}
                                    </span>
                                    <span style={{ flexShrink: 0 }}> | </span>
                                    <span style={{ display: "inline-block", minWidth: "32px", maxWidth: "32px", textAlign: "left", overflow: "hidden", paddingLeft: "4px", boxSizing: "border-box" }}>
                                      {(card.supervisorPosition || "-").length > 2 ? (card.supervisorPosition || "-").slice(0, 2) + ".." : card.supervisorPosition || "-"}
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="profile-divider"></div>
                      </div>
                      <div className="card-footer-row">
                        <span className="current-bid">Current Bid</span>
                        <div className="date-view">
                          <span className="date">{isEmpty ? "0000-00-00 (일)" : card.date}</span>
                          <span className="check-badge">
                            <i className="ti ti-check"></i>
                          </span>
                        </div>
                        <span className="likes">
                          <img src="/images/0/cluster4/icon/icon%20-%209.png" alt="likes" className="likes-icon" />
                          {isEmpty ? "0,99" : card.likes}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!isEmpty && (() => {
                    // 미리보기 뱃지(강화 상태): 위에서 매칭한 careerLine(weekId+career+careerProjectId/projectCode) 재사용.
                    // enhancementStatusBadge 헬퍼 재사용 → img src/alt 결정 (프론트 재계산 금지). matchedLine 없으면 legacy fallback.
                    const matchedLine = careerLine;
                    const enh = enhancementStatusBadge(matchedLine);
                    const src = enh?.src ?? (card.statusBadge as string | null | undefined);
                    const alt = enh?.alt ?? "status";
                    if (!src) return null;
                    // not-applicable-text: enhancementStatus 기준(매칭 시), 미매칭 시 legacy isNotApplicable.
                    const showNotApplicable = enh ? enh.toneClass === "not_applicable" : !!card.isNotApplicable;
                    return (
                      <div className="status-badge">
                        <img src={src} alt={alt} />
                        {showNotApplicable && <span className="not-applicable-text">해당 없음</span>}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          {totalCareerPages > 1 && (
            <div className="section3-pagination">
              {Array.from({ length: totalCareerPages }).map((_, i) => (
                <span key={i} className={`page-num ${careerPage === i ? "active" : ""} ${i === totalCareerPages - 1 ? "last" : ""}`} onClick={() => setCareerPage(i)} style={{ cursor: "pointer" }}>
                  {i + 1}
                </span>
              ))}
            </div>
          )}
          <div className="section-bottom-divider"></div>
        </div>
      </div>

      {/* ========== 실무 정보 모달 ========== */}
      {workInfoModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-work-edit">
            <div className="section-modal-header">
              <h3>실무 정보 편집</h3>
            </div>
            <div className="section-modal-body">
              {workInfoCards
                .filter((card) => !card.isEmpty)
                .map((card, index) => (
                  <div key={card.id} className="modal-card-item modal-card-workinfo">
                    {/* 상단 헤더: 과일 아이콘 + 태그 + 강화 상태 뱃지 */}
                    <div className="modal-card-header-row">
                      <div className="modal-card-left">
                        <div className={`modal-fruit-icon ${card.isFruit ? "fruit" : ""} ${card.isFailed ? "failed" : ""}`}>{card.icon && <img src={card.icon} alt={card.category} />}</div>
                        <div className="modal-card-info">
                          <span className={`modal-card-tag ${card.tagColor}`}>{card.category}</span>
                        </div>
                      </div>
                      <div className="modal-header-right">
                        <div className="modal-status-badge">
                          {card.status === "success" && (
                            <>
                              <img src="/images/0/cluster4/icon/5 강화 성공.png" alt="강화성공" />
                              <span className="status-text success">강화성공</span>
                            </>
                          )}
                          {card.status === "waiting" && (
                            <>
                              <img src="/images/0/cluster4/icon/6 강화 대기.png" alt="강화대기" />
                              <span className="status-text waiting">강화대기</span>
                            </>
                          )}
                          {card.status === "failed" && (
                            <>
                              <img src="/images/0/cluster4/icon/7 강화 실패.png" alt="강화실패" />
                              <span className="status-text fail">강화실패</span>
                            </>
                          )}
                          {card.status === "not_applicable" && (
                            <>
                              <img src="/images/0/cluster4/icon/8 해당 없음.png" alt="해당없음" />
                              <span className="status-text not-applicable">해당없음</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="modal-card-content">
                      {/* 타이틀 + 내용 (읽기 전용) */}
                      <div className="modal-title-section">
                        <div className="main-title">Main Title</div>
                        <div className="content-title">{card.title}</div>
                        <div className="modal-date-badge">
                          <span>{weekDateRange}</span>
                        </div>
                      </div>

                      {/* 미개설/강화실패/마감 안내 */}
                      {!isActivityActive(card.activityType) && (
                        <div
                          style={{
                            padding: "16px",
                            backgroundColor: getEnhancementStatus(card.activityType) === "failed" || isActivityExpired(card.activityType) ? "#fee2e2" : "#fff3cd",
                            border: getEnhancementStatus(card.activityType) === "failed" || isActivityExpired(card.activityType) ? "1px solid #ef4444" : "1px solid #ffc107",
                            borderRadius: "8px",
                            marginBottom: "16px",
                          }}
                        >
                          <p style={{ margin: 0, color: getEnhancementStatus(card.activityType) === "failed" || isActivityExpired(card.activityType) ? "#dc2626" : "#856404", fontSize: "14px" }}>
                            {getEnhancementStatus(card.activityType) === "failed"
                              ? "❌ 강화에 실패하여 2차 정보를 작성할 수 없습니다."
                              : isActivityExpired(card.activityType)
                                ? "⏰ 2차 정보 작성 기간이 마감되었습니다 (수 오후 22시까지)"
                                : "⚠️ 이 활동은 아직 개설되지 않았습니다. 운영진이 개설한 후 편집할 수 있습니다."}
                          </p>
                        </div>
                      )}

                      {/* Sub Title - 개설된 경우만 수정 가능 */}
                      <div className="modal-input-group">
                        <div className="section-label-row">
                          <div className="section-label">Sub Title</div>
                          <div className="char-counter">
                            <span className={(editingDetails[card.activityType]?.subTitle || "").length > 0 ? "active" : ""}>{(editingDetails[card.activityType]?.subTitle || "").length}</span> / 150
                          </div>
                        </div>
                        <textarea
                          value={editingDetails[card.activityType]?.subTitle || ""}
                          onChange={async (e) => {
                            if (e.target.value.length > 150) {
                              await popup.alert("최대 150자까지 입력할 수 있습니다.");
                              return;
                            }
                            setEditingDetails((prev) => ({
                              ...prev,
                              [card.activityType]: {
                                ...prev[card.activityType],
                                subTitle: e.target.value,
                              },
                            }));
                          }}
                          placeholder={isActivityActive(card.activityType) ? "메인 타이틀 내용에 대한 본인의 의견을 서브 타이틀 내용으로 입력해주세요 :)" : ""}
                          rows={3}
                          maxLength={150}
                          disabled={!isActivityActive(card.activityType)}
                          style={!isActivityActive(card.activityType) ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                        ></textarea>
                      </div>

                      {/* Output Link - 운영진 입력은 읽기 전용, 미개설 시 전체 비활성화 */}
                      <div className="modal-input-group">
                        <div className="section-label">Output Link</div>
                        <div className="output-links-buttons">
                          {[0, 1, 2, 3, 4].map((idx) => {
                            const link = editingDetails[card.activityType]?.outputLinks?.[idx] || { desc: "", url: "" };
                            const hasContent = link.url.trim() !== "";
                            const adminCount = getAdminOutputLinksCount(card.activityType);
                            const isAdminLink = idx < adminCount;
                            const isDisabled = !isActivityActive(card.activityType) || isAdminLink;
                            return (
                              <div key={idx} className={`output-link-item ${hasContent ? "active" : ""} ${isAdminLink ? "admin-link" : ""}`}>
                                <div className="link-button">
                                  <span className="link-num">{idx + 1}</span>
                                </div>
                                <input
                                  type="text"
                                  className="link-desc"
                                  placeholder={isDisabled ? "" : "링크 설명 (20자)"}
                                  maxLength={20}
                                  value={link.desc}
                                  disabled={isDisabled}
                                  style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                  onChange={async (e) => {
                                    if (e.target.value.length > 20) {
                                      await popup.alert("최대 20자까지 입력할 수 있습니다.");
                                      return;
                                    }
                                    !isDisabled &&
                                      setEditingDetails((prev) => {
                                        const currentLinks = [...(prev[card.activityType]?.outputLinks || createEmptyOutputLinks())];
                                        currentLinks[idx] = { ...currentLinks[idx], desc: e.target.value };
                                        return {
                                          ...prev,
                                          [card.activityType]: {
                                            ...prev[card.activityType],
                                            outputLinks: currentLinks,
                                          },
                                        };
                                      });
                                  }}
                                />
                                <input
                                  type="url"
                                  className="link-url"
                                  placeholder={isDisabled ? "" : "URL"}
                                  value={link.url}
                                  disabled={isDisabled}
                                  style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                  onChange={(e) =>
                                    !isDisabled &&
                                    setEditingDetails((prev) => {
                                      const currentLinks = [...(prev[card.activityType]?.outputLinks || createEmptyOutputLinks())];
                                      currentLinks[idx] = { ...currentLinks[idx], url: e.target.value };
                                      return {
                                        ...prev,
                                        [card.activityType]: {
                                          ...prev[card.activityType],
                                          outputLinks: currentLinks,
                                        },
                                      };
                                    })
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                        {getAdminOutputLinksCount(card.activityType) > 0 && <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>* 'A' 표시된 링크는 운영진이 입력한 것으로 수정할 수 없습니다.</p>}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="section-modal-footer">
              <button className="cancel-btn" onClick={() => setWorkInfoModalOpen(false)}>
                취소
              </button>
              <button className="save-btn" onClick={saveAllActivityDetails} disabled={isSaving}>
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 실무 역량 모달 ========== */}
      {workAbilityModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-work-edit">
            <div className="section-modal-header">
              <h3>실무 역량 편집</h3>
            </div>
            <div className="section-modal-body">
              {(() => {
                const abilityActivity = findFirstAbilityActivity();
                const abilityActivityTypeInfo = abilityActivity ? getActivityTypeInfo(abilityActivity.activity_type_id) : null;
                // 강화 실패 여부 체크: 활동이 개설되어 있어도 강화 실패면 2차 정보 작성 불가
                const abilityEnhancementStatus = abilityActivity ? getEnhancementStatus(abilityActivity.activity_type_id) : "not_applicable";
                const isAbilityFailed = abilityEnhancementStatus === "failed";
                // 편집 가능 여부: 활동이 개설되어 있고, 48시간 내이고, 강화 실패가 아닌 경우에만 가능
                const canEditAbility = isAnyAbilityActivityActive() && !isAbilityFailed;
                return (
                  <div className="modal-card-item modal-card-workinfo">
                    {/* 상단 헤더: 과일 아이콘 + 태그 + 강화 상태 뱃지 */}
                    <div className="modal-card-header-row">
                      <div className="modal-card-left">
                        <div className="modal-fruit-icon fruit">
                          <img src={abilityActivity ? getCompetencyIconPath(abilityActivity.activity_type_id) : "/images/0/cluster4/icon/실무 역량/실무 역량 - default.png"} alt="실무 역량" />
                        </div>
                        <div className="modal-card-info">
                          <span className="modal-card-tag tag--cyan">{abilityActivityTypeInfo?.name || "-"}</span>
                        </div>
                        <div className="modal-code-badge">
                          <span>{abilityActivityTypeInfo?.line_code || "-"}</span>
                        </div>
                      </div>
                      <div className="modal-header-right">
                        {(() => {
                          const statusLabels: Record<string, string> = {
                            success: "강화성공",
                            waiting: "강화대기",
                            failed: "강화실패",
                            not_applicable: "해당없음",
                          };
                          const statusImages: Record<string, string> = {
                            success: "/images/0/cluster4/icon/5 강화 성공.png",
                            waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                            failed: "/images/0/cluster4/icon/7 강화 실패.png",
                            not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                          };
                          return (
                            <div className={`modal-status-badge ${abilityEnhancementStatus}`}>
                              <img src={statusImages[abilityEnhancementStatus]} alt={statusLabels[abilityEnhancementStatus]} />
                              <span className={`status-text ${abilityEnhancementStatus}`}>{statusLabels[abilityEnhancementStatus]}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="modal-card-content">
                      {/* 타이틀 + 내용 (읽기 전용) */}
                      <div className="modal-title-section">
                        <div className="main-title">Main Title</div>
                        <div className="content-title">{abilityActivity?.title || "-"}</div>
                        <div className="modal-date-badge">
                          <span>{weekDateRange}</span>
                        </div>
                      </div>

                      {/* 미개설/강화실패/마감 안내 */}
                      {!canEditAbility && (
                        <div
                          style={{
                            padding: "16px",
                            backgroundColor: isAbilityFailed || isAnyAbilityActivityExpired() ? "#fee2e2" : "#fff3cd",
                            border: isAbilityFailed || isAnyAbilityActivityExpired() ? "1px solid #ef4444" : "1px solid #ffc107",
                            borderRadius: "8px",
                            marginBottom: "16px",
                          }}
                        >
                          <p style={{ margin: 0, color: isAbilityFailed || isAnyAbilityActivityExpired() ? "#dc2626" : "#856404", fontSize: "14px" }}>
                            {isAbilityFailed ? "❌ 강화에 실패하여 2차 정보를 작성할 수 없습니다." : isAnyAbilityActivityExpired() ? "⏰ 2차 정보 작성 기간이 마감되었습니다 (수 오후 22시까지)" : "⚠️ 이 활동은 아직 개설되지 않았습니다. 운영진이 개설한 후 편집할 수 있습니다."}
                          </p>
                        </div>
                      )}

                      {/* Sub Title - 강화 성공/대기인 경우만 수정 가능 */}
                      <div className="modal-input-group">
                        <div className="section-label-row">
                          <div className="section-label">Sub Title</div>
                          <div className="char-counter">
                            <span>{editingDetails[getActiveAbilityActivityType()]?.subTitle?.length || 0}</span> / 150
                          </div>
                        </div>
                        <textarea
                          placeholder={canEditAbility ? "메인 타이틀 내용에 대한 본인의 의견을 서브 타이틀 내용으로 입력해주세요 :)" : ""}
                          rows={3}
                          maxLength={150}
                          value={editingDetails[getActiveAbilityActivityType()]?.subTitle || ""}
                          onChange={async (e) => {
                            if (e.target.value.length > 150) {
                              await popup.alert("최대 150자까지 입력할 수 있습니다.");
                              return;
                            }
                            const actType = getActiveAbilityActivityType();
                            setEditingDetails((prev) => ({
                              ...prev,
                              [actType]: { ...prev[actType], subTitle: e.target.value },
                            }));
                          }}
                          disabled={!canEditAbility}
                          style={!canEditAbility ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                        ></textarea>
                      </div>

                      {/* Output Link - 운영진 입력은 읽기 전용, 미개설/강화실패 시 전체 비활성화 */}
                      <div className="modal-input-group">
                        <div className="section-label">Output Link</div>
                        <div className="output-links-buttons">
                          {(editingDetails[getActiveAbilityActivityType()]?.outputLinks || []).map((link, linkIndex) => {
                            const actType = getActiveAbilityActivityType();
                            const adminCount = getAdminOutputLinksCount(actType);
                            const isAdminLink = linkIndex < adminCount;
                            const isDisabled = !canEditAbility || isAdminLink;
                            return (
                              <div key={linkIndex} className={`output-link-item ${link.url.trim() ? "active" : ""} ${isAdminLink ? "admin-link" : ""}`}>
                                <div className="link-button">
                                  <span className="link-num">{linkIndex + 1}</span>
                                </div>
                                <input
                                  type="text"
                                  className="link-desc"
                                  placeholder={isDisabled ? "" : "링크 설명을 입력하세요"}
                                  maxLength={20}
                                  value={link.desc}
                                  disabled={isDisabled}
                                  style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                  onChange={async (e) => {
                                    if (e.target.value.length > 20) {
                                      await popup.alert("최대 20자까지 입력할 수 있습니다.");
                                      return;
                                    }
                                    !isDisabled &&
                                      setEditingDetails((prev) => {
                                        const newLinks = [...prev[actType].outputLinks];
                                        newLinks[linkIndex] = { ...newLinks[linkIndex], desc: e.target.value };
                                        return { ...prev, [actType]: { ...prev[actType], outputLinks: newLinks } };
                                      });
                                  }}
                                />
                                <input
                                  type="url"
                                  className="link-url"
                                  placeholder={isDisabled ? "" : "URL"}
                                  value={link.url}
                                  disabled={isDisabled}
                                  style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                  onChange={(e) =>
                                    !isDisabled &&
                                    setEditingDetails((prev) => {
                                      const newLinks = [...prev[actType].outputLinks];
                                      newLinks[linkIndex] = { ...newLinks[linkIndex], url: e.target.value };
                                      return { ...prev, [actType]: { ...prev[actType], outputLinks: newLinks } };
                                    })
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                        {getAdminOutputLinksCount(getActiveAbilityActivityType()) > 0 && <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>* 'A' 표시된 링크는 운영진이 입력한 것으로 수정할 수 없습니다.</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="section-modal-footer">
              <button className="cancel-btn" onClick={() => setWorkAbilityModalOpen(false)}>
                취소
              </button>
              {(() => {
                // 저장 버튼도 강화 실패 시 비활성화
                const abilityAct = findFirstAbilityActivity();
                const isAbilityFailed = abilityAct ? getEnhancementStatus(abilityAct.activity_type_id) === "failed" : false;
                const canSave = isAnyAbilityActivityActive() && !isAbilityFailed && !isSaving;
                return (
                  <button
                    className="save-btn"
                    onClick={async () => {
                      const actType = getActiveAbilityActivityType();
                      await saveActivityDetail(actType);
                      updateWeekActivityDetailsAfterSave([actType]);
                      await popup.alert("저장되었습니다.");
                      setWorkAbilityModalOpen(false);
                    }}
                    disabled={!canSave}
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========== 실무 경험 모달 ========== */}
      {workExpModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-work-edit">
            <div className="section-modal-header">
              <h3>실무 경험 편집</h3>
            </div>
            <div className="section-modal-body">
              {workExpCards
                .filter((card) => !card.isEmpty)
                .map((card, index) => (
                  <div key={card.id} className="modal-card-item modal-card-workinfo">
                    {/* 상단 헤더: 과일 아이콘 + 태그 + 강화 상태 뱃지 */}
                    <div className="modal-card-header-row">
                      <div className="modal-card-left">
                        <div className="modal-fruit-icon fruit">{card.icon && <img src={card.icon} alt={card.badge} />}</div>
                        <div className="modal-card-info">
                          <span className="modal-card-tag tag--purple">{card.badge}</span>
                        </div>
                        <div className="modal-code-badge">
                          <span>{(card as { displayCode?: string | null }).displayCode ?? ""}</span>
                        </div>
                      </div>
                      <div className="modal-header-right">
                        {(() => {
                          const enhStatus = card.enhancementStatus;
                          const statusLabels: Record<string, string> = {
                            success: "강화성공",
                            waiting: "강화대기",
                            failed: "강화실패",
                            not_applicable: "해당없음",
                          };
                          const statusImages: Record<string, string> = {
                            success: "/images/0/cluster4/icon/5 강화 성공.png",
                            waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                            failed: "/images/0/cluster4/icon/7 강화 실패.png",
                            not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                          };
                          return (
                            <div className={`modal-status-badge ${enhStatus}`}>
                              <img src={statusImages[enhStatus]} alt={statusLabels[enhStatus]} />
                              <span className={`status-text ${enhStatus}`}>{statusLabels[enhStatus]}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="modal-card-content">
                      {/* 타이틀 + 내용 (읽기 전용) */}
                      <div className="modal-title-section">
                        <div className="main-title-row">
                          <div className="main-title">Main Title</div>
                          <div className="modal-rating">
                            {(() => {
                              const full = Math.floor(card.rating);
                              const half = card.rating % 1 >= 0.5;
                              return [0, 1, 2, 3, 4].map((i) => {
                                if (i < full) {
                                  return <img key={i} src="/images/0/cluster4/icon/icon - star.png" alt="star" className="modal-star" />;
                                }
                                if (i === full && half) {
                                  return (
                                    <span key={i} className="modal-star" style={{ position: "relative", display: "inline-block" }}>
                                      <img src="/images/0/cluster4/icon/icon - star.png" alt="star" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", clipPath: "inset(0 50% 0 0)", zIndex: 2 }} />
                                      <img src="/images/0/cluster4/icon/icon - empty star.png" alt="star" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 1 }} />
                                    </span>
                                  );
                                }
                                return <img key={i} src="/images/0/cluster4/icon/icon - empty star.png" alt="star" className="modal-star" />;
                              });
                            })()}
                            <span className="rating-count">{card.ratingCount}</span>
                          </div>
                        </div>
                        <div className="content-title">{card.title}</div>
                        <div className="modal-date-badge">
                          <span>{weekDateRange}</span>
                        </div>
                      </div>

                      {/* Sub Title - 수정 가능 */}
                      {(() => {
                        const activityType = card.activityTypeId;
                        const isActive = isActivityActive(activityType);
                        const isExpired = isActivityExpired(activityType);
                        const isFailed = getEnhancementStatus(activityType) === "failed";
                        return (
                          <>
                            {/* 미개설/강화실패/마감 안내 */}
                            {!isActive && (
                              <div
                                style={{
                                  padding: "16px",
                                  backgroundColor: isFailed || isExpired ? "#fee2e2" : "#fff3cd",
                                  border: isFailed || isExpired ? "1px solid #ef4444" : "1px solid #ffc107",
                                  borderRadius: "8px",
                                  marginBottom: "16px",
                                }}
                              >
                                <p style={{ margin: 0, color: isFailed || isExpired ? "#dc2626" : "#856404", fontSize: "14px" }}>
                                  {isFailed ? "❌ 강화에 실패하여 2차 정보를 작성할 수 없습니다." : isExpired ? "⏰ 2차 정보 작성 기간이 마감되었습니다 (수 오후 22시까지)" : "⚠️ 이 활동은 아직 개설되지 않았습니다. 운영진이 개설한 후 편집할 수 있습니다."}
                                </p>
                              </div>
                            )}

                            <div className="modal-input-group">
                              <div className="section-label-row">
                                <div className="section-label">Sub Title</div>
                                <div className="char-counter">
                                  <span>{editingDetails[activityType]?.subTitle?.length || 0}</span> / 150
                                </div>
                              </div>
                              <textarea
                                placeholder={isActive ? "메인 타이틀 내용에 대한 본인의 의견을 서브 타이틀 내용으로 입력해주세요 :)" : ""}
                                rows={3}
                                maxLength={150}
                                value={editingDetails[activityType]?.subTitle || ""}
                                onChange={async (e) => {
                                  if (e.target.value.length > 150) {
                                    await popup.alert("최대 150자까지 입력할 수 있습니다.");
                                    return;
                                  }
                                  setEditingDetails((prev) => ({
                                    ...prev,
                                    [activityType]: { ...prev[activityType], subTitle: e.target.value },
                                  }));
                                }}
                                disabled={!isActive}
                                style={!isActive ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                              ></textarea>
                            </div>

                            {/* Output Link - 운영진 입력은 읽기 전용, 미개설 시 전체 비활성화 */}
                            <div className="modal-input-group">
                              <div className="section-label">Output Link</div>
                              <div className="output-links-buttons">
                                {editingDetails[activityType]?.outputLinks.map((link, linkIndex) => {
                                  const adminCount = getAdminOutputLinksCount(activityType);
                                  const isAdminLink = linkIndex < adminCount;
                                  const isDisabled = !isActive || isAdminLink;
                                  return (
                                    <div key={linkIndex} className={`output-link-item ${link.url.trim() ? "active" : ""} ${isAdminLink ? "admin-link" : ""}`}>
                                      <div className="link-button">
                                        <span className="link-num">{linkIndex + 1}</span>
                                      </div>
                                      <input
                                        type="text"
                                        className="link-desc"
                                        placeholder={isDisabled ? "" : "링크 설명을 입력하세요"}
                                        maxLength={20}
                                        value={link.desc}
                                        disabled={isDisabled}
                                        style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                        onChange={async (e) => {
                                          if (e.target.value.length > 20) {
                                            await popup.alert("최대 20자까지 입력할 수 있습니다.");
                                            return;
                                          }
                                          !isDisabled &&
                                            setEditingDetails((prev) => {
                                              const newLinks = [...prev[activityType].outputLinks];
                                              newLinks[linkIndex] = { ...newLinks[linkIndex], desc: e.target.value };
                                              return { ...prev, [activityType]: { ...prev[activityType], outputLinks: newLinks } };
                                            });
                                        }}
                                      />
                                      <input
                                        type="url"
                                        className="link-url"
                                        placeholder={isDisabled ? "" : "URL"}
                                        value={link.url}
                                        disabled={isDisabled}
                                        style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                        onChange={(e) =>
                                          !isDisabled &&
                                          setEditingDetails((prev) => {
                                            const newLinks = [...prev[activityType].outputLinks];
                                            newLinks[linkIndex] = { ...newLinks[linkIndex], url: e.target.value };
                                            return { ...prev, [activityType]: { ...prev[activityType], outputLinks: newLinks } };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              {getAdminOutputLinksCount(activityType) > 0 && <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>* 'A' 표시된 링크는 운영진이 입력한 것으로 수정할 수 없습니다.</p>}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
            </div>
            <div className="section-modal-footer">
              <button className="cancel-btn" onClick={() => setWorkExpModalOpen(false)}>
                취소
              </button>
              <button
                className="save-btn"
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    for (const activityType of workExpActivityTypes) {
                      await saveActivityDetail(activityType);
                    }
                    updateWeekActivityDetailsAfterSave(workExpActivityTypes);
                    await popup.alert("저장되었습니다.");
                    setWorkExpModalOpen(false);
                  } catch (error) {
                    console.error("Error saving work exp details:", error);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 실무 경력 모달 ========== */}
      {workCareerModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-work-edit">
            <div className="section-modal-header">
              <h3>실무 경력 편집</h3>
            </div>
            <div className="section-modal-body">
              {displayWorkCareerCards
                .filter((card) => !card.isEmpty)
                .map((card, index) => {
                  const statusText = card.verified ? "강화성공" : card.isFailed ? "강화실패" : "강화대기";
                  const statusClass = card.verified ? "success" : card.isFailed ? "failed" : "pending";
                  return (
                    <div key={card.id} className="modal-card-item modal-card-workinfo">
                      {/* 상단 헤더: 회사 로고 + 태그 + 강화 상태 뱃지 */}
                      <div className="modal-card-header-row">
                        <div className="modal-card-left">
                          <div className="modal-fruit-icon fruit">{card.icon && <img src={card.icon} alt={card.badge} />}</div>
                          <div className="modal-card-info">
                            <span className={`modal-card-tag ${card.grade === "S" ? "tag--yellow" : card.grade === "A" ? "tag--green" : card.grade === "B" ? "tag--cyan" : "tag--purple"}`}>{card.badge.replace("|", " - ")}</span>
                          </div>
                          <div className="modal-code-badge">
                            <span>{(card as { displayCode?: string | null }).displayCode ?? ""}</span>
                          </div>
                        </div>
                        <div className="modal-header-right">
                          <div className="modal-status-badge">
                            {card.statusBadge && <img src={card.statusBadge} alt="상태" />}
                            <span className={`status-text ${statusClass}`}>{statusText}</span>
                          </div>
                        </div>
                      </div>

                      <div className="modal-card-content">
                        {/* 타이틀 + 내용 (읽기 전용) */}
                        <div className="modal-title-section">
                          <div className="main-title-row">
                            <div className="main-title">{card.title}</div>
                            {card.grade && (
                              <div className="modal-grade">
                                <span className={`grade ${card.grade === "S" ? "active" : ""}`}>S</span>
                                <span className={`grade ${card.grade === "A" ? "active" : ""}`}>A</span>
                                <span className={`grade ${card.grade === "B" ? "active" : ""}`}>B</span>
                                <span className={`grade ${card.grade === "C" ? "active" : ""}`}>C</span>
                                <span className={`grade ${card.grade === "D" ? "active" : ""}`}>D</span>
                              </div>
                            )}
                          </div>
                          {card.projectDescription && <div className="content-title">{card.projectDescription}</div>}
                          <div className="modal-date-badge">
                            <span>{weekDateRange}</span>
                          </div>
                        </div>

                        {/* 강화실패 / 마감 안내 */}
                        {(() => {
                          const isDeadlineActive = card.secondaryInfoDeadline && new Date(card.secondaryInfoDeadline) > new Date();
                          const isDeadlineExpired = card.secondaryInfoDeadline && new Date(card.secondaryInfoDeadline) <= new Date();
                          const activityType = workCareerActivityTypes[card.id - 1];
                          if (card.isFailed)
                            return (
                              <div style={{ padding: "16px", backgroundColor: "#fee2e2", border: "1px solid #ef4444", borderRadius: "8px", marginBottom: "16px" }}>
                                <p style={{ margin: 0, color: "#dc2626", fontSize: "14px" }}>❌ 강화에 실패하여 2차 정보를 작성할 수 없습니다.</p>
                              </div>
                            );
                          if (isDeadlineExpired)
                            return (
                              <div style={{ padding: "16px", backgroundColor: "#fee2e2", border: "1px solid #ef4444", borderRadius: "8px", marginBottom: "16px" }}>
                                <p style={{ margin: 0, color: "#dc2626", fontSize: "14px" }}>⏰ 2차 정보 작성 기간이 마감되었습니다</p>
                              </div>
                            );
                          if (!card.secondaryInfoDeadline)
                            return (
                              <div style={{ padding: "16px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", marginBottom: "16px" }}>
                                <p style={{ margin: 0, color: "#856404", fontSize: "14px" }}>⚠️ 2차 정보 작성 마감 기한이 설정되지 않았습니다.</p>
                              </div>
                            );
                          return null;
                        })()}

                        {/* Sub Title - 마감 기한 이내만 수정 가능 */}
                        {(() => {
                          const activityType = workCareerActivityTypes[card.id - 1];
                          const isEditable = !card.isFailed && card.secondaryInfoDeadline && new Date(card.secondaryInfoDeadline) > new Date();
                          return activityType ? (
                            <div className="modal-input-group">
                              <div className="section-label-row">
                                <div className="section-label">Sub Title</div>
                                <div className="char-counter">
                                  <span className={(editingDetails[activityType]?.subTitle || "").length > 0 ? "active" : ""}>{(editingDetails[activityType]?.subTitle || "").length}</span> / 150
                                </div>
                              </div>
                              <textarea
                                value={editingDetails[activityType]?.subTitle || ""}
                                onChange={async (e) => {
                                  if (e.target.value.length > 150) {
                                    await popup.alert("최대 150자까지 입력할 수 있습니다.");
                                    return;
                                  }
                                  setEditingDetails((prev) => ({
                                    ...prev,
                                    [activityType]: {
                                      ...prev[activityType],
                                      subTitle: e.target.value,
                                    },
                                  }));
                                }}
                                placeholder={isEditable ? "메인 타이틀 내용에 대한 본인의 의견을 서브 타이틀 내용으로 입력해주세요 :)" : ""}
                                rows={3}
                                maxLength={150}
                                disabled={!isEditable}
                                style={!isEditable ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                              ></textarea>
                            </div>
                          ) : null;
                        })()}

                        {/* Output Link - 마감 기한 이내만 수정 가능 */}
                        {(() => {
                          const activityType = workCareerActivityTypes[card.id - 1];
                          const isEditable = !card.isFailed && card.secondaryInfoDeadline && new Date(card.secondaryInfoDeadline) > new Date();
                          const adminCount = activityType ? getAdminOutputLinksCount(activityType) : 0;
                          return activityType ? (
                            <div className="modal-input-group">
                              <div className="section-label">Output Link</div>
                              <div className="output-links-buttons">
                                {[0, 1, 2, 3, 4].map((idx) => {
                                  const link = editingDetails[activityType]?.outputLinks?.[idx] || { desc: "", url: "" };
                                  const hasContent = link.url.trim() !== "";
                                  const isAdminLink = idx < adminCount;
                                  const isDisabled = !isEditable || isAdminLink;
                                  return (
                                    <div key={idx} className={`output-link-item ${hasContent ? "active" : ""} ${isAdminLink ? "admin-link" : ""}`}>
                                      <div className="link-button">
                                        <span className="link-num">{idx + 1}</span>
                                      </div>
                                      <input
                                        type="text"
                                        className="link-desc"
                                        placeholder={isDisabled ? "" : "링크 설명 (20자)"}
                                        maxLength={20}
                                        value={link.desc}
                                        disabled={isDisabled}
                                        style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                        onChange={async (e) => {
                                          if (e.target.value.length > 20) {
                                            await popup.alert("최대 20자까지 입력할 수 있습니다.");
                                            return;
                                          }
                                          !isDisabled &&
                                            setEditingDetails((prev) => {
                                              const currentLinks = [...(prev[activityType]?.outputLinks || createEmptyOutputLinks())];
                                              currentLinks[idx] = { ...currentLinks[idx], desc: e.target.value };
                                              return {
                                                ...prev,
                                                [activityType]: {
                                                  ...prev[activityType],
                                                  outputLinks: currentLinks,
                                                },
                                              };
                                            });
                                        }}
                                      />
                                      <input
                                        type="url"
                                        className="link-url"
                                        placeholder={isDisabled ? "" : "URL"}
                                        value={link.url}
                                        disabled={isDisabled}
                                        style={isDisabled ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" } : {}}
                                        onChange={(e) =>
                                          !isDisabled &&
                                          setEditingDetails((prev) => {
                                            const currentLinks = [...(prev[activityType]?.outputLinks || createEmptyOutputLinks())];
                                            currentLinks[idx] = { ...currentLinks[idx], url: e.target.value };
                                            return {
                                              ...prev,
                                              [activityType]: {
                                                ...prev[activityType],
                                                outputLinks: currentLinks,
                                              },
                                            };
                                          })
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="section-modal-footer">
              <button className="cancel-btn" onClick={() => setWorkCareerModalOpen(false)}>
                취소
              </button>
              <button
                className="save-btn"
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    for (const activityType of workCareerActivityTypes) {
                      await saveActivityDetail(activityType);
                    }
                    updateWeekActivityDetailsAfterSave(workCareerActivityTypes);
                    await popup.alert("저장되었습니다.");
                    setWorkCareerModalOpen(false);
                  } catch (error) {
                    console.error("Error saving work career details:", error);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 상단 섹션 본인 편집 모달 (연계 동료 편집) — 스펙: 1명 선택 + 코멘트 + Type B 푸터 ========== */}
      {headerModalOpen && headerModalType === "본인" && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-colleague-edit">
            {/* ── 헤더 (110px) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
                <h3>연계 동료</h3>
              </div>
              <p className="modal-subtitle">
                이번 주차 동안 클럽에서 함께 성장하며, 자신이 도움을 받았거나
                <br />
                기억에 남는 결과를 보여준 선배/후배/동료 크루를 선택해주세요. 😊
              </p>
              <button className="modal-close-btn" onClick={handleColleagueEditCancel}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {/* ── 미드 (412px) ── */}
            <div className="section-modal-body colleague-edit-body">
              {/* 영역 1: 연계 동료 선택 (자동완성) */}
              <div className="colleague-select-section">
                <h4>
                  ■ 연계 동료 <span className="required-mark">*</span>
                </h4>

                {/* B 영역: 선택 결과 (상단) */}
                {colleagueEditData.selectedColleague ? (
                  <div className={`selected-colleague ${colleagueSaveAttemptFailed && !colleagueEditData.selectedColleague ? `field-error ${colleagueFieldErrorFlash ? "flash" : ""}` : ""}`}>
                    <div className="crew-info">
                      <span className="crew-number">{colleagueEditData.selectedColleague.number ?? colleagueEditData.selectedColleague.id}</span>
                      <span className="crew-divider">|</span>
                      <span className="crew-name">{mask.crewName(colleagueEditData.selectedColleague.name)}</span>
                      <span className="crew-divider">|</span>
                      <span className="crew-team">{colleagueEditData.selectedColleague.team || "-"}</span>
                    </div>
                    <button className="btn-deselect" title="선택 해제" onClick={handleDeselectColleague} disabled={!isColleagueEditing}>
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                ) : (
                  <div className={`selected-colleague-empty ${colleagueSaveAttemptFailed ? `field-error ${colleagueFieldErrorFlash ? "flash" : ""}` : ""}`}>아직 선택된 크루가 없습니다.</div>
                )}

                {/* A 영역: 검색 + 후보 (선택 전에만) */}
                {!colleagueEditData.selectedColleague && (
                  <>
                    <div className="search-input-wrapper">
                      <input
                        type="text"
                        className="search-input"
                        value={colleagueSearchQuery}
                        onChange={(e) => setColleagueSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && colleagueSearchResults.length > 0) {
                            e.preventDefault();
                            handleSelectColleagueCandidate(colleagueSearchResults[0]);
                          }
                        }}
                        placeholder="크루 이름을 입력하세요 (예: 김, 김ㅎ)"
                        autoFocus
                        disabled={!isColleagueEditing}
                      />
                      <i className="ti ti-search search-icon"></i>
                    </div>

                    {colleagueSearchResults.length > 0 && (
                      <div className="search-results">
                        {colleagueSearchResults.map((crew) => (
                          <div key={crew.id} className="search-result-item">
                            <div className="crew-info">
                              <span className="crew-number">{crew.number ?? crew.id}</span>
                              <span className="crew-divider">|</span>
                              <span className="crew-name">{mask.crewName(crew.name)}</span>
                              <span className="crew-divider">|</span>
                              <span className="crew-team">{crew.team || "-"}</span>
                            </div>
                            <button className="btn-select" title="이 크루 선택" onClick={() => handleSelectColleagueCandidate(crew)} disabled={!isColleagueEditing}>
                              <i className="ti ti-check"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {colleagueSearchQuery.trim() && colleagueSearchResults.length === 0 && <div className="search-no-results">일치하는 크루가 없습니다.</div>}
                  </>
                )}
              </div>

              {/* 영역 2: 코멘트 작성 */}
              <div className="colleague-content-section">
                <h4>
                  ■ 연계 내용 <span className="required-mark">*</span>
                </h4>
                <div className="content-wrapper">
                  <textarea
                    className={`content-textarea ${colleagueSaveAttemptFailed && !colleagueEditData.content.trim() ? `field-error ${colleagueFieldErrorFlash ? "flash" : ""}` : ""}`}
                    value={colleagueEditData.content}
                    onChange={(e) => {
                      setColleagueEditData((prev) => ({ ...prev, content: e.target.value.slice(0, 100) }));
                      if (colleagueSaveAttemptFailed) setColleagueSaveAttemptFailed(false);
                    }}
                    placeholder="연계 동료에게 전하고 싶은 말을 100자 이내로 작성해주세요."
                    maxLength={100}
                    disabled={!isColleagueEditing}
                  />
                  <div className="char-count">{colleagueEditData.content.length}/100</div>
                </div>
              </div>
            </div>

            {/* ── 푸터 (118px) Type B ── */}
            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={() => setHelpModalKind("colleague")} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!isColleagueEditing ? (
                    <button
                      type="button"
                      className="modal-edit-btn"
                      // 작성 창 닫힘이면 수정 진입 비활성 (onClick 게이트가 backstop).
                      disabled={colleagueWindowOpen === false}
                      onClick={async () => {
                        // 모달 오픈/저장과 동일 판정 게이트(서버 POST hasOpenEditWindow 와 일치).
                        if (!(await requireWeeklyColleaguesWriteAccess())) return;
                        handleEditClick(() => setIsColleagueEditing(true));
                      }}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button type="button" className="modal-cancel-btn" onClick={handleColleagueEditCancel}>
                        취소
                      </button>
                      <button type="button" className="modal-reset-btn" onClick={handleColleagueEditReset}>
                        초기화
                      </button>
                      {/* 저장 전에도 작성 창 닫힘이면 비활성 — 서버 403 방어(state 미반영)는 handleColleagueEditSave 가 유지. */}
                      <button type="button" className="modal-save-btn" onClick={handleColleagueEditSave} disabled={colleagueSaving || colleagueWindowOpen === false}>
                        {colleagueSaving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom">
                {colleagueWindowOpen === false ? (
                  <span className="modal-notice notice-error" style={{ visibility: "visible" }}>
                    관리자 허가를 받은 기간에만 작성할 수 있습니다. 
                  </span>
                ) : (
                  <span className={`modal-notice ${colleagueSaveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: colleagueSaveAttemptFailed ? "visible" : "hidden" }}>
                    필수 사항이 누락되었어요! 확인 부탁드려요! 😊
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 상단 섹션 타크루 모달 (타크루가 나에 대해 평판을 남김) ========== */}
      {headerModalOpen && headerModalType === "타크루" && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-reputation-form">
            <div className="section-modal-header">
              <button
                className="modal-close-btn"
                onClick={async () => {
                  if (isReputationFormEditing && isFormDirty() && !(await popup.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?"))) return;
                  setHeaderModalOpen(false);
                  setIsReputationFormEditing(false);
                  setReputationSaveError(null);
                  setReputationSaveSuccess(false);
                }}
              >
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
                <h3>위클리 평판 (Weekly Reputation)</h3>
              </div>
              <p className="modal-subtitle">
                혼자 하는 성장이 그 찰나에는 빠를 수 있지만, 멀리, 굳건히, 확실히 가려면 '함께' 가야 합니다! 😊
                <br />
                나와 함께한 동료/선배/후배 크루의 한 주를 평가/응원/조언하고, 상호간의 타산지석으로 삼아보자구요!
              </p>
            </div>
            {/* ── 미드 (342px) — 2열 레이아웃 (평점 + 키워드) + 내용 textarea ── */}
            <div className="section-modal-body reputation-form-body">
              <div className="reputation-form-top">
                {/* 1열: 평점 */}
                <div className="form-rating-section">
                  <h4>
                    ■ 평점을 입력해주세요. <span className="required-mark">*</span>
                  </h4>
                  <div className={`rating-input rating-field ${saveAttemptFailed && (!reputationEditData.rating || reputationEditData.rating === 0) ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`} data-field="rating">
                    <span className="star-rating">
                      {(() => {
                        const r = reputationEditData.rating || 0;
                        const fullStars = Math.floor(r / 2);
                        const hasHalf = r % 2 === 1;
                        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
                        return (
                          <>
                            {Array(fullStars)
                              .fill(0)
                              .map((_, i) => (
                                <i key={`f${i}`} className="ti ti-star-filled" />
                              ))}
                            {hasHalf && <i className="ti ti-star-half-filled" />}
                            {Array(emptyStars)
                              .fill(0)
                              .map((_, i) => (
                                <i key={`e${i}`} className="ti ti-star" />
                              ))}
                          </>
                        );
                      })()}
                      <span className="rating-text">{reputationEditData.rating || 0}/10</span>
                    </span>

                    <div className="custom-dropdown small">
                      <div ref={ratingDropdownTriggerRef} className={`dropdown-selected ${!isReputationFormEditing ? "disabled" : ""}`} onClick={openRatingDropdown} role="button" tabIndex={isReputationFormEditing ? 0 : -1} aria-haspopup="listbox" aria-expanded={ratingDropdownOpen}>
                        <span>{reputationEditData.rating || "-"}</span>
                        <i className="ti ti-chevron-down"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2열: 키워드 */}
                <div className="form-keyword-section">
                  <h4>
                    ■ 키워드를 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 10자)</span>
                  </h4>
                  <div className="keyword-mode-select">
                    <label>
                      <input
                        type="radio"
                        name="keywordMode"
                        value="select"
                        checked={formKeywordMode === "select"}
                        disabled={!isReputationFormEditing}
                        onChange={() => handleKeywordModeChange("select")}
                        onClick={async () => {
                          // 이미 select 상태에서도 재클릭 시 중첩 모달 재오픈 가능 (사용자 요청)
                          if (isReputationFormEditing && formKeywordMode === "select") {
                            handleKeywordModeChange("select");
                          }
                        }}
                      />
                      선택
                    </label>
                    <label>
                      <input type="radio" name="keywordMode" value="write" checked={formKeywordMode === "write"} disabled={!isReputationFormEditing} onChange={() => handleKeywordModeChange("write")} />
                      작성
                    </label>
                  </div>
                  <div className="keyword-input-wrapper" data-field="keyword">
                    <span className="keyword-hash">#</span>
                    <input
                      type="text"
                      className={`keyword-input ${saveAttemptFailed && (!reputationEditData.keyword || reputationEditData.keyword.trim().length < 7) ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`}
                      value={reputationEditData.keyword}
                      onChange={(e) => {
                        if (isReputationFormEditing && formKeywordMode === "write") {
                          setReputationEditData((prev) => ({ ...prev, keyword: e.target.value.slice(0, 10) }));
                          if (saveAttemptFailed) setSaveAttemptFailed(false); // 사용자 요청: 입력 시 에러 자동 해제
                        }
                      }}
                      onClick={() => {
                        // select 모드 + 편집 중일 때 input 클릭으로도 키워드 picker 열기
                        if (isReputationFormEditing && formKeywordMode === "select") {
                          handleKeywordModeChange("select");
                        }
                      }}
                      placeholder={formKeywordMode === "write" ? "해당 크루의 한 주 활동의 특징을 키워드로 입력해주세요." : "선택 버튼을 눌러 키워드를 선택하세요"}
                      maxLength={10}
                      readOnly={!isReputationFormEditing || formKeywordMode === "select"}
                      style={isReputationFormEditing && formKeywordMode === "select" ? { cursor: "pointer" } : undefined}
                      onKeyDown={(e) => {
                        if (!isReputationFormEditing || formKeywordMode === "select") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 하단: 내용 */}
              <div className="form-content-section" data-field="content">
                <h4>
                  ■ 내용을 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 100자)</span>
                </h4>
                <textarea
                  className={`form-content-textarea ${saveAttemptFailed && !reputationEditData.content.trim() ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`}
                  value={reputationEditData.content}
                  readOnly={!isReputationFormEditing}
                  onChange={(e) => {
                    if (!isReputationFormEditing) return;
                    setReputationEditData((prev) => ({ ...prev, content: e.target.value.slice(0, 100) }));
                    if (saveAttemptFailed) setSaveAttemptFailed(false); // 사용자 요청: 입력 시 에러 자동 해제
                  }}
                  placeholder="해당 크루의 한 주 활동을 따뜻하고, 냉철한 시각으로 평가/응원/조언해주세요."
                  maxLength={100}
                />
                <div className="char-count">{reputationEditData.content.length}/100</div>
              </div>
            </div>
            {/* ── 푸터 (118px) Type B: 행1[🔎 + 버튼] / 행2[안내문 우측 visibility 토글] ── */}
            <div className="section-modal-footer">
              {/* 행 1 */}
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={handleReputationHelp} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!isReputationFormEditing ? (
                    <button className="modal-edit-btn" onClick={handleEditMode}>
                      수정
                    </button>
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleFormCancel}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleFormReset}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleFormSave} disabled={reputationSaving}>
                        {reputationSaving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 행 2 — cluster3 패턴: 편집 모드에서 항상 표시, 에러 시 빨간색 + 텍스트 변경 */}
              <div className="modal-footer-bottom">
                <span className={`modal-notice modal-footer-notice ${saveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: isReputationFormEditing ? "visible" : "hidden" }}>
                  {saveAttemptFailed ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
                </span>
              </div>
            </div>

            {keywordModalOpen && (
              <div className="section-modal-overlay keyword-select-overlay">
                <div className="section-modal keyword-select-modal">
                  <div className="section-modal-header">
                    <button
                      type="button"
                      className="modal-close-btn"
                      onClick={async () => {
                        setKeywordModalOpen(false);
                        setSelectedKeywordTemp("");
                      }}
                      aria-label="키워드 선택 모달 닫기"
                    >
                      <i className="ti ti-x"></i>
                    </button>

                    <button type="button" className="btn-select-header" onClick={handleKeywordSelectConfirm} disabled={!selectedKeywordTemp}>
                      선택
                    </button>

                    <div className="modal-header-top">
                      <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
                      <h3>키워드를 선택해주세요. 😊</h3>
                    </div>
                  </div>

                  <div className="section-modal-body keyword-select-body">
                    {KEYWORD_GROUPS.map((group, gIdx) => (
                      <div key={group.id} className={`keyword-group group-${group.color}`}>
                        <h4 className="group-title">
                          [군락 {gIdx + 1}] {group.title}
                          <span className="group-count">({group.count}개)</span>
                        </h4>
                        <div className="keyword-grid">
                          {group.keywords.map((keyword) => (
                            <button key={`${group.id}-${keyword}`} type="button" className={`keyword-chip ${selectedKeywordTemp === keyword ? "selected" : ""}`} onClick={() => handleKeywordSelect(keyword)}>
                              {keyword}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 주차 평판 카드 상세보기 모달 — 가로형_중 979×570, 보기 전용 ========== */}
      {reputationViewModalOpen && selectedReputationCard && (
        <div className="section-modal-overlay">
          <div className="section-modal reputation-view-modal">
            {/* ── 헤더 (110px) — workInfo/workExp 패턴 준용 ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>위클리 평판 (Weekly Reputation)</h3>
              </div>
              <p className="modal-subtitle">저는 당신의 한 주를 아래와 같이 바라보았습니다. 당신의 땀방울에 제가 함께 있어요. 😊</p>
              <button className="modal-close-btn" onClick={() => setReputationViewModalOpen(false)}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {/* ── 미드 (460px) — 1열 세로 배치 ── */}
            <div className="section-modal-body reputation-body">
              {/* 상단: 인적사항 카드 (4개 모달과 동일 구조) */}
              <div className="workinfo-personal-card">
                <div className="personal-grid">
                  <div className="personal-photo">{selectedReputationCard.profileImg ? <img src={selectedReputationCard.profileImg} alt={mask.crewName(selectedReputationCard.name)} /> : <img src="/images/0/crew profile/남 1.webp" alt="profile" />}</div>

                  <div className="personal-info">
                    <div className="personal-row-1">
                      <span className="personal-name">{mask.crewName(selectedReputationCard.name)}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-gender">{mask.gender(selectedReputationCard.gender)}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-age">{mask.age(selectedReputationCard.age) || "—"} 세</span>
                    </div>

                    <div className="personal-row-2">
                      <span className="personal-field">
                        <span className="field-value">{formatSchool(mask.school(selectedReputationCard.university)) || "—"}</span>
                        <span className="field-label">학교</span>
                      </span>
                      <span className="personal-separator">|</span>
                      <span className="personal-field">
                        <span className="field-value">{formatMajor(mask.major(selectedReputationCard.major)) || "—"}</span>
                        <span className="field-label">학과</span>
                      </span>
                    </div>

                    <div className="personal-row-3">
                      <span className="personal-field">
                        <span className="field-value">{selectedReputationCard.team || "—"}</span>
                        <span className="field-label">팀</span>
                      </span>
                      <span className="personal-separator">|</span>
                      <span className="personal-field">
                        <span className="field-value">{selectedReputationCard.part || "—"}</span>
                        <span className="field-label">파트</span>
                      </span>
                    </div>
                  </div>

                  <div className="personal-tags">
                    <span className="tag-badge tag-role">{formatCrewClassDisplayLabel(selectedReputationCard.role, CREW_CLASS_REGULAR)}</span>
                    <span className="tag-badge tag-keyword">{selectedReputationCard.nickname || selectedReputationCard.keyword || "키워드"}</span>
                  </div>
                </div>
              </div>

              {/* 중단: 키워드(tag.tag--색상) + 내용 */}
              <div className="reputation-content-section">
                <span className={`tag ${selectedReputationCard.tagColor || "tag--pink"}`}>{selectedReputationCard.tagText || "#—"}</span>
                <div className="reputation-content-box">
                  <p className="reputation-content-text">{selectedReputationCard.description || "-"}</p>
                </div>
              </div>

              {/* 하단: 평점 + FM */}
              <div className="reputation-stats-row">
                <div className="reputation-rating">
                  <span className="stats-label">■ 평점</span>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const halfValue = selectedReputationCard.rating || 0; // 이미 5점 만점 (memo에서 /2 변환됨)
                      let starClass = "star-empty";
                      if (halfValue >= star) starClass = "star-full";
                      else if (halfValue >= star - 0.5) starClass = "star-half";
                      return (
                        <span key={star} className={`rating-star ${starClass}`}>
                          ★
                        </span>
                      );
                    })}
                  </div>
                  <span className="rating-value">{selectedReputationCard.ratingCount || "- / 10"}</span>
                </div>
                <div className="reputation-fm">
                  <span className="stats-label">■ FM</span>
                  {/* 명성도(FM): reputationSummary.fm 단일 출처 (누적 포인트 아님) */}
                  <span className="fm-value">{reputationFm}</span>
                </div>
              </div>

              {/* 최하단: 구분선 + 타임스탬프 (우측 정렬) — 백엔드 created_at 없으면 빈 문자열 */}
              <div className="reputation-bottom-section">
                <div className="reputation-bottom-divider"></div>
                <div className="reputation-timestamp">
                  <span>{formatReputationTime(selectedReputationCard.createdAt)}</span>
                </div>
              </div>

              {/* 어드민 전용: 수정/삭제 버튼 */}
              {session?.user?.isAdmin && !selectedReputationCard.isEmpty && (
                <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      setReputationEditData({
                        rating: selectedReputationCard.rawRating || 0,
                        content: selectedReputationCard.description || "",
                        keyword: selectedReputationCard.rawKeyword || "",
                      });
                      setEditingWeeklyReputationId(selectedReputationCard.id);
                      setReputationViewModalOpen(false);
                      setHeaderModalType("타크루");
                      setHeaderModalOpen(true);
                      fetchKeywordsIfNeeded();
                    }}
                    style={{ padding: "8px 16px", background: `${orgAccentColor}33`, border: `1px solid ${orgAccentColor}`, borderRadius: "6px", color: orgAccentColor, fontSize: "13px", cursor: "pointer" }}
                  >
                    수정
                  </button>
                  <button
                    onClick={async () => {
                      if (!(await popup.confirm("이 평판을 삭제하시겠습니까?"))) return;
                      try {
                        const res = await fetch(apiUrl(`/api/weekly-reputations?id=${selectedReputationCard.id}`), { method: "DELETE" });
                        const json = await res.json();
                        if (json.success) {
                          await popup.alert("삭제되었습니다.");
                          setReputationViewModalOpen(false);
                          fetchWeeklyReputations();
                        } else {
                          await popup.alert(json.error || "삭제 실패");
                        }
                      } catch {
                        await popup.alert("삭제 중 오류 발생");
                      }
                    }}
                    style={{ padding: "8px 16px", background: "rgba(255, 60, 60, 0.2)", border: "1px solid #ff3c3c", borderRadius: "6px", color: "#ff3c3c", fontSize: "13px", cursor: "pointer" }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 연계 동료 카드 상세보기 모달 — 세로형_중 540×640, 보기 전용 ========== */}
      {colleagueViewModalOpen && selectedColleagueCard && (
        <div className="section-modal-overlay">
          <div className="section-modal colleague-view-modal">
            {/* ── 헤더 (110px) — reputation-view-modal 패턴 준용 ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>연계 동료</h3>
              </div>
              <p className="modal-subtitle">저와 함께한 동료입니다. 😊</p>
              <div className="modal-footer-right modal-header-right">
                <button
                  className="modal-edit-btn modal-delete-btn"
                  onClick={async () => {
                    if (!(await popup.confirm("이 동료를 삭제하시겠습니까?"))) return;
                    handleDeleteColleague();
                  }}
                >
                  삭제
                </button>
              </div>
              <button className="modal-close-btn" onClick={() => setColleagueViewModalOpen(false)}>
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="section-modal-body colleague-body">
              {/* 최상단 감사 텍스트 */}
              <div className="colleague-thanks-text">함께 해주셔서 마음 깊이 감사드려요. 😊</div>

              {/* 인적사항 카드 — reputation-view-modal .workinfo-personal-card 구조 재사용 */}
              <div className="workinfo-personal-card">
                <div className="personal-grid">
                  <div className="personal-photo">{selectedColleagueCard.profileImg ? <img src={selectedColleagueCard.profileImg} alt={mask.crewName(selectedColleagueCard.name)} /> : <img src="/images/0/crew profile/남 1.webp" alt="profile" />}</div>

                  <div className="personal-info">
                    <div className="personal-row-1">
                      <span className="personal-name">{mask.crewName(selectedColleagueCard.name)}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-gender">{mask.gender(selectedColleagueCard.gender)}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-age">{mask.age(selectedColleagueCard.age) || "—"} 세</span>
                    </div>

                    <div className="personal-row-2">
                      <span className="personal-field">
                        <span className="field-value">{formatSchool(mask.school(selectedColleagueCard.university)) || "—"}</span>
                        <span className="field-label">학교</span>
                      </span>
                      <span className="personal-separator">|</span>
                      <span className="personal-field">
                        <span className="field-value">{formatMajor(mask.major(selectedColleagueCard.major)) || "—"}</span>
                        <span className="field-label">학과</span>
                      </span>
                    </div>

                    <div className="personal-row-3">
                      <span className="personal-field">
                        <span className="field-value">{selectedColleagueCard.team || "—"}</span>
                        <span className="field-label">팀</span>
                      </span>
                      <span className="personal-separator">|</span>
                      <span className="personal-field">
                        <span className="field-value">{selectedColleagueCard.part || "—"}</span>
                        <span className="field-label">파트</span>
                      </span>
                    </div>
                  </div>
                  <div className="personal-tags">
                    <span className="tag-badge tag-role">{formatCrewClassDisplayLabel(selectedColleagueCard.role, CREW_CLASS_REGULAR)}</span>
                    <span className="tag-badge tag-keyword">{selectedColleagueCard.nickname || selectedColleagueCard.keyword || "—"}</span>
                  </div>
                </div>
              </div>

              {/* From / To */}
              {/* TODO: [백엔드 작업 필요] From/To 사용자 이름 필드 확정 후 연동
                  fromName: 카드 보내는 사용자 (평판 작성자)
                  toName: 카드 받는 사용자 (대상자) */}
              <div className="colleague-fromto">
                <span className="fromto-block fromto-from">
                  <span className="fromto-label">From -</span>
                  <span className="fromto-name">{mask.crewName(selectedColleagueCard.fromName || myDisplayName || session?.user?.name)}</span>
                  <span className="fromto-suffix">님</span>
                </span>
                <span className="fromto-arrow">→</span>
                <span className="fromto-block fromto-to">
                  <span className="fromto-label">To -</span>
                  <span className="fromto-name">{mask.crewName(selectedColleagueCard.toName || selectedColleagueCard.name)}</span>
                  <span className="fromto-suffix">님</span>
                </span>
              </div>

              {/* Honor & Thank you */}
              <div className="colleague-honor-section">
                <h4 className="honor-label">Honor &amp; Thank you</h4>
                <div className="honor-content-box">
                  <p className="honor-content-text">{selectedColleagueCard.message || selectedColleagueCard.content || "-"}</p>
                </div>
              </div>

              {/* 하단 구분선 + 타임스탬프 (reputation-view-modal 패턴 준용) */}
              <div className="reputation-bottom-section">
                <div className="reputation-bottom-divider"></div>
                <div className="reputation-timestamp">
                  <span>{formatReputationTime(selectedColleagueCard.created_at || selectedColleagueCard.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 실무 정보 카드 상세보기 모달 (1차: 가로형_대 1468×855 / 헤더·푸터·state) ========== */}
      {workInfoViewModalOpen && selectedWorkInfoCard && (
        <div className="section-modal-overlay work-modal-size-overlay">
          <div className="section-modal work-view-modal workinfo-view-modal work-modal-size">
            {/* ── 헤더 (100px) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                {/* 상단 라인명(노란 문구): lineName(master.line_name) 우선, null 이면 activityTypeName → legacy category. */}
                <h3>
                  실무 정보 <span className="line-name-text">{(workInfoMatchedLine?.lineName as string | null | undefined) ?? (workInfoMatchedLine?.activityTypeName as string | null | undefined) ?? selectedWorkInfoCard.category ?? "카테고리"}</span>
                </h3>
              </div>
              <p className="modal-subtitle">이번 주에 어떤 실무 정보들을 통해, 어떤 과정과 성장을 이루어냈는지를 마음껏 어필해주세요. 😊</p>
              <button className="modal-close-btn" onClick={handleCloseWorkInfo}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {/* ── 미드 (637px) — 2차: 좌측 콘텐츠(인적사항/시즌/Output/텍스트3종) + 우측 이미지 placeholder(3차) ── */}
            <div className="section-modal-body">
              <div className="workinfo-content-layout">
                {/* ──── 좌측 ──── */}
                <div className="workinfo-left">
                  {/* 좌상단: 인적사항 카드 — 5열 그리드 (1열 사진 rowspan 3 + 2열 3행) */}
                  {/* TODO: [백엔드 작업 필요] profile API 응답에 인적사항(profilePhoto/name/gender/age/role/school/major/keyword) 필드 보장 후 아래 더미값 교체 */}
                  <div className="workinfo-personal-card">
                    <div className="personal-grid">
                      {/* 1열: 프로필 사진 (3행 차지) */}
                      <div className="personal-photo">
                        {/* TODO: [백엔드 작업 필요] profile API의 photo URL 사용 — 현재는 데모 더미 또는 기본 아이콘 */}
                        <img
                          src={ownerPersonalInfo.profileImageUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>

                      {/* 2열: 인적사항 텍스트 컬럼 (3행 stack) */}
                      <div className="personal-info">
                        {/* 1행 — 이름·성별·나이 + 역할/키워드 태그 (태그는 우측 정렬) */}
                        <div className="personal-row-1">
                          <span className="personal-name">{ownerInfoReady ? mask.crewName(ownerPersonalInfo.name) : <Skeleton width={60} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{ownerInfoReady ? mask.gender(ownerPersonalInfo.gender) : <Skeleton width={16} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{ownerInfoReady ? <>{ownerPersonalInfo.age != null ? mask.age(ownerPersonalInfo.age) : "—"} 세</> : <Skeleton width={30} height={15} />}</span>
                          <div className="personal-tags">
                            {/* TODO: [백엔드 작업 필요] role 필드 (운영진/앰배서더/일반 등) — profile API에 추가 필요 */}
                            <span className="tag-badge tag-role">{compactPersonalTag(ownerRoleBadge, CREW_CLASS_REGULAR)}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(ownerPersonalInfo.tagline ?? "-", "-")}</span>
                          </div>
                        </div>

                        {/* 2행 — 학교·학과 (필드명/값 분리, 고정폭, 말줄임 없음) */}
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? mask.school(ownerPersonalInfo.school) : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? (ownerPersonalInfo.department ? formatMajor(mask.major(ownerPersonalInfo.department)) : "—") : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        {/* 3행 — 팀·파트 (필드명/값 분리, 고정폭, 말줄임 없음) */}
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.team ?? "—"}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.part ?? "—"}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>

                      <div className="personal-line-status line-info-row">
                        {selectedWorkInfoCard.isEmpty || (selectedWorkInfoCard.status as string) === "empty" ? (
                          <div className="line-enhance-void" aria-label="빈 카드">
                            <span className="void-mark" />
                            <span className="void-mark" />
                            <span className="void-mark" />
                          </div>
                        ) : (() => {
                          // 강화 상태 status-badge: 백엔드 DTO matchedLine.enhancementStatus 단일 출처 (프론트 재계산 금지).
                          // line.status(라인칸 기입 상태)와 무관 — enhancementStatus 기준으로만 이미지/라벨 결정.
                          // 카드 미리보기와 동일 매칭: strict(lineTargetId) 미매칭 시 relaxed badge 라인으로 fallback.
                          // matchedLine 값 없으면 기존 legacy(status) fallback.
                          const enh = enhancementStatusBadge(workInfoMatchedLine ?? workInfoBadgeLine);
                          const src = enh?.src ?? (selectedWorkInfoCard.statusIcon as string | null | undefined);
                          const alt = enh?.alt ?? (selectedWorkInfoCard.status || "강화 상태");
                          const toneClass = enh?.toneClass ?? ((selectedWorkInfoCard.status as string) || "not_applicable");
                          const text = enh?.text ?? ({ success: "강화 성공", waiting: "강화 대기", failed: "강화 실패", not_applicable: "해당 없음" }[selectedWorkInfoCard.status as string] || "—");
                          return (
                            <>
                              {src ? <img className="line-enhance-icon" src={src} alt={alt} /> : <span className="line-status-icon">●</span>}
                              <span className={`line-enhance-status enhance-${toneClass}`}>{text}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 좌중단: 2열 (시즌/주차/카테고리/상태 + Output Link 5개) */}
                  <div className="workinfo-mid-section">
                    {/* 1열: 시즌/주차/날짜 + 카테고리/강화상태 */}
                    <div className="workinfo-mid-col1">
                      <div className="workinfo-date-badge">
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekNumberLabel(weekData.seasonType ?? weekData.seasonName, weekData.weekNumber)}` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        {/* TODO: [백엔드 작업 필요] line↔activity 매핑 확정 후 lineName/lineCode로 교체. 현재는 category로 대체. */}
                        {/* 1행: 활동 카테고리 — 기존 매핑 activityTypeConfig[activityType].icon (selectedWorkInfoCard.icon) 사용 */}
                        <div className="line-info-row">
                          {selectedWorkInfoCard.icon ? <img className="line-activity-icon" src={selectedWorkInfoCard.icon} alt={selectedWorkInfoCard.category || "활동"} /> : <span className="line-status-icon">●</span>}
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {/* 라인명: matchedLine.lineName(master.line_name) 우선 → activityTypeName → legacy (하드코딩 "인포데스크" 금지) */}
                            {(workInfoMatchedLine?.lineName as string | null | undefined) ?? workInfoMatchedLine?.activityTypeName ?? (selectedWorkInfoCard.category || "인포데스크")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2열: Output Link 5개 — cluster3 output modal 패턴 (dot + input/text + open-btn) + adminCount 보호 + 순차 입력 */}
                    <div className="workinfo-mid-col2">
                      <div className="workinfo-output-links" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          // cluster3 dot 색상(3개) → 5개 확장
                          const dotColor = ["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"][i];
                          const adminCount = selectedWorkInfoCard?.activityType ? getAdminOutputLinksCount(selectedWorkInfoCard.activityType, workInfoMatchedLine) : 0;
                          const isAdminLink = i < adminCount;
                          // 데모 데이터 (프론트 전용)
                          const demoOutputLinks = [
                            { desc: "성장 시즌 운영 매뉴얼", url: "https://example.com/manual" },
                            { desc: "실무 역량 강화 자료", url: "https://example.com/ability" },
                            { desc: "프로젝트 결과 보고서", url: "https://example.com/project-report" },
                            { desc: "커리어 트랙 로드맵", url: "https://example.com/career-roadmap" },
                            { desc: "주차별 성장 기록 아카이브", url: "https://example.com/growth-history" },
                          ];
                          // 표시 우선순위: 1) editing state (수정 모드) 2) admin preview 저장 값
                          //   3) matchedLine.outputLinks (backend 단일 출처) 4) demo data (matchedLine 없을 때만)
                          const adminOverride = isPureAdminPreview ? adminSavedOutputLinks["workInfo"]?.[i] : null;
                          const backendLink = lineOutputLinkAt(workInfoMatchedLine, i);
                          const link = workInfoViewIsEditing
                            ? editingOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim()
                                ? adminOverride
                                : workInfoMatchedLine
                                ? backendLink || { desc: "", url: "" }
                                : demoOutputLinks[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workInfoViewIsEditing ? editingOutputLinks[i - 1] : (isPureAdminPreview ? adminSavedOutputLinks["workInfo"]?.[i - 1] : null);
                          const sequentialDisabled = workInfoViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          if (isAdminPreview && i === 0) console.log("[RenderWorkInfo]", { isEditing: workInfoViewIsEditing, link, adminOverride });
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workInfoViewIsEditing && (!isAdminLink || isPureAdminPreview) ? (
                                <span
                                  className={`output-link-text output-link-editable${hasUrl ? "" : " output-link-empty"}${sequentialDisabled ? " output-link-disabled" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (!sequentialDisabled) openOutputLinkEditModal("workInfo", i);
                                  }}
                                  title={hasUrl ? link.desc?.trim() || link.url : undefined}
                                >
                                  {sequentialDisabled ? "먼저 상위 Output Link를 입력해주세요" : hasUrl ? displayText || "" : `Output Link ${i + 1}`}
                                </span>
                              ) : hasUrl ? (
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => { if ((workInfoViewIsEditing || workExpViewIsEditing || workAbilityViewIsEditing || workCareerViewIsEditing) && isAdminLink && !isPureAdminPreview) { void popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다."); return; } window.open(ensureProtocol(link.url), "_blank"); }}>
                                  {displayText}
                                </span>
                              ) : (
                                <span className="output-link-text output-link-empty">-</span>
                              )}
                              <button type="button" className="link-open-btn" onClick={() => hasUrl && window.open(ensureProtocol(link.url), "_blank")} disabled={!hasUrl} aria-label="링크 열기">
                                <i className="ti ti-external-link"></i>
                              </button>
                              {workInfoViewIsEditing && !isAdminLink && hasUrl && (
                                <button type="button" className="output-link-delete" onClick={() => handleOutputLinkDelete(i)} aria-label="링크 삭제">
                                  <i className="ti ti-x"></i>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="workinfo-mid-divider" aria-hidden="true" />
                  </div>

                  {/* 좌하단: Main Title (운영진 read-only) + Sub Title 200자 + Growth Point 100자 */}
                  <div className="workinfo-text-section">
                    {/* Main Title — 항상 보기 전용 (관리자가 어드민에서 입력) */}
                    <div className="workinfo-text-block text-block-main">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Main Title
                      </h4>
                      <div className="text-block-content main-title-readonly">{(() => { const t = workInfoMatchedLine?.mainTitle ?? (selectedWorkInfoCard.title && selectedWorkInfoCard.title !== "-" ? selectedWorkInfoCard.title : null); return t && t !== "-" ? t : "-"; })()}</div>
                    </div>

                    {/* Sub Title — 사용자 입력 200자 (필수) */}
                    <div className="workinfo-text-block text-block-sub" data-field="subTitle">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Sub Title
                      </h4>
                      {workInfoViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea sub-title-input"
                            value={editingSubTitle}
                            onChange={(e) => {
                              if (e.target.value.length <= 300) setEditingSubTitle(e.target.value);
                            }}
                            placeholder="이번 주 이 라인에서 어떤 내용을 진행하고, 어떤 과정을 밟으며, 어떤 정보들을 얻게 되었는지를 작성해주세요. 😊"
                            maxLength={300}
                          />
                          <span className="char-count">{editingSubTitle.length}/300</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{
                          // 사용자 제출값 단일 출처: 카드(=weekActivityDetails.sub_title) 우선 →
                          // DTO 라인 submission.subtitle → 없으면 "-". (운영자 필드 infoSubtitle 표시 금지)
                          selectedWorkInfoCard?.subTitle
                          || ((workInfoMatchedLine as (Cluster4WeeklyLineDto & { submission?: { subtitle?: string | null } }) | null)?.submission?.subtitle ?? "")
                          || "-"
                        }</div>
                      )}
                    </div>

                    {/* Growth Point — 사용자 입력 100자 (필수) */}
                    <div className="workinfo-text-block text-block-growth" data-field="growthPoint">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Growth Point
                      </h4>
                      {workInfoViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea growth-point-input"
                            value={editingGrowthPoint}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) setEditingGrowthPoint(e.target.value);
                            }}
                            placeholder="이번 주 이 라인을 진행하며 느낀 통찰, 정보, 감각, 식견을 통해 어떤 성장이 이루어졌는지를 어필해주세요. 😊"
                            maxLength={200}
                          />
                          <span className="char-count">{editingGrowthPoint.length}/200</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{
                          // 사용자 제출값 단일 출처: 카드(=weekActivityDetails.growth_point) 우선 →
                          // DTO 라인 submission.growthPoint → 없으면 "-". (운영자 필드 infoGrowthPoint 표시 금지)
                          selectedWorkInfoCard?.growthPoint
                          || ((workInfoMatchedLine as (Cluster4WeeklyLineDto & { submission?: { growthPoint?: string | null } }) | null)?.submission?.growthPoint ?? "")
                          || "-"
                        }</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ──── 우측 — 이미지 2×2 그리드 ──── */}
                {/* 슬롯 0..adminCount-1: 운영진 이미지 (read-only), 이후: 크루 이미지 (옵셔널) — adminCount = 관리자 점유 슬롯 수 */}
                <div className="workinfo-right">
                  <div className="workinfo-image-grid images-grid">
                    {Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                      // 운영진 이미지 슬롯 분기
                      const adminImages = selectedWorkInfoCard?.activityType ? getAdminOutputImages(selectedWorkInfoCard.activityType, workInfoMatchedLine) : [];
                      // 관리자가 점유한 이미지 슬롯 수 — matchedLine.adminOutputImageCount(백엔드 SoT) 우선, 없으면 legacy 길이.
                      const adminCount = Math.min(getAdminOutputImagesCount(selectedWorkInfoCard?.activityType ?? "", workInfoMatchedLine), WORKINFO_IMAGE_SLOT_COUNT);
                      const isAdminSlot = imageIdx < adminCount;
                      // 첫 번째 슬롯(imageIdx===0)은 고객 모드에서 이미지/관리자 점유 여부와 무관하게 항상 수정 불가(관리자 전용).
                      //   adminCount===0(관리자 미입력) 이어도 슬롯0 은 read-only — exp/ability/career 허브와 동일 정책.
                      const isFirstSlotLocked = !isPureAdminPreview && imageIdx === 0;
                      // 슬롯 idx → 데이터 출처
                      // 0..adminCount-1: adminImages[idx] (관리자 전용 read-only)
                      // adminCount..: 크루 이미지 (image_urls[idx - adminCount])
                      const viewImages = normalizeWorkInfoImages(selectedWorkInfoCard?.images);
                      const viewCaptions = normalizeWorkInfoCaptions(selectedWorkInfoCard?.imageCaptions);
                      const crewImagesForState = workInfoViewIsEditing ? editingImages : viewImages;
                      const crewCaptionsForState = workInfoViewIsEditing ? editingImageCaptions : viewCaptions;
                      let image: string | null = null;
                      let caption = "";
                      const effectiveIsAdmin = !isPureAdminPreview && isAdminSlot;
                      // card.images 가 crew-only 가 된 뒤(2026-06-09), 순수 어드민 '편집' 모드만 merged
                      // editingImages(초기화 3171 에서 admin+crew 병합)를 직접 인덱싱한다. 그 외(일반 모드 +
                      // 순수 어드민 '보기')는 어드민 슬롯=getAdminOutputImages, 크루 슬롯=card.images(crew-only)로
                      // 분리 렌더 → 동일 이미지 중복 없음.
                      if (isPureAdminPreview && workInfoViewIsEditing) {
                        image = crewImagesForState[imageIdx] || null;
                        caption = crewCaptionsForState[imageIdx] || "";
                      } else if (isAdminSlot) {
                        const adminImg = adminImages[imageIdx];
                        image = adminImg?.url || null;
                        caption = adminImg?.caption || "";
                      } else {
                        const crewSlotIdx = imageIdx - adminCount;
                        image = crewImagesForState[crewSlotIdx] || null;
                        caption = crewCaptionsForState[crewSlotIdx] || "";
                      }
                      const slotIsEditable = workInfoViewIsEditing && (isPureAdminPreview || !isAdminSlot) && !isFirstSlotLocked;
                      const crewSlotIdx = imageIdx - adminCount;
                      const effectiveIdx = isPureAdminPreview ? imageIdx : crewSlotIdx;
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${(effectiveIsAdmin || isFirstSlotLocked) && !image ? " disabled" : ""}${effectiveIsAdmin || isFirstSlotLocked ? " admin-slot" : ""}`} style={{ position: "relative" }}>
                          {image ? (
                            <div className="image-preview" onClick={() => { if (image) setPreviewImageUrl(image); }}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {slotIsEditable && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerImageUpload(effectiveIdx);
                                    }}
                                    title="교체"
                                    aria-label="교체"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="image-action-btn image-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImageDelete(effectiveIdx);
                                    }}
                                    title="삭제"
                                    aria-label="삭제"
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="image-preview"
                              onClick={async () => {
                                if (isPureAdminPreview && workInfoViewIsEditing) {
                                  triggerImageUpload(effectiveIdx);
                                } else if (isFirstSlotLocked && workInfoViewIsEditing) {
                                  await popup.alert("이 공간은 운영진이 업로드하는 공간입니다.");
                                } else if (isAdminSlot && workInfoViewIsEditing) {
                                  await popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다.");
                                } else if (!isAdminSlot && workInfoViewIsEditing) {
                                  const isCrewEnabled = crewSlotIdx === 0 || !!crewImagesForState[crewSlotIdx - 1];
                                  if (!isCrewEnabled) {
                                    await popup.alert("먼저 앞 순서의 이미지를 업로드해주세요.");
                                  } else {
                                    triggerImageUpload(crewSlotIdx);
                                  }
                                }
                              }}
                            >
                              {slotIsEditable && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerImageUpload(effectiveIdx);
                                    }}
                                    title="업로드"
                                    aria-label="업로드"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                </div>
                              )}
                              <div className="empty-slot"><i className="ti ti-photo-plus"></i></div>
                            </div>
                          )}
                          {(isPureAdminPreview || !isAdminSlot) && (
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                imageFileInputRefs.current[effectiveIdx] = el;
                              }}
                              style={{ display: "none" }}
                              onChange={(e) => handleImageFileChange(e, effectiveIdx)}
                            />
                          )}
                          <div className="image-caption-overlay">
                            {slotIsEditable && activeCaptionIdx === effectiveIdx ? (
                              <input
                                type="text"
                                className="caption-input"
                                value={editingImageCaptions[effectiveIdx] || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 20) handleCaptionChange(effectiveIdx, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="캡션 입력 (최대 20자)"
                                maxLength={20}
                                autoFocus
                              />
                            ) : (
                              <span className="caption-text">{caption}</span>
                            )}
                          </div>
                          {slotIsEditable && (
                            <button
                              type="button"
                              className={`image-action-btn image-caption-btn${activeCaptionIdx === effectiveIdx ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCaptionIdx(activeCaptionIdx === effectiveIdx ? null : effectiveIdx);
                              }}
                              title={activeCaptionIdx === effectiveIdx ? "캡션 저장" : "캡션 편집"}
                              aria-label="캡션"
                              style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                            >
                              <i className="ti ti-text-caption"></i>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 라인코드: 고객 표시용 공식 코드(DTO displayLineCode = /admin/lines/info 운영자 코드
                      IFBS-NN000X) 만 표시. 내부 lineCode(info-OK-wisdom-2026w10)는 노출 금지(매칭 전용).
                      미배정/미상(displayLineCode 없음)은 하드코딩 legacy(IF99A-NR####) 미노출 — "-" 처리. */}
                  <span className="line-code image-line-code">{(workInfoMatchedLine?.displayLineCode as string | null | undefined) || "-"}</span>
                </div>
              </div>
            </div>

            {/* ── 푸터 (118px) Type B: 행1[🔎 + 버튼] / 행2[안내문 우측 visibility 토글] ── */}
            <div className="section-modal-footer">
              {/* 행 1 */}
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={() => setHelpModalKind("workInfo")} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!workInfoViewIsEditing ? (
                    (() => {
                      // 백엔드 단일 출처: weekId + partType(information) + activityTypeKey 로만 매칭.
                      // partType-only 매칭 금지 — 매칭되는 line 이 없으면 (essay/wisdom/지난주 등)
                      // 수정 불가(disabled) 로 처리한다 (legacy 활성화 fallback 금지).
                      const activityTypeKey = (selectedWorkInfoCard?.activityType as string | null | undefined) ?? null;
                      const infoLine = findCluster4Line({ partType: "information", activityTypeKey });
                      const lineTargetId = (infoLine?.lineTargetId as string | null | undefined) ?? null;
                      const backendEditable = infoLine?.canEdit === true && !!lineTargetId;

                      const disabled = forceEditUnlock ? false : (!backendEditable || isForeignViewer);

                      const disabledReason: string | null = !disabled
                        ? null
                        : !infoLine
                        ? "NO_LINE_FOR_ACTIVITY_TYPE"
                        : !lineTargetId
                        ? "NO_LINE_TARGET_ID"
                        : infoLine.canEdit === false
                        ? (infoLine.editReason as string | null | undefined) ?? "BACKEND_CAN_EDIT_FALSE"
                        : "UNKNOWN";

                      const title = !disabled
                        ? "수정"
                        : !infoLine
                        ? "개설된 라인이 없습니다."
                        : (infoLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊";

                      // 현재 주차 information 라인 후보 (매칭 디버깅용)
                      const availableInformationLines = cluster4Lines
                        .filter((l) => {
                          if ((l.weekId ?? null) !== weekId) return false;
                          const p = String(l.partType ?? "").toLowerCase();
                          return p === "information" || p === "info";
                        })
                        .map((l) => ({
                          activityTypeKey: l.activityTypeKey ?? null,
                          lineTargetId: l.lineTargetId ?? null,
                          canEdit: typeof l.canEdit === "boolean" ? l.canEdit : null,
                        }));

                      // 진단 로그 — sub-line key(activityTypeKey) 포함
                      console.log("[cluster4-canEdit] workInfo 수정 버튼 상태", {
                        sessionUserId: session?.user?.id ?? null,
                        targetUserId: urlUserId || session?.user?.id || null,
                        partType: "information",
                        currentWeekId: weekId,
                        selectedWorkInfoCardActivityType: activityTypeKey,
                        availableInformationLines,
                        matchedLine: infoLine
                          ? {
                              activityTypeKey: infoLine.activityTypeKey ?? null,
                              lineTargetId,
                              canEdit: typeof infoLine.canEdit === "boolean" ? infoLine.canEdit : null,
                              editReason: (infoLine.editReason as string | null | undefined) ?? null,
                              status: (infoLine.status as string | null | undefined) ?? null,
                            }
                          : null,
                        lineStatus: (infoLine?.status as string | null | undefined) ?? null,
                        submissionOpensAt: (infoLine?.submissionOpensAt as string | null | undefined) ?? null,
                        submissionClosesAt: (infoLine?.submissionClosesAt as string | null | undefined) ?? null,
                        canEdit: typeof infoLine?.canEdit === "boolean" ? infoLine.canEdit : null,
                        disabledReason,
                      });

                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkInfo} disabled={disabled} aria-disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
                          수정
                        </button>
                      );
                    })()
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelWorkInfo}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetWorkInfo}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveWorkInfo}>
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 행 2 — visibility 토글로 공간 유지 (cluster2/3 표준: 우측 정렬) */}
              <div className="modal-footer-bottom">
                <span className={`modal-notice modal-footer-notice ${workInfoFooterNotice === "error" ? "notice-error" : ""}`} style={{ visibility: workInfoViewIsEditing ? "visible" : "hidden" }}>
                  {workInfoFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
                </span>
              </div>
            </div>
          </div>

          {/* 이미지 확대 2차 모달 — cluster3 패턴 (overlay 클릭으로 닫기, 닫기 버튼 없음) */}
          {previewImageUrl && (
            <div className="image-preview-overlay" onClick={() => setPreviewImageUrl(null)}>
              <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
                <img src={previewImageUrl} alt="확대 이미지" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 실무 경험 카드 상세보기 모달 (workInfo 패턴 복제 — 가로형_대 1468×855 / 헤더·푸터·state) ========== */}
      {workExpViewModalOpen && selectedWorkExpCard && (
        <div className="section-modal-overlay work-modal-size-overlay">
          <div className="section-modal work-view-modal workexp-view-modal work-modal-size">
            {/* ── 헤더 (100px) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>
                  실무 경험 <span className="line-name-text">{(workExpMatchedLine?.lineName as string | null | undefined) ?? workExpMatchedLine?.activityTypeName ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "카테고리")}</span>
                </h3>
              </div>
              <p className="modal-subtitle">이번 주에 어떤 실무 경험을 직접 진행해보며, 어떤 과정과 결과를 도출해냈는지를 마음껏 어필해주세요. 😊</p>
              <button className="modal-close-btn" onClick={handleCloseWorkExp}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {/* ── 미드 (637px) — 좌측 콘텐츠 + 우측 이미지 2×2 ── */}
            <div className="section-modal-body">
              <div className="workinfo-content-layout">
                {/* ──── 좌측 ──── */}
                <div className="workinfo-left">
                  {/* 좌상단: 인적사항 카드 */}
                  <div className="workinfo-personal-card">
                    <div className="personal-grid">
                      <div className="personal-photo">
                        <img
                          src={ownerPersonalInfo.profileImageUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>

                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{ownerInfoReady ? mask.crewName(ownerPersonalInfo.name) : <Skeleton width={60} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{ownerInfoReady ? mask.gender(ownerPersonalInfo.gender) : <Skeleton width={16} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{ownerInfoReady ? <>{ownerPersonalInfo.age != null ? mask.age(ownerPersonalInfo.age) : "—"} 세</> : <Skeleton width={30} height={15} />}</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(ownerRoleBadge, CREW_CLASS_REGULAR)}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(ownerPersonalInfo.tagline ?? "-", "-")}</span>
                          </div>
                        </div>

                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? mask.school(ownerPersonalInfo.school) : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? (ownerPersonalInfo.department ? formatMajor(mask.major(ownerPersonalInfo.department)) : "—") : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.team ?? "—"}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.part ?? "—"}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>

                      {(() => {
                        const enhanceStatusTextMap: Record<string, string> = {
                          success: "강화 성공",
                          waiting: "강화 대기",
                          failed: "강화 실패",
                          not_applicable: "해당 없음",
                        };
                        const statusImages: Record<string, string> = {
                          success: "/images/0/cluster4/icon/5 강화 성공.png",
                          waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                          failed: "/images/0/cluster4/icon/7 강화 실패.png",
                          not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                        };
                        // 강화 상태 status-badge: 백엔드 DTO matchedLine.enhancementStatus 단일 출처 (프론트 재계산 금지).
                        // 카드 미리보기와 동일 매칭: strict(lineTargetId) 미매칭 시 relaxed badge 라인으로 fallback.
                        // matchedLine 값 없을 때만 기존 legacy 평가로 fallback. 보이드(empty)는 카드 isEmpty 기준 유지.
                        const enh = enhancementStatusBadge(workExpMatchedLine ?? workExpBadgeLine);
                        const legacyKey = selectedWorkExpCard.isEmpty ? "empty" : isRestMode || isOnboardingWeek ? "not_applicable" : !selectedWorkExpCard.hasActivity ? "failed" : (selectedWorkExpCard.enhancementStatus as string);
                        const isVoid = !enh && legacyKey === "empty";
                        const src = enh?.src ?? statusImages[legacyKey];
                        const alt = enh?.alt ?? (enhanceStatusTextMap[legacyKey] || "강화 상태");
                        const toneClass = enh?.toneClass ?? (legacyKey || "not_applicable");
                        const text = enh?.text ?? (enhanceStatusTextMap[legacyKey] || "—");
                        return (
                          <div className="personal-line-status line-info-row">
                            {isVoid ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {src ? <img className="line-enhance-icon" src={src} alt={alt} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${toneClass}`}>{text}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 좌중단: 2열 (시즌/주차 + 라인정보 / Output Link 5개) */}
                  <div className="workinfo-mid-section">
                    <div className="workinfo-mid-col1">
                      <div className="workinfo-date-badge">
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekNumberLabel(weekData.seasonType ?? weekData.seasonName, weekData.weekNumber)}` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        <div className="line-info-row">
                          {/* 라인명: matchedLine.lineName(master.line_name) → activityTypeName → legacy (mainTitle 금지) */}
                          <img className="line-activity-icon" src={getWorkExpIcon((workExpMatchedLine?.lineName as string | null | undefined) || (workExpMatchedLine?.activityTypeName as string | null | undefined) || lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "")} alt={(workExpMatchedLine?.lineName as string | null | undefined) || (workExpMatchedLine?.activityTypeName as string | null | undefined) || selectedWorkExpCard.badge || "활동"} />
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {(workExpMatchedLine?.lineName as string | null | undefined) ?? workExpMatchedLine?.activityTypeName ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "—")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Output Link 5개 */}
                    <div className="workinfo-mid-col2">
                      <div className="workinfo-output-links" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          const dotColor = ["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"][i];
                          const adminCount = selectedWorkExpCard?.activityTypeId ? getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId, workExpMatchedLine) : 0;
                          const isAdminLink = i < adminCount;
                          const adminOverride = isPureAdminPreview ? adminSavedOutputLinks["workExp"]?.[i] : null;
                          const backendLink = lineOutputLinkAt(workExpMatchedLine, i);
                          const link = workExpViewIsEditing
                            ? editingExpOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim()
                                ? adminOverride
                                : workExpMatchedLine
                                ? backendLink || { desc: "", url: "" }
                                : selectedWorkExpCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workExpViewIsEditing ? editingExpOutputLinks[i - 1] : (isPureAdminPreview ? adminSavedOutputLinks["workExp"]?.[i - 1] : null);
                          const sequentialDisabled = workExpViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          if (isAdminPreview && i === 0) console.log("[RenderWorkExp]", { isEditing: workExpViewIsEditing, link, adminOverride });
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workExpViewIsEditing && (!isAdminLink || isPureAdminPreview) ? (
                                <span
                                  className={`output-link-text output-link-editable${hasUrl ? "" : " output-link-empty"}${sequentialDisabled ? " output-link-disabled" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (!sequentialDisabled) openOutputLinkEditModal("workExp", i);
                                  }}
                                  title={hasUrl ? link.desc?.trim() || link.url : undefined}
                                >
                                  {sequentialDisabled ? "먼저 상위 Output Link를 입력해주세요" : hasUrl ? displayText || "" : `Output Link ${i + 1}`}
                                </span>
                              ) : hasUrl ? (
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => { if ((workInfoViewIsEditing || workExpViewIsEditing || workAbilityViewIsEditing || workCareerViewIsEditing) && isAdminLink && !isPureAdminPreview) { void popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다."); return; } window.open(ensureProtocol(link.url), "_blank"); }}>
                                  {displayText}
                                </span>
                              ) : (
                                <span className="output-link-text output-link-empty">-</span>
                              )}
                              <button type="button" className="link-open-btn" onClick={() => hasUrl && window.open(ensureProtocol(link.url), "_blank")} disabled={!hasUrl} aria-label="링크 열기">
                                <i className="ti ti-external-link"></i>
                              </button>
                              {workExpViewIsEditing && !isAdminLink && hasUrl && (
                                <button type="button" className="output-link-delete" onClick={() => handleExpOutputLinkDelete(i)} aria-label="링크 삭제">
                                  <i className="ti ti-x"></i>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="workinfo-mid-divider" aria-hidden="true" />
                  </div>

                  {/* 좌하단: Main Title + Sub Title + Growth Point */}
                  <div className="workinfo-text-section">
                    <div className="workinfo-text-block text-block-main">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Main Title
                      </h4>
                      <div className="text-block-content main-title-readonly">{workExpMatchedLine?.mainTitle ?? (lookupWorkExpMapping(selectedWorkExpCard.code)?.mainTitle || (selectedWorkExpCard.title && selectedWorkExpCard.title !== "-" ? selectedWorkExpCard.title : "-"))}</div>
                    </div>

                    <div className="workinfo-text-block text-block-sub" data-field="subTitle">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Sub Title
                      </h4>
                      {workExpViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea sub-title-input"
                            value={editingExpSubTitle}
                            onChange={(e) => {
                              if (e.target.value.length <= 300) setEditingExpSubTitle(e.target.value);
                            }}
                            placeholder="이번 주 이 라인에서 어떤 실무 경험을 진행했고, 어떤 과정을 거쳐, 어떤 결과를 만들어냈는지를 작성해주세요. 😊"
                            maxLength={300}
                          />
                          <span className="char-count">{editingExpSubTitle.length}/300</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkExpCard.subTitle || "-"}</div>
                      )}
                    </div>

                    <div className="workinfo-text-block text-block-growth" data-field="growthPoint">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Growth Point
                      </h4>
                      {workExpViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea growth-point-input"
                            value={editingExpGrowthPoint}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) setEditingExpGrowthPoint(e.target.value);
                            }}
                            placeholder="이번 주 이 실무 경험을 통해 느낀 통찰, 역량, 성과를 통해 어떤 성장이 이루어졌는지를 어필해주세요. 😊"
                            maxLength={200}
                          />
                          <span className="char-count">{editingExpGrowthPoint.length}/200</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkExpCard.growthPoint || "-"}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ──── 우측 — 이미지 2×2 ──── */}
                <div className="workinfo-right">
                  <div className="workinfo-image-grid images-grid">
                    {Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                      const viewImages = normalizeWorkInfoImages(selectedWorkExpCard?.images);
                      const viewCaptions = normalizeWorkInfoCaptions(selectedWorkExpCard?.imageCaptions);
                      const imagesForState = workExpViewIsEditing ? editingExpImages : viewImages;
                      const captionsForState = workExpViewIsEditing ? editingExpImageCaptions : viewCaptions;
                      const image = imagesForState[imageIdx] || null;
                      const caption = captionsForState[imageIdx] || "";
                      // 첫 번째 슬롯(imageIdx===0)은 고객 모드에서 이미지 유무와 관계없이 항상 수정 불가(관리자 전용).
                      //   슬롯1은 고객 첫 편집 슬롯으로 항상 활성(슬롯0 이미지에 의존하지 않음), 슬롯2+는 직전 이미지 순차 활성.
                      //   isPureAdminPreview(관리자 미리보기)는 종전대로 전 슬롯 편집 가능.
                      const isEnabled = isPureAdminPreview || (imageIdx !== 0 && (imageIdx === 1 || !!imagesForState[imageIdx - 1]));
                      const isFirstSlotLocked = !isPureAdminPreview && imageIdx === 0;
                      const isRequired = imageIdx < 2;
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${!isEnabled ? " disabled" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
                          {image ? (
                            <div className="image-preview" onClick={() => { if (image) setPreviewExpImageUrl(image); }}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {workExpViewIsEditing && !isFirstSlotLocked && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerExpImageUpload(imageIdx);
                                    }}
                                    title="교체"
                                    aria-label="교체"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="image-action-btn image-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExpImageDelete(imageIdx);
                                    }}
                                    title="삭제"
                                    aria-label="삭제"
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="image-preview"
                              onClick={async () => {
                                if (workExpViewIsEditing) {
                                  if (isFirstSlotLocked) {
                                    await popup.alert("이 공간은 운영진이 업로드하는 공간입니다.");
                                  } else if (!isEnabled) {
                                    await popup.alert("먼저 앞 순서의 이미지를 업로드해주세요.");
                                  } else {
                                    triggerExpImageUpload(imageIdx);
                                  }
                                }
                              }}
                            >
                              {workExpViewIsEditing && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerExpImageUpload(imageIdx);
                                    }}
                                    disabled={!isEnabled}
                                    title="업로드"
                                    aria-label="업로드"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="image-action-btn image-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExpImageDelete(imageIdx);
                                    }}
                                    disabled
                                    title="삭제"
                                    aria-label="삭제"
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              )}
                              <div className="empty-slot">
                                <i className="ti ti-photo-plus"></i>
                              </div>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => {
                              expImageFileInputRefs.current[imageIdx] = el;
                            }}
                            style={{ display: "none" }}
                            onChange={(e) => handleExpImageFileChange(e, imageIdx)}
                          />
                          <div className="image-caption-overlay">
                            {workExpViewIsEditing && activeExpCaptionIdx === imageIdx ? (
                              <input
                                type="text"
                                className="caption-input"
                                value={editingExpImageCaptions[imageIdx] || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 20) handleExpCaptionChange(imageIdx, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="캡션 입력 (최대 20자)"
                                maxLength={20}
                                autoFocus
                              />
                            ) : (
                              <span className="caption-text">{caption}</span>
                            )}
                          </div>
                          {workExpViewIsEditing && (
                            <button
                              type="button"
                              className={`image-action-btn image-caption-btn${activeExpCaptionIdx === imageIdx ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveExpCaptionIdx(activeExpCaptionIdx === imageIdx ? null : imageIdx);
                              }}
                              title={activeExpCaptionIdx === imageIdx ? "캡션 저장" : "캡션 편집"}
                              aria-label="캡션"
                              style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                            >
                              <i className="ti ti-text-caption"></i>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 라인코드: 실제 개설 라인 lineCode 만 표시(하드코딩 legacy catalog 코드 미노출 — 미배정은 "-"). */}
                  <span className="line-code image-line-code">{workExpMatchedLine?.lineCode || "-"}</span>

                  {/* 라인 평점 — weekly-cards DTO 의 experienceRating(SoT=cluster4_experience_line_evaluations.rating) 단일 출처.
                      프론트 임의 계산 금지. number → "n / 10"(0 포함), null/undefined → "- / 10". */}
                  {(() => {
                    const dtoRating = typeof workExpMatchedLine?.experienceRating === "number" ? workExpMatchedLine.experienceRating : null;
                    const hasRating = dtoRating !== null;
                    const halfValue = hasRating ? dtoRating / 2 : 0;
                    return (
                      <div className="workexp-rating-section" data-field="rating">
                        <span className="rating-label">라인 평점</span>
                        <div className="rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => {
                            let starClass = "star-empty";
                            if (halfValue >= star) {
                              starClass = "star-full";
                            } else if (halfValue >= star - 0.5) {
                              starClass = "star-half";
                            }
                            return (
                              <span key={star} className={`rating-star ${starClass}`}>
                                ★
                              </span>
                            );
                          })}
                        </div>
                        <span className="rating-display">{hasRating ? dtoRating : "-"} / 10</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ── 푸터 Type B ── */}
            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={() => setShowExpHelpModal(true)} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!workExpViewIsEditing ? (
                    (() => {
                      // 백엔드 단일 출처: matchedLine 만으로 버튼 활성화 판단 (legacy canEdit / empty / locked fallback 제거).
                      // matchedLine 없음 → disabled, matchedLine.canEdit === true && lineTargetId 존재 → enabled.
                      const expLine = workExpMatchedLine;
                      const lineTargetId = (expLine?.lineTargetId as string | null | undefined) ?? null;
                      const backendEditable = expLine?.canEdit === true && !!lineTargetId;
                      const disabled = forceEditUnlock ? false : (!backendEditable || isForeignViewer);
                      const title = !disabled
                        ? "수정"
                        : !expLine
                        ? "개설된 라인이 없습니다."
                        : (expLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊";
                      console.log("[cluster4-canEdit] workExp 수정 버튼 상태", {
                        currentWeekId: weekId,
                        partType: "experience",
                        experienceLineMasterId: (selectedWorkExpCard?.experienceLineMasterId as string | null | undefined) ?? null,
                        lineCode: (selectedWorkExpCard?.code as string | null | undefined) ?? null,
                        matchedLine: expLine
                          ? { lineTargetId, canEdit: typeof expLine.canEdit === "boolean" ? expLine.canEdit : null, editReason: (expLine.editReason as string | null | undefined) ?? null }
                          : null,
                        disabled,
                      });
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkExp} disabled={disabled} aria-disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
                          수정
                        </button>
                      );
                    })()
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelWorkExp}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetWorkExp}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveWorkExp}>
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="modal-footer-bottom">
                <span className={`modal-notice modal-footer-notice ${workExpFooterNotice === "error" ? "notice-error" : ""}`} style={{ visibility: workExpViewIsEditing ? "visible" : "hidden" }}>
                  {workExpFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
                </span>
              </div>
            </div>
          </div>

          {/* 이미지 확대 2차 모달 — cluster3 패턴 (overlay 클릭으로 닫기) */}
          {previewExpImageUrl && (
            <div className="image-preview-overlay" onClick={() => setPreviewExpImageUrl(null)}>
              <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
                <img src={previewExpImageUrl} alt="확대 이미지" />
              </div>
            </div>
          )}

          {/* 도움말 모달 */}
          {showExpHelpModal && (
            <div className="help-modal-overlay" onClick={() => setShowExpHelpModal(false)}>
              <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="help-modal-header">
                  <div className="modal-header-top">
                    <span style={{ fontSize: "20px" }}>🔎</span>
                    <h3>도움말</h3>
                    <button className="modal-close-btn" onClick={() => setShowExpHelpModal(false)}>
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                </div>
                <HelpModalBody helpKey="exp" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 실무 역량 카드 상세보기 모달 (workInfo 패턴 복제) ========== */}
      {workAbilityViewModalOpen && selectedWorkAbilityCard && (
        <div className="section-modal-overlay work-modal-size-overlay">
          <div className="section-modal work-view-modal workability-view-modal work-modal-size">
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>
                  실무 역량 <span className="line-name-text">{selectedWorkAbilityCard.lineName || "카테고리"}</span>
                </h3>
              </div>
              <p className="modal-subtitle">이번 주에 어떤 실무 역량들을 습득하며, 어떤 과정과 성장을 이루어냈는지를 마음껏 어필해주세요. 😊</p>
              <button className="modal-close-btn" onClick={handleCloseWorkAbility}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            <div className="section-modal-body">
              <div className="workinfo-content-layout">
                <div className="workinfo-left">
                  <div className="workinfo-personal-card">
                    <div className="personal-grid">
                      <div className="personal-photo">
                        <img
                          src={ownerPersonalInfo.profileImageUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>
                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{ownerInfoReady ? mask.crewName(ownerPersonalInfo.name) : <Skeleton width={60} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{ownerInfoReady ? mask.gender(ownerPersonalInfo.gender) : <Skeleton width={16} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{ownerInfoReady ? <>{ownerPersonalInfo.age != null ? mask.age(ownerPersonalInfo.age) : "—"} 세</> : <Skeleton width={30} height={15} />}</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(ownerRoleBadge, CREW_CLASS_REGULAR)}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(ownerPersonalInfo.tagline ?? "-", "-")}</span>
                          </div>
                        </div>
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? mask.school(ownerPersonalInfo.school) : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? (ownerPersonalInfo.department ? formatMajor(mask.major(ownerPersonalInfo.department)) : "—") : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.team ?? "—"}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.part ?? "—"}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>
                      {(() => {
                        const statusTextMap: Record<string, string> = {
                          success: "강화 성공",
                          waiting: "강화 대기",
                          failed: "강화 실패",
                          not_applicable: "해당 없음",
                        };
                        // 강화 상태 status-badge: 백엔드 DTO matchedLine.enhancementStatus 단일 출처 (프론트 재계산 금지).
                        // 카드 미리보기와 동일 매칭: strict(lineTargetId) 미매칭 시 relaxed badge 라인으로 fallback.
                        // matchedLine 값 없을 때만 기존 legacy(statusIcon/enhancementStatus) fallback. 보이드(empty)는 카드 isEmpty 기준 유지.
                        const enh = enhancementStatusBadge(workAbilityMatchedLine ?? workAbilityBadgeLine);
                        const legacyKey = selectedWorkAbilityCard.isEmpty ? "empty" : (selectedWorkAbilityCard.enhancementStatus as string);
                        const isVoid = !enh && legacyKey === "empty";
                        const src = enh?.src ?? (selectedWorkAbilityCard.statusIcon as string | null | undefined);
                        const alt = enh?.alt ?? (statusTextMap[legacyKey] || "강화 상태");
                        const toneClass = enh?.toneClass ?? (legacyKey || "not_applicable");
                        const text = enh?.text ?? (statusTextMap[legacyKey] || "—");
                        return (
                          <div className="personal-line-status line-info-row">
                            {isVoid ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {src ? <img className="line-enhance-icon" src={src} alt={alt} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${toneClass}`}>{text}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="workinfo-mid-section">
                    <div className="workinfo-mid-col1">
                      <div className="workinfo-date-badge">
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekNumberLabel(weekData.seasonType ?? weekData.seasonName, weekData.weekNumber)}` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        <div className="line-info-row">
                          {selectedWorkAbilityCard.icon ? <img className="line-activity-icon" src={selectedWorkAbilityCard.icon} alt={selectedWorkAbilityCard.lineName || "활동"} /> : <span className="line-status-icon">●</span>}
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {selectedWorkAbilityCard.lineName || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="workinfo-mid-col2">
                      <div className="workinfo-output-links" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          const dotColor = ["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"][i];
                          const adminCount = getAbilityAdminLinkCount(workAbilityMatchedLine, selectedWorkAbilityCard?.activityTypeId);
                          const isAdminLink = i < adminCount;
                          const adminOverride = isPureAdminPreview ? adminSavedOutputLinks["workAbility"]?.[i] : null;
                          // 어드민 슬롯 = top-level outputLinks(어드민 개설값), 사용자 슬롯 = submission.outputLinks(사용자 제출값).
                          const backendLink = isAdminLink
                            ? lineOutputLinkAt(workAbilityMatchedLine, i)
                            : lineSubmissionOutputLinkAt(workAbilityMatchedLine, i - adminCount);
                          const link = workAbilityViewIsEditing
                            ? editingAbilityOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim()
                                ? adminOverride
                                : workAbilityMatchedLine
                                ? backendLink || { desc: "", url: "" }
                                : selectedWorkAbilityCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workAbilityViewIsEditing ? editingAbilityOutputLinks[i - 1] : (isPureAdminPreview ? adminSavedOutputLinks["workAbility"]?.[i - 1] : null);
                          const sequentialDisabled = workAbilityViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workAbilityViewIsEditing && (!isAdminLink || isPureAdminPreview) ? (
                                <span
                                  className={`output-link-text output-link-editable${hasUrl ? "" : " output-link-empty"}${sequentialDisabled ? " output-link-disabled" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (!sequentialDisabled) openOutputLinkEditModal("workAbility", i);
                                  }}
                                  title={hasUrl ? link.desc?.trim() || link.url : undefined}
                                >
                                  {sequentialDisabled ? "먼저 상위 Output Link를 입력해주세요" : hasUrl ? displayText || "" : `Output Link ${i + 1}`}
                                </span>
                              ) : hasUrl ? (
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => { if ((workInfoViewIsEditing || workExpViewIsEditing || workAbilityViewIsEditing || workCareerViewIsEditing) && isAdminLink && !isPureAdminPreview) { void popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다."); return; } window.open(ensureProtocol(link.url), "_blank"); }}>
                                  {displayText}
                                </span>
                              ) : (
                                <span className="output-link-text output-link-empty">-</span>
                              )}
                              <button type="button" className="link-open-btn" onClick={() => hasUrl && window.open(ensureProtocol(link.url), "_blank")} disabled={!hasUrl} aria-label="링크 열기">
                                <i className="ti ti-external-link"></i>
                              </button>
                              {workAbilityViewIsEditing && !isAdminLink && hasUrl && (
                                <button type="button" className="output-link-delete" onClick={() => handleAbilityOutputLinkDelete(i)} aria-label="링크 삭제">
                                  <i className="ti ti-x"></i>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="workinfo-mid-divider" aria-hidden="true" />
                  </div>

                  <div className="workinfo-text-section">
                    <div className="workinfo-text-block text-block-main">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Main Title
                      </h4>
                      <div className="text-block-content main-title-readonly">{(() => { const t = workAbilityMatchedLine?.mainTitle ?? (selectedWorkAbilityCard.title && selectedWorkAbilityCard.title !== "-" ? selectedWorkAbilityCard.title : null); return t && t !== "-" ? t : "-"; })()}</div>
                    </div>
                    <div className="workinfo-text-block text-block-sub" data-field="subTitle">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Sub Title
                      </h4>
                      {workAbilityViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea sub-title-input"
                            value={editingAbilitySubTitle}
                            onChange={(e) => {
                              if (e.target.value.length <= 300) setEditingAbilitySubTitle(e.target.value);
                            }}
                            placeholder="이번 주 이 실무 역량을 어떤 과정으로 습득했고, 어떤 결과를 만들어냈는지를 작성해주세요. 😊"
                            maxLength={300}
                          />
                          <span className="char-count">{editingAbilitySubTitle.length}/300</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkAbilityCard.subTitle || "-"}</div>
                      )}
                    </div>
                    <div className="workinfo-text-block text-block-growth" data-field="growthPoint">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Growth Point
                      </h4>
                      {workAbilityViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea growth-point-input"
                            value={editingAbilityGrowthPoint}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) setEditingAbilityGrowthPoint(e.target.value);
                            }}
                            placeholder="이번 주 이 실무 역량을 통해 느낀 통찰, 역량, 성과를 통해 어떤 성장이 이루어졌는지를 어필해주세요. 😊"
                            maxLength={200}
                          />
                          <span className="char-count">{editingAbilityGrowthPoint.length}/200</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkAbilityCard.growthPoint || "-"}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="workinfo-right">
                  <div className="workinfo-image-grid images-grid">
                    {Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                      // 보기 모드: 어드민 개설 이미지(top-level outputImages) 슬롯을 앞에, 그 뒤 사용자 제출 이미지
                      // (submission.outputImages = selectedWorkAbilityCard.images). submission=null 이어도 admin 이미지는 표시.
                      const abilityAdminImages = getAbilityAdminImages(workAbilityMatchedLine, selectedWorkAbilityCard?.activityTypeId);
                      const abilityAdminImageCount = Math.min(getAbilityAdminImageCount(workAbilityMatchedLine, selectedWorkAbilityCard?.activityTypeId), WORKINFO_IMAGE_SLOT_COUNT);
                      const userViewImages = normalizeWorkInfoImages(selectedWorkAbilityCard?.images);
                      const userViewCaptions = normalizeWorkInfoCaptions(selectedWorkAbilityCard?.imageCaptions);
                      const viewImages = Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, s) =>
                        s < abilityAdminImageCount ? abilityAdminImages[s]?.url || null : userViewImages[s - abilityAdminImageCount] || null,
                      );
                      const viewCaptions = Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }, (_, s) =>
                        s < abilityAdminImageCount ? abilityAdminImages[s]?.caption || "" : userViewCaptions[s - abilityAdminImageCount] || "",
                      );
                      // 어드민 이미지 슬롯은 보기 모드에서만 노출 — 보기 모드 그리드엔 편집/삭제 컨트롤이 없어 자동 read-only.
                      const imagesForState = workAbilityViewIsEditing ? editingAbilityImages : viewImages;
                      const captionsForState = workAbilityViewIsEditing ? editingAbilityImageCaptions : viewCaptions;
                      const image = imagesForState[imageIdx] || null;
                      const caption = captionsForState[imageIdx] || "";
                      // 첫 번째 슬롯(imageIdx===0)은 고객 모드에서 이미지 유무와 관계없이 항상 수정 불가(관리자 전용).
                      //   슬롯1은 고객 첫 편집 슬롯으로 항상 활성(슬롯0 이미지에 의존하지 않음), 슬롯2+는 직전 이미지 순차 활성.
                      //   isPureAdminPreview(관리자 미리보기)는 종전대로 전 슬롯 편집 가능.
                      const isEnabled = isPureAdminPreview || (imageIdx !== 0 && (imageIdx === 1 || !!imagesForState[imageIdx - 1]));
                      const isFirstSlotLocked = !isPureAdminPreview && imageIdx === 0;
                      const isRequired = imageIdx < 2;
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${!isEnabled ? " disabled" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
                          {image ? (
                            <div className="image-preview" onClick={() => { if (image) setPreviewAbilityImageUrl(image); }}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {workAbilityViewIsEditing && !isFirstSlotLocked && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerAbilityImageUpload(imageIdx);
                                    }}
                                    title="교체"
                                    aria-label="교체"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="image-action-btn image-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAbilityImageDelete(imageIdx);
                                    }}
                                    title="삭제"
                                    aria-label="삭제"
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="image-preview"
                              onClick={async () => {
                                if (workAbilityViewIsEditing) {
                                  if (isFirstSlotLocked) {
                                    await popup.alert("이 공간은 운영진이 업로드하는 공간입니다.");
                                  } else if (!isEnabled) {
                                    await popup.alert("먼저 앞 순서의 이미지를 업로드해주세요.");
                                  } else {
                                    triggerAbilityImageUpload(imageIdx);
                                  }
                                }
                              }}
                            >
                              {workAbilityViewIsEditing && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerAbilityImageUpload(imageIdx);
                                    }}
                                    disabled={!isEnabled}
                                    title="업로드"
                                    aria-label="업로드"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                  <button type="button" className="image-action-btn image-delete-btn" disabled title="삭제" aria-label="삭제">
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              )}
                              <div className="empty-slot">
                                <i className="ti ti-photo-plus"></i>
                              </div>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => {
                              abilityImageFileInputRefs.current[imageIdx] = el;
                            }}
                            style={{ display: "none" }}
                            onChange={(e) => handleAbilityImageFileChange(e, imageIdx)}
                          />
                          <div className="image-caption-overlay">
                            {workAbilityViewIsEditing && activeAbilityCaptionIdx === imageIdx ? (
                              <input
                                type="text"
                                className="caption-input"
                                value={editingAbilityImageCaptions[imageIdx] || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 20) handleAbilityCaptionChange(imageIdx, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="캡션 입력 (최대 20자)"
                                maxLength={20}
                                autoFocus
                              />
                            ) : (
                              <span className="caption-text">{caption}</span>
                            )}
                          </div>
                          {workAbilityViewIsEditing && (
                            <button
                              type="button"
                              className={`image-action-btn image-caption-btn${activeAbilityCaptionIdx === imageIdx ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbilityCaptionToggle(imageIdx);
                              }}
                              title={activeAbilityCaptionIdx === imageIdx ? "캡션 저장" : "캡션 편집"}
                              aria-label="캡션"
                              style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                            >
                              <i className="ti ti-text-caption"></i>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 라인코드: 실제 개설 라인 lineCode 만 표시(하드코딩 legacy catalog 코드 미노출 — 미배정은 "-"). */}
                  <span className="line-code image-line-code">{workAbilityMatchedLine?.lineCode || "-"}</span>
                </div>
              </div>
            </div>

            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={() => setShowAbilityHelpModal(true)} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!workAbilityViewIsEditing ? (
                    (() => {
                      // 백엔드 단일 출처: matchedLine 만으로 버튼 활성화 판단 (legacy canEdit / empty / locked fallback 제거).
                      const abilityLine = workAbilityMatchedLine;
                      const lineTargetId = (abilityLine?.lineTargetId as string | null | undefined) ?? null;
                      const backendEditable = abilityLine?.canEdit === true && !!lineTargetId;
                      const disabled = forceEditUnlock ? false : (!backendEditable || isForeignViewer);
                      const title = !disabled
                        ? "수정"
                        : !abilityLine
                        ? "개설된 라인이 없습니다."
                        : (abilityLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊";
                      console.log("[cluster4-canEdit] workAbility 수정 버튼 상태", {
                        currentWeekId: weekId,
                        partType: "competency",
                        competencyLineMasterId: (selectedWorkAbilityCard?.competencyLineMasterId as string | null | undefined) ?? null,
                        lineCode: (selectedWorkAbilityCard?.lineCode as string | null | undefined) ?? (selectedWorkAbilityCard?.code as string | null | undefined) ?? null,
                        matchedLine: abilityLine
                          ? { lineTargetId, canEdit: typeof abilityLine.canEdit === "boolean" ? abilityLine.canEdit : null, editReason: (abilityLine.editReason as string | null | undefined) ?? null }
                          : null,
                        disabled,
                      });
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkAbility} disabled={disabled} aria-disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
                          수정
                        </button>
                      );
                    })()
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelWorkAbility}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetWorkAbility}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveWorkAbility}>
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom">
                <span className={`modal-notice modal-footer-notice ${workAbilityFooterNotice === "error" ? "notice-error" : ""}`} style={{ visibility: workAbilityViewIsEditing ? "visible" : "hidden" }}>
                  {workAbilityFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
                </span>
              </div>
            </div>
          </div>

          {previewAbilityImageUrl && (
            <div className="image-preview-overlay" onClick={() => setPreviewAbilityImageUrl(null)}>
              <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
                <img src={previewAbilityImageUrl} alt="확대 이미지" />
              </div>
            </div>
          )}

          {showAbilityHelpModal && (
            <div className="help-modal-overlay" onClick={() => setShowAbilityHelpModal(false)}>
              <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="help-modal-header">
                  <div className="modal-header-top">
                    <span style={{ fontSize: "20px" }}>🔎</span>
                    <h3>도움말</h3>
                    <button className="modal-close-btn" onClick={() => setShowAbilityHelpModal(false)}>
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                </div>
                <HelpModalBody helpKey="ability" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 실무 경력 카드 상세보기 모달 ========== */}
      {workCareerViewModalOpen && selectedWorkCareerCard && (
        <div className="section-modal-overlay work-modal-size-overlay">
          <div className="section-modal work-view-modal workcareer-view-modal work-modal-size">
            {/* ── 헤더 — workInfo/workExp 패턴 복제 (modal-header-top + h3 + modal-subtitle + close) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>
                  실무 경력 <span className="line-name-text">{selectedWorkCareerCard.lineName || selectedWorkCareerCard.badge || "카테고리"}</span>
                </h3>
              </div>
              <p className="modal-subtitle">이번 주에 어떤 실무 경력을 쌓았으며, 그 과정 속에서 어떤 인사이트와 저변을 넓혔는지를 마음껏 어필해주세요. 😊</p>
              <button className="modal-close-btn" onClick={handleCloseWorkCareer}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {/* ── 미드 — 좌측 콘텐츠 + 우측 이미지 3장 + 후원사(4단계) ── */}
            <div className="section-modal-body">
              <div className="workinfo-content-layout">
                {/* ──── 좌측 ──── */}
                <div className="workinfo-left">
                  {/* 좌상단: 인적사항 카드 (workExp와 동일) */}
                  <div className="workinfo-personal-card">
                    <div className="personal-grid">
                      <div className="personal-photo">
                        <img
                          src={ownerPersonalInfo.profileImageUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>

                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{ownerInfoReady ? mask.crewName(ownerPersonalInfo.name) : <Skeleton width={60} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{ownerInfoReady ? mask.gender(ownerPersonalInfo.gender) : <Skeleton width={16} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{ownerInfoReady ? <>{ownerPersonalInfo.age != null ? mask.age(ownerPersonalInfo.age) : "—"} 세</> : <Skeleton width={30} height={15} />}</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(ownerRoleBadge, CREW_CLASS_REGULAR)}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(ownerPersonalInfo.tagline ?? "-", "-")}</span>
                          </div>
                        </div>

                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? mask.school(ownerPersonalInfo.school) : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? (ownerPersonalInfo.department ? formatMajor(mask.major(ownerPersonalInfo.department)) : "—") : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.team ?? "—"}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.part ?? "—"}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>

                      {(() => {
                        // workCareer는 careerRecords(DB) 기반이라 'empty' 트리거 경로가 현재 없음 —
                        // 향후 isEmpty 플래그가 추가되면 여기서 우선 분기되도록 대비.
                        const isEmptyCard = (selectedWorkCareerCard as { isEmpty?: boolean }).isEmpty === true;
                        // 강화 상태 status-badge: 백엔드 DTO matchedLine.enhancementStatus 단일 출처 (프론트 재계산 금지).
                        // 카드 미리보기와 동일 매칭: strict(lineTargetId) 미매칭 시 relaxed badge 라인으로 fallback.
                        // matchedLine 값 없을 때만 기존 legacy(verified/isFailed/isNotApplicable) fallback. 보이드(empty)는 카드 기준 유지.
                        const enh = enhancementStatusBadge(workCareerMatchedLine ?? workCareerBadgeLine);
                        const legacyKey = isEmptyCard ? "empty" : selectedWorkCareerCard.verified ? "success" : selectedWorkCareerCard.isFailed ? "failed" : selectedWorkCareerCard.isNotApplicable ? "not_applicable" : "waiting";
                        const legacyText = selectedWorkCareerCard.verified ? "강화 성공" : selectedWorkCareerCard.isFailed ? "강화 실패" : selectedWorkCareerCard.isNotApplicable ? "해당 없음" : "강화 대기";
                        const isVoid = !enh && legacyKey === "empty";
                        const src = enh?.src ?? (selectedWorkCareerCard.statusBadge as string | null | undefined);
                        const alt = enh?.alt ?? legacyText;
                        const toneClass = enh?.toneClass ?? legacyKey;
                        const text = enh?.text ?? legacyText;
                        return (
                          <div className="personal-line-status line-info-row">
                            {isVoid ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {src ? <img className="line-enhance-icon" src={src} alt={alt} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${toneClass}`}>{text}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 좌중단: 시즌/주차 + 라인정보 / Output Link 5개 */}
                  <div className="workinfo-mid-section">
                    <div className="workinfo-mid-col1">
                      <div className="workinfo-date-badge">
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekNumberLabel(weekData.seasonType ?? weekData.seasonName, weekData.weekNumber)}` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        <div className="line-info-row">
                          {selectedWorkCareerCard.icon && selectedWorkCareerCard.icon !== "-" ? (
                            <img
                              className="line-activity-icon"
                              src={selectedWorkCareerCard.icon}
                              alt={selectedWorkCareerCard.badge || "활동"}
                              onClick={(e) => handleCompanyLogoClick(e, selectedWorkCareerCard.companyHomepageUrl)}
                              style={{ cursor: selectedWorkCareerCard.companyHomepageUrl ? "pointer" : undefined }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="line-activity-icon-placeholder" style={{ width: 48, height: 48, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>-</span>
                            </div>
                          )}
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {selectedWorkCareerCard.lineName || selectedWorkCareerCard.badge || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="workinfo-mid-col2">
                      <div className="workinfo-output-links" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          const dotColor = ["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"][i];
                          const activityType = workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1];
                          const adminCount = activityType ? getAdminOutputLinksCount(activityType, workCareerMatchedLine) : 0;
                          const isAdminLink = i < adminCount;
                          const adminOverride = isPureAdminPreview ? adminSavedOutputLinks["workCareer"]?.[i] : null;
                          const backendLink = lineOutputLinkAt(workCareerMatchedLine, i);
                          const link = workCareerViewIsEditing
                            ? editingCareerOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim()
                                ? adminOverride
                                : workCareerMatchedLine
                                ? backendLink || { desc: "", url: "" }
                                : selectedWorkCareerCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workCareerViewIsEditing ? editingCareerOutputLinks[i - 1] : (isPureAdminPreview ? adminSavedOutputLinks["workCareer"]?.[i - 1] : null);
                          const sequentialDisabled = workCareerViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workCareerViewIsEditing && (!isAdminLink || isPureAdminPreview) ? (
                                <span
                                  className={`output-link-text output-link-editable${hasUrl ? "" : " output-link-empty"}${sequentialDisabled ? " output-link-disabled" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (!sequentialDisabled) openOutputLinkEditModal("workCareer", i);
                                  }}
                                  title={hasUrl ? link.desc?.trim() || link.url : undefined}
                                >
                                  {sequentialDisabled ? "먼저 상위 Output Link를 입력해주세요" : hasUrl ? displayText || "" : `Output Link ${i + 1}`}
                                </span>
                              ) : hasUrl ? (
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => { if ((workInfoViewIsEditing || workExpViewIsEditing || workAbilityViewIsEditing || workCareerViewIsEditing) && isAdminLink && !isPureAdminPreview) { void popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다."); return; } window.open(ensureProtocol(link.url), "_blank"); }}>
                                  {displayText}
                                </span>
                              ) : (
                                <span className="output-link-text output-link-empty">-</span>
                              )}
                              <button type="button" className="link-open-btn" onClick={() => hasUrl && window.open(ensureProtocol(link.url), "_blank")} disabled={!hasUrl} aria-label="링크 열기">
                                <i className="ti ti-external-link"></i>
                              </button>
                              {workCareerViewIsEditing && !isAdminLink && hasUrl && (
                                <button type="button" className="output-link-delete" onClick={() => handleCareerOutputLinkDelete(i)} aria-label="링크 삭제">
                                  <i className="ti ti-x"></i>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="workinfo-mid-divider" aria-hidden="true" />
                  </div>

                  {/* 좌하단: Main Title(읽기전용) + Sub Title + Growth Point */}
                  <div className="workinfo-text-section">
                    <div className="workinfo-text-block text-block-main">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Main Title
                      </h4>
                      <div className="text-block-content main-title-readonly">{(() => { const t = workCareerMatchedLine?.mainTitle ?? (selectedWorkCareerCard.title && selectedWorkCareerCard.title !== "-" ? selectedWorkCareerCard.title : null); return t && t !== "-" ? t : "-"; })()}</div>
                    </div>

                    <div className="workinfo-text-block text-block-sub" data-field="subTitle">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Sub Title
                      </h4>
                      {workCareerViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea sub-title-input"
                            value={editingCareerSubTitle}
                            onChange={(e) => {
                              if (e.target.value.length <= 300) setEditingCareerSubTitle(e.target.value);
                            }}
                            placeholder="이번 주 이 라인에서 어떤 실무 경력을 쌓았고, 어떤 과정을 거쳐, 어떤 결과를 만들어냈는지를 작성해주세요. 😊"
                            maxLength={300}
                          />
                          <span className="char-count">{editingCareerSubTitle.length}/300</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkCareerCard.subTitle || selectedWorkCareerCard.projectDescription || "-"}</div>
                      )}
                    </div>

                    <div className="workinfo-text-block text-block-growth" data-field="growthPoint">
                      <h4 className="text-block-title">
                        <i className="ti ti-pin"></i>
                        Growth Point
                      </h4>
                      {workCareerViewIsEditing ? (
                        <div className="text-block-edit">
                          <textarea
                            className="text-block-textarea growth-point-input"
                            value={editingCareerGrowthPoint}
                            onChange={(e) => {
                              if (e.target.value.length <= 200) setEditingCareerGrowthPoint(e.target.value);
                            }}
                            placeholder="이번 주 이 실무 경력을 통해 느낀 인사이트와 저변 확장을 어필해주세요. 😊"
                            maxLength={200}
                          />
                          <span className="char-count">{editingCareerGrowthPoint.length}/200</span>
                        </div>
                      ) : (
                        <div className="text-block-content">{selectedWorkCareerCard.growthPoint || "-"}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ──── 우측 — 이미지 3장 + 후원사 placeholder(4단계) ──── */}
                <div className="workinfo-right">
                  <div className="workinfo-image-grid images-grid workcareer-image-grid">
                    {(() => {
                      const careerIdxForLock = (selectedWorkCareerCard?.id || 1) - 1;
                      const adminImgCountForLock = getAdminOutputImagesCount(workCareerActivityTypes[careerIdxForLock], workCareerMatchedLine);
                      return Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                        const viewImages = normalizeWorkCareerImages(selectedWorkCareerCard?.images);
                        const viewCaptions = normalizeWorkCareerCaptions(selectedWorkCareerCard?.imageCaptions);
                        const imagesForState = workCareerViewIsEditing ? editingCareerImages : viewImages;
                        const captionsForState = workCareerViewIsEditing ? editingCareerImageCaptions : viewCaptions;
                        const image = imagesForState[imageIdx] || null;
                        const caption = captionsForState[imageIdx] || "";
                        // 첫 번째 슬롯(imageIdx===0)은 고객 모드에서 이미지 유무와 관계없이 항상 수정 불가(관리자 전용).
                      //   슬롯1은 고객 첫 편집 슬롯으로 항상 활성(슬롯0 이미지에 의존하지 않음), 슬롯2+는 직전 이미지 순차 활성.
                      //   isPureAdminPreview(관리자 미리보기)는 종전대로 전 슬롯 편집 가능.
                      const isEnabled = isPureAdminPreview || (imageIdx !== 0 && (imageIdx === 1 || !!imagesForState[imageIdx - 1]));
                      const isFirstSlotLocked = !isPureAdminPreview && imageIdx === 0;
                        const isRequired = imageIdx < 2;
                        const isAdminLocked = !isPureAdminPreview && imageIdx < adminImgCountForLock;
                        const showEditingActions = workCareerViewIsEditing && !isAdminLocked && !isFirstSlotLocked;
                        return (
                          <div key={imageIdx} className={`workinfo-image-slot image-slot${!isEnabled ? " disabled" : ""}${isAdminLocked ? " admin-locked" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
                            {image ? (
                              <div className="image-preview" onClick={() => handleCareerImagePreview(imageIdx)}>
                                <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                                {showEditingActions && (
                                  <div className="image-actions-overlay">
                                    <button
                                      type="button"
                                      className="image-action-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerCareerImageUpload(imageIdx);
                                      }}
                                      title="교체"
                                      aria-label="교체"
                                    >
                                      <i className="ti ti-upload"></i>
                                    </button>
                                    <button
                                      type="button"
                                      className="image-action-btn image-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCareerImageDelete(imageIdx);
                                      }}
                                      title="삭제"
                                      aria-label="삭제"
                                    >
                                      <i className="ti ti-trash"></i>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className="image-preview"
                                onClick={async () => {
                                  if (isFirstSlotLocked && workCareerViewIsEditing) {
                                    await popup.alert("이 공간은 운영진이 업로드하는 공간입니다.");
                                  } else if (isAdminLocked && workCareerViewIsEditing) {
                                    await popup.alert("이 영역은 관리자가 입력한 자료입니다. 사용자는 수정할 수 없습니다.");
                                  } else if (workCareerViewIsEditing && !isAdminLocked) {
                                    if (!isEnabled) {
                                      await popup.alert("먼저 앞 순서의 이미지를 업로드해주세요.");
                                    } else {
                                      triggerCareerImageUpload(imageIdx);
                                    }
                                  }
                                }}
                              >
                                {showEditingActions && (
                                  <div className="image-actions-overlay">
                                    <button
                                      type="button"
                                      className="image-action-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerCareerImageUpload(imageIdx);
                                      }}
                                      disabled={!isEnabled}
                                      title="업로드"
                                      aria-label="업로드"
                                    >
                                      <i className="ti ti-upload"></i>
                                    </button>
                                    <button
                                      type="button"
                                      className="image-action-btn image-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCareerImageDelete(imageIdx);
                                      }}
                                      disabled
                                      title="삭제"
                                      aria-label="삭제"
                                    >
                                      <i className="ti ti-trash"></i>
                                    </button>
                                  </div>
                                )}
                                <div className="empty-slot">
                                  <i className="ti ti-photo-plus"></i>
                                </div>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                careerImageFileInputRefs.current[imageIdx] = el;
                              }}
                              style={{ display: "none" }}
                              onChange={(e) => handleCareerImageFileChange(e, imageIdx)}
                            />
                            <div className="image-caption-overlay">
                              {showEditingActions && activeCareerCaptionIdx === imageIdx ? (
                                <input
                                  type="text"
                                  className="caption-input"
                                  value={editingCareerImageCaptions[imageIdx] || ""}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 20) handleCareerCaptionChange(imageIdx, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="캡션 입력 (최대 20자)"
                                  maxLength={20}
                                  autoFocus
                                />
                              ) : (
                                <span className="caption-text">{caption}</span>
                              )}
                            </div>
                            {showEditingActions && (
                              <button
                                type="button"
                                className={`image-action-btn image-caption-btn${activeCareerCaptionIdx === imageIdx ? " active" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCareerCaptionIdx(activeCareerCaptionIdx === imageIdx ? null : imageIdx);
                                }}
                                title={activeCareerCaptionIdx === imageIdx ? "캡션 저장" : "캡션 편집"}
                                aria-label="캡션"
                                style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                              >
                                <i className="ti ti-text-caption"></i>
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
                    {/* 4번째 슬롯 — 후원/제휴사 카드 (항상 읽기전용, 편집 모드에서도 수정 불가) */}
                    {(() => {
                      // DB 값이 우선. 없으면 데모 모드에서만 card id 기반 랜덤 폴백
                      const cardIdForDemo = selectedWorkCareerCard.id || 0;
                      const cardIconValid = selectedWorkCareerCard.icon && selectedWorkCareerCard.icon !== "-";
                      const supervisorImgValid = selectedWorkCareerCard.supervisorImg && selectedWorkCareerCard.supervisorImg !== "-";
                      const companyLogo = cardIconValid ? selectedWorkCareerCard.icon : isDemoMode ? DEMO_COMPANY_LOGOS[cardIdForDemo % DEMO_COMPANY_LOGOS.length] : "";
                      const supervisorPhoto = supervisorImgValid ? selectedWorkCareerCard.supervisorImg : isDemoMode ? DEMO_SUPERVISOR_PHOTOS[cardIdForDemo % DEMO_SUPERVISOR_PHOTOS.length] : "";
                      return (
                        <div className="workinfo-image-slot sponsor-card-slot">
                          <div className="sponsor-card">
                            {/* 1행: 기업 로고 + 기업명 */}
                            <div className="sponsor-company">
                              <div className="sponsor-company-logo">
                                {companyLogo ? (
                                  <img
                                    src={companyLogo}
                                    alt="기업 로고"
                                    onClick={(e) => handleCompanyLogoClick(e, selectedWorkCareerCard.companyHomepageUrl)}
                                    style={{ cursor: selectedWorkCareerCard.companyHomepageUrl ? "pointer" : undefined }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                      const sibling = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                                      if (sibling) sibling.style.display = "flex";
                                    }}
                                  />
                                ) : null}
                                <div className="logo-placeholder" style={{ display: companyLogo ? "none" : "flex" }}>
                                  기업
                                  <br />
                                  로고
                                </div>
                              </div>
                              <span className="sponsor-company-name">{selectedWorkCareerCard.badge || "기업명"}</span>
                            </div>

                            {/* 2~4행: 담당자 사진+라벨(같은 행) + 이름/직무 + 회사/직책 (독립 행) */}
                            <div className="sponsor-supervisor">
                              {/* 2행: 사진 좌측 + Supervised By 우측 */}
                              <div className="supervisor-row-2">
                                <div className="sponsor-supervisor-photo">
                                  {supervisorPhoto ? (
                                    <img
                                      src={supervisorPhoto}
                                      alt="담당자"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                        const sibling = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                                        if (sibling) sibling.style.display = "block";
                                      }}
                                    />
                                  ) : null}
                                  <div className="photo-placeholder" style={{ display: supervisorPhoto ? "none" : "block" }}></div>
                                </div>
                                <span className="supervisor-label">Supervised By</span>
                              </div>
                              {/* 3행: 이름 님 | 부서 */}
                              <div className="supervisor-details">
                                <span className="supervisor-name">
                                  {selectedWorkCareerCard.supervisorName || "-"}
                                  <span className="honorific"> 님</span>
                                </span>
                                <span className="supervisor-separator">|</span>
                                <span className="supervisor-dept">{selectedWorkCareerCard.supervisorDept || "-"}</span>
                              </div>
                              {/* 4행: 직책 (company 숨김, divider는 visible 유지 → x좌표 grid 일치) */}
                              <div className="supervisor-details">
                                <span className="supervisor-company-placeholder" style={{ visibility: "hidden" }}>
                                  -
                                </span>
                                <span className="supervisor-separator">|</span>
                                <span className="supervisor-position">{selectedWorkCareerCard.supervisorPosition || "-"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* 하단 정렬 행: 좌측 라인코드(.image-line-code) + 우측 라인 평점(.workcareer-grade-section).
                      flex(align-items:flex-end)로 두 요소의 하단 기준선을 일치시킨다 — absolute/margin 임시 보정 제거. */}
                  <div className="workcareer-bottom-row">
                    {/* 라인코드: 실제 개설 라인 projectCode 만 표시(하드코딩 legacy catalog 코드 미노출 — 미배정은 "-"). */}
                    <span className="line-code image-line-code">{workCareerMatchedLine?.projectCode || "-"}</span>

                    {/* 5단계: 라인 평점 — "라인 평점" 라벨 + S/A/B/C/D 등급(active 강조)만 표시.
                        점수(grade-points)/평가 상태(grade-rating-status)/강화 사유(grade-reason-note)는
                        노출 정책상 렌더하지 않는다. careerGradeInfo()는 등급 active 계산용으로만 사용. */}
                    {(() => {
                      const careerInfo = careerGradeInfo(workCareerMatchedLine, selectedWorkCareerCard);
                      return (
                        <div className="workcareer-grade-section">
                          <span className="grade-label">라인 평점</span>
                          <div className="grade-row">
                            {["S", "A", "B", "C", "D"].map((g) => (
                              <span key={g} className={`grade ${careerInfo.grade === g ? "active" : ""}`}>
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 푸터 Type B ── */}
            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <div className="modal-help-icon" title="도움말" onClick={() => setShowCareerHelpModal(true)} style={{ cursor: "pointer" }}>
                  🔎
                </div>
                <div className="modal-footer-right">
                  {!workCareerViewIsEditing ? (
                    (() => {
                      // 백엔드 단일 출처: matchedLine 만으로 버튼 활성화 판단 (legacy canEdit / empty / locked fallback 제거).
                      const careerLine = workCareerMatchedLine;
                      const lineTargetId = (careerLine?.lineTargetId as string | null | undefined) ?? null;
                      const backendEditable = careerLine?.canEdit === true && !!lineTargetId;
                      const disabled = forceEditUnlock ? false : (!backendEditable || isForeignViewer);
                      const title = !disabled
                        ? "수정"
                        : !careerLine
                        ? "개설된 라인이 없습니다."
                        : (careerLine.editReason as string | null | undefined) || "작성할 수 있는 기간이 아닙니다. 😊";
                      console.log("[cluster4-canEdit] workCareer 수정 버튼 상태", {
                        currentWeekId: weekId,
                        partType: "career",
                        careerProjectId: (selectedWorkCareerCard?.careerProjectId as string | null | undefined) ?? null,
                        projectCode: (selectedWorkCareerCard?.projectCode as string | null | undefined) ?? (selectedWorkCareerCard?.lineCode as string | null | undefined) ?? (selectedWorkCareerCard?.code as string | null | undefined) ?? null,
                        matchedLine: careerLine
                          ? { lineTargetId, canEdit: typeof careerLine.canEdit === "boolean" ? careerLine.canEdit : null, editReason: (careerLine.editReason as string | null | undefined) ?? null }
                          : null,
                        disabled,
                      });
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkCareer} disabled={disabled} aria-disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
                          수정
                        </button>
                      );
                    })()
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelWorkCareer}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetWorkCareer}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveWorkCareer}>
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="modal-footer-bottom">
                <span className={`modal-notice modal-footer-notice ${workCareerFooterNotice === "error" ? "notice-error" : ""}`} style={{ visibility: workCareerViewIsEditing ? "visible" : "hidden" }}>
                  {workCareerFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
                </span>
              </div>
            </div>
          </div>

          {/* 이미지 확대 2차 모달 */}
          {previewCareerImageUrl && (
            <div className="image-preview-overlay" onClick={() => setPreviewCareerImageUrl(null)}>
              <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
                <img src={previewCareerImageUrl} alt="확대 이미지" />
              </div>
            </div>
          )}

          {/* 도움말 모달 */}
          {showCareerHelpModal && (
            <div className="help-modal-overlay" onClick={() => setShowCareerHelpModal(false)}>
              <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="help-modal-header">
                  <div className="modal-header-top">
                    <span style={{ fontSize: "20px" }}>🔎</span>
                    <h3>도움말</h3>
                    <button className="modal-close-btn" onClick={() => setShowCareerHelpModal(false)}>
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                </div>
                <HelpModalBody helpKey="career" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 도움말 모달 (cluster2 패턴 준용) */}
      {helpModalKind && (
        <div className="help-modal-overlay" onClick={() => setHelpModalKind(null)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button className="modal-close-btn" onClick={() => setHelpModalKind(null)}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <HelpModalBody helpKey={helpModalKind} />
          </div>
        </div>
      )}
      {/* ========== 주차 리뷰 모달 (신규 — Portal) ========== */}
      {weeklyReviewModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={`section-modal-overlay ${getThemeClass(pathname)}`.trim()}>
            <div className="section-modal section-modal-weekly-review-form">
              {/* 헤더 */}
              <div className="section-modal-header">
                <button className="modal-close-btn" onClick={handleWeeklyReviewClose} aria-label="닫기">
                  <i className="ti ti-x"></i>
                </button>
                <div className="modal-header-top">
                  <img src="/images/0/write.png" alt="write" />
                  <h3>주차 리뷰</h3>
                </div>
                <p className="modal-subtitle">이번 주차에 이렇게 경험하고, 성찰하고 성장했습니다. 😊</p>
              </div>

              {/* 미드 — 3행 세로 배치 */}
              <div className="section-modal-body weekly-review-body">
                {/* 미드 1행 — 2열: 주차 정보 + 평점 */}
                <div className="weekly-review-row weekly-review-row-1">
                  {/* 1열: 주차 정보 */}
                  <div className="review-week-info">
                    <span className="week-info-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekNumberLabel(weekData.seasonType ?? weekData.seasonName, weekData.weekNumber)}` : "시즌 정보 로딩 중..."}</span>
                  </div>

                  {/* 2열: 리뷰 평점 */}
                  <div className="review-rating-section">
                    <h4>
                      ■ 리뷰 평점 <span className="required-mark">*</span>
                    </h4>
                    <div className={`rating-field ${weeklyReviewSaveAttemptFailed && weeklyReviewData.rating === 0 ? `field-error ${weeklyReviewFieldErrorFlash ? "flash" : ""}` : ""}`} style={{ flex: "1 1 0%" }} data-field="review-rating">
                      <span className="star-rating">
                        {(() => {
                          const r = weeklyReviewData.rating || 0;
                          const fullStars = Math.floor(r / 2);
                          const hasHalf = r % 2 === 1;
                          const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
                          return (
                            <>
                              {Array(fullStars)
                                .fill(0)
                                .map((_, i) => (
                                  <i key={`f${i}`} className="ti ti-star-filled" />
                                ))}
                              {hasHalf && <i className="ti ti-star-half-filled" />}
                              {Array(emptyStars)
                                .fill(0)
                                .map((_, i) => (
                                  <i key={`e${i}`} className="ti ti-star" />
                                ))}
                            </>
                          );
                        })()}
                        <span className="rating-text">{weeklyReviewData.rating || 0}/10</span>
                      </span>
                      <div className="custom-dropdown small">
                        <div ref={reviewRatingDropdownTriggerRef} className={`dropdown-selected ${!isWeeklyReviewEditing ? "disabled" : ""}`} onClick={openReviewRatingDropdown} role="button" tabIndex={isWeeklyReviewEditing ? 0 : -1} aria-haspopup="listbox" aria-expanded={reviewRatingDropdownOpen}>
                          <span>{weeklyReviewData.rating || "-"}</span>
                          <i className="ti ti-chevron-down"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 미드 2행 — 본인 인적사항 카드 (user_profiles + user_educations 실데이터) */}
                <div className="weekly-review-row weekly-review-row-2">
                  <div className="workinfo-personal-card">
                    <div className="personal-grid">
                      <div className="personal-photo">
                        <img
                          src={ownerPersonalInfo.profileImageUrl || "/images/0/crew profile/남 1.webp"}
                          alt="프로필"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>
                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{ownerInfoReady ? mask.crewName(ownerPersonalInfo.name) : <Skeleton width={60} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{ownerInfoReady ? mask.gender(ownerPersonalInfo.gender) : <Skeleton width={16} height={15} />}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{ownerInfoReady ? <>{ownerPersonalInfo.age != null ? mask.age(ownerPersonalInfo.age) : "—"} 세</> : <Skeleton width={30} height={15} />}</span>
                        </div>
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? mask.school(ownerPersonalInfo.school) : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerInfoReady ? (ownerPersonalInfo.department ? formatMajor(mask.major(ownerPersonalInfo.department)) : "—") : <Skeleton width={64} height={14} />}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.team ?? "—"}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{ownerPersonalInfo.part ?? "—"}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>
                      <div className="personal-tags">
                        <span className="tag-badge tag-role">{ownerRoleBadge}</span>
                        <span className="tag-badge tag-keyword">{ownerPersonalInfo.tagline ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 미드 3행 — 리뷰 200자 textarea */}
                <div className="weekly-review-row weekly-review-row-3">
                  <div className="review-content-section">
                    <h4>
                      ■ Weekly Review 내용 <span className="required-mark">*</span>
                      <span className="limit-hint">(최대 200자)</span>
                    </h4>
                    <div className="review-content-wrapper">
                      <textarea
                        className={`review-content-textarea ${weeklyReviewSaveAttemptFailed && weeklyReviewData.content.trim().length === 0 ? `field-error ${weeklyReviewFieldErrorFlash ? "flash" : ""}` : ""}`}
                        value={weeklyReviewData.content}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 200);
                          setWeeklyReviewData((prev) => ({ ...prev, content: v }));
                        }}
                        placeholder="이번 주차에 어떤 경험을 하셨나요? 배운 점, 느낀 점, 성장한 점을 자유롭게 작성해주세요."
                        maxLength={200}
                        disabled={!isWeeklyReviewEditing}
                        data-field="review-content"
                      />
                      <span className="char-count">{weeklyReviewData.content.length}/200</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 작업 3에서 푸터 추가 예정 */}
              {/* 푸터 Type B (reputation-form 준용) */}
              <div className="section-modal-footer">
                <div className="modal-footer-top">
                  <button type="button" className="modal-help-icon" onClick={handleWeeklyReviewHelp} aria-label="도움말">
                    🔎
                  </button>
                  <div className="modal-footer-right">
                    {!isWeeklyReviewEditing ? (
                      <button type="button" className="modal-edit-btn" onClick={handleWeeklyReviewEditClick} disabled={!isOwner} style={!isOwner ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={isOwner ? "수정" : "본인 주차 리뷰만 수정할 수 있습니다"}>
                        수정
                      </button>
                    ) : (
                      <>
                        <button type="button" className="modal-cancel-btn" onClick={handleWeeklyReviewCancel}>
                          취소
                        </button>
                        <button type="button" className="modal-reset-btn" onClick={handleWeeklyReviewReset}>
                          초기화
                        </button>
                        <button type="button" className="modal-save-btn" onClick={handleWeeklyReviewSave} disabled={weeklyReviewSaving}>
                          {weeklyReviewSaving ? "저장 중..." : "저장"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-footer-bottom">
                  <p className={`modal-footer-notice ${weeklyReviewSaveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: weeklyReviewSaveAttemptFailed ? "visible" : "hidden" }}>
                    필수 항목을 모두 입력해주세요.
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 주차 리뷰 — 평점 드롭다운 옵션 패널 (Portal) */}
      {reviewRatingDropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`dropdown-options-fixed review-rating-dropdown-options ${getThemeClass(pathname)}`.trim()}
            style={{
              position: "fixed",
              top: reviewRatingDropdownPos.top,
              left: reviewRatingDropdownPos.left,
              width: Math.max(reviewRatingDropdownPos.width, 70),
              zIndex: 100010,
            }}
            role="listbox"
            onWheel={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} className={`dropdown-option${weeklyReviewData.rating === n ? " selected" : ""}`} onClick={() => handleReviewRatingSelect(n)} role="option" aria-selected={weeklyReviewData.rating === n}>
                {n}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {/* 커스텀 별점 드롭다운 옵션 패널 — Portal (body 직속, cluster3 .dropdown-options-fixed 재사용) */}
      {ratingDropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`dropdown-options-fixed ${getThemeClass(pathname)}`.trim()}
            style={{
              position: "fixed",
              top: ratingDropdownPos.top,
              left: ratingDropdownPos.left,
              width: Math.max(ratingDropdownPos.width, 70),
              zIndex: 100010,
            }}
            role="listbox"
            onWheel={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} className={`dropdown-option${reputationEditData.rating === n ? " selected" : ""}`} onClick={() => handleRatingSelect(n)} role="option" aria-selected={reputationEditData.rating === n}>
                {n}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {/* Output Link 커스텀 툴팁 — 보기 모드 hover 시 전체 설명 표시 */}
      {olTooltip &&
        createPortal(
          <div className={`ol-custom-tooltip ${getThemeClass(pathname)}`.trim()} style={{ left: olTooltip.x, top: olTooltip.y }}>
            {olTooltip.text}
          </div>,
          document.body,
        )}

      {/* Detail Log 모달 — 빈 placeholder 컨테이너 (674×826) */}
      <DetailLogModal
        show={showDetailLogModal}
        onHide={() => setShowDetailLogModal(false)}
        data={detailLogData}
        lineEnhancement={lineEnhancement}
        onLineTabOpen={handleLineTabOpen}
        onLineRetry={handleLineRetry}
      />

      {/* Output Link 2차 모달 — Portal로 document.body에 직접 렌더링 (1차 모달 위에 뜸) */}
      {outputLinkEditModal &&
        createPortal(
          <div
            className={`output-link-edit-overlay ${getThemeClass(pathname)}`.trim()}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="output-link-edit-modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3 className="output-link-edit-title">
                <i className="ti ti-link" />
                Output Link {outputLinkEditModal.linkIdx + 1} 편집
              </h3>
              <div className="output-link-edit-field">
                <label>Output Link 주소</label>
                <input
                  type="url"
                  className="output-link-edit-input"
                  value={outputLinkEditModal.url}
                  onChange={(e) => {
                    if (e.target.value.length <= 1000) setOutputLinkEditModal((prev) => (prev ? { ...prev, url: e.target.value, error: "" } : null));
                  }}
                  placeholder="https://..."
                  maxLength={1000}
                  autoFocus
                />
                <div className="output-link-edit-field-footer">
                  <span className="char-count">{outputLinkEditModal.url.length} / 1,000</span>
                  {outputLinkEditModal.error && <span className="field-error">{outputLinkEditModal.error}</span>}
                </div>
              </div>
              <div className="output-link-edit-field">
                <label>Output Link 설명</label>
                <input
                  type="text"
                  className="output-link-edit-input"
                  value={outputLinkEditModal.desc}
                  onChange={(e) => {
                    if (e.target.value.length <= 30) setOutputLinkEditModal((prev) => (prev ? { ...prev, desc: e.target.value } : null));
                  }}
                  placeholder="링크에 대한 설명을 입력하세요"
                  maxLength={30}
                />
                <div className="output-link-edit-field-footer">
                  <span className="char-count">{outputLinkEditModal.desc.length} / 30</span>
                </div>
              </div>
              <div className="output-link-edit-buttons">
                <button type="button" className="btn-cancel" onClick={() => setOutputLinkEditModal(null)}>
                  취소
                </button>
                <button type="button" className="btn-save" onClick={saveOutputLinkEdit}>
                  저장
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Cluster4CardContent;

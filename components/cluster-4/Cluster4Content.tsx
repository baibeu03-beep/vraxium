"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";
import { useModalScroll } from "@/utils/useModalScroll";
import { usePopup } from "@/components/ui/popup";
import { supabase } from "@/lib/supabase";
import { useDataMasking } from "@/hooks/useDataMasking";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { getOrgAliasFromPathname } from "@/utils/orgLabelAlias";
import { DUMMY_SEASON_DATA, DUMMY_SEASON_HISTORIES, REVIEW_COMMENT_DEFAULT } from "@/constants/dummyData";
import { dedupedJson } from "@/lib/fetch-dedupe";
import { isPxRoute, isEcRoute, withPxRoute, getThemeClass, getOrgConfigFromPathname } from "@/lib/cluster-route";
import { formatSeasonLabel, formatSeasonWeekTitle } from "@/lib/cluster4-types";
import { isOfficialRestWeek } from "@/lib/cluster4-transition-week";
import { REPUTATION_KEYWORDS } from "@/lib/reputation-keywords";
import { isAdminEmail } from "@/lib/admin";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { appendDemoQuery } from "@/lib/appendDemoQuery";
import HelpModalBody from "@/components/shared/HelpModalBody";

// 글자수 초과 시 '..' 표시 (CSS ellipsis '…' 대신 JS 처리)
const truncate = (text: string | undefined | null, maxLen: number): string => {
  if (!text) return "-";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "..";
};

// 학과 표시값 정규화 — 라벨 "학과"와 중복/어색함 방지용 화면 표시 전용 helper.
//   원본 DTO 값은 변경하지 않고 렌더링에서만 가공한다.
//   "법무학" → "법무" (+ 학과 라벨 = "법무 학과"), "컴퓨터공학과" → "컴퓨터공학"
const formatMajor = (value: string | null | undefined): string => {
  if (!value) return "-";
  const v = value.trim(); // 원본 유지, 표시 직전 공백 제거 — "법무학 " 같은 패딩값도 suffix 매칭되게
  if (!v || v === "-") return "-";
  if (v.endsWith("학과")) return v.slice(0, -2) || "-"; // "법무학과" → "법무" (+ 학과 라벨 = "법무 학과")
  if (v.endsWith("학부")) return v.slice(0, -2) || "-"; // "소프트웨어학부" → "소프트웨어" (+ 학과 라벨)
  if (v.endsWith("학")) return v.slice(0, -1) || "-"; // "법무학" → "법무"
  return v;
};

// ──────────────────────────────────────────────────────────────────────────
// 인적사항 공통 표시 헬퍼 — Cluster4CardContent 의 resolvePersonalInfo 패턴과 동일.
// 이 화면(Cluster4Content)의 "모든" 인적사항 카드/모달이 같은 fallback 규칙으로
// (이름/성별/나이/학교/학과/팀/파트/일반·심화/프로필이미지/태그라인)을 표시하도록
// 단일 출처로 통일한다. source bag 에 가용한 모든 출처(계약 DTO / legacy alias /
// 세션 user / 시즌 역할 메타)를 넣어주면 필드별 우선순위대로 첫 "유효값"을 고른다.
// "유효값" = null/undefined/공백 및 placeholder("-"·"—") 가 아닌 값. 없으면 null.
type PersonalInfoSourceBag = {
  profile?: Record<string, any> | null; // 1순위 프로필류 (reviewer DTO / seasonReviewerProfile 등)
  user?: Record<string, any> | null; // 2순위 세션 user 류
  weeklyCardMeta?: Record<string, any> | null; // team/part alias 보강용 (시즌 역할 메타 등)
  headerExtras?: Record<string, any> | null;
  // 페이지 주인의 /api/profile data 객체(원본 snake_case alias 포함). profile/user 가 비웠을 때
  // team_name/part_name/membership_level/vision/profile_keyword 등을 마지막 source 로 채운다.
  // (seasonRoles 가 비어 팀/파트/멤버십/태그라인이 "-" 로 떨어지는 것을 방지하는 fallback.)
  fallbackProfile?: Record<string, any> | null;
};

type ResolvedPersonalInfo = {
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
  // fp = 페이지 주인 /api/profile data (snake_case alias 포함) — 각 필드의 마지막 fallback.
  const fp = sources.fallbackProfile ?? {};

  // 나이: 명시값 우선, 없으면 birthDate/birth_date 로 계산
  let age: number | string | null = pickPersonalValue(p.age, u.age, fp.age);
  if (age === null) {
    const birth = pickPersonalValue(p.birthDate, p.birth_date, u.birthDate, u.birth_date, fp.birthDate, fp.birth_date);
    if (birth) {
      const birthYear = new Date(birth).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!Number.isNaN(birthYear)) age = currentYear - birthYear;
    }
  }

  return {
    name: pickPersonalValue(
      p.name, p.displayName, p.display_name, u.displayName, u.display_name, u.name,
      fp.name, fp.displayName, fp.display_name,
    ),
    gender: pickPersonalValue(p.gender, u.gender, fp.gender),
    age,
    school: pickPersonalValue(
      p.school, p.schoolName, p.school_name, p.university, u.school, u.schoolName, u.school_name, u.university,
      fp.school, fp.schoolName, fp.school_name, fp.university,
    ),
    department: pickPersonalValue(
      p.department, p.departmentName, p.department_name, p.major, p.major1, p.major_first,
      u.department, u.departmentName, u.department_name, u.major, u.major1, u.major_first,
      fp.department, fp.departmentName, fp.department_name, fp.major, fp.major1, fp.major_first, fp.major_name_1,
    ),
    team: pickPersonalValue(
      p.team, p.teamName, p.team_name, u.team, u.teamName, u.team_name,
      p.currentTeamName, p.current_team_name, u.currentTeamName, u.current_team_name,
      meta.teamName, extras.teamName,
      fp.team, fp.teamName, fp.team_name,
    ),
    part: pickPersonalValue(
      p.part, p.partName, p.part_name, u.part, u.partName, u.part_name,
      p.currentPartName, p.current_part_name, u.currentPartName, u.current_part_name,
      meta.partName, extras.partName,
      fp.part, fp.partName, fp.part_name,
    ),
    membershipLevel: pickPersonalValue(
      p.membershipLevel, p.membership_level, u.membershipLevel, u.membership_level,
      p.role, u.role, p.status, u.status,
      fp.membershipLevel, fp.membership_level, fp.role,
    ),
    profileImageUrl: pickPersonalValue(
      p.profileImageUrl, p.profile_photo_url, p.profilePhotoUrl, p.profileImg, p.avatarUrl, p.image,
      u.profileImageUrl, u.profile_photo_url, u.profilePhotoUrl, u.profileImg, u.avatarUrl, u.image,
      fp.profileImageUrl, fp.profile_photo_url, fp.profilePhotoUrl,
    ),
    tagline: pickPersonalValue(
      p.profileTagline, p.profile_tagline, u.profileTagline, u.profile_tagline,
      p.profileKeyword, p.profile_keyword, u.profileKeyword, u.profile_keyword,
      p.nickname, u.nickname, p.vision, u.vision,
      fp.profileTagline, fp.profile_tagline, fp.profileKeyword, fp.profile_keyword, fp.vision,
    ),
  };
};

// 멤버십/역할/상태 라벨 공통 표시 헬퍼 — DB 원본값(membership_level / role 코드 / status)을
// 화면 친화적 한글 라벨로 변환한다. 모든 인적사항 카드 badge(tag-role)는 이 헬퍼만 사용한다.
//   ⚠ DB 원본은 변경하지 않으며(표시 시점에만 변환), 다음 fallback 규칙을 따른다:
//   - 값 없음(null/undefined/공백/"-"/"—")  → "-"  (하드코딩 "일반" 금지)
//   - 알 수 없는 신규 값                      → 원본값 그대로
//   - 이미 한글 라벨(일반/심화/운영진 …)        → 매핑 미스 → 원본 유지 (멱등)
const MEMBERSHIP_ROLE_LABEL_MAP: Record<string, string> = {
  // membership_level 단축값 / status
  active: "일반",
  advanced: "심화",
  agent: "심화(에이전트)",
  part_leader: "심화(파트장)",
  team_leader: "운영진(팀장)",
  ambassador: "운영진(앰배서더)",
  // role 코드 (user_role_history.role / profile.role 등) — 기존 ROLE_LABELS 통합
  crew: "일반",
  crew_regular: "일반",
  crew_normal: "일반",
  crew_advanced_agent: "심화(에이전트)",
  crew_agent: "심화(에이전트)",
  crew_advanced_part_leader: "심화(파트장)",
  crew_partleader: "심화(파트장)",
  operations_partleader: "심화(파트장)",
  admin_team_leader: "운영진(팀장)",
  crew_team_leader: "운영진(팀장)",
  operations_teamleader: "운영진(팀장)",
  admin_ambassador: "운영진(앰배서더)",
  crew_ambassador: "운영진(앰배서더)",
  operations_ambassador: "운영진(앰배서더)",
  operations_clubleader: "운영진(클럽장)",
};

const formatMembershipRoleLabel = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  const v = String(value).trim();
  if (v === "" || v === "-" || v === "—") return "-";
  // 정확 매칭 우선 → 소문자 정규화 매칭 → 그래도 없으면 원본 그대로(신규 값 보호).
  return MEMBERSHIP_ROLE_LABEL_MAP[v] ?? MEMBERSHIP_ROLE_LABEL_MAP[v.toLowerCase()] ?? v;
};

// 기본 시즌 데이터 — seasonHistories 가 비었을 때(=비-데모 API 로딩 전/무데이터) 쓰이는
//   render-safe 빈 상태(empty-state) 구조. currentSeason 이 항상 non-null 이어야 하므로
//   객체 형태는 유지하되, 모든 수치/라벨은 더미 대신 0·빈값(빈 상태)으로 둔다.
//   (이전의 '자릿수 테스트용' 더미 값은 운영 화면 fallback 더미라 제거함)
//   image 는 깨진 이미지 방지용 중립 placeholder, review 는 기본 안내 문구(guide text) 유지.
const defaultSeasonData = {
  id: "",
  year: "",
  season: "",
  dateRange: "",
  status: "",
  statusClass: "",
  image: "/images/0/cluster4/cluster4-1/image.png",
  approvedWeeks: 0,
  totalWeeks: 0,
  roleInSeason: "",
  isQualified: false,
  seasonRoles: [] as Array<{
    teamName: string | null;
    partName: string | null;
    roleLabel: string;
    isAdmin: boolean;
    adminGeneration: number | null;
    startedAt: string;
    profileImage?: string;
  }>,
  stats: { dangam: 0, injeolmi: 0, eoheung: 0 },
  rating: 0,
  review: REVIEW_COMMENT_DEFAULT,
  reviewLink: "",
  circles: {
    weekUsage: 0,
    scheduleReliability: 0,
    seasonGrowth: 0,
    approvedWeeks: 0,
    totalOperatingWeeks: 0,
    totalWeeksReliability: 0,
    reliableWeeks: 0,
    completedActivities: 0,
    totalActivities: 0,
  },
  progress: {
    info: { total: 0, completed: 0, rate: 0 },
    competency: { total: 0, completed: 0, rate: 0 },
    experience: { total: 0, completed: 0, rate: 0 },
    career: { total: 0, completed: 0, rate: 0 },
  },
};

// season_reputations.season_history_id 는 DB 에서 uuid 컬럼이다. placeholder/가짜 id
// (defaultSeasonData.id="", DUMMY_SEASON_DATA "dummy-season-1", "cluster-4-1" 등)를 실제
// season_history_id 로 전송하면 안 된다 — 저장 차단 또는 22P02 의 원인. 실제 uuid 만 통과시킨다.
const SEASON_HISTORY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealSeasonHistoryId = (id: unknown): id is string =>
  typeof id === "string" && SEASON_HISTORY_UUID_RE.test(id);

// 역할 라벨 매핑
const ROLE_LABELS: { [key: string]: string } = {
  crew: "일반",
  crew_regular: "일반",
  crew_normal: "일반",
  crew_advanced_agent: "심화(에이전트)",
  crew_agent: "심화(에이전트)",
  crew_advanced_part_leader: "심화(파트장)",
  crew_partleader: "심화(파트장)",
  operations_partleader: "심화(파트장)",
  part_leader: "심화(파트장)",
  admin_team_leader: "운영진(팀장)",
  crew_team_leader: "운영진(팀장)",
  operations_teamleader: "운영진(팀장)",
  admin_ambassador: "운영진(앰배서더)",
  crew_ambassador: "운영진(앰배서더)",
  operations_ambassador: "운영진(앰배서더)",
};

const ADMIN_ROLES = new Set([
  "admin_team_leader",
  "crew_team_leader",
  "operations_teamleader",
  "admin_ambassador",
  "crew_ambassador",
  "operations_ambassador",
]);

const isAdminRole = (role: string): boolean => ADMIN_ROLES.has(role);

const formatSeasonReputationTime = (timestamp: string | null | undefined): string => {
  if (!timestamp) return "00. 00. 00(0)  00:00";
  try {
    const d = new Date(timestamp);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const day = days[d.getDay()];
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}. ${mm}. ${dd}(${day})  ${hh}:${mi}`;
  } catch {
    return "00. 00. 00(0)  00:00";
  }
};

const Cluster4Content = () => {
  // 세션 및 본인 프로필 여부 확인
  const { data: session } = useSession();
  const { mask } = useDataMasking();
  const searchParams = useSearchParams();
  const popup = usePopup();
  // 테스트 유저(데모) 모드: admin → 고객 앱 이동 시 ?demoUserId={id} 만 붙고 userId/userID 는 비어 있다
  // (진입: /admin/test-users → /cluster-4?admin=true&demoUserId={id}).
  // Sidebar / profile API 와 동일한 우선순위 규칙으로 표시 대상을 resolve 해야
  // 상단 이력서뿐 아니라 cluster-4 본문도 테스트 유저 기준으로 로드된다.
  // 일반 로그인 사용자는 demoUserId 부재 → 기존 동작 그대로.
  const demoUserId = searchParams.get("demoUserId");
  const urlUserId =
    searchParams.get("userId") || searchParams.get("userID") || demoUserId;
  // 조회(read) API 에 붙일 demoUserId 마커 — 세션 우회가 필요한 라우트
  // (season-reputations 등)에서 세션 없이도 테스트 유저 데이터를 읽도록 한다.
  // 테스트 유저 모드가 아니면 빈 문자열(일반/admin 동작 불변).
  const demoQS = demoUserId ? `&demoUserId=${encodeURIComponent(demoUserId)}` : "";
  // 로컬 더미(localStorage demoMode)는 테스트 유저(?demoUserId=) 모드에서는 끈다 —
  // 테스트 모드는 실제 DB 를 source of truth 로 읽어야 하므로 더미가 응답을 덮으면 안 된다.
  const isDemoMode = checkDemoMode() && !demoUserId;
  // 어드민(마더) 계정은 모든 프로필 편집 가능
  // 테스트 유저(데모) 모드는 "demoUserId 유저로 로그인한 일반 고객"과 동일하게 동작해야 하므로,
  // 본인 페이지(urlUserId === demoUserId)일 때만 owner 로 취급한다. ?userId= 로 타 크루 페이지를
  // 열람 중(urlUserId !== demoUserId)이면 owner 가 아니어야 시즌 평판(= 타 크루 전용 작성)이
  // 정상 동작한다. (demoUserId 만으로 무조건 owner 처리하면 타 크루 페이지에서도 본인으로 오인해
  //  "시즌 평판은 타 크루끼리 작성합니다" 로 잘못 막혔다 — cluster-4-card isOwner 와 동일 규칙.)
  const isOwner = session?.user?.isAdmin
    || (demoUserId ? urlUserId === demoUserId : (!urlUserId || session?.user?.id === urlUserId));

  // 어드민이 다른 유저 편집 시 targetUserId를 API URL에 추가
  // (urlUserId 는 위에서 demoUserId 까지 fold-in 되어 있어 테스트 유저 모드도 동일 경로로 흐른다.)
  const apiUrl = (path: string) => {
    const separator = path.includes('?') ? '&' : '?';
    // 테스트 유저 모드면 demoUserId 부착(백엔드가 test_user_markers 검증 후 작성자/대상 고정).
    if (demoUserId) {
      return `${path}${separator}demoUserId=${encodeURIComponent(demoUserId)}`;
    }
    if (urlUserId && session?.user?.isAdmin) {
      return `${path}${separator}targetUserId=${urlUserId}`;
    }
    return path;
  };

  // 데모 모드에서 사용자별 collection-content 문구 분기용
  const [demoUserName, setDemoUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemoMode || !urlUserId) return;
    const fetchName = async () => {
      try {
        const json = await dedupedJson<any>(`/api/profile/?userId=${urlUserId}`);
        if (json) {
          const name = json.data?.display_name || null;
          setDemoUserName(name);
          // 데모 모드 사용자별 성장 상태 설정
          const demoStatusMap: Record<string, { us: string | null; gs: string | null }> = {
            전민경: { us: "graduated", gs: "졸업 완료" },
            곽예원: { us: "weekly_rest", gs: "주차 휴식 중" },
            김의환: { us: "suspended", gs: "활동 중단" },
          };
          if (name && demoStatusMap[name]) {
            setUserStatus(demoStatusMap[name].us);
            setGrowthStatus(demoStatusMap[name].gs);
          }
        }
      } catch {
        // API 실패 시 기존 더미 문구로 fallback
      }
    };
    fetchName();
  }, [isDemoMode, urlUserId]);

  const demoCollectionMessage =
    isDemoMode && demoUserName
      ? (
          {
            윤재윤: (

              <>
                현재 클럽은, <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>2026년 봄 시즌</span>을 가동 중에 있습니다.
              </>
            ),
            전민경: (
              <>
                현재 클럽은, <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>2026년 여름 시즌</span>을 준비 중인 전환 과정에 있습니다.
              </>
            ),
            곽예원: (
              <>
                현재 클럽은, <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>2026년 겨울 시즌</span>을 가동 중에 있습니다.
              </>
            ),
            김의환: (
              <>
                현재 클럽은, <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>2026년 가을 시즌</span>을 준비 중인 전환 과정에 있습니다.
              </>
            ),
          } as Record<string, React.ReactNode>
        )[demoUserName] || null
      : null;

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
    if (isDemoMode) {
      openModalFn();
      return;
    } // 더미 모드: 체크 스킵
    // 개발 모드: 비로그인 상태에서도 모달 열기 허용
    if (!session) {
      openModalFn();
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

  const router = useRouter();
  // PX 컨텍스트면 내부 cross-link 도 px 변형으로 라우팅 → phalanx 사용자가
  // weekly/season 탭을 눌러도 PX 라우트 안에 머무른다.
  // 모든 cluster navigation 은 withPxRoute(path, pathname) 으로 일관 적용.
  const pathname = usePathname();
  const isPX = isPxRoute(pathname);
  const isEC = isEcRoute(pathname);
  // 현재 조직 대표 강조색 — ORGANIZATION_CONFIG(단일 정의소). marketing #FAAB07 /
  // entertainment #FF4B70 / planning #1E9503. 인라인 분기 하드코딩 대체.
  const orgAccent = getOrgConfigFromPathname(pathname).themeColor;
  const headerRef = useRef<HTMLElement>(null);
  const [section3Page, setSection3Page] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isTextFading, setIsTextFading] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev">("next");

  // 시즌 평판 모달 상태
  const [seasonReputationModalOpen, setSeasonReputationModalOpen] = useState(false);
  const [seasonReputationEditData, setSeasonReputationEditData] = useState<{
    rating: number;
    content: string;
    keyword1: string;
    keyword2: string;
    keyword3: string;
  }>({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
  const [seasonReputationSaving, setSeasonReputationSaving] = useState(false);
  const [seasonReputationError, setSeasonReputationError] = useState<string | null>(null);

  // 별점 드롭다운 UI (season-reputation form)
  const [seasonRatingDropdownOpen, setSeasonRatingDropdownOpen] = useState(false);
  const [seasonRatingDropdownPos, setSeasonRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const seasonRatingDropdownTriggerRef = useRef<HTMLDivElement>(null);

  // 키워드 3슬롯 모드
  const [seasonKeywordModes, setSeasonKeywordModes] = useState<Array<"select" | "write" | null>>([null, null, null]);

  // 보기/편집 모드 토글
  const [isSeasonReputationFormEditing, setIsSeasonReputationFormEditing] = useState(false);
  const [seasonReputationFormSnapshot, setSeasonReputationFormSnapshot] = useState<{
    rating: number;
    content: string;
    keyword1: string;
    keyword2: string;
    keyword3: string;
  } | null>(null);
  const [seasonReputationSaveAttemptFailed, setSeasonReputationSaveAttemptFailed] = useState(false);
  const [seasonReputationFieldErrorFlash, setSeasonReputationFieldErrorFlash] = useState(false);
  // TODO: [백엔드 작업 필요] 일반 모드에서 API 응답의 canEdit 값을 setCanEditSeasonReputation으로 반영
  const [canEditSeasonReputation, setCanEditSeasonReputation] = useState(isDemoMode || !!demoUserId);
  useEffect(() => {
    // 테스트 유저(데모) 모드도 owner-승인 플래그는 통과시키고, 실제 작성기간 enforce 는
    // seasonReputationWindowOpen(= demoUserId 권한 fetch 결과)이 담당한다. demoUserId 를 빠뜨리면
    // 승인 플래그가 false 로 리셋돼 작성기간이 열려 있어도 수정 버튼이 막힌다.
    setCanEditSeasonReputation(isDemoMode || !!demoUserId);
  }, [isDemoMode, demoUserId]);
  const [seasonReputationSuccess, setSeasonReputationSuccess] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

  // 키워드 선택 중첩 모달
  const [seasonKeywordModalOpen, setSeasonKeywordModalOpen] = useState(false);
  const [seasonKeywordTargetSlot, setSeasonKeywordTargetSlot] = useState<number | null>(null);
  const [seasonKeywordTempSelection, setSeasonKeywordTempSelection] = useState<string | null>(null);

  // 도움말 모달
  const [helpModalKind, setHelpModalKind] = useState<"seasonReputation" | "seasonReview" | null>(null);

  // 평판 키워드 목록
  interface ReputationKeyword {
    id: string | number;
    cluster_number: number;
    cluster_name: string;
    cluster_color: string;
    keyword: string;
  }
  const [reputationKeywords, setReputationKeywords] = useState<ReputationKeyword[]>([]);

  // 커스텀 스크롤바 상태 (area-8: status-badges)
  const statusBadgesRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef8 = useRef<HTMLDivElement>(null);
  const [scrollThumbTop8, setScrollThumbTop8] = useState(0);
  const [isDragging8, setIsDragging8] = useState(false);
  const dragStartY8 = useRef(0);
  const dragStartScrollTop8 = useRef(0);

  // 커스텀 스크롤바 상태 (area-9: profile-cards)
  const profileCardsRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef9 = useRef<HTMLDivElement>(null);
  const [scrollThumbTop9, setScrollThumbTop9] = useState(0);
  const [isDragging9, setIsDragging9] = useState(false);
  const dragStartY9 = useRef(0);
  const dragStartScrollTop9 = useRef(0);

  // 시즌 평판 데이터 (DB에서 가져옴)
  interface SeasonReputationData {
    id: string;
    reviewer_id: string;
    target_user_id: string;
    season_history_id: string;
    rating: number;
    content: string;
    keyword_1: string | null;
    keyword_2: string | null;
    keyword_3: string | null;
    created_at: string;
    fmScore?: number;
    reviewer: {
      id: string;
      display_name: string;
      gender: string;
      birth_date: string | null;
      university: string;
      major_first: string | null;
      profile_photo_url: string | null;
      teamName: string | null;
      partName: string | null;
      vision: string | null;
    } | null;
  }
  const [seasonReputations, setSeasonReputations] = useState<SeasonReputationData[]>([]);
  const SEASON_REPUTATION_SLOT_COUNT = 7;

  const getDemoSeasonReputations = (reputations: any[]) => {
    if (searchParams.get("admin") !== "true") return reputations;

    const raw = searchParams.get("repCount");
    if (raw === null) return reputations;

    const count = Math.max(0, Math.min(reputations.length, parseInt(raw, 10) || 0));
    return reputations.slice(0, count);
  };

  const emptySeasonReputationSlotCount = Math.max(0, SEASON_REPUTATION_SLOT_COUNT - seasonReputations.length);

  const displaySeasonReputations = [
    ...seasonReputations,
    ...Array.from({ length: emptySeasonReputationSlotCount }, (_, index) => ({
      id: `season-reputation-empty-${index}`,
      isEmpty: true,
    })),
  ];

  // 시즌 평판 상세 보기 모달
  const [reputationDetailModalOpen, setReputationDetailModalOpen] = useState(false);
  const [selectedReputation, setSelectedReputation] = useState<SeasonReputationData | null>(null);

  // 어드민 평판 수정 시 사용하는 평판 ID
  const [editingReputationId, setEditingReputationId] = useState<string | null>(null);

  // 시즌 리뷰 모달 상태 (본인의 시즌 평가)
  const [seasonReviewModalOpen, setSeasonReviewModalOpen] = useState(false);
  const [seasonReviewEditData, setSeasonReviewEditData] = useState<{
    rating: number;
    review: string;
    link?: string;
  }>({ rating: 0, review: "" });
  const [seasonReviewSaving, setSeasonReviewSaving] = useState(false);
  const [seasonReviewError, setSeasonReviewError] = useState<string | null>(null);
  const [seasonReviewSuccess, setSeasonReviewSuccess] = useState(false);
  const [isSeasonReviewFormEditing, setIsSeasonReviewFormEditing] = useState(false);
  const [seasonReviewFormSnapshot, setSeasonReviewFormSnapshot] = useState<{
    rating: number;
    review: string;
  } | null>(null);
  const [seasonReviewSaveAttemptFailed, setSeasonReviewSaveAttemptFailed] = useState(false);
  const [seasonReviewFieldErrorFlash, setSeasonReviewFieldErrorFlash] = useState(false);
  const [seasonReviewRatingDropdownOpen, setSeasonReviewRatingDropdownOpen] = useState(false);
  const [seasonReviewRatingDropdownPos, setSeasonReviewRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const seasonReviewRatingDropdownTriggerRef = useRef<HTMLDivElement>(null);
  const [canEditSeasonReview, setCanEditSeasonReview] = useState(isDemoMode || !!demoUserId);
  useEffect(() => {
    // 테스트 유저(데모) 모드도 승인 플래그는 통과시키고, 실제 작성기간 enforce 는
    // seasonReviewWindowOpen(= demoUserId 권한 fetch 결과)이 담당한다. demoUserId 를 빠뜨리면
    // 승인 플래그가 false 로 리셋돼 작성기간이 열려 있어도 수정/저장이 막힌다.
    setCanEditSeasonReview(isDemoMode || !!demoUserId);
  }, [isDemoMode, demoUserId]);

  // ============================================================
  // user_edit_windows 기반 Cluster4 시즌 리뷰 작성 기간 (cluster3 패턴 재사용)
  //   resource_key: cluster4.season_review
  // 우선순위:
  //   1) isDemoMode      → 자동 허용
  //   2) admin           → 자동 허용 (마더 계정)
  //   3) dev override    → ?unlockCluster4 / ?unlockCluster4SeasonReview (DEV/QA 전용)
  //   4) permission API  → /api/edit-windows/permission?resource_key=cluster4.season_review
  // 기존 canEditSeasonReview (승인 상태 기반) 와 AND 로 결합되어 저장 시점에만 enforce.
  // 서버 PUT 도 동일 resource_key 로 enforce 되므로 dev override 는 UI 만 푼다.
  const [seasonReviewWindowOpen, setSeasonReviewWindowOpen] = useState<boolean>(isDemoMode);
  const [seasonReputationWindowOpen, setSeasonReputationWindowOpen] = useState<boolean>(isDemoMode);
  const [editWindowRefreshTick, setEditWindowRefreshTick] = useState(0);

  useEffect(() => {
    const isAdminCombined =
      !!session?.user?.isAdmin || isAdminEmail(session?.user?.email);
    const unlockAll = searchParams?.get("unlockCluster4") === "1";
    const unlockSeasonReview =
      searchParams?.get("unlockCluster4SeasonReview") === "1";

    // 테스트 유저(데모) 모드에서는 admin 우회하지 않고 테스트 유저(demoUserId)의 작성기간으로 판정.
    if (isDemoMode || (isAdminCombined && !demoUserId)) {
      setSeasonReviewWindowOpen(true);
      return;
    }

    // 테스트 유저(데모) 모드는 세션 없이도 demoUserId 기준으로 permission fetch 해야 하므로 제외.
    // 비로그인 일반 사용자(!demoUserId)는 기존처럼 fetch 생략(잠금).
    if (!session?.user && !demoUserId) {
      setSeasonReviewWindowOpen(unlockAll || unlockSeasonReview);
      return;
    }

    setSeasonReviewWindowOpen(unlockAll || unlockSeasonReview);

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.seasonReview)}`),
          { cache: "no-store" }
        );
        const result = await response.json();
        const permission = result?.data;
        if (cancelled) return;
        if (result?.success && permission && typeof permission.canEdit === "boolean") {
          setSeasonReviewWindowOpen(
            (unlockAll || unlockSeasonReview) || Boolean(permission.canEdit)
          );
        }
      } catch (error) {
        console.error("[cluster4 permission] cluster4.season_review 조회 실패", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isDemoMode,
    demoUserId,
    session?.user,
    session?.user?.isAdmin,
    session?.user?.email,
    searchParams,
    editWindowRefreshTick,
  ]);
  // ============================================================

  // ============================================================
  // user_edit_windows 기반 Cluster4 시즌 평판 작성 기간 (season_review 패턴 그대로)
  //   resource_key: cluster4.season_reputation
  // 우선순위:
  //   1) isDemoMode      → 자동 허용
  //   2) admin           → 자동 허용
  //   3) dev override    → ?unlockCluster4 / ?unlockCluster4SeasonReputation (DEV/QA 전용, UI 만)
  //   4) permission API  → /api/edit-windows/permission?resource_key=cluster4.season_reputation
  // 기존 canEditSeasonReputation (승인 상태 기반) 와 AND 로 결합되어 저장 시점에만 enforce.
  // 서버 POST/PUT 도 동일 resource_key 로 enforce 되며, 서버는 dev override 를 인정하지 않는다.
  useEffect(() => {
    const isAdminCombined =
      !!session?.user?.isAdmin || isAdminEmail(session?.user?.email);
    const unlockAll = searchParams?.get("unlockCluster4") === "1";
    const unlockSeasonReputation =
      searchParams?.get("unlockCluster4SeasonReputation") === "1";

    // 테스트 유저(데모) 모드에서는 admin 우회하지 않고 테스트 유저(demoUserId)의 작성기간으로 판정.
    if (isDemoMode || (isAdminCombined && !demoUserId)) {
      setSeasonReputationWindowOpen(true);
      return;
    }

    // 테스트 유저(데모) 모드는 세션 없이도 demoUserId 기준으로 permission fetch 해야 하므로 제외.
    // 비로그인 일반 사용자(!demoUserId)는 기존처럼 fetch 생략(잠금).
    if (!session?.user && !demoUserId) {
      setSeasonReputationWindowOpen(unlockAll || unlockSeasonReputation);
      return;
    }

    setSeasonReputationWindowOpen(unlockAll || unlockSeasonReputation);

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/edit-windows/permission?resource_key=${encodeURIComponent(CLUSTER4_EDIT_RESOURCE_KEYS.seasonReputation)}`),
          { cache: "no-store" }
        );
        const result = await response.json();
        const permission = result?.data;
        if (cancelled) return;
        if (result?.success && permission && typeof permission.canEdit === "boolean") {
          setSeasonReputationWindowOpen(
            (unlockAll || unlockSeasonReputation) || Boolean(permission.canEdit)
          );
        }
      } catch (error) {
        console.error("[cluster4 permission] cluster4.season_reputation 조회 실패", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isDemoMode,
    demoUserId,
    session?.user,
    session?.user?.isAdmin,
    session?.user?.email,
    searchParams,
    editWindowRefreshTick,
  ]);
  // ============================================================

  // 일반 모드 백엔드 승인 상태 → canEditSeasonReputation / canEditSeasonReview 일괄 반영
  // 어드민(마더) 계정은 승인 체크를 건너뛰고 항상 편집 가능
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드는 위 useEffect들이 true로 셋업
    // 테스트 유저(데모) 모드: canEditSeason* 는 init 에서 owner 기준 활성. 세션/승인 기반 override 금지
    // (실제 작성기간은 seasonReputationWindowOpen / seasonReviewWindowOpen = demoUserId 권한으로 판정).
    if (demoUserId) return;
    if (session?.user?.isAdmin) {
      setCanEditSeasonReputation(true);
      setCanEditSeasonReview(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const approved = await checkApprovalStatus();
      if (cancelled) return;
      setCanEditSeasonReputation(approved);
      setCanEditSeasonReview(approved);
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, session]);

  // season-reputation view 모달 핸들러
  const handleSeasonReputationViewClose = async () => {
    setReputationDetailModalOpen(false);
    setSelectedReputation(null);
  };

  // 시즌 평판 삭제 핸들러 (본인 작성분만 — API는 reviewer_id 검증)
  const handleDeleteSeasonReputation = async () => {
    if (!selectedReputation?.id) return;
    if (!(await popup.confirm("이 평판을 삭제하시겠습니까?"))) return;

    const targetId = selectedReputation.id;

    // UI 즉시 반영 (로컬 state filter)
    setSeasonReputations((prev) => prev.filter((r) => r.id !== targetId));
    handleSeasonReputationViewClose();

    // 일반 모드: 백엔드 DELETE 호출 (데모 모드는 로컬만)
    if (!isDemoMode) {
      try {
        const res = await fetch(apiUrl(`/api/season-reputations?id=${encodeURIComponent(targetId)}`), {
          method: "DELETE",
        });
        if (!res.ok) {
          console.error("시즌 평판 삭제 API 실패:", await res.text());
          await popup.alert("삭제 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.");
        }
      } catch (err) {
        console.error("시즌 평판 삭제 네트워크 오류:", err);
        await popup.alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // season-reputation 검증 함수
  const isSeasonReputationValid = (): boolean => {
    const k1 = seasonReputationEditData.keyword1?.trim() || "";
    const k2 = seasonReputationEditData.keyword2?.trim() || "";
    const k3 = seasonReputationEditData.keyword3?.trim() || "";
    const keywords = [k1, k2, k3];
    const duplicateKeywords = keywords.filter((keyword, index) => keyword && keywords.indexOf(keyword) !== index);
    const fieldResults = [
      {
        field: "rating",
        value: seasonReputationEditData.rating,
        valid: !!seasonReputationEditData.rating && seasonReputationEditData.rating >= 1,
        reason: "rating must be selected",
      },
      {
        field: "content",
        value: seasonReputationEditData.content,
        valid: !!seasonReputationEditData.content?.trim(),
        reason: "content must not be empty",
      },
      ...keywords.map((keyword, index) => ({
        field: `keyword${index + 1}`,
        value: keyword,
        mode: seasonKeywordModes[index],
        valid: keyword.length > 0 && keyword.length <= 10 && !duplicateKeywords.includes(keyword),
        reason: keyword.length === 0 ? "keyword is required" : keyword.length > 10 ? "keyword must be 10 characters or less" : duplicateKeywords.includes(keyword) ? "keyword must be unique" : "ok",
      })),
    ];
    const invalidFields = fieldResults.filter((result) => !result.valid);

    if (invalidFields.length > 0) {
      return false;
    }

    return true;
  };

  const isSeasonReputationDirty = (): boolean => {
    if (!seasonReputationFormSnapshot) {
      return seasonReputationEditData.rating > 0 || (seasonReputationEditData.content?.trim().length || 0) > 0 || (seasonReputationEditData.keyword1?.length || 0) > 0 || (seasonReputationEditData.keyword2?.length || 0) > 0 || (seasonReputationEditData.keyword3?.length || 0) > 0;
    }
    return (
      seasonReputationEditData.rating !== seasonReputationFormSnapshot.rating ||
      seasonReputationEditData.content !== seasonReputationFormSnapshot.content ||
      seasonReputationEditData.keyword1 !== seasonReputationFormSnapshot.keyword1 ||
      seasonReputationEditData.keyword2 !== seasonReputationFormSnapshot.keyword2 ||
      seasonReputationEditData.keyword3 !== seasonReputationFormSnapshot.keyword3
    );
  };

  // season-reputation form 핸들러
  const handleSeasonReputationEditClick = async () => {
    if (!canEditSeasonReputation) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    if (!isDemoMode && !seasonReputationWindowOpen) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    setSeasonReputationFormSnapshot({
      rating: seasonReputationEditData.rating,
      content: seasonReputationEditData.content,
      keyword1: seasonReputationEditData.keyword1,
      keyword2: seasonReputationEditData.keyword2,
      keyword3: seasonReputationEditData.keyword3,
    });
    setSeasonReputationSaveAttemptFailed(false);
    setSeasonReputationFieldErrorFlash(false);
    setIsSeasonReputationFormEditing(true);
  };

  const openSeasonRatingDropdown = () => {
    if (!isSeasonReputationFormEditing) return;
    if (seasonRatingDropdownOpen) {
      setSeasonRatingDropdownOpen(false);
      return;
    }
    const trigger = seasonRatingDropdownTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setSeasonRatingDropdownPos(getFixedDropdownPosition(rect, 4));
    setSeasonRatingDropdownOpen(true);
  };

  const handleSeasonRatingSelect = (value: number) => {
    setSeasonReputationEditData((prev) => ({ ...prev, rating: value }));
    setSeasonRatingDropdownOpen(false);
  };

  const handleSeasonKeywordModeChange = async (slotIndex: number, mode: "select" | "write") => {
    if (!isSeasonReputationFormEditing) return;

    if (mode === "write") {
      if (!(await popup.confirm("키워드를 직접 작성하시겠습니까?"))) return;
      setSeasonReputationEditData((prev) => {
        const next = { ...prev };
        if (slotIndex === 0) next.keyword1 = "";
        else if (slotIndex === 1) next.keyword2 = "";
        else if (slotIndex === 2) next.keyword3 = "";
        return next;
      });
      setSeasonKeywordModes((prev) => {
        const next = [...prev];
        next[slotIndex] = "write";
        return next;
      });
      return;
    }

    if (mode === "select") {
      setSeasonKeywordTargetSlot(slotIndex);
      setSeasonKeywordTempSelection(null);
      setSeasonKeywordModalOpen(true);
      return;
    }
  };

  // 키워드 중첩 모달 핸들러
  const handleSeasonKeywordTempSelect = (keyword: string) => {
    setSeasonKeywordTempSelection(keyword);
  };

  const handleSeasonKeywordSelectConfirm = async () => {
    if (!seasonKeywordTempSelection) {
      await popup.alert("키워드를 먼저 선택해주세요.");
      return;
    }
    if (!(await popup.confirm(`'${seasonKeywordTempSelection}' 을 선택하시겠습니까?`))) return;
    const slotIndex = seasonKeywordTargetSlot;
    if (slotIndex === null) return;
    setSeasonReputationEditData((prev) => {
      const next = { ...prev };
      if (slotIndex === 0) next.keyword1 = seasonKeywordTempSelection;
      else if (slotIndex === 1) next.keyword2 = seasonKeywordTempSelection;
      else if (slotIndex === 2) next.keyword3 = seasonKeywordTempSelection;
      return next;
    });
    setSeasonKeywordModes((prev) => {
      const next = [...prev];
      next[slotIndex] = "select";
      return next;
    });
    setSeasonKeywordModalOpen(false);
    setSeasonKeywordTargetSlot(null);
    setSeasonKeywordTempSelection(null);
  };

  const handleSeasonKeywordModalClose = () => {
    setSeasonKeywordModalOpen(false);
    setSeasonKeywordTargetSlot(null);
    setSeasonKeywordTempSelection(null);
  };

  const getSeasonKeywordsUsedByOtherSlots = (currentSlot: number): string[] => {
    const used: string[] = [];
    if (currentSlot !== 0 && seasonReputationEditData.keyword1) used.push(seasonReputationEditData.keyword1);
    if (currentSlot !== 1 && seasonReputationEditData.keyword2) used.push(seasonReputationEditData.keyword2);
    if (currentSlot !== 2 && seasonReputationEditData.keyword3) used.push(seasonReputationEditData.keyword3);
    return used;
  };

  const handleSeasonKeywordWrite = (slotIndex: number, value: string) => {
    if (!isSeasonReputationFormEditing) return;
    const v = value.slice(0, 10);
    setSeasonReputationEditData((prev) => {
      const next = { ...prev };
      if (slotIndex === 0) next.keyword1 = v;
      else if (slotIndex === 1) next.keyword2 = v;
      else if (slotIndex === 2) next.keyword3 = v;
      return next;
    });
  };

  const handleSeasonReputationFormClose = async () => {
    if (isSeasonReputationFormEditing && isSeasonReputationDirty()) {
      if (!(await popup.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?"))) return;
    }
    setSeasonReputationModalOpen(false);
    setIsSeasonReputationFormEditing(false);
    setSeasonReputationFormSnapshot(null);
    setSeasonReputationSaveAttemptFailed(false);
    setSeasonReputationFieldErrorFlash(false);
  };

  const handleSeasonReputationCancel = async () => {
    if (isSeasonReputationDirty()) {
      if (!(await popup.confirm("작성 중인 내용이 있습니다. 취소하시겠습니까?"))) return;
    }
    if (seasonReputationFormSnapshot) {
      setSeasonReputationEditData({ rating: seasonReputationFormSnapshot.rating, content: seasonReputationFormSnapshot.content, keyword1: seasonReputationFormSnapshot.keyword1, keyword2: seasonReputationFormSnapshot.keyword2, keyword3: seasonReputationFormSnapshot.keyword3 });
    } else {
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
    }
    setSeasonKeywordModes([null, null, null]);
    setIsSeasonReputationFormEditing(false);
    setSeasonReputationSaveAttemptFailed(false);
    setSeasonReputationFieldErrorFlash(false);
    setSeasonReputationFormSnapshot(null);
  };

  const handleSeasonReputationReset = async () => {
    if (!isDemoMode && !canEditSeasonReputation) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!isDemoMode && !seasonReputationWindowOpen) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    if (!(await popup.confirm("작성 내용을 초기 상태로 되돌리시겠습니까?"))) return;
    if (seasonReputationFormSnapshot) {
      setSeasonReputationEditData({ rating: seasonReputationFormSnapshot.rating, content: seasonReputationFormSnapshot.content, keyword1: seasonReputationFormSnapshot.keyword1, keyword2: seasonReputationFormSnapshot.keyword2, keyword3: seasonReputationFormSnapshot.keyword3 });
    } else {
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
    }
    setSeasonKeywordModes([null, null, null]);
    setSeasonReputationSaveAttemptFailed(false);
    setSeasonReputationFieldErrorFlash(false);
  };

  // season-reputation 저장 API
  const saveSeasonReputation = async (): Promise<{ id: string; created_at: string; updated_at?: string } | null> => {
    const isUpdate = !!selectedReputation?.id;

    if (isDemoMode) {
      const now = new Date().toISOString();
      if (isUpdate && selectedReputation) {
        return { id: selectedReputation.id, created_at: selectedReputation.created_at || now, updated_at: now };
      }
      return { id: `demo-season-reputation-${Date.now()}`, created_at: now };
    }

    try {
      const endpoint = apiUrl("/api/season-reputations");
      const method = isUpdate ? "PUT" : "POST";

      // 평판 대상(targetUserId) = 현재 열람 중인 타 크루 페이지의 user_id.
      //   urlUserId = ?userId= / ?userID= / demoUserId (page owner). 로그인 본인이 아니라
      //   "지금 보고 있는 크루"의 user_id 가 들어가야 한다.
      const targetUserId = urlUserId || undefined;

      // 시즌(seasonHistoryId) = 실제 season_history uuid 만 채택.
      //   우선순위: 선택된 시즌 → 현재 시즌 → 현재 페이지 row → 첫 row.
      //   defaultSeasonData(id="")·dummy·"cluster-4-1" 같은 가짜 id 는 isRealSeasonHistoryId 가 걸러
      //   currentSeason 이 아직 로딩 전(빈 fallback)이라도 seasonHistories 의 진짜 row 로 교정된다.
      const seasonHistoryId: string | undefined = [
        selectedSeasonId,
        currentSeason?.id,
        seasonHistories[section3Page]?.id,
        seasonHistories[0]?.id,
      ].find(isRealSeasonHistoryId);

      // [진단] 저장 직전 상태 — 요청된 5개 값 출력.
      console.log("[season-reputation POST] resolved body fields", {
        currentSeason,
        selectedSeasonId,
        seasonHistories,
        resolvedSeasonHistoryId: seasonHistoryId,
        targetUserId,
        currentSeasonId: currentSeason?.id,
        section3Page,
        reviewerId: session?.user?.id ?? null,
        demoUserId,
        rating: seasonReputationEditData.rating,
        content: seasonReputationEditData.content.trim(),
        keywords: [
          seasonReputationEditData.keyword1.trim(),
          seasonReputationEditData.keyword2.trim(),
          seasonReputationEditData.keyword3.trim(),
        ],
      });

      // 저장 직전 방어 — 신규 작성(POST)에서 대상/시즌이 비면 API 호출하지 않고 중단.
      // 어떤 값이 비었는지 console.warn 으로 명시.
      if (!isUpdate && (!targetUserId || !seasonHistoryId)) {
        const missing = [
          !targetUserId ? "targetUserId(urlUserId)" : null,
          !seasonHistoryId ? "seasonHistoryId(uuid 없음: selectedSeasonId/currentSeason/seasonHistories 모두 placeholder)" : null,
        ].filter(Boolean);
        console.warn("[season-reputation POST] 저장 중단 — 필수 값 누락:", missing.join(", "), {
          targetUserId,
          seasonHistoryId,
          selectedSeasonId,
          currentSeasonId: currentSeason?.id,
          seasonHistoriesIds: seasonHistories.map((s) => s?.id),
          urlUserId,
        });
        throw new Error("평판 대상 또는 시즌 정보가 없어 저장할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
      }

      const body = isUpdate
        ? {
            id: selectedReputation!.id,
            rating: seasonReputationEditData.rating,
            content: seasonReputationEditData.content.trim(),
            keyword1: seasonReputationEditData.keyword1.trim(),
            keyword2: seasonReputationEditData.keyword2.trim(),
            keyword3: seasonReputationEditData.keyword3.trim(),
          }
        : {
            targetUserId,
            seasonHistoryId,
            rating: seasonReputationEditData.rating,
            content: seasonReputationEditData.content.trim(),
            keyword1: seasonReputationEditData.keyword1.trim(),
            keyword2: seasonReputationEditData.keyword2.trim(),
            keyword3: seasonReputationEditData.keyword3.trim(),
          };
      const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        console.error("[season-reputation] API 실패:", res.status, errBody);
        // 서버가 내려준 메시지를 그대로 throw — handleSeasonReputationSave 가 alert 로 표시.
        // 우선순위: message (사용자용 친절 문구) → error (코드/짧은 사유) → 폴백.
        const serverMessage =
          (errBody && (errBody.message || errBody.error)) ||
          `저장 실패 (HTTP ${res.status})`;
        throw new Error(serverMessage);
      }
      const data = await res.json();
      const saved = data.data || data;
      return { id: saved.id || (isUpdate ? selectedReputation!.id : undefined), created_at: saved.created_at, updated_at: saved.updated_at };
    } catch (err) {
      console.error("[season-reputation] API 예외:", err);
      // 위 throw 또는 진짜 네트워크 예외를 그대로 위로 던져 caller 가 메시지 표시.
      throw err;
    }
  };

  const handleSeasonReputationSave = async () => {
    // [임시 진단 — 작성 차단 원인 파악용. 원인 확정 후 제거 예정]
    // 콘솔에서 다음 6 필드 확인:
    //   canEditSeasonReputation (= checkApprovalStatus 결과 또는 admin/demo)
    //   seasonReputationWindowOpen (= /api/edit-windows/permission cluster4.season_reputation)
    //   isOwner (true 면 자기리뷰 → 사실상 모달 진입 자체가 막혀 있어야 함)
    //   alreadySubmitted (true 면 prefill 된 수정 모드)
    //   selectedSeasonId / currentSeasonId (어느 시즌에 작성 중인지)
    //   urlUserId (타깃 user_id)
    console.debug("[season-reputation save] guard snapshot", {
      isDemoMode,
      canEditSeasonReputation,
      seasonReputationWindowOpen,
      isOwner,
      alreadySubmitted: !!selectedReputation?.id,
      selectedSeasonId,
      currentSeasonId: currentSeason?.id,
      urlUserId,
      sessionUserId: session?.user?.id,
      isAdmin: !!session?.user?.isAdmin,
    });
    if (!isDemoMode && !canEditSeasonReputation) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!isDemoMode && !seasonReputationWindowOpen) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    if (!isSeasonReputationValid()) {
      setSeasonReputationSaveAttemptFailed(true);
      setSeasonReputationFieldErrorFlash(true);
      setTimeout(() => setSeasonReputationFieldErrorFlash(false), 600);
      const k1 = seasonReputationEditData.keyword1?.trim() || "";
      const k2 = seasonReputationEditData.keyword2?.trim() || "";
      const k3 = seasonReputationEditData.keyword3?.trim() || "";
      if (k1 && k2 && k3 && (k1 === k2 || k1 === k3 || k2 === k3)) {
        await popup.alert("키워드 3개는 모두 다른 값이어야 합니다.");
      }
      return;
    }

    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;

    // TODO: 1주 보내기 10개 제한 — sentSeasonReputations state + 백엔드 카운트 API 도입 후 활성화
    // const isUpdate = !!selectedReputation?.id;
    // if (!isUpdate && sentThisWeekCount >= 10) {
    //   alert('이번 주에 보낼 수 있는 시즌 평판은 최대 10개입니다.');
    //   return;
    // }

    setSeasonReputationSaving(true);
    try {
      const savedRecord = await saveSeasonReputation();
      if (!savedRecord) {
        // saveSeasonReputation 이 실패하면 throw 하므로 정상적으로는 이 분기 도달 X.
        // 방어적으로 남겨두되 메시지는 일반 폴백.
        await popup.alert("저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      // 저장 직후 평판 목록 새로고침 — 카드 0개/카운트가 즉시 반영되도록
      const targetId = urlUserId || session?.user?.id;
      if (targetId && (selectedSeasonId || currentSeason?.id)) {
        await fetchSeasonReputations(targetId, selectedSeasonId || currentSeason.id);
      }
      await popup.alert("저장되었습니다.");
      setSeasonReputationModalOpen(false);
    } catch (err) {
      console.error("[season-reputation] 저장 실패:", err);
      // 서버가 내려준 메시지(EDIT_WINDOW_CLOSED 인 경우 EDIT_WINDOW_LOCKED_MESSAGE,
      // 그 외엔 한글 사유 등)를 사용자에게 그대로 표시.
      const message =
        err instanceof Error && err.message
          ? err.message
          : "저장 중 오류가 발생했습니다.";
      await popup.alert(message);
    } finally {
      setSeasonReputationSaving(false);
    }
  };

  // 모달 닫을 때 state 리셋 (마운트 시 실행 방지)
  const prevSeasonReputationModalOpen = useRef(seasonReputationModalOpen);
  useEffect(() => {
    if (prevSeasonReputationModalOpen.current && !seasonReputationModalOpen) {
      setIsSeasonReputationFormEditing(false);
      setSeasonReputationFormSnapshot(null);
      setSeasonReputationSaveAttemptFailed(false);
      setSeasonReputationFieldErrorFlash(false);
      setSeasonKeywordModes([null, null, null]);
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
      setSelectedReputation(null);
    }
    prevSeasonReputationModalOpen.current = seasonReputationModalOpen;
  }, [seasonReputationModalOpen]);

  useEffect(() => {
    if (!seasonRatingDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".form-rating-section .dropdown-selected") && !target.closest(".season-rating-dropdown-options")) {
        setSeasonRatingDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSeasonRatingDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [seasonRatingDropdownOpen]);

  useEffect(() => {
    if (!seasonReviewRatingDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".season-review-rating-section .dropdown-selected") && !target.closest(".season-review-rating-dropdown-options")) {
        setSeasonReviewRatingDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSeasonReviewRatingDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [seasonReviewRatingDropdownOpen]);

  useEffect(() => {
    if (seasonReviewModalOpen) return;
    setIsSeasonReviewFormEditing(false);
    setSeasonReviewFormSnapshot(null);
    setSeasonReviewSaveAttemptFailed(false);
    setSeasonReviewFieldErrorFlash(false);
    setSeasonReviewRatingDropdownOpen(false);
  }, [seasonReviewModalOpen]);

  // 모달 열릴 때 배경 스크롤 잠금
  const anyModalOpen = seasonReputationModalOpen || reputationDetailModalOpen || seasonReviewModalOpen || seasonKeywordModalOpen;
  useModalScroll(anyModalOpen);

  // 활동 통계 (주차 성장률)
  const [activityStats, setActivityStats] = useState<{
    info: { total: number; success: number };
    competency: { total: number; success: number };
    experience: { total: number; success: number };
    career: { total: number; success: number };
  }>({
    info: { total: 0, success: 0 },
    competency: { total: 0, success: 0 },
    experience: { total: 0, success: 0 },
    career: { total: 0, success: 0 },
  });

  // 현재 시즌 정보 상태 (DB에서 가져옴)
  const [currentSeasonInfo, setCurrentSeasonInfo] = useState<{
    year: number;
    name: string;
    seasonLabel?: string | null;
    seasonType?: string | null;
    currentWeek: number;
    isClubBreak: boolean;
    holidayName: string | null;
    isBreakSeason: boolean;
    fromSeason: string | null;
    toSeason: string | null;
  } | null>(
    isDemoMode
      ? {
          year: 2026,
          name: "겨울",
          currentWeek: 8,
          isClubBreak: false,
          holidayName: null,
          isBreakSeason: true,
          fromSeason: "겨울",
          toSeason: "봄",
        }
      : null,
  );

  // 사용자의 상태 (status, growth_status)
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [growthStatus, setGrowthStatus] = useState<string | null>(null);
  // user_profiles.role 기본값 (역할 이력이 없을 때 사용)
  const [userDefaultRole, setUserDefaultRole] = useState<string | null>(null);

  // 시즌 리뷰 모달 인적사항 카드용 프로필 (페이지 주인 기준 — urlUserId 우선, 없으면 본인)
  const [seasonReviewerProfile, setSeasonReviewerProfile] = useState<{
    displayName: string;
    profilePhotoUrl: string;
    gender: string;
    age: number | null;
    school: string;
    major: string;
    vision: string;
  }>({ displayName: "", profilePhotoUrl: "", gender: "", age: null, school: "", major: "", vision: "" });

  // 페이지 주인 인적사항 원본 — /api/profile 의 data 객체(team_name/part_name/membership_level/vision 등 alias 포함).
  // resolvePersonalInfo 의 fallbackProfile 로 넘겨, seasonRoles 가 비어도 팀/파트/멤버십/태그라인이 "-" 로
  // 떨어지지 않게 한다. (인적사항 모달/카드의 단일 fallback source — weeklyGrowth.data 는 시즌/성장 전용이라 사용 X.)
  const [ownerProfileData, setOwnerProfileData] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (isDemoMode) return;
    const targetId = urlUserId || session?.user?.id;
    if (!targetId) return;
    let cancelled = false;
    // urlUserId 없을 때는 fetchUserStatus 효과와 동일한 캐시 키(`/api/profile/`)를 사용하여 중복 네트워크 호출 방지
    const profileUrl = urlUserId ? `/api/profile/?userId=${urlUserId}` : "/api/profile/";
    (async () => {
      try {
        const [profileJson, eduJson] = await Promise.all([
          dedupedJson<any>(profileUrl).catch(() => null),
          dedupedJson<any>(`/api/educations?userId=${targetId}`).catch(() => null),
        ]);
        if (cancelled) return;

        const p = profileJson?.data;
        const eduFirst = Array.isArray(eduJson?.data) && eduJson.data.length > 0 ? eduJson.data[0] : null;

        // 인적사항 fallback source — /api/profile data 원본 그대로 보관(팀/파트/멤버십/태그라인 alias 포함).
        setOwnerProfileData(p ?? null);

        let age: number | null = null;
        if (p?.birth_date) {
          const birthYear = new Date(p.birth_date).getFullYear();
          const currentYear = new Date().getFullYear();
          if (!Number.isNaN(birthYear)) age = currentYear - birthYear;
        }

        setSeasonReviewerProfile({
          displayName: p?.display_name || "",
          profilePhotoUrl: p?.profile_photo_url || "",
          gender: p?.gender || "",
          age,
          school: eduFirst?.school || "",
          major: eduFirst?.major1 && eduFirst.major1 !== "-" ? eduFirst.major1 : "",
          vision: p?.vision || "",
        });
      } catch {
        // 무시 — 기존 fallback 유지
      }
    })();
    return () => { cancelled = true; };
  }, [isDemoMode, urlUserId, session?.user?.id]);

  // 성장 종료 정보
  // 운영 데이터: /api/profile 응답으로 채워진다. 로딩 전에는 null →
  //   화면은 "-" 빈 상태를 렌더(`growthEndInfo ? ... : ...`, `?? "-"`). 더미 초기값 금지.
  const [growthEndInfo, setGrowthEndInfo] = useState<{
    year: number | null;
    seasonName: string | null;
    weekNumber: number | null;
    isBreak?: boolean;
  } | null>(null);

  // 성장 시작 정보 — /api/profile 로딩 전 null (빈 상태), 더미 초기값 금지.
  const [growthStartInfo, setGrowthStartInfo] = useState<{
    year: number | null;
    seasonName: string | null;
    weekNumber: number | null;
    isBreak?: boolean;
  } | null>(null);

  // 성장 기간 통계 (시즌 기반) — /api/profile 로딩 전 null (빈 상태), 더미 초기값 금지.
  const [growthPeriodStats, setGrowthPeriodStats] = useState<{
    availableSeasons: number;
    approvedSeasons: number;
    restSeasons: number;
  } | null>(null);

  // 시즌 역할 이력 타입
  interface SeasonRoleItem {
    teamName: string | null;
    partName: string | null;
    roleLabel: string;
    isAdmin: boolean; // 운영진(팀장, 앰배서더) 여부
    adminGeneration: number | null; // 운영진 기수 (예: 3, 4)
    startedAt: string;
    profileImage?: string;
  }

  // 시즌 히스토리 (API에서 가져온 동적 데이터)
  interface SeasonHistoryData {
    id: string;
    year: string;
    season: string;
    dateRange: string;
    status: string;
    statusClass: string;
    image: string;
    approvedWeeks: number;
    totalWeeks: number;
    roleInSeason: string;
    // Qualified 승인 상태 (Part, Team, Cluv, Supervise 4개 도장)
    isQualified: boolean;
    // 시즌 상태 (역할/팀/파트 이력)
    seasonRoles?: SeasonRoleItem[];
    // 하드코딩 데이터와 호환을 위한 기본값 필드
    stats: { dangam: number; injeolmi: number; eoheung: number };
    rating: number;
    review: string;
    circles: {
      weekUsage: number;
      scheduleReliability: number;
      seasonGrowth: number;
      // 실제 값 표시용 추가 데이터
      approvedWeeks?: number;
      totalOperatingWeeks?: number;
      totalWeeksReliability?: number; // 일정 신뢰도 분모 (자릿수 테스트용)
      reliableWeeks?: number;
      completedActivities?: number;
      totalActivities?: number;
    };
    progress: {
      info: { total: number; completed: number; rate: number };
      competency: { total: number; completed: number; rate: number };
      experience: { total: number; completed: number; rate: number };
      career: { total: number; completed: number; rate: number };
    };
  }
  const [seasonHistories, setSeasonHistories] = useState<SeasonHistoryData[]>([]);

  // area-6-circles 단일 출처 = weekly-cards 스냅샷(snapshot-only). /api/profile 의 legacy 실시간
  // 계산(seasonStats)을 더 이상 쓰지 않고, admin Cluster4 스냅샷에서 현재 시즌 단위로 집계된
  // areaSixCircles 를 그대로 표시한다. demoUserId/일반 모드 모두 동일 DTO(같은 라우트·같은 파생 함수).
  //   weekUsage = 주차 활용도 / scheduleReliability = 일정 신뢰도 / seasonGrowth = 시즌 성장률.
  //   availableWeeks(e) = 분모 / approvedWeeks(a) / reliableWeeks(a+c).
  //   availableLines = 전체 가용 라인 / completedLines = 이행 라인.
  // 로딩 전/조회 실패 시 null → 화면은 0 으로 렌더(legacy 값으로 폴백하지 않음 — snapshot SoT 유지).
  const [snapshotCircles, setSnapshotCircles] = useState<{
    weekUsage: number;
    approvedWeeks: number;
    scheduleReliability: number;
    reliableWeeks: number;
    availableWeeks: number;
    seasonGrowth: number;
    completedLines: number;
    availableLines: number;
  } | null>(null);

  // area-7-progress 단일 출처 = 동일 weekly-cards 스냅샷(snapshot-only). 백엔드 seasonAreaProgress
  // (실무 정보/경험/역량/경력 시즌 누적 강화율)를 그대로 표시한다. 프론트 재계산/legacy seasonStats 미사용.
  //   각 항목: { key, label, rate(=round(earned/total*100)), total, earned }. 로딩 전/실패 시 null → 0 렌더.
  const [snapshotAreaProgress, setSnapshotAreaProgress] = useState<Array<{
    key: string;
    label: string;
    rate: number;
    total: number;
    earned: number;
  }> | null>(null);

  // weekly-cards 스냅샷에서 area-6-circles(현재 시즌 집계) 로드. 일반/데모 동일 라우트.
  //   URL 규칙(기존 /api/profile 패턴과 동일):
  //     urlUserId 있으면 ?userId=...(+demoUserId 마커) / 없으면 본인 세션.
  //   urlUserId 는 demoUserId 를 fold-in 하므로 데모 본인 페이지도 userId=demoUserId&demoUserId=...
  //   형태가 되어 백엔드 demo 경로(세션 우회)로 흐른다.
  useEffect(() => {
    let cancelled = false;
    const qs = urlUserId
      ? `?userId=${encodeURIComponent(urlUserId)}${demoQS}`
      : "";
    (async () => {
      try {
        const json = await dedupedJson<{
          success?: boolean;
          areaSixCircles?: {
            weekUsage: number;
            approvedWeeks: number;
            scheduleReliability: number;
            reliableWeeks: number;
            availableWeeks: number;
            seasonGrowth: number;
            completedLines: number;
            availableLines: number;
          } | null;
          seasonAreaProgress?: Array<{
            key: string;
            label: string;
            rate: number;
            total: number;
            earned: number;
          }> | null;
        }>(`/api/cluster4/weekly-cards${qs}`).catch(() => null);
        if (cancelled) return;
        const c = json?.areaSixCircles ?? null;
        setSnapshotCircles(
          c
            ? {
                weekUsage: c.weekUsage ?? 0,
                approvedWeeks: c.approvedWeeks ?? 0,
                scheduleReliability: c.scheduleReliability ?? 0,
                reliableWeeks: c.reliableWeeks ?? 0,
                availableWeeks: c.availableWeeks ?? 0,
                seasonGrowth: c.seasonGrowth ?? 0,
                completedLines: c.completedLines ?? 0,
                availableLines: c.availableLines ?? 0,
              }
            : null,
        );
        // area-7-progress — 동일 응답의 seasonAreaProgress 그대로 저장(snapshot SoT).
        const ap = Array.isArray(json?.seasonAreaProgress) ? json!.seasonAreaProgress! : null;
        setSnapshotAreaProgress(ap);
      } catch {
        if (!cancelled) {
          setSnapshotCircles(null);
          setSnapshotAreaProgress(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlUserId, demoQS]);

  // area-6-circles 표시값 — 스냅샷 로드 전/실패 시 0 세트(snapshot SoT, legacy 폴백 금지).
  const circlesView = snapshotCircles ?? {
    weekUsage: 0,
    approvedWeeks: 0,
    scheduleReliability: 0,
    reliableWeeks: 0,
    availableWeeks: 0,
    seasonGrowth: 0,
    completedLines: 0,
    availableLines: 0,
  };

  // area-7-progress 표시값 — 백엔드 seasonAreaProgress(key 기준) 를 4허브로 매핑.
  //   스냅샷 로드 전/항목 없음 → 0 fallback (rate/total/completed 전부 0, snapshot SoT 유지).
  //   front 의 .completed 는 DTO 의 earned(이행 라인 수)에 대응.
  const progressView = (() => {
    const zero = { rate: 0, total: 0, completed: 0 };
    const pick = (key: string) => {
      const item = (snapshotAreaProgress ?? []).find((x) => x.key === key);
      return item
        ? { rate: item.rate ?? 0, total: item.total ?? 0, completed: item.earned ?? 0 }
        : zero;
    };
    return {
      info: pick("practical_info"),
      experience: pick("practical_experience"),
      competency: pick("practical_competency"),
      career: pick("practical_career"),
    };
  })();

  // 역할 이력 데이터
  const [userRoleHistory, setUserRoleHistory] = useState<
    Array<{
      id: string;
      user_id: string;
      role: string;
      started_at: string;
      ended_at: string | null;
    }>
  >([]);

  // 팀/파트 이력 데이터
  const [userTeamParts, setUserTeamParts] = useState<
    Array<{
      user_id: string;
      team_id: string;
      part_id: string;
      joined_at: string;
      left_at: string | null;
    }>
  >([]);

  // 팀/파트 목록
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [parts, setParts] = useState<Array<{ id: string; name: string; team_id: string }>>([]);

  // 메인 프로필 사진
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>("/images/0/cluster4/cluster4-1/이안0.png");

  // 진입 화면 시즌 정보(area-1-title) / 시즌 누적 포인트(area-4-stats) — 서버 산출 DTO.
  // GET /api/cluster4/weekly-growth → data.seasonSummary / data.seasonPointSummary.
  // 프론트 계산 없이 그대로 표시(전환주차 제외는 백엔드 처리). 없으면 area-1="-", area-4=0.
  interface SeasonPointSummaryDto {
    star: number;
    shield: number;
    lightning: number;
  }
  interface SeasonSummaryDto {
    seasonKey?: string;
    year: number | null;
    seasonName: string;
    seasonCode: string;
    displayTitle: string;
    dateRangeLabel: string | null;
    status: string; // "active" | "ended" | "rest"
    seasonResult?: string; // "success" | "failed" | "none"
    statusLabel: string;
    startDate: string | null;
    endDate: string | null;
    pointSummary?: SeasonPointSummaryDto;
  }
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummaryDto | null>(null);
  const [seasonPointSummary, setSeasonPointSummary] = useState<SeasonPointSummaryDto | null>(null);
  // 시즌별 요약 배열(페이지네이션) — section3Page index 로 선택. 비면 단일 seasonSummary fallback.
  const [seasonSummaries, setSeasonSummaries] = useState<SeasonSummaryDto[]>([]);

  // area-8-season-status DTO — GET /api/cluster4/weekly-growth → data.seasonActivityStatuses.
  // 백엔드가 팀/파트/역할 라벨을 완성해서 내려준다. 프론트는 그대로 표시만 한다(재계산 금지).
  // 백엔드는 user_team_parts/user_role_history 부재 시 user_memberships/user_profiles.role
  // fallback 으로 최소 1개를 내려줄 수 있으므로 1개만 와도 정상 표시한다.
  interface SeasonActivityStatusDto {
    teamLabel: string;
    partLabel: string;
    statusLabel: string;
  }
  const [seasonActivityStatuses, setSeasonActivityStatuses] = useState<SeasonActivityStatusDto[]>([]);

  // status-badge 텍스트 — 아래 4종만 노출. active→진행 중, ended+success→성공,
  // ended+failed→중단, rest(전환/휴식/오프시즌)→휴식. ("진행중/종료/예정" 표기 금지)
  const seasonStatusText = (s: SeasonSummaryDto | null): string => {
    if (!s) return "-";
    if (s.status === "rest") return "시즌 휴식";
    if (s.status === "ended") {
      if (s.seasonResult === "success") return "시즌 성공";
      if (s.seasonResult === "failed") return "시즌 중단";
      return "시즌 휴식";
    }
    return "시즌 진행 중"; // active 및 기타
  };

  // 위 4종 → 기존 status-badge className 매핑(스타일 유지).
  const seasonStatusClass = (s: SeasonSummaryDto | null): string => {
    if (!s) return "in-progress";
    if (s.status === "rest") return "resting";
    if (s.status === "ended") {
      if (s.seasonResult === "success") return "completed";
      if (s.seasonResult === "failed") return "suspended";
      return "resting";
    }
    return "in-progress";
  };

  // seasonSummary.startDate/endDate("YYYY-MM-DD") → "YYYY / MM / DD (요일)".
  // 요일은 TZ 영향 없도록 UTC 기준으로 계산(서버/클라 시간대 무관 동일 결과).
  const SEASON_DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const formatSeasonDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(dateStr);
    const [, y, mo, d] = m;
    const dow = SEASON_DOW[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
    return `${y} / ${mo} / ${d} (${dow})`;
  };
  // 페이지네이션으로 선택된 시즌 — section3Page index 로 seasonSummaries[index] 선택.
  // seasonSummaries 가 비면(다른 환경/무데이터) 단일 현재-시즌 seasonSummary 로 fallback.
  const selectedSeasonSummary: SeasonSummaryDto | null =
    seasonSummaries.length > 0
      ? (seasonSummaries[section3Page] ?? seasonSummaries[0])
      : seasonSummary;
  // 선택 시즌의 누적 포인트(area-4-stats). seasonSummaries 항목은 pointSummary 동봉.
  const selectedPointSummary: SeasonPointSummaryDto | null =
    seasonSummaries.length > 0
      ? ((seasonSummaries[section3Page] ?? seasonSummaries[0])?.pointSummary ?? null)
      : seasonPointSummary;
  // 페이지네이션 소스 — 시즌별 요약이 있으면 그 길이만큼 페이지, 없으면 기존 seasonHistories.
  const seasonPages: Array<unknown> = seasonSummaries.length > 0 ? seasonSummaries : seasonHistories;

  // 진입 화면 날짜 범위 — startDate/endDate 우선(위 포맷), 둘 다 없을 때만 dateRangeLabel fallback.
  const seasonDateRangeText = selectedSeasonSummary?.startDate && selectedSeasonSummary?.endDate
    ? `${formatSeasonDate(selectedSeasonSummary.startDate)} - ${formatSeasonDate(selectedSeasonSummary.endDate)}`
    : (selectedSeasonSummary?.dateRangeLabel || "-");

  // 현재 선택된 시즌 데이터 (데모 모드 → seasonHistories 페이지네이션 우선, 없으면 기본 데이터)
  const currentSeason: SeasonHistoryData = isDemoMode
    ? seasonHistories.length > 0
      ? seasonHistories[section3Page] || seasonHistories[0]
      : (DUMMY_SEASON_DATA as unknown as SeasonHistoryData)
    : seasonHistories.length > 0
      ? seasonHistories[section3Page] || seasonHistories[0]
      : (defaultSeasonData as SeasonHistoryData);

  // area-8-season-status 표시 소스 — 우선순위:
  //   1) 백엔드 seasonActivityStatuses(DTO) — 현재 weekly-growth 라우트는 미제공이라 보통 비어 있음.
  //   2) currentSeason.seasonRoles 패스스루 — 로컬 더미(isDemoMode) 및 역할이력이 채워진 경우.
  //   3) /api/profile data(ownerProfileData) 기반 최소 1행 — user_team_parts/user_role_history 부재 환경 fallback.
  //   4) 빈 배열 → placeholder.
  // (프론트에서 역할/팀/파트를 재계산하지 않는다. profile fallback 은 이미 존재하는 team/part/membership 값을 표시만.)
  const seasonActivityStatusItems: SeasonActivityStatusDto[] = (() => {
    // 1) 백엔드 DTO
    if (seasonActivityStatuses.length > 0) return seasonActivityStatuses;
    // 2) seasonRoles 패스스루(이미 계산된 값 → DTO 모양 rename)
    const fromRoles = (currentSeason.seasonRoles || []).map((r) => ({
      teamLabel: r.isAdmin ? `운영진(${r.adminGeneration ?? ""}기)` : (r.teamName || "-"),
      partLabel: r.isAdmin ? "클럽 단위" : (r.partName || "-"),
      statusLabel: r.roleLabel || "-",
    }));
    if (fromRoles.length > 0) return fromRoles;
    // 3) /api/profile data 기반 최소 1행 fallback (팀/파트/멤버십 중 하나라도 의미값이 있을 때)
    const fp = ownerProfileData;
    if (fp) {
      const teamLabel = fp.team || fp.teamName || fp.team_name || null;
      const partLabel = fp.part || fp.partName || fp.part_name || null;
      const statusLabel = formatMembershipRoleLabel(
        fp.membershipLevel || fp.membership_level || fp.role || null,
      );
      const hasMeaning =
        (teamLabel && teamLabel !== "-") || (partLabel && partLabel !== "-") || (statusLabel && statusLabel !== "-");
      if (hasMeaning) {
        return [{ teamLabel: teamLabel || "-", partLabel: partLabel || "-", statusLabel: statusLabel || "-" }];
      }
    }
    // 4) placeholder
    return [];
  })();

  // 진입 화면 시즌 정보/누적 포인트 — GET /api/cluster4/weekly-growth (data.seasonSummary / data.seasonPointSummary).
  // 일반 모드(세션) + demoUserId 테스트 모드(urlUserId=demoUserId) 동일 경로. 로컬 더미(isDemoMode)만 스킵.
  useEffect(() => {
    if (isDemoMode) return; // 로컬 더미 모드는 API 호출 스킵(기존 패턴)
    const abortController = new AbortController();
    const fetchSeasonGrowth = async () => {
      const uid = urlUserId || session?.user?.id;
      if (!uid) return;
      try {
        const res = await fetch(
          `/api/cluster4/weekly-growth?userId=${encodeURIComponent(uid)}${demoQS}`,
          { signal: abortController.signal },
        );
        if (!res.ok) {
          console.warn("[cluster4/weekly-growth] non-OK", res.status);
          return;
        }
        const json = await res.json();
        if (abortController.signal.aborted) return;
        // 백엔드 DTO 그대로 반영(프론트 계산 X). 없으면 null → area-1 "-", area-4 0.
        setSeasonSummary(json?.data?.seasonSummary ?? null);
        setSeasonPointSummary(json?.data?.seasonPointSummary ?? null);
        setSeasonSummaries(Array.isArray(json?.data?.seasonSummaries) ? json.data.seasonSummaries : []);
        // area-8-season-status — 백엔드 DTO 그대로(teamLabel/partLabel/statusLabel). 없으면 [].
        setSeasonActivityStatuses(Array.isArray(json?.data?.seasonActivityStatuses) ? json.data.seasonActivityStatuses : []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[cluster4/weekly-growth] 시즌 요약 로드 오류:", err);
      }
    };
    fetchSeasonGrowth();
    return () => abortController.abort();
  }, [urlUserId, session?.user?.id]);

  // 현재 시즌 정보 가져오기
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    const fetchCurrentSeason = async () => {
      const today = new Date().toISOString().split("T")[0];

      // 현재 주차 정보 가져오기 (신규 schema: is_official_rest + season_key → season_definitions)
      const { data: currentWeekData, error: currentWeekError } = await supabase
        .from("weeks")
        .select("id, week_number, is_official_rest, holiday_name, season_key, season_definitions(season_key, season_type, season_label, year)")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (currentWeekError) {
        console.error("주차 데이터 로드 오류:", {
          query: "weeks select id,week_number,is_official_rest,holiday_name,season_key,season_definitions(season_key,season_type,season_label,year) where start_date<=today and end_date>=today",
          message: currentWeekError.message,
          error: currentWeekError,
        });
        return;
      }

      if (currentWeekData) {
        // 시즌 이름 변환 (spring -> 봄, summer -> 여름, fall -> 가을, winter -> 겨울)
        const seasonNameMap: { [key: string]: string } = {
          spring: "봄",
          summer: "여름",
          fall: "가을",
          winter: "겨울",
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonData = currentWeekData.season_definitions as any;
        const rawSeasonName = seasonData?.season_type || "";

        // break 시즌인지 확인 (예: spring_summer_break, fall_winter_break)
        const isBreakSeason = rawSeasonName.toLowerCase().includes("break");
        let fromSeason: string | null = null;
        let toSeason: string | null = null;
        let displayName = seasonNameMap[rawSeasonName] || rawSeasonName;

        if (isBreakSeason) {
          // break 시즌 이름 파싱 (spring_summer_break -> 봄, 여름)
          const parts = rawSeasonName.replace("_break", "").split("_");
          if (parts.length >= 2) {
            fromSeason = seasonNameMap[parts[0]] || parts[0];
            toSeason = seasonNameMap[parts[1]] || parts[1];
          }
          displayName = "시즌 전환";
        }

        setCurrentSeasonInfo({
          year: seasonData?.year || 0,
          name: displayName,
          seasonLabel: seasonData?.season_label || null,
          seasonType: seasonData?.season_type || rawSeasonName || null,
          currentWeek: currentWeekData.week_number,
          // 전환 주차(봄·가을 17주차 / 여름·겨울 9주차)는 휴식(공식)으로 계산·표시하지 않는다.
          isClubBreak: isOfficialRestWeek(rawSeasonName, currentWeekData.week_number, currentWeekData.is_official_rest || false),
          holidayName: currentWeekData.holiday_name || null,
          isBreakSeason,
          fromSeason,
          toSeason,
        });
      }
    };

    fetchCurrentSeason();
  }, []);

  // 활동 통계 가져오기 (현재 주차 기준)
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    const fetchActivityStats = async () => {
      if (!session?.user?.id && !urlUserId) return;

      const today = new Date().toISOString().split("T")[0];
      const targetUserId = urlUserId || session?.user?.id;

      // 1. 현재 주차 정보 가져오기 (신규 schema: season_key → season_definitions)
      const { data: currentWeekData, error: currentWeekError } = await supabase
        .from("weeks")
        .select("id, end_date, week_number, season_key, season_definitions(season_key, season_type, season_label, year)")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (currentWeekError) {
        console.error("활동 통계용 주차 데이터 로드 오류:", {
          query: "weeks select id,end_date,week_number,season_key,season_definitions(season_key,season_type,season_label,year) where start_date<=today and end_date>=today",
          message: currentWeekError.message,
          error: currentWeekError,
        });
        return;
      }

      if (!currentWeekData) return;

      const weekId = currentWeekData.id;

      // 2. activity_types 정보 가져오기 (eligible 조건 + 라인명 — 매니징 라인 역할 분기에 사용)
      const { data: activityTypesData } = await supabase.from("activity_types").select("id, cluster_id, name, eligible_min_approved_weeks, eligible_max_approved_weeks, count_once_in_total").eq("is_active", true);

      if (!activityTypesData) return;

      // cluster-4-card와 동일한 하드코딩 리스트 사용
      const infoTypeIds = ["calendar", "essay", "forum", "infodesk", "session", "wisdom", "etc_a"];
      const competencyTypeIds: string[] = [];
      const experienceTypeIds: string[] = [];
      const careerTypeIds: string[] = [];
      type ExperienceTypeInfo = {
        id: string;
        name: string;
        eligible_min_approved_weeks: number | null;
        eligible_max_approved_weeks: number | null;
        count_once_in_total: boolean | null;
      };
      const experienceInfos: ExperienceTypeInfo[] = [];

      activityTypesData.forEach((at) => {
        if (at.cluster_id === "practical_competency") {
          competencyTypeIds.push(at.id);
        } else if (at.cluster_id === "practical_experience") {
          experienceTypeIds.push(at.id);
          experienceInfos.push({
            id: at.id,
            name: at.name || "",
            eligible_min_approved_weeks: at.eligible_min_approved_weeks,
            eligible_max_approved_weeks: at.eligible_max_approved_weeks,
            count_once_in_total: at.count_once_in_total,
          });
        } else if (at.cluster_id === "practical_career") {
          careerTypeIds.push(at.id);
        }
      });

      // 3. weekly_activities 가져오기 (열린 활동)
      const { data: activitiesData } = await supabase
        .from("weekly_activities")
        .select("activity_type_id, is_active, opened_at, deadline")
        .eq("week_id", weekId);

      if (!activitiesData) return;

      const activeActivities = activitiesData.filter((a) => a.is_active);

      // 4. 프로필 API에서 activity_records, activity_details 가져오기
      const profileResult = await dedupedJson<any>(urlUserId ? `/api/users/${urlUserId}` : "/api/profile").catch(() => null);
      if (!profileResult || profileResult.error) return;
      const apiActivityRecords = profileResult.activityRecords || [];
      const apiActivityDetails = profileResult.activityDetails || [];
      const onboardingWeekId = profileResult.onboardingWeekId || null;

      // 온보딩 주차 여부 확인
      const isOnboardingWeek = weekId === onboardingWeekId;

      // 5. 누적 성공 주차 수 계산 (user_week_statuses SoT 기반)
      const { data: successStatusData } = await supabase.from("user_week_statuses").select("week_start_date").eq("user_id", targetUserId).eq("status", "success");
      const successStartDates = (successStatusData || []).map((s: any) => s.week_start_date).filter(Boolean);
      const { data: successWeeksJoined } = successStartDates.length > 0
        ? await supabase.from("weeks").select("id, start_date, end_date").in("start_date", successStartDates)
        : { data: [] };

      const userStartDateForCum = profileResult.growthInfo?.startDate || '1900-01-01';
      let currentCumulativeApproved = 0;
      if (successWeeksJoined && successWeeksJoined.length > 0) {
        currentCumulativeApproved = successWeeksJoined.filter((sw: any) => {
          return sw.end_date && sw.end_date <= currentWeekData.end_date && sw.end_date >= userStartDateForCum;
        }).length;
      }
      // 온보딩 주차도 누적에 포함 (user_week_statuses에 없는 경우)
      if (onboardingWeekId) {
        const onboardingAlreadyCounted = successWeeksJoined?.some((sw: any) => sw.id === onboardingWeekId);
        if (!onboardingAlreadyCounted) {
          const { data: onboardingWeekInfo } = await supabase.from("weeks").select("end_date").eq("id", onboardingWeekId).maybeSingle();
          if (onboardingWeekInfo && onboardingWeekInfo.end_date <= currentWeekData.end_date) {
            currentCumulativeApproved += 1;
          }
        }
      }

      // 6. 유저의 모든 완료 활동 저장 (experience eligible - count_once_in_total 체크용)
      const allCompletedActivities = apiActivityRecords
        .filter((ar: { is_completed: boolean }) => ar.is_completed)
        .map((ar: { week_id: string; activity_type_id: string }) => ({
          week_id: ar.week_id,
          activity_type_id: ar.activity_type_id,
        }));

      // 해당 주차의 approved activity_type_id 목록
      const weekApprovedActivities = apiActivityRecords.filter((ar: { week_id: string; is_completed: boolean }) => ar.week_id === weekId && ar.is_completed);
      const approvedActivityTypes = new Set<string>(weekApprovedActivities.map((a: { activity_type_id: string }) => a.activity_type_id));

      // 해당 주차의 activity_details
      const filteredActivityDetails = apiActivityDetails.filter((ad: { week_id: string }) => ad.week_id === weekId);

      // 7. 각 클러스터별 통계 계산
      const calcStats = (typeIds: string[]) => {
        const total = activeActivities.filter((a) => typeIds.includes(a.activity_type_id)).length;
        const now = Date.now();

        const success = activeActivities.filter((a) => {
          if (!typeIds.includes(a.activity_type_id)) return false;
          if (!approvedActivityTypes.has(a.activity_type_id)) return false;

          // 2차 정보 확인
          const detail = filteredActivityDetails.find((d: { activity_type_id: string }) => d.activity_type_id === a.activity_type_id);
          const hasSecondaryInfo = detail && ((detail.sub_title && detail.sub_title.trim() !== "") || (detail.output_links && detail.output_links.some((link: { url?: string }) => link?.url && link.url.trim() !== "")));

          if (hasSecondaryInfo) return true;

          // 마감 시간 경과 확인 (deadline 컬럼 우선, 없으면 opened_at+48h 폴백)
          if (a.deadline) {
            if (now >= new Date(a.deadline).getTime()) return true;
          } else if (a.opened_at) {
            const openedTime = new Date(a.opened_at).getTime();
            if (now - openedTime >= 48 * 60 * 60 * 1000) return true;
          }

          return false;
        }).length;

        return { total, success };
      };

      // 8. 실무 경험 eligible 조건 체크 (cluster-4-card와 동일한 로직)
      // eligible_min/max 룰 적용 시점: 2026년 봄 시즌 9주차부터
      const weekSeasonData = (currentWeekData as any)?.seasons;
      const isEligibilityRuleActive = weekSeasonData && (
        weekSeasonData.year > 2026 ||
        (weekSeasonData.year === 2026 && weekSeasonData.name !== 'spring') ||
        (weekSeasonData.year === 2026 && weekSeasonData.name === 'spring' && (currentWeekData as any).week_number >= 9)
      );

      // 매니징 라인 역할 분기 — 라인명에 _파트장/_에이전트 표기.
      // 사용자 역할과 라인이 안 맞으면 '해당 없음' 처리해야 함 (이행 기록이 없을 때만).
      const apiUserRoleHistory = profileResult.userRoleHistory || [];
      const userRoleForWeek = apiUserRoleHistory.find((urh: any) => {
        const startedAt = new Date(urh.started_at);
        const endedAt = urh.ended_at ? new Date(urh.ended_at) : null;
        const weekStart = new Date((currentWeekData as any).start_date);
        return startedAt <= weekStart && (!endedAt || endedAt > weekStart);
      });
      const userRole = userRoleForWeek?.role || profileResult.data?.role || "";
      const isLineForOtherRole = (lineName: string): boolean => {
        if (!lineName) return false;
        if (lineName.includes("파트장")) {
          return !userRole.includes("partleader") && !userRole.includes("part_leader");
        }
        if (lineName.includes("에이전트")) {
          return !userRole.includes("agent");
        }
        return false;
      };
      const hasRecordForType = (activityTypeId: string): boolean => {
        return apiActivityRecords.some((ar: { week_id: string; activity_type_id: string }) => ar.week_id === weekId && ar.activity_type_id === activityTypeId);
      };

      const calcExperienceStats = () => {
        let experienceTotal = 0;
        const experienceActivities = activeActivities.filter((a) => experienceTypeIds.includes(a.activity_type_id));

        experienceActivities.forEach((a) => {
          const typeInfo = experienceInfos.find((info) => info.id === a.activity_type_id);

          // 매니징 라인 역할 분기: 사용자 역할과 안 맞으면 카운트 제외 (이행 기록 있으면 폴백)
          if (typeInfo && isLineForOtherRole(typeInfo.name) && !hasRecordForType(a.activity_type_id)) {
            return;
          }

          if (!typeInfo) {
            experienceTotal++; // 정보가 없으면 기본 포함
            return;
          }

          if (isEligibilityRuleActive) {
            // eligible_min/max 체크 (null이면 제한 없음)
            const minWeek = typeInfo.eligible_min_approved_weeks ?? 1;
            const maxWeek = typeInfo.eligible_max_approved_weeks ?? 999;

            // 누적 주차가 eligible 범위 내인지 확인 (범위 밖이어도 이행 기록 있으면 폴백)
            const inRange = currentCumulativeApproved >= minWeek && currentCumulativeApproved <= maxWeek;
            if (!inRange && !hasRecordForType(a.activity_type_id)) {
              return;
            }

            if (inRange && typeInfo.count_once_in_total) {
              // 이미 이전 주차에서 완료했는지 확인
              const previouslyCompleted = allCompletedActivities.some(
                (ca: { week_id: string; activity_type_id: string }) => ca.activity_type_id === a.activity_type_id && ca.week_id !== weekId
              );
              if (!previouslyCompleted) {
                experienceTotal++;
              }
            } else {
              experienceTotal++;
            }
          } else {
            // 룰 적용 이전: 모든 실무 경험 활동 카운트 (단, 역할 미스매치는 위에서 이미 제외됨)
            experienceTotal++;
          }
        });

        // success 계산 (강화 성공 기준: is_completed + (마감 경과 OR 2차 정보 기입))
        const now = Date.now();

        const experienceSuccess = experienceActivities.filter((a) => {
          // 역할 미스매치 + 이행 기록 없음 → 카운트 제외
          const typeInfo = experienceInfos.find((info) => info.id === a.activity_type_id);
          if (typeInfo && isLineForOtherRole(typeInfo.name) && !hasRecordForType(a.activity_type_id)) {
            return false;
          }

          if (!approvedActivityTypes.has(a.activity_type_id)) return false;

          // 2차 정보 확인
          const detail = filteredActivityDetails.find((d: { activity_type_id: string }) => d.activity_type_id === a.activity_type_id);
          const hasSecondaryInfo = detail && ((detail.sub_title && detail.sub_title.trim() !== "") || (detail.output_links && detail.output_links.some((link: { url?: string }) => link?.url && link.url.trim() !== "")));

          if (hasSecondaryInfo) return true;

          // 마감 시간 경과 확인 (deadline 컬럼 우선, 없으면 opened_at+48h 폴백)
          if (a.deadline) {
            if (now >= new Date(a.deadline).getTime()) return true;
          } else if (a.opened_at) {
            const openedTime = new Date(a.opened_at).getTime();
            if (now - openedTime >= 48 * 60 * 60 * 1000) return true;
          }

          return false;
        }).length;

        return { total: experienceTotal, success: experienceSuccess };
      };

      // 온보딩 주차도 정상 계산 (팀/파트 + 강화 성공/실패 표시)
      {
        const infoStats = calcStats(infoTypeIds);
        const competencyStats = calcStats(competencyTypeIds);
        const experienceStats = calcExperienceStats(); // eligible 조건 적용
        const careerStats = calcStats(careerTypeIds);

        setActivityStats({
          info: infoStats,
          // 실무 역량: 항상 total=1 (매주 최대 1개 선택 가능)
          competency: { total: 1, success: Math.min(competencyStats.success, 1) },
          experience: experienceStats,
          career: careerStats,
        });
      }
    };

    fetchActivityStats();
  }, [session?.user?.id, urlUserId]);

  // 사용자 프로필에서 status, growth_status, growthEndInfo, growthStartInfo, growthPeriodStats, role 가져오기
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    const fetchUserStatus = async () => {
      try {
        // urlUserId가 있으면 해당 사용자, 없으면 본인 프로필 조회
        if (urlUserId) {
          const json = await dedupedJson<any>(`/api/profile/?userId=${urlUserId}`).catch(() => null);
          if (json) {
            setUserStatus(json.growthInfo?.status || null);
            setGrowthStatus(json.growthInfo?.growthStatus || null);
            // user_profiles.role 기본값 저장
            if (json.data?.role) {
              setUserDefaultRole(json.data.role);
            }
            // 성장 시작 정보 설정
            if (json.growthInfo?.startWeekInfo) {
              setGrowthStartInfo({
                year: json.growthInfo.startWeekInfo.year,
                seasonName: json.growthInfo.startWeekInfo.seasonName,
                weekNumber: json.growthInfo.startWeekInfo.weekNumber,
                isBreak: json.growthInfo.startWeekInfo.isBreak,
              });
            } else {
              setGrowthStartInfo(null);
            }
            // 성장 종료 정보 설정
            if (json.growthInfo?.endWeekInfo) {
              setGrowthEndInfo({
                year: json.growthInfo.endWeekInfo.year,
                seasonName: json.growthInfo.endWeekInfo.seasonName,
                weekNumber: json.growthInfo.endWeekInfo.weekNumber,
                isBreak: json.growthInfo.endWeekInfo.isBreak,
              });
            } else {
              setGrowthEndInfo(null);
            }
            // 성장 기간 통계 설정
            if (json.growthPeriodStats) {
              setGrowthPeriodStats({
                availableSeasons: json.growthPeriodStats.availableSeasons ?? 0,
                approvedSeasons: json.growthPeriodStats.approvedSeasons ?? 0,
                restSeasons: json.growthPeriodStats.restSeasons ?? 0,
              });
            }
            // 시즌 히스토리 설정
            if (json.seasonHistories && json.seasonHistories.length > 0) {
              const formattedSeasons = formatSeasonHistories(json.seasonHistories, json.userRoleHistory || [], json.userTeamParts || [], json.teams || [], json.parts || []);
              setSeasonHistories(formattedSeasons);
            }
            // 역할/팀/파트 이력 설정
            if (json.userRoleHistory) setUserRoleHistory(json.userRoleHistory);
            if (json.userTeamParts) setUserTeamParts(json.userTeamParts);
            if (json.teams) setTeams(json.teams);
            if (json.parts) setParts(json.parts);
            // 메인 프로필 사진 설정
            if (json.data?.profile_photo_url) setProfilePhotoUrl(json.data.profile_photo_url);
          }
        } else if (session?.user?.id) {
          const json = await dedupedJson<any>("/api/profile/").catch(() => null);
          if (json) {
            setUserStatus(json.growthInfo?.status || null);
            setGrowthStatus(json.growthInfo?.growthStatus || null);
            // user_profiles.role 기본값 저장
            if (json.data?.role) {
              setUserDefaultRole(json.data.role);
            }
            // 성장 시작 정보 설정
            if (json.growthInfo?.startWeekInfo) {
              setGrowthStartInfo({
                year: json.growthInfo.startWeekInfo.year,
                seasonName: json.growthInfo.startWeekInfo.seasonName,
                weekNumber: json.growthInfo.startWeekInfo.weekNumber,
                isBreak: json.growthInfo.startWeekInfo.isBreak,
              });
            } else {
              setGrowthStartInfo(null);
            }
            // 성장 종료 정보 설정
            if (json.growthInfo?.endWeekInfo) {
              setGrowthEndInfo({
                year: json.growthInfo.endWeekInfo.year,
                seasonName: json.growthInfo.endWeekInfo.seasonName,
                weekNumber: json.growthInfo.endWeekInfo.weekNumber,
                isBreak: json.growthInfo.endWeekInfo.isBreak,
              });
            } else {
              setGrowthEndInfo(null);
            }
            // 성장 기간 통계 설정
            if (json.growthPeriodStats) {
              setGrowthPeriodStats({
                availableSeasons: json.growthPeriodStats.availableSeasons ?? 0,
                approvedSeasons: json.growthPeriodStats.approvedSeasons ?? 0,
                restSeasons: json.growthPeriodStats.restSeasons ?? 0,
              });
            }
            // 시즌 히스토리 설정
            if (json.seasonHistories && json.seasonHistories.length > 0) {
              const formattedSeasons = formatSeasonHistories(json.seasonHistories, json.userRoleHistory || [], json.userTeamParts || [], json.teams || [], json.parts || []);
              setSeasonHistories(formattedSeasons);
            }
            // 역할/팀/파트 이력 설정
            if (json.userRoleHistory) setUserRoleHistory(json.userRoleHistory);
            if (json.userTeamParts) setUserTeamParts(json.userTeamParts);
            if (json.teams) setTeams(json.teams);
            if (json.parts) setParts(json.parts);
            // 메인 프로필 사진 설정
            if (json.data?.profile_photo_url) setProfilePhotoUrl(json.data.profile_photo_url);
          }
        }
      } catch (error) {
        console.error("Error fetching user status:", error);
      }
    };

    fetchUserStatus();
  }, [urlUserId, session?.user?.id]);

  // 시즌 평판 데이터 가져오기 함수
  const fetchSeasonReputations = async (targetId: string, seasonHistoryId: string) => {
    // UUID 형식이 아니면 (예: defaultSeasonData.id="dummy-season-1") API 호출 스킵 — DB 컬럼이 uuid 타입이라 22P02 발생
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(seasonHistoryId)) {
      setSeasonReputations([]);
      return;
    }
    try {
      const res = await fetch(`/api/season-reputations?targetUserId=${targetId}&seasonHistoryId=${seasonHistoryId}${demoQS}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSeasonReputations(json.data);
        }
      }
    } catch (error) {
      console.error("Error fetching season reputations:", error);
    }
  };

  // 평판 키워드 목록 가져오기
  const fetchReputationKeywords = async () => {
    try {
      const res = await fetch("/api/reputation-keywords");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setReputationKeywords(json.data);
        }
      }
    } catch (error) {
      console.error("Error fetching reputation keywords:", error);
    }
  };

  // 컴포넌트 마운트 시 키워드 목록 가져오기
  useEffect(() => {
    if (isDemoMode) {
      setReputationKeywords(REPUTATION_KEYWORDS);
      return;
    }
    fetchReputationKeywords();
  }, [isDemoMode]);

  // 시즌 평판 데이터 가져오기 (시즌 변경 시마다)
  useEffect(() => {
    if (isDemoMode) return; // 데모 모드에서는 API 호출 스킵
    // 대상 사용자 ID (urlUserId가 있으면 해당 사용자, 없으면 본인)
    const targetId = urlUserId || session?.user?.id;
    if (!targetId || !currentSeason?.id) return;

    fetchSeasonReputations(targetId, currentSeason.id);
  }, [urlUserId, session?.user?.id, currentSeason?.id]);

  // 데모 모드일 때 더미 데이터 일괄 적용 — searchParams 의존성 제거: useSearchParams 가 매 렌더마다 새 ref 반환해 useEffect 가 반복 발화하면서 신규 저장한 record 를 dummy 로 덮어쓰는 race condition 차단
  useEffect(() => {
    if (isDemoMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSeasonReputations(getDemoSeasonReputations(DUMMY_SEASON_DATA.seasonReputations as any) as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSeasonHistories(DUMMY_SEASON_HISTORIES as any);
    }
  }, [isDemoMode]);

  // 데모 모드: 페이지네이션 변경 시 시즌 평판 갱신 — 동일 이유로 searchParams 의존성 제거
  useEffect(() => {
    if (!isDemoMode) return;
    const currentHistory = DUMMY_SEASON_HISTORIES[section3Page];
    if (currentHistory) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSeasonReputations(getDemoSeasonReputations(currentHistory.seasonReputations as any) as any);
    } else {
      setSeasonReputations([]);
    }
  }, [section3Page, isDemoMode]);

  // 시즌 히스토리 포맷팅 함수
  const formatSeasonHistories = (
    histories: Array<{
      id: string;
      role_in_season: string;
      approved_weeks: number;
      total_weeks: number;
      progress_status: string;
      is_qualified?: boolean;
      rating?: number;
      review?: string;
      seasons: {
        id: string;
        year: number;
        name: string;
        start_date: string;
        end_date: string;
      };
      seasonPoints?: {
        stars: number;
        shields: number;
        lightnings: number;
      };
      seasonStats?: {
        weekUsageRate: number;
        approvedWeeks: number;
        totalOperatingWeeks: number;
        reliabilityRate: number;
        reliableWeeks: number;
        growthRate: number;
        completedActivities: number;
        totalActivities: number;
        clusterStats?: {
          info: { total: number; completed: number };
          competency: { total: number; completed: number };
          experience: { total: number; completed: number };
          career: { total: number; completed: number };
        };
      };
    }>,
    roleHistory: Array<{
      id: string;
      user_id: string;
      role: string;
      started_at: string;
      ended_at: string | null;
    }>,
    teamParts: Array<{
      user_id: string;
      team_id: string;
      part_id: string;
      joined_at: string;
      left_at: string | null;
    }>,
    teamsData: Array<{ id: string; name: string }>,
    partsData: Array<{ id: string; name: string; team_id: string }>,
  ): SeasonHistoryData[] => {
    const seasonNameMap: { [key: string]: string } = {
      spring: "봄",
      summer: "여름",
      fall: "가을",
      winter: "겨울",
    };

    const seasonImageMap: { [key: string]: string } = {
      봄: "/images/0/cluster4/시즌 이미지/봄_후보_1.png",
      여름: "/images/0/cluster4/cluster4-1/image.png",
      가을: "/images/0/cluster4/cluster4-1/image2.png",
      겨울: "/images/0/cluster4/cluster4-1/image3.png",
    };

    const getStatusInfo = (progressStatus: string): { status: string; statusClass: string } => {
      switch (progressStatus) {
        case "in_progress":
          return { status: "시즌 진행 중", statusClass: "in-progress" };
        case "completed":
          return { status: "시즌 성공", statusClass: "completed" };
        case "full_rest":
        case "resting":
          return { status: "시즌 휴식", statusClass: "resting" };
        case "suspended":
          return { status: "시즌 중단", statusClass: "suspended" };
        default:
          return { status: "시즌 진행 중", statusClass: "in-progress" };
      }
    };

    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dayOfWeek = days[date.getDay()];
      return `${year} / ${month} / ${day} (${dayOfWeek})`;
    };

    return histories.map(
      (sh: {
        id: string;
        role_in_season: string;
        approved_weeks: number;
        total_weeks: number;
        progress_status: string;
        is_qualified?: boolean;
        rating?: number;
        review?: string;
          seasons: {
          id: string;
          year: number;
          name: string;
          start_date: string;
          end_date: string;
        };
        seasonPoints?: {
          stars: number;
          shields: number;
          lightnings: number;
        };
        seasonStats?: {
          weekUsageRate: number;
          approvedWeeks: number;
          totalOperatingWeeks: number;
          reliabilityRate: number;
          reliableWeeks: number;
          growthRate: number;
          completedActivities: number;
          totalActivities: number;
          clusterStats?: {
            info: { total: number; completed: number };
            competency: { total: number; completed: number };
            experience: { total: number; completed: number };
            career: { total: number; completed: number };
          };
        };
      }) => {
        const seasonName = seasonNameMap[sh.seasons?.name] || sh.seasons?.name || "";
        const statusInfo = getStatusInfo(sh.progress_status);
        const startDate = formatDate(sh.seasons?.start_date || "");
        const endDate = formatDate(sh.seasons?.end_date || "");

        // 시즌별 포인트 (API에서 가져온 데이터)
        const seasonPoints = sh.seasonPoints || { stars: 0, shields: 0, lightnings: 0 };
        // 시즌별 통계 (API에서 가져온 데이터)
        const seasonStats = sh.seasonStats || {
          weekUsageRate: 0,
          approvedWeeks: 0,
          totalOperatingWeeks: 0,
          reliabilityRate: 0,
          reliableWeeks: 0,
          growthRate: 0,
          completedActivities: 0,
          totalActivities: 0,
          clusterStats: {
            info: { total: 0, completed: 0 },
            competency: { total: 0, completed: 0 },
            experience: { total: 0, completed: 0 },
            career: { total: 0, completed: 0 },
          },
        };

        // 클러스터별 강화율 계산
        const clusterStats = seasonStats.clusterStats || {
          info: { total: 0, completed: 0 },
          competency: { total: 0, completed: 0 },
          experience: { total: 0, completed: 0 },
          career: { total: 0, completed: 0 },
        };

        // 해당 시즌 기간 내 역할/팀/파트 이력 계산
        const seasonStartDate = sh.seasons?.start_date || "";
        const seasonEndDate = sh.seasons?.end_date || "";
        const seasonYear = sh.seasons?.year || 0;

        // 시즌 기간 내에 유효한 역할/팀/파트 조합 찾기
        const seasonRoleItems: SeasonRoleItem[] = [];

        // 역할 이력 중 해당 시즌과 겹치는 것들 필터링
        const relevantRoles = roleHistory.filter((rh) => {
          const roleStart = rh.started_at;
          const roleEnd = rh.ended_at || new Date().toISOString().split("T")[0];
          // 시즌 기간과 역할 기간이 겹치는지 확인
          return roleStart <= seasonEndDate && roleEnd >= seasonStartDate;
        });

        // 팀/파트 이력 중 해당 시즌과 겹치는 것들 필터링
        const relevantTeamParts = teamParts.filter((tp) => {
          const tpStart = tp.joined_at?.split(" ")[0].split("T")[0] || "";
          const tpEnd = tp.left_at?.split(" ")[0].split("T")[0] || new Date().toISOString().split("T")[0];
          return tpStart <= seasonEndDate && tpEnd >= seasonStartDate;
        });

        // 역할/팀/파트 조합 생성 (변경 시점 기준으로 정렬)
        // 각 변경 시점마다 새로운 상태 항목 생성
        const changePoints = new Set<string>();
        relevantRoles.forEach((rh) => changePoints.add(rh.started_at));
        relevantTeamParts.forEach((tp) => changePoints.add(tp.joined_at));
        const sortedChangePoints = Array.from(changePoints).sort();

        // 역할 라벨 매핑 (함수 내부용)
        const roleLabelMap: { [key: string]: string } = {
          crew: "일반",
          crew_regular: "일반",
          crew_normal: "일반",
          crew_advanced_agent: "심화(에이전트)",
          crew_agent: "심화(에이전트)",
          crew_advanced_part_leader: "심화(파트장)",
          crew_partleader: "심화(파트장)",
          part_leader: "심화(파트장)",
          admin_team_leader: "운영진(팀장)",
          crew_team_leader: "운영진(팀장)",
          operations_teamleader: "운영진(팀장)",
          admin_ambassador: "운영진(앰배서더)",
          crew_ambassador: "운영진(앰배서더)",
          operations_ambassador: "운영진(앰배서더)",
        };

        // 운영진 역할 확인 함수
        const checkIsAdmin = (role: string): boolean => {
          return ["admin_team_leader", "crew_team_leader", "operations_teamleader", "admin_ambassador", "crew_ambassador", "operations_ambassador"].includes(role);
        };

        // 각 변경 시점에서의 상태 계산
        sortedChangePoints.forEach((changePoint) => {
          // 해당 시점에 유효한 역할 찾기
          const activeRole = relevantRoles.find((rh) => {
            const roleStart = rh.started_at;
            const roleEnd = rh.ended_at || new Date().toISOString().split("T")[0];
            return roleStart <= changePoint && roleEnd >= changePoint;
          });

          // 해당 시점에 유효한 팀/파트 찾기 (left_at은 미포함, 즉 [joined_at, left_at) 범위)
          const activeTeamPart = relevantTeamParts.find((tp) => {
            const tpStart = tp.joined_at?.split(" ")[0].split("T")[0] || "";
            const tpEnd = tp.left_at?.split(" ")[0].split("T")[0] || "9999-12-31";
            // left_at이 없으면(is_current) 포함, 있으면 미포함으로 처리
            return tpStart <= changePoint && (tp.left_at === null || changePoint < tpEnd);
          });

          if (activeRole || activeTeamPart) {
            const role = activeRole?.role || sh.role_in_season || "crew_regular";
            const isAdmin = checkIsAdmin(role);
            const teamName = activeTeamPart ? teamsData.find((t) => t.id === activeTeamPart.team_id)?.name || null : null;
            const partName = activeTeamPart ? partsData.find((p) => p.id === activeTeamPart.part_id)?.name || null : null;

            // 운영진 역할의 경우 특별 처리
            let roleLabel = roleLabelMap[role] || role;
            let adminGeneration: number | null = null;

            if (isAdmin) {
              // 운영진 기수 계산 (시즌 년도 기반으로 계산 - 예시: 2025년 가을 시즌 = 3기, 2026년 = 4기 등)
              // 이 부분은 실제 비즈니스 로직에 맞게 조정 필요
              adminGeneration = seasonYear >= 2026 ? seasonYear - 2022 : seasonYear - 2022;

              // 팀장의 경우 팀 이름 포함
              if (role.includes("team_leader") && teamName) {
                roleLabel = `팀장(${teamName})`;
              } else if (role.includes("ambassador")) {
                roleLabel = "앰배서더";
              }
            }

            // 일반/심화 크루는 팀/파트 정보가 있어야만 표시
            // 운영진은 팀/파트 없어도 "클럽 단위"로 표시
            if (!isAdmin && (!teamName || !partName)) {
              return; // 일반/심화 크루인데 팀/파트 정보 없으면 스킵
            }

            // 중복 체크: 같은 조합이 이미 있는지 확인
            const isDuplicate = seasonRoleItems.some((item) => item.teamName === teamName && item.partName === partName && item.roleLabel === roleLabel && item.isAdmin === isAdmin);

            if (!isDuplicate) {
              seasonRoleItems.push({
                teamName,
                partName,
                roleLabel,
                isAdmin,
                adminGeneration,
                startedAt: changePoint,
              });
            }
          }
        });

        // 변경 이력이 없으면 기본 역할로 추가
        if (seasonRoleItems.length === 0 && sh.role_in_season) {
          const role = sh.role_in_season;
          const isAdmin = checkIsAdmin(role);
          let roleLabel = roleLabelMap[role] || role;
          let adminGeneration: number | null = null;

          // 시즌 기간 중 유효한 팀/파트 찾기 (가장 최근 것)
          const latestTeamPart = relevantTeamParts.length > 0 ? relevantTeamParts.sort((a, b) => b.joined_at.localeCompare(a.joined_at))[0] : null;
          const teamName = latestTeamPart ? teamsData.find((t) => t.id === latestTeamPart.team_id)?.name || null : null;
          const partName = latestTeamPart ? partsData.find((p) => p.id === latestTeamPart.part_id)?.name || null : null;

          if (isAdmin) {
            adminGeneration = seasonYear >= 2026 ? seasonYear - 2022 : seasonYear - 2022;
            if (role.includes("ambassador")) {
              roleLabel = "앰배서더";
            } else if (role.includes("team_leader") && teamName) {
              roleLabel = `팀장(${teamName})`;
            }

            // 운영진은 팀/파트 없어도 추가
            seasonRoleItems.push({
              teamName: null,
              partName: null,
              roleLabel,
              isAdmin,
              adminGeneration,
              startedAt: seasonStartDate,
            });
          } else if (teamName && partName) {
            // 일반/심화 크루는 팀/파트 정보가 있을 때만 추가
            seasonRoleItems.push({
              teamName,
              partName,
              roleLabel,
              isAdmin,
              adminGeneration,
              startedAt: seasonStartDate,
            });
          }
        }

        return {
          id: sh.id,
          year: String(sh.seasons?.year || ""),
          season: seasonName,
          dateRange: `${startDate} - ${endDate}`,
          status: statusInfo.status,
          statusClass: statusInfo.statusClass,
          image: seasonImageMap[seasonName] || "/images/0/cluster4/시즌 이미지/봄_후보_1.png",
          approvedWeeks: sh.approved_weeks || 0,
          totalWeeks: sh.total_weeks || 0,
          roleInSeason: sh.role_in_season || "",
          // Qualified 승인 상태 (Part, Team, Cluv, Supervise 4개 도장)
          isQualified: sh.is_qualified || false,
          // 시즌 상태 (역할/팀/파트 이력) - 최대 6개, 발생 순서대로
          seasonRoles: seasonRoleItems.slice(0, 6),
          // 시즌별 포인트 (단감=별, 인절미=방패, 어흥=번개)
          stats: {
            dangam: seasonPoints.stars,
            injeolmi: seasonPoints.shields,
            eoheung: seasonPoints.lightnings,
          },
          rating: sh.rating || 0,
          review: sh.review || "",
          // 시즌별 통계 (주차 활용도, 일정 신뢰도, 시즌 성장률)
          circles: {
            weekUsage: seasonStats.weekUsageRate,
            scheduleReliability: seasonStats.reliabilityRate,
            seasonGrowth: seasonStats.growthRate,
            // 추가 데이터 (실제 값 표시용)
            approvedWeeks: seasonStats.approvedWeeks,
            totalOperatingWeeks: seasonStats.totalOperatingWeeks,
            reliableWeeks: seasonStats.reliableWeeks,
            completedActivities: seasonStats.completedActivities,
            totalActivities: seasonStats.totalActivities,
          },
          progress: {
            info: {
              total: clusterStats.info.total,
              completed: clusterStats.info.completed,
              rate: clusterStats.info.total > 0 ? Math.round((clusterStats.info.completed / clusterStats.info.total) * 100) : 0,
            },
            competency: {
              total: clusterStats.competency.total,
              completed: clusterStats.competency.completed,
              rate: clusterStats.competency.total > 0 ? Math.round((clusterStats.competency.completed / clusterStats.competency.total) * 100) : 0,
            },
            experience: {
              total: clusterStats.experience.total,
              completed: clusterStats.experience.completed,
              rate: clusterStats.experience.total > 0 ? Math.round((clusterStats.experience.completed / clusterStats.experience.total) * 100) : 0,
            },
            career: {
              total: clusterStats.career.total,
              completed: clusterStats.career.completed,
              rate: clusterStats.career.total > 0 ? Math.round((clusterStats.career.completed / clusterStats.career.total) * 100) : 0,
            },
          },
        };
      },
    );
  };

  // 성장 상태를 badge 텍스트로 변환 (status와 growth_status 두 개 사용)
  const getGrowthBadgeText = (status: string | null, growthStatus: string | null): string => {
    // 1. 성장 완료 체크 (최우선)
    if (status === "graduated" || growthStatus === "졸업 완료" || growthStatus === "졸업 절차 중") {
      return "성장 완료";
    }

    // 2. 성장 중단 체크
    if (status === "suspended" || growthStatus === "활동 중단" || growthStatus === "활동 유보") {
      return "성장 중단";
    }

    // 3. 성장 휴식 체크
    if (status === "weekly_rest" || status === "seasonal_rest" || growthStatus === "주차 휴식 중" || growthStatus === "시즌 휴식 중" || growthStatus === "공식 휴식 중") {
      return "성장 휴식";
    }

    // 4. 기본값
    return "성장 진행 중";
  };

  // 페이지 전환 핸들러
  const handlePageChange = (newPage: number) => {
    if (newPage === section3Page || isFlipping) return;

    setFlipDirection(newPage > section3Page ? "next" : "prev");
    setIsFlipping(true);
    setIsTextFading(true);

    // 페이드아웃 완료 후 데이터 변경
    setTimeout(() => {
      setSection3Page(newPage);
      setIsFlipping(false);
    }, 600);

    // 데이터 변경 후 잠시 뒤에 페이드인 시작
    setTimeout(() => {
      setIsTextFading(false);
    }, 650);
  };

  // 시즌 평판 모달 열기
  // 본인이 이 시즌·이 대상에게 이미 남긴 평판이 있으면 prefill 하여 수정 모드로 진입
  const openSeasonReputationModal = () => {
    // 테스트 유저(데모) 모드는 세션이 없으므로 reviewer = demoUserId 로 본다(백엔드가 reviewer 를
    // demoUserId 로 고정해 저장하므로 기존 평판의 reviewer_id 도 demoUserId 다). 빠뜨리면 항상
    // 신규(POST)로 진입해 중복 작성 409 로 저장이 막힌다.
    const myProfileId = session?.user?.id || demoUserId || undefined;
    const myExisting = myProfileId
      ? seasonReputations.find((r) => r.reviewer_id === myProfileId)
      : undefined;

    if (myExisting) {
      setSelectedReputation(myExisting);
      setSeasonReputationEditData({
        rating: myExisting.rating ?? 0,
        content: myExisting.content ?? "",
        keyword1: myExisting.keyword_1 ?? "",
        keyword2: myExisting.keyword_2 ?? "",
        keyword3: myExisting.keyword_3 ?? "",
      });
    } else {
      setSelectedReputation(null);
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
    }
    setSeasonReputationError(null);
    setSeasonReputationSuccess(false);
    // 현재 보고 있는 시즌을 기본 선택 — 단, 실제 uuid 만(가짜 placeholder id 회피).
    // seasonHistories 가 아직 비어 있어 currentSeason 이 defaultSeasonData(id="") 면 ""
    // 로 두고, 아래 동기화 useEffect 가 로딩 완료 후 채워준다.
    const initialSeasonId = [
      currentSeason?.id,
      seasonHistories[section3Page]?.id,
      seasonHistories[0]?.id,
    ].find(isRealSeasonHistoryId);
    setSelectedSeasonId(initialSeasonId || "");
    setSeasonReputationModalOpen(true);
  };

  // 시즌 평판 모달이 열린 뒤 시즌 데이터가 늦게 로딩되는 경우 동기화.
  // 모달 open 시점에 seasonHistories 가 비어 selectedSeasonId 가 ""(또는 가짜 id)로 잡혔다면,
  // currentSeason / seasonHistories 가 채워지는 순간 실제 season_history uuid 로 1회 보정한다.
  // (이미 유효한 uuid 가 선택돼 있으면 — 사용자가 시즌을 직접 고른 경우 포함 — 덮어쓰지 않는다.)
  useEffect(() => {
    if (!seasonReputationModalOpen) return;
    if (isRealSeasonHistoryId(selectedSeasonId)) return;
    const resolved = [
      currentSeason?.id,
      seasonHistories[section3Page]?.id,
      seasonHistories[0]?.id,
    ].find(isRealSeasonHistoryId);
    if (resolved) {
      setSelectedSeasonId(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonReputationModalOpen, selectedSeasonId, currentSeason?.id, seasonHistories, section3Page]);

  // 시즌 평판 저장 - 다른 사람에게 평판 남기기
  const handleSaveSeasonReputation = async () => {
    if (!isDemoMode && !canEditSeasonReputation) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!isDemoMode && !seasonReputationWindowOpen) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    // 데모 모드: API 호출 없이 UI에만 반영
    if (isDemoMode) {
      setSeasonReputations((prev) => [
        ...prev,
        {
          id: `demo-${Date.now()}`,
          reviewer_id: session?.user?.id || "demo-user",
          target_user_id: urlUserId || "",
          season_history_id: selectedSeasonId || "",
          rating: seasonReputationEditData.rating,
          content: seasonReputationEditData.content.trim(),
          keyword_1: seasonReputationEditData.keyword1.trim() || null,
          keyword_2: seasonReputationEditData.keyword2.trim() || null,
          keyword_3: seasonReputationEditData.keyword3.trim() || null,
          created_at: new Date().toISOString(),
          reviewer: {
            id: session?.user?.id || "demo-user",
            display_name: session?.user?.name || "데모 유저",
            gender: "-",
            birth_date: null,
            university: "-",
            major_first: null,
            profile_photo_url: session?.user?.image || null,
            teamName: null,
            partName: null,
            vision: null,
          },
        },
      ]);
      await popup.alert("저장되었습니다.");
      setSeasonReputationModalOpen(false);
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
      return;
    }

    // 어드민 수정 모드
    if (editingReputationId && session?.user?.isAdmin) {
      setSeasonReputationSaving(true);
      try {
        const response = await fetch(apiUrl("/api/season-reputations"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingReputationId,
            rating: seasonReputationEditData.rating,
            content: seasonReputationEditData.content,
            keyword1: seasonReputationEditData.keyword1,
            keyword2: seasonReputationEditData.keyword2,
            keyword3: seasonReputationEditData.keyword3,
          }),
        });
        const result = await response.json();
        if (!response.ok) { alert(result.error || "수정에 실패했습니다."); return; }

        const targetId = urlUserId || session?.user?.id;
        if (targetId && currentSeason?.id) fetchSeasonReputations(targetId, currentSeason.id);
        alert("수정되었습니다.");
        setSeasonReputationModalOpen(false);
        setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
        setEditingReputationId(null);
      } catch { alert("서버 오류가 발생했습니다."); }
      finally { setSeasonReputationSaving(false); }
      return;
    }

    if (!urlUserId) {
      await popup.alert("평판을 남길 대상을 찾을 수 없습니다.");
      return;
    }

    if (!selectedSeasonId) {
      await popup.alert("시즌을 선택해주세요.");
      return;
    }

    if (seasonReputationEditData.content.trim() === "") {
      const el = document.querySelector(".edit-modal-content textarea");
      if (el) {
        (el as HTMLElement).style.border = "1px solid #ff4444";
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (seasonReputationEditData.keyword1.trim() === "" && seasonReputationEditData.keyword2.trim() === "") {
      const el = document.querySelector(".edit-modal-content input[placeholder='키워드를 입력하세요']");
      if (el) {
        (el as HTMLElement).style.border = "1px solid #ff4444";
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSeasonReputationSaving(true);
    setSeasonReputationError(null);

    try {
      const response = await fetch(apiUrl("/api/season-reputations"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: urlUserId,
          seasonHistoryId: selectedSeasonId,
          rating: seasonReputationEditData.rating,
          content: seasonReputationEditData.content,
          keyword1: seasonReputationEditData.keyword1,
          keyword2: seasonReputationEditData.keyword2,
          keyword3: seasonReputationEditData.keyword3,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        await popup.alert(result.error || "저장에 실패했습니다.");
        return;
      }

      // 평판 목록 새로고침 (현재 보고 있는 시즌의 평판)
      const targetId = urlUserId || session?.user?.id;
      if (targetId && currentSeason?.id) {
        fetchSeasonReputations(targetId, currentSeason.id);
      }

      await popup.alert("저장되었습니다.");
      setSeasonReputationModalOpen(false);
      setSeasonReputationEditData({ rating: 0, content: "", keyword1: "", keyword2: "", keyword3: "" });
      setEditingReputationId(null);
    } catch (error) {
      console.error("시즌 평판 저장 오류:", error);
      await popup.alert("서버 오류가 발생했습니다.");
    } finally {
      setSeasonReputationSaving(false);
    }
  };

  // 시즌 리뷰 모달 열기
  const openSeasonReviewModal = () => {
    // 현재 시즌의 rating, review 값을 가져와서 초기화
    // review 가 비어있으면 REVIEW_COMMENT_DEFAULT 로 폴백 — 초기화 버튼 동작과 동일한 디폴트 문구.
    setSeasonReviewEditData({
      rating: currentSeason.rating || 0,
      review: currentSeason.review || REVIEW_COMMENT_DEFAULT,
    });
    setSeasonReviewError(null);
    setSeasonReviewSuccess(false);
    setSeasonReviewModalOpen(true);
  };

  // 시즌 리뷰 저장
  const openSeasonReviewRatingDropdown = () => {
    if (!isSeasonReviewFormEditing) return;
    if (seasonReviewRatingDropdownOpen) {
      setSeasonReviewRatingDropdownOpen(false);
      return;
    }
    const trigger = seasonReviewRatingDropdownTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setSeasonReviewRatingDropdownPos(getFixedDropdownPosition(rect, 4));
    setSeasonReviewRatingDropdownOpen(true);
  };

  const handleSeasonReviewRatingSelect = (value: number) => {
    setSeasonReviewEditData((prev) => ({ ...prev, rating: value }));
    setSeasonReviewRatingDropdownOpen(false);
    if (seasonReviewSaveAttemptFailed) setSeasonReviewSaveAttemptFailed(false);
  };

  const isSeasonReviewValid = (): boolean => {
    if (!seasonReviewEditData.rating || seasonReviewEditData.rating < 1) return false;
    if (!seasonReviewEditData.review || !seasonReviewEditData.review.trim()) return false;
    return true;
  };

  const isSeasonReviewDirty = (): boolean => {
    if (!seasonReviewFormSnapshot) {
      return seasonReviewEditData.rating > 0 || (seasonReviewEditData.review?.trim().length || 0) > 0;
    }
    return seasonReviewEditData.rating !== seasonReviewFormSnapshot.rating || seasonReviewEditData.review !== seasonReviewFormSnapshot.review;
  };

  const handleSeasonReviewEditClick = async () => {
    if (!isOwner) {
      await popup.alert("본인 시즌 리뷰만 수정할 수 있습니다.");
      return;
    }
    if (!canEditSeasonReview) {
      await popup.alert("관리자 확인이 필요합니다.");
      return;
    }
    setSeasonReviewFormSnapshot({
      rating: seasonReviewEditData.rating,
      review: seasonReviewEditData.review,
    });
    setSeasonReviewSaveAttemptFailed(false);
    setSeasonReviewFieldErrorFlash(false);
    setIsSeasonReviewFormEditing(true);
  };

  const handleSeasonReviewCancel = async () => {
    if (isSeasonReviewDirty() && !(await popup.confirm("작성 중인 내용이 있습니다. 취소하시겠습니까?"))) return;
    if (seasonReviewFormSnapshot) {
      setSeasonReviewEditData({ rating: seasonReviewFormSnapshot.rating, review: seasonReviewFormSnapshot.review });
    } else {
      setSeasonReviewEditData({ rating: 0, review: "" });
    }
    setIsSeasonReviewFormEditing(false);
    setSeasonReviewSaveAttemptFailed(false);
    setSeasonReviewFieldErrorFlash(false);
    setSeasonReviewFormSnapshot(null);
  };

  const handleSeasonReviewReset = async () => {
    if (!isDemoMode && !canEditSeasonReview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!(await popup.confirm("작성 내용을 모두 초기화하시겠습니까?"))) return;
    // 초기화 = review는 디폴트 문구로 교체, 나머지(rating/link)는 빈 값으로
    setSeasonReviewEditData({ rating: 0, review: REVIEW_COMMENT_DEFAULT, link: "" });
    setSeasonReviewSaveAttemptFailed(false);
    setSeasonReviewFieldErrorFlash(false);
  };

  const handleSeasonReviewClose = async () => {
    if (isSeasonReviewFormEditing && isSeasonReviewDirty() && !(await popup.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?"))) return;
    setSeasonReviewModalOpen(false);
  };

  const handleSaveSeasonReview = async () => {
    if (!isOwner) {
      alert("본인 시즌 리뷰만 저장할 수 있습니다.");
      return;
    }
    if (!isDemoMode && !canEditSeasonReview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!isSeasonReviewValid()) {
      setSeasonReviewSaveAttemptFailed(true);
      setSeasonReviewFieldErrorFlash(true);
      setTimeout(() => setSeasonReviewFieldErrorFlash(false), 600);
      setTimeout(() => {
        const firstErrorField = document.querySelector(".section-modal-season-review .field-error");
        firstErrorField?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    // 저장 직전 confirm — 사용자 의도 재확인
    if (!(await popup.confirm("저장하시겠습니까?"))) return;

    setSeasonReviewSaving(true);
    setSeasonReviewError(null);

    if (isDemoMode) {
      // seasonHistories 업데이트 (UI 즉시 반영 — 현재 페이지 인덱스로 매칭)
      setSeasonHistories((prev) =>
        prev.map((season, idx) => (idx === section3Page ? { ...season, rating: seasonReviewEditData.rating, review: seasonReviewEditData.review.trim() } : season)),
      );
      await popup.alert("저장되었습니다.");
      setSeasonReviewModalOpen(false);
      setSeasonReviewSaving(false);
      return;
    }

    // 실제 user_season_histories row 가 있으면 무조건 그것을 사용한다.
    // currentSeason 이 defaultSeasonData fallback("dummy-season-1") 을 가리켜도
    // seasonHistories 에 진짜 row 가 있다면 그쪽 id 로 교정.
    const fallbackSeasonHistory =
      seasonHistories[section3Page] || seasonHistories[0];
    const effectiveSeasonHistoryId: string | undefined =
      currentSeason?.id && currentSeason.id !== "dummy-season-1"
        ? currentSeason.id
        : fallbackSeasonHistory?.id;

    // 진단 로그 — Network 에 PUT 이 안 뜨는 케이스를 추적하기 위한 콘솔 출력.
    // (저장 흐름이 안정되면 제거 가능)
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[seasonReview] saving", {
        seasonHistoriesCount: seasonHistories.length,
        section3Page,
        currentSeasonId: currentSeason?.id,
        fallbackId: fallbackSeasonHistory?.id,
        effectiveSeasonHistoryId,
      });
    }

    if (!effectiveSeasonHistoryId || effectiveSeasonHistoryId === "dummy-season-1") {
      setSeasonReviewSaving(false);
      await popup.alert("시즌 정보를 찾을 수 없습니다.");
      return;
    }

    // 0.0~5.0 범위, 0.5 단위 검증
    if (false && (seasonReviewEditData.rating < 0 || seasonReviewEditData.rating > 10)) {
      await popup.alert("평점은 0.0~5.0 사이의 0.5 단위여야 합니다.");
      return;
    }

    if (false && !seasonReviewEditData.review.trim()) {
      const el = document.querySelector(".edit-modal-content textarea");
      if (el) {
        (el as HTMLElement).style.border = "1px solid #ff4444";
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (false && seasonReviewEditData.review.length > 300) {
      const el = document.querySelector(".edit-modal-content textarea");
      if (el) {
        (el as HTMLElement).style.border = "1px solid #ff4444";
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // 작성 기간 게이트 — admin/demo/dev 우회는 seasonReviewWindowOpen 안에 이미 반영됨.
    if (!seasonReviewWindowOpen) {
      await popup.alert(EDIT_WINDOW_LOCKED_MESSAGE);
      return;
    }

    setSeasonReviewSaving(true);
    setSeasonReviewError(null);

    try {
      const res = await fetch(apiUrl("/api/season-review"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // effectiveSeasonHistoryId 로 송신 (currentSeason 이 defaultSeasonData
          // fallback 을 가리킬 때도 실제 row id 로 교정됨)
          seasonHistoryId: effectiveSeasonHistoryId,
          rating: seasonReviewEditData.rating,
          review: seasonReviewEditData.review.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 서버가 작성 기간 닫힘으로 거부 → 통일 문구 + 권한 재조회 트리거.
        if (res.status === 403 && data?.error === "EDIT_WINDOW_CLOSED") {
          setSeasonReviewWindowOpen(false);
          setEditWindowRefreshTick((t) => t + 1);
          await popup.alert(EDIT_WINDOW_LOCKED_MESSAGE);
          return;
        }
        await popup.alert(data?.error || "저장에 실패했습니다.");
        return;
      }

      // 현재 시즌 데이터 업데이트
      setSeasonHistories((prev) =>
        prev.map((season) => (currentSeasonInfo && season.year === String(currentSeasonInfo.year) && season.season === currentSeasonInfo.name ? { ...season, rating: seasonReviewEditData.rating, review: seasonReviewEditData.review.trim() } : season)),
      );

      await popup.alert("저장되었습니다.");
      setSeasonReviewModalOpen(false);
    } catch (error) {
      console.error("시즌 리뷰 저장 오류:", error);
      await popup.alert("서버 오류가 발생했습니다.");
    } finally {
      setSeasonReviewSaving(false);
    }
  };

  // 커스텀 스크롤바: area-8 (status-badges)
  const updateScrollbar8 = useCallback(() => {
    const container = statusBadgesRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const trackHeight = clientHeight;
    const thumbHeight = 61;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
    setScrollThumbTop8(thumbTop);
  }, []);

  const handleMouseDown8 = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging8(true);
    dragStartY8.current = e.clientY;
    dragStartScrollTop8.current = statusBadgesRef.current?.scrollTop || 0;
  }, []);

  // 커스텀 스크롤바: area-9 (profile-cards)
  const updateScrollbar9 = useCallback(() => {
    const container = profileCardsRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const trackHeight = clientHeight;
    const thumbHeight = 61;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
    setScrollThumbTop9(thumbTop);
  }, []);

  const handleMouseDown9 = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging9(true);
    dragStartY9.current = e.clientY;
    dragStartScrollTop9.current = profileCardsRef.current?.scrollTop || 0;
  }, []);

  // 드래그 이벤트 핸들러 (area-8)
  useEffect(() => {
    if (!isDragging8) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = statusBadgesRef.current;
      if (!container) return;
      const deltaY = e.clientY - dragStartY8.current;
      const { scrollHeight, clientHeight } = container;
      const trackHeight = clientHeight;
      const thumbHeight = 61;
      const maxThumbTop = trackHeight - thumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const scrollDelta = maxThumbTop > 0 ? (deltaY / maxThumbTop) * maxScrollTop : 0;
      container.scrollTop = dragStartScrollTop8.current + scrollDelta;
    };
    const handleMouseUp = () => setIsDragging8(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging8]);

  // 드래그 이벤트 핸들러 (area-9)
  useEffect(() => {
    if (!isDragging9) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = profileCardsRef.current;
      if (!container) return;
      const deltaY = e.clientY - dragStartY9.current;
      const { scrollHeight, clientHeight } = container;
      const trackHeight = clientHeight;
      const thumbHeight = 61;
      const maxThumbTop = trackHeight - thumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const scrollDelta = maxThumbTop > 0 ? (deltaY / maxThumbTop) * maxScrollTop : 0;
      container.scrollTop = dragStartScrollTop9.current + scrollDelta;
    };
    const handleMouseUp = () => setIsDragging9(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging9]);

  return (
    <div className="cluster4-content">
      {/* Section 1: CLUB CHALLENGE GROWTH */}
      <section className="cluster4-section1" ref={headerRef}>
        {/* 좌측 상단 탭 (세로 정렬) */}
        <div className="top-tabs">
          <div
            className="tab"
            style={{ width: "44px", height: "44px", background: "#161816" }}
            onClick={() => router.push(withPxRoute(appendDemoQuery(`/cluster-4${urlUserId ? `?userId=${urlUserId}` : ""}`, searchParams), pathname))}
          >
            <img src="/images/0/cluster4/icon/icon%20-%20%EC%A0%84%EA%B5%AC.png" alt="전구" className="tab-icon" />
            <div
              className="tab-badge"
              onClick={(e) => {
                e.stopPropagation();
                router.push(withPxRoute(appendDemoQuery(`/cluster-4${urlUserId ? `?userId=${urlUserId}` : ""}`, searchParams), pathname));
              }}
            >
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </div>
          <div
            className="tab"
            style={{
              width: "44px",
              height: "44px",
              // /cluster-4-1 (season detail) 에서 "book" 탭이 활성 (yellow).
              // org-suffix 라우트별 active accent 톤. base SCSS 의
              // `.top-tabs .tab:first-child` 룰은 첫 탭만 잡으므로 여기서 분기.
              background: orgAccent,
            }}
            onClick={() => router.push(withPxRoute(appendDemoQuery(`/cluster-4-1${urlUserId ? `?userId=${urlUserId}` : ""}`, searchParams), pathname))}
          >
            <img src="/images/0/cluster4/icon/icon%20-%20book.png" alt="book" className="tab-icon" />
            <div
              className="tab-badge"
              onClick={(e) => {
                e.stopPropagation();
                router.push(withPxRoute(appendDemoQuery(`/cluster-4-1${urlUserId ? `?userId=${urlUserId}` : ""}`, searchParams), pathname));
              }}
            >
              <span className="badge-text">Season Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </div>
        </div>

        {/* 타이틀 */}
        <div className="section1-title-wrapper">
          <div className="title-inner">
            <h2 className="section1-title">CLUB CHALLENGE GROWTH</h2>
          </div>
        </div>

        {/* 설명 텍스트 */}
        <div className="section1-description">
          <p>이 페이지에서는 주차별로(weekly), 시즌별로(season) 차곡차곡 성장한 크루의 내역이 나옵니다.</p>
          <p>잠깐의 열정과 객기는 누구나 가질 수 있지만, 역경과 부침, 짜증나는 고난과 요동치는 감정을 이겨내며 꾸준하게 성장할 수 있는 사람은 생각보다 적습니다.😊</p>
          <p className="small-text">1주, 1개월, 1분기, 1반기, 1년.. 세상에서 평가하는 나의 신뢰성은 어떠한가요?</p>
          <p className="quote-text">There is no magic to achievement. It's really about hard work, choices and persistence.</p>
          <p className="quote-highlight">"무언가를 성취하기 위해 부릴 수 있는 마법은 없다. 필요한 것은 오직 노력, 선택 그리고 꾸준함일 뿐이다."</p>
          <p className="quote-author">-미셸 오바마(Michelle Obama)-</p>
        </div>
      </section>

      {/* Section 2: SEASON GROWTH 카드 */}
      <section className="cluster4-section2">
        <div className="visible season-growth-card">
          {/* 왼쪽 콘텐츠 */}
          <div className="card-left">
            {/* 타이틀과 배지를 한 줄로 */}
            <div className="season-header-row">
              <div className="season-title-wrapper">
                <h3 className="season-title-shadow">SEASON GROWTH</h3>
                <h3 className="season-title">SEASON GROWTH</h3>
              </div>
              <div className="season-badge">
                <svg className="badge-outline" viewBox="0 0 124 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" stroke={orgAccent} strokeWidth="1.69311" fill="none" />
                </svg>
                <svg className="badge-border" viewBox="0 0 124 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" fill={orgAccent} stroke={orgAccent} strokeWidth="1.69311" />
                </svg>
                <span className="badge-text">{getGrowthBadgeText(userStatus, growthStatus)}</span>
              </div>
            </div>

            {/* Add new collection 카드 */}
            <div className="collection-card">
              <div className="collection-icon">
                <img
                  src={isPX ? "/images/0/cluster4/아호 캐릭터-px.png" : isEC ? "/images/0/cluster4/아호 캐릭터-ec.png" : "/images/0/cluster4/아호 캐릭터.png"}
                  alt="아호 캐릭터"
                />
              </div>
              <div className="collection-content">
                <div className="collection-header">
                  <img src="/images/0/cluster4/icon/icon - plus.png" alt="plus" className="add-icon" />
                  <span className="collection-label">Add new passion, hardship and growth</span>
                </div>
                <p className="collection-text">
                  {demoCollectionMessage ? (
                    demoCollectionMessage
                  ) : currentSeasonInfo?.isBreakSeason ? (
                    <>
                      현재 클럽은,{" "}
                      <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>
                        {formatSeasonLabel({ seasonName: currentSeasonInfo.toSeason, year: currentSeasonInfo.year })}
                      </span>
                      을 준비 중인 전환 과정에 있습니다.
                    </>
                  ) : (
                    <>
                      현재 클럽은,{" "}
                      {currentSeasonInfo ? (
                        <>
                          <span style={{ color: "#FF9C9C", fontSize: 20, fontFamily: "Pretendard", fontWeight: "800", lineHeight: "30px", wordWrap: "break-word" }}>
                            {formatSeasonLabel({ seasonLabel: currentSeasonInfo.seasonLabel, seasonName: currentSeasonInfo.name, seasonType: currentSeasonInfo.seasonType, year: currentSeasonInfo.year })}
                          </span>
                          을 가동 중에 있습니다.
                        </>
                      ) : (
                        "로딩 중..."
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Details 카드 */}
            <div className="details-card">
              <div className="details-header">
                <img src="/images/0/cluster4/icon/icon - ppt.png" alt="details" className="toggle-icon" />
                <span className="toggle-text">Details</span>
                <span className="arrow-icon"></span>
              </div>

              <div className="details-content">
                <div className="detail-row">
                  <span className="detail-label">성장 시작 시즌</span>
                  <span className="detail-value">
                    {growthStartInfo && growthStartInfo.year ? (growthStartInfo.isBreak ? `${formatSeasonLabel({ seasonName: growthStartInfo.seasonName, year: growthStartInfo.year })} 전환 주차` : formatSeasonWeekTitle({ seasonName: growthStartInfo.seasonName, year: growthStartInfo.year, weekNumber: growthStartInfo.weekNumber })) : "-"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 가능 시즌</span>
                  <span className="detail-value">
                    <span className="number">{seasonHistories.length}</span> <span className="white-text">개 시즌</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 성공 시즌</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.approvedSeasons ?? "-"}</span> <span className="white-text">개 시즌</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 휴식 시즌</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.restSeasons ?? "-"}</span> <span className="white-text">개 시즌</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 종료 시즌</span>
                  <span className="detail-value">
                    {growthEndInfo ? (
                      <>
                        {growthEndInfo.year}년, {growthEndInfo.seasonName} 시즌
                        {growthEndInfo.isBreak ? ", 전환 주차" : growthEndInfo.weekNumber ? `, ${growthEndInfo.weekNumber}주차` : ""} ({getGrowthBadgeText(userStatus, growthStatus)})
                      </>
                    ) : (
                      <>~ing ({getGrowthBadgeText(userStatus, growthStatus)})</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 캐릭터 이미지 */}
          <div className="card-right">
            <img src="/images/0/cluster4/bg cha.png" alt="Character" />
          </div>
        </div>
      </section>

      {/* Section 3: 2025년도_여름 시즌 */}
      <section className="cluster4-section3">
        {/* SEASON CHALLENGE 배너 */}
        <div className="section3-banner" style={{ marginBottom: 0, paddingBottom: "88px" }}>
          {/* Floating Icons - 시즌 평판 편집은 영역 9 헤더의 연필 아이콘 사용 (중복 제거) */}
          <div className="floating-icons" style={{ display: "flex" }}>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
          <div className="section3-title-wrapper">
            <h2 className="section3-banner-text">SEASON CHALLENGE</h2>
          </div>
          <div className="section3-banner-description">
            <p>성장한 모든 '시즌'의 종합 결과치가, 각개의 카드로 하나씩 보여집니다.</p>
            <p>당신의 특별한 시즌은 언제였나요?</p>
          </div>
          <div className="section3-banner-notice">
            <p>*모든 시즌들이 누적된 결과는 위 탭 [Club Final Index]에서 확인하실 수 있습니다. 😊</p>
          </div>
        </div>
        <div
          style={{
            width: "1023px",
            height: "1px",
            // 라우트별 1023px section3 상단 divider:
            //   PX → green 두-톤 그라데이션 + soft green glow
            //   EC → Encre pink 두-톤 그라데이션 + soft pink glow (dark/cinematic)
            //   default → 기존 #faab07 단색 (변경 없음)
            background: isPX
              ? "linear-gradient(90deg, rgba(30, 149, 3, 0.08), #1E9503, rgba(178, 255, 143, 0.55))"
              : isEC
              ? "linear-gradient(90deg, rgba(255, 75, 112, 0.08), #FF4B70, rgba(255, 152, 166, 0.55))"
              : "rgba(250, 171, 7, 1)",
            boxShadow: isPX
              ? "0 0 8px rgba(30, 149, 3, 0.22)"
              : isEC
              ? "0 0 8px rgba(255, 75, 112, 0.22)"
              : undefined,
            margin: "0 auto",
          }}
        />
        <div className="season-detail-container" style={{ backgroundImage: `url('${currentSeason.image}')`, marginTop: 0, paddingTop: "30px" }}>
          {/* 상단 헤더 영역 (영역 1 + 영역 2) */}
          <div className="top-header-row">
            {/* 영역 1: 타이틀 + 날짜 + 상태 */}
            <div className={`area-1-title ${isTextFading ? "fading" : ""}`} style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              {/* 진입 화면 시즌 정보 — 페이지네이션 선택 시즌(selectedSeasonSummary) 바인딩. 없으면 "-". */}
              <div className="season-main-title" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                <span className="year-orange">{selectedSeasonSummary?.year != null ? String(selectedSeasonSummary.year) : "-"}</span>년도<span style={{ display: "inline-block", width: "1.2em" }}></span>
                <span className="season-highlight" style={{ display: "inline-block", minWidth: "2em", textAlign: "right" }}>
                  {selectedSeasonSummary?.seasonName || "-"}
                </span>{" "}
                시즌
              </div>
              <span className="bullet-dot" style={{ display: "inline-block", width: "2px", height: "2px", background: orgAccent, borderRadius: "50%", marginLeft: "15px", transform: "translateY(0px)" }}></span>
              <div className="date-status" style={{ display: "flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
                <span className="date-range">{seasonDateRangeText}</span>
                <button className={`status-badge ${seasonStatusClass(selectedSeasonSummary)}`}>{seasonStatusText(selectedSeasonSummary)}</button>
              </div>
            </div>

            {/* 영역 2: Qualified */}
            <div className={`area-2-qualified ${isTextFading ? "fading" : ""}`}>
              <span className="qualified-text">Qualified</span>
              <div className="qualified-items">
                <div className={`item-group ${currentSeason.isQualified ? "" : "inactive"}`}>
                  <span className="item">Part</span>
                  <img src="/images/0/cluster4/icon/icon - part.png" alt="Part" className="qualified-icon" />
                  <div className={`tooltip ${currentSeason.isQualified ? "" : "unqualified"}`}>{currentSeason.isQualified ? <img src="/images/0/cluster4/sign 1.png" alt="Part tooltip" /> : <span className="unqualified-text">UnQualified</span>}</div>
                </div>
                <div className={`item-group ${currentSeason.isQualified ? "" : "inactive"}`}>
                  <span className="item">Team</span>
                  <img src="/images/0/cluster4/icon/icon - team.png" alt="Team" className="qualified-icon" />
                  <div className={`tooltip ${currentSeason.isQualified ? "" : "unqualified"}`}>{currentSeason.isQualified ? <img src="/images/0/cluster4/sign 2.png" alt="Team tooltip" /> : <span className="unqualified-text">UnQualified</span>}</div>
                </div>
                <div className={`item-group ${currentSeason.isQualified ? "" : "inactive"}`}>
                  <span className="item">Cluv</span>
                  <img src="/images/0/cluster4/icon/icon - cluv.png" alt="Cluv" className="qualified-icon" />
                  <div className={`tooltip ${currentSeason.isQualified ? "" : "unqualified"}`}>{currentSeason.isQualified ? <img src="/images/0/cluster4/sign 3.png" alt="Cluv tooltip" /> : <span className="unqualified-text">UnQualified</span>}</div>
                </div>
                <div className={`item-group ${currentSeason.isQualified ? "" : "inactive"}`}>
                  <span className="item">Supervise</span>
                  <img src="/images/0/cluster4/icon/icon - supervise.png" alt="Supervise" className="qualified-icon" />
                  <div className={`tooltip ${currentSeason.isQualified ? "" : "unqualified"}`}>{currentSeason.isQualified ? <img src="/images/0/cluster4/sign 4.png" alt="Supervise tooltip" /> : <span className="unqualified-text">UnQualified</span>}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 메인 컨텐츠 영역 (3열) */}
          <div className="main-content-grid">
            {/* 영역 3: 왼쪽 이미지 스택 */}
            <div className="area-3-image">
              <div className={`season-image-stack ${isFlipping ? "flipping" : ""}`}>
                <div className="image-card card-back">
                  <div className="card-frame">
                    <img src={seasonHistories.length > 0 ? seasonHistories[(section3Page + 2) % seasonHistories.length]?.image || currentSeason.image : "/images/0/cluster4/cluster4-1/image3.png"} alt="시즌" />
                  </div>
                </div>
                <div className="image-card card-middle">
                  <div className="card-frame">
                    <img src={seasonHistories.length > 0 ? seasonHistories[(section3Page + 1) % seasonHistories.length]?.image || currentSeason.image : "/images/0/cluster4/cluster4-1/image2.png"} alt="시즌" />
                  </div>
                </div>
                <div className="image-card card-front">
                  <div className="card-frame">
                    <img src={currentSeason.image} alt={`${currentSeason.season} 시즌`} />
                  </div>
                </div>
              </div>
            </div>

            {/* 중앙 열 (영역 4, 5, 6, 7) */}
            <div className={`center-column ${isTextFading ? "fading" : ""}`}>
              {/* 영역 4: 통계 바 — PX 분기에서만 라벨/아이콘을 PX alias (투구/방패/화살)로 치환.
                  원본 데이터(currentSeason.stats.*) 미터치. */}
              <div className="area-4-stats" style={{ transform: "translateX(44px)" }}>
                {(["단감", "인절미", "어흥"] as const).map((name) => {
                  // 진입 화면 시즌 누적 포인트 — 선택 시즌의 pointSummary(별/방패/번개). 없으면 0.
                  const valueMap = {
                    단감: selectedPointSummary?.star ?? 0,
                    인절미: selectedPointSummary?.shield ?? 0,
                    어흥: selectedPointSummary?.lightning ?? 0,
                  };
                  const defaultSrcMap = {
                    단감: "/images/0/cluster4/icon/icon - 단감.png",
                    인절미: "/images/0/cluster4/icon/icon - 인절미.png",
                    어흥: "/images/0/cluster4/icon/icon - 어흥.png",
                  };
                  // EC(encre) 전용 아이콘 이미지 매핑 — 라벨(별/방패/번개)에 1:1 대응.
                  // PX/default 분기는 미터치. 숫자 값(valueMap) 도 그대로.
                  const ecIconSrcMap = {
                    단감: "/images/0/Graphic10.png", // 별
                    인절미: "/images/0/Shield.png",   // 방패
                    어흥: "/images/0/Graphic13.png",  // 번개
                  };
                  // org-aware alias — PX → 투구/방패/화살, EC → 별/방패/번개,
                  // 그 외(default 라우트) → null → 원본 단감/인절미/어흥 유지.
                  const mapped = getOrgAliasFromPathname(pathname, name);
                  const label = mapped?.label ?? name;
                  return (
                    <span className="stat" key={name}>
                      {label}{" "}
                      {isEC ? (
                        <img src={ecIconSrcMap[name]} alt={label} className="stat-icon" />
                      ) : mapped ? (
                        <span className={`stat-icon badge-icon ${mapped.iconClass}`} aria-hidden="true" />
                      ) : (
                        <img src={defaultSrcMap[name]} alt={name} className="stat-icon" />
                      )}{" "}
                      <strong className="number">{Math.abs(valueMap[name])}</strong>
                      <span className="unit">개</span>
                    </span>
                  );
                })}
              </div>

              {/* 영역 5: 평점 및 리뷰 */}
              <div
                className="area-5-rating"
                style={{ position: "relative" }}
              >
                <div className="rating-avatar">
                  <img src={profilePhotoUrl || "/images/avatar/avatar.png"} alt="Profile" />
                </div>
                <div className="rating-content">
                  <div className="top-row">
                    <div className="stars-row">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const fullValue = star * 2;
                        const halfValue = star * 2 - 1;
                        const isFull = currentSeason.rating >= fullValue;
                        const isHalf = !isFull && currentSeason.rating >= halfValue;
                        if (isHalf) {
                          return (
                            <span key={star} className="star-icon star-half" style={{ position: "relative", display: "inline-block" }}>
                              <img src="/images/0/cluster4/icon - empty star.png" alt="star" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.3, zIndex: 1 }} />
                              <img src="/images/0/cluster4/icon - star.png" alt="star" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", clipPath: "inset(0 50% 0 0)", zIndex: 2 }} />
                            </span>
                          );
                        }
                        return <img key={star} className={`star-icon ${isFull ? "" : "empty"}`} src={isFull ? "/images/0/cluster4/icon - star.png" : "/images/0/cluster4/icon - empty star.png"} alt="star" />;
                      })}
                      <span className="rating-text">{currentSeason.rating || 0} / 10</span>
                    </div>
                    <div className="review-label-group">
                      <span
                        className="review-label"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(openSeasonReviewModal);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        Season Review
                      </span>
                      <div
                        className="edit-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(openSeasonReviewModal);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <i className="ti ti-pencil" style={{ fontSize: "11px", color: "#fff" }}></i>
                      </div>
                    </div>
                  </div>
                  <p className="review-comment">
                    {(() => {
                      const r = currentSeason.review || REVIEW_COMMENT_DEFAULT;
                      return r.length > 24 ? r.slice(0, 24) + "..." : r;
                    })()}
                  </p>
                </div>
              </div>

              {/* 영역 6: 원형 차트 3개 — 단일 출처=weekly-cards 스냅샷(현재 시즌 집계, circlesView).
                  /api/profile seasonStats(legacy 실시간) 미사용. 현재 시즌 값만 표시. */}
              <div className="area-6-circles">
                <div className="circle-item">
                  <div className="label-sub">
                    <div>
                      총 <span className="num-fixed">{circlesView.availableWeeks}</span>주 중
                    </div>
                    <div>
                      <span className="highlight">{circlesView.approvedWeeks}</span>주
                    </div>
                  </div>
                  <div className="circle-wrapper">
                    <img src="/images/0/cluster4/icon/icon - 주차 활용도.png" alt="주차 활용도" className="circle-icon" />
                    <div className="circle pink">
                      <svg viewBox="0 0 100 100">
                        <circle className="bg" cx="50" cy="50" r="40" />
                        <circle className="fill" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - circlesView.weekUsage / 100)} />
                      </svg>
                      <div className="percent">{circlesView.weekUsage}%</div>
                    </div>
                  </div>
                  <div className="label-main">주차 활용도</div>
                </div>
                <div className="circle-item">
                  <div className="label-sub">
                    <div>
                      총 <span className="num-fixed">{circlesView.availableWeeks}</span>주 중
                    </div>
                    <div>
                      <span className="highlight">{circlesView.reliableWeeks}</span>주
                    </div>
                  </div>
                  <div className="circle-wrapper">
                    <img src="/images/0/cluster4/icon/icon - 일정 신뢰도.png" alt="일정 신뢰도" className="circle-icon" />
                    <div className="circle yellow">
                      <svg viewBox="0 0 100 100">
                        <circle className="bg" cx="50" cy="50" r="40" />
                        <circle className="fill" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - circlesView.scheduleReliability / 100)} />
                      </svg>
                      <div className="percent">{circlesView.scheduleReliability}%</div>
                    </div>
                  </div>
                  <div className="label-main">일정 신뢰도</div>
                </div>
                <div className="circle-item">
                  <div className="label-sub">
                    <div>
                      총 <span className="num-fixed">{circlesView.availableLines}</span>개 중
                    </div>
                    <div>
                      <span className="highlight">{circlesView.completedLines}</span>개
                    </div>
                  </div>
                  <div className="circle-wrapper">
                    <img src="/images/0/cluster4/icon/icon - 시즌 성장률.png" alt="시즌 성장률" className="circle-icon" />
                    <div className="circle green">
                      <svg viewBox="0 0 100 100">
                        <circle className="bg" cx="50" cy="50" r="40" />
                        <circle className="fill" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - circlesView.seasonGrowth / 100)} />
                      </svg>
                      <div className="percent">{circlesView.seasonGrowth}%</div>
                    </div>
                  </div>
                  <div className="label-main">시즌 성장률</div>
                </div>
              </div>

              {/* 영역 7: 실무 성장률 프로그레스 바 (시즌 전체 데이터) */}
              <div className="area-7-progress">
                <div className="progress-item">
                  <div className="progress-header">
                    <span className="name">
                      <img src="/images/0/cluster4/icon/1 실무 정보.png" alt="1" className="progress-icon" /> 실무 <span style={{ color: "#FF9B9B" }}>정보</span> 강화율 <span className="rate-number">{progressView.info.rate}</span>%
                    </span>
                    <span className="value">
                      <img src="/images/0/cluster4/icon/stars.png" alt="stars" className="stars-icon" /> 총 <span className="num-fixed">{progressView.info.total}</span> 개 중 <span className="highlight">{progressView.info.completed}</span> 개
                    </span>
                  </div>
                  <div className="bar">
                    <div className="fill yellow" style={{ width: `${progressView.info.rate}%` }}></div>
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-header">
                    <span className="name">
                      <img src="/images/0/cluster4/icon/2 실무 경험.png" alt="2" className="progress-icon" /> 실무 <span style={{ color: "#FFD09B" }}>경험</span> 강화율 <span className="rate-number">{progressView.experience.rate}</span>%
                    </span>
                    <span className="value">
                      <img src="/images/0/cluster4/icon/stars.png" alt="stars" className="stars-icon" /> 총 <span className="num-fixed">{progressView.experience.total}</span> 개 중 <span className="highlight">{progressView.experience.completed}</span> 개
                    </span>
                  </div>
                  <div className="bar">
                    <div className="fill yellow" style={{ width: `${progressView.experience.rate}%` }}></div>
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-header">
                    <span className="name">
                      <img src="/images/0/cluster4/icon/3 실무 역량.png" alt="3" className="progress-icon" /> 실무 <span style={{ color: "#A8D8A8" }}>역량</span> 강화율 <span className="rate-number">{progressView.competency.rate}</span>%
                    </span>
                    <span className="value">
                      <img src="/images/0/cluster4/icon/stars.png" alt="stars" className="stars-icon" /> 총 <span className="num-fixed">{progressView.competency.total}</span> 개 중 <span className="highlight">{progressView.competency.completed}</span> 개
                    </span>
                  </div>
                  <div className="bar">
                    <div className="fill yellow" style={{ width: `${progressView.competency.rate}%` }}></div>
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-header">
                    <span className="name">
                      <img src="/images/0/cluster4/icon/4 실무 경력.png" alt="4" className="progress-icon" /> 실무 <span style={{ color: "#9BB8FF" }}>경력</span> 강화율 <span className="rate-number">{progressView.career.rate}</span>%
                    </span>
                    <span className="value">
                      <img src="/images/0/cluster4/icon/stars.png" alt="stars" className="stars-icon" /> 총 <span className="num-fixed">{progressView.career.total}</span> 개 중 <span className="highlight">{progressView.career.completed}</span> 개
                    </span>
                  </div>
                  <div className="bar">
                    <div className="fill yellow" style={{ width: `${progressView.career.rate}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 우측 열 (영역 8, 9) */}
            <div className={`right-column ${isTextFading ? "fading" : ""}`}>
              {/* 영역 8: 시즌 상태 */}
              <div className="area-8-season-status">
                <h4 className="section-title">
                  <img className="section-icon" src="/images/0/cluster4/icon - 시즌 상태.png" alt="시즌 상태" /> 시즌 상태{" "}
                  <span className="count-label">
                    <span className="num-fixed">{seasonActivityStatusItems.length}</span>개
                  </span>
                </h4>
                <div style={{ position: "relative" }}>
                  <div ref={statusBadgesRef} className="status-badges" onScroll={updateScrollbar8}>
                    {(() => {
                      // 백엔드 DTO(seasonActivityStatuses) 순서 그대로, 최대 6개까지.
                      // 슬롯은 항상 최소 3줄 유지 — 실제 항목이 3개 미만이면 나머지는 empty placeholder.
                      //   0개 → placeholder 3 · 1개 → 실제1+placeholder2 · 2개 → 실제2+placeholder1
                      //   3~6개 → 실제 개수만 · 6개 초과분은 slice 로 제외.
                      // (count-label 은 실제 DTO 개수만 표시 — placeholder 는 count 에 미포함.)
                      const items = seasonActivityStatusItems.slice(0, 6);
                      const renderCount = Math.min(6, Math.max(3, items.length));
                      return Array.from({ length: renderCount }).map((_, index) => {
                        const statusItem = items[index];
                        if (statusItem) {
                          return (
                            <div className="badge-item" key={index}>
                              <div className="badge-icon">
                                <img src={profilePhotoUrl || "/images/avatar/avatar.png"} alt="profile" />
                              </div>
                              <div className="badge-info">
                                <span className="badge-text">
                                  <span style={{ display: "inline-block", minWidth: "86px", maxWidth: "86px", whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{truncate(statusItem.teamLabel, 6)}</span>{" "}
                                  <span className="separator" style={{ margin: "0 4px 0 0" }}>
                                    |
                                  </span>{" "}
                                  <span className="sub-text" style={{ display: "inline-block", minWidth: "86px", maxWidth: "86px", whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>
                                    {truncate(statusItem.partLabel, 6)}
                                  </span>{" "}
                                  <span className="separator" style={{ margin: "0" }}>
                                    |
                                  </span>
                                </span>
                              </div>
                              <span className="badge-status yellow" style={{ display: "inline-block", width: "fit-content", whiteSpace: "nowrap", fontFamily: "'Pretendard', sans-serif", fontSize: "13px", padding: "4px 10px", marginLeft: "-4px" }}>
                                {truncate(statusItem.statusLabel, 9)}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div className="badge-item empty" key={`empty-${index}`} style={{ cursor: "default" }}>
                            <div className="badge-icon">
                              <div style={{ width: "100%", height: "100%", background: "#555", borderRadius: "50%" }} />
                            </div>
                            <div className="badge-info">
                              <span className="badge-text">
                                <span style={{ display: "inline-block", minWidth: "86px", maxWidth: "86px", whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>-</span>{" "}
                                <span className="separator" style={{ margin: "0 4px 0 0" }}>
                                  |
                                </span>{" "}
                                <span className="sub-text" style={{ display: "inline-block", minWidth: "86px", maxWidth: "86px", whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>
                                  -
                                </span>{" "}
                                <span className="separator" style={{ margin: "0" }}>
                                  |
                                </span>
                              </span>
                            </div>
                            <span className="badge-status yellow" style={{ display: "inline-block", width: "fit-content", whiteSpace: "nowrap", fontFamily: "'Pretendard', sans-serif", fontSize: "13px", padding: "4px 10px", marginLeft: "-4px" }}>
                              -
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {/* 커스텀 스크롤바 (area-8) */}
                  <div style={{ position: "absolute", right: 0, top: 0, width: "2px", height: "100%", background: "rgba(255,227,170,0.15)", borderRadius: "2px" }}>
                    <div ref={scrollThumbRef8} onMouseDown={handleMouseDown8} style={{ position: "absolute", top: `${scrollThumbTop8}px`, width: "100%", height: 61, background: "rgba(255,227,170,1)", borderRadius: "2px", cursor: "pointer" }} />
                  </div>
                </div>
              </div>

              {/* 영역 9: 시즌 평판 */}
              <div className="area-9-season-reputation">
                <div className="season-reputation-header">
                  <img className="section-icon" src="/images/0/cluster4/icon - 시즌 평판.png" alt="시즌 평판" />
                  <span className="section-label">시즌 평판</span>
                  <span className="section-count">
                    <span className="count-num">{seasonReputations.length}</span>/7
                  </span>
                  <span className="fm-badge">
                    <img src="/images/0/cluster4/wifi new.png" alt="wifi" className="wifi-icon" />
                    <span className="fm-label">FM :</span>
                    <span className="fm-value">{(seasonReputations || []).reduce((sum: number, r: any) => sum + (r?.rating ?? 0) * 3, 0)}</span>
                  </span>
                  <div
                    className="edit-icon"
                    onClick={async () => {
                      // 시즌 평판 작성 게이트.
                      // demo / admin → 무조건 통과.
                      // owner(자기 자신) → peer-review 라 자기리뷰 불가.
                      // 그 외 일반 유저 → 승인 상태(canEditSeasonReputation) + 작성 기간(seasonReputationWindowOpen) 모두 통과해야 함.
                      if (!isDemoMode && isOwner) {
                        await popup.alert("시즌 평판은 타 크루끼리 작성합니다.");
                        return;
                      }
                      if (!isDemoMode && !session?.user?.isAdmin) {
                        if (!canEditSeasonReputation) {
                          await popup.alert("관리자 승인 후 작성할 수 있습니다.");
                          return;
                        }
                        if (!seasonReputationWindowOpen) {
                          await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
                          return;
                        }
                      }
                      handleEditClick(openSeasonReputationModal);
                    }}
                  >
                    <i className="ti ti-pencil"></i>
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <div ref={profileCardsRef} className="profile-cards season-reputation-list" onScroll={updateScrollbar9}>
                    {displaySeasonReputations.map((reputation: any) => {
                      if (reputation.isEmpty) {
                        return (
                          <div className="profile-card season-reputation-waiting" key={reputation.id}>
                            <img src="/images/0/waiting.png" alt="waiting" className="waiting-image" />
                            <p className="waiting-message">시즌 평판 대기 중... 😊</p>
                          </div>
                        );
                      }

                        const reviewer = reputation.reviewer;
                        const currentYear = new Date().getFullYear();
                        const birthYear = reviewer?.birth_date ? new Date(reviewer.birth_date).getFullYear() : null;
                        const age = birthYear ? currentYear - birthYear : null;
                        const genderLabel = reviewer?.gender || "-";
                        const fullStars = Math.floor(reputation.rating / 2);
                        const hasHalfStar = reputation.rating % 2 === 1;
                        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

                        return (
                          <div className="profile-card" key={reputation.id}>
                            <div className="corner top-left"></div>
                            <div className="corner top-right"></div>
                            <div className="corner bottom-left"></div>
                            <div className="corner bottom-right"></div>
                            <div className="card-top">
                              <div className="avatar">
                                <img src={reviewer?.profile_photo_url || "/images/avatar/avatar.png"} alt="profile" />
                              </div>
                              <div className="info">
                                <div className="row1">
                                  <span
                                    style={{
                                      display: "inline-block",
                                      minWidth: "48px",
                                      maxWidth: "48px",
                                      whiteSpace: "nowrap",
                                      verticalAlign: "middle",
                                      fontFamily: "'Pretendard', sans-serif",
                                      fontSize: "14px",
                                      textAlign: !reviewer?.display_name || reviewer?.display_name === "-" ? "left" : undefined,
                                    }}
                                  >
                                    {truncate(reviewer?.display_name || "익명", 3)}
                                  </span>{" "}
                                  <span className="separator" style={{ margin: "0 1px" }}>
                                    |
                                  </span>{" "}
                                  <span style={{ display: "inline-block", minWidth: "18px", maxWidth: "18px", whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px", textAlign: genderLabel === "-" ? "left" : undefined }}>{genderLabel}</span>{" "}
                                  <span className="separator" style={{ margin: "0 1px" }}>
                                    |
                                  </span>{" "}
                                  <span style={{ display: "inline-block", minWidth: "2ch", maxWidth: "2ch", textAlign: !age && age !== 0 ? "left" : "right", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{mask.age(age)}</span>{" "}
                                  <span className="separator" style={{ margin: "0 1px" }}>
                                    |
                                  </span>{" "}
                                  <span style={{ minWidth: "85px", width: "85px", flex: "0 0 85px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "clip", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>
                                    {truncate(mask.school(reviewer?.university), 6)}
                                  </span>{" "}
                                  <span className="separator" style={{ margin: "0 1px" }}>
                                    |
                                  </span>{" "}
                                  <span style={{ flex: "1 1 0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{truncate(formatMajor(mask.major(reviewer?.major_first)), 6)}</span>
                                </div>
                                <div className="row2">
                                  <span style={{ minWidth: "85px", width: "85px", flex: "0 0 85px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "clip", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{truncate(reviewer?.teamName, 6)}</span>{" "}
                                  <span className="separator" style={{ margin: "0 1px" }}>
                                    |
                                  </span>{" "}
                                  <span style={{ minWidth: "85px", width: "85px", flex: "0 0 85px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "clip", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{truncate(reviewer?.partName, 6)}</span>
                                  {reviewer?.vision && (
                                    <>
                                      {" "}
                                      <span className="separator" style={{ margin: "0 1px" }}>
                                        |
                                      </span>{" "}
                                      <span style={{ flex: "1 1 0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", verticalAlign: "middle", fontFamily: "'Pretendard', sans-serif", fontSize: "14px" }}>{truncate(reviewer?.vision, 9)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="tags" style={{ display: "flex", gap: "8px", flexWrap: "nowrap" }}>
                              {reputation.keyword_1 && (
                                <span className="tag" style={{ display: "inline-block", width: "fit-content", whiteSpace: "nowrap", fontFamily: "'Pretendard', sans-serif", fontSize: "13px" }}>
                                  #{truncate(reputation.keyword_1 as string, 7)}
                                </span>
                              )}
                              {reputation.keyword_2 && (
                                <span className="tag-yellow" style={{ display: "inline-block", width: "fit-content", whiteSpace: "nowrap", fontFamily: "'Pretendard', sans-serif", fontSize: "13px" }}>
                                  #{truncate(reputation.keyword_2 as string, 7)}
                                </span>
                              )}
                              {reputation.keyword_3 && (
                                <span className="tag" style={{ display: "inline-block", width: "fit-content", whiteSpace: "nowrap", fontFamily: "'Pretendard', sans-serif", fontSize: "13px" }}>
                                  #{truncate(reputation.keyword_3 as string, 7)}
                                </span>
                              )}
                            </div>
                            <div
                              className="comment"
                              style={{ cursor: "pointer" }}
                              onClick={async () => {
                                setSelectedReputation(reputation);
                                setReputationDetailModalOpen(true);
                              }}
                            >
                              <img className="speech-icon" src="/images/0/cluster4/icon - speech.png" alt="speech" />
                              <span className="comment-text">{reputation.content}</span>
                              <span
                                className="arrow-icon"
                                style={{
                                  width: "15px",
                                  height: "15px",
                                  padding: "5px",
                                  flexShrink: 0,
                                  background: orgAccent,
                                  borderRadius: "5px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginRight: "11px",
                                }}
                              >
                                <svg width="11" height="10" viewBox="0 0 11 10" fill="none">
                                  <path d="M1 9L9 1M9 1H3M9 1V7" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            </div>
                            <div className="stats">
                              <span className="pm">
                                <img className="wifi-icon" src="/images/0/cluster4/wifi new.png" alt="wifi" /> FM : <span style={{ display: "inline-block", minWidth: "4ch", textAlign: "right", fontFamily: "'Pretendard', sans-serif" }}>{(reputation.rating ?? 0) * 3}</span>
                              </span>
                              <span className="rating">
                                {[...Array(fullStars)].map((_, i) => (
                                  <img key={`full-${i}`} className="star-icon" src="/images/0/cluster4/icon - star.png" alt="star" />
                                ))}
                                {hasHalfStar && (
                                  <span className="star-half">
                                    <img className="star-half-filled" src="/images/0/cluster4/icon - star.png" alt="star" />
                                    <img className="star-half-empty" src="/images/0/cluster4/icon - star.png" alt="star" />
                                  </span>
                                )}
                                {[...Array(emptyStars)].map((_, i) => (
                                  <img key={`empty-${i}`} className="star-icon empty" src="/images/0/cluster4/icon - star.png" alt="star" />
                                ))}
                                <span className="rating-score">
                                  <span style={{ display: "inline-block", minWidth: "2ch", textAlign: "right", fontFamily: "'Pretendard', sans-serif" }}>{reputation.rating}</span> / 10
                                </span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {/* 커스텀 스크롤바 (area-9) */}
                  <div style={{ position: "absolute", right: 0, top: 0, width: "2px", height: "100%", background: "rgba(255,227,170,0.15)", borderRadius: "2px" }}>
                    <div ref={scrollThumbRef9} onMouseDown={handleMouseDown9} style={{ position: "absolute", top: `${scrollThumbTop9}px`, width: "100%", height: 61, background: "rgba(255,227,170,1)", borderRadius: "2px", cursor: "pointer" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 페이지네이션 */}
        <div className="section3-pagination">
          {seasonPages.length > 0 ? (
            seasonPages.map((_: unknown, index: number) => (
              <span key={index} className={`page-num ${section3Page === index ? "active" : ""} ${index === seasonPages.length - 1 ? "last" : ""}`} onClick={() => handlePageChange(index)}>
                {index + 1}
              </span>
            ))
          ) : (
            <span className="page-num active last">1</span>
          )}
        </div>
      </section>

      {/* ========== 시즌 평판 모달 ========== */}

      {seasonReputationModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-season-reputation-form">
            {/* === 헤더 === */}
            <div className="section-modal-header">
              <button className="modal-close-btn" onClick={handleSeasonReputationFormClose} aria-label="닫기">
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain" as const, flexShrink: 0 }} />
                <h3>시즈닝 평판 (Seasoning Reputation)</h3>
              </div>
              <p className="modal-subtitle">
                혼자 하는 성장이 그 찰나에는 빠를 수 있지만, 멀리, 굳건히, 확실히 가려면 '함께' 가야 합니다! 😊
                <br />
                나와 함께한 동료/선배/후배 크루의 한 주를 평가/응원/조언하고, 상호간의 타산지석으로 삼아보자구요!
              </p>
            </div>

            {/* === 미드 === */}
            <div className="section-modal-body season-reputation-form-body">
              <div className="reputation-form-top">
                {/* 1열: 평점 — cluster-4-card 패턴 */}
                <div className="form-rating-section">
                  <h4>
                    ■ 평점을 입력해주세요. <span className="required-mark">*</span>
                  </h4>
                  <div className={`rating-input rating-field ${seasonReputationSaveAttemptFailed && seasonReputationEditData.rating === 0 ? `field-error ${seasonReputationFieldErrorFlash ? "flash" : ""}` : ""}`} data-field="rating">
                    <span className="star-rating">
                      {(() => {
                        const r = seasonReputationEditData.rating || 0;
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
                      <span className="rating-text">{seasonReputationEditData.rating || 0}/10</span>
                    </span>
                    <div className="custom-dropdown small">
                      <div ref={seasonRatingDropdownTriggerRef} className={`dropdown-selected ${!isSeasonReputationFormEditing ? "disabled" : ""}`} onClick={openSeasonRatingDropdown} role="button" aria-haspopup="listbox" aria-expanded={seasonRatingDropdownOpen}>
                        <span>{seasonReputationEditData.rating || "-"}</span>
                        <i className="ti ti-chevron-down"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2열: 키워드 3슬롯 — cluster-4-card 패턴 + 시즌 3행 */}
                <div className="form-keyword-section">
                  <h4>
                    ■ 키워드를 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 10자)</span>
                  </h4>
                  {[0, 1, 2].map((slotIndex) => {
                    const slotMode = seasonKeywordModes[slotIndex];
                    const slotValue = slotIndex === 0 ? seasonReputationEditData.keyword1 : slotIndex === 1 ? seasonReputationEditData.keyword2 : seasonReputationEditData.keyword3;
                    const allKw = [seasonReputationEditData.keyword1?.trim() || "", seasonReputationEditData.keyword2?.trim() || "", seasonReputationEditData.keyword3?.trim() || ""];
                    const sv = allKw[slotIndex];
                    const slotInvalid = sv.length === 0 || sv.length > 10 || (sv.length > 0 && allKw.filter((k, i) => i !== slotIndex && k === sv).length > 0);
                    const slotErrorClass = seasonReputationSaveAttemptFailed && slotInvalid ? `field-error ${seasonReputationFieldErrorFlash ? "flash" : ""}` : "";
                    return (
                      <div key={slotIndex} className={`season-keyword-row ${slotErrorClass}`} data-slot={slotIndex} data-field={`keyword-${slotIndex}`}>
                        <div className="keyword-mode-select">
                          <label>
                            <input type="radio" name={`keyword-mode-${slotIndex}`} value="select" checked={slotMode === "select"} onChange={() => handleSeasonKeywordModeChange(slotIndex, "select")} disabled={!isSeasonReputationFormEditing} />
                            선택
                          </label>
                          <label>
                            <input type="radio" name={`keyword-mode-${slotIndex}`} value="write" checked={slotMode === "write"} onChange={() => handleSeasonKeywordModeChange(slotIndex, "write")} disabled={!isSeasonReputationFormEditing} />
                            작성
                          </label>
                        </div>
                        <div className="keyword-input-wrapper">
                          <span className="keyword-hash">#</span>
                          <input
                            className="keyword-input"
                            type="text"
                            value={slotValue || ""}
                            onChange={(e) => handleSeasonKeywordWrite(slotIndex, e.target.value)}
                            placeholder="키워드를 입력해주세요."
                            disabled={!isSeasonReputationFormEditing || slotMode === null || slotMode === "select"}
                            maxLength={10}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 미드 2행: 내용 textarea 300자 */}
              <div className="season-content-section">
                <h4>
                  ▪ 내용을 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 300자)</span>
                </h4>
                <div className="season-content-wrapper">
                  <textarea
                    className={`season-content-textarea ${seasonReputationSaveAttemptFailed && (seasonReputationEditData.content?.trim().length || 0) === 0 ? `field-error ${seasonReputationFieldErrorFlash ? "flash" : ""}` : ""}`}
                    value={seasonReputationEditData.content}
                    onChange={(e) => {
                      if (!isSeasonReputationFormEditing) return;
                      const v = e.target.value.slice(0, 300);
                      setSeasonReputationEditData((prev) => ({ ...prev, content: v }));
                    }}
                    placeholder="해당 크루의 한 주 활동을 따뜻하고, 냉철한 시각으로 평가/응원/조언해주세요."
                    maxLength={300}
                    data-field="season-content"
                    disabled={!isSeasonReputationFormEditing}
                  />
                  <span className="char-count">{seasonReputationEditData.content.length}/300</span>
                </div>
              </div>
            </div>

            {/* === 푸터 — Type B === */}
            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <button type="button" className="modal-help-icon" onClick={() => setHelpModalKind("seasonReputation")} aria-label="도움말">
                  🔎
                </button>
                <div className="modal-footer-right">
                  {!isSeasonReputationFormEditing ? (
                    <button type="button" className="modal-edit-btn" onClick={handleSeasonReputationEditClick}>
                      수정
                    </button>
                  ) : (
                    <>
                      <button type="button" className="modal-cancel-btn" onClick={handleSeasonReputationCancel}>
                        취소
                      </button>
                      <button type="button" className="modal-reset-btn" onClick={handleSeasonReputationReset}>
                        초기화
                      </button>
                      <button type="button" className="modal-save-btn" onClick={handleSeasonReputationSave}>
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom">
                <p className={`modal-footer-notice ${seasonReputationSaveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: seasonReputationSaveAttemptFailed ? "visible" : "hidden" }}>
                  필수 항목을 모두 입력해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 시즌 평판 상세 보기 모달 (가이드 적용) ========== */}
      {reputationDetailModalOpen && selectedReputation && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-season-reputation-view">
            {/* === 헤더 === */}
            <div className="section-modal-header">
              <button type="button" className="modal-delete-btn" onClick={handleDeleteSeasonReputation}>
                삭제
              </button>
              <button className="modal-close-btn" onClick={handleSeasonReputationViewClose} aria-label="닫기">
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain" as const, flexShrink: 0 }} />
                <h3>시즈닝 평판 (Seasoning Reputation)</h3>
              </div>
              <p className="modal-subtitle">저는 당신의 한 시즌을 아래와 같이 바라보았습니다. 당신의 땀방울에 제가 함께 있어요. 😊</p>
            </div>

            {/* === 미드 === */}
            <div className="section-modal-body season-reputation-view-body">
              {/* 인적사항 카드 — 보낸 사람 정보 */}
              <div className="workinfo-personal-card">
                <div className="personal-grid">
                  {(() => {
                    // 보낸 사람(reviewer) 인적사항 — 공통 resolvePersonalInfo 로 alias fallback 통일.
                    // reviewer DTO: display_name/gender/birth_date/profile_photo_url/vision +
                    //   university(=school_name)/major_first/teamName/partName (role 미포함 → tag-role "-").
                    const pi = resolvePersonalInfo({ profile: selectedReputation.reviewer });
                    return (
                      <>
                        <div className="personal-photo">
                          <img src={pi.profileImageUrl || "/images/0/crew profile/남 1.webp"} alt="프로필" />
                        </div>
                        <div className="personal-info">
                          <div className="personal-row-1">
                            <span className="personal-name">{pi.name || "-"}</span>
                            <span className="personal-separator">|</span>
                            <span className="personal-gender">{pi.gender || "-"}</span>
                            <span className="personal-separator">|</span>
                            <span className="personal-age">{pi.age != null ? `${pi.age} 세` : "-"}</span>
                          </div>
                          <div className="personal-row-2">
                            <span className="personal-field">
                              <span className="field-value">{pi.school || "-"}</span>
                              <span className="field-label">학교</span>
                            </span>
                            <span className="personal-separator">|</span>
                            <span className="personal-field">
                              <span className="field-value">{formatMajor(pi.department)}</span>
                              <span className="field-label">학과</span>
                            </span>
                          </div>
                          <div className="personal-row-3">
                            <span className="personal-field">
                              <span className="field-value">{pi.team || "-"}</span>
                              <span className="field-label">팀</span>
                            </span>
                            <span className="personal-separator">|</span>
                            <span className="personal-field">
                              <span className="field-value">{pi.part || "-"}</span>
                              <span className="field-label">파트</span>
                            </span>
                          </div>
                        </div>
                        <div className="personal-tags">
                          <span className="tag-badge tag-role">{formatMembershipRoleLabel(pi.membershipLevel)}</span>
                          <span className="tag-badge tag-keyword">{pi.tagline || "키워드"}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 어드민 전용: 수정/삭제 버튼 */}
                {session?.user?.isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setSeasonReputationEditData({
                          rating: selectedReputation.rating,
                          content: selectedReputation.content,
                          keyword1: selectedReputation.keyword_1 || '',
                          keyword2: selectedReputation.keyword_2 || '',
                          keyword3: selectedReputation.keyword_3 || '',
                        });
                        setEditingReputationId(selectedReputation.id);
                        setReputationDetailModalOpen(false);
                        setSeasonReputationModalOpen(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: isPX ? 'rgba(30, 149, 3, 0.2)' : isEC ? 'rgba(255, 75, 112, 0.2)' : 'rgba(250, 171, 7, 0.2)',
                        border: `1px solid ${isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07'}`,
                        borderRadius: '6px',
                        color: isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >수정</button>
                    <button
                      onClick={async () => {
                        if (!confirm('이 평판을 삭제하시겠습니까?')) return;
                        try {
                          const res = await fetch(apiUrl(`/api/season-reputations?id=${selectedReputation.id}`), { method: 'DELETE' });
                          const json = await res.json();
                          if (json.success) {
                            alert('삭제되었습니다.');
                            setReputationDetailModalOpen(false);
                            const targetId = urlUserId || session?.user?.id;
                            if (targetId && currentSeason?.id) fetchSeasonReputations(targetId, currentSeason.id);
                          } else {
                            alert(json.error || '삭제 실패');
                          }
                        } catch { alert('삭제 중 오류 발생'); }
                      }}
                      style={{ padding: '8px 16px', background: 'rgba(255, 60, 60, 0.2)', border: '1px solid #ff3c3c', borderRadius: '6px', color: '#ff3c3c', fontSize: '13px', cursor: 'pointer' }}
                    >삭제</button>
                  </div>
                )}
              </div>

              {/* 키워드 3개 + 내용 */}
              <div className="season-reputation-content-section">
                <div className="season-reputation-keywords">
                  {[selectedReputation.keyword_1, selectedReputation.keyword_2, selectedReputation.keyword_3].map((kw, i) => (
                    <span key={i} className="tag tag--pink">
                      {kw ? `#${kw}` : "#-"}
                    </span>
                  ))}
                </div>
                <div className="season-reputation-content-box">
                  <p className="season-reputation-content-text">{selectedReputation.content || "-"}</p>
                </div>
              </div>

              {/* 평점 + FM */}
              <div className="season-reputation-stats-row">
                <div className="season-reputation-rating">
                  <span className="stats-label">■ 평점</span>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const r = (selectedReputation.rating || 0) / 2;
                      let cls = "rating-star star-empty";
                      if (r >= i) cls = "rating-star star-full";
                      else if (r >= i - 0.5) cls = "rating-star star-half";
                      return (
                        <span key={i} className={cls}>
                          ★
                        </span>
                      );
                    })}
                  </div>
                  <span className="rating-value">{selectedReputation.rating ? `${selectedReputation.rating} / 10` : "- / 10"}</span>
                </div>
                <div className="season-reputation-fm">
                  <span className="stats-label">■ FM</span>
                  <span className="fm-value">{(selectedReputation.rating ?? 0) * 3}</span>
                </div>
              </div>

              {/* 구분선 + 타임스탬프 */}
              <div className="season-reputation-bottom-section">
                <div className="season-reputation-bottom-divider"></div>
                <div className="season-reputation-timestamp">
                  <span>{formatSeasonReputationTime(selectedReputation.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 별점 드롭다운 옵션 패널 (season-reputation form) */}
      {seasonRatingDropdownOpen && (
        <div
          className="dropdown-options-fixed season-rating-dropdown-options"
          style={{
            position: "fixed",
            top: seasonRatingDropdownPos.top,
            left: seasonRatingDropdownPos.left,
            width: Math.max(seasonRatingDropdownPos.width, 70),
            zIndex: 100010,
          }}
          role="listbox"
          onWheel={(e) => e.stopPropagation()}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className={`dropdown-option${seasonReputationEditData.rating === n ? " selected" : ""}`} onClick={() => handleSeasonRatingSelect(n)} role="option" aria-selected={seasonReputationEditData.rating === n}>
              {n}
            </div>
          ))}
        </div>
      )}

      {/* ========== 키워드 선택 중첩 모달 (cluster-4-card 패턴 통일) ========== */}
      {seasonKeywordModalOpen && (
        <div className="section-modal-overlay keyword-select-overlay">
          <div className="section-modal keyword-select-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-modal-header">
              <button type="button" className="modal-close-btn" onClick={handleSeasonKeywordModalClose} aria-label="키워드 선택 모달 닫기">
                <i className="ti ti-x"></i>
              </button>
              <button type="button" className="btn-select-header" onClick={handleSeasonKeywordSelectConfirm} disabled={!seasonKeywordTempSelection}>
                선택
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: 72, height: 72, objectFit: "contain" as const, flexShrink: 0 }} />
                <h3>키워드를 선택해주세요. 😊</h3>
              </div>
            </div>
            <div className="section-modal-body keyword-select-body">
              {(() => {
                const usedKeywords = seasonKeywordTargetSlot !== null ? getSeasonKeywordsUsedByOtherSlots(seasonKeywordTargetSlot) : [];
                const clusterColorMap: Record<number, string> = { 1: "group-blue", 2: "group-green", 3: "group-yellow", 4: "group-orange", 5: "group-red" };
                const groupedByCluster: Record<number, typeof reputationKeywords> = {};
                reputationKeywords.forEach((kw) => {
                  if (!groupedByCluster[kw.cluster_number]) groupedByCluster[kw.cluster_number] = [];
                  groupedByCluster[kw.cluster_number].push(kw);
                });
                const clusterNumbers = Object.keys(groupedByCluster)
                  .map(Number)
                  .sort((a, b) => a - b);
                if (clusterNumbers.length === 0) return <div className="season-keyword-loading">키워드를 불러오는 중입니다...</div>;
                return clusterNumbers.map((clusterNum) => {
                  const items = groupedByCluster[clusterNum];
                  const clusterName = items[0]?.cluster_name || "";
                  const colorClass = clusterColorMap[clusterNum] || "group-blue";
                  return (
                    <div key={clusterNum} className={`keyword-group ${colorClass}`}>
                      <h4 className="group-title">
                        [군락 {clusterNum}] {clusterName}
                        <span className="group-count">({items.length}개)</span>
                      </h4>
                      <div className="keyword-grid">
                        {items.map((kw) => {
                          const isUsedByOther = usedKeywords.includes(kw.keyword);
                          const isSelected = seasonKeywordTempSelection === kw.keyword;
                          return (
                            <button
                              key={kw.id}
                              type="button"
                              className={`keyword-chip ${isSelected ? "selected" : ""} ${isUsedByOther ? "disabled" : ""}`}
                              onClick={() => !isUsedByOther && handleSeasonKeywordTempSelect(kw.keyword)}
                              disabled={isUsedByOther}
                              title={isUsedByOther ? "다른 슬롯에서 이미 사용 중인 키워드입니다" : undefined}
                            >
                              {kw.keyword}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========== 도움말 모달 ========== */}
      {helpModalKind && (
        <div className="help-modal-overlay" onClick={() => setHelpModalKind(null)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button className="modal-close-btn" onClick={() => setHelpModalKind(null)} aria-label="닫기">
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <HelpModalBody helpKey={helpModalKind} />
          </div>
        </div>
      )}

      {/* ========== 시즌 리뷰 모달 ========== */}
      {seasonReviewModalOpen && (
        <div className="section-modal-overlay">
          <div className="section-modal section-modal-season-review" onClick={(e) => e.stopPropagation()}>
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>시즌 리뷰</h3>
              </div>
              <p className="modal-subtitle">이번 시즌을 어떻게 경험하고, 성장했는지 기록해주세요.</p>
              <button className="modal-close-btn" onClick={handleSeasonReviewClose} aria-label="닫기">
                <i className="ti ti-x"></i>
              </button>
            </div>

            <div className="section-modal-body season-review-body">
              <div className="season-review-row-1">
                <div className="season-info-section">
                  <h4>시즌</h4>
                  <div className="season-info-display">
                    {currentSeasonInfo?.year || currentSeason.year}년 {currentSeasonInfo?.name || currentSeason.season} 시즌
                  </div>
                </div>
                <div className="season-review-rating-section">
                  <h4>
                    평점 <span className="required-mark">*</span>
                  </h4>
                  <div className={`rating-input rating-field ${seasonReviewSaveAttemptFailed && seasonReviewEditData.rating === 0 ? `field-error ${seasonReviewFieldErrorFlash ? "flash" : ""}` : ""}`} data-field="rating">
                    <span className="star-rating">
                      {(() => {
                        const r = seasonReviewEditData.rating || 0;
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
                      <span className="rating-text">{seasonReviewEditData.rating || 0}/10</span>
                    </span>
                    <div className="custom-dropdown small">
                      <div
                        ref={seasonReviewRatingDropdownTriggerRef}
                        className={`dropdown-selected ${!isSeasonReviewFormEditing ? "disabled" : ""}`}
                        onClick={openSeasonReviewRatingDropdown}
                        role="button"
                        tabIndex={isSeasonReviewFormEditing ? 0 : -1}
                        aria-haspopup="listbox"
                        aria-expanded={seasonReviewRatingDropdownOpen}
                      >
                        <span>{seasonReviewEditData.rating || "-"}</span>
                        <i className="ti ti-chevron-down"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 인적사항 카드 — user_profiles + user_educations 실데이터 */}
              <div className="workinfo-personal-card">
                <div className="personal-grid">
                  {(() => {
                    // 페이지 주인 인적사항 — 공통 resolvePersonalInfo 로 alias fallback 통일.
                    //   profile: seasonReviewerProfile(/api/profile + /api/educations 매핑), user: 세션.
                    //   팀/파트: 해당 시즌 최신 역할(seasonRoles 마지막 원소) 메타로 보강.
                    //   ⚠ 데모 모드는 개인정보 마스킹 정책 유지(이름 외 "-"), 팀/파트·역할은 더미 그대로.
                    const sr = currentSeason.seasonRoles;
                    const latest = sr && sr.length > 0 ? sr[sr.length - 1] : null;
                    const pi = resolvePersonalInfo({
                      profile: {
                        displayName: seasonReviewerProfile.displayName,
                        gender: seasonReviewerProfile.gender,
                        age: seasonReviewerProfile.age,
                        school: seasonReviewerProfile.school,
                        major: seasonReviewerProfile.major,
                        profilePhotoUrl: seasonReviewerProfile.profilePhotoUrl,
                        vision: seasonReviewerProfile.vision,
                      },
                      user: session?.user,
                      weeklyCardMeta: latest ? { teamName: latest.teamName, partName: latest.partName } : null,
                      // 팀/파트/멤버십/태그라인 — seasonRoles 가 비면 /api/profile data 로 채운다.
                      fallbackProfile: ownerProfileData,
                    });
                    // 역할 라벨: 시즌 최신 roleLabel(이미 한글) 우선. 없으면(seasonRoles 빈 경우) 멤버십 등급
                    //   (일반/심화 — /api/profile membership_level) 을 우선 표시하고, 그래도 없으면 role 코드로 폴백.
                    const roleLabel = latest?.roleLabel
                      ? latest.roleLabel
                      : formatMembershipRoleLabel(pi.membershipLevel || currentSeason.roleInSeason || userDefaultRole || "");
                    return (
                      <>
                        <div className="personal-photo">
                          <img
                            src={
                              isDemoMode
                                ? (profilePhotoUrl || session?.user?.image || "/images/avatar/avatar.png")
                                : (pi.profileImageUrl || profilePhotoUrl || "/images/avatar/avatar.png")
                            }
                            alt="프로필"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/images/avatar/avatar.png"; }}
                          />
                        </div>
                        <div className="personal-info">
                          <div className="personal-row-1">
                            <span className="personal-name">
                              {isDemoMode
                                ? (session?.user?.name || demoUserName || "-")
                                : (pi.name || "-")}
                            </span>
                            <span className="personal-separator">|</span>
                            <span className="personal-gender">{isDemoMode ? "-" : (pi.gender || "-")}</span>
                            <span className="personal-separator">|</span>
                            <span className="personal-age">{isDemoMode ? "-" : (pi.age ?? "-")}</span>
                          </div>
                          <div className="personal-row-2">
                            <span className="personal-field">
                              <span className="field-value">{isDemoMode ? "-" : (pi.school || "-")}</span>
                              <span className="field-label">학교</span>
                            </span>
                            <span className="personal-separator">|</span>
                            <span className="personal-field">
                              <span className="field-value">{isDemoMode ? "-" : formatMajor(pi.department)}</span>
                              <span className="field-label">학과</span>
                            </span>
                          </div>
                          <div className="personal-row-3">
                            <span className="personal-field"><span className="field-value">{pi.team || "-"}</span><span className="field-label">팀</span></span>
                            <span className="personal-separator">|</span>
                            <span className="personal-field"><span className="field-value">{pi.part || "-"}</span><span className="field-label">파트</span></span>
                          </div>
                        </div>
                        <div className="personal-tags">
                          <span className="tag-badge tag-role">{roleLabel}</span>
                          <span className="tag-badge tag-keyword">
                            {isDemoMode ? "-" : (pi.tagline || "-")}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="season-review-content-section" data-field="review">
                <h4>
                  Season Review <span className="required-mark">*</span>
                  <span className="limit-hint">(최대 300자)</span>
                </h4>
                <div className="content-wrapper">
                  <textarea
                    className={`content-textarea season-review-textarea ${seasonReviewSaveAttemptFailed && (seasonReviewEditData.review?.trim().length || 0) === 0 ? `field-error ${seasonReviewFieldErrorFlash ? "flash" : ""}` : ""}`}
                    value={seasonReviewEditData.review || ""}
                    onChange={(e) => {
                      if (!isSeasonReviewFormEditing) return;
                      setSeasonReviewEditData((prev) => ({ ...prev, review: e.target.value.slice(0, 300) }));
                      if (seasonReviewSaveAttemptFailed) setSeasonReviewSaveAttemptFailed(false);
                    }}
                    placeholder="이번 시즌의 경험, 성과, 성장을 300자 이내로 작성해주세요."
                    maxLength={300}
                    disabled={!isSeasonReviewFormEditing}
                  />
                  <div className="char-count">{seasonReviewEditData.review?.length || 0}/300</div>
                </div>
              </div>
            </div>

            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <button type="button" className="modal-help-icon" onClick={() => setHelpModalKind("seasonReview")} aria-label="도움말">
                  🔎
                </button>
                <div className="modal-footer-right">
                  {!isSeasonReviewFormEditing ? (
                    <button
                      type="button"
                      className="modal-edit-btn"
                      onClick={handleSeasonReviewEditClick}
                      disabled={!isOwner}
                      style={!isOwner ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
                      title={isOwner ? "수정" : "본인 시즌 리뷰만 수정할 수 있습니다"}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button type="button" className="modal-cancel-btn" onClick={handleSeasonReviewCancel}>
                        취소
                      </button>
                      <button type="button" className="modal-reset-btn" onClick={handleSeasonReviewReset}>
                        초기화
                      </button>
                      <button type="button" className="modal-save-btn" onClick={handleSaveSeasonReview} disabled={seasonReviewSaving}>
                        {seasonReviewSaving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom">
                <p className={`modal-notice ${seasonReviewSaveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: seasonReviewSaveAttemptFailed ? "visible" : "hidden" }}>
                  필수 항목을 입력해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {seasonReviewRatingDropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`dropdown-options-fixed season-review-rating-dropdown-options ${getThemeClass(pathname)}`.trim()}
            style={{ position: "fixed", top: seasonReviewRatingDropdownPos.top, left: seasonReviewRatingDropdownPos.left, width: Math.max(seasonReviewRatingDropdownPos.width, 70), zIndex: 100010 }}
            role="listbox"
            onWheel={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} className={`dropdown-option${seasonReviewEditData.rating === n ? " selected" : ""}`} onClick={() => handleSeasonReviewRatingSelect(n)} role="option" aria-selected={seasonReviewEditData.rating === n}>
                {n}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {false && seasonReviewModalOpen && (
        <div className="season-review-overlay">
          <div className="edit-modal-content season-review-modal">
            {/* Header */}
            <div className="edit-modal-header">
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: orgAccent }}>✦ 시즌 리뷰</h3>
              <span className="modal-subtitle" style={{ color: "#999", fontSize: "14px" }}>
                이번 시즌에 대한 나의 평가를 남겨주세요
              </span>
            </div>

            {/* Body */}
            <div className="edit-modal-body">
              {/* 평점 선택 */}
              <div className="slogan-rating-row" style={{ marginBottom: "20px" }}>
                <label className="slogan-rating-label" style={{ color: orgAccent, fontSize: "14px", fontWeight: 600 }}>
                  평점
                </label>
                <div className="slogan-star-rating">
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const fullValue = starIndex * 2;
                    const halfValue = starIndex * 2 - 1;
                    const currentRating = seasonReviewEditData.rating;
                    const isHalf = currentRating >= halfValue && currentRating < fullValue;
                    const isFull = currentRating >= fullValue;
                    return (
                      <div key={starIndex} className="star-wrapper">
                        <svg className="star-bg" viewBox="0 0 24 24" fill="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="#FFA500" strokeWidth="2" />
                        </svg>
                        {isHalf && (
                          <svg className="star-half-fill" viewBox="0 0 24 24">
                            <defs>
                              <clipPath id={`reviewHalfClip-${starIndex}`}>
                                <rect x="0" y="0" width="12" height="24" />
                              </clipPath>
                            </defs>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FFA500" clipPath={`url(#reviewHalfClip-${starIndex})`} />
                          </svg>
                        )}
                        {isFull && (
                          <svg className="star-full-fill" viewBox="0 0 24 24">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FFA500" />
                          </svg>
                        )}
                        <button className="star-click-area star-click-left" type="button" onClick={() => setSeasonReviewEditData((prev) => ({ ...prev, rating: halfValue }))} />
                        <button className="star-click-area star-click-right" type="button" onClick={() => setSeasonReviewEditData((prev) => ({ ...prev, rating: fullValue }))} />
                      </div>
                    );
                  })}
                </div>
                <span className="slogan-rating-value">{seasonReviewEditData.rating} / 10</span>
              </div>

              {/* 리뷰 입력 */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: orgAccent, marginBottom: "10px" }}>
                  한줄평 <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>(최대 300자)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="이번 시즌은 어땠나요? (300자 이내)"
                    maxLength={300}
                    value={seasonReviewEditData.review}
                    onChange={async (e) => {
                      if (e.target.value.length > 300) {
                        await popup.alert("최대 300자까지 입력할 수 있습니다.");
                        return;
                      }
                      setSeasonReviewEditData((prev) => ({ ...prev, review: e.target.value }));
                    }}
                    style={{
                      width: "100%",
                      height: "56px",
                      padding: "16px 60px 16px 16px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {seasonReviewEditData.review.length} / 300
                  </span>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="edit-modal-footer">
              <button
                onClick={() => setSeasonReviewModalOpen(false)}
                disabled={seasonReviewSaving}
                style={{ padding: "10px 24px", border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: "14px", cursor: seasonReviewSaving ? "not-allowed" : "pointer", opacity: seasonReviewSaving ? 0.5 : 1 }}
              >
                취소
              </button>
              <button
                onClick={handleSaveSeasonReview}
                disabled={seasonReviewSaving || seasonReviewSuccess || !seasonReviewEditData.review.trim()}
                style={{
                  padding: "10px 24px",
                  border: "none",
                  background: seasonReviewSaving || seasonReviewSuccess || !seasonReviewEditData.review.trim()
                    ? "#444"
                    : isPX
                    ? "linear-gradient(135deg, #1E9503 0%, #167702 100%)"
                    : isEC
                    ? "linear-gradient(135deg, #FF4B70 0%, #D63556 100%)"
                    : "linear-gradient(135deg, #FAAB07 0%, #E09A06 100%)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: seasonReviewSaving || seasonReviewSuccess || !seasonReviewEditData.review.trim() ? "not-allowed" : "pointer",
                }}
              >
                {seasonReviewSaving ? "저장 중..." : seasonReviewSuccess ? "완료!" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cluster4Content;

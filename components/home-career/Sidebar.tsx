"use client";
import Image from "next/image";
import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/ProfileContext";
import { dedupedJson } from "@/lib/fetch-dedupe";
import { useDataMasking } from "@/hooks/useDataMasking";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { DUMMY_USER_PROFILE, DUMMY_SIDEBAR_EXTRA } from "@/constants/dummyData";
import { SECTION2_SLOGAN_DEFAULTS } from "@/constants/dummyData/cluster2-section2-default";
import { useResumeCardHeight } from "@/hooks/useResumeCardHeight";
import { useModalScroll } from "@/utils/useModalScroll";
import { usePopup } from "@/components/ui/popup";
import { logEvent } from "@/utils/blackScreenDiagnostics";
import koreaRegionsData from "@/data/korea-regions.json";
import { isPxRoute, isEcRoute, getThemeClass, withPxRoute, getOrgConfigFromPathname, getOrgMascotSrc, getOrgStampSrc } from "@/lib/cluster-route";
import { RESUME_ROLE_CLASS_LABELS } from "@/lib/crewClassLabel";
import { LoadingPanel } from "@/components/ui/loading/LoadingPanel";
import { progressStatusToSeasonKey, RESUME_SEASON_BADGE_TEXT, type SeasonStatusKey } from "@/lib/cluster4-status-label";

const koreaRegions: { [key: string]: string[] } = koreaRegionsData;
const DEFAULT_PHONE_COMMENT = "평일 오전 10시 ~ 오후 20시 사이에 언제든지 연락가능합니다. 주말은 문자나 텍스트로만 부탁드려요! 😊";

// hexagon 아이콘 링크 기본값 — admin resumeCardSettings 미설정 시 fallback.
// 사용자 전환 reset 과 useState 초기값 두 곳에서 공용(값 표류 방지).
const DEFAULT_ICON_LINK_1 = "https://www.google.com/";
const DEFAULT_ICON_LINK_2 = "https://youtu.be/xf6q5dgn1hU?si=tNK3I1-QIsJ9JmvF";
const DEFAULT_ICON_LINK_3 = "https://www.naver.com/";

// 메달 뱃지 crewStatus 타입/매핑 — 캐시 init·fetch 두 경로 공용 단일 정의.
type CrewStatus = "Running" | "Complete" | "On Rest" | "Recharging" | "Next Challenge";
const CREW_STATUS_MAP: Record<string, CrewStatus> = {
  active: "Running",
  weekly_rest: "On Rest",
  seasonal_rest: "Recharging",
  graduated: "Complete",
  suspended: "Next Challenge",
};
// 메달 상태 판정 — API DTO 값 그대로 매핑 (프론트 임의 계산 금지).
// 종단 상태(graduated/suspended)는 user_profiles.status 가 active 로 남아 있어도
// growthInfo.growthStatus(raw enum)로 판정한다 — 이력서 카드 '정상 졸업'/'활동 중단'
// 뱃지·cluster4 성장 배지와 동일 판정(공용 라벨 SoT 와 같은 raw enum 기준).
// growthInfo.currentSeasonStatus === 'rest'(시즌 휴식, user_season_statuses SoT)면
// user_profiles.status 가 active 여도 Recharging(시즌 휴식 뱃지)으로 표시한다.
// demoUserId 테스트 모드도 동일 DTO(/api/profile)를 쓰므로 두 모드 매핑이 갈리지 않는다.
const resolveCrewStatus = (
  profileStatus: string | null | undefined,
  currentSeasonStatus: string | null | undefined,
  growthStatus?: string | null,
): CrewStatus => {
  if (profileStatus === "graduated" || growthStatus === "graduated") return "Complete";
  // 성장 중단 계열(suspended/paused/deferred) → Next Challenge.
  //   종전에는 suspended 만 매핑해, growth_status=paused(성장 유보·중단) 사용자가
  //   user_profiles.status='active' 인 채로 "Running"으로 잘못 표시됐다(2026-06-16 수정).
  //   admin RESUME_BADGE_BY_GROWTH_STATUS(paused/suspended→next_challenge) ·
  //   고객 getGrowthBadgeText(성장 중단 집합)과 동일한 raw enum 기준으로 통일.
  if (
    profileStatus === "suspended" ||
    growthStatus === "suspended" ||
    growthStatus === "paused" ||
    growthStatus === "deferred"
  )
    return "Next Challenge";
  if (currentSeasonStatus === "rest") return "Recharging";
  return (profileStatus && CREW_STATUS_MAP[profileStatus]) || "Running";
};

// resume-card .resume-badges point 값 정규화.
//   number → 그대로(NaN 은 0) / 문자열 숫자 → Number() / null·undefined·기타 → 0.
// API(/api/profile)의 point.{check,advantage,penalty} 표시 전용 — 어드민 값 방어적 정규화.
const toPointNum = (value: unknown): number => {
  if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
};

const resolveCareerSkillCount = (source: {
  practicalStats?: { careerProjectCount?: unknown } | null;
  practicalCounts?: { career?: unknown } | null;
  careerActivityCount?: unknown;
}): number | null => {
  const candidates = [
    source.practicalStats?.careerProjectCount,
    source.practicalCounts?.career,
    source.careerActivityCount,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
};

const IDENTITY_TAB_IMAGES = [
  { src: "/images/0/cluster 1/identity-tab-bg-1.png", overlay: 0.45 },
  { src: "/images/0/cluster 1/identity-tab-bg-2.png", overlay: 0.45 },
  { src: "/images/0/cluster 1/identity-tab-bg-3.png", overlay: 0.65 },
  { src: "/images/0/cluster 1/identity-tab-bg-4.png", overlay: 0.45 },
];

// =============================================================
// /api/profile 응답 → sidebar resume-card 의 userProfile state shape.
//
// resume-card 의 detail-row(성별/생년/주소/전화/이메일/학교/학과/팀/파트/멤버십)
// 데이터 매핑은 이전까지 두 경로(cache-init useLayoutEffect + fetchUserProfile)에
// 각각 inline 으로 작성되어 있었다. 두 mapping 이 서로 달라
//   - cache-init: team/part/membershipLevel **누락**
//   - fetchUserProfile: 전 필드 채움
// 인 상태였고, 둘 다 fire 되는 케이스(/crews → /cluster-4-px 진입)에서
// 늦게 도착한 cache-init 이 fetchUserProfile 결과를 incomplete 로 덮어써
// "최초 진입 시 학교/학과 아래 detail-row 가 빈 상태로 보이고,
//  cluster tab 한 번 이동 후 돌아오면 그제서야 채워지는" 버그가 발생했다.
//
// 본 helper 로 단일 mapping 을 강제 → 두 경로 모두 동일한 full set 을 produce.
// =============================================================
type SidebarUserProfile = {
  name: string;
  nameEng: string;
  gender: string;
  birthDate: string;
  city: string;
  district: string;
  address?: string;
  phone: string;
  email: string;
  school: string;
  major: string;
  major2: string;
  major3: string;
  enrollPeriod: string;
  graduationStatus: string;
  gpa: string;
  gpaMax: string;
  quote: string;
  photo: string;
  team: string;
  part: string;
  membershipLevel: string;
};

const buildSidebarUserProfile = (
  // /api/profile 응답의 data (snake_case + enriched team_name/part_name/membership_level)
  profile: Record<string, unknown>,
  initialQuote: string,
): SidebarUserProfile => {
  // 진단 로그 — 최초 진입 vs tab 전환 시 raw field 존재 여부 비교용.
  // detail-row 가 빈 채로 렌더되는 회귀가 의심되면 본 로그로 우선 확인.
  // eslint-disable-next-line no-console
  console.log("[buildSidebarUserProfile] raw fields", {
    has_display_name: !!profile.display_name,
    has_school_name: !!profile.school_name,
    has_major_name_1: !!profile.major_name_1,
    has_team_name: !!profile.team_name,
    has_part_name: !!profile.part_name,
    has_membership_level: !!profile.membership_level,
  });
  const address = (profile.address as string | null) ?? "";
  const addressParts = address.split(" ");
  const rawPhone = (profile.phone as string | null) ?? "";
  const rawBirth = (profile.birth_date as string | null) ?? "";
  return {
    name: (profile.display_name as string | null) ?? "",
    // 영문명(name-eng): admin API 가 노출하는 englishName(crew.englishName / bundle.englishName
    // 의 camelCase 미러) → english_name(user_profiles 정규 컬럼, bundle.profile.english_name)
    // → eng_name(레거시) → placeholder("") 순으로 fallback. read-only 표시이며
    // displayName(한글 이름, profile.display_name) 영역은 건드리지 않는다.
    nameEng:
      (profile.englishName as string | null) ??
      (profile.english_name as string | null) ??
      (profile.eng_name as string | null) ??
      "",
    gender: (profile.gender as string | null) ?? "",
    birthDate: rawBirth ? rawBirth.replace(/-/g, ".") : "",
    city: addressParts[0] || "",
    district: addressParts.slice(1).join(" ") || "",
    address,
    phone: rawPhone
      ? rawPhone
          .replace(/-/g, "")
          .replace(/(\d{3})(\d{1})\d{3}(\d{4})/, "$1-$2***-****")
      : "",
    email: (profile.email as string | null) ?? "",
    // school/major 는 1차로 /api/profile enrichment 값을 채우고,
    // fetchEducations() 가 이후 더 풍부한 데이터(period/gpa 포함)로 refine.
    school: (profile.school_name as string | null) ?? "",
    major:
      (profile.major_name_1 as string | null) ??
      (profile.department_name as string | null) ??
      "",
    major2: "",
    major3: "",
    enrollPeriod: "",
    graduationStatus: "",
    gpa: "",
    gpaMax: "",
    quote: initialQuote,
    photo: (profile.profile_photo_url as string | null) ?? "",
    // user_memberships enrichment — 누락되면 학교/학과 아래 detail-row 가
    // 빈 채로 렌더되는 버그가 재발하므로 반드시 helper 안에서 채운다.
    team: (profile.team_name as string | null) ?? "",
    part: (profile.part_name as string | null) ?? "",
    membershipLevel: (profile.membership_level as string | null) ?? "",
  };
};

const Sidebar = () => {
  const { alert: showAlert, confirm: popupConfirm } = usePopup();
  const showConfirm = useCallback(async (message: string, onConfirm: () => void | Promise<void>) => {
    if (await popupConfirm(message)) {
      await onConfirm();
    }
  }, [popupConfirm]);
  // SSR-safe: 첫 렌더는 항상 [0], 마운트 후 useEffect에서 random 갱신
  const [tabBg, setTabBg] = useState(IDENTITY_TAB_IMAGES[0]);
  const { data: session, status: sessionStatus } = useSession();
  const { mask, isAdmin } = useDataMasking();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // PX 라우트 컨텍스트 — pathname segment 중 하나라도 -px 로 끝나면 PX 색 사용.
  // 동적 subpath 포함 매칭. non-PX 라우트는 false → 기존 색 그대로.
  // 판정 로직은 lib/cluster-route 로 일원화.
  const isPX = isPxRoute(pathname);

  // Phase D5 — Sidebar inline accent theme helper.
  //
  // Sidebar 는 main-layout / cluster-pages layout / career / index-two 등 거의
  // 모든 페이지에 렌더됨. inline style hardcode (`#FFA500`, `rgba(255,165,0,X)`)
  // 가 ~70건 분포 — Edit Profile Modal portal, date/address/email dropdown
  // selected·hover, Phone Comment/Help modal, Mobile Profile slide-out 등.
  //
  // SCSS override 는 portal/inline style/styled-jsx/hover handler 에 닿지 못
  // 하므로 본 변수로 일괄 분기. cluster route 의 -px/-ec suffix 만 매칭하며
  // 비-cluster 라우트(/career, /index-two 등) 는 default yellow 유지.
  //
  // alpha helper 는 rgba 정밀 alpha 값을 함수로 받아 톤 유지.
  // gradient 는 mobile profile slide-out tab 의 vertical PROFILE 버튼 등 단일
  // 위치 쓰임.
  // Phase D5-B — sidebarAccent / sidebarThemeClass 에 query `org` 분기 추가.
  //
  // 원인:
  //   - `/crews?org=phalanx` 는 pathname segment 에 `-px` 없음 → isPxRoute=false
  //   - `/crews/page.tsx:297` 가 `<main class="phalanx-theme">` 클래스 사용
  //   - 결과: sidebarAccent.main 이 default fallback `#FFA500` 으로 resolve →
  //     Phone Help modal / Edit Profile modal 등 inline border 가 yellow 그대로
  //
  // Fix: pathname-based 판정 OR query `?org=phalanx|encre` 도 PX/EC 로 인정.
  // 둘 다 false 인 경우만 default yellow.
  //
  // sidebarThemeClass 도 동일하게 query org 시 cluster-px-theme/encre-theme 반환
  // (SCSS combined selector `.help-modal-overlay.cluster-px-theme` 등이 future-
  // ready 하게 매칭되도록 cluster route 와 동일 className 사용).
  const sidebarAccent = useMemo(() => {
    const orgParam = searchParams.get("org");
    const isPxCtx = isPxRoute(pathname) || orgParam === "phalanx";
    const isEcCtx = isEcRoute(pathname) || orgParam === "encre";
    if (isPxCtx) {
      return {
        main: "#1E9503",
        soft: "#B2FF8F",
        alpha: (a: number) => `rgba(30, 149, 3, ${a})`,
        gradient: "linear-gradient(180deg, #B2FF8F 0%, #1E9503 100%)",
      };
    }
    if (isEcCtx) {
      return {
        main: "#FF4B70",
        soft: "#FF98A6",
        alpha: (a: number) => `rgba(255, 75, 112, ${a})`,
        gradient: "linear-gradient(180deg, #FF98A6 0%, #FF4B70 100%)",
      };
    }
    return {
      main: "#FFA500",
      soft: "#FFC300",
      alpha: (a: number) => `rgba(255, 165, 0, ${a})`,
      gradient: "linear-gradient(180deg, #FAAB07 0%, #e09600 100%)",
    };
  }, [pathname, searchParams]);
  // portal/inline modal root 에 결합되는 theme class. pathname segment 우선,
  // query org fallback. cluster route + /crews?org= 양쪽 cover.
  const sidebarThemeClass = useMemo(() => {
    const pathClass = getThemeClass(pathname);
    if (pathClass) return pathClass;
    const orgParam = searchParams.get("org");
    if (orgParam === "phalanx") return "cluster-px-theme";
    if (orgParam === "encre") return "encre-theme";
    return "";
  }, [pathname, searchParams]);
  const router = useRouter();
  // 테스트 유저(데모) 모드: admin → 고객 앱 이동 시 ?demoUserId={userId} 만 붙고
  // userId/userID 는 비어 있다(진입: /admin/test-users → /cluster-4?admin=true&demoUserId={id}).
  // resume-card(이력서/Identity-Core)도 Cluster41Content / Cluster4CardContent 와 동일하게
  // 표시 대상 = admin-view(userId) → 없으면 테스트 유저(demoUserId) 로 resolve 한다.
  // 이 fallback 이 없으면 targetUserId=null 로 떨어져 로그인 세션(보통 관리자) 프로필/기본값을
  // 보게 되어 테스트 유저 이력서 영역이 전부 void 로 표시된다.
  // Sidebar 는 cluster-4 / cluster-4-ec / cluster-4-px 등 모든 cluster route 의 공용 컴포넌트라
  // 본 한 줄로 세 라우트가 동일하게 demoUserId 를 처리한다(일반 로그인 사용자는 demoUserId 부재 → 기존 동작).
  const demoUserId = searchParams.get("demoUserId");
  const targetUserId =
    searchParams.get("userId") || searchParams.get("userID") || demoUserId;
  const sessionUserId = session?.user?.id ?? null;
  const shouldFetchProfile = !!targetUserId || sessionStatus === "authenticated";
  const hasFetchIdentity = !!targetUserId || !!sessionUserId;
  const {
    fetchProfile: fetchCachedProfile,
    profileData: cachedProfile,
    clearCache: clearProfileCache,
    // ProfileContext 캐시(단일 슬롯)의 소유자 — 캐시 적용 전 userKey 일치 검증에 사용.
    lastFetchedUserId: cachedProfileUserId,
  } = useProfile();

  // 어드민이 다른 유저 편집 시 targetUserId를 API URL에 추가
  const apiUrl = (path: string) => {
    if (targetUserId && session?.user?.isAdmin) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}targetUserId=${targetUserId}`;
    }
    return path;
  };

  // SSR-safe: localStorage를 render time에 읽으면 SSR(false)/client(true) 불일치 → stateful로 변환
  const [demoMode, setDemoMode] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  // SSR-safe 기본값 (비-demo 기본값으로 통일). demo 모드일 때는 마운트 useEffect에서 덮어씀.
  const [reliabilityRate, setReliabilityRate] = useState<number | null>(100);
  const [hasReliabilityData, setHasReliabilityData] = useState<boolean>(false);
  const [completionRate, setCompletionRate] = useState<number | null>(80);
  const [hasCompletionData, setHasCompletionData] = useState<boolean>(false);
  const [practicalCompetency, setPracticalCompetency] = useState<number>(0); // 실무 역량 성장
  const [practicalExperience, setPracticalExperience] = useState<number>(0); // 실무 경험 축적
  const [practicalInfo, setPracticalInfo] = useState<number>(0); // 실무 정보 습득
  // 실무 정보 습득(실무정보 라인 강화 성공 누적 횟수) 전용 SoT.
  // /api/profile 의 practicalCounts.info 를 가공 없이 그대로 보관 — 어드민 표기상
  // practicalStats.infoCount 와 동일 값. resume-card skill-num 표시에 사용한다.
  // number 면 그대로(0 포함) 표시, API 미제공(null·undefined) 이면 "-".
  const [practicalInfoCount, setPracticalInfoCount] = useState<number | null>(null);
  // 실무 경험 축적(실무경험 라인 강화 성공 누적 횟수) 전용 SoT — info 와 동일 패턴.
  // /api/profile 의 practicalCounts.experience 를 가공 없이 그대로 보관 — 어드민 표기상
  // practicalStats.experienceCount 와 동일 값. resume-card skill-num 표시에 사용한다.
  // number 면 그대로(0 포함) 표시, API 미제공(null·undefined) 이면 "-".
  const [practicalExperienceCount, setPracticalExperienceCount] = useState<number | null>(null);
  // 실무 역량 성장(실무역량 라인 강화 성공 누적 횟수) 전용 SoT — info/experience 와 동일 패턴.
  // /api/profile 의 practicalCounts.competency 를 가공 없이 그대로 보관 — 어드민 표기상
  // practicalStats.abilityUnitCount 와 동일 값. resume-card skill-num 표시에 사용한다.
  // number 면 그대로(0 포함) 표시, API 미제공(null·undefined) 이면 "-".
  const [practicalCompetencyCount, setPracticalCompetencyCount] = useState<number | null>(null);
  // 실무 경력 누적 프로젝트 수 — practicalStats.careerProjectCount 를 우선 사용하고
  // 없을 때만 practicalCounts.career / careerActivityCount 로 폴백한다.
  // number 면 0 포함 표시, null/undefined 일 때만 "-".
  const [practicalCareerCount, setPracticalCareerCount] = useState<number | null>(null);
  const [hasActivityData, setHasActivityData] = useState<boolean>(false);
  const [stat1, setStat1] = useState(0);
  const [stat2, setStat2] = useState(0);
  const [badge1, setBadge1] = useState(0);
  const [badge2, setBadge2] = useState(0);
  const [badge3, setBadge3] = useState(0);
  // 배지 데이터 상태 (user_cumulative_points 테이블) — SSR-safe 기본값
  const [badgeData, setBadgeData] = useState({
    stars: 0, // 별
    lightnings: 0, // 번개
    shields: 0, // 방패
  });
  const [hasBadgeData, setHasBadgeData] = useState<boolean>(false);
  // resume-card .resume-badges 의 SoT — /api/profile 의 point DTO.
  //   check → icon-graphic10, advantage → icon-shield, penalty → icon-graphic13(red).
  // null 이면 badgeData(stars/shields/lightnings) 로 폴백(데모/구캐시 호환).
  const [pointData, setPointData] = useState<{ check: number; advantage: number; penalty: number } | null>(null);

  // 시즌 히스토리 데이터 상태 (user_season_histories + seasons)
  interface SeasonHistory {
    id: string;
    role_in_season: string;
    // null = admin 그래프트 실패로 분자 미확정('-' 표시) — stale 로컬 값 노출 금지 (2026-06-05)
    approved_weeks: number | null;
    total_weeks: number;
    progress_status: string;
    review_status: string;
    seasons: {
      id: string;
      year: number;
      name: string;
      start_date: string;
    };
  }
  const [seasonHistories, setSeasonHistories] = useState<SeasonHistory[]>([]);
  const [hasSeasonData, setHasSeasonData] = useState<boolean>(false);

  // 시즌 이름 한글 변환
  const seasonNameKorean: { [key: string]: string } = {
    spring: "봄",
    summer: "여름",
    fall: "가을",
    winter: "겨울",
  };

  // 역할 한글 변환 — 라벨 SoT 는 lib/crewClassLabel(RESUME_ROLE_CLASS_LABELS).
  //   /crews 크루 카드 클래스 배지와 동일 정의소를 공유한다(라벨 문구 수정은 그 파일 한 곳).
  const roleKorean = RESUME_ROLE_CLASS_LABELS;

  // 활동 이력(activity-line) 표시용 정규화.
  // 백엔드 DTO 필드명/시즌 시스템 편차(두 시즌 시스템: seasons(uuid) vs season_definitions)를
  // 흡수해 프론트 표시값(displaySeasonYear / displaySeasonName / displayTotalWeeks / displayRoleLabel)을 생성한다.
  // 하드코딩 대신 렌더 직전에 사용 가능한 필드를 우선순위로 선택한다.
  const normalizeActivityDisplay = (
    history: SeasonHistory,
    fallbackMembershipLevel?: string
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = history as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const season: any = history.seasons || {};

    // ── 연도(2자리): year 우선, 없으면 name/label 에서 4자리 연도 추출 ──
    let yearNum: number | null = typeof season.year === "number" ? season.year : null;
    if (yearNum == null) {
      const m = `${season.name ?? ""} ${season.season_label ?? ""}`.match(/(20\d{2})/);
      if (m) yearNum = parseInt(m[1], 10);
    }
    const displaySeasonYear = yearNum != null ? String(yearNum).slice(-2) : "";

    // ── 시즌 이름(봄/여름/가을/겨울): 한글 직접 추출 → english 매핑 → 원본 ──
    const nameSources = [season.name, season.season_label, season.season_type]
      .filter(Boolean)
      .map(String);
    let displaySeasonName = "";
    for (const s of nameSources) {
      const kr = s.match(/봄|여름|가을|겨울/)?.[0];
      if (kr) { displaySeasonName = kr; break; }
      const lower = s.toLowerCase();
      const mapped =
        seasonNameKorean[lower] ||
        (lower.includes("spring") ? "봄"
          : lower.includes("summer") ? "여름"
          : lower.includes("fall") || lower.includes("autumn") ? "가을"
          : lower.includes("winter") ? "겨울"
          : "");
      if (mapped) { displaySeasonName = mapped; break; }
    }
    if (!displaySeasonName) {
      displaySeasonName = seasonNameKorean[season.name] || season.name || "";
    }

    // ── 전체 주차 분모: DTO 사용가능 값 우선 → start/end_date 계산 → 0 회피 ──
    const dtoWeeks = [
      h.total_weeks,
      h.totalWeeks,
      h.seasonWeeks,
      h.expectedWeeks,
      h.durationWeeks,
    ].find((v: unknown) => typeof v === "number" && (v as number) > 0) as number | undefined;
    let displayTotalWeeks = typeof dtoWeeks === "number" ? dtoWeeks : 0;
    if (!displayTotalWeeks && season.start_date && season.end_date) {
      const start = new Date(season.start_date).getTime();
      const end = new Date(season.end_date).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        displayTotalWeeks = Math.round((end - start) / (7 * 24 * 60 * 60 * 1000));
      }
    }

    // ── 역할 라벨: 회원 구분 후보 필드 → roleKorean 매핑/한글 통과 → 기본값 ──
    const roleCandidates = [
      history.role_in_season,
      h.roleLabel,
      h.membershipTypeLabel,
      h.memberTypeLabel,
      h.planLabel,
      fallbackMembershipLevel,
    ].filter((v: unknown): v is string => typeof v === "string" && v.trim() !== "");
    let displayRoleLabel = "";
    for (const c of roleCandidates) {
      if (roleKorean[c]) { displayRoleLabel = roleKorean[c]; break; }
      if (/[가-힣]/.test(c)) { displayRoleLabel = c; break; } // 이미 한글 라벨이면 그대로
    }
    if (!displayRoleLabel) displayRoleLabel = "일반(정규)";

    return { displaySeasonYear, displaySeasonName, displayTotalWeeks, displayRoleLabel };
  };

  // 진행 상태 변환 — 판정은 공용 progressStatusToSeasonKey(lib/cluster4-status-label):
  // 영문 enum(in_progress/completed…)과 admin /api/cluster1/resume DTO 한글 라벨
  // ("진행 중"/"정상 완료"/"정상 졸업"…)을 공백 무시로 흡수한다. cluster4/cluster4-1 과
  // 같은 판정 함수를 공유하므로 같은 시즌이 표면별로 다른 상태로 보일 수 없다.
  // 문구는 이력서 카드 확정 5종(RESUME_SEASON_BADGE_TEXT — 60px 뱃지 폭 제약):
  // 진행 중 / 정상 완료 / 통합 휴식 / 활동 중단 / 정상 졸업(modifier 없는 base 클래스).
  // 미인식 값은 받은 라벨 passthrough(프론트 임의 재판정 금지).
  const RESUME_BADGE_CLASS: Record<SeasonStatusKey, string> = {
    in_progress: "active",
    success: "complete",
    stopped: "suspended",
    rest: "rest",
    graduated: "",
  };
  const getProgressStatus = (status: string) => {
    const key = progressStatusToSeasonKey(status);
    if (!key) return { text: status, className: "" };
    return { text: RESUME_SEASON_BADGE_TEXT[key], className: RESUME_BADGE_CLASS[key] };
  };

  // 검수 상태 변환 (영문 key + admin 한글 라벨, 공백 무시)
  const getReviewStatus = (status: string) => {
    const key = (status ?? "").replace(/\s/g, "");
    switch (key) {
      case "approved":
      case "승인완료":
      case "승인":
        return { text: "승인 완료", className: "approved" };
      case "reviewing":
      case "검수중":
      case "검수":
        return { text: "검수중", className: "pending" };
      default:
        return { text: status, className: "" };
    }
  };

  // 아바타 이미지 순환 (01.png, 02.png, 03.png)
  const getAvatarImage = (index: number) => {
    const num = (index % 3) + 1;
    return `/images/0/cluster 1/bg image/0${num}.png`;
  };

  const [skill1, setSkill1] = useState(0);
  const [skill2, setSkill2] = useState(0);
  const [skill3, setSkill3] = useState(0);
  const [skill4, setSkill4] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    if (isEditModalOpen) {
      document.body.style.overflow = "hidden";
      logEvent("scroll-lock", { source: "sidebar", reason: "isEditModalOpen" });
    } else {
      document.body.style.overflow = "";
      logEvent("scroll-unlock", { source: "sidebar", reason: "isEditModalOpen" });
    }
    return () => {
      document.body.style.overflow = "";
      logEvent("scroll-unlock", { source: "sidebar", reason: "isEditModalOpen-cleanup" });
    };
  }, [isEditModalOpen]);
  const [isSaving, setIsSaving] = useState(false);

  // 실제 유저 프로필 데이터
  const [userProfile, setUserProfile] = useState<{
    name: string;
    nameEng: string;
    gender: string;
    birthDate: string;
    city: string;
    district: string;
    address?: string;
    phone: string;
    email: string;
    school: string;
    major: string;
    major2: string;
    major3: string;
    enrollPeriod: string;
    graduationStatus: string;
    gpa: string;
    gpaMax: string;
    quote: string;
    photo: string;
    // user_memberships enrichment — 기존 sub-text 두 줄 (enrollPeriod / gpa 자리) 의
    // 데이터 소스로 사용. UI 구조 / 줄 수는 변경 없음, 데이터만 매핑 교체.
    team: string;
    part: string;
    membershipLevel: string;
  } | null>(null);

  // 데모 모드 사용자별 sidebar 더미 데이터 분기 (targetUserId 없을 때만 적용)
  useEffect(() => {
    if (!demoMode || !targetUserId) return;
    // targetUserId가 있으면 sidebar는 실제 API 데이터를 표시 (cluster2/3 더미와 별개)
    return;
    const applyDemoByName = () => {
      // 데모 모드에서는 URL의 userId를 이름으로 직접 사용
      const name = decodeURIComponent(targetUserId || "");

        const demoProfiles: Record<string, typeof DUMMY_USER_PROFILE> = {
          윤재윤: DUMMY_USER_PROFILE,
          안지혜: {
            name: "안지혜",
            nameEng: "AN JIHYE",
            gender: "여",
            birthDate: "1999.07.10",
            city: "대전광역시",
            district: "유성구",
            phone: "010-5555-6666",
            email: "jihye.an@gmail.com",
            school: "성균관대학교",
            major: "소프트웨어학과",
            major2: "",
            major3: "",
            enrollPeriod: "2018.03 - 2022.02",
            graduationStatus: "졸업",
            gpa: "4.4",
            gpaMax: "4.5",
            quote: "끊임없이 배우고 의심하는 것이 개발자의 기본 자세라 믿습니다",
            photo: "/images/0/crew profile/여 1.jpg",
          },
          전민경: {
            name: "전민경",
            nameEng: "JEON MINKYUNG",
            gender: "여",
            birthDate: "1998.05.15",
            city: "경기도",
            district: "성남시",
            phone: "010-8765-4321",
            email: "minkyung.j@naver.com",
            school: "성균관대학교",
            major: "경영학과",
            major2: "",
            major3: "",
            enrollPeriod: "2017.03 - ~ing",
            graduationStatus: "재학",
            gpa: "3.8",
            gpaMax: "4.5",
            quote: "끊임없이 도전하는 사람이 세상을 바꾼다",
            photo: "/images/0/crew profile/여 1.jpg",
          },
          곽예원: {
            name: "곽예원",
            nameEng: "KWAK YEWON",
            gender: "여",
            birthDate: "2000.11.23",
            city: "부산광역시",
            district: "해운대구",
            phone: "010-1111-2222",
            email: "yewon.kwak@gmail.com",
            school: "부산대학교",
            major: "디자인학과",
            major2: "",
            major3: "",
            enrollPeriod: "2019.03 - ~ing",
            graduationStatus: "재학",
            gpa: "4.0",
            gpaMax: "4.5",
            quote: "감각을 넘어 전략으로, 디자인의 가치를 증명하다 감각을 넘어 전략으로, 디자인의 가치를 증명하다 감각을 넘어 전략으로, 디자인의 가치를 증명하다 ",
            photo: "/images/0/crew profile/여 3.jpg",
          },
          김의환: {
            name: "김의환",
            nameEng: "KIM UIHWAN",
            gender: "남",
            birthDate: "1995.08.30",
            city: "인천광역시",
            district: "남동구",
            phone: "010-3333-4444",
            email: "uihwan.kim@daum.net",
            school: "인하대학교",
            major: "컴퓨터공학과",
            major2: "",
            major3: "",
            enrollPeriod: "2014.03 - ~ing",
            graduationStatus: "재학",
            gpa: "3.2",
            gpaMax: "4.5",
            quote: "코드 한 줄이 세상을 바꿀 수 있다고 믿는 개발자는 나야 나 나야 나, 오늘 밤 주인공은 나야 나, 나야 나, 개발자는 나야 나 나야 나",
            photo: "/images/0/crew profile/남 2.jpg",
          },
        };

        const demoStats: Record<string, { reliability: number; completion: number; stars: number; lightnings: number; shields: number; info: number; competency: number; experience: number; career: number; status: "Running" | "Complete" | "On Rest" | "Recharging" | "Next Challenge" }> = {
          윤재윤: { reliability: 87, completion: 90, stars: 25, lightnings: 8, shields: 12, info: 10, competency: 60, experience: 200, career: 4, status: "Running" },
          안지혜: { reliability: 95, completion: 96, stars: 33, lightnings: 4, shields: 22, info: 18, competency: 130, experience: 450, career: 7, status: "Complete" },
          전민경: { reliability: 85, completion: 93, stars: 150, lightnings: 99999, shields: 88, info: 15, competency: 120, experience: 500, career: 8, status: "Running" },
          곽예원: { reliability: 42, completion: 67, stars: 50, lightnings: 200, shields: 0, info: 8, competency: 45, experience: 120, career: 3, status: "On Rest" },
          김의환: { reliability: 15, completion: 30, stars: 88, lightnings: 0, shields: 7, info: 3, competency: 10, experience: 25, career: 1, status: "Next Challenge" },
        };

        if (demoProfiles[name]) {
          setUserProfile(demoProfiles[name]);
        }
        if (demoStats[name]) {
          const s = demoStats[name];
          setReliabilityRate(s.reliability);
          setCompletionRate(s.completion);
          setBadgeData({ stars: s.stars, lightnings: s.lightnings, shields: s.shields });
          setPracticalInfo(s.info);
          setPracticalCompetency(s.competency);
          setPracticalExperience(s.experience);
          setPracticalCareerCount(s.career);
          setCrewStatus(s.status);
        }
    };
    applyDemoByName();
  }, [demoMode, targetUserId]);

  // Hydration 에러 방지를 위한 마운트 상태
  const [isMounted, setIsMounted] = useState(false);
  const [hasData, setHasData] = useState(false); // 데이터 있음/없음 상태 (SSR-safe 기본)
  // fetch 가 한 번이라도 완료(성공/실패)되었는지 — render gate 무한 skeleton 방지용.
  // (잘못된 UUID / 본인 프로필 미존재 등으로 영구 실패해도 defaultProfile 로 fallthrough.)
  const [fetchSettled, setFetchSettled] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    // 마운트 후 demo 모드 확정 + tabBg random 갱신
    const checked = checkDemoMode();
    setDemoMode(checked);
    setTabBg(IDENTITY_TAB_IMAGES[Math.floor(Math.random() * IDENTITY_TAB_IMAGES.length)]);
    if (checked && !targetUserId) {
      // demo 모드 + 본인 프로필일 때만 더미 데이터 주입 (특정 크루 조회 시는 실제 API 사용)
      setReliabilityRate(DUMMY_SIDEBAR_EXTRA.reliabilityRate);
      setHasReliabilityData(true);
      setCompletionRate(DUMMY_SIDEBAR_EXTRA.completionRate);
      setHasCompletionData(true);
      setPracticalCompetency(DUMMY_SIDEBAR_EXTRA.practicalCompetency);
      setPracticalExperience(DUMMY_SIDEBAR_EXTRA.practicalExperience);
      setPracticalExperienceCount(DUMMY_SIDEBAR_EXTRA.practicalExperience);
      setPracticalInfo(DUMMY_SIDEBAR_EXTRA.practicalInfo);
      setPracticalInfoCount(DUMMY_SIDEBAR_EXTRA.practicalInfo);
      setPracticalCareerCount(DUMMY_SIDEBAR_EXTRA.practicalCareer);
      setHasActivityData(true);
      setBadgeData(DUMMY_SIDEBAR_EXTRA.badgeData);
      setHasBadgeData(true);
      setHasSeasonData(true);
      setUserProfile(DUMMY_USER_PROFILE);
      setHasData(true);
      setCrewStatus(DUMMY_SIDEBAR_EXTRA.crewStatus);
    }
  }, []);

  // 캐시된 프로필 데이터로 즉시 초기화 (클러스터 탭 전환 시 깜빡임 방지)
  const cacheInitRef = useRef(false);
  // 슬로건이 프로필보다 먼저 도착했을 때 임시로 보관하는 버퍼 (병렬 fetch 시 경쟁 상태 방지)
  const pendingSloganRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (demoMode) return; // 더미 모드면 캐시 초기화 스킵
    if (cacheInitRef.current || !cachedProfile?.data) return;
    // [userKey 검증] ProfileContext 캐시는 단일 슬롯 — 마지막 fetch 대상(lastFetchedUserId)이
    // 현재 표시 대상(targetUserId)과 다르면 이전 사용자 데이터이므로 절대 적용하지 않는다.
    // (사용자 전환 직후 remount 시 B 화면에 A 캐시가 그래프트되던 레이스의 근원.
    //  cacheInitRef 는 건드리지 않음 — 이후 현재 대상의 캐시가 도착하면 그때 적용.)
    if ((cachedProfileUserId ?? null) !== (targetUserId ?? null)) return;
    cacheInitRef.current = true;

    const profile = cachedProfile.data;
    setHasData(true);

    // 슬로건 우선순위: pending(네트워크로 먼저 도착) → sessionStorage 캐시 → 빈 값
    // (source of truth = user_introductions.slogan_1. bio는 다른 도메인이므로 fallback 으로 쓰지 않는다.)
    let cachedSlogan: string | null = null;
    try {
      if (typeof window !== "undefined") {
        cachedSlogan = sessionStorage.getItem(`sidebar:slogan1:${targetUserId || "self"}`);
      }
    } catch {}
    const initialQuote = pendingSloganRef.current ?? cachedSlogan ?? "";

    // mapping 은 buildSidebarUserProfile 로 일원화 — fetchUserProfile 과
    // 동일한 full set(team/part/membershipLevel 포함) 을 produce 한다.
    setUserProfile(buildSidebarUserProfile(profile, initialQuote));

    // 메달 상태 — DTO(profile.status + growthInfo.currentSeasonStatus + growthStatus) 기반 단일 매핑.
    setCrewStatus(resolveCrewStatus(profile.status, cachedProfile.growthInfo?.currentSeasonStatus, cachedProfile.growthInfo?.growthStatus));

    if (cachedProfile.completionRate !== undefined && cachedProfile.completionRate !== null) {
      setHasCompletionData(true);
      setCompletionRate(cachedProfile.completionRate);
    }
    if (cachedProfile.reliabilityRate !== undefined && cachedProfile.reliabilityRate !== null) {
      setHasReliabilityData(true);
      setReliabilityRate(cachedProfile.reliabilityRate);
    }
    if (cachedProfile.practicalCounts) {
      const { competency, experience, info } = cachedProfile.practicalCounts;
      const careerSkillCount = resolveCareerSkillCount(cachedProfile);
      setPracticalCompetency(competency);
      // 실무역량 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
      setPracticalCompetencyCount(typeof competency === "number" ? competency : null);
      setPracticalExperience(experience);
      // 실무경험 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
      setPracticalExperienceCount(typeof experience === "number" ? experience : null);
      setPracticalInfo(info);
      // 실무정보 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
      setPracticalInfoCount(typeof info === "number" ? info : null);
      // 실무경력 누적 프로젝트 수 — API 응답값 그대로(0 포함). 재계산 금지.
      setPracticalCareerCount(careerSkillCount);
      setHasActivityData(competency > 0 || experience > 0 || info > 0 || (careerSkillCount ?? 0) > 0);
    }
    if (cachedProfile.badges) {
      setBadgeData(cachedProfile.badges);
      setHasBadgeData(true);
    }
    if (cachedProfile.point) {
      setPointData({
        check: toPointNum(cachedProfile.point.check),
        advantage: toPointNum(cachedProfile.point.advantage),
        penalty: toPointNum(cachedProfile.point.penalty),
      });
    }
    if (cachedProfile.seasonHistories && cachedProfile.seasonHistories.length > 0) {
      setSeasonHistories(cachedProfile.seasonHistories);
      setHasSeasonData(true);
    }
    if (cachedProfile.resumeCardSettings) {
      setResumeCardSettings(cachedProfile.resumeCardSettings);
      const s = cachedProfile.resumeCardSettings;
      if (s.hexagonLink1) setIconLink1(s.hexagonLink1);
      if (s.hexagonLink2) setIconLink2(s.hexagonLink2);
      if (s.hexagonLink3) setIconLink3(s.hexagonLink3);
    }
    if (cachedProfile.growthPeriodStats?.approvedWeeks !== undefined) {
      setApprovedWeeksCount(cachedProfile.growthPeriodStats.approvedWeeks);
    }
  }, [cachedProfile, cachedProfileUserId, targetUserId]);

  // ── 사용자 전환(targetUserId 변경) 시 이전 사용자 카드 즉시 제거 ──
  // hasData=false + fetchSettled=false 로 렌더 게이트(Skeleton "Loading…")를 다시 띄우고,
  // 이전 대상의 늦은 응답은 epoch 비교로 폐기한다(A 카드가 B 화면에 남는 문제 방지).
  const profileEpochRef = useRef(0);
  const prevTargetUserIdRef = useRef(targetUserId);
  useEffect(() => {
    if (prevTargetUserIdRef.current === targetUserId) return;
    prevTargetUserIdRef.current = targetUserId;
    profileEpochRef.current += 1;
    if (demoMode) return; // 더미 모드는 demo seed effect 가 전담
    pendingSloganRef.current = null;
    setHasData(false);
    setFetchSettled(false);
    setUserProfile(null);
    setSeasonHistories([]);
    setHasSeasonData(false);
    setBadgeData({ stars: 0, lightnings: 0, shields: 0 });
    setHasBadgeData(false);
    setPointData(null);
    setCompletionRate(null);
    setHasCompletionData(false);
    setReliabilityRate(null);
    setHasReliabilityData(false);
    setPracticalCompetency(0);
    setPracticalCompetencyCount(null);
    setPracticalExperience(0);
    setPracticalExperienceCount(null);
    setPracticalInfo(0);
    setPracticalInfoCount(null);
    setPracticalCareerCount(null);
    setHasActivityData(false);
    setApprovedWeeksCount(null);
    setCrewStatus("Running");
    // resume-card admin settings 도 대상별 값 — 리셋하지 않으면 이전 사용자(타 조직)의
    // medalWeekOverride/notice/hexagon 링크가 새 사용자 카드에 잔존한다.
    setResumeCardSettings(null);
    setIconLink1(DEFAULT_ICON_LINK_1);
    setIconLink2(DEFAULT_ICON_LINK_2);
    setIconLink3(DEFAULT_ICON_LINK_3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, demoMode]);

  // 아이콘 링크 state — admin resumeCardSettings 가 있으면 마운트 후 덮어씌움
  const [iconLink1, setIconLink1] = useState(DEFAULT_ICON_LINK_1);
  const [iconLink2, setIconLink2] = useState(DEFAULT_ICON_LINK_2);
  const [iconLink3, setIconLink3] = useState(DEFAULT_ICON_LINK_3);
  const [iconLinkErrors, setIconLinkErrors] = useState({ link1: "", link2: "", link3: "" });

  // resume-card admin settings (3-tier merge: user > org > site, /api/profile 응답).
  // 모든 값 null = admin 미설정 → 기존 하드코딩 fallback 사용.
  const [resumeCardSettings, setResumeCardSettings] = useState<{
    hexagonLink1: string | null;
    hexagonLink2: string | null;
    hexagonLink3: string | null;
    helpTooltipText: string | null;
    medalWeekOverride: number | null;
    medalTheme: string | null;
    noticeTopText: string | null;
    noticeTopStampImageUrl: string | null;
    noticeBottomText: string | null;
    noticeBottomStampImageUrl: string | null;
    helpTooltipDefault: string | null;
  } | null>(null);

  // URL 유효성 검사 함수
  const isValidUrl = (url: string) => {
    if (!url || url.trim() === "") return true; // 빈 값은 허용
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleIconLinkChange = (value: string, linkNum: 1 | 2 | 3) => {
    const setters = { 1: setIconLink1, 2: setIconLink2, 3: setIconLink3 };
    const errorKeys = { 1: "link1", 2: "link2", 3: "link3" } as const;

    setters[linkNum](value);

    if (value && !isValidUrl(value)) {
      setIconLinkErrors((prev) => ({ ...prev, [errorKeys[linkNum]]: "정확한 링크를 입력해주세요." }));
    } else {
      setIconLinkErrors((prev) => ({ ...prev, [errorKeys[linkNum]]: "" }));
    }
  };

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isCustomAddress, setIsCustomAddress] = useState(false);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleDropdownOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-dropdown-list") && !target.closest(".chamfer-box")) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener("mousedown", handleDropdownOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleDropdownOutsideClick);
    };
  }, [openDropdown]);

  // 화면 높이 기반 카드 스케일 조절 (비율 유지)
  // NOTE: 가로(좌/우) 비율 안정화를 위해 "사이드바 폭"은 고정(497px)으로 유지하고
  // 카드만 필요 시 축소(<= 1)한다. (4K에서 카드가 커지며 4:6처럼 보이는 문제 방지)
  const [cardScale, setCardScale] = useState(1);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); // 모바일 프로필 슬라이드
  const cardRef = useRef<HTMLDivElement>(null);

  // .resume-card 높이를 뷰포트에 맞게 실시간 재계산
  useResumeCardHeight(cardRef, isMobileView);

  // useLayoutEffect — 첫 페인트 전에 cardScale/--sidebar-width 를 확정해
  // 로딩 skeleton 이 scale 1(=489px) 로 한 프레임 그려졌다가 넓어지는 shift 를 막는다.
  useLayoutEffect(() => {
    // 고정 너비 레이아웃: 항상 데스크탑
    setIsMobileView(false);

    const calculateScale = () => {
      const BASE_CARD_HEIGHT = 810;
      const BASE_SIDEBAR_WIDTH = 497;

      // 높이 기반 스케일: 카드가 뷰포트 높이에 맞게 (zoom 전 원래 높이 기준)
      // ★ Zone A(<1920): 1920×1080 baseline과 동일한 sidebar 비율을 위해 viewportHeight = 1080 고정.
      //   1920px 고정 + 가로 스크롤 전략이므로 화면 자체가 1920×1080 그대로 표시되어야 함.
      //   (Zone B/C는 ternary 두 번째 분기 사용 → 기존 동작과 동일)
      const originalWidth = window.innerWidth;
      const isZoneAViewport =
        originalWidth < 1920 ||
        (originalWidth >= 1920 && originalWidth < 2560 && window.innerHeight >= 1200);
      const viewportHeight = isZoneAViewport
        ? 1080
        : window.innerHeight;
      console.log('[calculateScale]', {
        innerWidth: originalWidth,
        innerHeight: window.innerHeight,
        viewportHeight,
      });
      const availableHeight = viewportHeight - 130;
      const scaleByHeight = availableHeight / BASE_CARD_HEIGHT;

      // 높이 기반으로 적용, 최대 1.25, 최소 0.55
      let scale = Math.min(1.25, scaleByHeight);
      scale = Math.max(0.55, scale);

      // 1920 초과: 1920 비율(30.6%) 유지를 위해 scale 1.31 적용
      // 2125px 기준 sidebar 650px → 650/497 = 1.308 ≈ 1.31
      if (originalWidth > 1920 && !isZoneAViewport) {
        scale = 1.31;
      }

      setCardScale(scale);
      console.log('[setCardScale]', scale);

      // 카드 shell 실측 크기 — 첫 페인트용 SCSS 기본값(--resume-shell-width/height)을
      // 실제 viewport 기준 값으로 갱신. skeleton/placeholder 레이아웃 박스가 이 변수를
      // 사용하므로 SSR 페인트 → hydration → 데이터 렌더 전 과정에서 너비가 변하지 않는다.
      document.documentElement.style.setProperty(
        "--resume-shell-width",
        `${Math.round(BASE_SIDEBAR_WIDTH * scale)}px`
      );
      document.documentElement.style.setProperty(
        "--resume-shell-height",
        `${Math.round(875 * scale)}px`
      );

      // 사이드바 폭: 1920 이하만 JS로 동적 설정
      // 1921px+ 는 SCSS @media (min-width: 1921px)에서 --sidebar-width: 651px 고정
      if (originalWidth <= 1920 || isZoneAViewport) {
        const effectiveSidebarWidth = Math.round(BASE_SIDEBAR_WIDTH * scale);
        document.documentElement.style.setProperty("--sidebar-width", `${effectiveSidebarWidth}px`);
      }
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);

    return () => {
      window.removeEventListener("resize", calculateScale);
    };
  }, [pathname]);

  // Form state
  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    lastNameEng: "",
    firstNameEng: "",
    gender: "",
    birthDate: "",
    addressCity: "",
    addressDistrict: "",
    customAddress: "",
    phone: "",
    phoneComment: DEFAULT_PHONE_COMMENT,
    emailId: "",
    emailDomain: "",
    customEmailDomain: "",
    // 학력 정보
    educationLevel: "",
    schoolType: "",
    school: "",
    major: "",
    major2: "",
    major3: "",
    graduationStatus: "",
    entranceYear: "",
    entranceMonth: "",
    graduationYear: "",
    graduationMonth: "",
    gpa: "",
    gpaMax: "",
    customGpaMax: "",
    additionalMajor: "",
    additionalMajorType: "",
    vision: "",
  });
  const [isCustomEmailDomain, setIsCustomEmailDomain] = useState(false);
  const [isPhoneCommentModalOpen, setIsPhoneCommentModalOpen] = useState(false);
  const [isPhoneEditing, setIsPhoneEditing] = useState(false);
  // 연락 가능 시간대 모달 내부 loading — 캐시에 contactAvailable 이 없을 때만 백그라운드 fetch.
  const [isPhoneCommentLoading, setIsPhoneCommentLoading] = useState(false);
  // 백그라운드 fetch 완료 시 사용자가 이미 수정 중이면 입력값을 덮어쓰지 않기 위한 ref.
  const isPhoneEditingRef = useRef(false);
  useEffect(() => {
    isPhoneEditingRef.current = isPhoneEditing;
  }, [isPhoneEditing]);
  const phoneCommentSnapshot = useRef("");
  const profileFormSnapshotRef = useRef<typeof formData | null>(null);
  const [isPhoneHelpModalOpen, setIsPhoneHelpModalOpen] = useState(false);
  const [showSearchTooltip, setShowSearchTooltip] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [debugProfileType, setDebugProfileType] = useState<"본인" | "타크루">("본인");
  // 라우트 기반 자동 theme — 판정은 lib/cluster-route 로 일원화한다.
  // isPxRoute/isEcRoute 는 canonical(-planning/-entertainment) 과 legacy(-px/-ec)
  // 를 모두 인식하므로 어느 표기로 진입해도 일관된 톤이 적용된다. marketing(기본)
  // 으로 이동하면 "OK" 로 리셋되어 이전 조직 톤이 잔류하지 않는다.
  // 초기값도 pathname 에서 lazy init — 첫 프레임에 "OK"(타 조직 톤/아이콘)가
  // 그려졌다가 effect 후 바뀌는 플래시를 차단한다.
  // 결과: .resume-card 의 hexagon/디테일 아이콘·테마 클래스가 현재 조직과 항상 일치.
  const [debugPanelType, setDebugPanelType] = useState<"OK" | "EC" | "PX">(() =>
    isPxRoute(pathname) ? "PX" : isEcRoute(pathname) ? "EC" : "OK",
  );
  useEffect(() => {
    if (!pathname) return;
    if (isPxRoute(pathname)) setDebugPanelType("PX");
    else if (isEcRoute(pathname)) setDebugPanelType("EC");
    else setDebugPanelType("OK");
  }, [pathname]);
  const [crewStatus, setCrewStatus] = useState<"Running" | "Complete" | "On Rest" | "Recharging" | "Next Challenge">("Running");
  const [approvedWeeksCount, setApprovedWeeksCount] = useState<number | null>(null);
  const [isArrowShaking, setIsArrowShaking] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState<"email" | "school" | "major" | "hexagon1" | "hexagon2" | "hexagon3" | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const normalizeDirtyValue = (value: unknown) => (value ?? "").toString().trim();
  const isPhoneCommentDirty = () => normalizeDirtyValue(formData.phoneComment) !== normalizeDirtyValue(phoneCommentSnapshot.current);
  const isProfileEditDirty = () => {
    const snap = profileFormSnapshotRef.current;
    if (!snap) return false;
    return JSON.stringify(formData) !== JSON.stringify(snap);
  };

  // Sidebar 모달 배경 스크롤 차단
  const isSidebarModalOpen = isEditModalOpen || isPhoneCommentModalOpen || isPhoneHelpModalOpen;
  useModalScroll(isSidebarModalOpen);

  useEffect(() => {
    logEvent(isEditModalOpen ? "modal-open" : "modal-close", {
      source: "sidebar",
      name: "profile-edit",
    });
  }, [isEditModalOpen]);

  useEffect(() => {
    logEvent(isPhoneCommentModalOpen ? "modal-open" : "modal-close", {
      source: "sidebar",
      name: "phone-comment",
    });
  }, [isPhoneCommentModalOpen]);

  useEffect(() => {
    logEvent(isPhoneHelpModalOpen ? "modal-open" : "modal-close", {
      source: "sidebar",
      name: "phone-help",
    });
  }, [isPhoneHelpModalOpen]);

  // 연락 가능 시간대 모달: 열릴 때 읽기전용 모드로 초기화
  useEffect(() => {
    if (isPhoneCommentModalOpen) {
      setIsPhoneEditing(false);
    }
  }, [isPhoneCommentModalOpen]);

  // 전공 툴팁 외부 클릭시 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (tooltipVisible === "major") {
        setTooltipVisible(null);
      }
    };

    if (tooltipVisible === "major") {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [tooltipVisible]);

  // 커스텀 스크롤바
  const activitiesRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const [scrollThumbTop, setScrollThumbTop] = useState(0);
  const [scrollThumbHeight, setScrollThumbHeight] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  // OK/EC/PX별 프로필 데이터
  const profileData = {
    OK: {
      name: "정이안",
      nameEng: "Jung Ian",
      gender: "여",
      birthDate: "2002.02.02",
      city: "서울특별시",
      district: "강남구",
      phone: "010-1***-****",
      email: "gildong@naver.com",
      school: "성균관대학교",
      major: "사학과",
      major2: "",
      major3: "",
      enrollPeriod: "2025.03",
      graduationStatus: "재학중",
      gpa: "3.0",
      gpaMax: "4.5",
      photo: "/images/0/cluster 1/shape.png",
      quote: "가장 어두운 순간에도 앞으로 한 걸음 내딛는 자에게 길이 열린다가장 어두운 순간에도 앞으로 한 걸음 내딛는 자에게 길이 열린다",
      lightColor: "#FFEC8F",
      accentColor: "#FFC300",
    },
    EC: {
      name: "박민주",
      nameEng: "Park Minju",
      gender: "남",
      birthDate: "2000.05.15",
      city: "경기도",
      district: "성남시 분당구",
      phone: "010-2***-****",
      email: "pmj_design@gmail.com",
      school: "한양대학교",
      major: "산업디자인학과",
      major2: "UX디자인학과",
      major3: "",
      enrollPeriod: "2019.03 ~ 2023.02",
      graduationStatus: "졸업",
      gpa: "3.8",
      gpaMax: "4.5",
      photo: "/images/0/cluster 1/EC00.png",
      quote: "디자인은 단순한 외형이 아니라 사용자의 경험을 설계하는 것이다. 좋은 디자인은 보이지 않는 곳에서 빛난다",
      lightColor: "#FF98A6",
      accentColor: "#FF4B70",
    },
    PX: {
      name: "이동민",
      nameEng: "Lee Dongmin",
      gender: "남",
      birthDate: "1999.11.22",
      city: "서울특별시",
      district: "마포구",
      phone: "010-3***-****",
      email: "dongmin.dev@kakao.com",
      school: "연세대학교",
      major: "컴퓨터과학과",
      major2: "인공지능학과",
      major3: "",
      enrollPeriod: "2018.03 ~ 2022.02",
      graduationStatus: "졸업",
      gpa: "4.1",
      gpaMax: "4.5",
      photo: "/images/0/cluster 1/PX00.png",
      quote: "코드 한 줄 한 줄에 사용자를 향한 진심을 담는다. 기술은 사람을 위해 존재해야 한다",
      lightColor: "#B2FF8F",
      accentColor: "#36DA60",
    },
  };

  // 현재 선택된 프로필 가져오기 (기본값)
  const defaultProfile = profileData[debugPanelType];

  // 실제 표시할 프로필 (마운트 후 유저 프로필이 있으면 사용, 없으면 기본값)
  const currentProfile =
    isMounted && userProfile
      ? {
          ...defaultProfile,
          name: userProfile.name,
          nameEng: userProfile.nameEng,
          gender: userProfile.gender,
          birthDate: userProfile.birthDate,
          city: userProfile.city,
          district: userProfile.district,
          address: userProfile.address || "",
          phone: userProfile.phone,
          email: userProfile.email,
          school: userProfile.school,
          major: userProfile.major,
          major2: userProfile.major2,
          major3: userProfile.major3,
          enrollPeriod: userProfile.enrollPeriod,
          graduationStatus: userProfile.graduationStatus,
          gpa: userProfile.gpa,
          gpaMax: userProfile.gpaMax,
          quote: userProfile.quote || SECTION2_SLOGAN_DEFAULTS.slogans[0].content,
          photo: userProfile.photo || defaultProfile.photo,
          // membership 필드 — 기존 sub-text 두 줄에 매핑 (UI 구조 미변경).
          team: userProfile.team,
          part: userProfile.part,
          membershipLevel: userProfile.membershipLevel,
        }
      : defaultProfile;

  // 페이지 로드 시 프로필 데이터 가져오기 (캐시 활용)
  const fetchUserProfile = async (forceRefresh?: boolean) => {
    // targetUserId가 있으면 public profile lookup이므로 session 상태 무관하게 진행.
    // targetUserId가 없으면 본인 프로필이므로 session이 확정될 때까지 대기.
    if (!targetUserId) {
      if (sessionStatus === "loading") {
        console.log("[fetchUserProfile] skipped: sessionStatus=loading & no targetUserId", { hasSession: !!session });
        return;
      }
      if (sessionStatus !== "authenticated") {
        console.log("[fetchUserProfile] skipped: no targetUserId & session not authenticated", { sessionStatus });
        return;
      }
      if (!sessionUserId) {
        console.log("[fetchUserProfile] skipped: authenticated session has no user id", { sessionStatus, hasSession: !!session });
        setHasData(false);
        setFetchSettled(true);
        return;
      }
    }
    console.log("[fetchUserProfile] started", { targetUserId, sessionStatus, sessionUserId, forceRefresh });
    // 사용자 전환 레이스 가드 — targetUserId 가 바뀌면 epoch 가 올라가고,
    // 이전 대상의 늦은 응답은 아래 비교에서 폐기된다.
    const epoch = profileEpochRef.current;

    try {
      // ProfileContext의 캐시된 데이터 사용 (페이지 이동 시 재호출 방지)
      let cachedResult = await fetchCachedProfile(targetUserId || undefined, forceRefresh);
      if (epoch !== profileEpochRef.current) return; // 사용자 전환 — stale 응답 폐기

      // targetUserId로 조회 실패 시, 로그인 사용자 본인 프로필로 폴백 시도
      if ((!cachedResult || !cachedResult.data) && targetUserId && sessionUserId) {
        const fallbackResult = await fetchCachedProfile(undefined, true);
        if (epoch !== profileEpochRef.current) return; // 사용자 전환 — stale 응답 폐기
        if (fallbackResult?.data?.id === sessionUserId) {
          // 본인 프로필인지 확인: 세션 ID가 URL의 userId를 포함하는지 체크 (UUID 잘림 대응)
          if (sessionUserId === targetUserId || sessionUserId.startsWith(targetUserId)) {
            cachedResult = fallbackResult;
            setIsOwner(true);
          }
        }
      }

      if (!cachedResult || !cachedResult.data) {
        console.error("Failed to fetch profile from cache");
        console.log("[hasData] cachedResult 실패로 false 설정", cachedResult);
        setHasData(false);
        setHasSeasonData(false);
        return;
      }

      const result = {
        success: true,
        data: cachedResult.data,
        completionRate: cachedResult.completionRate,
        reliabilityRate: cachedResult.reliabilityRate,
        practicalCounts: cachedResult.practicalCounts,
        practicalStats: cachedResult.practicalStats,
        careerProjectCount: cachedResult.careerProjectCount,
        careerActivityCount: cachedResult.careerActivityCount,
        badges: cachedResult.badges,
        point: cachedResult.point,
        seasonHistories: cachedResult.seasonHistories,
        resumeCardSettings: cachedResult.resumeCardSettings,
        growthPeriodStats: cachedResult.growthPeriodStats,
      };

      if (result.success && result.data) {
        console.log("[hasData] true로 설정됨");
        setHasData(true);
        const profile = result.data;

        // 본인 여부 확인 (어드민 계정은 모든 프로필 편집 가능)
        const currentUserId = session?.user?.id;
        const fetchedProfileId = profile.id;
        console.log("[isOwner] session.user.id:", currentUserId, "| targetUserId:", targetUserId, "| profile.id:", fetchedProfileId);
        if (session?.user?.isAdmin) {
          console.log("[isOwner] 어드민(마더) 계정 — 전체 편집 권한");
          setIsOwner(true);
        } else if (currentUserId) {
          const ownerCheck = !targetUserId || targetUserId === currentUserId || fetchedProfileId === currentUserId;
          console.log("[isOwner] 결과:", ownerCheck, "| !targetUserId:", !targetUserId, "| url일치:", targetUserId === currentUserId, "| profile일치:", fetchedProfileId === currentUserId);
          setIsOwner(ownerCheck);
        }

        // 슬로건 우선순위: 병렬 fetch 로 먼저 도착한 pending → sessionStorage 캐시 → 빈 값
        // (source of truth = user_introductions.slogan_1. bio 는 다른 도메인이므로 fallback 으로 쓰지 않는다.)
        let cachedSlogan: string | null = null;
        try {
          if (typeof window !== "undefined") {
            cachedSlogan = sessionStorage.getItem(`sidebar:slogan1:${targetUserId || "self"}`);
          }
        } catch {}
        const initialQuote = pendingSloganRef.current ?? cachedSlogan ?? "";

        // mapping 은 buildSidebarUserProfile 로 일원화 — cache-init useLayoutEffect 와
        // 동일한 full set 을 produce. team/part/membershipLevel 누락 재발 방지.
        setUserProfile(buildSidebarUserProfile(profile, initialQuote));

        // 학력은 프로필 응답 후 로드 (슬로건은 별도 useEffect에서 이미 병렬 실행)
        fetchEducations();

        // 메달 상태 — DTO(profile.status + growthInfo.currentSeasonStatus + growthStatus) 기반 단일 매핑.
        // 캐시 init(useLayoutEffect) 경로와 동일 함수 사용 — 두 경로 매핑이 갈리지 않게 한다.
        setCrewStatus(resolveCrewStatus(profile.status, cachedResult.growthInfo?.currentSeasonStatus, cachedResult.growthInfo?.growthStatus));

        // completionRate (활동 완료율) - API 응답에서 가져오기
        if (result.completionRate !== undefined && result.completionRate !== null) {
          setHasCompletionData(true);
          setCompletionRate(result.completionRate);
        } else {
          setHasCompletionData(false);
          setCompletionRate(null);
        }

        // reliabilityRate (일정 신뢰도) - API 응답에서 가져오기 (별도 supabase 쿼리 불필요)
        if (result.reliabilityRate !== undefined && result.reliabilityRate !== null) {
          setHasReliabilityData(true);
          setReliabilityRate(result.reliabilityRate);
        } else {
          setHasReliabilityData(false);
          setReliabilityRate(null);
        }

        // 스킬 카드 데이터 - API 응답에서 가져오기 (중복 호출 제거)
        if (result.practicalCounts) {
          const { competency, experience, info } = result.practicalCounts;
          const careerSkillCount = resolveCareerSkillCount(result);
          setPracticalCompetency(competency);
          // 실무역량 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
          setPracticalCompetencyCount(typeof competency === "number" ? competency : null);
          setPracticalExperience(experience);
          // 실무경험 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
          setPracticalExperienceCount(typeof experience === "number" ? experience : null);
          setPracticalInfo(info);
          // 실무정보 라인 강화 성공 누적 횟수 — API 응답값 그대로(0 포함). 재계산 금지.
          setPracticalInfoCount(typeof info === "number" ? info : null);
          // 실무경력 누적 프로젝트 수 — API 응답값 그대로(0 포함). 재계산 금지.
          setPracticalCareerCount(careerSkillCount);
          setHasActivityData(competency > 0 || experience > 0 || info > 0 || (careerSkillCount ?? 0) > 0);
        } else {
          setHasActivityData(false);
          setPracticalCompetencyCount(null);
          setPracticalExperienceCount(null);
          setPracticalInfoCount(null);
          setPracticalCareerCount(null);
        }

        // 배지 데이터 설정 (별, 번개, 방패)
        if (result.badges) {
          setBadgeData(result.badges);
          setHasBadgeData(true);
        } else {
          setHasBadgeData(false);
        }

        // point DTO (check/advantage/penalty) — resume-badges 표시 SoT.
        // 값 정규화: null/undefined/NaN → 0, 문자열 숫자 → Number().
        if (result.point) {
          setPointData({
            check: toPointNum(result.point.check),
            advantage: toPointNum(result.point.advantage),
            penalty: toPointNum(result.point.penalty),
          });
        } else {
          setPointData(null);
        }

        // 시즌 히스토리 데이터 설정
        if (result.seasonHistories && result.seasonHistories.length > 0) {
          setSeasonHistories(result.seasonHistories);
          setHasSeasonData(true);
        } else {
          setHasSeasonData(false);
        }

        // resume-card admin settings 적용 (있는 필드만 덮어씌움)
        if (result.resumeCardSettings) {
          setResumeCardSettings(result.resumeCardSettings);
          const s = result.resumeCardSettings;
          if (s.hexagonLink1) setIconLink1(s.hexagonLink1);
          if (s.hexagonLink2) setIconLink2(s.hexagonLink2);
          if (s.hexagonLink3) setIconLink3(s.hexagonLink3);
        }

        // 성장 성공 주차 수 (cluster-4-card의 cumulativeApprovedWeeks와 동일 소스)
        if (result.growthPeriodStats?.approvedWeeks !== undefined) {
          setApprovedWeeksCount(result.growthPeriodStats.approvedWeeks);
        } else {
          setApprovedWeeksCount(null);
        }
      }
    } catch (error) {
      console.error("프로필 로드 오류:", error);
      console.log("[hasData] catch에서 false로 설정됨", error);
      if (epoch === profileEpochRef.current) {
        setHasData(false);
        setHasSeasonData(false);
      }
    } finally {
      // superseded 된 이전 대상 fetch 가 새 로딩의 Skeleton 게이트를 조기 해제하지 못하게 한다.
      if (epoch === profileEpochRef.current) setFetchSettled(true);
    }
  };

  // 학력 데이터 가져오기 (최종학력)
  const fetchEducations = async () => {
    const epoch = profileEpochRef.current;
    try {
      const apiUrl = targetUserId ? `/api/educations?userId=${targetUserId}` : "/api/educations";
      const result: any = await dedupedJson(apiUrl);
      if (epoch !== profileEpochRef.current) return; // 사용자 전환 — stale 응답 폐기

      if (result?.success && result.data && result.data.length > 0) {
        // 최종학력 (isFinal: true) 찾기
        const finalEducation = result.data.find((edu: { isFinal: boolean }) => edu.isFinal);
        if (finalEducation) {
          setUserProfile((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              school: finalEducation.school || "",
              major: finalEducation.major1 || "",
              major2: finalEducation.major2 || "",
              major3: finalEducation.major3 || "",
              enrollPeriod: finalEducation.period || "",
              graduationStatus: finalEducation.status || "",
              gpa: finalEducation.gradeValue || "",
              gpaMax: finalEducation.gradeMax || "",
            };
          });
        }
      }
    } catch (error) {
      console.error("학력 로드 오류:", error);
    }
  };

  // 슬로건 데이터 가져오기 (user_introductions.slogan_1 — canonical source)
  // 프로필 fetch와 병렬로 실행 → 프로필보다 먼저 도착하면 pendingSloganRef에 보관.
  // 응답이 빈 값이어도 quote 를 명시적으로 빈 값으로 갱신 → admin 이 slogan 을 비웠을 때
  // 사용자 페이지가 stale 한 옛 값(pending/cached)을 그대로 표시하지 않도록 한다.
  // (currentProfile 단계에서 빈 값 → SECTION2_SLOGAN_DEFAULTS 로 fallback 처리됨.)
  const fetchSlogan = async () => {
    const epoch = profileEpochRef.current;
    try {
      const apiUrl = targetUserId ? `/api/slogans?userId=${targetUserId}` : "/api/slogans";
      const result: any = await dedupedJson(apiUrl);
      if (epoch !== profileEpochRef.current) return; // 사용자 전환 — stale 응답 폐기

      if (!result?.success) {
        return;
      }

      const content = (result.data?.slogan1?.content as string | null | undefined) ?? "";
      // sessionStorage 캐싱: 값이 있으면 set, 빈 값이면 명시적으로 remove (stale 방지)
      try {
        if (typeof window !== "undefined") {
          const key = `sidebar:slogan1:${targetUserId || "self"}`;
          if (content) {
            sessionStorage.setItem(key, content);
          } else {
            sessionStorage.removeItem(key);
          }
        }
      } catch {}

      setUserProfile((prev) => {
        if (!prev) {
          // 프로필이 아직 도착 안 함 → pending 에 보관, 프로필 setUserProfile 시 사용됨
          pendingSloganRef.current = content;
          return prev;
        }
        pendingSloganRef.current = null;
        return { ...prev, quote: content };
      });
    } catch (error) {
      console.error("슬로건 로드 오류:", error);
    }
  };

  // 세션 또는 targetUserId 변경 시 프로필 + 슬로건 병렬 로드 (플리커 최소화)
  // sessionStatus를 deps에 포함 — loading→authenticated/unauthenticated 전환 시 effect 재실행 보장.
  // (session reference가 null→null로 유지되는 unauthenticated 케이스에서 fetch가 영영 skip되던 회귀 방지)
  // pathname을 deps에 포함 — 뒤로가기로 cluster-* 복귀 시 segment 재사용 케이스에서도 effect 재실행 보장.
  // 정책: targetUserId가 있으면 session 상태 무관 fetch (fetchUserProfile 내부 가드 참조).
  useEffect(() => {
    if (demoMode) return; // 더미 모드면 API 안 부름
    if (shouldFetchProfile) {
      fetchUserProfile();
      fetchSlogan();
    }
  }, [shouldFetchProfile, sessionStatus, sessionUserId, targetUserId, demoMode, pathname]);

  // [진단] 뒤로가기/마운트 직후 화면 상태 로깅. 검은 화면 시점에
  // .page-reveal opacity / children 존재 여부를 함께 출력 → PageReveal 회귀인지,
  // Sidebar/data 상태 문제인지 즉시 판별 가능.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pageRevealEl = document.querySelector(".page-reveal") as HTMLElement | null;
    const computedOpacity = pageRevealEl ? getComputedStyle(pageRevealEl).opacity : "(no .page-reveal)";
    const childCount = pageRevealEl ? pageRevealEl.childElementCount : 0;
    const innerHTMLLen = pageRevealEl ? pageRevealEl.innerHTML.length : 0;
    // eslint-disable-next-line no-console
    console.table({
      pathname,
      searchParams: searchParams?.toString() || "",
      sessionStatus,
      sessionUserId: session?.user?.id ?? null,
      targetUserId: targetUserId ?? null,
      hasData,
      isMounted,
      demoMode,
      profileId: cachedProfile?.data?.id ?? null,
      pageRevealExists: !!pageRevealEl,
      pageRevealOpacity: computedOpacity,
      pageRevealChildCount: childCount,
      pageRevealInnerHTMLLen: innerHTMLLen,
    });
  }, [pathname, sessionStatus, targetUserId, hasData, isMounted, demoMode, session?.user?.id, cachedProfile?.data?.id, searchParams]);

  // 슬로건 변경 이벤트 수신 → .resume-card 즉시 반영
  useEffect(() => {
    const handleSloganUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.slogan1?.content !== undefined) {
        const newContent = detail.slogan1.content || "";
        // sessionStorage 캐시도 함께 갱신 (다음 방문 플리커 방지)
        try {
          if (typeof window !== "undefined") {
            const key = `sidebar:slogan1:${targetUserId || "self"}`;
            if (newContent) {
              sessionStorage.setItem(key, newContent);
            } else {
              sessionStorage.removeItem(key);
            }
          }
        } catch {}
        setUserProfile((prev) => {
          if (!prev) return prev;
          return { ...prev, quote: newContent };
        });
      }
    };
    window.addEventListener("sloganUpdated", handleSloganUpdated);
    return () => window.removeEventListener("sloganUpdated", handleSloganUpdated);
  }, [targetUserId]);

  // 학력 변경 이벤트 수신 → .resume-card 즉시 반영
  useEffect(() => {
    const handleEducationUpdated = () => {
      fetchEducations();
    };
    window.addEventListener("educationUpdated", handleEducationUpdated);
    return () => window.removeEventListener("educationUpdated", handleEducationUpdated);
  }, []);

  // 프로필 사진 변경 이벤트 수신 → Sidebar 즉시 반영
  useEffect(() => {
    const handlePhotoUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.photo) {
        setUserProfile(prev => prev ? { ...prev, photo: detail.photo } : prev);
      }
    };
    window.addEventListener("photoUpdated", handlePhotoUpdated);
    return () => window.removeEventListener("photoUpdated", handlePhotoUpdated);
  }, []);

  // Error state for validation
  const [errors, setErrors] = useState({
    lastName: "",
    firstName: "",
    lastNameEng: "",
    firstNameEng: "",
    email: "",
  });

  // 한글만 허용하는 검증 함수
  const isKoreanOnly = (text: string) => {
    const koreanRegex = /^[가-힣]*$/;
    return koreanRegex.test(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNameChange = async (e: React.ChangeEvent<HTMLInputElement>, field: "lastName" | "firstName", maxLength: number) => {
    const { value } = e.target;

    if (value.length <= maxLength) {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (value && !isKoreanOnly(value)) {
        setErrors((prev) => ({ ...prev, [field]: "한글만 입력해주세요" }));
      } else {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    } else {
      await showAlert(`최대 ${maxLength}자까지 입력할 수 있습니다.`);
    }
  };

  // 영문 이름 입력 핸들러
  const isEnglishOnly = (text: string) => /^[a-zA-Z\s]*$/.test(text);

  const handleEngNameChange = async (e: React.ChangeEvent<HTMLInputElement>, field: "lastNameEng" | "firstNameEng", maxLength: number) => {
    const { value } = e.target;

    if (value.length <= maxLength) {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (value && !isEnglishOnly(value)) {
        setErrors((prev) => ({ ...prev, [field]: "영문만 입력해주세요" }));
      } else {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    } else {
      await showAlert(`최대 ${maxLength}자까지 입력할 수 있습니다.`);
    }
  };

  // 필수 필드 유효성 검사 (학력 관련 필드 제외 - 별도 섹션에서 입력)
  const validateForm = () => {
    const requiredFields = [
      { key: "lastName", label: "성" },
      { key: "firstName", label: "이름" },
      { key: "gender", label: "성별" },
      { key: "birthDate", label: "생년월일" },
      { key: "addressCity", label: "시/도" },
      { key: "addressDistrict", label: "구/군" },
      { key: "phone", label: "핸드폰번호" },
      { key: "emailId", label: "이메일" },
      { key: "emailDomain", label: "이메일 도메인" },
    ];

    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = formData[field.key as keyof typeof formData];
      if (!value || value.trim() === "") {
        missingFields.push(field.label);
      }
    }

    // 직접입력 이메일 도메인 체크
    if (formData.emailDomain === "직접입력" && (!formData.customEmailDomain || formData.customEmailDomain.trim() === "")) {
      missingFields.push("이메일 도메인 (직접입력)");
    }

    return missingFields;
  };

  // 승인 상태 확인 함수
  const checkApprovalStatus = async () => {
    if (!session) return false;

    try {
      setIsCheckingStatus(true);
      const response = await fetch("/api/auth/check-status");
      const result = await response.json();

      if (result.success && result.status === "approved") {
        setIsApproved(true);
        return true;
      } else {
        setIsApproved(false);
        return false;
      }
    } catch (error) {
      console.error("승인 상태 확인 오류:", error);
      setIsApproved(false);
      return false;
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // 프로필 데이터 로드 함수
  const loadProfile = async () => {
    try {
      // 어드민이 다른 유저 프로필 편집 시 해당 유저의 데이터 로드
      const profileUrl = targetUserId && session?.user?.isAdmin
        ? `/api/profile/?userId=${targetUserId}`
        : "/api/profile/";
      const response = await fetch(profileUrl);
      const result = await response.json();

      if (result.success && result.data) {
        const profile = result.data;

        // user_profiles → formData 변환
        // 한글 이름 분리: 공백이 있으면 공백 기준, 없으면 첫 글자(또는 2글자 성)를 성으로 분리
        const displayName = profile.display_name || "";
        let lastName = "";
        let firstName = "";
        if (displayName.includes(" ")) {
          const displayNameParts = displayName.split(" ");
          lastName = displayNameParts[0] || "";
          firstName = displayNameParts.slice(1).join(" ") || "";
        } else if (displayName.length > 0) {
          // 2글자 성 목록 (복성)
          const twoCharLastNames = ["남궁", "제갈", "황보", "선우", "독고", "동방", "사공", "서문", "소봉", "장곡"];
          const firstTwo = displayName.substring(0, 2);
          if (displayName.length > 2 && twoCharLastNames.includes(firstTwo)) {
            lastName = firstTwo;
            firstName = displayName.substring(2);
          } else {
            lastName = displayName.substring(0, 1);
            firstName = displayName.substring(1);
          }
        }

        // 정규 컬럼명으로 읽는다(레거시 키 fallback 유지). GET /api/profile 는 user_profiles
        // raw row 를 그대로 반환하므로 english_name / contact_email / contact_phone 가 정본.
        // (과거엔 존재하지 않는 eng_name/email/phone 을 읽어 편집 모달이 항상 빈칸으로 떠,
        //  저장 시 기존 값을 빈 값으로 덮어쓸 위험이 있었다.)
        const engNameParts = (
          profile.english_name || profile.englishName || profile.eng_name || ""
        ).split(" ");
        const lastNameEng = engNameParts[0] || "";
        const firstNameEng = engNameParts.slice(1).join(" ") || "";

        const addressParts = (profile.address || "").split(" ");
        const addressCity = addressParts[0] || "";
        const addressDistrict = addressParts.slice(1).join(" ") || "";

        const emailParts = (profile.contact_email || profile.email || "").split("@");
        const emailId = emailParts[0] || "";
        const emailDomain = emailParts[1] || "";

        const phoneParts = (profile.contact_phone || profile.phone || "")
          .replace(/^010-?/, "")
          .split("-");

        setFormData((prev) => ({
          ...prev,
          lastName,
          firstName,
          lastNameEng,
          firstNameEng,
          gender: profile.gender === "남" ? "male" : profile.gender === "여" ? "female" : "",
          birthDate: profile.birth_date || "",
          addressCity,
          addressDistrict,
          phone: phoneParts.length >= 2 ? `${phoneParts[0]}-${phoneParts[1]}` : (profile.contact_phone || profile.phone)?.replace(/^010-?/, "") || "",
          emailId,
          emailDomain,
          vision: profile.vision || "",
          phoneComment: (profile.contactAvailable ?? profile.contact_available) || DEFAULT_PHONE_COMMENT,
        }));
      }
    } catch (error) {
      console.error("프로필 로드 오류:", error);
    }
  };

  // 프로필 수정 버튼 클릭 핸들러
  const handleEditButtonClick = async () => {
    // 로컬 데모 모드 또는 테스트 유저(데모) 모드면 세션 없이도 편집 모달을 연다.
    // (저장은 PUT/PATCH 가 demoUserId 를 받아 test_user_markers 검증 후 대상 유저로 기록.)
    if (demoMode || demoUserId) {
      profileFormSnapshotRef.current = formData;
      setIsEditModalOpen(true);
      return;
    }

    if (!session) {
      await showAlert("로그인이 필요합니다.");
      return;
    }

    // 어드민(마더) 계정은 승인 체크 건너뛰기
    if (!session.user?.isAdmin) {
      const approved = await checkApprovalStatus();

      if (!approved) {
        await showAlert("아직 회원 상태가 어드민 승인 대기 중입니다.");
        return;
      }
    }

    // 승인된 경우 프로필 로드 후 모달 열기
    await loadProfile();
    profileFormSnapshotRef.current = formData;
    setIsEditModalOpen(true);
  };

  // 모달 필드 네비게이션: Enter로 다음 필드 이동
  const navigateToNextField = async (currentNavIndex: number) => {
    const allNav = Array.from(document.querySelectorAll("[data-nav-index]")) as HTMLElement[];
    const sorted = allNav.sort((a, b) => Number(a.getAttribute("data-nav-index")) - Number(b.getAttribute("data-nav-index")));
    const currentPos = sorted.findIndex((el) => Number(el.getAttribute("data-nav-index")) === currentNavIndex);
    if (currentPos < 0 || currentPos >= sorted.length - 1) {
      const submitBtn = document.querySelector('.edit-modal-content button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.click();
      return;
    }
    const next = sorted[currentPos + 1];
    const dropdownName = next.getAttribute("data-nav-dropdown");
    if (dropdownName) {
      setOpenDropdown(dropdownName);
      next.focus();
    } else {
      next.focus();
    }
  };

  const handleEnterKeyNavigation = async (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const navIndex = Number(el.getAttribute("data-nav-index"));
    const dropdownName = el.getAttribute("data-nav-dropdown");
    if (dropdownName) {
      setOpenDropdown(dropdownName);
    } else {
      navigateToNextField(navIndex);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (demoMode) {
      await showAlert("저장되었습니다.");
      setIsEditModalOpen(false);
      return;
    }

    const missingFields = validateForm();

    if (missingFields.length > 0) {
      await showAlert(`다음 필드를 입력해주세요:\n${missingFields.join(", ")}`);
      return;
    }

    try {
      setIsSaving(true);

      // formData → user_profiles 필드 변환
      const profileData = {
        display_name: `${formData.lastName}${formData.firstName}`.trim(),
        eng_name: `${formData.lastNameEng}${formData.firstNameEng}`.trim(),
        gender: formData.gender === "male" ? "남" : formData.gender === "female" ? "여" : null,
        birth_date: formData.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.birthDate) ? formData.birthDate : null,
        address: `${formData.addressCity} ${formData.addressDistrict}`.trim() || null,
        phone: formData.phone ? `010-${formData.phone}` : null,
        email: formData.emailId && formData.emailDomain ? `${formData.emailId}@${formData.emailDomain === "직접입력" ? formData.customEmailDomain : formData.emailDomain}` : null,
        vision: formData.vision || null,
        portfolio_files: iconLink3 || null,
        contact_available: formData.phoneComment || null,
        // 테스트 유저(데모) 모드: demoUserId 를 함께 보내면 백엔드가 (데모 활성 + test_user_markers +
        // owner/admin) 검증 후 저장 대상을 테스트 유저로 고정한다. demoUserId 부재 시 일반 경로(본인 저장).
        ...(demoUserId ? { demoUserId } : {}),
      };

      const response = await fetch(apiUrl("/api/profile/"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (result.success) {
        await showAlert("저장되었습니다.");
        setIsEditModalOpen(false);
        // 캐시 무효화 후 프로필 데이터 새로고침
        clearProfileCache();
        fetchUserProfile(true);
      } else {
        await showAlert(result.error || "프로필 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("프로필 저장 오류:", error);
      await showAlert("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 일정 신뢰도(reliability_rate) - fetchUserProfile에서 /api/profile 응답으로 처리하므로 별도 쿼리 불필요
  // (성능 최적화: 중복 supabase 쿼리 제거)

  // 활동 완료율: fetchUserProfile에서 /api/profile 응답으로 처리하므로 별도 쿼리 불필요
  // (RLS 정책으로 인해 클라이언트 직접 쿼리 시 실패)
  /*
  useEffect(() => {
    const fetchCompletionRate = async () => {
      const userId = targetUserId || session?.user?.id;
      console.log('[Sidebar] fetchCompletionRate 시작, userId:', userId);
      if (!userId) {
        console.log('[Sidebar] userId 없음, return');
        setHasCompletionData(false);
        setCompletionRate(null);
        return;
      }

      try {
        // 1. 유저의 가입 주차 정보 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("joined_week_id")
          .eq("user_id", userId)
          .maybeSingle();

        console.log('[Sidebar] profileData:', profileData, 'profileError:', profileError);

        if (profileError || !profileData?.joined_week_id) {
          console.log('[Sidebar] joined_week_id 없음, return');
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        // 2. 가입 주차의 시작일 가져오기
        const { data: joinedWeekData, error: weekError } = await supabase
          .from("weeks")
          .select("start_date")
          .eq("id", profileData.joined_week_id)
          .maybeSingle();

        if (weekError || !joinedWeekData?.start_date) {
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        const joinedWeekStartDate = joinedWeekData.start_date;

        // 3. 가입 주차 이후의 모든 주차 ID 가져오기 (break 시즌 제외)
        const { data: weeksData, error: weeksError } = await supabase
          .from("weeks")
          .select("id, season_id, seasons(name)")
          .gte("start_date", joinedWeekStartDate);

        console.log('[Sidebar] weeksData:', weeksData?.length, 'weeksError:', weeksError);

        if (weeksError || !weeksData) {
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        // break 시즌 주차 제외
        const validWeekIds = weeksData
          .filter((w: { seasons: { name: string } | null }) => {
            // seasons가 null이면 포함 (break 시즌이 아님)
            if (!w.seasons) return true;
            return !w.seasons.name?.toLowerCase().includes('break');
          })
          .map((w: { id: string }) => w.id);

        console.log('[Sidebar] validWeekIds:', validWeekIds.length);

        if (validWeekIds.length === 0) {
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        // 4. P: 가입 주차 이후 열린 모든 활동 수 (weekly_activities에서 is_active=true)
        const { data: weeklyActivitiesData, error: waError } = await supabase
          .from("weekly_activities")
          .select("week_id, activity_type_id")
          .in("week_id", validWeekIds)
          .eq("is_active", true);

        if (waError) {
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        const totalP = weeklyActivitiesData?.length || 0;
        console.log('[Sidebar] totalP (열린 활동 수):', totalP);

        // 5. R: 완료한 활동 수 (activity_records에서 is_completed=true)
        const { data: activityRecordsData, error: arError } = await supabase
          .from("activity_records")
          .select("week_id, activity_type_id")
          .eq("user_id", userId)
          .eq("is_completed", true);

        if (arError) {
          console.error('[Sidebar] activity_records 오류:', arError);
          setHasCompletionData(false);
          setCompletionRate(null);
          return;
        }

        const totalR = activityRecordsData?.length || 0;
        console.log('[Sidebar] totalR (완료한 활동 수):', totalR);

        // 6. 활동 이행율 계산: (R / P) × 100
        if (totalP === 0) {
          console.log('[Sidebar] totalP가 0이라 completionRate를 null로 설정');
          setHasCompletionData(false);
          setCompletionRate(null);
        } else {
          const rate = Math.round((totalR / totalP) * 100);
          console.log('[Sidebar] completionRate 계산 결과:', rate, '%');
          setHasCompletionData(true);
          setCompletionRate(rate);
        }
      } catch (err) {
        console.error("활동 완료율 조회 오류:", err);
        setHasCompletionData(false);
        setCompletionRate(null);
      }
    };

    fetchCompletionRate();
  }, [session?.user?.id, targetUserId]);
  */

  // 스킬 카드 데이터 - fetchUserProfile에서 /api/profile 응답으로 처리하므로 별도 호출 불필요
  // (성능 최적화: 중복 API 호출 제거)

  useEffect(() => {
    // 0에서 올라가는 애니메이션
    const animateNumber = (setter: (val: number) => void, target: number, duration: number = 1000) => {
      const steps = 30;
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(current));
        }
      }, duration / steps);

      return timer;
    };

    // 프로필별 데이터 설정
    const profileStats = {
      OK: {
        stat1: 100,
        stat2: 80,
        badge1: 99999,
        badge2: 99999,
        badge3: -9999,
        skill1: 21,
        skill2: 21,
        skill3: 21,
        skill4: 21,
      },
      EC: {
        stat1: Math.floor(Math.random() * 100) + 1,
        stat2: Math.floor(Math.random() * 100) + 1,
        badge1: Math.floor(Math.random() * 99999) + 1,
        badge2: Math.floor(Math.random() * 99999) + 1,
        badge3: -(Math.floor(Math.random() * 9999) + 1),
        skill1: Math.floor(Math.random() * 99) + 1,
        skill2: Math.floor(Math.random() * 99) + 1,
        skill3: Math.floor(Math.random() * 99) + 1,
        skill4: Math.floor(Math.random() * 99) + 1,
      },
      PX: {
        stat1: Math.floor(Math.random() * 100) + 1,
        stat2: Math.floor(Math.random() * 100) + 1,
        badge1: Math.floor(Math.random() * 90) + 10,
        badge2: Math.floor(Math.random() * 900) + 100,
        badge3: -(Math.floor(Math.random() * 90) + 10),
        skill1: Math.floor(Math.random() * 99) + 1,
        skill2: Math.floor(Math.random() * 99) + 1,
        skill3: Math.floor(Math.random() * 99) + 1,
        skill4: Math.floor(Math.random() * 99) + 1,
      },
    };

    const currentStats = profileStats[debugPanelType];

    const timers = [
      animateNumber(setStat1, currentStats.stat1, 1000),
      animateNumber(setStat2, currentStats.stat2, 1000),
      // 배지 데이터 SoT: /api/profile 의 point DTO (check/advantage/penalty).
      //   point 미수신 시 badgeData(stars/shields/lightnings) → 데모 currentStats 순 폴백.
      // 포인트 표시 정책(2026-06-04): 방패=net·번개=−n 은 서버 표시 최종값 — 그대로 렌더.
      //   (구 Math.abs(lightnings) 가공 제거. 데모 시드 penalty 도 −n 으로 변환해 동일 정책 유지.)
      animateNumber(setBadge1, pointData ? pointData.check : (hasBadgeData ? badgeData.stars : currentStats.badge1), 1000), // icon-graphic10 ← point.check
      animateNumber(setBadge2, pointData ? pointData.advantage : (hasBadgeData ? badgeData.shields : currentStats.badge2), 1000), // icon-shield ← point.advantage(net)
      animateNumber(setBadge3, pointData ? pointData.penalty : (hasBadgeData ? (badgeData.lightnings || 0) : -Math.abs(currentStats.badge3)), 1000), // icon-graphic13(red) ← point.penalty(−n)
      animateNumber(setSkill1, currentStats.skill1, 1000),
      animateNumber(setSkill2, currentStats.skill2, 1000),
      animateNumber(setSkill3, currentStats.skill3, 1000),
      animateNumber(setSkill4, currentStats.skill4, 1000),
    ];

    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
  }, [debugPanelType, hasBadgeData, badgeData, pointData]);

  // 커스텀 스크롤바 업데이트
  const updateScrollbar = useCallback(() => {
    const container = activitiesRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const trackHeight = clientHeight;
    const thumbHeight = 44;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

    setScrollThumbTop(thumbTop);
  }, []);

  // 테마 변경 시 스크롤 위치 리셋 + 스크롤바 업데이트
  useEffect(() => {
    const container = activitiesRef.current;
    if (!container) return;

    container.scrollTop = 0;
    setScrollThumbTop(0);
  }, [debugPanelType]);

  // 드래그 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = activitiesRef.current?.scrollTop || 0;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !activitiesRef.current) return;

      const container = activitiesRef.current;
      const { scrollHeight, clientHeight } = container;
      const trackHeight = clientHeight;
      const thumbHeight = 44;
      const maxThumbTop = trackHeight - thumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;

      const deltaY = e.clientY - dragStartY.current;
      const scrollRatio = maxScrollTop / maxThumbTop;
      const newScrollTop = dragStartScrollTop.current + deltaY * scrollRatio;

      container.scrollTop = Math.max(0, Math.min(maxScrollTop, newScrollTop));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // [렌더 게이트] 모든 상태에서 명시적 UI 보장 — 절대 blank frame 금지.
  //   ┌──────────────────────────────────┬─────────────────────────────┐
  //   │ 상태                              │ 렌더                         │
  //   ├──────────────────────────────────┼─────────────────────────────┤
  //   │ !isMounted                       │ 투명 placeholder (hydration) │
  //   │ sessionStatus === "loading"       │ Skeleton ("Authenticating…") │
  //   │ fetch 진행 중 (!hasData + 식별자) │ Skeleton ("Loading…")        │
  //   │ unauthenticated + !targetUserId   │ defaultProfile로 정상 렌더   │
  //   │ hasData=true / demoMode           │ 정상 sidebarContent          │
  //   └──────────────────────────────────┴─────────────────────────────┘
  //
  // 식별자 보강: "session 있음"의 기준은 session?.user?.id 존재까지 확인.
  // (NextAuth 일부 케이스에서 status="authenticated"이지만 user 정보가 비어있을 수 있음 →
  //  이 상태로 fetch가 일어나면 own profile lookup이 깨지므로, fetch 흐름에서는
  //  hasUserIdentity 기준으로만 식별자 인정)
  const hasUserIdentity = hasFetchIdentity;

  // 이력서 카드 자리 예약 + 공용 LoadingPanel(금장 마스코트) —
  // cluster2/3/4 로딩 게이트와 동일한 시각 언어. label 은 스크린리더/진단용 문구.
  //
  // [너비 고정 — layout shift 방지] skeleton/placeholder 의 레이아웃 박스는 실제 카드
  // 렌더와 동일한 .sidebar-card-shell(497×875 × cardScale) 구조를 그대로 사용한다.
  // 이전에는 489×1001 고정 박스라서 cardScale>1 환경(1080p≈583px, 1921px+≈651px)에서
  // 로딩 중 사이드바 칼럼이 좁았다가 데이터 도착 후 넓어지는 shift 가 발생했다.
  // 내부 박스도 실제 .resume-card(489×855)와 동일 크기 + 동일 scale transform.
  // width/height 는 CSS 변수(--resume-shell-*) — SSR/hydration 전 첫 페인트는 SCSS 기본값
  // (583/1026, 1921px+ 은 651/1146), 이후엔 calculateScale 이 실측값으로 갱신.
  // 실카드 shell 도 동일 변수를 쓰므로 로딩↔완료 간 너비가 정의상 일치한다.
  const reservedShellStyle: React.CSSProperties = {
    width: isMobileView ? "100%" : "var(--resume-shell-width, 583px)",
    height: isMobileView ? "auto" : "var(--resume-shell-height, 1026px)",
    overflow: "visible",
    display: isMobileView ? "block" : "flex",
    justifyContent: isMobileView ? undefined : "center",
  };
  const renderSkeleton = (label: string) => (
    <div className="home-two-sidebar-col">
      <div className="sidebar-card-shell" style={reservedShellStyle}>
        <div
          aria-busy="true"
          aria-live="polite"
          style={{
            width: "489px",
            minWidth: "489px",
            height: "855px",
            borderRadius: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...(isMobileView
              ? {}
              : { transform: `scale(${cardScale})`, transformOrigin: "top center" }),
          }}
        >
          <LoadingPanel
            message={label === "Authenticating…" ? "로그인 정보를 확인하고 있어요…" : undefined}
            minHeight={0}
          />
        </div>
      </div>
    </div>
  );

  // 1) Hydration 가드 (항상 첫 단계): SSR 첫 페인트와 일치시키기 위해 투명 reserve.
  //    레이아웃 박스는 skeleton/실카드와 동일한 shell 구조 — 너비 점프 방지.
  if (!isMounted) {
    return (
      <div className="home-two-sidebar-col">
        <div className="sidebar-card-shell" style={reservedShellStyle} />
      </div>
    );
  }

  // 2) Session loading: blank frame 대신 명시적 skeleton 노출.
  if (sessionStatus === "loading") {
    return renderSkeleton("Authenticating…");
  }

  // 3) 사용자 전환 첫 프레임: 전환 reset effect 는 커밋 후(post-paint)에 실행되므로,
  //    그보다 먼저 평가되는 렌더 시점에 prev↔현재 targetUserId 불일치를 감지해
  //    이전 사용자(A) 데이터가 새 사용자(B) URL 아래 단 한 프레임도 페인트되지 않게 차단.
  //    (effect 가 state 를 비우고 ref 를 갱신하면 다음 렌더부터는 4)의 일반 게이트가 이어받는다.)
  const isUserSwitching = prevTargetUserIdRef.current !== targetUserId;
  if (!demoMode && isUserSwitching) {
    return renderSkeleton("Loading…");
  }

  // 4) Fetch 대기 중: 식별자(targetUserId 또는 session.user.id)가 있는데 hasData=false → skeleton.
  //    (식별자 없으면 fetch가 일어나지 않으므로 무한 skeleton 회피하고 정상 렌더로 fallthrough)
  //    fetchSettled=true 면 fetch 가 한 번이라도 완료된 상태 — 영구 실패(잘못된 UUID/본인 프로필 미존재 등)
  //    여도 무한 skeleton('블랙 화면') 회피하고 defaultProfile 로 fallthrough.
  if (!demoMode && !hasData && hasUserIdentity && !fetchSettled) {
    return renderSkeleton("Loading…");
  }

  // ★ 모바일: 슬라이드 패널 전체를 body에 Portal 렌더링
  const sidebarContent = (
    <div className="home-two-sidebar-col">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .arrow-shake {
          animation: shake 0.4s ease-in-out;
        }
        .custom-tooltip {
          position: fixed;
          background: rgba(30, 32, 40, 0.95);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 14px;
          color: #fff;
          white-space: nowrap;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          font-family: 'Pretendard', sans-serif;
          pointer-events: none;
        }
        .resume-activities::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
        }
        .resume-activities {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .modal-input::placeholder {
          color: #6b6e7a !important;
        }
        .modal-input::-webkit-input-placeholder {
          color: #6b6e7a !important;
        }
        .modal-input::-moz-placeholder {
          color: #6b6e7a !important;
        }
        .modal-input:-ms-input-placeholder {
          color: #6b6e7a !important;
        }
        .chamfer-box {
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
        }
      `,
        }}
      />
      {/* 스케일된 카드 - 비율 유지하며 화면에 맞춤 */}
      <div
        className="sidebar-card-shell"
        style={{
          // transform scale은 레이아웃 크기를 바꾸지 않기 때문에,
          // 확대(>1) 시에는 wrapper의 레이아웃 폭도 함께 늘려 "잘림"을 방지한다.
          // 크기는 skeleton/placeholder 와 공유하는 reservedShellStyle(--resume-shell-*)
          // 를 그대로 사용 — 로딩 중↔데이터 렌더 후 카드 영역 너비가 정의상 동일.
          ...reservedShellStyle,
        }}
      >
        <div
          ref={cardRef}
          className={`resume-card ${debugPanelType === "EC" ? "ec-theme" : debugPanelType === "PX" ? "px-theme" : ""}`}
          style={
            {
              position: "relative",
              "--identity-tab-bg": `url('${tabBg.src}')`,
              "--identity-tab-overlay": String(tabBg.overlay),
              ...(isMobileView ? {} : { transform: `scale(${cardScale})`, transformOrigin: "top center" }),
            } as React.CSSProperties
          }
        >
          {/* 프로필 수정 버튼: resume-card(고정 크기, position:relative) 기준 absolute 배치 — 콘텐츠 로딩/스크롤 무관 */}
          {/* <button
              onClick={isOwner || demoMode ? handleEditButtonClick : undefined}
              style={{
                position: "absolute",
                top: "6px",
                right: "18px",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isOwner || demoMode ? "pointer" : "not-allowed",
                zIndex: 20,
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                padding: 0,
                opacity: isOwner || demoMode ? 1 : 0.4,
              }}
            >
              <i className="ti ti-pencil" style={{ fontSize: "11px", color: "#000" }}></i>
            </button> */}
          <div
            onMouseEnter={() => setShowSearchTooltip(true)}
            onMouseLeave={() => setShowSearchTooltip(false)}
            style={{
              position: "absolute",
              top: "6px",
              right: "18px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 20,
              boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.3)",
              overflow: "visible",
              transition: "all 0.3s ease",
            }}
          >
            <i className="ti ti-search" style={{ fontSize: "11px", color: "#000" }}></i>
            {showSearchTooltip && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: "0",
                  background: "#222",
                  color: "#fff",
                  fontFamily: "'Pretendard', sans-serif",
                  fontSize: "12px",
                  fontWeight: 400,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  whiteSpace: "nowrap" as const,
                  zIndex: 1000,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  pointerEvents: "none" as const,
                }}
              >
                {resumeCardSettings?.helpTooltipText || resumeCardSettings?.helpTooltipDefault || "등록된 도움말이 없습니다"}
              </div>
            )}
          </div>
          {/* Header Section */}
          <div className="resume-header" style={{ position: "relative" }}>
            <div className="resume-photo" style={{ position: "relative" }}>
              {hasData ? (
                <Image src={currentProfile.photo} alt="Profile" width={240} height={273} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#999",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: "14px", fontFamily: "Pretendard, sans-serif" }}>사진을 등록하세요.</span>
                </div>
              )}
            </div>

            {/* Hexagon Buttons */}
            <div
              style={{
                position: "absolute",
                left: "213px",
                top: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 10,
              }}
            >
              <button
                onClick={() => iconLink1 && window.open(iconLink1, "_blank")}
                style={{
                  width: "24px",
                  height: "24px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  overflow: "visible",
                  position: "relative",
                }}
                aria-label="hexagon button 1"
                onMouseEnter={() => setTooltipVisible("hexagon1")}
                onMouseLeave={() => setTooltipVisible(null)}
                onMouseMove={(e) => setTooltipPosition({ x: e.clientX + 10, y: e.clientY + 10 })}
              >
                <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/PX06.png" : "/images/0/cluster 1/00.png"} alt="" width={24} height={24} className="hexagon-border" style={{ display: "block" }} />
                <Image src="/images/0/cluster 1/001.png" alt="" width={12} height={12} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
              </button>

              <button
                onClick={() => iconLink2 && window.open(iconLink2, "_blank")}
                style={{
                  width: "24px",
                  height: "24px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  overflow: "visible",
                  position: "relative",
                }}
                aria-label="hexagon button 2"
                onMouseEnter={() => setTooltipVisible("hexagon2")}
                onMouseLeave={() => setTooltipVisible(null)}
                onMouseMove={(e) => setTooltipPosition({ x: e.clientX + 10, y: e.clientY + 10 })}
              >
                <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/PX06.png" : "/images/0/cluster 1/00.png"} alt="" width={24} height={24} className="hexagon-border" style={{ display: "block" }} />
                <Image src="/images/0/cluster 1/002.png" alt="" width={12} height={12} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // PX 컨텍스트면 /cluster-3-px 로 이동해 .cluster-px-theme wrapper 유지.
                  const targetPath = withPxRoute('/cluster-3', pathname);
                  const targetSection = 'cluster3-section3';
                  // 이미 해당 페이지에 있고 section이 DOM에 있으면 바로 스크롤
                  const section = document.querySelector('.' + targetSection);
                  if (section) {
                    const offset = 120;
                    window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
                    return;
                  }
                  // 다른 페이지에 있으면 도착지로 이동 후 스크롤.
                  // SPA navigation 유지 — window.location.href(hard reload)는 RSC 캐시/React state를
                  // 끊어 뒤로가기 복귀 시 빈 화면 유발. 도착지는 scrollTo query를 처리함.
                  router.push(targetPath + '?scrollTo=' + targetSection);
                }}
                style={{
                  width: "24px",
                  height: "24px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  overflow: "visible",
                  position: "relative",
                }}
                aria-label="hexagon button 3"
                onMouseEnter={() => setTooltipVisible("hexagon3")}
                onMouseLeave={() => setTooltipVisible(null)}
                onMouseMove={(e) => setTooltipPosition({ x: e.clientX + 10, y: e.clientY + 10 })}
              >
                <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/PX06.png" : "/images/0/cluster 1/00.png"} alt="" width={24} height={24} className="hexagon-border" style={{ display: "block" }} />
                <Image src="/images/0/cluster 1/003.png" alt="" width={12} height={12} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
              </button>
            </div>

            <div className="resume-info">
              {hasData ? (
                <>
                  <h1 className="resume-name">
                    <span
                      className={`back-arrow ${isArrowShaking ? "arrow-shake" : ""}`}
                      style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                      onClick={() => {
                        setIsArrowShaking(true);
                        setTimeout(() => setIsArrowShaking(false), 400);
                      }}
                    >
                      <Image src="/images/0/cluster 1/small icon/Chevron_Right_MD.png" alt="" width={18} height={18} />
                    </span>
                    {mask.crewName(currentProfile.name)} <span className="name-eng">{mask.crewName(currentProfile.nameEng)}</span>
                  </h1>

                  <div className="resume-details">
                    <div className="detail-row">
                      <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/User_01-ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/User_01-px.png" : "/images/0/cluster 1/small icon/User_01.png"} alt="" width={16} height={16} className="detail-icon" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", display: "inline-block" }}>
                        <span style={{ color: currentProfile.lightColor }}>·</span> {currentProfile.gender}{" "}
                        <Image
                          src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/Gift-ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/Gift-px.png" : "/images/0/cluster 1/small icon/Gift.png"}
                          alt=""
                          width={13}
                          height={13}
                          className="detail-icon"
                          style={{ display: "inline-block", verticalAlign: "text-bottom", margin: "0 2px 0 45px" }}
                        />{" "}
                        <span style={{ color: currentProfile.lightColor }}>·</span> {mask.birthDate(currentProfile.birthDate)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/Building_03-ec (2).png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/House_01-px.png" : "/images/0/cluster 1/small icon/House_01.png"} alt="" width={16} height={16} className="detail-icon" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", display: "inline-block" }}>
                        <span style={{ color: currentProfile.lightColor }}>·</span> {mask.address((currentProfile as { address?: string }).address || [currentProfile.city, currentProfile.district].filter(Boolean).join(" "))}
                      </span>
                    </div>
                    <div className="detail-row" style={{ overflow: "hidden" }}>
                      <Image
                        src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/Mobile_Button-ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/Mobile_Button-px.png" : "/images/0/cluster 1/small icon/Mobile_Button.png"}
                        alt=""
                        width={16}
                        height={16}
                        className="detail-icon"
                      />
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ color: currentProfile.lightColor, flexShrink: 0 }}>·</span>
                        {currentProfile.phone}
                        {isOwner && (
                          <span
                            onClick={() => {
                              // 모달은 클릭 즉시 연다 — fetch 를 기다리며 오픈을 막지 않는다(체감 ~5초 지연 원인).
                              // contactAvailable 은 /api/profile 응답에 이미 포함돼 ProfileContext 에 캐시되므로
                              // 값이 있으면 추가 fetch 없이 그대로 사용, 없을 때만 모달 내 loading 으로 백그라운드 로드.
                              const cachedValue = cachedProfile?.contactAvailable ?? null;
                              const nextPhoneComment = cachedValue || DEFAULT_PHONE_COMMENT;
                              setFormData((prev) => ({ ...prev, phoneComment: nextPhoneComment }));
                              phoneCommentSnapshot.current = nextPhoneComment;
                              setIsPhoneCommentModalOpen(true);
                              setIsPhoneEditing(false);
                              // 프로필 캐시 자체가 아직 없을 때만 로드 — contactAvailable:null 은
                              // "코멘트 미등록"이라는 확정값(API 응답에 이미 포함)이므로 재요청하지 않는다.
                              if (!cachedProfile) {
                                setIsPhoneCommentLoading(true);
                                fetchCachedProfile(targetUserId || undefined, true)
                                  .then((refreshed) => {
                                    const latest =
                                      refreshed?.contactAvailable ??
                                      (refreshed?.data as { contact_available?: string | null } | undefined)?.contact_available ??
                                      null;
                                    const next = latest || DEFAULT_PHONE_COMMENT;
                                    // 사용자가 이미 수정 모드로 들어갔으면 입력값을 덮어쓰지 않는다.
                                    if (!isPhoneEditingRef.current) {
                                      setFormData((prev) => ({ ...prev, phoneComment: next }));
                                      phoneCommentSnapshot.current = next;
                                    }
                                  })
                                  .catch((error) => console.error("연락처 코멘트 로드 오류:", error))
                                  .finally(() => setIsPhoneCommentLoading(false));
                              }
                            }}
                            style={{
                              color: currentProfile.accentColor,
                              fontSize: "14px",
                              fontWeight: "400",
                              lineHeight: "1",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            +
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="detail-row">
                      <Image src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/Mail -ec.png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/Mail-px.png" : "/images/0/cluster 1/small icon/Mail.png"} alt="" width={16} height={16} className="detail-icon" />
                      <span
                        onMouseEnter={() => setTooltipVisible("email")}
                        onMouseMove={(e) => setTooltipPosition({ x: e.clientX + 12, y: e.clientY - 8 })}
                        onMouseLeave={() => setTooltipVisible(null)}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "180px",
                          cursor: "default",
                        }}
                      >
                        <span style={{ color: currentProfile.lightColor }}>·</span> {mask.email(currentProfile.email)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <Image
                        src={debugPanelType === "EC" ? "/images/0/cluster 1/small icon/Building_03-ec (1).png" : debugPanelType === "PX" ? "/images/0/cluster 1/small icon/Building_03-px.png" : "/images/0/cluster 1/small icon/Building_03.png"}
                        alt=""
                        width={16}
                        height={16}
                        className="detail-icon"
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "180px",
                          cursor: "default",
                        }}
                      >
                        <span style={{ color: currentProfile.lightColor }}>·</span> {mask.school(currentProfile.school)}
                      </span>
                    </div>

                    {/* 학과명 — 별도 줄 (피그마 시안: #FFEC8F, 14px, Pretendard 400, lineHeight 24) */}
                    <div className="detail-row">
                      <span className="detail-spacer"></span>
                      <span
                        className="major-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTooltipVisible(tooltipVisible === "major" ? null : "major");
                          setTooltipPosition({ x: e.clientX + 12, y: e.clientY - 8 });
                        }}
                      >
                        <span style={{ color: currentProfile.lightColor }}>·</span>{mask.major(currentProfile.major)}
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.33 6.67L11.67 10L8.33 13.33" stroke="#FFEC8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-spacer"></span>
                      <span className="sub-text" style={{ color: currentProfile.lightColor }}>
                        {/* 기존 enrollPeriod 자리 → user_memberships.team_name 매핑.
                            UI 구조/className 미변경, 데이터 소스만 교체. */}
                        <span style={{ color: currentProfile.lightColor }}>·</span> {currentProfile.team || "-"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    height: "100%",
                    padding: "20px 0",
                    paddingLeft: "40px",
                    marginTop: "-5px",
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: "14px",
                      fontFamily: "Pretendard, sans-serif",
                      textAlign: "left",
                    }}
                  >
                    정보를 입력하세요.
                  </span>
                </div>
              )}
              {hasData && (
                <div className="resume-details">
                  <div className="detail-row">
                    <span style={{ width: "16px" }}></span>
                    <span className="sub-text">
                      {/* 기존 "{gpa} /{gpaMax}" 자리 → "{part_name} /{membership_level 단축형}" 매핑.
                          UI 구조/슬래시 위치/className 미변경. 단축 라벨은 roleKorean 맵
                          (line 99-) 의 "(...)" 앞부분만 사용 — 예: "일반(정규)" → "일반". */}
                      <span style={{ color: currentProfile.lightColor }}>·</span> {currentProfile.part || "-"} <span style={{ color: currentProfile.lightColor }}>/{(roleKorean[currentProfile.membershipLevel] || currentProfile.membershipLevel || "-").split("(")[0] || "-"}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Introduction Box */}
          <div className="resume-intro">
            <Image src="/images/0/cluster 1/Image.png" alt="" width={24} height={24} className="intro-icon" />
            {hasData ? currentProfile.quote : <span style={{ color: "#888", fontSize: "20px" }}>내용을 작성해주세요.</span>}
          </div>

          {/* Three Column Section - 영역 4, 5, 6 side by side */}
          <div className="resume-three-column">
            {/* Stats Section - 영역 4 */}
            <div className="resume-stats">
              <div className="stat-item">
                <div className="stat-row">
                  <span className="stat-label">
                    {/* 누적(전체 성장기간) 일정 신뢰도 = /api/profile reliabilityRate(admin scheduleReliability.rate).
                        cluster4 area-6 의 "시즌 일정 신뢰도"(선택 시즌 스냅샷)와 스코프가 달라 라벨로 구분한다. */}
                    <span className="stat-dot">·</span> 누적 일정 신뢰도
                  </span>
                  <span className="stat-value">
                    {hasReliabilityData ? reliabilityRate : "-"}
                    <span className="stat-unit">%</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: hasReliabilityData ? `${reliabilityRate}%` : "0%" }}></div>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-row">
                  <span className="stat-label">
                    <span className="stat-dot">·</span> 활동 완료율
                  </span>
                  <span className="stat-value">
                    {hasCompletionData ? completionRate : "-"}
                    <span className="stat-unit">%</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: hasCompletionData ? `${completionRate}%` : "0%" }}></div>
                </div>
              </div>
            </div>

            {/* Badges Section - 영역 5 */}
            <div className="resume-badges">
              <div className="badge-group">
                <span className="badge-icon icon-graphic10"></span>
                <span className="badge-num">{hasData ? badge1.toLocaleString() : "-"}</span>
              </div>
              <div className="badge-group">
                <span className="badge-icon icon-shield"></span>
                <span className="badge-num">{hasData ? badge2.toLocaleString() : "-"}</span>
              </div>
              <div className="badge-group">
                <span className="badge-icon icon-graphic13"></span>
                <span className="badge-num red">{hasData ? badge3.toLocaleString() : "-"}</span>
              </div>
            </div>

            {/* Medal Badge - 영역 6 */}
            <div className={`resume-medal ${crewStatus === "Complete" ? "no-overlay" : ""}`}>
              <div className="medal-image-wrapper">
                {(() => {
                  // 마스코트(금장)는 현재 분기(라우트 org)만으로 결정 — SoT: getOrgMascotSrc.
                  // resumeCardSettings.medalTheme(org settings 의 자기 org 코드 미러)은 이미지
                  // 결정에서 제외한다: 프로필 DTO·stale state 경유로 라우트와 다른 조직
                  // 마스코트(예: planning 분기에 EC 사슴)가 그래프트되던 채널.
                  // (medalWeekOverride 등 나머지 settings 는 계속 사용.)
                  const medalSrc = getOrgMascotSrc(getOrgConfigFromPathname(pathname).organization);
                  return <Image src={medalSrc} alt="Medal" width={512} height={512} />;
                })()}
                <span className="medal-week-num">{resumeCardSettings?.medalWeekOverride ?? (demoMode ? 12 : (approvedWeeksCount ?? 0))}</span>
              </div>
              <div
                className={`medal-text ${crewStatus === "Next Challenge" ? "long" : crewStatus === "Recharging" ? "medium" : crewStatus === "Complete" ? "short-medium" : ""} ${crewStatus === "Complete" ? "medal-complete" : crewStatus === "Running" ? "medal-running" : crewStatus === "On Rest" ? "medal-onrest" : crewStatus === "Recharging" ? "medal-recharging" : crewStatus === "Next Challenge" ? "medal-next" : ""}`}
              >
                <span className="medal-text-inner">{crewStatus}</span>
              </div>
            </div>
          </div>

          {/* Activities */}
          <div style={{ position: "relative", width: "489px", height: "95px" }}>
            {hasData ? (
              <>
                <div
                  ref={activitiesRef}
                  className="resume-activities"
                  onScroll={updateScrollbar}
                  style={
                    {
                      width: "100%",
                      height: "100%",
                      overflowY: "scroll",
                      overflowX: "hidden",
                      padding: 0,
                      margin: 0,
                      display: "block",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    } as React.CSSProperties
                  }
                >
                  {/* 시즌 히스토리 동적 렌더링 */}
                  {hasSeasonData && seasonHistories.length > 0 ? (
                    seasonHistories.map((history, index) => {
                      const progressStatus = getProgressStatus(history.progress_status);
                      const reviewStatus = getReviewStatus(history.review_status);
                      const {
                        displaySeasonYear,
                        displaySeasonName,
                        displayTotalWeeks,
                        displayRoleLabel,
                      } = normalizeActivityDisplay(history, currentProfile.membershipLevel);
                      const avatarImage = getAvatarImage(index);

                      return (
                        <div className="activity-row" key={history.id}>
                          <div className="activity-avatar">
                            <Image src={avatarImage} alt="" width={36} height={36} />
                          </div>
                          <div className="activity-content">
                            <div className="activity-line">
                              <span className="activity-season">
                                {displaySeasonYear}, {displaySeasonName}
                                <span style={{ color: "#767676" }}>시즌</span>
                              </span>
                              <span className="activity-period">
                                {/* approved_weeks null = admin 그래프트 실패(분자 미확정) — 레거시 stale 값 대신 '-' (2026-06-05) */}
                                {history.approved_weeks ?? "-"}주 <span style={{ color: "#767676" }}>/ {displayTotalWeeks}주</span>
                              </span>
                              <span className="activity-role">{displayRoleLabel}</span>
                              <span className={`activity-badge ${progressStatus.className}`}>{progressStatus.text}</span>
                              <span className={`activity-check ${reviewStatus.className}`}>{reviewStatus.text}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="activity-row">
                      <div className="activity-content" style={{ textAlign: "center", color: "#666", padding: "20px" }}>
                        시즌 활동 기록이 없습니다.
                      </div>
                    </div>
                  )}
                </div>

                {/* 커스텀 스크롤바 */}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: "2px",
                    height: "100%",
                    background: "#3D4856",
                    borderRadius: "2px",
                  }}
                >
                  <div
                    ref={scrollThumbRef}
                    onMouseDown={handleMouseDown}
                    style={{
                      position: "absolute",
                      top: `${scrollThumbTop}px`,
                      width: "100%",
                      height: 44,
                      // PX 라우트 strict mapping (#FFC300 → #1E9503).
                      // EC 라우트(pathname 에 -ec segment) strict mapping (#FFC300 → #FF4B70).
                      //   debugPanelType 은 useEffect (L724-729) 에서 -px / -ec segment 로 자동 전환,
                      //   따라서 /cluster-*-ec?userId=… 진입 시 "EC" 가 확정 → Encre pink.
                      //   /crews?org=encre 의 page 자체는 -ec segment 가 없어 OK fallback 이지만
                      //   "보기" 버튼이 /cluster-4-ec?userId=… 로 보내므로 resume-card 가 그려지는
                      //   시점에는 EC 가 활성. 그 외(OK)는 원본 노란색 유지.
                      background: isPX ? "#1E9503" : debugPanelType === "EC" ? "#FF4B70" : "#FFC300",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div
                  className="resume-activities"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#1C242F",
                    borderTop: "1px solid #666",
                  }}
                >
                  <span
                    style={{
                      color: "#888",
                      fontSize: "14px",
                      fontFamily: "Pretendard, sans-serif",
                    }}
                  >
                    활동 시작 전입니다.
                  </span>
                </div>
                {/* 스크롤바 트랙 영역 */}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: "2px",
                    height: "100%",
                    background: "#2a2a2a",
                    borderRadius: "2px",
                  }}
                />
              </>
            )}
          </div>

          {/* Skill Cards and Footer Notices - with background */}
          <div className="resume-bottom-section">
            {/* Skill Cards */}
            <div className="resume-skills">
              <div className="skill-card">
                <Image src="/images/0/cluster 1/Sheriff Badge1 3.png" alt="" width={34} height={34} className="skill-icon" />
                <div className="skill-num-row">
                  <span className="skill-num">{typeof practicalInfoCount === "number" ? practicalInfoCount : "-"}</span>
                  <span className="skill-unit">회</span>
                </div>
                <span className="skill-label">실무 정보 습득</span>
              </div>
              <div className="skill-card">
                <Image src="/images/0/cluster 1/Sheriff Badge1.png" alt="" width={34} height={34} className="skill-icon" />
                <div className="skill-num-row">
                  <span className="skill-num">{typeof practicalExperienceCount === "number" ? practicalExperienceCount : "-"}</span>
                  <span className="skill-unit">건</span>
                </div>
                <span className="skill-label">실무 경험 축적</span>
              </div>
              <div className="skill-card">
                <Image src="/images/0/cluster 1/Sheriff Badge1 2.png" alt="" width={34} height={34} className="skill-icon" />
                <div className="skill-num-row">
                  <span className="skill-num">{typeof practicalCompetencyCount === "number" ? practicalCompetencyCount : "-"}</span>
                  <span className="skill-unit">unit</span>
                </div>
                <span className="skill-label">실무 역량 성장</span>
              </div>
              <div className="skill-card">
                <Image src="/images/0/cluster 1/Sheriff Badge1 4.png" alt="" width={34} height={34} className="skill-icon" />
                <div className="skill-num-row">
                  <span className="skill-num">{typeof practicalCareerCount === "number" ? practicalCareerCount : "-"}</span>
                  <span className="skill-unit">proj</span>
                </div>
                <span className="skill-label">실무 경력 누적</span>
              </div>
            </div>

            {/* Footer Notices — 졸업(Complete) 크루에게만 도장 표시 */}
            <div className="resume-notices">
              <div className="notice-box yellow">
                <Image src="/images/0/cluster 1/Star Badge.png" alt="" width={25} height={25} className="notice-icon-img" />
                <span className="notice-text notice-text-top">{resumeCardSettings?.noticeTopText || (debugPanelType === "EC" ? "전국청춘연합 엔터테인먼트/미디어 클럽, 엥크레" : debugPanelType === "PX" ? "전국청춘연합 기획/컨설팅 클럽, 팔랑크스" : "전국청춘연합 마케팅/퍼포먼스 클럽, 오랑캐")}</span>
                <div className={`notice-stamp-wrapper${crewStatus === "Complete" ? " stamped" : ""}`}>{crewStatus === "Complete" && <Image src={resumeCardSettings?.noticeTopStampImageUrl || getOrgStampSrc(getOrgConfigFromPathname(pathname).organization)} alt="" width={46} height={46} />}</div>
              </div>
              <div className="notice-box green">
                <Image src="/images/0/cluster 1/Star Badge2.png" alt="" width={25} height={25} className="notice-icon-img" />
                <span className="notice-text">{resumeCardSettings?.noticeBottomText || "전국청춘성장 클럽- 기업/실무자 후원 관리 위원회"}</span>
                <div className={`notice-stamp-wrapper${crewStatus === "Complete" ? " stamped" : ""}`}>{crewStatus === "Complete" && <Image src={resumeCardSettings?.noticeBottomStampImageUrl || "/images/0/cluster 1/실무기업 도장.webp"} alt="" width={46} height={46} />}</div>
              </div>
            </div>
          </div>
        </div>
      </div>{" "}
      {/* 스케일 wrapper 닫기 */}
      {/* Contact Info Modal - For 타크루 프로필 */}
      {isEditModalOpen && debugProfileType === "타크루" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 99999,
            paddingTop: "20px",
          }}
        >
          <div className="edit-modal-content" onClick={(e) => e.stopPropagation()} style={{ position: "relative", borderRadius: 0 }}>
            <Image src="/images/0/cluster 1/card01.png" alt="Contact Info" width={540} height={150} style={{ display: "block" }} />
            {/* X 닫기 버튼 */}
            <button
              className="modal-close-btn"
              onClick={() => {
                if (isProfileEditDirty()) {
                  void showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                    setIsEditModalOpen(false);
                  });
                  return;
                }
                setIsEditModalOpen(false);
              }}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Edit Profile Modal - For 본인 프로필 */}
      {isEditModalOpen &&
        debugProfileType === "본인" &&
        typeof document !== "undefined" &&
        createPortal(
          // overlay (부모 div) - 여기에 스크롤과 padding 추가
          // Phase D5 — portal root overlay 에 theme class 결합. 향후 SCSS
          // combined selector (`.edit-modal-overlay.cluster-px-theme`) 확장
          // 대비. cluster route 외에선 빈 문자열 → 영향 0.
          <div
            className={`edit-modal-overlay ${sidebarThemeClass}`.trim()}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
              overflow: "hidden",
              padding: "40px 0", // ← 여기 추가
            }}
          >
            {/* modal (자식 div) */}
            <div
              className={`edit-modal-content ${sidebarThemeClass}`.trim()}
              style={{
                border: `1px solid ${sidebarAccent.main}`,
                boxShadow: `0 0 10px ${sidebarAccent.alpha(0.15)}`,
                width: "580px",
                maxHeight: "700px",
              }}
            >
              {/* Cafe24Ohsquare 폰트 선언 */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                @font-face {
                  font-family: 'Cafe24Ohsquare';
                  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/Cafe24Ohsquare.woff') format('woff');
                  font-weight: normal;
                  font-style: normal;
                  font-display: swap;
                }
              `,
                }}
              />
              {/* 상단 헤더 바 */}
              <div
                className="edit-modal-header"
                style={{
                  padding: "20px 28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  position: "relative",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>프로필 수정</h3>
                  <p className="modal-subtitle" style={{ marginTop: "6px", marginBottom: 0 }}>
                    프로필 정보를 수정하고 하단의 [작성완료]를 눌러 저장하세요.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    if (isProfileEditDirty()) {
                      void showConfirm("변경사항이 저장되지 않았습니다.\n\n하단에 [작성 완료]를 눌러야 저장이 완료됩니다.\n지금 나가시겠습니까?", () => {
                        setIsEditModalOpen(false);
                      });
                      return;
                    }
                    setIsEditModalOpen(false);
                  }}
                  style={{
                    position: "absolute",
                    top: "18px",
                    right: "20px",
                  }}
                >
                  &#x2715;
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* 모달 본문 */}
                <div className="edit-modal-body" style={{ padding: "30px 32px 40px 40px", overflowY: "scroll" }}>
                  {/* 성 & 이름 - 일렬 배치 */}
                  <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                    {/* 성 */}
                    <div style={{ flex: 1 }}>
                      <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>성</label>
                      <input
                        className="modal-input chamfer-box"
                        type="text"
                        name="lastName"
                        data-nav-index={1}
                        value={formData.lastName}
                        onChange={(e) => handleNameChange(e, "lastName", 2)}
                        onKeyDown={handleEnterKeyNavigation}
                        maxLength={2}
                        placeholder="홍"
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          backgroundColor: "#252836",
                          border: errors.lastName ? "1px solid #ff6b6b" : "1px solid transparent",
                          borderRadius: "0",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {errors.lastName && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "6px", display: "block" }}>{errors.lastName}</span>}
                    </div>

                    {/* 이름 */}
                    <div style={{ flex: 2 }}>
                      <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>이름</label>
                      <input
                        className="modal-input chamfer-box"
                        type="text"
                        name="firstName"
                        data-nav-index={2}
                        value={formData.firstName}
                        onChange={(e) => handleNameChange(e, "firstName", 5)}
                        onKeyDown={handleEnterKeyNavigation}
                        maxLength={5}
                        placeholder="길동"
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          backgroundColor: "#252836",
                          border: errors.firstName ? "1px solid #ff6b6b" : "1px solid transparent",
                          borderRadius: "0",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {errors.firstName && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "6px", display: "block" }}>{errors.firstName}</span>}
                    </div>
                  </div>

                  {/* 영문 성 & 이름 - 일렬 배치 */}
                  <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                    {/* 영문 성 */}
                    <div style={{ flex: 1 }}>
                      <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>영문 성</label>
                      <input
                        className="modal-input chamfer-box"
                        type="text"
                        name="lastNameEng"
                        data-nav-index={3}
                        value={formData.lastNameEng}
                        onChange={(e) => handleEngNameChange(e, "lastNameEng", 20)}
                        onKeyDown={handleEnterKeyNavigation}
                        maxLength={20}
                        placeholder="Hong"
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          backgroundColor: "#252836",
                          border: errors.lastNameEng ? "1px solid #ff6b6b" : "1px solid transparent",
                          borderRadius: "0",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {errors.lastNameEng && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "6px", display: "block" }}>{errors.lastNameEng}</span>}
                    </div>

                    {/* 영문 이름 */}
                    <div style={{ flex: 2 }}>
                      <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>영문 이름</label>
                      <input
                        className="modal-input chamfer-box"
                        type="text"
                        name="firstNameEng"
                        data-nav-index={4}
                        value={formData.firstNameEng}
                        onChange={(e) => handleEngNameChange(e, "firstNameEng", 30)}
                        onKeyDown={handleEnterKeyNavigation}
                        maxLength={30}
                        placeholder="Gildong"
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          backgroundColor: "#252836",
                          border: errors.firstNameEng ? "1px solid #ff6b6b" : "1px solid transparent",
                          borderRadius: "0",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {errors.firstNameEng && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "6px", display: "block" }}>{errors.firstNameEng}</span>}
                    </div>
                  </div>

                  {/* 성별 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>성별</label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button
                        type="button"
                        className="chamfer-box"
                        data-nav-index={5}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, gender: "male" }));
                          setTimeout(() => navigateToNextField(5), 0);
                        }}
                        style={{
                          flex: 1,
                          padding: "14px 16px",
                          backgroundColor: formData.gender === "male" ? sidebarAccent.main : "#252836",
                          border: "1px solid transparent",
                          borderRadius: "0",
                          color: formData.gender === "male" ? "#1a1d29" : "#8a8d98",
                          fontSize: "16px",
                          fontWeight: formData.gender === "male" ? 600 : 500,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        남
                      </button>
                      <button
                        type="button"
                        className="chamfer-box"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, gender: "female" }));
                          setTimeout(() => navigateToNextField(5), 0);
                        }}
                        style={{
                          flex: 1,
                          padding: "14px 16px",
                          backgroundColor: formData.gender === "female" ? sidebarAccent.main : "#252836",
                          border: "1px solid transparent",
                          borderRadius: "0",
                          color: formData.gender === "female" ? "#1a1d29" : "#8a8d98",
                          fontSize: "16px",
                          fontWeight: formData.gender === "female" ? 600 : 500,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        여
                      </button>
                    </div>
                  </div>

                  {/* 생년월일 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>생년월일</label>
                    <style
                      dangerouslySetInnerHTML={{
                        // Phase D5 — styled-jsx scrollbar 를 sidebarAccent 기반
                        // template literal 로 변환. cluster route 외 default
                        // yellow 유지. hover state 도 동일 분기 (consistency).
                        __html: `
                  .edit-modal-content {
                    font-family: 'Pretendard', sans-serif !important;
                  }
                  .edit-modal-content * {
                    font-family: 'Pretendard', sans-serif !important;
                  }
                  .edit-modal-body::-webkit-scrollbar {
                    width: 1px;
                  }
                  .edit-modal-body::-webkit-scrollbar-track {
                    background: #252836;
                    border-radius: 2px;
                  }
                  .edit-modal-body::-webkit-scrollbar-thumb {
                    background: ${sidebarAccent.main};
                    border-radius: 2px;
                  }
                  .edit-modal-body::-webkit-scrollbar-thumb:hover {
                    background: ${sidebarAccent.soft};
                  }
                  .edit-modal-body::-webkit-scrollbar-button {
                    display: none;
                    height: 0;
                  }
                  .custom-dropdown-list::-webkit-scrollbar {
                    width: 6px;
                  }
                  .custom-dropdown-list::-webkit-scrollbar-track {
                    background: #1a1d29;
                    border-radius: 3px;
                  }
                  .custom-dropdown-list::-webkit-scrollbar-thumb {
                    background: ${sidebarAccent.main};
                    border-radius: 3px;
                  }
                `,
                      }}
                    />
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {/* 년도 커스텀 드롭다운 */}
                      <div style={{ flex: 1.2, position: "relative" }}>
                        <div
                          className="chamfer-box"
                          tabIndex={0}
                          data-nav-index={6}
                          data-nav-dropdown="year"
                          onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}
                          style={{
                            padding: "14px 12px",
                            backgroundColor: "#252836",
                            borderRadius: "0",
                            color: formData.birthDate.split("-")[0] ? "#fff" : "#6b6e7a",
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            border: openDropdown === "year" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span>{formData.birthDate.split("-")[0] ? `${formData.birthDate.split("-")[0]}년` : "년"}</span>
                          <span
                            style={{
                              transform: openDropdown === "year" ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              fontSize: "10px",
                              color: "#8a8d98",
                            }}
                          >
                            ▼
                          </span>
                        </div>
                        {openDropdown === "year" && (
                          <div
                            className="custom-dropdown-list"
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#1a1d29",
                              borderRadius: "8px",
                              border: "1px solid #333",
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 100,
                              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                            }}
                          >
                            {Array.from({ length: 56 }, (_, i) => 2025 - i).map((year, idx) => (
                              <div
                                key={year}
                                onClick={() => {
                                  const month = formData.birthDate.split("-")[1] || "";
                                  const day = formData.birthDate.split("-")[2] || "";
                                  setFormData((prev) => ({ ...prev, birthDate: `${year}-${month}-${day}` }));
                                  setOpenDropdown("month");
                                }}
                                style={{
                                  padding: "12px 14px",
                                  color: formData.birthDate.split("-")[0] === String(year) ? sidebarAccent.main : "#fff",
                                  backgroundColor: formData.birthDate.split("-")[0] === String(year) ? sidebarAccent.alpha(0.1) : "transparent",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  borderBottom: "1px solid #252836",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                  e.currentTarget.style.color = sidebarAccent.main;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = formData.birthDate.split("-")[0] === String(year) ? sidebarAccent.alpha(0.1) : "transparent";
                                  e.currentTarget.style.color = formData.birthDate.split("-")[0] === String(year) ? sidebarAccent.main : "#fff";
                                }}
                              >
                                {year}년
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 월 커스텀 드롭다운 */}
                      <div style={{ flex: 1, position: "relative" }}>
                        <div
                          className="chamfer-box"
                          tabIndex={0}
                          data-nav-index={7}
                          data-nav-dropdown="month"
                          onClick={() => setOpenDropdown(openDropdown === "month" ? null : "month")}
                          style={{
                            padding: "14px 12px",
                            backgroundColor: "#252836",
                            borderRadius: "0",
                            color: formData.birthDate.split("-")[1] ? "#fff" : "#6b6e7a",
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            border: openDropdown === "month" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span>{formData.birthDate.split("-")[1] ? `${parseInt(formData.birthDate.split("-")[1])}월` : "월"}</span>
                          <span
                            style={{
                              transform: openDropdown === "month" ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              fontSize: "10px",
                              color: "#8a8d98",
                            }}
                          >
                            ▼
                          </span>
                        </div>
                        {openDropdown === "month" && (
                          <div
                            className="custom-dropdown-list"
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#1a1d29",
                              borderRadius: "8px",
                              border: "1px solid #333",
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 100,
                              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                            }}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month, idx) => (
                              <div
                                key={month}
                                onClick={() => {
                                  const year = formData.birthDate.split("-")[0] || "";
                                  const day = formData.birthDate.split("-")[2] || "";
                                  setFormData((prev) => ({ ...prev, birthDate: `${year}-${String(month).padStart(2, "0")}-${day}` }));
                                  setOpenDropdown("day");
                                }}
                                style={{
                                  padding: "12px 14px",
                                  color: formData.birthDate.split("-")[1] === String(month).padStart(2, "0") ? sidebarAccent.main : "#fff",
                                  backgroundColor: formData.birthDate.split("-")[1] === String(month).padStart(2, "0") ? sidebarAccent.alpha(0.1) : "transparent",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  borderBottom: "1px solid #252836",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                  e.currentTarget.style.color = sidebarAccent.main;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = formData.birthDate.split("-")[1] === String(month).padStart(2, "0") ? sidebarAccent.alpha(0.1) : "transparent";
                                  e.currentTarget.style.color = formData.birthDate.split("-")[1] === String(month).padStart(2, "0") ? sidebarAccent.main : "#fff";
                                }}
                              >
                                {month}월
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 일 커스텀 드롭다운 */}
                      <div style={{ flex: 1, position: "relative" }}>
                        <div
                          className="chamfer-box"
                          tabIndex={0}
                          data-nav-index={8}
                          data-nav-dropdown="day"
                          onClick={() => setOpenDropdown(openDropdown === "day" ? null : "day")}
                          style={{
                            padding: "14px 12px",
                            backgroundColor: "#252836",
                            borderRadius: "0",
                            color: formData.birthDate.split("-")[2] ? "#fff" : "#6b6e7a",
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            border: openDropdown === "day" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span>{formData.birthDate.split("-")[2] ? `${parseInt(formData.birthDate.split("-")[2])}일` : "일"}</span>
                          <span
                            style={{
                              transform: openDropdown === "day" ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              fontSize: "10px",
                              color: "#8a8d98",
                            }}
                          >
                            ▼
                          </span>
                        </div>
                        {openDropdown === "day" && (
                          <div
                            className="custom-dropdown-list"
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#1a1d29",
                              borderRadius: "8px",
                              border: "1px solid #333",
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 100,
                              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                            }}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day, idx) => (
                              <div
                                key={day}
                                onClick={() => {
                                  const year = formData.birthDate.split("-")[0] || "";
                                  const month = formData.birthDate.split("-")[1] || "";
                                  setFormData((prev) => ({ ...prev, birthDate: `${year}-${month}-${String(day).padStart(2, "0")}` }));
                                  setOpenDropdown("city");
                                }}
                                style={{
                                  padding: "12px 14px",
                                  color: formData.birthDate.split("-")[2] === String(day).padStart(2, "0") ? sidebarAccent.main : "#fff",
                                  backgroundColor: formData.birthDate.split("-")[2] === String(day).padStart(2, "0") ? sidebarAccent.alpha(0.1) : "transparent",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  borderBottom: "1px solid #252836",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                  e.currentTarget.style.color = sidebarAccent.main;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = formData.birthDate.split("-")[2] === String(day).padStart(2, "0") ? sidebarAccent.alpha(0.1) : "transparent";
                                  e.currentTarget.style.color = formData.birthDate.split("-")[2] === String(day).padStart(2, "0") ? sidebarAccent.main : "#fff";
                                }}
                              >
                                {day}일
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 주소 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>주소</label>
                    {!isCustomAddress ? (
                      <div style={{ display: "flex", gap: "12px" }}>
                        {/* 시/도 커스텀 드롭다운 */}
                        <div style={{ flex: 1, position: "relative" }}>
                          <div
                            className="chamfer-box"
                            tabIndex={0}
                            data-nav-index={9}
                            data-nav-dropdown="city"
                            onClick={() => setOpenDropdown(openDropdown === "city" ? null : "city")}
                            style={{
                              padding: "14px 12px",
                              backgroundColor: "#252836",
                              borderRadius: "0",
                              color: formData.addressCity ? "#fff" : "#6b6e7a",
                              fontSize: "14px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              border: openDropdown === "city" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <span>{formData.addressCity || "시/도 선택"}</span>
                            <span
                              style={{
                                transform: openDropdown === "city" ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                                fontSize: "10px",
                                color: "#8a8d98",
                              }}
                            >
                              ▼
                            </span>
                          </div>
                          {openDropdown === "city" && (
                            <div
                              className="custom-dropdown-list"
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                marginTop: "4px",
                                backgroundColor: "#1a1d29",
                                borderRadius: "8px",
                                border: "1px solid #333",
                                maxHeight: "200px",
                                overflowY: "auto",
                                zIndex: 100,
                                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                              }}
                            >
                              {Object.keys(koreaRegions).map((city, idx) => (
                                <div
                                  key={city}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, addressCity: city, addressDistrict: "" }));
                                    setOpenDropdown("district");
                                  }}
                                  style={{
                                    padding: "12px 14px",
                                    color: formData.addressCity === city ? sidebarAccent.main : "#fff",
                                    backgroundColor: formData.addressCity === city ? sidebarAccent.alpha(0.1) : "transparent",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    borderBottom: "1px solid #252836",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                    e.currentTarget.style.color = sidebarAccent.main;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = formData.addressCity === city ? sidebarAccent.alpha(0.1) : "transparent";
                                    e.currentTarget.style.color = formData.addressCity === city ? sidebarAccent.main : "#fff";
                                  }}
                                >
                                  {city}
                                </div>
                              ))}
                              {/* 직접 입력 옵션 */}
                              <div
                                onClick={() => {
                                  setIsCustomAddress(true);
                                  setFormData((prev) => ({ ...prev, addressCity: "", addressDistrict: "" }));
                                  setOpenDropdown(null);
                                }}
                                style={{
                                  padding: "12px 14px",
                                  color: sidebarAccent.main,
                                  backgroundColor: "transparent",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  borderTop: "2px solid #333",
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                직접 입력
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 구/군 커스텀 드롭다운 */}
                        <div style={{ flex: 1, position: "relative" }}>
                          <div
                            className="chamfer-box"
                            tabIndex={0}
                            data-nav-index={10}
                            data-nav-dropdown="district"
                            onClick={() => {
                              if (formData.addressCity) {
                                setOpenDropdown(openDropdown === "district" ? null : "district");
                              }
                            }}
                            style={{
                              padding: "14px 12px",
                              backgroundColor: "#252836",
                              borderRadius: "0",
                              color: formData.addressDistrict ? "#fff" : "#6b6e7a",
                              fontSize: "14px",
                              cursor: formData.addressCity ? "pointer" : "not-allowed",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              border: openDropdown === "district" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                              transition: "all 0.2s ease",
                              opacity: formData.addressCity ? 1 : 0.6,
                            }}
                          >
                            <span>{formData.addressDistrict || "구/군 선택"}</span>
                            <span
                              style={{
                                transform: openDropdown === "district" ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                                fontSize: "10px",
                                color: "#8a8d98",
                              }}
                            >
                              ▼
                            </span>
                          </div>
                          {openDropdown === "district" && formData.addressCity && (
                            <div
                              className="custom-dropdown-list"
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                marginTop: "4px",
                                backgroundColor: "#1a1d29",
                                borderRadius: "8px",
                                border: "1px solid #333",
                                maxHeight: "200px",
                                overflowY: "auto",
                                zIndex: 100,
                                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                              }}
                            >
                              {koreaRegions[formData.addressCity]?.map((district, idx) => (
                                <div
                                  key={district}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, addressDistrict: district }));
                                    setOpenDropdown(null);
                                    setTimeout(() => navigateToNextField(10), 0);
                                  }}
                                  style={{
                                    padding: "12px 14px",
                                    color: formData.addressDistrict === district ? sidebarAccent.main : "#fff",
                                    backgroundColor: formData.addressDistrict === district ? sidebarAccent.alpha(0.1) : "transparent",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    borderBottom: "1px solid #252836",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                    e.currentTarget.style.color = sidebarAccent.main;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = formData.addressDistrict === district ? sidebarAccent.alpha(0.1) : "transparent";
                                    e.currentTarget.style.color = formData.addressDistrict === district ? sidebarAccent.main : "#fff";
                                  }}
                                >
                                  {district}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 직접 입력 모드 */
                      <div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <input
                            className="modal-input chamfer-box"
                            type="text"
                            name="customAddress"
                            data-nav-index={9}
                            value={formData.customAddress}
                            onChange={handleInputChange}
                            onKeyDown={handleEnterKeyNavigation}
                            placeholder="해외 또는 기타 주소를 입력해주세요 (예: 미국 캘리포니아, 독도)"
                            style={{
                              flex: 1,
                              padding: "14px 16px",
                              backgroundColor: "#252836",
                              border: "1px solid #FFB84D",
                              borderRadius: "0",
                              color: "#fff",
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <button
                            type="button"
                            className="chamfer-box"
                            onClick={() => {
                              setIsCustomAddress(false);
                              setFormData((prev) => ({ ...prev, customAddress: "" }));
                            }}
                            style={{
                              padding: "14px 16px",
                              backgroundColor: "#252836",
                              border: "1px solid #555",
                              borderRadius: "0",
                              color: "#8a8d98",
                              fontSize: "14px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = sidebarAccent.main;
                              e.currentTarget.style.color = sidebarAccent.main;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#555";
                              e.currentTarget.style.color = "#8a8d98";
                            }}
                          >
                            목록에서 선택
                          </button>
                        </div>
                        <span style={{ color: "#8a8d98", fontSize: "12px", marginTop: "8px", display: "block" }}>해외 거주자 또는 특수 지역 거주자는 주소를 직접 입력해주세요.</span>
                      </div>
                    )}
                  </div>

                  {/* 핸드폰 번호 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>핸드폰 번호</label>
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `
                  .phone-input::placeholder {
                    color: #6b6e7a;
                  }
                `,
                      }}
                    />
                    {(() => {
                      const phoneMid = formData.phone.split("-")[0] || "";
                      const phoneLast = formData.phone.split("-")[1] || "";
                      return (
                        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                          {/* 010 고정 */}
                          <div
                            className="chamfer-box"
                            style={{
                              width: "70px",
                              flexShrink: 0,
                              padding: "14px 16px",
                              backgroundColor: "#1a1d29",
                              border: "1px solid #333",
                              borderRadius: "0",
                              color: "#fff",
                              fontSize: "14px",
                              fontWeight: 500,
                              textAlign: "center",
                            }}
                          >
                            010
                          </div>
                          <span style={{ color: "#555", fontSize: "16px", padding: "0 8px" }}>-</span>
                          {/* 중간 4자리 */}
                          <input
                            type="text"
                            name="phoneMid"
                            className="phone-input modal-input chamfer-box"
                            data-nav-index={11}
                            value={phoneMid}
                            onChange={async (e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                              const value = digitsOnly.slice(0, 4);
                              if (digitsOnly.length > 4) {
                                await showAlert("최대 4자까지 입력할 수 있습니다.");
                              }
                              setFormData((prev) => ({ ...prev, phone: `${value}-${phoneLast}` }));
                            }}
                            onKeyDown={handleEnterKeyNavigation}
                            maxLength={4}
                            placeholder="0000"
                            style={{
                              width: "100px",
                              flexShrink: 0,
                              padding: "14px 16px",
                              backgroundColor: "#252836",
                              border: "1px solid transparent",
                              borderRadius: "0",
                              color: "#fff",
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <span style={{ color: "#555", fontSize: "16px", padding: "0 8px" }}>-</span>
                          {/* 마지막 4자리 */}
                          <input
                            type="text"
                            name="phoneLast"
                            className="phone-input modal-input chamfer-box"
                            data-nav-index={12}
                            value={phoneLast}
                            onChange={async (e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                              const value = digitsOnly.slice(0, 4);
                              if (digitsOnly.length > 4) {
                                await showAlert("최대 4자까지 입력할 수 있습니다.");
                              }
                              setFormData((prev) => ({ ...prev, phone: `${phoneMid}-${value}` }));
                            }}
                            onKeyDown={handleEnterKeyNavigation}
                            maxLength={4}
                            placeholder="0000"
                            style={{
                              width: "100px",
                              flexShrink: 0,
                              padding: "14px 16px",
                              backgroundColor: "#252836",
                              border: "1px solid transparent",
                              borderRadius: "0",
                              color: "#fff",
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* 이메일 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>이메일</label>
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                      {/* 이메일 아이디 입력 */}
                      <input
                        className="modal-input chamfer-box"
                        type="text"
                        name="emailId"
                        data-nav-index={13}
                        value={formData.emailId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData((prev) => ({ ...prev, emailId: value }));

                          // 이메일 아이디 형식 검증 (영문, 숫자, ., _, - 만 허용)
                          const emailIdRegex = /^[a-zA-Z0-9._-]*$/;
                          if (value && !emailIdRegex.test(value)) {
                            setErrors((prev) => ({ ...prev, email: "이메일 아이디는 영문, 숫자, ., _, - 만 사용 가능합니다" }));
                          } else if (value && value.length < 2) {
                            setErrors((prev) => ({ ...prev, email: "이메일 아이디는 2자 이상 입력해주세요" }));
                          } else {
                            setErrors((prev) => ({ ...prev, email: "" }));
                          }
                        }}
                        onKeyDown={handleEnterKeyNavigation}
                        placeholder="example"
                        style={{
                          flex: 1,
                          padding: "14px 16px",
                          backgroundColor: "#252836",
                          border: errors.email ? "1px solid #ff6b6b" : "1px solid transparent",
                          borderRadius: "0",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                          clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
                        }}
                      />
                      <span style={{ color: "#555", fontSize: "16px", padding: "0 8px" }}>@</span>
                      {/* 이메일 도메인 드롭다운 또는 직접 입력 */}
                      {!isCustomEmailDomain ? (
                        <div style={{ flex: 1, position: "relative" }}>
                          <div
                            className="chamfer-box"
                            tabIndex={0}
                            data-nav-index={14}
                            data-nav-dropdown="emailDomain"
                            onClick={() => setOpenDropdown(openDropdown === "emailDomain" ? null : "emailDomain")}
                            style={{
                              padding: "14px 12px",
                              backgroundColor: "#252836",
                              borderRadius: "0",
                              color: formData.emailDomain ? "#fff" : "#6b6e7a",
                              fontSize: "14px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              border: openDropdown === "emailDomain" ? `1px solid ${sidebarAccent.main}` : "1px solid transparent",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <span>{formData.emailDomain || "선택"}</span>
                            <span
                              style={{
                                transform: openDropdown === "emailDomain" ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                                fontSize: "10px",
                                color: "#8a8d98",
                              }}
                            >
                              ▼
                            </span>
                          </div>
                          {openDropdown === "emailDomain" && (
                            <div
                              className="custom-dropdown-list"
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                marginTop: "4px",
                                backgroundColor: "#1a1d29",
                                borderRadius: "8px",
                                border: "1px solid #333",
                                maxHeight: "200px",
                                overflowY: "auto",
                                zIndex: 100,
                                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                              }}
                            >
                              {["naver.com", "gmail.com", "daum.net", "hanmail.net", "kakao.com", "nate.com", "outlook.com", "icloud.com"].map((domain, idx) => (
                                <div
                                  key={domain}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, emailDomain: domain }));
                                    setOpenDropdown(null);
                                    setTimeout(() => navigateToNextField(14), 0);
                                  }}
                                  style={{
                                    padding: "12px 14px",
                                    color: formData.emailDomain === domain ? sidebarAccent.main : "#fff",
                                    backgroundColor: formData.emailDomain === domain ? sidebarAccent.alpha(0.1) : "transparent",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    borderBottom: "1px solid #252836",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                    e.currentTarget.style.color = sidebarAccent.main;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = formData.emailDomain === domain ? sidebarAccent.alpha(0.1) : "transparent";
                                    e.currentTarget.style.color = formData.emailDomain === domain ? sidebarAccent.main : "#fff";
                                  }}
                                >
                                  {domain}
                                </div>
                              ))}
                              {/* 직접 입력 옵션 */}
                              <div
                                onClick={() => {
                                  setIsCustomEmailDomain(true);
                                  setFormData((prev) => ({ ...prev, emailDomain: "" }));
                                  setOpenDropdown(null);
                                }}
                                style={{
                                  padding: "12px 14px",
                                  color: sidebarAccent.main,
                                  backgroundColor: "transparent",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  borderTop: "2px solid #333",
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = sidebarAccent.alpha(0.15);
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                직접 입력
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            className="modal-input chamfer-box"
                            type="text"
                            name="customEmailDomain"
                            data-nav-index={14}
                            value={formData.customEmailDomain}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^a-zA-Z0-9.-]/g, "");
                              setFormData((prev) => ({ ...prev, customEmailDomain: value }));
                            }}
                            onKeyDown={handleEnterKeyNavigation}
                            placeholder="domain.com"
                            style={{
                              flex: 1,
                              padding: "14px 16px",
                              backgroundColor: "#252836",
                              border: "1px solid #FFB84D",
                              borderRadius: "0",
                              color: "#fff",
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                          <button
                            type="button"
                            className="chamfer-box"
                            onClick={() => {
                              setIsCustomEmailDomain(false);
                              setFormData((prev) => ({ ...prev, customEmailDomain: "" }));
                            }}
                            style={{
                              padding: "14px 12px",
                              backgroundColor: "#252836",
                              border: "1px solid #555",
                              borderRadius: "0",
                              color: "#8a8d98",
                              fontSize: "12px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = sidebarAccent.main;
                              e.currentTarget.style.color = sidebarAccent.main;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#555";
                              e.currentTarget.style.color = "#8a8d98";
                            }}
                          >
                            목록
                          </button>
                        </div>
                      )}
                    </div>
                    {errors.email && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "8px", display: "block" }}>{errors.email}</span>}
                  </div>

                  {/* 비전 섹션 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>비전</label>
                    <input
                      className="modal-input chamfer-box"
                      type="text"
                      name="vision"
                      data-nav-index={15}
                      value={formData.vision}
                      onChange={async (e) => {
                        if (e.target.value.length <= 10) {
                          setFormData((prev) => ({ ...prev, vision: e.target.value }));
                        } else {
                          await showAlert("최대 10자까지 입력할 수 있습니다.");
                        }
                      }}
                      onKeyDown={handleEnterKeyNavigation}
                      placeholder="가고 싶은 기업/브랜드를 기재합니다. (ex.구글)"
                      maxLength={10}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "#252836",
                        border: "1px solid transparent",
                        borderRadius: "0",
                        color: "#fff",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ color: "#8a8d98", fontSize: "11px", marginTop: "4px", display: "block" }}>{formData.vision.length}/10자 (공백 포함)</span>
                  </div>

                  {/* 연계 링크 */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ color: "#8a8d98", fontSize: "14px", display: "block", marginBottom: "10px" }}>연계 링크</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <label style={{ color: "#8a8d98", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <Image src="/images/0/cluster 1/003.png" alt="" width={16} height={16} />
                          Portfolio Files
                        </label>
                        <input
                          className="modal-input chamfer-box"
                          type="url"
                          data-nav-index={16}
                          value={iconLink3}
                          onChange={(e) => handleIconLinkChange(e.target.value, 3)}
                          onKeyDown={handleEnterKeyNavigation}
                          placeholder="https://example.com"
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            backgroundColor: "#252836",
                            border: iconLinkErrors.link3 ? "1px solid #ff6b6b" : "1px solid transparent",
                            borderRadius: "0",
                            color: "#fff",
                            fontSize: "14px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        {iconLinkErrors.link3 && <span style={{ color: "#ff6b6b", fontSize: "12px", marginTop: "6px", display: "block" }}>{iconLinkErrors.link3}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                {/* 모달 푸터 */}
                <div className="edit-modal-footer">
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                @font-face {
                  font-family: 'Cafe24Ohsquare';
                  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/Cafe24Ohsquare.woff') format('woff');
                  font-weight: normal;
                  font-style: normal;
                }
                .submit-btn-cafe {
                  font-family: 'Cafe24Ohsquare', sans-serif !important;
                }
              `,
                    }}
                  />
                  <button
                    type="submit"
                    className="chamfer-box submit-btn-cafe"
                    style={{
                      width: "100%",
                      padding: "16px",
                      backgroundColor: sidebarAccent.main,
                      border: "none",
                      borderRadius: "0",
                      color: "#1a1d29",
                      fontSize: "20px",
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "0.5px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    작성완료
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
      {/* 핸드폰 코멘트 모달 - 타크루 프로필용 (안내 팝업) */}
      {isPhoneCommentModalOpen && debugProfileType === "타크루" && (
        <div
          className={`phone-comment-modal-overlay ${sidebarThemeClass}`.trim()}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            className={`edit-modal-content ${sidebarThemeClass}`.trim()}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "24px",
              width: "90%",
              maxWidth: "480px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              border: `1px solid ${sidebarAccent.main}`,
            }}
          >
            {/* 헤더 */}
            <div className="edit-modal-header" style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "8px", padding: 0 }}>
              {/* 전화 아이콘 */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Image src="/images/0/cluster 1/phone-only-dynamic-color.png" alt="phone" width={28} height={28} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  연락이 필요하시면, 하단 내용을 참고해주세요 :)
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  if (isPhoneCommentDirty()) {
                    void showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                      setIsPhoneCommentModalOpen(false);
                    });
                    return;
                  }
                  setIsPhoneCommentModalOpen(false);
                }}
                style={{
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            {/* 내용 */}
            <div
              style={{
                backgroundColor: "#252836",
                borderRadius: "12px",
                padding: "16px 20px",
                marginTop: "16px",
              }}
            >
              <p style={{ color: "#ffffff", fontSize: "16px", margin: 0, lineHeight: 1.6, fontFamily: "Pretendard, sans-serif", wordBreak: "keep-all" }}>
                {isPhoneCommentLoading
                  ? "불러오는 중..."
                  : cachedProfile?.contactAvailable || "등록된 코멘트가 없습니다."}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 핸드폰 코멘트 모달 - 본인 프로필용 (입력 폼) */}
      {isPhoneCommentModalOpen && debugProfileType === "본인" && (
        <div className="phone-comment-modal-overlay">
          <div
            className="edit-modal-content"
            data-modal="phone-comment"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="edit-modal-header">
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  if (isPhoneCommentDirty()) {
                    void showConfirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?", () => {
                      setIsPhoneCommentModalOpen(false);
                    });
                    return;
                  }
                  setIsPhoneCommentModalOpen(false);
                }}
              >
                ✕
              </button>

              <div className="modal-header-top">
                <Image className="modal-icon" src="/images/0/cluster 1/phone-only-dynamic-color.png" alt="phone" width={28} height={28} />
                <h3>연락 가능 시간대</h3>
              </div>

              <p className="modal-subtitle">
                연락이 용이한 시간대 및 코멘트를 남겨주세요
              </p>
            </div>

            <div className="edit-modal-body">
              {isPhoneEditing ? (
                <>
                  <div className="phone-comment-counter">
                    <span>최대 150자까지 작성 가능합니다.</span>
                    <span className={formData.phoneComment.length > 150 ? "is-over-limit" : undefined}>
                      {formData.phoneComment.length} / 150
                    </span>
                  </div>
                  <textarea
                    className="phone-comment-input"
                    value={formData.phoneComment}
                    onChange={(e) => {
                      if (e.target.value.length <= 150) {
                        setFormData((prev) => ({ ...prev, phoneComment: e.target.value }));
                      }
                    }}
                    placeholder="내용을 작성해 주세요."
                    maxLength={150}
                    rows={4}
                  />
                </>
              ) : (
                <p className="modal-content-text">
                  {isPhoneCommentLoading
                    ? "불러오는 중..."
                    : cachedProfile?.contactAvailable || "등록된 내용이 없습니다."}
                </p>
              )}
            </div>

            {/* 푸터 — Type B (2-row: 🔎+버튼 동일 y좌표 고정 + 안내문 하단) */}
            <div className="edit-modal-footer">
              <div className="modal-footer-top">
                {/* 좌측: 🔎 notice-stamp */}
                <div
                  className="notice-stamp"
                  onClick={() => setIsPhoneHelpModalOpen(true)}
                  role="button"
                  aria-label="도움말"
                >
                  🔎
                </div>

                {/* 우측: 버튼 그룹 */}
                <div className="modal-footer-right">
                  {!isPhoneEditing ? (
                    <button
                      type="button"
                      className="modal-edit-btn"
                      onClick={() => {
                        // 수정 진입 시 cachedProfile 의 최신값으로 textarea 시드.
                        const initialEditValue =
                          cachedProfile?.contactAvailable || formData.phoneComment || DEFAULT_PHONE_COMMENT;
                        setFormData((prev) => ({ ...prev, phoneComment: initialEditValue }));
                        phoneCommentSnapshot.current = initialEditValue;
                        setIsPhoneEditing(true);
                      }}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="modal-cancel-btn"
                        onClick={async () => {
                          setFormData((prev) => ({ ...prev, phoneComment: phoneCommentSnapshot.current }));
                          setIsPhoneEditing(false);
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="modal-reset-btn"
                        onClick={async () => {
                          await showConfirm("입력한 내용을 초기화하시겠습니까?", () => {
                            setFormData((prev) => ({ ...prev, phoneComment: DEFAULT_PHONE_COMMENT }));
                          });
                        }}
                      >
                        초기화
                      </button>
                      <button
                        type="button"
                        className="modal-save-btn"
                        onClick={async () => {
                          await showConfirm("저장하시겠습니까?", async () => {
                            if (demoMode) {
                              setIsPhoneEditing(false);
                              setIsPhoneCommentModalOpen(false);
                              await showAlert("저장되었습니다.");
                              return;
                            }
                            try {
                              const response = await fetch("/api/profile/", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  contactAvailable: formData.phoneComment || null,
                                  // 테스트 유저 모드: demoUserId 동봉 시 백엔드가 권한 검증 후 대상 고정.
                                  ...(demoUserId ? { demoUserId } : {}),
                                }),
                              });
                              const result = await response.json();
                              if (result.success) {
                                const savedValue =
                                  (result.data?.contactAvailable ?? result.data?.contact_available ?? formData.phoneComment) || "";
                                setFormData((prev) => ({ ...prev, phoneComment: savedValue }));
                                phoneCommentSnapshot.current = savedValue;
                                clearProfileCache();
                                fetchUserProfile(true);
                                setIsPhoneEditing(false);
                                setIsPhoneCommentModalOpen(false);
                                await showAlert("저장되었습니다.");
                              } else {
                                await showAlert("저장 실패: " + (result.error || "알 수 없는 오류"));
                              }
                            } catch (error) {
                              console.error("연락처 코멘트 저장 오류:", error);
                              await showAlert("저장 중 오류가 발생했습니다.");
                            }
                          });
                        }}
                      >
                        저장
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 하단 row: 안내문 — visibility 토글로 공간 유지 (🔎/버튼 y좌표 고정) */}
              <div className="modal-footer-bottom">
                <span
                  className="modal-notice"
                  style={{ visibility: isPhoneEditing ? "visible" : "hidden" }}
                >
                  내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 연락 가능 시간대 도움말 모달 */}
      {isPhoneHelpModalOpen && (
        <div className={`help-modal-overlay ${sidebarThemeClass}`.trim()} onClick={() => setIsPhoneHelpModalOpen(false)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100vh", background: "rgba(0, 0, 0, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2001 }}>
          <div className={`help-modal ${sidebarThemeClass}`.trim()} onClick={(e) => e.stopPropagation()} style={{ width: "1024px", maxWidth: "1024px", height: "794px", maxHeight: "794px", border: `1px solid ${sidebarAccent.main}`, display: "flex", flexDirection: "column" as const, overflow: "hidden", position: "relative" }}>
            <div className="help-modal-header" style={{ height: "153px", minHeight: "153px", maxHeight: "153px", flexShrink: 0, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const, padding: "20px 24px", borderBottom: `1px solid ${sidebarAccent.alpha(0.2)}` }}>
              <div className="modal-header-top" style={{ display: "flex", alignItems: "center", width: "100%" }}>
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3 style={{ margin: 0, color: sidebarAccent.main, fontSize: "2.0625rem", fontWeight: 700, flex: 1, marginLeft: "10px" }}>도움말</h3>
                <button className="modal-close-btn" onClick={() => setIsPhoneHelpModalOpen(false)} style={{ background: "transparent", border: "none", color: sidebarAccent.main, fontSize: "20px", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
            <div className="help-modal-body" style={{ flex: 1, padding: "24px", overflowY: "auto" }}>{/* 빈 콘텐츠 — 추후 추가 */}</div>
          </div>
        </div>
      )}
      {/* 커스텀 툴팁 */}
      {tooltipVisible && (
        <div
          className="custom-tooltip"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            ...(tooltipVisible === "major" && {
              background: "transparent",
              padding: 0,
              boxShadow: "none",
              borderRadius: 0,
            }),
          }}
        >
          {tooltipVisible === "email" && mask.email(currentProfile.email)}
          {tooltipVisible === "school" && currentProfile.school}
          {tooltipVisible === "major" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "rgba(20, 20, 20, 0.95)",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "12px 16px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                minWidth: "180px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ color: currentProfile.accentColor, fontSize: "10px" }}>●</span>
                <span style={{ color: "#666", fontSize: "11px" }}>전공 1</span>
                <span style={{ color: "#fff", fontSize: "13px" }}>{currentProfile.major}</span>
              </div>
              {currentProfile.major2 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: currentProfile.lightColor, fontSize: "10px" }}>●</span>
                  <span style={{ color: "#666", fontSize: "11px" }}>전공 2</span>
                  <span style={{ color: "#fff", fontSize: "13px" }}>{currentProfile.major2}</span>
                </div>
              )}
              {currentProfile.major3 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#888", fontSize: "10px" }}>●</span>
                  <span style={{ color: "#666", fontSize: "11px" }}>전공 3</span>
                  <span style={{ color: "#fff", fontSize: "13px" }}>{currentProfile.major3}</span>
                </div>
              )}
            </div>
          )}
          {tooltipVisible === "hexagon1" && "Club Community"}
          {tooltipVisible === "hexagon2" && "Life Resume"}
          {tooltipVisible === "hexagon3" && "Portfolio Files"}
        </div>
      )}
    </div>
  );

  // ★ 모바일: Portal로 슬라이드 패널 렌더링
  if (isMobileView && isMounted) {
    return (
      <>
        {/* 세로 탭 버튼 — 항상 왼쪽에 고정 */}
        {createPortal(
          <button
            onClick={() => setIsProfileOpen(true)}
            className={sidebarThemeClass}
            style={{
              position: "fixed",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 9989,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              background: isProfileOpen ? "transparent" : sidebarAccent.gradient,
              color: "#000",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "3px",
              padding: isProfileOpen ? "0" : "16px 7px",
              borderRadius: "0 8px 8px 0",
              cursor: "pointer",
              userSelect: "none" as const,
              boxShadow: isProfileOpen ? "none" : `2px 2px 12px ${sidebarAccent.alpha(0.3)}`,
              border: "none",
              fontFamily: "Pretendard, sans-serif",
              opacity: isProfileOpen ? 0 : 1,
              pointerEvents: isProfileOpen ? ("none" as const) : ("auto" as const),
              transition: "opacity 0.2s ease",
            }}
          >
            PROFILE
          </button>,
          document.body,
        )}

        {/* 오버레이 + 슬라이드 패널 */}
        {createPortal(
          <>
            {/* 배경 오버레이 */}
            <div
              onClick={() => setIsProfileOpen(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.6)",
                zIndex: 9990,
                opacity: isProfileOpen ? 1 : 0,
                pointerEvents: isProfileOpen ? "auto" : "none",
                transition: "opacity 0.3s ease",
              }}
            />

            {/* 슬라이드 패널 */}
            <div
              className={sidebarThemeClass}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: "380px",
                maxWidth: "85vw",
                background: "#0a0a0a",
                zIndex: 9991,
                transform: isProfileOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                overflowY: "auto",
                overflowX: "hidden",
                borderRight: isProfileOpen ? `1px solid ${sidebarAccent.main}` : "1px solid #333",
                boxShadow: isProfileOpen ? "4px 0 20px rgba(0, 0, 0, 0.5)" : "none",
              }}
            >
              {/* 닫기 버튼 */}
              <button
                onClick={() => setIsProfileOpen(false)}
                style={{
                  position: "sticky",
                  top: "12px",
                  float: "right",
                  marginRight: "12px",
                  width: "32px",
                  height: "32px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid #444",
                  borderRadius: "50%",
                  color: "#ccc",
                  fontSize: "18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
              >
                ✕
              </button>

              {/* 실제 사이드바 콘텐츠 */}
              {sidebarContent}
            </div>
          </>,
          document.body,
        )}
      </>
    );
  }

  // ★ 데스크톱: 기존 그대로
  return sidebarContent;
};

export default Sidebar;

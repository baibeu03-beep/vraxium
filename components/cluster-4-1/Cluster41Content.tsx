"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";

import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { getOrgAliasFromPathname } from "@/utils/orgLabelAlias";
import TestUserBanner from "@/components/test-user-banner/TestUserBanner";
import { isPxRoute, isEcRoute, withPxRoute, getOrgConfigFromPathname, getGraduationWeeksFromPathname } from "@/lib/cluster-route";
import type { AdminCluster4WeeklyCardDto, Cluster4WeeklyCardsResponseDto, Cluster4WeeklyLineDto } from "@/shared/cluster4.contracts";
import type { Cluster3StatsCards } from "@/lib/cluster3StatsCardsTypes";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { isTransitionWeek } from "@/lib/cluster4-transition-week";
import { resolveSeasonWeekText } from "@/lib/cluster4-types";
import { getGrowthBadgeText } from "@/lib/cluster4-status-label";
// QA(mode=test) API/link suffix is temporarily disabled. Keep for future QA deployment reuse.
// import { parseScopeMode } from "@/lib/userScopeShared";

const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
  const t = text || "-";
  return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
};

const cardTitle = (c: AdminCluster4WeeklyCardDto): string =>
  (c.displayTitle ?? c.weekLabel ?? `${c.weekNumber}w`) || `${c.weekNumber}w`;

// 카드 제목 파싱: "2026년도 봄시즌 12w" → { year:2026, season:"봄", weekText:"12", isBreak:false }
// year 우선순위: card.seasonYear → card.year → label 정규식(년/년도 옵션) → startDate.slice(0,4).
const parseWeekTitle = (card: AdminCluster4WeeklyCardDto): { year: number | null; season: string; weekText: string; isBreak: boolean } => {
  const rec = card as Record<string, unknown>;
  const label = `${card.displayTitle ?? ""} ${card.weekLabel ?? ""}`;

  let year: number | null = null;
  if (typeof rec.seasonYear === "number") year = rec.seasonYear;
  else if (typeof rec.year === "number") year = rec.year as number;
  else {
    const m = label.match(/(\d{4})\s*(?:년|년도)?/);
    if (m) year = parseInt(m[1], 10);
    else if (typeof card.startDate === "string" && /^\d{4}/.test(card.startDate)) {
      year = parseInt(card.startDate.slice(0, 4), 10);
    }
  }

  let season = "";
  if (typeof rec.seasonName === "string" && (rec.seasonName as string).trim()) {
    season = rec.seasonName as string;
  } else {
    const m = label.match(/(봄|여름|가을|겨울)/);
    if (m) season = m[1];
  }

  // 전환 주차 판정: DTO 플래그/라벨 + 시즌별 전환 주차 번호(봄·가을 17주차/여름·겨울 9주차).
  const isBreak =
    rec.isBreakSeason === true ||
    rec.isRestSeason === true ||
    /전환|break/i.test(label) ||
    isTransitionWeek(season, typeof card.weekNumber === "number" ? card.weekNumber : null);

  // 시즌 내 주차만 표시 — 공용 resolveSeasonWeekText(lib/cluster4-types):
  // seasonWeek/weekInSeason(API 제공 시 우선) → weekNumber → label 정규식 순으로,
  // 각 출처에서 시즌 범위(봄/가을 1~16, 여름/겨울 1~8)를 벗어난 누적 주차 값은 버린다.
  const weekText = isBreak
    ? "전환"
    : resolveSeasonWeekText({ card: rec, weekNumber: card.weekNumber, label, seasonName: season });

  return { year, season, weekText, isBreak };
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const textField = (source: unknown, keys: string[], fallback = "-"): string => {
  const rec = asRecord(source);
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
};

const numberField = (source: unknown, keys: string[], fallback = 0): number => {
  const rec = asRecord(source);
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
};

const statusToneClass = (tone: unknown): string => {
  switch (String(tone ?? "").toLowerCase()) {
    case "success":
      return "success";
    case "fail":
      return "fail";
    case "progress":
      return "in-progress";
    case "rest":
      return "rest";
    case "counting":
      return "counting";
    default:
      return "";
  }
};

const statusDividerColor = (className: string): string => {
  if (className.includes("stopped")) return "#b0b6bf";
  if (className.includes("fail")) return "#ff6b6b";
  if (className.includes("rest")) return "#65e3ff";
  if (className.includes("in-progress")) return "#9b59b6";
  if (className.includes("counting")) return "#ff1493";
  return "#9dfa07";
};

const STATUS_ICON_DIR = "/images/0/cluster4/icon";
// className → 실제 public 파일명(원본 한글/공백/괄호 그대로). 파일명이 상태별로 제각각(공백
// 유무가 다름: "성장 (집계 중)" vs "성장(성공)")이라 문자열 가공 대신 정적 매핑으로 못 박는다.
// encodeURIComponent 로 직렬화하므로 한글/공백/괄호 경로 불일치가 재발하지 않는다.
const STATUS_ICON_FILE: Record<string, string> = {
  "in-progress": "icon - 성장 (진행 중).png",
  counting: "icon - 성장 (집계 중).png",
  success: "icon - 성장(성공).png",
  fail: "icon - 성장(실패).png",
  "rest-personal": "icon - 휴식(개인).png",
  "rest-official": "icon - 휴식(공식).png",
  // 성장 중단(종단 상태) — 전용 트로피 아이콘이 없어 잠금(lock) 아이콘으로 표기.
  stopped: "lock.png",
};

const statusIconPath = (statusLabel: string, className: string): string => {
  // statusTone(className) 누락/불일치 대비: 라벨 기반으로 클래스를 한 번 더 정규화해 매핑한다.
  const resolvedClass = badgeClassFromLabel(statusLabel, className);
  const file = STATUS_ICON_FILE[resolvedClass] ?? STATUS_ICON_FILE.success;
  return `${STATUS_ICON_DIR}/${encodeURIComponent(file)}`;
};

const PART_LINE_ORDER = ["information", "competency", "experience", "career"] as const;
// weekly-card-stats 영역은 표시 순서를 정보→경험→역량→경력으로 노출 (집계 로직/데이터는 PART_LINE_ORDER와 동일)
const WEEKLY_STATS_LINE_ORDER = ["information", "experience", "competency", "career"] as const;
const PART_LINE_LABEL: Record<(typeof PART_LINE_ORDER)[number], string> = {
  information: "정보",
  competency: "역량",
  experience: "경험",
  career: "경력",
};

const normalizePartType = (partType: unknown): (typeof PART_LINE_ORDER)[number] | null => {
  const key = String(partType ?? "").toLowerCase();
  if (key === "info" || key === "information") return "information";
  if (key === "competency") return "competency";
  if (key === "experience") return "experience";
  if (key === "career") return "career";
  return null;
};

// DTO 값을 그대로 표시. null/undefined 면 0 (기존 UI 빈값 규칙).
const lineNumerator = (line: Cluster4WeeklyLineDto | undefined): number =>
  typeof line?.numerator === "number" && Number.isFinite(line.numerator) ? line.numerator : 0;

const lineDenominator = (line: Cluster4WeeklyLineDto | undefined): number =>
  typeof line?.denominator === "number" && Number.isFinite(line.denominator) ? line.denominator : 0;

const lineRate = (line: Cluster4WeeklyLineDto | undefined): number =>
  typeof line?.rate === "number" && Number.isFinite(line.rate) ? line.rate : 0;

const adminCardLinesByPart = (card: AdminCluster4WeeklyCardDto) => {
  const map = new Map<(typeof PART_LINE_ORDER)[number], Cluster4WeeklyLineDto>();
  (card.lines || []).forEach((line) => {
    const part = normalizePartType(line?.partType);
    if (part && !map.has(part)) map.set(part, line);
  });
  return map;
};

// ── 강화율 단일 출처 헬퍼 ──
// 백엔드는 강화율을 {rate,count,total} 객체로 내려주는 신규 DTO 와, flat 필드
// (weeklyGrowthRate / growthNumerator·growthDenominator / lines[].numerator·denominator)
// 를 쓰는 구버전 두 형태가 공존한다. 이 헬퍼는 객체가 유효하면(숫자 하나라도 존재) 그대로 쓰고,
// 아니면 null 을 반환해 호출부가 flat/lines fallback 으로 넘어가게 한다. 프론트 재계산은 하지 않는다.
type RateTriple = { rate: number; count: number; total: number };

const readRateObject = (value: unknown): RateTriple | null => {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;
  const rate = num(rec.rate);
  const count = num(rec.count);
  const total = num(rec.total);
  if (rate === null && count === null && total === null) return null;
  return { rate: rate ?? 0, count: count ?? 0, total: total ?? 0 };
};

// lines[] 의 numerator/denominator/rate 는 "해당 part 의 집계값"이 part 내 모든 라인에 동일하게
// 복제되어 내려온다(검증: 같은 part 라인들의 denominator 가 라인 수와 동일·일치). 따라서 part 별
// 첫 라인 하나만 취하면 그 part 의 강화율 집계가 된다(합산 금지 — 중복 집계됨).
const lineTriple = (line: Cluster4WeeklyLineDto | undefined): RateTriple => ({
  rate: lineRate(line),
  count: lineNumerator(line),
  total: lineDenominator(line),
});

// statusLabel 텍스트 기반으로 기존 프론트 className 매핑.
// 백엔드 statusTone 만으로는 personal/official rest 가 분리되지 않으므로
// label 텍스트를 우선 검사하고, 그래도 분류 안 되면 statusTone fallback.
const badgeClassFromLabel = (label: string, fallback: string): string => {
  // 성장 중단(suspended/paused/deferred) — 성공/실패/대기보다 우선(이력서 카드 배지와 동일 기준).
  if (label.includes("중단")) return "stopped";
  if (label.includes("실패")) return "fail";
  if (label.includes("성공")) return "success";
  if (label.includes("진행")) return "in-progress";
  if (label.includes("집계")) return "counting";
  if (label.includes("개인")) return "rest-personal";
  if (label.includes("공식")) return "rest-official";
  return fallback || "";
};

const seasonFromCard = (card: AdminCluster4WeeklyCardDto): string => {
  const label = `${card.displayTitle ?? ""} ${card.weekLabel ?? ""}`;
  const match = label.match(/(봄|여름|가을|겨울)\s*시즌/);
  if (match) return match[1];
  const month = new Date(card.startDate).getMonth() + 1;
  if (month >= 3 && month <= 6) return "봄";
  if (month >= 7 && month <= 8) return "여름";
  if (month >= 9 && month <= 12) return "가을";
  return "겨울";
};

const SEASON_START_MONTH: Record<string, number> = {
  "겨울": 1,
  "봄": 3,
  "여름": 7,
  "가을": 9,
};

// 기존 프론트 저장 경로 규칙 유지: 시즌(한글) + weekNumber → (month, weekInMonth).
// 백엔드 thumbnailUrl/imageUrl 은 사용하지 않는다.
const getWeekImagePath = (card: AdminCluster4WeeklyCardDto): { primary: string; stripped: string } => {
  const rec = asRecord(card);
  const fromSeason = textField(card, ["fromSeason"], "");
  const toSeason = textField(card, ["toSeason"], "");
  const isBreakSeason = rec.isBreakSeason === true || rec.isRestSeason === true;
  const isOnboarding = rec.isOnboarding === true;

  if (isBreakSeason && !isOnboarding && fromSeason && toSeason) {
    const mid = `/images/0/cluster4/주차 이미지/중간 주차 (${fromSeason}-${toSeason}).png`;
    return { primary: mid, stripped: mid };
  }

  const seasonNameFromCard = textField(card, ["seasonName"], "");
  const effectiveSeasonName =
    isBreakSeason && toSeason
      ? toSeason
      : (seasonNameFromCard || seasonFromCard(card));
  const startMonth = SEASON_START_MONTH[effectiveSeasonName] ?? 1;
  const weekNumber = card.weekNumber || 1;
  const monthOffset = Math.floor((weekNumber - 1) / 4);
  const month = startMonth + monthOffset;
  const weekOfMonth = ((weekNumber - 1) % 4) + 1;
  const holidayName = textField(card, ["holidayName"], "");
  const suffix = holidayName ? ` ${holidayName}` : "";
  const base = `/images/0/cluster4/주차 이미지/${effectiveSeasonName} ${weekNumber}주차 (${month}월 ${weekOfMonth}주차`;
  return {
    primary: `${base}${suffix}).png`,
    stripped: `${base}).png`,
  };
};

const handleWeekImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const rest = "/images/0/cluster4/주차 이미지/휴식(개인,공식).png";
  const stripped = img.dataset.strippedSrc;
  if (img.dataset.fallbackStep !== "1" && stripped) {
    img.dataset.fallbackStep = "1";
    img.src = stripped;
  } else {
    img.src = rest;
  }
};

// season filter 기준은 weekLabel 의 시즌 prefix (admin DTO 공식 라벨).
const seasonOfLabel = (label: string | null | undefined): string => {
  if (!label) return "";
  const m = label.match(/^(.+시즌)/);
  return (m?.[1] || label).trim();
};

const Cluster41Content = () => {
  const searchParams = useSearchParams();
  // 테스트 유저 모드: ?demoUserId={userId} 가 있으면 해당 테스트 유저 기준으로 페이지를 렌더한다.
  // (진입: /admin/test-users → /cluster-4?admin=true&demoUserId={userId})
  const demoUserId = searchParams.get('demoUserId');
  // 표시 대상 유저: 기존 admin-view(userId) → 없으면 테스트 유저(demoUserId).
  // 이렇게 하면 userId 키로 동작하는 모든 사용자 기준 조회가 자동으로 테스트 유저를 가리킨다(데이터 혼합 방지).
  const targetUserId = searchParams.get('userId') || searchParams.get('userID') || demoUserId;
  // 조회 API 에 붙일 demoUserId 쿼리 suffix (백엔드 테스트 유저 판정용). 없으면 빈 문자열.
  const demoQS = demoUserId ? `&demoUserId=${encodeURIComponent(demoUserId)}` : '';
  // weekly-cards 모집단 스코프 suffix — mode=test 면 admin 이 테스트 모드(여름 시뮬레이션) 정책으로
  // 카드/라인을 내려준다. operating(미지정)이면 빈 문자열 → 요청 byte-identical.
  // QA(mode=test) API suffix disabled.
  // const modeQS = parseScopeMode(searchParams.get('mode')) === 'test' ? '&mode=test' : '';
  const modeQS = '';
  // 페이지 내 네비게이션에 붙일 쿼리: target(userId)·actor(demoUserId)·org 를 모두 보존한다.
  // ⚠️ 과거엔 테스트 모드에서 demoUserId 만 싣고 userId(대상자)를 떨궈, 타 크루 주차 카드로
  //    진입할 때 urlUserId 가 demoUserId 로 폴백되어 "내 카드로 복귀"하는 버그가 있었다.
  //    target(userId)은 항상 유지하고, demoUserId 는 actor 로만 덧붙인다(분리 유지).
  const demoUserName = searchParams.get('demoUserName');
  const userLinkQuery = (() => {
    const params = new URLSearchParams();
    if (targetUserId) params.set('userId', targetUserId);
    if (demoUserId) {
      params.set('demoUserId', demoUserId);
      params.set('admin', 'true');
      if (demoUserName) params.set('demoUserName', demoUserName);
    }
    const org = searchParams.get('org');
    if (org) params.set('org', org);
    // 모집단 스코프(mode=test) 보존 — 주차카드/탭 이동 시 테스트 모드 유지.
    // operating(미지정)이면 미부착 → 링크 byte-identical.
    // QA(mode=test) page navigation propagation disabled.
    // if (parseScopeMode(searchParams.get('mode')) === 'test') params.set('mode', 'test');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  })();
  const isDemoMode = checkDemoMode();

  const [dbWeeklyData, setDbWeeklyData] = useState<AdminCluster4WeeklyCardDto[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const isPX = isPxRoute(pathname);
  const isEC = isEcRoute(pathname);
  // 현재 조직 대표 강조색 — ORGANIZATION_CONFIG(단일 정의소).
  const filterAccent = getOrgConfigFromPathname(pathname).themeColor;
  const filterAccentBg = isPX
    ? "rgba(30, 149, 3, 0.1)"
    : isEC
    ? "rgba(255, 75, 112, 0.1)"
    : "rgba(255, 165, 0, 0.1)";
  const filterAccentBgSelected = isPX
    ? "rgba(30, 149, 3, 0.2)"
    : isEC
    ? "rgba(255, 75, 112, 0.2)"
    : "rgba(255, 165, 0, 0.2)";

  const headerRef = useRef<HTMLElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [resultDropdownOpen, setResultDropdownOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState("역대 시즌");
  const [selectedResult, setSelectedResult] = useState("주차 결과");
  const [isMobile, setIsMobile] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftSeason, setDraftSeason] = useState("역대 시즌");
  const [draftResult, setDraftResult] = useState("주차 결과");
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);
  const [seasonBtnPos, setSeasonBtnPos] = useState({ top: 0, left: 0 });
  const [resultBtnPos, setResultBtnPos] = useState({ top: 0, left: 0 });
  const seasonBtnRef = useRef<HTMLDivElement>(null);
  const resultBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (seasonBtnRef.current && !seasonBtnRef.current.contains(e.target as Node)) {
        setSeasonDropdownOpen(false);
      }
      if (resultBtnRef.current && !resultBtnRef.current.contains(e.target as Node)) {
        setResultDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (window.location.hash === '#weekly-filter-bar') {
      const tryScroll = () => {
        const el = document.getElementById('weekly-filter-bar');
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 150;
          window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' });
        }
      };
      setTimeout(tryScroll, 500);
      setTimeout(tryScroll, 1000);
    }
  }, []);

  const [currentSeasonInfo, setCurrentSeasonInfo] = useState<{
    year: number;
    name: string;
    currentWeek: number;
    isClubBreak: boolean;
    // 전환 주차 여부 — 서버(/api/profile) canonical 값. 고객 문구를 고정 텍스트로 분기한다.
    isTransition: boolean;
    isBreakSeason: boolean;
    fromSeason: string | null;
    toSeason: string | null;
    // 전환 문구 연도(겨울→다음 연도 봄 처럼 from/to 연도가 다를 수 있음).
    fromYear: number | null;
    toYear: number | null;
  } | null>(null);

  interface GrowthPeriodStats {
    approvedWeeks: number;
    unapprovedWeeks: number;
    restWeeks: number;
    clubBreakWeeks: number;
    availableWeeks: number;
    availableSeasons: number;
    restSeasons: number;
  }
  const [growthPeriodStats, setGrowthPeriodStats] = useState<GrowthPeriodStats | null>(null);

  // 성장 주차 집계(가능/성공/실패/휴식) SoT — 실제 모드 전용.
  // GET /api/cluster3/stats-cards(admin canonical) proxy 응답. Cluster3 와 동일 SoT.
  // 데모/로딩/실패 시에는 기존 growthPeriodStats(/api/profile) fallback.
  const [statsCards, setStatsCards] = useState<Cluster3StatsCards | null>(null);

  interface WeekInfo {
    year: number | null;
    seasonName: string | null;
    weekNumber: number | null;
    isBreak?: boolean;
  }
  const [startWeekInfo, setStartWeekInfo] = useState<WeekInfo | null>(null);
  const [endWeekInfo, setEndWeekInfo] = useState<WeekInfo | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [growthStatus, setGrowthStatus] = useState<string | null>(null);

  interface SeasonCardData {
    id: string;
    seasonId: string;
    year: number;
    seasonName: string;
    startDate: string;
    endDate: string;
    progressStatus: string;
    approvedWeeks: number;
    totalWeeks: number;
    roleInSeason: string;
  }
  const [seasonCards, setSeasonCards] = useState<SeasonCardData[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(true);

  const [isLoadingWeeks, setIsLoadingWeeks] = useState(true);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);
  // 인적사항/성장 요약(프로필 응답) 준비 여부. 프로필 fetch 가 끝나기 전에는
  // 요약 카드(시즌/성장 주차 집계·배지)를 0/'-'/'로딩 중...' 대신 Skeleton 으로 가린다.
  // ※ 표시 전용 게이트일 뿐, 데이터/값/배선은 일절 바꾸지 않는다.
  const [summaryReady, setSummaryReady] = useState(false);

  const [joinedWeekStartDate, setJoinedWeekStartDate] = useState<string | null>(null);
  // weekly-cards 로드 실패(504/비-JSON/네트워크) 시 기존 데이터를 유지하면서 표시할 에러 상태.
  const [weeklyLoadError, setWeeklyLoadError] = useState(false);
  // 최신 요청만 state 에 반영(latest-wins). targetUserId 변경/재마운트로 fetch 가 여러 번 떠도
  // 늦게 도착한 stale 응답(특히 실패 응답)이 최신 성공 데이터를 덮어쓰지 못하게 한다.
  const weeklyReqSeqRef = useRef(0);

  useEffect(() => {
    const abortController = new AbortController();
    const myReq = ++weeklyReqSeqRef.current;
    // 이 응답이 더 이상 최신이 아니거나(다른 userId 요청이 뒤늦게 떴거나) 언마운트되면 stale.
    const isStale = () => abortController.signal.aborted || myReq !== weeklyReqSeqRef.current;

    const fetchData = async () => {
      try {
        setIsLoadingWeeks(true);
        // userId 전환 경계(effect deps=[targetUserId])에서만 카드 초기화 — 이전 유저 카드가
        // 새 유저 화면에 잘못 남지 않게 한다. 전환 중에는 isLoadingWeeks=true 가 로딩 화면을 보여준다.
        // (동일 userId 의 중도 실패는 effect 가 재실행되지 않으므로 여기서 초기화되지 않고 기존 데이터가 보존된다.)
        setDbWeeklyData([]);
        setWeeklyLoadError(false);
        setSummaryReady(false);

        // targetUserId 를 아는 경우(타 유저/데모 조회) weekly-cards 를 프로필과 병렬 시작.
        // 프로필 ?userId=X 응답의 data.id === X 이므로 동일한 요청이며, 응답 검사·반영
        // 순서는 기존과 동일(프로필 처리 후). 세션 모드는 userId 를 모르므로 기존 직렬 유지.
        const earlyWeeklyPromise = targetUserId
          ? fetch(`/api/cluster4/weekly-cards?userId=${targetUserId}${demoQS}${modeQS}`, { signal: abortController.signal })
          : null;
        // 프로필 실패로 조기 return 할 때 unhandled rejection 이 되지 않도록 미리 흡수.
        if (earlyWeeklyPromise) earlyWeeklyPromise.catch(() => {});

        // context=cluster41: cluster-4-1 이 응답에서 읽지 않는 무거운 계산(실무 카운트 라인쿼리·
        // resume-card settings·point DTO·club-rank 외부프록시)을 백엔드에서 스킵하는 경량 분기.
        // growthInfo/growthPeriodStats/currentSeasonInfo/seasonHistories 값은 plain 과 100% 동일.
        const profileUrl = targetUserId
          ? `/api/profile?userId=${targetUserId}${demoQS}&context=cluster41`
          : '/api/profile?context=cluster41';
        const profileRes = await fetch(profileUrl, { signal: abortController.signal });
        const profileResult = await profileRes.json();
        if (isStale()) return;

        if (!profileRes.ok || !profileResult.data?.id) {
          if (!targetUserId) {
            if (profileRes.status === 401) setIsNotLoggedIn(true);
            else if (profileRes.status === 404) setIsPendingApproval(true);
          }
          setDbWeeklyData([]);
          setIsLoadingWeeks(false);
          // 프로필 실패 시: 요약 카드가 (targetUserId 보기에서) 무한 Skeleton 으로 멈추지 않도록
          // 게이트를 풀어 기존 '-' fallback 을 노출한다(에러 상태는 별도 빈/안내 블록이 처리).
          setSummaryReady(true);
          return;
        }

        const userId = profileResult.data.id;

        if (profileResult.growthPeriodStats) {
          setGrowthPeriodStats(profileResult.growthPeriodStats);
        }
        if (profileResult.growthInfo) {
          setStartWeekInfo(profileResult.growthInfo.startWeekInfo || null);
          setEndWeekInfo(profileResult.growthInfo.endWeekInfo || null);
          setUserStatus(profileResult.growthInfo.status || null);
          setGrowthStatus(profileResult.growthInfo.growthStatus || null);
          if (profileResult.growthInfo.startDate) {
            setJoinedWeekStartDate(profileResult.growthInfo.startDate);
          }
        }

        // 현재 시즌/주차 — 서버 canonical 값을 그대로 표시 (프론트 계산 X)
        if (profileResult.currentSeasonInfo) {
          setCurrentSeasonInfo(profileResult.currentSeasonInfo);
        }

        const seasonNameMap: { [key: string]: string } = {
          'spring': '봄', 'summer': '여름', 'fall': '가을', 'winter': '겨울'
        };
        if (profileResult.seasonHistories && profileResult.seasonHistories.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cards: SeasonCardData[] = profileResult.seasonHistories.map((sh: any) => ({
            id: sh.id,
            seasonId: sh.seasons?.id || '',
            year: sh.seasons?.year || 0,
            seasonName: seasonNameMap[sh.seasons?.name] || sh.seasons?.name || '',
            startDate: sh.seasons?.start_date || '',
            endDate: sh.seasons?.end_date || '',
            progressStatus: sh.progress_status,
            approvedWeeks: sh.approved_weeks || 0,
            totalWeeks: sh.total_weeks || 0,
            roleInSeason: sh.role_in_season || '',
          }));
          setSeasonCards(cards);
        } else {
          setSeasonCards([]);
        }
        setIsLoadingSeasons(false);
        // 프로필 응답이 모두 반영된 시점 — 이제 요약 카드를 실데이터로 노출(Skeleton 해제).
        setSummaryReady(true);

        const weeklyRes = earlyWeeklyPromise
          ? await earlyWeeklyPromise
          : await fetch(`/api/cluster4/weekly-cards?userId=${userId}${demoQS}${modeQS}`, { signal: abortController.signal });
        if (isStale()) return;

        // ★ 504(Gateway Timeout)/HTML 에러 페이지 등 비정상 응답은 json() 이 throw 하거나
        //   data 가 배열이 아닐 수 있다. res.ok + content-type 를 먼저 검사하고,
        //   실패 시 기존 dbWeeklyData 를 절대 [] 로 덮어쓰지 않는다(이미 보이던 목록 보존).
        const contentType = weeklyRes.headers.get('content-type') || '';
        if (!weeklyRes.ok || !contentType.includes('application/json')) {
          console.error('[weekly-cards] 응답 실패 — 기존 데이터 유지(덮어쓰기 안 함):', {
            status: weeklyRes.status,
            contentType,
          });
          setWeeklyLoadError(true);
          return; // setDbWeeklyData([]) 하지 않음
        }

        const weeklyResult = await weeklyRes.json() as Cluster4WeeklyCardsResponseDto;
        if (isStale()) return;
        console.log('[weekly-cards] raw json', weeklyResult);
        console.log('[weekly-cards] json.data length', Array.isArray(weeklyResult.data) ? weeklyResult.data.length : 'not array');

        if (!Array.isArray(weeklyResult.data)) {
          // 200 이지만 data 가 배열이 아닌 경우(에러 페이로드 등)도 기존 데이터 보존.
          console.error('[weekly-cards] data 가 배열이 아님 — 기존 데이터 유지', weeklyResult);
          setWeeklyLoadError(true);
          return;
        }

        const cards = weeklyResult.data;
        console.log('[weekly-cards] state cards length', cards.length);
        if (cards.length > 0) {
          // DTO 원본 1장 — 위치별 매핑 검증용
          console.log('[weekly-cards] sample card (raw DTO)', cards[0]);
          console.log('[weekly-cards] sample card lines', cards[0]?.lines);
          // 진단: 주차 카드 목록 통계용 신규 요약 필드가 실제로 내려오는지 (백엔드 누락 시 즉시 식별)
          console.log('[weekly-cards] 신규 요약 필드 점검', cards.map((c) => ({
            weekNumber: c.weekNumber,
            reputationSummary: c.reputationSummary ?? null,
            colleagueSummary: c.colleagueSummary ?? null,
          })));
          // W12 raw DTO 출력 — 매핑 검증용
          const w12 = cards.find((c) => c.weekNumber === 12);
          if (w12) {
            console.log('[weekly-cards] W12 raw DTO', w12);
            console.log('[weekly-cards] W12 lines', w12.lines);
          } else {
            console.log('[weekly-cards] W12 not found in response');
          }
        }
        // 정상 응답(빈 배열 포함)만 데이터를 갱신한다.
        setWeeklyLoadError(false);
        setDbWeeklyData(cards);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // 네트워크 예외/JSON 파싱 실패 — 기존 데이터 유지, 에러만 표시.
        console.error("[weekly-cards] 로드 예외 — 기존 데이터 유지:", err);
        if (!isStale()) setWeeklyLoadError(true);
      } finally {
        if (!isStale()) setIsLoadingWeeks(false);
      }
    };

    fetchData();

    return () => { abortController.abort(); };
  }, [targetUserId]);

  // 성장 주차 집계 — 실제 모드 SoT.
  // GET /api/cluster3/stats-cards proxy(admin canonical) 응답을 그대로 사용한다(프론트 계산 X).
  useEffect(() => {
    const abortController = new AbortController();

    const fetchStatsCards = async () => {
      try {
        const url = targetUserId
          ? `/api/cluster3/stats-cards?userId=${targetUserId}${demoQS}`
          : "/api/cluster3/stats-cards";
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
          console.warn("[cluster3/stats-cards] non-OK", response.status);
          return;
        }
        const json = await response.json();
        if (abortController.signal.aborted) return;
        const data = (json?.data ?? null) as Cluster3StatsCards | null;
        setStatsCards(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("[cluster3/stats-cards] 로드 오류:", error);
      }
    };

    fetchStatsCards();

    return () => { abortController.abort(); };
  }, [targetUserId]);

  // 성장 상태 badge 텍스트 — 공용 getGrowthBadgeText(lib/cluster4-status-label) 사용.
  // raw enum 만 비교(한국어 라벨 비교 금지) · Cluster4Content 와 동일 매핑 함수 공유.
  // 성장 중단(suspended/paused/deferred)은 상단 허브/프로필 배지(아래 getGrowthBadgeText 호출)에 표시한다.
  // 주차 카드 목록의 상태 배지는 weekly-cards DTO 의 실제 주차 상태(userWeekStatus)를 그대로 사용하며,
  // 과거 성공/실패/휴식을 "성장 중단"으로 덮어쓰지 않는다(블랭킷 override 금지).
  //   단, "성장 중단" 배지는 성장 중단(suspended)이 적용된 주차 카드 1장에만 표시한다 — 아래 isStopWeekCard.
  // isStoppedUser: 상단/프로필 배지와 *동일 입력*으로 사용자가 성장 중단 상태인지 판정(graduated 와 구분).
  //   suspended/paused 모두 "성장 중단" 이지만, paused 는 endWeekInfo(=suspended_week_id)가 비어 있어
  //   카드별 표시 대상에서 자연히 제외된다(상단/프로필 배지만 유지). graduated 는 여기서 false.
  const isStoppedUser =
    getGrowthBadgeText(userStatus, statsCards?.process.growthStatusKey ?? growthStatus) === '성장 중단';

  // 성장 주차 집계 표시값 — 실제 모드: admin stats-cards(period) 우선, 데모/로딩/실패: /api/profile fallback.
  // 프론트 계산 없이 API 응답값만 표시. 숫자 4종만 admin 으로 전환(시작/종료 주차·badge·괄호 시즌값은 기존 유지).
  const growthWeeks = {
    available: statsCards?.period.growableWeeks ?? growthPeriodStats?.availableWeeks ?? null,
    approved: statsCards?.period.successWeeks ?? growthPeriodStats?.approvedWeeks ?? null,
    unapproved: statsCards?.period.failWeeks ?? growthPeriodStats?.unapprovedWeeks ?? null,
    rest: statsCards?.period.personalRestWeeks ?? growthPeriodStats?.restWeeks ?? null,
    restSeasons: statsCards?.period.personalRestSeasons ?? growthPeriodStats?.restSeasons ?? null,
  };

  const updateSeasonPos = () => {
    if (seasonBtnRef.current) {
      const rect = seasonBtnRef.current.getBoundingClientRect();
      const { top, left } = getFixedDropdownPosition(rect, 8);
      setSeasonBtnPos({ top, left });
    }
  };

  const updateResultPos = () => {
    if (resultBtnRef.current) {
      const rect = resultBtnRef.current.getBoundingClientRect();
      const { top, left } = getFixedDropdownPosition(rect, 8);
      setResultBtnPos({ top, left });
    }
  };

  // 드롭다운 열림 중 스크롤/리사이즈 시 fixed 메뉴 위치를 버튼 기준으로 재계산
  // (capture: true — window 스크롤뿐 아니라 내부 스크롤 컨테이너에도 반응)
  useEffect(() => {
    if (!seasonDropdownOpen && !resultDropdownOpen) return;
    const reposition = () => {
      if (seasonDropdownOpen) updateSeasonPos();
      if (resultDropdownOpen) updateResultPos();
    };
    window.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", reposition);
    };
  }, [seasonDropdownOpen, resultDropdownOpen]);

  const seasonOptions = React.useMemo(() => {
    const unique = new Map<string, string>();
    dbWeeklyData.forEach((w) => {
      const s = seasonOfLabel(w.weekLabel);
      if (s && !unique.has(s)) unique.set(s, s);
    });
    return ["역대 시즌", ...Array.from(unique.values())];
  }, [dbWeeklyData]);

  // result 필터는 백엔드 statusLabel 값을 그대로 사용한다.
  // 옵션 목록도 응답에서 발견된 statusLabel 들로 자동 구성.
  const resultOptions = React.useMemo(() => {
    const set = new Set<string>();
    dbWeeklyData.forEach((w) => {
      if (w.statusLabel) set.add(w.statusLabel);
    });
    return ["전체 (all)", ...Array.from(set)];
  }, [dbWeeklyData]);

  // 필터 결과를 매 렌더마다 재계산하지 않도록 메모이즈(입력/계산식 동일 — 출력 불변).
  const filteredDbData = React.useMemo(() => dbWeeklyData.filter((week) => {
    // 전환 주차(봄·가을 17주차 / 여름·겨울 9주차)는 주차 카드 목록에서 아예 제외한다.
    // → 목록/카드 개수/페이지네이션/필터 결과 모두에서 빠진다(이 배열이 단일 소스).
    if (isTransitionWeek(seasonFromCard(week), week.weekNumber)) return false;
    const seasonMatch =
      selectedSeason === "역대 시즌" || seasonOfLabel(week.weekLabel) === selectedSeason;
    const resultMatch =
      selectedResult === "주차 결과" ||
      selectedResult === "전체 (all)" ||
      week.statusLabel === selectedResult;
    return seasonMatch && resultMatch;
  }), [dbWeeklyData, selectedSeason, selectedResult]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDbData.length / itemsPerPage));
  // 화면에 그릴 카드 목록도 메모이즈 — 페이지/모바일 노출수/필터가 바뀔 때만 재계산.
  const visibleCards: AdminCluster4WeeklyCardDto[] = React.useMemo(
    () => isMobile
      ? filteredDbData.slice(0, mobileVisibleCount)
      : filteredDbData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredDbData, isMobile, mobileVisibleCount, currentPage]
  );

  console.log('[weekly-cards] render lengths', {
    cards: dbWeeklyData.length,
    filteredCards: filteredDbData.length,
    visibleCards: visibleCards.length,
    visibleWeekNumbers: visibleCards.map((c) => c.weekNumber),
  });
  if (dbWeeklyData.length > 0 && filteredDbData.length === 0) {
    console.error("[weekly-cards] 데이터 있으나 필터 후 0건 — 필터 조건 불일치",
      { firstStatusLabel: dbWeeklyData[0].statusLabel, selectedSeason, selectedResult });
  }
  if (dbWeeklyData.length === 0 && !isLoadingWeeks) {
    console.warn("[weekly-cards] 로딩 완료인데 데이터 0건 — API fetch 확인 필요");
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = days[date.getDay()];
    return `${year} - ${month} - ${day} (${dayOfWeek})`;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSeason, selectedResult]);

  return (
    <>
      {/* 드롭다운 애니메이션 스타일 */}
      <style jsx global>{`
        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

    {demoUserId ? <TestUserBanner /> : null}
    <div className="cluster4-content cluster4-content--week">
      {/* Section 1: CLUB CHALLENGE GROWTH */}
      <section className="cluster4-section1" ref={headerRef}>
        {/* 좌측 상단 탭 (세로 정렬) */}
        <div className="top-tabs">
          <div className="tab" style={{ width: '44px', height: '44px', background: isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20%EC%A0%84%EA%B5%AC.png" alt="전구" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(withPxRoute(`/cluster-4${userLinkQuery}`, pathname))}>
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </div>
          <div className="tab" style={{ width: '44px', height: '44px', background: '#161816' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20book.png" alt="book" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(withPxRoute(`/cluster-4-1${userLinkQuery}`, pathname))}>
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
          <p className="quote-text">
            There is no magic to achievement. It's really about hard work, choices and persistence.
          </p>
          <p className="quote-highlight">"무언가를 성취하기 위해 부릴 수 있는 마법은 없다. 필요한 것은 오직 노력, 선택 그리고 꾸준함일 뿐이다."</p>
          <p className="quote-author">-미셸 오바마(Michelle Obama)-</p>
        </div>
      </section>

      {/* Section 2: WEEKLY GROWTH 카드 */}
      <section className="cluster4-section2">
        {(isNotLoggedIn || isPendingApproval) && !targetUserId ? (
          <div className="season-growth-card visible" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <p style={{ fontSize: '16px', color: '#aaa', textAlign: 'center' }}>현재 해당 하는 시즌이 없습니다.</p>
          </div>
        ) : (
        <div className="season-growth-card visible">
          {/* 왼쪽 콘텐츠 */}
          <div className="card-left">
            {/* 타이틀과 배지를 한 줄로 */}
            <div className="season-header-row">
              <div className="season-title-wrapper">
                <h3 className="season-title-shadow">WEEKLY GROWTH</h3>
                <h3 className="season-title">WEEKLY GROWTH</h3>
              </div>
              <div className="season-badge">
                <svg className="badge-outline" viewBox="0 0 124 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" stroke={isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07'} strokeWidth="1.69311" fill="none"/>
                </svg>
                <svg className="badge-border" viewBox="0 0 124 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" fill={isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07'} stroke={isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07'} strokeWidth="1.69311"/>
                </svg>
                {summaryReady ? (
                  <span className="badge-text">{getGrowthBadgeText(
                    userStatus,
                    // 상태값 SoT: admin stats-cards process.growthStatusKey(raw 안정 키) 우선,
                    // 데모/로딩/실패 시 /api/profile growthStatus(raw enum) fallback.
                    // 한글 라벨(growthStatusLabel/growthStatus="성장 완료(졸업)" 등)은 매핑에
                    // 넣지 않는다 — raw enum 전용 공용 매퍼에서 전부 default 로 떨어져
                    // 졸업자가 "성장 진행 중"으로 오표시되던 원인(2026-06-05 수정).
                    statsCards?.process.growthStatusKey
                      ?? growthStatus
                  )}</span>
                ) : (
                  <Skeleton width={64} height={15} radius={4} />
                )}
              </div>
            </div>

            {/* Add new collection 카드 */}
            <div className="collection-card">
              <div className="collection-icon">
                <img
                  src={
                    isPX
                      ? "/images/0/cluster4/아호 캐릭터-px.png"
                      : isEC
                      ? "/images/0/cluster4/아호 캐릭터-ec.png"
                      : "/images/0/cluster4/아호 캐릭터.png"
                  }
                  alt="아호 캐릭터"
                />
              </div>
              <div className="collection-content">
                <div className="collection-header">
                  <img src="/images/0/cluster4/icon/icon - plus.png" alt="plus" className="add-icon" />
                  <span className="collection-label">Add new passion, hardship and growth</span>
                </div>
                <p className="collection-text">
                  <span className="collection-text-inner">
                  {!summaryReady ? (
                    <>
                      <Skeleton width="100%" height={14} radius={4} style={{ display: 'block', marginBottom: 6 }} />
                      <Skeleton width="70%" height={14} radius={4} style={{ display: 'block' }} />
                    </>
                  ) : currentSeasonInfo?.isBreakSeason ? (
                    <>현재 클럽은, <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.fromSeason} 시즌</strong>에서 <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.toSeason} 시즌</strong>으로 가는 휴식(시즌 전환) 중에 있습니다.</>
                  ) : currentSeasonInfo?.isTransition && currentSeasonInfo.fromSeason && currentSeasonInfo.toSeason ? (
                    // 전환 주차: 현재 시즌 → 다음 시즌(연도 포함) 동적 계산 문구(1줄). 시즌명 하드코딩·비고 미사용.
                    // 연도는 화면 표시만 2자리(26년)로 변환 — DTO 값(fromYear/toYear)은 그대로 사용하고
                    // % 100 으로 끝 2자리만 노출(겨울→다음 해: 27년 봄 처럼 연도 차이 유지).
                    // 문구는 카드 폭(739px) 1줄에 18px 폰트로 들어가도록 "…전환 준비 중입니다"로 축약.
                    <>현재 클럽은, <strong>{String((currentSeasonInfo.fromYear ?? currentSeasonInfo.year) % 100).padStart(2, "0")}년 {currentSeasonInfo.fromSeason} 시즌</strong>에서, <strong>{String((currentSeasonInfo.toYear ?? currentSeasonInfo.year) % 100).padStart(2, "0")}년 {currentSeasonInfo.toSeason} 시즌</strong>으로 전환 준비 중입니다.</>
                  ) : (
                    <>현재 클럽은, <strong>{currentSeasonInfo ? `${currentSeasonInfo.year}년 ${currentSeasonInfo.name} 시즌, ${currentSeasonInfo.currentWeek}주차` : '로딩 중...'}</strong>를 {currentSeasonInfo?.isClubBreak ? '휴식 (공식)' : '진행'} 중에 있습니다.</>
                  )}
                  </span>
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
                  <span className="detail-label">성장 시작 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={170} height={14} radius={4} />
                    ) : startWeekInfo && startWeekInfo.year
                      ? startWeekInfo.isBreak
                        ? `${startWeekInfo.year}년, ${startWeekInfo.seasonName} 시즌, 전환 주차`
                        : `${startWeekInfo.year}년, ${startWeekInfo.seasonName} 시즌, ${startWeekInfo.weekNumber}주차`
                      : '-'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 가능 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={90} height={14} radius={4} />
                    ) : (
                      <><span className="number">{growthWeeks.available ?? '-'}</span> <span className="white-text">개 주차</span></>
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 성공 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={70} height={14} radius={4} />
                    ) : (
                      <><span className="number">{growthWeeks.approved ?? '-'}</span> <span className="white-text">개 주차</span></>
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 실패 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={70} height={14} radius={4} />
                    ) : (
                      <><span className="number">{growthWeeks.unapproved ?? '-'}</span> <span className="white-text">개 주차</span></>
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 휴식 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={70} height={14} radius={4} />
                    ) : (
                      <><span className="number">{growthWeeks.rest ?? '-'}</span>{(growthWeeks.restSeasons ?? 0) >= 1 && <span className="orange-highlight">({growthWeeks.restSeasons})</span>} <span className="white-text">개 주차</span></>
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 종료 주차</span>
                  <span className="detail-value">
                    {!summaryReady ? (
                      <Skeleton width={170} height={14} radius={4} />
                    ) : endWeekInfo && endWeekInfo.year
                      ? `${endWeekInfo.year}년, ${endWeekInfo.seasonName} 시즌${endWeekInfo.isBreak ? ', 전환 주차' : (endWeekInfo.weekNumber ? `, ${endWeekInfo.weekNumber}주차` : '')} (${getGrowthBadgeText(userStatus, growthStatus)})`
                      : `~ing (${getGrowthBadgeText(userStatus, growthStatus)})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 캐릭터 이미지 */}
          <div className="card-right">
            <img src="/images/0/cluster4/4-1/image.png" alt="Character" />
          </div>
        </div>
        )}
      </section>

      {/*/!* Section 2.5: 시즌별 카드 리스트 *!/*/}
      {/*<section className="cluster4-season-list">*/}
      {/*  <div className="season-list-header">*/}
      {/*    <h3 className="season-list-title">*/}
      {/*      <img src="/images/0/cluster4/icon/icon - book.png" alt="book" className="title-icon" />*/}
      {/*      SEASON HISTORY*/}
      {/*    </h3>*/}
      {/*    <span className="season-count">총 {seasonCards.length}개 시즌</span>*/}
      {/*  </div>*/}
      {/*  <div className="season-cards">*/}
      {/*    {isLoadingSeasons ? (*/}
      {/*      <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>시즌 데이터 로딩 중...</div>*/}
      {/*    ) : seasonCards.length === 0 ? (*/}
      {/*      <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>표시할 시즌이 없습니다.</div>*/}
      {/*    ) : seasonCards.map((season) => {*/}
      {/*      // 시즌 상태 텍스트*/}
      {/*      const getSeasonStatusText = (status: string) => {*/}
      {/*        switch (status) {*/}
      {/*          case 'in_progress': return '시즌 진행 중';*/}
      {/*          case 'completed': return '시즌 완료';*/}
      {/*          case 'resting': return '시즌 휴식';*/}
      {/*          default: return status;*/}
      {/*        }*/}
      {/*      };*/}
      {/*      // 시즌 상태 클래스*/}
      {/*      const getSeasonStatusClass = (status: string) => {*/}
      {/*        switch (status) {*/}
      {/*          case 'in_progress': return 'in-progress';*/}
      {/*          case 'completed': return 'completed';*/}
      {/*          case 'resting': return 'resting';*/}
      {/*          default: return '';*/}
      {/*        }*/}
      {/*      };*/}
      {/*      // 날짜 포맷 (2025-06-01 → 2025 - 06 - 01 (일))*/}
      {/*      const formatSeasonDate = (dateStr: string) => {*/}
      {/*        if (!dateStr) return '-';*/}
      {/*        const date = new Date(dateStr);*/}
      {/*        const days = ['일', '월', '화', '수', '목', '금', '토'];*/}
      {/*        const year = date.getFullYear();*/}
      {/*        const month = String(date.getMonth() + 1).padStart(2, '0');*/}
      {/*        const day = String(date.getDate()).padStart(2, '0');*/}
      {/*        const dayOfWeek = days[date.getDay()];*/}
      {/*        return `${year} - ${month} - ${day} (${dayOfWeek})`;*/}
      {/*      };*/}
      {/*      // 시즌 이미지 경로*/}
      {/*      const getSeasonImagePath = (seasonName: string) => {*/}
      {/*        const seasonImageMap: { [key: string]: string } = {*/}
      {/*          '봄': '/images/0/cluster4/시즌 이미지/봄_후보_1.png',*/}
      {/*          '여름': '/images/0/cluster4/시즌 이미지/여름_후보_3.png',*/}
      {/*          '가을': '/images/0/cluster4/시즌 이미지/가을_후보_1.png',*/}
      {/*          '겨울': '/images/0/cluster4/시즌 이미지/겨울_후보_1.png',*/}
      {/*        };*/}
      {/*        return seasonImageMap[seasonName] || '/images/0/cluster4/시즌 이미지/봄_후보_1.png';*/}
      {/*      };*/}

      {/*      return (*/}
      {/*        <div key={season.id} className="season-card-item">*/}
      {/*          /!* 시즌 이미지 *!/*/}
      {/*          <div className="season-card-image">*/}
      {/*            <img src={getSeasonImagePath(season.seasonName)} alt={`${season.year}년 ${season.seasonName} 시즌`} />*/}
      {/*            <div className="image-badges">*/}
      {/*              <div className={`badge-tag ${getSeasonStatusClass(season.progressStatus)}`}>*/}
      {/*                {getSeasonStatusText(season.progressStatus)}*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*          </div>*/}

      {/*          /!* 시즌 정보 *!/*/}
      {/*          <div className="season-card-content">*/}
      {/*            <div className="season-card-header">*/}
      {/*              <h4 className="season-card-title">{season.year}년도_{season.seasonName} 시즌</h4>*/}
      {/*            </div>*/}
      {/*            <div className="season-card-date">*/}
      {/*              <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />*/}
      {/*              {formatSeasonDate(season.startDate)} ~ {formatSeasonDate(season.endDate)}*/}
      {/*            </div>*/}
      {/*            <div className="season-card-stats">*/}
      {/*              <span className="stat-item">*/}
      {/*                <span className="stat-label">성공 주차</span>*/}
      {/*                <span className="stat-value">{season.approvedWeeks} / {season.totalWeeks}</span>*/}
      {/*              </span>*/}
      {/*              <span className="stat-divider">|</span>*/}
      {/*              <span className="stat-item">*/}
      {/*                <span className="stat-label">역할</span>*/}
      {/*                <span className="stat-value">{season.roleInSeason || '-'}</span>*/}
      {/*              </span>*/}
      {/*            </div>*/}
      {/*          </div>*/}
      {/*        </div>*/}
      {/*      );*/}
      {/*    })}*/}
      {/*  </div>*/}
      {/*</section>*/}

      {/* Section 3: 주차별 리스트 */}
      <section className="cluster4-weekly-list">
        {/* 필터 바 */}
        {isMobile ? (
          <div className="weekly-filter-bar weekly-filter-bar--mobile">
            <button
              type="button"
              className="filter-mobile-btn"
              onClick={() => {
                setDraftSeason(selectedSeason);
                setDraftResult(selectedResult);
                setFilterSheetOpen(true);
              }}
            >
              <img src="/images/0/cluster4/icon/icon - 3.png" alt="filter" className="card-icon" />
              <span className="filter-mobile-text">
                {selectedSeason} · {selectedResult}
              </span>
              <span className="filter-mobile-count">{filteredDbData.length}</span>
            </button>
          </div>
        ) : (
          <div className="weekly-filter-bar" id="weekly-filter-bar">
            {/* 254x40 Reset 카드 */}
            <div
              className="filter-card filter-card-large"
              onClick={() => {
                setSelectedSeason("역대 시즌");
                setSelectedResult("주차 결과");
                setSeasonDropdownOpen(false);
                setResultDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 1.png" alt="reset" className="filter-icon" />
                <span>Reset</span>
              </div>
            </div>
            {/* 역대 시즌 버튼 */}
            <div
              ref={seasonBtnRef}
              className="filter-card filter-dropdown"
              style={{
                borderColor: selectedSeason !== "역대 시즌" ? filterAccent : 'rgba(255, 255, 255, 0.12)',
                background: selectedSeason !== "역대 시즌" ? filterAccentBg : 'transparent',
                position: 'relative'
              }}
              onClick={() => {
                updateSeasonPos();
                setSeasonDropdownOpen(!seasonDropdownOpen);
                setResultDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 2.png" alt="calendar" className="card-icon" />
                <span className="card-label" style={{ color: selectedSeason !== "역대 시즌" ? filterAccent : '#fff' }}>{selectedSeason}</span>
              </div>
              <span className={`card-arrow ${seasonDropdownOpen ? 'open' : ''}`} style={{ color: selectedSeason !== "역대 시즌" ? filterAccent : '#fff' }}>▼</span>
              {seasonDropdownOpen && (
                <div
                  style={{
                    position: 'fixed',
                    top: seasonBtnPos.top,
                    left: seasonBtnPos.left,
                    width: '200px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    zIndex: 999999,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    animation: 'dropdownSlide 0.2s ease-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {seasonOptions.map((option, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px 16px',
                        color: selectedSeason === option ? filterAccent : '#fff',
                        background: selectedSeason === option ? filterAccentBgSelected : 'transparent',
                        cursor: 'pointer',
                        borderBottom: index < seasonOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                      onClick={() => {
                        setSelectedSeason(option);
                        setSeasonDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSeason !== option) {
                          e.currentTarget.style.background = filterAccentBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSeason !== option) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 주차 결과 버튼 */}
            <div
              ref={resultBtnRef}
              className="filter-card filter-dropdown"
              style={{
                borderColor: selectedResult !== "주차 결과" ? filterAccent : 'rgba(255, 255, 255, 0.12)',
                background: selectedResult !== "주차 결과" ? filterAccentBg : 'transparent',
                position: 'relative'
              }}
              onClick={() => {
                updateResultPos();
                setResultDropdownOpen(!resultDropdownOpen);
                setSeasonDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 3.png" alt="setting" className="card-icon" />
                <span className="card-label" style={{ color: selectedResult !== "주차 결과" ? filterAccent : '#fff' }}>{selectedResult}</span>
              </div>
              <span className={`card-arrow ${resultDropdownOpen ? 'open' : ''}`} style={{ color: selectedResult !== "주차 결과" ? filterAccent : '#fff' }}>▼</span>
              {resultDropdownOpen && (
                <div
                  style={{
                    position: 'fixed',
                    top: resultBtnPos.top,
                    left: resultBtnPos.left,
                    width: '200px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    zIndex: 999999,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    animation: 'dropdownSlide 0.2s ease-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {resultOptions.map((option, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px 16px',
                        color: selectedResult === option ? filterAccent : '#fff',
                        background: selectedResult === option ? filterAccentBgSelected : 'transparent',
                        cursor: 'pointer',
                        borderBottom: index < resultOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                      onClick={() => {
                        setSelectedResult(option);
                        setResultDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (selectedResult !== option) {
                          e.currentTarget.style.background = filterAccentBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedResult !== option) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="filter-card">
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 4.png" alt="search" className="card-icon" />
                <span className="card-label">검색 결과</span>
              </div>
              <span className="card-value">{filteredDbData.length}</span>
            </div>
            <div className="filter-card">
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 5.png" alt="clock" className="card-icon" />
                <span className="card-label">전체 주차 수</span>
              </div>
              <span className="card-value">{dbWeeklyData.length}</span>
            </div>
          </div>
        )}

        {/* 모바일: 필터 바텀시트 */}
        {isMobile && filterSheetOpen && (
          <div
            className="filter-sheet-overlay"
          >
            <div className="filter-sheet" onMouseDown={(e) => e.stopPropagation()}>
              <div className="filter-sheet-header">
                <div className="filter-sheet-title">필터</div>
                <button type="button" className="filter-sheet-close" onClick={() => setFilterSheetOpen(false)}>
                  닫기
                </button>
              </div>

              <div className="filter-sheet-body">
                <label className="filter-sheet-label">시즌</label>
                <select
                  className="filter-sheet-select"
                  value={draftSeason}
                  onChange={(e) => setDraftSeason(e.target.value)}
                >
                  <option value="역대 시즌">역대 시즌</option>
                  {seasonOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <label className="filter-sheet-label">주차 결과</label>
                <select
                  className="filter-sheet-select"
                  value={draftResult}
                  onChange={(e) => setDraftResult(e.target.value)}
                >
                  {resultOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="filter-sheet-actions">
                <button
                  type="button"
                  className="filter-sheet-btn secondary"
                  onClick={() => {
                    setDraftSeason("역대 시즌");
                    setDraftResult("주차 결과");
                  }}
                >
                  리셋
                </button>
                <button
                  type="button"
                  className="filter-sheet-btn primary"
                  onClick={() => {
                    setSelectedSeason(draftSeason);
                    setSelectedResult(draftResult);
                    setFilterSheetOpen(false);
                    setExpandedWeekId(null);
                    setMobileVisibleCount(10);
                  }}
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 주차 카드 리스트 */}
        <div className="weekly-cards">
          {isLoadingWeeks ? (
            // 로딩 중에는 0/더미 카드 대신 동일 레이아웃의 Skeleton 카드를 노출(CLS 방지).
            Array.from({ length: 5 }).map((_, i) => (
              <div className="weekly-card" key={`weekly-skeleton-${i}`} style={{ pointerEvents: 'none' }}>
                <div className="weekly-card-image">
                  <Skeleton width="100%" height="100%" radius={12} style={{ display: 'block', minHeight: 120 }} />
                </div>
                <div className="weekly-card-content">
                  <div className="weekly-card-header" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Skeleton width={180} height={18} radius={4} />
                    <Skeleton width={150} height={13} radius={4} />
                  </div>
                  <div className="weekly-card-info" style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <Skeleton width={120} height={13} radius={4} />
                    <Skeleton width={120} height={13} radius={4} />
                    <Skeleton width={90} height={13} radius={4} />
                  </div>
                  <div className="weekly-card-main-progress" style={{ marginTop: 12 }}>
                    <Skeleton width="100%" height={8} radius={6} style={{ display: 'block' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <Skeleton width={160} height={13} radius={4} />
                    <Skeleton width={160} height={13} radius={4} />
                    <Skeleton width={160} height={13} radius={4} />
                    <Skeleton width={160} height={13} radius={4} />
                  </div>
                </div>
                <div className="weekly-card-status-badge">
                  <Skeleton width={56} height={56} radius={10} />
                </div>
              </div>
            ))
          ) : (isNotLoggedIn || isPendingApproval) && !targetUserId ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>현재 해당 하는 시즌이 없습니다.</p>
            </div>
          ) : visibleCards.length === 0 && weeklyLoadError && dbWeeklyData.length === 0 ? (
            // 데이터가 한 번도 도착하지 못한 채 로드 실패(예: 첫 진입부터 504) — '없음'이 아니라 '오류'로 안내.
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>주차 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
            </div>
          ) : visibleCards.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>표시할 주차 카드가 없습니다.</p>
            </div>
          ) : (
            visibleCards.map((week) => {
              const weekHref = withPxRoute(`/cluster-4-card/${week.weekId}${userLinkQuery}`, pathname);
              const isExpanded = expandedWeekId === week.weekId;

              // ── 백엔드 DTO → 기존 프론트 카드 위치 값 매핑 (재계산 금지, 단순 주입) ──
              const parsedTitle = parseWeekTitle(week);
              const altTitle = cardTitle(week); // 이미지 alt 용 raw 제목
              const rawStatusLabel = week.statusLabel ?? '-';
              const toneClass = statusToneClass(week.statusTone);
              // 기존 프론트 className 체계: statusLabel 우선, 없으면 statusTone fallback.
              // (전환 주차는 filteredDbData 단계에서 이미 목록에서 제외됨 — 여기 도달하지 않음.)
              // 주차 카드 상태 배지 = weekly-cards DTO 의 실제 주차 상태(statusLabel/statusTone)를 그대로 사용.
              //   과거 확정 주차(성공/실패/휴식)는 절대 덮어쓰지 않는다 — success→성공, fail→실패,
              //   official_rest/personal_rest→휴식.
              // 예외 — "성장 중단" 배지는 성장 중단(suspended)이 적용된 주차 카드 1장에만 표시한다:
              //   growthInfo.endWeekInfo(= user_profiles.suspended_week_id 파생, 백엔드가 status==='suspended'
              //   일 때만 채움)와 (연도·시즌·주차)가 일치하는 카드에만 적용. endWeekInfo·card 모두 같은
              //   weeks 행에서 파생되므로 연도/시즌(한글)/season-relative weekNumber 가 그대로 일치한다.
              //   paused 는 endWeekInfo 가 비어 자연히 제외(상단/프로필 배지만 유지), graduated 는
              //   isStoppedUser=false 로 제외. 휴식(개인/공식) 주차는 별개 상태이므로 덮어쓰지 않는다.
              const baseBadgeToneClass = badgeClassFromLabel(rawStatusLabel, toneClass);
              const isStopWeekRestBadge =
                baseBadgeToneClass === 'rest-personal' ||
                baseBadgeToneClass === 'rest-official' ||
                toneClass === 'rest';
              const isStopWeekCard =
                isStoppedUser &&
                !isStopWeekRestBadge &&
                !!endWeekInfo &&
                parsedTitle.year === endWeekInfo.year &&
                parsedTitle.season === endWeekInfo.seasonName &&
                (endWeekInfo.isBreak
                  ? parsedTitle.isBreak
                  : week.weekNumber === endWeekInfo.weekNumber);
              const statusLabel = isStopWeekCard ? '성장 중단' : rawStatusLabel;
              const badgeToneClass = isStopWeekCard ? 'stopped' : baseBadgeToneClass;
              const isFail = badgeToneClass === 'fail';
              const isPersonalRest = badgeToneClass === 'rest-personal';
              const isOfficialRest = badgeToneClass === 'rest-official';
              const isRest = isPersonalRest || isOfficialRest || toneClass === 'rest';
              const isActiveCount = badgeToneClass === 'in-progress' || badgeToneClass === 'counting';

              const dividerColor = isFail
                ? '#ff6b6b'
                : isPersonalRest
                ? '#65e3ff'
                : isOfficialRest
                ? '#ffea48'
                : badgeToneClass === 'in-progress'
                ? '#9b59b6'
                : badgeToneClass === 'counting'
                ? '#ff1493'
                : statusDividerColor(badgeToneClass);

              // ── 백엔드 DTO 값을 그대로 주입. 프론트에서 재계산 금지. ──
              // 이 카드(week item)의 필드만 사용한다. 전역 selected card / 상세 weeklyCardMeta / dummy 금지.
              const linesByPart = adminCardLinesByPart(week);

              // 주차 성장률(상단 총 A개 중 B개 / %)은 아래 rateByPart(게이트 적용 후) 합산으로 계산한다.
              // (2026-07-01) 이전엔 week.growthRate{rate,count,total} DTO(백엔드 재집계값)를 그대로 읽었는데,
              //   그 DTO 는 competency empty-zero 게이트(realCompetencyLines 0 → 0)를 반영하지 않아
              //   "총 1개 중 0개"인데 하단 4허브(정보/경험/역량/경력)는 전부 0 → 상단≠Σ허브 불일치가 났다.
              //   상세 카드(Cluster4CardContent.growthStatsAdmin)와 동일하게, 화면에 실제 렌더되는 게이트된
              //   허브 rate 를 그대로 합산한다 → 상단 == Σ허브 가 구조적으로 보장. growthRate DTO 는 읽지 않는다.
              //   (growthTotal/growthCount/growthRate 정의는 rateByPart 아래로 이동 — 합산 입력을 먼저 확정.)

              // 4허브 강화율 — 신규 {info,experience,competency,career}Rate 객체 우선, 없으면 lines[] (part별 첫 라인) fallback.
              const hubRate = (
                partType: (typeof PART_LINE_ORDER)[number],
                cardRateObj: unknown,
              ): RateTriple => readRateObject(cardRateObj) ?? lineTriple(linesByPart.get(partType));
              // ── 실무 역량 empty-zero 정책 — 상세 카드(Cluster4CardContent competencyStatsAdmin)와 동일 기준 ──
              // 실제 개설된 역량 라인 = lineTargetId 보유. lineTargetId 없는 placeholder(미배정/folded pending,
              // na)는 '실제 라인'이 아니므로, 하나도 없으면 competencyRate/placeholder 라인을 무시하고 0/0 을 쓴다.
              // (구버그) 목록 카드는 이 게이트 없이 week.competencyRate 또는 placeholder 라인(denominator=1)을
              // 그대로 읽어 "0/1" 로 표시 → 상세 카드는 0/0 → 불일치. 상세 카드는 이미 realCompetencyLines
              // 게이트를 적용하므로, 목록도 동일 게이트를 적용해 양쪽 값을 일치시킨다.
              const realCompetencyLines = (week.lines || []).filter(
                (l) => normalizePartType(l.partType) === 'competency' && !!l.lineTargetId,
              );
              const competencyRate: RateTriple =
                realCompetencyLines.length === 0
                  ? { rate: 0, count: 0, total: 0 }
                  : hubRate('competency', week.competencyRate);
              const rateByPart: Record<(typeof PART_LINE_ORDER)[number], RateTriple> = {
                information: hubRate('information', week.infoRate),
                experience: hubRate('experience', week.experienceRate),
                competency: competencyRate,
                career: hubRate('career', week.careerRate),
              };
              // ── 상단 주차 성장률 = 위 rateByPart(게이트 적용 후) 합산 (상세 카드 growthStatsAdmin 동일 산식) ──
              //   온보딩 주차엔 경험/역량/경력 허브가 값 미포함("-")이므로 합산에서도 제외(info 만 포함).
              //   rest 주차는 상·하단 모두 표시 자체가 억제되므로 합산값과 무관.
              const gateExpCompCareer = week.isOnboarding === true;
              const growthTotal =
                rateByPart.information.total +
                (gateExpCompCareer ? 0 : rateByPart.experience.total) +
                (gateExpCompCareer ? 0 : rateByPart.competency.total) +
                (gateExpCompCareer ? 0 : rateByPart.career.total);
              const growthCount =
                rateByPart.information.count +
                (gateExpCompCareer ? 0 : rateByPart.experience.count) +
                (gateExpCompCareer ? 0 : rateByPart.competency.count) +
                (gateExpCompCareer ? 0 : rateByPart.career.count);
              // 라운딩은 상세 카드(Math.round)와 일치 — 목록·상세 % 동일값 보장.
              const growthRate = growthTotal > 0 ? Math.round((growthCount / growthTotal) * 100) : 0;
              const currentWeekValue = numberField(week, ["approvedWeeks", "currentCumulative", "cumulative", "accumulatedApprovedWeeks"]);
              // 전체 주차(분모): DTO totalWeeks/totalWeekCount → totalRequiredWeeks/baseWeekCount 우선,
              // 모두 없을 때만 org 정책값(marketing 25 / encre·phalanx 30)으로 폴백.
              // 상세 header(Cluster4CardContent)와 "동일 규칙" — 같은 weekId 분모가 양쪽에서 일치하도록.
              const totalWeeks = numberField(week, ["totalWeeks", "totalWeekCount", "totalRequiredWeeks", "baseWeekCount"], getGraduationWeeksFromPathname(pathname));

              // 팀명/파트명: card.teamName / card.partName (null → "-")
              const teamName = week.teamName && week.teamName.trim() ? week.teamName : "-";
              const partName = week.partName && week.partName.trim() ? week.partName : "-";

              // 활동 상태: roleLabel 우선, 없으면 membershipStatusLabel (null → "-")
              const membership =
                (week.roleLabel && week.roleLabel.trim()) ||
                (week.membershipStatusLabel && week.membershipStatusLabel.trim()) ||
                "-";

              // 포인트: card.points?.star / card.points?.lightning (null → 0)
              const pointsObj = week.points || {};
              const starCount =
                typeof pointsObj.star === 'number' && Number.isFinite(pointsObj.star) ? pointsObj.star : 0;
              const lightningCount =
                typeof pointsObj.lightning === 'number' && Number.isFinite(pointsObj.lightning)
                  ? pointsObj.lightning
                  : 0;

              // 인절미(방패): 별/번개와 동일하게 "해당 주차" 값 = points.shield (per-week, null → 0).
              //   누적(cumulativeInjeolmi)은 주차별 칸에 쓰지 않는다 — 한 카드 안에서 단감/인절미/어흥의
              //   기준(per-week)을 통일. 누적 방패는 별도 누적 영역(net=Σshield-Σlightning)에서만 표기.
              const shieldCount =
                typeof pointsObj.shield === 'number' && Number.isFinite(pointsObj.shield)
                  ? pointsObj.shield
                  : 0;

              // ── 주차별 단일 출처: 반드시 "이 week item" 의 필드만 사용 (다른 주차 값 혼입 금지) ──
              // 해당 주차 신규 배열 — FM rating 합계 fallback/진단 전용. 전역 배열 사용 금지.
              const weekReputations = Array.isArray(week.weeklyReputations) ? week.weeklyReputations : [];
              const weekColleagues = Array.isArray(week.weeklyColleagues) ? week.weeklyColleagues : [];

              // ── 주차 평판: reputationSummary.receivedCount/receivedLimit 단일 출처 (해당 weekId) ──
              // 요약 부재 시에만 기존 reputationCount → 해당 주차 weeklyReputations.length → 분모 4 fallback.
              const repSummary =
                week.reputationSummary && typeof week.reputationSummary === 'object'
                  ? week.reputationSummary
                  : null;
              const reputationCount =
                repSummary && typeof repSummary.receivedCount === 'number' && Number.isFinite(repSummary.receivedCount)
                  ? repSummary.receivedCount
                  : typeof week.reputationCount === 'number' && Number.isFinite(week.reputationCount)
                  ? week.reputationCount
                  : weekReputations.length;
              const reputationTotal =
                repSummary && typeof repSummary.receivedLimit === 'number' && Number.isFinite(repSummary.receivedLimit)
                  ? repSummary.receivedLimit
                  : typeof week.reputationTotal === 'number' && Number.isFinite(week.reputationTotal) && week.reputationTotal > 0
                  ? week.reputationTotal
                  : 4;

              // ── 명성도(FM): reputationSummary.fm 단일 출처 (해당 weekId) ──
              // 누적 포인트(fmScore/fameScore)·count·length 금지. 요약 부재 시에만 "해당 주차" rating 합계.
              const fame =
                repSummary && typeof repSummary.fm === 'number' && Number.isFinite(repSummary.fm)
                  ? repSummary.fm
                  : weekReputations.reduce((s, r) => s + (typeof r?.rating === 'number' ? r.rating : 0), 0);

              // ── 연계 동료: colleagueSummary.writtenCount/writtenLimit 단일 출처 (해당 weekId) ──
              // 요약 부재 시에만 기존 colleagueCount → 해당 주차 weeklyColleagues.length → 분모 3 fallback.
              const colSummary =
                week.colleagueSummary && typeof week.colleagueSummary === 'object'
                  ? week.colleagueSummary
                  : null;
              const colleagueCount =
                colSummary && typeof colSummary.writtenCount === 'number' && Number.isFinite(colSummary.writtenCount)
                  ? colSummary.writtenCount
                  : typeof week.colleagueCount === 'number' && Number.isFinite(week.colleagueCount)
                  ? week.colleagueCount
                  : weekColleagues.length;
              const colleagueTotal =
                colSummary && typeof colSummary.writtenLimit === 'number' && Number.isFinite(colSummary.writtenLimit)
                  ? colSummary.writtenLimit
                  : typeof week.colleagueTotal === 'number' && Number.isFinite(week.colleagueTotal) && week.colleagueTotal > 0
                  ? week.colleagueTotal
                  : 3;

              // 진단: 각 주차 카드가 자기 weekId 의 summary 만으로 계산되는지 확인 (다른 주차 혼입 검출용)
              console.log('[weekly-cards] 주차별 통계 진단', {
                weekId: week.weekId,
                weekNumber: week.weekNumber,
                reputationSummary: week.reputationSummary ?? null,
                colleagueSummary: week.colleagueSummary ?? null,
                weeklyReputationsLength: weekReputations.length,
                weeklyColleaguesLength: weekColleagues.length,
                renderedReputationCount: reputationCount,
                renderedFm: fame,
                renderedColleagueCount: colleagueCount,
              });

              const imagePaths = getWeekImagePath(week);

              // 활동 누적 주차: 진행 중 / 집계 중 phase 는 "+1", 그 외엔 누적값.
              const weekNumDisplay = isActiveCount ? '+1' : currentWeekValue;

              if (isMobile) {
                return (
                  <div
                    key={week.weekId}
                    className={`weekly-card weekly-card--mobile ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    <Link
                      href={weekHref}
                      className="weekly-card-main"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div className={`weekly-card-image ${isPersonalRest || isFail ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': dividerColor } as React.CSSProperties}>
                        <img src={imagePaths.primary} alt={altTitle} loading="lazy" decoding="async" data-stripped-src={imagePaths.stripped !== imagePaths.primary ? imagePaths.stripped : undefined} onError={handleWeekImageError} />
                        <div className="image-badges">
                          <div className={`badge-tag ${badgeToneClass}`}>{statusLabel}</div>
                        </div>
                      </div>

                      <div className="weekly-card-content">
                        <div className="weekly-card-header">
                          <h4 className="weekly-card-title">
                            {parsedTitle.year ?? '-'}년, <span className="season-name-fixed">{parsedTitle.season || '-'}</span> 시즌, <span className="week-name-fixed">{parsedTitle.weekText}</span>{parsedTitle.isBreak ? ' 주차' : '주차'}
                          </h4>
                          <span className="weekly-card-date">
                            <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                            {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                          </span>
                        </div>

                        <div className="weekly-card-main-progress">
                          <span className="progress-label">
                            <span className="dot">·</span> 주차 성장률 <strong>{growthRate}%</strong>
                          </span>
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${growthRate}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>

                    <button
                      type="button"
                      className="weekly-card-expand"
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedWeekId(isExpanded ? null : week.weekId);
                      }}
                    >
                      {isExpanded ? '접기' : '상세'}
                    </button>

                    {isExpanded && (
                      <div className="weekly-card-details">
                        <div className="weekly-card-details-top">
                          <div className="detail-chip"><strong>[팀]</strong> {teamName}</div>
                          <div className="detail-chip"><strong>[파트]</strong> {partName}</div>
                          <div className="detail-chip"><strong>[역할]</strong> {membership}</div>
                        </div>

                        <div className="weekly-card-details-grid">
                          {PART_LINE_ORDER.map((partType) => {
                            const { rate, count, total } = rateByPart[partType];
                            return (
                              <div className="detail-row" key={partType}>
                                <span className="k">{PART_LINE_LABEL[partType]} 강화율</span>
                                <span className="v">{rate}% <span className="sub">({count}/{total})</span></span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="weekly-card-details-bottom">
                          <div className="metric">{getOrgAliasFromPathname(pathname, "단감")?.label ?? "단감"} <strong>{starCount}</strong></div>
                          <div className="metric">{getOrgAliasFromPathname(pathname, "인절미")?.label ?? "인절미"} <strong>{shieldCount}</strong></div>
                          <div className="metric">{getOrgAliasFromPathname(pathname, "어흥")?.label ?? "어흥"} <strong>{lightningCount}</strong></div>
                          <div className="metric">주차 평판 <strong>{reputationCount}</strong><span className="sub">/{reputationTotal}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // 데스크탑: 기존 카드 UI 유지 (className/DOM/이미지·아이콘 배치 그대로)
              return (
                <Link href={weekHref} key={week.weekId} className="weekly-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {/* 왼쪽 이미지 */}
                  <div className={`weekly-card-image ${isPersonalRest || isFail ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': dividerColor } as React.CSSProperties}>
                    <img src={imagePaths.primary} alt={altTitle} loading="lazy" decoding="async" data-stripped-src={imagePaths.stripped !== imagePaths.primary ? imagePaths.stripped : undefined} onError={handleWeekImageError} />
                    {isPersonalRest && (
                      <div className="rest-message">
                        <span className="rest-text-line">충분히 <span className="rest-emoji">🥰</span></span>
                        <span className="rest-text-line">쉬었나요..?</span>
                      </div>
                    )}
                    {isFail && (
                      <div className="rest-message">
                        <span className="rest-text-line">값진 실패는 <span className="rest-emoji">😎</span></span>
                        <span className="rest-text-line">훌륭한 스승님!</span>
                      </div>
                    )}
                    <div className="image-badges">
                      <div className={`badge-tag ${badgeToneClass}`}>{statusLabel}</div>
                      <div className="badge-like">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 중앙 콘텐츠 */}
                  <div className="weekly-card-content">
                    {/* 첫 번째 줄: 타이틀, 날짜, 활동 누적 주차 */}
                    <div className="weekly-card-header">
                      <h4 className="weekly-card-title">
                        {parsedTitle.year ?? '-'}년, <span className="season-name-fixed">{parsedTitle.season || '-'}</span> 시즌, <span className="week-name-fixed">{parsedTitle.weekText}</span>{parsedTitle.isBreak ? ' 주차' : '주차'}
                      </h4>
                      <span className="weekly-card-date">
                        <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                        {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                      </span>
                      <span className="weekly-card-week">
                        <img src="/images/0/cluster4/icon/icon - 7.png" alt="clock" className="week-icon" />
                        <span className="week-number num-2">{weekNumDisplay}</span> / <span className="num-2">{totalWeeks}</span> 주차
                      </span>
                    </div>

                    {/* 두 번째 줄: 팀, 파트, 역할(소속/상태), 아이템 */}
                    <div className="weekly-card-info">
                      <div className="info-group">
                        <span className="info-item team">
                          <strong>[팀]</strong>{' '}
                          <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{teamName.length > 6 ? teamName.slice(0, 6) + '..' : teamName}</span>
                        </span>
                        <span className="info-divider">|</span>
                        <span className="info-item part">
                          <strong>[파트]</strong>{' '}
                          <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{partName.length > 6 ? partName.slice(0, 6) + '..' : partName}</span>
                        </span>
                      </div>
                      <div className="info-group">
                        <span className="info-badge role">
                          <img src="/images/0/cluster4/icon/icon - 8.png" alt="role" className="role-icon" />
                          <span style={{ display: 'inline-block', maxWidth: '109px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Pretendard', sans-serif" }}>{truncate(membership, 8)}</span>
                        </span>
                      </div>
                      {(() => {
                        const renderItem = (name: "단감" | "인절미" | "어흥", value: number, defaultSrc: string) => {
                          const mapped = getOrgAliasFromPathname(pathname, name);
                          const label = mapped?.label ?? name;
                          return (
                            <span className="info-item with-icon" key={name}>
                              {label}
                              {mapped ? (
                                <span className={`item-icon badge-icon ${mapped.iconClass}`} aria-hidden="true" />
                              ) : (
                                <img src={defaultSrc} alt={name} className="item-icon" />
                              )}
                              <strong className="number-value num-3">{value}</strong>
                              개
                            </span>
                          );
                        };
                        return (
                          <div className="info-group items">
                            <span className="info-divider">·</span>
                            {renderItem("단감", starCount, "/images/0/cluster4/icon/icon - 단감.png")}
                            <span className="info-divider">·</span>
                            {renderItem("인절미", shieldCount, "/images/0/cluster4/icon/icon - 인절미.png")}
                            <span className="info-divider">·</span>
                            {renderItem("어흥", lightningCount, "/images/0/cluster4/icon/icon - 어흥.png")}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 세 번째 줄: 주차 성장률 + 총 N개 중 N개 */}
                    <div className="weekly-card-main-progress">
                      <span className="progress-label"><span className="dot">·</span> 주차 성장률 <strong><span className="num-3">{growthRate}</span>%</strong></span>
                      <div className="progress-bar-wrapper">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${growthRate}%` }}></div>
                        </div>
                      </div>
                      <span className="total-count">
                        <img src="/images/0/cluster4/icon/icon - 0.png" alt="leaf" className="leaf-icon" />
                        총 <span className="num-3">{growthTotal}</span> 개 중 <strong><span className="num-3">{growthCount}</span></strong> 개
                      </span>
                    </div>

                    {/* 네 번째/다섯 번째 줄: 실무 정보/역량/경험/경력 강화율 + 주차 평판/명성도(FM)/연계 동료 */}
                    <div className={`weekly-card-stats-wrapper ${badgeToneClass}`}>
                      <div className="weekly-card-stats">
                        {WEEKLY_STATS_LINE_ORDER.map((partType) => {
                          const { rate, count, total } = rateByPart[partType];
                          return (
                            <span className="stat" key={partType}>
                              <span className="dot">·</span> 실무 <span className={`highlight ${partType} ${badgeToneClass}`}>{PART_LINE_LABEL[partType]}</span> 강화율 <strong><span className="num-3">{rate}</span>%</strong> <span className="gray">(<span className="num num-2">{count}</span>/<span className="num-2">{total}</span>)</span>
                            </span>
                          );
                        })}
                      </div>
                      <div className="weekly-card-extra-stats">
                        <span className="stat"><span className="dot">·</span> <span className="label">주차 평판</span> <span className="num num-1">{isRest ? '-' : reputationCount}</span><span className="white">/<span className="num-1">{reputationTotal}</span></span></span>
                        <span className="stat"><span className="dot">·</span> <span className="label">명성도(FM)</span> <span className="num num-4">{isRest ? '-' : fame}</span></span>
                        <span className="stat"><span className="dot">·</span> <span className="label">연계 동료</span> <span className="num num-1">{isRest ? '-' : colleagueCount}</span><span className="white">/<span className="num-1">{colleagueTotal}</span></span></span>
                        <span className="stat empty"></span>
                      </div>
                    </div>
                  </div>

                  {/* 우측 성장 상태 배지 */}
                  <div className={`weekly-card-status-badge ${badgeToneClass}`}>
                    <span className="status-text">{statusLabel}</span>
                    <img src={statusIconPath(statusLabel, toneClass)} alt={statusLabel} className="trophy-icon" />
                  </div>

                  {/* 더보기 버튼 */}
                  <div className="weekly-card-more-btn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="2" fill="none" />
                      <path d="M7 5.5L10 8L7 10.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* 페이지네이션 */}
        {isMobile ? (
          <div className="weekly-pagination weekly-pagination--mobile">
            <div className="weekly-pagination-summary">
              전체 {filteredDbData.length}개 중 {Math.min(mobileVisibleCount, filteredDbData.length)}개 표시
            </div>
            {filteredDbData.length > mobileVisibleCount && (
              <button
                type="button"
                className="weekly-load-more-btn"
                onClick={() => setMobileVisibleCount((c) => c + 10)}
              >
                더 보기
              </button>
            )}
          </div>
        ) : (
          <div className="weekly-pagination">
            {totalPages > 0 ? (
              Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <span
                  key={num}
                  className={`page-num ${currentPage === num ? 'active' : ''} ${num === totalPages ? 'last' : ''}`}
                  onClick={() => setCurrentPage(num)}
                >
                  {num}
                </span>
              ))
            ) : (
              <span className="no-results">검색 결과가 없습니다</span>
            )}
          </div>
        )}
      </section>
    </div>
    </>
  );
};

export default Cluster41Content;

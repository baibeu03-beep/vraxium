"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";

import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { getOrgAliasFromPathname } from "@/utils/orgLabelAlias";
import { isPxRoute, isEcRoute, withPxRoute } from "@/lib/cluster-route";
import type { AdminCluster4WeeklyCardDto, Cluster4WeeklyCardsResponseDto, Cluster4WeeklyLineDto } from "@/shared/cluster4.contracts";

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

  const isBreak = rec.isBreakSeason === true || rec.isRestSeason === true || /전환|break/i.test(label);

  let weekText: string;
  if (isBreak) {
    weekText = "전환";
  } else if (typeof card.weekNumber === "number" && card.weekNumber > 0) {
    weekText = String(card.weekNumber);
  } else {
    const m = label.match(/(\d+)\s*(?:w|주차)/i);
    weekText = m ? m[1] : "-";
  }

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
  if (className.includes("fail")) return "#ff6b6b";
  if (className.includes("rest")) return "#65e3ff";
  if (className.includes("in-progress")) return "#9b59b6";
  if (className.includes("counting")) return "#ff1493";
  return "#9dfa07";
};

const statusIconPath = (statusLabel: string, className: string): string => {
  if (className === "in-progress") return "/images/0/cluster4/icon/icon%20-%20성장%20%28진행%20중%29.png";
  if (className === "counting") return "/images/0/cluster4/icon/icon%20-%20성장%20%28집계%20중%29.png";
  const normalized = statusLabel.replace(/\s+\(/g, "(");
  return `/images/0/cluster4/icon/icon%20-%20${encodeURIComponent(normalized)}.png`;
};

const PART_LINE_ORDER = ["information", "competency", "experience", "career"] as const;
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

// statusLabel 텍스트 기반으로 기존 프론트 className 매핑.
// 백엔드 statusTone 만으로는 personal/official rest 가 분리되지 않으므로
// label 텍스트를 우선 검사하고, 그래도 분류 안 되면 statusTone fallback.
const badgeClassFromLabel = (label: string, fallback: string): string => {
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
  const targetUserId = searchParams.get('userId') || searchParams.get('userID');
  const isDemoMode = checkDemoMode();

  const [dbWeeklyData, setDbWeeklyData] = useState<AdminCluster4WeeklyCardDto[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const isPX = isPxRoute(pathname);
  const isEC = isEcRoute(pathname);
  const filterAccent = isPX ? "#1E9503" : isEC ? "#FF4B70" : "#FFA500";
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
    holidayName: string | null;
    isBreakSeason: boolean;
    fromSeason: string | null;
    toSeason: string | null;
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

  const [joinedWeekStartDate, setJoinedWeekStartDate] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setIsLoadingWeeks(true);

        const profileUrl = targetUserId ? `/api/profile?userId=${targetUserId}` : '/api/profile';
        const profileRes = await fetch(profileUrl, { signal: abortController.signal });
        const profileResult = await profileRes.json();

        if (!profileRes.ok || !profileResult.data?.id) {
          if (!targetUserId) {
            if (profileRes.status === 401) setIsNotLoggedIn(true);
            else if (profileRes.status === 404) setIsPendingApproval(true);
          }
          setDbWeeklyData([]);
          setIsLoadingWeeks(false);
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

        const weeklyRes = await fetch(`/api/cluster4/weekly-cards?userId=${userId}`, { signal: abortController.signal });
        const weeklyResult = await weeklyRes.json() as Cluster4WeeklyCardsResponseDto;
        console.log('[weekly-cards] raw json', weeklyResult);
        console.log('[weekly-cards] json.data length', Array.isArray(weeklyResult.data) ? weeklyResult.data.length : 'not array');

        if (abortController.signal.aborted) return;

        if (!weeklyRes.ok) {
          console.error("주차 데이터 로드 오류:", {
            status: weeklyRes.status,
            error: weeklyResult?.error,
            message: weeklyResult?.detail || weeklyResult?.message || weeklyResult?.error,
          });
          setDbWeeklyData([]);
        } else {
          const cards = Array.isArray(weeklyResult.data) ? weeklyResult.data : [];
          console.log('[weekly-cards] state cards length', cards.length);
          if (cards.length > 0) {
            // DTO 원본 1장 — 위치별 매핑 검증용
            console.log('[weekly-cards] sample card (raw DTO)', cards[0]);
            console.log('[weekly-cards] sample card lines', cards[0]?.lines);
            // W12 raw DTO 출력 — 매핑 검증용
            const w12 = cards.find((c) => c.weekNumber === 12);
            if (w12) {
              console.log('[weekly-cards] W12 raw DTO', w12);
              console.log('[weekly-cards] W12 lines', w12.lines);
            } else {
              console.log('[weekly-cards] W12 not found in response');
            }
          }
          setDbWeeklyData(cards);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error("주차 데이터 로드 오류:", err);
      } finally {
        if (!abortController.signal.aborted) setIsLoadingWeeks(false);
      }
    };

    fetchData();

    return () => { abortController.abort(); };
  }, [targetUserId]);

  const getGrowthBadgeText = (status: string | null, growthStatus: string | null): string => {
    if (
      status === 'graduated' ||
      growthStatus === '졸업 완료' ||
      growthStatus === '졸업 절차 중'
    ) {
      return '성장 완료';
    }
    if (
      status === 'suspended' ||
      growthStatus === '활동 중단' ||
      growthStatus === '활동 유보'
    ) {
      return '성장 중단';
    }
    if (
      status === 'weekly_rest' ||
      status === 'seasonal_rest' ||
      growthStatus === '주차 휴식 중' ||
      growthStatus === '시즌 휴식 중' ||
      growthStatus === '공식 휴식 중'
    ) {
      return '성장 휴식';
    }
    return '성장 진행 중';
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

  const filteredDbData = dbWeeklyData.filter((week) => {
    const seasonMatch =
      selectedSeason === "역대 시즌" || seasonOfLabel(week.weekLabel) === selectedSeason;
    const resultMatch =
      selectedResult === "주차 결과" ||
      selectedResult === "전체 (all)" ||
      week.statusLabel === selectedResult;
    return seasonMatch && resultMatch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDbData.length / itemsPerPage));
  const paginatedDbData = filteredDbData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const visibleCards: AdminCluster4WeeklyCardDto[] = isMobile
    ? filteredDbData.slice(0, mobileVisibleCount)
    : paginatedDbData;

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

    <div className="cluster4-content cluster4-content--week">
      {/* Section 1: CLUB CHALLENGE GROWTH */}
      <section className="cluster4-section1" ref={headerRef}>
        {/* 좌측 상단 탭 (세로 정렬) */}
        <div className="top-tabs">
          <div className="tab" style={{ width: '44px', height: '44px', background: isPX ? '#1E9503' : isEC ? '#FF4B70' : '#FAAB07' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20%EC%A0%84%EA%B5%AC.png" alt="전구" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(withPxRoute(`/cluster-4${targetUserId ? `?userId=${targetUserId}` : ''}`, pathname))}>
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </div>
          <div className="tab" style={{ width: '44px', height: '44px', background: '#161816' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20book.png" alt="book" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(withPxRoute(`/cluster-4-1${targetUserId ? `?userId=${targetUserId}` : ''}`, pathname))}>
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
                <span className="badge-text">{getGrowthBadgeText(userStatus, growthStatus)}</span>
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
                  {currentSeasonInfo?.isBreakSeason ? (
                    <>현재 클럽은, <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.fromSeason} 시즌</strong>에서 <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.toSeason} 시즌</strong>으로 가는 휴식(시즌 전환) 중에 있습니다.</>
                  ) : (
                    <>현재 클럽은, <strong>{currentSeasonInfo ? `${currentSeasonInfo.year}년 ${currentSeasonInfo.name} 시즌, ${currentSeasonInfo.currentWeek}주차` : '로딩 중...'}</strong>를 {currentSeasonInfo?.isClubBreak ? `휴식 (${currentSeasonInfo.holidayName || '공식'})` : '진행'} 중에 있습니다.</>
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
                  <span className="detail-label">성장 시작 주차</span>
                  <span className="detail-value">
                    {startWeekInfo && startWeekInfo.year
                      ? startWeekInfo.isBreak
                        ? `${startWeekInfo.year}년, ${startWeekInfo.seasonName} 시즌, 전환 주차`
                        : `${startWeekInfo.year}년, ${startWeekInfo.seasonName} 시즌, ${startWeekInfo.weekNumber}주차`
                      : '-'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 가능 주차</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.availableWeeks ?? '-'}</span><span className="orange-highlight">({growthPeriodStats?.availableSeasons ?? '-'})</span> <span className="white-text">개 주차</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 성공 주차</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.approvedWeeks ?? '-'}</span> <span className="white-text">개 주차</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 실패 주차</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.unapprovedWeeks ?? '-'}</span> <span className="white-text">개 주차</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 휴식 주차</span>
                  <span className="detail-value">
                    <span className="number">{growthPeriodStats?.restWeeks ?? '-'}</span> <span className="white-text">개 주차</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">성장 종료 주차</span>
                  <span className="detail-value">
                    {endWeekInfo && endWeekInfo.year
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
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>주차 데이터 로딩 중...</div>
          ) : (isNotLoggedIn || isPendingApproval) && !targetUserId ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>현재 해당 하는 시즌이 없습니다.</p>
            </div>
          ) : visibleCards.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>표시할 주차 카드가 없습니다.</p>
            </div>
          ) : (
            visibleCards.map((week) => {
              const weekHref = withPxRoute(`/cluster-4-card/${week.weekId}${targetUserId ? `?userId=${targetUserId}` : ''}`, pathname);
              const isExpanded = expandedWeekId === week.weekId;

              // ── 백엔드 DTO → 기존 프론트 카드 위치 값 매핑 (재계산 금지, 단순 주입) ──
              const parsedTitle = parseWeekTitle(week);
              const altTitle = cardTitle(week); // 이미지 alt 용 raw 제목
              const statusLabel = week.statusLabel ?? '-';
              const toneClass = statusToneClass(week.statusTone);
              // 기존 프론트 className 체계: statusLabel 우선, 없으면 statusTone fallback.
              const badgeToneClass = badgeClassFromLabel(statusLabel, toneClass);
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
              const growthRate = typeof week.weeklyGrowthRate === 'number' ? week.weeklyGrowthRate : 0;
              const linesByPart = adminCardLinesByPart(week);
              const growthNumeratorRaw =
                typeof week.growthNumerator === 'number' && Number.isFinite(week.growthNumerator)
                  ? week.growthNumerator
                  : 0;
              const growthDenominatorRaw =
                typeof week.growthDenominator === 'number' && Number.isFinite(week.growthDenominator)
                  ? week.growthDenominator
                  : 0;
              const currentWeekValue = numberField(week, ["approvedWeeks", "currentCumulative", "cumulative", "accumulatedApprovedWeeks"]);
              const totalWeeks = numberField(week, ["totalWeeks", "totalWeekCount"], 25);

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

              // 인절미: cumulativeInjeolmi 우선, 없으면 points?.shield (null → 0)
              const cumulativeInjeolmi =
                typeof week.cumulativeInjeolmi === 'number' && Number.isFinite(week.cumulativeInjeolmi)
                  ? week.cumulativeInjeolmi
                  : typeof pointsObj.shield === 'number' && Number.isFinite(pointsObj.shield)
                  ? pointsObj.shield
                  : 0;

              // 주차 평판: reputationCount / reputationTotal (null → 0)
              const reputationCount =
                typeof week.reputationCount === 'number' && Number.isFinite(week.reputationCount)
                  ? week.reputationCount
                  : 0;
              const reputationTotal =
                typeof week.reputationTotal === 'number' && Number.isFinite(week.reputationTotal)
                  ? week.reputationTotal
                  : 0;

              // 명성도(FM): fmScore 우선, 없으면 fameScore (null → 0)
              const fame =
                typeof week.fmScore === 'number' && Number.isFinite(week.fmScore)
                  ? week.fmScore
                  : typeof week.fameScore === 'number' && Number.isFinite(week.fameScore)
                  ? week.fameScore
                  : 0;

              // 연계 동료: colleagueCount / colleagueTotal (null → 0)
              const colleagueCount =
                typeof week.colleagueCount === 'number' && Number.isFinite(week.colleagueCount)
                  ? week.colleagueCount
                  : 0;
              const colleagueTotal =
                typeof week.colleagueTotal === 'number' && Number.isFinite(week.colleagueTotal)
                  ? week.colleagueTotal
                  : 0;

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
                        <img src={imagePaths.primary} alt={altTitle} data-stripped-src={imagePaths.stripped !== imagePaths.primary ? imagePaths.stripped : undefined} onError={handleWeekImageError} />
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
                            const line = linesByPart.get(partType);
                            const numerator = lineNumerator(line);
                            const denominator = lineDenominator(line);
                            return (
                              <div className="detail-row" key={partType}>
                                <span className="k">{PART_LINE_LABEL[partType]} 강화율</span>
                                <span className="v">{lineRate(line)}% <span className="sub">({numerator}/{denominator})</span></span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="weekly-card-details-bottom">
                          <div className="metric">{getOrgAliasFromPathname(pathname, "단감")?.label ?? "단감"} <strong>{starCount}</strong></div>
                          <div className="metric">{getOrgAliasFromPathname(pathname, "인절미")?.label ?? "인절미"} <strong>{cumulativeInjeolmi}</strong></div>
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
                    <img src={imagePaths.primary} alt={altTitle} data-stripped-src={imagePaths.stripped !== imagePaths.primary ? imagePaths.stripped : undefined} onError={handleWeekImageError} />
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
                            {renderItem("인절미", cumulativeInjeolmi, "/images/0/cluster4/icon/icon - 인절미.png")}
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
                        총 <span className="num-3">{growthNumeratorRaw}</span> 개 중 <strong><span className="num-3">{growthDenominatorRaw}</span></strong> 개
                      </span>
                    </div>

                    {/* 네 번째/다섯 번째 줄: 실무 정보/역량/경험/경력 강화율 + 주차 평판/명성도(FM)/연계 동료 */}
                    <div className={`weekly-card-stats-wrapper ${badgeToneClass}`}>
                      <div className="weekly-card-stats">
                        {PART_LINE_ORDER.map((partType) => {
                          const line = linesByPart.get(partType);
                          const numerator = lineNumerator(line);
                          const denominator = lineDenominator(line);
                          return (
                            <span className="stat" key={partType}>
                              <span className="dot">·</span> 실무 <span className={`highlight ${partType} ${badgeToneClass}`}>{PART_LINE_LABEL[partType]}</span> 강화율 <strong><span className="num-3">{lineRate(line)}</span>%</strong> <span className="gray">(<span className="num num-2">{numerator}</span>/<span className="num-2">{denominator}</span>)</span>
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

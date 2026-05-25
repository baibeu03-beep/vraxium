"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";

import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { getOrgAliasFromPathname } from "@/utils/orgLabelAlias";
import { DUMMY_WEEKLY_LIST, DUMMY_WEEK_EXTRA } from "@/constants/dummyData";
import { isPxRoute, isEcRoute, withPxRoute } from "@/lib/cluster-route";
import type { WeeklyCardDto } from "@/lib/cluster4-weekly-cards";
import { GROWTH_STATUS_LABEL, type GrowthStatusKey } from "@/lib/cluster4-types";

const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
  const t = text || "-";
  return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
};

function dummyToWeeklyCard(w: typeof DUMMY_WEEKLY_LIST[number]): WeeklyCardDto {
  const extra = DUMMY_WEEK_EXTRA[w.id];
  const statusLabel = GROWTH_STATUS_LABEL[w.growthStatus as GrowthStatusKey] ?? w.growthStatus;
  return {
    weekId: w.id,
    weekNumber: w.weekNumber,
    seasonYear: w.seasonYear,
    seasonName: w.seasonName,
    seasonLabel: `${w.seasonYear}년도 ${w.seasonName}시즌`,
    startDate: w.startDate,
    endDate: w.endDate,
    isBreakSeason: w.isBreakSeason,
    isClubBreak: w.isOfficialRest || w.isBreakSeason,
    fromSeason: w.fromSeason,
    toSeason: w.toSeason,
    holidayName: w.holidayName,
    isOnboarding: false,
    resultStatus: statusLabel,
    teamName: extra?.teamPart?.teamName || null,
    partName: extra?.teamPart?.partName || null,
    roleLabel: extra?.roleLabel || null,
    points: extra?.points || { star: 0, shield: 0, lightning: 0 },
    cumulativeInjeolmi: 30,
    growthRate: extra?.growthRate || { rate: 0, count: 0, total: 0 },
    infoRate: extra?.infoRate || { rate: 0, count: 0, total: 0 },
    competencyRate: extra?.competencyRate || { rate: 0, count: 0, total: 0 },
    experienceRate: extra?.experienceRate || { rate: 0, count: 0, total: 0 },
    careerRate: extra?.careerRate || { rate: 0, count: 0, total: 0 },
    reputationCount: extra?.reputationCount || 0,
    fmScore: extra?.fmScore || 0,
    colleagueCount: extra?.colleagueCount || 0,
    accumulatedApprovedWeeks: 0,
  };
}

const Cluster41Content = () => {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get('userId') || searchParams.get('userID');
  const isDemoMode = checkDemoMode();

  const [demoUserName, setDemoUserName] = useState<string | null>(null);

  const [dbWeeklyData, setDbWeeklyData] = useState<WeeklyCardDto[]>(() => {
    if (!isDemoMode) return [];
    return DUMMY_WEEKLY_LIST.map(dummyToWeeklyCard);
  });

  useEffect(() => {
    if (!isDemoMode || !targetUserId) return;
    const fetchName = async () => {
      try {
        const res = await fetch(`/api/profile/?userId=${targetUserId}`);
        if (res.ok) {
          const json = await res.json();
          const name = json.data?.display_name || null;
          setDemoUserName(name);
          const demoStatusMap: Record<string, { us: string | null; gs: string | null }> = {
            '전민경': { us: 'graduated', gs: '졸업 완료' },
            '곽예원': { us: 'weekly_rest', gs: '주차 휴식 중' },
            '김의환': { us: 'suspended', gs: '활동 중단' },
          };
          if (name && demoStatusMap[name]) {
            setUserStatus(demoStatusMap[name].us);
            setGrowthStatus(demoStatusMap[name].gs);
          }
          const demoWeekOverrides: Record<string, typeof DUMMY_WEEK_EXTRA[string]> = {
            '윤재윤': {
              points: { star: 150, shield: 37, lightning: 30 },
              teamPart: { teamName: '마케팅', partName: '전략파트' }, roleLabel: '일반',
              growthRate: { rate: 75, count: 16, total: 24 },
              infoRate: { rate: 100, count: 10, total: 10 },
              competencyRate: { rate: 0, count: 0, total: 1 },
              experienceRate: { rate: 60, count: 3, total: 5 },
              careerRate: { rate: 0, count: 0, total: 20 },
              reputationCount: 2, fmScore: 85, colleagueCount: 1,
            },
            '전민경': {
              points: { star: 3, shield: 933, lightning: 45 },
              teamPart: { teamName: '사업개발전략기획', partName: '제휴협력사업파트' }, roleLabel: '팀장(사업개발전략)',
              growthRate: { rate: 100, count: 800, total: 999 },
              infoRate: { rate: 50, count: 5, total: 10 },
              competencyRate: { rate: 100, count: 99, total: 99 },
              experienceRate: { rate: 0, count: 0, total: 12 },
              careerRate: { rate: 80, count: 4, total: 5 },
              reputationCount: 3, fmScore: 9999, colleagueCount: 3,
            },
            '곽예원': {
              points: { star: 50, shield: 999, lightning: 999 },
              teamPart: { teamName: '브랜드커뮤니케이션', partName: '디지털마케팅전략파' }, roleLabel: '운영진(앰배서더)',
              growthRate: { rate: 1, count: 1, total: 8 },
              infoRate: { rate: 0, count: 0, total: 25 },
              competencyRate: { rate: 50, count: 2, total: 4 },
              experienceRate: { rate: 100, count: 15, total: 15 },
              careerRate: { rate: 0, count: 0, total: 1 },
              reputationCount: 0, fmScore: 0, colleagueCount: 0,
            },
            '김의환': {
              points: { star: 88, shield: 200, lightning: 0 },
              teamPart: { teamName: '글로벌크로스보더커머스', partName: '퍼포먼스마케팅최적화' }, roleLabel: '심화(에이전트파트장)',
              growthRate: { rate: 0, count: 0, total: 18 },
              infoRate: { rate: 70, count: 7, total: 10 },
              competencyRate: { rate: 0, count: 0, total: 2 },
              experienceRate: { rate: 25, count: 1, total: 4 },
              careerRate: { rate: 100, count: 10, total: 10 },
              reputationCount: 0, fmScore: 1500, colleagueCount: 0,
            },
          };
          if (name && demoWeekOverrides[name]) {
            DUMMY_WEEK_EXTRA['dw-01'] = demoWeekOverrides[name];
            setDbWeeklyData(prev => prev.map(card => {
              if (card.weekId !== 'dw-01') return card;
              const ovr = demoWeekOverrides[name];
              return {
                ...card,
                teamName: ovr.teamPart.teamName,
                partName: ovr.teamPart.partName,
                roleLabel: ovr.roleLabel,
                points: ovr.points,
                growthRate: ovr.growthRate,
                infoRate: ovr.infoRate,
                competencyRate: ovr.competencyRate,
                experienceRate: ovr.experienceRate,
                careerRate: ovr.careerRate,
                reputationCount: ovr.reputationCount,
                fmScore: ovr.fmScore,
                colleagueCount: ovr.colleagueCount,
              };
            }));
          }
        }
      } catch {
        // API 실패 시 기존 더미 문구로 fallback
      }
    };
    fetchName();
  }, [isDemoMode, targetUserId]);

  const demoCollectionMessage = isDemoMode && demoUserName ? ({
    '윤재윤': <>현재 클럽은, <strong>26년 봄 시즌, 1주차</strong>를 진행 중에 있습니다.</>,
    '전민경': <>현재 클럽은, <strong>26년 가을 시즌, 16주차</strong>를 진행 중에 있습니다.</>,
    '곽예원': <>현재 클럽은, <strong>26년 겨울 시즌, 99주차</strong>를 진행 중에 있습니다.</>,
    '김의환': <>현재 클럽은, <strong>26년 여름 시즌, 전환 주차</strong>를 진행 중에 있습니다.</>,
  } as Record<string, React.ReactNode>)[demoUserName] || null : null;

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
  } | null>(isDemoMode ? {
    year: 26, name: '봄', currentWeek: 1,
    isClubBreak: false, holidayName: null,
    isBreakSeason: false, fromSeason: null, toSeason: null
  } : null);

  interface GrowthPeriodStats {
    approvedWeeks: number;
    unapprovedWeeks: number;
    restWeeks: number;
    clubBreakWeeks: number;
    availableWeeks: number;
    availableSeasons: number;
    restSeasons: number;
  }
  const [growthPeriodStats, setGrowthPeriodStats] = useState<GrowthPeriodStats | null>({
    approvedWeeks: 12,
    unapprovedWeeks: 1,
    restWeeks: 1,
    clubBreakWeeks: 0,
    availableWeeks: 15,
    availableSeasons: 1,
    restSeasons: 0
  });

  interface WeekInfo {
    year: number | null;
    seasonName: string | null;
    weekNumber: number | null;
    isBreak?: boolean;
  }
  const [startWeekInfo, setStartWeekInfo] = useState<WeekInfo | null>({
    year: 2024, seasonName: '가을', weekNumber: 14
  });
  const [endWeekInfo, setEndWeekInfo] = useState<WeekInfo | null>({
    year: 2024, seasonName: '가을', weekNumber: 14
  });
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
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(!isDemoMode);

  const [isLoadingWeeks, setIsLoadingWeeks] = useState(!isDemoMode);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);

  const [joinedWeekStartDate, setJoinedWeekStartDate] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) return;

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

        const weeklyRes = await fetch(`/api/cluster4/weekly-growth?userId=${userId}`, { signal: abortController.signal });
        const weeklyResult = await weeklyRes.json();

        if (abortController.signal.aborted) return;

        if (!weeklyRes.ok) {
          console.error("[weekly-cards] API 실패:", weeklyRes.status, weeklyResult?.error, weeklyResult?.detail);
        } else {
          setDbWeeklyData(weeklyResult.weeklyCards || []);

          if (weeklyResult.growthStats?.startWeekInfo) setStartWeekInfo(weeklyResult.growthStats.startWeekInfo);
          if (weeklyResult.growthStats?.endWeekInfo) setEndWeekInfo(weeklyResult.growthStats.endWeekInfo);
          if (weeklyResult.userStatus !== undefined) setUserStatus(weeklyResult.userStatus);
          if (weeklyResult.userGrowthStatus !== undefined) setGrowthStatus(weeklyResult.userGrowthStatus);

          if (weeklyResult.currentWeekInfo) {
            setCurrentSeasonInfo({
              year: weeklyResult.currentWeekInfo.year,
              name: weeklyResult.currentWeekInfo.seasonName,
              currentWeek: weeklyResult.currentWeekInfo.weekNumber,
              isClubBreak: weeklyResult.currentWeekInfo.status === 'official_rest',
              holidayName: weeklyResult.currentWeekInfo.restReason,
              isBreakSeason: weeklyResult.currentWeekInfo.status === 'transition',
              fromSeason: weeklyResult.currentWeekInfo.seasonName,
              toSeason: weeklyResult.currentWeekInfo.nextSeasonName,
            });
          }

          const gs = weeklyResult.growthStats;
          if (gs) {
            setGrowthPeriodStats({
              approvedWeeks: gs.successWeeks,
              unapprovedWeeks: gs.failWeeks,
              restWeeks: gs.restWeeks,
              clubBreakWeeks: 0,
              availableWeeks: gs.availableWeeks,
              availableSeasons: gs.availableSeasons,
              restSeasons: 0,
            });
          }
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
    dbWeeklyData.forEach(w => {
      if (w.seasonLabel && !unique.has(w.seasonLabel)) unique.set(w.seasonLabel, w.seasonLabel);
    });
    return ["역대 시즌", ...Array.from(unique.values())];
  }, [dbWeeklyData]);

  const resultOptions = [
    "전체 (all)",
    "성장 (성공)",
    "성장 (실패)",
    "휴식 (개인)",
    "휴식 (공식)",
  ];

  const filteredDbData = dbWeeklyData.filter((week) => {
    let seasonMatch = true;
    if (selectedSeason !== "역대 시즌") {
      seasonMatch = week.seasonLabel === selectedSeason;
    }

    let resultMatch = true;
    if (selectedResult !== "주차 결과" && selectedResult !== "전체 (all)") {
      if (selectedResult === "성장 (성공)") resultMatch = week.resultStatus === "성공";
      else if (selectedResult === "성장 (실패)") resultMatch = week.resultStatus === "실패";
      else if (selectedResult === "휴식 (개인)") resultMatch = week.resultStatus === "휴식(개인)";
      else if (selectedResult === "휴식 (공식)") resultMatch = week.resultStatus === "휴식(공식)";
    }

    return seasonMatch && resultMatch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDbData.length / itemsPerPage));
  const paginatedDbData = filteredDbData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  console.debug("[weekly-cards] ── 데이터 흐름 ──");
  console.debug("  1. dbWeeklyData.length:", dbWeeklyData.length);
  console.debug("  2. filteredDbData.length:", filteredDbData.length);
  console.debug("  3. paginatedDbData.length:", paginatedDbData.length);
  console.debug("  4. selectedSeason (filter value):", JSON.stringify(selectedSeason));
  console.debug("  5. selectedResult (filter value):", JSON.stringify(selectedResult));
  console.debug("  6. 첫 번째 week:", dbWeeklyData[0] ? JSON.stringify({
    weekId: dbWeeklyData[0].weekId,
    seasonLabel: dbWeeklyData[0].seasonLabel,
    resultStatus: dbWeeklyData[0].resultStatus,
  }) : "(empty)");
  console.debug("  7. isDemoMode:", isDemoMode);
  console.debug("  8. isLoadingWeeks:", isLoadingWeeks, "| isNotLoggedIn:", isNotLoggedIn, "| isPendingApproval:", isPendingApproval, "| targetUserId:", targetUserId);
  console.debug("  9. seasonOptions:", JSON.stringify(seasonOptions));
  if (dbWeeklyData.length > 0) {
    console.debug("  resultStatus 분포:", dbWeeklyData.reduce((acc, w) => { acc[w.resultStatus] = (acc[w.resultStatus] || 0) + 1; return acc; }, {} as Record<string, number>));
  }
  if (dbWeeklyData.length > 0 && filteredDbData.length === 0) {
    console.error("[weekly-cards] 데이터 있으나 필터 후 0건 — 필터 조건 불일치",
      { firstWeekStatus: dbWeeklyData[0].resultStatus, selectedSeason, selectedResult });
  }
  if (dbWeeklyData.length === 0 && isDemoMode) {
    console.error("[weekly-cards] 데모 모드인데 dbWeeklyData 비어 있음 — DUMMY_WEEKLY_LIST 미할당");
  }
  if (dbWeeklyData.length === 0 && !isDemoMode && !isLoadingWeeks) {
    console.warn("[weekly-cards] 일반 모드, 로딩 완료인데 데이터 0건 — API fetch 확인 필요");
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

  const getImagePath = (title: string) => {
    const match = title.match(/\((\d+)월\s*(\d+)주차\)/);
    if (match) {
      const month = parseInt(match[1]);
      const weekInMonth = parseInt(match[2]);

      let season = "";
      let weekNum = 0;
      let suffix = "";

      if (month === 1) {
        season = "겨울";
        weekNum = weekInMonth;
      } else if (month === 2) {
        season = "겨울";
        weekNum = 4 + weekInMonth;
        if (weekInMonth === 2) {
          suffix = " 설,구정";
        }
      } else if (month === 3) {
        season = "봄";
        weekNum = weekInMonth;
      } else if (month === 4) {
        season = "봄";
        weekNum = 4 + weekInMonth;
      } else if (month === 5) {
        season = "봄";
        weekNum = 8 + weekInMonth;
      } else if (month === 6) {
        season = "봄";
        weekNum = 12 + weekInMonth;
      } else if (month === 7) {
        season = "여름";
        weekNum = weekInMonth;
      } else if (month === 8) {
        season = "여름";
        weekNum = 4 + weekInMonth;
      } else if (month === 9) {
        season = "가을";
        weekNum = weekInMonth;
      } else if (month === 10) {
        season = "가을";
        weekNum = 4 + weekInMonth;
      } else if (month === 11) {
        season = "가을";
        weekNum = 8 + weekInMonth;
      } else if (month === 12) {
        season = "가을";
        weekNum = 12 + weekInMonth;
      }

      return `/images/0/cluster4/주차 이미지/${season} ${weekNum}주차 (${month}월 ${weekInMonth}주차${suffix}).png`;
    }
    return "/images/0/cluster4/주차 이미지/여름 1주차 (7월 1주차).png";
  };

  const getWeekImagePath = (week: WeeklyCardDto): { primary: string; stripped: string } => {
    if (week.weekId.startsWith('dummy') || week.weekId.startsWith('dw-')) {
      const dummyImages: { [key: string]: string } = {
        'dummy-1': '/images/0/cluster4/주차 이미지/여름 3주차 (7월 1주차).png',
        'dummy-2': '/images/0/cluster4/주차 이미지/여름 2주차 (7월 1주차).png',
        'dummy-3': '/images/0/cluster4/주차 이미지/휴식(개인,공식)1.png',
        'dummy-4': '/images/0/cluster4/주차 이미지/휴식(개인,공식)2.png',
        'dummy-5': '/images/0/cluster4/주차 이미지/봄 15주차 (6월 4주차).png',
        'dummy-6': '/images/0/cluster4/주차 이미지/봄 14주차 (6월 3주차).png',
        'dummy-7': '/images/0/cluster4/주차 이미지/봄 13주차 (6월 2주차).png',
        'dummy-8': '/images/0/cluster4/주차 이미지/봄 12주차 (6월 1주차).png',
        'dummy-9': '/images/0/cluster4/주차 이미지/휴식(개인,공식)3.png',
        'dummy-10': '/images/0/cluster4/주차 이미지/휴식(개인,공식)4.png',
      };
      const dummy = dummyImages[week.weekId] || '/images/0/cluster4/주차 이미지/휴식(개인,공식).png';
      return { primary: dummy, stripped: dummy };
    }

    if (week.isBreakSeason && !week.isOnboarding && week.fromSeason && week.toSeason) {
      const mid = `/images/0/cluster4/주차 이미지/중간 주차 (${week.fromSeason}-${week.toSeason}).png`;
      return { primary: mid, stripped: mid };
    }

    const seasonStartMonth: { [key: string]: number } = {
      '겨울': 1,
      '봄': 3,
      '여름': 7,
      '가을': 9
    };

    const effectiveSeasonName = (week.isBreakSeason && week.toSeason) ? week.toSeason : week.seasonName;
    const startMonth = seasonStartMonth[effectiveSeasonName] || 1;
    const monthOffset = Math.floor((week.weekNumber - 1) / 4);
    const month = startMonth + monthOffset;
    const weekOfMonth = ((week.weekNumber - 1) % 4) + 1;

    const holidaySuffix = week.holidayName ? ` ${week.holidayName}` : '';
    const base = `/images/0/cluster4/주차 이미지/${effectiveSeasonName} ${week.weekNumber}주차 (${month}월 ${weekOfMonth}주차`;
    return {
      primary: `${base}${holidaySuffix}).png`,
      stripped: `${base}).png`,
    };
  };

  const handleWeekImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rest = '/images/0/cluster4/주차 이미지/휴식(개인,공식).png';
    const stripped = img.dataset.strippedSrc;
    if (img.dataset.fallbackStep !== '1' && stripped) {
      img.dataset.fallbackStep = '1';
      img.src = stripped;
    } else {
      img.src = rest;
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <img
        key={i}
        src="/images/0/cluster4/icon/icon - star.png"
        alt="star"
        className={`star-icon ${i >= rating ? 'empty' : ''}`}
      />
    ));
  };

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
                  {demoCollectionMessage ? demoCollectionMessage : (
                    currentSeasonInfo?.isBreakSeason ? (
                      <>현재 클럽은, <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.fromSeason} 시즌</strong>에서 <strong>{currentSeasonInfo.year}년 {currentSeasonInfo.toSeason} 시즌</strong>으로 가는 휴식(시즌 전환) 중에 있습니다.</>
                    ) : (
                      <>현재 클럽은, <strong>{currentSeasonInfo ? `${currentSeasonInfo.year}년 ${currentSeasonInfo.name} 시즌, ${currentSeasonInfo.currentWeek}주차` : '로딩 중...'}</strong>를 {currentSeasonInfo?.isClubBreak ? `휴식 (${currentSeasonInfo.holidayName || '공식'})` : '진행'} 중에 있습니다.</>
                    )
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
          ) : (isMobile ? filteredDbData.slice(0, mobileVisibleCount) : paginatedDbData).length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '16px' }}>표시할 주차 카드가 없습니다.</p>
            </div>
          ) : (
            (isMobile ? filteredDbData.slice(0, mobileVisibleCount) : paginatedDbData).map((week) => {
              const weekHref = withPxRoute(`/cluster-4-card/${week.weekId}${targetUserId ? `?userId=${targetUserId}` : ''}`, pathname);
              const isExpanded = expandedWeekId === week.weekId;
              const isRest = week.resultStatus.includes('휴식');
              const isPersonalRest = week.resultStatus === '휴식(개인)';
              const hideGrowth = isPersonalRest || (week.isClubBreak && week.growthRate.total === 0);
              const hideStats = isPersonalRest || week.isOnboarding || (week.isClubBreak && week.growthRate.total === 0);
              const weekTitle = week.isBreakSeason
                ? `${week.toSeason ? `${week.seasonYear}년도 ${week.toSeason}시즌` : week.seasonLabel} 전환 주차`
                : `${week.seasonLabel} ${week.weekNumber}주차`;

              if (isMobile) {
                return (
                  <div
                    key={week.weekId}
                    className={`weekly-card weekly-card--mobile ${isExpanded ? "is-expanded" : ""}`}
                  >
                    <Link
                      href={weekHref}
                      className="weekly-card-main"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className={`weekly-card-image ${week.resultStatus === '휴식(개인)' || week.resultStatus === '실패' ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': week.resultStatus === '실패' ? '#ff6b6b' : week.resultStatus === '휴식(개인)' ? '#65e3ff' : week.resultStatus === '휴식(공식)' ? '#ffea48' : week.resultStatus === '진행 중' ? '#9b59b6' : week.resultStatus === '집계 중' ? '#ff1493' : '#9dfa07' } as React.CSSProperties}>
                        {(() => { const paths = getWeekImagePath(week); return (
                          <img src={paths.primary} alt={weekTitle} data-stripped-src={paths.stripped !== paths.primary ? paths.stripped : undefined} onError={handleWeekImageError} />
                        ); })()}
                        <div className="image-badges">
                          <div className={`badge-tag ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>{week.resultStatus.includes('휴식') ? week.resultStatus.replace('(', ' (') : `성장 (${week.resultStatus})`}</div>
                        </div>
                      </div>

                      <div className="weekly-card-content">
                        <div className="weekly-card-header">
                          <h4 className="weekly-card-title">{weekTitle}</h4>
                          <span className="weekly-card-date">
                            <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                            {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                          </span>
                        </div>

                        <div className="weekly-card-main-progress">
                          <span className="progress-label">
                            <span className="dot">·</span> 주차 성장률 <strong>{hideGrowth ? "-" : `${week.growthRate.rate}%`}</strong>
                          </span>
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${hideGrowth ? 0 : week.growthRate.rate}%` }} />
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
                      {isExpanded ? "접기" : "상세"}
                    </button>

                    {isExpanded && (
                      <div className="weekly-card-details">
                        {(() => {
                          return (
                            <>
                              <div className="weekly-card-details-top">
                                <div className="detail-chip"><strong>[팀]</strong> {week.teamName || "-"}</div>
                                <div className="detail-chip"><strong>[파트]</strong> {week.partName || "-"}</div>
                                <div className="detail-chip"><strong>[역할]</strong> {week.roleLabel || "-"}</div>
                              </div>

                              <div className="weekly-card-details-grid">
                                <div className="detail-row">
                                  <span className="k">정보 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${week.infoRate.rate}%`} <span className="sub">({hideStats ? "-" : week.infoRate.count}/{hideStats ? "-" : week.infoRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">역량 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${week.competencyRate.rate}%`} <span className="sub">({hideStats ? "-" : week.competencyRate.count}/{hideStats ? "-" : week.competencyRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">경험 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${week.experienceRate.rate}%`} <span className="sub">({hideStats ? "-" : week.experienceRate.count}/{hideStats ? "-" : week.experienceRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">경력 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${week.careerRate.rate}%`} <span className="sub">({hideStats ? "-" : week.careerRate.count}/{hideStats ? "-" : week.careerRate.total})</span></span>
                                </div>
                              </div>

                              <div className="weekly-card-details-bottom">
                                <div className="metric">{getOrgAliasFromPathname(pathname, "단감")?.label ?? "단감"} <strong>{week.points.star}</strong></div>
                                <div className="metric">{getOrgAliasFromPathname(pathname, "인절미")?.label ?? "인절미"} <strong>{week.cumulativeInjeolmi}</strong></div>
                                <div className="metric">{getOrgAliasFromPathname(pathname, "어흥")?.label ?? "어흥"} <strong>{Math.abs(week.points.lightning)}</strong></div>
                                <div className="metric">주차 평판 <strong>{week.reputationCount}</strong><span className="sub">/4</span></div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              }

              // 데스크톱: 기존 카드 UI 유지
              return (
                <Link href={weekHref} key={week.weekId} className="weekly-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {/* 왼쪽 이미지 */}
                  <div className={`weekly-card-image ${week.resultStatus === '휴식(개인)' || week.resultStatus === '실패' ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': week.resultStatus === '실패' ? '#ff6b6b' : week.resultStatus === '휴식(개인)' ? '#65e3ff' : week.resultStatus === '휴식(공식)' ? '#ffea48' : week.resultStatus === '진행 중' ? '#9b59b6' : week.resultStatus === '집계 중' ? '#ff1493' : '#9dfa07' } as React.CSSProperties}>
                    {(() => { const paths = getWeekImagePath(week); return (
                      <img src={paths.primary} alt={weekTitle} data-stripped-src={paths.stripped !== paths.primary ? paths.stripped : undefined} onError={handleWeekImageError} />
                    ); })()}
                    {week.resultStatus === '휴식(개인)' && (
                      <div className="rest-message">
                        <span className="rest-text-line">충분히 <span className="rest-emoji">🥰</span></span>
                        <span className="rest-text-line">쉬었나요..?</span>
                      </div>
                    )}
                    {week.resultStatus === '실패' && (
                      <div className="rest-message">
                        <span className="rest-text-line">값진 실패는 <span className="rest-emoji">😎</span></span>
                        <span className="rest-text-line">훌륭한 스승님!</span>
                      </div>
                    )}
                    <div className="image-badges">
                      <div className={`badge-tag ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>{week.resultStatus.includes('휴식') ? week.resultStatus.replace('(', ' (') : `성장 (${week.resultStatus})`}</div>
                      <div className="badge-like">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 중앙 콘텐츠 */}
                  <div className="weekly-card-content">
                    {/* 첫 번째 줄: 타이틀, 날짜, 주차 */}
                    <div className="weekly-card-header">
                      <h4 className="weekly-card-title">{weekTitle}</h4>
                      <span className="weekly-card-date">
                        <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                        {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                      </span>
                      <span className="weekly-card-week">
                        <img src="/images/0/cluster4/icon/icon - 7.png" alt="clock" className="week-icon" />
                        <span className="week-number num-2">{(week.resultStatus === '진행 중' || week.resultStatus === '집계 중') ? '+1' : week.accumulatedApprovedWeeks}</span> / <span className="num-2">25</span> 주차
                      </span>
                    </div>

                    {/* 두 번째 줄: 팀, 파트, 역할, 아이템 */}
                    <div className="weekly-card-info">
                      {/* 그룹 1: 팀, 파트 */}
                      {(() => {
                        return (
                          <>
                            <div className="info-group">
                              <span className="info-item team">
                                <strong>[팀]</strong>{' '}
                                <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{(week.teamName || '-').length > 6 ? (week.teamName || '-').slice(0, 6) + '..' : week.teamName || '-'}</span>
                              </span>
                              <span className="info-divider">|</span>
                              <span className="info-item part">
                                <strong>[파트]</strong>{' '}
                                <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{(week.partName || '-').length > 6 ? (week.partName || '-').slice(0, 6) + '..' : week.partName || '-'}</span>
                              </span>
                            </div>
                            {/* 그룹 2: 역할 */}
                            <div className="info-group">
                              <span className="info-badge role">
                                <img src="/images/0/cluster4/icon/icon - 8.png" alt="role" className="role-icon" />
                                <span style={{ display: 'inline-block', maxWidth: '109px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Pretendard', sans-serif" }}>{truncate(week.roleLabel, 8)}</span>
                              </span>
                            </div>
                          </>
                        );
                      })()}
                      {/* 그룹 3: 아이템들 */}
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
                            {renderItem("단감", week.points.star, "/images/0/cluster4/icon/icon - 단감.png")}
                            <span className="info-divider">·</span>
                            {renderItem("인절미", week.cumulativeInjeolmi, "/images/0/cluster4/icon/icon - 인절미.png")}
                            <span className="info-divider">·</span>
                            {renderItem("어흥", Math.abs(week.points.lightning), "/images/0/cluster4/icon/icon - 어흥.png")}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 세 번째 줄: 주차 성장률 프로그레스 바 */}
                    {(() => {
                      return (
                        <>
                          <div className="weekly-card-main-progress">
                            <span className="progress-label"><span className="dot">·</span> 주차 성장률 <strong><span className="num-3">{hideGrowth ? '-' : week.growthRate.rate}</span>%</strong></span>
                            <div className="progress-bar-wrapper">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${hideGrowth ? 0 : week.growthRate.rate}%` }}></div>
                              </div>
                            </div>
                            <span className="total-count">
                              <img src="/images/0/cluster4/icon/icon - 0.png" alt="leaf" className="leaf-icon" />
                              총 <span className="num-3">{hideStats ? '-' : week.growthRate.total}</span> 개 중 <strong><span className="num-3">{hideStats ? '-' : week.growthRate.count}</span></strong> 개
                            </span>
                          </div>

                          {/* 네 번째, 다섯 번째 줄: 스탯들 */}
                          <div className={`weekly-card-stats-wrapper ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''}`}>
                            <div className="weekly-card-stats">
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>정보</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : week.infoRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : week.infoRate.count}</span>/<span className="num-2">{hideStats ? '-' : week.infoRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>역량</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : week.competencyRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : week.competencyRate.count}</span>/<span className="num-2">{hideStats ? '-' : week.competencyRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>경험</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : week.experienceRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : week.experienceRate.count}</span>/<span className="num-2">{hideStats ? '-' : week.experienceRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>경력</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : week.careerRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : week.careerRate.count}</span>/<span className="num-2">{hideStats ? '-' : week.careerRate.total}</span>)</span></span>
                            </div>
                            <div className="weekly-card-extra-stats">
                              <span className="stat"><span className="dot">·</span> <span className="label">주차 평판</span> <span className="num num-1">{isRest ? '-' : week.reputationCount}</span><span className="white">/<span className="num-1">4</span></span></span>
                              <span className="stat"><span className="dot">·</span> <span className="label">명성도(FM)</span> <span className="num num-4">{isRest ? '-' : week.fmScore}</span></span>
                              <span className="stat"><span className="dot">·</span> <span className="label">연계 동료</span> <span className="num num-1">{isRest ? '-' : week.colleagueCount}</span><span className="white">/<span className="num-1">3</span></span></span>
                              <span className="stat empty"></span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* 우측 성장 상태 */}
                  <div className={`weekly-card-status-badge ${week.resultStatus === '실패' ? 'fail' : ''} ${week.resultStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.resultStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.resultStatus === '진행 중' ? 'in-progress' : ''} ${week.resultStatus === '집계 중' ? 'counting' : ''}`}>
                    <span className="status-text">{week.resultStatus.includes('휴식') ? week.resultStatus.replace('(', ' (') : `성장 (${week.resultStatus})`}</span>
                    <img src={week.resultStatus === '진행 중' ? '/images/0/cluster4/icon/icon%20-%20성장%20%28진행%20중%29.png' : week.resultStatus === '집계 중' ? '/images/0/cluster4/icon/icon%20-%20성장%20%28집계%20중%29.png' : `/images/0/cluster4/icon/icon%20-%20${week.resultStatus.includes('휴식') ? week.resultStatus.replace('(', '%28').replace(')', '%29') : `성장%28${week.resultStatus}%29`}.png`} alt={week.resultStatus} className="trophy-icon" />
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

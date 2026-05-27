"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getFixedDropdownPosition } from "@/utils/documentZoom";
import { supabase } from "@/lib/supabase";
import { dedupedJson } from "@/lib/fetch-dedupe";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { DUMMY_WEEKLY_LIST, DUMMY_WEEK_EXTRA } from "@/constants/dummyData";

// 글자수 기반 말줄임 (info-badge role 8자 초과 시 "..")
const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
  const t = text || "-";
  return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
};

// 주차 결과 결정 시점 = N+1주(목) 12:01 KST = N(월) 00:00 + 10일 12시간 1분
// 이 시점에 동시에 확정:
//   - 라인 카드: '강화 대기' → '강화 성공' (이행자) / '강화 실패' (미이행자, 단 미이행은 진행 중 phase 부터 즉시 표시)
//   - 주차 카드: '집계 중' → '성장 성공' / '성장 실패' / '휴식(개인)' / '휴식(공식)'
// 2차 정보 / weekly_activities.deadline / opened_at+48h 는 영향을 주지 않는다 (2026 정책).
const computeResultDecidedMs = (startDate: string): number => {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + (10 * 24 + 12) * 3600 * 1000 + 60 * 1000;
};

const Cluster41Content = () => {
  // URL에서 userId 파라미터 읽기 (다른 유저 조회 시 사용)
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get('userId') || searchParams.get('userID');
  const isDemoMode = checkDemoMode();

  // 데모 모드에서 사용자별 collection-content 문구 분기용
  const [demoUserName, setDemoUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemoMode || !targetUserId) return;
    const fetchName = async () => {
      try {
        const res = await fetch(`/api/profile/?userId=${targetUserId}`);
        if (res.ok) {
          const json = await res.json();
          const name = json.data?.display_name || null;
          setDemoUserName(name);
          // 데모 모드 사용자별 성장 상태 설정
          const demoStatusMap: Record<string, { us: string | null; gs: string | null }> = {
            '전민경': { us: 'graduated', gs: '졸업 완료' },
            '곽예원': { us: 'weekly_rest', gs: '주차 휴식 중' },
            '김의환': { us: 'suspended', gs: '활동 중단' },
          };
          if (name && demoStatusMap[name]) {
            setUserStatus(demoStatusMap[name].us);
            setGrowthStatus(demoStatusMap[name].gs);
          }
          // 데모 모드 사용자별 weekly-card 더미 데이터 (자릿수 분산)
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
            setWeeklyReputationCounts(prev => ({ ...prev, 'dw-01': demoWeekOverrides[name].reputationCount }));
            setWeeklyFmScores(prev => ({ ...prev, 'dw-01': demoWeekOverrides[name].fmScore }));
            setWeeklyColleagueCounts(prev => ({ ...prev, 'dw-01': demoWeekOverrides[name].colleagueCount }));
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
  const { data: session, status: sessionStatus } = useSession();

  // 로그인 상태로 /cluster-4 진입 시 자기 userId 를 URL 에 부착
  // (카카오 로그인 callbackUrl 이 /cluster-4 로 고정 — userId 는 로그인 시점에 알 수 없어 여기서 정규화)
  // dedupedJson 우회: 다른 컴포넌트가 sessionStatus='authenticated' 직전에 /api/profile/ 호출하여
  // 401 응답을 30s TTL 캐시에 박는 race 발생 시 새로고침 전까지 myId 부착 실패 — direct fetch + no-store 로 회피
  // 404(user_profiles 매칭 실패) 처리는 (main-layout) 의 ProfileApprovalGate 에 위임
  useEffect(() => {
    if (isDemoMode) return;
    if (sessionStatus !== 'authenticated') return;
    if (targetUserId) return;
    // 어드민(마더 계정)은 user_profiles 에 없어 /cluster-4 자체가 의미 없음 — 크루 관리 시작점인 /crews 로
    if ((session?.user as any)?.isAdmin) {
      router.replace('/crews');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile/', { cache: 'no-store', credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) return;
        const result = await res.json();
        if (cancelled) return;
        const myId = result?.success && result?.data?.id;
        if (myId) router.replace(`/cluster-4?userId=${myId}`);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sessionStatus, session, targetUserId, isDemoMode, router]);

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
    // 고정 너비 레이아웃: 항상 데스크탑 모드
    setIsMobile(false);
  }, []);

  // 필터 드롭다운 외부 클릭 시 닫기
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

  // 현재 시즌 정보 상태
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

  // 성장 기간 집계 데이터 상태
  interface GrowthPeriodStats {
    approvedWeeks: number;      // 성장(성공) 주차
    unapprovedWeeks: number;    // 성장(실패) 주차
    restWeeks: number;          // 휴식 주차
    clubBreakWeeks: number;     // 휴식(공식) 주차
    availableWeeks: number;     // 성장 가능 주차
    availableSeasons: number;   // 성장 가능 시즌 (크루 등록 이후 클럽 정상 운영 시즌 수)
    restSeasons: number;        // 성장 휴식 시즌
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

  // 주차별 평판 개수 (week_card_id -> count)
  const [weeklyReputationCounts, setWeeklyReputationCounts] = useState<{ [key: string]: number }>({});
  const [weeklyFmScores, setWeeklyFmScores] = useState<{ [key: string]: number }>({});
  const [weeklyColleagueCounts, setWeeklyColleagueCounts] = useState<{ [key: string]: number }>({});

  // 성장 시작/종료 주차 정보 상태
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
  // user_profiles.role 기본값 (역할 이력이 없을 때 사용)
  const [userDefaultRole, setUserDefaultRole] = useState<string | null>(null);

  // 시즌 카드 데이터
  interface SeasonCardData {
    id: string;
    seasonId: string;
    year: number;
    seasonName: string;
    startDate: string;
    endDate: string;
    progressStatus: string;  // in_progress, completed, resting
    approvedWeeks: number;
    totalWeeks: number;
    roleInSeason: string;
  }
  const [seasonCards, setSeasonCards] = useState<SeasonCardData[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(!isDemoMode);

  // 주차별 평판 개수 + 별점 합산(명성도 FM) 가져오기
  useEffect(() => {
    if (isDemoMode) return;
    const fetchWeeklyReputationCounts = async () => {
      if (!targetUserId) return;
      try {
        const res = await fetch(`/api/weekly-reputations?targetUserId=${targetUserId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            // 주차별로 그룹화 (개수 + 별점 합산)
            const counts: { [key: string]: number } = {};
            const fmScores: { [key: string]: number } = {};
            json.data.forEach((rep: { week_card_id: string; rating: number }) => {
              counts[rep.week_card_id] = (counts[rep.week_card_id] || 0) + 1;
              fmScores[rep.week_card_id] = (fmScores[rep.week_card_id] || 0) + (rep.rating || 0);
            });
            setWeeklyReputationCounts(counts);
            setWeeklyFmScores(fmScores);
          }
        }
      } catch (error) {
        console.error("주차 평판 개수 가져오기 오류:", error);
      }
    };
    fetchWeeklyReputationCounts();
  }, [targetUserId]);

  // 데모 모드: 주차별 평판/FM/동료 데이터 설정
  useEffect(() => {
    if (!isDemoMode) return;
    const counts: { [key: string]: number } = {};
    const fmScores: { [key: string]: number } = {};
    const colleagues: { [key: string]: number } = {};
    Object.entries(DUMMY_WEEK_EXTRA).forEach(([weekId, extra]) => {
      counts[weekId] = extra.reputationCount;
      fmScores[weekId] = extra.fmScore;
      colleagues[weekId] = extra.colleagueCount;
    });
    setWeeklyReputationCounts(counts);
    setWeeklyFmScores(fmScores);
    setWeeklyColleagueCounts(colleagues);
  }, [isDemoMode]);

  // 현재 시즌 정보 가져오기
  useEffect(() => {
    if (isDemoMode) return;
    const fetchCurrentSeason = async () => {
      const today = new Date().toISOString().split('T')[0];

      // 현재 주차 정보 가져오기 (is_club_break, holiday_name 포함)
      const { data: currentWeekData } = await supabase
        .from('weeks')
        .select('id, week_number, is_club_break, holiday_name, seasons (id, name, year)')
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle();

      if (currentWeekData) {
        // 시즌 이름 변환 (spring -> 봄, summer -> 여름, fall -> 가을, winter -> 겨울)
        const seasonNameMap: { [key: string]: string } = {
          'spring': '봄',
          'summer': '여름',
          'fall': '가을',
          'winter': '겨울'
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonData = currentWeekData.seasons as any;
        const rawSeasonName = seasonData?.name || '';

        // break 시즌인지 확인 (예: spring_summer_break, fall_winter_break)
        const isBreakSeason = rawSeasonName.toLowerCase().includes('break');
        let fromSeason: string | null = null;
        let toSeason: string | null = null;
        let displayName = seasonNameMap[rawSeasonName] || rawSeasonName;

        if (isBreakSeason) {
          // break 시즌 이름 파싱 (spring_summer_break -> 봄, 여름)
          const parts = rawSeasonName.replace('_break', '').split('_');
          if (parts.length >= 2) {
            fromSeason = seasonNameMap[parts[0]] || parts[0];
            toSeason = seasonNameMap[parts[1]] || parts[1];
          }
          displayName = '시즌 전환';
        }

        setCurrentSeasonInfo({
          year: seasonData?.year || 0,
          name: displayName,
          currentWeek: currentWeekData.week_number,
          isClubBreak: currentWeekData.is_club_break || false,
          holidayName: currentWeekData.holiday_name || null,
          isBreakSeason,
          fromSeason,
          toSeason
        });
      }
    };

    fetchCurrentSeason();
  }, []);

  // DB 주차 데이터 상태
  interface DBWeekData {
    id: string;
    weekNumber: number;
    seasonYear: number;
    seasonName: string;
    startDate: string;
    endDate: string;
    isClubBreak: boolean;
    isBreakSeason: boolean; // 전환 주차 여부
    fromSeason: string | null; // 전환 주차: 이전 시즌 한글명
    toSeason: string | null;   // 전환 주차: 다음 시즌 한글명
    holidayName: string | null;
    termNumber: number | null; // 운영진 기수
    growthStatus: string; // 성공, 실패, 휴식(개인), 휴식(공식)
  }

  const [dbWeeklyData, setDbWeeklyData] = useState<DBWeekData[]>(
    isDemoMode ? DUMMY_WEEKLY_LIST : []
  );
  const [isLoadingWeeks, setIsLoadingWeeks] = useState(!isDemoMode);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);

  // 팀/파트/역할 데이터 상태
  interface TeamData {
    id: string;
    name: string;
  }
  interface PartData {
    id: string;
    name: string;
    team_id: string;
  }
  interface UserTeamPartData {
    id: string;
    user_id: string;
    team_id: string | null;
    part_id: string | null;
    joined_at: string;
    left_at: string | null;
    is_current: boolean;
    season_id: string;
    generation: number | null;
    managed_team_id: string | null;
  }
  interface UserRoleHistoryData {
    id: string;
    user_id: string;
    role: string;
    started_at: string;
    ended_at: string | null;
  }
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [parts, setParts] = useState<PartData[]>([]);
  const [userTeamParts, setUserTeamParts] = useState<UserTeamPartData[]>([]);
  const [userRoleHistory, setUserRoleHistory] = useState<UserRoleHistoryData[]>([]);

  // 포인트 데이터 상태
  interface PointData {
    id: string;
    user_id: string;
    week_id: string;
    point_type: 'star' | 'lightning' | 'shield';
    points: number;
  }
  const [userPoints, setUserPoints] = useState<PointData[]>([]);

  // 활동 데이터 상태 (주차별 실무 강화율 계산용) - activity_records 테이블 사용
  interface ActivityData {
    id: string;
    user_id: string;
    week_id: string;
    activity_type_id: string;
    is_completed: boolean;
  }
  const [userActivities, setUserActivities] = useState<ActivityData[]>([]);

  // 활동 타입별 분류 (실무 카테고리) - DB에서 동적으로 가져옴
  const [infoTypeIds, setInfoTypeIds] = useState<string[]>([]);
  const [competencyTypeIds, setCompetencyTypeIds] = useState<string[]>([]);
  const [experienceTypeIds, setExperienceTypeIds] = useState<string[]>([]);
  const [careerTypeIds, setCareerTypeIds] = useState<string[]>([]);

  // 주차별 열린 활동 데이터 (weekly_activities 테이블)
  interface WeeklyActivityData {
    week_id: string;
    activity_type_id: string;
    is_active: boolean;
    opened_at: string | null;
    deadline: string | null;  // 마감 시간 (없으면 opened_at+48h 폴백)
  }
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivityData[]>([]);

  // 2차 정보 데이터 (activity_details 테이블) - 강화 성공 판단용
  interface ActivityDetailData {
    week_id: string;
    activity_type_id: string;
    sub_title: string | null;
    output_links: { desc: string; url: string }[] | null;
  }
  const [activityDetails, setActivityDetails] = useState<ActivityDetailData[]>([]);

  // 온보딩 주차 ID 상태 (무적 주차)
  const [onboardingWeekId, setOnboardingWeekId] = useState<string | null>(null);

  // 경력 기록 데이터 (실무 경력 강화율 계산용) - career_records 테이블 사용
  interface CareerRecordData {
    id: string;
    user_id: string;
    week_id: string;
    project_id: string;
    enhancement_status: 'not_applicable' | 'pending' | 'enhanced';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weeks?: any;
  }
  const [userCareerRecords, setUserCareerRecords] = useState<CareerRecordData[]>([]);
  // 주차별 경력 프로젝트 수 (career_projects 기반 - total 계산용)
  const [careerProjectsByWeek, setCareerProjectsByWeek] = useState<Map<string, number>>(new Map());

  // 역할 라벨 매핑
  const roleLabels: { [key: string]: string } = {
    'crew': '일반',
    'crew_regular': '일반',
    'crew_normal': '일반',
    'part_leader': '심화(파트장)',
    'crew_partleader': '심화(파트장)',
    'crew_advanced_part_leader': '심화(파트장)',
    'operations_partleader': '심화(파트장)',
    'crew_agent': '심화(에이전트)',
    'crew_advanced_agent': '심화(에이전트)',
    'crew_ambassador': '운영진(앰배서더)',
    'admin_ambassador': '운영진(앰배서더)',
    'operations_ambassador': '운영진(앰배서더)',
    'crew_team_leader': '운영진(팀장)',
    'admin_team_leader': '운영진(팀장)',
    'operations_teamleader': '운영진(팀장)',
  };

  // 특정 날짜에 해당하는 팀/파트 정보 찾기
  const getTeamPartForDate = (date: string) => {
    // 데모 모드 팀/파트는 getFormattedTeamPart에서 DUMMY_WEEK_EXTRA로 처리
    if (isDemoMode) return { teamName: null, partName: null };
    const dateObj = new Date(date);

    // 해당 날짜에 활성화된 user_team_parts 찾기
    const activeTeamPart = userTeamParts.find(utp => {
      const startDate = new Date(utp.joined_at);
      const endDate = utp.left_at ? new Date(utp.left_at) : null;

      // joined_at <= date && (left_at is null OR left_at > date)
      // left_at은 떠난 날이므로 그 날짜에는 이미 해당 팀/파트에 속하지 않음
      return startDate <= dateObj && (!endDate || endDate > dateObj);
    });

    if (!activeTeamPart) return { teamName: null, partName: null };

    const team = teams.find(t => t.id === activeTeamPart.team_id);
    const part = parts.find(p => p.id === activeTeamPart.part_id);

    return {
      teamName: team?.name || null,
      partName: part?.name || null
    };
  };

  // 특정 날짜에 해당하는 역할 정보 찾기
  // 1순위: user_role_history 테이블에서 해당 날짜에 맞는 역할
  // 2순위: user_profiles.role 기본값
  const getRoleForDate = (date: string) => {
    // 데모 모드 역할은 렌더링에서 DUMMY_WEEK_EXTRA로 직접 처리
    if (isDemoMode) return null;
    const dateObj = new Date(date);

    // 1순위: 해당 날짜에 활성화된 역할 이력 찾기
    // ended_at은 종료 날이므로 그 날짜에는 이미 해당 역할이 아님
    const activeRole = userRoleHistory.find(urh => {
      const startDate = new Date(urh.started_at);
      const endDate = urh.ended_at ? new Date(urh.ended_at) : null;

      // started_at <= date && (ended_at is null OR ended_at > date)
      return startDate <= dateObj && (!endDate || endDate > dateObj);
    });

    if (activeRole) {
      return {
        role: activeRole.role,
        roleLabel: roleLabels[activeRole.role] || activeRole.role
      };
    }

    // 2순위: user_profiles.role 기본값 사용
    if (userDefaultRole) {
      return {
        role: userDefaultRole,
        roleLabel: roleLabels[userDefaultRole] || userDefaultRole
      };
    }

    return null;
  };

  // 운영진 역할 확인
  const isAdminRole = (role: string | undefined): boolean => {
    if (!role) return false;
    return ['admin_team_leader', 'crew_team_leader', 'operations_teamleader',
            'admin_ambassador', 'crew_ambassador', 'operations_ambassador'].includes(role);
  };

  // 운영진일 때 팀/파트 포맷 변환
  const getFormattedTeamPart = (date: string, week: DBWeekData) => {
    // 온보딩 주차는 '클럽온보딩' / '신입OT' 표시
    if (onboardingWeekId && week.id === onboardingWeekId) return { teamName: '클럽온보딩', partName: '신입OT' };
    if (week.isBreakSeason) return { teamName: '-', partName: '-' };
    // 데모 모드: DUMMY_WEEK_EXTRA에서 팀/파트 조회
    if (isDemoMode && DUMMY_WEEK_EXTRA[week.id]) {
      const extra = DUMMY_WEEK_EXTRA[week.id];
      return { teamName: extra.teamPart.teamName || '-', partName: extra.teamPart.partName || '-' };
    }
    const teamPart = getTeamPartForDate(date);
    const roleInfo = getRoleForDate(date);

    if (roleInfo && isAdminRole(roleInfo.role) && teamPart.teamName === '운영진') {
      const dateObj = new Date(date);
      const activeTeamPart = userTeamParts.find(utp => {
        const startDate = new Date(utp.joined_at);
        const endDate = utp.left_at ? new Date(utp.left_at) : null;
        return startDate <= dateObj && (!endDate || endDate > dateObj);
      });
      const gen = activeTeamPart?.generation;
      const isTeamLeader = roleInfo.role?.includes('team_leader');
      const managedTeam = activeTeamPart?.managed_team_id
        ? teams.find(t => t.id === activeTeamPart.managed_team_id)
        : null;

      return {
        teamName: gen ? `운영진(${gen}기)` : '운영진',
        partName: isTeamLeader && managedTeam ? `팀장(${managedTeam.name})` : (teamPart.partName || '-')
      };
    }

    return teamPart;
  };

  // 특정 주차의 포인트 정보 계산
  const getPointsForWeek = (weekId: string) => {
    // 데모 모드: DUMMY_WEEK_EXTRA에서 포인트 조회
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].points;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { star: 0, shield: 0, lightning: 0 };

    const weekPoints = userPoints.filter(p => p.week_id === weekId);

    const star = weekPoints
      .filter(p => p.point_type === 'star')
      .reduce((sum, p) => sum + p.points, 0);

    const lightning = weekPoints
      .filter(p => p.point_type === 'lightning')
      .reduce((sum, p) => sum + p.points, 0);

    const shield = weekPoints
      .filter(p => p.point_type === 'shield')
      .reduce((sum, p) => sum + p.points, 0);

    return { star, lightning, shield };
  };

  // 누적 인절미 계산 (현재 시즌 내, 특정 주차까지의 누적 shield - lightning)
  const getCumulativeInjeolmi = (weekId: string) => {
    if (dbWeeklyData[0]?.id.startsWith('dummy')) return 30;
    const currentWeek = dbWeeklyData.find(w => w.id === weekId);
    if (!currentWeek) return 0;

    // 같은 시즌 내, 해당 주차까지의 week ID만 필터
    const relevantWeekIds = dbWeeklyData
      .filter(w => w.seasonYear === currentWeek.seasonYear && w.seasonName === currentWeek.seasonName && w.endDate <= currentWeek.endDate)
      .map(w => w.id);

    const relevantPoints = userPoints.filter(p => relevantWeekIds.includes(p.week_id));

    const totalShield = relevantPoints
      .filter(p => p.point_type === 'shield')
      .reduce((sum, p) => sum + p.points, 0);

    const totalLightning = relevantPoints
      .filter(p => p.point_type === 'lightning')
      .reduce((sum, p) => sum + p.points, 0);

    return totalShield - totalLightning;
  };

  // 활동 누적 주차 계산 (해당 주차까지 전체 승인된 주차 수)
  const getCumulativeApprovedWeeks = (weekEndDate: string) => {
    if (isDemoMode) {
      return dbWeeklyData.filter(w => w.endDate <= weekEndDate && w.growthStatus === '성공').length;
    }
    // 해당 주차까지의 전체 승인된(성공) 주차 수 (모든 시즌 통틀어)
    // 표시되는 주차는 모두 완료된 과거 주차(end_date < today)이므로 성공 주차만 카운트
    return dbWeeklyData
      .filter(w =>
        w.endDate <= weekEndDate &&
        w.growthStatus === '성공'
      ).length;
  };

  // 주차별 실무 강화율 계산 함수들 (소수점 올림 처리)
  // 강화 성공 여부 판단 헬퍼 (결정 시점 기반: N+1 목 12:01 KST)
  // ※ 2차 정보 / weekly_activities.deadline / opened_at+48h 는 영향을 주지 않는다 (2026 정책).
  const isEnhancementSuccess = (weekId: string, activityTypeId: string): boolean => {
    // 1. 결정 시점(N+1 목 12:01 KST) 도달 전이면 무조건 false (강화 대기 상태)
    const week = dbWeeklyData.find(w => w.id === weekId);
    if (!week?.startDate) return false;
    if (Date.now() < computeResultDecidedMs(week.startDate)) return false;

    // 2. 결정 시점 이후 — 이행(is_completed=true) 여부만 본다.
    //    userActivities 는 is_completed 무관 전체 records 라서 명시적으로 필터.
    return userActivities.some(a =>
      a.week_id === weekId && a.activity_type_id === activityTypeId && a.is_completed
    );
  };

  // 주차별 실무 정보 강화율 (info)
  const getWeeklyInfoRate = (weekId: string) => {
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].infoRate;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { rate: 0, count: 0, total: 0 };
    // 온보딩 주차도 강화율 정상 계산 (팀/파트 + 강화 성공/실패 표시)
    // 해당 주차에 열린 활동 중 info 타입 개수 (total)
    const weekOpenActivities = weeklyActivities.filter(wa => wa.week_id === weekId && wa.is_active);
    const total = weekOpenActivities.filter(wa => infoTypeIds.includes(wa.activity_type_id)).length;
    // 강화 성공한 info 타입 활동 개수 (count)
    const infoCount = infoTypeIds.filter(activityTypeId =>
      isEnhancementSuccess(weekId, activityTypeId)
    ).length;
    // 소수점 올림 처리: ex) 0.4333..% → 1%
    return { count: infoCount, total, rate: total > 0 ? Math.ceil((infoCount / total) * 100) : 0 };
  };

  // 주차별 실무 역량 강화율 (competency)
  // - 평소: 분모 1
  // - 공식 휴식 주차: 기본 0, 예외적으로 활동이 개설(is_active)되면 1
  const getWeeklyCompetencyRate = (weekId: string) => {
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].competencyRate;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { rate: 0, count: 0, total: 0 };
    const week = dbWeeklyData.find(w => w.id === weekId);
    const isClubBreak = !!week?.isClubBreak;
    const hasActiveCompetency = weeklyActivities.some(
      wa => wa.week_id === weekId && wa.is_active && competencyTypeIds.includes(wa.activity_type_id)
    );
    const total = isClubBreak ? (hasActiveCompetency ? 1 : 0) : 1;
    const competencyCount = competencyTypeIds.some(activityTypeId =>
      isEnhancementSuccess(weekId, activityTypeId)
    ) ? 1 : 0;
    return { count: competencyCount, total, rate: total > 0 ? Math.ceil((competencyCount / total) * 100) : 0 };
  };

  // 주차별 실무 경험 강화율 (experience) — cluster-4-card / ranking API 와 정합: per-user 레코드 기반.
  // 운영진이 크루별로 실무 경험 라인을 임의 대체/지정 가능 → weeklyActivities.is_active=true (전체
  // 일괄 개설) + eligibility 윈도우 만으로는 분모 판정 부정확. source of truth = user_activity_records
  // 존재 여부 (어드민이 강화 성공/실패 마크 또는 크루 이행 인증 시 생성).
  // 분모 = 이 크루의 그 주차 records 중 experience 클러스터 라인의 distinct 개수.
  const getWeeklyExperienceRate = (weekId: string) => {
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].experienceRate;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { rate: 0, count: 0, total: 0 };
    const weekData = dbWeeklyData.find(w => w.id === weekId);
    if (!weekData) {
      return { count: 0, total: 0, rate: 0 };
    }

    const userExperienceTypeIds = new Set<string>();
    userActivities.forEach(a => {
      if (a.week_id === weekId && experienceTypeIds.includes(a.activity_type_id)) {
        userExperienceTypeIds.add(a.activity_type_id);
      }
    });

    const eligibleTotal = userExperienceTypeIds.size;
    const experienceCount = Array.from(userExperienceTypeIds).filter(activityTypeId =>
      isEnhancementSuccess(weekId, activityTypeId)
    ).length;

    return {
      count: experienceCount,
      total: eligibleTotal,
      rate: eligibleTotal > 0 ? Math.ceil((experienceCount / eligibleTotal) * 100) : 0
    };
  };

  // 주차별 실무 경력 강화율 (career) - career_projects 기반, 최대 5개 제한
  // P(분모) = 해당 주차에 개설된 경력 프로젝트 수 (career_projects)
  // R(분자) = 해당 주차에 완료(enhanced)한 경력 프로젝트 수 (career_records)
  const getWeeklyCareerRate = (weekId: string) => {
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].careerRate;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { rate: 0, count: 0, total: 0 };
    // 온보딩 주차도 강화율 정상 계산

    // P(분모) = 해당 주차 경력 프로젝트 수 (career_projects 기반, 최대 5개)
    const rawTotal = careerProjectsByWeek.get(weekId) || 0;
    const total = Math.min(rawTotal, 5);

    // R(분자) = enhanced 상태인 경력 프로젝트 수 (최대 P개)
    const weekCareerRecords = userCareerRecords.filter(cr => cr.week_id === weekId);
    const enhancedCount = weekCareerRecords.filter(cr => cr.enhancement_status === 'enhanced').length;
    const count = Math.min(enhancedCount, total);

    // 소수점 올림 처리
    return { count, total, rate: total > 0 ? Math.ceil((count / total) * 100) : 0 };
  };

  // 주차별 전체 성장률(k) 계산 (모든 실무 카테고리 합산)
  // k = {(a' + b' + c' + d') / (a + b + c + d)} * 100% (소수점 올림)
  // 주의: 각 파트 강화율(p,q,r,s)은 k 계산에 포함되지 않음
  const getWeeklyGrowthRate = (weekId: string) => {
    if (DUMMY_WEEK_EXTRA[weekId]) return DUMMY_WEEK_EXTRA[weekId].growthRate;
    if (weekId.startsWith('dummy') || weekId.startsWith('dw-')) return { rate: 0, count: 0, total: 0 };

    // 온보딩 주차는 무조건 성장(성공) → 100%
    if (onboardingWeekId && weekId === onboardingWeekId) {
      return { count: 0, total: 0, rate: 100 };
    }

    const info = getWeeklyInfoRate(weekId);
    const competency = getWeeklyCompetencyRate(weekId);
    const experience = getWeeklyExperienceRate(weekId);
    const career = getWeeklyCareerRate(weekId);

    const totalCount = info.count + competency.count + experience.count + career.count;
    const totalMax = info.total + competency.total + experience.total + career.total;
    // 소수점 올림 처리: ex) 84.522323… → 85%
    const rate = totalMax > 0 ? Math.ceil((totalCount / totalMax) * 100) : 0;

    return { count: totalCount, total: totalMax, rate };
  };

  // 프로필 API 결과 처리 헬퍼 함수 (fetchWeeklyData와 통합됨)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processProfileResult = (result: any) => {
    // 성장 기간 집계 데이터 설정
    if (result.growthPeriodStats) {
      setGrowthPeriodStats(result.growthPeriodStats);
    }

    // 성장 시작/종료 주차 정보 설정
    if (result.growthInfo) {
      setStartWeekInfo(result.growthInfo.startWeekInfo || null);
      setEndWeekInfo(result.growthInfo.endWeekInfo || null);
      setUserStatus(result.growthInfo.status || null);
      setGrowthStatus(result.growthInfo.growthStatus || null);
    }

    // user_profiles.role 기본값 저장
    if (result.data?.role) {
      setUserDefaultRole(result.data.role);
    }

    // profile API에서 제공하는 teams, parts, userTeamParts 사용 (중복 쿼리 제거)
    if (result.teams) {
      setTeams(result.teams);
    }
    if (result.parts) {
      setParts(result.parts);
    }
    if (result.userTeamParts) {
      setUserTeamParts(result.userTeamParts);
    }

    // 시즌 카드 데이터 설정
    const seasonNameMap: { [key: string]: string } = {
      'spring': '봄',
      'summer': '여름',
      'fall': '가을',
      'winter': '겨울'
    };

    if (result.seasonHistories && result.seasonHistories.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cards: SeasonCardData[] = result.seasonHistories.map((sh: any) => ({
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
  };

  // 성장 상태를 badge 텍스트로 변환 (status와 growth_status 두 개 사용)
  const getGrowthBadgeText = (status: string | null, growthStatus: string | null): string => {
    // 1. 성장 완료 체크 (최우선)
    if (
      status === 'graduated' ||
      growthStatus === '졸업 완료' ||
      growthStatus === '졸업 절차 중'
    ) {
      return '성장 완료';
    }

    // 2. 성장 중단 체크
    if (
      status === 'suspended' ||
      growthStatus === '활동 중단' ||
      growthStatus === '활동 유보'
    ) {
      return '성장 중단';
    }

    // 3. 성장 휴식 체크
    if (
      status === 'weekly_rest' ||
      status === 'seasonal_rest' ||
      growthStatus === '주차 휴식 중' ||
      growthStatus === '시즌 휴식 중' ||
      growthStatus === '공식 휴식 중'
    ) {
      return '성장 휴식';
    }

    // 4. 기본값
    return '성장 진행 중';
  };

  // 유저 가입 주차 시작일 상태
  const [joinedWeekStartDate, setJoinedWeekStartDate] = useState<string | null>(null);

  // DB에서 주차 데이터 가져오기
  useEffect(() => {
    if (isDemoMode) return; // 더미 모드면 API 안 부름

    const abortController = new AbortController();
    const currentTargetUserId = targetUserId; // 현재 요청 시점의 targetUserId 저장

    const fetchWeeklyData = async () => {
      try {
        setIsLoadingWeeks(true);
        const today = new Date().toISOString().split('T')[0];

        // 시즌 이름 변환 맵
        const seasonNameMap: { [key: string]: string } = {
          'spring': '봄',
          'summer': '여름',
          'fall': '가을',
          'winter': '겨울'
        };

        // 0. 현재 유저의 가입 주차 정보 가져오기 (프로필 API 사용)
        let userJoinedWeekStartDate: string | null = null;
        let userId: string | null = null;
        let apiActivityWeekIds: string[] = [];
        let apiRestWeekIds: string[] = [];
        let apiOnboardingWeekId: string | null = null;
        let apiActivityDetails: any[] = [];

        try {
          const apiUrl = currentTargetUserId ? `/api/profile?userId=${currentTargetUserId}` : '/api/profile';
          const response = await fetch(apiUrl, { signal: abortController.signal });
          const result = await response.json();

          if (response.ok && result.data?.id) {
            userId = result.data.id;
          }

          // 비로그인 또는 비승인 사용자: 주차 카드를 표시하지 않음
          if (!userId && !currentTargetUserId) {
            if (response.status === 401) {
              // 로그인하지 않은 경우
              setIsNotLoggedIn(true);
            } else if (response.status === 404) {
              // 로그인은 했지만 승인 안 된 경우 (404: 승인된 프로필 없음)
              setIsPendingApproval(true);
            }
            setDbWeeklyData([]);
            setIsLoadingWeeks(false);
            return;
          }

          if (response.ok && result.growthInfo?.startDate) {
            userJoinedWeekStartDate = result.growthInfo.startDate;
            setJoinedWeekStartDate(userJoinedWeekStartDate);
          }

          // API에서 활동/휴식 주차 ID 가져오기
          if (response.ok && result.activityWeekIds) {
            apiActivityWeekIds = result.activityWeekIds;
          }
          if (response.ok && result.restWeekIds) {
            apiRestWeekIds = result.restWeekIds;
          }
          // API에서 역할 이력 가져오기
          if (response.ok && result.userRoleHistory) {
            setUserRoleHistory(result.userRoleHistory);
          }
          // API에서 2차 정보(activityDetails) 가져오기 (RLS 우회 - service role key 사용)
          if (response.ok && result.activityDetails) {
            apiActivityDetails = result.activityDetails;
          }
          // API에서 온보딩 주차 ID 가져오기
          if (response.ok && result.onboardingWeekId) {
            apiOnboardingWeekId = result.onboardingWeekId;
            setOnboardingWeekId(apiOnboardingWeekId);
          }

          // 프로필 API 결과로 성장 데이터 설정 (기존 fetchGrowthStats 역할 통합)
          if (response.ok) {
            processProfileResult(result);
          }

          // 요청 중 targetUserId가 바뀌었으면 중단
          if (abortController.signal.aborted) return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          console.error('Failed to fetch profile:', err);
          setIsLoadingSeasons(false);
        }

        // 주차 카드 phase 시간 기준 (KST, 월요일 00:00 기준 누적)
        //   - VISIBLE_OFFSET_MINUTES  = N(월) 00:01   = 1m       → 카드 노출 + '진행 중' 시작
        //   - COUNTING_START_HOURS    = N(일) 00:00   = 144h     → '집계 중' 시작 (보라 → 핑크)
        //   - RESULT_DECIDED_MINUTES  = N+1(목) 12:01 = 252h 1m  → 성장 성공/실패/휴식 결정 (weeklyGrowth 반영)
        //     라인 카드 '강화 대기 → 강화 성공' 도 동일 시점에 확정 — computeResultDecidedMs 참고
        const VISIBLE_OFFSET_MINUTES = 1;
        const COUNTING_START_HOURS = 144;
        const RESULT_DECIDED_MINUTES = 252 * 60 + 1;
        const cutoffDateStr = new Date(Date.now() + 9 * 3600 * 1000 - VISIBLE_OFFSET_MINUTES * 60 * 1000)
          .toISOString()
          .split('T')[0];
        let weeksQuery = supabase
          .from('weeks')
          .select('id, week_number, start_date, end_date, is_club_break, holiday_name, seasons (id, year, name, term_number)')
          .lte('start_date', cutoffDateStr)
          .order('start_date', { ascending: false });

        // 가입 주차 이후만 필터링
        if (userJoinedWeekStartDate) {
          weeksQuery = weeksQuery.gte('start_date', userJoinedWeekStartDate);
        }

        const { data: weeksData, error: weeksError } = await weeksQuery;

        if (weeksError) throw weeksError;

        // 2. API에서 받은 활동/휴식 주차 ID 사용
        const activityWeekIds = new Set<string>(apiActivityWeekIds);
        const restWeekIds = new Set<string>(apiRestWeekIds);

        // 사용자의 주차 ID 목록 추출 (weekly_activities 필터링용)
        const userWeekIds = weeksData?.map(w => w.id) || [];

        // user_weekly_growth 데이터 가져오기 (성장 상태 결정용)
        let userWeeklyGrowthMap = new Map<string, { is_success: boolean; is_resting: boolean; is_club_break: boolean }>();
        if (userId) {
          // 모든 데이터 병렬로 가져오기 (성능 최적화)
          const [
            weeklyGrowthResult,
            userPointsResult,
            userActivitiesResult,
            activityTypesResult,
            careerRecordsResult,
            weeklyActivitiesResult,
            careerProjectsResult
          ] = await Promise.all([
            // user_weekly_growth
            supabase.from('user_weekly_growth').select('week_id, is_success, is_resting, is_club_break').eq('user_id', userId),
            // points
            supabase.from('points').select('id, user_id, week_id, point_type, points').eq('user_id', userId),
            // activity_records — is_completed 무관 전체 fetch (실무 경험 분모 판정용 per-user 레코드).
            // is_completed=true 인 것만 강화 성공 판정에 사용 (isEnhancementSuccess 에서 명시 체크).
            supabase.from('activity_records').select('id, user_id, week_id, activity_type_id, is_completed').eq('user_id', userId),
            // activity_types
            supabase.from('activity_types').select('id, cluster_id, name, eligible_min_approved_weeks, eligible_max_approved_weeks, count_once_in_total').eq('is_active', true),
            // career_records
            supabase.from('career_records').select('id, user_id, week_id, project_id, enhancement_status, weeks!career_records_week_id_fkey(id, start_date, end_date)').eq('user_id', userId).in('enhancement_status', ['pending', 'enhanced']),
            // weekly_activities - 사용자의 주차만 필터링 (1000개 제한 우회) + opened_at 추가
            userWeekIds.length > 0
              ? supabase.from('weekly_activities').select('week_id, activity_type_id, is_active, opened_at, deadline').in('week_id', userWeekIds)
              : Promise.resolve({ data: [], error: null }),
            // career_projects - 주차별 프로젝트 수 (total 계산용)
            userWeekIds.length > 0
              ? supabase.from('career_projects').select('id, week_id').eq('is_active', true).in('week_id', userWeekIds)
              : Promise.resolve({ data: [], error: null })
          ]);

          // user_weekly_growth 처리
          if (weeklyGrowthResult.data) {
            weeklyGrowthResult.data.forEach((wg) => {
              userWeeklyGrowthMap.set(wg.week_id, {
                is_success: wg.is_success,
                is_resting: wg.is_resting,
                is_club_break: wg.is_club_break
              });
            });
          }
          // profile API에서 이미 제공하는 데이터 사용 (teams, parts, userTeamParts는 processProfileResult에서 처리됨)
          if (userPointsResult.data) setUserPoints(userPointsResult.data);
          if (userActivitiesResult.data) setUserActivities(userActivitiesResult.data);
          if (weeklyActivitiesResult.data) setWeeklyActivities(weeklyActivitiesResult.data);
          // activityDetails는 profile API에서 가져온 데이터 사용 (RLS로 인해 클라이언트 직접 쿼리 불가)
          if (apiActivityDetails.length > 0) setActivityDetails(apiActivityDetails);
          if (careerRecordsResult.data) {
            setUserCareerRecords(careerRecordsResult.data as CareerRecordData[]);
          }
          // career_projects → 주차별 프로젝트 수 맵 생성
          if (careerProjectsResult.data) {
            const projectMap = new Map<string, number>();
            careerProjectsResult.data.forEach((p: { week_id: string }) => {
              projectMap.set(p.week_id, (projectMap.get(p.week_id) || 0) + 1);
            });
            setCareerProjectsByWeek(projectMap);
          }

          // activity_types에서 클러스터별 ID 분류
          if (activityTypesResult.data) {
            const infoIds: string[] = [];
            const competencyIds: string[] = [];
            const experienceIds: string[] = [];
            const careerIds: string[] = [];
            activityTypesResult.data.forEach((at: { id: string; cluster_id: string }) => {
              if (at.cluster_id === 'practical_info') {
                infoIds.push(at.id);
              } else if (at.cluster_id === 'practical_competency') {
                competencyIds.push(at.id);
              } else if (at.cluster_id === 'practical_experience') {
                experienceIds.push(at.id);
              } else if (at.cluster_id === 'practical_career') {
                careerIds.push(at.id);
              }
            });
            setInfoTypeIds(infoIds);
            setCompetencyTypeIds(competencyIds);
            setExperienceTypeIds(experienceIds);
            setCareerTypeIds(careerIds);
          }
        }

        // break 시즌 이름 파싱 (spring_summer_break -> "여름", 전환 주차로 표시)
        const parseBreakSeasonName = (rawName: string): { displayName: string; isBreak: boolean; fromSeason: string | null; toSeason: string | null } => {
          if (!rawName || !rawName.toLowerCase().includes('break')) {
            return { displayName: seasonNameMap[rawName] || rawName, isBreak: false, fromSeason: null, toSeason: null };
          }
          // spring_summer_break -> ['spring', 'summer'] -> "여름" (다음 시즌 이름)
          const parts = rawName.replace('_break', '').split('_');
          if (parts.length >= 2) {
            const from = seasonNameMap[parts[0]] || parts[0];
            const to = seasonNameMap[parts[1]] || parts[1];
            return { displayName: to, isBreak: true, fromSeason: from, toSeason: to };
          }
          return { displayName: rawName, isBreak: true, fromSeason: null, toSeason: null };
        };

        // 5. 데이터 변환 (break 시즌도 포함)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedData: DBWeekData[] = (weeksData || []).map((week: any) => {
          const seasonData = week.seasons;
          const rawSeasonName = seasonData?.name || '';
          const { displayName: seasonName, isBreak: isBreakSeason, fromSeason: breakFromSeason, toSeason: breakToSeason } = parseBreakSeasonName(rawSeasonName);

          // 성장 상태 결정 (공식 휴식 → 개인 휴식 → 시간 phase → 온보딩/weeklyGrowth/폴백)
          // 휴식만 phase 우회 — 온보딩 주차도 일반 phase(진행 중 → 집계 중) 거치고 결정 시점에 무조건 성공.
          let status = '실패';

          const weeklyGrowthForWeek = userWeeklyGrowthMap.get(week.id);
          const isOnboardingThisWeek = !!(apiOnboardingWeekId && week.id === apiOnboardingWeekId);
          const userIsOnOfficialRestForWeek = !isOnboardingThisWeek && (
            isBreakSeason
            || !!weeklyGrowthForWeek?.is_club_break
            || (!weeklyGrowthForWeek && !!week.is_club_break)
          );
          const userIsOnPersonalRestForWeek = !isOnboardingThisWeek && !userIsOnOfficialRestForWeek && (
            !!weeklyGrowthForWeek?.is_resting
            || (!weeklyGrowthForWeek && restWeekIds.has(week.id))
          );

          if (userIsOnOfficialRestForWeek) {
            // 클럽 공식 휴식 주차(전환 주차 포함)는 phase 우회하고 카드 노출 시점부터 바로 '휴식(공식)'.
            status = '휴식(공식)';
          } else if (userIsOnPersonalRestForWeek) {
            // 개인 휴식 크루도 phase 우회하고 카드 노출 시점부터 바로 '휴식(개인)'.
            status = '휴식(개인)';
          } else {
            // 주차 시작(월 00:00 KST)으로부터 경과 시간 산출
            const weekStartMs = new Date(week.start_date + 'T00:00:00+09:00').getTime();
            const elapsedMs = Date.now() - weekStartMs;
            const hoursSinceStart = elapsedMs / 3600000;
            const minutesSinceStart = elapsedMs / 60000;

            if (minutesSinceStart >= VISIBLE_OFFSET_MINUTES && hoursSinceStart < COUNTING_START_HOURS) {
              // (월) 00:01 ~ (일) 00:00 — 보라색 '진행 중'
              status = '진행 중';
            } else if (hoursSinceStart >= COUNTING_START_HOURS && minutesSinceStart < RESULT_DECIDED_MINUTES) {
              // (일) 00:00 ~ N+1(목) 12:01 — 핑크 '집계 중'
              status = '집계 중';
            } else if (isOnboardingThisWeek) {
              // N+1(목) 12:01 이후 — 온보딩(무적) 주차는 무조건 성공.
              status = '성공';
            } else if (weeklyGrowthForWeek) {
              status = weeklyGrowthForWeek.is_success ? '성공' : '실패';
            } else if (activityWeekIds.has(week.id)) {
              status = '성공';
            }
          }

          return {
            id: week.id,
            weekNumber: week.week_number,
            seasonYear: seasonData?.year || 0,
            seasonName,
            startDate: week.start_date,
            endDate: week.end_date,
            isClubBreak: (apiOnboardingWeekId && week.id === apiOnboardingWeekId) ? false : (week.is_club_break || isBreakSeason),
            isBreakSeason, // 전환 주차 여부
            fromSeason: breakFromSeason,
            toSeason: breakToSeason,
            holidayName: week.holiday_name,
            termNumber: seasonData?.term_number ? Number(seasonData.term_number) : null,
            growthStatus: status
          };
        }) as DBWeekData[];

        // 요청 중 targetUserId가 바뀌지 않았는지 확인
        if (abortController.signal.aborted) return;

        setDbWeeklyData(formattedData);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error("주차 데이터 로드 오류:", error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingWeeks(false);
        }
      }
    };

    if (targetUserId) {
      fetchWeeklyData();
    } else {
      setIsLoadingWeeks(false);
    }

    return () => {
      abortController.abort();
    };
  }, [targetUserId]);

  // 버튼 위치 업데이트
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

  // 드롭다운 옵션 - dbWeeklyData에서 유니크한 시즌 추출
  const seasonOptions = React.useMemo(() => {
    // 시즌 순서 매핑 (정렬용 - 겨울 시작)
    const seasonOrder: { [key: string]: number } = {
      '겨울': 1,
      '봄': 2,
      '여름': 3,
      '가을': 4
    };

    // 유니크한 (년도, 시즌) 조합 추출
    const uniqueSeasons = new Map<string, { year: number; season: string }>();
    dbWeeklyData.forEach(week => {
      const key = `${week.seasonYear}-${week.seasonName}`;
      if (!uniqueSeasons.has(key)) {
        uniqueSeasons.set(key, { year: week.seasonYear, season: week.seasonName });
      }
    });

    // 배열로 변환 후 정렬 (년도 내림차순, 시즌 순서)
    const seasons = Array.from(uniqueSeasons.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year; // 년도 내림차순
        return (seasonOrder[b.season] || 0) - (seasonOrder[a.season] || 0); // 시즌 내림차순
      })
      .map(s => `${s.year}년, ${s.season} 시즌`);
    return ["전체", ...seasons];
  }, [dbWeeklyData]);

  const resultOptions = [
    "전체 (all)",
    "성장 (성공)",
    "성장 (실패)",
    "휴식 (개인)",
    "휴식 (공식)",
  ];

  // DB 데이터 기반 필터링
  const filteredDbData = dbWeeklyData.filter((week) => {
    // 시즌 필터
    let seasonMatch = true;
    if (selectedSeason !== "역대 시즌" && selectedSeason !== "전체") {
      // "2025년, 여름 시즌" → year: 2025, season: 여름
      const seasonParts = selectedSeason.replace("년,", "").split(" ");
      const year = parseInt(seasonParts[0]); // 2025
      const season = seasonParts[1]; // "여름", "봄", "가을", "겨울"
      seasonMatch = week.seasonYear === year && week.seasonName === season;
    }

    // 결과 필터
    let resultMatch = true;
    if (selectedResult !== "주차 결과" && selectedResult !== "전체 (all)") {
      if (selectedResult === "성장 (성공)") {
        resultMatch = week.growthStatus === "성공";
      } else if (selectedResult === "성장 (실패)") {
        resultMatch = week.growthStatus === "실패";
      } else if (selectedResult === "휴식 (개인)") {
        resultMatch = week.growthStatus === "휴식(개인)";
      } else if (selectedResult === "휴식 (공식)") {
        resultMatch = week.growthStatus === "휴식(공식)";
      }
    }

    return seasonMatch && resultMatch;
  });

  // 페이지네이션 설정
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDbData.length / itemsPerPage));
  const paginatedDbData = filteredDbData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 날짜 포맷 함수 (2026-01-05 → 2026 - 01 - 05 (월))
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = days[date.getDay()];
    return `${year} - ${month} - ${day} (${dayOfWeek})`;
  };

  // 필터 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSeason, selectedResult]);

  // 타이틀에서 이미지 경로 생성 (월/주 정보로 실제 시즌 주차 계산)
  const getImagePath = (title: string) => {
    // "2025 여름 시즌, 8주차 (8월 4주차)" → 괄호 안의 월/주 정보 추출
    const match = title.match(/\((\d+)월\s*(\d+)주차\)/);
    if (match) {
      const month = parseInt(match[1]);
      const weekInMonth = parseInt(match[2]);

      // 월별 시즌 및 주차 매핑
      let season = "";
      let weekNum = 0;
      let suffix = ""; // 특수 파일명 접미사

      if (month === 1) {
        season = "겨울";
        weekNum = weekInMonth; // 1월 1주 = 겨울 1주
      } else if (month === 2) {
        season = "겨울";
        weekNum = 4 + weekInMonth; // 2월 1주 = 겨울 5주
        // 특수 케이스: 2월 2주차는 "설,구정" 접미사
        if (weekInMonth === 2) {
          suffix = " 설,구정";
        }
      } else if (month === 3) {
        season = "봄";
        weekNum = weekInMonth; // 3월 1주 = 봄 1주
      } else if (month === 4) {
        season = "봄";
        weekNum = 4 + weekInMonth; // 4월 1주 = 봄 5주
      } else if (month === 5) {
        season = "봄";
        weekNum = 8 + weekInMonth; // 5월 1주 = 봄 9주
      } else if (month === 6) {
        season = "봄";
        weekNum = 12 + weekInMonth; // 6월 1주 = 봄 13주
      } else if (month === 7) {
        season = "여름";
        weekNum = weekInMonth; // 7월 1주 = 여름 1주
      } else if (month === 8) {
        season = "여름";
        weekNum = 4 + weekInMonth; // 8월 1주 = 여름 5주
      } else if (month === 9) {
        season = "가을";
        weekNum = weekInMonth; // 9월 1주 = 가을 1주
      } else if (month === 10) {
        season = "가을";
        weekNum = 4 + weekInMonth; // 10월 1주 = 가을 5주
      } else if (month === 11) {
        season = "가을";
        weekNum = 8 + weekInMonth; // 11월 1주 = 가을 9주
      } else if (month === 12) {
        season = "가을";
        weekNum = 12 + weekInMonth; // 12월 1주 = 가을 13주
      }

      return `/images/0/cluster4/주차 이미지/${season} ${weekNum}주차 (${month}월 ${weekInMonth}주차${suffix}).png`;
    }
    return "/images/0/cluster4/주차 이미지/여름 1주차 (7월 1주차).png";
  };

  // DB 주차 데이터에서 이미지 경로 생성 (시즌명과 주차번호로 월/주차 계산)
  // primary 는 holiday_name 접미사를 포함한 1차 경로, stripped 는 holiday 없는 폴백.
  // (holiday_name 에 '시험 기간' 같이 디스크 파일에 없는 값이 들어와도 stripped 로 자동 복구)
  const getWeekImagePath = (week: DBWeekData): { primary: string; stripped: string } => {
    // 더미 데이터용 이미지 매핑
    if (week.id.startsWith('dummy')) {
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
      const dummy = dummyImages[week.id] || '/images/0/cluster4/주차 이미지/휴식(개인,공식).png';
      return { primary: dummy, stripped: dummy };
    }

    // 전환 주차 (break season) → 중간 주차 이미지 사용 (온보딩 주차는 정상 이미지)
    if (week.isBreakSeason && !(onboardingWeekId && week.id === onboardingWeekId) && week.fromSeason && week.toSeason) {
      const mid = `/images/0/cluster4/주차 이미지/중간 주차 (${week.fromSeason}-${week.toSeason}).png`;
      return { primary: mid, stripped: mid };
    }

    // 시즌별 시작 월 매핑 (cluster-4-card와 동일한 로직)
    const seasonStartMonth: { [key: string]: number } = {
      '겨울': 1,
      '봄': 3,
      '여름': 7,
      '가을': 9
    };

    // 온보딩 주차가 break 시즌에 속하면 toSeason(다음 시즌)으로 이미지 경로 생성
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

  // 주차 카드 이미지 onError 핸들러 — primary(holiday 접미사) → stripped → 휴식(개인,공식) 순서로 폴백.
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
          <div className="tab" style={{ width: '44px', height: '44px', background: '#FAAB07' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20%EC%A0%84%EA%B5%AC.png" alt="전구" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(`/cluster-4${targetUserId ? `?userId=${targetUserId}` : ''}`)}>
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </div>
          </div>
          <div className="tab" style={{ width: '44px', height: '44px', background: '#161816' }}>
            <img src="/images/0/cluster4/icon/icon%20-%20book.png" alt="book" className="tab-icon" />
            <div className="tab-badge" onClick={() => router.push(`/cluster-4-1${targetUserId ? `?userId=${targetUserId}` : ''}`)}>
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
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" stroke="#FAAB07" strokeWidth="1.69311" fill="none"/>
                </svg>
                <svg className="badge-border" viewBox="0 0 124 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.84668 0.846558H122.847V26.7666L98.4467 48.8466H0.84668V0.846558Z" fill="#FAAB07" stroke="#FAAB07" strokeWidth="1.69311"/>
                </svg>
                <span className="badge-text">{getGrowthBadgeText(userStatus, growthStatus)}</span>
              </div>
            </div>

            {/* Add new collection 카드 */}
            <div className="collection-card">
              <div className="collection-icon">
                <img src="/images/0/cluster4/아호%20캐릭터.png" alt="아호 캐릭터" />
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
                    <span className="number">{growthPeriodStats?.approvedWeeks ?? '-'}</span>{growthPeriodStats?.approvedSeasons ? <span className="orange-highlight">({growthPeriodStats.approvedSeasons})</span> : null} <span className="white-text">개 주차</span>
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
                    <span className="number">{growthPeriodStats?.restWeeks ?? '-'}</span>{growthPeriodStats?.restSeasons ? <span className="orange-highlight">({growthPeriodStats.restSeasons})</span> : null} <span className="white-text">개 주차</span>
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
                borderColor: selectedSeason !== "역대 시즌" ? '#FFA500' : 'rgba(255, 255, 255, 0.12)',
                background: selectedSeason !== "역대 시즌" ? 'rgba(255, 165, 0, 0.1)' : 'transparent',
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
                <span className="card-label" style={{ color: selectedSeason !== "역대 시즌" ? '#FFA500' : '#fff' }}>{selectedSeason}</span>
              </div>
              <span className={`card-arrow ${seasonDropdownOpen ? 'open' : ''}`} style={{ color: selectedSeason !== "역대 시즌" ? '#FFA500' : '#fff' }}>▼</span>
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
                        color: selectedSeason === option ? '#FFA500' : '#fff',
                        background: selectedSeason === option ? 'rgba(255,165,0,0.2)' : 'transparent',
                        cursor: 'pointer',
                        borderBottom: index < seasonOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                      onClick={() => {
                        setSelectedSeason(option);
                        setSeasonDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSeason !== option) {
                          e.currentTarget.style.background = 'rgba(255,165,0,0.1)';
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
                borderColor: selectedResult !== "주차 결과" ? '#FFA500' : 'rgba(255, 255, 255, 0.12)',
                background: selectedResult !== "주차 결과" ? 'rgba(255, 165, 0, 0.1)' : 'transparent',
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
                <span className="card-label" style={{ color: selectedResult !== "주차 결과" ? '#FFA500' : '#fff' }}>{selectedResult}</span>
              </div>
              <span className={`card-arrow ${resultDropdownOpen ? 'open' : ''}`} style={{ color: selectedResult !== "주차 결과" ? '#FFA500' : '#fff' }}>▼</span>
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
                        color: selectedResult === option ? '#FFA500' : '#fff',
                        background: selectedResult === option ? 'rgba(255,165,0,0.2)' : 'transparent',
                        cursor: 'pointer',
                        borderBottom: index < resultOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                      onClick={() => {
                        setSelectedResult(option);
                        setResultDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (selectedResult !== option) {
                          e.currentTarget.style.background = 'rgba(255,165,0,0.1)';
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
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>현재 해당하는 주차가 없습니다.</div>
          ) : (
            (isMobile ? filteredDbData.slice(0, mobileVisibleCount) : paginatedDbData).map((week) => {
              const weekHref = `/cluster-4-card/${week.id}${targetUserId ? `?userId=${targetUserId}` : ''}`;
              const isExpanded = expandedWeekId === week.id;
              const isRest = week.growthStatus.includes('휴식');
              // 개인 휴식 → 항상 '-'. 공식 휴식 → 이 크루에게 활동 기록 있을 때만 정상 계산 (예외 케이스).
              const isPersonalRest = week.growthStatus === '휴식(개인)';
              const isClubBreak = !!week.isClubBreak;
              const crewHasActivityThisWeek = userActivities.some(a => a.week_id === week.id);
              const isClubBreakNoActivity = isClubBreak && !crewHasActivityThisWeek;
              const isOnboarding = !!(onboardingWeekId && week.id === onboardingWeekId);
              const hideStats = isPersonalRest || isOnboarding || isClubBreakNoActivity;
              const hideGrowth = isPersonalRest || isClubBreakNoActivity;
              const growthRate = getWeeklyGrowthRate(week.id);

              if (isMobile) {
                return (
                  <div
                    key={week.id}
                    className={`weekly-card weekly-card--mobile ${isExpanded ? "is-expanded" : ""}`}
                  >
                    <Link
                      href={weekHref}
                      className="weekly-card-main"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className={`weekly-card-image ${week.growthStatus === '휴식(개인)' || week.growthStatus === '실패' ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': week.growthStatus === '실패' ? '#ff6b6b' : week.growthStatus === '휴식(개인)' ? '#65e3ff' : week.growthStatus === '휴식(공식)' ? '#ffea48' : week.growthStatus === '진행 중' ? '#9b59b6' : week.growthStatus === '집계 중' ? '#ff1493' : '#9dfa07' } as React.CSSProperties}>
                        {(() => { const paths = getWeekImagePath(week); return (
                          <img src={paths.primary} alt={`${week.seasonYear}년, ${week.seasonName} 시즌, ${week.isBreakSeason ? '전환 주차' : `${week.weekNumber}주차`}`} data-stripped-src={paths.stripped !== paths.primary ? paths.stripped : undefined} onError={handleWeekImageError} />
                        ); })()}
                        <div className="image-badges">
                          <div className={`badge-tag ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>{week.growthStatus.includes('휴식') ? week.growthStatus.replace('(', ' (') : `성장 (${week.growthStatus})`}</div>
                        </div>
                      </div>

                      <div className="weekly-card-content">
                        <div className="weekly-card-header">
                          <h4 className="weekly-card-title">{week.seasonYear}년, <span className="season-name-fixed">{week.seasonName}</span> 시즌, {week.isBreakSeason ? <><span className="week-name-fixed">전환</span> 주차</> : <><span className="week-name-fixed">{week.weekNumber}</span>주차</>}</h4>
                          <span className="weekly-card-date">
                            <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                            {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                          </span>
                        </div>

                        <div className="weekly-card-main-progress">
                          <span className="progress-label">
                            <span className="dot">·</span> 주차 성장률 <strong>{hideGrowth ? "-" : `${growthRate.rate}%`}</strong>
                          </span>
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${hideGrowth ? 0 : growthRate.rate}%` }} />
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
                        setExpandedWeekId(isExpanded ? null : week.id);
                      }}
                    >
                      {isExpanded ? "접기" : "상세"}
                    </button>

                    {isExpanded && (
                      <div className="weekly-card-details">
                        {(() => {
                          const infoRate = getWeeklyInfoRate(week.id);
                          const competencyRate = getWeeklyCompetencyRate(week.id);
                          const experienceRate = getWeeklyExperienceRate(week.id);
                          const careerRate = getWeeklyCareerRate(week.id);
                          const weekPoints = getPointsForWeek(week.id);
                          const injeolmi = getCumulativeInjeolmi(week.id);
                          const teamPart = getFormattedTeamPart(week.startDate, week);
                          const roleInfo = (week.isBreakSeason && !(onboardingWeekId && week.id === onboardingWeekId))
                            ? null
                            : (isDemoMode && DUMMY_WEEK_EXTRA[week.id] ? { roleLabel: DUMMY_WEEK_EXTRA[week.id].roleLabel } : getRoleForDate(week.startDate));

                          return (
                            <>
                              <div className="weekly-card-details-top">
                                <div className="detail-chip"><strong>[팀]</strong> {teamPart.teamName || "-"}</div>
                                <div className="detail-chip"><strong>[파트]</strong> {teamPart.partName || "-"}</div>
                                <div className="detail-chip"><strong>[역할]</strong> {roleInfo?.roleLabel || "-"}</div>
                              </div>

                              <div className="weekly-card-details-grid">
                                <div className="detail-row">
                                  <span className="k">정보 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${infoRate.rate}%`} <span className="sub">({hideStats ? "-" : infoRate.count}/{hideStats ? "-" : infoRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">역량 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${competencyRate.rate}%`} <span className="sub">({hideStats ? "-" : competencyRate.count}/{hideStats ? "-" : competencyRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">경험 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${experienceRate.rate}%`} <span className="sub">({hideStats ? "-" : experienceRate.count}/{hideStats ? "-" : experienceRate.total})</span></span>
                                </div>
                                <div className="detail-row">
                                  <span className="k">경력 강화율</span>
                                  <span className="v">{hideStats ? "-" : `${careerRate.rate}%`} <span className="sub">({hideStats ? "-" : careerRate.count}/{hideStats ? "-" : careerRate.total})</span></span>
                                </div>
                              </div>

                              <div className="weekly-card-details-bottom">
                                <div className="metric">단감 <strong>{weekPoints.star}</strong></div>
                                <div className="metric">인절미 <strong>{injeolmi}</strong></div>
                                <div className="metric">어흥 <strong>{Math.abs(weekPoints.lightning)}</strong></div>
                                <div className="metric">주차 평판 <strong>{weeklyReputationCounts[week.id] || 0}</strong><span className="sub">/4</span></div>
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
                <Link href={weekHref} key={week.id} className="weekly-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {/* 왼쪽 이미지 */}
                  <div className={`weekly-card-image ${week.growthStatus === '휴식(개인)' || week.growthStatus === '실패' ? 'rest-personal-overlay' : ''}`} style={{ '--divider-color': week.growthStatus === '실패' ? '#ff6b6b' : week.growthStatus === '휴식(개인)' ? '#65e3ff' : week.growthStatus === '휴식(공식)' ? '#ffea48' : week.growthStatus === '진행 중' ? '#9b59b6' : week.growthStatus === '집계 중' ? '#ff1493' : '#9dfa07' } as React.CSSProperties}>
                    {(() => { const paths = getWeekImagePath(week); return (
                      <img src={paths.primary} alt={`${week.seasonYear}년, ${week.seasonName} 시즌, ${week.isBreakSeason ? '전환 주차' : `${week.weekNumber}주차`}`} data-stripped-src={paths.stripped !== paths.primary ? paths.stripped : undefined} onError={handleWeekImageError} />
                    ); })()}
                    {week.growthStatus === '휴식(개인)' && (
                      <div className="rest-message">
                        <span className="rest-text-line">충분히 <span className="rest-emoji">🥰</span></span>
                        <span className="rest-text-line">쉬었나요..?</span>
                      </div>
                    )}
                    {week.growthStatus === '실패' && (
                      <div className="rest-message">
                        <span className="rest-text-line">값진 실패는 <span className="rest-emoji">😎</span></span>
                        <span className="rest-text-line">훌륭한 스승님!</span>
                      </div>
                    )}
                    <div className="image-badges">
                      <div className={`badge-tag ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>{week.growthStatus.includes('휴식') ? week.growthStatus.replace('(', ' (') : `성장 (${week.growthStatus})`}</div>
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
                      <h4 className="weekly-card-title">{week.seasonYear}년, <span className="season-name-fixed">{week.seasonName}</span> 시즌, {week.isBreakSeason ? <><span className="week-name-fixed">전환</span> 주차</> : <><span className="week-name-fixed">{week.weekNumber}</span>주차</>}</h4>
                      <span className="weekly-card-date">
                        <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                        {formatDate(week.startDate)} ~ {formatDate(week.endDate)}
                      </span>
                      <span className="weekly-card-week">
                        <img src="/images/0/cluster4/icon/icon - 7.png" alt="clock" className="week-icon" />
                        <span className="week-number num-2">{(week.growthStatus === '진행 중' || week.growthStatus === '집계 중') ? '+1' : getCumulativeApprovedWeeks(week.endDate)}</span> / <span className="num-2">25</span> 주차
                      </span>
                    </div>

                    {/* 두 번째 줄: 팀, 파트, 역할, 아이템 */}
                    <div className="weekly-card-info">
                      {/* 그룹 1: 팀, 파트 */}
                      {(() => {
                        // 전환 주차는 팀/파트/역할을 '-'로 표시
                        const teamPart = getFormattedTeamPart(week.startDate, week);
                        const roleInfo = (week.isBreakSeason && !(onboardingWeekId && week.id === onboardingWeekId))
                          ? null
                          : (isDemoMode && DUMMY_WEEK_EXTRA[week.id] ? { roleLabel: DUMMY_WEEK_EXTRA[week.id].roleLabel } : getRoleForDate(week.startDate));
                        return (
                          <>
                            <div className="info-group">
                              <span className="info-item team">
                                <strong>[팀]</strong>{' '}
                                <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{(teamPart.teamName || '-').length > 6 ? (teamPart.teamName || '-').slice(0, 6) + '..' : teamPart.teamName || '-'}</span>
                              </span>
                              <span className="info-divider">|</span>
                              <span className="info-item part">
                                <strong>[파트]</strong>{' '}
                                <span className="text-gray" style={{ display: 'inline-block', width: '109px', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{(teamPart.partName || '-').length > 6 ? (teamPart.partName || '-').slice(0, 6) + '..' : teamPart.partName || '-'}</span>
                              </span>
                            </div>
                            {/* 그룹 2: 역할 */}
                            <div className="info-group">
                              <span className="info-badge role">
                                <img src="/images/0/cluster4/icon/icon - 8.png" alt="role" className="role-icon" />
                                <span style={{ display: 'inline-block', maxWidth: '109px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Pretendard', sans-serif" }}>{truncate(roleInfo?.roleLabel, 8)}</span>
                              </span>
                            </div>
                          </>
                        );
                      })()}
                      {/* 그룹 3: 아이템들 */}
                      {(() => {
                        const weekPoints = getPointsForWeek(week.id);
                        const injeolmi = getCumulativeInjeolmi(week.id);
                        return (
                          <div className="info-group items">
                            <span className="info-divider">·</span>
                            <span className="info-item with-icon">
                              단감
                              <img src="/images/0/cluster4/icon/icon - 단감.png" alt="단감" className="item-icon" />
                              <strong className="number-value num-3">{weekPoints.star}</strong>
                              개
                            </span>
                            <span className="info-divider">·</span>
                            <span className="info-item with-icon">
                              인절미
                              <img src="/images/0/cluster4/icon/icon - 인절미.png" alt="인절미" className="item-icon" />
                              <strong className="number-value num-3">{injeolmi}</strong>
                              개
                            </span>
                            <span className="info-divider">·</span>
                            <span className="info-item with-icon">
                              어흥
                              <img src="/images/0/cluster4/icon/icon - 어흥.png" alt="어흥" className="item-icon" />
                              <strong className="number-value num-3">{Math.abs(weekPoints.lightning)}</strong>
                              개
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 세 번째 줄: 주차 성장률 프로그레스 바 */}
                    {(() => {
                      const infoRate = getWeeklyInfoRate(week.id);
                      const competencyRate = getWeeklyCompetencyRate(week.id);
                      const experienceRate = getWeeklyExperienceRate(week.id);
                      const careerRate = getWeeklyCareerRate(week.id);
                      // 개인 휴식 → 항상 '-'. 공식 휴식 → 이 크루에게 활동 기록 있을 때만 정상 계산 (예외 케이스).
                      const isPersonalRest = week.growthStatus === '휴식(개인)';
                      const isClubBreak = !!week.isClubBreak;
                      const crewHasActivityThisWeek = userActivities.some(a => a.week_id === week.id);
                      const isClubBreakNoActivity = isClubBreak && !crewHasActivityThisWeek;
                      const hideStats = isPersonalRest || isOnboarding || isClubBreakNoActivity;
                      const hideGrowth = isPersonalRest || isClubBreakNoActivity;
                      // 평판/명성도/연계동료는 휴식 주차 모두 '-' 처리 (예외 활동과 무관)
                      const isRest = week.growthStatus.includes('휴식');

                      return (
                        <>
                          <div className="weekly-card-main-progress">
                            <span className="progress-label"><span className="dot">·</span> 주차 성장률 <strong><span className="num-3">{hideGrowth ? '-' : growthRate.rate}</span>%</strong></span>
                            <div className="progress-bar-wrapper">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${hideGrowth ? 0 : growthRate.rate}%` }}></div>
                              </div>
                            </div>
                            <span className="total-count">
                              <img src="/images/0/cluster4/icon/icon - 0.png" alt="leaf" className="leaf-icon" />
                              총 <span className="num-3">{hideStats ? '-' : growthRate.total}</span> 개 중 <strong><span className="num-3">{hideStats ? '-' : growthRate.count}</span></strong> 개
                            </span>
                          </div>

                          {/* 네 번째, 다섯 번째 줄: 스탯들 */}
                          <div className={`weekly-card-stats-wrapper ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>
                            <div className="weekly-card-stats">
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>정보</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : infoRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : infoRate.count}</span>/<span className="num-2">{hideStats ? '-' : infoRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>역량</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : competencyRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : competencyRate.count}</span>/<span className="num-2">{hideStats ? '-' : competencyRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>경험</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : experienceRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : experienceRate.count}</span>/<span className="num-2">{hideStats ? '-' : experienceRate.total}</span>)</span></span>
                              <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>경력</span> 강화율 <strong><span className="num-3">{hideStats ? '-' : careerRate.rate}</span>%</strong> <span className="gray">(<span className="num num-2">{hideStats ? '-' : careerRate.count}</span>/<span className="num-2">{hideStats ? '-' : careerRate.total}</span>)</span></span>
                            </div>
                            <div className="weekly-card-extra-stats">
                              <span className="stat"><span className="dot">·</span> <span className="label">주차 평판</span> <span className="num num-1">{isRest ? '-' : (weeklyReputationCounts[week.id] || 0)}</span><span className="white">/<span className="num-1">4</span></span></span>
                              <span className="stat"><span className="dot">·</span> <span className="label">명성도(FM)</span> <span className="num num-4">{isRest ? '-' : (weeklyFmScores[week.id] ?? 0)}</span></span>
                              <span className="stat"><span className="dot">·</span> <span className="label">연계 동료</span> <span className="num num-1">{isRest ? '-' : (weeklyColleagueCounts[week.id] ?? 0)}</span><span className="white">/<span className="num-1">3</span></span></span>
                              <span className="stat empty"></span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* 우측 성장 상태 */}
                  <div className={`weekly-card-status-badge ${week.growthStatus === '실패' ? 'fail' : ''} ${week.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${week.growthStatus === '휴식(공식)' ? 'rest-official' : ''} ${week.growthStatus === '진행 중' ? 'in-progress' : ''} ${week.growthStatus === '집계 중' ? 'counting' : ''}`}>
                    <span className="status-text">{week.growthStatus.includes('휴식') ? week.growthStatus.replace('(', ' (') : `성장 (${week.growthStatus})`}</span>
                    <img src={week.growthStatus === '진행 중' ? '/images/0/cluster4/icon/icon%20-%20성장%20%28진행%20중%29.png' : week.growthStatus === '집계 중' ? '/images/0/cluster4/icon/icon%20-%20성장%20%28집계%20중%29.png' : `/images/0/cluster4/icon/icon%20-%20${week.growthStatus.includes('휴식') ? week.growthStatus.replace('(', '%28').replace(')', '%29') : `성장%28${week.growthStatus}%29`}.png`} alt={week.growthStatus} className="trophy-icon" />
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

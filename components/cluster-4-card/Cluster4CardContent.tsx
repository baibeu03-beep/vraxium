"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { getFixedDropdownPosition } from "@/utils/documentZoom";
import { useModalScroll } from "@/utils/useModalScroll";
import { useDebugLayout } from "@/utils/debugLayout";
import { usePopup } from "@/components/ui/popup";
import { supabase } from "@/lib/supabase";
import { useDataMasking } from "@/hooks/useDataMasking";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { DUMMY_WEEKLY_LIST, DUMMY_WEEK_EXTRA, DUMMY_WEEK_CARD } from "@/constants/dummyData";
import DetailLogModal from "./DetailLogModal";
import confetti from "canvas-confetti";
import HelpModalBody from "@/components/shared/HelpModalBody";

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

interface Cluster4CardContentProps {
  weekId: string;
}

// DB에서 가져온 주차 데이터 타입
interface DBWeekData {
  id: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
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
  if (!value || value === "-") return "-";
  if (value.endsWith("학과")) return value.slice(0, -1); // "컴퓨터공학과" → "컴퓨터공학" (+ 학과 라벨)
  if (value.endsWith("학부")) return value.slice(0, -1); // "소프트웨어학부" → "소프트웨어학" (+ 부 라벨은 안 맞지만 일단)
  return value;
};

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
  const urlUserId = searchParams.get("userId") || searchParams.get("userID");
  // ?admin=true — Output Link 2차 모달 UI 테스트용 프론트 전용 override (DB/API/권한 변경 없음)
  const isAdminPreview = searchParams.get("admin") === "true";
  // SSR/client hydration 일관성을 위해 stateful — 첫 렌더 SSR=client=false, 마운트 후 localStorage 값 반영
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  // NICKNAME_COLOR_OFFSET도 Math.random() 호출이 SSR/client 다른 값을 만들어 hydration mismatch 발생 → stateful
  const [nicknameColorOffset, setNicknameColorOffset] = useState(0);
  useEffect(() => {
    setIsDemoMode(checkDemoMode());
    setIsMounted(true);
    setNicknameColorOffset(Math.floor(Math.random() * 4));
  }, []);
  const NICKNAME_COLORS = ["rgba(101, 227, 255, 1)", "rgba(255, 97, 97, 1)", "rgba(157, 250, 7, 1)", "rgba(255, 234, 72, 1)"];
  const NICKNAME_COLOR_OFFSET = nicknameColorOffset;

  const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
    const t = text || "-";
    return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
  };
  // 어드민(마더) 계정은 모든 프로필 편집 가능
  const isOwner = session?.user?.isAdmin || !urlUserId || session?.user?.id === urlUserId;
  const isAdmin = !!session?.user?.isAdmin;

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
  }>({ displayName: "", profilePhotoUrl: "", gender: "", age: null, school: "", major: "", vision: "" });

  useEffect(() => {
    // urlUserId 가 있으면 비로그인이라도 공개 프로필을 표시할 수 있도록 fetch.
    // (서버에서 비로그인이면 자동 마스킹되므로 안전.)
    const targetId = urlUserId || session?.user?.id;
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, eduRes] = await Promise.all([fetch(`/api/profile/?userId=${targetId}`), fetch(`/api/educations?userId=${targetId}`)]);
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
        });
      } catch {
        // 무시 — fallback으로 session.user.name 사용
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, urlUserId]);

  // 어드민이 다른 유저 편집 시 targetUserId를 API URL에 추가
  const apiUrl = (path: string) => {
    if (urlUserId && session?.user?.isAdmin) {
      const separator = path.includes("?") ? "&" : "?";
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
    if (isDemoMode) {
      openModalFn();
      return;
    } // 더미 모드: 체크 스킵
    if (!session) {
      alert("로그인이 필요합니다.");
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

  // 팀/파트/역할/포인트 데이터 상태
  const [teamName, setTeamName] = useState<string | null>(null);
  const [partName, setPartName] = useState<string | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [managedTeamName, setManagedTeamName] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  // 해당 주차 시점의 raw 역할 코드 (예: crew_partleader / crew_agent / crew_regular ...) — 매니징 라인 적용 여부 판단용
  const [userWeekRole, setUserWeekRole] = useState<string | null>(null);
  const [weekPoints, setWeekPoints] = useState<{ star: number; lightning: number; shield: number }>({ star: 0, lightning: 0, shield: 0 });
  const [cumulativeInjeolmi, setCumulativeInjeolmi] = useState<number>(0);
  const [cumulativeApprovedWeeks, setCumulativeApprovedWeeks] = useState<number>(0);

  // 이전/다음 주차 ID
  const [prevWeekId, setPrevWeekId] = useState<string | null>(null);
  const [nextWeekId, setNextWeekId] = useState<string | null>(null);

  // 현재 유저 ID (저장 시 사용)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 주간 활동 데이터 (실무정보 모달용)
  interface WeeklyActivity {
    id: string;
    activity_type_id: string;
    title: string | null;
    is_active: boolean;
    opened_at: string | null;
    deadline?: string | null; // 어드민 직접 지정 마감 (옵션 — 없으면 시스템 기본 N+1주(목) 12:00 KST)
    output_links: OutputLink[] | null; // 운영진이 입력한 output links
    output_images?: Array<{ url: string; caption: string }> | null; // 운영진이 업로드한 이미지 (최대 2)
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

  const [careerRecords, setCareerRecords] = useState<CareerRecord[]>([
    {
      id: "cr-1",
      project_id: "p1",
      week_id: "w1",
      company_name: "우아한형제들",
      company_logo_url: "/images/0/naver webtoon.png",
      job_position: "서비스기획팀",
      project_name: "배달의민족 브랜드 바이럴 마케팅 캠페인 기획 및 실행",
      project_description: "소셜미디어 채널별 바이럴 콘텐츠 전략 수립 및 성과 분석",
      line_code: "AA22-11111",
      line_name: "마케팅(바이럴)",
      output_links: [],
      secondary_info_deadline: null,
      created_at: "2025-12-22T00:00:00Z",
      record_id: "r1",
      user_id: "u1",
      enhancement_status: "enhanced",
      grade: "S",
      grade_points: 99,
      career_code: "AA22-11111",
      supervisor_name: "김민지",
      supervisor_position: "대리",
      supervisor_department: "서비스기획팀",
      supervisor_company: "우아한형제들",
      supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자.jpg",
    },
    {
      id: "cr-2",
      project_id: "p2",
      week_id: "w1",
      company_name: "에스엠엔터테인먼트",
      company_logo_url: "/images/0/CJ_logo.svg.png",
      job_position: "브랜드마케팅",
      project_name: "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차일이",
      project_description:
        "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아일이삼사오",
      line_code: "BB33-22222",
      line_name: "퍼포먼스마케팅",
      output_links: [],
      secondary_info_deadline: null,
      created_at: "2025-12-22T00:00:00Z",
      record_id: "r2",
      user_id: "u1",
      enhancement_status: "enhanced",
      grade: "A",
      grade_points: 85,
      career_code: "BB33-22222",
      supervisor_name: "박서연",
      supervisor_position: "과장",
      supervisor_department: "브랜드마케팅",
      supervisor_company: "에스엠엔터",
      supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자2.png",
    },
    {
      id: "cr-3",
      project_id: "p3",
      week_id: "w1",
      company_name: "",
      company_logo_url: null,
      job_position: "",
      project_name: "개인 프로젝트",
      project_description: null,
      line_code: null,
      line_name: null,
      output_links: [],
      secondary_info_deadline: null,
      created_at: "2025-12-22T00:00:00Z",
      record_id: "r3",
      user_id: "u1",
      enhancement_status: "not_applicable",
      grade: "D",
      grade_points: 1,
      career_code: null,
      supervisor_name: "조워싱턴",
      supervisor_position: null,
      supervisor_department: null,
      supervisor_company: null,
      supervisor_profile_img: null,
    },
  ]);
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

  // 역할 라벨 매핑
  const roleLabels: { [key: string]: string } = {
    crew: "일반",
    crew_regular: "일반",
    part_leader: "심화(파트장)",
    crew_partleader: "심화(파트장)",
    operations_partleader: "심화(파트장)",
    crew_agent: "심화(에이전트)",
    operations_ambassador: "운영진(앰배서더)",
    operations_teamleader: "운영진(팀장)",
    operations_clubleader: "운영진(클럽장)",
  };

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
        setCumulativeInjeolmi(dummyExtra.points.shield);
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
            const res = await fetch(`/api/profile/?userId=${urlUserId}`);
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
    const fetchWeekData = async () => {
      if (!weekId) return;

      // 상태 리셋
      setPrevWeekId(null);
      setNextWeekId(null);

      try {
        setIsLoadingWeek(true);

        // ========== 1단계: 프로필 API (weekId 번들) + 보조 API 최대 병렬 로드 ==========
        const profileUrl = urlUserId ? `/api/profile?userId=${urlUserId}&context=card&weekId=${weekId}` : `/api/profile?context=card&weekId=${weekId}`;
        const earlyUserId = urlUserId || null;

        // 프로필 API (주차 번들 포함) + 보조 API 동시 시작
        const earlyApiPromise = earlyUserId
          ? Promise.all([
              fetch(`/api/career-records?week_id=${weekId}&user_id=${earlyUserId}`, { cache: "no-store" })
                .then((r) => r.json())
                .catch(() => null),
              fetch(`/api/weekly-reputations?targetUserId=${earlyUserId}&weekCardId=${weekId}`)
                .then((r) => r.json())
                .catch(() => null),
              fetch(`/api/weekly-colleagues?userId=${earlyUserId}&weekCardId=${weekId}`)
                .then((r) => r.json())
                .catch(() => null),
            ])
          : Promise.resolve([null, null, null] as const);

        // 모든 병렬 요청 동시 대기
        const [profileResponse, earlyApiResults] = await Promise.all([fetch(profileUrl), earlyApiPromise]);
        const [earlyCareerResult, earlyReputationsResult, earlyColleaguesResult] = earlyApiResults;

        // 프로필 정보 처리 (weekBundle 포함)
        const profileResult = await profileResponse.json();
        if (!profileResponse.ok || !profileResult.data?.id) {
          console.error("Failed to fetch profile");
          return;
        }

        const userId = profileResult.data.id;
        setCurrentUserId(userId);
        const apiActivityWeekIds = profileResult.activityWeekIds || [];
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

        // 성장 상태 결정 (Cluster41Content 와 동일한 phase 로직 — 동기화 필수)
        //   - VISIBLE_OFFSET_MINUTES  = N(월) 00:01   = 1m
        //   - COUNTING_START_HOURS    = N(일) 00:00   = 144h
        //   - RESULT_DECIDED_MINUTES  = N+1(목) 12:01 = 252h 1m
        //     라인 카드 '강화 대기 → 강화 성공' 도 동일 시점에 확정 — computeResultDecidedMs / resultsDecided 와 동기.
        const VISIBLE_OFFSET_MINUTES = 1;
        const COUNTING_START_HOURS = 144;
        const RESULT_DECIDED_MINUTES = 252 * 60 + 1;

        const weeklyGrowth = weeklyGrowthData;
        const onboardingWeekId = profileResult.onboardingWeekId;
        const isCurrentWeekOnboarding = weekId === onboardingWeekId;

        // phase(진행 중/집계 중) 와 무관하게 운영진이 마킹한 휴식 여부.
        // 활동 라인 단위(실무 정보/역량/경험/경력) 판정에서 사용.
        const userIsOnOfficialRestForWeek = !isCurrentWeekOnboarding && (isBreakSeason || !!weeklyGrowth?.is_club_break || (!weeklyGrowth && !!currentWeek.is_club_break));
        const userIsOnPersonalRestForWeek = !isCurrentWeekOnboarding && (!!weeklyGrowth?.is_resting || (!weeklyGrowth && apiRestWeekIds.includes(currentWeek.id)));

        // 휴식만 phase 우회 — 온보딩 주차도 일반 phase(진행 중 → 집계 중) 거치고 결정 시점에 무조건 성공.
        let growthStatus = "실패";
        if (userIsOnOfficialRestForWeek) {
          // 클럽 공식 휴식 주차(전환 주차 포함)는 phase 우회하고 카드 노출 시점부터 바로 '휴식(공식)'.
          growthStatus = "휴식(공식)";
        } else if (userIsOnPersonalRestForWeek) {
          // 개인 휴식 크루도 phase 우회하고 카드 노출 시점부터 바로 '휴식(개인)'.
          growthStatus = "휴식(개인)";
        } else {
          const weekStartMs = new Date(currentWeek.start_date + "T00:00:00+09:00").getTime();
          const elapsedMs = Date.now() - weekStartMs;
          const hoursSinceStart = elapsedMs / 3600000;
          const minutesSinceStart = elapsedMs / 60000;

          if (minutesSinceStart >= VISIBLE_OFFSET_MINUTES && hoursSinceStart < COUNTING_START_HOURS) {
            growthStatus = "진행 중";
          } else if (hoursSinceStart >= COUNTING_START_HOURS && minutesSinceStart < RESULT_DECIDED_MINUTES) {
            growthStatus = "집계 중";
          } else if (isCurrentWeekOnboarding) {
            // N+1(목) 12:01 이후 — 온보딩(무적) 주차는 무조건 성공.
            growthStatus = "성공";
          } else if (weeklyGrowth) {
            // 휴식은 위에서 이미 처리됨 — 여기는 성공/실패만 결정.
            growthStatus = weeklyGrowth.is_success ? "성공" : "실패";
          } else if (apiActivityWeekIds.includes(currentWeek.id)) {
            growthStatus = "성공";
          }
        }

        setWeekData({
          id: currentWeek.id,
          weekNumber: currentWeek.week_number,
          seasonYear: seasonData?.year || 0,
          seasonName,
          isBreakSeason,
          toSeasonName,
          startDate: currentWeek.start_date,
          endDate: currentWeek.end_date,
          isClubBreak: currentWeek.is_club_break || false,
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
          setRoleLabel(roleLabels[userRole.role] || userRole.role);
          setUserWeekRole(userRole.role || null);
        } else if (profileResult.data?.role) {
          setRoleLabel(roleLabels[profileResult.data.role] || profileResult.data.role);
          setUserWeekRole(profileResult.data.role || null);
        }

        // 포인트 정보 처리
        const weekPointsData = allPointsData.filter((p: any) => p.week_id === weekId);
        if (weekPointsData.length > 0) {
          const star = weekPointsData.filter((p: any) => p.point_type === "star").reduce((sum: number, p: any) => sum + p.points, 0);
          const lightning = weekPointsData.filter((p: any) => p.point_type === "lightning").reduce((sum: number, p: any) => sum + p.points, 0);
          const shield = weekPointsData.filter((p: any) => p.point_type === "shield").reduce((sum: number, p: any) => sum + p.points, 0);
          setWeekPoints({ star, lightning, shield });
        }

        // 누적 인절미 계산 (현재 시즌 내, 현재 주차까지의 shield 합계 - lightning 합계)
        const currentSeasonId = seasonData?.id;
        const seasonWeekIds = new Set(allWeeksForCumulative.filter((w: any) => w.season_id === currentSeasonId).map((w: any) => w.id));
        const seasonPointsData = allPointsData.filter((p: any) => seasonWeekIds.has(p.week_id));
        const totalShields = seasonPointsData.filter((p: any) => p.point_type === "shield").reduce((sum: number, p: any) => sum + p.points, 0);
        const totalLightnings = seasonPointsData.filter((p: any) => p.point_type === "lightning").reduce((sum: number, p: any) => sum + p.points, 0);
        setCumulativeInjeolmi(totalShields - totalLightnings);

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
        const currentWeekIsActive = !currentWeek.is_club_break && weekId !== onboardingWeekIdForCount;
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
          const competencyTotal = currentWeek.is_club_break || isBreakSeason ? (hasActiveCompetency ? 1 : 0) : 1;

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

          // success 계산 (강화 성공 기준: is_completed + 결정 시점 도달 — N+1 목 12:01 KST)
          // 해당 주차의 완료된 활동만 필터링
          type CompletedActivity = { week_id: string; activity_type_id: string };
          const weekCompletedActivities = allCompletedActivities.filter((a: CompletedActivity) => a.week_id === weekId);

          // 결정 시점 (N+1 목 12:01 KST) 도달 여부 — getEnhancementStatus 와 동일 기준
          const isResultsDecidedHere = currentWeek?.start_date ? Date.now() >= computeResultDecidedMs(currentWeek.start_date) : false;

          // 강화 성공 여부 판단 헬퍼 (2차 정보 / deadline 무관, 결정 시점만 본다)
          const isEnhancementSuccess = (activityTypeId: string): boolean => {
            if (!isResultsDecidedHere) return false;
            return weekCompletedActivities.some((a: CompletedActivity) => a.activity_type_id === activityTypeId);
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

        // Stage 1에서 선행 로드된 데이터 적용
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
            rank: item.rank,
            message: item.message || "",
            createdAt: item.created_at || "",
          }));
          setSelectedColleagues(colleagues);
        }
      } catch (error) {
        console.error("주차 데이터 로드 오류:", error);
      } finally {
        setIsLoadingWeek(false);
      }
    };

    fetchWeekData();
  }, [weekId, urlUserId, isDemoMode, isMounted]);

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
      const res = await fetch(`/api/weekly-reputations?targetUserId=${urlUserId}&weekCardId=${weekId}`);
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
    try {
      const excludeId = urlUserId || session?.user?.id || "";
      const res = await fetch(`/api/crews?excludeUserId=${excludeId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAllCrewList(json.data);
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
      const res = await fetch(`/api/weekly-colleagues?userId=${targetUserId}&weekCardId=${weekId}`);
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
  const [canEditReputation, setCanEditReputation] = useState<boolean>(isDemoMode);
  useEffect(() => {
    setCanEditReputation(isDemoMode);
  }, [isDemoMode]);

  // 연계 동료 — 평판/주차 리뷰와 동일하게 데모 모드에서 true, 일반 모드에서 승인 상태 따름
  const [canEditColleague, setCanEditColleague] = useState<boolean>(isDemoMode);
  useEffect(() => {
    setCanEditColleague(isDemoMode);
  }, [isDemoMode]);

  // Weekly Review / 연계동료 작성 시간 윈도우
  // 앵커 = weekData.startDate (= N주차 월요일 00:00 KST)
  //   144h(=6d 0h)  → N주차 일요일 00:00 KST  → +1min = 일 00:01 (오픈)
  //   252h(=10d 12h) → N+1주차 목요일 12:00 KST (마감, 시스템 여유분)
  // 데모/어드민은 우회.
  const requireWriteWindow = async (): Promise<boolean> => {
    if (isDemoMode) return true;
    if (session?.user?.isAdmin) return true;
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
    if (!isDemoMode && !canEditColleague) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!(await requireWriteWindow())) return;
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
        alert("삭제에 실패했습니다.");
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
  // 데모 모드: true (수정 가능 — UI 테스트용) / 일반 모드: false (관리자 승인 필요)
  // TODO: [백엔드 작업 필요] 일반 모드에서 API 응답의 canEdit 값을 setCanEditWorkInfo로 반영
  const [canEditWorkInfo, setCanEditWorkInfo] = useState<boolean>(isDemoMode);
  useEffect(() => {
    // isDemoMode는 마운트 시 useEffect로 false → checkDemoMode() 결과로 sync됨 (SSR/hydration 일관성).
    // useState 초기값은 첫 렌더만 사용되므로, 마운트 후 isDemoMode 변경을 canEditWorkInfo로 따라잡기 위해 별도 sync.
    setCanEditWorkInfo(isDemoMode);
  }, [isDemoMode]);

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
    setCanEditWorkAbility(isDemoMode);
  }, [isDemoMode]);

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
    setCanEditWorkExp(isDemoMode);
  }, [isDemoMode]);
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
    setCanEditWorkCareer(isDemoMode);
  }, [isDemoMode]);

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
  const getEnhanceStatus = (card: any): string => {
    if (!card) return "waiting";
    if (typeof card.status === "string") return card.status;
    if (typeof card.enhancementStatus === "string") return card.enhancementStatus;
    if (card.isFailed) return "failed";
    if (card.isNotApplicable) return "not_applicable";
    if (card.verified) return "success";
    return "waiting";
  };

  // 강화 실패 / 해당 없음이면 수정 불가
  const isLineLocked = (card: any): boolean => {
    const s = getEnhanceStatus(card);
    return s === "failed" || s === "not_applicable";
  };

  const LINE_LOCKED_TITLE = "강화 실패 또는 해당 없음 상태에서는 수정할 수 없습니다.";

  // workInfo View 모달 — 보기/편집 토글 핸들러 (Type B 푸터 규칙 + 관리자 승인)
  const handleEditWorkInfo = async () => {
    if (!canEditWorkInfo && !isAdminPreview) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    const card = selectedWorkInfoCard;
    // 스냅샷: 비교 대상 필드만 (subTitle/growthPoint/outputLinks/images)
    const initialOutputLinks = card?.outputLinks && card.outputLinks.length > 0 ? card.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" });
    const initialImages = normalizeWorkInfoImages(card?.images);
    const initialCaptions = normalizeWorkInfoCaptions(card?.imageCaptions);
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
    if (!isDemoMode && !canEditWorkInfo && !isAdminPreview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
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
  const persistImageUrls = async (images: (string | null)[], activityTypeId: string): Promise<(string | null)[]> => {
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
      formData.append("activity_type_id", activityTypeId);
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
  const persistActivityDetailToServer = async (params: { activityTypeId: string; subTitle: string | null; outputLinks: { desc: string; url: string }[] | null; growthPoint: string | null; images: (string | null)[]; imageCaptions: string[] }): Promise<{ images: (string | null)[] }> => {
    if (isDemoMode) return { images: params.images };
    if (!currentUserId || !weekId) return { images: params.images };
    const persistedImages = await persistImageUrls(params.images, params.activityTypeId);
    const adminCount = getAdminOutputLinksCount(params.activityTypeId);
    const userLinks = (params.outputLinks || []).slice(adminCount).filter((l) => l.url?.trim() !== "");
    const res = await fetch(apiUrl("/api/activity-details"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserId,
        week_id: weekId,
        activity_type_id: params.activityTypeId,
        sub_title: params.subTitle,
        output_links: userLinks.length > 0 ? userLinks : null,
        growth_point: params.growthPoint,
        image_urls: persistedImages,
        image_captions: params.imageCaptions,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "저장에 실패했습니다.");
    }
    return { images: persistedImages };
  };

  const handleSaveWorkInfo = async () => {
    if (!isDemoMode && !canEditWorkInfo && !isAdminPreview) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkInfo" });
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
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
      try {
        const persisted = await persistActivityDetailToServer({
          activityTypeId: selectedWorkInfoCard.activityType,
          subTitle: newSubTitle,
          outputLinks: newOutputLinks,
          growthPoint: newGrowthPoint,
          images: editingImages,
          imageCaptions: editingImageCaptions,
        });
        persistedImages = persisted.images;
      } catch (err) {
        console.error("workInfo 저장 실패:", err);
        alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
        return;
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
    const adminCount = getAdminOutputLinksCount(selectedWorkInfoCard.activityType);
    if (idx < adminCount) return; // 운영진 링크는 수정 불가
    setEditingOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleOutputLinkDelete = (idx: number) => {
    if (!selectedWorkInfoCard?.activityType) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkInfoCard.activityType);
    if (idx < adminCount) return; // 운영진 링크는 삭제 불가
    setEditingOutputLinks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      while (next.length < 5) next.push({ desc: "", url: "" });
      return next;
    });
  };

  // Output Link 2차 모달 — 열기
  const openOutputLinkEditModal = (modalType: "workInfo" | "workExp" | "workAbility" | "workCareer", idx: number) => {
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
    if (isAdminPreview) {
      // 프론트 테스트용: API/권한 체크 우회, editing state에만 직접 저장
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
    if (!canEditWorkAbility && !isAdminPreview) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    const card = selectedWorkAbilityCard;
    const initialOutputLinks = card?.outputLinks && card.outputLinks.length > 0 ? card.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" });
    const initialImages = normalizeWorkInfoImages(card?.images);
    const initialCaptions = normalizeWorkInfoCaptions(card?.imageCaptions);
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
    if (!isDemoMode && !canEditWorkAbility && !isAdminPreview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
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
    if (!isDemoMode && !canEditWorkAbility && !isAdminPreview) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkAbility" });
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 (이미지 1개 = 캡션 1개, 한쪽만 입력 불가)
    {
      const mismatch = findImageCaptionMismatch(editingAbilityImages, editingAbilityImageCaptions);
      if (mismatch) {
        setWorkAbilityFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    if (selectedWorkAbilityCard?.activityTypeId) {
      const newSubTitle = editingAbilitySubTitle.trim() || null;
      const newOutputLinks = editingAbilityOutputLinks;
      const newGrowthPoint = editingAbilityGrowthPoint.trim() || null;
      let persistedImages: (string | null)[] = editingAbilityImages;
      try {
        const persisted = await persistActivityDetailToServer({
          activityTypeId: selectedWorkAbilityCard.activityTypeId,
          subTitle: newSubTitle,
          outputLinks: newOutputLinks,
          growthPoint: newGrowthPoint,
          images: editingAbilityImages,
          imageCaptions: editingAbilityImageCaptions,
        });
        persistedImages = persisted.images;
      } catch (err) {
        console.error("workAbility 저장 실패:", err);
        alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
        return;
      }
      setEditingAbilityImages(persistedImages);
      setWeekActivityDetails((prev) => {
        const nextDetail = {
          week_id: weekId,
          activity_type_id: selectedWorkAbilityCard.activityTypeId,
          sub_title: newSubTitle,
          output_links: newOutputLinks,
          growth_point: newGrowthPoint,
          image_urls: persistedImages,
          image_captions: editingAbilityImageCaptions,
        };
        const existingIndex = prev.findIndex((d) => d.activity_type_id === selectedWorkAbilityCard.activityTypeId);
        if (existingIndex < 0) return [...prev, nextDetail];
        return prev.map((d) => (d.activity_type_id === selectedWorkAbilityCard.activityTypeId ? { ...d, ...nextDetail } : d));
      });
      setSelectedWorkAbilityCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingAbilityGrowthPoint,
              images: persistedImages,
              imageCaptions: editingAbilityImageCaptions,
            }
          : prev,
      );
      workAbilitySnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingAbilityGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...persistedImages],
        imageCaptions: [...editingAbilityImageCaptions],
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
    const adminCount = getAdminOutputLinksCount(selectedWorkAbilityCard.activityTypeId);
    if (idx < adminCount) return;
    setEditingAbilityOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || { desc: "", url: "" }), [field]: value };
      return next;
    });
  };

  const handleAbilityOutputLinkDelete = (idx: number) => {
    if (!selectedWorkAbilityCard?.activityTypeId) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkAbilityCard.activityTypeId);
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
    if (!canEditWorkExp && !isAdminPreview) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    const card = selectedWorkExpCard;
    const initialOutputLinks = card?.outputLinks && card.outputLinks.length > 0 ? card.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" });
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
    if (!isDemoMode && !canEditWorkExp && !isAdminPreview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
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
    if (!isDemoMode && !canEditWorkExp && !isAdminPreview) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkExp" });
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 (이미지 1개 = 캡션 1개, 한쪽만 입력 불가)
    {
      const mismatch = findImageCaptionMismatch(editingExpImages, editingExpImageCaptions);
      if (mismatch) {
        setWorkExpFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능 (라인 평점은 어드민 전용)
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    if (selectedWorkExpCard?.activityTypeId) {
      const newSubTitle = editingExpSubTitle.trim() || null;
      const newOutputLinks = editingExpOutputLinks;
      const newGrowthPoint = editingExpGrowthPoint.trim() || null;
      let persistedImages: (string | null)[] = editingExpImages;
      try {
        const persisted = await persistActivityDetailToServer({
          activityTypeId: selectedWorkExpCard.activityTypeId,
          subTitle: newSubTitle,
          outputLinks: newOutputLinks,
          growthPoint: newGrowthPoint,
          images: editingExpImages,
          imageCaptions: editingExpImageCaptions,
        });
        persistedImages = persisted.images;
      } catch (err) {
        console.error("workExp 저장 실패:", err);
        alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
        return;
      }
      setEditingExpImages(persistedImages);
      setWeekActivityDetails((prev) => {
        const nextDetail = {
          week_id: weekId,
          activity_type_id: selectedWorkExpCard.activityTypeId,
          sub_title: newSubTitle,
          output_links: newOutputLinks,
          growth_point: newGrowthPoint,
          image_urls: persistedImages,
          image_captions: editingExpImageCaptions,
        };
        const existingIndex = prev.findIndex((d) => d.activity_type_id === selectedWorkExpCard.activityTypeId);
        if (existingIndex < 0) return [...prev, nextDetail];
        return prev.map((d) => (d.activity_type_id === selectedWorkExpCard.activityTypeId ? { ...d, ...nextDetail } : d));
      });
      setSelectedWorkExpCard((prev: any) =>
        prev
          ? {
              ...prev,
              subTitle: newSubTitle || "",
              outputLinks: newOutputLinks,
              growthPoint: editingExpGrowthPoint,
              images: persistedImages,
              imageCaptions: editingExpImageCaptions,
              // rating은 어드민(compliance-manage)에서만 갱신 — 크루 저장 시 건드리지 않음
            }
          : prev,
      );
      workExpSnapshot.current = {
        subTitle: newSubTitle || "",
        growthPoint: editingExpGrowthPoint,
        outputLinks: JSON.parse(JSON.stringify(newOutputLinks)),
        images: [...persistedImages],
        imageCaptions: [...editingExpImageCaptions],
        rating: editingExpRating,
      };
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
  };

  const handleExpOutputLinkChange = (idx: number, field: "desc" | "url", value: string) => {
    if (!selectedWorkExpCard?.activityTypeId) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId);
    if (idx < adminCount) return;
    setEditingExpOutputLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleExpOutputLinkDelete = (idx: number) => {
    if (!selectedWorkExpCard?.activityTypeId) return;
    const adminCount = getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId);
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
    if (!canEditWorkCareer && !isAdminPreview) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }
    const card = selectedWorkCareerCard;
    const initialOutputLinks = card?.outputLinks && card.outputLinks.length > 0 ? card.outputLinks.map((l: { desc: string; url: string }) => ({ desc: l.desc || "", url: l.url || "" })) : Array(5).fill({ desc: "", url: "" });
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
    if (!isDemoMode && !canEditWorkCareer && !isAdminPreview) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    // 초기화 = 크루가 입력한 값만 비움. 어드민이 등록한 슬롯(output_images, output_links 앞쪽)은 유지.
    if (!(await popup.confirm("내용을 모두 초기화하시겠어요?"))) return;
    const careerIdx = (selectedWorkCareerCard?.id || 1) - 1;
    const careerRecord = careerRecords[careerIdx];
    const adminImgs = (careerRecord?.output_images || []).filter((i) => i?.url?.trim());
    const adminLinks = (careerRecord?.output_links || []).filter((l) => l?.url?.trim());
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
    if (!isDemoMode && !canEditWorkCareer && !isAdminPreview) {
      console.log("[AdminApprovalPopupCalled]", { isAdminPreview, caller: "handleSaveWorkCareer" });
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    // 아웃풋 이미지 ↔ 캡션 1:1 페어 검증 — 어드민 슬롯은 크루가 편집 불가하므로 제외 (한쪽만 입력 불가)
    {
      const careerIdxForCheck = (selectedWorkCareerCard?.id || 1) - 1;
      const adminImgCountForCheck = (careerRecords[careerIdxForCheck]?.output_images || []).filter((i) => i?.url?.trim()).length;
      const mismatch = findImageCaptionMismatch(editingCareerImages, editingCareerImageCaptions, adminImgCountForCheck);
      if (mismatch) {
        setWorkCareerFooterNotice("error");
        await popup.alert(captionMismatchMessage(mismatch));
        return;
      }
    }
    // 모든 필드 옵셔널 — 일부만 기입해도 저장 가능
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    const activityType = workCareerActivityTypes[(selectedWorkCareerCard?.id || 1) - 1];
    if (activityType) {
      const newSubTitle = editingCareerSubTitle.trim() || null;
      const newOutputLinks = editingCareerOutputLinks;
      const newGrowthPoint = editingCareerGrowthPoint.trim() || null;
      // 어드민 output_images 가 차지한 슬롯은 user_activity_details 에 저장하지 않음 (출처 분리)
      const careerIdx = (selectedWorkCareerCard?.id || 1) - 1;
      const adminImgsForSave = (careerRecords[careerIdx]?.output_images || []).filter((i) => i?.url?.trim());
      const adminImgCount = adminImgsForSave.length;
      const crewImagesToSave = editingCareerImages.slice(adminImgCount);
      const crewCaptionsToSave = editingCareerImageCaptions.slice(adminImgCount);
      let persistedCrewImages: (string | null)[] = crewImagesToSave;
      try {
        const persisted = await persistActivityDetailToServer({
          activityTypeId: activityType,
          subTitle: newSubTitle,
          outputLinks: newOutputLinks,
          growthPoint: newGrowthPoint,
          images: crewImagesToSave,
          imageCaptions: crewCaptionsToSave,
        });
        persistedCrewImages = persisted.images;
      } catch (err) {
        console.error("workCareer 저장 실패:", err);
        alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
        return;
      }
      // 화면 상태는 어드민 + 크루 머지 결과로 복원
      const mergedImages: (string | null)[] = [];
      const mergedCaptions: string[] = [];
      for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
        if (i < adminImgCount) {
          mergedImages.push(adminImgsForSave[i].url);
          mergedCaptions.push(adminImgsForSave[i].caption || "");
        } else {
          const crewIdx = i - adminImgCount;
          mergedImages.push(persistedCrewImages[crewIdx] || null);
          mergedCaptions.push(crewCaptionsToSave[crewIdx] || "");
        }
      }
      setEditingCareerImages(mergedImages);
      setEditingCareerImageCaptions(mergedCaptions);
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
    const adminCount = getAdminOutputLinksCount(activityType);
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
    const adminCount = getAdminOutputLinksCount(activityType);
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
    return (careerRecords[careerIdx]?.output_images || []).filter((i) => i?.url?.trim()).length;
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

  // 스펙: 이름 startsWith + 마지막 글자가 자음이면 초성 매칭. 숫자 차단. 가나다 순. 최대 5개. 본인 및 이미 선택된 동료 제외.
  const searchColleagueCandidates = (query: string, pool: any[]): any[] => {
    const q = (query || "").trim();
    if (!q) return [];
    if (/^\d+$/.test(q)) return [];

    const excludedIds = new Set(selectedColleagues.map((c) => c.id));

    const filtered = pool.filter((crew) => {
      if (!crew || !crew.name) return false;
      if (excludedIds.has(crew.id)) return false;
      const name: string = crew.name;
      if (name.startsWith(q)) return true;
      const lastChar = q[q.length - 1];
      if (/[ㄱ-ㅎ]/.test(lastChar)) {
        const prefix = q.slice(0, -1);
        if (name.startsWith(prefix) && name.length > prefix.length) {
          const nextChar = name[prefix.length];
          if (getInitialConsonant(nextChar) === lastChar) return true;
        }
      }
      return false;
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

  // colleague-view-modal [수정] — 관리자 승인 검증 후 편집 모달 진입
  const handleColleagueEditClick = async () => {
    if (!isDemoMode) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊.");
      return;
    }
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
    if (!isDemoMode && !canEditColleague) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
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
    if (!isDemoMode && !canEditColleague) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
    if (!(await requireWriteWindow())) return;
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
      nickname: picked.nickname || "-",
      role: picked.role || "",
      rank: nextRank,
      message: colleagueEditData.content.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedList = [...selectedColleagues, newEntry].sort((a, b) => a.rank - b.rank);
    setSelectedColleagues(updatedList);

    if (isDemoMode) {
      await popup.alert("저장되었습니다.");
      setIsColleagueEditing(false);
      setHeaderModalOpen(false);
      return;
    }

    setColleagueSaving(true);
    try {
      const payload = updatedList.map((c) => ({ colleagueId: c.id, rank: c.rank, message: c.message || "" }));
      const res = await fetch("/api/weekly-colleagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekCardId: weekId, colleagues: payload }),
      });
      if (!res.ok) throw new Error("저장 실패");
      await popup.alert("저장되었습니다.");
      setIsColleagueEditing(false);
      setHeaderModalOpen(false);
    } catch (err) {
      console.error("연계 동료 저장 실패:", err);
      await popup.alert("저장에 실패했습니다.");
    } finally {
      setColleagueSaving(false);
    }
  };

  useEffect(() => {
    if (!headerModalOpen) setIsColleagueEditing(false);
  }, [headerModalOpen]);

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
      const res = await fetch(`/api/weekly-reviews?${params.toString()}`);
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
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekCardId: weekId, rating: weeklyReviewData.rating, content: weeklyReviewData.content }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.error("[weekly-review] API 응답 오류:", res.status, errJson);
        return null;
      }
      const json = await res.json();
      const record = json?.success && json?.data ? json.data : null;
      if (!record) return null;
      return { id: record.id, weekCardId: record.weekCardId, created_at: record.created_at, updated_at: record.updated_at };
    } catch (err) {
      console.error("[weekly-review] API 예외:", err);
      return null;
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

  // 주차 리뷰 — 푸터 핸들러
  // [임시] 주차 리뷰는 관리자 승인 가드 해제 — 본인 회고 영역이라 승인 게이트 없이 작성 허용
  // 단, 본인 페이지(또는 어드민)에서만 수정 가능 — 타 크루 페이지에서는 열람만
  const handleWeeklyReviewEditClick = async () => {
    if (!isOwner) {
      await popup.alert("본인 주차 리뷰만 수정할 수 있습니다.");
      return;
    }
    if (!(await requireWriteWindow())) return;
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
    if (!(await requireWriteWindow())) return;
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
      if (!savedRecord) {
        await popup.alert("저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
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
      await popup.alert("저장 중 오류가 발생했습니다.");
    } finally {
      setWeeklyReviewSaving(false);
    }
  };

  const handleReputationHelp = () => {
    setHelpModalKind("reputation");
  };

  // 편집 진입 — 보기 → 편집 전환 + 현재값으로 스냅샷 업데이트 (롤백 기준점)
  const handleEditMode = async () => {
    // 승인 체크 — reputation-view-modal [수정] (L3031)과 동일 패턴
    if (!canEditReputation) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
      return;
    }

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
    if (!isDemoMode && !canEditReputation) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
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

  // [수정] — 관리자 승인 검증 + 편집 모달 진입 + 기존 데이터 초기화
  const handleReputationEditClick = async () => {
    if (!canEditReputation) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊.");
      return;
    }
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

    // 관리자 승인 체크 (데모=통과, 일반=기존 canEditReputation)
    if (!canEditReputation) {
      await popup.alert("작성할 수 있는 기간이 아닙니다. 😊.");
      return;
    }

    const ok = await popup.confirm("이 평판을 삭제하시겠습니까?");
    if (!ok) return;

    const repId = selectedReputationCard.id;

    try {
      if (isDemoMode) {
        // 데모 모드: 로컬 filter로 weeklyReputations에서 제거
        setWeeklyReputations((prev) => prev.filter((r) => r.id !== repId));
      } else {
        // 일반 모드: DELETE API 호출 후 재조회
        const res = await fetch(`/api/weekly-reputations/${repId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchWeeklyReputations();
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
    if (!isDemoMode && !canEditReputation) {
      await popup.alert("관리자 승인 후 수정할 수 있습니다.");
      return;
    }
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
      if (!window.confirm("저장하시겠습니까?")) return;
      setReputationSaving(true);
      try {
        const res = await fetch("/api/weekly-reputations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingWeeklyReputationId,
            rating: reputationEditData.rating,
            content: reputationEditData.content.trim(),
            keyword: reputationEditData.keyword,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          alert(json.error || "수정에 실패했습니다.");
          return;
        }
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
        alert("수정되었습니다.");
        setHeaderModalOpen(false);
        setReputationEditData({ rating: 0, content: "", keyword: "" });
        setEditingWeeklyReputationId(null);
        if (selectedReputationCard) setReputationViewModalOpen(true);
      } catch {
        alert("서버 오류가 발생했습니다.");
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

      const json = await res.json();
      if (!res.ok) {
        await popup.alert(json.error || "저장에 실패했습니다.");
        return null;
      }
      setReputationSaveSuccess(true);
      return {
        id: json.data?.id || "",
        created_at: json.data?.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error("주차 평판 저장 오류:", error);
      setReputationSaveError((error as Error)?.message || "서버 오류");
      await popup.alert("서버 오류가 발생했습니다.");
      return null;
    } finally {
      setReputationSaving(false);
    }
  };

  // 서브 타이틀 글자수 관리
  const [subTitleText, setSubTitleText] = useState("");

  // 기본값 설정
  const restImage = "/images/0/cluster4/주차%20이미지/휴식(개인,공식).png";

  // 휴식 모드 체크 (휴식(개인), 휴식(공식)일 때 모든 카드 비활성화)
  // phase(진행 중/집계 중) 와 무관하게 운영진이 마킹한 휴식 여부를 본다 — 봄 9주차가 아직
  // 결과 결정 시점 이전이라 growthStatus 가 "집계 중" 으로 잡혀도, 개인 휴식 크루의
  // 활동 라인은 '해당 없음' 으로 표시되어야 한다.
  const isRestMode = !!(weekData?.isPersonalRest || weekData?.isOfficialRest);

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
  const currentTitle = weekData ? (weekData.isBreakSeason ? `${weekData.seasonYear} ${weekData.toSeasonName} 시즌, 전환 주차` : `${weekData.seasonYear} ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차`) : "로딩 중...";

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

  // 성장 상태에 따른 뱃지 정보 — '성장 (xxx)' / '휴식 (xxx)' 통일
  // TODO: [백엔드 작업 필요] '진행 중' / '집계 중' 상태 결정 로직 추가 — 현재는 더미 맨 위 2장에서 진입 시 표시
  const getStatusBadgeInfo = (status: string | undefined) => {
    switch (status) {
      case "성공":
        return {
          className: "success",
          text: "성장 (성공)",
          icon: "/images/0/cluster4/icon/icon - 성장(성공).png",
        };
      case "실패":
        return {
          className: "fail",
          text: "성장 (실패)",
          icon: "/images/0/cluster4/icon/icon - 성장(실패).png",
        };
      case "휴식(개인)":
        return {
          className: "rest-personal",
          text: "휴식 (개인)",
          icon: "/images/0/cluster4/icon/icon - 휴식(개인).png",
        };
      case "휴식(공식)":
        return {
          className: "rest-official",
          text: "휴식 (공식)",
          icon: "/images/0/cluster4/icon/icon - 휴식(공식).png",
        };
      case "진행 중":
        return {
          className: "in-progress",
          text: "성장 (진행 중)",
          icon: "/images/0/cluster4/icon/icon - 성장 (진행 중).png",
        };
      case "집계 중":
        return {
          className: "counting",
          text: "성장 (집계 중)",
          icon: "/images/0/cluster4/icon/icon - 성장 (집계 중).png",
        };
      default:
        return {
          className: "success",
          text: "성장 (성공)",
          icon: "/images/0/cluster4/icon/icon - 성장(성공).png",
        };
    }
  };

  const statusBadgeInfo = getStatusBadgeInfo(weekData?.growthStatus);

  // 태그 색상 배열
  const tagColors = ["tag--pink", "tag--red", "tag--yellow", "tag--purple", "tag--green", "tag--cyan", "tag--mint", "tag--dark"];

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
    const apiData =
      weeklyReputations.length > 0
        ? weeklyReputations.map((rep, index) => {
            const reviewer = rep.reviewer;
            // 나이 계산
            let age: string | number = "-";
            if (reviewer?.birth_date) {
              const birthYear = new Date(reviewer.birth_date).getFullYear();
              const currentYear = new Date().getFullYear();
              age = currentYear - birthYear;
            }

            return {
              id: rep.id,
              name: reviewer?.display_name || "-",
              gender: reviewer?.gender || "-",
              age: age,
              profileImg: reviewer?.profile_photo_url || "",
              university: reviewer?.university || "-",
              major: reviewer?.major_first || "-",
              team: reviewer?.teamName || "-",
              part: reviewer?.partName || "-",
              nickname: reviewer?.vision || "-",
              role: reviewer?.role ? roleLabels[reviewer.role] || reviewer.role : "일반",
              rating: rep.rating / 2, // 10점 만점 → 5점 만점 변환 (별 표시용)
              ratingCount: `${rep.rating} / 10`,
              description: rep.content || "-",
              fm: 1, // FM은 항상 1
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
  }, [weeklyReputations, isDemoMode, searchParams]);

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

    // API에서 가져온 selectedColleagues를 UI 형식으로 변환
    const apiData =
      selectedColleagues.length > 0
        ? selectedColleagues.map((c) => ({
            id: c.id,
            name: c.name || "-",
            gender: c.gender || "-",
            age: c.age || "-",
            profileImg: c.profileImg || "",
            university: c.university || "-",
            major: c.major || "-",
            team: c.team || "-",
            part: c.part || "-",
            nickname: c.nickname || "-",
            role: c.role || "일반",
            date: c.createdAt ? formatDate(c.createdAt) : "-",
            message: c.message || "",
            created_at: c.createdAt || null, // 작업 6에서 reputation-timestamp 표시용
            isEmpty: false,
          }))
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

    // createdAt 오름차순 정렬 (reputation 패턴 동일)
    apiData.sort((a: any, b: any) => {
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
  }, [selectedColleagues, isRestMode, isDemoMode, searchParams]);

  // 실무 정보 activity_type_id → UI 매핑
  const activityTypeConfig: { [key: string]: { category: string; tagColor: string; icon: string; isFruit: boolean } } = {
    wisdom: { category: "위즈덤", tagColor: "tag--red", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 위즈덤.png", isFruit: true },
    essay: { category: "에세이", tagColor: "tag--yellow", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 에세이.png", isFruit: true },
    infodesk: { category: "인포데스크", tagColor: "tag--purple", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 인포데스크.png", isFruit: true },
    calendar: { category: "캘린더", tagColor: "tag--dark", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 캘린더.png", isFruit: true },
    forum: { category: "포럼", tagColor: "tag--green", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 포럼.png", isFruit: true },
    session: { category: "세션", tagColor: "tag--cyan", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 세션.png", isFruit: true },
    practical_lecture: { category: "실무특강", tagColor: "tag--mint", icon: "/images/0/cluster4/icon/실무 정보/실무 정보 - 실무특강.png", isFruit: true },
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

  // 강화 상태 판단 함수 (결정 시점 기반: N+1주(목) 12:01 KST)
  // - 해당 없음: 활동 미개설(is_active=false) / 온보딩 주차(무적 주차) / 개인 휴식 / 역할 미스매치 / 누적 주차 외
  // - 강화 실패: 활동 개설됨 + 카페 댓글 집계에서 이행하지 않음 (is_completed = false) — 진행 중에도 즉시 표시
  // - 강화 대기: 활동 개설됨 + 이행함 (is_completed = true) + 결정 시점 이전
  // - 강화 성공: 활동 개설됨 + 이행함 (is_completed = true) + 결정 시점 이후
  // - empty: 더미데이터의 sentinel 플래그 (record.is_empty)
  // ※ 2차 정보 작성 여부 / weekly_activities.deadline / opened_at+48h 는 강화 성공/실패 판정에 영향을 주지 않는다.
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

    if (!record || !record.is_completed) {
      // 레코드 없거나 is_completed = false → 강화 실패 (진행 중 phase에도 즉시 표시)
      return "failed";
    }

    // 이행함 (is_completed = true) — 결정 시점 도달 여부로 결정
    return resultsDecided ? "success" : "waiting";
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

  // 운영진이 입력한 output links 개수 가져오기
  const getAdminOutputLinksCount = (activityType: string): number => {
    // 실무 경력: career_projects의 output_links에서 가져옴
    const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
    if (careerIndex >= 0 && careerRecords[careerIndex]) {
      return careerRecords[careerIndex].output_links?.filter((l: { url?: string }) => l.url?.trim())?.length || 0;
    }
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    return activity?.output_links?.filter((l) => l.url?.trim())?.length || 0;
  };

  // 운영진이 입력한 output links 가져오기
  const getAdminOutputLinks = (activityType: string): OutputLink[] => {
    // 실무 경력: career_projects의 output_links에서 가져옴
    const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
    if (careerIndex >= 0 && careerRecords[careerIndex]) {
      return (careerRecords[careerIndex].output_links || []) as OutputLink[];
    }
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    return activity?.output_links || [];
  };

  // 운영진이 업로드한 output images 가져오기 (최대 2)
  const getAdminOutputImages = (activityType: string): Array<{ url: string; caption: string }> => {
    // 실무 경력: career_projects.output_images (career_records API 가 project 정보 같이 반환)
    const careerIndex = (careerTypeIds.length > 0 ? careerTypeIds : ["practical_project"]).indexOf(activityType);
    if (careerIndex >= 0 && careerRecords[careerIndex]) {
      const imgs = careerRecords[careerIndex].output_images || [];
      return imgs.filter((i) => i?.url?.trim());
    }
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
    return (activity?.output_images || []).filter((i) => i?.url?.trim());
  };
  const getAdminOutputImagesCount = (activityType: string): number => getAdminOutputImages(activityType).length;

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
          week_id: weekId,
          activity_type_id: activityType,
          sub_title: newSubTitle,
          output_links: newOutputLinks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to save activity detail:", error);
        await popup.alert("저장에 실패했습니다.");
        return;
      }
    } catch (error) {
      console.error("Error saving activity detail:", error);
      await popup.alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 통계 재계산 함수 (저장 후 즉시 업데이트용 - 강화 성공 기준: is_completed + 결정 시점 도달)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recalculateStats = (_updatedDetails: ActivityDetail[]) => {
    const activeActivities = weeklyActivities.filter((a) => a.is_active);

    // 강화 성공 여부 판단 헬퍼 (2차 정보 / deadline 무관, 결정 시점만 본다 — getEnhancementStatus 와 동일)
    const isEnhancementSuccessLocal = (activityTypeId: string): boolean => {
      if (!resultsDecided) return false;
      return weekApprovedTypes.has(activityTypeId);
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
  const workInfoCards = [
    ...workInfoActivityTypes.map((activityType, index) => {
      const activity = weeklyActivities.find((a) => a.activity_type_id === activityType);
      const detail = weekActivityDetails.find((d) => d.activity_type_id === activityType);
      const config = activityTypeConfig[activityType];
      const enhancementStatus = getEnhancementStatus(activityType);

      // Output Links 병합 (운영진 링크 + 사용자 링크)
      const adminLinks = activity?.output_links || [];
      const userLinks = detail?.output_links || [];
      const adminCount = adminLinks.filter((l: { url?: string }) => l.url?.trim()).length;
      const mergedOutputLinks: { desc: string; url: string }[] = [];
      for (let i = 0; i < 5; i++) {
        if (i < adminCount && adminLinks[i]?.url?.trim()) {
          // 운영진 링크
          mergedOutputLinks.push(adminLinks[i]);
        } else {
          // 사용자 링크 (운영진 링크 개수만큼 오프셋)
          const userLinkIndex = i - adminCount;
          if (userLinks[userLinkIndex]?.url?.trim()) {
            mergedOutputLinks.push(userLinks[userLinkIndex]);
          } else {
            mergedOutputLinks.push({ desc: "", url: "" });
          }
        }
      }

      return {
        id: index + 1,
        activityType,
        title: activity?.title || "-", // 운영진이 입력한 Main Title (없으면 '-')
        subTitle: detail?.sub_title || "",
        growthPoint: detail?.growth_point || "",
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
        images: normalizeWorkInfoImages(detail?.image_urls || undefined),
        imageCaptions: normalizeWorkInfoCaptions(detail?.image_captions || undefined),
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

  const workAbilityCards = workAbilityCardLineCodes.map((lineCodeKey, index) => {
    const mapping = workAbilityLineMap[lineCodeKey];
    const matchedActivityTypeId = workAbilityActivityTypes.find((typeId) => {
      const lineCode = activityTypesMap.get(typeId)?.line_code || typeId;
      return lineCode.replace(/\s+/g, "") === lineCodeKey;
    });
    const activityTypeId = matchedActivityTypeId || lineCodeKey;
    const activityTypeInfo = matchedActivityTypeId ? activityTypesMap.get(matchedActivityTypeId) : undefined;
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityTypeId);
    const detail = weekActivityDetails.find((d) => d.activity_type_id === activityTypeId);
    const enhancementStatus = isRestMode ? ("not_applicable" as EnhancementStatus) : getEnhancementStatus(activityTypeId);
    const adminLinks = activity?.output_links || [];
    const userLinks = detail?.output_links || [];
    const adminCount = adminLinks.filter((l: { url?: string }) => l.url?.trim()).length;
    const mergedOutputLinks: { desc: string; url: string }[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < adminCount && adminLinks[i]?.url?.trim()) {
        mergedOutputLinks.push(adminLinks[i]);
      } else {
        const userLinkIndex = i - adminCount;
        mergedOutputLinks.push(userLinks[userLinkIndex]?.url?.trim() ? userLinks[userLinkIndex] : { desc: "", url: "" });
      }
    }

    return {
      id: index + 1,
      activityTypeId,
      code: mapping.lineCode,
      lineCode: mapping.lineCode,
      lineName: mapping.lineName,
      badge: mapping.lineName,
      title: activity?.title || mapping.mainTitle,
      subTitle: detail?.sub_title || "",
      growthPoint: detail?.growth_point || "",
      outputLinks: mergedOutputLinks,
      images: normalizeWorkInfoImages(detail?.image_urls || undefined) as (string | null)[] | null,
      imageCaptions: normalizeWorkInfoCaptions(detail?.image_captions || undefined) as string[] | null,
      icon: getWorkAbilityIcon(mapping.lineName),
      status: enhancementStatus,
      statusIcon: enhancementStatusIcons[enhancementStatus],
      enhancementStatus,
      isFailed: enhancementStatus === "failed",
      isEmpty: false,
      hasActivity: !!activity || !!activityTypeInfo,
    };
  });

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
  const matchedAbilityCard = isRestMode ? effectiveWorkAbilityCards.find((c) => c.hasActivity) : effectiveWorkAbilityCards.find((c) => c.enhancementStatus !== "not_applicable");
  const isAbilityCardVoid = !matchedAbilityCard;
  const abilityVoidFallbackStatus: EnhancementStatus = isRestMode || isOnboardingWeek ? "not_applicable" : "failed";
  const displayedAbilityCard = matchedAbilityCard ?? {
    id: 0,
    activityTypeId: "",
    code: "-",
    lineCode: "-",
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
    isFailed: abilityVoidFallbackStatus === "failed",
    isEmpty: true,
    hasActivity: false,
  };

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

  const workExpCards = adminProcessedExpTypeIds.map((activityTypeId, index) => {
    const activityType = activityTypesMap.get(activityTypeId);
    const activity = weeklyActivities.find((a) => a.activity_type_id === activityTypeId);
    const detail = weekActivityDetails.find((d) => d.activity_type_id === activityTypeId);
    const enhStatus = getEnhancementStatus(activityTypeId);
    const lineCodeKey = (activityType?.line_code || "").replace(/\s+/g, "");
    const fallbackMapping = workExpLineMap[lineCodeKey];
    const hasActivity = !!activity;

    // 별점 계산 (points 테이블에서 가져온 평점 사용, 0~10 정수)
    const ratingScore = activityRatings.get(activityTypeId) || 0;
    const rating = ratingScore / 2; // 별 표시용 (0~5)

    // 기존 index === 3 보이드 강제 제거 — workExpLineMap 6개 항목 전부 유효 카드로 처리

    // workInfo 패턴 복제: outputLinks 병합 (운영진 + 사용자)
    const adminLinks = activity?.output_links || [];
    const userLinks = detail?.output_links || [];
    const adminCount = adminLinks.filter((l: { url?: string }) => l.url?.trim()).length;
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

    // 어드민 output_images(weekly_activities.output_images) 와 크루 image_urls 병합 — workCareer 와 동일 패턴.
    // 어드민 슬롯 우선, 그 다음 크루 슬롯. 레거시로 image_urls 에 어드민 URL 이 같이 저장된 경우 중복 제거.
    const adminImgs = (activity?.output_images || []).filter((i: { url?: string }) => i?.url?.trim());
    const adminUrlSet = new Set(adminImgs.map((i: { url: string }) => i.url));
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
    const mergedImages: (string | null)[] = [];
    const mergedCaptions: string[] = [];
    for (let i = 0; i < WORKINFO_IMAGE_SLOT_COUNT; i++) {
      if (i < adminImgs.length) {
        mergedImages.push(adminImgs[i].url);
        mergedCaptions.push(adminImgs[i].caption || "");
      } else {
        const crewIdx = i - adminImgs.length;
        mergedImages.push(filteredCrewImgs[crewIdx] || null);
        mergedCaptions.push(filteredCrewCaps[crewIdx] || "");
      }
    }

    return {
      id: index + 1,
      activityTypeId,
      code: activityType?.line_code || fallbackMapping?.lineCode || "-",
      badge: activityType?.name || fallbackMapping?.lineName || "-",
      title: activity?.title || fallbackMapping?.mainTitle || "-",
      subTitle: detail?.sub_title || "",
      growthPoint: detail?.growth_point || "",
      outputLinks: mergedOutputLinks,
      images: normalizeWorkInfoImages(mergedImages),
      imageCaptions: normalizeWorkInfoCaptions(mergedCaptions),
      verified: enhStatus === "success",
      rating: rating,
      ratingCount: hasActivity ? `${ratingScore} / 10` : "- / 10",
      hasWeb: (detail?.output_links?.length || 0) > 0,
      icon: getWorkExpIcon(fallbackMapping?.lineName || activityType?.name || ""),
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

  // 휴식 모드(공식/개인) — 운영진 개설 여부와 무관하게 Main Title 강제 '-'.
  // 별점/카테고리 등 본문은 보존, Main Title 만 차폐. 미개설 라인은 void 카드로 패딩.
  const effectiveWorkExpCards = isRestMode
    ? [
        ...workExpCards
          .filter((c) => c.hasActivity)
          .map((card) => ({
            ...card,
            title: "",
            enhancementStatus: "not_applicable" as EnhancementStatus,
            isFailed: false,
          })),
        buildVoidWorkExpCard(0),
        buildVoidWorkExpCard(1),
        buildVoidWorkExpCard(2),
        buildVoidWorkExpCard(3),
      ]
    : [...workExpCards.filter((c) => c.enhancementStatus !== "not_applicable"), buildVoidWorkExpCard(0), buildVoidWorkExpCard(1), buildVoidWorkExpCard(2), buildVoidWorkExpCard(3)];

  // 실무 경험 통계 — 카드 표시 기준(getEnhancementStatus 결과)에 맞춰 derive.
  // 운영진이 개설한 활동 중 이 크루에게 해당 없음(역할/이력 외)인 라인은 카운트에서 제외.
  const experienceStatsDisplay = {
    total: workExpCards.filter((c) => c.enhancementStatus !== "not_applicable").length,
    success: workExpCards.filter((c) => c.enhancementStatus === "success").length,
  };

  // 실무 경력 카드 데이터 (DB에서 가져온 프로젝트 기반 데이터 변환)
  const workCareerCards =
    careerRecords.length > 0
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
          const adminImgs = (record.output_images || []).filter((i) => i?.url?.trim());
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
          const mergedImages: (string | null)[] = [];
          const mergedCaptions: string[] = [];
          for (let i = 0; i < WORKCAREER_IMAGE_SLOT_COUNT; i++) {
            if (i < adminImgs.length) {
              mergedImages.push(adminImgs[i].url);
              mergedCaptions.push(adminImgs[i].caption || "");
            } else {
              const crewIdx = i - adminImgs.length;
              mergedImages.push(crewImgs[crewIdx] || null);
              mergedCaptions.push(crewCaps[crewIdx] || "");
            }
          }
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

  // 데이터 수만큼만 표시, 0개면 빈 카드 1개만
  const displayWorkCareerCards = sortedWorkCareerCards.length > 0 ? sortedWorkCareerCards : [emptyCareerCard(1)];

  // 페이지네이션: 6개씩 한 페이지
  const CAREER_CARDS_PER_PAGE = 6;
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
    return <div className="cluster4-card-content weekly-card-detail" style={{ marginRight: "27px", minHeight: "400px" }} />;
  }

  return (
    <div className="cluster4-card-content weekly-card-detail" style={{ marginRight: "27px" }}>
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
            <Link href={`/cluster-4${urlUserId ? `?userId=${urlUserId}` : ""}`} className="tab-badge" onClick={(e) => e.stopPropagation()}>
              <span className="badge-text">Weekly Growth</span>
              <img src="/images/0/cluster4/icon/icon%20-%20wallet.png" alt="wallet" className="badge-icon" />
            </Link>
          </div>
          <Link href={`/cluster-4-1${urlUserId ? `?userId=${urlUserId}` : ""}`} className="tab" style={{ width: "44px", height: "44px" }}>
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
            <Link href={`/cluster-4-card/${prevWeekId}${urlUserId ? `?userId=${urlUserId}` : ""}`} className="nav-btn-prev">
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
            <Link href={`/cluster-4-card/${nextWeekId}${urlUserId ? `?userId=${urlUserId}` : ""}`} className="nav-btn-next">
              <span>다음 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20right.png" alt="right" className="arrow-icon" />
            </Link>
          ) : (
            <button className="nav-btn-next disabled" disabled>
              <span>다음 주</span>
              <img src="/images/0/cluster4/icon/icon%20-%20arrow%20right.png" alt="right" className="arrow-icon" />
            </button>
          )}
          <Link href={`/cluster-4${urlUserId ? `?userId=${urlUserId}` : ""}#weekly-filter-bar`} className="nav-btn-filled">
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
                // 임시: 마더 계정(어드민) 외에는 주차 평판 작성/수정 비활성화
                if (!isDemoMode && !session?.user?.isAdmin) {
                  await popup.alert("작성할 수 있는 기간이 아닙니다. 😊");
                  return;
                }
                if (!isDemoMode && isOwner && !session?.user?.isAdmin) {
                  await popup.alert("주차 평판은 타 크루만이 작성할 수 있습니다.");
                  return;
                }
                handleEditClick(() => {
                  if (!isDemoMode && !canEditReputation) {
                    alert("관리자 승인 후 작성할 수 있습니다.");
                    return;
                  }
                  // 이미 작성한 평판이 있는지 확인 (편집 경로 진입)
                  const myExistingRep = !isDemoMode && session?.user?.id ? weeklyReputations.find((r: any) => r.reviewer_id === session.user.id) : null;

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
                    setSelectedReputationCard({
                      id: myExistingRep.id,
                      name: reviewer?.display_name || "-",
                      gender: reviewer?.gender || "-",
                      age,
                      profileImg: reviewer?.profile_photo_url || "",
                      university: reviewer?.university || "-",
                      major: reviewer?.major_first || "-",
                      team: reviewer?.teamName || "-",
                      part: reviewer?.partName || "-",
                      nickname: reviewer?.vision || "-",
                      role: reviewer?.role ? roleLabels[reviewer.role] || reviewer.role : "일반",
                      rating: (myExistingRep.rating || 0) / 2,
                      ratingCount: `${myExistingRep.rating || 0} / 10`,
                      description: myExistingRep.content || "",
                      fm: 1,
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
              alt="주차 이미지"
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
              <h1 className="section1-title">{currentTitle}</h1>
              <div className={`status-badge ${statusBadgeInfo.className}`}>
                <span>{statusBadgeInfo.text}</span>
                <img src={statusBadgeInfo.icon} alt={statusBadgeInfo.text} />
              </div>
            </div>
            <div className="header-info-row">
              <div className="info-badge date" style={{ alignSelf: "flex-start" }}>
                <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" />
                <span>{weekData ? `${formatDate(weekData.startDate)} ~ ${formatDate(weekData.endDate)}` : "로딩 중..."}</span>
              </div>
              <div className="info-badge role" style={{ width: "fit-content", minWidth: "auto", maxWidth: "200px", fontFamily: "'Pretendard', sans-serif", alignSelf: "flex-start" }}>
                <img src="/images/0/cluster4/icon/Interface/Star-3.png" alt="role" />
                <span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>{truncate(roleLabel, 8)}</span>
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
                    <span className="highlight">{weekData?.growthStatus === "진행 중" || weekData?.growthStatus === "집계 중" ? "+1" : cumulativeApprovedWeeks}</span> / 25 주차
                  </span>
                </div>
                <button ref={weekConfirmBtnRef} type="button" className={`week-confirm-btn status-${weekStatus}${isWeekConfirmed ? " is-confirmed" : ""}`} onClick={handleWeekConfirmClick} disabled={weekStatus !== "pending"} aria-label={isWeekConfirmed ? "주차 확인 완료" : "주차 확인 필요"}>
                  <span className="icon-shift">
                    <i className={isWeekConfirmed ? "ti ti-circle-check-filled" : "ti ti-circle-check"}></i>
                  </span>
                  <span>{isWeekConfirmed ? "확인 완료" : "확인 필요"}</span>
                </button>
                <button type="button" className="detail-log-btn" onClick={() => setShowDetailLogModal(true)} aria-label="Detail Log 열기">
                  <i className="ti ti-list-details"></i>
                  <span>Detail Log</span>
                </button>
              </div>
            </div>
            <div className="header-info-row2" style={{ gap: "11px" }}>
              <div className="info-group left" style={{ flexShrink: 0 }}>
                <span className="info-item team" style={{ display: "inline-flex", minWidth: "245px", maxWidth: "245px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif" }}>
                  <strong>[팀]&nbsp;</strong>
                  <span className="text-gray">{isOnboardingWeek ? "클럽 온보딩" : teamName === "운영진" && generation ? `운영진(${generation}기)` : (teamName || "-").length > 10 ? (teamName || "-").slice(0, 10) + ".." : teamName || "-"}</span>
                </span>
                <span className="info-divider" style={{ marginLeft: "-63px" }}>
                  |
                </span>
                <span className="info-item part" style={{ display: "inline-flex", minWidth: "245px", maxWidth: "245px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", marginLeft: "-4px" }}>
                  <strong>[파트]&nbsp;</strong>
                  <span className="text-gray">
                    {isOnboardingWeek
                      ? "신입OT"
                      : teamName === "운영진" && partName === "팀장" && managedTeamName
                        ? `팀장(${managedTeamName})`.length > 10
                          ? `팀장(${managedTeamName})`.slice(0, 10) + ".."
                          : `팀장(${managedTeamName})`
                        : (partName || "-").length > 10
                          ? (partName || "-").slice(0, 10) + ".."
                          : partName || "-"}
                  </span>
                </span>
              </div>
              <div className="info-group right" style={{ gap: "8px", fontSize: "16px", fontFamily: "'Pretendard', sans-serif", marginLeft: "0px" }}>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  단감
                  <img src="/images/0/cluster4/icon/icon - 단감.png" alt="단감" className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                    {weekPoints.star}
                  </strong>
                  <span className="unit-text">개</span>
                </span>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  인절미
                  <img src="/images/0/cluster4/icon/icon - 인절미.png" alt="인절미" className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                    {Math.abs(weekPoints.shield - weekPoints.lightning)}
                  </strong>
                  <span className="unit-text">개</span>
                </span>
                <span className="info-divider">·</span>
                <span className="info-item with-icon">
                  어흥
                  <img src="/images/0/cluster4/icon/icon - 어흥.png" alt="어흥" className="item-icon" />
                  <strong className="number-value" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                    {Math.abs(weekPoints.lightning)}
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
                <span className="count-num">{weeklyReputations.length}</span>/4
              </span>
              <span className="fm-badge">
                <img src="/images/0/cluster4/wifi new.png" alt="wifi" className="wifi-icon" />
                <span className="fm-label">FM :</span>
                <span className="fm-value">{reputationData.filter((c: any) => c && !c.isEmpty).reduce((sum: number, c: any) => sum + (c.fm || 0), 0)}</span>
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
                            <img src="/images/0/waiting.png" alt="waiting" />
                            <p>주차 평판 대기 중... 😊</p>
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
                          <div className="profile-image">{!isEmpty && user.profileImg ? <img src={user.profileImg} alt={user.name} /> : <div className="profile-placeholder"></div>}</div>
                          <div className="profile-info">
                            <div className="profile-name">
                              {isEmpty ? (
                                <>
                                  <span className="text">-</span> | <span className="text">-</span> | <span className="text">-</span>
                                </>
                              ) : (
                                <>
                                  <span className="text">{user.name}</span> | <span className="text">{user.gender}</span> | <span className="text">{mask.age(user.age)}세</span>
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
                                        {(user.role || "일반").length > 7 ? (user.role || "일반").slice(0, 7) + ".." : user.role || "일반"}
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
                    if (!(await requireWriteWindow())) return;
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
                <span className="count-num">{selectedColleagues.length}</span>/3
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
                      <div className="profile-image">{!isEmpty && user.profileImg ? <img src={user.profileImg} alt={user.name} /> : <div className="profile-placeholder"></div>}</div>
                      <div className="profile-info">
                        <div className="profile-name-row">
                          <div className="profile-name">
                            {isEmpty ? (
                              <>
                                <span className="text">-</span> | <span className="text">-</span> | <span className="text">-</span>
                              </>
                            ) : (
                              <>
                                <span className="text">{user.name}</span> | <span className="text">{user.gender}</span> | <span className="text">{mask.age(user.age)}세</span>
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
                                {(user.role || "일반").length > 10 ? (user.role || "일반").slice(0, 10) + ".." : user.role || "일반"}
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
                  {isRestMode ? "-" : infoStats.total + competencyStats.total + experienceStatsDisplay.total + careerStats.total}
                </span>{" "}
                개 중{" "}
                <span className="highlight" style={{ display: "inline-block", minWidth: "2ch", textAlign: "right" }}>
                  {isRestMode ? "-" : infoStats.success + competencyStats.success + experienceStatsDisplay.success + careerStats.success}
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
                    : `${infoStats.total + competencyStats.total + experienceStatsDisplay.total + careerStats.total > 0 ? Math.ceil(((infoStats.success + competencyStats.success + experienceStatsDisplay.success + careerStats.success) / (infoStats.total + competencyStats.total + experienceStatsDisplay.total + careerStats.total)) * 100) : isOnboardingWeek ? 100 : 0}%`,
                }}
              ></div>
              {isRestMode && <span className="rest-message">휴식주차로서 집계되지 않습니다</span>}
            </div>
          </div>
          <div className="growth-center">
            <span className="progress-percent">
              <span className="number">
                {isRestMode
                  ? "-"
                  : infoStats.total + competencyStats.total + experienceStatsDisplay.total + careerStats.total > 0
                    ? Math.ceil(((infoStats.success + competencyStats.success + experienceStatsDisplay.success + careerStats.success) / (infoStats.total + competencyStats.total + experienceStatsDisplay.total + careerStats.total)) * 100)
                    : isOnboardingWeek
                      ? 100
                      : 0}
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
              총 <span style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right", color: "white", fontSize: 24, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, textTransform: "uppercase" as const, lineHeight: "31px" }}>{isRestMode ? "-" : infoStats.total}</span> 개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isRestMode ? "-" : infoStats.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">파트 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isRestMode ? "-" : infoStats.total > 0 ? Math.ceil((infoStats.success / infoStats.total) * 100) : 0}
                </span>
                %
              </span>
            </div>
          </div>
          <div className="work-info-cards">
            {effectiveWorkInfoCards.map((card) => {
              const isEmpty = card.isEmpty;
              return (
                <div
                  key={card.id}
                  className={`work-info-card ${isEmpty ? "empty" : ""} ${card.status === "empty" ? "is-empty-card" : ""}`}
                  onClick={async () => {
                    setSelectedWorkInfoCard(card);
                    setWorkInfoViewModalOpen(true);
                  }}
                  style={{ cursor: "pointer" }}
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
                      <div className={`card-icon-area ${!isEmpty && card.isFruit ? "fruit" : ""} ${!isEmpty && card.isFailed ? "failed" : ""}`}>
                        {!isEmpty && card.icon ? <img src={card.icon} alt={card.category} style={{ opacity: card.status === "failed" || card.status === "not_applicable" ? 0.3 : 1 }} /> : <div className="icon-placeholder"></div>}
                        {!isEmpty && card.isFailed && (
                          <div className="failed-overlay" style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span className="failed-text" style={{ whiteSpace: "nowrap", width: "auto", color: "#ff4444", fontWeight: "800" }}>
                              강화 실패
                            </span>
                            <span className="failed-emoji">😿</span>
                          </div>
                        )}
                      </div>
                      <span className="card-desc">{isEmpty ? "-" : card.title || "-"}</span>
                      {!isEmpty && <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />}
                    </div>
                  </div>
                  {!isEmpty && card.status !== "empty" && card.status && card.statusIcon && (
                    <div className="status-badge">
                      <img src={card.statusIcon} alt={card.status} />
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
                {isOnboardingWeek || isRestMode ? "-" : experienceStatsDisplay.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : experienceStatsDisplay.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">파트 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : experienceStatsDisplay.total > 0 ? Math.ceil((experienceStatsDisplay.success / experienceStatsDisplay.total) * 100) : 0}
                </span>
                %
              </span>
            </div>
          </div>
          <div className="work-exp-cards">
            {Array.from({ length: 5 }, (_, cardIndex) => {
              // 슬롯 기반 렌더링: 실제 데이터 개수와 무관하게 항상 5개 슬롯을 만든다.
              //  - cardIndex 0~3 : 실제 카드 데이터 → 없으면 buildVoidWorkExpCard 로 폴백(empty)
              //  - cardIndex 4   : 데이터 유무와 무관하게 '잠금 상태' empty 카드 (lock-overlay 부착)
              //  - cardIndex 5+  : 만들지 않음 (3행 2열 grid 우측 하단 셀은 비워둠)
              const isLocked = cardIndex === 4;
              const card = isLocked ? buildVoidWorkExpCard(cardIndex) : (effectiveWorkExpCards[cardIndex] ?? buildVoidWorkExpCard(cardIndex));
              const isEmpty = isLocked ? true : card.isEmpty;
              const expActivityType = workExpActivityTypes[cardIndex];
              return (
                <div
                  key={`work-exp-slot-${cardIndex}`}
                  className={`work-exp-card ${isEmpty ? "empty" : ""}${isLocked ? " locked" : ""}`}
                  onClick={
                    isLocked
                      ? undefined
                      : async () => {
                          setSelectedWorkExpCard(card);
                          setWorkExpViewModalOpen(true);
                        }
                  }
                  style={{ cursor: isLocked ? "not-allowed" : "pointer" }}
                  aria-disabled={isLocked ? true : undefined}
                >
                  <div className="card-top-row">
                    <div className={`card-icon-area ${!isEmpty && card.enhancementStatus === "failed" ? "failed" : ""}`}>
                      {!isEmpty && card.icon ? <img src={card.icon} alt={card.badge} style={{ opacity: card.enhancementStatus === "failed" ? 0.3 : 1 }} /> : <div className="icon-placeholder"></div>}
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
                        <span className="code-tag">{isEmpty ? "-" : card.code}</span>
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
                            const text = weekActivityDetails.find((d) => d.activity_type_id === card.activityTypeId)?.sub_title || "-";
                            return text;
                          })()}
                    </span>
                    {!isEmpty && <img src="/images/0/cluster4/icon - 더보기.png" alt="더보기" className="card-arrow" />}
                  </div>
                  {!isEmpty && card.enhancementStatus !== "empty" && (
                    <div className={`status-badge ${isRestMode || isOnboardingWeek ? "not_applicable" : !card.hasActivity ? "failed" : card.enhancementStatus}`}>
                      {(() => {
                        if (isRestMode || isOnboardingWeek) return <img src="/images/0/cluster4/icon/8 해당 없음.png" alt="해당 없음" />;
                        if (!card.hasActivity) return <img src="/images/0/cluster4/icon/7 강화 실패.png" alt="강화 실패" />;
                        const statusImages: Record<string, string> = {
                          success: "/images/0/cluster4/icon/5 강화 성공.png",
                          waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                          failed: "/images/0/cluster4/icon/7 강화 실패.png",
                          not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                        };
                        return <img src={statusImages[card.enhancementStatus] || statusImages["not_applicable"]} alt="강화 상태" />;
                      })()}
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
                {isOnboardingWeek || isRestMode ? "-" : competencyStats.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : competencyStats.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">파트 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : competencyStats.total > 0 ? Math.ceil((competencyStats.success / competencyStats.total) * 100) : 0}
                </span>
                %
              </span>
            </div>
          </div>
          <div className="work-ability-cards">
            {[displayedAbilityCard].map((card) => {
              const isFailedCard = card.enhancementStatus === "failed";
              const usePlaceholder = isAbilityCardVoid;
              return (
                <div
                  key={isAbilityCardVoid ? "void" : card.code}
                  className={`work-ability-card ${usePlaceholder ? "empty" : ""}`}
                  onClick={async () => {
                    setSelectedWorkAbilityCard(card);
                    setWorkAbilityViewModalOpen(true);
                  }}
                  style={{ cursor: "pointer" }}
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
                      <span className="code-tag">{card.lineCode}</span>
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
                  {card.enhancementStatus !== "empty" && (
                    <div className="status-badge">
                      <img src={card.statusIcon} alt="강화 상태" />
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
                {isOnboardingWeek || isRestMode ? "-" : careerStats.total}
              </span>{" "}
              개 중{" "}
              <span className="highlight" style={{ display: "inline-block", minWidth: "2.5ch", textAlign: "right" }}>
                {isOnboardingWeek || isRestMode ? "-" : careerStats.success}
              </span>{" "}
              개
            </span>
            <div className="section-title-right">
              <span className="rate-label">파트 강화율</span>
              <span className="rate-value">
                <span className="highlight" style={{ display: "inline-block", minWidth: "3ch", textAlign: "right" }}>
                  {isOnboardingWeek || isRestMode ? "-" : careerStats.total > 0 ? Math.ceil((careerStats.success / careerStats.total) * 100) : 0}
                </span>
                %
              </span>
            </div>
          </div>
          <div className="work-career-cards">
            {currentCareerCards.map((card, cardIndex) => {
              const isEmpty = card.isEmpty;
              return (
                <div key={card.id} className="work-career-card-wrapper">
                  <div
                    className={`work-career-card ${isEmpty ? "empty" : ""} ${card.isFailed ? "failed" : ""} ${card.isNotApplicable ? "not-applicable" : ""}`}
                    onClick={async () => {
                      setSelectedWorkCareerCard(card);
                      setWorkCareerViewModalOpen(true);
                    }}
                    style={{ cursor: "pointer" }}
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
                          <span className="code-tag">{isEmpty ? "-" : card.code}</span>
                        </div>
                        <div className="grade-row">
                          <span className={`grade ${!isEmpty && card.grade === "S" ? "active" : ""}`}>S</span>
                          <span className={`grade ${!isEmpty && card.grade === "A" ? "active" : ""}`}>A</span>
                          <span className={`grade ${!isEmpty && card.grade === "B" ? "active" : ""}`}>B</span>
                          <span className={`grade ${!isEmpty && card.grade === "C" ? "active" : ""}`}>C</span>
                          <span className={`grade ${!isEmpty && card.grade === "D" ? "active" : ""}`}>D</span>
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
                  {!isEmpty && card.statusBadge && (
                    <div className="status-badge">
                      <img src={card.statusBadge} alt="status" />
                      {card.isNotApplicable && <span className="not-applicable-text">해당 없음</span>}
                    </div>
                  )}
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
                          <span>{card.code}</span>
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
                            <span>{card.code}</span>
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
                      <span className="crew-name">{colleagueEditData.selectedColleague.name || "-"}</span>
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
                              <span className="crew-name">{crew.name || "-"}</span>
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
                      onClick={async () => {
                        if (!(await requireWriteWindow())) return;
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
                      <button type="button" className="modal-save-btn" onClick={handleColleagueEditSave} disabled={colleagueSaving}>
                        {colleagueSaving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom">
                <span className={`modal-notice ${colleagueSaveAttemptFailed ? "notice-error" : ""}`} style={{ visibility: colleagueSaveAttemptFailed ? "visible" : "hidden" }}>
                  필수 사항이 누락되었어요! 확인 부탁드려요! 😊
                </span>
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
                  <div className="personal-photo">{selectedReputationCard.profileImg ? <img src={selectedReputationCard.profileImg} alt={selectedReputationCard.name} /> : <img src="/images/0/crew profile/남 1.webp" alt="profile" />}</div>

                  <div className="personal-info">
                    <div className="personal-row-1">
                      <span className="personal-name">{selectedReputationCard.name || "—"}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-gender">{selectedReputationCard.gender || "—"}</span>
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
                    <span className="tag-badge tag-role">{selectedReputationCard.role || "일반"}</span>
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
                  <span className="fm-value">{selectedReputationCard.fm ?? 0}</span>
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
                    style={{ padding: "8px 16px", background: "rgba(250, 171, 7, 0.2)", border: "1px solid #FAAB07", borderRadius: "6px", color: "#FAAB07", fontSize: "13px", cursor: "pointer" }}
                  >
                    수정
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("이 평판을 삭제하시겠습니까?")) return;
                      try {
                        const res = await fetch(`/api/weekly-reputations?id=${selectedReputationCard.id}`, { method: "DELETE" });
                        const json = await res.json();
                        if (json.success) {
                          alert("삭제되었습니다.");
                          setReputationViewModalOpen(false);
                          fetchWeeklyReputations();
                        } else {
                          alert(json.error || "삭제 실패");
                        }
                      } catch {
                        alert("삭제 중 오류 발생");
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
                  <div className="personal-photo">{selectedColleagueCard.profileImg ? <img src={selectedColleagueCard.profileImg} alt={selectedColleagueCard.name} /> : <img src="/images/0/crew profile/남 1.webp" alt="profile" />}</div>

                  <div className="personal-info">
                    <div className="personal-row-1">
                      <span className="personal-name">{selectedColleagueCard.name || "—"}</span>
                      <span className="personal-separator">|</span>
                      <span className="personal-gender">{selectedColleagueCard.gender || "—"}</span>
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
                    <span className="tag-badge tag-role">{selectedColleagueCard.role || "일반"}</span>
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
                  <span className="fromto-name">{selectedColleagueCard.fromName || myDisplayName || session?.user?.name || "-"}</span>
                  <span className="fromto-suffix">님</span>
                </span>
                <span className="fromto-arrow">→</span>
                <span className="fromto-block fromto-to">
                  <span className="fromto-label">To -</span>
                  <span className="fromto-name">{selectedColleagueCard.toName || selectedColleagueCard.name || "-"}</span>
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
        <div className="section-modal-overlay">
          <div className="section-modal work-view-modal workinfo-view-modal">
            {/* ── 헤더 (100px) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                {/* TODO: [백엔드 작업 필요] line↔activity 매핑 확정 후 "[라인: {lineName}]" 형태로 복원 — 현재는 category 표시 */}
                <h3>
                  실무 정보 <span className="line-name-text">{selectedWorkInfoCard.category || "카테고리"}</span>
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
                          src={isDemoMode ? "/images/0/crew profile/남 1.webp" : reviewerProfile.profilePhotoUrl || "/images/0/crew profile/남 1.webp"}
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
                          <span className="personal-name">{isDemoMode ? "홍길동" : reviewerProfile.displayName || session?.user?.name || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{isDemoMode ? "남" : reviewerProfile.gender || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{isDemoMode ? "22" : (reviewerProfile.age ?? "—")} 세</span>
                          <div className="personal-tags">
                            {/* TODO: [백엔드 작업 필요] role 필드 (운영진/앰배서더/일반 등) — profile API에 추가 필요 */}
                            <span className="tag-badge tag-role">{compactPersonalTag(isDemoMode ? "앰배서더" : roleLabel || "—", "—")}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(isDemoMode ? "엔비디아 구글 테슬라" : reviewerProfile.vision || "-", "-")}</span>
                          </div>
                        </div>

                        {/* 2행 — 학교·학과 (필드명/값 분리, 고정폭, 말줄임 없음) */}
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "서울대" : reviewerProfile.school || "—"}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "경영" : reviewerProfile.major || "—"}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        {/* 3행 — 팀·파트 (필드명/값 분리, 고정폭, 말줄임 없음) */}
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{teamName || (isDemoMode ? "마케팅" : "—")}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{partName || (isDemoMode ? "바이럴" : "—")}</span>
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
                        ) : (
                          <>
                            {selectedWorkInfoCard.statusIcon ? <img className="line-enhance-icon" src={selectedWorkInfoCard.statusIcon} alt={selectedWorkInfoCard.status || "강화 상태"} /> : <span className="line-status-icon">●</span>}
                            <span className={`line-enhance-status enhance-${(selectedWorkInfoCard.status as string) || "not_applicable"}`}>
                              {{
                                success: "강화 성공",
                                waiting: "강화 대기",
                                failed: "강화 실패",
                                not_applicable: "해당 없음",
                              }[selectedWorkInfoCard.status as string] || "—"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 좌중단: 2열 (시즌/주차/카테고리/상태 + Output Link 5개) */}
                  <div className="workinfo-mid-section">
                    {/* 1열: 시즌/주차/날짜 + 카테고리/강화상태 */}
                    <div className="workinfo-mid-col1">
                      <div className="workinfo-date-badge">
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        {/* TODO: [백엔드 작업 필요] line↔activity 매핑 확정 후 lineName/lineCode로 교체. 현재는 category로 대체. */}
                        {/* 1행: 활동 카테고리 — 기존 매핑 activityTypeConfig[activityType].icon (selectedWorkInfoCard.icon) 사용 */}
                        <div className="line-info-row">
                          {selectedWorkInfoCard.icon ? <img className="line-activity-icon" src={selectedWorkInfoCard.icon} alt={selectedWorkInfoCard.category || "활동"} /> : <span className="line-status-icon">●</span>}
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {"인포데스크"}
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
                          const adminCount = selectedWorkInfoCard?.activityType ? getAdminOutputLinksCount(selectedWorkInfoCard.activityType) : 0;
                          const isAdminLink = i < adminCount;
                          // 데모 데이터 (프론트 전용)
                          const demoOutputLinks = [
                            { desc: "성장 시즌 운영 매뉴얼", url: "https://example.com/manual" },
                            { desc: "실무 역량 강화 자료", url: "https://example.com/ability" },
                            { desc: "프로젝트 결과 보고서", url: "https://example.com/project-report" },
                            { desc: "커리어 트랙 로드맵", url: "https://example.com/career-roadmap" },
                            { desc: "주차별 성장 기록 아카이브", url: "https://example.com/growth-history" },
                          ];
                          // 표시 우선순위: 1) editing state (수정 모드) 2) admin preview 저장 값 3) card/demo data
                          const adminOverride = isAdminPreview ? adminSavedOutputLinks["workInfo"]?.[i] : null;
                          const link = workInfoViewIsEditing
                            ? editingOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim() ? adminOverride : demoOutputLinks[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workInfoViewIsEditing ? editingOutputLinks[i - 1] : (isAdminPreview ? adminSavedOutputLinks["workInfo"]?.[i - 1] : null);
                          const sequentialDisabled = workInfoViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          if (isAdminPreview && i === 0) console.log("[RenderWorkInfo]", { isEditing: workInfoViewIsEditing, link, adminOverride });
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workInfoViewIsEditing && (!isAdminLink || isAdminPreview) ? (
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
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => window.open(ensureProtocol(link.url), "_blank")}>
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
                      <div className="text-block-content main-title-readonly">{selectedWorkInfoCard.title && selectedWorkInfoCard.title !== "-" ? selectedWorkInfoCard.title : "-"}</div>
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
                        <div className="text-block-content">{selectedWorkInfoCard.subTitle || "-"}</div>
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
                        <div className="text-block-content">{selectedWorkInfoCard.growthPoint || "-"}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ──── 우측 — 이미지 2×2 그리드 ──── */}
                {/* 슬롯 0·1: 운영진 이미지 (read-only), 슬롯 2·3: 크루 이미지 (옵셔널) */}
                <div className="workinfo-right">
                  <div className="workinfo-image-grid images-grid">
                    {Array.from({ length: WORKINFO_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                      // 운영진 이미지 슬롯 분기
                      const adminImages = selectedWorkInfoCard?.activityType ? getAdminOutputImages(selectedWorkInfoCard.activityType) : [];
                      const adminCount = adminImages.length;
                      const isAdminSlot = imageIdx < 2;
                      // 슬롯 idx → 데이터 출처
                      // 0,1: adminImages[0], adminImages[1]
                      // 2,3: 크루 이미지 (image_urls[0], image_urls[1])
                      const viewImages = normalizeWorkInfoImages(selectedWorkInfoCard?.images);
                      const viewCaptions = normalizeWorkInfoCaptions(selectedWorkInfoCard?.imageCaptions);
                      const crewImagesForState = workInfoViewIsEditing ? editingImages : viewImages;
                      const crewCaptionsForState = workInfoViewIsEditing ? editingImageCaptions : viewCaptions;
                      let image: string | null = null;
                      let caption = "";
                      if (isAdminSlot) {
                        const adminImg = adminImages[imageIdx];
                        image = adminImg?.url || null;
                        caption = adminImg?.caption || "";
                      } else {
                        const crewSlotIdx = imageIdx - 2;
                        image = crewImagesForState[crewSlotIdx] || null;
                        caption = crewCaptionsForState[crewSlotIdx] || "";
                      }
                      // 어드민 슬롯은 클릭/편집/삭제 모두 비활성, 크루 슬롯만 편집 가능
                      const slotIsEditable = workInfoViewIsEditing && !isAdminSlot;
                      const crewSlotIdx = imageIdx - 2; // 슬롯 2,3 → 크루 image_urls[0,1]
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${imageIdx === 0 ? " large" : " small"}${isAdminSlot && !image ? " disabled" : ""}${isAdminSlot ? " admin-slot" : ""}`} style={{ position: "relative" }}>
                          {image ? (
                            <div className="image-preview" onClick={() => !isAdminSlot && handleImagePreview(crewSlotIdx)}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {slotIsEditable && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerImageUpload(crewSlotIdx);
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
                                      handleImageDelete(crewSlotIdx);
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
                                if (slotIsEditable) triggerImageUpload(crewSlotIdx);
                              }}
                            >
                              {slotIsEditable && (
                                <div className="image-actions-overlay">
                                  <button
                                    type="button"
                                    className="image-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerImageUpload(crewSlotIdx);
                                    }}
                                    title="업로드"
                                    aria-label="업로드"
                                  >
                                    <i className="ti ti-upload"></i>
                                  </button>
                                </div>
                              )}
                              <div className="empty-slot">{isAdminSlot ? <span style={{ color: "#aaa", fontSize: 12 }}>운영진 미업로드</span> : <i className="ti ti-photo-plus"></i>}</div>
                            </div>
                          )}
                          {!isAdminSlot && (
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                imageFileInputRefs.current[crewSlotIdx] = el;
                              }}
                              style={{ display: "none" }}
                              onChange={(e) => handleImageFileChange(e, crewSlotIdx)}
                            />
                          )}
                          {/* 캡션 바 — 어드민 슬롯은 보기 전용, 크루 슬롯만 편집 가능 */}
                          <div className="image-caption-overlay">
                            {slotIsEditable && activeCaptionIdx === crewSlotIdx ? (
                              <input
                                type="text"
                                className="caption-input"
                                value={editingImageCaptions[crewSlotIdx] || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 20) handleCaptionChange(crewSlotIdx, e.target.value);
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
                              className={`image-action-btn image-caption-btn${activeCaptionIdx === crewSlotIdx ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCaptionIdx(activeCaptionIdx === crewSlotIdx ? null : crewSlotIdx);
                              }}
                              title={activeCaptionIdx === crewSlotIdx ? "캡션 저장" : "캡션 편집"}
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
                  <span className="line-code image-line-code">{lineCodeMap[selectedWorkInfoCard.activityType] || selectedWorkInfoCard.activityType || ""}</span>
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
                      const locked = isLineLocked(selectedWorkInfoCard);
                      const isEmptyStatus = (selectedWorkInfoCard?.status as string) === "empty";
                      const disabled = !isAdminPreview && (!canEditWorkInfo || locked || isEmptyStatus);
                      const title = isEmptyStatus ? "빈 카드 상태에서는 수정할 수 없습니다." : locked ? LINE_LOCKED_TITLE : canEditWorkInfo || isAdminPreview ? "수정" : "작성할 수 있는 기간이 아닙니다. 😊";
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
        <div className="section-modal-overlay">
          <div className="section-modal work-view-modal workexp-view-modal">
            {/* ── 헤더 (100px) ── */}
            <div className="section-modal-header">
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" />
                <h3>
                  실무 경험 <span className="line-name-text">{lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "카테고리"}</span>
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
                          src={isDemoMode ? "/images/0/crew profile/남 1.webp" : reviewerProfile.profilePhotoUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>

                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{isDemoMode ? "홍길동" : reviewerProfile.displayName || session?.user?.name || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{isDemoMode ? "남" : reviewerProfile.gender || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{isDemoMode ? "22" : (reviewerProfile.age ?? "—")} 세</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(isDemoMode ? "앰배서더" : roleLabel || "—", "—")}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(isDemoMode ? "엔비디아 구글 테슬라" : reviewerProfile.vision || "-", "-")}</span>
                          </div>
                        </div>

                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "서울대" : reviewerProfile.school || "—"}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "경영" : reviewerProfile.major || "—"}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{teamName || (isDemoMode ? "마케팅" : "—")}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{partName || (isDemoMode ? "바이럴" : "—")}</span>
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
                        // 카드 status-badge와 동일 우선순위로 평가: isEmpty(보이드) → isRestMode/온보딩 → !hasActivity → enhancementStatus
                        const statusKey = selectedWorkExpCard.isEmpty ? "empty" : isRestMode || isOnboardingWeek ? "not_applicable" : !selectedWorkExpCard.hasActivity ? "failed" : (selectedWorkExpCard.enhancementStatus as string);
                        const statusText = enhanceStatusTextMap[statusKey] || "—";
                        const statusImages: Record<string, string> = {
                          success: "/images/0/cluster4/icon/5 강화 성공.png",
                          waiting: "/images/0/cluster4/icon/6 강화 대기.png",
                          failed: "/images/0/cluster4/icon/7 강화 실패.png",
                          not_applicable: "/images/0/cluster4/icon/8 해당 없음.png",
                        };
                        return (
                          <div className="personal-line-status line-info-row">
                            {statusKey === "empty" ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {statusImages[statusKey] ? <img className="line-enhance-icon" src={statusImages[statusKey]} alt={statusText} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${statusKey || "not_applicable"}`}>{statusText}</span>
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
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차` : "시즌 정보 로딩 중..."}</span>
                        <span className="date-range-text">{weekDateRange}</span>
                      </div>
                      <div className="workinfo-line-info">
                        <div className="line-info-row">
                          <img className="line-activity-icon" src={getWorkExpIcon(lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "")} alt={selectedWorkExpCard.badge || "활동"} />
                          <span className="line-name" style={{ lineHeight: "26px", height: "26px", overflow: "visible" }}>
                            {lookupWorkExpMapping(selectedWorkExpCard.code)?.lineName || selectedWorkExpCard.badge || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Output Link 5개 */}
                    <div className="workinfo-mid-col2">
                      <div className="workinfo-output-links" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          const dotColor = ["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"][i];
                          const adminCount = selectedWorkExpCard?.activityTypeId ? getAdminOutputLinksCount(selectedWorkExpCard.activityTypeId) : 0;
                          const isAdminLink = i < adminCount;
                          const adminOverride = isAdminPreview ? adminSavedOutputLinks["workExp"]?.[i] : null;
                          const link = workExpViewIsEditing
                            ? editingExpOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim() ? adminOverride : selectedWorkExpCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workExpViewIsEditing ? editingExpOutputLinks[i - 1] : (isAdminPreview ? adminSavedOutputLinks["workExp"]?.[i - 1] : null);
                          const sequentialDisabled = workExpViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          if (isAdminPreview && i === 0) console.log("[RenderWorkExp]", { isEditing: workExpViewIsEditing, link, adminOverride });
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workExpViewIsEditing && (!isAdminLink || isAdminPreview) ? (
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
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => window.open(ensureProtocol(link.url), "_blank")}>
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
                      <div className="text-block-content main-title-readonly">{lookupWorkExpMapping(selectedWorkExpCard.code)?.mainTitle || (selectedWorkExpCard.title && selectedWorkExpCard.title !== "-" ? selectedWorkExpCard.title : "-")}</div>
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
                      const isEnabled = imageIdx === 0 || !!imagesForState[imageIdx - 1];
                      const isRequired = imageIdx < 2;
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${imageIdx === 0 ? " large" : " small"}${!isEnabled ? " disabled" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
                          {image ? (
                            <div className="image-preview" onClick={() => handleExpImagePreview(imageIdx)}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {workExpViewIsEditing && (
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
                                if (workExpViewIsEditing && isEnabled) triggerExpImageUpload(imageIdx);
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
                  <span className="line-code image-line-code">{lookupWorkExpMapping(selectedWorkExpCard.code)?.lineCode || selectedWorkExpCard.code || ""}</span>

                  {/* 라인 평점 — 어드민(compliance-manage)에서 입력한 값을 읽기전용으로 표시 (0=미입력, 1~10) */}
                  {(() => {
                    const ratingValue = (selectedWorkExpCard?.rating ?? 0) * 2;
                    const halfValue = (ratingValue || 0) / 2;
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
                        <span className="rating-display">{ratingValue > 0 ? ratingValue : "-"} / 10</span>
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
                      const empty = selectedWorkExpCard?.isEmpty;
                      const locked = isLineLocked(selectedWorkExpCard);
                      const disabled = !isAdminPreview && (!canEditWorkExp || empty || locked);
                      const title = empty ? "비어있는 카드입니다" : locked ? LINE_LOCKED_TITLE : canEditWorkExp || isAdminPreview ? "수정" : "작성할 수 있는 기간이 아닙니다. 😊";
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkExp} disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
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
        <div className="section-modal-overlay">
          <div className="section-modal work-view-modal workability-view-modal">
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
                          src={isDemoMode ? "/images/0/crew profile/남 1.webp" : reviewerProfile.profilePhotoUrl || "/images/0/crew profile/남 1.webp"}
                          alt="profile"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>
                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{isDemoMode ? "홍길동" : reviewerProfile.displayName || session?.user?.name || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{isDemoMode ? "남" : reviewerProfile.gender || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{isDemoMode ? "22" : (reviewerProfile.age ?? "—")} 세</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(isDemoMode ? "앰배서더" : roleLabel || "—", "—")}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(isDemoMode ? "엔비디아 구글 테슬라" : reviewerProfile.vision || "-", "-")}</span>
                          </div>
                        </div>
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "서울대" : reviewerProfile.school || "—"}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "경영" : reviewerProfile.major || "—"}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{teamName || (isDemoMode ? "마케팅" : "—")}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{partName || (isDemoMode ? "바이럴" : "—")}</span>
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
                        const statusKey = selectedWorkAbilityCard.isEmpty ? "empty" : (selectedWorkAbilityCard.enhancementStatus as string);
                        const statusText = statusTextMap[statusKey] || "—";
                        return (
                          <div className="personal-line-status line-info-row">
                            {statusKey === "empty" ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {selectedWorkAbilityCard.statusIcon ? <img className="line-enhance-icon" src={selectedWorkAbilityCard.statusIcon} alt={statusText} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${statusKey || "not_applicable"}`}>{statusText}</span>
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
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차` : "시즌 정보 로딩 중..."}</span>
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
                          const adminCount = selectedWorkAbilityCard?.activityTypeId ? getAdminOutputLinksCount(selectedWorkAbilityCard.activityTypeId) : 0;
                          const isAdminLink = i < adminCount;
                          const adminOverride = isAdminPreview ? adminSavedOutputLinks["workAbility"]?.[i] : null;
                          const link = workAbilityViewIsEditing
                            ? editingAbilityOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim() ? adminOverride : selectedWorkAbilityCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workAbilityViewIsEditing ? editingAbilityOutputLinks[i - 1] : (isAdminPreview ? adminSavedOutputLinks["workAbility"]?.[i - 1] : null);
                          const sequentialDisabled = workAbilityViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workAbilityViewIsEditing && (!isAdminLink || isAdminPreview) ? (
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
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => window.open(ensureProtocol(link.url), "_blank")}>
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
                      <div className="text-block-content main-title-readonly">{selectedWorkAbilityCard.title && selectedWorkAbilityCard.title !== "-" ? selectedWorkAbilityCard.title : "-"}</div>
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
                      const viewImages = normalizeWorkInfoImages(selectedWorkAbilityCard?.images);
                      const viewCaptions = normalizeWorkInfoCaptions(selectedWorkAbilityCard?.imageCaptions);
                      const imagesForState = workAbilityViewIsEditing ? editingAbilityImages : viewImages;
                      const captionsForState = workAbilityViewIsEditing ? editingAbilityImageCaptions : viewCaptions;
                      const image = imagesForState[imageIdx] || null;
                      const caption = captionsForState[imageIdx] || "";
                      const isEnabled = imageIdx === 0 || !!imagesForState[imageIdx - 1];
                      const isRequired = imageIdx < 2;
                      return (
                        <div key={imageIdx} className={`workinfo-image-slot image-slot${imageIdx === 0 ? " large" : " small"}${!isEnabled ? " disabled" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
                          {image ? (
                            <div className="image-preview" onClick={() => handleAbilityImagePreview(imageIdx)}>
                              <img src={image} alt={`이미지 ${imageIdx + 1}`} />
                              {workAbilityViewIsEditing && (
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
                                if (workAbilityViewIsEditing && isEnabled) triggerAbilityImageUpload(imageIdx);
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
                  <span className="line-code image-line-code">{selectedWorkAbilityCard.lineCode || selectedWorkAbilityCard.code || ""}</span>
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
                      const empty = selectedWorkAbilityCard?.isEmpty;
                      const locked = isLineLocked(selectedWorkAbilityCard);
                      const disabled = !isAdminPreview && (!canEditWorkAbility || empty || locked);
                      const title = empty ? "비어있는 카드입니다" : locked ? LINE_LOCKED_TITLE : canEditWorkAbility || isAdminPreview ? "수정" : "작성할 수 있는 기간이 아닙니다. 😊";
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkAbility} disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
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
        <div className="section-modal-overlay">
          <div className="section-modal work-view-modal workcareer-view-modal">
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
                        <img src="/images/0/crew profile/남 1.webp" alt="profile" />
                      </div>

                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{isDemoMode ? "홍길동" : reviewerProfile.displayName || session?.user?.name || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{isDemoMode ? "남" : reviewerProfile.gender || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{isDemoMode ? "22" : (reviewerProfile.age ?? "—")} 세</span>
                          <div className="personal-tags">
                            <span className="tag-badge tag-role">{compactPersonalTag(isDemoMode ? "앰배서더" : roleLabel || "—", "—")}</span>
                            <span className="tag-badge tag-keyword">{compactPersonalTag(isDemoMode ? "엔비디아 구글 테슬라" : reviewerProfile.vision || "-", "-")}</span>
                          </div>
                        </div>

                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "서울대" : reviewerProfile.school || "—"}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "경영" : reviewerProfile.major || "—"}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>

                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{teamName || (isDemoMode ? "마케팅" : "—")}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{partName || (isDemoMode ? "바이럴" : "—")}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>

                      {(() => {
                        // workCareer는 careerRecords(DB) 기반이라 'empty' 트리거 경로가 현재 없음 —
                        // 향후 isEmpty 플래그가 추가되면 여기서 우선 분기되도록 대비.
                        const isEmptyCard = (selectedWorkCareerCard as { isEmpty?: boolean }).isEmpty === true;
                        const statusKey = isEmptyCard ? "empty" : selectedWorkCareerCard.verified ? "success" : selectedWorkCareerCard.isFailed ? "failed" : selectedWorkCareerCard.isNotApplicable ? "not_applicable" : "waiting";
                        const statusText = selectedWorkCareerCard.verified ? "강화 성공" : selectedWorkCareerCard.isFailed ? "강화 실패" : selectedWorkCareerCard.isNotApplicable ? "해당 없음" : "강화 대기";
                        return (
                          <div className="personal-line-status line-info-row">
                            {statusKey === "empty" ? (
                              <div className="line-enhance-void" aria-label="빈 카드">
                                <span className="void-mark" />
                                <span className="void-mark" />
                                <span className="void-mark" />
                              </div>
                            ) : (
                              <>
                                {selectedWorkCareerCard.statusBadge ? <img className="line-enhance-icon" src={selectedWorkCareerCard.statusBadge} alt={statusText} /> : <span className="line-status-icon">●</span>}
                                <span className={`line-enhance-status enhance-${statusKey}`}>{statusText}</span>
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
                        <span className="date-badge-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차` : "시즌 정보 로딩 중..."}</span>
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
                          const adminCount = activityType ? getAdminOutputLinksCount(activityType) : 0;
                          const isAdminLink = i < adminCount;
                          const adminOverride = isAdminPreview ? adminSavedOutputLinks["workCareer"]?.[i] : null;
                          const link = workCareerViewIsEditing
                            ? editingCareerOutputLinks[i] || { desc: "", url: "" }
                            : (adminOverride?.url?.trim() ? adminOverride : selectedWorkCareerCard.outputLinks?.[i]) || { desc: "", url: "" };
                          const hasUrl = !!link.url?.trim();
                          const prevLink = workCareerViewIsEditing ? editingCareerOutputLinks[i - 1] : (isAdminPreview ? adminSavedOutputLinks["workCareer"]?.[i - 1] : null);
                          const sequentialDisabled = workCareerViewIsEditing && !isAdminLink && i > adminCount && !prevLink?.url?.trim();
                          const displayText = link.desc?.trim() || link.url;
                          return (
                            <div className={`output-link-row ${isAdminLink ? "admin-link" : ""}`} key={i}>
                              <span className="link-dot" style={{ backgroundColor: dotColor }} />
                              {workCareerViewIsEditing && (!isAdminLink || isAdminPreview) ? (
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
                                <span className="output-link-text output-link-clickable" onMouseEnter={(e) => showOlTooltip(e, link.desc?.trim() || link.url || "")} onMouseLeave={hideOlTooltip} onClick={() => window.open(ensureProtocol(link.url), "_blank")}>
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
                      <div className="text-block-content main-title-readonly">{selectedWorkCareerCard.title && selectedWorkCareerCard.title !== "-" ? selectedWorkCareerCard.title : "-"}</div>
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
                      const adminImgCountForLock = (careerRecords[careerIdxForLock]?.output_images || []).filter((i) => i?.url?.trim()).length;
                      return Array.from({ length: WORKCAREER_IMAGE_SLOT_COUNT }).map((_, imageIdx) => {
                        const viewImages = normalizeWorkCareerImages(selectedWorkCareerCard?.images);
                        const viewCaptions = normalizeWorkCareerCaptions(selectedWorkCareerCard?.imageCaptions);
                        const imagesForState = workCareerViewIsEditing ? editingCareerImages : viewImages;
                        const captionsForState = workCareerViewIsEditing ? editingCareerImageCaptions : viewCaptions;
                        const image = imagesForState[imageIdx] || null;
                        const caption = captionsForState[imageIdx] || "";
                        const isEnabled = imageIdx === 0 || !!imagesForState[imageIdx - 1];
                        const isRequired = imageIdx < 2;
                        const isAdminLocked = imageIdx < adminImgCountForLock;
                        const showEditingActions = workCareerViewIsEditing && !isAdminLocked;
                        return (
                          <div key={imageIdx} className={`workinfo-image-slot image-slot${imageIdx === 0 ? " large" : " small"}${!isEnabled ? " disabled" : ""}${isAdminLocked ? " admin-locked" : ""}`} {...(isRequired ? { "data-field": `image${imageIdx}` } : {})}>
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
                                  if (showEditingActions && isEnabled) triggerCareerImageUpload(imageIdx);
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
                  <span className="line-code image-line-code">{selectedWorkCareerCard.lineCode || selectedWorkCareerCard.code || ""}</span>

                  {/* 5단계: 라인 평점 (S/A/B/C/D) — 관리자만 설정, 사용자 읽기전용 */}
                  <div className="workcareer-grade-section">
                    <span className="grade-label">라인 평점</span>
                    <div className="grade-row">
                      {["S", "A", "B", "C", "D"].map((g) => (
                        <span key={g} className={`grade ${selectedWorkCareerCard?.grade === g ? "active" : ""}`}>
                          {g}
                        </span>
                      ))}
                    </div>
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
                      const empty = selectedWorkCareerCard?.isEmpty;
                      const locked = isLineLocked(selectedWorkCareerCard);
                      const disabled = !isAdminPreview && (!canEditWorkCareer || empty || locked);
                      const title = empty ? "비어있는 카드입니다" : locked ? LINE_LOCKED_TITLE : canEditWorkCareer || isAdminPreview ? "수정" : "작성할 수 있는 기간이 아닙니다. 😊";
                      return (
                        <button className="modal-edit-btn" onClick={handleEditWorkCareer} disabled={disabled} style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined} title={title}>
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
          <div className="section-modal-overlay">
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
                    <span className="week-info-text">{weekData ? `${weekData.seasonYear}년 ${weekData.seasonName} 시즌, ${weekData.weekNumber}주차` : "시즌 정보 로딩 중..."}</span>
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
                          src={isDemoMode ? "/images/0/crew profile/남 1.webp" : reviewerProfile.profilePhotoUrl || "/images/0/crew profile/남 1.webp"}
                          alt="프로필"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/0/crew profile/남 1.webp";
                          }}
                        />
                      </div>
                      <div className="personal-info">
                        <div className="personal-row-1">
                          <span className="personal-name">{isDemoMode ? "홍길동" : reviewerProfile.displayName || session?.user?.name || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-gender">{isDemoMode ? "남" : reviewerProfile.gender || "—"}</span>
                          <span className="personal-separator">|</span>
                          <span className="personal-age">{isDemoMode ? "22" : (reviewerProfile.age ?? "—")} 세</span>
                        </div>
                        <div className="personal-row-2">
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "서울대" : reviewerProfile.school || "—"}</span>
                            <span className="field-label">학교</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{isDemoMode ? "경영" : reviewerProfile.major || "—"}</span>
                            <span className="field-label">학과</span>
                          </span>
                        </div>
                        <div className="personal-row-3">
                          <span className="personal-field">
                            <span className="field-value">{teamName || (isDemoMode ? "마케팅" : "—")}</span>
                            <span className="field-label">팀</span>
                          </span>
                          <span className="personal-separator">|</span>
                          <span className="personal-field">
                            <span className="field-value">{partName || (isDemoMode ? "디자인" : "—")}</span>
                            <span className="field-label">파트</span>
                          </span>
                        </div>
                      </div>
                      <div className="personal-tags">
                        <span className="tag-badge tag-role">{isDemoMode ? "앰배서더" : roleLabel || "일반"}</span>
                        <span className="tag-badge tag-keyword">{isDemoMode ? "엔비디아 구글 테슬라" : reviewerProfile.vision || "-"}</span>
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
            className="dropdown-options-fixed review-rating-dropdown-options"
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
            className="dropdown-options-fixed"
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
          <div className="ol-custom-tooltip" style={{ left: olTooltip.x, top: olTooltip.y }}>
            {olTooltip.text}
          </div>,
          document.body,
        )}

      {/* Detail Log 모달 — 빈 placeholder 컨테이너 (674×826) */}
      <DetailLogModal show={showDetailLogModal} onHide={() => setShowDetailLogModal(false)} />

      {/* Output Link 2차 모달 — Portal로 document.body에 직접 렌더링 (1차 모달 위에 뜸) */}
      {outputLinkEditModal &&
        createPortal(
          <div
            className="output-link-edit-overlay"
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

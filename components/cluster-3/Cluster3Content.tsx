"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import { getDocumentZoom, getFixedDropdownPosition } from "@/utils/documentZoom";
import { isDemoMode as checkDemoMode } from "@/utils/isDemoMode";
import { getOrgAliasFromPathname } from "@/utils/orgLabelAlias";
import { useModalScroll } from "@/utils/useModalScroll";
import { useProfile } from "@/contexts/ProfileContext";
import { isAdminEmail } from "@/lib/admin";
import { isPxRoute, isEcRoute, getThemeClass } from "@/lib/cluster-route";
import { usePopup } from "@/components/ui/popup";
import {
  CLUSTER3_DUMMY_PROFILE,
  CLUSTER3_DUMMY_ARCHIVES,
  CLUSTER3_DUMMY_ARCHIVE_CHANNELS,
  CLUSTER3_DUMMY_OUTPUTS,
  CLUSTER3_DUMMY_OUTPUT_CHANNELS,
  CLUSTER3_DUMMY_DETAILS,
  CLUSTER3_DUMMY_DETAIL_CHANNELS,
  CLUSTER3_DUMMY_BY_USER,
  CLUSTER3_DUMMY_OUTPUT_CARDS,
  DEFAULT_DEMO_USER,
} from "@/constants/dummyData";
import { CLUSTER3_CHANNEL_DEFAULTS, createEmptyChannelCards } from "@/constants/dummyData/cluster3-section-default";
import { OUTPUT_CARD_1_DEFAULT } from "@/constants/dummyData/cluster3-output-default";
import { DETAIL_CARD_1_DEFAULT, createInitialDetailCardsWithDefault } from "@/constants/dummyData/cluster3-detail-default";

// Zone C(>1920px, ResponsiveScale.tsx에서 documentElement에 zoom:1.08 적용) 대응.
// getBoundingClientRect는 zoom 적용 후 좌표를 반환하지만 position:fixed의 top/left는 CSS 픽셀 기준이라 좌표가 어긋난다.
// zoom이 적용되지 않은 Zone A/B에서는 1을 반환해 기존 동작을 유지한다.

// 커스텀 드롭다운 (네이티브 <option>은 cursor 스타일 미지원)
const CustomSelect = ({ value, onChange, options, className, style }: { value: string; onChange: (val: string) => void; options: { value: string; label: string }[]; className?: string; style?: React.CSSProperties }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || "선택하세요";

  return (
    <div ref={ref} className={`${className || ""} custom-select-wrapper`} style={style}>
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        {selectedLabel}
      </div>
      {isOpen && (
        <div className="custom-select-options">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-select-option${opt.value === value ? " selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type PeriodDateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

type CalendarPosition = {
  top: number;
  left: number;
};

const PERIOD_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PERIOD_CALENDAR_WIDTH = 286;

const toDateOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDate = (a: Date | null, b: Date | null) => {
  if (!a || !b) return false;
  return toDateOnly(a).getTime() === toDateOnly(b).getTime();
};

const isDateBetween = (date: Date, startDate: Date | null, endDate: Date | null) => {
  if (!startDate || !endDate) return false;
  const current = toDateOnly(date).getTime();
  return current > toDateOnly(startDate).getTime() && current < toDateOnly(endDate).getTime();
};

const formatPeriodDateWithWeekday = (year: number | null, month: number | null, day: number | null) => {
  if (!year || !month || !day) return "00. 00. 00 (0)";

  const date = new Date(year, month - 1, day);
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const wd = PERIOD_WEEKDAYS[date.getDay()];

  return `${yy}. ${mm}. ${dd} (${wd})`;
};

const PeriodRangePicker = ({
  range,
  month,
  onMonthChange,
  onSelect,
  onToday,
  onClear,
  position,
  themeClassName,
}: {
  range: PeriodDateRange;
  month: Date;
  onMonthChange: (date: Date) => void;
  onSelect: (date: Date) => void;
  onToday: () => void;
  onClear: () => void;
  position: CalendarPosition;
  themeClassName?: string;
}) => {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const today = toDateOnly(new Date());
  const helperText = range.startDate && !range.endDate ? "종료일을 선택해주세요" : "시작일과 종료일을 선택해주세요";

  // Phase C — portal root 에 theme class 직접 부착. _popup-portal-theme.scss 의
  // `.period-range-panel.cluster-px-theme` / `.period-range-panel.encre-theme`
  // combined selector 와 짝. createPortal 이 document.body 직속이라
  // descendant cascade 가 닿지 못하므로 root 주입이 유일한 정답.
  const panelClassName = ["period-range-panel", "calendar-popup", themeClassName].filter(Boolean).join(" ");

  return (
    <div className={panelClassName} style={{ top: position.top, left: position.left }}>
      <div className="period-range-helper">{helperText}</div>
      <div className="period-range-header">
        <button type="button" className="period-month-btn" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          &lt;
        </button>
        <span className="period-month-title">
          {month.getFullYear()}. {String(month.getMonth() + 1).padStart(2, "0")}
        </span>
        <button type="button" className="period-month-btn" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          &gt;
        </button>
      </div>
      <div className="period-weekdays">
        {PERIOD_WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="period-calendar-grid">
        {days.map((date) => {
          const outsideMonth = date.getMonth() !== month.getMonth();
          const selectedStart = isSameDate(date, range.startDate);
          const selectedEnd = isSameDate(date, range.endDate);
          const inRange = isDateBetween(date, range.startDate, range.endDate);
          const isToday = isSameDate(date, today);
          const className = [
            "period-day-btn",
            outsideMonth ? "outside-month" : "",
            selectedStart ? "range-start" : "",
            selectedEnd ? "range-end" : "",
            inRange ? "in-range" : "",
            isToday ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button key={date.toISOString()} type="button" className={className} onClick={() => onSelect(date)}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="period-range-actions">
        <button type="button" onClick={onToday}>
          오늘
        </button>
        <button type="button" onClick={onClear}>
          초기화
        </button>
      </div>
    </div>
  );
};

// PX (Phalanx) 테마 hex 토큰. _px-tokens.scss 의 --px-* 변수와 동일 값 유지.
// inline style 분기에서만 사용. CSS 매칭은 var(--px-*) 토큰을 우선.
const PX_ACCENT = "#1E9503";
const PX_ACCENT_SOFT = "#B2FF8F";

// Encre (EC) 테마 hex 토큰. _theme-tokens.scss 의 --ec-* 변수와 동일 값.
// inline style 분기에서만 사용. CSS 매칭은 var(--ec-*) 토큰을 우선.
const EC_ACCENT = "#FF4B70";
const EC_ACCENT_SOFT = "#FF98A6";

const Cluster3Content = () => {
  // 세션 및 본인 프로필 여부 확인
  const { data: session } = useSession();
  // Sidebar와 동일한 ProfileContext 캐시 — display_name 등 공통 프로필 정보 빠르게 접근
  const { profileData: cachedProfile } = useProfile();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // PX / EC 라우트 진입 시 inline style 들이 해당 톤으로 전환된다.
  // 판정 로직은 lib/cluster-route 로 일원화.
  const isPX = isPxRoute(pathname);
  const isEC = isEcRoute(pathname);
  const popup = usePopup();
  const urlUserId = searchParams.get("userId") || searchParams.get("userID");
  const demoNameParam = searchParams.get("demoName");
  const demoLookupName = demoNameParam || urlUserId;
  // 어드민(마더) 계정은 모든 프로필 편집 가능
  const isOwner = session?.user?.isAdmin || !urlUserId || session?.user?.id === urlUserId;
  const isDemoMode = checkDemoMode();

  // 어드민이 다른 유저 편집 시 targetUserId를 API URL에 추가
  const apiUrl = (path: string) => {
    if (urlUserId && session?.user?.isAdmin) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}targetUserId=${urlUserId}`;
    }
    return path;
  };

  // scrollTo query parameter 처리 (Sidebar hex3에서 이동 시)
  useEffect(() => {
    const scrollTarget = searchParams.get("scrollTo");
    if (scrollTarget) {
      const timer = setTimeout(() => {
        const section = document.querySelector("." + scrollTarget);
        if (section) {
          const offset = 120;
          window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
        }
        window.history.replaceState({}, "", window.location.pathname);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

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

  const section1Ref = useRef<HTMLElement>(null);

  // 현재 활성화된 슬라이드 인덱스
  const [activeSlide, setActiveSlide] = useState(0);

  // 일정 신뢰도 프로그레스 애니메이션 (섹션 1)
  const [progressOffset, setProgressOffset] = useState(393); // 시작: 0%
  const [progressPercent, setProgressPercent] = useState(0); // 퍼센트 숫자
  const [reliabilityRate, setReliabilityRate] = useState<number | null>(50);
  const [hasReliabilityData, setHasReliabilityData] = useState(true);

  // 성장 진행 상태 데이터
  interface GrowthInfo {
    status: string;
    growthStatus: string;
    startDate: string | null;
    endDate: string | null;
  }
  const [growthInfo, setGrowthInfo] = useState<GrowthInfo | null>({
    status: "active",
    growthStatus: "pending",
    startDate: "2025-02-22",
    endDate: null,
  });

  // 영어 이름
  const [engName, setEngName] = useState<string>("Eng Name");

  // 크루 한글 이름 (display_name) — 모달 타이틀 "{displayName} 님의 ..." 용
  const [displayName, setDisplayName] = useState<string>("");

  // ProfileContext 캐시(Sidebar와 공유)에서 display_name 즉시 동기화
  useEffect(() => {
    const cached = cachedProfile?.data?.display_name;
    if (cached) setDisplayName(cached);
  }, [cachedProfile?.data?.display_name]);

  // 성장 점수 기록 데이터 (단감, 인절미, 어흥)
  interface PointsData {
    dangam: number; // 단감 (star)
    injeolmi: number; // 인절미 (shield - lightning)
    eoheung: number; // 어흥 (lightning)
  }
  const [pointsData, setPointsData] = useState<PointsData>({ dangam: 0, injeolmi: 0, eoheung: 0 });

  // 품계 데이터 (user_grade_stats)
  interface GradeStats {
    avgPercentile: number; // 상위 퍼센트
    grade: number; // 품계 숫자 (1=정승, 2=정1품, ... 10=정9품)
    gradeLabel: string; // 품계 라벨 (정 7품 등)
  }
  const [gradeStats, setGradeStats] = useState<GradeStats | null>(null);

  // 성장 기간 집계 데이터 (user_growth_stats)
  interface GrowthPeriodStats {
    approvedWeeks: number; // 성장(성공) 주차
    unapprovedWeeks: number; // 성장(실패) 주차
    restWeeks: number; // 휴식(개인) 주차
    clubBreakWeeks: number; // 휴식(공식) 주차
    availableWeeks: number; // 성장 가능 주차
    restSeasons: number; // 성장 휴식 시즌
    approvedSeasons: number; // 성장(성공) 시즌
  }
  const [growthPeriodStats, setGrowthPeriodStats] = useState<GrowthPeriodStats | null>(null);

  // 성장 상태 표시 (DB에 저장된 값 그대로 또는 영문값 변환)
  const getGrowthStatusText = (status: string, growthStatus: string): string => {
    // 이미 한글로 저장된 경우 그대로 반환
    const koreanStatuses = ["클럽 온보딩 중", "활동 중", "휴식(개인) 중", "휴식(공식) 중", "시즌 휴식 중", "성장 유보", "성장 중단", "졸업 절차 중", "성장 완료(졸업)", "추가 성장 중"];

    if (koreanStatuses.includes(growthStatus)) {
      // '활동 중'은 '성장 중'으로 표시
      if (growthStatus === "활동 중") return "성장 중";
      return growthStatus;
    }

    // 영문 growthStatus 값 변환 (10개)
    if (growthStatus === "pending") return "클럽 온보딩 중";
    if (growthStatus === "active") return "성장 중";
    if (growthStatus === "resting") return "휴식(개인) 중";
    if (growthStatus === "official_rest") return "휴식(공식) 중";
    if (growthStatus === "season_rest") return "시즌 휴식 중";
    if (growthStatus === "deferred") return "성장 유보";
    if (growthStatus === "suspended") return "성장 중단";
    if (growthStatus === "graduating") return "졸업 절차 중";
    if (growthStatus === "graduated") return "성장 완료(졸업)";
    if (growthStatus === "reinforcing") return "추가 성장 중";

    return "클럽 온보딩 중";
  };

  // 날짜 포맷 변환 (2025-02-22 → 2025년 02월 22일 (토))
  const formatDateKorean = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekDay = weekDays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekDay})`;
  };

  // 섹션 2 프로그레스 바 애니메이션
  const [section2Progress, setSection2Progress] = useState(0);
  const [section2Percent, setSection2Percent] = useState(0); // 퍼센트 숫자
  const section2Ref = useRef<HTMLElement>(null);

  // 섹션 2 품계 카드 애니메이션
  const [highlightedRank, setHighlightedRank] = useState(-1); // -1: 애니메이션 전
  const [animationComplete, setAnimationComplete] = useState(false);

  // 섹션 2 상위 퍼센트 애니메이션
  const [topPercent, setTopPercent] = useState(0);

  // 화살표 애니메이션 (섹션별)
  const [arrowAnimating, setArrowAnimating] = useState<string | null>(null);

  const handleArrowClick = (section: string) => {
    if (!arrowAnimating) {
      setArrowAnimating(section);
      setTimeout(() => setArrowAnimating(null), 600);
    }
  };

  // 섹션 4 버튼 바운스 애니메이션
  const [bouncingBtn, setBouncingBtn] = useState<string | null>(null);

  const handleBtnClick = (btn: string) => {
    if (!bouncingBtn) {
      setBouncingBtn(btn);
      setTimeout(() => setBouncingBtn(null), 500);
    }
  };

  // 섹션 3 페이지네이션
  const [section3Page, setSection3Page] = useState(0);

  // 모달 상태 관리
  const [section3ModalOpen, setSection3ModalOpen] = useState(false);
  const [section4ModalOpen, setSection4ModalOpen] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [section3FooterNotice, setSection3FooterNotice] = useState<"default" | "error">("default");
  const MAX_CARDS = 16;

  // 모달 body ref — section3 full-card 모달 전용 (필수 미입력 시 스크롤 이동에 사용)
  const section3ModalBodyRef = useRef<HTMLDivElement>(null);

  const [showHelpModal, setShowHelpModal] = useState(false);

  // 모달 열릴 때 배경 스크롤 잠금
  const anyModalOpen = section3ModalOpen || section4ModalOpen;
  useModalScroll(anyModalOpen);

  // section3 모달 열 때 보기 모드로 초기화
  useEffect(() => {
    if (section3ModalOpen) {
      setIsEditMode(false);
      setSection3FooterNotice("default");
    }
  }, [section3ModalOpen]);

  const CARDS_PER_PAGE = 8;

  const handlePrevCard = () => {
    if (isEditMode || currentCardIndex <= 0) return;
    const newIndex = currentCardIndex - 1;
    setCurrentCardIndex(newIndex);
    const newPage = Math.floor(newIndex / CARDS_PER_PAGE);
    if (newPage !== section3Page) setSection3Page(newPage);
  };
  const handleNextCard = () => {
    if (isEditMode || currentCardIndex >= unlockedCardCount - 1 || currentCardIndex >= MAX_CARDS - 1) return;
    const newIndex = currentCardIndex + 1;
    setCurrentCardIndex(newIndex);
    const newPage = Math.floor(newIndex / CARDS_PER_PAGE);
    if (newPage !== section3Page) setSection3Page(newPage);
  };

  // 채널 카드 16개 풀 데이터 저장 (cluster-3 Channel 모달)
  const [isSavingChannelCard, setIsSavingChannelCard] = useState(false);
  // Output Top 5 + Detail 10 풀 데이터 저장 (cluster-3 World Of Top Works)
  const [isSavingTopCard, setIsSavingTopCard] = useState(false);

  // 채널 옵션 목록
  const channelOptions = [
    { value: "", label: "채널 선택", icon: "" },
    { value: "instagram", label: "인스타그램", icon: "/images/0/cluster 3/icon/Instagram.png" },
    { value: "youtube", label: "유튜브", icon: "/images/0/cluster 3/icon/Youtube.png" },
    { value: "blog", label: "블로그", icon: "/images/0/cluster 3/icon/naver blog.png" },
    { value: "tistory", label: "티스토리", icon: "/images/0/cluster 3/icon/Tstory.png" },
    { value: "twitter", label: "X(트위터)", icon: "/images/0/cluster 3/icon/X.png" },
    { value: "threads", label: "쓰레드", icon: "/images/0/cluster 3/icon/Threads.png" },
    { value: "tiktok", label: "틱톡", icon: "/images/0/cluster 3/icon/TikTok.png" },
    { value: "behance", label: "비핸스", icon: "/images/0/cluster 3/icon/Behance.png" },
    { value: "etc", label: "기타", icon: "/images/0/cluster 3/icon/etc 2.png" },
  ];

  // 데모 모드 sample seed:
  //   - card 1 만 firstCard sample (Discovery_Korea 등) 전체 시드
  //   - card 1~10 link 는 dummy.archives 로 추가 시드
  // production 에서는 절대 실행되지 않는다. canonical fetch 가 빈 응답이어도
  // state 는 emptyCard 그대로 유지되어 sample 값이 PUT 경로로 흘러가지 않는다.
  useEffect(() => {
    if (!isDemoMode) return;
    const demoUser = demoLookupName || DEFAULT_DEMO_USER;
    const userData = CLUSTER3_DUMMY_BY_USER[demoUser] || CLUSTER3_DUMMY_BY_USER[DEFAULT_DEMO_USER];
    setChannelCards((prev) =>
      prev.map((card, index) => {
        // index 0 = card 1 → firstCard sample 전체로 교체 (id 보존)
        if (index === 0) {
          return { ...CLUSTER3_CHANNEL_DEFAULTS.firstCard, id: card.id };
        }
        // index 1~9 = link 만 dummy seed
        if (index < 10 && userData.archives[index]) {
          return { ...card, link: userData.archives[index] };
        }
        return card;
      }),
    );
  }, [isDemoMode, demoLookupName]);

  // 채널 카드 16개 풀 데이터 로드 (portfolio_channel_cards 테이블)
  // 저장된 카드만 응답에 포함되며, 미저장 카드는 emptyCard 상태 그대로 유지
  useEffect(() => {
    if (isDemoMode) return;
    const fetchChannelCards = async () => {
      try {
        const url = urlUserId
          ? `/api/portfolio-channel-cards?userId=${urlUserId}`
          : "/api/portfolio-channel-cards";
        const response = await fetch(url);
        if (!response.ok) return;
        const result = await response.json();
        if (!result?.success || !Array.isArray(result.cards) || result.cards.length === 0) return;

        // cardIndex(1~16) → 응답 카드 매핑
        const byIndex = new Map<number, any>();
        for (const c of result.cards) byIndex.set(Number(c.cardIndex), c);

        setChannelCards((prev) =>
          prev.map((card, i) => {
            const saved = byIndex.get(i + 1);
            if (!saved) return card;
            return {
              ...card,
              channelName: saved.channelName ?? "",
              platform: saved.platform ?? "",
              management: saved.management ?? "",
              startYear: saved.startYear ?? "",
              startMonth: saved.startMonth ?? "",
              startDay: saved.startDay ?? "",
              rating: saved.rating ?? "",
              status: saved.status ?? "",
              link: saved.link ?? "",
              images: Array.isArray(saved.images) ? saved.images : card.images,
              insight: saved.insight ?? "",
              experience: saved.experience ?? "",
              metrics: saved.metrics ?? "",
            };
          })
        );
      } catch (error) {
        console.error("채널 카드 로드 오류:", error);
      }
    };
    fetchChannelCards();
  }, [session?.user?.email, urlUserId, isDemoMode]);

  // sample/default seed 가 PUT 으로 흘러가는 사고 방지용 marker 비교.
  // production 의 initial state 는 emptyCard 만 사용 (createEmptyChannelCards) 이므로
  // 정상 흐름에서는 이 marker 가 절대 매칭되지 않는다. 매칭되는 경우는 누군가
  // sample 객체를 그대로 PUT 페이로드로 보낸 케이스 — canonical row 덮어쓰기 차단.
  const isFirstCardSamplePayload = (card: any): boolean => {
    if (!card) return false;
    const s = CLUSTER3_CHANNEL_DEFAULTS.firstCard;
    return (
      card.channelName === s.channelName &&
      card.link === s.link &&
      card.platform === s.platform
    );
  };

  // 채널 카드 저장: blob URL 이미지 업로드 → 카드 PUT
  // 성공 시 업로드된 URL이 반영된 카드 객체 반환, 실패 시 null
  const saveChannelCard = async (cardIndex: number, card: any): Promise<any | null> => {
    if (isDemoMode) {
      return card;
    }
    // 방어: sample(firstCard) 페이로드는 production DB 에 절대 PUT 하지 않는다.
    // 2026-05-18 사고 — canonical row 의 channel_name 이 '@ Discovery_Korea' 로 revert.
    if (isFirstCardSamplePayload(card)) {
      console.warn(
        "[saveChannelCard] firstCard sample 페이로드 PUT 차단",
        { cardIndex, channelName: card?.channelName },
      );
      await popup.alert("샘플 데이터는 저장할 수 없습니다. 실제 채널 정보를 입력해주세요.");
      return null;
    }
    setIsSavingChannelCard(true);
    try {
      // 이미지 5칸 중 blob: URL은 업로드 후 public URL로 교체, 기존 URL은 유지
      const rawImages: (string | null)[] = Array.isArray(card.images) ? card.images.slice(0, 5) : [];
      while (rawImages.length < 5) rawImages.push(null);

      const uploadedImages: (string | null)[] = [];
      for (let slot = 0; slot < 5; slot++) {
        const img = rawImages[slot];
        if (!img) {
          uploadedImages.push(null);
          continue;
        }
        if (typeof img === "string" && img.startsWith("blob:")) {
          try {
            const blob = await fetch(img).then((r) => r.blob());
            const mime = blob.type || "image/jpeg";
            const ext = mime.split("/")[1] || "jpg";
            const file = new File([blob], `slot-${slot}.${ext}`, { type: mime });
            const fd = new FormData();
            fd.append("file", file);
            fd.append("cardIndex", String(cardIndex));
            fd.append("slotIndex", String(slot));
            const uploadRes = await fetch(apiUrl("/api/portfolio-channel-cards/upload"), {
              method: "POST",
              body: fd,
            });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadJson?.error || "이미지 업로드 실패");
            uploadedImages.push(uploadJson.url);
          } catch (e) {
            console.error(`slot-${slot} 업로드 오류:`, e);
            throw e;
          }
        } else {
          // 이미 저장된 public URL 또는 default 경로
          uploadedImages.push(img);
        }
      }

      const putRes = await fetch(apiUrl("/api/portfolio-channel-cards"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIndex,
          channelName: card.channelName ?? "",
          platform: card.platform ?? "",
          management: card.management ?? "",
          startYear: card.startYear ?? "",
          startMonth: card.startMonth ?? "",
          startDay: card.startDay ?? "",
          rating: card.rating ?? "",
          status: card.status ?? "",
          link: card.link ?? "",
          images: uploadedImages,
          insight: card.insight ?? "",
          experience: card.experience ?? "",
          metrics: card.metrics ?? "",
        }),
      });
      const putJson = await putRes.json();
      if (!putRes.ok) {
        console.error("카드 저장 실패:", putJson);
        alert(putJson?.error || "저장에 실패했습니다.");
        return null;
      }

      const finalCard = { ...card, images: uploadedImages };
      setChannelCards((prev) => {
        const next = [...prev];
        next[cardIndex - 1] = { ...prev[cardIndex - 1], ...finalCard };
        return next;
      });
      return finalCard;
    } catch (e) {
      console.error("채널 카드 저장 오류:", e);
      alert(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      return null;
    } finally {
      setIsSavingChannelCard(false);
    }
  };

  // 데모 모드에서 Section4·5 썸네일 link 를 dummy 로 시드.
  // 일반 모드의 link 값은 portfolio_top_cards canonical fetch가 outputCards/detailCards 에 직접 채운다.
  useEffect(() => {
    if (!isDemoMode) return;
    const demoUser = demoLookupName || DEFAULT_DEMO_USER;
    const userData = CLUSTER3_DUMMY_BY_USER[demoUser] || CLUSTER3_DUMMY_BY_USER[DEFAULT_DEMO_USER];
    setTopWorksSlides((prev) =>
      prev.map((slide, index) =>
        userData.outputs[index] ? { ...slide, link: userData.outputs[index] } : slide,
      ),
    );
    setDetailThumbnails((prev) =>
      prev.map((thumb, index) =>
        userData.details[index] ? { ...thumb, link: userData.details[index] } : thumb,
      ),
    );
  }, [isDemoMode, demoLookupName]);

  // API에서 일정 신뢰도 데이터 가져오기
  useEffect(() => {
    const fetchReliabilityRate = async () => {
      if (isDemoMode) {
        const demoUser = demoLookupName || DEFAULT_DEMO_USER;
        const userData = CLUSTER3_DUMMY_BY_USER[demoUser] || CLUSTER3_DUMMY_BY_USER[DEFAULT_DEMO_USER];
        setReliabilityRate(userData.profile.reliabilityRate);
        setHasReliabilityData(true);
        setEngName(userData.profile.engName);
        setDisplayName(demoUser);
        setPointsData(userData.profile.pointsData);
        setGradeStats(userData.profile.gradeStats);
        setTopPercent(userData.profile.gradeStats.avgPercentile);
        setGrowthPeriodStats(userData.profile.growthPeriodStats);
        return;
      }
      if (!session?.user?.email && !urlUserId) {
        setHasReliabilityData(false);
        return;
      }

      try {
        // URL에 userId가 있으면 해당 유저의 데이터를 가져옴
        const apiUrl = urlUserId ? `/api/profile?userId=${urlUserId}` : "/api/profile";
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (response.ok && result.reliabilityRate !== undefined) {
          setReliabilityRate(result.reliabilityRate);
          setHasReliabilityData(true);
        } else {
          setHasReliabilityData(false);
        }

        // 성장 진행 상태 데이터 설정
        if (result.growthInfo) {
          setGrowthInfo(result.growthInfo);
        }

        // 영어 이름 설정
        if (result.data?.eng_name) {
          setEngName(result.data.eng_name);
        }

        // 한글 display_name 설정
        if (result.data?.display_name) {
          setDisplayName(result.data.display_name);
        }

        // 성장 점수 기록 데이터 설정 (badges에서 가져옴)
        if (result.badges) {
          setPointsData({
            dangam: result.badges.stars || 0, // 단감 = star (별)
            injeolmi: result.badges.shields || 0, // 인절미 = total_shields (이미 계산된 값: shields_net - lightnings)
            eoheung: result.badges.lightnings || 0, // 어흥 = lightning (번개)
          });
        }

        // 품계 데이터 설정
        if (result.gradeStats) {
          setGradeStats(result.gradeStats);
          // 상위 퍼센트 즉시 설정 (애니메이션은 섹션 스크롤 시 실행)
          setTopPercent(result.gradeStats.avgPercentile || 0);
        }

        // 성장 기간 집계 데이터 설정
        if (result.growthPeriodStats) {
          setGrowthPeriodStats(result.growthPeriodStats);
        }
      } catch (error) {
        console.error("신뢰도 데이터 로드 오류:", error);
        setHasReliabilityData(false);
      }
    };

    fetchReliabilityRate();
  }, [session?.user?.email, urlUserId]);

  // 일정 신뢰도 프로그레스 애니메이션
  useEffect(() => {
    // reliabilityRate가 로드되지 않았으면 대기
    if (reliabilityRate === null) return;

    const targetPercent = reliabilityRate;
    // 393 = 전체 반원 길이, 0% = 393, 100% = 0
    const targetOffset = 393 - (393 * targetPercent) / 100;

    const timer = setTimeout(() => {
      setProgressOffset(targetOffset);

      // 숫자 카운트업 애니메이션
      const duration = 1500;
      const startTime = Date.now();

      const countUp = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOut 효과
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentPercent = Math.round(easeOut * targetPercent);

        setProgressPercent(currentPercent);

        if (progress < 1) {
          requestAnimationFrame(countUp);
        }
      };

      requestAnimationFrame(countUp);
    }, 300);

    return () => clearTimeout(timer);
  }, [reliabilityRate]);

  // 섹션 2 스크롤 감지
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animationComplete) {
            // 프로그레스 바 애니메이션
            setTimeout(() => {
              setSection2Progress(90);

              // 숫자 카운트업 애니메이션 (1.5초 동안 0 → 90)
              const duration = 1500;
              const targetPercent = 90;
              const startTime = Date.now();

              const countUp = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentPercent = Math.round(easeOut * targetPercent);

                setSection2Percent(currentPercent);

                if (progress < 1) {
                  requestAnimationFrame(countUp);
                }
              };

              requestAnimationFrame(countUp);

              // 상위 퍼센트 카운트업 애니메이션 (gradeStats.avgPercentile 값으로)
              const topDuration = 800;
              const topTarget = gradeStats?.avgPercentile || 0;
              const topStartTime = Date.now();

              const countUpTop = () => {
                const elapsed = Date.now() - topStartTime;
                const progress = Math.min(elapsed / topDuration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentPercent = Math.round(easeOut * topTarget);

                setTopPercent(currentPercent);

                if (progress < 1) {
                  requestAnimationFrame(countUpTop);
                }
              };

              requestAnimationFrame(countUpTop);
            }, 300);

            // 품계 카드 순차 애니메이션 (정 9품 → 정승)
            let currentRank = 10; // 정 9품(10번째 카드)부터 시작
            const interval = setInterval(() => {
              setHighlightedRank(currentRank);
              currentRank--;
              if (currentRank < 1) {
                clearInterval(interval);
                setTimeout(() => {
                  setAnimationComplete(true);
                }, 150);
              }
            }, 120); // 120ms 간격으로 다라라락!
          }
        });
      },
      { threshold: 0.3 },
    );

    if (section2Ref.current) {
      observer.observe(section2Ref.current);
    }

    return () => observer.disconnect();
  }, [animationComplete, gradeStats]);

  // 포트폴리오 채널 카드 데이터 (16개 표시, 10개만 DB 연동)
  // SNS 아이콘 순서: 인스타, 유튜브, 블로그, 티스토리, X, 쓰레드, 틱톡, 비핸스, 기타1, 기타2, (11-16번은 반복)
  const snsIconOrder = [
    "/images/0/cluster 3/icon/Instagram.png",
    "/images/0/cluster 3/icon/Youtube.png",
    "/images/0/cluster 3/icon/Naver Blog.png",
    "/images/0/cluster 3/icon/Tstory.png",
    "/images/0/cluster 3/icon/X.png",
    "/images/0/cluster 3/icon/Threads.png",
    "/images/0/cluster 3/icon/TikTok.png",
    "/images/0/cluster 3/icon/Behance.png",
    "/images/0/cluster 3/icon/etc 2.png",
    "/images/0/cluster 3/icon/etc 2.png",
    // 11-16번 카드용 (페이지 2)
    "/images/0/cluster 3/icon/etc 3.png",
    "/images/0/cluster 3/icon/etc 2.png",
    "/images/0/cluster 3/icon/etc 3.png",
    "/images/0/cluster 3/icon/etc 1.png",
    "/images/0/cluster 3/icon/etc 2.png",
    "/images/0/cluster 3/icon/etc 3.png",
  ];

  const PLATFORM_ICONS: Record<string, string> = {
    유튜브: "/images/0/cluster 3/icon/Youtube.png",
    인스타그램: "/images/0/cluster 3/icon/Instagram.png",
    "블로그(네이버)": "/images/0/cluster 3/icon/Naver Blog.png",
    티스토리: "/images/0/cluster 3/icon/Tstory.png",
    "X(트위터)": "/images/0/cluster 3/icon/X.png",
    "스레드(메타)": "/images/0/cluster 3/icon/Threads.png",
    카카오스토리: "/images/0/cluster 3/story.png",
    핀터레스트: "/images/0/cluster 3/pinterest.png",
    틱톡: "/images/0/cluster 3/icon/TikTok.png",
    비핸스: "/images/0/cluster 3/icon/Behance.png",
    노션: "/images/0/cluster 3/notion.png",
  };
  const PLATFORM_OPTIONS = Object.keys(PLATFORM_ICONS);
  const MANAGEMENT_OPTIONS = ["개인 소유 관리", "팀 소속 협업", "기타 진행"];
  const STATUS_OPTIONS = ["운영 중", "운영 중단", "운영 보류"];

  // production initial state = 16 카드 모두 empty.
  // sample/default 데이터가 state 에 들어가면 modal Save 가 그대로 PUT 되어
  // canonical row 를 덮어쓰는 사고가 발생한다. demo 모드는 별도 useEffect 가
  // card 1 만 firstCard sample 로 시드 (아래 `데모 모드에서 sample seed` 참고).
  const [channelCards, setChannelCards] = useState(createEmptyChannelCards());
  const [cardSnapshot, setCardSnapshot] = useState<any>(null);

  // Output(Top Works) 모달 — 타입 B (보기+편집+좌우) 1-6단계 UI
  type OutputCard = {
    id: number;
    mainTitle: string;
    subTitle: string;
    contribution: number;
    platform: string;
    roleDescription: string;
    roles: string[];
    tools: string[];
    periodStartYear: number | null;
    periodStartMonth: number | null;
    periodStartDay: number | null;
    periodEndYear: number | null;
    periodEndMonth: number | null;
    periodEndDay: number | null;
    mainImage: string | null;
    subImages: (string | null)[];
    mainImageCaption: string;
    subImageCaptions: string[];
    metrics: string[];
    report: string;
    insight: string;
    links: string[];
  };
  const MAX_OUTPUT_CARDS = 5;
  const ROLE_OPTIONS = [
    { key: "leading", label: "리딩", color: "#FF4444" },
    { key: "following", label: "팔로잉", color: "#FF8C00" },
    { key: "management", label: "관리", color: isPX ? PX_ACCENT_SOFT : isEC ? EC_ACCENT_SOFT : "#FFD700" },
    { key: "planning", label: "기획", color: "#32CD32" },
    { key: "execution", label: "진행", color: "#00CED1" },
    { key: "analysis", label: "분석", color: "#4169E1" },
    { key: "production", label: "제작", color: "#8A2BE2" },
    { key: "support", label: "지원", color: "#FF69B4" },
    { key: "communication", label: "소통", color: "#20B2AA" },
    { key: "etc", label: "기타", color: "#778899" },
  ];
  const TOOL_OPTIONS = [
    { key: "notion", label: "노션", icon: "/images/0/cluster 3/notion.png" },
    { key: "figma", label: "피그마", icon: "/images/0/cluster 3/figma.png" },
    { key: "excel", label: "엑셀", icon: "/images/0/cluster 3/excel.png" },
    { key: "powerpoint", label: "파워포인트", icon: "/images/0/cluster 3/powerpoint.png" },
    { key: "word", label: "워드프로세서", icon: "/images/0/cluster 3/word.png" },
    { key: "photoshop", label: "포토샵", icon: "/images/0/cluster 3/photoshop.png" },
    { key: "illustrator", label: "일러스트레이터", icon: "/images/0/cluster 3/illustrator.png" },
    { key: "premiere", label: "프리미어프로", icon: "/images/0/cluster 3/premierepro.png" },
    { key: "canva", label: "캔바", icon: "/images/0/cluster 3/canva.png" },
    { key: "miricanvas", label: "미리캔버스", icon: "/images/0/cluster 3/miricanvas.png" },
    { key: "midjourney", label: "미드저니", icon: "/images/0/cluster 3/midjourney.png" },
    { key: "chatgpt", label: "챗지피티", icon: "/images/0/cluster 3/chatgpt.png" },
    { key: "claude", label: "클로드", icon: "/images/0/cluster 3/claude.svg" },
    { key: "discord", label: "디스코드", icon: "/images/0/cluster 3/discord.png" },
    { key: "zoom", label: "줌", icon: "/images/0/cluster 3/zoom.png" },
    { key: "etc", label: "기타", icon: "/images/0/cluster 3/etc.png" },
  ];
  const emptyOutputCard = (id: number): OutputCard => ({
    id,
    mainTitle: "",
    subTitle: "",
    contribution: 0,
    platform: "",
    roleDescription: "",
    roles: [],
    tools: [],
    periodStartYear: null,
    periodStartMonth: null,
    periodStartDay: null,
    periodEndYear: null,
    periodEndMonth: null,
    periodEndDay: null,
    mainImage: null,
    subImages: [null, null],
    mainImageCaption: "",
    subImageCaptions: ["", ""],
    metrics: ["", "", "", "", "", ""],
    report: "",
    insight: "",
    links: ["", "", ""],
  });
  // 1번 카드는 샘플 데이터로 시작 (채널 카드와 동일 패턴 — 활성 표시 + 다음 카드 unlock 트리거)
  const createInitialOutputCards = (): OutputCard[] => [
    { ...OUTPUT_CARD_1_DEFAULT } as OutputCard,
    emptyOutputCard(2),
    emptyOutputCard(3),
    emptyOutputCard(4),
    emptyOutputCard(5),
  ];
  const [outputCards, setOutputCards] = useState<OutputCard[]>(isDemoMode ? (CLUSTER3_DUMMY_OUTPUT_CARDS as OutputCard[]) : createInitialOutputCards());
  const [currentOutputIndex, setCurrentOutputIndex] = useState(0);
  const [isOutputEditMode, setIsOutputEditMode] = useState(false);
  const [outputSnapshot, setOutputSnapshot] = useState<OutputCard | null>(null);
  const [outputFooterNotice, setOutputFooterNotice] = useState<"default" | "error">("default");
  const [canEditOutput, setCanEditOutput] = useState<boolean>(isDemoMode);
  const [captionOpenIndex, setCaptionOpenIndex] = useState<number | null>(null);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const subImageInputRefs = useRef<(HTMLInputElement | null)[]>([null, null]);
  const outputPeriodPickerRef = useRef<HTMLDivElement>(null);
  const outputPeriodTriggerRef = useRef<HTMLButtonElement>(null);
  const [outputDateRange, setOutputDateRange] = useState<PeriodDateRange>({ startDate: null, endDate: null });
  const [outputRangePickerOpen, setOutputRangePickerOpen] = useState(false);
  const [outputRangeMonth, setOutputRangeMonth] = useState(() => new Date());
  const [outputCalendarPosition, setOutputCalendarPosition] = useState<CalendarPosition | null>(null);

  // ===== Detail-10 modal state =====
  const MAX_DETAIL_CARDS = 10;
  const emptyDetailCard = (id: number): OutputCard => ({
    id,
    mainTitle: "",
    subTitle: "",
    contribution: 0,
    platform: "",
    roleDescription: "",
    roles: [],
    tools: [],
    periodStartYear: null,
    periodStartMonth: null,
    periodStartDay: null,
    periodEndYear: null,
    periodEndMonth: null,
    periodEndDay: null,
    mainImage: null,
    subImages: [null, null],
    mainImageCaption: "",
    subImageCaptions: ["", ""],
    metrics: ["", "", "", "", "", ""],
    report: "",
    insight: "",
    links: ["", "", ""],
  });
  // 1번 카드는 샘플 데이터로 시작 (활성 표시 + 다음 카드 unlock 트리거)
  const createInitialDetailCards = (): OutputCard[] => [
    { ...DETAIL_CARD_1_DEFAULT } as OutputCard,
    ...Array.from({ length: MAX_DETAIL_CARDS - 1 }, (_, i) => emptyDetailCard(i + 2)),
  ];
  const [detailCards, setDetailCards] = useState<OutputCard[]>(
    isDemoMode ? (createInitialDetailCardsWithDefault() as OutputCard[]) : createInitialDetailCards(),
  );
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailEditMode, setIsDetailEditMode] = useState(false);
  const [detailSnapshot, setDetailSnapshot] = useState<OutputCard | null>(null);
  const [detailFooterNotice, setDetailFooterNotice] = useState<"default" | "error">("default");
  const [canEditDetail, setCanEditDetail] = useState<boolean>(isDemoMode);

  // 어드민(마더) 계정은 Portfolio Output/Detail 편집 권한 자동 부여
  // session.user.isAdmin 플래그가 JWT 쿠키에 아직 반영 안 됐을 수 있어 email로도 직접 판정
  useEffect(() => {
    const isAdmin = session?.user?.isAdmin || isAdminEmail(session?.user?.email);
    if (isAdmin) {
      setCanEditOutput(true);
      setCanEditDetail(true);
    }
  }, [session?.user?.isAdmin, session?.user?.email]);

  const [detailCaptionOpenIndex, setDetailCaptionOpenIndex] = useState<number | null>(null);
  const detailMainImageInputRef = useRef<HTMLInputElement>(null);
  const detailSubImageInputRefs = useRef<(HTMLInputElement | null)[]>([null, null]);
  const detailPeriodPickerRef = useRef<HTMLDivElement>(null);
  const detailPeriodTriggerRef = useRef<HTMLButtonElement>(null);
  const [detailDateRange, setDetailDateRange] = useState<PeriodDateRange>({ startDate: null, endDate: null });
  const [detailRangePickerOpen, setDetailRangePickerOpen] = useState(false);
  const [detailRangeMonth, setDetailRangeMonth] = useState(() => new Date());
  const [detailCalendarPosition, setDetailCalendarPosition] = useState<CalendarPosition | null>(null);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    if (openDropdownId === id) {
      setOpenDropdownId(null);
      setDropdownPosition(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenDropdownId(id);
      setDropdownPosition(getFixedDropdownPosition(rect));
    }
  };

  const getCalendarPosition = (trigger: HTMLButtonElement | null): CalendarPosition | null => {
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const zoom = getDocumentZoom();
    const top = rect.bottom + window.scrollY + 8;
    const left = rect.right + window.scrollX - PERIOD_CALENDAR_WIDTH;
    // Zone C(zoom:1.08)에서 getBoundingClientRect/scrollY는 post-zoom 좌표,
    // position:absolute의 top/left는 zoom된 좌표계에 CSS 픽셀로 적용되므로 zoom으로 나눠 보정.
    // zoom === 1(Zone A/B)에서는 원본 식과 완전히 동일한 경로.
    return zoom === 1
      ? { top, left }
      : { top: top / zoom, left: left / zoom };
  };

  const updateOutputCalendarPosition = () => {
    const position = getCalendarPosition(outputPeriodTriggerRef.current);
    if (position) setOutputCalendarPosition(position);
  };

  const updateDetailCalendarPosition = () => {
    const position = getCalendarPosition(detailPeriodTriggerRef.current);
    if (position) setDetailCalendarPosition(position);
  };

  useEffect(() => {
    if (!openDropdownId) return;
    const handler = (e: MouseEvent) => {
      const fixed = document.querySelector(".dropdown-options-fixed");
      if (fixed?.contains(e.target as Node)) return;
      const allSelected = document.querySelectorAll(".dropdown-selected, .platform-selected, .tool-dropdown-btn, .period-trigger-btn");
      for (const sel of allSelected) {
        if (sel.contains(e.target as Node)) return;
      }
      setOpenDropdownId(null);
      setDropdownPosition(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as Element).closest?.(".period-range-panel")) return;
      if (outputPeriodPickerRef.current?.contains(e.target as Node)) return;
      if (detailPeriodPickerRef.current?.contains(e.target as Node)) return;
      setOutputRangePickerOpen(false);
      setDetailRangePickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!outputRangePickerOpen) return;
    updateOutputCalendarPosition();
    window.addEventListener("resize", updateOutputCalendarPosition);
    window.addEventListener("scroll", updateOutputCalendarPosition, true);
    return () => {
      window.removeEventListener("resize", updateOutputCalendarPosition);
      window.removeEventListener("scroll", updateOutputCalendarPosition, true);
    };
  }, [outputRangePickerOpen]);

  useEffect(() => {
    if (!detailRangePickerOpen) return;
    updateDetailCalendarPosition();
    window.addEventListener("resize", updateDetailCalendarPosition);
    window.addEventListener("scroll", updateDetailCalendarPosition, true);
    return () => {
      window.removeEventListener("resize", updateDetailCalendarPosition);
      window.removeEventListener("scroll", updateDetailCalendarPosition, true);
    };
  }, [detailRangePickerOpen]);

  const getCardDateRange = (card: OutputCard): PeriodDateRange => ({
    startDate:
      card.periodStartYear && card.periodStartMonth && card.periodStartDay
        ? new Date(card.periodStartYear, card.periodStartMonth - 1, card.periodStartDay)
        : null,
    endDate:
      card.periodEndYear && card.periodEndMonth && card.periodEndDay
        ? new Date(card.periodEndYear, card.periodEndMonth - 1, card.periodEndDay)
        : null,
  });

  const getInitialRangeMonth = (range: PeriodDateRange) => range.startDate || range.endDate || new Date();

  const formatPeriodRange = (card: OutputCard) =>
    `${formatPeriodDateWithWeekday(card.periodStartYear, card.periodStartMonth, card.periodStartDay)} ~ ${formatPeriodDateWithWeekday(card.periodEndYear, card.periodEndMonth, card.periodEndDay)}`;

  const applyOutputDateRange = (range: PeriodDateRange) => {
    const updated = [...outputCards];
    updated[currentOutputIndex] = {
      ...updated[currentOutputIndex],
      periodStartYear: range.startDate?.getFullYear() ?? null,
      periodStartMonth: range.startDate ? range.startDate.getMonth() + 1 : null,
      periodStartDay: range.startDate?.getDate() ?? null,
      periodEndYear: range.endDate?.getFullYear() ?? null,
      periodEndMonth: range.endDate ? range.endDate.getMonth() + 1 : null,
      periodEndDay: range.endDate?.getDate() ?? null,
    };
    setOutputCards(updated);
    setOutputDateRange(range);
    setOutputRangeMonth(getInitialRangeMonth(range));
  };

  const applyDetailDateRange = (range: PeriodDateRange) => {
    const updated = [...detailCards];
    updated[currentDetailIndex] = {
      ...updated[currentDetailIndex],
      periodStartYear: range.startDate?.getFullYear() ?? null,
      periodStartMonth: range.startDate ? range.startDate.getMonth() + 1 : null,
      periodStartDay: range.startDate?.getDate() ?? null,
      periodEndYear: range.endDate?.getFullYear() ?? null,
      periodEndMonth: range.endDate ? range.endDate.getMonth() + 1 : null,
      periodEndDay: range.endDate?.getDate() ?? null,
    };
    setDetailCards(updated);
    setDetailDateRange(range);
    setDetailRangeMonth(getInitialRangeMonth(range));
  };

  const selectOutputRangeDate = (date: Date) => {
    const selected = toDateOnly(date);
    const current = outputDateRange;
    if (!current.startDate || current.endDate || selected < toDateOnly(current.startDate)) {
      applyOutputDateRange({ startDate: selected, endDate: null });
      return;
    }
    applyOutputDateRange({ startDate: current.startDate, endDate: selected });
  };

  const selectDetailRangeDate = (date: Date) => {
    const selected = toDateOnly(date);
    const current = detailDateRange;
    if (!current.startDate || current.endDate || selected < toDateOnly(current.startDate)) {
      applyDetailDateRange({ startDate: selected, endDate: null });
      return;
    }
    applyDetailDateRange({ startDate: current.startDate, endDate: selected });
  };

  const isCardComplete = (card: (typeof channelCards)[0]): boolean => {
    if (!card.channelName?.trim()) return false;
    if (!card.platform) return false;
    if (!card.management) return false;
    if (!card.startYear || !card.startMonth || !card.startDay) return false;
    if (!card.rating || Number(card.rating) < 1 || Number(card.rating) > 10) return false;
    if (!card.status) return false;
    if (!card.link?.trim()) return false;
    if ((card.images || []).filter((img) => img !== null).length < 3) return false;
    if (!card.insight?.trim()) return false;
    if (!card.experience?.trim()) return false;
    if (!card.metrics?.trim()) return false;
    return true;
  };

  // 편집 모드 진입 시 스냅샷 저장
  useEffect(() => {
    if (isEditMode && section3ModalOpen) {
      setCardSnapshot(JSON.parse(JSON.stringify(channelCards[currentCardIndex])));
    }
  }, [isEditMode, section3ModalOpen, currentCardIndex]);

  const isCardDirty = () => {
    if (!cardSnapshot) return false;
    return JSON.stringify(channelCards[currentCardIndex]) !== JSON.stringify(cardSnapshot);
  };

  const handleCloseModal = async () => {
    if (isEditMode && isCardDirty()) {
      if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
        const restored = [...channelCards];
        restored[currentCardIndex] = JSON.parse(JSON.stringify(cardSnapshot));
        setChannelCards(restored);
        setSection3ModalOpen(false);
        setIsEditMode(false);
        setSection3FooterNotice("default");
      }
    } else {
      setSection3ModalOpen(false);
      setIsEditMode(false);
    }
  };

  // Output 모달 열 때 보기 모드로 초기화
  useEffect(() => {
    if (section4ModalOpen) {
      setIsOutputEditMode(false);
      setCurrentOutputIndex(0);
      setOutputFooterNotice("default");
    }
  }, [section4ModalOpen]);

  // Output 편집 모드 진입/카드 전환 시 스냅샷 저장
  useEffect(() => {
    if (isOutputEditMode && section4ModalOpen) {
      setOutputSnapshot(JSON.parse(JSON.stringify(outputCards[currentOutputIndex])));
    }
  }, [isOutputEditMode, section4ModalOpen, currentOutputIndex]);

  // Output 편집 모드 종료/카드 전환 시 캡션 토글 리셋
  useEffect(() => {
    if (!isOutputEditMode) setCaptionOpenIndex(null);
    if (!isOutputEditMode) setOutputRangePickerOpen(false);
  }, [isOutputEditMode, currentOutputIndex]);

  const isOutputDirty = () => {
    if (!outputSnapshot) return false;
    return JSON.stringify(outputCards[currentOutputIndex]) !== JSON.stringify(outputSnapshot);
  };

  const handleOutputChange = (field: keyof OutputCard, value: any) => {
    const updated = [...outputCards];
    updated[currentOutputIndex] = { ...updated[currentOutputIndex], [field]: value };
    setOutputCards(updated);
  };

  const handlePrevOutput = () => {
    if (isOutputEditMode) return;
    if (currentOutputIndex > 0) setCurrentOutputIndex((p) => p - 1);
  };

  const handleNextOutput = () => {
    if (isOutputEditMode) return;
    // 순차 잠금: unlockedOutputCount를 넘어가는 카드는 이동 불가
    const limit = Math.min(MAX_OUTPUT_CARDS, unlockedOutputCount);
    if (currentOutputIndex < limit - 1) setCurrentOutputIndex((p) => p + 1);
  };

  const handleCancelOutput = async () => {
    if (isOutputDirty()) {
      if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
        const restored = [...outputCards];
        if (outputSnapshot) restored[currentOutputIndex] = JSON.parse(JSON.stringify(outputSnapshot));
        setOutputCards(restored);
        setIsOutputEditMode(false);
        setOutputFooterNotice("default");
      }
    } else {
      setIsOutputEditMode(false);
      setOutputFooterNotice("default");
    }
  };

  const handleResetOutput = async () => {
    if (await popup.confirm("내용을 모두 초기화하시겠어요?")) {
      const updated = [...outputCards];
      updated[currentOutputIndex] = currentOutputIndex === 0 ? ({ ...OUTPUT_CARD_1_DEFAULT } as OutputCard) : emptyOutputCard(currentOutputIndex + 1);
      setOutputCards(updated);
      setOutputFooterNotice("default");
    }
  };

  const validateOutputCard = (card: OutputCard): string[] => {
    const errors: string[] = [];
    if (!card.mainTitle?.trim()) errors.push("메인 제목");
    if (!card.subTitle?.trim()) errors.push("서브 제목");
    if (!card.contribution || card.contribution <= 0) errors.push("기여도");
    if (!card.platform?.trim()) errors.push("플랫폼");
    if (!card.roleDescription?.trim()) errors.push("역할 문구");
    if (!card.roles || card.roles.length === 0) errors.push("역할 선택");
    if (!card.tools || card.tools.length === 0) errors.push("사용 기술/도구");
    if (!card.periodStartYear || !card.periodStartMonth || !card.periodStartDay) errors.push("시작일");
    if (!card.periodEndYear || !card.periodEndMonth || !card.periodEndDay) errors.push("종료일");
    if (!card.mainImage) errors.push("메인 이미지");
    if (!card.subImages || card.subImages.some((img) => !img)) errors.push("서브 이미지");
    const filledLinks = (card.links || []).filter((l) => l?.trim());
    if (filledLinks.length === 0) errors.push("링크 (최소 1개)");
    const metrics = card.metrics || [];
    let hasCompleteMetric = false;
    for (let i = 0; i < metrics.length; i += 2) {
      if (metrics[i]?.trim() && metrics[i + 1]?.trim()) {
        hasCompleteMetric = true;
        break;
      }
    }
    if (!hasCompleteMetric) errors.push("주요 정량 지표 (최소 1행)");
    if (!card.report?.trim()) errors.push("Output Report");
    if (!card.insight?.trim()) errors.push("Output Insight");
    return errors;
  };

  const compactOutputCard = (card: OutputCard): OutputCard => {
    const compactLinks = (card.links || []).filter((l) => l?.trim());
    while (compactLinks.length < 3) compactLinks.push("");
    const metrics = card.metrics || [];
    const compactMetrics: string[] = [];
    for (let i = 0; i < metrics.length; i += 2) {
      const name = metrics[i]?.trim() || "";
      const value = metrics[i + 1]?.trim() || "";
      if (name || value) compactMetrics.push(name, value);
    }
    while (compactMetrics.length < 6) compactMetrics.push("");
    return { ...card, links: compactLinks, metrics: compactMetrics };
  };

  // Output Top 5 + Detail 10 통합 저장: blob URL 이미지 업로드 → 카드 PUT
  // 성공 시 업로드된 URL이 반영된 OutputCard 반환, 실패 시 null
  const saveTopCard = async (
    cardType: "output" | "detail",
    cardIndex: number,
    card: OutputCard
  ): Promise<OutputCard | null> => {
    if (isDemoMode) return card;
    setIsSavingTopCard(true);
    try {
      // main 이미지 업로드 (blob URL인 경우만)
      let uploadedMain: string | null = card.mainImage ?? null;
      if (uploadedMain && uploadedMain.startsWith("blob:")) {
        const blob = await fetch(uploadedMain).then((r) => r.blob());
        const mime = blob.type || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        const file = new File([blob], `main.${ext}`, { type: mime });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("cardType", cardType);
        fd.append("cardIndex", String(cardIndex));
        fd.append("imageType", "main");
        const res = await fetch(apiUrl("/api/portfolio-top-cards/upload"), { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "메인 이미지 업로드 실패");
        uploadedMain = json.url;
      }

      // sub 이미지 2장
      const rawSubs: (string | null)[] = Array.isArray(card.subImages) ? card.subImages.slice(0, 2) : [];
      while (rawSubs.length < 2) rawSubs.push(null);
      const uploadedSubs: (string | null)[] = [];
      for (let slot = 0; slot < 2; slot++) {
        const img = rawSubs[slot];
        if (!img) {
          uploadedSubs.push(null);
          continue;
        }
        if (typeof img === "string" && img.startsWith("blob:")) {
          const blob = await fetch(img).then((r) => r.blob());
          const mime = blob.type || "image/jpeg";
          const ext = mime.split("/")[1] || "jpg";
          const file = new File([blob], `sub-${slot}.${ext}`, { type: mime });
          const fd = new FormData();
          fd.append("file", file);
          fd.append("cardType", cardType);
          fd.append("cardIndex", String(cardIndex));
          fd.append("imageType", `sub-${slot}`);
          const res = await fetch(apiUrl("/api/portfolio-top-cards/upload"), { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || `서브 이미지 ${slot + 1} 업로드 실패`);
          uploadedSubs.push(json.url);
        } else {
          uploadedSubs.push(img);
        }
      }

      const putRes = await fetch(apiUrl("/api/portfolio-top-cards"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardType,
          cardIndex,
          mainTitle: card.mainTitle ?? "",
          subTitle: card.subTitle ?? "",
          roleDescription: card.roleDescription ?? "",
          report: card.report ?? "",
          insight: card.insight ?? "",
          platform: card.platform ?? "",
          contribution: card.contribution ?? 0,
          periodStartYear: card.periodStartYear,
          periodStartMonth: card.periodStartMonth,
          periodStartDay: card.periodStartDay,
          periodEndYear: card.periodEndYear,
          periodEndMonth: card.periodEndMonth,
          periodEndDay: card.periodEndDay,
          roles: card.roles || [],
          tools: card.tools || [],
          mainImage: uploadedMain,
          subImages: uploadedSubs,
          mainImageCaption: card.mainImageCaption ?? "",
          subImageCaptions: card.subImageCaptions || ["", ""],
          metrics: card.metrics || ["", "", "", "", "", ""],
          links: card.links || ["", "", ""],
        }),
      });
      const putJson = await putRes.json();
      if (!putRes.ok) {
        console.error("탑 카드 저장 실패:", putJson);
        alert(putJson?.error || "저장에 실패했습니다.");
        return null;
      }

      return { ...card, mainImage: uploadedMain, subImages: uploadedSubs as (string | null)[] };
    } catch (e) {
      console.error("탑 카드 저장 오류:", e);
      alert(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      return null;
    } finally {
      setIsSavingTopCard(false);
    }
  };

  // 마운트 시 Output 5 + Detail 10 풀 데이터 한 번에 로드
  useEffect(() => {
    if (isDemoMode) return;
    const fetchTopCards = async () => {
      try {
        const url = urlUserId
          ? `/api/portfolio-top-cards?userId=${urlUserId}`
          : "/api/portfolio-top-cards";
        const response = await fetch(url);
        if (!response.ok) return;
        const result = await response.json();
        if (!result?.success || !Array.isArray(result.cards) || result.cards.length === 0) return;

        const outputByIndex = new Map<number, any>();
        const detailByIndex = new Map<number, any>();
        for (const c of result.cards) {
          if (c.cardType === "output") outputByIndex.set(Number(c.cardIndex), c);
          else if (c.cardType === "detail") detailByIndex.set(Number(c.cardIndex), c);
        }

        const apply = (prev: OutputCard[], byIndex: Map<number, any>): OutputCard[] =>
          prev.map((card, i) => {
            const saved = byIndex.get(i + 1);
            if (!saved) return card;
            return {
              ...card,
              mainTitle: saved.mainTitle ?? "",
              subTitle: saved.subTitle ?? "",
              roleDescription: saved.roleDescription ?? "",
              report: saved.report ?? "",
              insight: saved.insight ?? "",
              platform: saved.platform ?? "",
              contribution: saved.contribution ?? 0,
              periodStartYear: saved.periodStartYear ?? null,
              periodStartMonth: saved.periodStartMonth ?? null,
              periodStartDay: saved.periodStartDay ?? null,
              periodEndYear: saved.periodEndYear ?? null,
              periodEndMonth: saved.periodEndMonth ?? null,
              periodEndDay: saved.periodEndDay ?? null,
              roles: Array.isArray(saved.roles) ? saved.roles : [],
              tools: Array.isArray(saved.tools) ? saved.tools : [],
              mainImage: saved.mainImage ?? null,
              subImages: Array.isArray(saved.subImages) ? saved.subImages : [null, null],
              mainImageCaption: saved.mainImageCaption ?? "",
              subImageCaptions: Array.isArray(saved.subImageCaptions) ? saved.subImageCaptions : ["", ""],
              metrics: Array.isArray(saved.metrics) ? saved.metrics : ["", "", "", "", "", ""],
              links: Array.isArray(saved.links) ? saved.links : ["", "", ""],
            };
          });

        if (outputByIndex.size > 0) setOutputCards((prev) => apply(prev, outputByIndex));
        if (detailByIndex.size > 0) setDetailCards((prev) => apply(prev, detailByIndex));
      } catch (error) {
        console.error("탑 카드 로드 오류:", error);
      }
    };
    fetchTopCards();
  }, [session?.user?.email, urlUserId, isDemoMode]);

  const handleSaveOutput = async () => {
    const current = outputCards[currentOutputIndex];
    const errors = validateOutputCard(current);
    if (errors.length > 0) {
      setOutputFooterNotice("error");
      await popup.alert(`다음 필수 항목을 입력해주세요:\n${errors.join(", ")}`);
      return;
    }
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    const compacted = compactOutputCard(current);

    if (isDemoMode) {
      const updated = [...outputCards];
      updated[currentOutputIndex] = compacted;
      setOutputCards(updated);
      setOutputSnapshot(JSON.parse(JSON.stringify(compacted)));
      setIsOutputEditMode(false);
      setOutputFooterNotice("default");
      return;
    }

    const finalCard = await saveTopCard("output", currentOutputIndex + 1, compacted);
    if (!finalCard) return;

    const updated = [...outputCards];
    updated[currentOutputIndex] = finalCard;
    setOutputCards(updated);
    setOutputSnapshot(JSON.parse(JSON.stringify(finalCard)));
    setIsOutputEditMode(false);
    setOutputFooterNotice("default");
  };

  const handleCloseOutputModal = async () => {
    if (isOutputEditMode && isOutputDirty()) {
      if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
        const restored = [...outputCards];
        if (outputSnapshot) restored[currentOutputIndex] = JSON.parse(JSON.stringify(outputSnapshot));
        setOutputCards(restored);
        setSection4ModalOpen(false);
        setIsOutputEditMode(false);
        setOutputFooterNotice("default");
      }
    } else {
      setSection4ModalOpen(false);
      setIsOutputEditMode(false);
    }
  };

  // ===== Detail-10 handlers =====
  const isDetailDirty = () => {
    if (!detailSnapshot) return false;
    return JSON.stringify(detailCards[currentDetailIndex]) !== JSON.stringify(detailSnapshot);
  };

  const handleDetailChange = (field: keyof OutputCard, value: any) => {
    const updated = [...detailCards];
    updated[currentDetailIndex] = { ...updated[currentDetailIndex], [field]: value };
    setDetailCards(updated);
  };

  const handlePrevDetail = () => {
    if (isDetailEditMode) return;
    if (currentDetailIndex > 0) setCurrentDetailIndex((p) => p - 1);
  };

  const handleNextDetail = () => {
    if (isDetailEditMode) return;
    // 순차 잠금: unlockedDetailCount를 넘어가는 카드는 이동 불가
    const limit = Math.min(MAX_DETAIL_CARDS, unlockedDetailCount);
    if (currentDetailIndex < limit - 1) setCurrentDetailIndex((p) => p + 1);
  };

  const handleCancelDetail = async () => {
    if (isDetailDirty()) {
      if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
        const restored = [...detailCards];
        if (detailSnapshot) restored[currentDetailIndex] = JSON.parse(JSON.stringify(detailSnapshot));
        setDetailCards(restored);
        setIsDetailEditMode(false);
        setDetailFooterNotice("default");
      }
    } else {
      setIsDetailEditMode(false);
      setDetailFooterNotice("default");
    }
  };

  const handleResetDetail = async () => {
    if (await popup.confirm("내용을 모두 초기화하시겠어요?")) {
      const updated = [...detailCards];
      updated[currentDetailIndex] = currentDetailIndex === 0 ? ({ ...DETAIL_CARD_1_DEFAULT } as OutputCard) : emptyDetailCard(currentDetailIndex + 1);
      setDetailCards(updated);
      setDetailFooterNotice("default");
    }
  };

  const handleSaveDetail = async () => {
    const current = detailCards[currentDetailIndex];
    const errors = validateOutputCard(current);
    if (errors.length > 0) {
      setDetailFooterNotice("error");
      await popup.alert(`다음 필수 항목을 입력해주세요:\n${errors.join(", ")}`);
      return;
    }
    if (!(await popup.confirm("저장하시겠습니까?"))) return;
    const compacted = compactOutputCard(current);

    if (isDemoMode) {
      const updated = [...detailCards];
      updated[currentDetailIndex] = compacted;
      setDetailCards(updated);
      setDetailSnapshot(JSON.parse(JSON.stringify(compacted)));
      setIsDetailEditMode(false);
      setDetailFooterNotice("default");
      return;
    }

    const finalCard = await saveTopCard("detail", currentDetailIndex + 1, compacted);
    if (!finalCard) return;

    const updated = [...detailCards];
    updated[currentDetailIndex] = finalCard;
    setDetailCards(updated);
    setDetailSnapshot(JSON.parse(JSON.stringify(finalCard)));
    setIsDetailEditMode(false);
    setDetailFooterNotice("default");
  };

  const handleCloseDetailModal = async () => {
    if (isDetailEditMode && isDetailDirty()) {
      if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
        const restored = [...detailCards];
        if (detailSnapshot) restored[currentDetailIndex] = JSON.parse(JSON.stringify(detailSnapshot));
        setDetailCards(restored);
        setIsDetailModalOpen(false);
        setIsDetailEditMode(false);
        setDetailFooterNotice("default");
      }
    } else {
      setIsDetailModalOpen(false);
      setIsDetailEditMode(false);
    }
  };

  // Detail 모달 열기/닫기 시 초기화 & 편집 모드 진입 시 스냅샷 저장
  useEffect(() => {
    if (isDetailModalOpen) {
      setIsDetailEditMode(false);
      setDetailFooterNotice("default");
    } else {
      setIsDetailEditMode(false);
      setCurrentDetailIndex(0);
      setDetailFooterNotice("default");
    }
  }, [isDetailModalOpen]);

  useEffect(() => {
    if (isDetailEditMode && isDetailModalOpen) {
      setDetailSnapshot(JSON.parse(JSON.stringify(detailCards[currentDetailIndex])));
    }
  }, [isDetailEditMode, isDetailModalOpen, currentDetailIndex]);

  useEffect(() => {
    if (!isDetailEditMode) setDetailCaptionOpenIndex(null);
    if (!isDetailEditMode) setDetailRangePickerOpen(false);
  }, [isDetailEditMode, currentDetailIndex]);

  // 안내문 자동 복원
  useEffect(() => {
    if (!isEditMode || section3FooterNotice !== "error") return;
    if (isCardComplete(channelCards[currentCardIndex])) setSection3FooterNotice("default");
  }, [channelCards, currentCardIndex, isEditMode, section3FooterNotice]);

  // 순차 입력: 연속으로 완성된 카드 수 + 1 = 입력 가능 카드 수
  const unlockedOutputCount = (() => {
    const MAX = 5;
    let count = 1;
    for (let i = 0; i < outputCards.length; i++) {
      if (validateOutputCard(outputCards[i]).length === 0) {
        count = Math.max(count, i + 2);
      } else {
        break;
      }
    }
    return Math.min(count, MAX);
  })();

  const unlockedDetailCount = (() => {
    let count = 1;
    for (let i = 0; i < detailCards.length; i++) {
      if (validateOutputCard(detailCards[i]).length === 0) {
        count = Math.max(count, i + 2);
      } else {
        break;
      }
    }
    return Math.min(count, MAX_DETAIL_CARDS);
  })();

  const unlockedCardCount = (() => {
    let count = 1;
    for (let i = 0; i < channelCards.length; i++) {
      if (isCardComplete(channelCards[i])) {
        count = Math.max(count, i + 2);
      } else {
        break;
      }
    }
    return Math.min(count, MAX_CARDS);
  })();

  // 2페이지 동적 노출
  const showPage2 = channelCards.filter((c) => isCardComplete(c)).length >= CARDS_PER_PAGE;

  const handleCardChange = (field: string, value: any) => {
    setChannelCards((prev) => prev.map((card, i) => (i === currentCardIndex ? { ...card, [field]: value } : card)));
  };

  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isSlotEnabled = (slotIndex: number): boolean => {
    if (slotIndex === 0) return true;
    return !!channelCards[currentCardIndex]?.images[slotIndex - 1];
  };

  const handleImageUploadClick = (slotIndex: number) => imageInputRefs.current[slotIndex]?.click();

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newImages = [...channelCards[currentCardIndex].images];
      newImages[slotIndex] = url;
      handleCardChange("images", newImages);
    }
    e.target.value = "";
  };

  const handleImageDelete = (slotIndex: number) => {
    const img = channelCards[currentCardIndex].images[slotIndex];
    if (img) URL.revokeObjectURL(img);
    const newImages = [...channelCards[currentCardIndex].images];
    newImages[slotIndex] = null;
    handleCardChange("images", newImages);
  };

  const StarRating = ({ rating }: { rating: number }) => {
    const r = Number(rating) || 0;
    const fullStars = Math.floor(r / 2);
    const hasHalf = r % 2 === 1;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    return (
      <span className="star-rating">
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
        <span className="rating-text">{r}/10</span>
      </span>
    );
  };

  const formatDate = (y: string, m: string, d: string) => {
    if (!y) return "-";
    return `${y.slice(-2)}. ${m || "??"}. ${d || "??"}`;
  };

  // Top Works 슬라이드 데이터 (5개)
  const [topWorksSlides, setTopWorksSlides] = useState([
    { id: 1, active: false, link: "" },
    { id: 2, active: false, link: "" },
    { id: 3, active: true, link: "" },
    { id: 4, active: false, link: "" },
    { id: 5, active: false, link: "" },
  ]);

  // Detail 10 썸네일 데이터 (10개, 2줄 5개)
  const [detailThumbnails, setDetailThumbnails] = useState([
    { id: 1, link: "" },
    { id: 2, link: "" },
    { id: 3, link: "" },
    { id: 4, link: "" },
    { id: 5, link: "" },
    { id: 6, link: "" },
    { id: 7, link: "" },
    { id: 8, link: "" },
    { id: 9, link: "" },
    { id: 10, link: "" },
  ]);

  // 기타 아이콘 목록
  const etcIcons = ["/images/0/cluster 3/icon/etc 1.png", "/images/0/cluster 3/icon/etc 2.png", "/images/0/cluster 3/icon/etc 3.png"];

  // URL에 프로토콜 추가 함수
  const ensureProtocol = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  // URL에 따른 아이콘 매칭 함수
  const getIconByUrl = (url: string, id?: number) => {
    if (!url) return null; // 링크 없으면 null (그라데이션 표시)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) return "/images/0/cluster 3/icon/Youtube.png";
    if (lowerUrl.includes("instagram.com")) return "/images/0/cluster 3/icon/Instagram.png";
    if (lowerUrl.includes("blog.naver.com") || lowerUrl.includes("m.blog.naver.com")) return "/images/0/cluster 3/icon/Naver Blog.png";
    if (lowerUrl.includes("tistory.com")) return "/images/0/cluster 3/icon/Tstory.png";
    if (lowerUrl.includes("tiktok.com")) return "/images/0/cluster 3/icon/TikTok.png";
    if (lowerUrl.includes("threads.net") || lowerUrl.includes("threads.com")) return "/images/0/cluster 3/icon/Threads.png";
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) return "/images/0/cluster 3/icon/X.png";
    if (lowerUrl.includes("behance.net")) return "/images/0/cluster 3/icon/Behance.png";
    // 기타 링크는 etc 아이콘
    return etcIcons[id ? id % etcIcons.length : Math.floor(Math.random() * etcIcons.length)];
  };

  return (
    <div className="cluster3-content">
      {/* Section 1: CLUB FINAL INDEX - 새 디자인 */}
      <section className="cluster3-section1">
        {/* 플로팅 아이콘 */}
        <div className="floating-icons" style={{ display: "flex" }}>
          <div className="edit-icon search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div className="tooltip">등록된 도움말이 없습니다</div>
          </div>
        </div>
        {/* 배경 이미지 영역 */}
        <div className="section1-bg">
          <img src="/images/0/cluster 3/bg1.png" alt="Background" />
          {/* 왼쪽 캐릭터 */}
          <div className="char-left">
            <img src="/images/0/cluster 3/icon/battle.png" alt="Battle" />
          </div>
          {/* 오른쪽 폭탄 */}
          <div className="char-right">
            <img src="/images/0/cluster 3/icon/Bomb.png" alt="Bomb" />
          </div>
        </div>

        {/* 타이틀 */}
        <div className="section1-title-wrapper">
          <div className="title-inner">
            <h2 className="section1-title">CLUB FINAL INDEX</h2>
          </div>
        </div>

        {/* 설명 텍스트 */}
        <div className="section1-description">
          <p>이 페이지는 우리 시대의 성장하는 청춘! 크루들의 지금까지 누적된, 현재 성장 & 강화 결과를 리포트합니다.</p>
          <p>클럽의 마지막 성장 주차까지 종료한 크루의 경우, 그대로 클럽 마지막 최종 결과표가 되기도 할 거에요. 😊</p>
          <p className="small-text">내가 가고 있는 이 길이 어디쯤 와있는지, 내가 초심을 잃지 않고 목표를 향해, 성장을 향해 잘 나아가고 있는지를, 확인하세요!</p>
          <p className="small-text">당신의 시간과 성장은 얼마나 자랑스러우신가요?</p>
          <p className="quote-text">I believe that every right implies a responsibility; every opportunity, an obligation; every possession, a duty.</p>
          <p className="quote-highlight">"모든 권리에는 책임이 따르고, 모든 기회에는 의무가 따르며, 모든 소유물에는 의무가 따른다고 믿는다."</p>
          <p className="quote-author">-존 D. 록펠러 (John D. Rockefeller)-</p>
        </div>

        {/* 프로그레스 반원 */}
        <div className="progress-area">
          <div className="progress-semi-circle">
            <svg viewBox="0 0 300 170">
              {/* 배경 반원 */}
              <path className="progress-bg" d="M 25 150 A 125 125 0 0 1 275 150" fill="none" stroke={isPX ? "rgba(30, 149, 3, 0.5)" : isEC ? "rgba(255, 75, 112, 0.5)" : "rgba(250, 171, 7, 0.5)"} strokeWidth="20" strokeLinecap="butt" />
              {/* 진행 반원 (애니메이션) */}
              <path className="progress-bar" d="M 25 150 A 125 125 0 0 1 275 150" fill="none" stroke="url(#progressGradient)" strokeWidth="20" strokeDasharray="393" strokeDashoffset={progressOffset} strokeLinecap="butt" style={{ transition: "stroke-dashoffset 1.5s ease-out" }} />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07"} />
                  <stop offset="100%" stopColor={isPX ? PX_ACCENT_SOFT : isEC ? EC_ACCENT_SOFT : "#FFC919"} />
                </linearGradient>
              </defs>
            </svg>
            <div className="progress-text">
              <span className="progress-percent">{progressPercent}%</span>
              <span className="progress-label">일정 신뢰도</span>
            </div>
          </div>
        </div>

        {/* 3개의 스탯 카드 */}
        <div className="stats-cards">
          {/* 카드 1: 성장 진행 상태 */}
          <div className="stat-card">
            <div className="card-header">
              <div className="card-icon pink">
                <img src="/images/0/cluster 3/icon/0pink.png" alt="Pink" />
              </div>
              <h3 className="card-title">성장 진행 상태(Process)</h3>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 상태
                </span>
                <span className="info-value highlight">{growthInfo ? getGrowthStatusText(growthInfo.status, growthInfo.growthStatus) : "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 시작일
                </span>
                <span className="info-value">{growthInfo?.startDate ? formatDateKorean(growthInfo.startDate) : "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 종료일
                </span>
                <span className={`info-value ${growthInfo?.endDate ? "" : "be-cluving"}`}>{growthInfo?.endDate ? formatDateKorean(growthInfo.endDate) : "Be Cluving"}</span>
              </div>
            </div>
            <div className="card-footer">
              <span className="watch-pricing">
                WATCH GROWTH <img src="/images/0/cluster 3/icon/_.png" alt="icon" />
              </span>
            </div>
          </div>

          {/* 카드 2: 성장 기간 집계(Period) */}
          <div className="stat-card wide">
            <div className="card-header">
              <div className="card-icon purple">
                <img src="/images/0/cluster 3/icon/0purple.png" alt="Purple" />
              </div>
              <h3 className="card-title">성장 기간 집계(Period)</h3>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 <span className="hl success">성공</span> 주차
                </span>
                <span className="info-value week">
                  {growthPeriodStats?.approvedWeeks ?? 0}
                  <span className="highlight-orange">({growthPeriodStats?.approvedSeasons ?? 0})</span>
                  <span className="unit">주</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 <span className="hl fail">실패</span> 주차
                </span>
                <span className="info-value week">
                  {growthPeriodStats?.unapprovedWeeks ?? 0}
                  <span className="unit">주</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> <span className="hl personal">개인</span> 휴식 주차
                </span>
                <span className="info-value week">
                  {growthPeriodStats?.restWeeks ?? 0}
                  <span className="highlight-orange">({growthPeriodStats?.restSeasons ?? 0})</span>
                  <span className="unit">주</span>
                </span>
              </div>
              <div className="info-row club-break-row">
                <span className="info-label">
                  <span className="dot">·</span> <span className="hl official">공식</span> 휴식 주차
                </span>
                <span className="info-value week">
                  {growthPeriodStats?.clubBreakWeeks ?? 0}
                  <span className="unit">주</span>
                </span>
                <div className="club-break-tooltip">공식 휴식 주차(구정 설 연휴, 추석, 중간/기말고사 등)에 사전 승인된 &apos;활동&apos;을 진행하여 적격요건을 달성한 경우, 해당 주차는 &apos;휴식(공식) 주차&apos;가 아닌, &apos;성장(성공) 주차&apos;에 반영됩니다.</div>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 가능 주차
                </span>
                <span className="info-value week">
                  {growthPeriodStats?.availableWeeks ?? 0}
                  <span className="unit">주</span>
                </span>
              </div>
              <div className="info-row separator">
                <span className="info-label">
                  <span className="dot">·</span> <span className="hl personal">개인</span> 휴식 시즌
                </span>
                <span className="info-value season">
                  {growthPeriodStats?.restSeasons ?? 0}
                  <span className="unit">시즌</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <span className="dot">·</span> 성장 <span className="hl success">성공</span> 시즌
                </span>
                <span className="info-value season">
                  {growthPeriodStats?.approvedSeasons ?? 0}
                  <span className="unit">시즌</span>
                </span>
              </div>
            </div>
            <div className="card-footer">
              <span className="watch-pricing">
                WATCH GROWTH <img src="/images/0/cluster 3/icon/_.png" alt="icon" />
              </span>
            </div>
          </div>

          {/* 카드 3: 성장 점수 기록(Point) */}
          <div className="stat-card">
            <div className="card-header">
              <div className="card-icon green">
                <img src="/images/0/cluster 3/icon/0green.png" alt="Green" />
              </div>
              <h3 className="card-title">성장 점수 기록(Point)</h3>
            </div>
            {/* PX 분기에서만 단감/인절미/어흥 → 투구/방패/화살 텍스트 + badge-icon class 로 교체.
                pointsData 원본은 미터치. "(총합)" 접미사와 .orange semantic class 는 보존. */}
            <div className="card-body">
              {(() => {
                const rows: Array<{
                  name: "단감" | "인절미" | "어흥";
                  value: number;
                  defaultSrc: string;
                  defaultIconClass: string;
                }> = [
                  { name: "단감", value: pointsData.dangam, defaultSrc: "/images/0/cluster 3/icon/Ok01.png", defaultIconClass: "label-icon orange" },
                  { name: "인절미", value: pointsData.injeolmi, defaultSrc: "/images/0/cluster 3/icon/OK02.png", defaultIconClass: "label-icon" },
                  { name: "어흥", value: Math.abs(pointsData.eoheung), defaultSrc: "/images/0/cluster 3/icon/Ok03.png", defaultIconClass: "label-icon" },
                ];
                return rows.map((row) => {
                  // org-aware alias (PX → 투구/방패/화살, EC → 별/방패/번개).
                  const mapped = getOrgAliasFromPathname(pathname, row.name);
                  const label = mapped?.label ?? row.name;
                  return (
                    <div className="info-row" key={row.name}>
                      <span className="info-label">
                        <span className="dot">·</span> {label}(총합){" "}
                        {mapped ? (
                          <span className={`${row.defaultIconClass} badge-icon ${mapped.iconClass}`} aria-hidden="true" />
                        ) : (
                          <img src={row.defaultSrc} alt={row.name} className={row.defaultIconClass} />
                        )}
                      </span>
                      <span className="info-value number">
                        {row.value.toLocaleString()}
                        <span className="unit">개</span>
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="card-footer">
              <span className="watch-pricing">
                WATCH GROWTH <img src="/images/0/cluster 3/icon/_.png" alt="icon" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 졸업 자격 조건 - 배경 이미지 영역 */}
      <section className="cluster3-section2" ref={section2Ref}>
        {/* 플로팅 아이콘 */}
        <div className="floating-icons" style={{ display: "flex" }}>
          <div className="edit-icon search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div className="tooltip">등록된 도움말이 없습니다</div>
          </div>
        </div>
        <div className="section2-bg">
          <img src="/images/0/cluster 3/bg2.png" alt="Background" />
        </div>
        <div className="section2-right">
          <div className="section2-text">
            <span className="handwriting">클럽 강화 품계</span>
          </div>
        </div>

        {/* 상위 퍼센트 + 서브 멘트 - 같은 y좌표 배치 */}
        <div className="section2-sub-row">
          <div className="section2-progress">
            <div className="progress-info">
              <span className="progress-label">상위</span>
              <span className="progress-percent">{topPercent}</span>
              <span className="progress-unit">%</span>
            </div>
          </div>
          <p className="section-comment section2-comment">
            클럽 활동 중 함께 활동하는 수백명의 크루들 간의 경쟁을 기준으로,
            <br />매 주 단위 &apos;강화&apos; / &apos;성장&apos; 순위를 집계하여 누적된, 나의 최종 클럽 활동 성적입니다.
          </p>
        </div>

        {/* 10개의 품계 카드 (정승 + 정 1~9품) */}
        <div className="section2-cards">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => {
            // 라벨 표시: 1->정승, 2->정1품, 3->정2품 ... 10->정9품
            const displayRank = rank === 1 ? "정승" : rank - 1;
            // rank index → 이미지 파일 명시적 매핑 (label off-by-one 과 무관하게 rank 1~10 → 정 1~10 품.png 고정)
            const rankImageFile = [
              "정 1 품.png",
              "정 2 품.png",
              "정 3 품.png",
              "정 4 품.png",
              "정 5 품.png",
              "정 6 품.png",
              "정 7 품.png",
              "정 8 품.png",
              "정 9 품.png",
              "정 10 품.png",
            ][rank - 1];
            // org-suffix 별 rank 이미지 폴더 — default /image, PX /image/px,
            // EC /image/ec. 파일명(`정 1 품.png` ~ `정 10 품.png`)은 폴더
            // 마다 동일하므로 rankImageFile 배열은 모두에서 재사용.
            const rankImageBasePath = isPX
              ? "/images/0/cluster 3/image/px"
              : isEC
              ? "/images/0/cluster 3/image/ec"
              : "/images/0/cluster 3/image";
            return (
              <div
                key={rank}
                className={`rank-card ${rank === (gradeStats?.grade || 10) ? "active" : "inactive"}`}
                style={{
                  transform: !animationComplete && highlightedRank !== -1 && highlightedRank >= rank ? `scale(${1 + 0.08 * Math.max(0, 1 - Math.abs(highlightedRank - rank) * 0.3)}) translateY(${-5 * Math.max(0, 1 - Math.abs(highlightedRank - rank) * 0.3)}px)` : undefined,
                  boxShadow: !animationComplete && highlightedRank === rank
                    ? (isPX ? "0 8px 25px rgba(30, 149, 3, 0.6)" : isEC ? "0 8px 25px rgba(255, 75, 112, 0.6)" : "0 8px 25px rgba(250, 171, 7, 0.6)")
                    : !animationComplete && highlightedRank !== -1 && Math.abs(highlightedRank - rank) === 1
                    ? (isPX ? "0 4px 15px rgba(30, 149, 3, 0.3)" : isEC ? "0 4px 15px rgba(255, 75, 112, 0.3)" : "0 4px 15px rgba(250, 171, 7, 0.3)")
                    : undefined,
                  transition: !animationComplete ? "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
                  zIndex: !animationComplete && highlightedRank === rank ? 10 : undefined,
                }}
              >
                <div className="rank-medal">
                  <img src={`/images/0/cluster 3/icon/medal ${rank}.png`} alt={`Medal ${rank}`} />
                </div>
                <div className="rank-card-image">
                  <img src={`${rankImageBasePath}/${rankImageFile}`} alt={`Rank ${rank}`} />
                </div>
                <div className="rank-label">
                  {displayRank === "정승" ? (
                    <>
                      <span className="rank-prefix">정</span>
                      <span className="rank-number">승</span>
                    </>
                  ) : (
                    <>
                      <span className="rank-prefix">정</span>
                      <span className="rank-number">{displayRank}</span>
                      <span className="rank-suffix">품</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: 포트폴리오 마케팅 Channel */}
      <section className="cluster3-section3">
        <div className="floating-icons" style={{ display: "flex" }}>
          <div className="edit-icon search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>
        {/* 배경 이미지 */}
        <div className="section3-bg">
          <img src="/images/0/cluster 3/bg3.png" alt="Background" />
        </div>

        <div className="section3-header">
          <div className="header-left">
            <h2 className="subtitle">
              <img src="/images/0/cluster 3/polygon.png" alt="triangle" style={{ width: "39px", height: "39px", objectFit: "contain", marginRight: "-24px", position: "relative", top: "-8px", zIndex: -1 }} />
              포트폴리오 아카이빙 Channel
            </h2>
            <div className="header-sub">
              <span className="view-all" onClick={() => handleArrowClick("section3")} style={{ cursor: "pointer" }}>
                View All Bids <img src="/images/0/cluster 3/arrow.png" alt="arrow" style={{ width: "14px", height: "14px", objectFit: "contain", marginLeft: "4px" }} />
              </span>
            </div>
            <p className="section-comment section3-comment">클럽 활동 중 쌓아 올린 커리어 결과물이 누적된 포트폴리오 아카이빙 채널 리스트 입니다.</p>
          </div>
        </div>

        <div className="channel-cards">
          {channelCards.slice(section3Page * 8, section3Page * 8 + 8).map((card, index) => {
            const actualIndex = section3Page * 8 + index;
            const isUnlocked = actualIndex < unlockedCardCount;
            const isLocked = !isUnlocked;
            const isComplete = isCardComplete(card);
            return (
              <div
                key={card.id}
                className={`channel-card${card.link ? " has-link" : ""}${isLocked ? " locked" : ""}`}
                style={{ cursor: isLocked ? "not-allowed" : "pointer", opacity: !isComplete ? 0.4 : 1 }}
                onClick={() => {
                  if (isLocked) return;
                  setCurrentCardIndex(actualIndex);
                  setSection3ModalOpen(true);
                }}
              >
                <div className="card-image">
                  <img src={`/images/0/cluster 3/image/${isPX ? "px/" : isEC ? "ec/" : ""}1-${((card.id - 1) % 8) + 1}.png`} alt="Channel" />
                  <div className="card-tag">{card.startYear && card.startMonth && card.startDay ? `${card.startYear}년 ${String(card.startMonth).padStart(2, "0")}월 ${String(card.startDay).padStart(2, "0")}일` : card.tag}</div>
                  <div className="card-like">
                    <svg viewBox="0 0 24 24" fill={card.status === "운영 중" ? "#ff4444" : card.status === "운영 중단" ? "#4488ff" : card.status === "운영 보류" ? "#44bb44" : "none"} stroke={card.status ? "none" : "currentColor"} strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                </div>
                <div className="card-content">
                  <p className="card-title">
                    {card.channelName ? (
                      <>
                        <span className="at-symbol">@</span> {card.channelName.replace(/^@\s*/, "")}
                      </>
                    ) : (
                      card.title
                    )}
                  </p>
                  <div className="card-info">
                    <div className="info-row">
                      <div className="info-author">
                        {card.platform && PLATFORM_ICONS[card.platform] && <img src={PLATFORM_ICONS[card.platform]} alt={card.platform} className={`sns-icon`} />}
                        <div className="author-text">
                          <span className="info-label">Created by:</span>
                          <span className="author-name">{engName || "Unknown"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="card-divider"></div>
                    <div className="info-row growth-row">
                      {card.management ? <span className={`management-tag ${card.management === "개인 소유 관리" ? "tag--yellow" : card.management === "팀 소속 협업" ? "tag--red" : "tag--blue"}`}>#{card.management}</span> : <span className="info-label">Growth Bid</span>}
                      <div className="info-price">
                        <img src="/images/0/cluster 3/icon/dia.png" alt="dia" className="dia-icon" />
                        <span className="price-value">{card.rating ? `${card.rating}/10` : "- / 10"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 섹션 3 페이지네이션 */}
        <div className="section3-pagination">
          <span className={`page-num ${section3Page === 0 ? "active" : ""}`} onClick={() => setSection3Page(0)}>
            1
          </span>
          {showPage2 && (
            <span className={`page-num ${section3Page === 1 ? "active" : ""} last`} onClick={() => setSection3Page(1)}>
              2
            </span>
          )}
        </div>
      </section>

      {/* Section 4: 포트폴리오 아카이빙 Output */}
      <section className="cluster3-section4">
        {/* 플로팅 아이콘 - 로그인한 본인만 표시 */}
        <div className="floating-icons" style={{ display: "flex" }}>
          <div className="edit-icon search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div className="tooltip">등록된 도움말이 없습니다</div>
          </div>
        </div>
        {/* 배경 이미지 */}
        <div className="section4-bg">
          <img src="/images/0/cluster 3/bg4.png" alt="Background" />
        </div>

        <div className="section4-top-header">
          <div className="header-left">
            <h2 className="subtitle">
              <img src="/images/0/cluster 3/polygon.png" alt="triangle" style={{ width: "39px", height: "39px", objectFit: "contain", marginRight: "-24px", position: "relative", top: "-8px", zIndex: -1 }} />
              포트폴리오 아카이빙 output
            </h2>
            <div className="header-sub">
              <span className="view-all" onClick={() => handleArrowClick("section4")} style={{ cursor: "pointer" }}>
                View All Bids <img src="/images/0/cluster 3/arrow.png" alt="arrow" style={{ width: "14px", height: "14px", objectFit: "contain", marginLeft: "4px" }} />
              </span>
            </div>
          </div>
        </div>
        <div className="section4-header">
          <h2 className="section4-title">World Of Top Works</h2>
          <p className="section4-desc">
            *본 섹션에서는, 클럽에서 쌓은 모든 활동 경험 중 커리어에서 가장 어필하고자 하는 최고 결과물 Top 5개 만을 선별하여 기재하였습니다.
            <br />
            전체적인 실무 경험, 실무 경력, 실무 역량, 실무 정보 등은 다른 탭, 섹션에서 확인해주세요.
          </p>
        </div>

        <div className="section4-tabs">
          <button className={`tab-btn creative ${bouncingBtn === "creative" ? "btn-bounce" : ""}`} onClick={() => handleBtnClick("creative")}>
            #Creative More <img src="/images/0/cluster 3/icon/화살표.png" alt="arrow" className="btn-arrow" />
          </button>
          <button className={`tab-btn practical ${bouncingBtn === "practical" ? "btn-bounce" : ""}`} onClick={() => handleBtnClick("practical")}>
            #Practical More <img src="/images/0/cluster 3/icon/화살표.png" alt="arrow" className="btn-arrow" />
          </button>
        </div>

        <div className="top-works-slider">
          {topWorksSlides.map((slide, index) => {
            // 현재 활성 슬라이드 기준으로 원형 회전 위치 계산
            const totalSlides = topWorksSlides.length;
            let position = index - activeSlide;

            // 원형 회전: -2 ~ 2 범위로 조정
            if (position > 2) position -= totalSlides;
            if (position < -2) position += totalSlides;

            // 순차 잠금: 카드 N을 완성해야 카드 N+1 unlock (channel 카드와 동일 패턴)
            const isVoidCard = index >= unlockedOutputCount;
            // 작성된(검증 통과) 카드만 선명 — 미완성 unlock 카드는 채널과 동일하게 dim
            const isOutputComplete = !isVoidCard && validateOutputCard(outputCards[index]).length === 0;
            return (
              <div
                key={slide.id}
                className={`slider-item position-${position}${isOutputComplete ? " has-link" : ""}${isVoidCard ? " void-card" : ""}`}
                data-position={position}
                onClick={() => {
                  if (position !== 0) return;
                  if (isVoidCard) return;
                  setCurrentOutputIndex(index);
                  setSection4ModalOpen(true);
                }}
                style={{ cursor: position === 0 && !isVoidCard ? "pointer" : "default", opacity: isVoidCard ? 0.4 : (isOutputComplete ? 1 : 0.4) }}
              >
                <img src={`/images/0/cluster 3/image/2-${slide.id}.png`} alt={`Work ${slide.id}`} />
                <div className="card-overlay">
                  <div className="card-top">
                    <div className="info-author">
                      {outputCards[index]?.platform && PLATFORM_ICONS[outputCards[index].platform] && (
                        <img src={PLATFORM_ICONS[outputCards[index].platform]} alt={outputCards[index].platform} className="sns-icon" />
                      )}
                      <div className="author-text">
                        <span className="info-label">Posted by :</span>
                        <span className="author-name">{engName || "Unknown"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="card-badges">
                    <div className="card-tag">09h 99m 99s</div>
                    <div className="card-like">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="section4-pagination">
          {[1, 2, 3, 4, 5].map((num) => (
            <span key={num} className={`page-num ${activeSlide === num - 1 ? "active" : ""} ${num === 5 ? "last" : ""}`} onClick={() => setActiveSlide(num - 1)}>
              {num}
            </span>
          ))}
        </div>

        {/* Section 5: The Detail 10 - 섹션4 배경 안에 포함 */}
        <div className="cluster3-section5">
          {/* 플로팅 아이콘 - 로그인한 본인만 표시 */}
          <div className="floating-icons" style={{ display: "flex" }}>
            <div className="edit-icon search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="tooltip">등록된 도움말이 없습니다</div>
            </div>
          </div>
          <div className="section5-header">
            <div className="header-left">
              <h2 className="subtitle">
                <img src="/images/0/cluster 3/polygon.png" alt="triangle" style={{ width: "39px", height: "39px", objectFit: "contain", marginRight: "-24px", position: "relative", top: "-8px", zIndex: -1 }} />
                The Detail 10
              </h2>
              <div className="header-sub">
                <span className="view-all" onClick={() => handleArrowClick("section5")} style={{ cursor: "pointer" }}>
                  View All Bids <img src="/images/0/cluster 3/arrow.png" alt="arrow" style={{ width: "14px", height: "14px", objectFit: "contain", marginLeft: "4px" }} />
                </span>
              </div>
            </div>
            <p className="section-comment section5-comment">
              클럽에서 쌓아올린 모든 활동 중 더 자세하게 핵심으로 어필하고픈 <br />
              second 10 개의 최고 결과물을 선별하여 기재하였습니다.
            </p>
          </div>

          <div className="detail-grid">
            {detailThumbnails.map((thumb, index) => {
              const isVoidDetail = index >= unlockedDetailCount;
              // 작성된 카드만 선명 (채널과 동일 패턴)
              const isDetailComplete = !isVoidDetail && validateOutputCard(detailCards[index]).length === 0;

              return (
                <div
                  key={thumb.id}
                  className={`detail-item${isDetailComplete ? " has-link" : ""}${isVoidDetail ? " void-card" : ""}`}
                  onClick={() => {
                    if (isVoidDetail) return;
                    setCurrentDetailIndex(index);
                    setIsDetailModalOpen(true);
                  }}
                  style={{ cursor: isVoidDetail ? "default" : "pointer", opacity: isVoidDetail ? 0.4 : (isDetailComplete ? 1 : 0.4) }}
                >
                  <img src={`/images/0/cluster 3/image/3-${thumb.id}.png`} alt={`Detail ${thumb.id}`} />
                  <div className="item-overlay">
                    <div className="like-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <span>99 Like</span>
                    </div>
                    <div className="item-bottom">
                      {detailCards[index]?.platform && PLATFORM_ICONS[detailCards[index].platform] && (
                        <img src={PLATFORM_ICONS[detailCards[index].platform]} alt={detailCards[index].platform} className="sns-icon" />
                      )}
                      <div className="item-info">
                        <span className="item-tags">#Detail, #Micro</span>
                        <span className="item-author">@{engName || "Unknown"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 섹션 3 모달 - 채널 링크 편집 */}
      {section3ModalOpen && (
        <div className="section-modal-overlay">
          <div className="modal-scroll-content">
          <div className={`section-modal${!isEditMode && (() => { const c = channelCards[currentCardIndex]; if (!c) return false; return !c.channelName?.trim() && !c.platform && !c.management && !c.startYear && !c.rating && !c.status && !c.link?.trim() && (c.images || []).filter((img) => img).length === 0 && !c.insight?.trim() && !c.experience?.trim() && !c.metrics?.trim(); })() ? " modal-dimmed" : ""}`}>
            <div className="section-modal-header">
              <button className="modal-close-btn" onClick={handleCloseModal}>
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>Portfolio Channel [{currentCardIndex + 1}]</h3>
              </div>
              {isEditMode && (
                <p className="modal-subtitle">
                  본인의 포트폴리오 채널의 성과와 관련 경험들을 기업/사회/커리어 측면에서 어필이 될 수 있도록 작성하세요.<span style={{ fontStyle: "normal" }}>😊</span>
                </p>
              )}
            </div>
            <div className="section-modal-body" ref={section3ModalBodyRef}>
              <div className="modal-top-row">
                <div className="channel-info-section">
                  <h4 className="channel-info-title">
                    <img src="/images/0/portfolio.png" alt="portfolio" className="title-icon" />
                    <span className="user-name">{displayName || "크루"} 님</span>
                    <span className="channel-title-text">의 Portfolio Channel</span>
                  </h4>
                  {(() => {
                    const card = channelCards[currentCardIndex];
                    if (!card) return null;
                    const fields = [
                      { label: "채널명", key: "channelName", type: "channelNameInput" },
                      { label: "채널 플랫폼", key: "platform", type: "platformDropdown" },
                      { label: "채널 관리", key: "management", type: "select", options: MANAGEMENT_OPTIONS },
                      { label: "채널 시작", key: "date", type: "date" },
                      { label: "채널 평가", key: "rating", type: "rating" },
                      { label: "운영 현황", key: "status", type: "select", options: STATUS_OPTIONS },
                      { label: "채널 살펴보기", key: "link", type: "link" },
                    ];
                    return fields.map((f) => (
                      <div key={f.key} className="channel-info-field" data-field={f.key === "date" ? "startDate" : f.key === "platformDropdown" ? "platform" : f.key}>
                        <label>
                          {f.label}
                          {isEditMode && <span style={{ color: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07", marginLeft: "2px" }}>*</span>}
                        </label>
                        {f.type === "text" && (isEditMode ? <input type="text" value={(card as any)[f.key] || ""} onChange={(e) => handleCardChange(f.key, e.target.value)} placeholder={f.placeholder} /> : <span className="field-value">{(card as any)[f.key] || "-"}</span>)}
                        {f.type === "channelNameInput" &&
                          (isEditMode ? (
                            <div className="channel-name-input-wrapper">
                              <span className="at-prefix">@&nbsp;</span>
                              <input type="text" value={(card.channelName || "").replace(/^@\s*/, "")} onChange={(e) => handleCardChange("channelName", "@ " + e.target.value)} placeholder="채널명을 입력하세요" />
                            </div>
                          ) : (
                            <span className="field-value">@ {(card.channelName || "-").replace(/^@\s*/, "")}</span>
                          ))}
                        {f.type === "select" &&
                          (isEditMode ? (
                            <div className="custom-dropdown">
                              <div className="dropdown-selected" onClick={(e) => toggleDropdown(f.key, e)}>
                                <span>{(card as any)[f.key] || "선택하세요"}</span>
                                <i className="ti ti-chevron-down"></i>
                              </div>
                            </div>
                          ) : (
                            <span className="field-value">{(card as any)[f.key] || "-"}</span>
                          ))}
                        {f.type === "platformDropdown" &&
                          (isEditMode ? (
                            <div className="platform-dropdown">
                              <div className="platform-selected" onClick={(e) => toggleDropdown("platform", e)}>
                                {card.platform ? (
                                  <>
                                    {PLATFORM_ICONS[card.platform] && <img src={PLATFORM_ICONS[card.platform]} alt={card.platform} className="platform-icon" />}
                                    <span>{card.platform}</span>
                                  </>
                                ) : (
                                  <span className="placeholder">선택하세요</span>
                                )}
                                <i className="ti ti-chevron-down"></i>
                              </div>
                            </div>
                          ) : (
                            <div className="platform-display" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {PLATFORM_ICONS[card.platform] && <img src={PLATFORM_ICONS[card.platform]} alt={card.platform} className="platform-icon" style={{ width: "20px", height: "20px", objectFit: "contain" }} />}
                              <span className="field-value">{card.platform || "-"}</span>
                            </div>
                          ))}
                        {f.type === "date" &&
                          (isEditMode ? (
                            <input
                              type="date"
                              className="channel-date-input"
                              value={card.startYear && card.startMonth && card.startDay ? `${card.startYear}-${String(card.startMonth).padStart(2, "0")}-${String(card.startDay).padStart(2, "0")}` : ""}
                              onChange={(e) => {
                                const d = new Date(e.target.value);
                                if (!isNaN(d.getTime())) {
                                  handleCardChange("startYear", String(d.getFullYear()));
                                  handleCardChange("startMonth", String(d.getMonth() + 1).padStart(2, "0"));
                                  handleCardChange("startDay", String(d.getDate()).padStart(2, "0"));
                                }
                              }}
                            />
                          ) : (
                            <span className="field-value">{formatDate(card.startYear, card.startMonth, card.startDay)}</span>
                          ))}
                        {f.type === "rating" && (
                          <div className="rating-field" style={{ flex: 1 }}>
                            <StarRating rating={Number(card.rating) || 0} />
                            {isEditMode && (
                              <div className="custom-dropdown small">
                                <div className="dropdown-selected" onClick={(e) => toggleDropdown("rating", e)}>
                                  <span>{card.rating || "-"}</span>
                                  <i className="ti ti-chevron-down"></i>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {f.type === "link" &&
                          (isEditMode ? (
                            <div className="link-field">
                              <input type="text" value={card.link || ""} onChange={(e) => handleCardChange("link", e.target.value)} placeholder="https://..." style={{ whiteSpace: "nowrap" as const, overflow: "auto" }} />
                              <button
                                className="link-open-btn"
                                onClick={() => {
                                  if (card.link) window.open(card.link, "_blank");
                                }}
                                disabled={!card.link}
                              >
                                <i className="ti ti-arrow-up-right"></i>
                              </button>
                            </div>
                          ) : (
                            <div className="link-field">
                              <span className="field-value" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                                {card.link ? (card.link.length > 20 ? card.link.substring(0, 20) + ".." : card.link) : "-"}
                              </span>
                              {card.link && (
                                <button className="link-open-btn" onClick={() => window.open(card.link, "_blank")}>
                                  <i className="ti ti-arrow-up-right"></i>
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    ));
                  })()}
                </div>
                <div className="channel-images-section" data-field="images">
                  {/* 대표 이미지 타이틀 — 주석 처리
                  <h4 className="channel-images-title">대표 이미지 (최소 3장 필수)</h4>
                  */}
                  <div className="images-grid">
                    {channelCards[currentCardIndex]?.images.map((img, si) => (
                      <div key={si} className={`image-slot${si === 0 ? " large" : " small"}${!isSlotEnabled(si) ? " disabled" : ""}`}>
                        <div
                          className="image-preview"
                          onClick={() => {
                            if (img) setPreviewImage(img);
                          }}
                        >
                          {img ? (
                            <img src={img} alt={`대표 이미지 ${si + 1}`} />
                          ) : (
                            <div className="empty-slot">
                              <i className="ti ti-photo-plus"></i>
                            </div>
                          )}
                          {isEditMode && si <= 2 && !img && <span className="image-required">*</span>}
                          {isEditMode && (
                            <div className="image-actions-overlay">
                              <button
                                className="image-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImageUploadClick(si);
                                }}
                                disabled={!isSlotEnabled(si)}
                              >
                                <i className="ti ti-upload"></i>
                              </button>
                              <button
                                className="image-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImageDelete(si);
                                }}
                                disabled={!isSlotEnabled(si) || !img}
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          ref={(el) => {
                            imageInputRefs.current[si] = el;
                          }}
                          style={{ display: "none" }}
                          onChange={(e) => handleImageFileChange(e, si)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="channel-bottom-section">
                {(
                  [
                    { key: "insight", title: "기획 방향/인싸이트", placeholder: "기획 방향/인싸이트를 작성해주세요 (최대 250자)" },
                    { key: "experience", title: "관련 주요 경험/활동", placeholder: "관련 주요 경험/활동을 작성해주세요 (최대 250자)" },
                    { key: "metrics", title: "핵심 정량적 지표/수치", placeholder: "핵심 정량적 지표/수치를 작성해주세요 (최대 250자)" },
                  ] as const
                ).map((box) => {
                  const card = channelCards[currentCardIndex];
                  const val = (card as any)[box.key] || "";
                  return (
                    <div key={box.key} className="channel-textarea-box" data-field={box.key}>
                      <h5 className="textarea-title">
                        {box.title}
                        {isEditMode && <span style={{ color: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07", marginLeft: "2px" }}>*</span>}
                      </h5>
                      <div className="textarea-wrapper">
                        {isEditMode ? (
                          <>
                            <textarea
                              value={val}
                              onChange={(e) => {
                                if (e.target.value.length <= 250) handleCardChange(box.key, e.target.value);
                              }}
                              maxLength={250}
                              placeholder={box.placeholder}
                              rows={6}
                            />
                            <span className="char-count">{val.length}/250</span>
                          </>
                        ) : (
                          <div className="textarea-readonly">{val || "-"}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="section-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)} style={{ cursor: "pointer", visibility: "visible" }}>
                  🔎
                </span>
                <div className="modal-footer-nav">
                  <button className="nav-btn prev" onClick={handlePrevCard} disabled={isEditMode || currentCardIndex === 0} title={isEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-left"></i>
                  </button>
                  <button className="nav-btn next" onClick={handleNextCard} disabled={isEditMode || currentCardIndex >= unlockedCardCount - 1 || currentCardIndex >= MAX_CARDS - 1} title={isEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-right"></i>
                  </button>
                </div>
                <div className="modal-footer-right">
                  {!isEditMode ? (
                    <button className="modal-edit-btn" onClick={() => setIsEditMode(true)}>
                      수정
                    </button>
                  ) : (
                    <>
                      <button
                        className="modal-cancel-btn"
                        onClick={async () => {
                          if (isCardDirty()) {
                            if (await popup.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?")) {
                              const restored = [...channelCards];
                              restored[currentCardIndex] = JSON.parse(JSON.stringify(cardSnapshot));
                              setChannelCards(restored);
                              setIsEditMode(false);
                              setSection3FooterNotice("default");
                            }
                          } else {
                            setIsEditMode(false);
                            setSection3FooterNotice("default");
                          }
                        }}
                      >
                        취소
                      </button>
                      <button
                        className="modal-reset-btn"
                        onClick={async () => {
                          if (await popup.confirm("내용을 모두 초기화하시겠어요?")) {
                            const resetCard = currentCardIndex === 0 ? { ...CLUSTER3_CHANNEL_DEFAULTS.firstCard } : { id: currentCardIndex + 1, ...CLUSTER3_CHANNEL_DEFAULTS.emptyCard };
                            const updated = [...channelCards];
                            updated[currentCardIndex] = resetCard;
                            setChannelCards(updated);
                            setSection3FooterNotice("default");
                          }
                        }}
                      >
                        초기화
                      </button>
                      <button
                        className="modal-save-btn"
                        disabled={isSavingChannelCard}
                        onClick={async () => {
                          const card = channelCards[currentCardIndex];
                          const missing: string[] = [];
                          if (!card.channelName?.trim()) missing.push("channelName");
                          if (!card.platform) missing.push("platform");
                          if (!card.management) missing.push("management");
                          if (!card.startYear || !card.startMonth || !card.startDay) missing.push("startDate");
                          if (!card.rating || Number(card.rating) < 1) missing.push("rating");
                          if (!card.status) missing.push("status");
                          if (!card.link?.trim()) missing.push("link");
                          if ((card.images || []).filter((img) => img !== null).length < 3) missing.push("images");
                          if (!card.insight?.trim()) missing.push("insight");
                          if (!card.experience?.trim()) missing.push("experience");
                          if (!card.metrics?.trim()) missing.push("metrics");

                          if (missing.length > 0) {
                            setSection3FooterNotice("error");
                            const modalBody = document.querySelector(".section-modal-body");
                            const targetEl = modalBody?.querySelector(`[data-field="${missing[0]}"]`);
                            if (targetEl) {
                              targetEl.classList.add("field-missing");
                              targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                              setTimeout(() => targetEl.classList.remove("field-missing"), 900);
                            }
                            return;
                          }

                          if (!(await popup.confirm("저장하시겠습니까?"))) return;

                          // 빈 슬롯 뒤로 정렬
                          const compactImages = (card.images || []).filter((img) => img !== null);
                          const reorderedImages = [...compactImages, ...Array(5 - compactImages.length).fill(null)];
                          const cardToSave = { ...card, images: reorderedImages };

                          if (isDemoMode) {
                            const updated = [...channelCards];
                            updated[currentCardIndex] = cardToSave;
                            setChannelCards(updated);
                            await popup.alert("저장되었어요!");
                            setCardSnapshot(JSON.parse(JSON.stringify(updated[currentCardIndex])));
                            setIsEditMode(false);
                            setSection3FooterNotice("default");
                            return;
                          }

                          const finalCard = await saveChannelCard(currentCardIndex + 1, cardToSave);
                          if (!finalCard) return;

                          // saveChannelCard 내부에서 channelCards가 이미 갱신됨 (업로드된 URL 반영)
                          // 스냅샷에는 동일한 finalCard를 동기화
                          setCardSnapshot(JSON.parse(JSON.stringify({ ...channelCards[currentCardIndex], ...finalCard })));
                          await popup.alert("저장되었어요!");
                          setIsEditMode(false);
                          setSection3FooterNotice("default");
                        }}
                      >
                        {isSavingChannelCard ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom" style={{ visibility: isEditMode ? "visible" : "hidden" }}>
                <p className={`modal-footer-notice ${section3FooterNotice === "error" ? "notice-error" : ""}`}>{section3FooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
      {/* fixed 드롭다운 옵션 (overflow 잘림 방지) */}
      {openDropdownId &&
        dropdownPosition &&
        (() => {
          // Detail 모달 — 도구(멀티 선택)
          if (openDropdownId === "detailTools") {
            const detail = detailCards[currentDetailIndex];
            if (!detail) return null;
            const selectedTools = detail.tools || [];
            return (
              <div className="dropdown-options-fixed" style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, width: Math.max(dropdownPosition.width, 200), zIndex: 100010 }} onWheel={(e) => e.stopPropagation()}>
                <div className="dropdown-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "6px 10px", borderBottom: `1px solid ${isPX ? "rgba(30, 149, 3, 0.2)" : isEC ? "rgba(255, 75, 112, 0.2)" : "rgba(255, 165, 0, 0.2)"}` }}>
                  <button
                    className="dropdown-action-btn"
                    onClick={() => {
                      handleDetailChange("tools", []);
                    }}
                    style={{ background: "transparent", border: "1px solid #666", color: "#ccc", padding: "3px 10px", fontSize: "12px", cursor: "pointer", borderRadius: "3px" }}
                  >
                    삭제
                  </button>
                  <button
                    className="dropdown-action-btn"
                    onClick={() => {
                      setOpenDropdownId(null);
                      setDropdownPosition(null);
                    }}
                    style={{ background: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07", border: "none", color: "#000", padding: "3px 10px", fontSize: "12px", cursor: "pointer", borderRadius: "3px", fontWeight: "bold" }}
                  >
                    저장
                  </button>
                </div>
                {TOOL_OPTIONS.map((tool) => {
                  const isSelected = selectedTools.includes(tool.key);
                  return (
                    <div
                      key={tool.key}
                      className={`dropdown-option${isSelected ? " selected" : ""}`}
                      onClick={async () => {
                        if (isSelected) {
                          handleDetailChange(
                            "tools",
                            selectedTools.filter((t) => t !== tool.key),
                          );
                        } else {
                          if (selectedTools.length >= 5) {
                            await popup.alert("최대 5개까지 고를 수 있습니다.");
                            return;
                          }
                          handleDetailChange("tools", [...selectedTools, tool.key]);
                        }
                      }}
                    >
                      <span className="tool-check">{isSelected ? "☑" : "☐"}</span>
                      {tool.icon ? <img src={tool.icon} alt={tool.label} className="platform-icon" /> : <span className="platform-icon-placeholder" />}
                      <span>{tool.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          }
          // Detail 모달 드롭다운
          if (openDropdownId === "detailPlatform" || openDropdownId === "detailContribution") {
            const detail = detailCards[currentDetailIndex];
            if (!detail) return null;
            let options: { key: string; label: string; icon?: string }[] = [];
            let currentVal = "";
            if (openDropdownId === "detailPlatform") {
              options = [{ key: "", label: "-", icon: "" }, ...PLATFORM_OPTIONS.map((p) => ({ key: p, label: p, icon: PLATFORM_ICONS[p] || "" }))];
              currentVal = detail.platform || "";
            } else {
              options = [{ key: "0", label: "-" }, ...[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => ({ key: String(n), label: `${n}%` }))];
              currentVal = String(detail.contribution || 0);
            }
            return (
              <div className="dropdown-options-fixed" style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, zIndex: 100010 }} onWheel={(e) => e.stopPropagation()}>
                {options.map((opt) => (
                  <div
                    key={opt.key}
                    className={`dropdown-option${currentVal === opt.key ? " selected" : ""}`}
                    onClick={() => {
                      if (openDropdownId === "detailPlatform") {
                        handleDetailChange("platform", opt.key);
                      } else {
                        handleDetailChange("contribution", Number(opt.key));
                      }
                      setOpenDropdownId(null);
                      setDropdownPosition(null);
                    }}
                  >
                    {opt.icon && <img src={opt.icon} alt={opt.label} className="platform-icon" />}
                    {opt.icon === "" && openDropdownId === "detailPlatform" && <span className="platform-icon-placeholder" />}
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            );
          }
          // Output 모달 — 도구(멀티 선택)
          if (openDropdownId === "tools") {
            const output = outputCards[currentOutputIndex];
            if (!output) return null;
            const selectedTools = output.tools || [];
            return (
              <div className="dropdown-options-fixed" style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, width: Math.max(dropdownPosition.width, 200), zIndex: 100010 }} onWheel={(e) => e.stopPropagation()}>
                <div className="dropdown-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "6px 10px", borderBottom: `1px solid ${isPX ? "rgba(30, 149, 3, 0.2)" : isEC ? "rgba(255, 75, 112, 0.2)" : "rgba(255, 165, 0, 0.2)"}` }}>
                  <button
                    className="dropdown-action-btn"
                    onClick={() => {
                      handleOutputChange("tools", []);
                    }}
                    style={{ background: "transparent", border: "1px solid #666", color: "#ccc", padding: "3px 10px", fontSize: "12px", cursor: "pointer", borderRadius: "3px" }}
                  >
                    삭제
                  </button>
                  <button
                    className="dropdown-action-btn"
                    onClick={() => {
                      setOpenDropdownId(null);
                      setDropdownPosition(null);
                    }}
                    style={{ background: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07", border: "none", color: "#000", padding: "3px 10px", fontSize: "12px", cursor: "pointer", borderRadius: "3px", fontWeight: "bold" }}
                  >
                    저장
                  </button>
                </div>
                {TOOL_OPTIONS.map((tool) => {
                  const isSelected = selectedTools.includes(tool.key);
                  return (
                    <div
                      key={tool.key}
                      className={`dropdown-option${isSelected ? " selected" : ""}`}
                      onClick={async () => {
                        if (isSelected) {
                          handleOutputChange(
                            "tools",
                            selectedTools.filter((t) => t !== tool.key),
                          );
                        } else {
                          if (selectedTools.length >= 5) {
                            await popup.alert("최대 5개까지 고를 수 있습니다.");
                            return;
                          }
                          handleOutputChange("tools", [...selectedTools, tool.key]);
                        }
                      }}
                    >
                      <span className="tool-check">{isSelected ? "☑" : "☐"}</span>
                      {tool.icon ? <img src={tool.icon} alt={tool.label} className="platform-icon" /> : <span className="platform-icon-placeholder" />}
                      <span>{tool.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          }
          // Output 모달 드롭다운
          if (openDropdownId === "outputPlatform" || openDropdownId === "outputContribution") {
            const output = outputCards[currentOutputIndex];
            if (!output) return null;
            let options: { key: string; label: string; icon?: string }[] = [];
            let currentVal = "";
            if (openDropdownId === "outputPlatform") {
              options = [{ key: "", label: "-", icon: "" }, ...PLATFORM_OPTIONS.map((p) => ({ key: p, label: p, icon: PLATFORM_ICONS[p] || "" }))];
              currentVal = output.platform || "";
            } else {
              options = [{ key: "0", label: "-" }, ...[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => ({ key: String(n), label: `${n}%` }))];
              currentVal = String(output.contribution || 0);
            }
            return (
              <div className="dropdown-options-fixed" style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, zIndex: 100010 }} onWheel={(e) => e.stopPropagation()}>
                {options.map((opt) => (
                  <div
                    key={opt.key}
                    className={`dropdown-option${currentVal === opt.key ? " selected" : ""}`}
                    onClick={() => {
                      if (openDropdownId === "outputPlatform") {
                        handleOutputChange("platform", opt.key);
                      } else {
                        handleOutputChange("contribution", Number(opt.key));
                      }
                      setOpenDropdownId(null);
                      setDropdownPosition(null);
                    }}
                  >
                    {opt.icon && <img src={opt.icon} alt={opt.label} className="platform-icon" />}
                    {opt.icon === "" && openDropdownId === "outputPlatform" && <span className="platform-icon-placeholder" />}
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            );
          }
          // 채널 모달 드롭다운
          const card = channelCards[currentCardIndex];
          if (!card) return null;
          let options: { key: string; label: string; icon?: string }[] = [];
          if (openDropdownId === "platform") {
            options = PLATFORM_OPTIONS.map((p) => ({ key: p, label: p, icon: PLATFORM_ICONS[p] || "" }));
          } else if (openDropdownId === "management") {
            options = MANAGEMENT_OPTIONS.map((o) => ({ key: o, label: o }));
          } else if (openDropdownId === "status") {
            options = STATUS_OPTIONS.map((o) => ({ key: o, label: o }));
          } else if (openDropdownId === "rating") {
            options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ key: String(n), label: String(n) }));
          }
          if (options.length === 0) return null;
          const currentVal = openDropdownId === "rating" ? String(card.rating) : (card as any)[openDropdownId] || "";
          return (
            <div className="dropdown-options-fixed" style={{ position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, zIndex: 100010 }} onWheel={(e) => e.stopPropagation()}>
              {options.map((opt) => (
                <div
                  key={opt.key}
                  className={`dropdown-option${currentVal === opt.key ? " selected" : ""}`}
                  onClick={() => {
                    handleCardChange(openDropdownId === "rating" ? "rating" : openDropdownId, opt.key);
                    setOpenDropdownId(null);
                    setDropdownPosition(null);
                  }}
                >
                  {opt.icon && <img src={opt.icon} alt={opt.label} className="platform-icon" />}
                  {opt.icon === "" && openDropdownId === "platform" && <span className="platform-icon-placeholder" />}
                  <span>{opt.label}</span>
                </div>
              ))}
            </div>
          );
        })()}
      {isOutputEditMode &&
        outputRangePickerOpen &&
        outputCalendarPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <PeriodRangePicker
            range={outputDateRange}
            month={outputRangeMonth}
            position={outputCalendarPosition}
            onMonthChange={setOutputRangeMonth}
            onSelect={selectOutputRangeDate}
            onToday={() => {
              const today = toDateOnly(new Date());
              applyOutputDateRange({ startDate: today, endDate: today });
            }}
            onClear={() => applyOutputDateRange({ startDate: null, endDate: null })}
            themeClassName={getThemeClass(pathname)}
          />,
          document.body,
        )}
      {isDetailEditMode &&
        detailRangePickerOpen &&
        detailCalendarPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <PeriodRangePicker
            range={detailDateRange}
            month={detailRangeMonth}
            position={detailCalendarPosition}
            onMonthChange={setDetailRangeMonth}
            onSelect={selectDetailRangeDate}
            onToday={() => {
              const today = toDateOnly(new Date());
              applyDetailDateRange({ startDate: today, endDate: today });
            }}
            onClear={() => applyDetailDateRange({ startDate: null, endDate: null })}
            themeClassName={getThemeClass(pathname)}
          />,
          document.body,
        )}
      {previewImage && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100002 }} onClick={() => setPreviewImage(null)}>
          <div
            className="image-preview-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "1020px", height: "794px", background: "#1a1a2e", border: `1px solid ${isPX ? "rgba(30, 149, 3, 0.3)" : isEC ? "rgba(255, 75, 112, 0.3)" : "rgba(255, 165, 0, 0.3)"}`, padding: "0px", boxShadow: isPX ? "0 0 60px rgba(30,149,3,0.15)" : isEC ? "0 0 60px rgba(255,75,112,0.15)" : "0 0 60px rgba(255,165,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
          >
            <img src={previewImage} alt="확대 보기" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        </div>
      )}

      {/* 도움말 모달 */}
      {showHelpModal && (
        <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100001 }}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button className="modal-close-btn" onClick={() => setShowHelpModal(false)}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <div className="help-modal-body">{/* 빈 콘텐츠 */}</div>
          </div>
        </div>
      )}

      {/* 섹션 4 모달 - Top Works 링크 편집 */}
      {section4ModalOpen && (
        <div className="output-modal-overlay">
          <div className="modal-scroll-content">
          <div className="output-modal">
            <div className="output-modal-header">
              <button className="modal-close-btn" onClick={handleCloseOutputModal}>
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/treasure.png" alt="treasure" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>Portfolio Output Top 5 [{currentOutputIndex + 1}]</h3>
              </div>
              <p className="modal-subtitle" style={{ visibility: isOutputEditMode ? "visible" : "hidden" }}>
                본인의 포트폴리오 결과물의 목표 {">"} 과정 {">"} 결과, 그리고 그 안에서 얻은 경험치들을 기업/사회/커리어 측면에서 어필이 될 수 있도록 작성하세요.<span style={{ fontStyle: "normal" }}>😊</span>
              </p>
            </div>
            <div className="output-modal-body">
              <div className="output-upper-section">
                <div className="output-left-column">
                  <div className="output-title-row">
                    <img src="/images/0/portfolio.png" alt="portfolio" className="title-icon" />
                    <span className="output-user-title">
                      <span className="user-name">{displayName || "크루"} 님</span>
                      <span style={{ marginLeft: "4px", fontSize: "23px", fontWeight: 700, color: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#faab07" }}>의 Output Top 5 [{currentOutputIndex + 1}]</span>
                    </span>
                    <div className="output-period" data-field="period">
                      <div className="period-wrapper" ref={outputPeriodPickerRef}>
                        <div className="period-display-row">
                          <div className="period-display-left">
                            {isOutputEditMode && <span className="required-mark">*</span>}
                            <span className="period-value period-range-value">{formatPeriodRange(outputCards[currentOutputIndex])}</span>
                          </div>
                          {isOutputEditMode && (
                            <button
                              ref={outputPeriodTriggerRef}
                              className="period-trigger-btn"
                              onClick={() => {
                                const range = getCardDateRange(outputCards[currentOutputIndex]);
                                setOutputDateRange(range);
                                setOutputRangeMonth(getInitialRangeMonth(range));
                                const position = getCalendarPosition(outputPeriodTriggerRef.current);
                                if (position) setOutputCalendarPosition(position);
                                setOutputRangePickerOpen((open) => !open);
                              }}
                            >
                              ▽
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="output-main-title output-field-with-count" data-field="mainTitle">
                    {isOutputEditMode && (
                      <span className="required-mark" style={{ position: "absolute", top: "4px", right: "6px", pointerEvents: "none", zIndex: 2 }}>
                        *
                      </span>
                    )}
                    {isOutputEditMode ? (
                      <input
                        type="text"
                        value={outputCards[currentOutputIndex].mainTitle || ""}
                        onChange={(e) => {
                          if (e.target.value.length <= 30) handleOutputChange("mainTitle", e.target.value);
                        }}
                        maxLength={30}
                        placeholder="메인 제목을 작성하세요 (최대 30자)"
                        className="output-main-title-input"
                      />
                    ) : (
                      <h2 className="output-main-title-text">{outputCards[currentOutputIndex].mainTitle || "-"}</h2>
                    )}
                    {isOutputEditMode && <span className="char-count">{(outputCards[currentOutputIndex].mainTitle || "").length}/30</span>}
                  </div>
                  <div className="output-sub-title output-field-with-count" data-field="subTitle">
                    {isOutputEditMode && (
                      <span className="required-mark" style={{ position: "absolute", top: "4px", right: "1px", pointerEvents: "none", zIndex: 2 }}>
                        *
                      </span>
                    )}
                    {isOutputEditMode ? (
                      <textarea
                        value={outputCards[currentOutputIndex].subTitle || ""}
                        onChange={(e) => {
                          if (e.target.value.length <= 100) handleOutputChange("subTitle", e.target.value);
                        }}
                        maxLength={100}
                        rows={2}
                        placeholder="서브 제목을 작성하세요 (최대 100자, 2줄까지)"
                        className="output-sub-title-input"
                      />
                    ) : (
                      <p className="output-sub-title-text">{outputCards[currentOutputIndex].subTitle || "-"}</p>
                    )}
                    {isOutputEditMode && <span className="char-count">{(outputCards[currentOutputIndex].subTitle || "").length}/100</span>}
                  </div>
                  {/* (3) 기여도 + (4) 플랫폼 */}
                  <div className="output-meta-row">
                    <div className="output-contribution" data-field="contribution">
                      <label>
                        기여도
                        {isOutputEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      <div className="contribution-bar-wrapper">
                        <div className="contribution-bar">
                          <div className="contribution-fill" style={{ width: `${outputCards[currentOutputIndex].contribution || 0}%` }} />
                        </div>
                        {isOutputEditMode ? (
                          <div className="custom-dropdown small contribution-dropdown">
                            <div className="dropdown-selected" onClick={(e) => toggleDropdown("outputContribution", e)}>
                              <span>{outputCards[currentOutputIndex].contribution || 0}%</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                          </div>
                        ) : (
                          <span className="contribution-value">{outputCards[currentOutputIndex].contribution || 0}%</span>
                        )}
                      </div>
                    </div>
                    <div className="output-platform" data-field="platform">
                      <label>
                        플랫폼
                        {isOutputEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      {isOutputEditMode ? (
                        <div className="custom-dropdown output-platform-dropdown">
                          <div className="dropdown-selected" onClick={(e) => toggleDropdown("outputPlatform", e)}>
                            {outputCards[currentOutputIndex].platform ? (
                              <>
                                {PLATFORM_ICONS[outputCards[currentOutputIndex].platform] && <img src={PLATFORM_ICONS[outputCards[currentOutputIndex].platform]} alt={outputCards[currentOutputIndex].platform} className="platform-icon" />}
                                <span>{outputCards[currentOutputIndex].platform}</span>
                              </>
                            ) : (
                              <span className="placeholder">선택하세요</span>
                            )}
                            <i className="ti ti-chevron-down"></i>
                          </div>
                        </div>
                      ) : (
                        <span className="field-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {PLATFORM_ICONS[outputCards[currentOutputIndex].platform] && <img src={PLATFORM_ICONS[outputCards[currentOutputIndex].platform]} alt={outputCards[currentOutputIndex].platform} className="platform-icon" style={{ width: "20px", height: "20px" }} />}
                          {outputCards[currentOutputIndex].platform || "-"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 4~5단: 역할+사용기술(좌) / 링크(우) */}
                  <div className="output-role-links-row">
                    <div className="output-role-column">
                      <div className="output-role-section" data-field="role">
                        <div className="output-role-header">
                          <label>
                            역할
                            {isOutputEditMode && (
                              <span className="required-mark" style={{ marginLeft: "2px" }}>
                                *
                              </span>
                            )}
                          </label>
                          <div className="output-role-input-wrap" style={{ position: "relative", flex: 1 }}>
                            {isOutputEditMode ? (
                              <input
                                type="text"
                                value={outputCards[currentOutputIndex].roleDescription || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 50) handleOutputChange("roleDescription", e.target.value);
                                }}
                                maxLength={50}
                                placeholder="이 과정에서 어떤 역할을 했는지 작성하세요 (최대 50자)"
                                className="output-role-input"
                                style={{ paddingRight: "55px" }}
                              />
                            ) : (
                              <p className="output-role-text">{outputCards[currentOutputIndex].roleDescription || "-"}</p>
                            )}
                            {isOutputEditMode && (
                              <span className="char-count" style={{ position: "absolute", bottom: "8px", right: "10px", fontSize: "11px", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                                {(outputCards[currentOutputIndex].roleDescription || "").length}/50
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="output-role-tags">
                          {ROLE_OPTIONS.map((role) => {
                            const isActive = (outputCards[currentOutputIndex].roles || []).includes(role.key);
                            return (
                              <button
                                key={role.key}
                                className={`role-tag ${isActive ? "active" : ""}`}
                                style={isActive ? { backgroundColor: role.color, color: "#1a1a1a", borderColor: role.color } : {}}
                                onClick={() => {
                                  if (!isOutputEditMode) return;
                                  const currentRoles = outputCards[currentOutputIndex].roles || [];
                                  if (isActive) {
                                    handleOutputChange(
                                      "roles",
                                      currentRoles.filter((r: string) => r !== role.key),
                                    );
                                  } else {
                                    handleOutputChange("roles", [...currentRoles, role.key]);
                                  }
                                }}
                                disabled={!isOutputEditMode}
                              >
                                {role.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="output-links-section" data-field="links">
                      {[0, 1, 2].map((i) => {
                        const link = (outputCards[currentOutputIndex].links || ["", "", ""])[i];
                        const dotColor = ["#FF6B6B", "#4ECDC4", isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07"][i];
                        return (
                          <div className="output-link-row" key={i} style={!isOutputEditMode ? { marginLeft: "9px" } : undefined}>
                            <span className="link-dot" style={{ backgroundColor: dotColor, marginLeft: "auto", ...(i === 0 ? { marginRight: "18px" } : (isOutputEditMode ? { marginRight: "15px" } : {})) }} />
                            {isOutputEditMode && i === 0 && (
                              <span className="required-mark" style={{ marginLeft: "-14px", marginRight: "-4px" }}>
                                *
                              </span>
                            )}
                            {isOutputEditMode ? (
                              <input
                                type="text"
                                value={link}
                                onChange={(e) => {
                                  const updated = [...(outputCards[currentOutputIndex].links || ["", "", ""])];
                                  updated[i] = e.target.value;
                                  handleOutputChange("links", updated);
                                }}
                                placeholder="https://..."
                                className="output-link-input"
                                style={{ maxWidth: "193px" }}
                              />
                            ) : (
                              <span className="output-link-text" style={{ maxWidth: "193px", fontSize: "13px", ...(i === 0 && { marginLeft: "-6px" }) }}>
                                {link ? (link.length > 20 ? link.substring(0, 20) + ".." : link) : "-"}
                              </span>
                            )}
                            <button className="link-open-btn" onClick={() => link && window.open(link, "_blank")} disabled={!link}>
                              <i className="ti ti-external-link"></i>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="output-right-column">
                  {/* (12) 메인 이미지 */}
                  <div className="output-main-image" data-field="mainImage">
                    <div className="image-preview" onClick={() => outputCards[currentOutputIndex].mainImage && setPreviewImage(outputCards[currentOutputIndex].mainImage)} style={{ position: "relative" }}>
                      {outputCards[currentOutputIndex].mainImage ? (
                        <img src={outputCards[currentOutputIndex].mainImage as string} alt="메인 이미지" style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                      ) : (
                        <div className="empty-slot">
                          <i className="ti ti-photo-plus"></i>
                        </div>
                      )}
                      {isOutputEditMode && !outputCards[currentOutputIndex].mainImage && (
                        <span className="required-mark" style={{ position: "absolute", bottom: "4px", left: "6px" }}>
                          *
                        </span>
                      )}
                      {isOutputEditMode && captionOpenIndex === 0 && (
                        <div
                          className="image-caption-overlay"
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            textAlign: "center",
                            padding: "4px 6px",
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                            zIndex: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "24px",
                            height: "24px",
                          }}
                        >
                          <input
                            type="text"
                            className="image-caption-input"
                            value={outputCards[currentOutputIndex].mainImageCaption || ""}
                            onChange={(e) => {
                              if (e.target.value.length <= 20) handleOutputChange("mainImageCaption", e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="캡션 입력 (최대 20자)"
                            maxLength={20}
                            autoFocus
                            style={{
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              color: "#fff",
                              fontSize: "7pt",
                              textAlign: "center",
                              outline: "none",
                              padding: 0,
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                      )}
                      {!(isOutputEditMode && captionOpenIndex === 0) && (
                        <div
                          className="image-caption-overlay"
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            textAlign: "center",
                            padding: "4px 6px",
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                            zIndex: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "24px",
                            height: "24px",
                          }}
                        >
                          <span style={{ color: "#fff", fontSize: "7pt", display: "block" }}>{outputCards[currentOutputIndex].mainImageCaption || ""}</span>
                        </div>
                      )}
                    </div>
                    {isOutputEditMode && (
                      <div className="image-actions-overlay">
                        <button className="image-action-btn" onClick={() => mainImageInputRef.current?.click()}>
                          <i className="ti ti-upload"></i>
                        </button>
                        <button className="image-action-btn" onClick={() => handleOutputChange("mainImage", null)} disabled={!outputCards[currentOutputIndex].mainImage}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    )}
                    {isOutputEditMode && (
                      <button
                        className={`image-action-btn image-caption-btn${captionOpenIndex === 0 ? " active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptionOpenIndex(captionOpenIndex === 0 ? null : 0);
                        }}
                        title="캡션"
                        style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                      >
                        <i className="ti ti-text-caption"></i>
                      </button>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      ref={mainImageInputRef}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOutputChange("mainImage", URL.createObjectURL(file));
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* 하단: (좌) 사용기술+이미지2장 / (우) 정량지표+Report+Insight */}
              <div className="output-bottom-row">
                <div className="output-bottom-left">
                  <div className="output-tools-section" data-field="tools">
                    <div className="output-tools-header">
                      <label>
                        사용 기술/도구
                        {isOutputEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      <div className="selected-tools">
                        {(() => {
                          const sortedSelected = TOOL_OPTIONS.filter((t) => (outputCards[currentOutputIndex].tools || []).includes(t.key));
                          return Array.from({ length: 5 }).map((_, i) => {
                            const tool = sortedSelected[i] || null;
                            return (
                              <span key={i} className={`tool-icon-badge${!tool ? " empty" : ""}`} title={tool?.label || ""}>
                                {tool ? tool.icon ? <img src={tool.icon} alt={tool.label} /> : <span className="tool-placeholder">{tool.label.charAt(0)}</span> : <span className="tool-empty-slot" />}
                              </span>
                            );
                          });
                        })()}
                      </div>
                      {isOutputEditMode && (
                        <button className="tool-dropdown-btn" onClick={(e) => toggleDropdown("tools", e)}>
                          ▽
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="output-sub-images" data-field="subImages">
                    {[0, 1].map((slotIndex) => {
                      const img = (outputCards[currentOutputIndex].subImages || [null, null])[slotIndex];
                      return (
                        <div className="output-sub-image-slot" key={slotIndex}>
                          <div className="image-preview" onClick={() => img && setPreviewImage(img)} style={{ position: "relative" }}>
                            {img ? (
                              <img src={img} alt={`서브 이미지 ${slotIndex + 1}`} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                            ) : (
                              <div className="empty-slot">
                                <i className="ti ti-photo-plus"></i>
                              </div>
                            )}
                            {isOutputEditMode && !img && (
                              <span className="required-mark" style={{ position: "absolute", bottom: "4px", left: "6px" }}>
                                *
                              </span>
                            )}
                            {isOutputEditMode && captionOpenIndex === slotIndex + 1 && (
                              <div
                                className="image-caption-overlay"
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  textAlign: "center",
                                  padding: "4px 6px",
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: "24px",
                                  height: "24px",
                                }}
                              >
                                <input
                                  type="text"
                                  className="image-caption-input"
                                  value={(outputCards[currentOutputIndex].subImageCaptions || ["", ""])[slotIndex] || ""}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 20) {
                                      const newCaptions = [...(outputCards[currentOutputIndex].subImageCaptions || ["", ""])];
                                      newCaptions[slotIndex] = e.target.value;
                                      handleOutputChange("subImageCaptions", newCaptions);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="캡션 입력 (최대 20자)"
                                  maxLength={20}
                                  autoFocus
                                  style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: "7pt",
                                    textAlign: "center",
                                    outline: "none",
                                    padding: 0,
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            )}
                            {!(isOutputEditMode && captionOpenIndex === slotIndex + 1) && (
                              <div
                                className="image-caption-overlay"
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  textAlign: "center",
                                  padding: "4px 6px",
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: "24px",
                                  height: "24px",
                                }}
                              >
                                <span style={{ color: "#fff", fontSize: "7pt", display: "block" }}>{(outputCards[currentOutputIndex].subImageCaptions || ["", ""])[slotIndex] || ""}</span>
                              </div>
                            )}
                          </div>
                          {isOutputEditMode && (
                            <div className="image-actions-overlay">
                              <button className="image-action-btn" onClick={() => subImageInputRefs.current[slotIndex]?.click()}>
                                <i className="ti ti-upload"></i>
                              </button>
                              <button
                                className="image-action-btn"
                                onClick={() => {
                                  const updated = [...(outputCards[currentOutputIndex].subImages || [null, null])];
                                  if (updated[slotIndex]) URL.revokeObjectURL(updated[slotIndex] as string);
                                  updated[slotIndex] = null;
                                  handleOutputChange("subImages", updated);
                                }}
                                disabled={!img}
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          )}
                          {isOutputEditMode && (
                            <button
                              className={`image-action-btn image-caption-btn${captionOpenIndex === slotIndex + 1 ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCaptionOpenIndex(captionOpenIndex === slotIndex + 1 ? null : slotIndex + 1);
                              }}
                              title="캡션"
                              style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                            >
                              <i className="ti ti-text-caption"></i>
                            </button>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => {
                              subImageInputRefs.current[slotIndex] = el;
                            }}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const updated = [...(outputCards[currentOutputIndex].subImages || [null, null])];
                                updated[slotIndex] = URL.createObjectURL(file);
                                handleOutputChange("subImages", updated);
                              }
                              e.target.value = "";
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="output-stats-column">
                  <div className="output-stats-top-row">
                    <div className="output-metrics-section" data-field="metrics">
                      <h5 className="output-section-title">주요 정량 지표</h5>
                      <div className="output-metrics-rows">
                        {[0, 1, 2].map((rowIndex) => {
                          const col1Index = rowIndex * 2;
                          const col2Index = rowIndex * 2 + 1;
                          const metrics = outputCards[currentOutputIndex].metrics || ["", "", "", "", "", ""];
                          const col1Val = metrics[col1Index] || "";
                          const col2Val = metrics[col2Index] || "";
                          return (
                            <div className="output-metric-row" key={rowIndex} style={rowIndex === 0 ? { position: "relative" } : undefined}>
                              <span className="metric-bullet">·</span>
                              {isOutputEditMode && rowIndex === 0 && (
                                <span className="required-mark" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 2 }}>*</span>
                              )}
                              <div className="metric-cell col-1">
                                <input
                                  type="text"
                                  className="output-metric-input"
                                  value={col1Val}
                                  onChange={
                                    isOutputEditMode
                                      ? (e) => {
                                          if (e.target.value.length > 8) return;
                                          const updated = [...metrics];
                                          updated[col1Index] = e.target.value;
                                          handleOutputChange("metrics", updated);
                                        }
                                      : undefined
                                  }
                                  disabled={!isOutputEditMode}
                                  readOnly={!isOutputEditMode}
                                  maxLength={8}
                                  placeholder=""
                                />
                                {isOutputEditMode && <span className="metric-counter">{col1Val.length}/8</span>}
                              </div>
                              <div className="metric-cell col-2">
                                <input
                                  type="text"
                                  className="output-metric-input"
                                  value={col2Val}
                                  onChange={
                                    isOutputEditMode
                                      ? (e) => {
                                          if (e.target.value.length > 10) return;
                                          const updated = [...metrics];
                                          updated[col2Index] = e.target.value;
                                          handleOutputChange("metrics", updated);
                                        }
                                      : undefined
                                  }
                                  disabled={!isOutputEditMode}
                                  readOnly={!isOutputEditMode}
                                  maxLength={10}
                                  placeholder=""
                                />
                                {isOutputEditMode && <span className="metric-counter">{col2Val.length}/10</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="output-report-section" data-field="report" style={{ position: "relative" }}>
                      <h5 className="output-section-title">
                        Output Report
                        {isOutputEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </h5>
                      <textarea
                        value={outputCards[currentOutputIndex].report || ""}
                        onChange={
                          isOutputEditMode
                            ? (e) => {
                                if (e.target.value.length <= 100) handleOutputChange("report", e.target.value);
                              }
                            : undefined
                        }
                        maxLength={100}
                        placeholder={isOutputEditMode ? "이 아웃풋에서 어떤 결과가 나왔는지를 정성적으로 작성 (최대 100자)" : ""}
                        className="output-report-textarea"
                        rows={1}
                        style={{ paddingBottom: "20px" }}
                        disabled={!isOutputEditMode}
                        readOnly={!isOutputEditMode}
                      />
                      {isOutputEditMode && (
                        <span
                          className="char-count"
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "10px",
                            fontSize: "11px",
                            color: "rgba(255,255,255,0.4)",
                            pointerEvents: "none",
                            zIndex: 1,
                          }}
                        >
                          {(outputCards[currentOutputIndex].report || "").length}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="output-insight-section" data-field="insight">
                    <h5 className="output-section-title">
                      Output Insight
                      {isOutputEditMode && (
                        <span className="required-mark" style={{ marginLeft: "2px" }}>
                          *
                        </span>
                      )}
                    </h5>
                    <div style={{ position: "relative" }}>
                      <textarea
                        value={outputCards[currentOutputIndex].insight || ""}
                        onChange={
                          isOutputEditMode
                            ? (e) => {
                                if (e.target.value.length <= 200) handleOutputChange("insight", e.target.value);
                              }
                            : undefined
                        }
                        maxLength={200}
                        placeholder={isOutputEditMode ? "이 아웃풋 결과물을 도출하면서 어떤 것을 배우고, 경험했는지, 그리고 어떤 것을 느꼈는지 등에 대한 인싸이트를 작성 (최대 200자)" : ""}
                        className="output-insight-textarea"
                        rows={2}
                        style={{ paddingBottom: "20px" }}
                        disabled={!isOutputEditMode}
                        readOnly={!isOutputEditMode}
                      />
                      {isOutputEditMode && (
                        <span className="char-count" style={{ position: "absolute", bottom: "8px", right: "10px", fontSize: "11px", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                          {(outputCards[currentOutputIndex].insight || "").length}/200
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="output-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)} style={{ cursor: "pointer" }}>
                  🔎
                </span>
                <div className="modal-footer-nav">
                  <button className="nav-btn prev" onClick={handlePrevOutput} disabled={isOutputEditMode || currentOutputIndex === 0} title={isOutputEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-left"></i>
                  </button>
                  <button className="nav-btn next" onClick={handleNextOutput} disabled={isOutputEditMode || currentOutputIndex >= unlockedOutputCount - 1 || currentOutputIndex >= MAX_OUTPUT_CARDS - 1} title={isOutputEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-right"></i>
                  </button>
                </div>
                <div className="modal-footer-right">
                  {!isOutputEditMode ? (
                    <button
                      className="modal-edit-btn"
                      onClick={async () => {
                        if (!canEditOutput) {
                          await popup.alert("관리자의 허가가 필요합니다.");
                          return;
                        }
                        setIsOutputEditMode(true);
                      }}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelOutput}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetOutput}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveOutput} disabled={isSavingTopCard}>
                        {isSavingTopCard ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom" style={{ visibility: isOutputEditMode ? "visible" : "hidden" }}>
                <p className={`modal-footer-notice ${outputFooterNotice === "error" ? "notice-error" : ""}`}>{outputFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && (
        <div className="output-modal-overlay">
          <div className="modal-scroll-content">
          <div className="output-modal detail-modal-variant">
            <div className="output-modal-header">
              <button className="modal-close-btn" onClick={handleCloseDetailModal}>
                <i className="ti ti-x"></i>
              </button>
              <div className="modal-header-top">
                <img src="/images/0/treasure.png" alt="treasure" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                <h3>Portfolio Output Detail 10 [{currentDetailIndex + 1}]</h3>
              </div>
              <p className="modal-subtitle" style={{ visibility: isDetailEditMode ? "visible" : "hidden" }}>
                본인의 포트폴리오 결과물의 목표 {">"} 과정 {">"} 결과, 그리고 그 안에서 얻은 경험치들을 기업/사회/커리어 측면에서 어필이 될 수 있도록 작성하세요.<span style={{ fontStyle: "normal" }}>😊</span>
              </p>
            </div>
            <div className="output-modal-body">
              <div className="output-upper-section">
                <div className="output-left-column">
                  <div className="output-title-row">
                    <img src="/images/0/portfolio.png" alt="portfolio" className="title-icon" />
                    <span className="output-user-title">
                      <span className="user-name">{displayName || "크루"} 님</span>
                      <span style={{ marginLeft: "4px", fontSize: "23px", fontWeight: 700, color: isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#faab07" }}>의 Output Detail 10 [{currentDetailIndex + 1}]</span>
                    </span>
                    <div className="output-period" data-field="period">
                      <div className="period-wrapper" ref={detailPeriodPickerRef}>
                        <div className="period-display-row">
                          <div className="period-display-left">
                            {isDetailEditMode && <span className="required-mark">*</span>}
                            <span className="period-value period-range-value">{formatPeriodRange(detailCards[currentDetailIndex])}</span>
                          </div>
                          {isDetailEditMode && (
                            <button
                              ref={detailPeriodTriggerRef}
                              className="period-trigger-btn"
                              onClick={() => {
                                const range = getCardDateRange(detailCards[currentDetailIndex]);
                                setDetailDateRange(range);
                                setDetailRangeMonth(getInitialRangeMonth(range));
                                const position = getCalendarPosition(detailPeriodTriggerRef.current);
                                if (position) setDetailCalendarPosition(position);
                                setDetailRangePickerOpen((open) => !open);
                              }}
                            >
                              ▽
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="output-main-title output-field-with-count" data-field="mainTitle">
                    {isDetailEditMode && (
                      <span className="required-mark" style={{ position: "absolute", top: "4px", right: "6px", pointerEvents: "none", zIndex: 2 }}>
                        *
                      </span>
                    )}
                    {isDetailEditMode ? (
                      <input
                        type="text"
                        value={detailCards[currentDetailIndex].mainTitle || ""}
                        onChange={(e) => {
                          if (e.target.value.length <= 30) handleDetailChange("mainTitle", e.target.value);
                        }}
                        maxLength={30}
                        placeholder="메인 제목을 작성하세요 (최대 30자)"
                        className="output-main-title-input"
                      />
                    ) : (
                      <h2 className="output-main-title-text">{detailCards[currentDetailIndex].mainTitle || "-"}</h2>
                    )}
                    {isDetailEditMode && <span className="char-count">{(detailCards[currentDetailIndex].mainTitle || "").length}/30</span>}
                  </div>
                  <div className="output-sub-title output-field-with-count" data-field="subTitle">
                    {isDetailEditMode && (
                      <span className="required-mark" style={{ position: "absolute", top: "4px", right: "1px", pointerEvents: "none", zIndex: 2 }}>
                        *
                      </span>
                    )}
                    {isDetailEditMode ? (
                      <textarea
                        value={detailCards[currentDetailIndex].subTitle || ""}
                        onChange={(e) => {
                          if (e.target.value.length <= 100) handleDetailChange("subTitle", e.target.value);
                        }}
                        maxLength={100}
                        rows={2}
                        placeholder="서브 제목을 작성하세요 (최대 100자, 2줄까지)"
                        className="output-sub-title-input"
                      />
                    ) : (
                      <p className="output-sub-title-text">{detailCards[currentDetailIndex].subTitle || "-"}</p>
                    )}
                    {isDetailEditMode && <span className="char-count">{(detailCards[currentDetailIndex].subTitle || "").length}/100</span>}
                  </div>
                  {/* (3) 기여도 + (4) 플랫폼 */}
                  <div className="output-meta-row">
                    <div className="output-contribution" data-field="contribution">
                      <label>
                        기여도
                        {isDetailEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      <div className="contribution-bar-wrapper">
                        <div className="contribution-bar">
                          <div className="contribution-fill" style={{ width: `${detailCards[currentDetailIndex].contribution || 0}%` }} />
                        </div>
                        {isDetailEditMode ? (
                          <div className="custom-dropdown small contribution-dropdown">
                            <div className="dropdown-selected" onClick={(e) => toggleDropdown("detailContribution", e)}>
                              <span>{detailCards[currentDetailIndex].contribution || 0}%</span>
                              <i className="ti ti-chevron-down"></i>
                            </div>
                          </div>
                        ) : (
                          <span className="contribution-value">{detailCards[currentDetailIndex].contribution || 0}%</span>
                        )}
                      </div>
                    </div>
                    <div className="output-platform" data-field="platform">
                      <label>
                        플랫폼
                        {isDetailEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      {isDetailEditMode ? (
                        <div className="custom-dropdown output-platform-dropdown">
                          <div className="dropdown-selected" onClick={(e) => toggleDropdown("detailPlatform", e)}>
                            {detailCards[currentDetailIndex].platform ? (
                              <>
                                {PLATFORM_ICONS[detailCards[currentDetailIndex].platform] && <img src={PLATFORM_ICONS[detailCards[currentDetailIndex].platform]} alt={detailCards[currentDetailIndex].platform} className="platform-icon" />}
                                <span>{detailCards[currentDetailIndex].platform}</span>
                              </>
                            ) : (
                              <span className="placeholder">선택하세요</span>
                            )}
                            <i className="ti ti-chevron-down"></i>
                          </div>
                        </div>
                      ) : (
                        <span className="field-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {PLATFORM_ICONS[detailCards[currentDetailIndex].platform] && <img src={PLATFORM_ICONS[detailCards[currentDetailIndex].platform]} alt={detailCards[currentDetailIndex].platform} className="platform-icon" style={{ width: "20px", height: "20px" }} />}
                          {detailCards[currentDetailIndex].platform || "-"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 4~5단: 역할+사용기술(좌) / 링크(우) */}
                  <div className="output-role-links-row">
                    <div className="output-role-column">
                      <div className="output-role-section" data-field="role">
                        <div className="output-role-header">
                          <label>
                            역할
                            {isDetailEditMode && (
                              <span className="required-mark" style={{ marginLeft: "2px" }}>
                                *
                              </span>
                            )}
                          </label>
                          <div className="output-role-input-wrap" style={{ position: "relative", flex: 1 }}>
                            {isDetailEditMode ? (
                              <input
                                type="text"
                                value={detailCards[currentDetailIndex].roleDescription || ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= 50) handleDetailChange("roleDescription", e.target.value);
                                }}
                                maxLength={50}
                                placeholder="이 과정에서 어떤 역할을 했는지 작성하세요 (최대 50자)"
                                className="output-role-input"
                                style={{ paddingRight: "55px" }}
                              />
                            ) : (
                              <p className="output-role-text">{detailCards[currentDetailIndex].roleDescription || "-"}</p>
                            )}
                            {isDetailEditMode && (
                              <span className="char-count" style={{ position: "absolute", bottom: "8px", right: "10px", fontSize: "11px", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                                {(detailCards[currentDetailIndex].roleDescription || "").length}/50
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="output-role-tags">
                          {ROLE_OPTIONS.map((role) => {
                            const isActive = (detailCards[currentDetailIndex].roles || []).includes(role.key);
                            return (
                              <button
                                key={role.key}
                                className={`role-tag ${isActive ? "active" : ""}`}
                                style={isActive ? { backgroundColor: role.color, color: "#1a1a1a", borderColor: role.color } : {}}
                                onClick={() => {
                                  if (!isDetailEditMode) return;
                                  const currentRoles = detailCards[currentDetailIndex].roles || [];
                                  if (isActive) {
                                    handleDetailChange(
                                      "roles",
                                      currentRoles.filter((r: string) => r !== role.key),
                                    );
                                  } else {
                                    handleDetailChange("roles", [...currentRoles, role.key]);
                                  }
                                }}
                                disabled={!isDetailEditMode}
                              >
                                {role.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="output-links-section" data-field="links">
                      {[0, 1, 2].map((i) => {
                        const link = (detailCards[currentDetailIndex].links || ["", "", ""])[i];
                        const dotColor = ["#FF6B6B", "#4ECDC4", isPX ? PX_ACCENT : isEC ? EC_ACCENT : "#FAAB07"][i];
                        return (
                          <div className="output-link-row" key={i} style={!isDetailEditMode ? { marginLeft: "9px" } : undefined}>
                            <span className="link-dot" style={{ backgroundColor: dotColor, marginLeft: "auto", ...(i === 0 ? { marginRight: "18px" } : (isDetailEditMode ? { marginRight: "15px" } : {})) }} />
                            {isDetailEditMode && i === 0 && (
                              <span className="required-mark" style={{ marginLeft: "-14px", marginRight: "-4px" }}>
                                *
                              </span>
                            )}
                            {isDetailEditMode ? (
                              <input
                                type="text"
                                value={link}
                                onChange={(e) => {
                                  const updated = [...(detailCards[currentDetailIndex].links || ["", "", ""])];
                                  updated[i] = e.target.value;
                                  handleDetailChange("links", updated);
                                }}
                                placeholder="https://..."
                                className="output-link-input"
                                style={{ maxWidth: "193px" }}
                              />
                            ) : (
                              <span className="output-link-text" style={{ maxWidth: "193px", fontSize: "13px", ...(i === 0 && { marginLeft: "-6px" }) }}>
                                {link ? (link.length > 20 ? link.substring(0, 20) + ".." : link) : "-"}
                              </span>
                            )}
                            <button className="link-open-btn" onClick={() => link && window.open(link, "_blank")} disabled={!link}>
                              <i className="ti ti-external-link"></i>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="output-right-column">
                  {/* (12) 메인 이미지 */}
                  <div className="output-main-image" data-field="mainImage">
                    <div className="image-preview" onClick={() => detailCards[currentDetailIndex].mainImage && setPreviewImage(detailCards[currentDetailIndex].mainImage)} style={{ position: "relative" }}>
                      {detailCards[currentDetailIndex].mainImage ? (
                        <img src={detailCards[currentDetailIndex].mainImage as string} alt="메인 이미지" style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                      ) : (
                        <div className="empty-slot">
                          <i className="ti ti-photo-plus"></i>
                        </div>
                      )}
                      {isDetailEditMode && !detailCards[currentDetailIndex].mainImage && (
                        <span className="required-mark" style={{ position: "absolute", bottom: "4px", left: "6px" }}>
                          *
                        </span>
                      )}
                      {isDetailEditMode && detailCaptionOpenIndex === 0 && (
                        <div
                          className="image-caption-overlay"
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            textAlign: "center",
                            padding: "4px 6px",
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                            zIndex: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "24px",
                            height: "24px",
                          }}
                        >
                          <input
                            type="text"
                            className="image-caption-input"
                            value={detailCards[currentDetailIndex].mainImageCaption || ""}
                            onChange={(e) => {
                              if (e.target.value.length <= 20) handleDetailChange("mainImageCaption", e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="캡션 입력 (최대 20자)"
                            maxLength={20}
                            autoFocus
                            style={{
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              color: "#fff",
                              fontSize: "7pt",
                              textAlign: "center",
                              outline: "none",
                              padding: 0,
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                      )}
                      {!(isDetailEditMode && detailCaptionOpenIndex === 0) && (
                        <div
                          className="image-caption-overlay"
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            textAlign: "center",
                            padding: "4px 6px",
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                            zIndex: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "24px",
                            height: "24px",
                          }}
                        >
                          <span style={{ color: "#fff", fontSize: "7pt", display: "block" }}>{detailCards[currentDetailIndex].mainImageCaption || ""}</span>
                        </div>
                      )}
                    </div>
                    {isDetailEditMode && (
                      <div className="image-actions-overlay">
                        <button className="image-action-btn" onClick={() => detailMainImageInputRef.current?.click()}>
                          <i className="ti ti-upload"></i>
                        </button>
                        <button className="image-action-btn" onClick={() => handleDetailChange("mainImage", null)} disabled={!detailCards[currentDetailIndex].mainImage}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    )}
                    {isDetailEditMode && (
                      <button
                        className={`image-action-btn image-caption-btn${detailCaptionOpenIndex === 0 ? " active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailCaptionOpenIndex(detailCaptionOpenIndex === 0 ? null : 0);
                        }}
                        title="캡션"
                        style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                      >
                        <i className="ti ti-text-caption"></i>
                      </button>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      ref={detailMainImageInputRef}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDetailChange("mainImage", URL.createObjectURL(file));
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* 하단: (좌) 사용기술+이미지2장 / (우) 정량지표+Report+Insight */}
              <div className="output-bottom-row">
                <div className="output-bottom-left">
                  <div className="output-tools-section" data-field="detailTools">
                    <div className="output-tools-header">
                      <label>
                        사용 기술/도구
                        {isDetailEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </label>
                      <div className="selected-tools">
                        {(() => {
                          const sortedSelected = TOOL_OPTIONS.filter((t) => (detailCards[currentDetailIndex].tools || []).includes(t.key));
                          return Array.from({ length: 5 }).map((_, i) => {
                            const tool = sortedSelected[i] || null;
                            return (
                              <span key={i} className={`tool-icon-badge${!tool ? " empty" : ""}`} title={tool?.label || ""}>
                                {tool ? tool.icon ? <img src={tool.icon} alt={tool.label} /> : <span className="tool-placeholder">{tool.label.charAt(0)}</span> : <span className="tool-empty-slot" />}
                              </span>
                            );
                          });
                        })()}
                      </div>
                      {isDetailEditMode && (
                        <button className="tool-dropdown-btn" onClick={(e) => toggleDropdown("detailTools", e)}>
                          ▽
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="output-sub-images" data-field="subImages">
                    {[0, 1].map((slotIndex) => {
                      const img = (detailCards[currentDetailIndex].subImages || [null, null])[slotIndex];
                      return (
                        <div className="output-sub-image-slot" key={slotIndex}>
                          <div className="image-preview" onClick={() => img && setPreviewImage(img)} style={{ position: "relative" }}>
                            {img ? (
                              <img src={img} alt={`서브 이미지 ${slotIndex + 1}`} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                            ) : (
                              <div className="empty-slot">
                                <i className="ti ti-photo-plus"></i>
                              </div>
                            )}
                            {isDetailEditMode && !img && (
                              <span className="required-mark" style={{ position: "absolute", bottom: "4px", left: "6px" }}>
                                *
                              </span>
                            )}
                            {isDetailEditMode && detailCaptionOpenIndex === slotIndex + 1 && (
                              <div
                                className="image-caption-overlay"
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  textAlign: "center",
                                  padding: "4px 6px",
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: "24px",
                                  height: "24px",
                                }}
                              >
                                <input
                                  type="text"
                                  className="image-caption-input"
                                  value={(detailCards[currentDetailIndex].subImageCaptions || ["", ""])[slotIndex] || ""}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 20) {
                                      const newCaptions = [...(detailCards[currentDetailIndex].subImageCaptions || ["", ""])];
                                      newCaptions[slotIndex] = e.target.value;
                                      handleDetailChange("subImageCaptions", newCaptions);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="캡션 입력 (최대 20자)"
                                  maxLength={20}
                                  autoFocus
                                  style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: "7pt",
                                    textAlign: "center",
                                    outline: "none",
                                    padding: 0,
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            )}
                            {!(isDetailEditMode && detailCaptionOpenIndex === slotIndex + 1) && (
                              <div
                                className="image-caption-overlay"
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  textAlign: "center",
                                  padding: "4px 6px",
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  zIndex: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: "24px",
                                  height: "24px",
                                }}
                              >
                                <span style={{ color: "#fff", fontSize: "7pt", display: "block" }}>{(detailCards[currentDetailIndex].subImageCaptions || ["", ""])[slotIndex] || ""}</span>
                              </div>
                            )}
                          </div>
                          {isDetailEditMode && (
                            <div className="image-actions-overlay">
                              <button className="image-action-btn" onClick={() => detailSubImageInputRefs.current[slotIndex]?.click()}>
                                <i className="ti ti-upload"></i>
                              </button>
                              <button
                                className="image-action-btn"
                                onClick={() => {
                                  const updated = [...(detailCards[currentDetailIndex].subImages || [null, null])];
                                  if (updated[slotIndex]) URL.revokeObjectURL(updated[slotIndex] as string);
                                  updated[slotIndex] = null;
                                  handleDetailChange("subImages", updated);
                                }}
                                disabled={!img}
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          )}
                          {isDetailEditMode && (
                            <button
                              className={`image-action-btn image-caption-btn${detailCaptionOpenIndex === slotIndex + 1 ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailCaptionOpenIndex(detailCaptionOpenIndex === slotIndex + 1 ? null : slotIndex + 1);
                              }}
                              title="캡션"
                              style={{ position: "absolute", bottom: "8px", right: "8px", zIndex: 3 }}
                            >
                              <i className="ti ti-text-caption"></i>
                            </button>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => {
                              detailSubImageInputRefs.current[slotIndex] = el;
                            }}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const updated = [...(detailCards[currentDetailIndex].subImages || [null, null])];
                                updated[slotIndex] = URL.createObjectURL(file);
                                handleDetailChange("subImages", updated);
                              }
                              e.target.value = "";
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="output-stats-column">
                  <div className="output-stats-top-row">
                    <div className="output-metrics-section" data-field="metrics">
                      <h5 className="output-section-title">주요 정량 지표</h5>
                      <div className="output-metrics-rows">
                        {[0, 1, 2].map((rowIndex) => {
                          const col1Index = rowIndex * 2;
                          const col2Index = rowIndex * 2 + 1;
                          const metrics = detailCards[currentDetailIndex].metrics || ["", "", "", "", "", ""];
                          const col1Val = metrics[col1Index] || "";
                          const col2Val = metrics[col2Index] || "";
                          return (
                            <div className="output-metric-row" key={rowIndex} style={rowIndex === 0 ? { position: "relative" } : undefined}>
                              <span className="metric-bullet">·</span>
                              {isDetailEditMode && rowIndex === 0 && (
                                <span className="required-mark" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 2 }}>*</span>
                              )}
                              <div className="metric-cell col-1">
                                <input
                                  type="text"
                                  className="output-metric-input"
                                  value={col1Val}
                                  onChange={
                                    isDetailEditMode
                                      ? (e) => {
                                          if (e.target.value.length > 8) return;
                                          const updated = [...metrics];
                                          updated[col1Index] = e.target.value;
                                          handleDetailChange("metrics", updated);
                                        }
                                      : undefined
                                  }
                                  disabled={!isDetailEditMode}
                                  readOnly={!isDetailEditMode}
                                  maxLength={8}
                                  placeholder=""
                                />
                                {isDetailEditMode && <span className="metric-counter">{col1Val.length}/8</span>}
                              </div>
                              <div className="metric-cell col-2">
                                <input
                                  type="text"
                                  className="output-metric-input"
                                  value={col2Val}
                                  onChange={
                                    isDetailEditMode
                                      ? (e) => {
                                          if (e.target.value.length > 10) return;
                                          const updated = [...metrics];
                                          updated[col2Index] = e.target.value;
                                          handleDetailChange("metrics", updated);
                                        }
                                      : undefined
                                  }
                                  disabled={!isDetailEditMode}
                                  readOnly={!isDetailEditMode}
                                  maxLength={10}
                                  placeholder=""
                                />
                                {isDetailEditMode && <span className="metric-counter">{col2Val.length}/10</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="output-report-section" data-field="report" style={{ position: "relative" }}>
                      <h5 className="output-section-title">
                        Output Report
                        {isDetailEditMode && (
                          <span className="required-mark" style={{ marginLeft: "2px" }}>
                            *
                          </span>
                        )}
                      </h5>
                      <textarea
                        value={detailCards[currentDetailIndex].report || ""}
                        onChange={
                          isDetailEditMode
                            ? (e) => {
                                if (e.target.value.length <= 100) handleDetailChange("report", e.target.value);
                              }
                            : undefined
                        }
                        maxLength={100}
                        placeholder={isDetailEditMode ? "이 아웃풋에서 어떤 결과가 나왔는지를 정성적으로 작성 (최대 100자)" : ""}
                        className="output-report-textarea"
                        rows={1}
                        style={{ paddingBottom: "20px" }}
                        disabled={!isDetailEditMode}
                        readOnly={!isDetailEditMode}
                      />
                      {isDetailEditMode && (
                        <span
                          className="char-count"
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "10px",
                            fontSize: "11px",
                            color: "rgba(255,255,255,0.4)",
                            pointerEvents: "none",
                            zIndex: 1,
                          }}
                        >
                          {(detailCards[currentDetailIndex].report || "").length}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="output-insight-section" data-field="insight">
                    <h5 className="output-section-title">
                      Output Insight
                      {isDetailEditMode && (
                        <span className="required-mark" style={{ marginLeft: "2px" }}>
                          *
                        </span>
                      )}
                    </h5>
                    <div style={{ position: "relative" }}>
                      <textarea
                        value={detailCards[currentDetailIndex].insight || ""}
                        onChange={
                          isDetailEditMode
                            ? (e) => {
                                if (e.target.value.length <= 200) handleDetailChange("insight", e.target.value);
                              }
                            : undefined
                        }
                        maxLength={200}
                        placeholder={isDetailEditMode ? "이 아웃풋 결과물을 도출하면서 어떤 것을 배우고, 경험했는지, 그리고 어떤 것을 느꼈는지 등에 대한 인싸이트를 작성 (최대 200자)" : ""}
                        className="output-insight-textarea"
                        rows={2}
                        style={{ paddingBottom: "20px" }}
                        disabled={!isDetailEditMode}
                        readOnly={!isDetailEditMode}
                      />
                      {isDetailEditMode && (
                        <span className="char-count" style={{ position: "absolute", bottom: "8px", right: "10px", fontSize: "11px", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                          {(detailCards[currentDetailIndex].insight || "").length}/200
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="output-modal-footer">
              <div className="modal-footer-top">
                <span className="modal-help-icon" onClick={() => setShowHelpModal(true)} style={{ cursor: "pointer" }}>
                  🔎
                </span>
                <div className="modal-footer-nav">
                  <button className="nav-btn prev" onClick={handlePrevDetail} disabled={isDetailEditMode || currentDetailIndex === 0} title={isDetailEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-left"></i>
                  </button>
                  <button className="nav-btn next" onClick={handleNextDetail} disabled={isDetailEditMode || currentDetailIndex >= unlockedDetailCount - 1 || currentDetailIndex >= MAX_DETAIL_CARDS - 1} title={isDetailEditMode ? "편집 중에는 이동할 수 없습니다" : ""}>
                    <i className="ti ti-chevron-right"></i>
                  </button>
                </div>
                <div className="modal-footer-right">
                  {!isDetailEditMode ? (
                    <button
                      className="modal-edit-btn"
                      onClick={async () => {
                        if (!canEditDetail) {
                          await popup.alert("관리자의 허가가 필요합니다.");
                          return;
                        }
                        setIsDetailEditMode(true);
                      }}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button className="modal-cancel-btn" onClick={handleCancelDetail}>
                        취소
                      </button>
                      <button className="modal-reset-btn" onClick={handleResetDetail}>
                        초기화
                      </button>
                      <button className="modal-save-btn" onClick={handleSaveDetail} disabled={isSavingTopCard}>
                        {isSavingTopCard ? "저장 중..." : "저장"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer-bottom" style={{ visibility: isDetailEditMode ? "visible" : "hidden" }}>
                <p className={`modal-footer-notice ${detailFooterNotice === "error" ? "notice-error" : ""}`}>{detailFooterNotice === "error" ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊" : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Cluster3Content;

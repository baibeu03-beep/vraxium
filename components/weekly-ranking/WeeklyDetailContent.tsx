"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WEEKLY_CARD_DUMMY, type WeeklyCardData, type ChampionCrew, type WeeklyLeagueMvp, type CrewRankShowcase } from "@/constants/dummyData/weekly-card-dummy";
import { isDemoMode } from "@/utils/isDemoMode";
import { getRankingThemeForSeason, getRankingThemeVars } from "@/lib/rankingTheme";
import {
  WeeklyFilterSelect,
  getSelectWidthByLongestLabel,
  type FilterOption,
} from "@/components/weekly-ranking/WeeklyFilterBar";

// ── 기본 이미지(요구사항 SoT) ── DTO 이미지 필드 미설정 시 폴백.
const DEFAULT_HERO_IMAGE = "/images/0/weekly-b.png";
const DEFAULT_REPRESENTATIVE_IMAGE = "/images/0/weekly-b-2.png";

// ── Champion's Hall ── 포인트 아이콘은 조직(org)별로 매칭한다.
//   포인트 A = 성장 활동량 / 포인트 B = 성장 집중력. 탭 아이콘과 카드 내부 아이콘이 동일 매핑 사용.
const GROWTH_RATE_ICON = "/images/0/cluster4/icon/icon - 시즌 성장률.png"; // 주차 성장률(공통)

// 조직별 포인트 아이콘(웹 경로 = public 기준). 경로 대소문자·공백을 정확히 유지.
//   a=활동량(별) · b=집중력(방패) · c=번개/화살(penalty). Cluster4CardContent 헤더 맵과 동일 세트.
const ORG_POINT_ICONS: Record<string, { a: string; b: string; c: string }> = {
  encre: { a: "/images/0/Graphic10.png", b: "/images/0/Shield.png", c: "/images/0/Graphic13.png" },
  oranke: { a: "/images/0/cluster 1/Ok01.png", b: "/images/0/cluster 1/OK02.png", c: "/images/0/cluster 1/Ok03.png" },
  phalanx: { a: "/images/0/cluster 1/PX01.png", b: "/images/0/cluster 1/pX02.png", c: "/images/0/cluster 1/PX03.png" },
};
// 기본값(org 미지정/미매칭) — encre 세트로 폴백.
const DEFAULT_POINT_ICONS = ORG_POINT_ICONS.encre;

// org slug(phalanx·encre·oranke) 또는 한글 클럽명을 정규화(공용 헬퍼).
function normalizeOrgKey(org: string | null): "encre" | "oranke" | "phalanx" | null {
  const key = (org ?? "").trim().toLowerCase();
  if (key === "encre" || key === "엥크레") return "encre";
  if (key === "oranke" || key === "오랑캐") return "oranke";
  if (key === "phalanx" || key === "팔랑크스") return "phalanx";
  return null;
}

// org → 포인트 아이콘 세트(A/B/C). 미매칭 시 encre 폴백.
function resolvePointIcons(org: string | null): { a: string; b: string; c: string } {
  const k = normalizeOrgKey(org);
  return k ? ORG_POINT_ICONS[k] : DEFAULT_POINT_ICONS;
}

// ── [5] Weekly Rank Showcase — 크루 리스트 상수/헬퍼 ──
// 페이지당 크루 수(10개 초과 시 페이지네이션).
const WRS_PER_PAGE = 10;
// 상세 버튼 아이콘(시즌 평판) — 클릭 시 해당 크루의 cluster-4-card weekly 페이지로 이동.
const WRS_DETAIL_ICON = "/images/0/cluster4/icon - 시즌 평판.png";
// 이번 주 결과 아이콘.
const WRS_RESULT_SUCCESS_ICON = "/images/0/cluster4/icon/icon - 성장(성공).png";
const WRS_RESULT_FAIL_ICON = "/images/0/cluster4/icon/icon - 성장(실패).png";
// 강화율 5지표 아이콘(주차 성장률은 GROWTH_RATE_ICON 재사용, 실무 4종은 Sheriff Badge).
const WRS_RATE_ICONS = {
  growth: GROWTH_RATE_ICON,
  info: "/images/0/Sheriff Badge1 3.png",
  experience: "/images/0/Sheriff Badge1.png",
  competency: "/images/0/Sheriff Badge1 2.png",
  career: "/images/0/Sheriff Badge1 4.png",
};

// org → cluster-4-card weekly 라우트 base(테마 라우트). userId 쿼리로 대상 크루 지정.
function resolveCluster4Base(org: string | null): string {
  const k = normalizeOrgKey(org);
  if (k === "encre") return "/cluster-4-card-ec";
  if (k === "phalanx") return "/cluster-4-card-px";
  return "/cluster-4-card";
}

// 순위 → 티어(1=gold · 2~3=silver · 4~6=sky · 7+=base). 전체 등수(rank) 기준.
const rankTier = (rank: number): "gold" | "silver" | "sky" | "base" =>
  rank === 1 ? "gold" : rank <= 3 ? "silver" : rank <= 6 ? "sky" : "base";
// 델타 표기: +N / -N / +0.
const fmtDelta = (d: number) => (d >= 0 ? `+${d}` : `${d}`);
const deltaTone = (d: number) => (d > 0 ? "up" : d < 0 ? "down" : "flat");

type ChampTabKey = "activity" | "focus" | "growth";

// 순위별 Accent Color(카드 전체가 아닌 강조색만 변경) — 무지개(빨→보) 순서 10단계.
const RANK_ACCENTS = [
  "#FF4B4B", // 1 빨강
  "#FF7A2F", // 2 주황
  "#FFB020", // 3 노랑(앰버)
  "#FFE23D", // 4 노랑
  "#7ED957", // 5 연두
  "#2FD07E", // 6 초록
  "#22C3D6", // 7 청록
  "#3D8BFF", // 8 파랑
  "#6C5CE7", // 9 남색
  "#A55CF0", // 10 보라
];
// 이니셜 폴백 아바타용 — 순위 accent 로 틴트.
const initialOf = (name: string) => (name?.trim()?.[0] ?? "?");

// ── [5] 하단 격언(페이지 디자인 상수 — 주차 데이터 아님) ──
const QUOTE_TEXT =
  "어떤 아름다운 것도 언젠가는 쇠퇴하고, 우연이나 자연의 무상한 이치로 모습이 망가지지만, 그러나 그대의 영원한 여름만은 절대로 시들지 않으리";
const QUOTE_AUTHOR = "William Shakespeare";

// ── [6][7] 본문 폴백(예시) ── DTO 값 부재 시 표시하는 샘플/플레이스홀더 카피.
//   DTO(weeklyComment / cluvActivityFlow)가 실제 값을 내려주면 그 값이 우선한다.
const SAMPLE_WEEKLY_COMMENT =
  "태풍 ‘고래’가 우리나라를 강타한 한 주였습니다. 세상이 떠나갈 듯 내리는 이번 한 주에 우리 크루분들은 또 한 주의 성장을 이루어냈을겁니다.\n선의의 경쟁이 치열했던 위클리 리그를 살펴보고, 나의 한 주를 돌아보자구요! 😊";
const SAMPLE_ACTIVITY_FLOW =
  "이번 주 우리 클럽은, 총 5개 팀, 17개 파트가 성장을 위해 굵은 땀방울을 흘렸습니다.\n총 14개의 라인이 오픈되었고, [확장] 주간 중 첫 번째 주간을 진행했어요.\n\n후회 없는 한 주가 되었길 바래요!";

// [4] 활동 여부 라벨 — 공식 휴식이면 휴식, 그 외(정상/심화 진행)는 공식 활동.
const resolveActivity = (card: WeeklyCardData) => {
  const isRest = card.leagueResultStatus === "공식 휴식";
  return { isRest, label: isRest ? "공식 휴식" : "공식 활동" };
};

// ── [5] Weekly Rank Showcase — 필터 옵션(모든 드롭다운에 Void '-' 존재, 기본 선택도 '-') ──
//   ① 주차 진행 / ② 주차 결과는 고정 옵션. ③ 소속 팀은 DTO(card.teams)에서 구성(하드코딩 금지).
const WRS_VOID = "-";
const WRS_PROGRESS_OPTIONS: FilterOption[] = [
  { value: WRS_VOID, label: "-" },
  { value: "challenge", label: "성장 도전" },
  { value: "rest", label: "성장 휴식" },
];
const WRS_RESULT_OPTIONS: FilterOption[] = [
  { value: WRS_VOID, label: "-" },
  { value: "success", label: "성장 성공" },
  { value: "fail", label: "성장 실패" },
];

// 정렬 규칙 — 다음 작업(크루 목록)에서 소비할 키 시퀀스. 이번 회차는 구조만 선반영.
//   · 필터 미적용(기본): 품계 desc → 주차 성장률 desc → 이름 가나다순
//   · 필터 1개 이상 적용: 누적 주차 desc → 주차 성장률 desc → 팀 가나다순 → 파트 가나다순 → 이름 가나다순
const WRS_SORT_KEYS_DEFAULT = ["품계", "주차성장률", "이름"] as const;
const WRS_SORT_KEYS_FILTERED = ["누적주차", "주차성장률", "팀", "파트", "이름"] as const;

interface WeeklyDetailContentProps {
  weekId: string;
  // 조직 slug(phalanx · encre · oranke). 상세 데이터 조회에 필요.
  org: string | null;
}

type LoadState = "loading" | "ready" | "notfound";

export default function WeeklyDetailContent({ weekId, org }: WeeklyDetailContentProps) {
  const [card, setCard] = useState<WeeklyCardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // 대시보드 Progress Bar 진입 애니메이션 트리거(0% → 목표%).
  const [barsIn, setBarsIn] = useState(false);
  // Champion's Hall 활성 탭 — 기본 '성장 활동량 Top 10'.
  const [champTab, setChampTab] = useState<ChampTabKey>("activity");
  // Weekly Rank Showcase 필터 — 3개 드롭다운 모두 Void('-') 기본값. 복합(AND) 조건으로 동작.
  const [wrsProgress, setWrsProgress] = useState<string>(WRS_VOID);
  const [wrsResult, setWrsResult] = useState<string>(WRS_VOID);
  const [wrsTeam, setWrsTeam] = useState<string>(WRS_VOID);
  // Weekly Rank Showcase — 페이지네이션(1-base) + Weekly Review 읽기 전용 모달.
  const [wrsPage, setWrsPage] = useState(1);
  const [reviewModal, setReviewModal] = useState<{ name: string; body: string } | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // 조직별 포인트 아이콘(포인트 A/B) — 탭·카드가 공유하는 단일 소스.
  const pointIcons = useMemo(() => resolvePointIcons(org), [org]);
  const championTabs = useMemo<
    Array<{ key: ChampTabKey; label: string; icon: string; ready: boolean }>
  >(
    () => [
      { key: "activity", label: "성장 활동량 Top 10", icon: pointIcons.a, ready: true },
      { key: "focus", label: "성장 집중력 Top 10", icon: pointIcons.b, ready: true },
      { key: "growth", label: "주차 성장률 Top 10", icon: GROWTH_RATE_ICON, ready: true },
    ],
    [pointIcons],
  );

  // 데이터 로드 — 데모: 더미에서 id 매칭 / 일반: /api/weekly-league?org= 응답에서 id 매칭.
  //   리스트와 동일 DTO(WeeklyCardData)를 그대로 소비(현재 Week DTO 재사용).
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setCard(null);

    const demo = isDemoMode();
    if (demo) {
      const found = WEEKLY_CARD_DUMMY.find((c) => c.id === weekId) ?? null;
      setCard(found);
      setState(found ? "ready" : "notfound");
      return;
    }

    if (!org) {
      setState("notfound");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/weekly-league?org=${encodeURIComponent(org)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        const cards: WeeklyCardData[] = json?.success && Array.isArray(json.cards) ? json.cards : [];
        const found = cards.find((c) => c.id === weekId) ?? null;
        setCard(found);
        setState(found ? "ready" : "notfound");
      } catch {
        if (!cancelled) setState("notfound");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekId, org]);

  // 스크롤 진입 fade-up — data-fadeup 요소가 뷰포트에 들어오면 is-visible 부여.
  //   콘텐츠가 opacity:0 로 영구 숨는 일이 없도록 3중 안전장치:
  //   (1) 마운트 시 이미 뷰포트에 있는 요소 즉시 노출, (2) 나머지는 IO 로 스크롤 시 노출,
  //   (3) IO 미지원/미발화 대비 900ms 후 남은 전부 강제 노출.
  useEffect(() => {
    if (state !== "ready") return;
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-fadeup]"));
    const reveal = (el: Element) => el.classList.add("is-visible");

    // (1) 즉시 노출 — 마운트 시점 뷰포트 안(약간의 여유 포함)에 걸친 요소.
    const vh = window.innerHeight || 0;
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.98) reveal(el);
    });

    // (2) 나머지 — 스크롤 진입 시 노출.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
      );
      items.forEach((el) => {
        if (!el.classList.contains("is-visible")) io!.observe(el);
      });
    }

    // (3) 안전망 — 900ms 후에도 안 보인 요소는 강제 노출(영구 숨김 방지).
    const safety = window.setTimeout(() => items.forEach(reveal), 900);

    return () => {
      io?.disconnect();
      window.clearTimeout(safety);
    };
  }, [state]);

  // Progress Bar 진입 애니메이션 — 카드 준비 후 0% → 목표% 로 전개.
  useEffect(() => {
    if (state !== "ready") {
      setBarsIn(false);
      return;
    }
    const t = window.setTimeout(() => setBarsIn(true), 260);
    return () => window.clearTimeout(t);
  }, [state]);

  // [5] 필터 변경 시 페이지를 1로 초기화(목록·페이지네이션 함께 갱신).
  useEffect(() => {
    setWrsPage(1);
  }, [wrsProgress, wrsResult, wrsTeam]);

  // [5] Weekly Review 모달 — ESC 닫기 + 배경 스크롤 잠금.
  useEffect(() => {
    if (!reviewModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewModal(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [reviewModal]);

  // 조직 + 주차 시즌 → 테마 변수(--wr-*). 카드 부재 시에도 org 브랜드색으로 폴백.
  const themeVars = useMemo(
    () => getRankingThemeVars(getRankingThemeForSeason(org, card?.seasonName)),
    [org, card?.seasonName],
  );

  const backHref = org ? `/weekly-ranking?org=${encodeURIComponent(org)}` : "/weekly-ranking";

  // ── 로딩 / 미발견 상태 ──
  if (state === "loading") {
    return (
      <section className="weekly-detail-page weekly-detail-page--status" style={themeVars}>
        <div className="wd-status" role="status" aria-live="polite">
          <span className="wd-status__spinner" aria-hidden="true" />
          <p>주차 정보를 불러오는 중입니다…</p>
        </div>
      </section>
    );
  }

  if (state === "notfound" || !card) {
    return (
      <section className="weekly-detail-page weekly-detail-page--status" style={themeVars}>
        <div className="wd-status">
          <p className="wd-status__title">해당 주차 정보를 찾을 수 없습니다.</p>
          <Link href={backHref} className="wd-back-btn">
            <i className="ti ti-arrow-left" aria-hidden="true" /> 목록으로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  const heroImage = card.heroImage || DEFAULT_HERO_IMAGE;
  const representativeImage = card.representativeImage || DEFAULT_REPRESENTATIVE_IMAGE;
  const weeklyComment = card.weeklyComment || SAMPLE_WEEKLY_COMMENT;
  const activityFlow = card.cluvActivityFlow || SAMPLE_ACTIVITY_FLOW;
  const { isRest, label: activityLabel } = resolveActivity(card);

  // ── [2] 대시보드 값 ── 원자 DTO 필드에서 파생 계산해 화면 등식을 항상 보장한다:
  //   ① 소속크루 = ② 시즌휴식 + ③ 개인휴식 + ④ 성장도전,  ④ = ⑤ 성장성공 + ⑥ 성장실패
  //   도전율 = ④/①·100,  성공률 = ⑤/④·100. (DTO totalCrews/growthChallenge 대신 재계산 → 불일치 방지)
  const successCount = card.growthSuccess ?? 0;
  const failCount = card.growthFail ?? 0;
  const challengeCount = successCount + failCount;
  const personalRest = card.personalRest ?? 0;
  const seasonRest = card.seasonRest ?? 0;
  const totalCrew = seasonRest + personalRest + challengeCount;
  const challengeRate = totalCrew > 0 ? Math.round((challengeCount / totalCrew) * 100) : 0;
  const successRate = challengeCount > 0 ? Math.round((successCount / challengeCount) * 100) : 0;

  // KPI 카드(라벨/아이콘은 UI 카피, 값은 위 파생값). 3행×2열 배치 순서 = 스펙 ①~⑥.
  //   보조 설명(desc)은 노출하지 않는다 — 아이콘/label/value 핵심 정보만.
  const kpis: Array<{ tone: string; icon: string; label: string; value: number }> = [
    { tone: "accent", icon: "ti ti-users", label: "소속 크루", value: totalCrew },
    { tone: "gray", icon: "ti ti-zzz", label: "시즌 휴식", value: seasonRest },
    { tone: "gray", icon: "ti ti-bed", label: "개인 휴식", value: personalRest },
    { tone: "blue", icon: "ti ti-flame", label: "성장 도전", value: challengeCount },
    { tone: "green", icon: "ti ti-trophy", label: "성장 성공", value: successCount },
    { tone: "red", icon: "ti ti-circle-x", label: "성장 실패", value: failCount },
  ];
  // 공식(formula)은 화면 비노출 — 값은 위에서 계산 완료. 카드에는 제목/퍼센트/바만 표시.
  const progresses: Array<{ tone: string; label: string; value: number }> = [
    { tone: "blue", label: "성장 도전율", value: challengeRate },
    { tone: "green", label: "성장 성공률", value: successRate },
  ];

  // Champion's Hall — DTO(card.top10 / card.top10Focus)에서 수신(하드코딩 없음).
  const activeTab = championTabs.find((t) => t.key === champTab) ?? championTabs[0];
  // 탭별 표시 데이터: 리스트 / 포인트 아이콘 / 값 getter / 단위. 카드 컴포넌트는 완전 공용.
  const champTabData: Record<
    ChampTabKey,
    { list: ChampionCrew[]; pointIcon: string; pointOf: (c: ChampionCrew) => number; unit: string }
  > = {
    activity: { list: Array.isArray(card.top10) ? card.top10 : [], pointIcon: pointIcons.a, pointOf: (c) => c.pointA, unit: "개" },
    focus: { list: Array.isArray(card.top10Focus) ? card.top10Focus : [], pointIcon: pointIcons.b, pointOf: (c) => c.pointB, unit: "개" },
    growth: { list: Array.isArray(card.top10Growth) ? card.top10Growth : [], pointIcon: GROWTH_RATE_ICON, pointOf: (c) => c.growthRate, unit: "%" },
  };
  const activeChamp = champTabData[champTab];

  // Top10 비었을 때 상태별 fallback 문구.
  //   · 공식 휴식 주차            → 랭킹 미제공
  //   · 점수 미확정(대전 중/집계/공표, 검수 완료 아님) → 주차 종료 후 공개
  //   · 완료(검수 완료)인데 데이터 없음 → 표시할 크루 없음
  const isRestWeek = card.leagueResultStatus === "공식 휴식" || card.leagueRecordStatus === "대전 휴식";
  const isFinalizedWeek = card.leagueRecordStatus === "검수 완료";
  const champEmptyMessage = isRestWeek
    ? "공식 휴식 주차에는 랭킹이 제공되지 않습니다."
    : !isFinalizedWeek
      ? "이번 주 랭킹은 주차 종료 후 공개됩니다."
      : "표시할 크루가 없습니다.";

  // ── [9] Team Battle — 팀별 주차 결과(집계 DTO). 미설정/휴식 주차면 섹션 숨김.
  //   teamGoal/weeklyFlow/crewComment 는 입력 기능 전이라 대부분 null → 해당 줄만 생략(오류 없음).
  //   ⚠️ 팀별 수치(승률·전적·크루 구성)는 전부 DTO 원값을 그대로 표시한다(프론트 재계산 금지).
  //   아래 요약(팀 수/파트 수/통합 전적)만 teams[] 의 단순 집계다(표시용 카운트, 비즈니스 로직 아님).
  const teams = Array.isArray(card.teams) ? card.teams : [];
  const teamCount = teams.length;

  // ── [5] Weekly Rank Showcase 필터 ──
  //   소속 팀 옵션 = DTO(card.teams)의 팀명(유니크·가나다순) + Void('-'). 하드코딩 없음.
  const wrsTeamOptions: FilterOption[] = [
    { value: WRS_VOID, label: "-" },
    ...Array.from(new Set(teams.map((t) => t.teamName).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "ko"))
      .map((name) => ({ value: name, label: `${name} 팀` })),
  ];
  const wrsProgressWidth = getSelectWidthByLongestLabel(WRS_PROGRESS_OPTIONS, 132);
  const wrsResultWidth = getSelectWidthByLongestLabel(WRS_RESULT_OPTIONS, 132);
  const wrsTeamWidth = getSelectWidthByLongestLabel(wrsTeamOptions, 150);
  const resetWrsFilters = () => {
    setWrsProgress(WRS_VOID);
    setWrsResult(WRS_VOID);
    setWrsTeam(WRS_VOID);
  };
  // 필터가 하나 이상 적용되었는지 → 정렬 규칙 전환.
  const wrsHasActiveFilter =
    wrsProgress !== WRS_VOID || wrsResult !== WRS_VOID || wrsTeam !== WRS_VOID;
  const wrsSortKeys = wrsHasActiveFilter ? WRS_SORT_KEYS_FILTERED : WRS_SORT_KEYS_DEFAULT;

  // ── [5] 크루 목록: 필터(AND) → 정렬 → 페이지네이션 ──
  const crewAll: CrewRankShowcase[] = Array.isArray(card.crewRankShowcase) ? card.crewRankShowcase : [];
  const crewFiltered = crewAll.filter((c) => {
    if (wrsProgress !== WRS_VOID && c.weeklyProgress !== wrsProgress) return false; // 성장 도전/휴식
    if (wrsResult !== WRS_VOID && c.weeklyResult !== wrsResult) return false;       // 성장 성공/실패
    if (wrsTeam !== WRS_VOID && c.teamName !== wrsTeam) return false;               // 소속 팀
    return true;
  });
  // 정렬: 기본(품계↑·주차성장률↓·이름) / 필터 적용(누적성공주차↓·주차성장률↓·팀·파트·이름).
  const crewSorted = [...crewFiltered].sort((a, b) => {
    if (wrsHasActiveFilter) {
      return (
        b.cumulativeSuccessWeeks - a.cumulativeSuccessWeeks ||
        b.weeklyGrowthRate - a.weeklyGrowthRate ||
        (a.teamName ?? "").localeCompare(b.teamName ?? "", "ko") ||
        (a.partName ?? "").localeCompare(b.partName ?? "", "ko") ||
        a.name.localeCompare(b.name, "ko")
      );
    }
    return (
      a.gradeLevel - b.gradeLevel ||
      b.weeklyGrowthRate - a.weeklyGrowthRate ||
      a.name.localeCompare(b.name, "ko")
    );
  });
  const crewPageCount = Math.max(1, Math.ceil(crewSorted.length / WRS_PER_PAGE));
  const crewPageSafe = Math.min(Math.max(1, wrsPage), crewPageCount);
  const crewPageItems = crewSorted.slice((crewPageSafe - 1) * WRS_PER_PAGE, crewPageSafe * WRS_PER_PAGE);
  const cluster4Base = resolveCluster4Base(org);
  const crewDetailHref = (c: CrewRankShowcase) =>
    `${cluster4Base}/${encodeURIComponent(c.weekId)}?userId=${encodeURIComponent(c.userId)}${
      org ? `&org=${encodeURIComponent(org)}` : ""
    }`;

  // ── Weekly League MVP(팀 에이스) — 팀명 가나다순 고정 정렬(SoT: 렌더 시점 정렬).
  //   선정 크루가 바뀌어도 카드 위치는 팀명으로 결정 → 매주 동일 위치 유지.
  const mvps = (Array.isArray(card.weeklyLeagueMvp) ? [...card.weeklyLeagueMvp] : []).sort(
    (a, b) => a.teamName.localeCompare(b.teamName, "ko"),
  );
  const partTotal = teams.reduce((s, t) => s + t.partCount, 0);
  const battleWins = teams.filter((t) => t.battleResult === "win").length;
  const battleLoses = teams.filter((t) => t.battleResult === "lose").length;
  const battleDraws = teams.filter((t) => t.battleResult === "draw").length;
  const battleRecordText = `${battleWins}승 ${battleLoses}패${battleDraws ? ` ${battleDraws}무` : ""}`;
  const BATTLE_LABEL: Record<string, string> = { win: "WIN", lose: "LOSE", draw: "DRAW" };
  // 승률 원형 게이지 SVG 기하(반지름/둘레).
  const GAUGE_R = 30;
  const GAUGE_C = 2 * Math.PI * GAUGE_R;

  return (
    <section className="weekly-detail-page" style={themeVars} ref={rootRef}>
      <Link href={backHref} className="wd-back-link">
        <i className="ti ti-arrow-left" aria-hidden="true" /> Weekly League
      </Link>

      {/* [1] Hero — 헤드 이미지 + 제목 */}
      <header className="wd-hero" data-fadeup>
        <div className="wd-hero__bg" style={{ backgroundImage: `url("${heroImage}")` }} aria-hidden="true" />
        <div className="wd-hero__overlay" aria-hidden="true" />
        <div className="wd-hero__inner">
          <span className="wd-hero__eyebrow">Championship</span>
          <h1 className="wd-hero__title">CREW WEEKLY LEAGUE</h1>
        </div>
      </header>

      <div className="wd-divider" aria-hidden="true" />

      <div className="wd-grid">
        {/* 좌측 — [5] 대표 이미지 카드 + 격언 */}
        <div className="wd-col wd-col--left">
          <figure className="wd-repr" data-fadeup>
            <div className="wd-repr__imgwrap">
              <img className="wd-repr__img" src={representativeImage} alt={`${card.seasonName} 대표 이미지`} />
              <div className="wd-repr__scrim" aria-hidden="true" />
              {/* [2][3][4] 오버레이 — 대표 이미지 위 상단 배치 */}
              <div className="wd-repr__overlays">
                <div className="wd-repr__meta">
                  <h2 className="wd-chip wd-chip--season">{card.seasonName}</h2>
                  <p className="wd-chip wd-chip--date">{card.dateRangeText}</p>
                </div>
                <span className={`wd-activity ${isRest ? "wd-activity--rest" : "wd-activity--active"}`}>
                  <i className={isRest ? "ti ti-bed" : "ti ti-flame"} aria-hidden="true" />
                  {activityLabel}
                </span>
              </div>

              {/* [5] 격언 — 대표 이미지 하단에 Glass 오버레이로 겹침(이미지와 동일 폭) */}
              <blockquote className="wd-quote" data-fadeup>
                <span className="wd-quote__mark" aria-hidden="true">
                  &ldquo;
                </span>
                <p className="wd-quote__text">{QUOTE_TEXT}</p>
                <footer className="wd-quote__author">
                  <span className="wd-quote__author-emoji" aria-hidden="true">
                    👨‍🎨
                  </span>
                  {QUOTE_AUTHOR}
                </footer>
              </blockquote>
            </div>
          </figure>
        </div>

        {/* 우측 — [6] Weekly Comment / [7] Cluv Activity Flow */}
        <div className="wd-col wd-col--right">
          <article className="wd-glass" data-fadeup>
            <h2 className="wd-glass__title">
              <span className="wd-glass__mark" aria-hidden="true" />
              Weekly Comment
            </h2>
            <p className="wd-glass__body">{weeklyComment}</p>
          </article>

          <article className="wd-glass" data-fadeup>
            <h2 className="wd-glass__title">
              <span className="wd-glass__mark" aria-hidden="true" />
              Cluv Activity Flow
            </h2>
            <p className="wd-glass__body">{activityFlow}</p>
          </article>
        </div>
      </div>

      {/* [8] 이번 주 크루 종합 결과 Dashboard — wd-grid 아래 배치. 좌 KPI(55%) / 우 Progress(45%) */}
      <section className="wd-dash" data-fadeup aria-label="이번 주 크루 종합 결과">
        <div className="wd-dash__head">
          <h2 className="wd-dash__title">
            <span className="wd-dash__mark" aria-hidden="true" />
            이번 주 크루 종합 결과
          </h2>
          <p className="wd-dash__caption">{card.seasonName} · 이번 주 클럽 전체 활동 현황</p>
        </div>

        <div className="wd-dash__body">
          {/* 좌측 — KPI 3×2 (아이콘 | label/value) */}
          <div className="wd-dash__kpis">
            {kpis.map((k) => (
              <div key={k.label} className={`wd-kpi wd-kpi--${k.tone}`}>
                <span className="wd-kpi__icon" aria-hidden="true">
                  <i className={k.icon} />
                </span>
                <div className="wd-kpi__content">
                  <span className="wd-kpi__label">{k.label}</span>
                  <strong className="wd-kpi__value">
                    {k.value.toLocaleString()}
                    <span className="wd-kpi__unit">명</span>
                  </strong>
                </div>
              </div>
            ))}
          </div>

          {/* 우측 — Progress 2개 */}
          <div className="wd-dash__progress">
            {progresses.map((p) => (
              <div key={p.label} className={`wd-prog wd-prog--${p.tone}`}>
                <div className="wd-prog__head">
                  <span className="wd-prog__label">{p.label}</span>
                  <span className="wd-prog__value">
                    {p.value}
                    <span className="wd-prog__unit">%</span>
                  </span>
                </div>
                <div
                  className="wd-prog__track"
                  role="progressbar"
                  aria-valuenow={p.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={p.label}
                >
                  <div className="wd-prog__fill" style={{ width: barsIn ? `${p.value}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* [3] Champion's Hall — 우수 크루 Top 10 (탭 전환) */}
      <section className="wd-champ" data-fadeup aria-label="Champion's Hall">
        {/* [0] 헤드 — 명예의 전당 타이틀(장식 라인·글로우) */}
        <header className="wd-champ__head">
          <span className="wd-champ__deco" aria-hidden="true" />
          <h2 className="wd-champ__title">
            Champion&rsquo;s Hall
            <span className="wd-champ__title-glow" aria-hidden="true">Champion&rsquo;s Hall</span>
          </h2>
          <span className="wd-champ__deco" aria-hidden="true" />
        </header>

        <div className="wd-champ__card">
          {/* [2] Tabs — 포인트 아이콘 + 라벨 */}
          <div className="wd-champ__tabs" role="tablist">
            {championTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={champTab === t.key}
                className={`wd-champ__tab${champTab === t.key ? " is-active" : ""}`}
                onClick={() => setChampTab(t.key)}
              >
                <img className="wd-champ__tab-icon" src={t.icon} alt="" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* 탭 내용 — key 로 재마운트해 fade/slide 전환 */}
          <div className="wd-champ__panel" key={champTab}>
            {activeTab.ready && activeChamp.list.length > 0 ? (
              <div className="wd-champ__grid">
                {activeChamp.list.map((c) => {
                  const accent = RANK_ACCENTS[(c.rank - 1) % RANK_ACCENTS.length];
                  return (
                    <div
                      key={c.rank}
                      className="wd-champ-card"
                      style={{ ["--card-accent" as string]: accent }}
                    >
                      <span className="wd-champ-card__rank">TOP {c.rank}</span>

                      <div className="wd-champ-card__head">
                        <span className="wd-champ-card__avatar">
                          {c.profileImage ? (
                            <img src={c.profileImage} alt="" />
                          ) : (
                            <span className="wd-champ-card__avatar-ph">{initialOf(c.name)}</span>
                          )}
                        </span>
                        <span className="wd-champ-card__id">
                          <span className="wd-champ-card__name">{c.name}</span>
                          {c.className ? <span className="wd-champ-card__class">{c.className}</span> : null}
                        </span>
                      </div>

                      <div className="wd-champ-card__meta">
                        {(c.school || c.major) && (
                          <span className="wd-champ-card__meta-row">
                            {c.school ? <span className="wd-champ-card__tag">{c.school}</span> : null}
                            {c.major ? <span className="wd-champ-card__tag">{c.major}</span> : null}
                          </span>
                        )}
                        {(c.team || c.part) && (
                          <span className="wd-champ-card__meta-row">
                            {c.team ? <span className="wd-champ-card__tag">{c.team} 팀</span> : null}
                            {c.part ? <span className="wd-champ-card__tag">{c.part} 파트</span> : null}
                          </span>
                        )}
                      </div>

                      <div className="wd-champ-card__point">
                        <img className="wd-champ-card__point-icon" src={activeChamp.pointIcon} alt="" aria-hidden="true" />
                        <strong className="wd-champ-card__point-value">{activeChamp.pointOf(c).toLocaleString()}</strong>
                        <span className="wd-champ-card__point-unit">{activeChamp.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="wd-champ__empty">
                {activeTab.ready ? champEmptyMessage : "곧 공개됩니다."}
              </div>
            )}
          </div>
        </div>

        {/* Weekly League MVP — Champion's Hall '내부' 하위 섹션(Sub Section Title). 독립 섹션 아님.
            휴식/무팀 주차는 숨김. 위계: Champion's Hall(h2) > Weekly League MVP(h3). */}
        {!isRestWeek && mvps.length > 0 && (
          <div className="wd-mvp" data-fadeup aria-labelledby="wd-mvp-title">
            {/* 소제목 — Champion's Hall 보다 한 단계 작은 h3(장식·글로우·디바이더 최소화) */}
            <div className="wd-mvp__subhead">
              <span className="wd-mvp__mark" aria-hidden="true" />
              <h3 className="wd-mvp__title" id="wd-mvp-title">
                Weekly League MVP
                <span className="wd-mvp__subtitle">(팀 에이스)</span>
              </h3>
            </div>

            {/* 카드 Grid — Desktop 3열 / Tablet 2열 / Mobile 1열. 팀 증가 시 아래로 자동 확장 */}
            <div className="wd-mvp__grid">
            {mvps.map((m: WeeklyLeagueMvp) => (
              <article key={m.teamId ?? m.teamName} className="wd-mvp-card">
                <div className="wd-mvp-card__body">
                  {/* 좌측 — ① 프로필 / ② 크루명 / ③ 클래스 */}
                  <div className="wd-mvp-card__profile">
                    <span className="wd-mvp-card__avatar">
                      {m.profileImage ? (
                        <img src={m.profileImage} alt="" />
                      ) : (
                        <span className="wd-mvp-card__avatar-ph">{initialOf(m.name)}</span>
                      )}
                    </span>
                    <div className="wd-mvp-card__id">
                      <span className="wd-mvp-card__name">{m.name}</span>
                      {m.className ? <span className="wd-mvp-card__class">{m.className}</span> : null}
                    </div>
                  </div>

                  {/* 우측 — ⑧ 팀 아이콘 → ⑨ 팀명 → ⑩ ACE (하나의 묶음) */}
                  <div className="wd-mvp-card__ace">
                    <span className="wd-mvp-card__team-icon" aria-hidden="true">
                      {m.teamIcon ? <img src={m.teamIcon} alt="" /> : <i className="ti ti-crown" />}
                    </span>
                    <span className="wd-mvp-card__team-name">{m.teamName} 팀</span>
                    <span className="wd-mvp-card__ace-label">ACE</span>
                  </div>
                </div>

                {/* ④ 학교 / ⑤ 전공 / ⑥ 팀 / ⑦ 파트 */}
                <div className="wd-mvp-card__meta">
                  {(m.school || m.major) && (
                    <span className="wd-mvp-card__meta-row">
                      {m.school ? <span className="wd-mvp-card__tag">{m.school}</span> : null}
                      {m.major ? <span className="wd-mvp-card__tag">{m.major}</span> : null}
                    </span>
                  )}
                  <span className="wd-mvp-card__meta-row">
                    <span className="wd-mvp-card__tag">{m.teamName} 팀</span>
                    {m.part ? <span className="wd-mvp-card__tag">{m.part} 파트</span> : null}
                  </span>
                </div>

                {/* ⑪ Team Leader Comment — 넓은 영역(3~4줄 기본, 최대 100자 대부분 노출) */}
                <div className="wd-mvp-card__comment">
                  <span className="wd-mvp-card__comment-label">
                    <i className="ti ti-quote" aria-hidden="true" /> Team Leader Comment
                  </span>
                  <p className="wd-mvp-card__comment-body">
                    {m.leaderComment && m.leaderComment.trim()
                      ? m.leaderComment
                      : "아직 팀장 코멘트가 등록되지 않았습니다."}
                  </p>
                </div>
              </article>
            ))}
            </div>
          </div>
        )}
      </section>

      {/* [9] Team Battle — 팀별 주차 결과(Champion's Hall 아래). 휴식/무팀 주차는 섹션 숨김 */}
      {!isRestWeek && teams.length > 0 && (
        <section className="wd-tb" data-fadeup aria-label="Team Battle">
          {/* 장식 헤더 — Champion's Hall 과 동일 위계(데코 라인 + 글로우 타이틀) */}
          <header className="wd-tb__head">
            <span className="wd-tb__deco" aria-hidden="true" />
            <h2 className="wd-tb__title">
              Team Battle
              <span className="wd-tb__title-glow" aria-hidden="true">Team Battle</span>
            </h2>
            <span className="wd-tb__deco" aria-hidden="true" />
          </header>
          <p className="wd-tb__subtitle">{card.seasonName} · 팀별 이번 주 성장 대전 결과</p>

          {/* 요약 KPI — 팀 수 / 파트 수 / 통합 전적 (Dashboard: 아이콘 + Label + Value) */}
          <div className="wd-tb__summary">
            <div className="wd-tb-kpi wd-tb-kpi--accent">
              <span className="wd-tb-kpi__icon" aria-hidden="true"><i className="ti ti-users-group" /></span>
              <div className="wd-tb-kpi__content">
                <span className="wd-tb-kpi__label">참전 팀</span>
                <strong className="wd-tb-kpi__value">{teamCount}<span className="wd-tb-kpi__unit">팀</span></strong>
              </div>
            </div>
            <div className="wd-tb-kpi wd-tb-kpi--blue">
              <span className="wd-tb-kpi__icon" aria-hidden="true"><i className="ti ti-layout-grid" /></span>
              <div className="wd-tb-kpi__content">
                <span className="wd-tb-kpi__label">전체 파트</span>
                <strong className="wd-tb-kpi__value">{partTotal}<span className="wd-tb-kpi__unit">파트</span></strong>
              </div>
            </div>
            <div className="wd-tb-kpi wd-tb-kpi--accent">
              <span className="wd-tb-kpi__icon" aria-hidden="true"><i className="ti ti-swords" /></span>
              <div className="wd-tb-kpi__content">
                <span className="wd-tb-kpi__label">통합 전적</span>
                <strong className="wd-tb-kpi__value wd-tb-kpi__value--record">{battleRecordText}</strong>
              </div>
            </div>
          </div>

          {/* 팀 카드 Grid — Desktop 3열 / Tablet 2열 / Mobile 1열.
              모든 섹션을 항상 렌더(값 없으면 '-'/placeholder) → 카드마다 내부 y좌표 동일. */}
          <div className="wd-tb__grid">
            {teams.map((t) => {
              // 파트명/파트 수 — 기본 노이즈 파트('일반') 제외. 수·명을 같은 집합으로 산출(불일치 방지).
              const partNames = t.parts
                .map((p) => p.partName)
                .filter((n) => n && n.trim() && n.trim() !== "일반");
              const partShownCount = partNames.length;
              const partNameText = partNames.length > 0 ? partNames.join(", ") : "-";

              // 대전 결과 마크(승/패/무). 승만 왕관, 그 외는 아이콘 자리(placeholder) 확보.
              const resultMark = t.battleResult === "win" ? "승" : t.battleResult === "lose" ? "패" : "무";

              // Crew Stat — 소속 크루(좌측 대형) + 6종(우측 3열×2행). '성장 도전' → '도전 크루'.
              const crewGrid = [
                { label: "도전 크루", value: t.challengeCrew, tone: "blue" },
                { label: "심화 크루", value: t.advancedCrew, tone: "accent" },
                { label: "성장 성공", value: t.successCrew, tone: "green" },
                { label: "휴식 크루", value: t.restCrew, tone: "gray" },
                { label: "정규 크루", value: t.regularCrew, tone: "gray" },
                { label: "성장 실패", value: t.failCrew, tone: "red" },
              ];

              // Team Goal / Team Flow / Crew Comment — 값 없어도 항상 노출(placeholder). DTO 연결 시 값만 주입.
              const goalRaw = t.teamGoal && t.teamGoal.trim() ? t.teamGoal.trim() : "";
              const flowRaw = t.weeklyFlow && t.weeklyFlow.trim() ? t.weeklyFlow.trim() : "";
              const commentRaw = t.crewComment && t.crewComment.trim() ? t.crewComment.trim() : "";
              const goalText = goalRaw || "등록된 팀 목표가 없습니다.";
              const flowText = flowRaw || "등록된 주차 플로우가 없습니다.";
              const commentText = commentRaw || "등록된 크루 코멘트가 없습니다.";

              return (
                <article key={t.teamId ?? t.teamName} className="wd-tb-card" data-result={t.battleResult}>
                  {/* 헤더 — 팀 아바타 + 팀명 + 대전 결과 뱃지 */}
                  <div className="wd-tb-card__head">
                    <span className="wd-tb-card__avatar" aria-hidden="true">
                      {t.leader.profileImageUrl ? (
                        <img src={t.leader.profileImageUrl} alt="" />
                      ) : (
                        <span className="wd-tb-card__avatar-ph">{t.teamName?.trim()?.[0] ?? "?"}</span>
                      )}
                    </span>
                    <div className="wd-tb-card__id">
                      <strong className="wd-tb-card__name">{t.teamName} 팀</strong>
                      <span className="wd-tb-card__subhead">이번 주 성장 대전</span>
                    </div>
                    <span className="wd-tb-card__badge">{BATTLE_LABEL[t.battleResult] ?? "DRAW"}</span>
                  </div>

                  {/* 팀장 프로필 — 팀장명/학교/학과를 항상 렌더(미지정도 '-') → 카드 높이 통일 */}
                  <div className="wd-tb-card__leader">
                    <span className="wd-tb-card__leader-row">
                      <span className="wd-tb-card__leader-key">
                        <i className="ti ti-user-star" aria-hidden="true" /> 팀장
                      </span>
                      <span className="wd-tb-card__leader-name">{t.leader.name?.trim() || "-"}</span>
                    </span>
                    <span className="wd-tb-card__leader-tags">
                      <span className="wd-tb-card__tag">
                        <i className="ti ti-school" aria-hidden="true" /> {t.leader.school?.trim() || "-"}
                      </span>
                      <span className="wd-tb-card__tag">
                        <i className="ti ti-book-2" aria-hidden="true" /> {t.leader.major?.trim() || "-"}
                      </span>
                    </span>
                  </div>

                  {/* 파트 정보 — 파트 수 + 파트명(항상 노출) */}
                  <div className="wd-tb-card__partinfo">
                    <span className="wd-tb-card__partinfo-count">
                      <i className="ti ti-layout-grid" aria-hidden="true" /> 파트 <b>{partShownCount}</b>개
                    </span>
                    <span className="wd-tb-card__partinfo-names" title={partNameText}>{partNameText}</span>
                  </div>

                  {/* Team Goal — 값 없으면 placeholder(구조 유지, DTO 연결 시 값만 주입) */}
                  <div className="wd-tb-card__block">
                    <span className="wd-tb-card__block-label">
                      <i className="ti ti-target-arrow" aria-hidden="true" /> Team Goal
                    </span>
                    <p className={`wd-tb-card__block-body${goalRaw ? "" : " is-empty"}`} title={goalText}>
                      {goalText}
                    </p>
                  </div>

                  {/* Team Flow */}
                  <div className="wd-tb-card__block">
                    <span className="wd-tb-card__block-label">
                      <i className="ti ti-route" aria-hidden="true" /> Team Flow
                    </span>
                    <p className={`wd-tb-card__block-body${flowRaw ? "" : " is-empty"}`} title={flowText}>
                      {flowText}
                    </p>
                  </div>

                  {/* Battle — [승/패] [전적] [승률 게이지] */}
                  <div className="wd-tb-card__battle">
                    <div className="wd-tb-card__result" aria-label={`대전 결과 ${resultMark}`}>
                      <span className="wd-tb-card__result-mark">{resultMark}</span>
                      <span className="wd-tb-card__result-icon" aria-hidden="true">
                        {t.battleResult === "win" ? <img src="/images/0/crown.png" alt="" /> : null}
                      </span>
                    </div>
                    <div className="wd-tb-card__record">
                      {[
                        { k: "전", v: t.matchCount, tone: "gray" },
                        { k: "승", v: t.winCount, tone: "green" },
                        { k: "패", v: t.loseCount, tone: "red" },
                      ].map((m) => (
                        <div key={m.k} className={`wd-tb-card__record-item wd-tb-card__record-item--${m.tone}`}>
                          <strong className="wd-tb-card__record-value">{m.v}</strong>
                          <span className="wd-tb-card__record-label">{m.k}</span>
                        </div>
                      ))}
                    </div>
                    <div className="wd-tb-card__gauge" role="img" aria-label={`승률 ${t.winRate}%`}>
                      <svg viewBox="0 0 72 72">
                        <circle className="wd-tb-card__gauge-track" cx="36" cy="36" r={GAUGE_R} />
                        <circle
                          className="wd-tb-card__gauge-fill"
                          cx="36"
                          cy="36"
                          r={GAUGE_R}
                          strokeDasharray={GAUGE_C}
                          strokeDashoffset={barsIn ? GAUGE_C * (1 - t.winRate / 100) : GAUGE_C}
                        />
                      </svg>
                      <div className="wd-tb-card__gauge-label">
                        <strong>{t.winRate}<span>%</span></strong>
                        <span>승률</span>
                      </div>
                    </div>
                  </div>

                  {/* Crew Stat — [소속 크루 대형] + [3열×2행] */}
                  <div className="wd-tb-card__crew">
                    <div className="wd-tb-card__crew-total">
                      <span className="wd-tb-card__crew-total-label">
                        <i className="ti ti-users" aria-hidden="true" /> 소속 크루
                      </span>
                      <strong className="wd-tb-card__crew-total-value">{t.totalCrew}</strong>
                    </div>
                    <div className="wd-tb-card__crew-grid">
                      {crewGrid.map((s) => (
                        <div key={s.label} className={`wd-tb-stat wd-tb-stat--${s.tone}`}>
                          <strong className="wd-tb-stat__value">{s.value}</strong>
                          <span className="wd-tb-stat__label">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Crew Comment — 항상 노출(placeholder) */}
                  <div className="wd-tb-card__block wd-tb-card__block--comment">
                    <span className="wd-tb-card__block-label">
                      <i className="ti ti-message-2" aria-hidden="true" /> Crew Comment
                    </span>
                    <p className={`wd-tb-card__block-body${commentRaw ? "" : " is-empty"}`} title={commentText}>
                      {commentText}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* [5] Weekly Rank Showcase — 크루 개별 활동 결과(Team Battle 아래 메인 섹션).
          Header → Filter Bar → 페이지네이션(리스트 위) → 크루 랭킹 리스트(1열). */}
      <section
        className="wd-wrs"
        data-fadeup
        aria-label="Weekly Rank Showcase"
        data-sort-rule={wrsSortKeys.join(" > ")}
      >
        {/* 장식 헤더 — Champion's Hall · Team Battle 과 동일 메인 위계(데코 라인 + 글로우 타이틀) */}
        <header className="wd-wrs__head">
          <span className="wd-wrs__deco" aria-hidden="true" />
          <h2 className="wd-wrs__title">
            Weekly Rank Showcase
            <span className="wd-wrs__title-glow" aria-hidden="true">Weekly Rank Showcase</span>
          </h2>
          <span className="wd-wrs__deco" aria-hidden="true" />
        </header>
        <p className="wd-wrs__subtitle">{card.seasonName} · 이번 주 크루 개별 활동 결과</p>

        {/* Filter Bar — Premium Glass Card. Desktop 한 줄 / Mobile 줄바꿈.
            드롭다운은 기존 nice-select(.tournaments cascade) 재사용, 모든 옵션에 Void('-') 존재. */}
        <div className="wd-wrs__filter tournaments">
          <div className="wd-wrs__filter-row">
            <div className="wd-wrs__field">
              <span className="wd-wrs__field-label">
                <span className="wd-wrs__dot" aria-hidden="true">●</span> 주차 진행
              </span>
              <WeeklyFilterSelect
                options={WRS_PROGRESS_OPTIONS}
                value={wrsProgress}
                onChange={setWrsProgress}
                width={wrsProgressWidth}
              />
            </div>

            <div className="wd-wrs__field">
              <span className="wd-wrs__field-label">
                <span className="wd-wrs__dot" aria-hidden="true">●</span> 주차 결과
              </span>
              <WeeklyFilterSelect
                options={WRS_RESULT_OPTIONS}
                value={wrsResult}
                onChange={setWrsResult}
                width={wrsResultWidth}
              />
            </div>

            <div className="wd-wrs__field">
              <span className="wd-wrs__field-label">
                <span className="wd-wrs__dot" aria-hidden="true">●</span> 소속 팀
              </span>
              <WeeklyFilterSelect
                options={wrsTeamOptions}
                value={wrsTeam}
                onChange={setWrsTeam}
                width={wrsTeamWidth}
              />
            </div>

            <button type="button" className="wd-wrs__reset" onClick={resetWrsFilters}>
              <i className="ti ti-refresh" aria-hidden="true" /> 초기화
            </button>
          </div>
        </div>

        {/* 페이지네이션 — 리스트 '위쪽'. 10개 초과 시에만 노출 */}
        {crewPageCount > 1 && (
          <nav className="wd-wrs__pager" aria-label="크루 목록 페이지">
            {Array.from({ length: crewPageCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`wd-wrs__page${p === crewPageSafe ? " is-active" : ""}`}
                aria-current={p === crewPageSafe ? "page" : undefined}
                onClick={() => setWrsPage(p)}
              >
                {p}
              </button>
            ))}
          </nav>
        )}

        {/* 크루 랭킹 리스트 — 1열(위→아래 순위). PC 가로형 / 모바일 세로형 */}
        <div className="wd-wrs__list">
          {crewPageItems.length === 0 ? (
            <div className="wd-wrs__empty">조건에 맞는 크루가 없습니다.</div>
          ) : (
            crewPageItems.map((c) => {
              const tier = rankTier(c.rank);
              const points = [
                { key: "A", icon: pointIcons.a, value: c.pointA },
                { key: "B", icon: pointIcons.b, value: c.pointB },
                { key: "C", icon: pointIcons.c, value: c.pointC },
              ];
              const rates = [
                { key: "growth", icon: WRS_RATE_ICONS.growth, label: "주차 성장률", value: c.weeklyGrowthRate, delta: c.weeklyGrowthRateDelta },
                { key: "info", icon: WRS_RATE_ICONS.info, label: "실무 정보 강화율", value: c.infoRate, delta: c.infoRateDelta },
                { key: "exp", icon: WRS_RATE_ICONS.experience, label: "실무 경험 강화율", value: c.experienceRate, delta: c.experienceRateDelta },
                { key: "comp", icon: WRS_RATE_ICONS.competency, label: "실무 역량 강화율", value: c.competencyRate, delta: c.competencyRateDelta },
                { key: "career", icon: WRS_RATE_ICONS.career, label: "실무 경력 강화율", value: c.careerRate, delta: c.careerRateDelta },
              ];
              const result =
                c.weeklyProgress === "rest"
                  ? { cls: "rest", label: "성장 휴식", icon: null }
                  : c.weeklyResult === "success"
                    ? { cls: "success", label: "성장 성공", icon: WRS_RESULT_SUCCESS_ICON }
                    : { cls: "fail", label: "성장 실패", icon: WRS_RESULT_FAIL_ICON };
              const reviewText = c.weeklyReview && c.weeklyReview.trim() ? c.weeklyReview.trim() : "";
              return (
                <article key={c.userId} className="wd-crew" data-tier={tier}>
                  {/* 상단 좌측 — 상세 · 등수 · 프로필 · 학교/전공/팀/파트 (한 행) */}
                  <div className="wd-crew__info">
                    <Link href={crewDetailHref(c)} className="wd-crew__detail" aria-label={`${c.name} 크루 상세 보기`}>
                      <img src={WRS_DETAIL_ICON} alt="" aria-hidden="true" />
                    </Link>
                    <div className="wd-crew__rank">
                      <span className="wd-crew__rank-total">총 {c.totalRankCount.toLocaleString()}명 중</span>
                      <strong className="wd-crew__rank-num">{c.rank}등</strong>
                    </div>
                    <div className="wd-crew__profile">
                      <span className="wd-crew__avatar">
                        {c.profileImage ? (
                          <img src={c.profileImage} alt="" />
                        ) : (
                          <span className="wd-crew__avatar-ph">{initialOf(c.name)}</span>
                        )}
                      </span>
                      <div className="wd-crew__id">
                        <span className="wd-crew__name">
                          {c.name} <em>크루</em>
                        </span>
                        {c.className ? <span className="wd-crew__class">{c.className}</span> : null}
                      </div>
                    </div>
                    <div className="wd-crew__meta">
                      <span className="wd-crew__meta-row">
                        <span className="wd-crew__tag">{c.school ?? "-"}</span>
                        <span className="wd-crew__tag">{c.major ?? "-"}</span>
                      </span>
                      <span className="wd-crew__meta-row">
                        <span className="wd-crew__tag">{c.teamName ? `${c.teamName} 팀` : "-"}</span>
                        <span className="wd-crew__tag">{c.partName ? `${c.partName} 파트` : "-"}</span>
                      </span>
                    </div>
                  </div>

                  {/* 상단 우측 — 포인트 A/B/C · 누적 성공 주차 · 이번 주 결과 (한 행) */}
                  <div className="wd-crew__stats">
                    <div className="wd-crew__points">
                      {points.map((p) => (
                        <div key={p.key} className="wd-crew__point">
                          <img className="wd-crew__point-icon" src={p.icon} alt="" aria-hidden="true" />
                          <strong className="wd-crew__point-value">{p.value.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="wd-crew__weeks">
                      <img className="wd-crew__weeks-icon" src={WRS_RESULT_SUCCESS_ICON} alt="" aria-hidden="true" />
                      <strong className="wd-crew__weeks-value">
                        {c.cumulativeSuccessWeeks}
                        <span>주</span>
                      </strong>
                      <span className={`wd-crew__weeks-delta wd-crew__delta--${c.weeklySuccessDelta > 0 ? "up" : "flat"}`}>
                        (+{c.weeklySuccessDelta})
                      </span>
                    </div>
                    <div className={`wd-crew__result wd-crew__result--${result.cls}`}>
                      {result.icon ? (
                        <img src={result.icon} alt="" aria-hidden="true" />
                      ) : (
                        <i className="ti ti-bed" aria-hidden="true" />
                      )}
                      <span>{result.label}</span>
                    </div>
                  </div>

                  {/* 하단 좌측 — 강화율 5지표 */}
                  <div className="wd-crew__rates">
                    {rates.map((r) => (
                      <div key={r.key} className="wd-crew__rate">
                        <img className="wd-crew__rate-icon" src={r.icon} alt="" aria-hidden="true" />
                        <div className="wd-crew__rate-body">
                          <span className="wd-crew__rate-value">
                            {r.value}
                            <span className="wd-crew__rate-unit">%</span>
                            <em className={`wd-crew__delta--${deltaTone(r.delta)}`}>({fmtDelta(r.delta)})</em>
                          </span>
                          <span className="wd-crew__rate-label">{r.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 하단 우측 — Weekly Review */}
                  <div className="wd-crew__review">
                    <div className="wd-crew__review-head">
                      <span className="wd-crew__review-label">
                        <i className="ti ti-clipboard-text" aria-hidden="true" /> Weekly Review
                      </span>
                      <button
                        type="button"
                        className="wd-crew__review-view"
                        aria-label={`${c.name} 크루 위클리 리뷰 전체 보기`}
                        disabled={!reviewText}
                        onClick={() => reviewText && setReviewModal({ name: c.name, body: reviewText })}
                      >
                        <i className="ti ti-eye" aria-hidden="true" />
                      </button>
                    </div>
                    <p className={`wd-crew__review-body${reviewText ? "" : " is-empty"}`}>
                      {reviewText || "작성된 위클리 리뷰가 없습니다."}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* [5] Weekly Review 읽기 전용 모달 — X 닫기만(작성/수정 없음) */}
      {reviewModal && (
        <div
          className="wd-review-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${reviewModal.name} 위클리 리뷰`}
          onClick={() => setReviewModal(null)}
        >
          <div className="wd-review-modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="wd-review-modal__head">
              <h3 className="wd-review-modal__title">{reviewModal.name} · Weekly Review</h3>
              <button
                type="button"
                className="wd-review-modal__close"
                aria-label="닫기"
                onClick={() => setReviewModal(null)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <p className="wd-review-modal__body">{reviewModal.body}</p>
          </div>
        </div>
      )}
    </section>
  );
}

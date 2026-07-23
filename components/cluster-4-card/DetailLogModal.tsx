"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { getThemeClass } from "@/lib/cluster-route";
import { formatLineDuration } from "@/lib/lineDuration";
// 주차 성장 성공 기준 표기 = 위클리 리그 두 화면과 공유하는 단일 SoT(포맷 + 조직별 명칭·아이콘).
import {
  POINT_A_CRITERION_UNIT,
  POINT_A_CRITERION_EMPTY_LABEL,
  normalizePointACriterion,
} from "@/lib/pointACriterionLabel";
import { resolveGrowthStandardPoint, growthStandardLabel } from "@/lib/orgPointMeta";
// 액트 요약 산식 = 관리자 "액트 체크 내역" 탭과 공유하는 단일 SoT(두 repo 미러링).
import {
  buildCrewActSummary,
  emptyCrewActSummary,
  resolveCrewActResult,
  type CrewActCheckResult,
} from "@/shared/crewActSummary";
// 표 정렬 규칙 = 관리자 주차 상세와 공유하는 단일 SoT(두 repo byte-identical 미러링).
import {
  ariaSortValue,
  cycleSort,
  sortActRows,
  sortLineRows,
  type ActSortKey,
  type ActSortRow,
  type ActSortState,
  type LineSortKey,
  type LineSortRow,
  type LineSortState,
  type SortDirection,
} from "@/shared/detailLogSort";
import type {
  CrewLinePointPairDto,
  CrewWeekLineEnhancementDetailDto,
  CrewWeekLineEnhancementRowDto,
} from "@/shared/cluster4.contracts";

/** 성장 결과 1줄(체크박스) — 충족/미충족 */
export interface DetailLogCondition {
  checked: boolean;
  text: string;
}

/** 포인트 카드 1개 (조직별 명칭 — 별/단감/투구 …, 미상 시 Po.A/B/C) */
export interface DetailLogPoint {
  label: string;
  icon: string;
  value: number;
}

/**
 * 액트 내역(actLogs) 1행 — 백엔드 snapshot DTO v30(card.actLogs)을 표시용으로 가공한 값.
 * 1차 범위 = "수행/적립된 액트 내역"만(미스/미수행 row 없음). 호출부(Cluster4CardContent)가
 * 단일 출처로 가공해 주입한다(본 컴포넌트는 순수 표시 — 임의 row 생성/대상자 재판정 금지).
 */
export interface DetailLogActRow {
  /** 결과 — 1차는 항상 "checked". (후속 Phase 에서 "miss" 추가 대비) */
  result: "checked" | "miss";
  actName: string;
  /** 발생 시점(=체크 신청 시점) 포맷 문자열, 없으면 "-" */
  occurredText: string;
  /** 소속 허브 급 — "실무 정보/경험/역량/경력" 또는 "-"(변동·비귀속) */
  hubLabel: string;
  /** 소속 라인 급 — line group name 또는 "-" */
  lineLabel: string;
  /** 소요 시간 — "30m" 또는 "-"(변동/미상) */
  durationText: string;
  /** Po.A(별/단감/투구 …) 적립값 */
  pointA: number;
  /** Po.B(방패/인절미 …) 적립값 */
  pointB: number;
  /** Po.C(번개/어흥/화살 …) 패널티 magnitude(양수) — 표시는 음수 */
  pointC: number;
  /**
   * (선택) 획득 가능했던 최대 Po.A/B/C — 요약 "획득 / 가능" 비율의 분모용.
   * 서버 DTO 가 제공하면 그대로, 없으면 획득값(pointA/B/C)으로 폴백(획득=가능).
   * 별도 조회/DOM 재추산 없이 이 값(=표시 중인 행)만 합산한다.
   */
  availableA?: number;
  availableB?: number;
  availableC?: number;
  /** 구분 — 정규/변동 */
  source: "regular" | "irregular";
  /** 종류 — 필수/선별(정규) · 전원/부분(변동) */
  kindLabel: string;
  /** 종류 배지 색상 구분 키 */
  kindKey: "required" | "selective" | "all" | "partial" | "unknown";
  // ── 정렬용 원본값(표시 문자열이 아니라 원본으로 정렬 — 화면 문자열 재파싱 금지) ──
  /** 결정적 정렬 tie-breaker(행 안정키). 호출부가 award/index 파생으로 채운다. */
  stableKey: string;
  /** 발생 시점 원본 ISO(occurredText 의 원천). 없으면 null → 정렬 시 최하단 */
  occurredAt: string | null;
  /** 소속 허브 원시 코드(hubLabel 의 원천: info/experience/… 또는 null) — 공식순서 정렬용 */
  hubToken: string | null;
  /** 소요 시간(분) 원본값(durationText 의 원천). 없으면 null → 최하단 */
  durationMinutes: number | null;
}

/**
 * Detail Log 모달이 표시할 데이터 묶음.
 * 모든 값은 호출부(Cluster4CardContent)에서 단일 출처로 계산해 주입한다.
 * (본 컴포넌트는 순수 표시 — 데이터 fetch/가공을 하지 않는다.)
 */
export interface DetailLogData {
  /** "2026년, 여름 시즌, 1주차" */
  seasonWeekTitle: string;
  /** "2026.06.29(월) ~ 2026.07.05(일)" */
  periodText: string;
  /**
   * 주차 성장 성공 기준 개수(표시 전용) — 그 주차·그 조직에 귀속된 값.
   * 호출부가 weekly-cards DTO(card.pointACriterion)에서 그대로 넘긴다.
   * 미확정(설정 없음·org 미상·조회 실패) = null → "-" 표시(0개로 오인 금지).
   */
  pointACriterion?: number | null;
  /**
   * 조직 slug(encre·oranke·phalanx) — 기준 문구의 포인트 명칭·아이콘 해석용.
   * 위클리 리그 두 화면과 같은 lib/orgPointMeta 를 타므로 세 화면 표기가 일치한다.
   * 미지정/미매칭이면 공용 폴백 세트(임의의 "A" 문자 대체 금지).
   */
  org?: string | null;
  crew: {
    name: string;
    team: string;
    part: string;
    level: string;
  };
  /** 성장 결과 텍스트 ("성장 성공" 등) */
  statusText: string;
  /** status-badge 톤 클래스 (success/fail/rest-personal/…) — 기존 토큰 재사용 */
  statusClass: string;
  /** 누적 성공 주차 수 */
  cumulativeWeeks: number;
  /** 결과 메시지(Alert 본문) */
  resultMessage: string;
  /** 포인트 카드 3개 */
  points: DetailLogPoint[];
  /** 성장 성공 조건 체크 */
  conditions: DetailLogCondition[];
  /** 이번 주 도움말 */
  weeklyHelp: string;
  /** 액트 내역(수행/적립) 행 — 없으면 빈 배열(→ empty state) */
  acts: DetailLogActRow[];
  /** Po.A/B/C 컬럼 헤더 조직별 명칭([별,방패,번개] 등). 조직 미상 시 [Po.A,Po.B,Po.C] */
  actPointNames: [string, string, string];
}

/** Detail Log 좌측 탭 — 액트 체크 내역 / 라인 강화 내역 */
export type DetailLogTabKey = "act" | "line";

/**
 * "라인 강화 내역" 탭 데이터 상태 — 호출부(Cluster4CardContent)가 lazy 조회해 주입한다.
 * (본 컴포넌트는 순수 표시 — fetch 하지 않는다. 탭 최초 진입 시 onLineTabOpen 으로 알리기만 한다.)
 *   idle    = 아직 조회 전(탭 미진입)
 *   loading = 조회 중 → skeleton
 *   error   = 조회 실패 → 메시지 + 재시도
 *   ready   = 백엔드 DTO 그대로 표시(값 재계산 금지)
 */
export type DetailLogLineEnhancementState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CrewWeekLineEnhancementDetailDto };

interface DetailLogModalProps {
  show: boolean;
  onHide: () => void;
  data: DetailLogData | null;
  /** 라인 강화 내역 상태(미지정 시 idle 취급 — 탭은 표시되나 진입 시 조회 요청) */
  lineEnhancement?: DetailLogLineEnhancementState | null;
  /** 라인 탭 최초 진입 알림 — 호출부가 캐시 확인 후 필요할 때만 조회한다(탭 전환마다 재요청 금지) */
  onLineTabOpen?: () => void;
  /** 라인 탭 조회 실패 시 재시도 */
  onLineRetry?: () => void;
  /**
   * Phase A — portal root 에 직접 부착될 theme scope class.
   * 미지정 시 usePathname() 으로 자동 추론.
   * createPortal 이 document.body 직속이라 descendant theme selector 가
   * 닿지 않으므로 overlay 에 직접 부착해 SCSS(var(--org-accent))가 매칭되게 한다.
   */
  themeClassName?: string;
}

/** status-badge 톤 → Alert 톤 (positive/warn/neutral) */
const alertToneFromStatus = (statusClass: string): "positive" | "warn" | "neutral" => {
  if (statusClass.includes("success")) return "positive";
  if (statusClass.includes("fail")) return "warn";
  return "neutral";
};

/** +53개 / -3개 / 0개 — '개' 단위 포함 */
const formatPointValue = (v: number): string => (v > 0 ? `+${v}개` : `${v}개`);

/**
 * 크루 이름 표시 전용 — 마스킹 결과 뒤에 '님'을 부착한다(순수 표시, 데이터/DTO 불변).
 * 이미 '님'으로 끝나면 중복 부착하지 않는다. 빈 값/"-" 은 그대로 반환.
 */
const formatCrewNameHonorific = (name: string): string => {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === "-") return trimmed;
  return /님$/.test(trimmed) ? trimmed : `${trimmed} 님`;
};

/** 액트 내역 획득 포인트(A/B) — +n / +0. 0 이하는 미적용(회색). */
const formatGainPoint = (v: number): string => (v > 0 ? `+${v}` : "+0");
/** 액트 내역 패널티 포인트(C) — 양수 magnitude 를 그대로(부호없음) 빨강 표기. 0 은 미적용(회색). */
const formatPenaltyPoint = (v: number): string => (v !== 0 ? `${Math.abs(v)}` : "0");

/**
 * 포인트 값 색상 — 포인트 종류(A/B/C) 기준 단일 출처. 조직 무관(if org 분기 금지).
 *  - A/B(index 0·1) = 연두(#9dfa07), C(index 2, 패널티) = 빨강(#ff6b6b).
 * 포인트 카드(dl-point-value)와 요약 인덱스(dl-act-stat--point 값)가 동일하게 재사용한다.
 */
const pointValueColor = (index: number): string => (index === 2 ? "#ff6b6b" : "#9dfa07");

/**
 * 액트 내역 요약 통계 — **공통 SoT `shared/crewActSummary`** 로 이관(2026-07-17).
 *   기존 로컬 buildActSummary/EMPTY_ACT_SUMMARY 는 관리자 "액트 체크 내역" 탭과 산식이 갈라질 수 있어
 *   두 repo 가 미러링하는 shared 모듈로 옮겼다. 산식·불변식·부호 규칙은 **바이트 동일**(이관만).
 *   ⚠ 여기서 다시 계산하지 말 것 — 표시 중인 acts 를 그대로 buildCrewActSummary 에 넘긴다.
 *   (DetailLogActRow 는 CrewActSummaryRow 의 상위집합이라 그대로 전달 가능.)
 */
const buildActSummary = (acts: DetailLogActRow[]) => buildCrewActSummary(acts);

/**
 * 크루 액트 결과 → 행 배지 표시(라벨·톤 클래스). **판정은 공통 resolveCrewActResult** 가 하고
 * 여기서는 표시만 매핑한다 — 프론트가 포인트를 보고 라벨을 따로 추정하지 않는다(요구).
 *   success → "✓ 체크"(초록, --checked) · fail → "✕ 미스"(빨강, --miss) · pending → "· 대기"(중립)
 * ⚠ 배지와 요약(체크 성공/실패)이 **같은 함수**를 타므로 "결과 ✓ 체크 + Point.C 12" 같은 모순이 불가능하다.
 */
const crewActResultBadge = (
  result: CrewActCheckResult,
): { label: string; toneClass: string } => {
  if (result === "fail") return { label: "✕ 미스", toneClass: "dl-act-result--miss" };
  if (result === "pending") return { label: "· 대기", toneClass: "dl-act-result--pending" };
  return { label: "✓ 체크", toneClass: "dl-act-result--checked" };
};

/** null-data 시 요약 기본값(타입 안정용 — 실제 렌더는 data 존재 분기에서만) */
const EMPTY_ACT_SUMMARY = emptyCrewActSummary();

/**
 * 평점 표시 — 0 과 null 을 혼동하지 않는다.
 *   number(0 포함) → 그대로. null/undefined(값 없음) → "-".
 */
const formatLineRating = (v: number | null | undefined): string =>
  typeof v === "number" ? String(v) : "-";

/** 포인트 축 — 색을 결정하는 유일한 입력(A/B=초록, C=빨강). */
export type LinePointKind = "a" | "b" | "c";

/**
 * 숫자 쌍 표기 SoT — Detail Log 팝업의 **모든** "A/B" 표기는 이 구분자만 쓴다.
 *   형식 = `숫자 + 공백 + / + 공백 + 숫자` (예: "0 / 2", "12 / 18").
 *   ⚠ 호출부에서 "/" 를 직접 쓰지 말 것 — "0/2", "0 /2" 처럼 갈라지는 원인이다.
 */
export const RATIO_SEPARATOR = " / ";
/** 획득/가능 등 숫자 쌍 표시 문자열 — 구분자는 RATIO_SEPARATOR 단일 출처. */
export const formatRatio = (a: number, b: number): string => `${a}${RATIO_SEPARATOR}${b}`;

/**
 * 행/요약 공통 "획득 / 가능" 렌더 — 라인 탭의 표 3열(A/B/C)과 상단 요약 3카드가 **전부 이것만** 쓴다.
 *
 *   색 규칙 — **구분자를 포함한 쌍 전체**를 축 색으로 칠한다. 획득/가능은 색으로 구분하지 않는다:
 *     · A → "0 / 2" 전체 초록   · B → 전체 초록   · C → 전체 빨강
 *     · [2026-07-23] "/" 만 기본 색으로 남기던 규칙(2026-07-17) 폐기 — 액트 탭 요약 칩은
 *       "0 / 0" 전체가 축 색이라 같은 모달 안에서 라인 탭만 다른 폰트처럼 보이던 원인이었다.
 *       폰트(14px·800·tabular-nums)는 양쪽 다 .dl-act-stat-value 상속이라 원래 동일하다.
 *   값이 0 인지와 무관하다(0 / 0 도 같은 색). 색 정의는 SCSS(.dl-point-pair--*) 한 곳뿐이다.
 *
 *   ⚠ 축(kind)만이 색의 입력이다 — org·mode(일반/mode=test/actAsTestUserId/demoUserId)·값 크기에
 *     따른 분기가 없다. 6개 표시 지점이 같은 컴포넌트를 타므로 규칙이 갈라질 수 없다(컬럼별 스타일 금지).
 *   · 획득이 0이어도 "0 / N" 을 그대로 표시한다(0 이라고 숨기지 않음 — 요구 §2).
 */
const LinePointPair: React.FC<{ pair: CrewLinePointPairDto; kind: LinePointKind }> = ({
  pair,
  kind,
}) => (
  <span className={`dl-point-pair dl-point-pair--${kind}`}>
    <span className="dl-point-earned">{pair.earned}</span>
    <span className="dl-point-sep">{RATIO_SEPARATOR}</span>
    <span className="dl-point-available">{pair.available}</span>
  </span>
);

/** 주차 성장 조건 배지 문구 — 실무 경험만 필수(백엔드 growthRequirement SoT). */
const growthRequirementLabel = (r: "required" | "optional"): string =>
  r === "required" ? "필수" : "자율";

/** 탭 순서(좌우 방향키 이동 기준) */
const TAB_ORDER: DetailLogTabKey[] = ["act", "line"];

/** 탭 라벨 — 패널 내부 제목을 제거했으므로 이 문구가 각 패널의 **유일한 제목**이다. */
const TAB_LABEL: Record<DetailLogTabKey, string> = {
  act: "액트 체크 내역",
  line: "라인 강화 내역",
};

// 액트 행 → 공통 정렬 정규화 행(ActSortRow). 표시 문자열이 아니라 원본값으로 정렬한다.
//   결과 정렬은 화면 배지 라벨(공통 resolveCrewActResult 판정) 기준 — 배지와 정렬 기준이 일치.
const toActSortRow = (a: DetailLogActRow): ActSortRow => ({
  stableKey: a.stableKey,
  result: crewActResultBadge(resolveCrewActResult(a)).label,
  name: a.actName,
  occurredAt: a.occurredAt,
  hubToken: a.hubToken,
  line: a.lineLabel,
  duration: a.durationMinutes,
  pointA: a.pointA,
  pointB: a.pointB,
  pointC: a.pointC,
  source: a.source === "regular" ? "정규" : "변동",
  kind: a.kindLabel,
});

// 라인 행 → 공통 정렬 정규화 행(LineSortRow). 허브는 원시 hub(practical_*) 로 공식순서 정렬.
const toLineSortRow = (row: CrewWeekLineEnhancementRowDto): LineSortRow => ({
  stableKey: row.stableKey,
  result: row.resultLabel,
  name: row.lineName,
  hubToken: row.hub,
  kind: row.kind ?? "",
  duration: row.estimatedDurationMinutes,
  rating: row.rating,
  pointA: row.pointA.earned,
  pointB: row.pointB.earned,
  pointC: row.pointC.earned,
  growthRequirement: growthRequirementLabel(row.growthRequirement),
  clubOpen: true, // 크루 표는 클럽 오픈 라인만 실린다 — 컬럼 없음(정렬 대상 아님).
});

// 정렬 가능한 헤더 셀 — 크루 Detail Log 표 공용. 어드민 SortableTh 와 동일 UX 규칙.
//   접근성: th[aria-sort] + 실제 <button>(키보드 Enter/Space) + 상태를 담은 aria-label.
//   아이콘(▲/▼/↕)은 aria-hidden — 의미는 aria-label 로 전달한다. 표 CSS 를 건드리지 않도록
//   버튼은 인라인 스타일로 헤더 텍스트 서식을 상속(색/폰트=inherit, 배경/테두리 제거)한다.
const SortTh: React.FC<{
  label: React.ReactNode;
  labelText: string;
  dir: SortDirection | null;
  onSort: () => void;
  className?: string;
}> = ({ label, labelText, dir, onSort, className }) => {
  const next =
    dir === "asc"
      ? "오름차순 정렬됨. 누르면 내림차순."
      : dir === "desc"
        ? "내림차순 정렬됨. 누르면 기본 정렬로."
        : "정렬 안 됨. 누르면 오름차순.";
  return (
    <th className={className} aria-sort={ariaSortValue(dir)}>
      <button
        type="button"
        className="dl-sort-th"
        onClick={onSort}
        aria-label={`${labelText} 기준 정렬 — ${next}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          whiteSpace: "nowrap", // 문구+아이콘을 한 줄로(요구 §7) — 아이콘이 다음 줄로 내려가지 않게.
          background: "none",
          border: 0,
          padding: 0,
          margin: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <span>{label}</span>
        <span aria-hidden="true" style={{ opacity: dir ? 1 : 0.4, fontSize: "0.75em" }}>
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
};

const DetailLogModal: React.FC<DetailLogModalProps> = ({
  show,
  onHide,
  data,
  lineEnhancement,
  onLineTabOpen,
  onLineRetry,
  themeClassName,
}) => {
  const pathname = usePathname();
  const resolvedThemeClass = themeClassName ?? getThemeClass(pathname);
  // 헤더 도움말 버튼 → 2차 도움말 모달(기존 도움말 규격). 본문은 비워둔다.
  const [showHelp, setShowHelp] = useState(false);
  // 기본 탭 = 액트 체크 내역(기존 UX 유지). 닫으면 기본 탭으로 초기화.
  const [activeTab, setActiveTab] = useState<DetailLogTabKey>("act");
  const tabRefs = useRef<Record<DetailLogTabKey, HTMLButtonElement | null>>({
    act: null,
    line: null,
  });
  // 라인 탭 조회 요청은 "모달 1회 열림당 최초 진입 1회"만 — 탭 전환마다 재요청하지 않는다.
  const lineTabRequestedRef = useRef(false);

  // 표 정렬 상태 — null=기본(액트: 발생 시점 ASC·null 최하단 / 라인: 공식 허브 순서 ASC).
  //   모달을 완전히 닫으면 기본 정렬로 초기화(아래 show=false effect). 탭 전환은 유지.
  const [actSort, setActSort] = useState<ActSortState>(null);
  const [lineSort, setLineSort] = useState<LineSortState>(null);

  // 표시 순서만 정렬(값·요약·판정 불변). 요약은 정렬 전 원본 배열로 계산한다(순서 무관).
  //   ⚠ Hook 은 조기 return 위에서 호출한다(rules-of-hooks). 정렬 결과는 렌더에서만 쓴다.
  const sortedActs = useMemo(
    () => (data ? sortActRows(data.acts, actSort, toActSortRow) : []),
    [data, actSort],
  );
  const sortedLineRows = useMemo(() => {
    const st: DetailLogLineEnhancementState = lineEnhancement ?? { status: "idle" };
    const rows: CrewWeekLineEnhancementRowDto[] = st.status === "ready" ? st.data.rows : [];
    return sortLineRows(rows, lineSort, toLineSortRow);
  }, [lineEnhancement, lineSort]);

  // 모달이 닫히면 2차 도움말 상태도 초기화.
  useEffect(() => {
    if (!show) setShowHelp(false);
  }, [show]);

  // 모달이 닫히면 기본 탭으로 초기화 + 라인 조회 요청 플래그 해제 + 정렬 기본 복귀.
  useEffect(() => {
    if (!show) {
      setActiveTab("act");
      lineTabRequestedRef.current = false;
      setActSort(null);
      setLineSort(null);
    }
  }, [show]);

  // 라인 탭 최초 진입 → 호출부에 조회 요청(실제 캐시 판단/조회는 호출부 책임).
  //   ref 가드라 onLineTabOpen 참조가 바뀌어도 중복 호출되지 않는다.
  useEffect(() => {
    if (!show || activeTab !== "line") return;
    if (lineTabRequestedRef.current) return;
    lineTabRequestedRef.current = true;
    onLineTabOpen?.();
  }, [show, activeTab, onLineTabOpen]);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 2차 도움말이 열려 있으면 그것부터 닫는다.
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      onHide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onHide, showHelp]);

  if (!show || typeof document === "undefined") return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onHide();
  };

  // 좌우 방향키로 탭 이동(WAI-ARIA tabs 관례). 이동 후 포커스도 함께 옮긴다.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TAB_ORDER.indexOf(activeTab);
    const next =
      e.key === "ArrowRight"
        ? TAB_ORDER[(i + 1) % TAB_ORDER.length]
        : TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const lineState: DetailLogLineEnhancementState = lineEnhancement ?? { status: "idle" };

  const overlayClass = `section-modal-overlay detail-log-modal-overlay${
    resolvedThemeClass ? ` ${resolvedThemeClass}` : ""
  }`;

  // 주차 성장 성공 기준의 포인트 명칭·아이콘 — 조직별 실제 표기(내부 코드 노출 금지).
  //   주차 카드 배지·주차 상세와 동일한 lib/orgPointMeta 를 탄다.
  const growthStandardPoint = resolveGrowthStandardPoint(data?.org ?? null);

  const crewSegments = data
    ? [data.crew.name, data.crew.team, data.crew.part, data.crew.level].filter(
        (s) => s && s.trim() && s.trim() !== "-",
      )
    : [];

  // 액트 내역 요약 — 표시 중인 행 단일 출처(불변식: 체크 가능 = 행 개수 = 성공 + 실패).
  const actSummary = data ? buildActSummary(data.acts) : EMPTY_ACT_SUMMARY;

  // 획득 포인트 인덱스 라벨 — 포인트 카드/표 헤더와 동일 단일 출처(조직 point config). 하드코딩 금지.
  const [pointALabel, pointBLabel, pointCLabel] = data?.actPointNames ?? ["Po.A", "Po.B", "Po.C"];

  const actDir = (key: ActSortKey): SortDirection | null => (actSort?.key === key ? actSort.dir : null);
  const onActSort = (key: ActSortKey) => setActSort((s) => cycleSort(s, key));
  const lineDir = (key: LineSortKey): SortDirection | null => (lineSort?.key === key ? lineSort.dir : null);
  const onLineSort = (key: LineSortKey) => setLineSort((s) => cycleSort(s, key));

  return createPortal(
    <div className={overlayClass} onClick={handleOverlayClick}>
      <div
        className="section-modal section-modal-detail-log"
        role="dialog"
        aria-modal="true"
        aria-label="Weekly League Detail Log"
      >
        {/* ── Header (제목 좌측 · 도움말/닫기 우측). 주차 메타는 본문 상단으로 이동. ── */}
        <div className="dl-modal-header">
          <span className="dl-header-icon" aria-hidden="true">
            <i className="ti ti-list-details" />
          </span>
          <h3 className="dl-modal-title">Weekly League Detail Log</h3>
          <div className="dl-header-actions">
            <button type="button" className="dl-help-btn" onClick={() => setShowHelp(true)} aria-label="도움말">
              <i className="ti ti-help-circle" />
              <span>도움말</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onHide} aria-label="닫기">
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="detail-log-modal-body dl-modal-body">
          {!data ? (
            <div className="dl-empty">데이터를 불러오는 중입니다…</div>
          ) : (
            <>
              {/* 주차 메타(시즌/주차 · 기간) — 헤더에서 본문 상단(크루 배지 바로 위)으로 이동. 원천/포맷 불변.
                  ※ 주차 성장 성공 기준은 여기(메타 줄 우측)에서 아래 포인트 카드(별) 우측 상단으로 이동했다. */}
              <div className="dl-modal-meta-row">
                <p className="dl-modal-meta">
                  <span className="dl-meta-strong">{data.seasonWeekTitle}</span>
                  <span className="dl-meta-dot">·</span>
                  <span className="dl-meta-period">{data.periodText}</span>
                </p>
              </div>

              {/* 크루 프로필 (Badge) */}
              <div className="dl-crew-badge">
                {crewSegments.map((seg, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="dl-crew-sep">|</span>}
                    {/* 크루 이름(i===0)만 표시 전용 '님' 부착 — 마스킹 결과 뒤, 데이터 불변 */}
                    <span className={i === 0 ? "dl-crew-name" : "dl-crew-seg"}>
                      {i === 0 ? formatCrewNameHonorific(seg) : seg}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* 요약: 좌측 포인트 카드 / 우측(상단 성장 결과 · 하단 결과 메시지) */}
              <div className="dl-summary-layout">
                <div className="dl-summary-left">
                  <div className="dl-point-cards">
                    {data.points.map((p, i) => {
                      // 요약 포인트: index 2 = C(패널티) — 양수 magnitude 를 부호없이 빨강. A/B(0,1)=초록.
                      const isPointC = i === 2;
                      // index 0 = 주차 성장 성공 기준이 걸린 포인트(조직별 "별" 등) — 이 카드 우측 상단에만 기준 배지를 얹는다.
                      //   같은 포인트의 "이번 주 보유 개수 ↔ 성공 기준 개수" 를 한 칸에서 바로 대조할 수 있게 하기 위함.
                      const isGrowthStandardPoint = i === 0;
                      const criterion = normalizePointACriterion(data.pointACriterion);
                      return (
                        <div className="dl-point-card" key={i}>
                          {isGrowthStandardPoint && (
                            /* 카드 폭(약 191px)이 좁아 화면 문구는 "기준"으로 줄인다 — 바로 옆 카드 라벨이
                               포인트명(별)을 이미 말하고 있어 "별 기준"으로 읽힌다. 전체 문구는
                               title/aria-label 로 그대로 보존한다(내부 코드 "A" 노출 금지는 동일). */
                            <div
                              className="dl-modal-growth-standard"
                              title={`${growthStandardLabel(growthStandardPoint.name)} ${
                                criterion == null ? POINT_A_CRITERION_EMPTY_LABEL : `${criterion.toLocaleString()}${POINT_A_CRITERION_UNIT}`
                              }`}
                              aria-label={`${growthStandardLabel(growthStandardPoint.name)} ${
                                criterion == null ? POINT_A_CRITERION_EMPTY_LABEL : `${criterion.toLocaleString()}${POINT_A_CRITERION_UNIT}`
                              }`}
                            >
                              <span className="dl-modal-growth-standard__label" aria-hidden="true">기준</span>
                              {criterion == null ? (
                                <strong
                                  className="dl-modal-growth-standard__value dl-modal-growth-standard__value--empty"
                                  aria-hidden="true"
                                >
                                  {POINT_A_CRITERION_EMPTY_LABEL}
                                </strong>
                              ) : (
                                <strong className="dl-modal-growth-standard__value" aria-hidden="true">
                                  {criterion.toLocaleString()}
                                  <span className="dl-modal-growth-standard__unit">{POINT_A_CRITERION_UNIT}</span>
                                </strong>
                              )}
                            </div>
                          )}
                          <span className="dl-point-icon">
                            {p.icon ? <img src={p.icon} alt={p.label} /> : null}
                          </span>
                          <span className="dl-point-text">
                            <span className="dl-point-label">{p.label}</span>
                            <span
                              className="dl-point-value"
                              style={{ color: pointValueColor(i) }}
                            >
                              {isPointC ? `${Math.abs(p.value)}개` : formatPointValue(p.value)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="dl-summary-right">
                  {/* 성장 결과 + 누적 성공 주차 */}
                  <div className="dl-result-row">
                    <div className="dl-result-left">
                      <span className="dl-section-label">성장 결과</span>
                      <span className={`status-badge dl-status-badge ${data.statusClass}`}>
                        <span>{data.statusText || "-"}</span>
                      </span>
                    </div>
                    <div className="dl-result-right">
                      <span className="dl-cumulative-label">누적 성공 주차</span>
                      <span className="dl-cumulative-num">{data.cumulativeWeeks}</span>
                    </div>
                  </div>

                  {/* 결과 메시지 (Alert) */}
                  <div className={`dl-alert dl-alert--${alertToneFromStatus(data.statusClass)}`}>
                    <i className="ti ti-message-2 dl-alert-icon" aria-hidden="true" />
                    <p className="dl-alert-text">{data.resultMessage}</p>
                  </div>
                </div>
              </div>

              {/* 하단 2단 — 조건 체크 + 이번 주 도움말 */}
              <div className="dl-bottom-grid">
                <section className="dl-card dl-card--check">
                  <header className="dl-card-head">
                    <i className="ti ti-checklist" aria-hidden="true" />
                    <h4>성장 성공 조건 체크</h4>
                  </header>
                  <ul className="dl-check-list">
                    {data.conditions.map((c, i) => (
                      <li key={i} className={c.checked ? "is-checked" : "is-unchecked"}>
                        <span className="dl-checkbox" aria-hidden="true">
                          <i className={c.checked ? "ti ti-check" : "ti ti-x"} />
                        </span>
                        <span className="dl-check-text">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="dl-card dl-card--help">
                  <header className="dl-card-head">
                    <i className="ti ti-bulb" aria-hidden="true" />
                    <h4>이번 주 도움말</h4>
                  </header>
                  <p className="dl-help-text">{data.weeklyHelp}</p>
                </section>
              </div>

              {/* ── 내역 탭 (액트 체크 내역 / 라인 강화 내역) ── */}
              <section className="dl-card dl-act-section">
                <div className="dl-tabs" role="tablist" aria-label="Detail Log 내역">
                  <button
                    type="button"
                    role="tab"
                    id="dl-tab-act"
                    aria-selected={activeTab === "act"}
                    aria-controls="dl-panel-act"
                    tabIndex={activeTab === "act" ? 0 : -1}
                    ref={(el) => {
                      tabRefs.current.act = el;
                    }}
                    className={`dl-tab${activeTab === "act" ? " is-active" : ""}`}
                    onClick={() => setActiveTab("act")}
                    onKeyDown={handleTabKeyDown}
                  >
                    <i className="ti ti-clipboard-list" aria-hidden="true" />
                    <span className="dl-tab-label">{TAB_LABEL.act}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="dl-tab-line"
                    aria-selected={activeTab === "line"}
                    aria-controls="dl-panel-line"
                    tabIndex={activeTab === "line" ? 0 : -1}
                    ref={(el) => {
                      tabRefs.current.line = el;
                    }}
                    className={`dl-tab${activeTab === "line" ? " is-active" : ""}`}
                    onClick={() => setActiveTab("line")}
                    onKeyDown={handleTabKeyDown}
                  >
                    <i className="ti ti-chart-bar" aria-hidden="true" />
                    <span className="dl-tab-label">{TAB_LABEL.line}</span>
                  </button>
                </div>

                {/* ── 액트 체크 내역 (백엔드 snapshot DTO v30 actLogs) — 기존 데이터/산식 불변 ── */}
                <div
                  className="dl-tabpanel"
                  role="tabpanel"
                  id="dl-panel-act"
                  aria-labelledby="dl-tab-act"
                  hidden={activeTab !== "act"}
                >
                {/* 패널 제목 없음 — 탭 버튼(#dl-tab-act)이 이미 "액트 체크 내역"을 표시하므로 중복이다.
                    패널의 접근성 이름은 aria-labelledby="dl-tab-act"(탭 버튼)로 유지되므로 스크린리더에도
                    제목이 그대로 노출된다(헤더 제거로 잃는 정보 없음). 아이콘도 탭 버튼에 동일한 것이 있다. */}
                {data.acts.length === 0 ? (
                  <div className="dl-act-empty">이번 주 수행·적립된 액트 내역이 없어요.</div>
                ) : (
                  <>
                    {/* Activity Summary — 액트 체크율 + 요약 통계(표시 행 단일 출처) */}
                    <div className="dl-act-summary">
                      <div className="dl-act-summary-bar-row">
                        <span className="dl-act-summary-title">액트 체크율</span>
                        <div
                          className="dl-act-progress"
                          role="progressbar"
                          aria-valuenow={actSummary.rate}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div className="dl-act-progress-fill" style={{ width: `${actSummary.rate}%` }} />
                        </div>
                        <span className="dl-act-summary-rate">{actSummary.rate}%</span>
                      </div>
                      <div className="dl-act-stats">
                        <span className="dl-act-stat">
                          <span className="dl-act-stat-label">체크 가능</span>
                          <span className="dl-act-stat-value">{actSummary.total}</span>
                        </span>
                        <span className="dl-act-stat dl-act-stat--success">
                          <span className="dl-act-stat-label">체크 성공</span>
                          <span className="dl-act-stat-value">{actSummary.success}</span>
                        </span>
                        <span className="dl-act-stat dl-act-stat--fail">
                          <span className="dl-act-stat-label">체크 실패</span>
                          <span className="dl-act-stat-value">{actSummary.fail}</span>
                        </span>
                        <span className="dl-act-stat">
                          <span className="dl-act-stat-label">체크 필수</span>
                          <span className="dl-act-stat-value">{actSummary.required}</span>
                        </span>
                        <span className="dl-act-stat">
                          <span className="dl-act-stat-label">체크 선별</span>
                          <span className="dl-act-stat-value">{actSummary.selective}</span>
                        </span>

                        {/* 획득 포인트 A/B/C — "획득 / 가능"(표시 중인 행 단일 출처 합계). 라벨=조직 point config.
                            값 색상 = 포인트 카드와 동일 단일 출처(pointValueColor) — A/B 연두·C 빨강, 조직 무관. 라벨 색상 불변. */}
                        <span className="dl-act-stat dl-act-stat--point">
                          <span className="dl-act-stat-label">획득 {pointALabel}</span>
                          <span className="dl-act-stat-value" style={{ color: pointValueColor(0) }}>
                            {formatRatio(actSummary.points.pointA.earned, actSummary.points.pointA.available)}
                          </span>
                        </span>
                        <span className="dl-act-stat dl-act-stat--point">
                          <span className="dl-act-stat-label">획득 {pointBLabel}</span>
                          <span className="dl-act-stat-value" style={{ color: pointValueColor(1) }}>
                            {formatRatio(actSummary.points.pointB.earned, actSummary.points.pointB.available)}
                          </span>
                        </span>
                        <span className="dl-act-stat dl-act-stat--point">
                          <span className="dl-act-stat-label">획득 {pointCLabel}</span>
                          <span className="dl-act-stat-value" style={{ color: pointValueColor(2) }}>
                            {formatRatio(actSummary.points.pointC.earned, actSummary.points.pointC.available)}
                          </span>
                        </span>

                        {/* 정규/변동 액트 — 구분(source) 단일 기준 */}
                        <span className="dl-act-stat">
                          <span className="dl-act-stat-label">정규 액트</span>
                          <span className="dl-act-stat-value">{actSummary.regularActCount}</span>
                        </span>
                        <span className="dl-act-stat">
                          <span className="dl-act-stat-label">변동 액트</span>
                          <span className="dl-act-stat-value">{actSummary.variableActCount}</span>
                        </span>
                      </div>
                    </div>

                    <div className="dl-act-table-wrap">
                      <table className="dl-act-table">
                        <colgroup>
                          <col className="dl-col-result" />
                          <col className="dl-col-name" />
                          <col className="dl-col-time" />
                          <col className="dl-col-hub" />
                          <col className="dl-col-line" />
                          <col className="dl-col-dur" />
                          <col className="dl-col-pt" />
                          <col className="dl-col-pt" />
                          <col className="dl-col-pt" />
                          <col className="dl-col-div" />
                          <col className="dl-col-kind" />
                        </colgroup>
                        <thead>
                          <tr>
                            <SortTh label="결과" labelText="결과" dir={actDir("result")} onSort={() => onActSort("result")} />
                            <SortTh label="액트명" labelText="액트명" dir={actDir("name")} onSort={() => onActSort("name")} className="dl-act-col-name" />
                            <SortTh label="발생 시점" labelText="발생 시점" dir={actDir("occurredAt")} onSort={() => onActSort("occurredAt")} />
                            <SortTh label="소속 허브 급" labelText="소속 허브 급" dir={actDir("hub")} onSort={() => onActSort("hub")} />
                            <SortTh label="소속 라인 급" labelText="소속 라인 급" dir={actDir("line")} onSort={() => onActSort("line")} />
                            <SortTh label="소요 시간" labelText="소요 시간" dir={actDir("duration")} onSort={() => onActSort("duration")} />
                            <SortTh label={data.actPointNames[0]} labelText={data.actPointNames[0]} dir={actDir("pointA")} onSort={() => onActSort("pointA")} className="dl-act-col-point" />
                            <SortTh label={data.actPointNames[1]} labelText={data.actPointNames[1]} dir={actDir("pointB")} onSort={() => onActSort("pointB")} className="dl-act-col-point" />
                            <SortTh label={data.actPointNames[2]} labelText={data.actPointNames[2]} dir={actDir("pointC")} onSort={() => onActSort("pointC")} className="dl-act-col-point" />
                            <SortTh label="구분" labelText="구분" dir={actDir("source")} onSort={() => onActSort("source")} />
                            <SortTh label="종류" labelText="종류" dir={actDir("kind")} onSort={() => onActSort("kind")} />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedActs.map((a) => {
                            // 결과 배지 = 크루 기준 판정(공통 SoT). 원장 result 필드가 아니라 적립 포인트에서 파생 —
                            //   요약 "체크 성공/실패"와 동일 함수라 배지-포인트 모순(예: ✓ 체크 + Po.C 12)이 불가능.
                            const crewResult = resolveCrewActResult(a);
                            const resultBadge = crewActResultBadge(crewResult);
                            return (
                            <tr key={a.stableKey}>
                              <td>
                                <span className={`dl-act-badge dl-act-result ${resultBadge.toneClass}`}>
                                  {resultBadge.label}
                                </span>
                              </td>
                              <td className="dl-act-name" title={a.actName || "-"}>
                                {a.actName || "-"}
                              </td>
                              <td className="dl-act-time">{a.occurredText}</td>
                              <td className="dl-act-cell">{a.hubLabel}</td>
                              <td className="dl-act-cell" title={a.lineLabel}>
                                {a.lineLabel}
                              </td>
                              <td className="dl-act-num">{a.durationText}</td>
                              <td className={`dl-act-point ${a.pointA > 0 ? "is-gain" : "is-zero"}`}>
                                {formatGainPoint(a.pointA)}
                              </td>
                              <td className={`dl-act-point ${a.pointB > 0 ? "is-gain" : "is-zero"}`}>
                                {formatGainPoint(a.pointB)}
                              </td>
                              <td className={`dl-act-point ${a.pointC !== 0 ? "is-penalty" : "is-zero"}`}>
                                {formatPenaltyPoint(a.pointC)}
                              </td>
                              <td>
                                <span className={`dl-act-badge dl-act-source dl-act-source--${a.source}`}>
                                  {a.source === "regular" ? "정규" : "변동"}
                                </span>
                              </td>
                              <td>
                                <span className={`dl-act-badge dl-act-kind dl-act-kind--${a.kindKey}`}>
                                  {a.kindLabel}
                                </span>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                </div>

                {/* ── 라인 강화 내역 (어드민 getCrewWeekLineSummary SoT — 값 그대로 표시, 재계산 금지) ── */}
                <div
                  className="dl-tabpanel"
                  role="tabpanel"
                  id="dl-panel-line"
                  aria-labelledby="dl-tab-line"
                  hidden={activeTab !== "line"}
                >
                  {/* 패널 제목 없음 — 탭 버튼(#dl-tab-line)이 이미 "라인 강화 내역"을 표시하므로 중복이다.
                      액트 탭(#dl-panel-act)과 동일 원칙: 두 탭 모두 **탭 버튼이 제목 역할**을 한다.
                      패널의 접근성 이름은 aria-labelledby="dl-tab-line"(탭 버튼)로 유지되므로
                      스크린리더에는 제목이 그대로 노출된다 — 시각적 중복만 제거된다. */}
                  {lineState.status === "idle" || lineState.status === "loading" ? (
                    <div className="dl-line-loading" role="status" aria-live="polite">
                      <span className="dl-line-skeleton" aria-hidden="true" />
                      <span className="dl-line-skeleton" aria-hidden="true" />
                      <span className="dl-line-skeleton" aria-hidden="true" />
                      <span className="dl-line-loading-text">라인 강화 내역을 불러오는 중입니다…</span>
                    </div>
                  ) : lineState.status === "error" ? (
                    <div className="dl-line-error" role="alert">
                      <i className="ti ti-alert-circle" aria-hidden="true" />
                      <p className="dl-line-error-text">{lineState.message}</p>
                      {onLineRetry ? (
                        <button type="button" className="dl-line-retry" onClick={onLineRetry}>
                          다시 시도
                        </button>
                      ) : null}
                    </div>
                  ) : lineState.data.rows.length === 0 ? (
                    <div className="dl-act-empty">이 주차에 오픈된 라인이 없습니다.</div>
                  ) : (
                    <>
                      {/* 상단 요약 X — 전부 백엔드 summary 값(프론트 재집계 금지). */}
                      <div className="dl-act-summary">
                        <div className="dl-act-summary-bar-row">
                          <span className="dl-act-summary-title">주차 성장률</span>
                          <div
                            className="dl-act-progress"
                            role="progressbar"
                            aria-valuenow={lineState.data.summary.enhancementRate}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="dl-act-progress-fill"
                              style={{ width: `${lineState.data.summary.enhancementRate}%` }}
                            />
                          </div>
                          <span className="dl-act-summary-rate">
                            {lineState.data.summary.enhancementRate}%
                          </span>
                        </div>
                        <div className="dl-act-stats">
                          <span className="dl-act-stat">
                            <span className="dl-act-stat-label">클럽 오픈 라인</span>
                            <span className="dl-act-stat-value">
                              {lineState.data.summary.clubOpenCount}
                            </span>
                          </span>
                          <span className="dl-act-stat">
                            <span className="dl-act-stat-label">크루 오픈 라인</span>
                            <span className="dl-act-stat-value">
                              {lineState.data.summary.crewOpenCount}
                            </span>
                          </span>
                          <span className="dl-act-stat dl-act-stat--success">
                            <span className="dl-act-stat-label">강화 성공</span>
                            <span className="dl-act-stat-value">
                              {lineState.data.summary.successCount}
                            </span>
                          </span>
                          <span className="dl-act-stat dl-act-stat--fail">
                            <span className="dl-act-stat-label">강화 실패</span>
                            <span className="dl-act-stat-value">
                              {lineState.data.summary.failureCount}
                            </span>
                          </span>
                          <span className="dl-act-stat">
                            <span className="dl-act-stat-label">해당 없음</span>
                            <span className="dl-act-stat-value">
                              {lineState.data.summary.notApplicableCount}
                            </span>
                          </span>

                          {/* 획득 포인트 A/B/C — "획득 / 가능". 라벨=조직 point config(액트 탭과 동일 출처).
                              ⚠ C 는 현재 원천상 항상 0 / 0 이지만 **값이 0 이라는 이유로 숨기지 않는다**(요구 §2).
                              ⚠ 색은 표 3열과 **동일 컴포넌트·동일 kind**로 결정된다(A/B 초록·C 빨강).
                                인라인 color 를 다시 넣지 말 것 — 요약과 표가 갈라진다. */}
                          <span className="dl-act-stat dl-act-stat--point">
                            <span className="dl-act-stat-label">획득 {pointALabel}</span>
                            <span className="dl-act-stat-value">
                              <LinePointPair pair={lineState.data.summary.pointA} kind="a" />
                            </span>
                          </span>
                          <span className="dl-act-stat dl-act-stat--point">
                            <span className="dl-act-stat-label">획득 {pointBLabel}</span>
                            <span className="dl-act-stat-value">
                              <LinePointPair pair={lineState.data.summary.pointB} kind="b" />
                            </span>
                          </span>
                          <span className="dl-act-stat dl-act-stat--point">
                            <span className="dl-act-stat-label">획득 {pointCLabel}</span>
                            <span className="dl-act-stat-value">
                              <LinePointPair pair={lineState.data.summary.pointC} kind="c" />
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* 하단 표 Y — 이번 주 클럽 오픈 라인 전 행. 10열이라 좁은 폭에선 가로 스크롤(wrap). */}
                      <div className="dl-act-table-wrap">
                        <table className="dl-act-table dl-line-table">
                          <colgroup>
                            <col className="dl-line-col-result" />
                            <col className="dl-line-col-name" />
                            <col className="dl-line-col-hub" />
                            <col className="dl-line-col-kind" />
                            <col className="dl-line-col-duration" />
                            <col className="dl-line-col-rating" />
                            <col className="dl-line-col-pt" />
                            <col className="dl-line-col-pt" />
                            <col className="dl-line-col-pt" />
                            <col className="dl-line-col-req" />
                          </colgroup>
                          <thead>
                            <tr>
                              <SortTh label="결과" labelText="결과" dir={lineDir("result")} onSort={() => onLineSort("result")} />
                              <SortTh label="라인명" labelText="라인명" dir={lineDir("name")} onSort={() => onLineSort("name")} className="dl-act-col-name" />
                              <SortTh label="소속 허브" labelText="소속 허브" dir={lineDir("hub")} onSort={() => onLineSort("hub")} />
                              <SortTh label="종류" labelText="종류" dir={lineDir("kind")} onSort={() => onLineSort("kind")} />
                              <SortTh label="소요 시간" labelText="소요 시간" dir={lineDir("duration")} onSort={() => onLineSort("duration")} />
                              <SortTh label="평점" labelText="평점" dir={lineDir("rating")} onSort={() => onLineSort("rating")} />
                              <SortTh label={`획득 ${pointALabel}`} labelText={`획득 ${pointALabel}`} dir={lineDir("pointA")} onSort={() => onLineSort("pointA")} className="dl-act-col-point" />
                              <SortTh label={`획득 ${pointBLabel}`} labelText={`획득 ${pointBLabel}`} dir={lineDir("pointB")} onSort={() => onLineSort("pointB")} className="dl-act-col-point" />
                              <SortTh label={`획득 ${pointCLabel}`} labelText={`획득 ${pointCLabel}`} dir={lineDir("pointC")} onSort={() => onLineSort("pointC")} className="dl-act-col-point" />
                              <SortTh label="주차 성장 조건" labelText="주차 성장 조건" dir={lineDir("growthRequirement")} onSort={() => onLineSort("growthRequirement")} />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedLineRows.map((row) => (
                              <tr key={row.stableKey}>
                                <td>
                                  <span
                                    className={`dl-act-badge dl-line-result dl-line-result--${row.resultTone}`}
                                  >
                                    {row.resultLabel}
                                  </span>
                                </td>
                                {/* 라인명 — 한 줄 ellipsis 금지(최대 3줄 clamp + title 전체 노출) */}
                                <td className="dl-line-name" title={row.lineName || "-"}>
                                  {row.lineName || "-"}
                                </td>
                                <td className="dl-act-cell">{row.hubLabel}</td>
                                <td className="dl-act-cell">{row.kind || "-"}</td>
                                {/* 소요 시간 — 분(DTO) → 표시는 공용 formatter 단일 경유. 미설정=" - ". */}
                                <td className="dl-act-num">
                                  {formatLineDuration(row.estimatedDurationMinutes)}
                                </td>
                                <td className="dl-act-num">{formatLineRating(row.rating)}</td>
                                {/* 포인트 A/B/C — 요약 카드와 **동일 컴포넌트·동일 kind**(A/B 초록·C 빨강). */}
                                <td className="dl-act-num">
                                  <LinePointPair pair={row.pointA} kind="a" />
                                </td>
                                <td className="dl-act-num">
                                  <LinePointPair pair={row.pointB} kind="b" />
                                </td>
                                <td className="dl-act-num">
                                  <LinePointPair pair={row.pointC} kind="c" />
                                </td>
                                <td>
                                  <span
                                    className={`dl-act-badge dl-line-req dl-line-req--${row.growthRequirement}`}
                                  >
                                    {growthRequirementLabel(row.growthRequirement)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── 2차 도움말 모달 (기존 도움말 규격 — Detail Log 위에 표시, 본문 비움) ── */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowHelp(false)}
                  aria-label="닫기"
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <div className="help-modal-body" />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default DetailLogModal;

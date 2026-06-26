// =============================================================
// Weekly Ranking 테마 SoT — /weekly-ranking 페이지 전용 색상 정의소.
//
// 목적: 조직(organization) + 분기(반기, 상반기/하반기) 조합으로 페이지 색상
//       테마를 결정한다. 컴포넌트는 본 모듈의 함수만 호출해 CSS 변수를 주입하고,
//       SCSS 는 `var(--wr-*, <기존값>)` 형태로 소비한다(변수 부재 시 기존 룩 유지).
//
// 설계 원칙(요구사항 반영):
//   1) ranking DTO / API 응답 / snapshot 은 일절 건드리지 않는다. 본 모듈은
//      이미 응답에 들어있는 organization(=org slug) 과 seasonName 만 입력으로 받아
//      UI 색상 토큰을 산출하는 순수 함수 모음이다(부수효과·네트워크·DB 접근 0).
//   2) 색상 하드코딩을 컴포넌트에 흩지 않는다 — 모든 색은 본 파일의 테이블에서만.
//   3) "조직 + 분기" 단위로 확장 가능 — ORG_HALF_THEME(조직×반기 기본) +
//      RANKING_QUARTER_THEME(연도까지 특정한 override) 2단 테이블.
//   4) 일반 사용자 경로/데모(demoUserId) 경로 모두 같은 seasonName 문자열을 쓰므로
//      동일 입력 → 동일 색상(경로 분기 없음).
//
// 분기(반기) 매핑:
//   상반기(h1) = 겨울 · 봄   (대표월 1~5월)
//   하반기(h2) = 여름 · 가을 (대표월 6~11월)
//   ※ 정책 변경 시 SEASON_TO_HALF 한 곳만 수정.
// =============================================================

import { getOrgConfigForSlug } from "@/lib/cluster-route";
import type { CSSProperties } from "react";

export type RankingOrg = "oranke" | "encre" | "phalanx";
/** 반기 — h1=상반기, h2=하반기. */
export type RankingHalf = "h1" | "h2";

export interface RankingQuarter {
  year: number;
  /** 한글 시즌 단어 — 봄/여름/가을/겨울. */
  season: string;
  half: RankingHalf;
  /** "2026 상반기" 형태 사람 표시용 라벨. */
  label: string;
  /** 테마 테이블 키 — `${year}-${half}` (예: "2026-h1"). */
  key: string;
}

/** accent/accentSoft 한 쌍 — 테이블 엔트리의 최소 단위. */
interface AccentPair {
  accent: string;
  accentSoft: string;
}

/** 컴포넌트/SCSS 로 전달되는 최종 색상 토큰. */
export interface RankingThemeTokens {
  /** 주요 강조 — 보더/구분선/강조 텍스트. */
  accent: string;
  /** 라이트 강조 — 숫자/진행바 fill/소프트 텍스트. */
  accentSoft: string;
  /** 강조색 70% 알파 — 보더 펄스 애니메이션 저점용. */
  accentDim: string;
  /** 채도·명도를 낮춘 강조색 — breadcrumb 등 과하게 튀면 안 되는 텍스트. */
  accentMuted: string;
  /** 글로우(rgba) — box-shadow/text-shadow. */
  glow: string;
  /** 페이지/섹션 배경 틴트(gradient). */
  pageBg: string;
  /** 소프트 배경(rgba 0.18) — 히어로 슬로건 박스 등 면 영역. */
  softBg: string;
  /** 소프트 보더(rgba 0.55) — 슬로건 박스 테두리 등. */
  softBorder: string;
  /** 기본(브랜드) 뱃지 배경. */
  badgeBg: string;
  /** 기본(브랜드) 뱃지 보더. */
  badgeBorder: string;
  /** 기본(브랜드) 뱃지 텍스트색. */
  badgeColor: string;
}

// ── 시즌 → 반기 매핑(정책 SoT) ──
const SEASON_TO_HALF: Record<string, RankingHalf> = {
  겨울: "h1",
  봄: "h1",
  여름: "h2",
  가을: "h2",
};

// ── 조직 × 반기 기본 테마(연도 무관 폴백) ──
// 같은 색조(hue)를 유지하되 반기별 명도/온도를 달리한다. 브랜드 H1 값은
// ORGANIZATION_CONFIG(themeColor/accentSoft)와 일치 — 기존 룩 회귀 0.
const ORG_HALF_THEME: Record<RankingOrg, Record<RankingHalf, AccentPair>> = {
  oranke: {
    h1: { accent: "#FAAB07", accentSoft: "#FFC300" }, // 봄·겨울 — 따뜻한 골드
    h2: { accent: "#F57C00", accentSoft: "#FFB74D" }, // 여름·가을 — 깊은 앰버
  },
  encre: {
    h1: { accent: "#FF4B70", accentSoft: "#FF98A6" }, // 핑크
    h2: { accent: "#C2185B", accentSoft: "#F06292" }, // 딥 마젠타
  },
  phalanx: {
    h1: { accent: "#1E9503", accentSoft: "#B2FF8F" }, // 라이트 그린
    h2: { accent: "#2E7D32", accentSoft: "#A5D6A7" }, // 딥 그린
  },
};

// ── 연도까지 특정한 override(최우선) ──
// "조직 + YYYY 반기" 단위로 특정 색을 강제하고 싶을 때만 채운다.
// 비어 있으면 ORG_HALF_THEME 로 폴백한다(현 시점 기본값으로 충분).
//   키 형식: `${org}:${year}-${half}`  예: "oranke:2026-h2"
const RANKING_QUARTER_THEME: Record<string, AccentPair> = {
  // 예시(주석) — 필요 시 주석 해제 후 색만 바꿔 확장:
  // "oranke:2026-h2": { accent: "#EF6C00", accentSoft: "#FFB74D" },
  // "phalanx:2026-h2": { accent: "#1B5E20", accentSoft: "#A5D6A7" },
};

const isRankingOrg = (v: string | null | undefined): v is RankingOrg =>
  v === "oranke" || v === "encre" || v === "phalanx";

// "#RRGGBB" → "r, g, b" (rgba() 합성용). 비정상 입력은 흰색으로 폴백.
const hexToRgbTriplet = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "255, 255, 255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const rgba = (hex: string, alpha: number): string =>
  `rgba(${hexToRgbTriplet(hex)}, ${alpha})`;

// 두 hex 를 ratio(=첫 색 가중치, 0~1)로 선형 혼합한 hex. 비정상 입력은 첫 색 폴백.
const mixHex = (hex: string, withHex: string, ratio: number): string => {
  const a = hexToRgbTriplet(hex).split(",").map((n) => Number(n.trim()));
  const b = hexToRgbTriplet(withHex).split(",").map((n) => Number(n.trim()));
  if (a.length !== 3 || b.length !== 3) return hex;
  const out = a.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * seasonName("2026년, 봄 시즌, 3주차") → 분기 정보. 매칭 실패 시 null.
 * weekly-ranking 카드/필터가 공유하는 파싱 규칙과 동일(연도+시즌 단어).
 */
export function resolveRankingQuarter(
  seasonName: string | null | undefined,
): RankingQuarter | null {
  if (!seasonName) return null;
  const m = seasonName.match(/(\d{4})년,?\s*(봄|여름|가을|겨울)\s*시즌/);
  if (!m) return null;
  const year = Number(m[1]);
  const season = m[2];
  const half = SEASON_TO_HALF[season] ?? "h1";
  return {
    year,
    season,
    half,
    label: `${year} ${half === "h1" ? "상반기" : "하반기"}`,
    key: `${year}-${half}`,
  };
}

/**
 * 조직 + (선택적) 분기 → 색상 토큰. 해석 우선순위:
 *   1) RANKING_QUARTER_THEME[`${org}:${year}-${half}`]  (연도 특정 override)
 *   2) ORG_HALF_THEME[org][half]                         (조직×반기 기본)
 *   3) ORGANIZATION_CONFIG 브랜드색                       (분기 미상 폴백)
 * org 가 알 수 없으면 marketing(오랑캐) 브랜드색으로 폴백한다.
 */
export function getRankingTheme(
  org: string | null | undefined,
  quarter?: RankingQuarter | null,
): RankingThemeTokens {
  const safeOrg: RankingOrg = isRankingOrg(org) ? org : "oranke";

  let pair: AccentPair | undefined;
  if (quarter) {
    pair = RANKING_QUARTER_THEME[`${safeOrg}:${quarter.key}`] ?? ORG_HALF_THEME[safeOrg][quarter.half];
  }
  if (!pair) {
    // 분기 미상 — 조직 브랜드색(ORGANIZATION_CONFIG)로 폴백.
    const cfg = getOrgConfigForSlug(safeOrg);
    pair = { accent: cfg.themeColor, accentSoft: cfg.accentSoft };
  }

  const { accent, accentSoft } = pair;
  return {
    accent,
    accentSoft,
    accentDim: rgba(accent, 0.7),
    // 강조색을 중성 회색(#555)과 50% 혼합 → 채도·명도를 낮춘 자연스러운 톤.
    accentMuted: mixHex(accent, "#555555", 0.5),
    glow: rgba(accent, 0.35),
    pageBg: `linear-gradient(180deg, ${rgba(accent, 0.06)} 0%, rgba(0, 0, 0, 0) 360px)`,
    softBg: rgba(accent, 0.18),
    softBorder: rgba(accent, 0.55),
    badgeBg: rgba(accent, 0.15),
    badgeBorder: rgba(accent, 0.48),
    badgeColor: accentSoft,
  };
}

/** seasonName 으로 바로 토큰을 얻는 단축 헬퍼(org + 카드 시즌). */
export function getRankingThemeForSeason(
  org: string | null | undefined,
  seasonName: string | null | undefined,
): RankingThemeTokens {
  return getRankingTheme(org, resolveRankingQuarter(seasonName));
}

/**
 * 토큰 → CSS 변수 객체. 컴포넌트가 `.weekly-ranking-page` 루트 style 에 주입하면
 * 커스텀 프로퍼티 상속으로 히어로/필터/카드 전 영역(자손)이 동일 테마를 읽는다.
 */
export function getRankingThemeVars(tokens: RankingThemeTokens): CSSProperties {
  return {
    "--wr-accent": tokens.accent,
    "--wr-accent-soft": tokens.accentSoft,
    "--wr-accent-dim": tokens.accentDim,
    "--wr-accent-muted": tokens.accentMuted,
    "--wr-glow": tokens.glow,
    "--wr-page-bg": tokens.pageBg,
    "--wr-soft-bg": tokens.softBg,
    "--wr-soft-border": tokens.softBorder,
    "--wr-badge-bg": tokens.badgeBg,
    "--wr-badge-border": tokens.badgeBorder,
    "--wr-badge-color": tokens.badgeColor,
  } as CSSProperties;
}

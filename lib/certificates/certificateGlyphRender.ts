import "server-only";
import type { Font } from "opentype.js";

// 증명서 공통 텍스트 레이아웃 엔진 — 활동 증명서 · 경력 증명서가 함께 쓰는 유일한 구현.
// ─────────────────────────────────────────────────────────────────────────────
// opentype.js 로 글리프를 벡터 <path> 로 직접 구워 SVG 에 얹는다(<text> 노드 미사용).
// 이유는 activityCertificateRenderer.ts 상단 주석 참고 — 여기서는 그 근거가 되는
// 저수준 유틸리티(글리프 직렬화 · 측정 · 한 줄/여러 줄 레이아웃)만 공유한다.
//
// ⚠️ 이 파일은 특정 증명서 타입(활동/경력)을 몰라야 한다. 슬롯 이름·라벨·필드명은
//    전부 호출부가 문자열로 넘긴다 — 여기 타입 분기를 추가하지 말 것.
// ─────────────────────────────────────────────────────────────────────────────

/** 렌더 자체가 불가능한 내부 오류(글리프 경로 생성 실패 등). 사용자 입력 탓이 아니다. */
export class CertificateRenderError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "CertificateRenderError";
  }
}

export type CertificateFieldErrorCodeLike = string;

export interface CertificateFieldErrorLike {
  field: string;
  code: string;
  message: string;
}

export class CertificateLayoutError extends Error {
  status = 422;
  errors: CertificateFieldErrorLike[];

  constructor(errors: CertificateFieldErrorLike[]) {
    super(errors[0]?.message ?? "증명서 레이아웃 오류");
    this.name = "CertificateLayoutError";
    this.errors = errors;
  }
}

// ── 글리프 path 직렬화 ───────────────────────────────────────────────────────
//
// ⚠️ opentype.js 2.0.0 의 Path.toPathData() 를 쓰지 않는다.
//    특정 부동소수 좌표에서 좌표 하나를 리터럴 "NaN" 으로 출력한다(실측: `MNaN 64.51`).
//    그러면 librsvg 가 그 서브패스 이후를 조용히 버려 글자가 소리 없이 사라진다.
//    예외도 경고도 없다. 증명서는 법적 문서이므로 이런 무성 손실은 허용할 수 없어
//    직접 직렬화한다. (되돌리지 말 것.)

interface PathCommand {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

function coord(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return Number.isFinite(rounded) ? String(rounded) : null;
}

export function serializeGlyphPath(commands: PathCommand[]): string | null {
  let out = "";
  for (const c of commands) {
    switch (c.type) {
      case "M":
      case "L": {
        const x = coord(c.x);
        const y = coord(c.y);
        if (x === null || y === null) return null;
        out += `${c.type}${x} ${y}`;
        break;
      }
      case "C": {
        const parts = [c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(coord);
        if (parts.some((p) => p === null)) return null;
        out += `C${parts.join(" ")}`;
        break;
      }
      case "Q": {
        const parts = [c.x1, c.y1, c.x, c.y].map(coord);
        if (parts.some((p) => p === null)) return null;
        out += `Q${parts.join(" ")}`;
        break;
      }
      case "Z":
        out += "Z";
        break;
      default:
        return null;
    }
  }
  return out;
}

/** 텍스트를 글리프 path 로 만들어 반환. 실패(NaN 좌표 등)하면 null. */
export function glyphPathData(font: Font, text: string, x: number, y: number, size: number): string | null {
  const commands = font.getPath(text, x, y, size, { kerning: true }).commands as unknown as PathCommand[];
  return serializeGlyphPath(commands);
}

// ── 측정 ────────────────────────────────────────────────────────────────────

export function measure(font: Font, text: string, size: number): number {
  return font.getAdvanceWidth(text, size, { kerning: true });
}

/**
 * 폰트에 없는 글자는 opentype 이 .notdef(빈/네모 path)로 그려 조용한 두부가 된다.
 * 대체하지 않고 검증 오류로 사용자에게 알린다.
 */
export function findUnsupportedChars(font: Font, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (ch === " ") continue;
    if (font.charToGlyphIndex(ch) === 0) missing.add(ch);
  }
  return Array.from(missing);
}

// ── 한 줄 슬롯 레이아웃(자동 축소, 잘라내지 않음) ────────────────────────────

export interface SingleLineSpec {
  x: number;
  y: number;
  align: "left" | "center" | "right";
  fontSize: number;
  minFontSize: number;
  maxWidth: number;
  color?: string;
}

export interface LaidOutLine {
  kind: "line";
  text: string;
  fontSize: number;
  x: number;
  y: number;
  color: string;
}

/**
 * 한 줄짜리 슬롯의 배치를 결정한다. 줄바꿈은 없고 축소만 한다.
 *   fontSize 부터 1px 씩 minFontSize 까지 줄이며 maxWidth 안에 들어가는 크기를 찾는다.
 *   끝내 못 찾으면 잘라내지 않고 FIELD_OVERFLOW — 값이 잘린 증명서를 만들지 않는다.
 */
export function layoutSingleLine(
  font: Font,
  text: string,
  spec: SingleLineSpec,
  defaultColor: string,
  field: string,
  label: string,
): LaidOutLine | CertificateFieldErrorLike {
  const missing = findUnsupportedChars(font, text);
  if (missing.length > 0) {
    return {
      field,
      code: "UNSUPPORTED_CHARACTER",
      message: `${label}에 증명서 서체가 지원하지 않는 문자가 있습니다: ${missing.slice(0, 5).join(" ")}`,
    };
  }

  for (let size = spec.fontSize; size >= spec.minFontSize; size -= 1) {
    const advance = measure(font, text, size);
    if (advance <= spec.maxWidth) {
      const x =
        spec.align === "left" ? spec.x : spec.align === "center" ? spec.x - advance / 2 : spec.x - advance;
      return {
        kind: "line",
        text,
        fontSize: size,
        x,
        y: spec.y,
        color: spec.color ?? defaultColor,
      };
    }
  }

  return {
    field,
    code: "FIELD_OVERFLOW",
    message: `${label}이(가) 증명서의 기입 칸을 벗어납니다. 더 짧게 입력해주세요.`,
  };
}

export function isFieldError(v: unknown): v is CertificateFieldErrorLike {
  return !!v && typeof v === "object" && "code" in (v as Record<string, unknown>);
}

// ── 여러 줄(문단) 블록 레이아웃 — 한글/공백 단위 줄바꿈, 자동 축소 ────────────

export interface MultilineSpec {
  /** 블록 중심 x(px). 각 줄이 이 x 를 기준으로 가운데 정렬된다. */
  x: number;
  /** 첫 줄 baseline y(px). */
  y: number;
  fontSize: number;
  minFontSize: number;
  maxWidth: number;
  maxLines: number;
  lineHeight: number;
  color?: string;
}

/**
 * 텍스트를 공백 단위 토큰으로 쪼개 maxWidth 안에서 그리디하게 줄바꿈한다.
 * 토큰 하나가 이미 maxWidth 를 넘으면(공백 없는 긴 한글 어절 등) 그 토큰만 문자
 * 단위로 추가 분해한다("한글/공백 단위 줄바꿈" — 공백을 우선하고 안 되면 글자 단위).
 */
function wrapLines(font: Font, text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.length > 0) lines.push(current);
    current = "";
  };

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (measure(font, candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    // 현재 줄에 넣으면 넘친다 — 지금까지 쌓은 줄을 확정하고 새 줄 시작.
    pushCurrent();
    if (measure(font, word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    // 단어 자체가 한 줄보다 길다 — 글자 단위로 분해.
    let chunk = "";
    for (const ch of word) {
      const next = chunk + ch;
      if (measure(font, next, fontSize) <= maxWidth || chunk.length === 0) {
        chunk = next;
      } else {
        lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  pushCurrent();
  return lines;
}

export interface LaidOutBlock {
  kind: "block";
  lines: { text: string; x: number; y: number }[];
  fontSize: number;
  color: string;
}

/**
 * 여러 줄 문단 블록의 배치를 결정한다.
 *   fontSize 부터 1px 씩 minFontSize 까지 줄이며, 그 크기로 wrapLines 한 결과가
 *   maxLines 이하에 들어가는 첫 크기를 찾는다. 끝내 못 찾으면 잘라내지 않고
 *   FIELD_OVERFLOW.
 */
export function layoutMultilineBlock(
  font: Font,
  text: string,
  spec: MultilineSpec,
  defaultColor: string,
  field: string,
  label: string,
): LaidOutBlock | CertificateFieldErrorLike {
  const missing = findUnsupportedChars(font, text);
  if (missing.length > 0) {
    return {
      field,
      code: "UNSUPPORTED_CHARACTER",
      message: `${label}에 증명서 서체가 지원하지 않는 문자가 있습니다: ${missing.slice(0, 5).join(" ")}`,
    };
  }

  for (let size = spec.fontSize; size >= spec.minFontSize; size -= 1) {
    const wrapped = wrapLines(font, text, size, spec.maxWidth);
    if (wrapped.length === 0 || wrapped.length > spec.maxLines) continue;
    // 실제로 각 줄이 maxWidth 안에 들어가는지 재확인(글자 단위 분해 후 마지막 조각 등).
    if (wrapped.some((line) => measure(font, line, size) > spec.maxWidth)) continue;

    const color = spec.color ?? defaultColor;
    const lines = wrapped.map((line, i) => {
      const advance = measure(font, line, size);
      return { text: line, x: spec.x - advance / 2, y: spec.y + i * spec.lineHeight };
    });
    return { kind: "block", lines, fontSize: size, color };
  }

  return {
    field,
    code: "FIELD_OVERFLOW",
    message: `${label}이(가) 증명서의 기입 칸을 벗어납니다. 더 짧게 입력해주세요.`,
  };
}

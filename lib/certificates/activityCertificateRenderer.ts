import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFDocument, PageSizes } from "pdf-lib";
import type { Font } from "opentype.js";
import {
  ACTIVITY_CERTIFICATE_TEMPLATE,
  CERTIFICATE_FIELD_LABELS,
  CERTIFICATE_RENDER_SLOTS,
  type CertificateRenderSlot,
  type CertificateSlotSpec,
} from "./activityCertificateTemplate";
import {
  buildRenderValues,
  type ActivityCertificateInput,
  type CertificateFieldError,
} from "./activityCertificateValidation";
import { loadCertificateAssets } from "./activityCertificateAssets";

// 활동 증명서 이미지 생성 — preview 와 issue 가 공유하는 유일한 생성 경로.
// ─────────────────────────────────────────────────────────────────────────────
// 파이프라인: 템플릿 PNG + (opentype.js 로 벡터 path 화한 텍스트 레이어) + QR PNG
//             → sharp composite.
//
// 왜 <text> 가 아니라 <path> 인가:
//   1. 서버(특히 Vercel)의 fontconfig/librsvg 폰트 등록 상태에 전혀 의존하지 않는다.
//      SVG 안에 폰트 참조가 남지 않으므로 한글 두부(tofu)가 원천적으로 불가능하다.
//   2. getAdvanceWidth 로 잰 폭이 곧 렌더될 폭이라 maxWidth/축소 판정이 실제 결과와
//      어긋날 수 없다.
//   3. 사용자 문자열이 XML 직렬화기에 도달하지 않는다 → SVG 주입면 0.
//
// 템플릿에 이미 인쇄된 것(제목·라벨·고정 문구·사슴 금장·도장·[ 주 ]·년/월/일)은 다시
// 그리지 않는다. 서버가 얹는 것은 빈칸 값과 QR 뿐이다.
//
// PDF 는 여기서 만든 PNG 버퍼를 재렌더 없이 그대로 임베드한다(위치 불일치 불가능).
// ─────────────────────────────────────────────────────────────────────────────

/** 렌더 자체가 불가능한 내부 오류(글리프 경로 생성 실패 등). 사용자 입력 탓이 아니다. */
export class CertificateRenderError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "CertificateRenderError";
  }
}

export class CertificateLayoutError extends Error {
  status = 422;
  errors: CertificateFieldError[];

  constructor(errors: CertificateFieldError[]) {
    super(errors[0]?.message ?? "증명서 레이아웃 오류");
    this.name = "CertificateLayoutError";
    this.errors = errors;
  }
}

// ── 글리프 path 직렬화 ───────────────────────────────────────────────────────
//
// ⚠️ opentype.js 2.0.0 의 Path.toPathData() 를 쓰지 않는다.
//    특정 부동소수 좌표에서 좌표 하나를 리터럴 "NaN" 으로 출력한다(실측: `MNaN 64.51`).
//    그러면 librsvg 가 그 서브패스 이후를 조용히 버려 "오랑캐"가 "오라"로 렌더되는 등
//    글자가 소리 없이 사라진다. 예외도 경고도 없다. 증명서는 법적 문서이므로 이런
//    무성 손실은 허용할 수 없어 직접 직렬화한다. (되돌리지 말 것.)

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

function serializeGlyphPath(commands: PathCommand[]): string | null {
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

// ── 측정 / 배치 ─────────────────────────────────────────────────────────────

function measure(font: Font, text: string, size: number): number {
  return font.getAdvanceWidth(text, size, { kerning: true });
}

/**
 * 폰트에 없는 글자는 opentype 이 .notdef(빈/네모 path)로 그려 조용한 두부가 된다.
 * 대체하지 않고 검증 오류로 사용자에게 알린다.
 */
function findUnsupportedChars(font: Font, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (ch === " ") continue;
    if (font.charToGlyphIndex(ch) === 0) missing.add(ch);
  }
  return Array.from(missing);
}

/** 슬롯 라벨 — 오류 메시지에 쓰는 사람이 읽는 이름. */
const SLOT_LABELS: Record<CertificateRenderSlot, string> = {
  clubName: CERTIFICATE_FIELD_LABELS.clubName,
  industryField: CERTIFICATE_FIELD_LABELS.industryField,
  name: CERTIFICATE_FIELD_LABELS.name,
  birthDate: CERTIFICATE_FIELD_LABELS.birthDate,
  clubEliteCode: CERTIFICATE_FIELD_LABELS.clubEliteCode,
  graduationGrade: CERTIFICATE_FIELD_LABELS.graduationGrade,
  activityPeriod: "활동 기간",
  activityWeeks: CERTIFICATE_FIELD_LABELS.activityWeeks,
  activityForm: CERTIFICATE_FIELD_LABELS.activityForm,
  issueYear: "발급 연도",
  issueMonth: "발급 월",
  issueDay: "발급 일",
};

/** 슬롯 → 사용자가 고칠 수 있는 입력 필드(검증 오류를 폼 필드에 붙이기 위한 매핑). */
const SLOT_TO_INPUT_FIELD: Record<CertificateRenderSlot, string> = {
  clubName: "clubName",
  industryField: "industryField",
  name: "name",
  birthDate: "birthDate",
  clubEliteCode: "clubEliteCode",
  graduationGrade: "graduationGrade",
  activityPeriod: "activityStartDate",
  activityWeeks: "activityWeeks",
  activityForm: "activityForm",
  issueYear: "issueDate",
  issueMonth: "issueDate",
  issueDay: "issueDate",
};

interface LaidOutSlot {
  slot: CertificateRenderSlot;
  spec: CertificateSlotSpec;
  text: string;
  fontSize: number;
}

/**
 * 슬롯 하나의 배치를 결정. 모든 칸이 한 줄이므로 줄바꿈은 없고 축소만 한다.
 *   fontSize 부터 1px 씩 minFontSize 까지 줄이며 maxWidth 안에 들어가는 크기를 찾는다.
 *   끝내 못 찾으면 잘라내지 않고 FIELD_OVERFLOW — 값이 잘린 증명서를 만들지 않는다.
 */
function layoutSlot(
  font: Font,
  slot: CertificateRenderSlot,
  text: string,
  spec: CertificateSlotSpec,
): LaidOutSlot | CertificateFieldError {
  const label = SLOT_LABELS[slot];
  const field = SLOT_TO_INPUT_FIELD[slot];

  const missing = findUnsupportedChars(font, text);
  if (missing.length > 0) {
    return {
      field,
      code: "UNSUPPORTED_CHARACTER",
      message: `${label}에 증명서 서체가 지원하지 않는 문자가 있습니다: ${missing.slice(0, 5).join(" ")}`,
    };
  }

  for (let size = spec.fontSize; size >= spec.minFontSize; size -= 1) {
    if (measure(font, text, size) <= spec.maxWidth) {
      return { slot, spec, text, fontSize: size };
    }
  }

  return {
    field,
    code: "FIELD_OVERFLOW",
    message: `${label}이(가) 증명서의 기입 칸을 벗어납니다. 더 짧게 입력해주세요.`,
  };
}

// ── 렌더 ────────────────────────────────────────────────────────────────────

export interface RenderedCertificate {
  png: Buffer;
  width: number;
  height: number;
  /** 동일 입력 → 동일 바이트임을 검증/비교하기 위한 체크섬. */
  checksum: string;
}

export interface RenderCertificateOptions {
  /** Resume Link 칸에 넣을 QR PNG. 서버가 effectiveUserId 로만 만든 것이어야 한다. */
  qrPng?: Buffer | null;
}

/**
 * 최종 증명서 PNG 생성. preview 와 issue 가 **동일하게** 호출하는 유일한 함수.
 *
 * @throws CertificateLayoutError (422)  칸을 벗어나거나 미지원 문자 포함
 * @throws CertificateAssetError  (503)  템플릿/폰트 미등록
 * @throws CertificateRenderError (500)  글리프 경로 생성 실패
 */
export async function renderActivityCertificatePng(
  input: ActivityCertificateInput,
  options: RenderCertificateOptions = {},
): Promise<RenderedCertificate> {
  const { templatePng, font } = await loadCertificateAssets();
  const tpl = ACTIVITY_CERTIFICATE_TEMPLATE;
  const values = buildRenderValues(input);

  // 템플릿 실제 크기를 읽어 텍스트 레이어 크기를 맞춘다(설정값보다 파일 메타를 우선).
  const meta = await sharp(templatePng).metadata();
  const width = meta.width ?? tpl.width;
  const height = meta.height ?? tpl.height;

  const errors: CertificateFieldError[] = [];
  const laidOut: LaidOutSlot[] = [];
  for (const slot of CERTIFICATE_RENDER_SLOTS) {
    const text = values[slot];
    if (!text) continue; // 빈 슬롯은 그리지 않는다(검증에서 이미 필수값을 걸렀다).
    const result = layoutSlot(font, slot, text, tpl.slots[slot]);
    if ("code" in result) errors.push(result);
    else laidOut.push(result);
  }
  if (errors.length > 0) throw new CertificateLayoutError(errors);

  // 색상별로 <g> 를 묶는다 — 활동 형태만 분홍 배너 위라 흰색이다.
  // fill 값은 프리즈된 템플릿 상수에서만 온다(사용자 입력 미유입).
  const pathsByColor = new Map<string, string[]>();
  for (const { slot, spec, text, fontSize } of laidOut) {
    const advance = measure(font, text, fontSize);
    const x =
      spec.align === "left"
        ? spec.x
        : spec.align === "center"
          ? spec.x - advance / 2
          : spec.x - advance;
    const commands = font.getPath(text, x, spec.y, fontSize, { kerning: true })
      .commands as unknown as PathCommand[];
    const d = serializeGlyphPath(commands);
    if (d === null) {
      throw new CertificateRenderError(`슬롯 '${slot}' 의 글리프 경로를 생성하지 못했습니다.`);
    }
    if (d.length === 0) continue;
    const color = spec.color ?? tpl.defaultTextColor;
    const list = pathsByColor.get(color) ?? [];
    list.push(`<path d="${d}"/>`);
    pathsByColor.set(color, list);
  }

  const groups = Array.from(pathsByColor, ([color, paths]) => `<g fill="${color}">${paths.join("")}</g>`);

  // ⚠️ sharp/librsvg 는 viewBox 가 아니라 width/height 속성으로 래스터화한다.
  //    둘이 어긋나면 조용히 스케일링돼 좌표가 밀린다 — 반드시 동일하게 유지한다.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${groups.join("")}</svg>`;

  const overlays: sharp.OverlayOptions[] = [];

  if (options.qrPng) {
    // QR 은 벡터 텍스트와 무관한 별도 래스터 오버레이 — 템플릿의 Resume Link 흰 박스 안에 놓는다.
    overlays.push({ input: options.qrPng, left: tpl.qr.left, top: tpl.qr.top });
  }

  const textLayer = await sharp(Buffer.from(svg, "utf8"), { density: 72 }).png().toBuffer();
  overlays.push({ input: textLayer, top: 0, left: 0 });

  const png = await sharp(templatePng)
    .composite(overlays)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    png,
    width,
    height,
    checksum: createHash("sha256").update(png).digest("hex"),
  };
}

// ── PDF (A4 세로) ───────────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4;

/** mm → pt. 소수 2자리로 반올림해 A4 가 정확히 595.28 x 841.89(뷰어 표준값)가 되게 한다. */
function mmToPt(mm: number): number {
  return Math.round(mm * MM_TO_PT * 100) / 100;
}

/** A4 세로 페이지 규격(pt). pdf-lib 의 PageSizes.A4 와 동일한 값이어야 한다. */
export const A4_PORTRAIT_PT = {
  width: mmToPt(ACTIVITY_CERTIFICATE_TEMPLATE.pdf.pageWidthMm),
  height: mmToPt(ACTIVITY_CERTIFICATE_TEMPLATE.pdf.pageHeightMm),
  margin: mmToPt(ACTIVITY_CERTIFICATE_TEMPLATE.pdf.marginMm),
} as const;

// 설정 mm 값에서 계산한 페이지 크기가 pdf-lib 의 표준 A4 와 어긋나면 즉시 실패시킨다.
// (뷰어/프린터가 "A4" 로 인식하지 못하는 어중간한 페이지가 조용히 나가는 것을 막는다.)
{
  const [a4Width, a4Height] = PageSizes.A4;
  if (A4_PORTRAIT_PT.width !== a4Width || A4_PORTRAIT_PT.height !== a4Height) {
    throw new Error(
      `[certificates] A4 페이지 규격 불일치: 계산=${A4_PORTRAIT_PT.width}x${A4_PORTRAIT_PT.height}, ` +
        `pdf-lib PageSizes.A4=${a4Width}x${a4Height}`,
    );
  }
}

/**
 * 렌더된 PNG 를 **A4 세로 1페이지** PDF 로 감싼다.
 * 재렌더가 없으므로 PNG 와 PDF 의 내용·텍스트 위치는 100% 동일하다.
 *
 * 배치 규칙:
 *   · 페이지 = 항상 A4 세로(210x297mm = 595.28x841.89pt). 이미지 픽셀 크기와 무관하다.
 *   · 이미지 = 비율을 유지한 채 인쇄 가능 영역(여백 제외)에 들어가는 **최대 배율**(contain).
 *     min(가용폭/이미지폭, 가용높이/이미지높이) 이므로 잘림이 발생할 수 없다.
 *   · 상하좌우 중앙 정렬.
 *
 * 템플릿(0.750)과 A4(0.707) 종횡비가 달라 폭이 먼저 한계에 닿는다 → 좌우는 여백값 그대로,
 * 위아래는 그보다 큰 여백이 남는다. 잘라내지 않는 한 피할 수 없는 결과다.
 *
 * ⚠️ 이전 구현은 페이지 크기를 픽셀/150dpi 로 잡아 183.9x245.2mm 비표준 용지를 만들었다.
 *    그러면 뷰어가 인쇄 시 "용지에 맞춤" 축소를 걸어 100% 배율 출력이 A4 에 맞지 않았다.
 *    (되돌리지 말 것.)
 */
export async function renderActivityCertificatePdf(
  rendered: RenderedCertificate,
  issueDateIso: string,
): Promise<Buffer> {
  const { width: pageWidth, height: pageHeight, margin } = A4_PORTRAIT_PT;
  const availWidth = pageWidth - margin * 2;
  const availHeight = pageHeight - margin * 2;

  const doc = await PDFDocument.create();
  const image = await doc.embedPng(rendered.png);

  const scale = Math.min(availWidth / image.width, availHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  // PDF 좌표계 원점은 좌하단. 중앙 정렬이라 상하 대칭이므로 y 계산도 동일하다.
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = (pageHeight - drawHeight) / 2;

  const page = doc.addPage([pageWidth, pageHeight]);
  page.drawImage(image, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });

  // pdf-lib 는 기본적으로 현재 시각을 CreationDate/ModDate 에 박는다 → 같은 입력인데도
  // 호출할 때마다 파일 바이트가 달라진다. 증명서 문서의 날짜는 "발급일" 이므로 그 값으로
  // 고정해 동일 입력 → 동일 산출물(재현 가능)이 되게 한다.
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(issueDateIso)
    ? new Date(`${issueDateIso}T00:00:00.000Z`)
    : new Date(0);
  doc.setCreationDate(stamp);
  doc.setModificationDate(stamp);
  doc.setProducer("vraxium");
  doc.setCreator("vraxium");

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── 파일명 ──────────────────────────────────────────────────────────────────

/**
 * 출력 파일명 — 사용자 입력을 그대로 쓰지 않는다.
 * ASCII 고정 패턴 + 렌더 결과에서 파생된 짧은 해시만 사용한다.
 */
export function buildCertificateFileName(
  rendered: RenderedCertificate,
  issueDateIso: string,
  ext: "png" | "pdf",
): string {
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(issueDateIso)
    ? issueDateIso.replace(/-/g, "")
    : "00000000";
  return `activity-certificate-${datePart}-${rendered.checksum.slice(0, 8)}.${ext}`;
}

/** RFC 6266 — ASCII filename 만 사용(사용자 입력 유래 문자가 없으므로 filename* 불필요). */
export function buildContentDisposition(
  disposition: "inline" | "attachment",
  fileName: string,
): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${disposition}; filename="${safe}"`;
}

import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  ACTIVITY_CERTIFICATE_TEMPLATE,
  CERTIFICATE_FIELD_LABELS,
  CERTIFICATE_RENDER_SLOTS,
  type CertificateRenderSlot,
} from "./activityCertificateTemplate";
import {
  buildRenderValues,
  type ActivityCertificateInput,
  type CertificateFieldError,
} from "./activityCertificateValidation";
import { loadCertificateAssets } from "./activityCertificateAssets";
import {
  CertificateLayoutError,
  CertificateRenderError,
  glyphPathData,
  isFieldError,
  layoutSingleLine,
  type LaidOutLine,
} from "./certificateGlyphRender";
import { A4_PORTRAIT_PT, renderCertificatePdfA4 } from "./certificatePdf";

export { CertificateLayoutError, CertificateRenderError };
export { A4_PORTRAIT_PT };

// 활동 증명서 이미지 생성 — preview 와 issue 가 공유하는 유일한 생성 경로.
// ─────────────────────────────────────────────────────────────────────────────
// 파이프라인: 템플릿 PNG + (opentype.js 로 벡터 path 화한 텍스트 레이어) + QR PNG
//             → sharp composite. 텍스트 레이아웃 엔진(글리프 직렬화·측정·자동 축소)은
//             certificateGlyphRender.ts 공용 구현을 그대로 쓴다 — 여기서는 활동
//             증명서 고유의 슬롯 목록/좌표만 다룬다(경력 증명서 분기 없음).
//
// 템플릿에 이미 인쇄된 것(제목·라벨·고정 문구·사슴 금장·도장·[ 주 ]·년/월/일)은 다시
// 그리지 않는다. 서버가 얹는 것은 빈칸 값과 QR 뿐이다.
//
// PDF 는 certificatePdf.ts 의 공용 renderCertificatePdfA4 를 그대로 써서, 여기서 만든
// PNG 버퍼를 재렌더 없이 그대로 임베드한다(위치 불일치 불가능).
// ─────────────────────────────────────────────────────────────────────────────

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
  const laidOut: LaidOutLine[] = [];
  for (const slot of CERTIFICATE_RENDER_SLOTS) {
    const text = values[slot];
    if (!text) continue; // 빈 슬롯은 그리지 않는다(검증에서 이미 필수값을 걸렀다).
    const spec = tpl.slots[slot];
    const result = layoutSingleLine(
      font,
      text,
      spec,
      tpl.defaultTextColor,
      SLOT_TO_INPUT_FIELD[slot],
      SLOT_LABELS[slot],
    );
    if (isFieldError(result)) errors.push(result as CertificateFieldError);
    else laidOut.push(result);
  }
  if (errors.length > 0) throw new CertificateLayoutError(errors);

  // 색상별로 <g> 를 묶는다 — 활동 형태만 분홍 배너 위라 흰색이다.
  const pathsByColor = new Map<string, string[]>();
  for (const line of laidOut) {
    const d = glyphPathData(font, line.text, line.x, line.y, line.fontSize);
    if (d === null) {
      throw new CertificateRenderError(`텍스트 '${line.text}' 의 글리프 경로를 생성하지 못했습니다.`);
    }
    if (d.length === 0) continue;
    const list = pathsByColor.get(line.color) ?? [];
    list.push(`<path d="${d}"/>`);
    pathsByColor.set(line.color, list);
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
// 공용 구현(certificatePdf.ts)을 그대로 재노출한다 — 경력 증명서와 동일 함수.

export async function renderActivityCertificatePdf(
  rendered: RenderedCertificate,
  issueDateIso: string,
): Promise<Buffer> {
  return renderCertificatePdfA4(rendered, issueDateIso);
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

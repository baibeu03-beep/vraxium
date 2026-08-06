import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  CAREER_CERTIFICATE_TEMPLATE,
  CAREER_CERTIFICATE_FIELD_LABELS,
  CAREER_CERTIFICATE_RENDER_SLOTS,
  type CareerCertificateRenderSlot,
  type Organization,
} from "./careerCertificateTemplate";
import {
  buildCareerRenderValues,
  type CareerCertificateInput,
  type CertificateFieldError,
} from "./careerCertificateValidation";
import { loadCareerCertificateAssets } from "./careerCertificateAssets";
import {
  CertificateLayoutError,
  CertificateRenderError,
  glyphPathData,
  isFieldError,
  layoutMultilineBlock,
  layoutSingleLine,
  type LaidOutBlock,
  type LaidOutLine,
} from "./certificateGlyphRender";
import { A4_PORTRAIT_PT, renderCertificatePdfA4 } from "./certificatePdf";

export { CertificateLayoutError, CertificateRenderError };
export { A4_PORTRAIT_PT };

// 경력 증명서 이미지 생성 — preview 와 issue 가 공유하는 유일한 생성 경로.
// ─────────────────────────────────────────────────────────────────────────────
// 활동증명서 renderer(activityCertificateRenderer.ts)와 완전히 동일한 기술을 쓰되
// (opentype.js 벡터 path → sharp composite, 공용 글리프 레이아웃 엔진, 공용 PDF
// 래퍼, 공용 폰트 로더), 별도 파일의 별도 함수로 존재한다 — 활동증명서 renderer
// 내부에 type 분기를 추가하지 않는다.
//
// 경력 증명서는 QR 이 없다(Resume Link 칸 자체가 템플릿에 없음). 대신 하단 증명
// 문구가 조직 컨텍스트에 따라 달라지는 멀티라인 블록이라 layoutMultilineBlock 을
// 추가로 쓴다(활동증명서는 전부 한 줄 슬롯이라 이 경로를 타지 않는다).
//
// ⚠️ affiliation(소속)·academicRecord(학과사항) 슬롯은 사용자 입력을 받지 않는다.
//    호출부(careerCertificateApi.ts)가 서버에서 확정한 organizationDisplayName·
//    academicRecord 문자열만 넘긴다 — 이 함수는 그 값을 그대로 그릴 뿐, body 의
//    affiliation/education 값을 절대 참조하지 않는다(애초에 CareerCertificateInput
//    타입에 그 키가 없다).
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<CareerCertificateRenderSlot, string> = {
  name: CAREER_CERTIFICATE_FIELD_LABELS.name,
  birthDate: CAREER_CERTIFICATE_FIELD_LABELS.birthDate,
  // 소속/학과사항은 더 이상 입력 필드가 아니라 CAREER_CERTIFICATE_FIELD_LABELS 에 없다
  // — 오류 메시지에 쓰는 사람이 읽는 이름만 여기 직접 둔다.
  affiliation: "소속",
  academicRecord: "학적사항",
  taskName: CAREER_CERTIFICATE_FIELD_LABELS.taskName,
  careerPeriod: "경력 기간",
  issueYear: "발급 연도",
  issueMonth: "발급 월",
  issueDay: "발급 일",
};

/**
 * 슬롯 → 오류 귀속 필드명. affiliation/academicRecord 는 실제 폼 입력이 아니므로
 * (사용자가 고칠 수 있는 <input> 이 없다) 폼 필드명이 아니라 원인을 가리키는 합성
 * 키를 쓴다 — 클라이언트는 이 값으로 "조직을 다시 확인" / "학력 정보를 등록" 안내로
 * 분기할 수 있다(둘 다 사실상 발생 가능성이 매우 낮다 — 이름이 짧아 오버플로 여지가
 * 거의 없다. 그래도 잘라내지 않고 422 로 정직하게 알리는 원칙은 유지한다).
 */
const SLOT_TO_INPUT_FIELD: Record<CareerCertificateRenderSlot, string> = {
  name: "name",
  birthDate: "birthDate",
  affiliation: "organization",
  academicRecord: "academicRecord",
  taskName: "taskName",
  careerPeriod: "careerStartDate",
  issueYear: "issueDate",
  issueMonth: "issueDate",
  issueDay: "issueDate",
};

export interface RenderedCertificate {
  png: Buffer;
  width: number;
  height: number;
  checksum: string;
}

/**
 * 최종 경력 증명서 PNG 생성. preview 와 issue 가 **동일하게** 호출하는 유일한 함수.
 *
 * @param org 서버가 확정한 조직 컨텍스트(요청 body 유래 아님) — 하단 증명 문구에 쓰인다.
 * @param organizationDisplayName 표의 소속 칸에 찍을 짧은 조직명(예: "엥크레") —
 *   ORGANIZATION_CONFIG[org].displayNameKo 에서 호출부가 확정해 넘긴다.
 * @param academicRecord 표의 학과사항 칸에 찍을 "{대학교명} {학과명}" — 호출부가
 *   사용자의 등록된 학력 정보에서 확정해 넘긴다(둘 중 하나라도 없으면 호출부가
 *   ACADEMIC_RECORD_MISSING 으로 이 함수 자체를 호출하지 않는다).
 *
 * @throws CertificateLayoutError (422)  칸/블록을 벗어나거나 미지원 문자 포함
 * @throws CertificateAssetError  (503)  템플릿/폰트 미등록
 * @throws CertificateRenderError (500)  글리프 경로 생성 실패
 */
export async function renderCareerCertificatePng(
  input: CareerCertificateInput,
  org: Organization,
  organizationDisplayName: string,
  academicRecord: string,
): Promise<RenderedCertificate> {
  const { templatePng, font } = await loadCareerCertificateAssets();
  const tpl = CAREER_CERTIFICATE_TEMPLATE;
  const { slots: values, careerDescription, verificationText } = buildCareerRenderValues(
    input,
    org,
    organizationDisplayName,
    academicRecord,
  );

  const meta = await sharp(templatePng).metadata();
  const width = meta.width ?? tpl.width;
  const height = meta.height ?? tpl.height;

  const errors: CertificateFieldError[] = [];
  const laidOutLines: LaidOutLine[] = [];
  for (const slot of CAREER_CERTIFICATE_RENDER_SLOTS) {
    const text = values[slot];
    if (!text) continue;
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
    else laidOutLines.push(result);
  }

  const laidOutBlocks: LaidOutBlock[] = [];
  if (careerDescription) {
    const result = layoutMultilineBlock(
      font,
      careerDescription,
      tpl.careerDescriptionBlock,
      tpl.defaultTextColor,
      "careerDescription",
      CAREER_CERTIFICATE_FIELD_LABELS.careerDescription,
    );
    if (isFieldError(result)) errors.push(result as CertificateFieldError);
    else laidOutBlocks.push(result);
  }
  {
    // 증명 문구는 사용자 입력 필드가 아니므로 오류가 나면 "affiliation"(소속 자체가
    // 아니라 조직 매핑 결과) 이 아니라 폼에 없는 가상의 필드로 보고한다 — 서버 설정
    // 문제(문구가 너무 김)라는 신호이지 사용자가 고칠 수 있는 값이 아니다.
    const result = layoutMultilineBlock(
      font,
      verificationText,
      tpl.verificationTextBlock,
      tpl.defaultTextColor,
      "verificationText",
      "증명 문구",
    );
    if (isFieldError(result)) errors.push(result as CertificateFieldError);
    else laidOutBlocks.push(result);
  }

  if (errors.length > 0) throw new CertificateLayoutError(errors);

  const pathsByColor = new Map<string, string[]>();
  const addPath = (d: string | null, color: string, sourceLabel: string) => {
    if (d === null) {
      throw new CertificateRenderError(`'${sourceLabel}' 의 글리프 경로를 생성하지 못했습니다.`);
    }
    if (d.length === 0) return;
    const list = pathsByColor.get(color) ?? [];
    list.push(`<path d="${d}"/>`);
    pathsByColor.set(color, list);
  };

  for (const line of laidOutLines) {
    addPath(glyphPathData(font, line.text, line.x, line.y, line.fontSize), line.color, line.text);
  }
  for (const block of laidOutBlocks) {
    for (const line of block.lines) {
      addPath(glyphPathData(font, line.text, line.x, line.y, block.fontSize), block.color, line.text);
    }
  }

  const groups = Array.from(pathsByColor, ([color, paths]) => `<g fill="${color}">${paths.join("")}</g>`);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${groups.join("")}</svg>`;

  const textLayer = await sharp(Buffer.from(svg, "utf8"), { density: 72 }).png().toBuffer();
  const png = await sharp(templatePng)
    .composite([{ input: textLayer, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    png,
    width,
    height,
    checksum: createHash("sha256").update(png).digest("hex"),
  };
}

// ── PDF (A4 세로) — 활동증명서와 동일한 공용 구현을 그대로 재노출 ───────────

export async function renderCareerCertificatePdf(
  rendered: RenderedCertificate,
  issueDateIso: string,
): Promise<Buffer> {
  return renderCertificatePdfA4(rendered, issueDateIso);
}

// ── 파일명 ──────────────────────────────────────────────────────────────────

export function buildCareerCertificateFileName(
  rendered: RenderedCertificate,
  issueDateIso: string,
  ext: "png" | "pdf",
): string {
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(issueDateIso) ? issueDateIso.replace(/-/g, "") : "00000000";
  return `career-certificate-${datePart}-${rendered.checksum.slice(0, 8)}.${ext}`;
}

export function buildContentDisposition(disposition: "inline" | "attachment", fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${disposition}; filename="${safe}"`;
}

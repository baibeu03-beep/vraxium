import "server-only";
import { PDFDocument, PageSizes } from "pdf-lib";

// 증명서 공통 PDF 변환 — 활동 증명서 · 경력 증명서가 **같은 함수**를 호출한다.
// ─────────────────────────────────────────────────────────────────────────────
// 렌더된 PNG 를 **A4 세로 1페이지** PDF 로 감싼다. 재렌더가 없으므로 PNG 와 PDF 의
// 내용·텍스트 위치는 100% 동일하다(같은 PNG 바이트를 그대로 임베드 — 텍스트/QR 을
// PDF 용으로 다시 그리지 않는다).
//
// 배치 규칙(증명서 종류와 무관하게 고정):
//   · 페이지 = 항상 A4 세로(210x297mm = 595.28x841.89pt). 이미지 픽셀 크기와 무관하다.
//   · 사방 안전 여백 = 12.7mm(=36.00pt, mmToPt(12.7) 은 반올림 오차 없이 정확히 떨어진다).
//   · 이미지 = 비율을 유지한 채 여백을 뺀 가용 영역에 들어가는 **최대 배율**(contain).
//     scale = min(가용폭/이미지폭, 가용높이/이미지높이) 이므로 잘림·왜곡이 발생할 수 없다.
//   · 상하좌우 중앙 정렬 — 불필요한 추가 여백 없이 가용 영역을 꽉 채운다.
//
// ⚠️ 페이지 크기를 이미지 픽셀/DPI 로 잡지 않는다(그러면 뷰어가 "용지에 맞춤" 축소를
//    걸고 100% 배율 인쇄가 A4 에 맞지 않는다). 페이지는 항상 고정 A4, 여백도 항상
//    고정 12.7mm — 이미지 크기는 contain 배율에만 영향을 준다. (되돌리지 말 것.)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 12.7;

const MM_TO_PT = 72 / 25.4;

/** mm → pt. 소수 2자리로 반올림해 A4 가 정확히 595.28 x 841.89(뷰어 표준값)가 되게 한다. */
export function mmToPt(mm: number): number {
  return Math.round(mm * MM_TO_PT * 100) / 100;
}

/** A4 세로 페이지 규격(pt). pdf-lib 의 PageSizes.A4 와 동일한 값이어야 한다. */
export const A4_PORTRAIT_PT = {
  width: mmToPt(PAGE_WIDTH_MM),
  height: mmToPt(PAGE_HEIGHT_MM),
  margin: mmToPt(MARGIN_MM),
} as const;

// 계산한 페이지 크기가 pdf-lib 의 표준 A4 와 어긋나면 즉시 실패시킨다.
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

export interface RenderedCertificateLike {
  png: Buffer;
  width: number;
  height: number;
}

/**
 * 렌더된 증명서 PNG → A4 세로 1페이지 PDF. 증명서 타입 무관 공통 구현.
 * @throws never (렌더 자체 실패는 이 함수에 도달하기 전 단계에서 처리된다)
 */
export async function renderCertificatePdfA4(
  rendered: RenderedCertificateLike,
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

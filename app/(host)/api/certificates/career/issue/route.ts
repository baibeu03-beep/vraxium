import { NextResponse } from "next/server";
import {
  buildCareerCertificateFileName,
  buildContentDisposition,
  renderCareerCertificatePdf,
} from "@/lib/certificates/careerCertificateRenderer";
import {
  certificateErrorPayload,
  certificateErrorResponse,
  prepareCareerCertificate,
  readJsonBody,
} from "@/lib/certificates/careerCertificateApi";

// POST /api/certificates/career/issue?format=png|pdf&org=encre|oranke|phalanx
// 최종 발급물 다운로드.
//
// preview 와 동일한 prepareCareerCertificate → 동일한 PNG 버퍼를 만든 뒤, format=pdf
// 일 때만 그 **같은 바이트**를 활동증명서와 공유하는 A4 PDF 래퍼(renderCareerCertificatePdf
// → certificatePdf.ts 의 renderCertificatePdfA4)로 감싼다(재렌더 없음).

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const TAG = "[api/certificates/career/issue]";

export async function POST(request: Request) {
  try {
    let format = "png";
    try {
      format = (new URL(request.url).searchParams.get("format") ?? "png").toLowerCase();
    } catch {
      format = "png";
    }
    if (format !== "png" && format !== "pdf") {
      return NextResponse.json(
        certificateErrorPayload("format", "format 은 png 또는 pdf 만 지원합니다.", {
          code: "INVALID_FORMAT",
        }),
        { status: 400 },
      );
    }

    const body = await readJsonBody(request);
    const prepared = await prepareCareerCertificate(request, body);
    if (!prepared.ok) return prepared.response;

    const { rendered, input, org } = prepared.value;
    const fileName = buildCareerCertificateFileName(rendered, input.issueDate, format);

    let payload: Buffer;
    let contentType: string;
    if (format === "pdf") {
      try {
        payload = await renderCareerCertificatePdf(rendered, input.issueDate);
      } catch (e) {
        const mapped = certificateErrorResponse(e);
        if (mapped) return mapped;
        throw e;
      }
      contentType = "application/pdf";
    } else {
      payload = rendered.png;
      contentType = "image/png";
    }

    return new NextResponse(new Uint8Array(payload), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(payload.byteLength),
        "Content-Disposition": buildContentDisposition("attachment", fileName),
        "Cache-Control": "no-store, private",
        // PNG 기준 체크섬 — PDF 응답에서도 같은 값이라 preview↔issue 동일성을 검증할 수 있다.
        "X-Certificate-Checksum": rendered.checksum,
        "X-Certificate-Width": String(rendered.width),
        "X-Certificate-Height": String(rendered.height),
        "X-Certificate-Org": org,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${TAG} unexpected`, message);
    return NextResponse.json(
      certificateErrorPayload("unexpected", "증명서를 발급하지 못했습니다.", {
        code: "INTERNAL_ERROR",
      }),
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  buildCertificateFileName,
  buildContentDisposition,
  renderActivityCertificatePdf,
} from "@/lib/certificates/activityCertificateRenderer";
import {
  certificateErrorPayload,
  certificateErrorResponse,
  prepareCertificate,
  readJsonBody,
} from "@/lib/certificates/activityCertificateApi";

// POST /api/certificates/activity/issue?format=png|pdf
// 최종 발급물 다운로드.
//
// preview 와 동일한 prepareCertificate → 동일한 PNG 버퍼를 만든 뒤, format=pdf 일 때만
// 그 **같은 바이트**를 1페이지 PDF 로 감싼다(재렌더 없음 → 텍스트 위치 불일치 불가능).
// 라우트를 둘로 나누지 않은 이유: 인증·금지키 검사·검증·컨텍스트 로드·PNG 생성이 100%
// 공유되고 마지막 래핑만 다르다. 나누면 preview/issue 드리프트가 가장 유력한 버그가 된다.
//
// TODO(phase2): 발급 이력 저장 · 발급 자격 조건 · 관리자 승인 · 발급번호/QR 은 이 지점에
//   훅으로 추가한다(현재 단계에서는 DB 기록 없음).

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const TAG = "[api/certificates/activity/issue]";

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
    const prepared = await prepareCertificate(request, body);
    if (!prepared.ok) return prepared.response;

    const { rendered, input, resumeUrl } = prepared.value;
    const fileName = buildCertificateFileName(rendered, input.issueDate, format);

    let payload: Buffer;
    let contentType: string;
    if (format === "pdf") {
      try {
        payload = await renderActivityCertificatePdf(rendered, input.issueDate);
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
        // QR 목적지 검증용(서버가 만든 값 — 요청으로 바꿀 수 없다).
        "X-Certificate-Resume-Url": resumeUrl,
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

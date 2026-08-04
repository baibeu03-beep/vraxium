import { NextResponse } from "next/server";
import {
  buildCertificateFileName,
  buildContentDisposition,
} from "@/lib/certificates/activityCertificateRenderer";
import {
  certificateErrorPayload,
  prepareCertificate,
  readJsonBody,
} from "@/lib/certificates/activityCertificateApi";

// POST /api/certificates/activity/preview
// 미리보기 PNG. issue 와 **완전히 동일한** prepareCertificate 파이프라인을 타므로,
// 미리보기와 최종 발급물의 줄바꿈/좌표/바이트가 달라질 수 없다.
// 클라이언트는 이 응답 이미지를 그대로 <img> 로 띄운다(브라우저 canvas 합성 없음).

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const TAG = "[api/certificates/activity/preview]";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const prepared = await prepareCertificate(request, body);
    if (!prepared.ok) return prepared.response;

    const { rendered, input, resumeUrl } = prepared.value;
    const fileName = buildCertificateFileName(rendered, input.issueDate, "png");

    return new NextResponse(new Uint8Array(rendered.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(rendered.png.byteLength),
        "Content-Disposition": buildContentDisposition("inline", fileName),
        "Cache-Control": "no-store, private",
        "X-Certificate-Checksum": rendered.checksum,
        "X-Certificate-Width": String(rendered.width),
        "X-Certificate-Height": String(rendered.height),
        "X-Certificate-Resume-Url": resumeUrl,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${TAG} unexpected`, message);
    return NextResponse.json(
      certificateErrorPayload("unexpected", "미리보기를 생성하지 못했습니다.", {
        code: "INTERNAL_ERROR",
      }),
      { status: 500 },
    );
  }
}

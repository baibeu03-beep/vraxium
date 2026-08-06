import { NextResponse } from "next/server";
import {
  buildCareerCertificatePageDto,
  loadCareerCertificateUserContext,
  resolveCareerCertificateOrg,
} from "@/lib/certificates/careerCertificateContext";
import {
  certificateErrorPayload,
  resolveCertificateActor,
} from "@/lib/certificates/careerCertificateApi";

// GET /api/certificates/career/context?org=encre|oranke|phalanx
// 증명 발급 페이지가 처음 읽는 컨텍스트 DTO.
// 일반 · mode=test&actAsTestUserId · demoUserId 세 경로가 동일한 DTO 를 받는다
// (분기는 resolveCertificateActor 안의 effective user 결정 한 곳뿐 — org 판정은
// 세 경로 모두 동일하게 URL 쿼리에서만 읽는다).

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TAG = "[api/certificates/career/context]";

export async function GET(request: Request) {
  try {
    const actor = await resolveCertificateActor(request);
    if (!actor.ok) return actor.response;

    const org = resolveCareerCertificateOrg(request);
    const context = await loadCareerCertificateUserContext(actor.userId);
    const dto = await buildCareerCertificatePageDto(context, org);
    return NextResponse.json(dto);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${TAG} unexpected`, message);
    return NextResponse.json(
      certificateErrorPayload("unexpected", "증명 발급 정보를 불러오지 못했습니다.", {
        code: "INTERNAL_ERROR",
      }),
      { status: 500 },
    );
  }
}

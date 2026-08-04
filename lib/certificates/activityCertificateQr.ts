import "server-only";
import QRCode from "qrcode";
import { ACTIVITY_CERTIFICATE_TEMPLATE } from "./activityCertificateTemplate";

// 증명서 QR — 발급 대상 사용자의 이력서(cluster-4-entertainment) 절대 URL.
// ─────────────────────────────────────────────────────────────────────────────
// 보안 규칙:
//   · userId 와 resumeUrl 을 request body/query 에서 절대 받지 않는다. 목적지는 서버가
//     effectiveUserId(세션·actAsTestUserId·demoUserId 해석 결과)만으로 만든다.
//   · origin 도 요청 Host 헤더를 무조건 신뢰하지 않는다 — 환경변수를 우선한다.
//     (Host 스푸핑으로 QR 목적지를 외부 도메인으로 바꾸는 것을 막는다.)
//   · 일반/actAs/demo 세 경로가 이 함수 하나만 쓴다 → QR URL 생성 로직 분기 없음.
//   · preview 와 issue 가 같은 렌더러를 타므로 QR 이미지도 자동으로 동일하다.
// ─────────────────────────────────────────────────────────────────────────────

/** QR 목적지 경로. 조직 고정(엥크레 = cluster-4-entertainment). */
const RESUME_PATH = "/cluster-4-entertainment/";

/**
 * 신뢰 가능한 origin 결정.
 *   1. CERTIFICATE_PUBLIC_ORIGIN (명시 설정 — 운영에서 권장)
 *   2. NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL (기존 프로젝트 관례)
 *   3. 요청 URL 의 origin (로컬 개발 폴백)
 */
export function resolveTrustedOrigin(request: Request): string {
  const candidates = [
    process.env.CERTIFICATE_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).origin;
    } catch {
      // 다음 후보로
    }
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/**
 * 발급 대상 사용자의 이력서 절대 URL.
 * effectiveUserId 는 반드시 서버가 해석한 값이어야 한다(요청 body 값 금지).
 */
export function buildResumeUrl(request: Request, effectiveUserId: string): string {
  const origin = resolveTrustedOrigin(request);
  const url = new URL(RESUME_PATH, origin);
  url.searchParams.set("userId", effectiveUserId);
  return url.toString();
}

/** 위 URL 을 담은 QR PNG 버퍼. 템플릿 설정의 크기/quiet zone 을 그대로 따른다. */
export async function renderResumeQrPng(resumeUrl: string): Promise<Buffer> {
  const { size, marginModules } = ACTIVITY_CERTIFICATE_TEMPLATE.qr;
  return QRCode.toBuffer(resumeUrl, {
    type: "png",
    width: size,
    margin: marginModules,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

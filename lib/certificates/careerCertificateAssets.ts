import "server-only";
import path from "node:path";
import type { Font } from "opentype.js";
import { CAREER_CERTIFICATE_TEMPLATE } from "./careerCertificateTemplate";
import {
  CertificateAssetError,
  CERTIFICATE_ASSET_MESSAGES,
  loadCertificateFont,
  isFontAvailable,
  readFirstExisting,
  type CertificateAssetErrorCode,
} from "./certificateAssetsShared";

export { CertificateAssetError, CERTIFICATE_ASSET_MESSAGES, type CertificateAssetErrorCode };

// 경력 증명서 전용 배경 PNG 로더. 한글 폰트는 certificateAssetsShared.ts 의 공용
// loadCertificateFont() 를 그대로 쓴다(활동/경력 증명서가 같은 폰트 파일을 공유 —
// 프로세스 내 모듈 스코프 캐시라 두 번째 호출은 즉시 반환된다).
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ Vercel 배포 주의(activityCertificateAssets.ts 와 동일 사고 이력):
//    아래 경로는 반드시 **리터럴 세그먼트**로만 join 한다. 설정값에서 동적으로
//    만들면 @vercel/nft 가 public/images 디렉터리 전체를 함수 번들에 밀어 넣어
//    250MB 제한을 초과시킨다(activity 증명서에서 실측: 429.66MB). 아래에서 설정값과
//    문자열로 대조해 어긋나면 즉시 실패시킨다.
//    next.config.mjs 의 experimental.outputFileTracingIncludes 에도
//    "**/api/certificates/career/**" 항목으로 이 파일과 public/fonts 를 명시
//    포함시켜 두었다 — 경로를 바꾸면 그쪽도 같이 고칠 것.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_PUBLIC_RELATIVE = "images/certified.png";
if (CAREER_CERTIFICATE_TEMPLATE.publicRelativePath !== TEMPLATE_PUBLIC_RELATIVE) {
  throw new Error(
    `[certificates] 경력 증명서 템플릿 경로 불일치: 설정=${CAREER_CERTIFICATE_TEMPLATE.publicRelativePath}, ` +
      `로더=${TEMPLATE_PUBLIC_RELATIVE}. careerCertificateAssets.ts 의 리터럴 경로를 함께 수정할 것.`,
  );
}

/** 서식 이미지 경로. CAREER_CERTIFICATE_TEMPLATE_PATH 설정 시 그 경로만 사용한다. */
function templateCandidates(): string[] {
  const override = process.env.CAREER_CERTIFICATE_TEMPLATE_PATH?.trim();
  if (override) return [override];
  return [path.join(process.cwd(), "public", "images", "certified.png")];
}

export interface CareerCertificateAssets {
  templatePng: Buffer;
  font: Font;
}

let cachedTemplatePng: Buffer | null = null;

/**
 * 배경 PNG + 파싱된 폰트를 반환. 하나라도 없으면 CertificateAssetError(503) throw.
 * 라우트는 이 에러를 잡아 구조화 JSON 으로 내려야 한다 — 절대 500 으로 새어나가면 안 된다.
 */
export async function loadCareerCertificateAssets(): Promise<CareerCertificateAssets> {
  if (!cachedTemplatePng) {
    const png = await readFirstExisting(templateCandidates());
    if (!png) {
      throw new CertificateAssetError("TEMPLATE_MISSING", CERTIFICATE_ASSET_MESSAGES.TEMPLATE_MISSING);
    }
    cachedTemplatePng = png;
  }
  const font = await loadCertificateFont();
  return { templatePng: cachedTemplatePng, font };
}

export interface CertificateAssetProbe {
  available: boolean;
  templateAvailable: boolean;
  fontAvailable: boolean;
  reason: "ok" | CertificateAssetErrorCode;
  message: string | null;
}

/** GET context 전용 비-throw 가용성 점검(활동증명서와 동일 패턴). */
export async function probeCareerCertificateAssets(): Promise<CertificateAssetProbe> {
  try {
    await loadCareerCertificateAssets();
    return { available: true, templateAvailable: true, fontAvailable: true, reason: "ok", message: null };
  } catch (e) {
    if (!(e instanceof CertificateAssetError)) throw e;
    const templateAvailable = e.code !== "TEMPLATE_MISSING";
    const fontAvailable = e.code === "TEMPLATE_MISSING" ? await isFontAvailable() : false;
    return {
      available: false,
      templateAvailable,
      fontAvailable,
      reason: e.code,
      message: CERTIFICATE_ASSET_MESSAGES[e.code],
    };
  }
}

/** 테스트/검증 스크립트가 env 를 바꿔 재확인할 때 쓰는 캐시 무효화 훅. */
export function resetCareerCertificateAssetCache(): void {
  cachedTemplatePng = null;
}

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
// ⚠️ named import 필수. 웹팩은 package.json 의 "module"(dist/opentype.mjs)을 고르는데
//    그 빌드에는 default export 가 없다 — `import opentype from "opentype.js"` 는
//    undefined 가 되어 런타임에 FONT_UNPARSEABLE 로만 보이는 함정이 된다.
import { parse as parseFont } from "opentype.js";
import type { Font } from "opentype.js";
import { ACTIVITY_CERTIFICATE_TEMPLATE } from "./activityCertificateTemplate";

// 증명서 렌더에 필요한 바이너리 에셋(배경 PNG + 한글 폰트) 로더.
// ─────────────────────────────────────────────────────────────────────────────
// 정책:
//   · 에셋이 없어도 앱 빌드는 절대 실패하지 않는다. 런타임에 CertificateAssetError
//     (503)로 승격되고, GET context 는 render.available=false 로 조용히 내려준다.
//   · 파싱 비용이 큰 폰트(수 MB, 200~800ms)는 모듈 스코프에 캐시한다 — 서버리스
//     warm 인스턴스 전체에서 재사용된다.
//   · 경로는 env 또는 상수에서만 온다. 요청 body/query 로 경로를 받지 않는다.
//
// ⚠️ Vercel 배포 주의: public/ 하위 파일은 정적 레이어로만 업로드되어 서버리스 함수의
//    파일시스템에 없을 수 있고, Next 의 파일 트레이서는 런타임 path.join 을 볼 수 없다.
//    next.config.mjs 의 experimental.outputFileTracingIncludes 로 증명서 API 경로에
//    public/certificates · public/fonts 를 명시 포함시켜 두었다. 경로를 바꾸면 그쪽도
//    같이 고쳐야 한다.
// ─────────────────────────────────────────────────────────────────────────────

export type CertificateAssetErrorCode =
  | "TEMPLATE_MISSING"
  | "FONT_MISSING"
  | "FONT_UNPARSEABLE";

export class CertificateAssetError extends Error {
  code: CertificateAssetErrorCode;
  status = 503;

  constructor(code: CertificateAssetErrorCode, message: string) {
    super(message);
    this.name = "CertificateAssetError";
    this.code = code;
  }
}

export const CERTIFICATE_ASSET_MESSAGES: Record<CertificateAssetErrorCode, string> = {
  TEMPLATE_MISSING: "증명서 템플릿 이미지가 등록되지 않았습니다.",
  FONT_MISSING: "증명서 한글 폰트가 등록되지 않았습니다.",
  FONT_UNPARSEABLE: "증명서 한글 폰트를 읽을 수 없습니다.",
};

// ⚠️ env 오버라이드는 "우선 후보"가 아니라 **유일 후보**다.
//    운영자가 경로를 명시했는데 그 파일이 없으면, 번들 기본값으로 조용히 폴백하는 대신
//    503 으로 실패해야 설정 오류를 즉시 알 수 있다(잘못된 서식으로 발급되는 것 방지).

/**
 * 한글 폰트 경로.
 *   CERTIFICATE_FONT_PATH 가 설정되면 그 경로만 사용한다.
 *   미설정 시 public/fonts/NotoSansKR-Regular.ttf → Pretendard-Regular.otf 순.
 *
 * 저장소에는 한글 폰트 바이너리를 커밋하지 않는다(라이선스 확인 전 임의 추가 금지).
 * 운영 배포 전에 위 파일 중 하나를 LICENSE 와 함께 배치하거나 env 를 설정해야 한다.
 */
function fontCandidates(): string[] {
  const override = process.env.CERTIFICATE_FONT_PATH?.trim();
  if (override) return [override];
  const publicFonts = path.join(process.cwd(), "public", "fonts");
  return [
    path.join(publicFonts, "NotoSansKR-Regular.ttf"),
    path.join(publicFonts, "Pretendard-Regular.otf"),
  ];
}

// ⚠️⚠️ 아래 경로는 반드시 **리터럴 세그먼트**로만 join 한다.
//    한때
//        path.join(process.cwd(), "public", ...TEMPLATE.publicRelativePath.split("/"))
//    처럼 동적으로 만들었더니, @vercel/nft(빌드 트레이서)가 대상 파일을 특정하지 못해
//    보수적으로 public/images 디렉터리 **전체(약 395MB / 1078개 파일)** 를 세 함수
//    번들에 밀어 넣었다. 그 결과 Vercel 배포가
//        "api/certificates/activity/context is 429.66mb ... exceeds 250mb"
//    로 실패했다(실측). 다른 API 라우트는 public/images 를 0개 트레이스한다.
//    설정값과 어긋나지 않도록 아래에서 문자열로 대조한다(경로 조합을 다시 만들지 말 것).
const TEMPLATE_PUBLIC_RELATIVE = "images/certificate-encre.png";
if (ACTIVITY_CERTIFICATE_TEMPLATE.publicRelativePath !== TEMPLATE_PUBLIC_RELATIVE) {
  throw new Error(
    `[certificates] 템플릿 경로 불일치: 설정=${ACTIVITY_CERTIFICATE_TEMPLATE.publicRelativePath}, ` +
      `로더=${TEMPLATE_PUBLIC_RELATIVE}. activityCertificateAssets.ts 의 리터럴 경로를 함께 수정할 것.`,
  );
}

/** 서식 이미지 경로. CERTIFICATE_TEMPLATE_PATH 설정 시 그 경로만 사용한다. */
function templateCandidates(): string[] {
  const override = process.env.CERTIFICATE_TEMPLATE_PATH?.trim();
  if (override) return [override];
  return [path.join(process.cwd(), "public", "images", "certificate-encre.png")];
}

async function readFirstExisting(candidates: string[]): Promise<Buffer | null> {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate);
    } catch {
      // 다음 후보로. (ENOENT 뿐 아니라 권한 오류도 "없음"으로 동일 취급)
    }
  }
  return null;
}

export interface CertificateAssets {
  templatePng: Buffer;
  font: Font;
}

let cachedAssets: CertificateAssets | null = null;

/**
 * 배경 PNG + 파싱된 폰트를 반환. 하나라도 없으면 CertificateAssetError(503) throw.
 * 라우트는 이 에러를 잡아 구조화 JSON 으로 내려야 한다 — 절대 500 으로 새어나가면 안 된다.
 */
export async function loadCertificateAssets(): Promise<CertificateAssets> {
  if (cachedAssets) return cachedAssets;

  const templatePng = await readFirstExisting(templateCandidates());
  if (!templatePng) {
    throw new CertificateAssetError(
      "TEMPLATE_MISSING",
      CERTIFICATE_ASSET_MESSAGES.TEMPLATE_MISSING,
    );
  }

  const fontBuffer = await readFirstExisting(fontCandidates());
  if (!fontBuffer) {
    throw new CertificateAssetError("FONT_MISSING", CERTIFICATE_ASSET_MESSAGES.FONT_MISSING);
  }

  let font: Font;
  try {
    // ⚠️ Buffer 는 풀링된 ArrayBuffer 의 뷰다. buf.buffer 를 그대로 넘기면 이웃 데이터를
    //    파싱해 깨진다. 반드시 byteOffset~byteLength 구간만 slice 해서 넘긴다.
    const arrayBuffer = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength,
    ) as ArrayBuffer;
    font = parseFont(arrayBuffer);
  } catch (e) {
    throw new CertificateAssetError(
      "FONT_UNPARSEABLE",
      `${CERTIFICATE_ASSET_MESSAGES.FONT_UNPARSEABLE} (${(e as Error).message})`,
    );
  }

  cachedAssets = { templatePng, font };
  return cachedAssets;
}

export interface CertificateAssetProbe {
  available: boolean;
  templateAvailable: boolean;
  fontAvailable: boolean;
  reason: "ok" | CertificateAssetErrorCode;
  message: string | null;
}

/**
 * GET context 전용 비-throw 가용성 점검.
 * 페이지가 미리보기 버튼을 미리 비활성화할 수 있게 해서, 사용자가 503 을 만나지 않게 한다.
 */
export async function probeCertificateAssets(): Promise<CertificateAssetProbe> {
  try {
    await loadCertificateAssets();
    return {
      available: true,
      templateAvailable: true,
      fontAvailable: true,
      reason: "ok",
      message: null,
    };
  } catch (e) {
    if (!(e instanceof CertificateAssetError)) throw e;
    // loadCertificateAssets 는 템플릿에서 먼저 실패하면 폰트를 보지 않는다.
    // 두 항목을 각각 보고해야 운영자가 "무엇을 넣어야 하는지" 알 수 있으므로 따로 확인한다.
    const templateAvailable = e.code !== "TEMPLATE_MISSING";
    const fontAvailable =
      e.code === "TEMPLATE_MISSING"
        ? (await readFirstExisting(fontCandidates())) !== null
        : false;
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
export function resetCertificateAssetCache(): void {
  cachedAssets = null;
}

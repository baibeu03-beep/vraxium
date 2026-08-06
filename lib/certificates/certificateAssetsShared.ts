import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
// ⚠️ named import 필수. 웹팩은 package.json 의 "module"(dist/opentype.mjs)을 고르는데
//    그 빌드에는 default export 가 없다 — `import opentype from "opentype.js"` 는
//    undefined 가 되어 런타임에 FONT_UNPARSEABLE 로만 보이는 함정이 된다.
import { parse as parseFont } from "opentype.js";
import type { Font } from "opentype.js";

// 증명서 공통 에셋(한글 폰트) 로더 — 활동 증명서 · 경력 증명서가 공유한다.
// ─────────────────────────────────────────────────────────────────────────────
// 템플릿 PNG 는 증명서 종류마다 다른 파일이라 각자의 *CertificateAssets.ts 가
// 자기 리터럴 경로로 로드하지만(Vercel 트레이서 주의사항은 그쪽 파일 참고), 폰트는
// 완전히 동일한 파일 하나를 공유하므로 여기서 한 번만 로드하고 캐시한다.
// ─────────────────────────────────────────────────────────────────────────────

export type CertificateAssetErrorCode = "TEMPLATE_MISSING" | "FONT_MISSING" | "FONT_UNPARSEABLE";

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

export async function readFirstExisting(candidates: string[]): Promise<Buffer | null> {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate);
    } catch {
      // 다음 후보로. (ENOENT 뿐 아니라 권한 오류도 "없음"으로 동일 취급)
    }
  }
  return null;
}

let cachedFont: Font | null = null;

/** 파싱된 한글 폰트를 반환(모듈 스코프 캐시 — 서버리스 warm 인스턴스 전체에서 재사용). */
export async function loadCertificateFont(): Promise<Font> {
  if (cachedFont) return cachedFont;

  const fontBuffer = await readFirstExisting(fontCandidates());
  if (!fontBuffer) {
    throw new CertificateAssetError("FONT_MISSING", CERTIFICATE_ASSET_MESSAGES.FONT_MISSING);
  }

  try {
    // ⚠️ Buffer 는 풀링된 ArrayBuffer 의 뷰다. buf.buffer 를 그대로 넘기면 이웃 데이터를
    //    파싱해 깨진다. 반드시 byteOffset~byteLength 구간만 slice 해서 넘긴다.
    const arrayBuffer = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength,
    ) as ArrayBuffer;
    cachedFont = parseFont(arrayBuffer);
    return cachedFont;
  } catch (e) {
    throw new CertificateAssetError(
      "FONT_UNPARSEABLE",
      `${CERTIFICATE_ASSET_MESSAGES.FONT_UNPARSEABLE} (${(e as Error).message})`,
    );
  }
}

export async function isFontAvailable(): Promise<boolean> {
  return (await readFirstExisting(fontCandidates())) !== null;
}

/** 테스트/검증 스크립트가 env 를 바꿔 재확인할 때 쓰는 캐시 무효화 훅. */
export function resetCertificateFontCache(): void {
  cachedFont = null;
}

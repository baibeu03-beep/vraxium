// 4허브(work_info / work_ability / work_exp / work_career) 운영진 output 정책 클램프.
// ─────────────────────────────────────────────────────────────────────────────
// 정책(2026-06-10 확정): 운영진(admin)이 라인에 등록하는 output image / output link 는
//   각각 "정확히 1개"(최대 1) 로 고정한다. (크루가 제출하는 이미지/링크 개수와는 무관 — 이 함수는
//   top-level outputImages / outputLinks(=운영진 슬롯)와 adminOutput*Count 만 다룬다.)
//
// 이 함수는 순수·비파괴(non-mutating) — 항상 새 객체를 반환한다. weekly-cards 프록시(HTTP DTO 전달)와
// 클라이언트 ingestion(렌더) 양쪽이 동일 함수를 사용해 "direct == HTTP" 패리티를 보장한다.
// snapshot 원본은 건드리지 않는다(전달/렌더 단계 클램프만). 기존 데이터가 2개여도 안전하게 1개로 제한.

export const ADMIN_OUTPUT_IMAGE_MAX = 1;
export const ADMIN_OUTPUT_LINK_MAX = 1;

type AnyLine = Record<string, unknown>;

/**
 * 라인 DTO 의 운영진 output 을 최대 1개로 클램프한 새 객체를 반환한다.
 * - outputImages(운영진 전용, 사용자분은 submission.outputImages) → 앞 1개만.
 * - outputImageCaptions(outputImages 와 1:1) → 앞 1개만.
 * - outputLinks 는 [운영진 prefix(adminOutputLinkCount) + 사용자 링크] 통합 배열일 수 있으므로,
 *   운영진 prefix 만 1개로 줄이고(2번째 이후 운영진 링크 제거) 사용자 링크는 그대로 보존한다.
 * - adminOutputImageCount / adminOutputLinkCount → Math.min(count, 1).
 * 멱등(idempotent): 이미 클램프된 입력에 다시 적용해도 동일 결과.
 */
export function clampAdminOutputs<T extends AnyLine>(line: T): T {
  if (!line || typeof line !== "object") return line;
  const next: AnyLine = { ...line };

  // ── 운영진 output images ──
  const imgs = next.outputImages;
  const imgCountRaw =
    typeof next.adminOutputImageCount === "number"
      ? next.adminOutputImageCount
      : Array.isArray(imgs)
        ? imgs.length
        : 0;
  const imgCount = Math.min(Math.max(imgCountRaw, 0), ADMIN_OUTPUT_IMAGE_MAX);
  if (Array.isArray(imgs)) next.outputImages = imgs.slice(0, imgCount);
  if (Array.isArray(next.outputImageCaptions)) {
    next.outputImageCaptions = (next.outputImageCaptions as unknown[]).slice(0, imgCount);
  }
  if (next.adminOutputImageCount != null) next.adminOutputImageCount = imgCount;

  // ── 운영진 output links (통합 배열 가능 → prefix 만 클램프, 사용자 링크 보존) ──
  if (typeof next.adminOutputLinkCount === "number") {
    const origAdmin = Math.max(next.adminOutputLinkCount, 0);
    const newAdmin = Math.min(origAdmin, ADMIN_OUTPUT_LINK_MAX);
    const links = next.outputLinks;
    if (Array.isArray(links) && origAdmin > newAdmin) {
      // 운영진 링크 [newAdmin, origAdmin) 구간만 제거 — 1번째 운영진 링크 + 모든 사용자 링크는 보존.
      next.outputLinks = [...links.slice(0, newAdmin), ...links.slice(origAdmin)];
    }
    next.adminOutputLinkCount = newAdmin;
  }

  return next as T;
}

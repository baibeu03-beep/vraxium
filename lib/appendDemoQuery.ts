// 테스트 유저(데모) 모드 컨텍스트를 앱 내부 네비게이션 전 구간에 보존하는 단일 헬퍼.
// ─────────────────────────────────────────────────────────────────────────────
// admin → 고객 앱 진입 URL: /cluster-X?admin=true&demoUserId={id}&demoUserName={name}&org={slug}
//   이 4개 컨텍스트 파라미터(demoUserId / admin=true / demoUserName / org)가 중간 페이지
//   (index-two-*, /crews, /weekly-ranking 등)를 거치며 유실되면 테스트 모드가 꺼져,
//   타 크루 카드에서 위클리 평판 작성이 "로그인이 필요합니다" 로 막힌다.
//   → 모든 내부 Link href / router.push 대상을 본 헬퍼에 통과시켜 컨텍스트를 유지한다.
//
// 정책:
//   - demoUserId 없음(일반 로그인/비로그인) → href 그대로 (완전 no-op, 기존 동작 보존).
//   - userId(= 카드 대상자/target)는 호출부가 직접 설정한다. 본 헬퍼는 userId 를 절대
//     건드리지 않는다 → target = userId, actor = demoUserId 분리를 그대로 유지.
//   - 이미 href 에 있는 키는 덮어쓰지 않는다(호출부가 명시한 org/userId 우선).
//   - 해시(#anchor)는 쿼리 뒤에 보존한다.

import { appendModeQuery, parseScopeMode } from "@/lib/userScopeShared";

export type DemoParamSource = { get(name: string): string | null };

export interface AppendDemoQueryOptions {
  // 현재 org 컨텍스트를 함께 실을지 여부. index-two-*(동물 랜딩)처럼 목적지가 org 를
  // 스스로(경로로) 결정하는 링크에서는 false — 현재 org 를 실으면 목적지 org 와 충돌한다
  // (resolveCurrentOrg 가 path 보다 ?org= 를 우선하므로). 기본 true.
  carryOrg?: boolean;
}

export function appendDemoQuery(
  href: string,
  source: DemoParamSource | null | undefined,
  options: AppendDemoQueryOptions = {},
): string {
  const { carryOrg = true } = options;

  // 모집단 스코프(mode=test) 보존 — demoUserId 유무와 무관하게 항상 적용.
  // 테스트 모드(mode=test)는 demoUserId 없이도 켜질 수 있으므로(우하단 토글/직접 진입),
  // 내부 네비게이션 전 구간에서 mode 를 유지해야 페이지 전환 시 꺼지지 않는다.
  // operating(mode 미지정)이면 appendModeQuery 가 no-op → 링크 byte-identical.
  const withMode = appendModeQuery(href, parseScopeMode(source?.get("mode") ?? null));

  const demoUserId = source?.get("demoUserId") ?? null;
  if (!demoUserId) return withMode;
  href = withMode;

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const [path, existingQuery = ""] = base.split("?");
  const params = new URLSearchParams(existingQuery);

  if (!params.has("demoUserId")) params.set("demoUserId", demoUserId);
  if (!params.has("admin")) params.set("admin", "true");

  const demoUserName = source?.get("demoUserName");
  if (demoUserName && !params.has("demoUserName")) params.set("demoUserName", demoUserName);

  if (carryOrg) {
    const org = source?.get("org");
    if (org && !params.has("org")) params.set("org", org);
  }

  const qs = params.toString();
  return `${qs ? `${path}?${qs}` : path}${hash}`;
}

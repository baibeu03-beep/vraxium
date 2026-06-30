// 사용자 스코프 — 클라이언트/서버 공용 순수 헬퍼 (서버 전용 의존 없음).
// ─────────────────────────────────────────────────────────────────────
// resolveUserScope(서버·supabase 사용)는 lib/userScope.ts 에 있다. 이 모듈은
// mode 파싱/링크 전파 등 순수 함수만 담아 "use client" 컴포넌트에서도 import 가능하게 한다.
//   (lib/userScope.ts 는 supabase 서버 클라이언트를 import 하므로 클라이언트 번들에 넣으면 안 됨)
//
// vraxium-admin 의 lib/userScopeShared.ts 미러 — 고객 앱 Phase 4b 포팅.
//
// ⚠️ 스코프 결정 방식 전환 (QA 배포):
//   과거: URL ?mode=test 쿼리로 모집단 스코프를 켰다(우하단 토글/링크 전파).
//   현재: **배포 환경변수**(NEXT_PUBLIC_APP_ENV / NEXT_PUBLIC_DEPLOY_ENV)로 배포 단위 결정.
//     · 운영 배포(NEXT_PUBLIC_APP_ENV=operating 또는 미설정) : operating — 실사용자만.
//     · QA   배포(NEXT_PUBLIC_APP_ENV=qa)                    : test — test_user_markers 만.
//   같은 코드/같은 DTO/같은 snapshot 조회 구조. 배포마다 build-time 으로 NEXT_PUBLIC_* 가
//   인라인되어 한 배포는 단일 스코프로 고정된다 → 운영/QA 데이터가 한 화면에 섞이지 않는다.
//   ?mode=test URL 전파는 폐기(아래 append/toggle 은 no-op 유지) — URL 로 스코프를 못 바꾼다.
// 정책(확정):
//   · operating : 실사용자만. test_user_markers 전원 제외.
//   · test      : test_user_markers 만. 실사용자 전원 제외.
// ─────────────────────────────────────────────────────────────────────

export type ScopeMode = "operating" | "test";

// useSearchParams()(ReadonlyURLSearchParams)·URLSearchParams 양쪽 호환 최소 형태.
type SearchParamsLike = { get(name: string): string | null } | null | undefined;

// ─────────────────────────────────────────────────────────────────────
// QA 기간 고정 테스트-전용 필터 — vraxium-admin 의 QA_FIXED_TEST_ONLY 미러.
//
//   true  : 배포 환경변수(NEXT_PUBLIC_APP_ENV)·URL(?mode) 과 무관하게 고객앱 전체
//           모집단을 test_user_markers 로 고정한다. 운영 배포에서도 실사용자 노출 0
//           — 랭킹/크루/카드/프로필/주차 결과/성장·리그 전 화면이 test 스코프로 동작.
//           (getDeployMode() 가 1차 SoT 이므로 resolveUserScope·readScopeMode·
//            resolveWeekScopeForUser·enforceQaMode·QaModeGuard 가 일괄 test 로 전환된다.)
//   false : 종전 동작 — 아래 NEXT_PUBLIC_APP_ENV 로 배포 단위 스코프를 결정(운영=실사용자).
//
//   ⚠️ QA 종료 시 이 한 줄을 false 로 되돌리면 운영 동작으로 즉시 복귀한다(코드 변경 끝).
//      DB(test_user_markers / PMS-MIGRATION 원본)는 별도로 관리.
//   새 모드/배포/토글을 만들지 않는다 — 기존 "test" 스코프를 고정 스위치로 켤 뿐이다.
// ─────────────────────────────────────────────────────────────────────
export const QA_FIXED_TEST_ONLY = true;

// 배포 모드 단일 SoT — QA_FIXED_TEST_ONLY 우선, 그다음 NEXT_PUBLIC_APP_ENV(우선) /
//   NEXT_PUBLIC_DEPLOY_ENV(alias). 값 'qa' 또는 'test' → test 스코프.
//   그 외(operating/미설정/오타) → operating(fail-safe).
//   NEXT_PUBLIC_* 는 빌드 시 인라인되어 클라이언트/서버 양쪽에서 동일하게 읽힌다.
// ⚠️ process.env.NEXT_PUBLIC_* 는 Next 가 빌드 시 리터럴 치환하므로 동적 키 접근 금지 —
//    반드시 정적 프로퍼티 접근(process.env.NEXT_PUBLIC_APP_ENV)으로 작성한다.
export function getDeployMode(): ScopeMode {
  if (QA_FIXED_TEST_ONLY) return "test"; // QA 기간 고정 — env/URL 무시.
  const raw = (
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_DEPLOY_ENV ??
    ""
  )
    .trim()
    .toLowerCase();
  return raw === "qa" || raw === "test" ? "test" : "operating";
}

// 문자열 → ScopeMode. (구) ?mode= 파서. 이제 URL 인자는 무시하고 배포 모드를 반환한다.
//   스코프는 배포 환경변수로만 결정된다 — URL 로 켜고 끌 수 없다.
export function parseScopeMode(raw: string | null | undefined): ScopeMode {
  void raw; // URL ?mode= 무시 — 배포 환경변수가 스코프 SoT.
  return getDeployMode();
}

// URL ?mode 파싱(레거시 시그니처). 인자는 무시하고 배포 모드를 반환한다.
//   route/서버컴포넌트/클라이언트 모두 이 한 곳을 거쳐 동일한 배포 스코프를 얻는다.
export function readScopeMode(searchParams: SearchParamsLike): ScopeMode {
  void searchParams; // URL ?mode= 무시 — 배포 환경변수가 스코프 SoT.
  return getDeployMode();
}

// 링크/탭 이동 시 mode 보존. operating(기본)이면 파라미터 미부착 → 운영 링크는 byte-identical.
//   - 이미 다른 query(org/userId/tab/week 등)는 모두 보존, mode 만 추가/유지.
//   - 해시(#anchor)는 쿼리 뒤에 보존.
export function appendModeQuery(href: string, mode: ScopeMode): string {
  void mode;
  // QA(mode=test) link propagation is temporarily disabled.
  // if (mode !== "test") return href;
  // const [pathAndQuery, hash] = href.split("#");
  // const [path, query] = pathAndQuery.split("?");
  // const params = new URLSearchParams(query ?? "");
  // if (params.get("mode") !== "test") params.set("mode", "test");
  // const qs = params.toString();
  // return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
  return href;
}

// 토글 — 현재 href 의 다른 query 는 전부 유지하고 mode 만 뒤집는다.
//   · 현재 test → mode 제거(operating)
//   · 현재 operating → mode=test 추가
// TestModeToggle 버튼 전용. 해시도 보존.
export function toggleModeInHref(href: string): string {
  // QA(mode=test) toggle URL handling is temporarily disabled.
  // const [pathAndQuery, hash] = href.split("#");
  // const [path, query] = pathAndQuery.split("?");
  // const params = new URLSearchParams(query ?? "");
  // const isTest = parseScopeMode(params.get("mode")) === "test";
  // if (isTest) params.delete("mode");
  // else params.set("mode", "test");
  // const qs = params.toString();
  // return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
  return href;
}

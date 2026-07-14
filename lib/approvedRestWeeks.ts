// ─────────────────────────────────────────────────────────────────────
// 승인된 개인 휴식 주차 — 공통 SoT 접근자 (front / customer).
//
// SoT = `vacation_requests` (status='approved'). admin 의 lib/approvedRestWeeks 와 동일한
//   유일 SoT 를 바라본다(같은 상태를 앱별로 다른 테이블·다른 규칙으로 계산하지 않는다).
//
// 배경: 과거 개인 휴식은 `rest_requests` 를 읽었으나 그 테이블은 현재 DB 에 없어(조회 실패=빈값)
//   실질적으로 죽은 경로였다. /admin/rest-management 승인 SoT 인 vacation_requests 로 일원화한다.
//
// 반환: week_id(weeks.id uuid) 목록 — /api/profile 의 restWeekIds 소비처(cluster-4-card 상세의
//   개인 휴식 void 판정 `restWeekIds.includes(currentWeek.id)`)가 week_id 로 조인하기 때문.
//   `approved` 만 포함(pending/rejected/cancelled 제외). week_id 가 null 인 레거시 행은 제외.
//
// 일반 사용자·mode=test·demoUserId 는 이 접근자를 바꾸지 않는다 — 호출부가 정한 userId 만 다르다.
// ─────────────────────────────────────────────────────────────────────

// PostgREST 쿼리 빌더를 반환하는 팩토리 — 기존 Promise.all 배열 안에서
//   `rest_requests` 쿼리를 그대로 대체할 수 있게(같은 `.data` shape: [{ week_id }]) 한다.
//   client 는 호출부의 supabaseAdmin(모듈 싱글턴)을 그대로 넘긴다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function approvedRestWeekIdsQuery(client: any, userId: string, org?: string | null) {
  let q = client
    .from("vacation_requests")
    .select("week_id")
    .eq("user_id", userId)
    .eq("status", "approved");
  if (org) q = q.eq("org", org);
  return q;
}

// 승인된 휴식 주차 week_id 목록(단독 조회용). 조회 실패는 빈 배열로 격리.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApprovedRestWeekIds(
  client: any,
  userId: string,
  org?: string | null,
): Promise<string[]> {
  if (!client) return [];
  const { data, error } = await approvedRestWeekIdsQuery(client, userId, org);
  if (error) return [];
  return ((data ?? []) as Array<{ week_id: string | null }>)
    .map((r) => r.week_id)
    .filter((w): w is string => Boolean(w));
}

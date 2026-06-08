import { supabaseAdmin } from "@/lib/supabase";

// user_edit_windows 기반 작성 기간 게이트 — 일반화 헬퍼.
// cluster3 `hasOpenTopCardEditWindow` 와 동일 패턴이되 resource_key 를 매개변수화한 형태.
// 호출 측에서 admin bypass 는 별도로 처리한다 (이 헬퍼는 순수 row 체크).
//
// 허용 조건:
//   1) user_edit_windows row 존재
//   2) resource_key 일치
//   3) opened_at <= now() < expires_at
//
// weekId:
//   - 주간 자원(cluster4.weekly_reviews / weekly_colleagues / weekly_reputation)은
//     user_edit_windows 가 (user_id, resource_key, week_id) 단위로 분리되어 있다
//     (admin 2026-05-31 마이그레이션). 이때 weekId 를 넘기면 해당 주차 행만 검사한다.
//   - weekId 를 넘기지 않으면 (비주간 자원) week_id 조건 없이 검사한다.
//   - ⚠ 주간 자원인데 weekId 없이 호출하면 "주차 행 + legacy 전역 행" 이 동시에
//     매칭되어 .maybeSingle() 이 multiple-rows 에러를 던지고 false 가 된다.
//     이것이 GET /api/edit-windows/permission 과 동일했던 버그였다 — 저장 게이트도
//     반드시 동일한 week_id 기준을 쓰도록 weekId 를 함께 넘겨야 한다.
export async function hasOpenEditWindow(params: {
  userId: string;
  resourceKey: string;
  weekId?: string | null;
}): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[edit-window] supabaseAdmin not configured");
    return false;
  }

  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("user_edit_windows")
    .select("id")
    .eq("user_id", params.userId)
    .eq("resource_key", params.resourceKey)
    .lte("opened_at", now)
    .gt("expires_at", now);

  // week_id 가 주어지면 해당 주차 행만 — 부분 unique index 가 ≤1행을 보장하므로
  // maybeSingle() 안전. 주어지지 않으면 비주간 자원으로 보고 기존 동작 유지.
  if (params.weekId != null) {
    query = query.eq("week_id", params.weekId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[edit-window] query failed", error);
    return false;
  }

  return Boolean(data);
}

// 여러 resource_key 중 하나라도 열려 있으면 true.
// cluster4 의 4개 모달 (work_info/ability/exp/career) + legacy activity_details 처럼
// "신규 분할 키 OR 폴백 단일 키" 형태의 게이트가 필요할 때 사용한다.
//
// weekId (2026-06-08 주차별 추가 개방):
//   - 4개 실무 허브(work_*)는 admin 이 (카드종류, 시즌, 주차) 단위로 추가 개방할 수 있다.
//     이때 user_edit_windows 행은 week_id 를 가진다.
//   - weekId 를 넘기면 "이 카드 주차 행 OR 전역(week_id IS NULL) 행" 을 additive OR 로 본다.
//       · week_id = weekId : 신규 주차별 개방
//       · week_id IS NULL  : legacy 전역 개방(해당 허브 전 주차) — 하위호환 보존
//   - weekId 를 넘기지 않으면 기존 동작(week_id 무관, 전역+주차 모두 매칭)을 유지한다.
export async function hasOpenEditWindowAny(params: {
  userId: string;
  resourceKeys: readonly string[];
  weekId?: string | null;
}): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[edit-window] supabaseAdmin not configured");
    return false;
  }
  if (params.resourceKeys.length === 0) return false;

  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("user_edit_windows")
    .select("id")
    .eq("user_id", params.userId)
    .in("resource_key", params.resourceKeys as string[])
    .lte("opened_at", now)
    .gt("expires_at", now);

  // 카드 주차가 주어지면 (해당 주차 행 OR 전역 행) 으로 좁힌다.
  if (params.weekId != null) {
    query = query.or(`week_id.eq.${params.weekId},week_id.is.null`);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.error("[edit-window] multi-key query failed", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

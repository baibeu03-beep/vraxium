import { supabaseAdmin } from "@/lib/supabase";

// user_edit_windows 기반 작성 기간 게이트 — 일반화 헬퍼.
// cluster3 `hasOpenTopCardEditWindow` 와 동일 패턴이되 resource_key 를 매개변수화한 형태.
// 호출 측에서 admin bypass 는 별도로 처리한다 (이 헬퍼는 순수 row 체크).
//
// 허용 조건:
//   1) user_edit_windows row 존재
//   2) resource_key 일치
//   3) opened_at <= now() < expires_at
export async function hasOpenEditWindow(params: {
  userId: string;
  resourceKey: string;
}): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[edit-window] supabaseAdmin not configured");
    return false;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("user_edit_windows")
    .select("id")
    .eq("user_id", params.userId)
    .eq("resource_key", params.resourceKey)
    .lte("opened_at", now)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    console.error("[edit-window] query failed", error);
    return false;
  }

  return Boolean(data);
}

// 여러 resource_key 중 하나라도 열려 있으면 true.
// cluster4 의 4개 모달 (work_info/ability/exp/career) + legacy activity_details 처럼
// "신규 분할 키 OR 폴백 단일 키" 형태의 게이트가 필요할 때 사용한다.
export async function hasOpenEditWindowAny(params: {
  userId: string;
  resourceKeys: readonly string[];
}): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[edit-window] supabaseAdmin not configured");
    return false;
  }
  if (params.resourceKeys.length === 0) return false;

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("user_edit_windows")
    .select("id")
    .eq("user_id", params.userId)
    .in("resource_key", params.resourceKeys as string[])
    .lte("opened_at", now)
    .gt("expires_at", now)
    .limit(1);

  if (error) {
    console.error("[edit-window] multi-key query failed", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

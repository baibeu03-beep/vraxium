import { supabaseAdmin } from "@/lib/supabase";

export type TopCardType = "output" | "detail";

// admin repo 의 작성 기간 관리(user_edit_windows)에 등록된 resource_key 와 1:1 매핑.
//   - Output Top 5 카드: cluster3.output_cards
//   - Detail 10 카드:    cluster3.detail_cards
// 두 키는 별도 row 로 관리되어 Output / Detail 작성 기간을 독립적으로 열고 닫을 수 있다.
export const TOP_CARD_EDIT_RESOURCE_BY_TYPE: Record<TopCardType, string> = {
  output: "cluster3.output_cards",
  detail: "cluster3.detail_cards",
};

// 주어진 사용자의 (output|detail) 작성 기간이 현재 열려 있는지 판정.
//   허용 조건 (admin repo 가이드와 동일):
//     1) user_edit_windows row 존재
//     2) resource_key = TOP_CARD_EDIT_RESOURCE_BY_TYPE[cardType]
//     3) opened_at <= now() < expires_at
//   admin bypass 는 호출 측 라우트에서 별도 처리한다 (이 helper 는 순수 row 체크).
export async function hasOpenTopCardEditWindow(params: {
  userId: string;
  cardType: TopCardType;
}): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[top-cards edit window] supabaseAdmin not configured");
    return false;
  }

  const resourceKey = TOP_CARD_EDIT_RESOURCE_BY_TYPE[params.cardType];
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("user_edit_windows")
    .select("id")
    .eq("user_id", params.userId)
    .eq("resource_key", resourceKey)
    .lte("opened_at", now)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    console.error("[top-cards edit window] query failed", error);
    return false;
  }

  return Boolean(data);
}

// 비활성(빛바램) 카드 판정 SoT 공용 헬퍼.
// 사용처: components/cluster-4-card/Cluster4CardContent.tsx (실무 정보/경험/역량/경력 4파트 카드 컨테이너).
// ─────────────────────────────────────────────────────────────────────
// 정책(2026-06-04): not_applicable(해당 없음)과 void(미개설 빈 슬롯)는 동일한
// "비활성 카드(Faded Card)" UI 정책으로 묶는다 — 카드 컨테이너에 .faded-card 클래스 1개로 표현.
//  - not_applicable(해당 없음/미배정): 개설 데이터 존재 + 본인 미배정/미선발 → 빛바램
//  - void(미개설 빈 슬롯/placeholder): 개설 데이터 자체가 없음 → 빛바램
//    (legacy 카드 enum "empty" = 프론트의 void 표현이므로 동일 취급)
//  - success / pending(waiting) / fail(failed): 영향 없음. locked 슬롯은 호출부에서 가드.
// 입력은 각 카드의 "표시 상태"(enhancementStatusBadge toneClass 우선 → legacy 카드 enum) —
// 뱃지·모달 오픈 게이트(canOpenLineModal)와 항상 같은 기준을 본다.
// ※ 상태→스타일 매핑을 카드(섹션)별로 따로 만들지 말 것 — 새 섹션/카드가 추가되면
//    이 헬퍼만 호출하면 전체가 동일하게 동작한다(섹션별 분기 드리프트 방지).

export const FADED_CARD_STATUSES = new Set(["not_applicable", "void", "empty"]);

export function isFadedCardStatus(status: string | null | undefined): boolean {
  return FADED_CARD_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

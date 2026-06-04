// 비활성 카드(Faded Card) 판정 단위 검증 — lib/cluster4-faded-card.ts isFadedCardStatus 미러 +
// 4파트 컨테이너의 표시 상태(effective status) 환산 규칙 검증.
const FADED_CARD_STATUSES = new Set(["not_applicable", "void", "empty"]);
const isFadedCardStatus = (status) => FADED_CARD_STATUSES.has(String(status ?? "").trim().toLowerCase());
// canOpenLineModal (동일 표시 상태 입력 — faded ⇒ 모달 금지 invariant 검증용)
const MODAL_OPENABLE_STATUSES = new Set(["pending", "waiting", "success", "fail", "failed"]);
const canOpenLineModal = (status) => MODAL_OPENABLE_STATUSES.has(String(status ?? "").trim().toLowerCase());

let fails = 0;
const check = (label, got, exp) => {
  if (got !== exp) fails++;
  console.log(`${got === exp ? "PASS" : "FAIL"}  ${label} = ${got} (기대 ${exp})`);
};

// 1) 상태 → faded 판정
const CASES = [
  ["not_applicable", true], ["void", true], ["empty", true],
  ["Not_Applicable", true], ["VOID", true], [" void ", true],
  ["pending", false], ["waiting", false], ["success", false], ["fail", false], ["failed", false],
  ["", false], [null, false], [undefined, false], ["locked", false],
];
for (const [s, exp] of CASES) check(`isFadedCardStatus(${JSON.stringify(s)})`, isFadedCardStatus(s), exp);

// 2) invariant: faded 상태는 전부 모달 금지 (역은 성립 안 해도 됨 — 미지값 등)
for (const s of FADED_CARD_STATUSES) check(`faded("${s}") ⇒ 모달 금지`, canOpenLineModal(s), false);

// 3) 4파트 컨테이너 환산 규칙 (TSX 미러)
//    info:    isEmpty || card.status==="empty" → "void", 그 외 effectiveStatus(badge ?? card.status)
//    exp:     badge.toneClass ?? (isEmpty ? "void" : card.enhancementStatus); locked 는 무조건 false
//    ability: badge.toneClass ?? (usePlaceholder ? "void" : card.enhancementStatus)
//    career:  isEmpty → "void", 그 외 badge ?? legacy 플래그 환산
const infoFaded = (isEmpty, status, badgeTone) =>
  isFadedCardStatus(isEmpty || status === "empty" ? "void" : (badgeTone ?? status ?? "not_applicable"));
check(`info: void 슬롯(isEmpty)`, infoFaded(true, undefined, null), true);
check(`info: status="empty"`, infoFaded(false, "empty", null), true);
check(`info: 해당 없음 뱃지`, infoFaded(false, "waiting", "not_applicable"), true);
check(`info: 성공 카드`, infoFaded(false, "success", "success"), false);

const expFaded = (isLocked, isEmpty, enhStatus, badgeTone) =>
  !isLocked && isFadedCardStatus(badgeTone ?? (isEmpty ? "void" : enhStatus));
check(`exp: void 슬롯(badge 無)`, expFaded(false, true, "not_applicable", null), true);
check(`exp: 해당 없음 뱃지`, expFaded(false, false, "waiting", "not_applicable"), true);
check(`exp: 잠금 슬롯 제외`, expFaded(true, true, "not_applicable", null), false);
check(`exp: 대기 카드`, expFaded(false, false, "waiting", "waiting"), false);

const abilityFaded = (usePlaceholder, enhStatus, badgeTone) =>
  isFadedCardStatus(badgeTone ?? (usePlaceholder ? "void" : enhStatus));
check(`ability: void placeholder`, abilityFaded(true, "empty", null), true);
check(`ability: 해당 없음`, abilityFaded(false, "not_applicable", "not_applicable"), true);
check(`ability: 성공 카드`, abilityFaded(false, "success", "success"), false);

const careerEffective = (isEmpty, badgeTone, flags) =>
  isEmpty ? "void" : (badgeTone ?? (flags.isNotApplicable ? "not_applicable" : flags.isFailed ? "failed" : flags.verified ? "success" : "waiting"));
check(`career: void(미개설 패딩)`, isFadedCardStatus(careerEffective(true, null, {})), true);
check(`career: 해당 없음(미배정)`, isFadedCardStatus(careerEffective(false, "not_applicable", {})), true);
check(`career: 실패 카드(빛바램 X)`, isFadedCardStatus(careerEffective(false, null, { isFailed: true })), false);
check(`career: 성공 카드`, isFadedCardStatus(careerEffective(false, "success", {})), false);

console.log(fails === 0 ? "\nALL PASS" : `\nFAIL ${fails}건`);

// canOpenLineModal + career 6슬롯 패딩 단위 검증 (Cluster4CardContent.tsx 로직 미러)
const MODAL_OPENABLE_STATUSES = new Set(["pending", "waiting", "success", "fail", "failed"]);
const canOpenLineModal = (status) => MODAL_OPENABLE_STATUSES.has(String(status ?? "").trim().toLowerCase());

const CASES = [
  ["pending", true], ["waiting", true], ["success", true], ["fail", true], ["failed", true],
  ["not_applicable", false], ["void", false], ["empty", false], ["", false], [null, false], [undefined, false],
  ["PENDING", true], ["Not_Applicable", false], [" success ", true],
];
let fails = 0;
for (const [s, exp] of CASES) {
  const got = canOpenLineModal(s);
  if (got !== exp) fails++;
  console.log(`${got === exp ? "PASS" : "FAIL"}  canOpenLineModal(${JSON.stringify(s)}) = ${got} (기대 ${exp})`);
}

// career 6슬롯 패딩: target = max(6, ceil(n/6)*6)
const PER_PAGE = 6;
const pad = (n) => Math.max(PER_PAGE, Math.ceil(n / PER_PAGE) * PER_PAGE);
const PAD_CASES = [[0, 6], [2, 6], [6, 6], [7, 12]];
for (const [n, exp] of PAD_CASES) {
  const got = pad(n);
  if (got !== exp) fails++;
  console.log(`${got === exp ? "PASS" : "FAIL"}  career 라인 ${n}개 → 표시 칸 ${got} (실 ${n} + void ${got - n}, 기대 ${exp})`);
}
console.log(fails === 0 ? "\nALL PASS" : `\nFAIL ${fails}건`);

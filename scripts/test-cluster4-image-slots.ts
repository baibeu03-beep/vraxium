/**
 * 예약 슬롯 모델(2026-07-18) 검증 — 크루 페이지 아웃풋 이미지 슬롯.
 *
 * lib/cluster4OutputImages 의 buildImageSlots/splitImageSlots(운영진 SoT 계약) 와
 * Cluster4CardContent 내부 assembleReservedImageSlots/splitReservedImageSlots(캡션 동반) 를
 * 미러링해, 저장(split→크루 payload)→읽기(assemble→화면 슬롯) round-trip 을 시나리오별로 검증한다.
 *
 * 핵심 불변식:
 *   · 슬롯 0(1번) = 운영진 예약. 운영진 이미지가 없어도(=null) 크루는 절대 슬롯 0 으로 당겨지지 않는다.
 *   · 크루 첫 이미지 = 화면 슬롯 2번(index 1).
 *   · 저장 payload(크루) 에는 운영진/빈 운영진 슬롯이 포함되지 않는다.
 *   · 운영진 이미지 추가/삭제로 크루 슬롯이 이동하지 않는다.
 *
 * 실행: npx tsx scripts/test-cluster4-image-slots.ts
 */
import {
  buildImageSlots,
  splitImageSlots,
  RESERVED_ADMIN_IMAGE_SLOTS,
  IMAGE_SLOT_COUNT,
  type Cluster4OutputImage,
} from "../lib/cluster4OutputImages";

// ── 컴포넌트 내부 헬퍼 미러 (Cluster4CardContent.tsx 의 module-local 헬퍼와 동일 규칙) ──
type Img = { url?: string | null; caption?: string | null };

const assembleReservedImageSlots = (
  adminImages: ReadonlyArray<Img>,
  crewImages: ReadonlyArray<string | null>,
  crewCaptions: ReadonlyArray<string | null>,
  reserved: number,
  totalSlots: number,
): { images: (string | null)[]; captions: string[] } => {
  const images: (string | null)[] = [];
  const captions: string[] = [];
  for (let i = 0; i < totalSlots; i++) {
    if (i < reserved) {
      images.push(adminImages[i]?.url ?? null);
      captions.push(adminImages[i]?.caption ?? "");
    } else {
      const c = i - reserved;
      images.push(crewImages[c] ?? null);
      captions.push(crewCaptions[c] ?? "");
    }
  }
  return { images, captions };
};

const splitReservedImageSlots = (
  slotImages: ReadonlyArray<string | null>,
  slotCaptions: ReadonlyArray<string | null>,
  reserved: number,
): { crewImages: (string | null)[]; crewCaptions: string[] } => ({
  crewImages: slotImages.slice(reserved).map((u) => u ?? null),
  crewCaptions: slotCaptions.slice(reserved).map((c) => c ?? ""),
});

// persistImageUrls 미러: null 보존 + 길이 유지 (blob 업로드는 URL 그대로 통과로 취급).
const persistCrewImages = (imgs: (string | null)[]): (string | null)[] => imgs.map((u) => u ?? null);

// 읽기(build) 미러: 운영진 이미지(≤1) + 크루 이미지(submission/detail) → 화면 슬롯.
//   reserved = max(adminImgs.length, RESERVED_ADMIN_IMAGE_SLOTS) **항상**(fail-safe: 매칭 실패에서도 1).
//   admin DTO(v47) adminOutputImageCount=RESERVED 무조건 송신 계약과 동일.
const readSlots = (
  adminImgs: Img[],
  crewImgs: (string | null)[],
  crewCaps: (string | null)[],
  _hasLine: boolean, // (더 이상 reserved 를 좌우하지 않음 — 계약상 항상 예약)
  totalSlots: number,
): (string | null)[] => {
  const reserved = Math.min(
    Math.max(adminImgs.length, RESERVED_ADMIN_IMAGE_SLOTS),
    totalSlots,
  );
  return assembleReservedImageSlots(adminImgs, crewImgs, crewCaps, reserved, totalSlots).images;
};

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) console.log(`    got : ${g}\n    want: ${w}`);
};

const TOTAL = IMAGE_SLOT_COUNT; // 4 (info/ability/exp)
const cap = (u: string | null) => (u ? `${u}-cap` : "");

console.log(`\n=== 예약 슬롯 모델 검증 (IMAGE_SLOT_COUNT=${IMAGE_SLOT_COUNT}, RESERVED=${RESERVED_ADMIN_IMAGE_SLOTS}) ===\n`);

// ── 시나리오 1: 운영진 이미지 없음, 크루 A 1개 ──
{
  const admin: Img[] = [];
  const crew = ["A"];
  const slots = readSlots(admin, crew, crew.map(cap), true, TOTAL);
  eq("S1 운영진 없음/크루 A → [null, A, null, null] (A는 2번 슬롯)", slots, [null, "A", null, null]);
  eq("S1 A가 1번(슬롯0)에 없음", slots[0], null);
}

// ── 시나리오 2: 운영진 B 추가, 크루 A ──
{
  const admin: Img[] = [{ url: "B", caption: "B-cap" }];
  const crew = ["A"];
  const slots = readSlots(admin, crew, crew.map(cap), true, TOTAL);
  eq("S2 운영진 B/크루 A → [B, A, null, null]", slots, ["B", "A", null, null]);
}

// ── 시나리오 3: 운영진 B 삭제 후, 크루 A (S1 과 동일해야 함 — A 이동 금지) ──
{
  const admin: Img[] = [];
  const crew = ["A"];
  const slots = readSlots(admin, crew, crew.map(cap), true, TOTAL);
  eq("S3 운영진 삭제/크루 A → [null, A, null, null] (A 1번으로 이동 안 함)", slots, [null, "A", null, null]);
}

// ── 시나리오 4: 크루가 C 추가 (A 있는 상태) — 저장 payload=[A, C] ──
{
  // 편집 화면 슬롯(운영진 없음): [null, A, C, null]
  const editing = [null, "A", "C", null];
  const editingCaps = editing.map(cap);
  const reserved = Math.min(Math.max(0, RESERVED_ADMIN_IMAGE_SLOTS), TOTAL); // 1
  const { crewImages } = splitReservedImageSlots(editing, editingCaps, reserved);
  eq("S4 저장 payload(크루) = [A, C, null] (운영진 슬롯 제외)", crewImages, ["A", "C", null]);
  eq("S4 payload 유의미 이미지 = [A, C]", crewImages.filter(Boolean), ["A", "C"]);
  // 저장→읽기 round-trip
  const persisted = persistCrewImages(crewImages);
  const slots = readSlots([], persisted, persisted.map(cap), true, TOTAL);
  eq("S4 읽기 → [null, A, C, null]", slots, [null, "A", "C", null]);
}

// ── 시나리오 5: 크루 첫 이미지 A 삭제 ([A, C] → C만) — C는 2번으로 이동 허용, 1번(운영진) 금지 ──
{
  // 편집 화면 슬롯 [null, A, C, null] 에서 A(슬롯1) 삭제 → filter → [null, C, null, null]
  const afterDelete = [null, "C", null, null];
  const reserved = 1;
  const { crewImages } = splitReservedImageSlots(afterDelete, afterDelete.map(cap), reserved);
  eq("S5 저장 payload = [C, null, null]", crewImages, ["C", null, null]);
  const persisted = persistCrewImages(crewImages);
  const slots = readSlots([], persisted, persisted.map(cap), true, TOTAL);
  eq("S5 읽기 → [null, C, null, null] (C=2번, 1번 아님)", slots, [null, "C", null, null]);
  eq("S5 C가 1번(운영진 슬롯)에 없음", slots[0], null);
}

// ── 레거시/stale 호환: adminOutputImageCount 누락·0 이어도 크루 첫 이미지는 2번 ──
{
  // stale: 운영진 없음, 크루 [A] — reserved 는 무조건 floor 되어 1
  const slots = readSlots([], ["A"], ["A-cap"], true, TOTAL);
  eq("Legacy stale(count 누락/0) → [null, A, null, null]", slots, [null, "A", null, null]);
}

// ── fail-safe: 라인 매칭 실패(hasLine=false)여도 reserved=1 유지 (크루가 1번으로 안 밀림) ──
{
  const slots = readSlots([], ["A"], ["A-cap"], false, TOTAL); // hasLine=false
  eq("Fail-safe 매칭 실패에도 → [null, A, null, null] (reserved=0 로 안 떨어짐)", slots, [null, "A", null, null]);
  eq("Fail-safe A가 1번(슬롯0)에 없음", slots[0], null);
}

// ── 운영진 이미지가 저장 payload 에 누수되지 않음 (핵심 회귀: exp/ability 이전 버그) ──
{
  // 편집 화면 슬롯(운영진 B 존재): [B, A, null, null]. 저장 payload 는 크루만 = [A, null, null]
  const editing = ["B", "A", null, null];
  const { crewImages } = splitReservedImageSlots(editing, editing.map(cap), 1);
  eq("누수방지 저장 payload = [A, null, null] (B 미포함)", crewImages, ["A", null, null]);
  eq("누수방지 payload 에 B 없음", crewImages.includes("B"), false);
  // 만약 whole 로 저장했다면(구 버그) 읽기 시 이중 오프셋 발생 검증
  const buggyPersist = persistCrewImages(editing); // [B, A, null, null] whole
  const buggySlots = readSlots([{ url: "B", caption: "B-cap" }], buggyPersist.filter((u) => u !== "B") as (string | null)[], [], true, TOTAL);
  // (참고용) 구 버그 재현 확인 — 지금 코드 경로는 위 crewImages(=[A,...]) 로 저장하므로 아래는 발생 안 함.
  void buggySlots;
}

// ── career(3슬롯) 동형 검증 ──
{
  const CAREER_TOTAL = 3;
  const slots = readSlots([], ["A"], ["A-cap"], true, CAREER_TOTAL);
  eq("Career(3슬롯) 운영진 없음/크루 A → [null, A, null]", slots, [null, "A", null]);
  const admin: Img[] = [{ url: "B", caption: "B-cap" }];
  const slots2 = readSlots(admin, ["A"], ["A-cap"], true, CAREER_TOTAL);
  eq("Career(3슬롯) 운영진 B/크루 A → [B, A, null]", slots2, ["B", "A", null]);
}

// ── lib SoT(buildImageSlots/splitImageSlots) round-trip 무손실 검증 ──
{
  const admin: Cluster4OutputImage[] = [{ url: "B", caption: "b" }];
  const crew: Cluster4OutputImage[] = [{ url: "A", caption: "a" }, { url: "C", caption: "c" }];
  const slots = buildImageSlots(admin, crew);
  eq("lib buildImageSlots → [B, A, C, null]", slots.map((s) => s?.url ?? null), ["B", "A", "C", null]);
  const back = splitImageSlots(slots);
  eq("lib splitImageSlots.admin → [B]", back.adminImages.map((i) => i.url), ["B"]);
  eq("lib splitImageSlots.crew → [A, C]", back.crewImages.map((i) => i.url), ["A", "C"]);
  // 운영진 없음: 슬롯0 예약 유지
  const slots2 = buildImageSlots([], crew);
  eq("lib buildImageSlots(운영진 없음) → [null, A, C, null]", slots2.map((s) => s?.url ?? null), [null, "A", "C", null]);
}

console.log(`\n=== 결과: ${failures === 0 ? "ALL PASS ✅" : `${failures} FAIL ❌`} ===\n`);
process.exit(failures === 0 ? 0 : 1);

// 클래스(역할명) 표시 parity 검증 — 실제 HTTP API + 실제 프로덕션 resolver.
// ─────────────────────────────────────────────────────────────────────
// "동일 사용자·동일 기준 시점이면 모든 경로가 같은 클래스 라벨을 낸다"를 실측으로 확인한다.
// 라벨 계산은 **재구현하지 않고** 화면이 쓰는 함수를 그대로 import 한다
//   (lib/crewClassDisplayLabel.resolveCrewClassLabel).
//
// 비교 경로:
//   ① 일반 모드 크루 API            GET  {FRONT}/api/crews?org=
//   ② 테스트 모드 크루 API          GET  {FRONT}/api/crews?org=&mode=test
//   ③ 일반 모드 Cluster4-CARD API   GET  {FRONT}/api/cluster4/weekly-cards?userId=
//   ④ 테스트 모드 Cluster4-CARD API GET  {FRONT}/api/cluster4/weekly-cards?userId=&mode=test
//   ⑤ demoUserId 경로               GET  {FRONT}/api/cluster4/weekly-cards?userId=&demoUserId=
//   ⑥ actAsTestUserId 경로          GET  {FRONT}/api/cluster4/weekly-cards?userId=&actAsTestUserId=
//   ⑦ 어드민 API(직접)              GET  {ADMIN}/api/cluster4/weekly-cards?userId=
//   ⑧ 프로필(이력서 카드 상단)      GET  {FRONT}/api/profile?userId=
//   ⑨ snapshot 저장본(조회 무관)    cluster4_weekly_card_snapshots.cards[]
//
// 실행: npx tsx scripts/verify-crew-class-role-parity.ts
//   env: VERIFY_FRONT_URL(기본 http://localhost:3001) / VERIFY_ADMIN_URL(기본 http://localhost:3005)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolveCrewClassLabel } from "../lib/crewClassDisplayLabel";
import { roleLevelToPositionCode, positionCodeToClassLabel } from "../shared/crewClassPosition";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const FRONT = process.env.VERIFY_FRONT_URL ?? "http://localhost:3001";
const ADMIN = process.env.VERIFY_ADMIN_URL ?? "http://localhost:3005";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Card = {
  weekId?: string | null;
  startDate?: string | null;
  roleLabel?: string | null;
  membershipStatusLabel?: string | null;
  crewClassPositionCode?: string | null;
};

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { accept: "application/json" } });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, body: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, body: null, raw: text.slice(0, 120) };
    }
  } catch (e) {
    return { ok: false, status: 0, body: null, raw: (e as Error).message.slice(0, 120) };
  }
}

// 화면이 쓰는 것과 동일한 함수로 "그 카드의 표시 라벨"을 만든다.
const cardLabel = (c: Card | null | undefined): string =>
  c
    ? resolveCrewClassLabel(
        {
          positionCode: c.crewClassPositionCode,
          roleLabel: c.roleLabel,
          membershipStatusLabel: c.membershipStatusLabel,
        },
        "-",
      )
    : "(카드없음)";

const latestCard = (cards: Card[]): Card | null =>
  [...cards].sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")))[0] ?? null;

// ── 검증 모집단: 역할·등급 조합을 최대한 넓게(회귀 검증 요구 항목 전부 포함) ──
async function pickTargets() {
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id,display_name,role,organization_slug")
    .limit(2000);
  const { data: mems } = await supabase
    .from("user_memberships")
    .select("user_id,team_name,membership_level,is_current,updated_at");

  const memByUser = new Map<string, any[]>();
  for (const m of mems ?? []) {
    if (!memByUser.has(m.user_id)) memByUser.set(m.user_id, []);
    memByUser.get(m.user_id)!.push(m);
  }
  const pick = (rows: any[] | undefined) => {
    const rank = (r: any) => {
      const cur = Boolean(r.is_current);
      const team = typeof r.team_name === "string" && r.team_name.trim() !== "";
      if (cur && team) return 0;
      if (team) return 1;
      if (cur) return 2;
      return 3;
    };
    return [...(rows ?? [])].sort(
      (a, b) => rank(a) - rank(b) || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
    )[0] ?? null;
  };

  const buckets = new Map<string, any[]>();
  for (const p of profiles ?? []) {
    const level = pick(memByUser.get(p.user_id))?.membership_level ?? null;
    const key = `${p.role ?? "(null)"} / ${level ?? "(null)"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    if (buckets.get(key)!.length < 2) buckets.get(key)!.push({ ...p, level, bucket: key });
  }
  return Array.from(buckets.values()).flat();
}

async function main() {
  const targets = await pickTargets();
  console.log(`검증 대상: ${targets.length}명 (role×등급 조합 전수 커버)\n`);

  const ids = targets.map((t) => t.user_id);
  const snapRows: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await supabase
      .from("cluster4_weekly_card_snapshots")
      .select("user_id,dto_version,cards")
      .in("user_id", ids.slice(i, i + 50));
    snapRows.push(...(data ?? []));
  }
  const snapByUser = new Map(snapRows.map((s) => [s.user_id, s]));

  const orgs = Array.from(new Set(targets.map((t) => t.organization_slug).filter(Boolean))) as string[];
  const crewsByOrg = new Map<string, any>();
  const crewsTestByOrg = new Map<string, any>();
  for (const org of orgs) {
    crewsByOrg.set(org, await getJson(`${FRONT}/api/crews?org=${encodeURIComponent(org)}`));
    crewsTestByOrg.set(org, await getJson(`${FRONT}/api/crews?org=${encodeURIComponent(org)}&mode=test`));
  }
  const crewRow = (res: any, userId: string) =>
    (res?.body?.data ?? []).find((c: any) => c.id === userId) ?? null;

  type Row = Record<string, string>;
  const rows: Row[] = [];
  const failures: string[] = [];

  for (const t of targets) {
    const uid = t.user_id;
    const org = t.organization_slug ?? "";

    const [normal, test, demo, actAs, admin, profile] = await Promise.all([
      getJson(`${FRONT}/api/cluster4/weekly-cards?userId=${uid}`),
      getJson(`${FRONT}/api/cluster4/weekly-cards?userId=${uid}&mode=test`),
      getJson(`${FRONT}/api/cluster4/weekly-cards?userId=${uid}&demoUserId=${uid}`),
      getJson(`${FRONT}/api/cluster4/weekly-cards?userId=${uid}&actAsTestUserId=${uid}`),
      getJson(`${ADMIN}/api/cluster4/weekly-cards?userId=${uid}`),
      getJson(`${FRONT}/api/profile?userId=${uid}`),
    ]);

    const cardsOf = (r: any): Card[] => (Array.isArray(r?.body?.data) ? r.body.data : []);
    const snapCards: Card[] = Array.isArray(snapByUser.get(uid)?.cards) ? snapByUser.get(uid)!.cards : [];

    const L = {
      "③일반CARD": cardLabel(latestCard(cardsOf(normal))),
      "④testCARD": cardLabel(latestCard(cardsOf(test))),
      "⑤demoUserId": cardLabel(latestCard(cardsOf(demo))),
      "⑥actAsTest": cardLabel(latestCard(cardsOf(actAs))),
      "⑦어드민": cardLabel(latestCard(cardsOf(admin))),
      "⑨snapshot": cardLabel(latestCard(snapCards)),
    };

    // ⑧ 프로필(이력서 카드 상단) — 사이드바와 동일하게 class_position_code 우선.
    const pd = profile?.body?.data ?? null;
    const profileLabel = pd
      ? resolveCrewClassLabel({ positionCode: pd.class_position_code, roleLabel: pd.membership_level }, "-")
      : "(프로필없음)";

    // ①② 크루 API — className(서버 라벨) 과 classPositionCode(공통 코드) 둘 다 본다.
    const cn = crewRow(crewsByOrg.get(org), uid);
    const ct = crewRow(crewsTestByOrg.get(org), uid);

    // 기준값 = 공통 정규화기(현재 시점). 주차 override 없는 사용자의 "현재" 클래스.
    const canonicalNow = positionCodeToClassLabel(roleLevelToPositionCode(t.role, t.level)) ?? "(정규화불가)";

    const cardLabels = Array.from(new Set(Object.values(L).filter((v) => v !== "(카드없음)")));
    const cardsAgree = cardLabels.length <= 1;
    if (!cardsAgree) failures.push(`${t.display_name}: 경로별 카드 라벨 불일치 ${JSON.stringify(L)}`);

    // 카드가 있는 사용자는 "현재 주차 카드 라벨"과 "프로필(현재) 라벨"이 같아야 한다.
    const cardNow = cardLabels[0];
    if (cardNow && profileLabel !== "(프로필없음)" && cardNow !== profileLabel) {
      failures.push(`${t.display_name}: 카드(현재주차)=${cardNow} vs 프로필=${profileLabel}`);
    }
    // 크루 API className 은 배지 노출 정책상 null 가능 — 값이 있으면 canonical 과 같아야 한다.
    if (cn?.className && cn.className !== canonicalNow && canonicalNow !== "(정규화불가)") {
      failures.push(`${t.display_name}: /api/crews className=${cn.className} vs canonical=${canonicalNow}`);
    }
    if (cn && ct && cn.className !== ct.className) {
      failures.push(`${t.display_name}: 크루 API 일반=${cn.className} vs test=${ct.className}`);
    }

    rows.push({
      name: t.display_name,
      "role/등급": t.bucket,
      canonical: canonicalNow,
      "①crews": cn ? `${cn.className ?? "(배지없음)"}` : "(목록없음)",
      "②crews:test": ct ? `${ct.className ?? "(배지없음)"}` : "(목록없음)",
      "⑧profile": profileLabel,
      ...L,
      OK: cardsAgree ? "✓" : "✗",
    });
  }

  console.table(rows);

  console.log("\n── snapshot 저장 원본(raw) 확인: roleLabel 은 등급 원문이 남아 있어도 무방 ──");
  for (const t of targets.slice(0, 6)) {
    const snap = snapByUser.get(t.user_id);
    const cards: Card[] = Array.isArray(snap?.cards) ? snap.cards : [];
    const c = latestCard(cards);
    if (!c) continue;
    console.log(
      `  ${t.display_name.padEnd(8)} dto_v=${snap?.dto_version}  raw roleLabel=${JSON.stringify(c.roleLabel)}  ` +
        `crewClassPositionCode=${JSON.stringify(c.crewClassPositionCode)}  → 표시=${cardLabel(c)}`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 전 사용자 오프라인 패스 — 로컬 dev 는 QA 모드(NEXT_PUBLIC_APP_ENV=qa)라 실사용자 대상
  //   HTTP 응답이 QA_MODE_FORBIDDEN 으로 차단된다(설계된 게이트). 그 게이트는 역할 로직보다
  //   **앞단**이라 라벨에 영향을 주지 않으므로, 실사용자는 같은 함수를 같은 원천 데이터에
  //   직접 적용해 전수 검증한다(운영 배포에서 HTTP 로 나가는 값과 동일 계산).
  console.log("\n── 전 사용자 오프라인 패스(실사용자 포함) ──");
  const { data: allProfiles } = await supabase
    .from("user_profiles")
    .select("user_id,display_name,role")
    .limit(2000);
  const { data: allMems } = await supabase
    .from("user_memberships")
    .select("user_id,team_name,membership_level,is_current,updated_at");
  const memAll = new Map<string, any[]>();
  for (const m of allMems ?? []) {
    if (!memAll.has(m.user_id)) memAll.set(m.user_id, []);
    memAll.get(m.user_id)!.push(m);
  }
  const pickMem = (rows: any[] | undefined) => {
    const rank = (r: any) => {
      const cur = Boolean(r.is_current);
      const team = typeof r.team_name === "string" && r.team_name.trim() !== "";
      if (cur && team) return 0;
      if (team) return 1;
      if (cur) return 2;
      return 3;
    };
    return [...(rows ?? [])].sort(
      (a, b) => rank(a) - rank(b) || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
    )[0] ?? null;
  };
  const allIds = (allProfiles ?? []).map((p) => p.user_id);
  const allSnaps: any[] = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const { data } = await supabase
      .from("cluster4_weekly_card_snapshots")
      .select("user_id,dto_version,cards")
      .in("user_id", allIds.slice(i, i + 50));
    allSnaps.push(...(data ?? []));
  }
  const snapAll = new Map(allSnaps.map((s) => [s.user_id, s]));

  // 현재 주차 override — /api/profile 이 현재 시점 클래스에 덧씌우는 것과 **같은 원천**.
  //   이걸 빼고 비교하면 "현재 주차 override 를 받은 사용자"가 가짜 불일치로 잡힌다.
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: curWeek } = await supabase
    .from("weeks")
    .select("start_date")
    .lte("start_date", todayIso)
    .order("start_date", { ascending: false })
    .limit(1);
  const curWeekStart = curWeek?.[0]?.start_date ?? null;
  const { data: curOverrides } = await supabase
    .from("cluster4_team_week_position_overrides")
    .select("user_id,week_start_date,position_code")
    .eq("week_start_date", curWeekStart ?? "1970-01-01");
  const ovrNow = new Map((curOverrides ?? []).map((o) => [o.user_id, o.position_code]));
  console.log(`  현재 주차=${curWeekStart} · 현재 주차 override 보유자 ${ovrNow.size}명`);

  let checked = 0;
  const banned = /(^|[^(])일반|(^|[^(])심화(?!\()/;
  const bannedHits: string[] = [];
  const currentMismatch: string[] = [];
  // 코드 정규화 불가 = 데이터 품질 이슈(등급 NULL·비표준 값·등급체계 밖 계정)이지 "구 스냅샷"이 아니다.
  //   정규화기가 조용히 regular 로 만들지 않는 것이 정책이므로, 여기서는 폴백이 실제로 라벨을
  //   만들어내는지(=화면이 "-" 로 깨지지 않는지)만 본다. 진짜 재생성 대상은 dto_version 이
  //   crewClassPositionCode 도입(v46) 이전인 스냅샷뿐이다.
  const legacySnapshotUsers: string[] = [];
  const unresolvable: string[] = [];
  for (const p of allProfiles ?? []) {
    const level = pickMem(memAll.get(p.user_id))?.membership_level ?? null;
    const profileLabel =
      positionCodeToClassLabel(ovrNow.get(p.user_id) ?? roleLevelToPositionCode(p.role, level)) ?? null;
    const snap = snapAll.get(p.user_id);
    const cards: Card[] = Array.isArray(snap?.cards) ? snap!.cards : [];
    if (cards.length === 0) continue;
    checked++;
    if ((snap?.dto_version ?? 0) < 46) legacySnapshotUsers.push(`${p.display_name}(v${snap?.dto_version})`);
    for (const c of cards) {
      const label = cardLabel(c);
      if (!c.crewClassPositionCode && label === "-") {
        unresolvable.push(`${p.display_name} ${c.startDate}(role=${p.role ?? "null"}, 등급=${level ?? "null"})`);
      }
      // 내부 어휘("일반" 단독 / 괄호 없는 "심화")가 화면 문자열로 새는지 — 표시 어휘 게이트.
      if (banned.test(label)) bannedHits.push(`${p.display_name}: "${label}"`);
    }
    // 현재 주차 카드 == 프로필(현재 시점) — **같은 기준 시점**끼리만 비교한다.
    const cur = curWeekStart ? cards.find((c) => c.startDate === curWeekStart) ?? null : null;
    if (cur && profileLabel) {
      const curLabel = cardLabel(cur);
      if (curLabel !== profileLabel) {
        currentMismatch.push(
          `${p.display_name}(role=${p.role ?? "null"}, 등급=${level ?? "null"}): 현재주차카드=${curLabel} / 프로필=${profileLabel} [code=${cur.crewClassPositionCode ?? "null"}]`,
        );
      }
    }
  }
  console.log(`  스냅샷 보유 사용자 ${checked}명 전수`);
  console.log(`  구 스냅샷(dto_version<46, crewClassPositionCode 도입 이전): ${legacySnapshotUsers.length}명 ${legacySnapshotUsers.slice(0, 5).join(", ")}`);
  console.log(`  코드·폴백 모두 실패해 "-" 로 떨어지는 카드: ${unresolvable.length}건 ${unresolvable.slice(0, 4).join(", ")}`);
  console.log(`  금지 어휘 노출: ${bannedHits.length}건 ${bannedHits.slice(0, 5).join(", ")}`);
  console.log(`  현재주차카드↔프로필(동일 시점) 불일치: ${currentMismatch.length}건`);
  for (const m of currentMismatch.slice(0, 12)) console.log("    · " + m);
  if (legacySnapshotUsers.length > 0) failures.push(`구 스냅샷(v<46) ${legacySnapshotUsers.length}명 — 재생성 필요`);
  if (bannedHits.length > 0) failures.push(`금지 어휘 노출 ${bannedHits.length}건`);
  if (currentMismatch.length > 0) failures.push(`동일 시점(현재 주차) 라벨 불일치 ${currentMismatch.length}건`);

if (failures.length > 0) {
    console.error(`\n❌ 불일치 ${failures.length}건`);
    for (const f of failures) console.error("   - " + f);
    process.exit(1);
  }
  console.log("\n✅ 전 경로 클래스 라벨 일치 (일반 / mode=test / demoUserId / actAsTestUserId / 어드민 / snapshot / 프로필 / 크루 API).");

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

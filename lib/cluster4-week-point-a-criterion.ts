import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// 주차 성장 성공 "포인트 A 기준 개수" 단일 SoT — 고객 앱 서버 사이드 로더.
//
// 값의 의미 = **그 주차·그 조직의 성장 성공 판정에 실제로 쓰인 Point.A 기준 개수**
//   (사용자가 이번 주 획득한 Point.A 가 아니다 — 획득량은 별도 축이다).
//
// 원천(SoT) = cluster4_week_opening_configs.recognition_count_n  (week_id × organization_slug)
//   · 어드민 `lib/lineAvailability.fetchWeekRecognitionRequiredByOrg` 의 **미러**다
//     (같은 테이블·같은 select·같은 "값 없음=null" 정책, 두 레포는 별도 배포라 함수를 공유할 수 없다).
//     어드민 주석 표기 그대로 "[주차 성공 기준값 SoT] recognition_count_n[주차, 조직]" —
//     verdict(성공/실패 판정)·finalize 차단 검사가 읽는 바로 그 값이다.
//   · 세 화면(주차 상세 · 주차 카드 · Detail Log)이 이 로더 하나로 수렴한다.
//
// ⚠ 어드민 카드 DTO 의 experienceGrowth.checkGate.required 를 표시에 쓰지 않는 이유:
//   그건 **사용자별 weekly-cards 스냅샷**에 구워진 값이라, 어드민이 N 을 수정한 뒤 아직 재계산되지
//   않은 유저는 옛 값을 그대로 들고 있다. 2026-07-22 실측(encre 2026-summer W1): 같은 주차·같은
//   조직인데 required=81(287명) / 45(41명) 공존, DB recognition_count_n=45. 화면 표시는 주차×조직
//   단위 값이어야 하므로 스냅샷이 아니라 이 원천을 읽는다. (판정 로직은 종전대로 checkGate 사용 — 불변.)
//
// ⚠ org_week_thresholds / weeks.check_threshold(=lib/weekResultState.resolveOrgWeekThresholds)는
//   **다른 값**이다(봄 시즌 리그 집계 전용으로만 존치). 실측 2026-summer W2: recognition_count_n
//   phalanx=68·encre=75·oranke=45 vs check_threshold=행 없음. 기준값 표시에 쓰면 안 된다.
//
// 스코프: 항상 operating.
//   · qa_cluster4_week_opening_configs 오버레이 테이블은 존재하지 않는다(실측: PGRST205).
//   · 주차/시즌/정책/판정 값은 QA 배포에서도 operating 을 그대로 따른다(QA 는 사용자 목록 노출만
//     test 로 갈린다) → mode/actAsTestUserId/demoUserId 로 분기하지 않는다.
//
// 미확정 정책: 행 없음 / NULL / 0 이하 → null 을 돌려준다. 소비처는 "0개"가 아니라 "-" 로 표시한다.
// ─────────────────────────────────────────────────────────────────────────

// 표시 문구/포맷은 클라이언트도 쓰므로 lib/pointACriterionLabel.ts(서버 전용 아님)에 있다.
import { normalizePointACriterion } from "@/lib/pointACriterionLabel";

const IN_CHUNK = 100;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * (weekId → Point.A 기준 개수) 맵. 주차 목록 1회 조회 = 카드당 추가 호출 0.
 * 미확정 주차는 맵에 담기지 않는다(get → undefined → 소비처가 null/"-" 처리).
 */
export async function resolveWeekPointACriteria(
  db: SupabaseClient,
  opts: { org: string | null | undefined; weekIds: readonly string[] },
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const org = String(opts.org ?? "").trim();
  const ids = Array.from(new Set(opts.weekIds.filter(Boolean)));
  if (!org || ids.length === 0) return out;

  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await db
      .from("cluster4_week_opening_configs")
      .select("week_id, recognition_count_n")
      .eq("organization_slug", org)
      .in("week_id", part)
      .returns<Array<{ week_id: string; recognition_count_n: number | null }>>();
    if (error) {
      // 조회 실패는 "미확정"과 같게 취급한다 — 값을 지어내지 않고 "-" 로 남긴다.
      console.error("[pointACriterion] cluster4_week_opening_configs fetch failed", { error: error.message });
      continue;
    }
    for (const r of data ?? []) {
      const n = normalizePointACriterion(r.recognition_count_n);
      if (n != null) out.set(r.week_id, n);
    }
  }

  return out;
}

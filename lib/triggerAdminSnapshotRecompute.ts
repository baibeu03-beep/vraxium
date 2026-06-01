import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";

// 고객앱에서 주차 카드에 영향을 주는 데이터를 저장/삭제한 직후, admin snapshot
// 재계산을 트리거하는 server-to-server 헬퍼.
//
// 설계 원칙:
//   - best-effort: 실패해도 throw 하지 않는다 → 원래 고객 저장/삭제 작업을 rollback 하지 않음.
//   - env (admin base url / INTERNAL_API_KEY) 미설정 시 console.warn 후 skip.
//   - userId 중복 제거 후 비어 있으면 호출하지 않음.
//   - admin lib 직접 import 금지 — HTTP 호출만 사용 (weekly-cards proxy 와 동일한
//     resolveAdminBaseUrl + x-internal-api-key 패턴).
const RECOMPUTE_PATH = "/api/admin/cluster4/recompute-user-snapshots";
const RECOMPUTE_TIMEOUT_MS = 5_000;

export async function triggerAdminSnapshotRecompute(
  userIds: Array<string | null | undefined>
): Promise<void> {
  try {
    const uniqueUserIds = Array.from(
      new Set(
        userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    if (uniqueUserIds.length === 0) {
      return;
    }

    const adminBaseUrl = await resolveAdminBaseUrl();
    if (!adminBaseUrl) {
      console.warn(
        "[triggerAdminSnapshotRecompute] admin backend URL 미설정 (env + localhost probe 실패) — recompute skip",
        { userCount: uniqueUserIds.length }
      );
      return;
    }

    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      console.warn("[triggerAdminSnapshotRecompute] INTERNAL_API_KEY 미설정 — recompute skip");
      return;
    }

    const targetUrl = `${adminBaseUrl}${RECOMPUTE_PATH}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RECOMPUTE_TIMEOUT_MS);

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });
      if (!res.ok) {
        console.error("[triggerAdminSnapshotRecompute] recompute 응답 실패", {
          status: res.status,
          userCount: uniqueUserIds.length,
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // best-effort: 호출 실패는 삼키고 절대 throw 하지 않는다.
    const e = error as { name?: string; message?: string };
    console.error("[triggerAdminSnapshotRecompute] recompute 호출 실패", {
      isAbort: e?.name === "AbortError",
      name: e?.name,
      message: e?.message || String(error),
    });
  }
}

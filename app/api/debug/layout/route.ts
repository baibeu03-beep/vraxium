// 임시 진단 — cluster-4 work-view-modal 레이아웃 깨짐 원인 추적용 telemetry 수집.
// ?debugLayout=1 일 때만 클라이언트가 호출하므로 인증/rate-limit는 생략.
// 검증 후 반드시 제거할 것. (utils/debugLayout.ts 와 호출부도 함께)
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 32 * 1024; // 32KB — payload는 수 KB 수준이므로 충분

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "payload too large" },
        { status: 413 },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid json" },
        { status: 400 },
      );
    }

    // 서버 로그(Vercel/Console)에서 grep 할 수 있도록 prefix + 한 줄 JSON
    // eslint-disable-next-line no-console
    console.log("[layout-debug]", JSON.stringify(payload));

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[layout-debug] route error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

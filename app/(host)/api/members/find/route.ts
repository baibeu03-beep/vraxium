import { NextResponse } from "next/server";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 기존 회원 찾기 — 사용자 앱(프론트)의 동일 출처 진입점.
 *
 * 실제 조회 로직은 admin 백엔드(vraxium-admin)의 `/api/members/find`
 * (lib/memberLookup.ts findExistingMember) 단일 SoT 에 위임한다. 프론트는
 * 로직을 중복 구현하지 않고 그대로 프록시만 한다 — 응답 DTO 동일성·
 * direct==HTTP 보장은 백엔드 lib 한 곳에서 성립.
 *
 * 매칭/마스킹 규칙(백엔드):
 *   - 이름: display_name OR english_name 정확 일치
 *   - 전화: contact_phone 숫자 정규화 비교
 *   - 등록 이메일: auth_email → contact_email (email 컬럼 부재)
 *   - 응답: { found:true, displayName, maskedEmail } | { found:false }
 *     (실제 이메일 원문은 절대 미반환 — 마스킹만)
 *
 * 모달은 same-origin 이 필요(백엔드는 CORS 미설정)하므로 본 프록시를 경유한다.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; phone?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "이름과 휴대폰 번호를 모두 입력해주세요." },
      { status: 400 },
    );
  }

  const name = typeof body?.name === "string" ? body.name : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  if (!name.trim() || !phone.trim()) {
    return NextResponse.json(
      { error: "이름과 휴대폰 번호를 모두 입력해주세요." },
      { status: 400 },
    );
  }

  const adminBaseUrl = await resolveAdminBaseUrl();
  if (!adminBaseUrl) {
    console.error("[/api/members/find] admin backend URL 미해결 — 조회 위임 실패");
    return NextResponse.json(
      { error: "조회 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${adminBaseUrl}/api/members/find`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({ name, phone }),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => null);
    // 백엔드 DTO 를 그대로 통과시킨다(가공 금지 — DTO 동일성 유지).
    return NextResponse.json(data ?? { found: false }, { status: upstream.status });
  } catch (e) {
    console.error("[/api/members/find] admin 백엔드 호출 실패", e);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}

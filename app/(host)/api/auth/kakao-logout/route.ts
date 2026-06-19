import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 카카오 계정 세션 종료용 리다이렉트 라우트.
// 클라이언트가 앱(next-auth) 세션을 먼저 지운 뒤 이 라우트로 이동하면, 여기서 카카오
// 로그아웃 엔드포인트로 302 한다. 카카오가 세션을 종료한 뒤 logout_redirect_uri 로 복귀.
//
//  · client_id          = 서버 env KAKAO_CLIENT_ID (OAuth authorize 에 이미 노출되는 값 — 비밀 아님)
//  · logout_redirect_uri = 요청 origin 기반(로컬/운영 자동 분기, 하드코딩 없음), returnTo 동일 origin 만 허용
//
// ⚠ logout_redirect_uri 는 Kakao Developers 콘솔(카카오 로그인 > 고급 > Logout Redirect URI)에
//   환경별로 등록돼 있어야 한다(미등록 시 카카오가 에러). 등록 없으면 client_id 누락 폴백처럼
//   카카오를 거치지 않고 앱으로만 복귀할 수도 있으므로 운영 등록 필요.
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const clientId = process.env.KAKAO_CLIENT_ID;

  // returnTo 는 동일 origin 경로만 허용(open-redirect 방지). 기본 /sign-in.
  let redirectUri = `${origin}/sign-in`;
  const raw = req.nextUrl.searchParams.get("returnTo");
  if (raw) {
    try {
      const candidate = new URL(raw, origin);
      if (candidate.origin === origin) redirectUri = candidate.toString();
    } catch {
      /* 잘못된 returnTo → 기본값 사용 */
    }
  }

  // client_id 미설정 시 카카오 우회 — 앱으로만 복귀(앱 세션은 이미 종료된 상태).
  if (!clientId) {
    return NextResponse.redirect(redirectUri);
  }

  const kakaoLogout = new URL("https://kauth.kakao.com/oauth/logout");
  kakaoLogout.searchParams.set("client_id", clientId);
  kakaoLogout.searchParams.set("logout_redirect_uri", redirectUri);
  return NextResponse.redirect(kakaoLogout.toString());
}

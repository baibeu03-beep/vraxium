import { signOut } from "next-auth/react";

// 공용 로그아웃 — provider 에 따라 분기한다.
//   · kakao  : 앱(next-auth) 세션 종료 + 카카오 계정 세션까지 종료(카카오 로그아웃 URL 경유).
//              → 다음 로그인 시 카카오 계정 선택/재로그인 화면이 뜬다.
//   · 그 외(google 등): 기존처럼 앱 세션만 종료(구글 전체 로그인 상태는 유지).
//              구글 재로그인 계정 선택은 GoogleProvider authorization prompt=select_account 가 담당.
//
// provider 는 호출부에서 useSession 의 session.provider(= jwt/session callback 에 저장)로 넘긴다.
// returnTo(callbackUrl)는 window.location.origin 기준으로 합쳐 환경(로컬/운영) 자동 분기 —
// 하드코딩/별도 env 없이 동작하고, 카카오 redirect uri 도 서버 라우트에서 origin 으로 구성한다.
export async function appSignOut(
  provider: string | null | undefined,
  callbackUrl = "/sign-in",
): Promise<void> {
  if (provider === "kakao") {
    // 앱 세션 먼저 종료(쿠키 제거) — redirect:false 로 이동은 우리가 직접 한다.
    await signOut({ redirect: false });
    // 카카오 로그아웃 복귀는 항상 /sign-in 으로 고정한다(완전 로그아웃 후 자연스러운 착지).
    // 버튼별 callbackUrl 에 의존하지 않으므로 Kakao 콘솔 logout_redirect_uri 등록이
    // 환경당 1개({origin}/sign-in)로 단순해진다. origin 은 런타임 기준(로컬/운영 자동 분기).
    const returnTo = `${window.location.origin}/sign-in`;
    window.location.href = `/api/auth/kakao-logout?returnTo=${encodeURIComponent(
      returnTo,
    )}`;
    return;
  }

  await signOut({ callbackUrl });
}

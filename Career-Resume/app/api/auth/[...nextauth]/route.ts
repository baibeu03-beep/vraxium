import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withSessionCookies } from "@/lib/session-cookie";

const handler = NextAuth(authOptions);

// 세션 토큰을 브라우저 세션 쿠키로 변환(Expires/Max-Age 제거):
//   - 새로고침/페이지이동/새 탭 → 로그인 유지
//   - 브라우저 완전 종료 → 세션 쿠키 자동 삭제 → 재실행 시 로그인 화면
const sessionHandler = withSessionCookies(handler);

export { sessionHandler as GET, sessionHandler as POST };

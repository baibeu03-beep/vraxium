// 로그인 세션을 "브라우저 세션 쿠키"로 만든다.
//
// 요구사항: 브라우저(창 전체)가 종료되면 로그인도 종료. 새로고침/페이지이동/새 탭은 유지.
//
// NextAuth v4 는 세션 토큰 쿠키에 항상 Expires(=session.maxAge, 기본 30일)를 찍어
// 영구 쿠키로 만든다. 이 때문에 브라우저를 닫았다 열어도 로그인이 유지된다.
// config 만으로는 끌 수 없어(쿠키 기록 시점에 expires 가 강제 주입됨),
// 핸들러 응답의 Set-Cookie 에서 세션 토큰 쿠키의 Expires/Max-Age 속성을 제거해
// "세션 쿠키"(브라우저 종료 시 자동 삭제, 탭/새로고침은 공유)로 변환한다.
//
// beforeunload 같은 비표준/비신뢰 이벤트는 사용하지 않는다 — 브라우저 표준
// 세션 쿠키 수명 관리에만 의존한다.

const SESSION_COOKIE_PREFIXES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function getCookieName(setCookie: string): string {
  return setCookie.split("=", 1)[0]?.trim() ?? "";
}

function getCookieValue(setCookie: string): string {
  const firstPair = setCookie.split(";", 1)[0] ?? "";
  const eq = firstPair.indexOf("=");
  return eq === -1 ? "" : firstPair.slice(eq + 1).trim();
}

function isSessionTokenCookie(setCookie: string): boolean {
  const name = getCookieName(setCookie);
  return SESSION_COOKIE_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}.`),
  );
}

// Expires / Max-Age 속성만 제거해 브라우저 세션 쿠키로 변환.
function stripExpiry(setCookie: string): string {
  return setCookie
    .split(";")
    .filter((part) => {
      const key = part.trim().split("=", 1)[0]?.trim().toLowerCase();
      return key !== "expires" && key !== "max-age";
    })
    .join(";");
}

// NextAuth 핸들러를 감싸 세션 토큰 쿠키를 브라우저 세션 쿠키로 변환.
export function withSessionCookies(
  handler: (req: Request, ctx: unknown) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: unknown): Promise<Response> => {
    const res = await handler(req, ctx);

    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];

    if (setCookies.length === 0) {
      return res;
    }

    let mutated = false;
    const rewritten = setCookies.map((cookie) => {
      // 로그아웃(삭제) 쿠키는 값이 비어 있고 Max-Age=0 으로 즉시 만료시켜야 하므로
      // 건드리지 않는다. 값이 있는 세션 토큰 쿠키만 세션 쿠키로 변환한다.
      if (isSessionTokenCookie(cookie) && getCookieValue(cookie) !== "") {
        mutated = true;
        return stripExpiry(cookie);
      }
      return cookie;
    });

    if (!mutated) {
      return res;
    }

    const headers = new Headers(res.headers);
    headers.delete("set-cookie");
    for (const cookie of rewritten) {
      headers.append("set-cookie", cookie);
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}

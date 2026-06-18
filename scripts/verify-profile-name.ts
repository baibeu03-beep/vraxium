// Verifies the "DB display_name in session/API" fix end-to-end:
//   1) direct  — resolveGoogleAccountAccess/resolveUserProfileAccess → profile.display_name
//   2) HTTP    — /api/auth/check-status (DB name over HTTP) with a minted NextAuth session cookie
//   3) HTTP    — /api/auth/session (session callback: user.name=DB name, providerName=OAuth name)
// Cookie is a real NextAuth JWE minted with NEXTAUTH_SECRET (same encode NextAuth uses).
import { encode } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveGoogleAccountAccess } from "@/lib/auth-account-access";
import { resolveUserProfileAccess } from "@/lib/user-profile-access";

const EMAIL = "baibeu03@gmail.com";
const SUB = "100794291990196871797";
const OAUTH_NAME = "바이브";
const KANG = "3330f4c3-5331-4632-bbe6-01a19017a089";
const BASE = "http://localhost:3001";
const COOKIE_NAME = "next-auth.session-token"; // dev (useSecureCookies=false)

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin missing");
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET missing");

  // ---------- 1) DIRECT ----------
  const g = await resolveGoogleAccountAccess(supabaseAdmin, { providerUserId: SUB, email: EMAIL, name: OAUTH_NAME });
  const k = await resolveUserProfileAccess(supabaseAdmin, { email: EMAIL });
  const gName = g.status === "approved" ? (g.profile as any).display_name : `(${g.status})`;
  const kName = k.status === "approved" ? (k.profile as any).display_name : `(${k.status})`;
  console.log("1) DIRECT resolveGoogleAccountAccess.profile.display_name =", gName,
    "| user_id===KANG?", g.status === "approved" && g.profile.user_id === KANG);
  console.log("1) DIRECT resolveUserProfileAccess.profile.display_name  =", kName);

  // The value the jwt callback writes to token.profileName == access.profile.display_name (above).
  const profileNameFromJwt = gName;

  // ---------- mint a NextAuth session token (post-signin shape) ----------
  // Mirrors what lib/auth.ts jwt callback persists for an approved Google login.
  const token = {
    id: KANG,
    sub: KANG,
    email: EMAIL,
    name: OAUTH_NAME,        // OAuth provider name (what NextAuth seeds as token.name)
    profileName: profileNameFromJwt, // set by our jwt-callback change (DB display_name)
    provider: "google",
    providerUserId: SUB,
    isApproved: true,
  };
  const cookie = await encode({ token, secret });

  const headers = { cookie: `${COOKIE_NAME}=${cookie}` };

  // ---------- 2) HTTP check-status (DB name from fresh DB resolution) ----------
  const csRes = await fetch(`${BASE}/api/auth/check-status`, { headers, cache: "no-store" });
  const cs = await csRes.json();
  console.log(`\n2) HTTP GET /api/auth/check-status → ${csRes.status}`);
  console.log("   status:", cs.status, "| data.displayName:", cs?.data?.displayName,
    "| data.userId===KANG?", cs?.data?.userId === KANG);

  // ---------- 3) HTTP /api/auth/session (session callback mapping) ----------
  const sRes = await fetch(`${BASE}/api/auth/session`, { headers, cache: "no-store" });
  const s = await sRes.json();
  console.log(`\n3) HTTP GET /api/auth/session → ${sRes.status}`);
  console.log("   user.name:", s?.user?.name, "| user.providerName:", s?.user?.providerName,
    "| user.id===KANG?", s?.user?.id === KANG);

  // ---------- compare ----------
  const directName = gName;
  const httpCheckStatus = cs?.data?.displayName;
  const httpSessionName = s?.user?.name;
  const allEqual = directName === httpCheckStatus && httpCheckStatus === httpSessionName;
  console.log("\n=== EQUALITY ===");
  console.log("direct:", directName, "| check-status:", httpCheckStatus, "| session.user.name:", httpSessionName);
  console.log("direct === HTTP(check-status) === HTTP(session.user.name)?", allEqual);
  console.log("OAuth name isolated to providerName?", s?.user?.providerName === OAUTH_NAME);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

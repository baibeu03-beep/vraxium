import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "./supabase";
import { resolveUserProfileAccess } from "./user-profile-access";
import { resolveGoogleAccountAccess } from "./auth-account-access";

const isProd = process.env.NODE_ENV === "production";

// 고객 앱 소셜 로그인 provider 매칭 정책 — 결과 계약(UserProfileAccessResult)과
// 승인(isApproved)·token.id=user_profiles.user_id 플로우는 동일하고, 매칭 키만 다르다:
//  * kakao  → email(auth_email/contact_email) 매칭 (resolveUserProfileAccess, 기존 그대로)
//  * google → id_token sub 기반 (provider, provider_user_id) 매칭 (resolveGoogleAccountAccess)
//    같은 email 의 kakao 계정이 있어도 자동 병합하지 않는다.

const kakaoProviderConfig: Parameters<typeof KakaoProvider>[0] = {
  clientId: process.env.KAKAO_CLIENT_ID ?? "",
};

if (process.env.KAKAO_CLIENT_SECRET) {
  kakaoProviderConfig.clientSecret = process.env.KAKAO_CLIENT_SECRET;
}

export const authOptions: AuthOptions = {
  providers: [
    KakaoProvider(kakaoProviderConfig),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // 로그아웃 시 구글 세션은 유지하되, 재로그인 때 항상 계정 선택 화면을 띄운다.
      // (구글 전체 로그인 상태는 보존 — Gmail/Drive 등 영향 없음.)
      authorization: { params: { prompt: "select_account" } },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.user) {
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            image: data.user.image,
            accessToken: data.accessToken,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "kakao") {
        try {
          const email = user.email;
          if (!email) {
            console.error(`${account?.provider} login email missing`);
            return true;
          }

          if (!supabaseAdmin) {
            console.error(`${account?.provider} login supabaseAdmin missing`);
            return true;
          }

          await resolveUserProfileAccess(supabaseAdmin, {
            email,
            name: user.name,
            ensureApplicantOnPending: true,
          });
        } catch (error) {
          console.error("signIn callback error:", error);
        }
      } else if (account?.provider === "google") {
        try {
          if (!supabaseAdmin) {
            console.error("google login supabaseAdmin missing");
            return true;
          }

          // providerAccountId = OIDC 검증된 id_token 의 sub — email 이 아닌 고유 식별자
          await resolveGoogleAccountAccess(supabaseAdmin, {
            providerUserId: account.providerAccountId,
            email: user.email,
            name: user.name,
            picture: user.image,
            ensureApplicantOnPending: true,
          });
        } catch (error) {
          console.error("google signIn callback error:", error);
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }

      // 최초 로그인 시 provider 식별 정보를 토큰에 고정 — check-status 등이
      // 세션만으로 kakao(email)/google(sub) 매칭 경로를 분기할 수 있게 한다.
      if (account?.provider) {
        token.provider = account.provider;
      }
      if (account?.provider === "google") {
        token.providerUserId = account.providerAccountId;
      }

      if (account?.provider === "kakao" && user?.email && supabaseAdmin) {
        try {
          const access = await resolveUserProfileAccess(supabaseAdmin, {
            email: user.email,
            name: user.name,
            fallbackProfileId: typeof token.id === "string" ? token.id : null,
          });

          if (access.status === "approved") {
            token.id = access.profile.user_id ?? token.id;
            token.isApproved = true;
            // UI 표시 이름 SoT = 매칭된 user_profiles.display_name (OAuth 이름이 아님).
            // OAuth provider 이름은 token.name 에 그대로 남겨 providerName 폴백으로만 노출한다.
            token.profileName = access.profile.display_name ?? undefined;
          } else {
            token.isApproved = false;
          }
        } catch (error) {
          console.error("jwt callback error:", error);
          token.isApproved = false;
        }
      } else if (account?.provider === "google" && supabaseAdmin) {
        try {
          const access = await resolveGoogleAccountAccess(supabaseAdmin, {
            providerUserId: account.providerAccountId,
            email: user?.email,
            name: user?.name,
            picture: user?.image,
          });

          if (access.status === "approved") {
            token.id = access.profile.user_id ?? token.id;
            token.isApproved = true;
            // UI 표시 이름 SoT = 매칭된 user_profiles.display_name (OAuth 이름이 아님).
            token.profileName = access.profile.display_name ?? undefined;
          } else {
            token.isApproved = false;
          }
        } catch (error) {
          console.error("google jwt callback error:", error);
          token.isApproved = false;
        }
      }

      // 기존 세션 backfill — 이 변경 이전 발급된 토큰에는 profileName 이 없다.
      // 승인된(user_id 확정) 토큰에 한해 user_profiles.display_name 을 1회 직접 조회해 채운다
      // (재로그인 불필요). user_id PK 직독이라 이메일/매칭 로직과 무관하며, 채워진 뒤에는
      // 가드(!token.profileName)로 재조회하지 않는다.
      if (!token.profileName && token.isApproved === true && typeof token.id === "string" && supabaseAdmin) {
        try {
          const { data } = await supabaseAdmin
            .from("user_profiles")
            .select("display_name")
            .eq("user_id", token.id)
            .maybeSingle();
          if (data?.display_name) {
            token.profileName = data.display_name as string;
          }
        } catch (error) {
          console.error("jwt profileName backfill error:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        // 프로필 드롭다운 등 UI 표시 이름 = 매칭된 user_profiles.display_name 우선.
        //   매칭 실패(미승인) 시 token.profileName 부재 → 기존 OAuth 이름(token.name) 폴백 유지.
        //   OAuth provider 이름은 providerName 으로 분리 노출(폴백/표시용). 매칭/이메일 로직 무변경.
        const providerName = (token.name as string | undefined) ?? session.user.name ?? undefined;
        (session.user as { providerName?: string | null }).providerName = providerName ?? null;
        session.user.name = (token.profileName as string | undefined) ?? providerName ?? null;
        (session as { accessToken?: string }).accessToken = token.accessToken as string;
        (session as { isApproved?: boolean }).isApproved = token.isApproved as boolean;
        // provider 분기용 — 기존(kakao) 세션 토큰에는 없을 수 있는 additive 필드
        (session as { provider?: string }).provider = token.provider as string | undefined;
        (session as { providerUserId?: string }).providerUserId =
          token.providerUserId as string | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: isProd,
  debug: !isProd,
};

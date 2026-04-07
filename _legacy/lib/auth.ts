import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "./supabase";

export const authOptions: AuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
      // 카카오 로그인인 경우만 처리
      if (account?.provider === "kakao") {
        try {
          const email = user.email;
          if (!email) {
            console.error("카카오 로그인: 이메일 없음");
            return true; // 이메일 없어도 로그인은 허용
          }

          if (!supabaseAdmin) {
            console.error("카카오 로그인: supabaseAdmin 없음");
            return true; // 서버 설정 오류여도 로그인은 허용
          }

          // 1. user_profiles에서 기존 사용자 확인 (이미 승인된 사용자)
          const { data: existingProfile } = await supabaseAdmin
            .from("user_profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existingProfile) {
            console.log("기존 승인된 사용자:", email);
            return true;
          }

          // 2. applicants에서 기존 지원자 확인
          const { data: existingApplicant } = await supabaseAdmin
            .from("applicants")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existingApplicant) {
            console.log("기존 지원자:", email);
            return true;
          }

          // 3. 새 지원자로 등록
          // 이름에서 띄어쓰기 제거
          const cleanName = (user.name || "카카오 사용자").replace(/\s+/g, "");
          const { error } = await supabaseAdmin
            .from("applicants")
            .insert({
              name: cleanName,
              email: email,
              applied_date: new Date().toISOString(),
              status: "pending",
            });

          if (error) {
            console.error("지원자 등록 실패:", error);
          } else {
            console.log("새 지원자 등록 완료:", email);
          }
        } catch (error) {
          console.error("signIn 콜백 오류:", error);
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

      // 카카오 로그인 시 user_profiles ID 확인
      if (account?.provider === "kakao" && user?.email && supabaseAdmin) {
        try {
          let matchedProfileId: string | null = null;

          // 1차: 이메일로 직접 매칭
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("id, auth_email")
            .eq("email", user.email)
            .maybeSingle();

          if (profile) {
            matchedProfileId = profile.id;
          }

          // 2차: auth_email (카카오 로그인 이메일)로 매칭
          if (!matchedProfileId) {
            const { data: profileByAuth } = await supabaseAdmin
              .from("user_profiles")
              .select("id, auth_email")
              .eq("auth_email", user.email)
              .maybeSingle();

            if (profileByAuth) {
              matchedProfileId = profileByAuth.id;
            }
          }

          // 3차: 카카오 이름으로 display_name 매칭
          if (!matchedProfileId && user.name) {
            const cleanName = user.name.replace(/\s+/g, "");
            const { data: profileByName } = await supabaseAdmin
              .from("user_profiles")
              .select("id, auth_email")
              .eq("display_name", cleanName)
              .maybeSingle();

            if (profileByName) {
              matchedProfileId = profileByName.id;
            }
          }

          if (matchedProfileId) {
            token.id = matchedProfileId;
            token.isApproved = true;
            // auth_email 자동 저장
            await supabaseAdmin
              .from("user_profiles")
              .update({ auth_email: user.email })
              .eq("id", matchedProfileId)
              .is("auth_email", null);
          } else {
            token.isApproved = false;
          }
        } catch (error) {
          console.error("jwt 콜백 오류:", error);
          token.isApproved = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        (session as { accessToken?: string }).accessToken = token.accessToken as string;
        (session as { isApproved?: boolean }).isApproved = token.isApproved as boolean;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

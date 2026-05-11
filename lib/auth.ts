import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "./supabase";
import { resolveUserProfileAccess } from "./user-profile-access";

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
      if (account?.provider === "kakao") {
        try {
          const email = user.email;
          if (!email) {
            console.error("Kakao login email missing");
            return true;
          }

          if (!supabaseAdmin) {
            console.error("Kakao login supabaseAdmin missing");
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
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.accessToken = (user as { accessToken?: string }).accessToken;
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
          } else {
            token.isApproved = false;
          }
        } catch (error) {
          console.error("jwt callback error:", error);
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

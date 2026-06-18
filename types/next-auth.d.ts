import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin?: boolean;
      // OAuth provider 원본 이름(폴백/표시 분리용). user.name 은 user_profiles.display_name 우선.
      providerName?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
  }

  interface User extends DefaultUser {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    accessToken?: string;
    isAdmin?: boolean;
    // 매칭된 user_profiles.display_name (UI 표시 이름 SoT). 미승인 시 undefined.
    profileName?: string;
  }
}

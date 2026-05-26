# 인증 시스템 설정 가이드

NextAuth.js를 사용한 인증 시스템이 성공적으로 구현되었습니다.

## 설치된 패키지

- `next-auth` - NextAuth.js v5 (App Router 지원)

## 파일 구조

```
/lib
  /auth.ts                          # NextAuth 설정
/app
  /api/auth/[...nextauth]
    /route.ts                       # NextAuth API 라우트 핸들러
/components
  /pages
    /SignIn.tsx                     # 로그인 페이지 (기능 통합됨)
    /SignUp.tsx                     # 회원가입 페이지 (기능 통합됨)
  /providers
    /SessionProvider.tsx            # 세션 프로바이더 컴포넌트
  /shared
    /UserMenu.tsx                   # 사용자 메뉴 컴포넌트 (로그인/로그아웃)
/types
  /next-auth.d.ts                   # NextAuth 타입 정의
/middleware.ts                      # 인증 미들웨어
/.env.example                       # 환경 변수 예제 파일
```

## 설정 단계

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# NextAuth 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# 백엔드 API URL
NEXT_PUBLIC_API_URL=http://your-backend-api.com

# Google OAuth (선택사항)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Discord OAuth (선택사항)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

**NEXTAUTH_SECRET 생성 방법:**
```bash
openssl rand -base64 32
```

### 2. 백엔드 API 엔드포인트 요구사항

백엔드 API에는 다음 엔드포인트가 필요합니다:

#### 로그인 API
- **엔드포인트:** `POST /auth/login`
- **요청 본문:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **응답:**
  ```json
  {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "image": "https://example.com/avatar.jpg"
    },
    "accessToken": "jwt-token-here"
  }
  ```

#### 회원가입 API
- **엔드포인트:** `POST /auth/register`
- **요청 본문:**
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **응답:**
  ```json
  {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name"
    },
    "message": "회원가입이 완료되었습니다."
  }
  ```

### 3. 소셜 로그인 설정 (선택사항)

#### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/) 방문
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보" 이동
4. OAuth 2.0 클라이언트 ID 생성
5. 승인된 리디렉션 URI 추가: `http://localhost:3000/api/auth/callback/google`
6. 클라이언트 ID와 시크릿을 `.env.local`에 추가

#### Discord OAuth
1. [Discord Developer Portal](https://discord.com/developers/applications) 방문
2. 새 애플리케이션 생성
3. OAuth2 섹션에서 클라이언트 ID 및 시크릿 확인
4. 리디렉션 URL 추가: `http://localhost:3000/api/auth/callback/discord`
5. 클라이언트 ID와 시크릿을 `.env.local`에 추가

## 사용 방법

### 1. 페이지에서 세션 정보 사용하기

```typescript
"use client";
import { useSession } from "next-auth/react";

export default function MyComponent() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>로딩중...</div>;
  }

  if (session) {
    return <div>안녕하세요, {session.user?.name}님!</div>;
  }

  return <div>로그인이 필요합니다.</div>;
}
```

### 2. 서버 컴포넌트에서 세션 확인

```typescript
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();

  if (!session) {
    return <div>로그인이 필요합니다.</div>;
  }

  return <div>안녕하세요, {session.user?.name}님!</div>;
}
```

### 3. 로그아웃 구현

```typescript
"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/sign-in" })}>
      로그아웃
    </button>
  );
}
```

### 4. UserMenu 컴포넌트 사용

헤더나 네비게이션에 UserMenu 컴포넌트를 추가하세요:

```typescript
import UserMenu from "@/components/shared/UserMenu";

export default function Header() {
  return (
    <header>
      <nav>
        {/* 다른 네비게이션 항목들... */}
        <UserMenu />
      </nav>
    </header>
  );
}
```

## 보호된 라우트

현재 다음 경로들이 인증을 필요로 합니다 (`middleware.ts` 참조):
- `/profile` - 프로필 페이지
- `/chat` - 채팅 페이지

추가 보호 경로를 설정하려면 `middleware.ts` 파일의 `protectedRoutes` 배열을 수정하세요:

```typescript
const protectedRoutes = ["/profile", "/chat", "/dashboard", "/settings"];
```

## API에서 인증 토큰 사용하기

세션에서 액세스 토큰을 가져와 API 요청에 사용할 수 있습니다:

```typescript
"use client";
import { useSession } from "next-auth/react";

export default function MyComponent() {
  const { data: session } = useSession();

  const fetchData = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/data`, {
      headers: {
        Authorization: `Bearer ${(session as any)?.accessToken}`,
      },
    });
    const data = await response.json();
    return data;
  };

  // ...
}
```

## 문제 해결

### 1. "NEXTAUTH_SECRET 환경 변수가 설정되지 않았습니다" 오류
- `.env.local` 파일에 `NEXTAUTH_SECRET`이 설정되어 있는지 확인하세요.
- 개발 서버를 재시작하세요.

### 2. 로그인 후 리디렉션되지 않음
- 백엔드 API가 올바른 형식의 응답을 반환하는지 확인하세요.
- 브라우저 콘솔에서 오류를 확인하세요.

### 3. 소셜 로그인이 작동하지 않음
- OAuth 클라이언트 ID와 시크릿이 올바르게 설정되어 있는지 확인하세요.
- 리디렉션 URI가 OAuth 앱 설정과 일치하는지 확인하세요.

### 4. 세션이 유지되지 않음
- 쿠키가 차단되지 않았는지 확인하세요.
- HTTPS를 사용하는 경우 `NEXTAUTH_URL`이 HTTPS로 설정되어 있는지 확인하세요.

## 추가 기능

필요에 따라 다음 기능을 추가할 수 있습니다:

1. **이메일 인증** - 회원가입 후 이메일 인증
2. **비밀번호 재설정** - 비밀번호 찾기 기능
3. **2단계 인증 (2FA)** - 추가 보안 레이어
4. **프로필 업데이트** - 사용자 정보 수정
5. **소셜 계정 연동** - 여러 소셜 계정 연결

## 참고 자료

- [NextAuth.js 공식 문서](https://next-auth.js.org/)
- [Next.js App Router 문서](https://nextjs.org/docs/app)

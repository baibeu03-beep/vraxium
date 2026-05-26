"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>로딩중...</div>;
  }

  if (!session) {
    return (
      <div className="user-menu">
        <Link href="/sign-in" className="btn--secondary">
          로그인
        </Link>
        <Link href="/sign-up" className="btn--secondary">
          회원가입
        </Link>
      </div>
    );
  }

  return (
    <div className="user-menu">
      <span>환영합니다, {session.user?.name || session.user?.email}님!</span>
      <button
        onClick={() => signOut({ callbackUrl: "/sign-in" })}
        className="btn--secondary"
      >
        로그아웃
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// 신규 가입자 가드: user_profiles 매칭이 없는 카카오 계정으로 (main-layout) 자식 라우트 진입 시
// '어드민 승인 대기중' 안내 후 메인('/') 으로 돌려보냄.
// - '/' 자체는 무한 루프 방지를 위해 skip
// - 한 세션 내 1회 표시 (sessionStorage 플래그) — alert 반복 방지
export default function ProfileApprovalGate() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname || pathname === "/") return;
    if ((session?.user as any)?.isAdmin) return; // 어드민(마더 계정)은 user_profiles 에 없음
    if (typeof window !== "undefined" && sessionStorage.getItem("approval-gate-shown")) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/", { cache: "no-store", credentials: "same-origin" });
        if (cancelled) return;
        if (res.status === 404) {
          try { sessionStorage.setItem("approval-gate-shown", "1"); } catch {}
          alert("어드민 승인 대기중입니다.");
          router.replace("/");
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [status, session, pathname, router]);

  return null;
}

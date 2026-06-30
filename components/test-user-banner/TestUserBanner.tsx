"use client";

import { useEffect, useState } from "react";

/**
 * 테스트 유저 모드 배너.
 * - 부모는 demoUserId 가 있을 때(테스트 유저 모드)에만 이 컴포넌트를 렌더한다.
 * - 표시 이름 우선순위:
 *   1) URL 쿼리 ?demoUserName= (admin 앱이 cross-origin 이동 시 전달 — sessionStorage 대체)
 *   2) sessionStorage.demoPreviewUser({ userId, name, email }) (동일 origin 진입 폴백)
 *   3) 없으면 일반 문구로 fallback
 * - window/sessionStorage 접근은 마운트 후(useEffect)에만 — SSR/CSR hydration mismatch 방지.
 *   admin(3000) → 고객(3001) 은 origin 이 달라 sessionStorage 가 공유되지 않으므로 URL 전달이 기본 경로다.
 */
export default function TestUserBanner() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // 1) URL 쿼리 우선 (cross-origin 이동의 기본 경로).
      const fromUrl = new URLSearchParams(window.location.search)
        .get("demoUserName")
        ?.trim();
      if (fromUrl) {
        setName(fromUrl);
        return;
      }
      // 2) 동일 origin 진입 폴백 — sessionStorage.
      const raw = sessionStorage.getItem("demoPreviewUser");
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string | null };
        if (parsed?.name) setName(parsed.name);
      }
    } catch {
      // 접근 실패 / JSON 파싱 실패 → fallback 문구 사용
    }
  }, []);

  const message = name
    ? `테스트 유저 모드: 현재 ${name} 님 계정으로 UX 검증 중입니다.`
    : "테스트 유저 모드로 UX 검증 중입니다.";

  void message;

  // QA/test-user banner is temporarily disabled. Preserve the UI for future QA deployment reuse.
  // return (
  //   <div
  //     role="status"
  //     style={{
  //       position: "sticky",
  //       top: 0,
  //       zIndex: 1000,
  //       width: "100%",
  //       padding: "10px 16px",
  //       background: "#1E9503",
  //       color: "#fff",
  //       fontSize: "14px",
  //       fontWeight: 600,
  //       textAlign: "center",
  //       lineHeight: 1.4,
  //       boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  //     }}
  //   >
  //     {message}
  //   </div>
  // );
  return null;
}

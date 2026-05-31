"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

// 고객 앱 공통 테스트 유저(데모) 모드 훅.
// ─────────────────────────────────────────────────────────────────────────
// admin → 고객 앱 진입 URL: /cluster-X?admin=true&demoUserId={id}&demoUserName={name}
//   - demoUserId 가 있으면 "테스트 유저 모드". 화면/조회/저장 대상을 그 유저로 고정한다.
//   - demoUserName 이 있으면 상단 배너 표시(TestUserBanner 는 자체적으로 URL 에서 읽음).
//   - demoUserId 가 없으면 기존 일반 로그인 흐름 그대로(모든 값이 비활성/no-op).
//
// cluster-4 계열(Cluster41Content / Cluster4CardContent)에 인라인 중복되던
//   demoUserId / targetUserId / demoQS / userLinkQuery 패턴을 단일 소스로 일원화한다.
//
// 사용 예:
//   const demo = useDemoUserMode();
//   const targetUserId = demo.targetUserId;                 // 조회/표시 대상
//   fetch(`/api/foo?userId=${targetUserId}${demo.demoQS}`)  // GET — userId 폴드 + demoUserId suffix
//   fetch(demo.appendDemoUserParams("/api/foo"), { method: "PUT", ... })  // 저장 — demoUserId 부착
//   router.push(`/cluster-2${demo.userLinkQuery}`)          // 네비게이션 — query 유지
//   {demo.isDemo ? <TestUserBanner /> : null}
// ─────────────────────────────────────────────────────────────────────────
export interface DemoUserMode {
  /** URL ?demoUserId= 원본 (없으면 null) */
  demoUserId: string | null;
  /** URL ?demoUserName= 원본 (배너 표시용, 없으면 null) */
  demoUserName: string | null;
  /** 테스트 유저 모드 여부 (= demoUserId 존재) */
  isDemo: boolean;
  /**
   * 조회/표시 대상 user_id.
   * admin-view(userId/userID) 우선 → 없으면 demoUserId. 일반 사용자는 null(=본인).
   */
  targetUserId: string | null;
  /**
   * GET API 에 붙일 demoUserId 쿼리 suffix. 이미 다른 param 이 있다고 가정(&로 시작).
   * 데모 모드가 아니면 빈 문자열.
   */
  demoQS: string;
  /**
   * 클러스터 간 네비게이션에 유지할 query.
   * - 데모 모드: ?demoUserId=...&demoUserName=...&admin=true (다음 페이지에서도 모드 지속)
   * - admin-view(userId): ?userId=...
   * - 일반: ""
   */
  userLinkQuery: string;
  /** 임의 경로에 demoUserId 를 안전하게 부착(저장/수정/삭제/업로드 API 용). 데모 아니면 path 그대로. */
  appendDemoUserParams: (path: string) => string;
}

export function useDemoUserMode(): DemoUserMode {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const demoUserId = searchParams.get("demoUserId");
    const demoUserName = searchParams.get("demoUserName");
    const adminView = searchParams.get("userId") || searchParams.get("userID");
    const targetUserId = adminView || demoUserId;

    const demoQS = demoUserId
      ? `&demoUserId=${encodeURIComponent(demoUserId)}`
      : "";

    let userLinkQuery = "";
    if (demoUserId) {
      const parts = [`demoUserId=${encodeURIComponent(demoUserId)}`, "admin=true"];
      if (demoUserName) parts.push(`demoUserName=${encodeURIComponent(demoUserName)}`);
      userLinkQuery = `?${parts.join("&")}`;
    } else if (targetUserId) {
      userLinkQuery = `?userId=${encodeURIComponent(targetUserId)}`;
    }

    const appendDemoUserParams = (path: string): string => {
      if (!demoUserId) return path;
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}demoUserId=${encodeURIComponent(demoUserId)}`;
    };

    return {
      demoUserId,
      demoUserName,
      isDemo: !!demoUserId,
      targetUserId,
      demoQS,
      userLinkQuery,
      appendDemoUserParams,
    };
  }, [searchParams]);
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  detectHardBlackScreen,
  healBlackScreenIfNeeded,
  initBlackScreenDiagnostics,
  publishSnapshot,
  setDiagUserId,
  trackRouteChange,
} from "@/utils/blackScreenDiagnostics";

const DiagnosticsInit = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  // 항시 작동: 에러/청크 실패/fetch 실패 캡처는 운영에서도 항상 초기화
  useEffect(() => {
    initBlackScreenDiagnostics();
  }, []);

  // 에러 로그 컨텍스트용 사용자 ID (로깅 전용 — 권한/데이터 경로와 무관)
  useEffect(() => {
    setDiagUserId(session?.user?.id ?? null);
  }, [session?.user?.id]);

  // 라우트 전환 추적(이전/현재 URL) + 검은 화면 워치독 — 항시 작동.
  // 전환 후 600ms/1600ms 두 시점에 검사해, app-ready 누락(opacity:0)이면
  // 스냅샷을 console.error로 남기고 즉시 자가 복구한다.
  useEffect(() => {
    trackRouteChange(window.location.href);

    const runWatchdog = (at: string) => {
      if (!detectHardBlackScreen()) return;
      // 원인 추적용 스냅샷 먼저 기록 → 그 다음 복구 (복구가 증거를 지우지 않게)
      void publishSnapshot(`auto-detect-${at}`, { copy: false, notify: false });
      healBlackScreenIfNeeded(at);
    };

    const t1 = window.setTimeout(() => runWatchdog("600ms"), 600);
    const t2 = window.setTimeout(() => runWatchdog("1600ms"), 1600);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
};

export default DiagnosticsInit;

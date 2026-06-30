"use client";

// 테스트 모드(mode=test) 플로팅 토글 버튼.
// ─────────────────────────────────────────────────────────────────────
// 정책(Phase 4b):
//   · mode=test 로 한 번이라도 진입하면 localStorage.testModeSeen='true' 기록 →
//     이후 모든 고객 앱 페이지에서 우하단 버튼이 계속 보인다.
//   · 한 번도 mode=test 로 진입한 적 없는 일반 사용자에게는 버튼이 보이지 않는다.
//   · 버튼은 현재 URL 의 다른 query(org/userId/tab/week 등)는 전부 유지하고 mode 만 토글:
//       mode=test → mode 제거(operating) / mode 없음 → mode=test 추가.
//   · mode=test 는 "읽기 모집단 필터"일 뿐 — demoUserId 쓰기 우회/저장 경로와 무관.
// 기존 DemoToggle(🎭 Demo ON/OFF, localStorage.demoMode)을 대체한다.
// ─────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseScopeMode, toggleModeInHref } from "@/lib/userScopeShared";

const STORAGE_KEY = "testModeSeen";
const TEST_MODE_TOGGLE_VISIBLE = false;

function TestModeToggleInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isTest = parseScopeMode(searchParams?.get("mode") ?? null) === "test";

  // 진입 이력 게이트 — mode=test 로 한 번이라도 들어온 적 있어야 버튼 노출.
  // localStorage 는 SSR 접근 불가 → 마운트 후 판정.
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTest) {
      // 현재 test 모드 진입 → 이력 기록(이후 다른 페이지에서도 버튼 유지).
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* storage 비활성 환경 — 무시 */
      }
      setSeen(true);
      return;
    }
    try {
      setSeen(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setSeen(false);
    }
  }, [isTest]);

  if (!seen) return null;

  const toggle = () => {
    const query = searchParams?.toString() ?? "";
    const href = `${pathname}${query ? `?${query}` : ""}`;
    // 다른 query 는 전부 유지하고 mode 만 토글.
    router.replace(toggleModeInHref(href));
  };

  return (
    <button
      onClick={toggle}
      style={{
        position: "fixed",
        bottom: "80px",
        right: "20px",
        zIndex: 99999,
        padding: "8px 16px",
        borderRadius: "20px",
        border: "none",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 700,
        fontFamily: "Pretendard",
        background: isTest ? "#FAAB07" : "#333",
        color: isTest ? "#000" : "#888",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        transition: "all 0.2s",
      }}
    >
      {isTest ? "🧪 테스트 모드 ON" : "🧪 테스트 모드 OFF"}
    </button>
  );
}

// useSearchParams 는 prerender 시 Suspense 경계를 요구 → 컴포넌트 내부에서 감싼다
// (layout 전체 bailout 방지).
const TestModeToggle = () => {
  if (!TEST_MODE_TOGGLE_VISIBLE) return null;

  return (
    <Suspense fallback={null}>
      <TestModeToggleInner />
    </Suspense>
  );
};

export default TestModeToggle;

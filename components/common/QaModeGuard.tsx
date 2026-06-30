"use client";

// QA 모드(mode=test) 쉘 가드 — 고객앱 Phase C.
// ─────────────────────────────────────────────────────────────────────
// 정책:
//   · operating(기본)      : 완전 no-op — children 즉시 렌더(기존 동작/성능 불변).
//   · test(mode=test)      : /api/qa-mode/access 로 현재 세션 허용 여부 판정.
//       - 허용(테스트 유저 세션 / 유효 demoUserId 경로) → children 렌더(QA 상태 표시).
//       - 차단(실사용자 세션, 마커 미등재) → 운영/QA 콘텐츠 대신 "테스트 계정 선택 안내" 차단 화면.
// 데이터 보호는 각 API(enforceQaMode)가 독립 수행 — 본 가드는 화면 차단(UX)용.
// ─────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseScopeMode, toggleModeInHref } from "@/lib/userScopeShared";

type AccessState = "operating" | "loading" | "allowed" | "blocked";

function QaModeGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isTest = parseScopeMode(searchParams?.get("mode") ?? null) === "test";
  const demoUserId = searchParams?.get("demoUserId") ?? null;

  const [state, setState] = useState<AccessState>(isTest ? "loading" : "operating");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (!isTest) {
      setState("operating");
      return;
    }
    let cancelled = false;
    setState("loading");
    const qs = new URLSearchParams({ mode: "test" });
    if (demoUserId) qs.set("demoUserId", demoUserId);
    fetch(`/api/qa-mode/access?${qs.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.allowed) {
          setState("allowed");
        } else {
          setReason(String(data?.reason ?? ""));
          setState("blocked");
        }
      })
      .catch(() => {
        // 판정 실패 시 안전 측: 차단(운영 데이터 노출 금지).
        if (!cancelled) {
          setReason("qa-access-check-failed");
          setState("blocked");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isTest, demoUserId]);

  // 운영 모드 — 완전 no-op.
  if (state === "operating") return <>{children}</>;
  if (state === "allowed") return <>{children}</>;

  if (state === "loading") {
    return (
      <div style={overlayStyle}>
        <div style={{ color: "#aaa", fontFamily: "Pretendard", fontSize: 14 }}>QA 모드 확인 중…</div>
      </div>
    );
  }

  // blocked
  const exitTestMode = () => {
    const query = searchParams?.toString() ?? "";
    const href = `${pathname}${query ? `?${query}` : ""}`;
    router.replace(toggleModeInHref(href)); // mode=test 제거 → operating
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧪</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
          QA(테스트) 모드 — 접근 제한
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#bbb", margin: "0 0 4px" }}>
          QA 모드는 <b style={{ color: "#FAAB07" }}>테스트 계정</b>으로만 사용할 수 있습니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#888", margin: "0 0 20px" }}>
          현재 로그인한 실사용자 계정으로는 QA 데이터에 접근할 수 없습니다.
          테스트 계정으로 로그인하거나 테스트 모드를 종료하세요.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={exitTestMode} style={primaryBtn}>테스트 모드 종료</button>
          <a href="/sign-in" style={secondaryBtn}>테스트 계정으로 로그인</a>
        </div>
        {reason ? (
          <div style={{ marginTop: 16, fontSize: 11, color: "#555" }}>사유: {reason}</div>
        ) : null}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  minHeight: "60vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: 440,
  width: "100%",
  textAlign: "center",
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 16,
  padding: "36px 28px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "Pretendard",
  background: "#FAAB07",
  color: "#000",
};
const secondaryBtn: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid #444",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "Pretendard",
  background: "transparent",
  color: "#ccc",
  textDecoration: "none",
};

const QaModeGuard = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<>{children}</>}>
    <QaModeGuardInner>{children}</QaModeGuardInner>
  </Suspense>
);

export default QaModeGuard;

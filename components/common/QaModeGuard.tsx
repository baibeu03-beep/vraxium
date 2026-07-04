"use client";

// QA 배포 쉘 가드 — 배포 환경변수(NEXT_PUBLIC_APP_ENV) 기반.
// ─────────────────────────────────────────────────────────────────────
// 정책:
//   · 운영 배포(operating) : 완전 no-op — children 즉시 렌더(기존 동작/성능 불변).
//       (layout 이 운영 배포에선 이 가드를 마운트하지 않으므로 보통 이 경로엔 도달하지 않는다.)
//   · QA   배포(qa/test)   : /api/qa-mode/access 로 현재 세션 허용 여부 판정.
//       - 허용(테스트 유저 세션 / 유효 demoUserId 경로) → children 렌더(QA 데이터).
//       - 차단(실유저 세션, 마커 미등재) → 운영/QA 콘텐츠 대신 "테스트 계정 안내" 차단 화면.
// 데이터 보호는 각 API(enforceQaMode)가 독립 수행 — 본 가드는 화면 차단(UX)용.
// 스코프는 배포 단위 고정 → "테스트 모드 종료" 토글 없음(URL 로 배포 스코프를 바꿀 수 없다).
// ─────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDeployMode } from "@/lib/userScopeShared";

type AccessState = "operating" | "loading" | "allowed" | "blocked";

function QaModeGuardInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  const isTest = getDeployMode() === "test";
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
    // 스코프는 배포 환경변수로 결정되므로 mode 파라미터를 보내지 않는다(access 라우트도 env 로 판정).
    const qs = new URLSearchParams();
    if (demoUserId) qs.set("demoUserId", demoUserId);
    fetch(`/api/qa-mode/access${qs.toString() ? `?${qs.toString()}` : ""}`, { cache: "no-store" })
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

  // QA 접근 판정 중 — 사용자 화면에는 어떤 문구도 렌더하지 않는다(빈 상태).
  //   판정 로직(위 effect)은 그대로 유지되며, 판정 완료 시 allowed→children / blocked→안내로 전환된다.
  //   운영 배포는 이 경로에 도달하지 않으므로(state=operating) 빈 화면 노출 없음.
  if (state === "loading") {
    return null;
  }

  // blocked — QA 배포는 테스트 계정 전용. 배포 스코프는 토글 불가이므로 로그인 CTA 만 제공.
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧪</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
          QA 배포 — 접근 제한
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#bbb", margin: "0 0 4px" }}>
          이 환경은 <b style={{ color: "#FAAB07" }}>테스트 계정</b>으로만 사용할 수 있습니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#888", margin: "0 0 20px" }}>
          현재 로그인한 실사용자 계정으로는 QA 데이터에 접근할 수 없습니다.
          운영 화면은 운영 배포 주소를 이용하고, QA 검증은 테스트 계정으로 로그인하세요.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/sign-in" style={primaryBtn}>테스트 계정으로 로그인</a>
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
  textDecoration: "none",
};

const QaModeGuard = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<>{children}</>}>
    <QaModeGuardInner>{children}</QaModeGuardInner>
  </Suspense>
);

export default QaModeGuard;

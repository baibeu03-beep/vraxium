// QA 배포 전역 배너 (서버 컴포넌트, 클라이언트 JS 0).
// ─────────────────────────────────────────────────────────────────────
// QA 배포(NEXT_PUBLIC_APP_ENV=qa)에서만 layout 이 이 배너를 트리에 넣는다.
// 운영 배포에서는 아예 마운트되지 않으므로 운영 화면에 영향이 없다.
// 목적: 테스터/운영진이 "지금 보는 데이터는 QA(테스트 마커) 모집단"임을 한눈에 인지 →
//       운영/QA 데이터가 화면상 섞여 보이는 혼동을 차단(요구 3).
// 과거 ?mode=test 기반 TestUserBanner(데모 유저 이름 표시)와 달리 배포 단위 고정 표시.

export default function QaDeployBanner() {
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        padding: "8px 16px",
        background: "#1E9503",
        color: "#fff",
        fontSize: "13px",
        fontWeight: 700,
        textAlign: "center",
        lineHeight: 1.4,
        letterSpacing: "0.02em",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}
    >
      🧪 QA 배포 — 테스트 계정(테스트 마커) 데이터만 표시됩니다. 운영 데이터가 아닙니다.
    </div>
  );
}

"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { getOrgConfigForSlug } from "@/lib/cluster-route";
import { getRankingTheme, getRankingThemeVars } from "@/lib/rankingTheme";

const WeeklyDetailContent = dynamic(
  () => import("@/components/weekly-ranking/WeeklyDetailContent"),
  { ssr: false },
);

const KNOWN_ORGS = ["phalanx", "encre", "oranke"] as const;
type OrgSlug = (typeof KNOWN_ORGS)[number];

const ORG_LABEL: Record<OrgSlug, string> = {
  phalanx: getOrgConfigForSlug("phalanx").displayNameKo,
  encre: getOrgConfigForSlug("encre").displayNameKo,
  oranke: getOrgConfigForSlug("oranke").displayNameKo,
};

const isOrgSlug = (value: string | null | undefined): value is OrgSlug =>
  !!value && (KNOWN_ORGS as readonly string[]).includes(value);

function WeeklyDetailPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const weekId = decodeURIComponent(String(params?.weekId ?? ""));
  const orgParam = searchParams?.get("org") ?? null;
  const org: OrgSlug | null = isOrgSlug(orgParam) ? orgParam : null;

  // breadcrumb·페이지 배경이 상속받을 org 테마 변수를 main 에 주입(리스트 page.tsx 동형).
  const baseThemeVars = getRankingThemeVars(getRankingTheme(org));
  const title = org ? `Weekly League · ${ORG_LABEL[org]}` : "Weekly League";

  return (
    <main
      className={`nftg-content nftg-content-home weekly-ranking-layout${org === "phalanx" ? " phalanx-theme" : ""}`}
      style={{ padding: 0, ...baseThemeVars }}
    >
      <Animations />
      <Breadcrumb title={title} />
      {/* trending/trending-nft 클래스는 제외 — .trending-nft h2 { font-size !important } 등
          전역 규칙이 상세 카드 제목(h2)을 덮는다. 상세는 .weekly-detail-page 로 자기완결 스타일. */}
      <section
        className="pb-120"
        style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 30 }}
      >
        <div className="container-fluid" style={{ paddingLeft: 15, paddingRight: 15, maxWidth: "100%" }}>
          <WeeklyDetailContent weekId={weekId} org={org} />
        </div>
      </section>
    </main>
  );
}

const WeeklyDetailPage = () => (
  <Suspense fallback={null}>
    <WeeklyDetailPageInner />
  </Suspense>
);

export default WeeklyDetailPage;

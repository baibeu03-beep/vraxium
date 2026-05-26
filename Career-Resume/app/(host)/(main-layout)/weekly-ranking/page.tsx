"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const WeeklyRankingContent = dynamic(
  () => import("@/components/weekly-ranking/WeeklyRankingContent"),
  { ssr: false }
);

const KNOWN_ORGS = ["phalanx", "encre", "oranke"] as const;
type OrgSlug = typeof KNOWN_ORGS[number];

const ORG_LABEL: Record<OrgSlug, string> = {
  phalanx: "팔랑크스",
  encre: "엥크레",
  oranke: "오랑캐",
};

const isOrgSlug = (value: string | null | undefined): value is OrgSlug =>
  !!value && (KNOWN_ORGS as readonly string[]).includes(value);

function WeeklyRankingPageInner() {
  const searchParams = useSearchParams();
  const orgParam = searchParams?.get("org") ?? null;
  const org: OrgSlug | null = isOrgSlug(orgParam) ? orgParam : null;

  // 1) ?org= 없거나 유효하지 않으면 안내 화면.
  //    잘못된 값(예: ?org=xyz)도 동일하게 안내로 떨어뜨려 redirect 비용 회피 — /crews 동형.
  if (!org) {
    return (
      <main className="nftg-content nftg-content-home" style={{ padding: 0 }}>
        <Animations />
        <Breadcrumb title="Weekly League" />
        <section className="pb-120 trending trending-nft" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 30 }}>
          <div className="container-fluid" style={{ paddingLeft: 15, paddingRight: 15, maxWidth: '100%' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 'calc(100vh - 240px)',
              color: '#aaa',
              textAlign: 'center',
              gap: 16,
            }}>
              <div style={{
                fontFamily: "'Pretendard', sans-serif",
                fontSize: 18,
                fontWeight: 600,
                color: '#fff',
              }}>
                조직을 선택해 주세요
              </div>
              <div style={{
                fontFamily: "'Pretendard', sans-serif",
                fontSize: 14,
                color: '#888',
                lineHeight: 1.6,
              }}>
                사이드바에서 조직(팔랑크스 · 엥크레 · 오랑캐)을 선택하면<br />
                해당 조직 주차 랭킹이 표시됩니다.
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // 2) 유효 org → 랭킹 콘텐츠 (데이터 연동은 신규 백엔드 확정 후 별도 작업).
  return (
    <main className={`nftg-content nftg-content-home${org === "phalanx" ? " phalanx-theme" : ""}`} style={{ padding: 0 }}>
      <Animations />
      <Breadcrumb title={`Weekly League · ${ORG_LABEL[org]}`} />
      <section
        className="pb-120 trending trending-nft"
        style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 30 }}
      >
        <div
          className="container-fluid"
          style={{ paddingLeft: 15, paddingRight: 15, maxWidth: '100%' }}
        >
          <WeeklyRankingContent />
        </div>
      </section>
    </main>
  );
}

const WeeklyRankingPage = () => (
  <Suspense fallback={null}>
    <WeeklyRankingPageInner />
  </Suspense>
);

export default WeeklyRankingPage;

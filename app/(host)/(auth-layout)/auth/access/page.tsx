"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { appSignOut } from "@/lib/auth-logout";

const ACCESS_COPY = {
  pending: {
    title: "승인 대기 중",
    description:
      "로그인은 완료되었지만 아직 가입 승인 대기 상태입니다. 승인 후 기존 프로필과 연결되어 이용할 수 있습니다.",
  },
  // 승인은 됐지만 소속 조직(organization_slug) 미배정 — 특정 조직 카드 페이지로
  // 자동 진입시키지 않고 여기서 안내한다 (post-login 조직 분기의 no-org 폴백).
  "no-organization": {
    title: "조직 배정 대기",
    description:
      "가입 승인은 완료되었지만 아직 소속 조직이 배정되지 않았습니다. 운영진이 조직을 배정하면 본인 카드 페이지로 진입할 수 있습니다.",
  },
  not_registered: {
    title: "등록 안내",
    description:
      "등록된 프로필 또는 신청 이력이 확인되지 않았습니다. 운영진 확인 후 신청 또는 계정 연결이 필요합니다.",
  },
} as const;

const AccessPage = () => {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const rawStatus = searchParams.get("status");
  const status =
    rawStatus === "pending" || rawStatus === "no-organization" ? rawStatus : "not_registered";
  const copy = ACCESS_COPY[status];

  return (
    <main className="nftg-content-two">
      <section className="authentication pt-120 pb-120 fade-wrapper">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-12">
              <div className="authentication__wrapper text-center">
                <div className="authentication__inner">
                  <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">{copy.title}</h2>
                  <p className="text-xl text-alter mt-12">{copy.description}</p>
                  <div className="btn-wrapper mt-40" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/cluster-4-marketing" className="btn--secondary">
                      메인으로 이동
                    </Link>
                    <Link href="/contact-us" className="btn--tertiary">
                      문의하기
                    </Link>
                    <button
                      type="button"
                      className="btn--tertiary"
                      onClick={() =>
                        appSignOut(
                          (session as { provider?: string } | null)?.provider,
                          "/sign-in",
                        )
                      }
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AccessPage;

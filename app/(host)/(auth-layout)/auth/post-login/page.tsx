"use client";

import { DEFAULT_APPROVED_CALLBACK_URL, sanitizeCallbackUrl } from "@/lib/auth-redirect";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const PostLoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    const callbackUrl = sanitizeCallbackUrl(
      searchParams.get("callbackUrl"),
      DEFAULT_APPROVED_CALLBACK_URL,
    );

    if (sessionStatus === "unauthenticated") {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (hasCheckedRef.current) {
      return;
    }

    hasCheckedRef.current = true;

    const checkStatus = async () => {
      try {
        const response = await fetch("/api/auth/check-status", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "승인 상태를 확인하지 못했습니다.");
        }

        if (result.status === "approved") {
          router.replace(callbackUrl);
          return;
        }

        if (result.status === "pending") {
          // pending 은 정상 onboarding 상태 — 안내 화면으로 라우팅(에러 톤 X)
          router.replace("/auth/access?status=pending");
          return;
        }

        if (result.status === "rejected") {
          router.replace("/auth/access?status=rejected");
          return;
        }

        router.replace("/auth/access?status=not_registered");
      } catch (error) {
        // 실제 서버/네트워크 오류만 error 분기로. pending 은 try 블록에서 정상 처리되므로
        // 사용자에겐 "오류" 톤이 노출되지 않음.
        console.error("Post-login status check failed:", error);
        router.replace("/auth/access?status=error");
      }
    };

    void checkStatus();
  }, [router, searchParams, sessionStatus]);

  // 로딩 중에만 잠깐 표시되는 중립 안내 — 모든 분기는 즉시 redirect 되므로 거의 노출되지 않음.
  return (
    <main className="nftg-content-two">
      <section className="authentication pt-120 pb-120 fade-wrapper">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-12">
              <div className="authentication__wrapper text-center">
                <div className="authentication__inner">
                  <h2
                    className="title-lg fw-8 transform-none mt-8"
                    style={{ color: "#fff", fontSize: "clamp(20px, 4.5vw, 28px)" }}
                  >
                    잠시만 기다려주세요
                  </h2>
                  <p
                    className="mt-12"
                    style={{
                      marginTop: "12px",
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: "clamp(13px, 3.4vw, 15px)",
                    }}
                  >
                    로그인 정보를 확인하고 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PostLoginPage;

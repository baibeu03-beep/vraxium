"use client";

import { DEFAULT_APPROVED_CALLBACK_URL, sanitizeCallbackUrl } from "@/lib/auth-redirect";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AuthStatus = "idle" | "approved" | "pending" | "not_registered" | "error";

const PostLoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [message, setMessage] = useState("로그인 상태를 확인하고 있습니다.");
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
        const response = await fetch("/api/auth/check-status", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "승인 상태를 확인하지 못했습니다.");
        }

        if (result.status === "approved") {
          setAuthStatus("approved");
          setMessage("승인된 계정입니다. 이동 중입니다.");
          router.replace(callbackUrl);
          return;
        }

        if (result.status === "pending") {
          setAuthStatus("pending");
          setMessage("가입 승인 대기 중입니다.");
          router.replace("/auth/access?status=pending");
          return;
        }

        setAuthStatus("not_registered");
        setMessage("등록되지 않은 계정입니다.");
        router.replace("/auth/access?status=not_registered");
      } catch (error) {
        console.error("Post-login status check failed:", error);
        setAuthStatus("error");
        setMessage("로그인 상태 확인 중 오류가 발생했습니다.");
      }
    };

    void checkStatus();
  }, [router, searchParams, sessionStatus]);

  return (
    <main className="nftg-content-two">
      <section className="authentication pt-120 pb-120 fade-wrapper">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-12">
              <div className="authentication__wrapper text-center">
                <div className="authentication__inner">
                  <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">Checking Access</h2>
                  <p className="text-xl text-alter mt-12">{message}</p>
                  {authStatus === "error" && (
                    <div className="btn-wrapper mt-40">
                      <Link href="/sign-in" className="btn--secondary">
                        로그인으로 돌아가기
                      </Link>
                    </div>
                  )}
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

"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { buildPostLoginRedirectUrl } from "@/lib/auth-redirect";

const kakaoIconStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#FEE500",
  color: "#191919",
  fontWeight: 800,
  fontSize: 12,
} as const;

const SignUpPage = () => {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // /sign-up?callbackUrl=... 명시 callback 만 전달하고, 없으면 post-login 에서 조직 분기 redirect 가 적용된다.
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const postLoginRedirectUrl = buildPostLoginRedirectUrl(rawCallbackUrl);

  const handleKakaoLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      await signIn("kakao", { callbackUrl: postLoginRedirectUrl });
    } catch {
      setError("카카오 로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <main className="nftg-content-two">
      <section className="authentication pt-120 pb-120 fade-wrapper">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-12">
              <div className="authentication__wrapper text-center">
                <div className="mb-55">
                  <h2 className="title-lg fw-8 stroked-text transform-none title-animation">Start With Kakao</h2>
                  <p className="text-xl mt-12 text-alter">사용자 앱 회원 진입은 카카오 로그인만 지원합니다.</p>
                </div>
                <div className="authentication__inner">
                  {error && (
                    <div className="alert alert-danger mb-3" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="oauth-tab">
                    <div className="oauth-btns">
                      <button
                        onClick={handleKakaoLogin}
                        disabled={isLoading}
                        aria-label="continue with kakao"
                        title="continue with kakao"
                        className="btn--tertiary"
                      >
                        <span aria-hidden="true" style={kakaoIconStyle}>
                          K
                        </span>
                        {isLoading ? "카카오 로그인 중..." : "Kakao로 시작하기"}
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                          <path d="M0 0  L100 0  L100 70 L89 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-60 h-a text-start">
                    <p>
                      이미 계정이 있나요? <Link href="/sign-in">로그인 화면으로 이동</Link>
                    </p>
                    <p className="mt-8">
                      카카오 이메일이 기존 `auth_email` 또는 `contact_email`과 일치할 때만 자동 승인됩니다.
                    </p>
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

export default SignUpPage;

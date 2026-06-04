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

const googleIconStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#FFFFFF",
} as const;

const GoogleIcon = () => (
  <span aria-hidden="true" style={googleIconStyle}>
    <svg width="14" height="14" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  </span>
);

const SignUpPage = () => {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  // Google 신규가입도 카카오와 동일한 pending 신청 → 승인 흐름(post-login → check-status)을 탄다.
  const handleGoogleLogin = async () => {
    setError("");
    setIsGoogleLoading(true);

    try {
      await signIn("google", { callbackUrl: postLoginRedirectUrl });
    } catch {
      setError("Google 로그인 중 오류가 발생했습니다.");
      setIsGoogleLoading(false);
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
                  <h2 className="title-lg fw-8 stroked-text transform-none title-animation">Sign Up</h2>
                  <p className="text-xl mt-12 text-alter">사용자 앱 회원 진입은 카카오 또는 Google 계정으로 진행됩니다.</p>
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
                      <button
                        onClick={handleGoogleLogin}
                        disabled={isGoogleLoading}
                        aria-label="continue with google"
                        title="continue with google"
                        className="btn--tertiary mt-16"
                      >
                        <GoogleIcon />
                        {isGoogleLoading ? "Google 로그인 중..." : "Google로 시작하기"}
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
                    <p className="mt-8">
                      Google 계정은 이메일이 같아도 기존 계정과 자동으로 연결되지 않으며, 운영자 승인 후 이용할 수 있습니다.
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

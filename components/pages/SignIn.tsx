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

const SignIn = () => {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // /sign-in?callbackUrl=... 로 보호된 페이지에서 튕겨진 경우만 명시 callback 으로 전달.
  // 명시 callback 이 없으면 post-login 에서 조직 분기 redirect 가 적용된다.
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

  // Google 도 카카오와 동일한 post-login 진입 흐름(/auth/post-login → check-status 분기)을 탄다.
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
                  <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">Login</h2>
                  <p className="text-xl text-alter mt-12">사용자 앱 로그인은 카카오 또는 Google 계정으로 진행됩니다.</p>
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
                        {isLoading ? "카카오 로그인 중..." : "Kakao로 계속하기"}
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                          <path d="M0 0  L100 0  L100 70 L89 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </button>
                      <button
                        onClick={handleGoogleLogin}
                        disabled={isGoogleLoading}
                        aria-label="continue with google"
                        title="continue with google"
                        className="btn--tertiary"
                      >
                        <GoogleIcon />
                        {isGoogleLoading ? "Google 로그인 중..." : "Google로 계속하기"}
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                          <path d="M0 0  L100 0  L100 70 L89 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-60 h-a text-start">
                    <p className="mt-8">
                      계정 연결이 되지 않으면 <Link href="/auth/access?status=pending">승인 대기 상태</Link>를 확인하세요.
                    </p>
                    <p className="mt-8">
                      운영자 이메일 로그인은 별도 Admin 경로에서 계속 사용됩니다.
                    </p>
                    <p className="mt-8">
                      처음 방문하셨나요? <Link href="/sign-up">카카오로 시작하기</Link>
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

export default SignIn;

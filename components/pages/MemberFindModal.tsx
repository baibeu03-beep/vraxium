"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./MemberFindModal.scss";

type FindResult =
  | { found: true; displayName: string; maskedEmail: string }
  | { found: false }
  | null;

interface MemberFindModalProps {
  onClose: () => void;
}

const MemberFindModal = ({ onClose }: MemberFindModalProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FindResult>(null);
  const [mounted, setMounted] = useState(false);

  // createPortal 은 client 에서만 — SSR 시 document 미존재 가드.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError("이름과 휴대폰 번호를 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/members/find/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "조회 중 오류가 발생했습니다.");
        return;
      }
      setResult(data as FindResult);
    } catch {
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="member-find-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="기존 회원 찾기"
    >
      <div className="member-find">
        <div className="member-find__header">
          <h3 className="member-find__title">기존 회원 찾기</h3>
          <button
            type="button"
            className="member-find__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {result === null ? (
          <form className="member-find__body" onSubmit={handleSubmit}>
            <p className="member-find__desc">
              가입 시 등록한 이름과 휴대폰 번호를 입력해주세요.
            </p>

            <label className="member-find__field">
              <span className="member-find__label">이름</span>
              <input
                type="text"
                className="member-find__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력해주세요"
                autoComplete="name"
              />
            </label>

            <label className="member-find__field">
              <span className="member-find__label">휴대폰 번호</span>
              <input
                type="tel"
                className="member-find__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                autoComplete="tel"
                inputMode="numeric"
              />
            </label>

            {error && <p className="member-find__error">{error}</p>}

            <div className="member-find__footer">
              <button
                type="button"
                className="member-find__btn member-find__btn--cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                취소
              </button>
              <button
                type="submit"
                className="member-find__btn member-find__btn--confirm"
                disabled={isLoading}
              >
                {isLoading ? "조회 중..." : "확인"}
              </button>
            </div>
          </form>
        ) : result.found ? (
          <div className="member-find__body">
            <div className="member-find__result">
              <p className="member-find__result-row">
                <span className="member-find__result-key">이름</span>
                <span className="member-find__result-val">{result.displayName}</span>
              </p>
              <p className="member-find__result-row">
                <span className="member-find__result-key">등록 이메일</span>
                <span className="member-find__result-val member-find__result-email">
                  {result.maskedEmail}
                </span>
              </p>
            </div>
            <p className="member-find__guide">
              위 이메일로 가입된 구글 또는 카카오 계정으로 로그인해주세요.
            </p>
            <div className="member-find__footer">
              <button
                type="button"
                className="member-find__btn member-find__btn--confirm"
                onClick={onClose}
              >
                확인
              </button>
            </div>
          </div>
        ) : (
          <div className="member-find__body">
            <p className="member-find__guide member-find__guide--notfound">
              등록된 회원 정보를 찾을 수 없습니다. 운영진에게 문의해주세요.
            </p>
            <div className="member-find__footer">
              <button
                type="button"
                className="member-find__btn member-find__btn--cancel"
                onClick={() => setResult(null)}
              >
                다시 입력
              </button>
              <button
                type="button"
                className="member-find__btn member-find__btn--confirm"
                onClick={onClose}
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default MemberFindModal;

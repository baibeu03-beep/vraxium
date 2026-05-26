"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * FontSizeControl - 접근성을 위한 폰트 크기 조절 컴포넌트
 * 
 * 사용법: layout.tsx 또는 Header 컴포넌트 안에 <FontSizeControl /> 추가
 * 
 * 원리:
 * - html의 font-size를 조절 (기본 16px → 14px ~ 20px)
 * - rem 단위로 된 폰트만 영향받음
 * - px 고정 레이아웃은 그대로 유지 → 레이아웃 깨짐 없음
 * - localStorage에 설정 저장 → 재방문 시 유지
 */

type FontLevel = "small" | "default" | "large";

const FONT_SIZES: Record<FontLevel, number> = {
  small: 14,
  default: 16,
  large: 18,
};

const FONT_LABELS: Record<FontLevel, string> = {
  small: "작게",
  default: "기본",
  large: "크게",
};

const STORAGE_KEY = "oreaming-font-size";

export default function FontSizeControl() {
  const [currentLevel, setCurrentLevel] = useState<FontLevel>("default");
  const [isOpen, setIsOpen] = useState(false);

  // 초기 로드: localStorage에서 설정 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in FONT_SIZES) {
        const level = saved as FontLevel;
        setCurrentLevel(level);
        document.documentElement.style.fontSize = `${FONT_SIZES[level]}px`;
      }
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }, []);

  // 폰트 크기 변경
  const changeFontSize = useCallback((level: FontLevel) => {
    setCurrentLevel(level);
    document.documentElement.style.fontSize = `${FONT_SIZES[level]}px`;
    setIsOpen(false);

    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".font-size-control")) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="font-size-control" style={styles.wrapper}>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.toggleBtn}
        title="글자 크기 조절"
        aria-label="글자 크기 조절"
      >
        <span style={styles.icon}>가</span>
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>글자 크기</div>
          {(Object.keys(FONT_SIZES) as FontLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => changeFontSize(level)}
              style={{
                ...styles.option,
                ...(currentLevel === level ? styles.optionActive : {}),
              }}
            >
              <span
                style={{
                  fontSize: `${FONT_SIZES[level]}px`,
                  fontWeight: currentLevel === level ? 700 : 400,
                }}
              >
                가
              </span>
              <span style={styles.optionLabel}>{FONT_LABELS[level]}</span>
              {currentLevel === level && (
                <span style={styles.checkmark}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 인라인 스타일 (별도 SCSS 파일 없이 독립 작동)
// 프로젝트 디자인에 맞게 수정 가능
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    zIndex: 1000,
  },
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontSize: "14px",
    fontFamily: "'Pretendard', sans-serif",
    fontWeight: 600,
  },
  icon: {
    fontSize: "16px",
    lineHeight: 1,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: "0",
    width: "180px",
    background: "#1a1a1a",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "12px",
    padding: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
  },
  dropdownHeader: {
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.5)",
    padding: "4px 8px 8px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    marginBottom: "4px",
    fontFamily: "'Pretendard', sans-serif",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "8px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    transition: "background 0.15s ease",
    fontFamily: "'Pretendard', sans-serif",
    textAlign: "left" as const,
  },
  optionActive: {
    background: "rgba(255, 180, 0, 0.15)",
    color: "#FFB400",
  },
  optionLabel: {
    fontSize: "13px",
    flex: 1,
  },
  checkmark: {
    fontSize: "14px",
    color: "#FFB400",
  },
};
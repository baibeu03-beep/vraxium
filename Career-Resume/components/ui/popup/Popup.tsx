'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { ThemeKey } from '@/lib/cluster-route';
import './Popup.scss';

/* ----------------------- 랜덤 풀 ----------------------- */

/**
 * 헤더 배경 일러스트 풀 (전용 이미지)
 * - /public/images/0/popup/1.png ~ 4.png 랜덤 사용
 * - overlay 값은 모든 이미지 동일 (0.65)
 */
const HEADER_IMAGES: Array<{ src: string; overlay: number }> = [
  { src: '/images/0/popup/1.png', overlay: 0.65 },
  { src: '/images/0/popup/2.png', overlay: 0.65 },
  { src: '/images/0/popup/3.png', overlay: 0.65 },
  { src: '/images/0/popup/4.png', overlay: 0.65 },
];

/**
 * 본문 좌측 아이콘 풀.
 *
 * Phase B — theme 별 변형 자산이 /public/images/0/ 에 별도 PNG 로 존재.
 *   default: popup-{1,2,3}.png    (yellow 톤)
 *   PX     : popup-{1,2,3}-px.png (green 톤)
 *   Encre  : popup-{1,2,3}-ec.png (pink 톤)
 *
 * 헤더 배경(/images/0/popup/{1..4}.png)은 theme 변형 자산이 없으므로 swap
 * 미적용 (hue-rotate / filter 금지 규칙). 본 풀은 body 아이콘만 swap.
 */
const BODY_ICON_BASES = ['popup-1', 'popup-2', 'popup-3'] as const;

/**
 * theme key 에 따라 body 아이콘 파일명 suffix 결정. null/default 는 무접미.
 */
const themeIconSuffix = (key: ThemeKey | null | undefined): string =>
  key === 'px' ? '-px' : key === 'ec' ? '-ec' : '';

const buildBodyIconPath = (
  base: (typeof BODY_ICON_BASES)[number],
  key: ThemeKey | null | undefined,
): string => `/images/0/${base}${themeIconSuffix(key)}.png`;

const pickRandom = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

/* ----------------------- Props ----------------------- */

interface PopupProps {
  message: string;
  variant: 'A' | 'B';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Phase A — portal root 에 직접 부착될 theme scope class.
   *
   * Popup 은 createPortal 로 document.body 에 렌더되므로 `.cluster-px-theme`
   * / `.encre-theme` 의 descendant 가 아니다. 따라서 `.encre-theme .custom-popup`
   * 같은 selector 가 매칭되지 않는다. 본 prop 으로 backdrop element 에
   * theme class 를 직접 부여해 SCSS 가 portal 내부 까지 닿게 한다.
   */
  themeClassName?: string;
  /**
   * Phase B — body 아이콘 자산 swap 키. PopupProvider 가 pathname 에서
   * 추론해 전달. theme 별 PNG 변형(`popup-N-px.png`, `popup-N-ec.png`)을
   * 선택. null/undefined 면 원본(`popup-N.png`).
   *
   * SCSS 색상 override 와 별개의 channel — img 자산은 hue-rotate/filter 로
   * 변형 금지(글리프/whitespace 깨짐) 라 별도 PNG 를 쓴다.
   */
  themeKey?: ThemeKey | null;
}

/* ----------------------- Component ----------------------- */

const Popup: React.FC<PopupProps> = ({
  message,
  variant,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  themeClassName = '',
  themeKey = null,
}) => {
  const headerImg = useMemo(() => pickRandom(HEADER_IMAGES), []);
  // body 아이콘은 base 풀에서 1회만 무작위 선택. themeKey 가 바뀌어도
  // 같은 베이스가 유지되도록 base 자체를 useMemo, 경로 결정은 매 렌더.
  const bodyIconBase = useMemo(() => pickRandom(BODY_ICON_BASES), []);
  const bodyIcon = buildBodyIconPath(bodyIconBase, themeKey);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (variant === 'A') onCancel();
        else onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    confirmBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel, variant]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (variant === 'A') onCancel();
      else onConfirm();
    }
  };

  return (
    <div
      className={`custom-popup-backdrop${themeClassName ? ` ${themeClassName}` : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="custom-popup"
        style={
          {
            '--popup-header-bg': `url('${headerImg.src}')`,
            '--popup-header-overlay': String(headerImg.overlay),
          } as React.CSSProperties
        }
      >
        <div className="custom-popup__header" />

        <div className="custom-popup__body">
          <div className="custom-popup__icon">
            <img src={bodyIcon} alt="" />
          </div>
          <div className="custom-popup__message">{message}</div>
        </div>

        <div className="custom-popup__footer">
          {variant === 'A' && (
            <button
              type="button"
              className="custom-popup__btn custom-popup__btn--cancel"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className="custom-popup__btn custom-popup__btn--confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;

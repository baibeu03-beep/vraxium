'use client';

import { useEffect, RefObject } from 'react';

/**
 * .resume-card 높이를 뷰포트에 맞게 실시간 재계산하는 훅
 * - 기존 transform: scale 로직과 독립적으로 동작
 * - scale 보정: visual height = cssHeight * scale → cssHeight = availableHeight / scale
 * - rAF로 debounce하여 성능 최적화
 */

const BASE_CARD_HEIGHT = 810;   // 기존 calculateScale과 동일한 기준값
const SCALE_OFFSET = 130;       // 기존 calculateScale과 동일한 오프셋

const getEffectiveViewportHeight = () => {
  const width = window.innerWidth;
  const isZoneAViewport =
    width < 1920 ||
    (width >= 1920 && width < 2560 && window.innerHeight >= 1200);

  return isZoneAViewport ? 1080 : window.innerHeight;
};

export function useResumeCardHeight(
  cardRef: RefObject<HTMLDivElement | null>,
  isMobile: boolean
) {
  useEffect(() => {
    if (isMobile) return;

    const card = cardRef.current;
    if (!card) return;

    let rafId: number | null = null;

    const updateHeight = () => {
      rafId = null;

      const viewportHeight = getEffectiveViewportHeight();
      const availableForScale = viewportHeight - SCALE_OFFSET;
      let scale = Math.min(1.25, availableForScale / BASE_CARD_HEIGHT);
      scale = Math.max(0.55, scale);

      // 실제 헤더 높이를 DOM에서 읽기
      const header = document.querySelector('header');
      const headerHeight = header ? header.getBoundingClientRect().height : 66;
      const gap = 8;
      const availableHeight = viewportHeight - headerHeight - gap;

      // scale 보정: visual = cssHeight * scale, 그러므로 cssHeight = available / scale
      const cssHeight = Math.round(availableHeight / scale);

      card.style.setProperty('height', `${cssHeight}px`, 'important');
      card.style.setProperty('min-height', `${cssHeight}px`, 'important');
      card.style.setProperty('max-height', `${cssHeight}px`, 'important');
    };

    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeight);
    };

    // 초기 계산
    updateHeight();

    // window resize (창 크기 변경)
    window.addEventListener('resize', handleResize);

    // visualViewport resize (브라우저 zoom 변경 감지)
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (vv) vv.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [cardRef, isMobile]);
}

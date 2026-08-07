'use client';

/**
 * EllipsisTooltip — 말줄임표(ellipsis)로 잘린 텍스트에 hover 시 전체 문구를 보여주는 공용 컴포넌트.
 *
 * 배경: 프로젝트에 Radix/shadcn 등 기존 Tooltip 라이브러리가 없어(package.json 미설치) 신규
 * 라이브러리 추가 없이 순수 React + createPortal 로 구현했다. `usePopup`(components/ui/popup)
 * 과 동일하게 body 에 직접 포탈 렌더 — 조상 요소의 `overflow: hidden`(카드/테이블 셀 등)에
 * 잘리지 않기 위함이다.
 *
 * 동작 원칙:
 * - 실제 overflow(scrollWidth > clientWidth, multiline 이면 scrollHeight 도 포함)가 있을 때만
 *   Tooltip 을 띄운다 — 항상 뜨는 네이티브 `title` 과 달리 잘리지 않은 텍스트엔 아무 것도 안 뜬다.
 * - ResizeObserver + window resize 로 폭 변화 시 재판정한다(반응형/줌 대응).
 * - 트리거는 mouseenter/focus 로만 열고 mouseleave/blur 로 닫는다 — 클릭/터치 핸들러를 추가하지
 *   않으므로 모바일 탭/스와이프 등 기존 터치 동작을 가로채지 않는다(모바일은 hover 자체가 없어
 *   Tooltip 이 뜨지 않는 게 정상 동작이며, 텍스트는 native title 없이도 그대로 보인다).
 * - 네이티브 `title` 속성은 절대 병행하지 않는다 — 같이 쓰면 브라우저 기본 툴팁과 중복 노출된다.
 *
 * 이 컴포넌트는 텍스트 컨테이너 자체가 되는 용도다. 기존에 이미 있는 ellipsis CSS 클래스
 * (예: `.activity-role`)를 `className` 으로 그대로 넘겨 재사용하고, 새 ellipsis CSS를 만들지 않는다.
 *
 * 버튼/input/textarea 등 인터랙티브 요소에는 사용하지 마세요(자체 title/label 패턴을 쓸 것).
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import './EllipsisTooltip.scss';

export type EllipsisTooltipProps = {
  children: ReactNode;
  className?: string;
  tooltip?: ReactNode;
  /** 멀티라인(line-clamp) ellipsis 도 overflow 판정에 포함(scrollHeight > clientHeight). 기본 false(단일 라인). */
  multiline?: boolean;
  /** 트리거 태그. 기본 span — 버튼/input/textarea 등 인터랙티브 요소에는 쓰지 말 것. */
  as?: 'span' | 'div' | 'td' | 'th' | 'li' | 'p';
  /** 툴팁 말풍선 자체에 얹을 추가 className. */
  tooltipClassName?: string;
};

const GAP = 8; // 트리거 ↔ 툴팁 간격(px)
const EDGE_PADDING = 8; // 뷰포트 가장자리 최소 여백(px) — 화면 밖 잘림 방지

export default function EllipsisTooltip({
  children,
  className,
  tooltip,
  multiline = false,
  as = 'span',
  tooltipClassName,
}: EllipsisTooltipProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [placed, setPlaced] = useState(false); // 위치 계산 완료 후에만 opacity:1 (뜬금 위치 깜빡임 방지)
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });
  const [mounted, setMounted] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkOverflow = useCallback((): boolean => {
    const el = triggerRef.current;
    if (!el) return false;
    return (
      el.scrollWidth > el.clientWidth + 1 ||
      (multiline && el.scrollHeight > el.clientHeight + 1)
    );
  }, [multiline]);

  const syncOverflowState = useCallback(() => {
    setIsOverflowing(checkOverflow());
  }, [checkOverflow]);

  // 최초 마운트 + resize(컨테이너/윈도우) 시 overflow 재판정.
  useLayoutEffect(() => {
    syncOverflowState();
    const el = triggerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => syncOverflowState());
    ro.observe(el);
    window.addEventListener('resize', syncOverflowState);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncOverflowState);
    };
  }, [syncOverflowState]);

  const show = useCallback(() => {
    // state(isOverflowing)는 다음 렌더까지 반영이 늦을 수 있어, 여는 시점에 한 번 더 직접 판정.
    if (!checkOverflow()) return;
    setIsOverflowing(true);
    setPlaced(false);
    setVisible(true);
  }, [checkOverflow]);

  const hide = useCallback(() => {
    setVisible(false);
    setPlaced(false);
  }, []);

  // 트리거 위치 기준으로 포탈 툴팁 좌표 계산 — 뷰포트 밖으로 잘리지 않도록 clamp.
  useLayoutEffect(() => {
    if (!visible) return;
    const triggerEl = triggerRef.current;
    const tooltipEl = tooltipRef.current;
    if (!triggerEl || !tooltipEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    let top = triggerRect.top - tooltipRect.height - GAP;
    let placement: 'top' | 'bottom' = 'top';
    if (top < EDGE_PADDING) {
      top = triggerRect.bottom + GAP;
      placement = 'bottom';
    }
    const maxTop = window.innerHeight - tooltipRect.height - EDGE_PADDING;
    top = Math.min(Math.max(top, EDGE_PADDING), Math.max(maxTop, EDGE_PADDING));

    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const maxLeft = window.innerWidth - tooltipRect.width - EDGE_PADDING;
    left = Math.min(Math.max(left, EDGE_PADDING), Math.max(maxLeft, EDGE_PADDING));

    setCoords({ top, left, placement });
    setPlaced(true);
  }, [visible, tooltip, children]);

  const Tag = as as React.ElementType;

  return (
    <>
      <Tag
        ref={triggerRef as React.Ref<HTMLElement>}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible && isOverflowing ? tooltipId : undefined}
      >
        {children}
      </Tag>
      {mounted &&
        visible &&
        isOverflowing &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={`ellipsis-tooltip-bubble ellipsis-tooltip-bubble--${coords.placement}${
              tooltipClassName ? ` ${tooltipClassName}` : ''
            }`}
            style={{
              top: coords.top,
              left: coords.left,
              opacity: placed ? 1 : 0,
            }}
          >
            {tooltip ?? children}
          </div>,
          document.body,
        )}
    </>
  );
}

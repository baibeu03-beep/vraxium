import { useEffect } from 'react';

export function useModalScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    let lastTouchY = 0;

    const preventWheelScroll = (e: WheelEvent) => {
      let el: HTMLElement | null = e.target as HTMLElement;

      while (el) {
        if (el === document.body || el === document.documentElement) break;

        const style = getComputedStyle(el);
        const hasScrollOverflow =
          style.overflowY === 'auto' || style.overflowY === 'scroll';

        if (hasScrollOverflow) {
          const remainingDown = el.scrollHeight - el.clientHeight - el.scrollTop;
          const remainingUp = el.scrollTop;
          const absDelta = Math.abs(e.deltaY);

          const canScrollDown = e.deltaY > 0 && remainingDown > 0;
          const canScrollUp = e.deltaY < 0 && remainingUp > 0;

          if (canScrollDown || canScrollUp) {
            return;
          }
        }

        el = el.parentElement;
      }

      e.preventDefault();
    };

    const preventTouchScroll = (e: TouchEvent) => {
      if (e.touches.length === 0) return;

      const touchY = e.touches[0].clientY;
      const deltaY = lastTouchY - touchY;
      lastTouchY = touchY;

      let el: HTMLElement | null = e.target as HTMLElement;

      while (el) {
        if (el === document.body || el === document.documentElement) break;

        const style = getComputedStyle(el);
        const hasScrollOverflow =
          style.overflowY === 'auto' || style.overflowY === 'scroll';

        if (hasScrollOverflow) {
          const remainingDown = el.scrollHeight - el.clientHeight - el.scrollTop;
          const remainingUp = el.scrollTop;
          const absDelta = Math.abs(deltaY);

          const canScrollDown = deltaY > 0 && remainingDown > 0;
          const canScrollUp = deltaY < 0 && remainingUp > 0;

          if (canScrollDown || canScrollUp) {
            return;
          }
        }

        el = el.parentElement;
      }

      e.preventDefault();
    };

    const saveTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        lastTouchY = e.touches[0].clientY;
      }
    };

    document.addEventListener('wheel', preventWheelScroll, { passive: false });
    document.addEventListener('touchstart', saveTouchStart, { passive: true });
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });

    return () => {
      document.removeEventListener('wheel', preventWheelScroll);
      document.removeEventListener('touchstart', saveTouchStart);
      document.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [isOpen]);
}

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { getThemeClass, getThemeKey, type ThemeKey } from '@/lib/cluster-route';
import Popup from './Popup';

/* ----------------------- Types ----------------------- */

export type PopupVariant = 'A' | 'B'; // A: [취소][확인], B: [확인]만

export interface PopupOptions {
  /** 본문 메시지 */
  message: string;
  /** 'A' = confirm 스타일, 'B' = alert 스타일 */
  variant: PopupVariant;
  /** 확인 버튼 텍스트 (기본 "확인") */
  confirmText?: string;
  /** 취소 버튼 텍스트 (기본 "취소", variant A에서만) */
  cancelText?: string;
}

interface PopupQueueItem extends PopupOptions {
  id: number;
  resolve: (value: boolean) => void;
  /** 팝업이 열린 시점 URL 기준으로 확정한 theme scope (portal root 부착). */
  themeClassName: string;
  themeKey: ThemeKey | null;
}

interface PopupContextValue {
  /** confirm 스타일: [취소][확인] → Promise<boolean> */
  confirm: (message: string, options?: Partial<PopupOptions>) => Promise<boolean>;
  /** alert 스타일: [확인]만 → Promise<void> */
  alert: (message: string, options?: Partial<PopupOptions>) => Promise<void>;
  showConfirm: (message: string, options?: Partial<PopupOptions>) => Promise<boolean>;
  showAlert: (message: string, options?: Partial<PopupOptions>) => Promise<void>;
}

const PopupContext = createContext<PopupContextValue | null>(null);

/* ----------------------- Provider ----------------------- */

export const PopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<PopupQueueItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  // Phase A/B — portal popup 의 theme scope.
  // Provider 는 layout 트리(=route subtree) 안에 있어 usePathname 으로 현재
  // 라우트의 theme 을 추론할 수 있다. 그 결과를 Popup 의 portal root 에 직접
  // 부착(themeClassName)해 createPortal body-direct 한계를 SCSS 측에서 우회
  // (`.cluster-px-theme.custom-popup-backdrop` 결합 selector). themeKey 는
  // body 아이콘 PNG 자산 swap (popup-N-px.png / -ec.png) 용도.
  const pathname = usePathname();

  // cluster route(-ec/-px)는 pathname 으로, /crews?org= · /weekly-ranking?org=
  // 는 ?org= 쿼리로 theme 을 판정한다(Sidebar sidebarThemeClass 와 동일 fallback).
  // 값은 usePathname 만 dep 으로 두고 org 는 팝업이 열리는 시점의 window.location
  // 에서 읽어 확정한다 — useSearchParams 를 쓰면 이 Provider 가 앱 전체를 감싸므로
  // 상위 트리에 Suspense 경계가 강제되어 정적 프리렌더가 깨진다(회피).
  const resolvePopupTheme = useCallback((): {
    themeClassName: string;
    themeKey: ThemeKey | null;
  } => {
    const pathClass = getThemeClass(pathname);
    if (pathClass) {
      return { themeClassName: pathClass, themeKey: getThemeKey(pathname) };
    }
    const orgParam =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('org')
        : null;
    if (orgParam === 'phalanx') {
      return { themeClassName: 'cluster-px-theme', themeKey: 'px' };
    }
    if (orgParam === 'encre') {
      return { themeClassName: 'encre-theme', themeKey: 'ec' };
    }
    return { themeClassName: '', themeKey: null };
  }, [pathname]);

  // Portal은 클라이언트에서만 마운트 (Next.js SSR 호환)
  useEffect(() => {
    setMounted(true);
  }, []);

  const current = queue[0] ?? null;

  /** 큐에 새 팝업 추가 */
  const enqueue = useCallback(
    (opts: PopupOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        idRef.current += 1;
        const theme = resolvePopupTheme();
        const item: PopupQueueItem = {
          ...opts,
          id: idRef.current,
          resolve,
          themeClassName: theme.themeClassName,
          themeKey: theme.themeKey,
        };
        setQueue((prev) => [...prev, item]);
      });
    },
    [resolvePopupTheme]
  );

  /** 현재 팝업 닫고 큐에서 제거 */
  const handleClose = useCallback((result: boolean) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      head.resolve(result);
      return rest;
    });
  }, []);

  const api = useMemo<PopupContextValue>(
    () => ({
      confirm: (message, options) =>
        enqueue({ message, variant: 'A', ...options }),
      alert: async (message, options) => {
        await enqueue({ message, variant: 'B', ...options });
      },
      showConfirm: (message, options) =>
        enqueue({ message, variant: 'A', ...options }),
      showAlert: async (message, options) => {
        await enqueue({ message, variant: 'B', ...options });
      },
    }),
    [enqueue]
  );

  return (
    <PopupContext.Provider value={api}>
      {children}
      {mounted &&
        current &&
        createPortal(
          <Popup
            key={current.id}
            message={current.message}
            variant={current.variant}
            confirmText={current.confirmText}
            cancelText={current.cancelText}
            onConfirm={() => handleClose(true)}
            onCancel={() => handleClose(false)}
            themeClassName={current.themeClassName}
            themeKey={current.themeKey}
          />,
          document.body
        )}
    </PopupContext.Provider>
  );
};

/* ----------------------- Hook ----------------------- */

export const usePopup = (): PopupContextValue => {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    throw new Error('usePopup must be used within <PopupProvider>');
  }
  return ctx;
};

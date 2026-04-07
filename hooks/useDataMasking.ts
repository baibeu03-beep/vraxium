'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
// [LEGACY REMOVED] import {...} from '@/lib/dataMasking';
// 마스킹 함수 stub: 비로그인/마스킹 모드에서도 원본 또는 '-' 그대로 반환
const maskBirthDate = (v: string | null | undefined): string => v || '-';
const maskAddress = (v: string | null | undefined): string => v || '-';
const maskEmail = (v: string | null | undefined): string => v || '-';
const maskSchool = (v: string | null | undefined): string => v || '-';
const maskMajor = (v: string | null | undefined): string => v || '-';
const maskGPA = (v: string | number | null | undefined): string => String(v ?? '-');
const maskYear = (v: string | number | null | undefined): string => String(v ?? '-');
const maskPeriod = (v: string | null | undefined): string => v || '-';
const maskAge = (v: string | number | null | undefined): string => String(v ?? '-');
import { isDemoMode as checkDemoMode } from '@/utils/isDemoMode';

/**
 * 비로그인 사용자용 데이터 마스킹 훅
 * - 로그인된 사용자: 원본 데이터 그대로 반환
 * - 비로그인 사용자: 마스킹된 데이터 반환
 * - 더미 모드: 마스킹 비활성화 (원본 그대로)
 *
 * SSR/client hydration 일관성: isDemoMode()가 localStorage를 읽으므로
 * render time에 직접 호출하면 SSR(false) ↔ client(true) 불일치 발생.
 * stateful로 변환하여 첫 렌더는 항상 false, 마운트 후 localStorage 값 반영.
 */
export function useDataMasking() {
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const [isDemoModeState, setIsDemoModeState] = useState(false);
  useEffect(() => {
    setIsDemoModeState(checkDemoMode());
  }, []);
  const skipMask = isLoggedIn || isDemoModeState;

  // 로그인 상태 또는 더미 모드면 원본 그대로, 아니면 마스킹
  const m = {
    birthDate: (v: string | null | undefined) => skipMask ? (v || '-') : maskBirthDate(v),
    address: (v: string | null | undefined) => skipMask ? (v || '-') : maskAddress(v),
    email: (v: string | null | undefined) => skipMask ? (v || '-') : maskEmail(v),
    school: (v: string | null | undefined) => skipMask ? (v || '-') : maskSchool(v),
    major: (v: string | null | undefined) => skipMask ? (v || '-') : maskMajor(v),
    gpa: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskGPA(v),
    year: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskYear(v),
    period: (v: string | null | undefined) => skipMask ? (v || '-') : maskPeriod(v),
    age: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskAge(v),
  };

  return { isLoggedIn, mask: m };
}

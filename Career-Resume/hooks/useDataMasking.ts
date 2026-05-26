'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  maskBirthDate,
  maskAddress,
  maskEmail,
  maskSchool,
  maskMajor,
  maskGPA,
  maskYear,
  maskPeriod,
  maskAge,
  maskDisplayName,
} from '@/lib/dataMasking';
import { isDemoMode as checkDemoMode } from '@/utils/isDemoMode';

/**
 * 데이터 마스킹 훅
 * - 어드민(마더 계정) 세션: 모든 원본 데이터 그대로
 * - 일반 로그인 사용자: 이메일만 마스킹 (그 외 raw — 전화번호는 서버사이드에서 마스킹)
 * - 비로그인 사용자: 전체 마스킹 (displayName 포함)
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

  // 어드민 권한은 NextAuth 세션의 isAdmin 플래그로만 판정
  // (lib/admin.ts ADMIN_EMAILS 의 마더 계정 3개에서만 true)
  const isAdmin = !!session?.user?.isAdmin;

  // 관리자 모드: 모든 정보 원본 그대로
  const raw = {
    birthDate: (v: string | null | undefined) => v || '-',
    address: (v: string | null | undefined) => v || '-',
    email: (v: string | null | undefined) => v || '-',
    school: (v: string | null | undefined) => v || '-',
    major: (v: string | null | undefined) => v || '-',
    gpa: (v: string | number | null | undefined) => String(v ?? '-'),
    year: (v: string | number | null | undefined) => String(v ?? '-'),
    period: (v: string | null | undefined) => v || '-',
    age: (v: string | number | null | undefined) => String(v ?? '-'),
    displayName: (v: string | null | undefined) => v || '-',
  };

  // 비어드민 사용자:
  // - 로그인/데모 시 (skipMask=true): 이메일 외 모두 raw
  // - 비로그인 시 (skipMask=false): 모든 필드 마스킹 (displayName 포함)
  const masked = {
    birthDate: (v: string | null | undefined) => skipMask ? (v || '-') : maskBirthDate(v),
    address: (v: string | null | undefined) => skipMask ? (v || '-') : maskAddress(v),
    email: (v: string | null | undefined) => maskEmail(v),
    school: (v: string | null | undefined) => skipMask ? (v || '-') : maskSchool(v),
    major: (v: string | null | undefined) => skipMask ? (v || '-') : maskMajor(v),
    gpa: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskGPA(v),
    year: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskYear(v),
    period: (v: string | null | undefined) => skipMask ? (v || '-') : maskPeriod(v),
    age: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskAge(v),
    displayName: (v: string | null | undefined) => skipMask ? (v || '-') : maskDisplayName(v),
  };

  return { isLoggedIn, isAdmin, mask: isAdmin ? raw : masked };
}

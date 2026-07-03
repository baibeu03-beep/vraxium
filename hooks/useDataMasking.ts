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
  maskCrewName,
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
    // 크루 이름 — 어드민은 원본 그대로(isLoggedIn=true 로 전달).
    crewName: (v: string | null | undefined) => maskCrewName(v, true),
    gender: (v: string | null | undefined) => v || '-',
  };

  // 비어드민 사용자:
  // - 로그인/데모 시 (skipMask=true): 이메일 외 모두 raw
  // - 비로그인 시 (skipMask=false): 모든 필드 마스킹 (displayName 포함)
  const masked = {
    birthDate: (v: string | null | undefined) => skipMask ? (v || '-') : maskBirthDate(v),
    address: (v: string | null | undefined) => skipMask ? (v || '-') : maskAddress(v),
    // 이메일도 다른 필드와 동일하게 skipMask 게이트 — 로그인/데모 시 원문, 비로그인만 마스킹.
    // (기존엔 email 만 skipMask 무시하고 항상 마스킹 → 카드/모달이 우회해 raw 노출하던 불일치 정리)
    email: (v: string | null | undefined) => skipMask ? (v || '-') : maskEmail(v),
    school: (v: string | null | undefined) => skipMask ? (v || '-') : maskSchool(v),
    major: (v: string | null | undefined) => skipMask ? (v || '-') : maskMajor(v),
    gpa: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskGPA(v),
    year: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskYear(v),
    period: (v: string | null | undefined) => skipMask ? (v || '-') : maskPeriod(v),
    age: (v: string | number | null | undefined) => skipMask ? String(v ?? '-') : maskAge(v),
    displayName: (v: string | null | undefined) => skipMask ? (v || '-') : maskDisplayName(v),
    // 크루 이름 — 로그인/데모면 원본, 비로그인이면 마지막 글자만 마스킹(공용 maskCrewName).
    //   백엔드 /api/crews 가 이미 비로그인 응답에서 마스킹하지만, 표시 컴포넌트도 동일 공통 함수를
    //   경유시켜 이중 방어 + 단일 규칙을 보장한다(idempotent 라 이미 마스킹된 값도 안전).
    crewName: (v: string | null | undefined) => maskCrewName(v, skipMask),
    // 성별 — 비로그인은 비공개('-'). 로그인/데모는 원문. (부분 마스킹이 의미없는 1글자 필드라 전체 가림)
    gender: (v: string | null | undefined) => skipMask ? (v || '-') : '-',
  };

  return { isLoggedIn, isAdmin, mask: isAdmin ? raw : masked };
}

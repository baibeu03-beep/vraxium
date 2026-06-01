"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { dedupedJson, invalidateDedupe } from "@/lib/fetch-dedupe";

// Profile 데이터 타입
interface ProfileData {
  data: any;
  // 연락 가능 시간대/코멘트 — DB: user_profiles.contact_available, API/Frontend: contactAvailable.
  // /api/profile 응답의 data.contactAvailable (alias) 또는 data.contact_available 에서 매핑.
  // 값이 없으면 null. resume-card phone-comment 모달이 직접 이 필드를 읽음.
  contactAvailable: string | null;
  practicalCounts: { competency: number; experience: number; info: number; career: number } | null;
  practicalStats: {
    infoCount: number;
    experienceCount: number;
    abilityUnitCount: number;
    careerProjectCount: number;
  } | null;
  careerProjectCount: number | null;
  careerActivityCount: number | null;
  reliabilityRate: number | null;
  completionRate: number | null;
  badges: { stars: number; lightnings: number; shields: number } | null;
  // resume-card .resume-badges point DTO (source: user_cumulative_points 전용 컬럼).
  // check=total_checks, advantage=total_advantages, penalty=total_penalties. 미존재 시 0.
  point: { check: number; advantage: number; penalty: number } | null;
  seasonHistories: any[] | null;
  growthInfo: any | null;
  gradeStats: any | null;
  growthPeriodStats: any | null;
  activityWeekIds: string[];
  restWeekIds: string[];
  approvedActivities: any[];
  activityRecords: any[];
  activityDetails: any[];
  activityPoints: any[];
  userRoleHistory: any[];
  teams: any[];
  parts: any[];
  userTeamParts: any[];
  onboardingWeekId: string | null;
  resumeCardSettings: {
    hexagonLink1: string | null;
    hexagonLink2: string | null;
    hexagonLink3: string | null;
    helpTooltipText: string | null;
    medalWeekOverride: number | null;
    medalTheme: string | null;
    noticeTopText: string | null;
    noticeTopStampImageUrl: string | null;
    noticeBottomText: string | null;
    noticeBottomStampImageUrl: string | null;
    helpTooltipDefault: string | null;
  } | null;
}

interface ProfileContextType {
  profileData: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: (userId?: string, forceRefresh?: boolean) => Promise<ProfileData | null>;
  clearCache: () => void;
  lastFetchedUserId: string | null;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);
  const [errorTimestamp, setErrorTimestamp] = useState<number>(0);
  const [lastErrorUserId, setLastErrorUserId] = useState<string | null>(null);

  // 캐시 유효 시간 (5분)
  const CACHE_TTL = 5 * 60 * 1000;
  // 에러 캐시 유효 시간 (30초) - 실패 시 재시도 간격
  const ERROR_CACHE_TTL = 30 * 1000;

  // ref로 현재 값 참조 → useCallback 의존성 배열을 []로 안정화
  const stateRef = useRef({
    profileData,
    lastFetchedUserId,
    cacheTimestamp,
    error,
    lastErrorUserId,
    errorTimestamp,
  });
  useEffect(() => {
    stateRef.current = {
      profileData,
      lastFetchedUserId,
      cacheTimestamp,
      error,
      lastErrorUserId,
      errorTimestamp,
    };
  });

  const fetchProfile = useCallback(async (userId?: string, forceRefresh?: boolean): Promise<ProfileData | null> => {
    const targetUserId = userId || null;
    const now = Date.now();
    const s = stateRef.current;

    // 캐시된 데이터가 있고, 같은 userId이고, 캐시가 유효하면 재사용
    if (
      !forceRefresh &&
      s.profileData &&
      s.lastFetchedUserId === targetUserId &&
      now - s.cacheTimestamp < CACHE_TTL
    ) {
      return s.profileData;
    }

    // 최근 에러가 있고, 같은 userId이고, 에러 캐시가 유효하면 재요청 방지
    if (
      !forceRefresh &&
      s.error &&
      s.lastErrorUserId === targetUserId &&
      now - s.errorTimestamp < ERROR_CACHE_TTL
    ) {
      return null;
    }

    // targetUserId 가 UUID 형식 아니면 API 호출 전에 즉시 실패 처리 — 불필요한 400 응답 차단.
    // (URL 의 userId 가 잘리거나 잘못 입력된 케이스에서 무한 skeleton 으로 빠지는 것 방지)
    if (targetUserId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId)) {
        const errorMsg = '유효하지 않은 사용자 ID 형식입니다.';
        console.warn('[ProfileContext] UUID 형식 오류로 fetch 스킵:', targetUserId);
        setError(errorMsg);
        setErrorTimestamp(now);
        setLastErrorUserId(targetUserId);
        return null;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = targetUserId ? `/api/profile/?userId=${targetUserId}` : '/api/profile/';
      // forceRefresh 면 dedupe 캐시 무효화 후 새로 요청
      if (forceRefresh) invalidateDedupe(apiUrl);
      const result: any = await dedupedJson(apiUrl);

      if (!result || !result.success) {
        const errorMsg = result?.error || 'Failed to fetch profile';
        console.warn('[ProfileContext] API 응답 실패:', errorMsg);
        setError(errorMsg);
        setErrorTimestamp(now);
        setLastErrorUserId(targetUserId);
        setIsLoading(false);
        return null;
      }

      const newProfileData: ProfileData = {
        data: result.data,
        contactAvailable:
          result.data?.contactAvailable ?? result.data?.contact_available ?? null,
        practicalCounts: result.practicalCounts || null,
        practicalStats: result.practicalStats || null,
        careerProjectCount:
          typeof result.careerProjectCount === "number" ? result.careerProjectCount : null,
        careerActivityCount:
          typeof result.careerActivityCount === "number" ? result.careerActivityCount : null,
        reliabilityRate: result.reliabilityRate ?? null,
        completionRate: result.completionRate ?? null,
        badges: result.badges || null,
        point: result.point || null,
        seasonHistories: result.seasonHistories || null,
        growthInfo: result.growthInfo || null,
        gradeStats: result.gradeStats || null,
        growthPeriodStats: result.growthPeriodStats || null,
        activityWeekIds: result.activityWeekIds || [],
        restWeekIds: result.restWeekIds || [],
        approvedActivities: result.approvedActivities || [],
        activityRecords: result.activityRecords || [],
        activityDetails: result.activityDetails || [],
        activityPoints: result.activityPoints || [],
        userRoleHistory: result.userRoleHistory || [],
        teams: result.teams || [],
        parts: result.parts || [],
        userTeamParts: result.userTeamParts || [],
        onboardingWeekId: result.onboardingWeekId || null,
        resumeCardSettings: result.resumeCardSettings || null,
      };

      setProfileData(newProfileData);
      setLastFetchedUserId(targetUserId);
      setCacheTimestamp(now);
      setIsLoading(false);

      return newProfileData;
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to fetch profile');
      setErrorTimestamp(now);
      setLastErrorUserId(targetUserId);
      setIsLoading(false);
      return null;
    }
  }, []);

  const clearCache = useCallback(() => {
    setProfileData(null);
    setLastFetchedUserId(null);
    setCacheTimestamp(0);
    setError(null);
    setErrorTimestamp(0);
    setLastErrorUserId(null);
    // 모듈 레벨 dedupe 캐시도 같이 무효화 — Cluster4Content 등 다른 호출처와 일관성 유지
    invalidateDedupe('/api/profile');
  }, []);

  // 세션 변경 시 캐시 초기화
  useEffect(() => {
    if (session?.user?.id !== lastFetchedUserId) {
      clearCache();
    }
  }, [session?.user?.id]);

  return (
    <ProfileContext.Provider value={{
      profileData,
      isLoading,
      error,
      fetchProfile,
      clearCache,
      lastFetchedUserId,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

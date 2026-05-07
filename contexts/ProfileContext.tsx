"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

// Profile 데이터 타입
interface ProfileData {
  data: any;
  practicalCounts: { competency: number; experience: number; info: number; career: number } | null;
  reliabilityRate: number | null;
  completionRate: number | null;
  badges: { stars: number; lightnings: number; shields: number } | null;
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

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = targetUserId ? `/api/profile/?userId=${targetUserId}` : '/api/profile/';
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'Failed to fetch profile';
        console.warn('[ProfileContext] API 응답 실패:', response.status, errorMsg);
        setError(errorMsg);
        setErrorTimestamp(now);
        setLastErrorUserId(targetUserId);
        setIsLoading(false);
        return null;
      }

      const newProfileData: ProfileData = {
        data: result.data,
        practicalCounts: result.practicalCounts || null,
        reliabilityRate: result.reliabilityRate ?? null,
        completionRate: result.completionRate ?? null,
        badges: result.badges || null,
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

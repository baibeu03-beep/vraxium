"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const Cluster4CardPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // 현재 주차로 리다이렉트
  useEffect(() => {
    // demoMode 가 켜져 있을 때만 dw-01 더미 카드로 직행.
    // ?admin=true 는 DemoToggle 노출 신호일 뿐 (DemoToggle.tsx 가 처리) — 단독으로
    // dw-01 redirect 를 트리거하지 않는다. dw-01 은 frontend dummy 라
    // demoMode=false 에서 흘러가면 실 API 가 weekId='dw-01' 을 UUID 캐스트하다 실패.
    // 진입 쿼리(userId=대상자/target, demoUserId=테스트 작성자/actor, admin, demoUserName, org)를
    // redirect 목적지(주차 카드)까지 그대로 보존한다. 안 그러면 cluster-4-card 가 urlUserId 를
    // demoUserId 로 폴백해 타 크루 카드에서 "내 카드로 복귀"한다.
    const params = new URLSearchParams(window.location.search);
    const qs = params.toString();
    const withQs = (path: string) => (qs ? `${path}?${qs}` : path);
    const demoOn =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('demoMode') === 'true';
    if (demoOn) {
      router.replace(withQs('/cluster-4-card-marketing/dw-01'));
      return;
    }

    const fetchCurrentWeekAndRedirect = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // 현재 날짜가 포함된 주차 찾기 — v1: 실 컬럼명 (started_at/ended_at) 사용
        const { data: currentWeek, error } = await supabase
          .from('weeks')
          .select('id, started_at, ended_at, seasons(name)')
          .lte('started_at', today)
          .gte('ended_at', today)
          .single();

        if (error || !currentWeek) {
          // 현재 주차가 없으면 가장 최근 주차로
          const { data: latestWeek } = await supabase
            .from('weeks')
            .select('id, seasons(name)')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (latestWeek) {
            // break 시즌 제외
            const seasonName = (latestWeek.seasons as any)?.name || '';
            if (!seasonName.toLowerCase().includes('break')) {
              router.replace(withQs(`/cluster-4-card-marketing/${latestWeek.id}`));
              return;
            }
          }
        } else {
          // break 시즌 제외
          const seasonName = (currentWeek.seasons as any)?.name || '';
          if (!seasonName.toLowerCase().includes('break')) {
            router.replace(withQs(`/cluster-4-card-marketing/${currentWeek.id}`));
            return;
          }
        }

        // 적절한 주차를 찾지 못한 경우 로딩 상태 유지
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching current week:', err);
        setIsLoading(false);
      }
    };

    fetchCurrentWeekAndRedirect();
  }, [router]);

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        현재 주차를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
      표시할 주차가 없습니다.
    </div>
  );
};

export default Cluster4CardPage;

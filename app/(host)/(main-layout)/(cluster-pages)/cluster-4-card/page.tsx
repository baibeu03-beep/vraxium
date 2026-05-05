"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const Cluster4CardPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // 현재 주차로 리다이렉트
  useEffect(() => {
    // ?admin=true이면 dw-01 더미 카드로 직행 (파라미터 유지로 DemoToggle 활성화도 그대로 작동)
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      router.replace(`/cluster-4-card/dw-01?${params.toString()}`);
      return;
    }

    const fetchCurrentWeekAndRedirect = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // 현재 날짜가 포함된 주차 찾기
        const { data: currentWeek, error } = await supabase
          .from('weeks')
          .select('id, start_date, end_date, seasons(name)')
          .lte('start_date', today)
          .gte('end_date', today)
          .single();

        if (error || !currentWeek) {
          // 현재 주차가 없으면 가장 최근 주차로
          const { data: latestWeek } = await supabase
            .from('weeks')
            .select('id, seasons(name)')
            .order('start_date', { ascending: false })
            .limit(1)
            .single();

          if (latestWeek) {
            // break 시즌 제외
            const seasonName = (latestWeek.seasons as any)?.name || '';
            if (!seasonName.toLowerCase().includes('break')) {
              router.replace(`/cluster-4-card/${latestWeek.id}`);
              return;
            }
          }
        } else {
          // break 시즌 제외
          const seasonName = (currentWeek.seasons as any)?.name || '';
          if (!seasonName.toLowerCase().includes('break')) {
            router.replace(`/cluster-4-card/${currentWeek.id}`);
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

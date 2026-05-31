"use client";

// Encre 전용 cluster-4-card 변형. 원본은 현재/최신 주차로 자동 redirect 한다.
// EC 변형도 동일 동작이되, redirect 목적지를 /cluster-4-card-ec 로 한정해
// EC 라우트 내부에 머무르게 한다.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const Cluster4CardEcPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // demoMode 가 켜져 있을 때만 dw-01 더미 카드로 직행.
    // ?admin=true 는 DemoToggle 노출 신호일 뿐 — 단독 트리거 금지 (base route 와 동기).
    const params = new URLSearchParams(window.location.search);
    const demoOn =
      typeof window !== "undefined" &&
      window.localStorage.getItem("demoMode") === "true";
    if (demoOn) {
      const qs = params.toString();
      router.replace(qs ? `/cluster-4-card-entertainment/dw-01?${qs}` : "/cluster-4-card-entertainment/dw-01");
      return;
    }

    const fetchCurrentWeekAndRedirect = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        // v1: 실 컬럼명 (started_at/ended_at) 사용
        const { data: currentWeek, error } = await supabase
          .from("weeks")
          .select("id, started_at, ended_at, seasons(name)")
          .lte("started_at", today)
          .gte("ended_at", today)
          .single();

        if (error || !currentWeek) {
          const { data: latestWeek } = await supabase
            .from("weeks")
            .select("id, seasons(name)")
            .order("started_at", { ascending: false })
            .limit(1)
            .single();

          if (latestWeek) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const seasonName = (latestWeek.seasons as any)?.name || "";
            if (!seasonName.toLowerCase().includes("break")) {
              router.replace(`/cluster-4-card-entertainment/${latestWeek.id}`);
              return;
            }
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seasonName = (currentWeek.seasons as any)?.name || "";
          if (!seasonName.toLowerCase().includes("break")) {
            router.replace(`/cluster-4-card-entertainment/${currentWeek.id}`);
            return;
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching current week:", err);
        setIsLoading(false);
      }
    };

    fetchCurrentWeekAndRedirect();
  }, [router]);

  if (isLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        현재 주차를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
      표시할 주차가 없습니다.
    </div>
  );
};

export default Cluster4CardEcPage;

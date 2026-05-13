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
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") {
      router.replace(`/cluster-4-card-ec/dw-01?${params.toString()}`);
      return;
    }

    const fetchCurrentWeekAndRedirect = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const { data: currentWeek, error } = await supabase
          .from("weeks")
          .select("id, start_date, end_date, seasons(name)")
          .lte("start_date", today)
          .gte("end_date", today)
          .single();

        if (error || !currentWeek) {
          const { data: latestWeek } = await supabase
            .from("weeks")
            .select("id, seasons(name)")
            .order("start_date", { ascending: false })
            .limit(1)
            .single();

          if (latestWeek) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const seasonName = (latestWeek.seasons as any)?.name || "";
            if (!seasonName.toLowerCase().includes("break")) {
              router.replace(`/cluster-4-card-ec/${latestWeek.id}`);
              return;
            }
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seasonName = (currentWeek.seasons as any)?.name || "";
          if (!seasonName.toLowerCase().includes("break")) {
            router.replace(`/cluster-4-card-ec/${currentWeek.id}`);
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

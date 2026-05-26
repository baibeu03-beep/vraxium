"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

const DEFAULT_PRIMARY = "#FAAB07";

const BalanceChart: React.FC = () => {
  // --primary-color 는 RouteThemeShell 의 <div data-route-path> 래퍼에서 라우트별로 주입됨.
  // documentElement 가 아니라 차트 컨테이너에서 읽어야 cascade 된 값을 얻는다.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const raf = window.requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const v = getComputedStyle(containerRef.current).getPropertyValue("--primary-color").trim();
      if (v) setPrimaryColor(v);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  const balanceChartOptions: ApexOptions = useMemo(() => ({
    colors: [primaryColor],
    chart: {
      type: "area",
      height: 150,
      width: "100%",
      toolbar: { show: false },
      sparkline: { enabled: true },
    },
    annotations: { yaxis: [], xaxis: [] },
    series: [
      {
        name: "Balance",
        data: [400, 350, 300, 350, 300, 350, 300, 400, 350, 300, 250, 300],
      },
    ],
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: 2,
      colors: [primaryColor],
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 1,
        opacityTo: 0.1,
        stops: [0, 100],
        colorStops: [
          { offset: 0,   color: "#000000", opacity: 1   },
          { offset: 100, color: "#000000", opacity: 0.1 },
        ],
      },
    },
    markers: {
      colors: [primaryColor],
      strokeColors: primaryColor,
      hover: { size: 6 },
    },
    tooltip: {
      theme: "dark",
      style: { fontSize: "12px", fontFamily: "inherit" },
    },
    xaxis: {
      axisTicks: { show: false },
      categories: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    },
    yaxis: {
      show: false,
      opposite: false,
      labels: {
        formatter: (value: number) => "$" + value,
      },
    },
    grid: {
      show: false,
      yaxis: { lines: { show: false } },
    },
    legend: {
      show: false,
      horizontalAlign: "left",
    },
    responsive: [
      {
        breakpoint: 767,
        options: {
          chart: {
            maxWidth: "100%",
            height: 150,
            sparkline: { enabled: false },
          },
        },
      },
    ],
  }), [primaryColor]);

  return (
    <div ref={containerRef}>
      <ApexCharts options={balanceChartOptions} series={balanceChartOptions.series} type="area" height={150} />
    </div>
  );
};

export default BalanceChart;

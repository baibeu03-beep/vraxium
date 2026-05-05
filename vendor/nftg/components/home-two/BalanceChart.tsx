import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

const BalanceChart: React.FC = () => {
  const balanceChartOptions: ApexOptions = {
    colors: ["#FAAB07"],
    chart: {
      type: "area",
      height: 150,
      width: "100%",
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
    },
    annotations: {
      yaxis: [],
      xaxis: [],
    },
    series: [
      {
        name: "Balance",
        data: [400, 350, 300, 350, 300, 350, 300, 400, 350, 300, 250, 300],
      },
    ],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 1,
        opacityTo: 0.1,
        stops: [0, 100],
        colorStops: [
          {
            offset: 0,
            color: "#000000",
            opacity: 1,
          },
          {
            offset: 100,
            color: "#000000",
            opacity: 0.1,
          },
        ],
      },
    },
    markers: {
      hover: {
        size: 6,
      },
    },
    tooltip: {
      theme: "dark",
      style: {
        fontSize: "12px",
        fontFamily: "inherit",
      },
    },
    xaxis: {
      axisTicks: {
        show: false,
      },
      categories: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    },
    yaxis: {
      show: false,
      opposite: false,
      labels: {
        formatter: (value: number) => {
          return "$" + value;
        },
      },
    },
    grid: {
      show: false,
      yaxis: {
        lines: {
          show: false,
        },
      },
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
            sparkline: {
              enabled: false,
            },
          },
        },
      },
    ],
  };

  return <ApexCharts options={balanceChartOptions} series={balanceChartOptions.series} type="area" height={150} />;
};

export default BalanceChart;

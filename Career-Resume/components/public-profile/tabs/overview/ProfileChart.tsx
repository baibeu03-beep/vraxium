import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

const ProfileChart: React.FC = () => {
  const profileChartOptions: ApexOptions = {
    series: [
      {
        name: "ROI",
        data: [331, 440, 328, 251, 342, 209, 400],
      },
      {
        name: "Profit",
        data: [142, 232, 245, 132, 234, 442, 500],
      },
    ],
    chart: {
      height: 250,
      type: "area",
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
    },
    xaxis: {
      type: "datetime",
      labels: {
        show: false,
      },
      categories: ["2018-09-19T00:00:00.000Z", "2018-09-19T01:30:00.000Z", "2018-09-19T02:30:00.000Z", "2018-09-19T03:30:00.000Z", "2018-09-19T04:30:00.000Z", "2018-09-19T05:30:00.000Z", "2018-09-19T06:30:00.000Z"],
    },
    yaxis: {
      labels: {
        style: {
          colors: "#FFFFFF",
        },
      },
    },
    tooltip: {
      theme: "dark",
      style: {
        fontSize: "12px",
        fontFamily: "inherit",
      },
    },
  };

  return <ApexCharts options={profileChartOptions} series={profileChartOptions.series} type="area" height={250} />;
};

export default ProfileChart;

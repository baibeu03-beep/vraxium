"use client";

// Encre 전용 cluster-5 변형. 원본 /cluster-5 와 PX /cluster-5-px 는 손대지
// 않으며, 본 EC 라우트는 공용 placeholder 컴포넌트(ClusterPlaceholderEc) 만
// import 한다. theme wrapper(.encre-theme) 는 (cluster-pages)/layout.tsx 에서
// pathname segment 가 -ec 로 끝나면 자동 부착된다.
import ClusterPlaceholderEc from "@/components/shared/ClusterPlaceholderEc";

const Cluster5EcPage = () => {
  return <ClusterPlaceholderEc />;
};

export default Cluster5EcPage;

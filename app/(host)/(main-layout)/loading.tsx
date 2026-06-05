import LoadingPanel from "@/components/ui/loading/LoadingPanel";

// (main-layout) 세그먼트 loading boundary.
// Why: 이게 없으면 느린 페이지로의 전환(같은 그룹 내 포함) suspension이
// (host)/loading.tsx까지 버블링되어 셸(.nftg-app·헤더·사이드바)이 통째로
// unmount/remount → 매 전환마다 전체 화면 교체 + reveal 게이트 재시작.
// 여기서 끊으면 셸은 유지되고 콘텐츠 영역만 로딩 패널로 대체된다.
const loading = () => <LoadingPanel message="페이지를 불러오고 있어요…" minHeight="60vh" />;

export default loading;

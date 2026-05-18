export const CLUSTER3_CHANNEL_DEFAULTS = {
  firstCard: {
    id: 1,
    title: "Career Exp Channel",
    badge: "D",
    price: "4.89",
    tag: "09h 99m 99s",
    channelName: "@ Discovery_Korea",
    platform: "유튜브",
    management: "개인 소유 관리",
    startYear: "2019",
    startMonth: "04",
    startDay: "26",
    rating: "7",
    status: "운영 중",
    link: "https://www.youtube.com/@Discovery_Korea",
    images: [
      "/images/0/1/1.png",
      "/images/0/1/2.png",
      "/images/0/1/3.png",
      "/images/0/1/4.png",
      "/images/0/1/5.png",
    ] as (string | null)[],
    captions: ["", "", "", "", ""],
    insight: "한국의 다양한 문화와 자연을 소개하는 콘텐츠를 기획하고 있으며, 구독자와의 소통을 최우선 가치로 두고 채널을 운영하고 있습니다. 트렌드 분석을 통해 시청자가 원하는 콘텐츠를 선제적으로 제작하는 방향으로 기획하고 있습니다.",
    experience: "영상 촬영 및 편집 경력 3년, 유튜브 크리에이터 아카데미 수료, 다수의 브랜드 협업 프로젝트 참여 경험이 있으며, SNS 마케팅 캠페인 기획 및 운영을 통해 콘텐츠 제작 역량을 키워왔습니다.",
    metrics: "구독자 12,500명 달성, 평균 조회수 8,200회, 월 평균 시청 시간 4,500시간, 최고 조회수 영상 152,000회, 커뮤니티 참여율 6.8%, 브랜드 협업 누적 15건 진행.",
  },
  emptyCard: {
    title: "Career Exp Channel",
    badge: "D",
    price: "4.89",
    tag: "09h 99m 99s",
    channelName: "",
    platform: "",
    management: "",
    startYear: "",
    startMonth: "",
    startDay: "",
    rating: "",
    status: "",
    link: "",
    images: [null, null, null, null, null] as (string | null)[],
    captions: ["", "", "", "", ""],
    insight: "",
    experience: "",
    metrics: "",
  },
};

// Production 초기 state — 16카드 모두 emptyCard.
// canonical fetch (portfolio_channel_cards) 가 아직 응답하기 전이라도
// `firstCard` sample 값이 state 에 들어 있으면, 사용자가 무심코 모달 Save 를
// 눌렀을 때 sample 페이로드가 canonical row 를 덮어쓰는 사고가 발생한다.
// (실제 2026-05-18 사고 — channel_name 이 '@ Discovery_Korea' 로 revert.)
// → production initial state 에서는 sample 을 절대 시드하지 않는다.
//   sample 데이터는 데모 모드에서만 별도 useEffect 가 명시적으로 주입한다.
export const createEmptyChannelCards = () =>
  Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    ...CLUSTER3_CHANNEL_DEFAULTS.emptyCard,
  }));

// Demo 모드 전용 — card 1 만 firstCard sample 로 시드. production 사용 금지.
export const createInitialChannelCards = () => [
  { ...CLUSTER3_CHANNEL_DEFAULTS.firstCard },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: i + 2,
    ...CLUSTER3_CHANNEL_DEFAULTS.emptyCard,
  })),
];

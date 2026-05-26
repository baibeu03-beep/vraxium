export const DEMO_CREW_MEMBERS = ["윤재윤", "전민경", "안지혜", "곽예원", "김의환"] as const;
export const DEFAULT_DEMO_USER = "윤재윤";

// 윤재윤 — TYPICAL (자연스러운 중간 값)
export const CLUSTER2_DUMMY_PHOTOS = {
  mainPhoto: "/images/0/cluster 2/dummy/sub-photo-1.png",
  subPhotos: ["/images/0/cluster 2/dummy/sub-photo-1.png", "/images/0/cluster 2/dummy/sub-photo-2.png", "/images/0/cluster 2/dummy/sub-photo-3.png", "/images/0/cluster 2/dummy/sub-photo-4.png"] as (string | null)[],
};

export const CLUSTER2_DUMMY_SLOGANS = {
  engName: "YUN JAEYUN",
  slogan1: { option: "Dreamer", content: "고객의 마음을 읽는 데이터 기반 마케터", rating: 8 },
  slogan2: { option: "Pioneer", content: "매일 1%씩 성장하는 것이 나의 철학입니다 고객의 마음을 읽는 데이터 기반 마케터 매일 1%씩 성장하는 것이 나의", rating: 9 },
  slogan3: { option: "Warrior", content: "함께 가면 더 멀리 갈 수 있다고 믿습니다 함께 가면 더 멀리 갈 수 있다고 믿습니다 함께 가면 더 멀리 갈 수 있다고 믿습니다 함께 가면 ", rating: 7 },
};

export const CLUSTER2_DUMMY_VIDEOS = {
  videoUrl1: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  videoUrl2: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  videoUrl3: null as string | null,
};

export const CLUSTER2_DUMMY_EDUCATIONS = [
  {
    eduLevel: "대학교(4년)",
    school: "한국외국어대학교",
    status: "졸업",
    category: "인문계열",
    major1: "스페인어과",
    major2: "국제통상학과",
    major3: "",
    period: "2016.03 ~ 2020.02",
    startYear: "2016",
    startMonth: "03",
    endYear: "2020",
    endMonth: "02",
    gradeMax: "4.5",
    gradeValue: "4.3",
    description: "글로벌 커뮤니케이션과 다문화 이해를 기반으로 마케팅 역량을 키웠습니다.",
    isFinal: true,
  },
  { eduLevel: "고등학교", school: "서울외국어고등학교", status: "졸업", category: "", major1: "스페인어과", major2: "", major3: "", period: "2013.03 ~ 2016.02", startYear: "2013", startMonth: "03", endYear: "2016", endMonth: "02", gradeMax: "", gradeValue: "", description: "" },
];

export const CLUSTER2_DUMMY_REVIEWS = {
  cluvingReviewLink: "https://www.cluving.com/review/sample",
  reviewLinks: ["https://brunch.co.kr/@sample/insight", "https://medium.com/@sample/guide", "https://blog.naver.com/sample/report", "", "", "", "", "", "", ""],
};

export const CLUSTER2_DUMMY_INTRO = {
  growthStory: "어린 시절부터 새로운 것을 배우는 데 열정을 가지고 있었습니다. 대학 시절 스페인 교환학생 경험을 통해 다양한 문화와 관점을 이해하게 되었고, 이는 마케팅에서 고객의 다양한 니즈를 파악하는 데 큰 도움이 되었습니다.",
  socialExperience: "대학 마케팅 학회에서 2년간 활동하며 브랜드 캠페인 기획과 실행을 경험했습니다. 졸업 후에는 스타트업에서 그로스 마케팅을 담당하며 DAU 300% 성장에 기여했습니다.",
  careerDirection: "데이터 기반의 퍼포먼스 마케팅 전문가로 성장하고 싶습니다. 특히 글로벌 시장을 대상으로 한 크로스보더 마케팅에 관심이 있습니다.",
  workStyle: "체계적인 계획 수립과 데이터 기반 의사결정을 선호합니다. 동시에 팀원들과의 열린 소통을 중요시하며, 빠른 실행과 피드백을 통한 개선을 추구합니다.",
  personalStory: "주말에는 러닝 크루에서 함께 달리며 체력을 관리합니다. 최근에는 독서 모임에 참여하여 매달 2권의 비즈니스 서적을 읽고 인사이트를 공유하고 있습니다.",
};

type Cluster2UserData = {
  photos: { mainPhoto: string; subPhotos: (string | null)[] };
  slogans: typeof CLUSTER2_DUMMY_SLOGANS;
  videos: { videoUrl1: string; videoUrl2: string; videoUrl3: string | null };
  educations: typeof CLUSTER2_DUMMY_EDUCATIONS;
  reviews: typeof CLUSTER2_DUMMY_REVIEWS;
  intro: typeof CLUSTER2_DUMMY_INTRO;
};

// 오버플로우 테스트용 매우 긴 텍스트 (반복으로 길이 확보)
const OVERFLOW_LONG = "오랑캐는 백수의 왕이며 그 포효 한 번에 산이 흔들리고 그 발걸음 한 번에 강이 멈춘다 이 문장은 입력 필드의 최대 글자 수를 초과하기 위한 테스트 텍스트입니다 ".repeat(6);
const OVERFLOW_SHORT = "사용자 입력 필드의 maxLength 제약을 초과하는지 확인하기 위한 긴 슬로건 텍스트 사용자 입력 필드의 maxLength 제약을 초과하는지 확인하기 위한 긴 슬로건 텍스트 사용자 입력 필드의 maxLength 제약을 초과하는지 확인하기 위한 긴 슬로건 텍스트";

export const CLUSTER2_DUMMY_BY_USER: Record<string, Cluster2UserData> = {
  // 1) 윤재윤 — TYPICAL: 자연스러운 중간 값
  윤재윤: {
    photos: CLUSTER2_DUMMY_PHOTOS,
    slogans: CLUSTER2_DUMMY_SLOGANS,
    videos: CLUSTER2_DUMMY_VIDEOS,
    educations: CLUSTER2_DUMMY_EDUCATIONS,
    reviews: CLUSTER2_DUMMY_REVIEWS,
    intro: CLUSTER2_DUMMY_INTRO,
  },

  // 2) 전민경 — VOID: 모든 필드 비어있는 상태
  전민경: {
    photos: {
      mainPhoto: "",
      subPhotos: [null, null, null, null],
    },
    slogans: {
      engName: "",
      slogan1: { option: "", content: "", rating: 0 },
      slogan2: { option: "", content: "", rating: 0 },
      slogan3: { option: "", content: "", rating: 0 },
    },
    videos: {
      videoUrl1: "",
      videoUrl2: "",
      videoUrl3: null,
    },
    educations: [],
    reviews: {
      cluvingReviewLink: "",
      reviewLinks: ["", "", "", "", "", "", "", "", "", ""],
    },
    intro: {
      growthStory: "",
      socialExperience: "",
      careerDirection: "",
      workStyle: "",
      personalStory: "",
    },
  },

  // 3) 안지혜 — OVERFLOW: 최대 글자수 초과, 모든 슬롯 가득
  안지혜: {
    photos: {
      mainPhoto: "/images/0/cluster 2/dummy/sub-photo-2.png",
      subPhotos: ["/images/0/cluster 2/dummy/sub-photo-1.png", "/images/0/cluster 2/dummy/sub-photo-2.png", "/images/0/cluster 2/dummy/sub-photo-3.png", "/images/0/cluster 2/dummy/sub-photo-4.png"],
    },
    slogans: {
      engName: "AHN JIHYE THE OVERFLOW QUEEN OF VERY VERY LONG ENGLISH NAME FOR TESTING",
      slogan1: { option: "Dreamer", content: "사용자 입력 필드의 maxLength 제약 86자 이내 경계선에서 정확히 테스트하는 슬로건 최대 길이 케이스", rating: 10 },
      slogan2: { option: "Pioneer", content: "브랜드 스토리텔링과 데이터 기반 퍼포먼스 마케팅의 절묘한 균형을 추구하며 매일 성장 중인 디지털 마케터", rating: 10 },
      slogan3: { option: "Warrior", content: "고객 여정의 모든 터치포인트에서 의미있는 경험을 만들어가는 퍼포먼스 마케터로 성장하는 긴 여정 중", rating: 10 },
    },
    videos: {
      videoUrl1: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoUrl2: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoUrl3: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    educations: [
      {
        eduLevel: "대학원(박사)",
        school: "서울대학교 일반대학원 컴퓨터공학부 인공지능전공",
        status: "졸업",
        category: "공학계열",
        major1: "컴퓨터공학과 인공지능 머신러닝 전공",
        major2: "데이터사이언스 융합전공",
        major3: "통계학 부전공",
        period: "2020.03 ~ 2024.02",
        startYear: "2020",
        startMonth: "03",
        endYear: "2024",
        endMonth: "02",
        gradeMax: "4.5",
        gradeValue: "4.5",
        description: OVERFLOW_LONG,
        isFinal: true,
      },
      {
        eduLevel: "대학원(석사)",
        school: "한국과학기술원(KAIST) 전산학부",
        status: "졸업",
        category: "공학계열",
        major1: "전산학과 인공지능 전공 매우 긴 학과명 테스트용",
        major2: "수학과 부전공",
        major3: "물리학과 부전공",
        period: "2018.03 ~ 2020.02",
        startYear: "2018",
        startMonth: "03",
        endYear: "2020",
        endMonth: "02",
        gradeMax: "4.3",
        gradeValue: "4.3",
        description: OVERFLOW_LONG,
      },
      {
        eduLevel: "대학교(4년)",
        school: "포항공과대학교(POSTECH) 무은재학부 컴퓨터공학과",
        status: "졸업",
        category: "공학계열",
        major1: "컴퓨터공학과",
        major2: "수학과",
        major3: "물리학과",
        period: "2014.03 ~ 2018.02",
        startYear: "2014",
        startMonth: "03",
        endYear: "2018",
        endMonth: "02",
        gradeMax: "4.5",
        gradeValue: "4.49",
        description: OVERFLOW_LONG,
      },
      {
        eduLevel: "고등학교",
        school: "한국과학영재학교 부설 영재교육원 과학영재교육과정 최우수 졸업생",
        status: "졸업",
        category: "",
        major1: "이과 심화 과정 최우수",
        major2: "수학 올림피아드 트랙",
        major3: "정보 올림피아드 트랙",
        period: "2011.03 ~ 2014.02",
        startYear: "2011",
        startMonth: "03",
        endYear: "2014",
        endMonth: "02",
        gradeMax: "100",
        gradeValue: "99",
        description: OVERFLOW_LONG,
      },
    ],
    reviews: {
      cluvingReviewLink: "https://www.cluving.com/review/jihye-very-long-review-link-with-many-parameters?utm_source=test&utm_medium=overflow&utm_campaign=maxlen",
      reviewLinks: [
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/1",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/2",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/3",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/4",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/5",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/6",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/7",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/8",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/9",
        "https://very-long-domain-name-for-overflow-test.example.com/path/to/resource/with/many/segments/10",
      ],
    },
    intro: {
      growthStory: OVERFLOW_LONG + OVERFLOW_LONG,
      socialExperience: OVERFLOW_LONG + OVERFLOW_LONG,
      careerDirection: OVERFLOW_LONG + OVERFLOW_LONG,
      workStyle: OVERFLOW_LONG + OVERFLOW_LONG,
      personalStory: OVERFLOW_LONG + OVERFLOW_LONG,
    },
  },

  // 4) 곽예원 — PARTIAL: 순차 입력의 첫 1~2개만 채움
  곽예원: {
    photos: {
      mainPhoto: "/images/0/cluster 2/dummy/sub-photo-3.png",
      subPhotos: ["/images/0/cluster 2/dummy/sub-photo-1.png", "/images/0/cluster 2/dummy/sub-photo-2.png", null, null],
    },
    slogans: {
      engName: "KWAK YEWON",
      slogan1: { option: "Dreamer", content: "프로덕트의 본질을 고민하는 기획자", rating: 6 },
      slogan2: { option: "", content: "", rating: 0 },
      slogan3: { option: "", content: "", rating: 0 },
    },
    videos: {
      videoUrl1: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoUrl2: "",
      videoUrl3: null,
    },
    educations: [
      {
        eduLevel: "대학교(4년)",
        school: "연세대학교",
        status: "재학",
        category: "사회계열",
        major1: "경영학과",
        major2: "",
        major3: "",
        period: "2019.03 ~ ",
        startYear: "2019",
        startMonth: "03",
        endYear: "",
        endMonth: "",
        gradeMax: "4.3",
        gradeValue: "3.7",
        description: "",
        isFinal: true,
      },
    ],
    reviews: {
      cluvingReviewLink: "https://www.cluving.com/review/yewon",
      reviewLinks: ["https://brunch.co.kr/@yewon/first", "", "", "", "", "", "", "", "", ""],
    },
    intro: {
      growthStory: "프로덕트 기획자의 길로 들어서게 된 계기에 대한 이야기를 작성했습니다.",
      socialExperience: "",
      careerDirection: "",
      workStyle: "",
      personalStory: "",
    },
  },

  // 5) 김의환 — MINIMAL: 1글자/단일 항목
  김의환: {
    photos: {
      mainPhoto: "/images/0/cluster 2/dummy/sub-photo-4.png",
      subPhotos: [null, null, null, null],
    },
    slogans: {
      engName: "K",
      slogan1: { option: "Dreamer", content: "존", rating: 1 },
      slogan2: { option: "Pioneer", content: "버", rating: 1 },
      slogan3: { option: "Warrior", content: "티", rating: 1 },
    },
    videos: {
      videoUrl1: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoUrl2: "",
      videoUrl3: null,
    },
    educations: [
      {
        eduLevel: "고등학교",
        school: "ㅇ",
        status: "졸업",
        category: "",
        major1: "ㅇ",
        major2: "",
        major3: "",
        period: "2010.03 ~ 2013.02",
        startYear: "2010",
        startMonth: "03",
        endYear: "2013",
        endMonth: "02",
        gradeMax: "",
        gradeValue: "",
        description: "",
        isFinal: true,
      },
    ],
    reviews: {
      cluvingReviewLink: "https://a.co",
      reviewLinks: ["https://b.co", "", "", "", "", "", "", "", "", ""],
    },
    intro: {
      growthStory: "한",
      socialExperience: "글",
      careerDirection: "자",
      workStyle: "씩",
      personalStory: "만",
    },
  },
};

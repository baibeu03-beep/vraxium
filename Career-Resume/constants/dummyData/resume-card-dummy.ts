// constants/dummyData/resume-card-dummy.ts
// TODO: 더미 데이터 — 기획자 확인용, 실서버 노출 안 됨

import { randomCrewProfile } from "@/utils/randomImage";

// 중간 글자수 기준 (1개이므로)
export const DUMMY_USER_PROFILE = {
  name: "윤재윤",
  nameEng: "YUN JAEYUN",
  gender: "남",
  birthDate: "1900.01.01",
  city: "서울시",
  district: "송파구",
  phone: "010-2345-6789", // 마스킹 해제
  email: "encre.jjang@gmail.com",
  school: "한국외국어대학교",
  major: "스페인어과",
  major2: "",
  major3: "",
  enrollPeriod: "2016.02 - ~ing",
  graduationStatus: "재학",
  gpa: "4.3",
  gpaMax: "4.5",
  quote: "가장 어두운 순간에도 앞으로 한 걸음 내딛는 자에게 길이 열린다가장 어두운 순간에도 앞으로 한 걸음 내딛는 자에게 길이 열린다",
  photo: randomCrewProfile(),
};

// 추가 state 더미 — 숫자 자릿수 배분
export const DUMMY_SIDEBAR_EXTRA = {
  completionRate: 100, // 3자리 (최대)
  reliabilityRate: 7, // 1자리 (최소)
  badgeData: {
    stars: 3, // 1자리
    lightnings: 999, // 2자리
    shields: 99999, // 3자리
  },
  practicalInfo: 111, // 1자리
  practicalCompetency: 969, // 2자리
  practicalExperience: 999, // 3자리
  practicalCareer: 261, // 2자리
  crewStatus: "Complete" as const,
};

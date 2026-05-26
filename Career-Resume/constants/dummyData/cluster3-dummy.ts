import { createInitialOutputCardsWithDefault } from './cluster3-output-default';

// 윤재윤 — TYPICAL (자연스러운 중간 값)
export const CLUSTER3_DUMMY_PROFILE = {
  reliabilityRate: 87,
  engName: 'YUN JAEYUN',
  pointsData: { dangam: 25, injeolmi: 12, eoheung: 8 },
  gradeStats: { avgPercentile: 30, grade: 3, gradeLabel: '정 2품' },
  growthPeriodStats: {
    approvedWeeks: 18,
    unapprovedWeeks: 3,
    restWeeks: 2,
    clubBreakWeeks: 1,
    availableWeeks: 24,
    restSeasons: 1,
    approvedSeasons: 3,
  },
};

export const CLUSTER3_DUMMY_ARCHIVES = [
  'https://brunch.co.kr/@sample/marketing-channel',
  'https://www.youtube.com/@sample-channel',
  'https://blog.naver.com/sample-marketing',
  'https://www.instagram.com/sample_marketing/',
  '',
  '',
  '',
  '',
  '',
  '',
];

export const CLUSTER3_DUMMY_ARCHIVE_CHANNELS = [
  'instagram', 'youtube', 'blog', 'tistory', 'twitter',
  'threads', 'tiktok', 'behance', 'etc', 'etc',
];

export const CLUSTER3_DUMMY_OUTPUTS = [
  'https://brunch.co.kr/@sample/top-work-1',
  'https://medium.com/@sample/top-work-2',
  'https://blog.naver.com/sample/top-work-3',
  '',
  '',
];

export const CLUSTER3_DUMMY_OUTPUT_CHANNELS = [
  'threads', 'youtube', 'tiktok', 'youtube', 'tistory',
];

export const CLUSTER3_DUMMY_DETAILS = [
  'https://brunch.co.kr/@sample/detail-1',
  'https://medium.com/@sample/detail-2',
  'https://blog.naver.com/sample/detail-3',
  'https://www.instagram.com/p/sample-detail-4/',
  '',
  '',
  '',
  '',
  '',
  '',
];

export const CLUSTER3_DUMMY_DETAIL_CHANNELS = [
  'youtube', 'twitter', 'youtube', 'threads', 'instagram',
  'instagram', 'instagram', 'instagram', 'youtube', 'threads',
];

// Output Top 5 상세 카드 데이터 — 1번만 초기 데이터, 2~5번은 void
export const CLUSTER3_DUMMY_OUTPUT_CARDS: any[] = createInitialOutputCardsWithDefault();

type Cluster3UserData = {
  profile: typeof CLUSTER3_DUMMY_PROFILE;
  archives: string[];
  archiveChannels: string[];
  outputs: string[];
  outputChannels: string[];
  details: string[];
  detailChannels: string[];
};

const OVERFLOW_LONG_URL = 'https://very-long-overflow-test-domain.example.com/path/segment/with/many/parts/to-test-input-max-length-constraints/and-additional-long-query-params?utm_source=overflow&utm_medium=test';

export const CLUSTER3_DUMMY_BY_USER: Record<string, Cluster3UserData> = {
  // 1) 윤재윤 — TYPICAL: 자연스러운 중간 값
  "윤재윤": {
    profile: CLUSTER3_DUMMY_PROFILE,
    archives: CLUSTER3_DUMMY_ARCHIVES,
    archiveChannels: CLUSTER3_DUMMY_ARCHIVE_CHANNELS,
    outputs: CLUSTER3_DUMMY_OUTPUTS,
    outputChannels: CLUSTER3_DUMMY_OUTPUT_CHANNELS,
    details: CLUSTER3_DUMMY_DETAILS,
    detailChannels: CLUSTER3_DUMMY_DETAIL_CHANNELS,
  },

  // 2) 전민경 — VOID: 모든 필드 0/빈 문자열
  "전민경": {
    profile: {
      reliabilityRate: 0,
      engName: '',
      pointsData: { dangam: 0, injeolmi: 0, eoheung: 0 },
      gradeStats: { avgPercentile: 0, grade: 0, gradeLabel: '' },
      growthPeriodStats: {
        approvedWeeks: 0,
        unapprovedWeeks: 0,
        restWeeks: 0,
        clubBreakWeeks: 0,
        availableWeeks: 0,
        restSeasons: 0,
        approvedSeasons: 0,
      },
    },
    archives: ['', '', '', '', '', '', '', '', '', ''],
    archiveChannels: ['', '', '', '', '', '', '', '', '', ''],
    outputs: ['', '', '', '', ''],
    outputChannels: ['', '', '', '', ''],
    details: ['', '', '', '', '', '', '', '', '', ''],
    detailChannels: ['', '', '', '', '', '', '', '', '', ''],
  },

  // 3) 안지혜 — OVERFLOW: 최대치/긴 URL/모든 슬롯 가득
  "안지혜": {
    profile: {
      reliabilityRate: 100,
      engName: 'AHN JIHYE THE OVERFLOW QUEEN OF VERY VERY LONG ENGLISH NAME FOR TESTING',
      pointsData: { dangam: 9999, injeolmi: 9999, eoheung: 9999 },
      gradeStats: { avgPercentile: 1, grade: 1, gradeLabel: '정 1품 최상위 등급 테스트' },
      growthPeriodStats: {
        approvedWeeks: 999,
        unapprovedWeeks: 999,
        restWeeks: 999,
        clubBreakWeeks: 999,
        availableWeeks: 999,
        restSeasons: 99,
        approvedSeasons: 99,
      },
    },
    archives: [
      OVERFLOW_LONG_URL + '/archive-1',
      OVERFLOW_LONG_URL + '/archive-2',
      OVERFLOW_LONG_URL + '/archive-3',
      OVERFLOW_LONG_URL + '/archive-4',
      OVERFLOW_LONG_URL + '/archive-5',
      OVERFLOW_LONG_URL + '/archive-6',
      OVERFLOW_LONG_URL + '/archive-7',
      OVERFLOW_LONG_URL + '/archive-8',
      OVERFLOW_LONG_URL + '/archive-9',
      OVERFLOW_LONG_URL + '/archive-10',
    ],
    archiveChannels: ['instagram', 'youtube', 'blog', 'tistory', 'twitter', 'threads', 'tiktok', 'behance', 'etc', 'etc'],
    outputs: [
      OVERFLOW_LONG_URL + '/output-1',
      OVERFLOW_LONG_URL + '/output-2',
      OVERFLOW_LONG_URL + '/output-3',
      OVERFLOW_LONG_URL + '/output-4',
      OVERFLOW_LONG_URL + '/output-5',
    ],
    outputChannels: ['youtube', 'youtube', 'youtube', 'youtube', 'youtube'],
    details: [
      OVERFLOW_LONG_URL + '/detail-1',
      OVERFLOW_LONG_URL + '/detail-2',
      OVERFLOW_LONG_URL + '/detail-3',
      OVERFLOW_LONG_URL + '/detail-4',
      OVERFLOW_LONG_URL + '/detail-5',
      OVERFLOW_LONG_URL + '/detail-6',
      OVERFLOW_LONG_URL + '/detail-7',
      OVERFLOW_LONG_URL + '/detail-8',
      OVERFLOW_LONG_URL + '/detail-9',
      OVERFLOW_LONG_URL + '/detail-10',
    ],
    detailChannels: ['instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'instagram'],
  },

  // 4) 곽예원 — PARTIAL: 순차 입력의 첫 1~2개만 채움
  "곽예원": {
    profile: {
      reliabilityRate: 45,
      engName: 'KWAK YEWON',
      pointsData: { dangam: 5, injeolmi: 0, eoheung: 0 },
      gradeStats: { avgPercentile: 60, grade: 5, gradeLabel: '정 3품' },
      growthPeriodStats: {
        approvedWeeks: 2,
        unapprovedWeeks: 0,
        restWeeks: 0,
        clubBreakWeeks: 0,
        availableWeeks: 24,
        restSeasons: 0,
        approvedSeasons: 0,
      },
    },
    archives: [
      'https://brunch.co.kr/@yewon',
      'https://medium.com/@yewon',
      '', '', '', '', '', '', '', '',
    ],
    archiveChannels: ['blog', 'tistory', '', '', '', '', '', '', '', ''],
    outputs: [
      'https://brunch.co.kr/@yewon/case-1',
      '', '', '', '',
    ],
    outputChannels: ['blog', '', '', '', ''],
    details: [
      'https://medium.com/@yewon/research-1',
      'https://medium.com/@yewon/research-2',
      '', '', '', '', '', '', '', '',
    ],
    detailChannels: ['tistory', 'tistory', '', '', '', '', '', '', '', ''],
  },

  // 5) 김의환 — MINIMAL: 1자리/단일 항목
  "김의환": {
    profile: {
      reliabilityRate: 1,
      engName: 'K',
      pointsData: { dangam: 1, injeolmi: 1, eoheung: 1 },
      gradeStats: { avgPercentile: 100, grade: 10, gradeLabel: '정 9품' },
      growthPeriodStats: {
        approvedWeeks: 1,
        unapprovedWeeks: 1,
        restWeeks: 1,
        clubBreakWeeks: 1,
        availableWeeks: 1,
        restSeasons: 1,
        approvedSeasons: 1,
      },
    },
    archives: ['https://a.co', '', '', '', '', '', '', '', '', ''],
    archiveChannels: ['etc', '', '', '', '', '', '', '', '', ''],
    outputs: ['https://b.co', '', '', '', ''],
    outputChannels: ['etc', '', '', '', ''],
    details: ['https://c.co', '', '', '', '', '', '', '', '', ''],
    detailChannels: ['etc', '', '', '', '', '', '', '', '', ''],
  },
};

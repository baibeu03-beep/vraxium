// 5군락 × 100개 평판 키워드 마스터 카탈로그 (단일 source).
// 제품에 고정된 taxonomy이므로 DB가 아닌 코드 상수로 관리.
// 소비처: /api/reputation-keywords, Cluster4Content, Cluster4CardContent.

export type ReputationKeyword = {
  id: string;
  cluster_number: number;
  cluster_name: string;
  cluster_color: string;
  keyword: string;
  sort_order: number;
};

export type ReputationKeywordGroup = {
  id: string;
  color: "blue" | "green" | "yellow" | "orange" | "red";
  emoji: string;
  title: string;
  count: number;
  keywords: string[];
};

type ClusterMeta = {
  cluster_number: 1 | 2 | 3 | 4 | 5;
  cluster_name: string;
  cluster_color: string;
  color_name: ReputationKeywordGroup["color"];
  emoji: string;
};

const CLUSTERS: ClusterMeta[] = [
  { cluster_number: 1, cluster_name: "도구 · 기술 · 시스템 활용 역량", cluster_color: "#3B82F6", color_name: "blue", emoji: "🔵" },
  { cluster_number: 2, cluster_name: "콘텐츠 · 표현 · 메시지 생산 역량", cluster_color: "#22C55E", color_name: "green", emoji: "🟢" },
  { cluster_number: 3, cluster_name: "마케팅 · 확산 · 영향력 설계", cluster_color: "#EAB308", color_name: "yellow", emoji: "🟡" },
  { cluster_number: 4, cluster_name: "사고 · 분석 · 구조화 역량", cluster_color: "#F97316", color_name: "orange", emoji: "🟠" },
  { cluster_number: 5, cluster_name: "태도 · 실행 · 지속성 기반 역량", cluster_color: "#EF4444", color_name: "red", emoji: "🔴" },
];

const KEYWORDS_BY_CLUSTER: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  1: [
    "노션 유망주", "노션 마스터",
    "인스타 유망주", "인스타 마스터",
    "유튜브 유망주", "유튜브 마스터",
    "AI 유망주", "AI 마스터",
    "블로그 유망주", "블로그 마스터",
    "미드저니 유망주", "미드저니 마스터",
    "깃업 유망주", "깃업 마스터",
    "노코드 유망주", "노코드 마스터",
    "옵시디언 유망주", "옵시디언 마스터",
    "파워포인트",
    "엑셀 유망주", "엑셀 마스터",
    "카카오 생태계", "네이버 생태계", "구글 생태계",
    "퍼블리싱",
    "UI / UX 기획",
    "웹 develop", "앱 develop",
    "서버 관리",
    "데이터 처리", "데이터 분석", "데이터 해석",
    "AI 프롬프트",
    "시스템 구축력",
    "도구 사용력", "기술 습득력",
  ],
  2: [
    "콘텐츠", "카드 콘텐츠", "텍스트 콘텐츠", "스토리텔링",
    "동영상 숏폼", "동영상 롱폼", "릴스 특화", "쇼츠 특화",
    "캐치프레이즈", "슬로건", "표현력", "언어 능력",
    "설득력", "상상력", "유머와 재미", "창의성",
  ],
  3: [
    "퍼포먼스", "브랜딩 마케팅", "바이럴 마케팅", "커뮤니티",
    "연관 검색어", "구글 트렌드", "정보력", "사회성",
    "소통력", "공감력",
  ],
  4: [
    "인지력", "관찰력", "이해력", "논리력",
    "상황 추론력", "문제 정의력", "연구력", "업무 분석력",
    "업무 기획력", "계획력", "구조화", "도식화",
    "범위화", "항목화", "자료화", "변칙성",
  ],
  5: [
    "지속성", "기민성", "신뢰성", "성장성", "유연성", "안정성",
    "위기 대응성", "학습력", "지도력", "소속감", "적극성", "자신감",
    "헌신성", "행동력", "회복력", "몰입력", "잠재력",
    "업무 진행력", "업무 관리력", "수용력", "지구력", "강인한 체력",
  ],
};

const buildReputationKeywords = (): ReputationKeyword[] => {
  const out: ReputationKeyword[] = [];
  let sortOrder = 0;
  for (const meta of CLUSTERS) {
    for (const keyword of KEYWORDS_BY_CLUSTER[meta.cluster_number]) {
      sortOrder += 1;
      out.push({
        id: `rk-${sortOrder}`,
        cluster_number: meta.cluster_number,
        cluster_name: meta.cluster_name,
        cluster_color: meta.cluster_color,
        keyword,
        sort_order: sortOrder,
      });
    }
  }
  return out;
};

const buildReputationKeywordGroups = (): ReputationKeywordGroup[] =>
  CLUSTERS.map((meta) => {
    const keywords = KEYWORDS_BY_CLUSTER[meta.cluster_number];
    return {
      id: `group${meta.cluster_number}`,
      color: meta.color_name,
      emoji: meta.emoji,
      title: meta.cluster_name,
      count: keywords.length,
      keywords,
    };
  });

export const REPUTATION_KEYWORDS: ReputationKeyword[] = buildReputationKeywords();
export const REPUTATION_KEYWORD_GROUPS: ReputationKeywordGroup[] = buildReputationKeywordGroups();

export function getReputationKeywords(): ReputationKeyword[] {
  return REPUTATION_KEYWORDS;
}

export function getReputationKeywordGroups(): ReputationKeywordGroup[] {
  return REPUTATION_KEYWORD_GROUPS;
}

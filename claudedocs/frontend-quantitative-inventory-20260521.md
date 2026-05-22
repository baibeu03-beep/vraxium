# 프론트 정량값 후보 인벤토리 — 통합본

> 작성일: 2026-05-21
> 작성 근거: Career-Resume Next.js 프로젝트 프론트 코드 한정 조사
> 작성 원칙:
> - 백엔드(`app/(host)/api/*`, `app/api/*`, `backend/`) 미열람
> - 계산 공식 추정·단정 금지 → 공식 의미는 모두 **결정 필요**
> - 4분류: 확정 정량값 / 정량값 후보 / 단순 표시값 / 계산 공식 확인 필요
> - 본 문서는 권한 매트릭스와 별도의 **계산값 매트릭스** 작성을 위한 1차 인벤토리

---

## 목차
- [0. Admin Dashboard](#0-admin-dashboard)
- [1. Resume Card](#1-resume-card)
- [2. Cluster2](#2-cluster2)
- [3. Cluster3](#3-cluster3)
- [4. Cluster4](#4-cluster4)
- [5. 화면 간 공통 정합성 — 결정 필요 항목](#5-화면-간-공통-정합성--결정-필요-항목)
- [6. 사용자 후보 키워드 ↔ 코드 실재 여부](#6-사용자-후보-키워드--코드-실재-여부)
- [7. 다음 단계: 백엔드·기획과 확정해야 할 것](#7-다음-단계-백엔드기획과-확정해야-할-것)

---

## 0. Admin Dashboard

- **프론트 화면 자체 없음.** `app/(host)/...` 라우트에도, `components/` 에도 admin/dashboard 컴포넌트 없음.
- `lib/admin.ts` 는 `ADMIN_EMAILS` + `isAdminEmail()` 헬퍼(백엔드 가드용)일 뿐, 페이지 아님.
- `resumeCardSettings` 안의 "admin" 키워드는 **설정값 개념**(user > org > site 3-tier merge)이지 화면이 아님.
- **결정 필요**: "Admin Dashboard"를 어떤 화면으로 정의할지(사용자 관리 / 콘텐츠 승인 / 통계 / `resumeCardSettings` 편집기 등). 정의 전까지 인벤토리 대상 없음.

---

## 1. Resume Card

대상 파일:
- `components/home-career/Sidebar.tsx` (메인)
- `components/home-two/Sidebar.tsx` — `/api/profile/summary` 사용, 필드 동일
- `components/home-three/Sidebar.tsx` — 전부 하드코딩 더미

### 1-1. 확정 정량값

| UI 라벨 | 위치 | 식별자 | 가공 흔적 | 출처 흔적 |
|---|---|---|---|---|
| 별(Star) 개수 | Sidebar.tsx:181, 2400-2402 | `badgeData.stars` | 없음 | fetch `/api/profile` → `result.badges.stars` |
| 방패(Shield) 개수 | Sidebar.tsx:182, 2404-2406 | `badgeData.shields` | 없음 | fetch `/api/profile` → `result.badges.shields` |
| 시즌별 승인/총 주차 ("X주 / Y주") | Sidebar.tsx:2460-2490 | `history.approved_weeks` / `history.total_weeks` | 없음(문자열 포맷만) | `result.seasonHistories[]` |
| 메달 내부 주차 번호 | Sidebar.tsx:2427 | `approvedWeeksCount` 또는 admin override `resumeCardSettings.medalWeekOverride` | 없음(둘 중 택1) | `result.growthPeriodStats.approvedWeeks` 또는 admin 설정 |

공식 의미: **모두 결정 필요** (이 값이 무엇을 집계한 카운트인지 백엔드 확인 필요).

### 1-2. 정량값 후보

| UI 라벨 | 위치 | 식별자 | 가공 흔적 | 출처 흔적 |
|---|---|---|---|---|
| 실무 정보 습득 (회) | Sidebar.tsx:171, 2578-2585 | `practicalInfo` | 표시값에 `Math.floor` 카운트업 애니메이션 | `result.practicalCounts.info` |
| 실무 역량 성장 (unit) | Sidebar.tsx:169, 2594-2601 | `practicalCompetency` | 동상 | `result.practicalCounts.competency` |
| 실무 경험 축적 (건) | Sidebar.tsx:170, 2586-2593 | `practicalExperience` | 동상 | `result.practicalCounts.experience` |
| 실무 경력 누적 (proj) | Sidebar.tsx:172, 2602-2609 | `practicalCareer` | 동상 | `result.practicalCounts.career` |

공식 의미: **결정 필요** (4종이 같은 단위인지, 어떤 활동 집계인지 미확정).

### 1-3. 단순 표시값

- 단위 라벨: `%`, `unit`, `회`, `건`, `proj`, `/4.5`
- 배지 아이콘(`icon-graphic10/13`, `icon-shield`) — 정량값 아님

### 1-4. 계산 공식 확인 필요

| UI 라벨 | 위치 | 식별자 | 보이는 연산 |
|---|---|---|---|
| 일정 신뢰도 프로그레스바 | Sidebar.tsx:165, 2374-2379 | `reliabilityRate` | `width: "${reliabilityRate}%"` — 값 범위(0-1 vs 0-100) 미확정 |
| 활동 완료율 프로그레스바 | Sidebar.tsx:167, 2388-2393 | `completionRate` | `width: "${completionRate}%"` — 동일 |
| 번개(Lightning) 표시값 | Sidebar.tsx:183, 1752, 2408-2410 | `badgeData.lightnings` | `Math.abs(badgeData.lightnings || 0)` — DB가 음수로 들어오는지 미확정 |
| 카운트업 애니메이션 | Sidebar.tsx:1700 | (전 스탯 공통) | `Math.floor(current)` — 시각 효과용. 저장값 영향 없음 |

공식 의미: **전부 결정 필요**.

---

## 2. Cluster2

대상 파일: `components/cluster-2/Cluster2Content.tsx`

> Cluster2는 **점수/랭킹/등급 같은 누적 지표가 본질적으로 없음.** 슬로건, 학력, 자기소개서, 사진, 비디오, Club Review 위주.

### 2-1. 확정 정량값

| UI 라벨 | 위치 | 식별자 | 출처 |
|---|---|---|---|
| 슬로건 별점 (rating, 1~10) | Cluster2Content.tsx:2250-2286, 2322-2358 | `sloganData.slogan2.rating`, `slogan3.rating` | `/api/slogans` |
| 학교 생활 textarea 최대 길이 | Cluster2Content.tsx:4631 | `maxLength={200}` | 하드코딩 |
| 슬로건 textarea 최대 길이 | Cluster2Content.tsx:3085/3195/3305 | `maxLength={86}` | 하드코딩 |
| 자기소개서 textarea 최대 길이 | Cluster2Content.tsx:3622 | `maxLength={1000}` | 하드코딩 |
| 학력 카드 최대 개수 | Cluster2Content.tsx:4640 | `editingEduData.length < 10` | 하드코딩 |
| Section 1 사진 슬롯 수 | Cluster2Content.tsx:195, 203 | 배열 길이 = 6 | 하드코딩 |
| 비디오 페이지당 슬롯 수 | Cluster2Content.tsx:796 | `VIDEOS_PER_PAGE = 3` | 하드코딩 |
| 학력 입학년도 범위 (현재년도 ~ -30) | Cluster2Content.tsx:4244 | 동적 생성 | 코드 계산 |
| 학력 졸업년도 범위 (2030 ~ 2000) | Cluster2Content.tsx:4335 | 동적 생성 | 코드 계산 |
| 클라이언트 이미지 압축 임계값 | Cluster2Content.tsx:295, 350 | `maxSizeMB = 2` | 하드코딩 |
| 클라이언트 이미지 최대 dimension | Cluster2Content.tsx:303 | `maxDimension = 1200` | 하드코딩 |

### 2-2. 정량값 후보

| UI 라벨 | 위치 | 식별자 | 비고 |
|---|---|---|---|
| Club Review 슬롯 ↔ 주차 매핑 | Cluster2Content.tsx:1432-1433, 2647, 2667 | `REVIEW_LINK_WEEK_INDICES = [30,3,6,9,12,15,18,21,24,27]` | "활동 주차 수" 개념과 동일한지 결정 필요 |

### 2-3. 단순 표시값 (전형적 디자인 더미)

| UI 라벨 | 위치 | 식별자 | 비고 |
|---|---|---|---|
| "OH, MY DREAM" 99.9% | Cluster2Content.tsx:2061 | 하드코딩 `"99.9%"` | 백엔드 연동 없음, 플레이스홀더 |
| "Cluving Joined" 999 | Cluster2Content.tsx:2032-2035 | 하드코딩 `"999"` | 더미 |
| 비디오 카드 "9.9k Viewers" | Cluster2Content.tsx:768, 776, 785 | 하드코딩 | 더미 |
| 슬로건 태그 옵션 8종 / 학생 신분 / 학기·계열 옵션 | `lib/cluster2SloganOptions.ts`, Cluster2Content.tsx:4104/4150/4268/4359/4587 | 옵션 배열 | 입력 선택지 — 정량 아님 |
| 진행 상태 "~ing" 마크 | Cluster2Content.tsx:2464-2472 | 텍스트 마크업 | |

### 2-4. 계산 공식 확인 필요

| UI 라벨 | 위치 | 보이는 연산 |
|---|---|---|
| 별점 5단계 렌더링 (rating 0~10 → 5별) | Cluster2Content.tsx:2250-2283, 2322-2357 | `fullValue = starIndex*2`, `halfValue = starIndex*2-1` |
| GPA 최대값 클램프 | Cluster2Content.tsx:4421-4427 | `parseFloat(edu.gradeMax)` 와 비교 후 강제 치환 |
| 학력 기간 문자열 생성 | Cluster2Content.tsx:4796-4809 | `startYear.startMonth - (isOngoing ? "~ing" : ...)`, 상태("재학/졸예/휴학") 분기 |
| 카드 내용 truncate | Cluster2Content.tsx:104-113, 2487 | `truncateByBytes(card.content, 80)` — 한글 2바이트 가정 |
| 학력 카드 정렬 | Cluster2Content.tsx:2417-2423 | `parseInt(startYear)*100 + parseInt(startMonth)` 내림차순, `isFinal` 우선 |
| 학력 페이지네이션 동적 페이지 수 | Cluster2Content.tsx:992-1020 | `cardStep=324`, `Math.ceil(overflow/cardStep)+1` |
| 리뷰 권한 메시지 분기 | Cluster2Content.tsx:1610-1616 | `canEditClubReview` & `expiresAt` 분기 |

공식 의미: **전부 결정 필요**. 특히 별점의 0~10 vs 5단계 매핑은 Cluster3/4와 다른 비율(`/2`, `*3`)이 적용되는 부분이 있어 화면 간 일관성 결정 필요.

### 2-5. 코드에 없음 (요청 후보 대조)

"활동 완료율 / 누적 점수 / 일정 신뢰도 / 평판 점수 / 등급 / 시즌 수 / 승인 주차 수 / 성장률 / 랭킹" — **Cluster2 코드에는 등장하지 않음.**

---

## 3. Cluster3

대상 파일: `components/cluster-3/Cluster3Content.tsx`

> 원 조사에서 "계산 공식 확인 필요 0건"으로 보고됐으나, 별점·카운트업·순차 잠금에 가공 흔적이 있어 재분류 적용.

### 3-1. 확정 정량값 (받은 그대로 표시, 카운트업 외 가공 없음)

| 그룹 | UI 라벨 | 위치 | 식별자 | 출처 |
|---|---|---|---|---|
| 성장 정보 | 성장 진행 상태 | Cluster3Content.tsx:2181 | `growthInfo.growthStatus` | `/api/profile` |
| | 성장 시작/종료일 | Cluster3Content.tsx:2187, 2193 | `growthInfo.startDate/endDate` | `/api/profile` (포맷팅만) |
| 주차 집계 | 성공 주차 | :2217 | `growthPeriodStats.approvedWeeks` | `/api/profile` |
| | 실패 주차 | :2227 | `growthPeriodStats.unapprovedWeeks` | `/api/profile` |
| | 개인 휴식 주차 | :2236 | `growthPeriodStats.restWeeks` | `/api/profile` |
| | 공식 휴식 주차 | :2246-2249 | `growthPeriodStats.clubBreakWeeks` | `/api/profile` |
| | 성장 가능 주차 | :2256 | `growthPeriodStats.availableWeeks` | `/api/profile` |
| | 휴식/성공 시즌 | :2265, 2274 | `growthPeriodStats.restSeasons/approvedSeasons` | `/api/profile` |
| 품계 | 품계 등급(숫자) | :2405 | `gradeStats.grade` (1~10) | `/api/profile` |
| | 품계 라벨 | :2405 | `gradeStats.gradeLabel` | `/api/profile` |
| 채널 카드(16) | 채널명/플랫폼/관리방식/시작일/링크/상태/평점/이미지/insight/experience/metrics | :2492~2970 | `channelCards[].*` | `/api/portfolio-channel-cards` |
| Output(5)·Detail(10) | mainTitle/subTitle/roleDescription/roles/tools/period/이미지/캡션/metrics/report/insight/links | :1666~1758, 2688~2725 | `outputCards[].*`, `detailCards[].*` | `/api/portfolio-top-cards` |

공식 의미: **전부 결정 필요** (집계 기준, 시즌-주차 환산 룰, gradeLabel 매핑표 등).

### 3-2. 정량값 후보

| UI 라벨 | 위치 | 식별자 | 비고 |
|---|---|---|---|
| Output 기여도(contribution) | :944, 1672 | `outputCards[].contribution` (number) | 타입 정의만 있고 표시 위치/범위 미확인 |
| 단감 (별 아이콘) | :2304, 2323 | `pointsData.dangam` ← `badges.stars` | Resume Card 의 `stars`와 같은 백엔드 키일 가능성, 화면 라벨만 다름 |
| 인절미 (방패 아이콘) | :2305 | `pointsData.injeolmi` ← `badges.shields` | 동상 |
| 일정 신뢰도 (반원 차트) | :309-311, 2160 | `reliabilityRate` | 0-100/0-1 구분 미확정 |
| 상위 퍼센트 | :2366, 849 | `gradeStats.avgPercentile` | 의미(낮을수록 상위?) 결정 필요 |

### 3-3. 단순 표시값

- 슬라이드 카드 더미 표기 "09h 99m 99s / 99 Like" (:2636)
- 채널/Output/Detail 카드 미완성 opacity(0.4 vs 1.0) — UI 잠금 표현
- 텍스트 길이 제약 (`insight/experience/metrics` 각 250자) — 입력 스펙

### 3-4. 계산 공식 확인 필요

| UI 라벨 | 위치 | 보이는 연산 |
|---|---|---|
| 일정 신뢰도 카운트업 | :309-311 | `easeOut` 애니메이션 (1500ms) — 표시값을 0→target 으로 점진 증가 |
| 상위 퍼센트 카운트업 | :849 | 800ms easeOut |
| 어흥 표시값 | :2306, 2323 | `Math.abs(badgeData.lightnings)` |
| 채널 카드 별점(StarRating) | :2524, 2836-2845 | rating(1~10) → 5단계 별 렌더 (`rating/10` 텍스트 동반) |
| 채널 카드 순차 잠금 | :2483, 2985 | `isCardComplete()` 8개 필수 필드 체크 + `unlockedCardCount` 누적 |
| Output/Detail 순차 잠금 | :2606-2620, 2689-2691 | `isVoidCard`, `isOutputComplete`, `unlockedOutputCount/unlockedDetailCount` |

공식 의미: **전부 결정 필요**.

---

## 4. Cluster4

대상 파일:
- `components/cluster-4/Cluster4Content.tsx`
- `components/cluster-4-1/Cluster41Content.tsx`
- `components/cluster-4-card/Cluster4CardContent.tsx`
- `components/cluster-4-card/DetailLogModal.tsx`
- `constants/dummyData/cluster4-card-dummy.ts`, `cluster4-season-dummy.ts`

### 4-1. 확정 정량값

| 그룹 | UI 라벨 | 위치 | 식별자 |
|---|---|---|---|
| 시즌 기본 | 시즌 년도 | Cluster4Content.tsx:165 | `year` |
| | 시즌 이름 | :166 | `season` |
| | 승인된 주차 / 총 주차 | :171, 172 | `approvedWeeks`, `totalWeeks` |
| | 시즌 별점(rating, 0~10) | :181 | `rating` |
| 점수 | 단감/인절미/어흥 | :180 | `stats.dangam/injeolmi/eoheung` |
| Progress.* total/completed | 정보·역량·경험·경력 총합·완료 카운트 | :196-199 | `progress.{info,competency,experience,career}.{total,completed}` |
| 주차 리뷰 | 리뷰 별점(0~10) | Cluster4CardContent.tsx:6040, 6060 | `weeklyReviewFromDB.rating` |
| 평판 입력 | 별점 선택 범위(1~10) | Cluster4CardContent.tsx:8275 | `reputationEditData.rating` |

공식 의미: **결정 필요** (특히 stats 3종은 Resume Card `badges.*`, Cluster3 `pointsData.*` 와 같은 출처인지 결정 필요).

### 4-2. 정량값 후보 (출처/가공 불명확)

| UI 라벨 | 위치 | 식별자 |
|---|---|---|
| 주차 활용률 weekUsage | Cluster4Content.tsx:185 | `circles.weekUsage` (주석에 "8/30" 메모) |
| 일정 신뢰도 scheduleReliability | :186 | `circles.scheduleReliability` (주석 "125/999") |
| 시즌 성장률 seasonGrowth | :187 | `circles.seasonGrowth` (주석 "5/5") |
| circles 보조 분자/분모 | :188-193 | `approvedWeeks/totalOperatingWeeks/totalWeeksReliability/reliableWeeks/completedActivities/totalActivities` |
| GrowthPeriodStats 7종 | Cluster41Content.tsx:218-224 | `approvedWeeks/unapprovedWeeks/restWeeks/clubBreakWeeks/availableWeeks/availableSeasons/restSeasons` (Cluster3 `growthPeriodStats`와 동명 — 같은 소스인지 결정 필요) |
| 주차별 points 3종 | Cluster41Content.tsx:61-91 | `points.star/shield/lightning` (Cluster3 `pointsData`, Resume `badges` 와의 관계 결정 필요) |
| 주차별 growthRate.{rate,count,total} | Cluster41Content.tsx:63-93 | 분자·분모 의미 미정 |
| 주차별 4가지 활동 완료율 (info/competency/experience/career Rate) | Cluster41Content.tsx:64-97 | 동상 |
| 주차별 reputationCount / fmScore / colleagueCount | Cluster41Content.tsx:68-98 | fmScore 계산식 결정 필요 |
| 경력 카드 grade_points | cluster4-card-dummy.ts:184/211/265 | 더미값, 의미·범위 결정 필요 |

### 4-3. 단순 표시값

- `SEASON_REPUTATION_SLOT_COUNT = 7` (Cluster4Content.tsx:552) — UI 슬롯 수
- 더미 활동 개수: 정보 9 / 역량 4 / 경험 4 / 경력 6 (cluster4-card-dummy.ts:102~329) — 입력 스펙
- 시즌 리뷰 텍스트 `REVIEW_COMMENT_DEFAULT` — 플레이스홀더

### 4-4. 계산 공식 확인 필요

| UI 라벨 | 위치 | 보이는 연산 |
|---|---|---|
| progress.{info/competency/experience/career}.rate | Cluster4Content.tsx:196-199 | `total`/`completed` 와 별도 `rate` 필드 존재 — 어디서 계산되는지(서버/프론트) 미확정 |
| 평판 별점 표시 | Cluster4CardContent.tsx:4560-4561 | `rep.rating / 2` |
| 명성도 FM 점수 | Cluster4CardContent.tsx:3393 | `seasonReputations.reduce((sum, r) => sum + (r?.rating ?? 0) * 3, 0)` |
| 경험 카드 라인 평점 | Cluster4CardContent.tsx:9517, 9537 | `ratingValue / 2` 표시 + 저장은 5점 만점 추정 흔적 |
| renderStars 별 분할 | Cluster4CardContent.tsx:5815-5825 | `Math.floor(rating)`, `rating % 1 >= 0.5` |
| 활동 평점 | Cluster4CardContent.tsx:1385, 5536-5537 | `Math.max(0, (p.points || 0) - baseStar)` — `baseStar` 의미 미정 |
| 원형 차트 3종(weekUsage/scheduleReliability/seasonGrowth) | Cluster4Content.tsx:185-193 | 코드 흔적상 분자/분모는 별도 필드로 들어오나 표시값(`circles.weekUsage` 등)이 분자 자체인지 비율인지 모호 |

공식 의미: **전부 결정 필요**. 특히 `/2`, `*3`, `-baseStar` 는 화면별로 다른 스케일이 섞여 있어 통일 정책 결정 필요.

---

## 5. 화면 간 공통 정합성 — 결정 필요 항목

아래는 **여러 화면이 같은 값처럼 보이는데 분류/스케일이 달라** 백엔드/기획 확정이 필요한 지점.

| 개념 | Resume Card | Cluster3 | Cluster4 | 결정 필요 |
|---|---|---|---|---|
| 별/단감/star | `badges.stars` | `pointsData.dangam`(←`badges.stars`) | `stats.dangam`, `points.star` | 같은 값인지, 누적·시즌·주차 스코프별로 다른 값인지 |
| 방패/인절미/shield | `badges.shields` | `pointsData.injeolmi`(←`badges.shields`) | `stats.injeolmi`, `points.shield` | 동상 |
| 번개/어흥/lightning | `badges.lightnings` (Math.abs) | `pointsData.eoheung` (Math.abs) | `stats.eoheung`, `points.lightning` | 음수 저장 여부, abs 처리 통일 정책 |
| 일정 신뢰도 | `reliabilityRate` width% | `reliabilityRate` 반원 차트 | `circles.scheduleReliability`, 주차별 동일 개념 | 0-100 vs 0-1 범위, 분자·분모 정의 |
| 활동 완료율 | `completionRate` width% | (없음) | `progress.*.rate` 4종 + 주차별 4종 | 같은 개념인지, 4 카테고리 합산 룰 |
| 승인 주차 수 | `seasonHistories[].approved_weeks`, 메달 `approvedWeeksCount` | `growthPeriodStats.approvedWeeks` | `season.approvedWeeks`, `GrowthPeriodStats.approvedWeeks` | 시즌별/누적 구분, "메달 내부 숫자"와의 동치 여부 |
| 시즌 별점 | (없음) | (별도 평점 없음) | `season.rating`(0~10), 평판 `rating/2`, 경험 `rating*2` | 0~10 / 0~5 / 0~10 스케일 혼재 — 단일 스케일 결정 |
| 등급 / 품계 | (없음) | `gradeStats.grade` 1~10 + label | (없음) | "등급" 요청 개념과 동치 여부 |
| 상위 % | (없음) | `gradeStats.avgPercentile` | (없음) | 정의·표시 의미 |
| 성장률 | (없음) | (없음) | `circles.seasonGrowth`, 주차별 `growthRate.rate` | 분자·분모 |
| FM / 평판 점수 | (없음) | (없음) | 주차별 `fmScore`, 시즌 `reduce(rating*3)` | `*3` 의미, 시즌·주차 합산 룰 |
| 랭킹 | (없음) | (없음) | (없음) | **프론트 코드에 아예 없음** — 신규 화면 정의 필요 |

---

## 6. 사용자 후보 키워드 ↔ 코드 실재 여부

| 후보 | Resume Card | Cluster2 | Cluster3 | Cluster4 |
|---|---|---|---|---|
| 일정 신뢰도 | O (계산 공식 확인 필요) | X | O (정량값 후보) | O (정량값 후보, 원형차트) |
| 활동 완료율 | O (계산 공식 확인 필요) | X | X | O (progress.*.rate / 주차별) |
| 누적 점수 | △ (단/방/번개) | X (99.9% 더미만) | △ (pointsData) | △ (stats) |
| 성장률 | X | X | X | O (정량값 후보) |
| 승인 주차 수 | O | X | O | O |
| 활동 주차 수 | X | △ (Club Review 슬롯 [3..27]) | X | X |
| 시즌 수 | O (`seasonHistories[]` 개수) | X | O (`restSeasons/approvedSeasons`) | △ (시즌 ID만) |
| 평판 점수 | X | X | X | O (FM / `rating*3`) |
| 등급 | X | X | O (품계 1~10) | X |
| 랭킹 | X | X | X | X |

범례: O = 명확히 존재 / △ = 유사 개념 존재(동치 미확정) / X = 코드에 없음

---

## 7. 다음 단계: 백엔드·기획과 확정해야 할 것

1. **공통 점수 3종**(별/방패/번개 · 단감/인절미/어흥 · star/shield/lightning) 의 스코프(누적/시즌/주차) 와 부호 처리(특히 lightning)
2. **신뢰도·완료율의 값 범위**(0-1 vs 0-100) 와 분자/분모 정의
3. **별점 스케일 통일**: 슬로건(0~10) / 채널(1~10/5단계) / 시즌(0~10) / 평판(`/2`) / 경험(`*2`) 혼재
4. **승인 주차 수 / 시즌 수**의 시즌별 vs 누적 구분 및 "메달 내부 숫자"와의 동치 여부
5. **평판 FM**: `rating*3` 의 근거, 주차 단위 vs 시즌 단위 합산
6. **Cluster4 `progress.*.rate`** : 백엔드 계산인지 프론트가 `completed/total*100` 으로 다시 만드는지
7. **Cluster3 `contribution`** : 표시 위치·범위·의미 미확인
8. **랭킹 / Admin Dashboard** : 코드에 아예 없음 → 화면 정의가 선행되어야 함

---

> 본 인벤토리는 **프론트 코드 흔적만**으로 작성되었습니다.
> 공식의 "의미" 확정은 모두 백엔드 응답 스펙 + 기획서 매칭 후에 결정 필요합니다.

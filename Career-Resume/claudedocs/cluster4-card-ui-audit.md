# Cluster 4 Card UI 감사 보고서

> **작성일**: 2026-05-27  
> **목적**: 프론트 UI 구조 파악 → 데이터 계약 수립을 위한 기초 자료  
> **대상**: `/cluster-4-card` 페이지 및 하위 카드/모달 UI  
> **코드 수정 없음** — 조사 및 보고만 진행

---

## 1. 파일 구조

### 페이지 파일

| 파일 경로 | 역할 |
|---|---|
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card/page.tsx` | 메인 진입점, 현재/최근 주차로 리디렉트 |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card/[weekId]/page.tsx` | 동적 주차별 카드 렌더링 |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-ec/page.tsx` | Encre(EC) 변형 진입점 |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-ec/[weekId]/page.tsx` | EC 동적 주차별 |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/page.tsx` | Phalanx(PX) 변형 진입점 |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/[weekId]/page.tsx` | PX 동적 주차별 |

### 컴포넌트 파일

| 파일 경로 | 역할 |
|---|---|
| `components/cluster-4-card/Cluster4CardContent.tsx` | **메인 컴포넌트** (582KB) — 4개 허브 카드 + 모든 모달 포함 |
| `components/cluster-4-card/DetailLogModal.tsx` | Detail Log 모달 (포탈 렌더링) |
| `components/shared/HelpModalBody.tsx` | 도움말 모달 공용 바디 |

### 타입/DTO 정의

| 파일 경로 | 역할 |
|---|---|
| `lib/cluster4-types.ts` | SEASON_MAP, GROWTH_STATUS_LABEL, GrowthStatusKey |
| `lib/cluster4-weekly-cards.ts` | `WeeklyCardDto` 인터페이스 + `buildWeeklyCards()` 서버 빌더 |
| `lib/cluster4-weekly-growth-service.ts` | `WeeklyGrowthResponseDto`, `GrowthStartWeekDto` + `getWeeklyGrowthData()` |
| `lib/cluster4EditWindow.ts` | `CLUSTER4_EDIT_RESOURCE_KEYS` 상수 (작성기간 권한 키) |

### API 라우트

| 파일 경로 | 역할 |
|---|---|
| `app/(host)/api/cluster4/weekly-growth/route.ts` | 사용자용 주차 성장 데이터 GET |
| `app/(host)/api/admin/crews/[legacy_user_id]/cluster4/weekly-growth/route.ts` | 어드민용 주차 성장 데이터 GET |
| `app/(host)/api/cluster-4-ranking/route.ts` | 랭킹 데이터 |

### 더미 데이터

| 파일 경로 | 역할 |
|---|---|
| `constants/dummyData/cluster4-card-dummy.ts` | 주차별 카드 더미 데이터 (5주차분) |
| `constants/dummyData/cluster4-weekly-dummy.ts` | 주차 리스트 + 주차별 메타 더미 |
| `constants/dummyData/cluster4-season-dummy.ts` | 시즌 페이지 더미 |

### 유틸리티

| 파일 경로 | 역할 |
|---|---|
| `lib/cluster-route.ts` | org suffix 감지 (PX/EC), 테마 클래스, 라우트 헬퍼 |
| `lib/editWindowMessages.ts` | 작성기간 잠금 메시지 상수 |
| `lib/reputation-keywords.ts` | 평판 키워드 그룹 |

### 스타일

| 파일 경로 | 역할 |
|---|---|
| `assets/scss/components/_cluster4-week.scss` (422KB) | 주차 카드 메인 스타일 |
| `assets/scss/components/_cluster4-card-px.scss` (45KB) | PX 테마 오버라이드 |
| `assets/scss/components/_cluster4-card-encre.scss` (32KB) | EC 테마 오버라이드 |
| `assets/scss/components/cluster4-week-responsive.scss` | 반응형 |

---

## 2. 화면에 표시되는 모든 데이터 항목

### 2-1. 메인 페이지 헤더 영역

| 화면 위치 | 필드명 | 타입 | 현재 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 상단 헤더 | weekNumber | number | DB weeks 테이블 | O | X |
| 상단 헤더 | seasonYear | number | DB season_definitions | O | X |
| 상단 헤더 | seasonName | string | DB season_definitions.season_type | O | X |
| 상단 헤더 | startDate / endDate | string | DB weeks | O | X |
| 상단 헤더 | growthStatus | string | DB user_week_statuses.status | O | X |
| 상단 헤더 | teamName | string \| null | DB teams (user_team_parts 기반) | O | X |
| 상단 헤더 | partName | string \| null | DB parts (user_team_parts 기반) | O | X |
| 상단 헤더 | roleLabel | string \| null | DB user_role_history → ROLE_LABELS 매핑 | O | X |
| 상단 헤더 | points (star/shield/lightning) | object | DB user_weekly_points | O | X |
| 상단 헤더 | cumulativeInjeolmi | number | DB 누적 계산 | O | X |
| 상단 헤더 | cumulativeApprovedWeeks | number | 누적 승인 주차 계산 | O | X |
| 주차 확인 | weekStatus | "pending" \| "confirming" \| "confirmed" | 프론트 상태머신 | X | O (버튼) |

### 2-2. 실무 정보 (Work Info) 허브 — 최대 9개 카드

| 화면 위치 | 필드명 | 타입 | 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 카드 표면 | category | string | activity_types.name (config 매핑) | O | X |
| 카드 표면 | icon | string | 정적 이미지 파일 (config 매핑) | O | X |
| 카드 표면 | tagColor | string | config 매핑 | O | X |
| 카드 표면 | title (Main Title) | string | **weekly_activities.title** | O | X |
| 카드 표면 | enhancementStatus | EnhancementStatus | 계산값 (getEnhancementStatus) | O | X |
| 카드 표면 | statusIcon | string | enhancementStatus → 이미지 매핑 | O | X |
| 모달 내부 | subTitle (Sub Title) | string | **user_activity_details.sub_title** | X | **O** |
| 모달 내부 | growthPoint (Growth Point) | string | **user_activity_details.growth_point** | X | **O** |
| 모달 내부 | outputLinks (Output Link) | array | **운영진: weekly_activities.output_links + 사용자: user_activity_details.output_links** 병합 | 운영자분 O | **사용자분 O** |
| 모달 내부 | images (Output Image) | (string\|null)[] | **운영진: weekly_activities.output_images + 사용자: user_activity_details.image_urls** 병합 | 운영자분 O | **사용자분 O** |
| 모달 내부 | imageCaptions | string[] | **user_activity_details.image_captions** | X | **O** |

### 2-3. 실무 역량 (Work Ability) 허브 — 단일 표시 카드 (내부 4개 중 1개 선택)

| 화면 위치 | 필드명 | 타입 | 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 카드 표면 | lineCode | string | activity_types.line_code | O | X |
| 카드 표면 | lineName / badge | string | workAbilityLineMap 매핑 | O | X |
| 카드 표면 | title (Main Title) | string | **weekly_activities.title** | O | X |
| 카드 표면 | icon | string | 파일명 매칭 (WORK_ABILITY_ICON_FILES) | O | X |
| 카드 표면 | enhancementStatus | EnhancementStatus | getEnhancementStatus 계산 | O | X |
| 모달 내부 | subTitle | string | **user_activity_details.sub_title** | X | **O** |
| 모달 내부 | growthPoint | string | **user_activity_details.growth_point** | X | **O** |
| 모달 내부 | outputLinks | array | 운영진+사용자 병합 | 운영자분 O | **사용자분 O** |
| 모달 내부 | images / imageCaptions | array | 운영진+사용자 병합 | 운영자분 O | **사용자분 O** |

### 2-4. 실무 경험 (Work Exp) 허브 — 최대 5칸 (실제 카드 + void 패딩)

| 화면 위치 | 필드명 | 타입 | 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 카드 표면 | code (line_code) | string | activity_types.line_code | O | X |
| 카드 표면 | badge (name) | string | activity_types.name | O | X |
| 카드 표면 | title (Main Title) | string | **weekly_activities.title** | O | X |
| 카드 표면 | enhancementStatus | EnhancementStatus | getEnhancementStatus 계산 | O | X |
| 카드 표면 | rating | number (0~5) | **user_activity_details.rating** (0~10→0~5 변환) | O | X |
| 카드 표면 | ratingCount | string | 포맷: "{ratingScore} / 10" | O | X |
| 모달 내부 | subTitle | string | **user_activity_details.sub_title** | X | **O** |
| 모달 내부 | growthPoint | string | **user_activity_details.growth_point** | X | **O** |
| 모달 내부 | outputLinks | array | 운영진+사용자 병합 | 운영자분 O | **사용자분 O** |
| 모달 내부 | images / imageCaptions | array | 운영진+사용자 병합 | 운영자분 O | **사용자분 O** |

### 2-5. 실무 경력 (Work Career) 허브 — 카드 수 = career_records 수 (페이지네이션)

| 화면 위치 | 필드명 | 타입 | 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 카드 표면 | badge (company_name) | string | **career_projects.company_name** | O | X |
| 카드 표면 | title (project_name / job_position) | string | **career_projects.project_name** | O | X |
| 카드 표면 | code (line_code / career_code) | string | **career_projects.line_code** | O | X |
| 카드 표면 | icon (company_logo_url) | string | **career_projects.company_logo_url** | O | X |
| 카드 표면 | companyHomepageUrl | string | **career_projects.company_homepage_links[0]** | O | X |
| 카드 표면 | grade | string | **career_records.grade** | O | X |
| 카드 표면 | gradePoints | number | **career_records.grade_points** | O | X |
| 카드 표면 | statusBadge | string | career_records.enhancement_status + resultsDecided 계산 | O | X |
| 카드 표면 | supervisorImg | string | **career_projects.supervisor_profile_img** | O | X |
| 카드 표면 | supervisorName | string | **career_projects.supervisor_name** | O | X |
| 카드 표면 | supervisorPosition | string | **career_projects.supervisor_position** | O | X |
| 카드 표면 | supervisorDept | string | **career_projects.supervisor_department** | O | X |
| 카드 표면 | supervisorCompany | string | **career_projects.supervisor_company** | O | X |
| 카드 표면 | lineName | string | **career_projects.line_name** | O | X |
| 모달 내부 | subTitle (= project_description) | string | **user_activity_details.sub_title** fallback career_projects.project_description | X | **O** |
| 모달 내부 | growthPoint | string | **user_activity_details.growth_point** | X | **O** |
| 모달 내부 | outputLinks | array | 운영진(career_projects)+사용자 병합 | 운영자분 O | **사용자분 O** |
| 모달 내부 | images (3슬롯) / imageCaptions | array | 운영진(output_images)+사용자 병합 | 운영자분 O | **사용자분 O** |

### 2-6. 부가 영역 (주차 리뷰, 평판, 연계동료)

| 화면 위치 | 필드명 | 타입 | 데이터 소스 | 읽기전용 | 입력가능 |
|---|---|---|---|---|---|
| 주차 리뷰 | rating | number | DB weekly_reviews.rating | X | **O** (본인) |
| 주차 리뷰 | content | string | DB weekly_reviews.content | X | **O** (본인) |
| 주차 평판 | rating | number | DB weekly_reputations.rating | X | **O** (타크루) |
| 주차 평판 | content | string | DB weekly_reputations.content | X | **O** (타크루) |
| 주차 평판 | keyword | string | DB weekly_reputations.keyword_1~3 | X | **O** (타크루) |
| 주차 평판 | fmScore | number | DB weekly_reputations.fm_score | O | X |
| 연계 동료 | rank (1st/2nd/3rd) | number | DB weekly_colleagues.rank | X | **O** (본인) |
| 연계 동료 | message | string | DB weekly_colleagues.message | X | **O** (본인) |
| 연계 동료 | 크루 프로필 | object | DB user_profiles + educations | O | X |

---

## 3. 운영자 입력 정보(1차) / 사용자 입력 정보(2차) 분리

### 운영자 입력 정보 (1차 — 라인 개설 시 입력)

코드 기준으로 `weekly_activities` + `career_projects` 테이블에서 온 데이터:

| 항목 | 소스 테이블.필드 | 해당 허브 |
|---|---|---|
| Main Title | `weekly_activities.title` | Info, Ability, Exp |
| Output Link (운영진분) | `weekly_activities.output_links` | Info, Ability, Exp |
| Output Image (운영진분) | `weekly_activities.output_images` | Info, Ability, Exp |
| Activity 개설 여부 | `weekly_activities.is_active` | 전체 |
| Activity 마감일 | `weekly_activities.deadline` | 전체 |
| Activity 개설일 | `weekly_activities.opened_at` | 전체 |
| Team 지정 | `weekly_activities.team_id` | Exp |
| 회사명 | `career_projects.company_name` | Career |
| 회사 로고 | `career_projects.company_logo_url` | Career |
| 직무 | `career_projects.job_position` | Career |
| 프로젝트명 | `career_projects.project_name` | Career |
| 프로젝트 설명 | `career_projects.project_description` | Career |
| 라인 코드 | `career_projects.line_code` | Career |
| 라인명 | `career_projects.line_name` | Career |
| Output Link (운영진분) | `career_projects.output_links` | Career |
| Output Image (운영진분) | `career_projects.output_images` | Career |
| 회사 홈페이지 | `career_projects.company_homepage_links` | Career |
| 감독자 정보 전체 | `career_projects.supervisor_*` | Career |
| 2차정보 마감 | `career_projects.secondary_info_deadline` | Career |
| 등급 | `career_records.grade` | Career |
| 등급 점수 | `career_records.grade_points` | Career |
| 강화 상태 | `career_records.enhancement_status` | Career |
| Rating (별점) | `user_activity_details.rating` | Exp |
| 주차 결과 상태 | `user_week_statuses.status` | 헤더 |
| 포인트 (star/shield/lightning) | `user_weekly_points` | 헤더 |

### 사용자 입력 정보 (2차 — 라인 강화 시 입력)

코드 기준으로 `user_activity_details` 테이블에 저장:

| 항목 | 소스 테이블.필드 | 해당 허브 |
|---|---|---|
| Sub Title | `user_activity_details.sub_title` | Info, Ability, Exp, Career |
| Growth Point | `user_activity_details.growth_point` | Info, Ability, Exp, Career |
| Output Link (사용자분) | `user_activity_details.output_links` | Info, Ability, Exp, Career |
| Output Image (사용자분) | `user_activity_details.image_urls` | Info, Ability, Exp, Career |
| Image Caption | `user_activity_details.image_captions` | Info, Ability, Exp, Career |

별도 사용자 입력 (다른 테이블):

| 항목 | 소스 테이블 | 위치 |
|---|---|---|
| 주차 리뷰 (rating + content) | `weekly_reviews` | 주차 리뷰 모달 |
| 주차 평판 (rating + content + keyword) | `weekly_reputations` | 평판 모달 |
| 연계 동료 (rank + message) | `weekly_colleagues` | 동료 모달 |

---

## 4. 카드 상태값 조사

### EnhancementStatus (실무 정보/역량/경험 공통)

| 상태값 | 화면 표시 | 아이콘 | 판단 로직 |
|---|---|---|---|
| `"success"` | 강화 성공 | `5 강화 성공.png` | is_completed=true + 결정시점(N+1목 12:01) 이후 |
| `"waiting"` | 강화 대기 | `6 강화 대기.png` | is_completed=true + 결정시점 이전 |
| `"failed"` | 강화 실패 | `7 강화 실패.png` | is_completed=false (진행 중에도 즉시) |
| `"not_applicable"` | 해당 없음 | `8 해당 없음.png` | 미개설/온보딩/개인휴식/역할불일치/주차외 |
| `"empty"` | (렌더링 안 함) | 없음 | 더미데이터 sentinel (is_empty=true) |

### Career Enhancement Status (실무 경력 전용)

| 상태값 | 화면 표시 | 아이콘 | 판단 로직 |
|---|---|---|---|
| `"enhanced"` | 강화 성공 | `5 강화 성공.png` | DB값 또는 pending+결정시점이후 |
| `"pending"` | 강화 대기 | `6 강화 대기.png` | DB값 + 결정시점 이전 |
| `"failed"` | 강화 실패 | `7 강화 실패.png` | DB값 |
| `"not_applicable"` | 해당 없음 | `8 해당 없음.png` | DB값 |

### Growth Status (주차 결과 — 헤더)

| 상태값 | 화면 표시 | 데이터 소스 |
|---|---|---|
| `"성공"` | 성장 성공 | user_week_statuses.status="success" |
| `"실패"` | 성장 실패 | status="fail" |
| `"진행 중"` | 진행 중 | 결정시점 이전 + 집계 전 |
| `"집계 중"` | 집계 중 | 결정시점 이전 + 집계 시작 후 |
| `"휴식(개인)"` | 휴식(개인) | status="personal_rest" |
| `"휴식(공식)"` | 휴식(공식) | status="official_rest" |

### WeekConfirmStatus (주차 확인)

| 상태값 | 화면 표시 | 용도 |
|---|---|---|
| `"pending"` | 확인 필요 | 초기 상태 |
| `"confirming"` | 확인 중 | 전환 중 |
| `"confirmed"` | 확인 완료 | 최종 상태 |

---

## 5. 비활성화 로직 조사

### 편집 권한 비활성화

| 조건 | 코드 위치 | 동작 |
|---|---|---|
| `!canEditWorkInfo` | L2217, L2260, L2367 | Work Info 모달 내 입력 필드 비활성화 + 저장 차단 |
| `!canEditWorkAbility` | L2554, L2595, L2609 | Work Ability 모달 내 입력 비활성화 |
| `!canEditWorkExp` | L2795, L2839, L2854 | Work Exp 모달 내 입력 비활성화 |
| `!canEditWorkCareer` | L3066, L3107, L3144 | Work Career 모달 내 입력 비활성화 |
| `!canEditWeeklyReviews` | L3873 | 주차 리뷰 저장 차단 |
| `!canEditReputation` | L4065, L4124, L4161 | 평판 작성/수정/삭제 차단 |
| `!canEditColleague` | L1963, L3445, L3465 | 동료 선택 모달 저장 차단 |

### 활동 상태 비활성화

| 조건 | 코드 위치 | 동작 |
|---|---|---|
| `!isActivityActive(type)` | L5031-5038 | 해당 활동 편집 불가 (마감 지남 + grant 없음) |
| `isActivityExpired(type)` | L5041-5053 | 마감됨 표시 (빨간 배경) |
| `isOnboardingWeek` | L4941 | 전체 활동 "해당 없음" 처리 |
| `weekData?.isPersonalRest` | L4945 | 전체 활동 "해당 없음" 처리 |
| `isRestMode` (공식/개인 휴식) | effectiveWorkXXXCards | 모든 카드 title 차폐, 상태 not_applicable |
| `resultsDecided` | L303 | N+1 목 12:01 KST 도달 → waiting→success 전환 |

### 사용자 인증 비활성화

| 조건 | 코드 위치 | 동작 |
|---|---|---|
| `!isOwner && !isAdmin` | L182 | 타인 프로필은 편집 불가 |
| `!session` (미로그인) | L275-278 | "로그인이 필요합니다" alert |
| 승인 대기 (approved) | L286-290 | 어드민 승인 전 편집 불가 |

### 기타 비활성화

| 조건 | 코드 위치 | 동작 |
|---|---|---|
| `weekStatus !== "pending"` | L6254 | 주차 확인 버튼 disabled |
| `isLocked` (cardIndex===4) | L6930-6947 | 5번째 경험 카드 잠금 (cursor: not-allowed) |
| `isLineForOtherRole` | L4919-4928 | 파트장/에이전트 전용 라인 미스매치 |
| experienceTypeInfo eligible 주차 범위 | L4957-4964 | 누적 주차 범위 밖 → not_applicable |

### 작성기간 권한 판단 우선순위

```
1. isDemoMode → 자동 허용
2. isAdmin → 자동 허용
3. dev override (?unlockCluster4*=1) → 프론트만 허용 (서버 검증 별도)
4. API 권한 → /api/edit-windows/permission?resource_key=cluster4.*
```

---

## 6. API 연결 현황

### 데이터 조회 API

| URL | 메서드 | Request | Response | 사용 컴포넌트 |
|---|---|---|---|---|
| `/api/profile/?userId={id}` | GET | userId query | 유저 프로필 | 헤더, 리뷰어 프로필 |
| `/api/educations?userId={id}` | GET | userId query | 교육 정보 | 리뷰어 프로필 |
| `/api/auth/check-status` | GET | - | { success, status } | 편집 승인 체크 |
| `/api/career-records?week_id=&user_id=` | GET | week_id, user_id | CareerRecord[] | 실무 경력 카드 |
| `/api/weekly-reputations?targetUserId=&weekCardId=` | GET | targetUserId, weekCardId | 평판 데이터 | 평판 카드 |
| `/api/weekly-colleagues?userId=&weekCardId=` | GET | userId, weekCardId | 연계동료 데이터 | 동료 카드 |
| `/api/reputation-keywords` | GET | - | 키워드 목록 | 평판 키워드 |
| `/api/crews?excludeUserId=` | GET | excludeUserId | 크루 목록 | 동료 선택 |
| `/api/weekly-reviews?...` | GET | userId, weekCardId | 주차 리뷰 데이터 | 주차 리뷰 |
| `/api/edit-windows/permission?resource_key=` | GET | resource_key | { canEdit } | 작성기간 권한 |
| `/api/cluster4/weekly-growth` | GET | userId | WeeklyGrowthResponseDto | 주차 목록 |

### 데이터 저장 API

| URL | 메서드 | Request DTO | 사용 컴포넌트 |
|---|---|---|---|
| `/api/activity-details` | PUT | { week_id, activity_type_id, sub_title, growth_point, output_links, image_urls, image_captions } | Info/Ability/Exp/Career 모달 저장 |
| `/api/activity-details/upload-image` | POST | FormData (image file) | 이미지 업로드 |
| `/api/weekly-colleagues` | POST | { weekCardId, colleagues[] } | 동료 저장 |
| `/api/weekly-colleagues` | DELETE | { weekCardId, targetUserId } | 동료 삭제 |
| `/api/weekly-reviews` | POST/PUT | { weekCardId, rating, content } | 주차 리뷰 저장 |
| `/api/weekly-reputations` | POST | { targetUserId, weekCardId, rating, content, keyword_1~3 } | 평판 작성 |
| `/api/weekly-reputations/{id}` | DELETE | - | 평판 삭제 |

---

## 7. 최종 데이터 계약 초안

| 화면 항목 | 화면 위치 | 운영자 입력(1차) | 사용자 입력(2차) | 현재 필드명 | 데이터 소스 |
|---|---|---|---|---|---|
| Main Title | 카드 표면 (Info/Ability/Exp) | **O** | X | `weekly_activities.title` | Supabase weekly_activities |
| Sub Title | 모달 내부 (전체) | X | **O** | `user_activity_details.sub_title` | Supabase user_activity_details |
| Growth Point | 모달 내부 (전체) | X | **O** | `user_activity_details.growth_point` | Supabase user_activity_details |
| Output Link (운영자) | 모달 내부 (전체) | **O** | X | `weekly_activities.output_links` / `career_projects.output_links` | Supabase |
| Output Link (사용자) | 모달 내부 (전체) | X | **O** | `user_activity_details.output_links` | Supabase user_activity_details |
| Output Image (운영자) | 모달 내부 (전체) | **O** | X | `weekly_activities.output_images` / `career_projects.output_images` | Supabase |
| Output Image (사용자) | 모달 내부 (전체) | X | **O** | `user_activity_details.image_urls` | Supabase user_activity_details |
| Image Caption | 모달 내부 (전체) | X | **O** | `user_activity_details.image_captions` | Supabase user_activity_details |
| Rating (별점) | 카드 표면 (Exp) | **O** | X | `user_activity_details.rating` | Supabase user_activity_details |
| Activity 개설 여부 | 카드 상태 (전체) | **O** | X | `weekly_activities.is_active` | Supabase weekly_activities |
| Activity 마감 | 시간 표시 (전체) | **O** | X | `weekly_activities.deadline` | Supabase weekly_activities |
| 라인 코드 | 카드 표면 (Ability/Exp/Career) | **O** | X | `activity_types.line_code` / `career_projects.line_code` | Supabase |
| 라인명 | 카드 표면 (Ability/Career) | **O** | X | `activity_types.name` / `career_projects.line_name` | Supabase |
| 카테고리 | 카드 표면 (Info) | **O** | X | `activity_types.name` → config 매핑 | Supabase activity_types |
| 회사명 | 카드 표면 (Career) | **O** | X | `career_projects.company_name` | Supabase career_projects |
| 회사 로고 | 카드 아이콘 (Career) | **O** | X | `career_projects.company_logo_url` | Supabase career_projects |
| 직무 | 카드 내부 (Career) | **O** | X | `career_projects.job_position` | Supabase career_projects |
| 프로젝트명 | 카드 표면 (Career) | **O** | X | `career_projects.project_name` | Supabase career_projects |
| 프로젝트 설명 | 모달 (Career) | **O** (초기값) | **O** (수정) | `career_projects.project_description` → `user_activity_details.sub_title` 오버라이드 | Supabase |
| 감독자 이름 | 카드 (Career) | **O** | X | `career_projects.supervisor_name` | Supabase career_projects |
| 감독자 직급 | 카드 (Career) | **O** | X | `career_projects.supervisor_position` | Supabase career_projects |
| 감독자 부서 | 카드 (Career) | **O** | X | `career_projects.supervisor_department` | Supabase career_projects |
| 감독자 회사 | 카드 (Career) | **O** | X | `career_projects.supervisor_company` | Supabase career_projects |
| 감독자 프로필 | 카드 (Career) | **O** | X | `career_projects.supervisor_profile_img` | Supabase career_projects |
| 등급 | 카드 (Career) | **O** | X | `career_records.grade` | Supabase career_records |
| 등급 점수 | 카드 (Career) | **O** | X | `career_records.grade_points` | Supabase career_records |
| 강화 상태 | 전체 카드 상태 배지 | **O** (시스템) | X | `career_records.enhancement_status` / `activity_records.is_completed` | Supabase |
| 포인트 (star/shield/lightning) | 헤더 | **O** | X | `user_weekly_points` | Supabase user_weekly_points |
| 팀 / 파트 | 헤더 | **O** | X | `teams.name` / `parts.name` via `user_team_parts` | Supabase |
| 역할 | 헤더 | **O** | X | `user_role_history.role` → ROLE_LABELS | Supabase user_role_history |
| 주차 리뷰 | 리뷰 모달 | X | **O** (본인) | `weekly_reviews.rating`, `.content` | Supabase weekly_reviews |
| 주차 평판 | 평판 모달 | X | **O** (타크루) | `weekly_reputations.rating`, `.content`, `.keyword_*` | Supabase weekly_reputations |
| 연계 동료 | 동료 모달 | X | **O** (본인) | `weekly_colleagues.rank`, `.message` | Supabase weekly_colleagues |
| 회사 홈페이지 | 카드 (Career) | **O** | X | `career_projects.company_homepage_links` | Supabase career_projects |
| 2차정보 마감 | 내부 계산 (Career) | **O** | X | `career_projects.secondary_info_deadline` | Supabase career_projects |

---

## 8. 모달 목록

| 모달 | state 변수 | 용도 | 입력 주체 |
|---|---|---|---|
| Work Info 편집 모달 | `workInfoModalOpen` | 실무 정보 2차 정보 입력 | 사용자 |
| Work Ability 편집 모달 | `workAbilityModalOpen` | 실무 역량 2차 정보 입력 | 사용자 |
| Work Exp 편집 모달 | `workExpModalOpen` | 실무 경험 2차 정보 입력 | 사용자 |
| Work Career 편집 모달 | `workCareerModalOpen` | 실무 경력 2차 정보 입력 | 사용자 |
| Work Info View 모달 | `workInfoViewModalOpen` | 실무 정보 상세 보기 | 읽기전용 |
| Work Ability View 모달 | `workAbilityViewModalOpen` | 실무 역량 상세 보기 | 읽기전용 |
| Work Exp View 모달 | `workExpViewModalOpen` | 실무 경험 상세 보기 | 읽기전용 |
| Work Career View 모달 | `workCareerViewModalOpen` | 실무 경력 상세 보기 | 읽기전용 |
| Header 모달 (본인) | `headerModalOpen` (type="본인") | 연계 동료 편집 | 사용자 |
| Header 모달 (타크루) | `headerModalOpen` (type="타크루") | 평판 작성/수정 | 타크루 |
| 주차 리뷰 모달 | `weeklyReviewModalOpen` | 주차 리뷰 작성 | 사용자 |
| 평판 View 모달 | `reputationViewModalOpen` | 평판 상세 보기 | 읽기전용 |
| 동료 View 모달 | `colleagueViewModalOpen` | 연계동료 상세 보기 | 읽기전용 |
| 키워드 모달 | `keywordModalOpen` | 평판 키워드 선택 | 타크루 |
| Detail Log 모달 | `showDetailLogModal` | 활동 로그 보기 | 읽기전용 |
| Help 모달 | `helpModalKind` | 도움말 표시 | 읽기전용 |
| Ability Help 모달 | `showAbilityHelpModal` | 실무 역량 도움말 | 읽기전용 |
| Exp Help 모달 | `showExpHelpModal` | 실무 경험 도움말 | 읽기전용 |
| Career Help 모달 | `showCareerHelpModal` | 실무 경력 도움말 | 읽기전용 |

---

## 9. 핵심 발견 사항

### 4개 허브 공통 패턴

```
운영자 → weekly_activities / career_projects 에 1차 정보 입력
    ↓
사용자 → user_activity_details 에 2차 정보 입력
    (sub_title, growth_point, output_links, image_urls, image_captions)
```

### 작성기간 권한 체계

- 모달별로 `cluster4.work_info` / `work_ability` / `work_exp` / `work_career` 키로 개별 제어
- Legacy `cluster4.activity_details` 키가 fallback으로 존재
- 추가로 `cluster4.weekly_reviews`, `cluster4.weekly_colleagues`, `cluster4.weekly_reputation`, `cluster4.season_review`, `cluster4.season_reputation` 키

### 강화 상태 결정 시점

- **N+1주 목요일 12:01 KST** 기준으로 `waiting` → `success` 전환
- 2차 정보 작성 여부는 강화 성공/실패 판정에 **무관** (2026 정책)
- `computeResultDecidedMs = weekStart + (10일 × 24h + 12h) × 3600 × 1000 + 60 × 1000`

### Supabase 테이블 관계도 (추정)

```
weeks ─── season_definitions
  │
  ├── weekly_activities (운영자 라인 개설)
  │     └── activity_types (라인 마스터)
  │
  ├── activity_records (이행 여부)
  │
  ├── user_activity_details (사용자 2차 정보)
  │
  ├── career_projects (운영자 경력 프로젝트)
  │     └── career_records (사용자 경력 기록)
  │
  ├── weekly_reviews (주차 리뷰)
  ├── weekly_reputations (주차 평판)
  ├── weekly_colleagues (연계 동료)
  │
  ├── user_week_statuses (주차 결과)
  ├── user_weekly_points (포인트)
  ├── rest_requests (휴식 신청)
  │
  └── user_edit_windows (작성기간 권한)

user_profiles ─── user_team_parts ─── teams / parts
              └── user_role_history
```

---

## 10. 다음 단계 제안

이 보고서를 기반으로 아래 순서로 진행할 수 있습니다:

```
1. 현재 프론트 UI 구조 파악 ✅ (이 보고서)
2. 실제 데이터 항목 정의 ✅ (섹션 7 데이터 계약 초안)
3. 어드민 UI 설계 → 운영자 입력(1차) 항목 기반
4. Supabase 스키마 설계 → 테이블 관계도 기반
5. API 설계 → 섹션 6 API 현황 기반
```

# Cluster4 Front 실구현 현황 보고서

조사일: 2026-05-20
조사 범위: Admin ↔ Supabase ↔ Front 연동 운영화를 위한 read-only 기초 조사
코드 수정: 없음 / migration 작성: 없음 / 신규 테이블 생성: 없음

---

## 1. 결론

**D ─ Cluster4는 이미 canonical Supabase source가 운영 중인 가장 성숙한 클러스터**이며, Admin editor가 별도 화면으로 존재하지 않는다는 점만 비어 있다.

근거:
- Cluster4의 모든 view/edit가 `weeks`, `user_weekly_growth`, `points`, `activity_records`, `weekly_activities`, `user_activity_details`, `weekly_reviews`, `weekly_reputations`, `weekly_colleagues`, `season_reputations`, `user_season_histories`, `career_records`, `career_projects` 등의 실재 Supabase 테이블 위에서 동작한다.
- 각 mutation API는 이미 NextAuth session 기반 self-edit + `isAdminEmail()` 기반 admin override를 분기하고 있다 (`/api/weekly-reputations` PUT/DELETE, `/api/weekly-reviews/[id]` PUT/DELETE, `/api/season-reputations` PUT/DELETE).
- Front는 `?userId=...` 쿼리를 받으면 `apiUrl()` helper로 mutation 호출에 `targetUserId`를 붙여 admin이 타 유저 데이터를 편집할 수 있는 경로까지 이미 깔려 있다 (`Cluster4Content.tsx:323-329`, `Cluster4CardContent.tsx:333-339`).
- **단, 별도 Admin 페이지 UI는 없음.** Cluster4 Front 자체가 `?userId=...&admin=true` 진입 시 admin 편집 모드로 작동하도록 설계됨.
- Dummy data (`DUMMY_WEEKLY_LIST`, `DUMMY_WEEK_EXTRA`, `DUMMY_SEASON_DATA`, `DUMMY_WEEK_CARD`)는 **`isDemoMode()` (localStorage 토글) 분기 안에서만 사용**되며 DB로 write되지 않음 → Cluster2/3에서 본 "page-load 시 default seed가 DB에 박히는" 패턴은 Cluster4에서는 **없음**.

---

## 2. 실제 파일 경로

### 페이지 라우트 (12개)
```
app/(host)/(main-layout)/(cluster-pages)/cluster-4/page.tsx              → Cluster41Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-ec/page.tsx           → Cluster41Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-px/page.tsx           → Cluster41Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-1/page.tsx            → Cluster4Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-1-ec/page.tsx         → Cluster4Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-1-px/page.tsx         → Cluster4Content
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card/page.tsx         → redirect to /cluster-4-card/{currentWeekId}
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card/[weekId]/page.tsx       → Cluster4CardContent
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-ec/page.tsx      → redirect (ec)
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-ec/[weekId]/page.tsx    → Cluster4CardContent
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/page.tsx      → redirect (px)
app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/[weekId]/page.tsx    → Cluster4CardContent
```

### 컴포넌트
```
components/cluster-4-1/Cluster41Content.tsx       (2,347 LOC, /cluster-4 진입)
components/cluster-4/Cluster4Content.tsx          (4,290 LOC, /cluster-4-1 진입)
components/cluster-4-card/Cluster4CardContent.tsx (10,720 LOC, /cluster-4-card/[weekId] 진입)
```
> 라우트 이름과 컴포넌트 폴더 이름이 **교차 매핑**되어 있다는 점 주의: `/cluster-4` ⇒ `cluster-4-1/Cluster41Content`, `/cluster-4-1` ⇒ `cluster-4/Cluster4Content`.

### SCSS
```
app/(host)/assets/scss/components/_cluster4-encre.scss
app/(host)/assets/scss/components/_cluster4-px.scss
app/(host)/assets/scss/components/_cluster4-week.scss
app/(host)/assets/scss/components/_cluster4-season.scss
app/(host)/assets/scss/components/_cluster4-card-encre.scss
app/(host)/assets/scss/components/_cluster4-card-px.scss
```

### API 라우트 (Cluster4가 호출)
```
app/(host)/api/profile/route.ts                  (1,679 LOC — context=card 분기로 weekBundle 반환)
app/(host)/api/activity-details/route.ts         (GET/POST/DELETE)
app/(host)/api/career-records/route.ts           (GET)
app/(host)/api/weekly-reputations/route.ts       (GET/POST/PUT/DELETE)
app/(host)/api/weekly-colleagues/route.ts        (GET/POST)
app/(host)/api/season-reputations/route.ts       (GET/POST/PUT/DELETE)
app/(host)/api/season-review/route.ts            (GET/PUT)
app/(host)/api/reputation-keywords/route.ts      (GET/POST)
app/(host)/api/crews/route.ts                    (GET)
app/(host)/api/cluster-4-ranking/route.ts        (GET)
app/api/weekly-reviews/route.ts                  (GET/POST)
app/api/weekly-reviews/[id]/route.ts             (PUT/DELETE)
app/api/activity-details/upload-image/route.ts   (POST)
```

### Dummy data 모듈
```
constants/dummyData/cluster4-weekly-dummy.ts   (DUMMY_WEEKLY_LIST, DUMMY_WEEK_EXTRA)
constants/dummyData/cluster4-season-dummy.ts   (DUMMY_SEASON_DATA, DUMMY_SEASON_HISTORIES, REVIEW_COMMENT_DEFAULT)
constants/dummyData/cluster4-card-dummy.ts     (DUMMY_WEEK_CARD)
data/weeklyData.ts                             (legacy weeklyData[] — 어디서도 import되지 않음, dead code)
```

### Navigation
```
components/home-career/ClusterTabs.tsx:38       (CLUB CHALLENGE GROWTH 탭 → /cluster-4)
components/home-career/Sidebar.tsx              (좌측 사이드바)
lib/cluster-route.ts                            (isPxRoute / isEcRoute / withPxRoute / getThemeClass)
utils/orgLabelAlias.ts                          (단감/인절미/어흥 → 조직별 alias)
```

---

## 3. Route 목록

| Route | Variant | 컴포넌트 | userId query | weekId param |
|---|---|---|---|---|
| `/cluster-4` | base | Cluster41Content | ✅ `?userId=` | — |
| `/cluster-4-ec` | encre | Cluster41Content | ✅ | — |
| `/cluster-4-px` | phalanx | Cluster41Content | ✅ | — |
| `/cluster-4-1` | base | Cluster4Content | ✅ | — |
| `/cluster-4-1-ec` | encre | Cluster4Content | ✅ | — |
| `/cluster-4-1-px` | phalanx | Cluster4Content | ✅ | — |
| `/cluster-4-card` | base | redirect→`/cluster-4-card/{id}` | `?admin=true` → `/cluster-4-card/dw-01` | — |
| `/cluster-4-card/[weekId]` | base | Cluster4CardContent | ✅ | URL path |
| `/cluster-4-card-ec` | encre | redirect | `?admin=true` 동일 동작 | — |
| `/cluster-4-card-ec/[weekId]` | encre | Cluster4CardContent | ✅ | URL path |
| `/cluster-4-card-px` | phalanx | redirect | `?admin=true` 동일 동작 | — |
| `/cluster-4-card-px/[weekId]` | phalanx | Cluster4CardContent | ✅ | URL path |

세 variant(base/ec/px)는 **동일 컴포넌트**를 마운트하고 테마만 `(cluster-pages)/layout.tsx`의 wrapper class로 분기.

---

## 4. UI 섹션 목록

### `/cluster-4` (Cluster41Content — Weekly Growth)
| 화면 이름 | 데이터 | 편집 | Modal | Save | Lock UX |
|---|---|---|---|---|---|
| Section 1 헤더 (CLUB CHALLENGE GROWTH) | static text | ✗ | ✗ | ✗ | ✗ |
| Section 2 Season Growth 카드 | `currentSeasonInfo`, `growthPeriodStats`, `startWeekInfo`, `endWeekInfo`, `userStatus`, `growthStatus` | ✗ | ✗ | ✗ | `isPendingApproval` / `isNotLoggedIn` 시 메시지 박스 |
| Filter Bar (시즌/결과 dropdown, reset, count) | `seasonOptions`, `resultOptions` 계산 | dropdown 선택만 | mobile 시 bottom-sheet | ✗ | ✗ |
| Weekly Cards 리스트 | `dbWeeklyData[]` (Supabase weeks + user_weekly_growth + points + activity_records 합성) | ✗ (read-only, click → `/cluster-4-card/{week.id}`) | ✗ | ✗ | 미로그인/미승인 시 "표시할 데이터가 없습니다" |

### `/cluster-4-1` (Cluster4Content — Season Growth)
| 화면 이름 | 데이터 | 편집 | Modal | Save | Lock UX |
|---|---|---|---|---|---|
| Section 1 헤더 + 탭 | static | ✗ | ✗ | ✗ | ✗ |
| Section 2 Season Growth 좌측 카드 | `currentSeasonInfo`, `growthPeriodStats`, `growthStartInfo`, `growthEndInfo`, `seasonHistories` count | ✗ | ✗ | ✗ | ✗ |
| Section 3 SEASON CHALLENGE 좌측 이미지 스택 (paginated) | `seasonHistories[section3Page]`, fallback `DUMMY_SEASON_DATA` | ✗ | ✗ | ✗ | ✗ |
| Section 3 area-4 Stats bar | dangam/injeolmi/eoheung counts from `seasonHistories[].stats` | ✗ | ✗ | ✗ | ✗ |
| Section 3 area-5 Rating + Season Review | `currentSeason.rating`, `currentSeason.review` | **✏️ pencil → seasonReviewModal** | ✅ `seasonReviewModalOpen` | ✅ PUT `/api/season-review` | non-admin & 미승인 시 disabled, `canEditSeasonReview` 플래그 |
| Section 3 area-6 3 circle charts | `currentSeason.circles.{weekUsage, scheduleReliability, seasonGrowth}` | ✗ | ✗ | ✗ | ✗ |
| Section 3 area-7 4 강화율 bars | `currentSeason.progress.{info, competency, experience, career}` | ✗ | ✗ | ✗ | ✗ |
| Section 3 area-8 시즌 상태 (운영진 history) | `seasonRoles[]` (user_role_history + team/part) | ✗ | ✗ | ✗ | 빈 슬롯 "-" |
| Section 3 area-9 시즌 평판 (7 slots) | `seasonReputations[]` from `/api/season-reputations` | **✏️ pencil → seasonReputationModal** | ✅ keyword modal, rating dropdown, detail modal | ✅ POST/PUT/DELETE `/api/season-reputations` | self는 자기 평판 작성 불가, non-admin 미승인 시 disabled |

### `/cluster-4-card/[weekId]` (Cluster4CardContent — Week Detail)
| 화면 이름 | 데이터 | 편집 | Modal | Save | Lock UX |
|---|---|---|---|---|---|
| Top Tabs / Prev-Next nav | `prevWeekId`, `nextWeekId` | ✗ | ✗ | ✗ | prev/next null이면 disabled |
| Weekly Growth Badge (floating) | toggle state | ✗ | ✗ | ✗ | ✗ |
| 주차 이미지 | computed from `weekData.growthStatus` | ✗ | ✗ | ✗ | ✗ |
| Weekly Review 박스 | `weeklyReviewFromDB.{content, rating}` | **✏️ → review modal** | ✅ `weeklyReviewModalOpen` | ✅ POST `/api/weekly-reviews` 또는 PUT `/api/weekly-reviews/[id]` | self만 작성 (POST 시 user_id=session.user.id), admin은 header override |
| 본인 한 줄 평 + 평판 카드 7장 | `weeklyReputations[]` from `/api/weekly-reputations` | **✏️ → reputation modal** | ✅ `headerModalOpen`/`headerModalType`, keyword modal, detail modal | ✅ POST/PUT/DELETE `/api/weekly-reputations` | non-admin은 자기 자신에 reputation 작성 불가, 미승인 시 disabled |
| 연계 동료 3슬롯 | `selectedColleagues[]` from `/api/weekly-colleagues` | **➕ → colleague picker** | ✅ crew search modal | ✅ POST `/api/weekly-colleagues` (delete+insert) | self만, admin override |
| 실무 정보 (info) grid | `weeklyActivities` × `weekActivityRecords` × `weekActivityDetails` | **✏️ per-card → workInfoModal** | ✅ `workInfoModalOpen`, image upload modal | ✅ POST `/api/activity-details` + POST `/api/activity-details/upload-image` | deadline 경과 + secondary_info_grants 없으면 backend 403 (admin도 bypass 불가) |
| 실무 역량 (competency) grid | 동일 패턴 | **✏️ → workAbilityModal** | ✅ | ✅ POST `/api/activity-details` | 동일 |
| 실무 경험 (experience) grid | 동일 패턴 | **✏️ → workExpModal** | ✅ | ✅ POST `/api/activity-details` | 동일 |
| 실무 경력 (career) | `careerRecords[]` from `/api/career-records` | **✏️ → workCareerModal** | ✅ | ✅ POST `/api/activity-details`로 동일 라인 사용 | 동일 |
| Stats 4 진행률 링/뱃지 (info/competency/experience/career) | 계산값 (`infoStats`, `competencyStats`, …) | ✗ | ✗ | ✗ | `resultsDecided`가 false면 "-" 표시 |

---

## 5. API 목록

| Endpoint | Method | 호출처 | Read/Write | userId 처리 | Self/Admin |
|---|---|---|---|---|---|
| `/api/profile?userId=...&context=card&weekId=...` | GET | 3개 컴포넌트 전부 | R | query `userId` 또는 session | extractTargetUserId override |
| `/api/educations?userId=...` | GET | Cluster4Content, Cluster4CardContent (reviewerProfile) | R | query `userId` | — |
| `/api/auth/check-status` | GET | 미승인 가드 (edit 클릭 시) | R | session 전제 | — |
| `/api/weekly-reputations?targetUserId=...&weekCardId=...` | GET | Cluster41Content, Cluster4CardContent | R | query `targetUserId` (대상) | (no session check — 누구나 read 가능) |
| `/api/weekly-reputations` | POST | Cluster4CardContent (작성) | W | body `targetUserId`(대상), reviewer = session via extractTargetUserId | rate-limit 7 sent/4 received |
| `/api/weekly-reputations` | PUT | Cluster4CardContent (수정) | W | body `id`, reviewer ownership | admin override |
| `/api/weekly-reputations?id=...` | DELETE | Cluster4CardContent (삭제) | W | `id`, reviewer ownership | admin override |
| `/api/weekly-colleagues?userId=...&weekCardId=...` | GET | Cluster4CardContent | R | query `userId` (대상) | (no session check) |
| `/api/weekly-colleagues` | POST | Cluster4CardContent | W (delete+insert) | session(targetUserId override 시 admin) | extractTargetUserId override |
| `/api/season-reputations?targetUserId=...&seasonHistoryId=...` | GET | Cluster4Content | R | query `targetUserId` | (no session check) |
| `/api/season-reputations` | POST | Cluster4Content | W | body `targetUserId`, reviewer = session | rate-limit 10 sent/7 received |
| `/api/season-reputations` | PUT | Cluster4Content (수정/admin) | W | body `id`, reviewer ownership | admin override |
| `/api/season-reputations?id=...` | DELETE | Cluster4Content | W | `id`, reviewer ownership | admin override |
| `/api/season-review?seasonHistoryId=...` | GET | Cluster4Content | R | query | — |
| `/api/season-review` | PUT | Cluster4Content | W | body `seasonHistoryId`, ownership against `user_season_histories.user_id` | **admin override 없음** (엄격 자기 소유 검증만) |
| `/api/weekly-reviews?userId=...&weekCardId=...` | GET | Cluster4CardContent | R | query `userId` | (no session check) |
| `/api/weekly-reviews` | POST | Cluster4CardContent | W | body, user = session(targetUserId override) | extractTargetUserId override |
| `/api/weekly-reviews/[id]` | PUT | Cluster4CardContent | W | path `id`, ownership | admin override |
| `/api/weekly-reviews/[id]` | DELETE | Cluster4CardContent | W | path `id`, ownership | admin override |
| `/api/career-records?user_id=...&week_id=...` | GET | Cluster4CardContent | R | query `user_id` | (no session check) |
| `/api/activity-details?user_id=...&week_id=...&activity_type_id=...` | GET | Cluster4CardContent | R | query `user_id` | (no session check) |
| `/api/activity-details` | POST | Cluster4CardContent | W (upsert) | body `user_id, week_id, activity_type_id` | weekly_activities.deadline + secondary_info_grants 기반 시간 gate, admin bypass **없음** |
| `/api/activity-details?user_id=...&week_id=...&activity_type_id=...` | DELETE | Cluster4CardContent (현재 호출 안 함) | W | query | — |
| `/api/activity-details/upload-image` | POST (multipart) | Cluster4CardContent | W (storage) | session(targetUserId override) | extractTargetUserId override |
| `/api/reputation-keywords` | GET | Cluster4CardContent (lazy on modal open), Cluster4Content | R | — | (hardcoded fallback if DB fails) |
| `/api/crews?excludeUserId=...&org=...` | GET | Cluster4CardContent (lazy on colleague modal) | R | query | — |
| `/api/cluster-4-ranking?weekId=...` | GET | Cluster4 자체에서는 호출 안 함 (rankings 페이지 등 다른 컴포넌트가 사용) | R | — | — |

---

## 6. Field Mapping Table

| UI 섹션 | UI 필드 | state/props field | API response key | Supabase table / column | read source | write source | hardcoded/mock | self-edit | admin-edit |
|---|---|---|---|---|---|---|---|---|---|
| /cluster-4 Section 2 | 시즌 시작 주차 | `startWeekInfo.{year, seasonName, weekNumber}` | profile.growthInfo / weeks | `weeks.start_date` + `seasons.year/name` | `/api/profile` + `weeks` | (none) | demo: `DUMMY_WEEK_EXTRA` overrides | ✗ | ✗ |
| /cluster-4 Section 2 | 성장 가능/성공/실패/휴식 주차 | `growthPeriodStats.{availableWeeks, approvedWeeks, unapprovedWeeks, restWeeks, clubBreakWeeks}` | profile.growthInfo + `user_weekly_growth` aggregation | `user_weekly_growth.{is_success, is_resting, is_club_break}` | `/api/profile` | (none) | demo hardcoded | ✗ | ✗ |
| /cluster-4 Weekly Cards | 주차 정보 (year/season/week/date) | `dbWeeklyData[].{weekNumber, seasonYear, seasonName, startDate, endDate, isClubBreak, isBreakSeason, holidayName, termNumber}` | weeks + seasons | `weeks.{id, week_number, start_date, end_date, is_club_break, holiday_name}` + `seasons.{id, year, name, term_number}` | direct `supabase.from('weeks')` | (none) | demo: `DUMMY_WEEKLY_LIST` | ✗ | ✗ |
| /cluster-4 Weekly Cards | 성장 상태 | `dbWeeklyData[].growthStatus` (계산) | user_weekly_growth | `user_weekly_growth.{is_success, is_resting, is_club_break}` | direct `supabase.from('user_weekly_growth')` | (none) | demo `growthStatus` 직접 | ✗ | ✗ |
| /cluster-4 Weekly Cards | 단감/인절미/어흥 누적값 | `weekPoints`, `getCumulativeInjeolmi` | points | `points.{user_id, week_id, point_type, points}` | direct `supabase.from('points')` | (none) | demo `DUMMY_WEEK_EXTRA.points` | ✗ | ✗ |
| /cluster-4 Weekly Cards | 4강화율 (info/competency/experience/career) | 계산된 `weeklyInfoRate` 등 | activity_types + weekly_activities + activity_records + career_projects + career_records | 5개 테이블 join | direct supabase + `/api/profile` | (none) | demo `DUMMY_WEEK_EXTRA.{infoRate, competencyRate, experienceRate, careerRate}` | ✗ | ✗ |
| /cluster-4 Weekly Cards | 주차 평판 카운트 / FM | `weeklyReputationCounts[weekId]`, `weeklyFmScores[weekId]` | weekly-reputations | `weekly_reputations.{week_card_id, target_user_id, rating}` | `/api/weekly-reputations` | (other users write) | demo `DUMMY_WEEK_EXTRA.{reputationCount, fmScore}` | ✗ (남이 작성) | ✗ |
| /cluster-4 Weekly Cards | 연계 동료 카운트 | `weeklyColleagueCounts[weekId]` | weekly-colleagues | `weekly_colleagues.{user_id, week_card_id}` | `/api/weekly-colleagues` (Front aggregation 미확인) | self write | demo `DUMMY_WEEK_EXTRA.colleagueCount` | self-only | header override |
| /cluster-4 Weekly Cards | 팀/파트/역할 | `getTeamPartForDate`, `getRoleForDate` | userTeamParts + userRoleHistory + teams + parts | `user_team_parts.{team_id, part_id, joined_at, left_at, generation, managed_team_id}` + `user_role_history.{role, started_at, ended_at}` | `/api/profile` | (none in this view — 관리되는 곳이 별도) | demo `DUMMY_WEEK_EXTRA.teamPart, roleLabel` | ✗ | ✗ |
| /cluster-4-1 Section 3 area-5 | 시즌 별점 (rating) | `currentSeason.rating` ⇄ `seasonReviewEditData.rating` | season-review GET | `user_season_histories.rating` | `/api/season-review` | `/api/season-review` PUT | demo `DUMMY_SEASON_DATA.rating=10` | ✅ owner only | ❌ admin override 없음 (route가 엄격 ownership 검증) |
| /cluster-4-1 Section 3 area-5 | 시즌 review | `currentSeason.review` ⇄ `seasonReviewEditData.review` | season-review | `user_season_histories.review` | `/api/season-review` | `/api/season-review` PUT | demo `REVIEW_COMMENT_DEFAULT` 상수 | ✅ owner only | ❌ |
| /cluster-4-1 area-9 | 시즌 평판 7장 | `seasonReputations[]` ⇄ modal `seasonReputationEditData` | season-reputations | `season_reputations.{reviewer_id, target_user_id, season_history_id, rating, content, keyword_1, keyword_2, keyword_3}` | `/api/season-reputations` GET | POST/PUT/DELETE | demo `DUMMY_SEASON_REPUTATIONS` | reviewer = self (남에 대해) | PUT/DELETE admin override |
| /cluster-4-1 area-9 | 평판 키워드 후보 | `reputationKeywords` | reputation-keywords | `reputation_keywords.{id, cluster_number, cluster_name, cluster_color, keyword}` | `/api/reputation-keywords` | (admin seed POST) | hardcoded 100개 fallback | ✗ | seed-only |
| /cluster-4-1 area-8 | 시즌 상태 (운영진 history) | `seasonRoles[]` | profile.userRoleHistory | `user_role_history.{role, started_at, ended_at}` + team/part | `/api/profile` | (none) | demo `DUMMY_SEASON_DATA.seasonRoles` | ✗ | ✗ |
| /cluster-4-card Weekly Review 박스 | content/rating | `weeklyReviewFromDB.{content, rating}` ⇄ modal | weekly-reviews | `weekly_reviews.{user_id, week_card_id, rating, content}` | `/api/weekly-reviews` GET | POST or PUT `/api/weekly-reviews/[id]` | (none) | ✅ owner | ✅ admin override |
| /cluster-4-card 평판 카드 | rating/content/keyword | `weeklyReputations[]` ⇄ modal | weekly-reputations | `weekly_reputations.{reviewer_id, target_user_id, week_card_id, rating, content, keyword}` | `/api/weekly-reputations` | POST/PUT/DELETE | (reviewer enrich is real) | reviewer = self about 남 | PUT/DELETE admin |
| /cluster-4-card 연계 동료 | rank/message | `selectedColleagues[]` | weekly-colleagues | `weekly_colleagues.{user_id, week_card_id, colleague_id, rank, message}` | `/api/weekly-colleagues` GET | POST (delete+insert) | demo overrides via DUMMY_WEEK_CARD | self-only via session | extractTargetUserId override |
| /cluster-4-card 실무 정보/역량/경험 modal | sub_title / output_links / image_urls / image_captions / growth_point | `editingDetails`, `weekActivityDetails` | activity-details GET / weekBundle | `user_activity_details.{user_id, week_id, activity_type_id, sub_title, output_links, growth_point, image_urls, image_captions}` | `/api/profile`(weekBundle) + `/api/activity-details` GET | POST `/api/activity-details` upsert + POST `/api/activity-details/upload-image` (Supabase Storage) | (none for owner writes) | ✅ deadline 기반 gate | extractTargetUserId override (단 deadline 통과 필요) |
| /cluster-4-card 실무 경력 | project + supervisor info | `careerRecords[]` | career-records | `career_projects.{id, week_id, company_name, company_logo_url, job_position, project_name, project_description, output_links, output_images, supervisor_*}` + `career_records.{user_id, week_id, project_id, enhancement_status, grade}` | `/api/career-records` GET | (활성화 라인은 activity-details에 저장됨 — `record_id`만 career_records에 들어감) | demo `careerRecords` 하드코딩 3장 | ✗ (project는 admin이 만듦) | ✗ |
| /cluster-4-card 4 stats 진행률 | `infoStats`, `competencyStats`, `experienceStats`, `careerStats` | (계산) | weekBundle aggregation | activity_records + career_records + activity_types eligibility | `/api/profile` | (none) | resultsDecided가 false면 "-" | ✗ | ✗ |

---

## 7. Hardcoded / mock / fallback 목록

### Mock 데이터 (`isDemoMode()` 분기 안에서만 활성)
| 위치 | 내용 | 사용처 | DB write 위험 |
|---|---|---|---|
| `constants/dummyData/cluster4-weekly-dummy.ts` | `DUMMY_WEEKLY_LIST` (20 weeks `dw-01..dw-20`), `DUMMY_WEEK_EXTRA` (per-week points/team/part/role/rates/평판카운트) | Cluster41Content, Cluster4CardContent | ❌ 없음 (state-only) |
| `constants/dummyData/cluster4-season-dummy.ts` | `DUMMY_SEASON_DATA` (1 시즌 전체 stats/circles/progress/roles/reputations), `DUMMY_SEASON_HISTORIES`, `REVIEW_COMMENT_DEFAULT` | Cluster4Content | ❌ 없음 |
| `constants/dummyData/cluster4-card-dummy.ts` | `DUMMY_WEEK_CARD` (dw-01 카드: weeklyActivities + activityDetails + activityRecords + careerRecords) | Cluster4CardContent | ❌ 없음 |
| `data/weeklyData.ts` | legacy `weeklyData[]` | **import 되지 않음 — dead code** | ❌ |

### Hardcoded 상수
| 위치 | 내용 |
|---|---|
| `Cluster41Content.tsx:59-100` | `demoWeekOverrides`(데모 유저별 팀/파트/role/points override) — 단 import된 `DUMMY_WEEK_EXTRA['dw-01']`을 **mutate** (line 102) |
| `Cluster41Content.tsx:115-120` | `demoCollectionMessage`("현재 클럽은, 26년 봄 시즌, 1주차를 진행 중에 있습니다." 등 데모 유저별 메시지) |
| `Cluster41Content.tsx:489-505` | `roleLabels` (18개 role 코드 → 한글) |
| `Cluster41Content.tsx:1261-1270` | dropdown options 문자열 |
| `Cluster41Content.tsx:1388-1434` | `getWeekImagePath()` 이미지 경로 매핑 |
| `Cluster41Content.tsx:2087, 2197` | `'-'` placeholder (role/team 없을 때) |
| `Cluster41Content.tsx:2167` | `/25` cumulative 분모 |
| `Cluster41Content.tsx:2115, 2278` | `/4` 주차 평판 분모 |
| `Cluster41Content.tsx:2280` | `/3` 동료 분모 |
| `Cluster4Content.tsx:36-157` | `DUMMY_SEASON_REPUTATIONS` (6장) |
| `Cluster4Content.tsx:248-309` | `SEASON_KEYWORDS_FALLBACK` (100개 키워드 5 cluster — demo only) |
| `Cluster4Content.tsx:1247` | `profilePhotoUrl = "/images/0/cluster4/cluster4-1/이안0.png"` 초기값 |
| `Cluster4Content.tsx:201-217, 1982-1997` | `roleLabels` 매핑 |
| `Cluster4Content.tsx:1839-1851` | `seasonNameMap` (en→ko), 시즌 이미지 경로 hardcode |
| `Cluster4Content.tsx:549` | `SEASON_REPUTATION_SLOT_COUNT = 7` |
| `Cluster4Content.tsx:160-198` | `defaultSeasonData` (seasonHistories 비었을 때 fallback — **demo & not-demo 둘 다**) |
| `Cluster4CardContent.tsx:90,99` | `WORKINFO_IMAGE_SLOT_COUNT=4`, `WORKCAREER_IMAGE_SLOT_COUNT=3` |
| `Cluster4CardContent.tsx:153-231` | `KEYWORD_GROUPS` (5 그룹) |
| `Cluster4CardContent.tsx:262` | `NICKNAME_COLORS[4]` |
| `Cluster4CardContent.tsx:107-108, 561, 727` | DEMO_COMPANY_LOGOS, DEMO_SUPERVISOR_PHOTOS 경로 |
| `Cluster4CardContent.tsx:675-755` | `careerRecords` 초기값에 데모 3장 들어가 있음 (state 초기값) |
| `Cluster4CardContent.tsx:786-830` | competency/experience icon map |
| `Cluster4CardContent.tsx:1160-1162` | `VISIBLE_OFFSET_MINUTES=1`, `COUNTING_START_HOURS=144`, `RESULT_DECIDED_MINUTES=15121` |
| `Cluster4CardContent.tsx:5909` | `<span className="badge-count">99</span>` (heart count 항상 99) |
| `Cluster4CardContent.tsx:5924` | "아직 작성된 리뷰가 없습니다…" fallback 텍스트 |
| `Cluster4CardContent.tsx:894` | `"00. 00. 00(0)  00:00"` placeholder timestamp |
| `app/(host)/api/reputation-keywords/route.ts:7-117` | 100개 키워드 hardcoded fallback (DB 실패 시 synthetic ID로 반환) |

### "-" / "로딩 중…" / 0 fallback
- 모든 "-": 데이터 missing 시 표시. DB write 없음.
- "로딩 중…", "표시할 주차가 없습니다.", "아직 작성된 리뷰가 없습니다." 등 모든 placeholder는 **view-only**, 어디서도 DB로 흘러 들어가지 않음.

### 위험 신호 (Cluster3에서 배운 패턴과 비교)
**없음 (좋음).** Cluster4 dummy data는:
- `isDemoMode()`(localStorage) 분기 안에서만 활성
- 어떤 mutation 핸들러도 dummy 객체를 그대로 POST/PUT 하지 않음
- Cluster3의 "page 로드 시 default seed를 user_table에 upsert" 같은 패턴이 **존재하지 않음**

다만 **잠재 위험 2종**이 있음:
1. `Cluster4Content.tsx:1247`에서 `profilePhotoUrl` 초기값이 `/images/0/cluster4/cluster4-1/이안0.png` 정적 파일 — `/api/profile` fetch가 늦거나 실패하면 이 정적 이미지가 표시되는데, 만약 admin이 "현재 사진" 상태로 오해해서 그대로 저장하면 잘못된 이미지가 DB로 들어갈 수 있음. (현재 코드는 사진 수정 API 호출이 없으므로 실재 위험 0이지만 admin editor 추가 시 주의.)
2. `app/(host)/api/reputation-keywords/route.ts`의 GET hardcoded fallback이 synthetic `id`를 반환 — admin이 그 synthetic id로 평판을 작성하면 backend FK 위반으로 실패.

---

## 8. Self-edit 가능 필드 (현재 Front에서 작동 중)

| 테이블 | 필드 | UI | Endpoint |
|---|---|---|---|
| `user_activity_details` | sub_title, output_links, growth_point, image_urls, image_captions (per user_id+week_id+activity_type_id) | /cluster-4-card 4개 modal | POST `/api/activity-details` + POST `/api/activity-details/upload-image` |
| `weekly_reviews` | rating(1-10), content(1-200) | /cluster-4-card Weekly Review 박스 | POST `/api/weekly-reviews`, PUT `/api/weekly-reviews/[id]` |
| `weekly_colleagues` | colleague_id, rank, message (full replace per user_id+week_card_id) | /cluster-4-card 연계 동료 modal | POST `/api/weekly-colleagues` |
| `weekly_reputations` | rating, content, keyword (reviewer가 남에 대해 작성, target_user_id가 다른 유저) | /cluster-4-card 평판 7장 | POST/PUT/DELETE `/api/weekly-reputations` |
| `season_reputations` | rating, content, keyword_1/2/3 (reviewer가 남에 대해, target_user_id 다름) | /cluster-4-1 area-9 | POST/PUT/DELETE `/api/season-reputations` |
| `user_season_histories` | rating, review (자기 자신만) | /cluster-4-1 area-5 Season Review | PUT `/api/season-review` |

---

## 9. Admin-edit 필요 필드 (Admin editor가 새로 와야 하는 것)

Cluster4의 일관된 Admin 시나리오는 "타 유저의 view + override edit"인데, 다음 두 종류로 나눠야 함.

### A. 이미 admin override가 backend에서 지원됨 — Admin UI 만들면 끝
| 필드 | API admin gate | 비고 |
|---|---|---|
| `user_activity_details` 모든 컬럼 | `extractTargetUserId(request)` header로 admin이 타 유저로 가장 | **deadline gate 통과 필요** — admin도 마감 지난 주차는 못 씀 → admin UI는 `secondary_info_grants` 부여 흐름이 같이 있어야 함 |
| `weekly_reviews` rating/content | PUT/DELETE `isAdminEmail()` 통과 시 ownership bypass | ✅ |
| `weekly_reputations` rating/content/keyword | PUT/DELETE `isAdminEmail()` bypass | ✅ POST는 reviewer_id가 admin 자신이 되므로 admin이 "남 대신 작성"하는 의도는 별도 설계 필요 |
| `weekly_colleagues` | POST에 `extractTargetUserId` 적용됨 | ✅ 단 delete+insert 패턴이라 atomicity 약함 — admin 편집 시 트랜잭션 보강 필요 |
| `season_reputations` rating/content/keyword_1/2/3 | PUT/DELETE `isAdminEmail()` bypass | ✅ |

### B. Backend에 admin override가 아직 없음 — backend route 보강 + Admin UI 필요
| 필드 | 누락된 admin path |
|---|---|
| `user_season_histories.{rating, review}` | `/api/season-review` PUT은 **엄격 ownership 검증만** 있고 `isAdminEmail` 분기 없음 → admin이 시즌 review를 대신 수정 불가 |
| `reputation_keywords` 마스터 데이터 | POST가 admin-only로 명시적 gate 없음 (그냥 admin client 호출) — 정식 admin-only 검증 추가 필요 |
| 주차 마스터(`weeks`), 시즌 마스터(`seasons`), `activity_types`, `weekly_activities`(deadline 부여) | Cluster4 자체 read만, 어떤 API도 write 노출 없음 — admin UI가 별도로 다뤄야 함 |
| `points`, `user_weekly_growth`, `activity_records` (성장 성공 판정, 단감/인절미/어흥 부여) | Front read only. 현재 backend POST/PUT route 자체가 노출 안 됨. Admin이 결과 강제 변경하려면 신규 admin-only endpoint 필요 |
| `career_projects` (회사/감독자/직무) | Front read only (`/api/career-records` GET만 노출). Admin이 프로젝트 마스터를 만들거나 업데이트하려면 admin-only endpoint 필요 |
| `secondary_info_grants` (deadline 지난 주차에 대해 admin이 작성 권한 부여) | 신규 endpoint 필요 |

---

## 10. 신규 Supabase table/column 필요 후보

**원칙: 새 테이블을 함부로 만들지 말 것** — 거의 모든 canonical source가 이미 있음.

새 테이블이 **반드시 필요한 것은 없음**. 다만 다음 정도가 보강 후보로 고려 가능 (이번 작업 범위 밖, 결정은 사람이 해야 함):

1. **`weeks.image_url`** (또는 `week_assets` 별도 테이블) — 현재 주차 이미지는 `Cluster41Content.tsx:1388-1434`에서 파일명 규칙 기반 하드코딩(`/images/0/cluster4/주차 이미지/{season}_{week}.png`). Admin이 주차별 대표 이미지를 교체할 수 있게 하려면 컬럼 또는 별도 테이블 필요.
2. **`seasons.image_url`** — 동일 이유, 시즌별 이미지가 `Cluster4Content.tsx:1846-1851`에서 하드코딩.
3. **`weekly_activities.admin_link_locks`** (또는 column flag) — 첫 N슬롯이 admin 링크인지/유저 입력인지 구분은 현재 UI에서 처리되지만 DB에는 없음. Admin UI에서 명시적으로 락걸려면 컬럼 필요.

**현 단계에서는 신규 컬럼/테이블 없이도 Admin UI 구축이 가능**한 것으로 판단.

---

## 11. Source-of-truth 위험 지점 (Cluster2/3 교훈 적용)

| # | 위험 | 위치 | 영향 |
|---|---|---|---|
| 1 | **READ 엔드포인트 무인증** — `/api/weekly-reputations` GET, `/api/weekly-colleagues` GET, `/api/weekly-reviews` GET(userId 명시 시), `/api/activity-details` GET, `/api/career-records` GET, `/api/season-reputations` GET 전부 NextAuth session 검증 없이 `targetUserId` 쿼리로 누구나 read 가능. | route.ts | 프라이버시. Admin editor 도입 시 "admin만 남의 데이터 보기"라는 기대를 backend가 enforce하지 않음. |
| 2 | **카멜/스네이크 mixing in body** — `/api/weekly-reputations` POST body는 `targetUserId, weekCardId`(camel) → column은 `target_user_id, week_card_id`(snake). `/api/season-reputations` POST body는 `keyword1/2/3`(camel) → column은 `keyword_1/2/3`(snake). API 라우트에서 명시적 destructure로 변환되고 있으나 **추가 필드가 생길 때 누락 위험**. | 각 route.ts의 POST | 신규 필드 추가 시 silent drop |
| 3 | **`/api/season-review` PUT에 admin override 없음** | `app/(host)/api/season-review/route.ts:91` | Admin이 타 유저의 시즌 리뷰를 수정/대필할 경로 없음 — Admin UI 만들 때 backend도 같이 손봐야 함 |
| 4 | **`/api/activity-details` POST deadline gate가 admin도 막음** | `app/(host)/api/activity-details/route.ts:179` | Admin이 마감 지난 주차를 보강하려면 `secondary_info_grants` 행을 먼저 만들거나 별도 admin endpoint가 필요 |
| 5 | **`/api/weekly-colleagues` POST가 delete+insert(non-atomic)** | `app/(host)/api/weekly-colleagues/route.ts:180-201` | 네트워크 중단 시 동료 리스트 손실 |
| 6 | **`/api/reputation-keywords` GET이 DB 실패 시 hardcoded synthetic id 반환** | `app/(host)/api/reputation-keywords/route.ts:135-150` | synthetic id로 작성된 평판은 FK 위반으로 POST 실패 — 사용자에게 "작성됨"으로 오해될 수 있음 |
| 7 | **`Cluster4Content.tsx:160-198 defaultSeasonData` fallback이 demo 외에서도 사용** | seasonHistories 비었을 때 fallback (line 1256) | non-demo prod에서 신규 가입자에게 임시 시즌 카드가 잘못 표시 가능 — 단 DB write 없음 |
| 8 | **`Cluster41Content.tsx:102` `DUMMY_WEEK_EXTRA['dw-01'] = demoWeekOverrides[name]` mutation** | imported object를 in-place mutate | demo 모드 안에서만 작동하지만 import 객체 직접 변형 = 다른 컴포넌트가 같은 dummy data 참조할 때 cross-contamination 가능성 |
| 9 | **`careerRecords` state 초기값이 데모 3장으로 시작** | `Cluster4CardContent.tsx:675-755` | non-demo 환경에서 잠깐이라도 데모 3장이 표시되다가 API 응답 후 교체됨. UX flicker. 단 DB write 없음. |
| 10 | **3개 컴포넌트가 동일 데이터를 다른 경로로 fetch** — Section 2 시즌 정보는 Cluster41Content가 `supabase.from('weeks')` 직접 호출 + `/api/profile`을 둘 다 쓰고, Cluster4Content도 같은 시즌 정보를 `/api/profile`만으로 받음 | Cluster41Content vs Cluster4Content | 데이터가 일치하지 않을 수 있음. Admin이 weeks 마스터를 수정해도 어디서 캐싱되는지 추적이 어려움 |
| 11 | **dedupedJson 캐싱 + 저장 후 명시적 refetch 누락 가능** | `Cluster4Content.tsx` 곳곳, save 후 list refresh를 명시적으로 호출 | Admin이 저장 후 다시 모달 열면 stale 데이터 보일 위험 |
| 12 | **`/api/profile` context=card 분기의 weekBundle은 server-side aggregation** | profile/route.ts | weeks/activity_types/career_projects/teams 등 마스터를 Front에 노출하는 사실상 단일 진입점 — Admin이 마스터 변경 시 캐시 무효화 전략 필요 |

---

## 12. 추천 작업 순서

> **원칙: Cluster4 본체 Front를 그대로 두고, Admin 모드 진입을 강화하는 방향.** 새 페이지를 만들기보다 `?userId=...&admin=true` 진입을 정식 지원하는 것이 가장 적은 코드 변경.

### Phase 0 — 결정 안건 (코드 변경 전, 사람이 합의)
1. Admin이 Cluster4를 편집할 때 **별도 `/admin/cluster-4/[userId]` 페이지를 만들지**, 아니면 **기존 Cluster4 페이지에 `?admin=true` 진입으로 admin chrome만 추가할지**.
2. `weekly_activities.deadline` 지난 주차에 대한 admin 편집 정책: ① admin이 `secondary_info_grants` 행을 만들고 일반 흐름 사용 ② admin 전용 endpoint를 별도로 두어 deadline 무시.
3. `/api/season-review` PUT에 admin override를 어디까지 허용할지 (시즌 review는 자기 자신 회고이므로 admin이 대필하는 것이 적절한지).

### Phase 1 — Read-side hardening (Admin UI 깔기 전 필수)
1. 모든 GET 엔드포인트(weekly-reputations / weekly-colleagues / activity-details / career-records / weekly-reviews / season-reputations)에 **NextAuth session + (owner OR admin)** 검증 추가. 현재 누구나 read 가능한 상태가 admin UI의 보안 가정과 충돌함.
2. `/api/reputation-keywords` GET hardcoded fallback 제거 또는 synthetic id 대신 503 응답.
3. `Cluster4Content.tsx:1256`의 `defaultSeasonData` fallback을 non-demo에서는 비활성화 (현재 데이터 없는 신규 유저에게 가짜 시즌이 잠시 표시되는 UX 정리).

### Phase 2 — Backend admin path 보강 (신규 API 0개 목표, 기존 라우트만 손봄)
1. `/api/season-review` PUT에 `isAdminEmail` 분기 추가 → admin override 활성화. (PR 1개)
2. `/api/activity-details` POST의 deadline gate에 admin bypass 옵션 또는 `secondary_info_grants` upsert 헬퍼를 admin 엔드포인트로 분리. (PR 1개)
3. `/api/weekly-colleagues` POST를 Postgres function 또는 트랜잭션 wrapper로 묶어 atomicity 확보. (선택)

### Phase 3 — Admin UI (라우트 신규 또는 chrome wrapper)
1. **Cluster4 본체 페이지에 admin chrome layer만 추가**하는 방식 추천 (옵션 ①):
   - URL: `/cluster-4-card/{weekId}?userId={targetId}&admin=true`
   - 기존 컴포넌트는 그대로 두고, 상단에 admin banner + lock override switch + 시간 게이트 무시 토글만 노출
   - 모든 mutation은 이미 `apiUrl()` helper로 `targetUserId`를 붙이게 되어 있으므로 추가 코드 거의 0
2. Admin이 마스터 데이터(weeks, seasons, weekly_activities)를 수정해야 하는 부분은 **본 작업 범위 밖** — Cluster4 운영화 1차에서는 user-level 데이터(평판/리뷰/동료/2차 정보)만 admin이 편집할 수 있게 하는 것을 목표로.

### Phase 4 — Drift 방지
1. `weekly-reputations`/`season-reputations` POST body 키 camelCase ↔ DB snake_case 변환을 한 곳(zod schema + mapper)으로 집중시켜 새 필드 추가 시 자동 적용되게.
2. `/api/profile` context=card 분기에서 반환되는 weekBundle의 응답 shape를 **TypeScript 타입으로 명시**(현재 Cluster4CardContent에서 인라인 destructuring으로 받음)해, 새 컬럼 추가 시 컴파일러가 잡도록.

### Phase 5 — Cluster2/3 교훈 적용 검증
- 작업 후 다음 항목이 여전히 0인지 확인:
  - "page 로드 시 default seed가 DB에 upsert" → 0
  - "Front read vs save가 다른 테이블/뷰" → 0
  - "Admin이 write하는 곳과 Front가 read하는 곳이 다름" → 0
  - "snake/camel mapping mismatch로 silent field drop" → 1→0 (Phase 4 완료 후)
  - "demo seed가 prod 환경에서 잠시 표시" → Cluster4Content `defaultSeasonData`만 남음 → Phase 1.3에서 제거

---

**조사 요약**: Cluster4는 Cluster2/3과 달리 **이미 Supabase canonical에 정착**한 클러스터이며, 가장 큰 작업은 신규 테이블/엔드포인트가 아니라 **(a) read 엔드포인트 인증 보강, (b) `/api/season-review` admin override 추가, (c) admin chrome layer UI 추가** 세 가지로 압축됩니다. Schema drift / sample overwrite 위험은 demo 모드 localStorage 분기 안에 격리되어 있어 Cluster2/3 수준의 폭발력은 없습니다.

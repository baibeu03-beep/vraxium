# 더미 데이터 분석 → 데이터베이스 테이블 설계 보고서

> 분석일: 2026-04-03  
> 대상: Carrer-Resume 프로젝트 (Next.js 14 + Supabase)  
> 분석 범위: constants/dummyData/*, data/*, types/*, app/api/*, backend/database/schema/*

---

## 1. 더미 데이터 파일별 분석

### 파일 1: `constants/dummyData/resume-card-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | 이력서 카드 (Cluster 1 — 사이드바 프로필) |
| Export | `DUMMY_USER_PROFILE`, `DUMMY_SIDEBAR_EXTRA` |

**DUMMY_USER_PROFILE 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| name | string | 이름 |
| nameEng | string | 영문 이름 |
| gender | string | 성별 (남/여) |
| birthDate | string | 생년월일 |
| city | string | 시/도 |
| district | string | 구/군 |
| phone | string | 연락처 |
| email | string | 이메일 |
| school | string | 대학교명 |
| major / major2 / major3 | string | 전공 (최대 3개) |
| enrollPeriod | string | 재학 기간 |
| graduationStatus | string | 재학/졸업/휴학 |
| gpa / gpaMax | string | 학점 / 만점 |
| quote | string | 좌우명 |
| photo | string | 프로필 사진 URL |

**DUMMY_SIDEBAR_EXTRA 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| completionRate | number | 완성도 (0~100) |
| reliabilityRate | number | 신뢰도 |
| badgeData.stars | number | 별 포인트 |
| badgeData.lightnings | number | 번개 포인트 |
| badgeData.shields | number | 방패 포인트 |
| practicalInfo | number | 실무 정보 점수 |
| practicalCompetency | number | 실무 역량 점수 |
| practicalExperience | number | 실무 경험 점수 |
| practicalCareer | number | 실무 커리어 점수 |
| crewStatus | string | 크루 상태 ("Complete" 등) |

**관계**: user_profiles, user_cumulative_points, user_growth_stats, user_cumulative_compliance_rates

---

### 파일 2: `constants/dummyData/cluster2-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 2 — 자기소개 페이지 (사진, 슬로건, 영상, 학력, 리뷰, 소개글) |
| Export | `CLUSTER2_DUMMY_PHOTOS`, `CLUSTER2_DUMMY_SLOGANS`, `CLUSTER2_DUMMY_VIDEOS`, `CLUSTER2_DUMMY_EDUCATIONS`, `CLUSTER2_DUMMY_REVIEWS`, `CLUSTER2_DUMMY_INTRO` |

**CLUSTER2_DUMMY_PHOTOS 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| mainPhoto | string | 메인 사진 URL |
| subPhotos | (string \| null)[] | 서브 사진 URL 4개 |

**CLUSTER2_DUMMY_SLOGANS 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| engName | string | 영문 이름 |
| slogan1~3.option | string | 슬로건 태그 (Dreamer/Pioneer/Warrior) |
| slogan1~3.content | string | 슬로건 내용 |
| slogan1~3.rating | number | 슬로건 평점 |

**CLUSTER2_DUMMY_VIDEOS 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| videoUrl1~3 | string \| null | 영상 URL (최대 3개) |

**CLUSTER2_DUMMY_EDUCATIONS 구조** (배열):

| 필드명 | 타입 | 설명 |
|--------|------|------|
| eduLevel | string | 학력 수준 (고등학교/대학교(4년)) |
| school | string | 학교명 |
| status | string | 졸업/재학 |
| category | string | 계열 (인문계열 등) |
| major1 / major2 / major3 | string | 전공 |
| period | string | 재학 기간 |
| startYear / startMonth | string | 입학 년/월 |
| endYear / endMonth | string | 졸업 년/월 |
| gradeMax / gradeValue | string | 만점/학점 |
| description | string | 설명 |
| isFinal | boolean | 최종학력 여부 |

**CLUSTER2_DUMMY_REVIEWS 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| cluvingReviewLink | string | 클루빙 리뷰 링크 |
| reviewLinks | string[] | 리뷰 URL (최대 10개) |

**CLUSTER2_DUMMY_INTRO 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| growthStory | string | 성장 스토리 |
| socialExperience | string | 사회 경험 |
| careerDirection | string | 커리어 방향 |
| workStyle | string | 업무 스타일 |
| personalStory | string | 개인 이야기 |

**관계**: user_introductions, user_educations, user_profiles

---

### 파일 3: `constants/dummyData/cluster3-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 3 — 포트폴리오 페이지 (신뢰도, 포인트, 등급, 성장기간, 아카이브/아웃풋/디테일) |
| Export | `CLUSTER3_DUMMY_PROFILE`, `CLUSTER3_DUMMY_ARCHIVES`, `CLUSTER3_DUMMY_ARCHIVE_CHANNELS`, `CLUSTER3_DUMMY_OUTPUTS`, `CLUSTER3_DUMMY_OUTPUT_CHANNELS`, `CLUSTER3_DUMMY_DETAILS`, `CLUSTER3_DUMMY_DETAIL_CHANNELS` |

**CLUSTER3_DUMMY_PROFILE 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| reliabilityRate | number | 신뢰도 |
| engName | string | 영문 이름 |
| pointsData.dangam | number | 단감 포인트 |
| pointsData.injeolmi | number | 인절미 포인트 |
| pointsData.eoheung | number | 어흥 포인트 |
| gradeStats.avgPercentile | number | 평균 백분위 |
| gradeStats.grade | number | 등급 |
| gradeStats.gradeLabel | string | 등급 라벨 (정 2품 등) |
| growthPeriodStats.approvedWeeks | number | 승인 주차 |
| growthPeriodStats.unapprovedWeeks | number | 미승인 주차 |
| growthPeriodStats.restWeeks | number | 개인 휴식 주차 |
| growthPeriodStats.clubBreakWeeks | number | 공식 휴식 주차 |
| growthPeriodStats.availableWeeks | number | 가용 주차 |
| growthPeriodStats.restSeasons | number | 휴식 시즌 수 |
| growthPeriodStats.approvedSeasons | number | 승인 시즌 수 |

**아카이브/아웃풋/디테일**: URL 배열 + 채널 배열 (instagram/youtube/blog/tistory/twitter/threads/tiktok/behance/etc)

**관계**: user_introductions, user_growth_stats, user_cumulative_points, user_reliability_rates

---

### 파일 4: `constants/dummyData/cluster4-season-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 4 — 시즌 페이지 (시즌 정보, 포인트, 별점, 차트, 강화율, 크루 역할, 평판) |
| Export | `DUMMY_SEASON_DATA`, `DUMMY_SEASON_HISTORIES` |

**DUMMY_SEASON_DATA 구조**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| id | string | 시즌 ID |
| year | string | 연도 |
| season | string | 시즌명 (봄/여름/가을/겨울) |
| dateRange | string | 기간 |
| status | string | 상태 (시즌 진행 중/성장 완료/성장 휴식/성장 중단) |
| statusClass | string | CSS 클래스 |
| image | string | 시즌 이미지 URL |
| approvedWeeks | number | 승인 주차 수 |
| totalWeeks | number | 총 주차 수 |
| isQualified | boolean | 자격 여부 |
| roleInSeason | string | 시즌 역할 (운영진(앰배서더)/심화(파트장)/일반) |
| stats.dangam / injeolmi / eoheung | number | 포인트 |
| rating | number | 별점 (0~10) |
| review | string | 시즌 리뷰 (30자) |
| reviewLink | string | 리뷰 링크 |
| circles.* | number | 원형 차트 지표 (주간활용도/일정신뢰도/시즌성장/승인주차/운영주차/신뢰주차/완료활동/전체활동) |
| progress.info/competency/experience/career | object | 강화율 {total, completed, rate} |
| seasonRoles[] | array | 크루 역할 배열 (profileImage/teamName/partName/roleLabel/isAdmin/adminGeneration) |
| seasonReputations[] | array | 시즌 평판 배열 (id/rating/content/keyword_1~3/fmScore/created_at/reviewer{...}) |

**DUMMY_SEASON_HISTORIES**: 위와 동일한 구조의 시즌 히스토리 4개 (진행중/완료/휴식/중단)

**관계**: seasons, user_season_histories, user_team_parts, teams, parts, season_reputations, user_profiles

---

### 파일 5: `constants/dummyData/cluster4-weekly-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 4 — 주차 목록 페이지 |
| Export | `DUMMY_WEEKLY_LIST`, `DUMMY_WEEK_EXTRA` |

**DUMMY_WEEKLY_LIST 구조** (배열):

| 필드명 | 타입 | 설명 |
|--------|------|------|
| id | string | 주차 ID |
| weekNumber | number | 주차 번호 |
| seasonYear | number | 시즌 연도 |
| seasonName | string | 시즌명 |
| startDate | string | 시작일 |
| endDate | string | 종료일 |
| isClubBreak | boolean | 공식 휴식 여부 |
| isBreakSeason | boolean | 휴식 시즌 여부 |
| fromSeason / toSeason | string \| null | 전환 주차 (이전/다음 시즌) |
| holidayName | string \| null | 공휴일명 |
| termNumber | number \| null | 기수 |
| growthStatus | string | 성장 상태 (성공/실패/휴식(개인)/휴식(공식)) |

**DUMMY_WEEK_EXTRA 구조** (Record by week ID):

| 필드명 | 타입 | 설명 |
|--------|------|------|
| points.star / shield / lightning | number | 주차 포인트 |
| teamPart.teamName / partName | string \| null | 팀/파트명 |
| roleLabel | string | 역할 라벨 |
| growthRate.rate / count / total | number | 전체 성장률 |
| infoRate / competencyRate / experienceRate / careerRate | object | 실무 4섹션 비율 |
| reputationCount | number | 평판 수 |
| fmScore | number | FM 점수 |
| colleagueCount | number | 동료 수 |

**관계**: weeks, seasons, points, user_team_parts, weekly_reputations, weekly_colleagues

---

### 파일 6: `constants/dummyData/cluster4-card-dummy.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 4 — 주차 카드 상세 페이지 (평판, 동료, 성장률, 실무 카드) |
| Export | `DUMMY_WEEK_CARD_DATA` |

**주요 구조**:

| 영역 | 필드 | 설명 |
|------|------|------|
| 상단 | title, growthStatus, date, role, weekNumber, totalWeeks, team, part, stats | 주차 기본 정보 |
| 평판 | reputations[] | 리뷰어 정보 (name/gender/age/school/major/team/part/nickname/rating/comment/fmScore/tag) |
| 동료 | colleagues[] | 동료 정보 (name/gender/age/school/major/team/part/nickname/date) |
| 성장률 | growthRate | total/completed/rate |
| 실무-정보 | workSections.info.cards[] | category/categoryColor/status/mainTitle/body |
| 실무-역량 | workSections.ability.cards[] | code/category/rating/mainBody/subBody |
| 실무-경험 | workSections.experience.cards[] | code/category/rating/mainBody/subBody |
| 실무-커리어 | workSections.career.cards[] | grade/date/supervisorName/supervisorRole/categoryTag/currentBid/mainBody/subBody/profileImage |

**관계**: weeks, weekly_reputations, weekly_colleagues, weekly_activities, activity_records, career_records

---

### 기타 데이터 파일: `data/weeklyData.ts`

| 항목 | 내용 |
|------|------|
| 사용처 | Cluster 4 — 주차 카드 리스트 공용 데이터 |
| Export | `WeekData` 인터페이스, `weeklyData` 배열 |

**WeekData 인터페이스**:

| 필드명 | 타입 | 설명 |
|--------|------|------|
| id | number | 주차 ID |
| image | string | 주차 이미지 |
| title / shortTitle | string | 주차 제목 |
| dateRange | string | 기간 |
| status | string | 상태 |
| team / part / role | string | 팀/파트/역할 |
| tags | string[] | 태그 배열 |
| progress.week / schedule / growth | number | 진행률 |
| rating | number | 평점 |
| growthStatus | string | 성장 상태 |

---

## 2. 최종 테이블 설계안

Supabase(PostgreSQL) 기준. API 라우트 26개 + 더미 데이터 6개 + 기존 스키마 교차 분석 결과.

---

### 테이블 1: `user_profiles` — 사용자 기본 정보

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  auth_email TEXT,
  display_name VARCHAR(20) NOT NULL,
  eng_name VARCHAR(50),
  gender VARCHAR(5),
  birth_date DATE,
  city VARCHAR(20),
  district VARCHAR(20),
  phone VARCHAR(20),
  university VARCHAR(50),
  major_first VARCHAR(50),
  profile_photo_url TEXT,
  vision VARCHAR(50),
  quote TEXT,
  status VARCHAR(20) DEFAULT 'active',
  onboarding_week_id UUID REFERENCES weeks(id),
  joined_week_id UUID REFERENCES weeks(id),
  reliability_rate INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: 프로젝트의 중심 테이블. 거의 모든 테이블이 이 테이블을 참조.

---

### 테이블 2: `user_educations` — 학력 정보

```sql
CREATE TABLE user_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  education_level VARCHAR(20),
  school_name VARCHAR(50) NOT NULL,
  status VARCHAR(10),
  major_category VARCHAR(20),
  major_name_1 VARCHAR(50),
  major_name_2 VARCHAR(50),
  major_name_3 VARCHAR(50),
  admission_year VARCHAR(4),
  graduation_year VARCHAR(4),
  grade_max_type VARCHAR(5),
  grade_value VARCHAR(5),
  note TEXT,
  sort_order INT DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles → 1:N

---

### 테이블 3: `user_introductions` — 자기소개 통합

```sql
CREATE TABLE user_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 서브 사진
  sub_photo_1 TEXT,
  sub_photo_2 TEXT,
  sub_photo_3 TEXT,
  sub_photo_4 TEXT,

  -- 슬로건
  slogan_1 TEXT,
  slogan_1_tag VARCHAR(20),
  slogan_1_rating INT,
  slogan_2 TEXT,
  slogan_2_tag VARCHAR(20),
  slogan_2_rating INT,
  slogan_3 TEXT,
  slogan_3_tag VARCHAR(20),
  slogan_3_rating INT,

  -- 영상
  video_url_1 TEXT,
  video_url_2 TEXT,
  video_url_3 TEXT,

  -- 자기소개 5항목
  growth_story TEXT,
  social_experience TEXT,
  career_direction TEXT,
  work_style TEXT,
  personal_story TEXT,

  -- 리뷰 링크
  cluving_review_link TEXT,

  -- 포트폴리오 아카이브 (10개)
  portfolio_archive_1 TEXT,
  portfolio_archive_2 TEXT,
  portfolio_archive_3 TEXT,
  portfolio_archive_4 TEXT,
  portfolio_archive_5 TEXT,
  portfolio_archive_6 TEXT,
  portfolio_archive_7 TEXT,
  portfolio_archive_8 TEXT,
  portfolio_archive_9 TEXT,
  portfolio_archive_10 TEXT,

  -- 포트폴리오 아카이브 채널 (10개)
  portfolio_archive_channel_1 VARCHAR(20),
  portfolio_archive_channel_2 VARCHAR(20),
  portfolio_archive_channel_3 VARCHAR(20),
  portfolio_archive_channel_4 VARCHAR(20),
  portfolio_archive_channel_5 VARCHAR(20),
  portfolio_archive_channel_6 VARCHAR(20),
  portfolio_archive_channel_7 VARCHAR(20),
  portfolio_archive_channel_8 VARCHAR(20),
  portfolio_archive_channel_9 VARCHAR(20),
  portfolio_archive_channel_10 VARCHAR(20),

  -- 포트폴리오 아웃풋/디테일 (15개)
  portfolio_output_1 TEXT,
  portfolio_output_2 TEXT,
  portfolio_output_3 TEXT,
  portfolio_output_4 TEXT,
  portfolio_output_5 TEXT,
  portfolio_output_6 TEXT,
  portfolio_output_7 TEXT,
  portfolio_output_8 TEXT,
  portfolio_output_9 TEXT,
  portfolio_output_10 TEXT,
  portfolio_output_11 TEXT,
  portfolio_output_12 TEXT,
  portfolio_output_13 TEXT,
  portfolio_output_14 TEXT,
  portfolio_output_15 TEXT,

  -- 포트폴리오 아웃풋/디테일 채널 (15개)
  portfolio_output_channel_1 VARCHAR(20),
  portfolio_output_channel_2 VARCHAR(20),
  portfolio_output_channel_3 VARCHAR(20),
  portfolio_output_channel_4 VARCHAR(20),
  portfolio_output_channel_5 VARCHAR(20),
  portfolio_output_channel_6 VARCHAR(20),
  portfolio_output_channel_7 VARCHAR(20),
  portfolio_output_channel_8 VARCHAR(20),
  portfolio_output_channel_9 VARCHAR(20),
  portfolio_output_channel_10 VARCHAR(20),
  portfolio_output_channel_11 VARCHAR(20),
  portfolio_output_channel_12 VARCHAR(20),
  portfolio_output_channel_13 VARCHAR(20),
  portfolio_output_channel_14 VARCHAR(20),
  portfolio_output_channel_15 VARCHAR(20),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles → 1:1

---

### 테이블 4: `seasons` — 시즌 정보

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  name VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image TEXT,
  is_active BOOLEAN DEFAULT false
);
```

**관계**: weeks(1:N), user_season_histories(1:N)

---

### 테이블 5: `weeks` — 주차 정보

```sql
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_club_break BOOLEAN DEFAULT false,
  is_break_season BOOLEAN DEFAULT false,
  from_season VARCHAR(10),
  to_season VARCHAR(10),
  holiday_name VARCHAR(30),
  term_number INT
);
```

**관계**: seasons(N:1), weekly_activities(1:N), points(1:N)

---

### 테이블 6: `teams` — 팀

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

---

### 테이블 7: `parts` — 파트

```sql
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(30) NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

**관계**: teams(N:1)

---

### 테이블 8: `user_team_parts` — 사용자 팀/파트 배정

```sql
CREATE TABLE user_team_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  part_id UUID REFERENCES parts(id),
  season_id UUID REFERENCES seasons(id),
  joined_at DATE,
  left_at DATE,
  is_current BOOLEAN DEFAULT true
);
```

**관계**: user_profiles(N:1), teams(N:1), parts(N:1), seasons(N:1)

---

### 테이블 9: `user_season_histories` — 사용자 시즌 이력

```sql
CREATE TABLE user_season_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id),
  status VARCHAR(20),
  role_in_season VARCHAR(30),
  approved_weeks INT DEFAULT 0,
  total_weeks INT DEFAULT 0,
  is_qualified BOOLEAN DEFAULT false,
  rating INT DEFAULT 0,
  review TEXT,
  review_link TEXT,
  progress_status VARCHAR(20),
  review_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(N:1), seasons(N:1), season_reputations(1:N)

---

### 테이블 10: `user_growth_stats` — 성장 통계

```sql
CREATE TABLE user_growth_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  approved_weeks INT DEFAULT 0,
  unapproved_weeks INT DEFAULT 0,
  rest_weeks INT DEFAULT 0,
  club_break_weeks INT DEFAULT 0,
  approved_seasons INT DEFAULT 0,
  rest_seasons INT DEFAULT 0,
  available_weeks INT DEFAULT 0
);
```

**관계**: user_profiles(N:1)

---

### 테이블 11: `user_cumulative_points` — 누적 포인트

```sql
CREATE TABLE user_cumulative_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  total_stars INT DEFAULT 0,
  total_lightnings INT DEFAULT 0,
  total_shields INT DEFAULT 0
);
```

**관계**: user_profiles(N:1)

---

### 테이블 12: `user_cumulative_compliance_rates` — 누적 실무 참여율

```sql
CREATE TABLE user_cumulative_compliance_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  practical_info_participated INT DEFAULT 0,
  practical_competency_participated INT DEFAULT 0,
  practical_experience_participated INT DEFAULT 0,
  practical_career_participated INT DEFAULT 0
);
```

**관계**: user_profiles(N:1)

---

### 테이블 13: `user_reliability_rates` — 신뢰도

```sql
CREATE TABLE user_reliability_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reliability_rate INT DEFAULT 0,
  avg_percentile INT DEFAULT 0,
  grade INT DEFAULT 0,
  grade_label VARCHAR(20)
);
```

**관계**: user_profiles(N:1)

---

### 테이블 14: `points` — 주차별 포인트

```sql
CREATE TABLE points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  point_type VARCHAR(20) NOT NULL,
  points INT DEFAULT 0
);
```

**관계**: user_profiles(N:1), weeks(N:1)

---

### 테이블 15: `activity_types` — 활동 유형 마스터

```sql
CREATE TABLE activity_types (
  id TEXT PRIMARY KEY,
  cluster_id INT,
  line_code TEXT,
  line_name TEXT,
  eligible_min_approved_weeks INT,
  eligible_max_approved_weeks INT,
  count_once_in_total BOOLEAN DEFAULT false
);
```

---

### 테이블 16: `weekly_activities` — 주차별 활동

```sql
CREATE TABLE weekly_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  activity_type_id TEXT NOT NULL REFERENCES activity_types(id),
  is_active BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ
);
```

**관계**: user_profiles(N:1), weeks(N:1), activity_types(N:1)

---

### 테이블 17: `activity_records` — 활동 기록 (실무 정보 카드)

```sql
CREATE TABLE activity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  activity_type_id TEXT REFERENCES activity_types(id),
  is_completed BOOLEAN DEFAULT false,
  category VARCHAR(30),
  category_color VARCHAR(10),
  status VARCHAR(10),
  main_title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 테이블 18: `user_activity_details` — 2차 정보 (기존 스키마)

```sql
-- 기존 backend/database/schema/user-activity-details-schema.sql 참조
CREATE TABLE user_activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  activity_type_id TEXT NOT NULL,
  sub_title TEXT,
  output_links JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_id, activity_type_id)
);
```

---

### 테이블 19: `career_projects` — 커리어 프로젝트

```sql
CREATE TABLE career_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(50),
  company_logo_url TEXT,
  job_position VARCHAR(50),
  project_name VARCHAR(100),
  project_description TEXT
);
```

---

### 테이블 20: `career_records` — 커리어 기록

```sql
CREATE TABLE career_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES career_projects(id),
  is_active BOOLEAN DEFAULT false,
  career_code VARCHAR(20),
  line_code VARCHAR(20),
  line_name VARCHAR(50),
  enhancement_status VARCHAR(20),
  grade VARCHAR(5),
  grade_points VARCHAR(20),
  supervisor_name VARCHAR(20),
  supervisor_position VARCHAR(50),
  supervisor_department VARCHAR(50),
  supervisor_company VARCHAR(50),
  supervisor_profile_img TEXT,
  secondary_info_deadline DATE,
  output_links JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(N:1), weeks(N:1), career_projects(N:1)

---

### 테이블 21: `season_reputations` — 시즌 평판

```sql
CREATE TABLE season_reputations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES user_profiles(id),
  target_user_id UUID NOT NULL REFERENCES user_profiles(id),
  season_history_id UUID NOT NULL REFERENCES user_season_histories(id),
  rating INT DEFAULT 0,
  content TEXT,
  keyword_1 VARCHAR(20),
  keyword_2 VARCHAR(20),
  keyword_3 VARCHAR(20),
  fm_score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(reviewer/target N:1), user_season_histories(N:1)

---

### 테이블 22: `weekly_reputations` — 주차 평판

```sql
CREATE TABLE weekly_reputations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES user_profiles(id),
  target_user_id UUID NOT NULL REFERENCES user_profiles(id),
  week_card_id UUID NOT NULL,
  rating INT DEFAULT 0,
  content TEXT,
  keyword VARCHAR(20),
  fm_score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(reviewer/target N:1)

---

### 테이블 23: `weekly_colleagues` — 주차 연계 동료

```sql
CREATE TABLE weekly_colleagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  week_card_id UUID NOT NULL,
  colleague_id UUID NOT NULL REFERENCES user_profiles(id),
  rank INT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(user/colleague N:1)

---

### 테이블 24: `reputation_keywords` — 평판 키워드 마스터

```sql
CREATE TABLE reputation_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_number INT,
  cluster_name VARCHAR(30),
  cluster_color VARCHAR(10),
  keyword VARCHAR(20)
);
```

---

### 테이블 25: `user_role_history` — 사용자 역할 이력

```sql
CREATE TABLE user_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  role VARCHAR(30),
  started_at DATE,
  ended_at DATE
);
```

**관계**: user_profiles(N:1), seasons(N:1)

---

### 테이블 26: `user_weekly_growth` — 주차별 성장 상태

```sql
CREATE TABLE user_weekly_growth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  is_success BOOLEAN DEFAULT false,
  growth_status VARCHAR(20)
);
```

**관계**: user_profiles(N:1), weeks(N:1)

---

### 테이블 27: `rest_requests` — 휴식 신청

```sql
CREATE TABLE rest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  is_resting BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**관계**: user_profiles(N:1), weeks(N:1)

---

## 3. 테이블 관계도

```
user_profiles (중심 테이블)
│
├── 1:1  → user_introductions
├── 1:1  → user_growth_stats
├── 1:1  → user_cumulative_points
├── 1:1  → user_cumulative_compliance_rates
├── 1:1  → user_reliability_rates
│
├── 1:N  → user_educations
├── 1:N  → user_team_parts ──→ teams, parts, seasons
├── 1:N  → user_season_histories ──→ seasons
├── 1:N  → user_role_history ──→ seasons
├── 1:N  → user_weekly_growth ──→ weeks
├── 1:N  → rest_requests ──→ weeks
│
├── 1:N  → points ──→ weeks
├── 1:N  → weekly_activities ──→ weeks, activity_types
├── 1:N  → activity_records ──→ weeks
├── 1:N  → career_records ──→ weeks, career_projects
├── 1:N  → user_activity_details ──→ weeks
│
├── 1:N  → season_reputations (as reviewer / target)
├── 1:N  → weekly_reputations (as reviewer / target)
└── 1:N  → weekly_colleagues (as user / colleague)

seasons
├── 1:N  → weeks
├── 1:N  → user_season_histories
└── 1:N  → user_team_parts

마스터 테이블 (독립):
  teams, parts, activity_types, reputation_keywords, career_projects
```

---

## 4. 더미 데이터 ↔ 테이블 매핑 요약

| 더미 데이터 파일 | 매핑 테이블 |
|-----------------|------------|
| resume-card-dummy.ts | user_profiles, user_cumulative_points, user_cumulative_compliance_rates, user_growth_stats |
| cluster2-dummy.ts (Photos) | user_introductions (sub_photo_1~4) |
| cluster2-dummy.ts (Slogans) | user_introductions (slogan_*), user_profiles (eng_name) |
| cluster2-dummy.ts (Videos) | user_introductions (video_url_*) |
| cluster2-dummy.ts (Educations) | user_educations |
| cluster2-dummy.ts (Reviews) | user_introductions (cluving_review_link) |
| cluster2-dummy.ts (Intro) | user_introductions (growth_story 등 5항목) |
| cluster3-dummy.ts (Profile) | user_reliability_rates, user_cumulative_points, user_growth_stats |
| cluster3-dummy.ts (Archives) | user_introductions (portfolio_archive_*) |
| cluster3-dummy.ts (Outputs) | user_introductions (portfolio_output_1~5) |
| cluster3-dummy.ts (Details) | user_introductions (portfolio_output_6~15) |
| cluster4-season-dummy.ts | seasons, user_season_histories, user_team_parts, season_reputations |
| cluster4-weekly-dummy.ts (List) | weeks, seasons |
| cluster4-weekly-dummy.ts (Extra) | points, user_team_parts, weekly_reputations, weekly_colleagues |
| cluster4-card-dummy.ts (Reputations) | weekly_reputations, user_profiles |
| cluster4-card-dummy.ts (Colleagues) | weekly_colleagues, user_profiles |
| cluster4-card-dummy.ts (WorkSections) | activity_records, career_records |
| data/weeklyData.ts | weeks, user_team_parts |

---

## 5. 비고

- 이 설계안은 **제안**이며, 확정 전 기획 검토가 필요합니다.
- 기존 `user_activity_details` 스키마(backend/database/schema/)와 호환됩니다.
- Supabase RLS(Row Level Security) 정책은 테이블별로 별도 설계 필요합니다.
- 총 **27개 테이블** (마스터 5개 + 사용자 관련 14개 + 활동/평판 8개)

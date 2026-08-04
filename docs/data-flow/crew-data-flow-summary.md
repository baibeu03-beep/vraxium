# 크루 레포 데이터 소비처 인덱스 — 요약

조사 기준: 크루 앱(vraxium) `app/` · `components/` · `hooks/` · `contexts/` · `lib/` 클라이언트 코드.
어드민(vraxium-admin) 업스트림은 **크루 프록시 라우트 경유분만** 기록했다.

---

## 1. 조사한 크루 페이지 수

| 구분 | 수 |
| --- | --- |
| 라우트 파일(`page.tsx`) | 74 |
| 페이지 유형(org 변형 `-ec`/`-px`/`-ok`, 동적 경로 통합) | 46 |
| 데이터를 소비하는 페이지 유형 | 14 |
| 공유 셸(모든 cluster 페이지에 데이터 주입) | 2 — `(cluster-pages)/layout` 이력서 사이드바, `(main-layout)/layout` QA 가드 |
| 벤더 템플릿 정적 페이지 | 26 |
| 공사중 정적 페이지 | 6 (`cluster-5`~`cluster-10`) |

org 변형(`-ec` = 엥크레, `-px` = 팔랑크스, 무접미 = 마케팅/오랑캐)은 **같은 컴포넌트를 그대로 렌더**하고
테마 wrapper 만 다르므로 1개 유형으로 묶었다. 공개 URL(`-marketing`/`-entertainment`/`-planning`)은
`next.config.mjs` rewrite 로 위 폴더에 매핑된다.

## 2. 호출 API 수

| 구분 | 수 |
| --- | --- |
| 클라이언트가 호출하는 HTTP 엔드포인트 | 37 |
| 그중 어드민 업스트림 프록시 | 4 (`cluster3/stats-cards`, `cluster4/weekly-cards`, `cluster4/weekly-growth`, `cluster4/weekly-line-enhancement`) |
| 클라이언트 Supabase 직접 쿼리 경로 | 2 (`/cluster-4-1` 현재 시즌, `/cluster-4-card` 인덱스 리다이렉트) |

서버 라우트 총 49개 중 **12개는 클라이언트에서 호출되지 않는다**(`portfolio-archives`,
`portfolio-details`, `portfolio-outputs`, `users/[id]`, `users/[id]/season-history`,
`cluster-4-ranking`, `cluster4/lines/*`, `admin/crews/*`, `debug/layout`, `test-user`,
`auth/kakao-logout`, `activity-details` GET).

## 3. 확인된 데이터 항목 수

| 구분 | 수 |
| --- | --- |
| `crew-pages.csv` 행(페이지 × API) | 91 |
| `crew-data-consumers.csv` 행(도메인 × 데이터 항목 × 소비 페이지) | 127 |
| 도메인 | 21 (identity, membership, growth-status, growth-weeks, season, week-result, points, practical, reliability, grade, resume-card, reputation, colleague, line, detail-log, week-image, edit-gate, portfolio, cluster2, crews, weekly-league, vacation, auth, summary, help, scope) |

## 4. API 값을 그대로 표시하는 페이지 수

**7개 페이지 유형**이 대부분의 값을 무변환 표시한다(포맷 변경만 존재).

- `/cluster-4-1` — `weekly-growth` 시즌 요약/포인트, `weekly-cards` area-6/area-7 스냅샷
- `/weekly-ranking/[weekId]` — 팀 대전·Top10·MVP 전 항목
- `/vacation` — `eligibleWeeks`/`myApplications`/`summary`
- `/cluster-2` — 사진·슬로건·자기소개·학력
- `/cluster-3` — stats-cards 3카드(Process/Period/Point), 품계 3종
- `/index-two[-ec|-ok|-px]` — profile/summary 수치
- `/auth/post-login`, `/sign-in` — 단일 응답 분기

## 5. 화면에서 값을 다시 계산하는 페이지 수

**8개 페이지 유형**에서 의미 변경(재판정/재집계)이 확인됐다.

| 페이지 | 재계산 내용 | 종류 |
| --- | --- | --- |
| `/cluster-4` | 주차 성장률 = 4허브 rate 합산(DTO `growthRate` 미사용), competency empty-zero 게이트, 평판/동료 분자 = 표시배열 우선, '성장 중단' 배지 주차 매칭 | 의미 |
| `/cluster-4-card/[weekId]` | 라인 N-1 carry-forward(라인 귀속 주차 재태깅), `resultsDecided` 브라우저 시각 기반 pending→enhanced 승격, 경력 통계 5 cap, 액트 성공/실패 = Point.C>0 재판정, 4허브 owner 게이트 3중 재계산 | 의미 |
| `/cluster-4-1` | 현재 주차·전환/휴식 판정을 클라 Supabase 쿼리 + `isTransitionWeek()`/`isOfficialRestWeek()` 로 재계산, 팀/역할 이력 부재 시 최소 1행 합성 | 의미 |
| `/cluster-4-card` (인덱스) | UTC `new Date().toISOString()` 기준 오늘 주차 판정, break 시즌 문자열 포함 검사 | 의미 |
| `/crews` | 성장상태 10종 → 2종(`활동 중`/`활동 졸업`) 축약, `organizationSlug` 재필터 | 의미(축소) |
| `/weekly-ranking` | `resultConfirmed ?? (leagueRecordStatus 문자열 매칭)` 확정 재판정, `isTallying`/`isOngoing` 로 값 대신 `N`·0 표시 | 의미 |
| `(cluster-pages)/layout` 이력서 사이드바 | 시즌 전체주차 분모를 `(end-start)/7` 로 계산, 시즌명 3중 추론, 이름 성/이름 복성 추정 | 의미 |
| `/vacation` | `contiguousPrefix()` 연속 주차 재검증 | 의미(서버와 이중) |

포맷 변경(의미 불변)만 있는 대표 경로: 날짜 `YYYY - MM - DD (요일)`, 연도 2자리(`%100`),
시즌명 영문→한글, `toLocaleString()` 천단위, `formatMajor` trim, `formatLineDuration`,
`formatSeasonWeekTitle`, `formatPointACriterion`.

## 6. fallback 사용 경로

총 **31개 항목**이 폴백을 가진다. 다단 폴백(3단 이상)이 위험 집중 지점이다.

| 폴백 깊이 | 항목 |
| --- | --- |
| 4단 | 주차 평판 분자(`weeklyReputations[]` → `reputationSummary.receivedCount` → `reputationCount` → 배열 길이), 연계 동료 분자(동일 구조) |
| 4단 | 졸업 목표 주차 분모(`totalWeeks`→`totalWeekCount`→`totalRequiredWeeks`→`baseWeekCount`→ **org 하드코딩 상수 25/30**) |
| 4단 | 누적 인정 주차(`approvedWeeks`→`currentCumulative`→`cumulative`→`accumulatedApprovedWeeks`) |
| 3단 | 평판 분모(`receivedLimit`→`reputationTotal`→상수 4), 동료 분모(`writtenLimit`→`colleagueTotal`→상수 3) |
| 2단 | 성장 주차 4종(stats-cards → profile `growthPeriodStats` → `'-'`), 성장 상태(`growthStatusKey` → `growthStatus` 라벨 문자열), Point C(`pointC` → `-lightning`), 이력서 배지(`point` → `badges`), 학교/학과(profile enrichment → educations refine), 대표카드 이미지(top-cards → 채널카드 이미지), 클래스(`crewClassPositionCode` → `roleLabel`) |
| 보수적 폴백 | 권한 API 실패 시: 동료 창 = **닫힘(false)**, 주차 리뷰·평판 창 = **시간창 fallback(열림 가능)** — 두 정책이 서로 다르다 |
| 데모 전용 시드 | `/cluster-3` stats-cards/points, `/cluster-4-1`·`/cluster-4-card` 평판 키워드, `/weekly-ranking` 더미 카드 |

## 7. snapshot · cache 사용 경로

**snapshot(재계산 금지, 서버 확정값)**

- `GET /api/cluster4/weekly-cards` — 주차 카드/라인/평판/동료/area-6/area-7/actLogs 전부
- `GET /api/cluster4/weekly-growth` — 시즌 요약·포인트·활동 상태
- `GET /api/cluster4/weekly-line-enhancement` — Detail Log 라인/액트/문구
- `GET /api/cluster3/stats-cards` — Process/Period/Point 3카드
- `GET /api/weekly-league` — 주차 리그 집계(snapshot-only, `result_published_at` 게이트)

**cache**

| 캐시 | 대상 | TTL | 무효화 |
| --- | --- | --- | --- |
| `ProfileContext` | `/api/profile` | 5분 + 에러 30초 | `clearCache()` — 쓰기 후 필수 |
| `lib/fetch-dedupe` | GET URL 단위 | 30초 | `invalidateDedupe(prefix)` |
| `lib/weeklyLeagueClient` | `/api/weekly-league?org&seasonKey` | 30초, **성공 응답만 저장** | 실패는 캐시/인플라이트에서 제거 후 백오프 3회 |
| `HelpModalBody` | `/api/help-contents` | module-level inflight | 없음 |
| `no-store` 강제 | crews, career-records, week-confirmations, edit-windows/permission, weekly-cards(카드 상세), line-enhancement, vacation, qa-mode/access | - | - |

**2단 캐시 위험**: `/api/profile` 은 ProfileContext(5분)와 fetch-dedupe(30초)를 동시에 통과한다.
쓰기 후 `clearCache()` 를 호출하지 않으면 사이드바가 이전 값으로 복원된다.

## 8. 일반 모드와 테스트 모드가 다른 경로

**결론: URL `?mode=test` 전파는 전부 비활성화됐고, 스코프는 배포 환경변수로 고정된다.**

- `lib/userScopeShared.ts` — `QA_FIXED_TEST_ONLY = true` → `getDeployMode()` 가 **항상 `test`** 를 반환.
  `parseScopeMode` / `readScopeMode` 는 인자를 무시하고, `appendModeQuery` / `toggleModeInHref` 는 no-op.
- `Cluster41Content` / `Cluster4Content` / `Cluster4CardContent` 의 `modeQS` 는 **하드코딩된 `""`** 다.
- `/crews`, `/weekly-ranking` 의 mode 전파 코드는 주석 처리 상태.

실제로 동작이 갈리는 경로는 **`demoUserId`(테스트 유저 모드)** 와 **`actAsTestUserId`**, 그리고
**localStorage `demoMode`(프론트 더미)** 3종이다. 총 **18개 경로**에서 차이가 확인됐다.

| # | 경로 | 차이 |
| --- | --- | --- |
| 1 | `useDemoUserMode.targetUserId` | `userId`/`userID` → `demoUserId` → `actAsTestUserId` 우선순위. 컴포넌트마다 폴드 방식이 다르다(`Cluster3Content` 는 `demo.demoUserId` 직접, `Cluster2Content` 는 `demo.targetUserId`) |
| 2 | `ProfileContext` | `/api/profile/?userId=` 만 사용 — **`demoUserId` 를 URL 에 붙이지 않는다**(캐시 키 충돌 가능) |
| 3 | `/api/profile/summary` (index-two) | 세션 전용 — demo/actAs 미지원 |
| 4 | `/api/auth/check-status` | 세션 전용 — demo 미지원 |
| 5 | `/cluster-3` stats-cards | `demoQS` 미부착. localStorage 데모면 **API 호출 자체를 스킵**하고 더미 시드 사용 |
| 6 | `/cluster-3` 채널·탑 카드 | `demoQS` 미부착, `urlUserId` 만 |
| 7 | `/cluster-4-card` 인덱스 | localStorage `demoMode=true` 면 `/cluster-4-card-marketing/dw-01` 더미로 직행 |
| 8 | `/weekly-ranking` | `isDemoMode()` 면 `WEEKLY_CARD_DUMMY` 사용, fetch 생략 |
| 9 | `/cluster-4-1` 현재 시즌 | 데모면 Supabase 쿼리 스킵 |
| 10 | 평판 키워드 | 데모면 로컬 상수 `REPUTATION_KEYWORDS` |
| 11 | 동료 작성 게이트 | `isDemoMode` → 무조건 `true` 반환(권한 API 미조회) |
| 12 | 주차 리뷰 게이트 | `session.isAdmin && !demoUserId` → 무조건 `true` |
| 13 | 주차 평판 게이트 | 동일 단축 경로 |
| 14 | 1번 학력 게이트 | `isAuthenticated = !!session?.user \|\| isDemo` — 데모가 인증을 대체 |
| 15 | `/cluster-2` 저장 API | `apiUrl()` 이 `demoUserId` 부착 → 세션 없이 대상 유저에 저장 |
| 16 | 이력서 사이드바 `apiUrl()` | `targetUserId && session.isAdmin` 일 때만 `targetUserId` 부착(다른 컴포넌트와 규칙 상이) |
| 17 | `QaModeGuard` | QA 배포에서만 마운트, `demoUserId` 있으면 access 판정에 포함 |
| 18 | 주차 확인(`week-confirmations`) | 클라이언트 `viewerUserId` 가 `actAs` 를 포함하지 않음 |

## 9. 우선 검증이 필요한 고위험 경로 TOP 10

| 순위 | 경로 | 위험 |
| --- | --- | --- |
| 1 | `/cluster-4-card/[weekId]` 라인 N-1 carry-forward | 프론트가 라인의 **귀속 주차를 변경**한다. `enhancementStatus` 필터·휴식(공식) 가드·placeholder 제거가 얽혀 있어, 조건 하나만 어긋나도 다른 주차 라인이 현재 주차에 '강화 실패'로 표시된다(과거 재발 이력). |
| 2 | `/cluster-4-card/[weekId]` `resultsDecided` | **브라우저 시각**으로 `pending → enhanced` 를 승격한다. 사용자 시계/타임존이 어긋나면 경력 카운트가 서버·어드민과 다르게 보인다. |
| 3 | `/cluster-4-card` 인덱스 리다이렉트 | `new Date().toISOString()`(**UTC**) 로 오늘을 계산하고, `weeks.started_at/ended_at` 컬럼을 쓴다. 같은 앱의 `/cluster-4-1` 은 `start_date/end_date` 를 쓴다 — **컬럼명 불일치**. KST 09:00 이전에는 전 주차로 리다이렉트될 수 있다. |
| 4 | `/cluster-4` 주차 성장률 프론트 합산 | DTO `growthRate` 를 버리고 4허브 rate 를 합산한다. 백엔드 게이트 정책이 바뀌면 목록·상세·어드민 3곳이 조용히 갈린다. |
| 5 | 권한 API 실패 시 폴백 비대칭 | 동료 창은 **닫힘**, 리뷰·평판 창은 **시간창 fallback(열릴 수 있음)**. 후자는 "모달은 열리는데 저장 시 403" 을 만든다(과거 재발 이력). |
| 6 | 졸업 목표 주차 분모 org 하드코딩 | 4단 폴백 끝에 `pathname` 기반 상수(marketing 25 / ec·px 30)로 떨어진다. 조직 정책이 바뀌면 화면만 틀린다. |
| 7 | `/crews` 성장상태 2종 축약 + `displayGrowthStatus` fallback graft | 10종을 2종으로 줄이므로 stale graft(과거 `graduating` 노출 이력)를 화면에서 검출할 수 없다. |
| 8 | `/weekly-ranking` 확정 여부 문자열 매칭 | `resultConfirmed` 가 null 이면 `'공표 중' \|\| '검수 완료'` 한글 문자열로 판정한다. 라벨 문구가 바뀌면 미확정 주차가 확정으로 표시된다. |
| 9 | `/api/profile` 2단 캐시(ProfileContext 5분 + dedupe 30초) + `demoUserId` 미부착 | 쓰기 후 `clearCache()` 누락 시 이전 값 복원, 테스트 유저 모드에서 캐시 키 충돌 가능. 이력서 사이드바가 **모든 cluster 페이지**에 있어 영향 범위가 가장 넓다. |
| 10 | 이름/학교/학과 마스킹이 클라이언트 단일 게이트 | `/api/videos`·`/api/weekly-reputations` 등은 raw 이름을 반환하고 `useDataMasking` 만이 가린다. 네트워크 응답에는 원본이 그대로 실린다. |

## 10. 신뢰도 LOW 항목

CSV `confidence=LOW` 로 표기한 **11개 항목**. 코드에서 소비 지점은 확정했으나,
값의 정확성이 런타임 상태(시각·캐시·데이터 부재·URL 파라미터)에 좌우되어 정적 확인만으로는 보증할 수 없는 것들이다.

| 항목 | 페이지 | LOW 사유 |
| --- | --- | --- |
| 현재 주차 리다이렉트 대상 | `/cluster-4-card` 인덱스 | UTC 오늘 계산 + 타 화면과 다른 컬럼명(`started_at` vs `start_date`) — 실제 스키마 확인 필요 |
| 시즌 이력(`seasonHistories`) | 이력서 사이드바, `/cluster-4-1` | 두 시즌 시스템(`seasons` uuid / `season_definitions` text key) 혼재. 분모를 날짜 차로 계산하는 경로 존재 |
| 졸업 목표 주차 분모 | `/cluster-4` 카드 | 4단 폴백 끝이 pathname 하드코딩 상수 |
| 주차 경력 통계(총/성공) | `/cluster-4-card` | 브라우저 시각 기반 승격 |
| 라인 목록(4허브) | `/cluster-4-card` | N-1 carry-forward 로 귀속 주차가 프론트에서 바뀜 |
| 4허브 수정 가능 여부 | `/cluster-4-card` | 3곳(버튼 disabled·진입 핸들러·canEdit effect)이 각자 재계산 — 한 곳만 고치면 누수 |
| 주차 리뷰 작성 창 | `/cluster-4-card` | 권한 실패 시 시간창 fallback |
| 주차 평판 작성 창 | `/cluster-4-card` | 동일 |
| 시즌 리뷰/평판 작성 창 | `/cluster-4-1` | `unlockAll`/`unlockSeasonX` **URL 디버그 플래그로 OR 우회** 가능 |
| 이력서 요약(index-two) | `/index-two*` | `/api/profile/summary` 에 stale-schema `seasons` 쿼리(deferred)가 남아 있음 |
| 프로필 캐시 키 | 전 cluster 페이지 | `demoUserId` 를 URL 에 붙이지 않아 캐시 키가 대상 유저를 구분하지 못할 수 있음 |

---

## 부록 — 조사 방법과 한계

- **확인 방법**: 각 API 호출부의 `fetch()` URL 과 응답 필드 접근 코드(`result.X`, `card.Y`, 구조분해)를
  직접 읽어 기록했다. API 이름만으로 필드를 추정한 항목은 없다.
- **어드민 업스트림 DTO**: 4개 프록시 라우트의 **업스트림 원본 스키마**는 이 레포에 없다.
  `shared/cluster4.contracts.ts` 의 타입 선언과 프록시가 주입/클램프하는 필드(`lineRating`,
  `pointACriterion`, `clampAdminOutputs`)까지만 확인했다.
- **런타임 미검증**: 정적 코드 분석만 수행했다. 실제 응답 값·null 빈도·캐시 히트율은 확인하지 않았다.
- **불일치 미수정**: 발견한 불일치(컬럼명 상이, 폴백 비대칭, 캐시 키 등)는 이 문서에 기록만 하고
  코드는 변경하지 않았다.

# 이전 작업자 코드 의존성 감사 보고서

> 생성 일시: 2026-04-07
> 감사 대상: Carrer-Resume 프로젝트 (Next.js 14 + Supabase + NextAuth)
> 작업 브랜치: feature/api-contract
> 목적: 이전 작업자가 남긴 백엔드/유틸 코드 중 어떤 것이 현재 퍼블리싱된 프론트엔드에서 실제로 사용되는지 분류

---

## 1. 전체 요약

| 항목 | 수치 |
|---|---|
| API Routes 총 개수 | **28개** (route.ts 파일 기준) |
| 프론트엔드에서 직접 호출하는 API | **25개** |
| 간접 사용 (NextAuth 핸들러) | **1개** |
| 미사용 (안전하게 삭제 가능) | **2개** |
| `lib/` 유틸리티 총 개수 | **5개** (전부 사용 중) |
| `backend/` 폴더 코드 참조 | **0건** (SQL/문서만 존재) |
| 백엔드 관련 패키지 | 3개 (그중 1개는 데드 의존성) |
| `.env.example` 키 | 9개 (Supabase 키 3개 누락) |

### 한 줄 결론

**"백엔드 코드의 거의 전부가 프론트와 강하게 결합돼 있어 통째 삭제는 불가능하다. 단, 명확한 데드코드 3건과 의심스러운 NEXT_PUBLIC_API_URL 흔적 2건은 정리 가능하다."**

---

## 2. API Routes 분류

### 🔴 삭제 불가 — 프론트엔드가 실제 사용 중 (25개)

| # | API Route | HTTP 메서드 | 호출 파일 (대표) |
|---|---|---|---|
| 1 | `/api/profile` | GET, PUT | `components/cluster-4/Cluster4Content.tsx:160,907`, `components/cluster-4-1/Cluster41Content.tsx:23`, `components/cluster-4-card/Cluster4CardContent.tsx:752`, `components/home-career/Sidebar.tsx:260,1074,1228,1855,3697`, `components/shared/Sidebar.tsx:37`, `app/(main-layout)/crews/page.tsx`, `contexts/ProfileContext.tsx:106` |
| 2 | `/api/profile/summary` | GET | `components/home-two/Sidebar.tsx:120` |
| 3 | `/api/auth/check-status` | GET | `components/cluster-3/Cluster3Content.tsx:62`, `components/cluster-4/Cluster4Content.tsx:195`, `components/cluster-4-card/Cluster4CardContent.tsx:96`, `components/home-career/Sidebar.tsx:1052` |
| 4 | `/api/photos` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:274` |
| 5 | `/api/photos/upload` | POST | `components/cluster-2/Cluster2Content.tsx:200` |
| 6 | `/api/slogans` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:489` |
| 7 | `/api/videos` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:658` |
| 8 | `/api/educations` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:786` |
| 9 | `/api/introductions` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:1006` |
| 10 | `/api/review-link` | GET, PUT | `components/cluster-2/Cluster2Content.tsx:1046` |
| 11 | `/api/schools/search` | GET | `components/cluster-2/Cluster2Content.tsx:1151` |
| 12 | `/api/portfolio-archives` | GET, PUT | `components/cluster-3/Cluster3Content.tsx:350,394` |
| 13 | `/api/portfolio-outputs` | GET, PUT | `components/cluster-3/Cluster3Content.tsx:446,489` |
| 14 | `/api/portfolio-details` | GET, PUT | `components/cluster-3/Cluster3Content.tsx:539,582` |
| 15 | `/api/season-reputations` | GET, POST, DELETE | `components/cluster-4/Cluster4Content.tsx:971,1574` |
| 16 | `/api/season-review` | GET, PUT | `components/cluster-4/Cluster4Content.tsx:1671` |
| 17 | `/api/reputation-keywords` | GET, POST | `components/cluster-4/Cluster4Content.tsx:991`, `components/cluster-4-card/Cluster4CardContent.tsx:1297` |
| 18 | `/api/career-records` | GET | `components/cluster-4-card/Cluster4CardContent.tsx:801,1254` |
| 19 | `/api/weekly-reputations` | GET, POST, DELETE | `components/cluster-4-1/Cluster41Content.tsx:234`, `components/cluster-4-card/Cluster4CardContent.tsx:804,1313,1685` |
| 20 | `/api/weekly-colleagues` | GET, POST | `components/cluster-4-card/Cluster4CardContent.tsx:807,1354,1590` |
| 21 | `/api/activity-details` | GET, POST, DELETE | `components/cluster-4-card/Cluster4CardContent.tsx:2350` |
| 22 | `/api/crews` | GET | `components/cluster-4-card/Cluster4CardContent.tsx:1337`, `app/(main-layout)/crews/page.tsx:90` |
| 23 | `/api/cluster-4-ranking` | GET | `components/cluster-4-ranking/Cluster4RankingContent.tsx:89,124` |
| 24 | `/api/users/[id]` | GET | `components/cluster-4/Cluster4Content.tsx:688` (`urlUserId ? /api/users/${urlUserId} : /api/profile`) |
| 25 | `/api/weekly-ranking` | GET | `components/weekly-ranking/WeeklyRankingContent.tsx:23-24` |

### 🟡 간접 사용 — fetch 호출은 없으나 NextAuth 핸들러로 필수 (1개)

| API Route | 사용 방식 | 비고 |
|---|---|---|
| `/api/auth/[...nextauth]/route.ts` | `useSession()`, `signIn()`, `signOut()`, `SessionProvider`, `getServerSession()` | **NextAuth의 핵심 핸들러.** 직접 fetch는 없지만 next-auth 라이브러리가 이 경로로 자동 라우팅. 삭제 시 로그인 시스템 전체 붕괴. **37개 파일에서 next-auth 관련 사용 확인됨** |

### 🟢 삭제 가능 — 호출처 없음 (2개)

| API Route | 비고 |
|---|---|
| `/api/test-user/route.ts` | 파일명에서 알 수 있듯 테스트 전용. 어디서도 호출되지 않음 (`grep "test-user"` 결과 없음) |
| `/api/users/[id]/season-history/route.ts` | `grep "season-history"` 결과 없음. 미완성 또는 향후 사용 예정 흔적으로 추정 |

---

## 3. lib/ 폴더 분류

### 🔴 삭제 불가 (5개 전부)

| 파일 | export | 사용 위치 |
|---|---|---|
| `lib/auth.ts` | `authOptions` (NextAuth 설정) | API 라우트 17개 (`/api/auth/[...nextauth]`, `/api/auth/check-status`, `/api/profile`, `/api/profile/summary`, `/api/educations`, `/api/introductions`, `/api/slogans`, `/api/videos`, `/api/photos`, `/api/photos/upload`, `/api/portfolio-archives`, `/api/portfolio-outputs`, `/api/portfolio-details`, `/api/review-link`, `/api/season-reputations`, `/api/season-review`, `/api/weekly-reputations`, `/api/weekly-colleagues`) |
| `lib/supabase.ts` | `supabase` (브라우저용 클라이언트), `supabaseAdmin` (서버용) | **프론트엔드 4개**(`components/cluster-4/Cluster4Content.tsx`, `components/cluster-4-1/Cluster41Content.tsx`, `components/cluster-4-card/Cluster4CardContent.tsx`, `components/home-career/Sidebar.tsx`, `app/(main-layout)/(cluster-pages)/cluster-4-card/page.tsx`) + API 라우트 12개 |
| `lib/supabase-server.ts` | `createAdminClient()` | API 라우트 8개 (`/api/activity-details`, `/api/career-records`, `/api/crews`, `/api/test-user`, `/api/users/[id]`, `/api/users/[id]/season-history`, `/api/weekly-colleagues`, `/api/weekly-ranking`, `/api/weekly-reputations`) |
| `lib/cached-data.ts` | `getCachedTeams`, `getCachedParts`, `getCachedActivityTypes` (5분 TTL 메모리 캐시) | API 라우트 5개 (`/api/profile`, `/api/profile/summary`, `/api/crews`, `/api/weekly-colleagues`, `/api/weekly-reputations`) |
| `lib/dataMasking.ts` | `maskBirthDate`, `maskEmail`, `maskGrade`, `maskMajor`, `maskAdmissionYear`, `maskAddress`, `maskSchool` 등 (비로그인 사용자 마스킹 유틸) | `hooks/useDataMasking.ts` |

### 비고 — supabase.ts vs supabase-server.ts 중복

이전 작업자가 같은 목적(서버 admin 클라이언트)을 위해 **두 가지 패턴을 동시에 사용**하고 있음:
- `lib/supabase.ts`의 `supabaseAdmin` (모듈 로드 시점에 1회 생성, 캐시됨)
- `lib/supabase-server.ts`의 `createAdminClient()` (호출마다 새 클라이언트 생성, 환경변수 캐시 문제 회피용)

**어느 쪽도 안전하게 제거할 수 없으나**, 향후 정리 시 한쪽으로 통일하는 것이 권장됨.

---

## 4. backend/ 폴더

| 파일 | 프론트엔드 참조 여부 | 분류 |
|---|---|---|
| `backend/database/db-design-report.md` | 없음 | 🟢 **참고용 보존 권장** — 27개 테이블 완성 설계서 (961줄). 도메인 이해의 핵심 자료 |
| `backend/database/schema/user-activity-details-schema.sql` | 없음 (코드는 이미 Supabase에 적용됐을 것으로 추정) | 🟡 Supabase 테이블 생성에 사용됐을 가능성. 마이그레이션 이력 차원에서 보존 권장 |
| `backend/database/schema/ALTER_USER_RELIABILITY_FK.sql` | 없음 | 🟡 user_reliability_rates FK 변경 스키마. 마이그레이션 이력 |
| `backend/database/seeds/SAMPLE_USER_DATA.sql` | 없음 | 🟢 김크루(`fade949c-faf1-44c6-a3f1-ccd98a89bc60`) 샘플 데이터. 개발 환경 재현용 |
| `backend/database/seeds/INSERT_ALL_PROFILE_IMAGES.sql` | 없음 | 🟢 프로필 이미지 시드 |
| `backend/database/seeds/INSERT_RANDOM_PROFILE_IMAGES.sql` | 없음 | 🟢 프로필 이미지 시드 |
| `backend/database/seeds/INSERT_WEB_PROFILE_IMAGES.sql` | 없음 | 🟢 프로필 이미지 시드 |
| `backend/database/seeds/QUICK_INSERT_IMAGES.sql` | 없음 | 🟢 프로필 이미지 시드 |
| `backend/database/seeds/UPDATE_PROFILE_IMAGES.sql` | 없음 | 🟢 프로필 이미지 시드 |

**핵심**:
- `backend/` 폴더는 **순수 SQL 아티팩트와 설계 문서**일 뿐, 실행 가능한 백엔드 애플리케이션 코드는 0줄
- 프론트엔드/`app/api/`/`lib/` 어디에서도 `backend/` 경로를 import하거나 참조하지 않음 (`grep "backend/" → 0건`)
- 따라서 폴더 자체를 삭제해도 **빌드/런타임에 영향 없음**
- 다만 `db-design-report.md`는 **현 프로젝트의 사실상 유일한 도메인 명세 문서**라 보존을 강력 권장

---

## 5. 패키지 의존성

| 패키지 | 버전 | 이전 작업자 추정 | 실제 사용 | 분류 |
|---|---|---|---|---|
| `@supabase/supabase-js` | ^2.90.1 | 예 | 예 (lib/supabase, lib/supabase-server, 4개 컴포넌트) | 🔴 |
| `next-auth` | ^4.24.13 | 예 | 예 (37개 파일) | 🔴 |
| `@anthropic-ai/sdk` | ^0.70.1 | 예 | **아니오 — 어디서도 import 안 됨** | 🟢 **데드 의존성** |

`@anthropic-ai/sdk`는 `package.json`에 등록돼 있지만 `grep -r "anthropic" --include="*.ts" --include="*.tsx"` 결과가 0건. **삭제 가능.**

---

## 6. 환경변수

### `.env.example`에 정의된 키 (9개)

| 변수명 | 사용처 | 분류 |
|---|---|---|
| `NEXTAUTH_URL` | NextAuth 자동 사용 | 🔴 |
| `NEXTAUTH_SECRET` | NextAuth JWT 서명 | 🔴 |
| `GOOGLE_CLIENT_ID` | `lib/auth.ts` (GoogleProvider) | 🔴 |
| `GOOGLE_CLIENT_SECRET` | `lib/auth.ts` (GoogleProvider) | 🔴 |
| `DISCORD_CLIENT_ID` | `lib/auth.ts` (DiscordProvider) | 🔴 |
| `DISCORD_CLIENT_SECRET` | `lib/auth.ts` (DiscordProvider) | 🔴 |
| `KAKAO_CLIENT_ID` | `lib/auth.ts` (KakaoProvider) | 🔴 |
| `KAKAO_CLIENT_SECRET` | `lib/auth.ts` (KakaoProvider) | 🔴 |
| `NEXT_PUBLIC_API_URL` | `lib/auth.ts:34` (`/auth/login`), `components/pages/SignUp.tsx:51` (`/auth/register`) | 🟡 **데드코드 가능성 — 5번 항목 참조** |

### 코드에서 참조되지만 `.env.example`에 누락된 키 (3개)

| 변수명 | 사용처 | 분류 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts:3`, `lib/supabase-server.ts:6` | 🔴 **필수, 누락** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts:4` | 🔴 **필수, 누락** |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts:15`, `lib/supabase-server.ts:7` | 🔴 **필수, 누락** |

⚠️ **이전 작업자가 `.env.example`을 갱신하지 않아, 새로 클론하는 사람은 Supabase 키를 어떻게 받아야 할지 알 수 없는 상태.**

---

## 7. 특이사항 / 주의점 (중요)

### 7-1. 프론트엔드가 API 라우트를 우회해 Supabase에 직접 쿼리

다음 5개 위치는 `/api/*`를 거치지 않고 `lib/supabase`의 `supabase` 클라이언트로 **DB에 직접 쿼리**하고 있음:

- `components/cluster-4/Cluster4Content.tsx:8`
- `components/cluster-4-1/Cluster41Content.tsx:6`
- `components/cluster-4-card/Cluster4CardContent.tsx:7`
- `components/home-career/Sidebar.tsx:7`
- `app/(main-layout)/(cluster-pages)/cluster-4-card/page.tsx:5`

**의미**:
- API 라우트 정리 시 이 경로들은 영향받지 않지만,
- **`lib/supabase.ts`를 제거하거나 환경변수를 바꾸면 즉시 깨짐**
- 향후 백엔드 재설계 시 "API 라우트만 정리하면 된다"가 아니라 **이 직접 쿼리들도 함께 마이그레이션해야 함**

### 7-2. 데드코드 흔적: NEXT_PUBLIC_API_URL 외부 백엔드 참조

`lib/auth.ts:34`:
```typescript
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {...})
```

`components/pages/SignUp.tsx:51`:
```typescript
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {...})
```

**분석**:
- `lib/auth.ts`의 `CredentialsProvider` 내부에서 외부 백엔드(`NEXT_PUBLIC_API_URL/auth/login`)로 로그인 검증을 시도
- 하지만 실제로는 `app/api/auth/[...nextauth]`만 존재하고, `NEXT_PUBLIC_API_URL`이 가리키는 외부 백엔드는 **존재하지 않음** (`.env.example`에는 `your-backend-api.com` 플레이스홀더)
- 즉, 이전 작업자가 처음에는 **외부 백엔드 + Credentials 로그인**을 계획했다가, 중간에 **OAuth(Google/Discord/Kakao) + Supabase 직접**으로 방향을 바꾼 흔적
- 현재 상태에서 사용자가 이메일/비밀번호로 로그인하면 **404가 나거나 의도와 다른 동작** 발생 가능
- ⚠️ **삭제 권장**, 다만 SignUp 페이지가 어떤 형태로든 동작해야 한다면 NextAuth 흐름으로 대체 필요

### 7-3. .env.example 갱신 필요 (가장 시급)

이전 작업자는 코드는 Supabase로 옮겼는데 `.env.example`을 따라 갱신하지 않아, **새 환경에서는 이 프로젝트가 빌드만 되고 런타임에 즉시 throw**:

```typescript
// lib/supabase.ts:6
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}
```

신규 개발자 온보딩이 막히는 상태.

### 7-4. db-design-report.md는 사실상 도메인 명세서

961줄, 27개 테이블의 완성된 SQL 설계서. 여기에는:
- 더미 데이터 → 테이블 매핑 분석
- user_profiles, user_introductions(자기소개 통합 100+ 컬럼), seasons, weeks, teams, parts, growth_stats, points, weekly_activities, career_projects, season_reputations, weekly_reputations, reputation_keywords, user_role_history, rest_requests 등
- 테이블 관계도 + 비고

**프로젝트 전체에서 도메인을 한눈에 볼 수 있는 유일한 문서**. 재구축 작업 시 1순위 참고 자료.

### 7-5. types/ 폴더는 사실상 비어있음

- `types/next-auth.d.ts` 1개뿐 — NextAuth Session 타입 augment 용도
- API 응답 타입, DB row 타입, 더미 데이터 타입 등은 **모두 컴포넌트 내부에 inline 또는 `any`**
- 이전 작업자가 타입 정의를 거의 안 만들고 작업한 것으로 보임 → 향후 재구축 시 타입 시스템 보강 필요

---

## 8. 삭제 작업 시 권장 순서

### 1단계 — 즉시 삭제 가능 (🟢)

| 대상 | 사유 |
|---|---|
| `app/api/test-user/route.ts` | 호출처 0건, 파일명도 테스트 전용 표시 |
| `app/api/users/[id]/season-history/route.ts` | 호출처 0건 |
| `package.json`에서 `@anthropic-ai/sdk` 제거 + `npm i` | 코드에서 import 0건 |
| `backend/database/seeds/*.sql` | 시드 데이터, 운영에 불필요. 단 개발환경 재현 필요시 보존 |

### 2단계 — 코드 정리 (🟡, 동작에 영향 있음)

| 대상 | 사유 | 조치 |
|---|---|---|
| `lib/auth.ts:30-50` 의 `CredentialsProvider` 블록 | 존재하지 않는 외부 백엔드 호출 | NextAuth providers에서 제거하거나 정상 구현으로 교체 |
| `components/pages/SignUp.tsx:51` 의 `fetch(NEXT_PUBLIC_API_URL/auth/register)` | 동일 이유 | NextAuth `signIn()` 흐름으로 교체하거나 SignUp 페이지를 OAuth-only로 전환 |
| `.env.example`의 `NEXT_PUBLIC_API_URL` | 위 정리 후 미사용 | 제거 |
| `.env.example`에 Supabase 키 3개 추가 | 현재 누락 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 추가 |
| `backend/database/schema/*.sql` | 마이그레이션 이력 | 보존 권장 (Supabase 외부 백업) |

### 3단계 — 대체 코드 준비 후 삭제 (🔴)

위 1번에 분류된 25개 API + 5개 lib 파일은 **새로운 백엔드 레이어가 동작 가능한 상태가 된 후에만** 삭제. 그 전에는 어느 하나라도 지우면 다음과 같은 페이지가 즉시 깨짐:

- `cluster-1` ~ `cluster-10` 페이지 (cluster-2/3/4/4-card에서 활발히 fetch)
- `crews` 페이지
- `weekly-ranking` 페이지
- `home-career` 사이드바 (전역)
- 로그인/로그아웃 (NextAuth 핸들러 의존)
- `/profile`, `/chat` (middleware의 NextAuth 세션 검사 의존)

### 4단계 — db-design-report.md는 절대 삭제 금지

위치 이동(`backend/database/` → `docs/architecture/` 등)은 가능하지만 내용은 보존. 재구축 작업의 도메인 명세서.

---

## 9. 페이지 ↔ API 매핑 요약 (감사 부산물)

| 주요 페이지/컴포넌트 | 의존하는 API | 의존하는 lib |
|---|---|---|
| `cluster-2` (자기소개) | `/api/photos`, `/api/photos/upload`, `/api/slogans`, `/api/videos`, `/api/educations`, `/api/introductions`, `/api/review-link`, `/api/schools/search`, `/api/auth/check-status` | `lib/auth` (간접) |
| `cluster-3` (포트폴리오) | `/api/portfolio-archives`, `/api/portfolio-outputs`, `/api/portfolio-details`, `/api/auth/check-status` | `lib/auth` (간접) |
| `cluster-4` (시즌 평판) | `/api/profile`, `/api/users/[id]`, `/api/season-reputations`, `/api/season-review`, `/api/reputation-keywords`, `/api/auth/check-status` | `lib/supabase` (직접) |
| `cluster-4-1` | `/api/profile`, `/api/weekly-reputations` | `lib/supabase` (직접) |
| `cluster-4-card` (주차 카드) | `/api/profile`, `/api/career-records`, `/api/weekly-reputations`, `/api/weekly-colleagues`, `/api/reputation-keywords`, `/api/crews`, `/api/activity-details`, `/api/auth/check-status` | `lib/supabase` (직접) |
| `cluster-4-ranking` | `/api/cluster-4-ranking` | - |
| `weekly-ranking` 페이지 | `/api/weekly-ranking` | - |
| `crews` 페이지 | `/api/crews`, `/api/profile` | - |
| `home-career/Sidebar` (전역) | `/api/profile`, `/api/auth/check-status` | `lib/supabase` (직접), NextAuth |
| `home-two/Sidebar` | `/api/profile/summary` | NextAuth |
| `ProfileContext` (전역 상태) | `/api/profile` | NextAuth (`useSession`) |
| `middleware.ts` | - | NextAuth 세션 쿠키만 검사 |

---

## 10. 종합 권장사항

1. **즉시 행동 권장 (안전)**
   - `.env.example`에 Supabase 키 3개 추가 → 신규 온보딩 가능 상태로 복구
   - `@anthropic-ai/sdk` 의존성 제거 → 번들 크기 절감
   - `app/api/test-user/route.ts`, `app/api/users/[id]/season-history/route.ts` 삭제 → 코드 정리
   - `backend/database/db-design-report.md` 위치를 `docs/architecture/`로 이동 권장 (도메인 문서임을 명확히)

2. **중기 행동 권장 (검증 필요)**
   - `lib/auth.ts`의 `CredentialsProvider` 블록과 `SignUp.tsx`의 `NEXT_PUBLIC_API_URL` 호출 정리 → 데드코드 제거
   - `lib/supabase.ts`의 `supabaseAdmin` ↔ `lib/supabase-server.ts`의 `createAdminClient()` 중복 통일

3. **장기 (재설계 작업과 함께)**
   - 프론트엔드의 직접 Supabase 쿼리 5곳을 API 라우트로 정리 (관심사 분리)
   - 컴포넌트별로 흩어진 fetch 호출을 `lib/api/` 클라이언트 + 훅으로 추상화
   - 25개 API와 27개 테이블에 대한 TypeScript 타입 정의 작성
   - API 명세 문서화 (현재 `docs/api/` 부재)

---

## 부록 A. 조사 명령 재현용

```bash
# API 라우트 목록
find app/api -name "route.ts" | sort

# fetch("/api/...") 호출 위치
grep -rn 'fetch.*["`/]/api/' --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v app/api/

# lib/ import 위치
grep -rn 'from.*["'\'']@?/?lib/' --include="*.tsx" --include="*.ts" | grep -v node_modules

# backend/ 참조 (없어야 정상)
grep -rn 'backend/' --include="*.tsx" --include="*.ts" --include="*.json" | grep -v node_modules

# Supabase 환경변수 참조
grep -rn 'NEXT_PUBLIC_SUPABASE\|SUPABASE_SERVICE_ROLE' --include="*.ts" --include="*.tsx" | grep -v node_modules

# NextAuth 사용 위치
grep -rln 'useSession\|signIn\|signOut\|SessionProvider\|getServerSession' --include="*.ts" --include="*.tsx" | grep -v node_modules
```

---

**보고서 끝.** 이 보고서는 git에 커밋하지 않고 로컬에만 보존한다.

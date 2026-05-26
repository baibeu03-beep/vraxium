# 프로젝트 백엔드 구조 분석 보고서

> 분석일: 2026-04-03

## 1. 기술 스택 요약

| 계층 | 기술 |
|------|------|
| 프레임워크 | Next.js 14.2 (App Router) |
| 인증 | NextAuth v4.24.13 (JWT) |
| DB | Supabase (PostgreSQL) |
| 스토리지 | Supabase Storage |
| 캐싱 | In-Memory (TTL 5분) |
| 외부 API | NEIS (학교 정보), Claude API |

---

## 2. API 라우트 (총 28개)

### 인증
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 핸들러 |
| `/api/auth/check-status` | GET | 인증 상태 확인 |

### 사용자
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/users/[id]` | GET | 사용자 프로필 조회 (프로필, 신뢰도, 포인트, 준수율) |
| `/api/users/[id]/season-history` | GET | 사용자 시즌별 이력 조회 |
| `/api/profile` | GET/PUT | 프로필 관리 |
| `/api/profile/summary` | GET | 프로필 요약 |

### 학력/경력
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/educations` | GET/PUT | 학력 정보 조회/저장 |
| `/api/career-records` | GET | 경력 기록 조회 (프로젝트 정보 포함) |

### 포트폴리오
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/portfolio-details` | GET/PUT | 포트폴리오 디테일 링크 (Detail 10) |
| `/api/portfolio-outputs` | GET/PUT | 포트폴리오 아웃풋 |
| `/api/portfolio-archives` | GET/PUT | 포트폴리오 아카이브 |

### 프로필 콘텐츠
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/introductions` | GET/PUT | 자기소개서 (성장 스토리, 경력 방향 등) |
| `/api/slogans` | GET/PUT | 슬로건 |
| `/api/videos` | GET/PUT | 비디오 정보 |
| `/api/photos` | GET/PUT | 사진 정보 |
| `/api/photos/upload` | POST | 사진 업로드 (Supabase Storage) |

### 평가/평판 시스템
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/reputation-keywords` | GET | 평판 키워드 |
| `/api/season-reputations` | GET/POST | 시즌별 평판 |
| `/api/weekly-reputations` | GET/POST | 주간 평판 |
| `/api/season-review` | GET/PUT | 시즌 리뷰 |
| `/api/review-link` | GET/PUT | 리뷰 링크 |

### 랭킹 시스템
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/weekly-ranking` | GET | 주간 랭킹 (별, 번개, 방패 포인트) |
| `/api/cluster-4-ranking` | GET | 클러스터 4 랭킹 |
| `/api/weekly-colleagues` | GET/POST | 주간 동료 정보 |

### 기타
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/activity-details` | GET/POST | 활동 상세 정보 |
| `/api/crews` | GET | 크루 목록 (팀/파트 정보 포함) |
| `/api/schools/search` | GET | 학교 검색 (NEIS API 연동) |
| `/api/test-user` | GET | 테스트 유저 |

---

## 3. 인증 방식

### NextAuth v4 (JWT 전략)

**소셜 로그인 제공자:**
- **Kakao (카카오)** — 주력 소셜 로그인, 이메일 기반 사용자 매칭
- **Google** — 선택적 소셜 로그인
- **Discord** — 선택적 소셜 로그인
- **Credentials** — 이메일/비밀번호 (외부 API `NEXT_PUBLIC_API_URL/auth/login` 연동)

**세션 흐름:**
```
사용자 로그인 (Kakao/Google/Discord/Credentials)
  → signIn 콜백: user_profiles 이메일 매칭, 승인 여부 확인
    → 미등록 사용자: applicants 테이블에 자동 등록
  → jwt 콜백: 토큰에 userId, email, 승인 상태 저장
  → session 콜백: JWT 데이터를 세션에 매핑
```

**환경 변수:**
```
NEXTAUTH_SECRET          # JWT 서명 키
NEXTAUTH_URL             # 콜백 URL
KAKAO_CLIENT_ID          # 카카오 REST API 키
KAKAO_CLIENT_SECRET      # 카카오 시크릿
GOOGLE_CLIENT_ID         # Google OAuth
GOOGLE_CLIENT_SECRET
DISCORD_CLIENT_ID        # Discord OAuth
DISCORD_CLIENT_SECRET
```

---

## 4. 데이터베이스 (Supabase PostgreSQL)

### 주요 테이블

**Core:**
- `user_profiles` — id, display_name, email, auth_email, profile_photo_url, status, growth_status 등
- `user_educations` — user_id, education_level, school_name, major_*, grades 등
- `user_introductions` — user_id, growth_story, social_experience, career_direction, work_style, personal_story, portfolio_output_* 등
- `user_growth_stats` — user_id, reliability_rate
- `user_cumulative_points` — user_id, total_stars, total_shields, total_lightnings
- `user_cumulative_compliance_rates` — user_id, practical_*_participated

**경력/프로젝트:**
- `career_records` — user_id, project_id, week_id, company_name, grade, enhancement_status
- `career_projects` — id, week_id, company_name, job_position, project_name, output_links, is_active

**포인트/랭킹:**
- `points` — user_id, week_id, point_type (star/lightning/shield), points
- `weeks` — id, week_number, start_date, end_date, season_id, is_club_break
- `seasons` — id, year, name

**조직:**
- `teams` — id, name
- `parts` — id, name, team_id
- `user_team_parts` — user_id, team_id, part_id, is_current

**기타:**
- `applicants` — id, email, name, applied_date, status
- `activity_types` — id, cluster_id

### DB 접근 방식

| 클라이언트 | 키 | RLS | 용도 |
|-----------|-----|-----|------|
| `supabaseAdmin` | `SUPABASE_SERVICE_ROLE_KEY` | 우회 | API Route (서버) |
| `supabase` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 적용 | 클라이언트 (제한적) |

### 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # 브라우저용 공개 키
SUPABASE_SERVICE_ROLE_KEY       # 서버용 관리자 키
```

---

## 5. 데이터 흐름

### 패턴 1: 인증 보호 API (GET)
```
프론트엔드 (fetch GET)
  → API Route (getServerSession(authOptions) 인증 검증)
    → user_profiles에서 email로 userId 조회
      → supabaseAdmin으로 데이터 SELECT
        → JSON 응답 반환
```

### 패턴 2: 공개 API (GET)
```
프론트엔드 (fetch GET + searchParams userId)
  → API Route (인증 없이 처리)
    → supabaseAdmin으로 데이터 SELECT
      → JSON 응답 반환
```

### 패턴 3: 데이터 저장 (PUT)
```
프론트엔드 (fetch PUT + JSON body)
  → API Route (인증 검증)
    → 기존 데이터 DELETE
      → 새 데이터 INSERT
        → 성공/실패 응답
```

### 패턴 4: 파일 업로드 (POST)
```
프론트엔드 (FormData + multipart/form-data)
  → API Route (파일 검증: 2MB 이하, 이미지 형식만)
    → Supabase Storage 업로드
      → Public URL 생성 및 반환
```

### 패턴 5: 외부 API 연동
```
클라이언트 query 파라미터
  → 대학교/대학원: 정적 JSON (korea-schools.json) 필터링
  → 초/중/고: NEIS 공공 API 실시간 요청
    → 결과 반환
```

---

## 6. 외부 서비스 연동

| 서비스 | 용도 |
|--------|------|
| Supabase | DB + Storage + Auth 보조 |
| NEIS API | 초/중/고 학교 검색 (`NEIS_API_KEY`) |
| Claude API | `@anthropic-ai/sdk` (AI 기능) |
| Kakao OAuth | 소셜 로그인 |
| Google OAuth | 소셜 로그인 |
| Discord OAuth | 소셜 로그인 |

---

## 7. 캐싱 전략

**In-Memory 캐싱** (TTL 5분, `/lib/cached-data.ts`):
- `getCachedTeams()` — teams 테이블
- `getCachedParts()` — parts 테이블
- `getCachedActivityTypes()` — activity_types 테이블

**렌더링**: 대부분의 API가 `export const dynamic = "force-dynamic"` (캐싱 비활성화)

---

## 8. 백엔드 패키지

```json
{
  "next": "^14.2.13",
  "next-auth": "^4.24.13",
  "@supabase/supabase-js": "^2.90.1",
  "@anthropic-ai/sdk": "^0.70.1",
  "sharp": "^0.33.5"
}
```

# 이전 작업자 코드 (격리 보존)

> 격리 일시: 2026-04-07
> 사유: 오랑캐 PMS 데이터 연결을 위해 백엔드를 새로 구축하면서, 이전 작업자의 코드를 격리

## 포함된 내용

- `api/` — Next.js API Routes (28개 라우트, 원래 위치: `app/api/`)
- `lib/` — 이전 작업자의 유틸리티 5개 (원래 위치: `lib/`)
  - `auth.ts` — NextAuth 설정 (Google/Discord/Kakao OAuth + Credentials)
  - `supabase.ts` — Supabase 클라이언트 (브라우저 + 서버 admin)
  - `supabase-server.ts` — 서버 전용 admin 클라이언트 (호출마다 새로 생성)
  - `cached-data.ts` — teams/parts/activity_types 5분 메모리 캐시
  - `dataMasking.ts` — 비로그인 사용자용 마스킹 유틸 (생년월일/이메일/주소/학교/전공 등)
- `backend/` — DB 설계 자료 (원래 위치: `backend/`)
  - `database/db-design-report.md` — **27개 테이블 전체 설계서 (961줄, 도메인 명세)**
  - `database/schema/*.sql` — 스키마/마이그레이션 (`user_activity_details`, `ALTER_USER_RELIABILITY_FK`)
  - `database/seeds/*.sql` — 시드 데이터 6개 (프로필 이미지, 샘플 사용자)
- `types/` — NextAuth 타입 정의 (원래 위치: `types/next-auth.d.ts`)

## 참고할 만한 파일 (재구축 시 1순위)

- **`backend/database/db-design-report.md`** — 27개 테이블 전체 설계서 (도메인 명세). 절대 잃어버리지 말 것.
- `lib/supabase.ts` — Supabase 클라이언트 설정 패턴 참고
- `api/profile/route.ts`, `api/profile/summary/route.ts` — 가장 큰 엔드포인트 (조인 + 캐시 패턴 참고)
- `api/auth/[...nextauth]/route.ts` + `lib/auth.ts` — NextAuth + OAuth 통합 패턴 참고
- `lib/dataMasking.ts` — 도메인-특화 마스킹 규칙 (재사용 가치 높음)

## 격리 시점에 함께 처리된 사항 (참고)

격리 작업 중 빌드 통과를 위해 다음 파일들에 최소 변경이 가해짐:

1. **`lib/supabase.ts` 신규 생성 (stub)** — 5개 컴포넌트가 `import { supabase } from '@/lib/supabase'` 로 직접 쿼리 중이라 모듈 경로를 보존해야 했음. 체이닝 + await 호환 stub으로 대체. 새 백엔드 레이어 구축 시 이 파일을 통째 교체.
2. **`hooks/useDataMasking.ts`** — `@/lib/dataMasking` import 제거 + 9개 마스킹 함수를 파일 내부 inline stub (모두 원본 그대로 반환)으로 대체. `[LEGACY REMOVED]` 태그 부착.

## 격리 시점에 이동하지 않은 파일 (의도적)

| 파일 | 사유 |
|---|---|
| `middleware.ts` | next-auth 패키지 직접 사용. lib/ import 없음. 격리 대상 아님 |
| `contexts/ProfileContext.tsx` | useSession (패키지) + fetch('/api/profile/'). 빌드 영향 없음 (런타임만 깨짐) |
| `hooks/useDataMasking.ts` | useSession (패키지) + lib/dataMasking → inline stub으로 변환 |
| `components/cluster-2/Cluster2Content.tsx` 등 fetch 호출 컴포넌트 | fetch는 동적 문자열이라 빌드 영향 없음. 런타임에서 404 발생 (수용) |
| `constants/dummyData/`, `data/` | 더미 데이터, 격리 대상 아님 |

## 주의

- 이 폴더의 코드는 **더 이상 프로젝트 빌드/실행에 포함되지 않음** (`app/`, `lib/`, `backend/`, `types/` 외부에 있음)
- 참고용으로만 사용하고, 필요한 부분이 있으면 새 코드에 재구현할 것
- **삭제하지 말 것** — `db-design-report.md`는 도메인 명세서이므로 특히 중요
- `_legacy/` 안의 파일들이 서로의 import 경로(`@/lib/auth` 등)를 깨뜨릴 수 있으나 무시 (실행 안 됨)

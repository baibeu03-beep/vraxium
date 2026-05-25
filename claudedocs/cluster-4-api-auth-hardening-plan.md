# Cluster4 권한 보강 — 조사 결과 + 수정 계획 (read-only)

조사일: 2026-05-20
조사 범위: Cluster4 Front가 호출하는 7개 user-facing API의 owner/admin 권한 게이트 점검
코드 수정: 없음 / Admin Editor 구현: 보류 / Supabase schema 변경: 금지

---

## 0. 공통 컨텍스트 (기존 primitive)

이미 코드베이스에 깔려 있는 권한 도구들 — **새 헬퍼를 만들기보다 이걸 재사용**해야 합니다.

| 도구 | 위치 | 동작 |
|---|---|---|
| `getServerSession(authOptions)` | NextAuth | 세션 검증. `session.user.email` 없으면 401 |
| `isAdminEmail(email)` | `lib/admin.ts:12` | ADMIN_EMAILS(3명) 매칭 |
| `extractTargetUserId(request)` | `lib/admin.ts:18` | URL query `targetUserId` 추출 |
| `getUserProfile(select, targetUserId?)` | `lib/get-user-profile.ts:66` | **세션 + admin override를 한 번에 처리**. `targetUserId` 넘기고 호출자가 admin이면 그 유저 profile 반환, 아니면 본인 profile 반환. 401/404 응답 객체도 직접 만들어 줌 |
| `canSeePersonalInfo()`, `getViewerContext()` | `lib/permissions.ts:63,83` | 역할(앰배서더/팀장/파트장) 기반 보기 권한 — Cluster4에서는 GET read 게이트로 쓰기엔 너무 무겁고, **본 작업 범위에서는 사용하지 않음** (admin/owner 둘로만 분기) |

**핵심 관찰**: `getUserProfile()`은 이미 "owner 본인 OR admin이 targetUserId로 가장" 패턴을 캡슐화해 둠. 대부분의 mutation 라우트가 이 헬퍼를 쓰고 있어 admin override가 작동함. 누락된 곳은 **GET 라우트** + **activity-details POST/DELETE 전체**.

이번 작업에서 **신규로 만들 헬퍼는 1개만 권장**:

```
// lib/api-auth.ts (제안, 코드 생성은 아직 안 함)
async function requireOwnerOrAdmin(request, targetUserId): Promise<
  | { ok: true; viewerUserId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse }
>
```

- session 검증 + admin 체크 + targetUserId가 본인과 같은지 확인 + 다른 사람이면 admin만 통과
- GET 라우트 6개에서 동일 패턴이 반복되므로 헬퍼화 가치 있음
- 내부에서 `getServerSession` + `isAdminEmail` + `getUserProfile`을 조합

---

## 1. 라우트별 현황 + 수정 계획 매트릭스

| 라우트 | Method | 세션 검증 | targetUserId 검증 | admin override | Owner 검증 | 누공 | 필요한 수정 |
|---|---|---|---|---|---|---|---|
| `/api/weekly-reputations` | GET | ❌ 없음 | ❌ 없음(format만 검증) | n/a | n/a | **타인 평판 누구나 read** | 세션 + (owner OR admin) gate 추가 |
| | POST | ✅ `getUserProfile` | ✅ admin 분기 | ✅ via getUserProfile | n/a (남에게 작성) | (정상) | 변경 없음 |
| | PUT | ✅ session | ✅ extractTargetUserId | ✅ `isAdmin` bypass (line 378) | ✅ reviewer_id 확인 (line 397) | (정상) | 변경 없음 |
| | DELETE | ✅ session | ✅ | ✅ isAdmin bypass (line 308,335) | ✅ reviewer_id 필터 | (정상) | 변경 없음 |
| `/api/weekly-colleagues` | GET | ❌ 없음 | ❌ 없음 | n/a | n/a | **타인 동료 목록 누구나 read** | 세션 + (owner OR admin) gate 추가 |
| | POST | ✅ `getUserProfile` | ✅ admin 분기 | ✅ via getUserProfile | n/a (본인이 자기 동료 저장) | atomicity: **delete+insert non-atomic** | 변경 없음(권한). atomicity는 별도 항목 5 |
| `/api/weekly-reviews` | GET | ❌ 명시적 comment "누구나 가능" (line 36) | ❌ explicitUserId 무검증 (line 53-60) | n/a | n/a | **타인 리뷰 누구나 read** | 세션 + (owner OR admin) gate 추가, comment 수정 |
| | POST | ✅ `getUserProfile` | ✅ admin 분기 | ✅ | n/a (본인이 자기 리뷰) | (정상) | 변경 없음 |
| | PUT `[id]` | ✅ `getUserProfile` + 세션 (line 97) | ✅ | ✅ isAdmin bypass (line 121) | ✅ user_id 확인 | (정상) | 변경 없음 |
| | DELETE `[id]` | ✅ session (line 174) | ✅ | ✅ isAdmin bypass (line 190) | ✅ user_id 필터 (line 202) | (정상) | 변경 없음 |
| `/api/activity-details` | GET | ❌ 없음 | ❌ user_id 무검증 | n/a | n/a | **타인 2차 정보 누구나 read** | 세션 + (owner OR admin) gate 추가 |
| | POST | ❌ **세션 자체 없음** (body의 user_id만 신뢰, line 64) | n/a | ❌ admin 식별 자체 없음 | ❌ 본인 확인 없음 | **🚨 최대 누공: 누구나 body.user_id 박아 타인 데이터 덮어쓰기 가능**. deadline gate(line 142-184)는 본인 확인이 아님 | 세션 + body.user_id가 viewer 본인이거나 viewer가 admin이어야 함. **admin은 deadline gate bypass** 추가 |
| | DELETE | ❌ 세션 자체 없음 | n/a | ❌ | ❌ | **🚨 누구나 query만으로 타인 2차 정보 삭제 가능** | POST와 동일 게이트 |
| `/api/career-records` | GET | ❌ 없음 | ❌ user_id 무검증 | n/a | n/a | **타인 enhancement_status / grade 등 user-specific 필드 누구나 read** (project master는 사실상 공개 OK) | 세션 + (owner OR admin) gate 추가 (또는 user_id가 있을 때만 게이트, 없을 때는 project master만 반환) |
| `/api/season-reputations` | GET | ❌ 없음 | ❌ | n/a | n/a | **타인 시즌 평판 누구나 read** | 세션 + (owner OR admin) gate 추가 |
| | POST | ✅ `getUserProfile` | ✅ | ✅ | n/a (남에게 작성) | (정상) | 변경 없음 |
| | PUT | ✅ session + isAdmin | ✅ | ✅ isAdmin bypass | ✅ reviewer_id 확인 | (정상) | 변경 없음 |
| | DELETE | ✅ session + isAdmin | ✅ | ✅ | ✅ | (정상) | 변경 없음 |
| `/api/season-review` | GET | ❌ 없음 | ❌ seasonHistoryId만으로 누구든 read | n/a | n/a | **타인 시즌 리뷰 누구나 read** | 세션 + ownership(또는 admin) gate 추가. `user_season_histories.user_id` 조회 후 owner OR admin만 |
| | PUT | ✅ `getUserProfile` (line 51) | ✅ extractTargetUserId | ⚠️ **부분 작동**: admin이 `?targetUserId=X`를 명시적으로 붙여야만 작동 (Front의 apiUrl() 헬퍼가 자동으로 붙이므로 실제로는 흐름이 통하지만, 명시적 isAdmin bypass는 없음 — line 91) | ✅ profile.id == seasonHistory.user_id | (브리틀하지만 작동) | **isAdminEmail bypass 추가** — 다른 라우트와 패턴 통일. admin은 targetUserId 없이도 또는 ownership 미스매치여도 통과 |

### 누공 우선순위 요약

🚨 **Critical** (즉시 보강 권장):
- `/api/activity-details` POST/DELETE — 세션 자체 없음. 익명 사용자가 임의의 user_id로 타인 2차 정보 덮어쓰기/삭제 가능.

🟡 **High** (Admin UI 진입 전 반드시 보강):
- 6개 GET 엔드포인트 — 누구나 타인 user-specific 데이터 read 가능.
- `/api/season-review` PUT의 admin bypass 누락 — Front 계약에만 의존하므로 비강건함.

🟢 **Nice-to-have**:
- `/api/weekly-colleagues` POST의 atomicity (별도 항목 5).

---

## 2. GET 보강 공통 패턴 (제안, 아직 코드 생성 아님)

7개 GET 엔드포인트가 거의 동일한 의미("나 또는 admin만 X의 데이터를 본다")이므로 동일한 게이트로 처리합니다.

```ts
// 의사코드 — 실제 코드 생성은 승인 후
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserProfile } from "@/lib/get-user-profile";

// targetUserId: 조회 대상이 누구인가 (query param에서 받은 값)
async function requireOwnerOrAdmin(targetUserId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: { status: 401, message: "로그인이 필요합니다." } };
  }
  const isAdmin = isAdminEmail(session.user.email);

  // 본인 user_id 확인
  const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", null);
  if (error) return { error };

  if (!targetUserId || targetUserId === profile.user_id) {
    return { ok: true, viewerUserId: profile.user_id, isAdmin };
  }
  if (isAdmin) {
    return { ok: true, viewerUserId: targetUserId, isAdmin };
  }
  return { error: { status: 403, message: "권한이 없습니다." } };
}
```

각 GET 라우트의 변경량은 5~7줄 (import 1, 함수 호출 1, error 분기 1).

> 사이드 효과 주의: `/api/profile`, `/api/educations`, `/api/cluster-4-ranking`처럼 **이미 익명 read를 전제로 만들어진 광범위 read 엔드포인트**가 다른 화면에서 같이 쓰이고 있음. 위 게이트는 **Cluster4 7개 라우트에만** 적용하고, 다른 라우트는 본 작업 범위 밖.

---

## 3. season-review PUT의 admin override (항목 3)

**현 상태**: line 91 `seasonHistory.user_id !== profile.id`. `getUserProfile()`은 `?targetUserId=X` + admin email 조합일 때 profile.id=X를 반환하므로 admin이 Front의 apiUrl 헬퍼로 `?targetUserId`를 붙이면 통과한다. 즉 **흐름은 작동하지만 isAdmin이라는 의도가 코드에 명시되지 않음**.

**수정 안** (`/api/season-review/route.ts:51-92`):

1. 기존 `getServerSession` + `isAdminEmail` import 추가.
2. PUT 진입 시 `isAdmin = isAdminEmail(session?.user?.email)`로 분리.
3. line 91 조건을 `if (!isAdmin && seasonHistory.user_id !== profile.id)`로 변경.

→ weekly-reputations PUT / weekly-reviews PUT과 동일 패턴이 되고, Front가 targetUserId를 빼먹어도 admin이면 통과.

---

## 4. activity-details POST의 admin bypass (항목 4)

**현 상태** (`route.ts:53-218`):
- POST에 세션 검증 자체가 없음. body.user_id만 신뢰.
- deadline gate (line 142-184): `isBeforeDeadline OR hasActiveGrant`만. admin email인지 안 봄.

**수정 안 (2단계)**:

### 4-A. 권한 게이트 추가 (먼저)
```
1. getServerSession → 없으면 401
2. isAdmin = isAdminEmail(session.user.email)
3. viewer = getUserProfile()로 본인 user_id 확인
4. body.user_id가 viewer.user_id와 다르면 → isAdmin이어야 통과, 아니면 403
```

### 4-B. Admin은 deadline gate bypass
```
if (!isAdmin && !isBeforeDeadline && !hasActiveGrant) return 403
```

→ 마감 지난 주차도 admin은 운영상 복구 가능. **`secondary_info_grants` 행을 별도로 만들지 않아도 admin은 직접 쓸 수 있게** 됨.

DELETE도 동일 게이트(4-A) 추가. DELETE에는 deadline 검사가 없으므로 4-B는 불필요.

> 결정 필요 (사람이): admin의 deadline bypass를 활성화할지, 아니면 admin도 `secondary_info_grants`를 명시적으로 만들고 일반 흐름을 타게 할지. 본 보고서는 단순함을 위해 4-B를 추천하지만 감사 로그 관점에서는 grants 경로가 더 깔끔할 수 있음.

---

## 5. weekly-colleagues delete+insert 비원자성 (항목 5)

**현 상태** (`route.ts:179-209`):
```ts
await supabase.from("weekly_colleagues").delete()...   // (1) 무조건 삭제
if (colleagues && colleagues.length > 0) {
  await supabase.from("weekly_colleagues").insert(insertData)  // (2) 다음 호출
}
```
- (1) 성공 후 (2)에서 네트워크/제약 위반으로 실패하면 → 기존 동료 사라지고 새 동료도 안 들어감 → **유저 데이터 영구 손실**.
- (1)과 (2) 사이에 race가 끼면 partial state.

**개선안 (소→대 순서, 사람이 고를 것)**:

| 안 | 변경 범위 | 트랜잭션성 | 추천 |
|---|---|---|---|
| **A. Try/catch 보호 + 백업** | 라우트 파일만 | 약함 (best-effort rollback) | △ 단순하지만 부분 실패 시 복구 불가 |
| **B. Upsert + 잔여 row 삭제** | 라우트 파일만 | 중간 (insert가 conflict 되면 update, 새 row만 다루므로 기존 row 잃지 않음) | ✅ **추천** — 코드 변경 작고, 부분 실패해도 기존 데이터 안전 |
| **C. Postgres function (RPC)로 트랜잭션 묶기** | 신규 RPC + 라우트 수정 | 강함 (true atomic) | ⚪ DB function 추가는 본 작업 범위 밖. 향후 검토 |

**B안 상세**:
1. `weekCardId`의 모든 colleague 목록을 `(user_id, week_card_id, rank)` 유니크 키로 upsert.
2. 새 목록에 없는 rank는 별도 DELETE로 제거 (e.g., `.delete().eq("user_id", ...).eq("week_card_id", ...).gt("rank", colleagues.length)`).
3. upsert 실패 시 기존 row가 그대로 남음 → 영구 손실 방지.

> 단, 현 `weekly_colleagues` 테이블에 `UNIQUE(user_id, week_card_id, rank)` 제약이 있는지 확인 필요 (스키마 변경 금지 원칙이므로 제약이 없으면 B안은 미적용 → A안으로 폴백).

---

## 6. 사이드 영향 분석 (수정 전 반드시 확인)

GET 라우트에 인증 게이트를 추가하면 영향받는 호출처:

| 라우트 | 현재 호출하는 컴포넌트/스크립트 |
|---|---|
| `/api/weekly-reputations` GET | Cluster41Content, Cluster4CardContent. **모두 로그인 사용자가 호출** → 영향 없음 |
| `/api/weekly-colleagues` GET | Cluster4CardContent — 로그인 사용자만 → 영향 없음 |
| `/api/weekly-reviews` GET | Cluster4CardContent — 로그인 사용자만 → 영향 없음 |
| `/api/activity-details` GET | Cluster4CardContent — 로그인 사용자만 → 영향 없음. **scripts/diag_*.mjs** 등 진단 스크립트가 호출한다면 service-role bypass 경로 별도 검토 필요 |
| `/api/career-records` GET | Cluster4CardContent — 로그인 사용자만 → 영향 없음 |
| `/api/season-reputations` GET | Cluster4Content — 로그인 사용자만 → 영향 없음 |
| `/api/season-review` GET | Cluster4Content — 로그인 사용자만 → 영향 없음 |

**미로그인/미승인 사용자의 데모 모드**(`isDemoMode()`): localStorage 플래그로 동작하며 데모 데이터는 API 호출 없이 컴포넌트 안에서 처리되므로 게이트 영향 없음. 다만 Cluster41Content가 데모 모드일 때도 `/api/profile`을 호출하는 분기가 있으므로 (line 47, demo + targetUserId), demo + targetUserId 조합에서는 API가 401 떨어질 가능성 있음 — Cluster41Content가 현재 어떻게 처리하는지 한 번 더 확인 권장.

---

## 7. 권장 시행 순서

> **모든 작업 코드 수정은 본 보고 승인 후 별도 PR로.**

| Step | 작업 | 영향 범위 | 리스크 |
|---|---|---|---|
| 1 | `lib/api-auth.ts` 신규 헬퍼 `requireOwnerOrAdmin` 작성 (위 §2 의사코드) | 새 파일 1개 | 무 |
| 2 | `/api/activity-details` POST/DELETE에 세션 게이트 추가 + admin 식별 + (admin이면 deadline bypass) | route.ts 1개 | 🚨 가장 큰 누공 막음. 기존 호출은 모두 본인 user_id로 오기 때문에 정상 작동 |
| 3 | 6개 GET 라우트에 §2 헬퍼 호출 추가 (weekly-reputations / weekly-colleagues / weekly-reviews / activity-details / career-records / season-reputations / season-review GET) | route.ts 7개 | 낮음. Cluster4 호출자는 모두 로그인 |
| 4 | `/api/season-review` PUT에 `isAdminEmail` bypass 추가 | route.ts 1개 | 무 |
| 5 | `weekly_colleagues` POST를 B안(upsert + 잔여 삭제)으로 전환 (선택) | route.ts 1개 + UNIQUE 제약 존재 확인 | UNIQUE 제약 없으면 폴백 |
| 6 | 회귀 확인: Cluster4 Front 3개 페이지를 데모/로그인/미승인/admin 4가지로 스모크 | UI | 무 |

각 step은 **독립된 PR**로 분리 가능하며, step 2가 가장 시급. step 3-6은 함께 묶어도 무방.

---

## 8. 의도적으로 변경하지 않는 것 (재확인)

- 새 테이블 생성: ❌
- Supabase schema 변경 (컬럼 추가/제약 변경): ❌
- `weeks`, `seasons`, `activity_types`, `weekly_activities` 같은 master 데이터 write 노출: ❌
- `points`, `user_weekly_growth`, `activity_records`, `career_records` 등 derived/판정 데이터 write 노출: ❌
- Admin Editor UI 추가: ❌ (지시대로 보류)
- `/api/profile`, `/api/cluster-4-ranking`, `/api/educations`, `/api/crews` 등 Cluster4 범위 밖 라우트: ❌

---

**결론**: 7개 라우트 중 **7개 GET, 2개 mutation(activity-details POST/DELETE)** 합쳐 **9개 핸들러**에 owner-or-admin 게이트가 비어 있음. 1개 신규 헬퍼 + 9개 핸들러 게이트 추가 + season-review PUT 1군데 admin bypass 추가로 정리 가능. 가장 큰 누공은 **`/api/activity-details` POST/DELETE의 무인증**이며 step 2로 단독 PR을 권장합니다. 승인 주시면 step 1-2부터 코드 작업 시작하겠습니다.

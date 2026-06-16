# W13 mode=test 신정책 success 테스트 fixture — 설계서 (구현 전)

작성일 2026-06-16 · 대상 week `a2112b50-64d2-42d6-a243-faf9fcdc6ffc` (2026-spring W13, start 2026-05-25)
상태: **설계만. 구현/DB 쓰기 없음.** 승인 후 구현.

---

## 0. 배경 (왜 지금 fail 인가 — 버그 아님)

- 고객앱은 테스트유저에게 항상 `mode=test` 를 보낸다 → admin `app/api/cluster4/weekly-cards/route.ts` 가 `getCluster4WeeklyCardsForProfileUser(user, { effectiveFromOverride: TEST_SUMMER_SIM_EFFECTIVE_FROM="1970-01-01" })` **라이브 계산**으로 분기(snapshot 무접촉).
- 이 override 는 레거시 경계(`CLUSTER4_SLOT_POLICY_EFFECTIVE_FROM="2026-06-29"`)를 과거로 밀어 **W13 을 신 여름 5슬롯 정책으로 시뮬**한다.
- 신정책 필수 슬롯 = experience **slot 1(도출)·2(분석)·3(평가)**. 테스트유저는 현재 레거시 통합라인(`[통합] 주차 활동 내역`, master `04e1f6ad`, org=common) 1개만 보유 → **시뮬은 이 라인을 org 슬롯에 매핑하지 않음** → 필수 3슬롯 전부 missing → verdict fail → `userWeekStatus=fail`.
- 운영 모드(mode 없음)는 W13 을 레거시로 평가 → 통합라인 success → `userWeekStatus=success`. **즉 운영/DB/snapshot 은 정상 일치, fail 은 시뮬 전용.**

검증 실측(edfe7e58 / T김주원 / oranke):
```
OPERATING : W13 success | exp 1슬롯(legacy) success
TEST(sim) : W13 fail    | exp slot1/2/3/5 fail(ltid missing) + slot4 n/a
```

---

## 1. 신정책 success 판정 규칙 (admin 소스 근거)

`lib/cluster4Enhancement.ts`, `lib/lineAvailability.ts` 기준.

| 상수 | 값 | 출처 |
|---|---|---|
| `EXPERIENCE_RATING_FAIL_THRESHOLD` | **3** (rating ≤ 3 → 강화 실패) | cluster4Enhancement.ts |
| `DEFAULT_WEEK_CHECK_THRESHOLD` | 30 (W13 은 weeks.check_threshold=**37** 적용) | lineAvailability.ts |
| `CLUSTER4_SLOT_POLICY_EFFECTIVE_FROM` | 2026-06-29 | lineAvailability.ts:45 |
| `TEST_SUMMER_SIM_EFFECTIVE_FROM` | 1970-01-01 | lineAvailability.ts:49 |

### 1-A. 슬롯 매핑 (org별)
slot_order/category 는 `cluster4_experience_line_masters.experience_slot_order` + `experience_category` 컬럼 SoT. 시뮬은 **slot_order 당 1칸**만 렌더(같은 slot 마스터 여러 개면 dedupe; phalanx slot1 4개 마스터 → 1칸 확인됨).

| org | slot1 (도출) master | slot2 (분석) master | slot3 (평가) master |
|---|---|---|---|
| encre | `EXEC-EN0001` 4b1d2226 | `EXEC-EN0002` 7154cb52 | `EXEC-EN0003` 2ef5df67 |
| oranke | `EXOK-EN0002` f6811bf1 | `EXOK-EN0003` 8f12e9c6 | `EXOK-EN0001` df105a36 (또는 EXOK-EN0004) |
| phalanx | `EXPX-EN0001` (도출 1/4 외 3개 중 1) | `EXPX-EN0005` | `EXPX-EN0006` |
> 레거시 통합 master `04e1f6ad`(EXBS-EN0000, org=common)는 slot_order=1 이지만 org 슬롯과 별개라 시뮬 org-슬롯에 안 잡힘.

### 1-B. per-slot enhancementStatus = success 조건 (slot 1/2/3)
모두 충족해야 success:
1. active experience `cluster4_lines` 행 존재 + 그 `experience_line_master_id` = 해당 org/slot 마스터
2. `cluster4_line_targets` 행: `target_mode='user'`, `target_user_id=<유저>`, `week_id=W13`, `line_id=<위 라인>`
3. 마감 경과: `submission_closes_at < now` (W13 마감 2026-05-31 < 오늘 → 충족)
4. 평점: `cluster4_experience_line_evaluations` rating **null(미평가) 또는 > 3** → success / rating ≤ 3 → fail

### 1-C. 주차 verdict + checkGate
- `reduceExperienceRequiredSlotVerdict([slot1,2,3])`: 하나라도 fail→fail / 전부 success→pass.
- `applyExperienceCheckGate`(pass 일 때만): `earned = user_weekly_points.points`(해당 week_start), `required = 37`, `enforced=true`(신정책). `earned ≥ 37` → pass 유지, 아니면 **fail 강등**(슬롯 강화상태는 success 유지).
- ⚠ 구현 시 검증 필요: 시뮬 경로에서 checkGate `enforced=true` 실제 적용 여부 + `earned` 가 W13 user_weekly_points.points 를 읽는지.

---

## 2. 현재 cohort 인벤토리

W13 에 experience target 보유 테스트유저 = **76명** (encre 26 · oranke 25 · phalanx 25).
전원 동일: **레거시 통합라인 1개만 보유 → 시뮬 org-슬롯 0개(slot 1/2/3 전부 missing)**.
checkGate(≥37) 분포: PASS **54명** / FAIL(<37, 슬롯 추가해도 강등으로 잔류 fail) **22명**.

| org | total | 슬롯추가 시 success (≥37) | checkGate로 잔류 fail (<37) |
|---|---|---|---|
| encre | 26 | 19 | 7 |
| oranke | 25 | 18 | 7 |
| phalanx | 25 | 17 | 8 |

전체 76명 표 → `claudedocs/w13_fixture_cohort.csv`. 인벤토리 재생성 = `scripts/verify_w13_fixture_inventory.mjs`.

**checkGate 잔류 fail 22명**(points<37, 운영데이터라 미수정 → 정당한 fail):
T강현우(25) T권태현(36) T한지민(19) T이수아(6) T박지훈(22) T이서연(13) 이유나(0) [encre] · T안시우(14) T황지유(26) T정채원(8) T한지윤(34) T오지우(11) T한서준(20) T권예준(22) [oranke] · T조현우(34) T서승현(12) T오다은(13) T최민재(15) T이정우(32) T김예은(2) T박민서(34) T이하준(12) [phalanx]

---

## 3. Fixture 설계 (공유 라인 + per-user 타깃)

### 3-A. 추가할 행
**(1) 공유 experience 라인 9개** = 3 슬롯 × 3 org. `cluster4_lines`:
- `part_type='experience'`, `is_active=true`, `week_id=W13`
- `experience_line_master_id` = §1-A 표의 org/slot 마스터
- `submission_opens_at='2026-05-24T15:00:00Z'`, `submission_closes_at='2026-05-31T14:59:59Z'` (레거시 라인과 동일, 마감 경과)
- 식별 태그(롤백/구분용): `source_file_name='TESTSIM-W13-FIXTURE-20260616'`, `line_code='EXSIM-W13-S{n}-{org}'`
- `main_title` = "(테스트 시뮬) {category} 슬롯"

**(2) per-user 타깃 228개** = 76명 × 3슬롯. `cluster4_line_targets`:
- `line_id=<위 org/slot 라인>`, `week_id=W13`, `target_mode='user'`, `target_user_id=<cohort 유저>`
- 유저 org 에 맞는 3개(slot1/2/3) 라인만 연결

**(3) 평점 — 선택.** 미생성(=rating null) 시 success. baseline success 엔 불필요.
- 항목4(rating 5→success / 3→fail) 검증 시: `cluster4_experience_line_evaluations(user_id, line_target_id, rating)` 추가.

### 3-B. 안 건드리는 것 (운영 데이터 보호)
- `user_weekly_points`(checkGate earned) · `user_week_statuses` · 레거시 통합라인/타깃 · snapshot 테이블 — **전부 미수정**.
- 22명(<37)은 그대로 fail.

### 3-C. 선택: slot5(관리) success 로 강화율 100%
필수 아님(verdict 무관). 심화/운영진 유저 강화율까지 100% 원하면 org slot5 master(EXBS-EL0001/0002) 라인+타깃 추가. 기본 설계 제외(slot5 fail → 강화율<100%, 주차 success 엔 영향 없음).

---

## 4. "mode=test 전용" 보장 분석

신규 9라인/228타깃이 운영에 새는지 점검:
- **운영 경로**: W13 은 레거시(start<2026-06-29) → `getCluster4WeeklyCardsForProfileUser`(override 없음)가 레거시 통합라인만 평가, **비통합 experience 라인/타깃 skip**(cluster4WeeklyCardsData.ts step1/2 legacy gate). → 신규 슬롯 라인 무시.
- **snapshot**: 동일 함수(override 없음) → 레거시 skip → snapshot 불변. **재계산 불필요.**
- **weekly-growth**: 레거시 override 적용 → 무영향.
- **실유저**: 타깃이 test_user_markers 유저 id 로만 스코프 → 실유저 무영향.
- **타 주차**: 라인 week_id=W13 + 타깃 week_id=W13 → 다른 주차 쿼리에 안 잡힘.
- **잔존 리스크**: 테이블에 test-only 플래그는 없음(스키마상). 누군가 `CLUSTER4_SLOT_POLICY_EFFECTIVE_FROM` 을 W13 이전으로 당기면 운영이 이 라인을 읽게 됨 → `source_file_name='TESTSIM-W13-FIXTURE-*'` 태그로 식별/롤백 가능하게 설계.
- ⚠ §4 의 "운영 레거시 skip" 은 코드 근거(agent 매핑)이며 **구현 직후 실측 검증 필수**(아래 5-검증 2·3).

---

## 5. 검증 계획 (구현 후 실행)

대표 유저: edfe7e58(oranke), encre 1명, phalanx 1명 + 전수 스팟.

1. **direct function/DB**: 추가된 9라인·228타깃·(있으면)평점 행 존재 확인.
2. **운영 무변화(핵심)**: `GET /weekly-cards?userId=<u>` (mode 없음) → W13 여전히 `success` + exp 1슬롯(legacy). snapshot row `dto_version/is_stale/cards` 불변.
3. **snapshot 불변**: fixture 전후 `cluster4_weekly_card_snapshots` diff 없음. 재계산 트리거 안 함.
4. **HTTP test 경로**: `GET /weekly-cards?userId=<u>&mode=test` → W13 `userWeekStatus=success`, exp slot1/2/3 `enhancementStatus=success`, points 41 유지.
5. **direct == HTTP**: 슬롯/verdict 동일.
6. **브라우저**: `/cluster-4-card/<W13>?demoUserId=<u>&mode=test&org=<org>` → 성장(성공) + 강화성공 렌더 캡처.
7. **전수**: cohort 54명(≥37) success / 22명(<37) fail 확인. 회귀로 W12·W11 등 타 주차 불변.
8. **demoUserId==internal 경로 동일 DTO**: 두 mode=test 진입점(데모 분기/internal 분기) 결과 동치.

완료 기준: **mode=test 에서 (≥37 유저) direct==HTTP==browser 모두 success + points 유지 + exp enhancementStatus success**, 그리고 **운영/snapshot 불변**.

---

## 6. 구현 산출물(예정, 승인 후)
- `vraxium-admin/scripts/seed-w13-testsim-fixture.ts` (idempotent insert, 태그 기반 재실행/롤백)
- 검증 스크립트: 기존 `scripts/verify_w13_*.mjs` 확장
- 롤백: `source_file_name='TESTSIM-W13-FIXTURE-20260616'` 라인 + 그 line_id 타깃 일괄 삭제

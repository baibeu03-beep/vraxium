# Cluster4Ranking — 디자인 교체로 인한 백업

백업 일자: 2026-05-10
백업 사유: /weekly-ranking 페이지를 신규 스펙(Weekly League 디자인)으로 교체.
기존 컴포넌트는 시안과 디자인이 완전히 달라 통째 백업 처리.
의도(특정 주차 안 개인 랭킹)는 동일하므로, 다음 회차 카드 본 구현 시 데이터/로직 일부 재활용 예정.

## 백업 내용

### 1. components/cluster-4-ranking/Cluster4RankingContent.tsx (1,435줄)
- 기존 동작: 시즌/주차 드롭다운으로 특정 주차 선택 → 그 주차 개인 랭킹 카드 리스트 표시
- 부가 기능 (다음 회차 재활용 예정):
  * 팀별 활동 인정률 Swiper (지표별 비교)
  * 팀별 성장 승패 세로 막대그래프
  * 1/2/3등 메달 그라디언트, 1등 왕관 👑
- 데이터 소스: /api/cluster-4-ranking?weekId=...
- 사용 타입: RankingUser, WeekOption, RateInfo, TeamStats
- 메모리에 명시된 패턴: `info-badge.role` + `truncate(roleLabel, 8)`

### 2. app/(main-layout)/weekly-ranking/page.tsx
- 기존 내용: Cluster4RankingContent 마운트 (Breadcrumb wrapper 포함)
- 백업 사본 (cp). 원본은 3단계에서 신규 내용으로 덮어씀.

## 다음 회차에 재활용할 것

- ✅ RankingUser 타입 정의 (인터페이스 그대로)
- ✅ /api/cluster-4-ranking API 호출 로직
- ✅ getStatusDisplay / getStatusClass / getStatusIcon / isStatusPlusOne 헬퍼
- ✅ truncate 헬퍼 (info-badge role 8자 제한)
- ✅ 팀별 통계 계산 useMemo (rankings → teamStats)
- ✅ 팀 활동 인정률 Swiper UI
- ✅ 성장 승패 막대그래프 UI
- ✅ 1/2/3등 메달 + 왕관 시각 패턴

## 폐기할 것

- ❌ 시즌/주차 드롭다운 UI (신규 필터바로 대체)
- ❌ 기존 Hero 영역 부재 (신규 Hero로 추가)

## 유지된 것 (백업하지 않음)

- app/api/cluster-4-ranking/route.ts — 그대로 유지, 다음 회차에 재사용
- types/RankingUser 등 타입은 다음 회차에 신규 컴포넌트로 import

## 복구 방법

만약 신규 디자인을 폐기하고 기존으로 복구하려면:
1. 신규 components/weekly-ranking/* 삭제
2. 본 폴더의 components/cluster-4-ranking/* 를 원래 경로로 mv
3. 본 폴더의 app/(main-layout)/weekly-ranking/page.tsx 를 원래 경로로 cp(덮어쓰기)

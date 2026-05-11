# Weekly Ranking — Dead Code Backup (정정본)

## ⚠️ 정정 안내

본 README는 최초 작성 시 "기존 /weekly-ranking 페이지의 코드"라고 잘못 기재되었다.
**실제로는 라우트에 연결된 적이 없는 dead code였음**이 다음 회차에 확인되었다.

진짜 동작 중이던 페이지는 `Cluster4RankingContent.tsx`였으며,
이는 별도 백업 폴더(`_archive/cluster-4-ranking-legacy-20260510/`)에 보관됨.

## 백업 내용 (실제 dead code)

- `components/weekly-ranking/`
  - WeeklyRankingContent.tsx (143줄)
  - WeekSelector.tsx (118줄)
  - RankingCard.tsx (76줄)
  - types.ts (44줄)

- `app/api/weekly-ranking/route.ts` (276줄)

## 이 코드의 위상

- 사이드바 / 다른 페이지 / 라우트에 import된 흔적 없음.
- `app/(main-layout)/weekly-ranking/page.tsx`는 별도 컴포넌트(`Cluster4RankingContent`)를 마운트하고 있었고, 본 폴더 코드와는 무관.
- 즉, 누군가 만들다 만 dead code였을 가능성이 높음.

## 복구가 필요할 때

폴더 내용을 원래 경로(`components/weekly-ranking/`, `app/api/weekly-ranking/`)로 mv 하면 됨.
단, 라우트 page.tsx는 별도로 작성해야 동작함.

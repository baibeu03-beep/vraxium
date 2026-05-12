# 📋 `/cluster-4-px` PX Green 진단 보고서

> 조사 기준: 브랜치 `Tuna`, 디스크 파일 + `main.scss` import 순서 + `Cluster41Content.tsx` JSX (2330 lines)
> 수정은 일체 진행하지 않았습니다.
> 작성일: 2026-05-12

---

## ⚠️ 라우트 ↔ 컴포넌트 매핑 (중요)

`/cluster-4-px` 와 `/cluster-4-1-px` 는 **렌더 컴포넌트가 다릅니다.**
본 진단의 대상은 `/cluster-4-px` 한정입니다.

| 라우트 | 렌더 컴포넌트 | 본 진단 |
|---|---|---|
| `/cluster-4` | `components/cluster-4-1/Cluster41Content.tsx` (weekly list) | 기준 비교 대상 |
| **`/cluster-4-px`** | **`components/cluster-4-1/Cluster41Content.tsx`** (weekly list) | **✅ 본 진단 대상** |
| `/cluster-4-1` | `components/cluster-4/Cluster4Content.tsx` (season detail) | 대상 아님 |
| `/cluster-4-1-px` | `components/cluster-4/Cluster4Content.tsx` (season detail) | 별도 보고서 `cluster-4-1-px-diagnostic.md` |
| `/cluster-4-card-px/[weekId]` | `components/cluster-4-card/Cluster4CardContent.tsx` | 대상 아님 |

`Cluster41Content` 가 실제로 렌더하는 섹션 (Cluster41Content.tsx L1467 ~ L2325):

- `<div className="cluster4-content cluster4-content--week">` (L1467 root)
- `<section className="cluster4-section1">` (L1469) — CLUB CHALLENGE GROWTH hero
- `<section className="cluster4-section2">` (L1509) — WEEKLY GROWTH 카드
- `<section className="cluster4-weekly-list">` (L1718) — 필터바 + 주차 카드 + 페이지네이션

> 본 라우트에는 `cluster4-section3` / `cluster4-section3-banner` / `cluster4-section4` / `section-modal*` / `help-modal*` 가 **렌더되지 않습니다.** `_cluster4-px.scss` 의 13번 블록(`.cluster4-section3.*` overrides)과 `_cluster4-week.scss` 의 modal/`cluster4-card-content` 룰들은 본 라우트에서는 dead selector 입니다 (cascade 충돌 없음, 무해).

---

## 1) 현재 사용 중인 파일 목록

**컴포넌트 파일**
- `components/cluster-4-1/Cluster41Content.tsx` (2330 lines)
  - L12: `import { isPxRoute, withPxRoute } from "@/lib/cluster-route"`
  - L127-130: `isPX` flag + `filterAccent`/`filterAccentBg`/`filterAccentBgSelected` PX 분기
  - L1467: `<div className="cluster4-content cluster4-content--week">` root
  - L1539: 아호 캐릭터 image `isPX ? "...-px.png" : "....png"` ✅
- `app/(host)/(main-layout)/(cluster-pages)/cluster-4-px/page.tsx` — Suspense + Cluster41Content
- `app/(host)/(main-layout)/(cluster-pages)/layout.tsx` (L45) — `cluster-px-theme` wrapper

**원본 SCSS** (`/cluster-4` 와 `/cluster-4-px` 공통)
- `_cluster4-season.scss` (8355 lines) — `main.scss` **L144** import. `cluster4-section1`/`cluster4-section2`/`cluster4-weekly-list` 정의 (그 외 section3/section4 도 정의 — 본 라우트는 미렌더).
- `_cluster4-week.scss` (14614 lines) — `main.scss` **L145**. L85-108 `.cluster4-content--week { ... .cluster4-section2 .season-growth-card .card-right { ... } }` (위치 보정만). 그 외에는 `.cluster4-card-content` 스코프이므로 본 라우트 무영향.

**PX override SCSS**
- `_cluster4-px.scss` (874 lines) — `main.scss` **L146** import. base 보다 뒤 cascade ✅. `/cluster-4-px` + `/cluster-4-1-px` + `/cluster-4-card-px` 공용.
- `_cluster4-card-px.scss` — `main.scss` **L147** import. `.cluster4-card-content` 스코프이므로 본 라우트 미적용.
- `_px-tokens.scss` — `main.scss` **L137**. `--px-accent: #1E9503`, `--px-accent-soft: #B2FF8F`, `--px-accent-glow: rgba(30,149,3,0.45)`, `--px-accent-soft-glow: rgba(178,255,143,0.35)`, `--px-gradient`.

**Cascade 순서 (main.scss)**
```
L137 _px-tokens          (토큰 정의)
L144 _cluster4-season    (base — section1/2/weekly-list yellow 원본)
L145 _cluster4-week      (base — 본 라우트는 L85-108 layout-only)
L146 _cluster4-px        ★ override (반드시 base 뒤)
L147 _cluster4-card-px   (다른 라우트용)
L167 cluster4-season-responsive  (DISABLED, 빈 파일 ✅)
L168 cluster4-week-responsive    (DISABLED, 빈 파일 ✅)
```
`_cluster4-px.scss` 가 마지막 active 파일이라 cascade 정상.

**token / helper**
- `lib/cluster-route.ts` — `isPxRoute()` (segment `-px` 매칭 정규식), `withPxRoute()`
- `utils/pxLabelAlias.ts` — `getPxAlias()` 호출은 본 라우트에서 없음 (cluster1-3 인포 행 대상)

**이미지 관련 파일** (`public/images/0/cluster4/`)

| 자산 | 원본 | PX 변형 | 처리 |
|---|---|---|---|
| 시즌 카드 backdrop | `4-1/bg image.png` | 없음 | SCSS `background-blend-mode: multiply` + dark-emerald linear-gradient (PX block 10) |
| 시즌 카드 warrior (sword/fire/ice) | `4-1/image.png` | 없음 | **변경 없음** — 캐릭터 식별색 유지 ✅ |
| 아호 캐릭터 | `아호 캐릭터.png` ✅ 존재 | `아호 캐릭터-px.png` ✅ 존재 | TSX `isPX ? ... : ...` 분기 (L1539) ✅ |
| 시즌 카드 gold frame | `bg border.png` | 없음 | SCSS `filter: hue-rotate(80deg)` (PX block 7) |
| 필터 PNG 아이콘 | `icon - 1~5.png` | 없음 | SCSS `filter: hue-rotate(80deg)` (PX block 6) |
| 탭/배지 PNG | `icon - 전구.png`, `icon - book.png`, `icon - wallet.png`, `icon - plus.png` 등 | 없음 | 미변경 (semantic icon) |

---

## 2) 실제 적용 중인 PX selector 목록 (본 라우트 한정)

> scope: `<main class="nftg-content nftg-content-home cluster-px-theme">` (layout.tsx L45) → `<div class="cluster4-content cluster4-content--week">` (Cluster41Content L1467). DOM 체인 ✅. 아래 모든 selector 가 매칭됩니다.

### 2-A) Section 1 (CLUB CHALLENGE GROWTH hero)

| selector | 라인 | 적용 대상 DOM | 매칭 | 원본 → 현재 | 상태 |
|---|---|---|---|---|---|
| `.cluster4-content .top-tabs .tab:first-child` bg !important | `_cluster4-px.scss` L76-78 | 좌상단 첫 번째 탭 (전구 아이콘, TSX L1472 인라인 `#FAAB07` 도 덮음) | ✅ | `#FAAB07`/`#faab07` → `var(--px-accent)` | 정상 |
| `.cluster4-content .top-tabs .tab .tab-badge` bg | L81-83 | tab hover popup (Weekly Growth / Season Growth) | ✅ | `#ffec8f` → `var(--px-accent-soft)` | 정상 |
| `.cluster4-content .section1-description .quote-highlight` 텍스트 그라데이션 | L87-91 | hero 인용문 강조 ("무언가를 성취하기 위해...") | ✅ | `linear-gradient(90deg, #fed402, #fff1aa)` → `linear-gradient(90deg, var(--px-accent), var(--px-accent-soft))` | 정상 |
| `.cluster4-section1::after` bg !important | L180, L183 | section1 하단 1px pseudo divider (80% 폭, 좌우 중앙) | ✅ | `#ecbb02` → `var(--px-accent)` | 정상 |
| `.cluster4-content > section > .floating-icons .edit-icon` bg + hover | L656-664 | section1 우상단 floating edit 동그라미 | ⚠️ Dead | `#faab07/#ffc919` → `var(--px-accent)` | **본 라우트 TSX 에는 `.floating-icons` 미렌더** → dead selector (cascade 충돌 없음, 무해) |
| `.collection-text` defensive reset | L642-647 | 시즌 로딩 안내 문구 | ✅ (TSX L1548 에 .collection-text 존재) | 외부 cascade 침투 방지 | 정상 |

### 2-B) Section 2 (WEEKLY GROWTH 카드)

| selector | 라인 | 적용 대상 DOM | 매칭 | 상태 |
|---|---|---|---|---|
| `.season-growth-card .season-badge .badge-outline path stroke + .badge-border path fill/stroke` !important | L95-103 | season-badge SVG (TSX L1526/L1529 인라인 `stroke/fill="#FAAB07"`) | ✅ CSS 가 presentation attr 우선 | 정상 |
| `.cluster4-section2 .season-growth-card::after { filter: hue-rotate(80deg) }` | L162-164 | gold parallelogram frame PNG (`bg border.png`) | ✅ | 정상 (raster filter) |
| `.cluster4-section2 .season-growth-card { &::before, .card-background } { background-image: linear-gradient(135deg, rgba(15,80,20,0.72), rgba(30,149,3,0.45)), url(bg image.png); background-blend-mode: multiply, normal }` | L321-348 | 카드 backdrop yellow tone → dark emerald | ✅ | 정상 (warrior `<img>` / 아호 캐릭터는 별도 자식 → 영향 없음) |
| `.cluster4-section2 .season-growth-card .card-left .season-title-shadow { -webkit-text-stroke: 1px var(--px-accent) }` | L231-234 | "WEEKLY GROWTH" 타이틀 stroke | ✅ | 정상 |
| `.cluster4-card-content .card-title / .week-title / .season-title / .badge-title` color | L27-32 | (cluster4-card-content 스코프) | ⚠️ Dead 본 라우트 | 무해 (다른 라우트용) |
| `.details-card .details-content .detail-row .detail-value { color, .number, .orange-highlight }` !important | L114-124 | Details 펼침 패널 (성장 시작/완료/종료 주차 값) | ✅ TSX L1582/L1588/L1600 `.orange-highlight` 매칭 | 정상 |

### 2-C) Section 3 (cluster4-weekly-list)

| selector | 라인 | 적용 대상 DOM | 매칭 | 상태 |
|---|---|---|---|---|
| `.cluster4-weekly-list::before` bg !important | L182, L183 | 필터바 위쪽 1px pseudo divider | ✅ | `#ecbb02` → `var(--px-accent)` 정상 |
| `.weekly-filter-bar .filter-card:hover { border-color }` | L136-138 | 필터 카드 hover 외곽선 | ✅ | `#ffa500` → `var(--px-accent)` 정상 |
| `.weekly-filter-bar .filter-card.filter-card-large { background, border-color }` | L140-144 | Reset 버튼 (큰 카드, 254×40) | ✅ | `#ffe3aa` → `var(--px-accent-soft)` 정상 |
| `.weekly-filter-bar .filter-icon, .card-icon { filter: hue-rotate(80deg) }` | L148-151 | 필터 카드 PNG 아이콘 5종 (icon-1~5.png) | ✅ | 정상 (PNG raster filter) |
| 필터 dropdown 인라인 색상 (`filterAccent`/`filterAccentBg`/`filterAccentBgSelected`) | TSX L128-130 | 시즌/주차결과 dropdown menu 항목 (border, bg, label color, selected/hover bg) | ✅ TSX `isPX ? "#1E9503" : "#FFA500"` 직접 분기 | 정상 (SCSS `.filter-dropdown .dropdown-menu` 룰은 인라인 fixed 메뉴라 dead) |
| `.weekly-card .weekly-card-header .weekly-card-week .week-number` color | L246-249 | "+1" 누적 주차 숫자 | ✅ | `#faab07` → `var(--px-accent-soft)` 정상 |
| `.weekly-card-main-progress .progress-label .dot` + `.weekly-card-stats .stat .dot` + `.weekly-card-extra-stats .stat .dot` | L252-256 | 좌측 행 머리 점 | ✅ | 정상 |
| `.progress-label strong` (메인 주차 성장률 %) | L259-261 | 성장률 % 강조 | ✅ | 정상 |
| `.progress-fill` bg | L264-266 | 메인 progress bar 게이지 | ✅ | `#faab07` → `var(--px-accent)` 정상 |
| `.total-count strong` | L269-271 | "총 X개 중 Y개" 카운트 | ✅ | 정상 |
| `.weekly-card-stats .stat strong` + `.stat .gray .num` | L274-279 | 정보/역량/경험/경력 강화율 % 와 (count/total) 숫자 | ✅ | 정상 |
| `.weekly-card-extra-stats .stat .num` | L282-284 | 평판 / FM / 연계 동료 카운트 | ✅ | 정상 |
| `.weekly-card-extra-stats .stat.fm-badge .wifi-icon { filter: hue-rotate(80deg) }` | L286-290 | (TSX 에 미렌더 — `.fm-badge`/`.wifi-icon` 없음) | ⚠️ Dead 본 라우트 | 무해 |
| `.weekly-card:has(.weekly-card-status-badge.in-progress) .highlight { color: #9b59b6 }` + `.counting → #ff1493` | L302-307 | 진행 중/집계 중 상태 라벨 색을 우측 상단 status badge 와 동기화 | ✅ JSX/DOM 미수정 | 정상 (semantic alignment) |

---

## 3) 남아있는 yellow/gold source 목록

### 3-A) ⚠️ 변경 대상 (미적용)

| # | DOM 위치 | computed | source selector | source file:line | semantic | 권장 |
|---|---|---|---|---|---|---|
| **A-1** | `.cluster4-weekly-list .weekly-pagination .page-num` (active, hover) text + `::after`/`::before` 가로 라인 | `#ddf247` (lime-yellow) | `.cluster4-weekly-list .weekly-pagination .page-num { :hover, &.active, &::after bg, &::before bg }` | `_cluster4-season.scss` L5188, L5201, L5209, L5214 | ❌ 의미색 아님 (decorative 강조) | PX-soft `#B2FF8F` 로 치환. `_cluster4-px.scss` 의 block 13-11 (`.cluster4-section3 .section3-pagination .page-num`) 과 동일 패턴으로 `.cluster4-weekly-list .weekly-pagination .page-num` 추가. **본 라우트 유일한 brand decorative 잔존 yellow.** |

### 3-B) ✅ 이미 정상 적용된 영역 (참고)

| DOM 위치 | source selector | 상태 |
|---|---|---|
| section1 hero quote-highlight | `.section1-description .quote-highlight` | ✅ (block 3) |
| section1 하단 1px divider | `.cluster4-section1::after` | ✅ (block 8) |
| section2 SEASON GROWTH 외곽 gold frame | `.season-growth-card::after` | ✅ filter: hue-rotate (block 7) |
| section2 카드 backdrop (yellow tone) | `.season-growth-card::before` + `.card-background` | ✅ blend-mode multiply (block 10) |
| section2 WEEKLY GROWTH 타이틀 stroke | `.season-title-shadow -webkit-text-stroke` | ✅ (block 9) |
| section2 season-badge SVG | `.season-badge .badge-outline/.badge-border path` | ✅ !important (block 4) |
| section2 Details 우측 패널 숫자/orange-highlight | `.details-card .details-content .detail-row .detail-value` | ✅ (block 5) |
| weekly-list 위쪽 divider | `.cluster4-weekly-list::before` | ✅ (block 8) |
| weekly-filter-bar hover/large/filter-icon | `.filter-card:hover`, `.filter-card-large`, `.filter-icon` | ✅ (block 6) |
| 필터 dropdown menu 색상 | TSX 인라인 `filterAccent`/`filterAccentBg`/`filterAccentBgSelected` | ✅ (PX 분기) |
| top-tabs first child + tab-badge | `.top-tabs .tab:first-child` + `.tab-badge` | ✅ (block 1, 2) |
| weekly-card 내부 12 항목 (주차 숫자/dot/progress/total/stat strong/num/평판 num/FM num 등) | `_cluster4-px.scss` block 11 (L244-308) | ✅ |

### 3-C) Dead selector (본 라우트 무관 — 변경 불필요)

| selector | 위치 | 사유 |
|---|---|---|
| `_cluster4-px.scss` L656-664 `.floating-icons .edit-icon` | section1 우상단 | TSX 에 미렌더 |
| `_cluster4-px.scss` L286-290 `.fm-badge .wifi-icon` | weekly-card extra stats | TSX 에 `.fm-badge`/`.wifi-icon` 미렌더 (FM 은 텍스트만) |
| `_cluster4-px.scss` block 13 (`.cluster4-section3.*`) | /cluster-4-1-px 전용 | 본 라우트 section3 미렌더 |
| `_cluster4-px.scss` block 12 (`.cluster4-card-content.*`) | /cluster-4-card-px 전용 | 본 라우트 cluster4-card-content 미사용 |
| `_cluster4-px.scss` L201-207 `.season-reputation-bottom-divider` 등 | reputation section | 본 라우트 reputation 영역 미렌더 |
| `_cluster4-px.scss` L219-222 `.work-exp-section/.work-career-section .section-bottom-divider` | work section | 본 라우트 work section 미렌더 |
| `_cluster4-season.scss` L4437-4444 `.filter-dropdown .dropdown-menu .dropdown-item:hover/.selected` (#ffa500) | filter dropdown | TSX 가 인라인 `position: fixed` dropdown 으로 대체 (SCSS dropdown-menu 미사용) |
| `_cluster4-season.scss` L4878 `.weekly-card-info .info-badge strong { color: #ffa500 }` | role badge 내부 strong | TSX role badge 내부에 `<strong>` 없음 → dead |
| `_cluster4-season.scss` L5246-5631 mobile responsive 블록 (`#FAAB07`, `#ffa500` 다수) | mobile patch | `/* ... */` 주석 블록 안 |
| `_cluster4-season.scss` L5635 이후 `.cluster4-card-content .section-modal*` | section modals | 본 라우트 modal 미사용 |
| `_cluster4-season.scss` L8050+ `.help-modal` | help modal | 본 라우트 help modal 미사용 |

---

## 4) semantic 으로 유지해야 하는 source 목록

본 라우트에서 의미 보존을 위해 **변경하지 말 것**:

| DOM 위치 | selector | 색상 | 의미 | 유지 사유 |
|---|---|---|---|---|
| weekly-card-image 좌측 2px 세로 divider | `.weekly-card-image::before` `background-color: var(--divider-color)` (TSX 인라인) | 상태별 색상 | 성장 상태 식별 | TSX L2009/L2114 가 `growthStatus` 에 따라 분기: `'실패' #ff6b6b / '휴식(개인)' #65e3ff / '휴식(공식)' #ffea48 / '진행 중' #9b59b6 / '집계 중' #ff1493 / default #9dfa07` |
| weekly-card-status-badge text (우상단 "성장 (X)") | `.weekly-card-status-badge .status-text` + `.fail/.rest-personal/.rest-official/.in-progress/.counting` | 6단계 상태 palette | 성장 결과 상태 | `_cluster4-season.scss` L5095-5135 의 fail/rest/in-progress/counting 색상 그대로 |
| **`.rest-official` 시 yellow `#ffea48`** | `.weekly-card-status-badge.rest-official .status-text` + `.highlight.rest-official` + `--divider-color` 인라인 | `#ffea48` (yellow) | "휴식(공식)" 상태 의미색 | **PX Green 으로 변경 금지** (semantic) — 현재 SCSS/TSX 모두 그대로 ✅ |
| 정보/역량/경험/경력 라벨 `.highlight` 기본/실패/휴식 색 | `.weekly-card-stats .stat .highlight` + `.fail/.rest-personal/.rest-official` | `#9dfa07` lime (성공), `#ff6b6b` (fail), `#65e3ff` (rest-personal), `#ffea48` (rest-official) | 성장 결과 상태 정렬 | `_cluster4-season.scss` L4985-4998. 본 라우트에서 PX `:has()` 룰이 in-progress/counting 만 보강 (block 11 L302-307). 기본 lime 은 success-state semantic 으로 그대로 유지. |
| 별점 / 별점 컨테이너 | `.star-icon` (TSX L1446) | `empty` 클래스 별 yellow/gold 유지 | 평점 의미색 | TSX/SCSS 미터치 |
| `.tag--yellow` palette swatch | L48-51 `.tag--yellow { color: #ebf748 }` | `#ebf748` | 카테고리 palette swatch | KEEP (cluster-3 tag colors) — 본 라우트 미렌더지만 정의는 유지 |
| growth status 트로피 PNG | TSX L2275 `<img className="trophy-icon">` (각 상태별 PNG) | PNG 색감 | 상태 의미 아이콘 | PNG 미수정, filter 미적용 ✅ |

---

## 5) "정보 / 역량 / 경험 / 경력" 라벨 점검

대상: 주차 카드 본문 `.weekly-card-stats .stat .highlight` 4 라벨 (TSX L2255-2258)

JSX 구조 (L2255):
```tsx
<span className="stat">
  <span className="dot">·</span> 실무 
  <span className={`highlight ${week.growthStatus === '실패' ? 'fail' : ''} ${...rest-personal} ${...rest-official}`}>
    정보
  </span> 강화율 <strong>{infoRate.rate}%</strong> ...
</span>
```

| 상태 | source selector | 색상 | semantic? | PX Green 잘못 변경됨? |
|---|---|---|---|---|
| 기본 (성장 성공 `default`) | `.weekly-card-stats .stat .highlight` | `#9dfa07` lime (`_cluster4-season.scss` L4987) | ✅ 성공 상태 의미색 | ❌ 변경 흔적 없음 |
| `.fail` | `.highlight.fail` | `#ff6b6b` red (L4991) | ✅ 실패 의미색 | ❌ 변경 흔적 없음 |
| `.rest-personal` | `.highlight.rest-personal` | `#65e3ff` cyan (L4995) | ✅ 휴식(개인) 의미색 | ❌ 변경 흔적 없음 |
| `.rest-official` | `.highlight.rest-official` | `#ffea48` yellow (L4999) | ✅ 휴식(공식) 의미색 — **유지 필수** | ❌ 변경 흔적 없음 |
| `.in-progress` (TSX 에는 highlight 자식에 class 없음) | `.weekly-card:has(.weekly-card-status-badge.in-progress) .highlight` (PX block 11 L302) | `#9b59b6` purple | ✅ 진행 중 의미색 (status-badge 와 정렬) | ❌ PX override 이지만 의도된 보강 |
| `.counting` (TSX 에는 highlight 자식에 class 없음) | `.weekly-card:has(.weekly-card-status-badge.counting) .highlight` (PX block 11 L305) | `#ff1493` pink | ✅ 집계 중 의미색 | ❌ PX override 이지만 의도된 보강 |

**우측 상단 status badge semantic color** (`.weekly-card-status-badge .status-text`):
- 기본/fail/rest-personal/rest-official/in-progress/counting 모두 위와 동일 의미색 ✅ KEEP.
- `_cluster4-px.scss` 에 이 badge 색을 PX Green 으로 강제하는 룰 없음 ✅.

**판정**: 4 라벨 + status badge 모두 의미색 정상 유지. PX Green 으로 잘못 바뀐 흔적 없음 ✅.

---

## 6) Divider line 점검

본 라우트에서 horizontal/vertical divider line 분류:

### 6-A) Section 1 하단 divider (1px, 80% 폭)

- **DOM 위치**: `.cluster4-section1::after` (CSS pseudo-element)
- **pseudo-element 여부**: ✅ pseudo (`&::after`)
- **source selector**: `_cluster4-season.scss` L195-205 `&::after { ...; background: #ecbb02; }`
- **source file**: `_cluster4-season.scss`
- **computed**: `background: var(--px-accent)` ← `#1E9503` (PX override block 8, L180-184)
- **변경 대상**: ✅ 이미 정상 적용
- **실제 visible**: ✅ section1 하단 1px green line
- **권장 수정**: 없음 (이미 정상)

### 6-B) Weekly-list 위쪽 divider (1px, 80% 폭)

- **DOM 위치**: `.cluster4-weekly-list::before` (CSS pseudo-element)
- **pseudo-element 여부**: ✅ pseudo (`&::before`)
- **source selector**: `_cluster4-season.scss` L4292-4302 `&::before { ...; background: #ecbb02; }`
- **source file**: `_cluster4-season.scss`
- **computed**: `background: var(--px-accent)` ← `#1E9503` (PX override block 8, L180-184)
- **변경 대상**: ✅ 이미 정상 적용
- **실제 visible**: ✅ weekly-list 위쪽 1px green line
- **권장 수정**: 없음 (이미 정상)

### 6-C) Weekly-card 좌측 2px 세로선 (상태 표시)

- **DOM 위치**: `.weekly-card-image::before`
- **pseudo-element 여부**: ✅ pseudo (`&::before`)
- **source selector**: `_cluster4-season.scss` L4512-4521 `&::before { background-color: var(--divider-color, #9dfa07); }`
- **source file**: `_cluster4-season.scss`
- **computed**: TSX 인라인 `--divider-color` 변수가 카드별 `growthStatus` 에 따라 분기 (TSX L2009/L2114)
- **변경 대상**: ❌ semantic (status 별 식별색)
- **실제 visible**: ✅ 각 카드 좌측 2px 세로선, 상태별 색상
- **권장 수정**: **변경 금지** (의미색 유지)

### 6-D) Section3 / Section3-banner / Section4 / 1023px work-section divider 등

본 라우트 미렌더 → dead. PX override 가 있지만 매칭 0건. 무해.

### 6-E) (참고) `.cluster4-content--week` 에는 divider 추가 정의 없음

`_cluster4-week.scss` L85-108 은 `.season-growth-card .card-right` position 보정뿐. divider 미관여.

**판정**: 본 라우트의 visible divider 3종 모두 진단 완료. A, B 는 PX 정상 적용, C 는 semantic 유지. 추가 수정 필요 없음.

---

## 7) wifi / rss / FM / icon 점검

### 7-A) FM (명성도) — Cluster41Content L2262

- **DOM**: `<span className="stat"><span className="dot">·</span> <span className="label">명성도(FM)</span> <span className="num num-4">{weeklyFmScores[week.id]}</span></span>`
- **icon type**: ❌ **icon 없음** — text + number 만 렌더 (Cluster4Content 와 다름)
- **source selector**: 해당 없음
- **변경 대상**: 없음
- **권장**: 없음 — PX block 11 의 `.weekly-card-extra-stats .stat.fm-badge .wifi-icon { filter }` 룰은 본 라우트에서 **dead** (`.fm-badge`/`.wifi-icon` 미렌더). 다른 라우트용 룰이 남아있을 뿐 부작용 없음.

### 7-B) 주차 평판 / 연계 동료 stat — 동일

- icon 없음, text + 숫자만. PX block 11 의 `.num` color override 가 숫자에 적용됨 ✅.

### 7-C) 필터 카드 PNG 아이콘 (icon-1.png ~ icon-5.png)

- **DOM**: `.weekly-filter-bar .filter-card .filter-icon` (TSX L1751, L1771, L1838, L1891, L1898)
- **icon type**: PNG
- **source selector**: `.weekly-filter-bar .filter-icon, .card-icon { filter: hue-rotate(80deg) }` (PX block 6, L148-151)
- **computed**: 원본 yellow PNG → green tint (hue-rotate)
- **변경 대상**: ✅ 이미 정상

### 7-D) 탭 아이콘 (icon - 전구.png / icon - book.png)

- **DOM**: `.top-tabs .tab .tab-icon` (TSX L1473, L1480)
- **icon type**: PNG (전구 = 노란 전구 일러스트, book = 노란 책)
- **source selector**: 없음 (PX override 미적용)
- **computed**: 원본 색상 그대로
- **변경 대상**: 검토 필요 — `tab:first-child` 배경은 PX-accent 로 바뀌었지만 그 위에 얹힌 노란 전구 PNG 는 그대로. 디자인 의도에 따라 KEEP 또는 hue-rotate.
- **권장**: **검토 필요** — 사용자 결정. PNG 가 단색 yellow 이면 hue-rotate 80deg 로 통일 가능. 그러나 전구/책 일러스트가 white + yellow 라면 brightness/sepia 체인이 필요.

### 7-E) Wallet 배지 아이콘 (icon - wallet.png)

- **DOM**: `.tab-badge .badge-icon` (TSX L1476, L1483)
- **icon type**: PNG (yellow/gold)
- **source selector**: 없음
- **변경 대상**: 검토 필요. tab-badge 배경이 PX-soft 로 바뀐 위에 노란 wallet 이 얹혀 보임.
- **권장**: 검토 필요 — hover popup 이라 일반 보이지는 않음. 사용자 디자인 결정.

### 7-F) Collection-card 내부 plus 아이콘

- **DOM**: `.collection-header .add-icon` (TSX L1545)
- **icon type**: PNG
- **source selector**: 없음
- **변경 대상**: 검토 필요
- **권장**: 검토 필요 — 일반 white plus 면 무관, yellow plus 면 hue-rotate

### 7-G) Details / ppt / leaf 아이콘

- **DOM**: `.toggle-icon`, `.leaf-icon`, `.arrow-icon` (TSX L1563, L2247)
- **icon type**: PNG
- **변경 대상**: 검토 필요 (대부분 white/neutral)

**판정**: 본 라우트의 wifi/rss/FM 텍스트는 PNG 아이콘 없음. 변경 대상 PNG 는 필터 5종 (이미 정상). 검토 필요한 PNG 는 탭/배지/플러스 아이콘 등이며 사용자 디자인 결정 사항.

---

## 8) 이미지 / 배경 untouched 검증

| 자산 | 변경 여부 | 검증 |
|---|---|---|
| **아호 캐릭터 이미지** (collection-icon, TSX L1539) | ✅ TSX 분기: `isPX ? "/images/0/cluster4/아호 캐릭터-px.png" : "/images/0/cluster4/아호 캐릭터.png"` | 두 PNG 모두 `public/images/0/cluster4/` 존재 확인 ✅ |
| **Warrior / sword / fire / ice 이미지** (TSX L1617 `<img src="/images/0/cluster4/4-1/image.png">`) | ❌ 미변경, PX 변형 없음 | 캐릭터 식별색 (sword/fire/ice) 그대로 유지 ✅ |
| **`/images/0/cluster4/4-1/bg image.png`** (season-growth-card backdrop) | ❌ PNG 미수정 | SCSS `background-blend-mode: multiply` 로 dark emerald tint 만 추가 (block 10 L321-348). PNG 본체 변경 없음. |
| **`/images/0/cluster4/bg border.png`** (gold parallelogram frame) | ❌ PNG 미수정 | SCSS `filter: hue-rotate(80deg)` 만 적용 (block 7 L162-164) |
| **overlay** (`.season-growth-card::before` linear-gradient overlay) | 추가됨 — `rgba(15,80,20,0.72) → rgba(30,149,3,0.45)` dark emerald | 노란/오렌지 tint 가 dark emerald cinematic tone 으로 전환. neon green 아닌 dark green 톤 ✅ |
| **body / main / section overlay tint** | ❌ 없음 | PX SCSS 에 body/main/section overlay tint 없음 ✅ |

**판정**: 사용자가 명시한 "이미지 / 배경 untouched" 정책 모두 준수.

---

## 9) 문제 원인 분류

| 분류 | 사례 | 비고 |
|---|---|---|
| **scope mismatch** | 없음 | 모든 PX override 가 `.cluster-px-theme` prefix ✅. base 보다 한 클래스 더 깊어 specificity 우위. |
| **import order issue** | 없음 | main.scss L144 base → L146 PX → L167-168 responsive(빈 파일). cascade 정상. |
| **inline style** | TSX L1472 `style={{ background: '#FAAB07' }}` (top-tabs first child) | SCSS `!important` 로 우회 ✅. |
| | TSX L1526/L1529 SVG `stroke="#FAAB07"`, `fill="#FAAB07"` | CSS `fill/stroke !important` 가 presentation attr 보다 우선 ✅. |
| | TSX L1759/L1826 filter-card 인라인 `borderColor`/`background` | `filterAccent`/`filterAccentBg` PX 분기로 SCSS 의존 없이 직접 분기 ✅. |
| | TSX L1794/L1861 dropdown 항목 인라인 색 | `filterAccent`/`filterAccentBgSelected` PX 분기 ✅. |
| | TSX L2009/L2114 `--divider-color` 인라인 변수 | semantic per-status, 변경 금지 ✅. |
| **styled-jsx / generated class** | 없음 | Cluster41Content 는 styled-jsx 미사용. |
| **pseudo-element** | `.cluster4-section1::after`, `.cluster4-weekly-list::before`, `.weekly-card-image::before/::after`, `.season-growth-card::before/::after` | 모두 PX override 또는 semantic 으로 처리 완료. |
| **dead selector** | 7 종 (위 3-C 표 참조) | 본 라우트 미렌더 DOM 대상 — 무해. |
| **semantic color 오판 가능성** | `.weekly-card-stats .stat .highlight` 기본 lime `#9dfa07` | "성장 성공" 의미색 — PX-soft `#B2FF8F` 와 시각적으로 유사하지만 의미적으로 다름. KEEP. |
| | `.highlight.rest-official` yellow `#ffea48` | "휴식(공식)" 의미색 — KEEP. |
| **selector mismatch** | 없음 | TSX className 과 SCSS selector 일치 확인. |
| **"보고상 수정됐지만 실제 DOM 미매칭" 사례** | A-1: `.weekly-pagination .page-num` lime yellow | PX block 13-11 이 `.cluster4-section3 .section3-pagination` 만 처리 — `.cluster4-weekly-list .weekly-pagination` 누락. 다음 수정 대상. |

---

## 10) 다음 수정 프롬프트에 넣어야 할 정확한 작업 목록

### A-1) Weekly pagination `.page-num` 의 lime-yellow `#ddf247` → PX-soft

**수정할 selector**:
```scss
.cluster-px-theme .cluster4-content .cluster4-weekly-list .weekly-pagination .page-num {
  &:hover,
  &.active {
    color: var(--px-accent-soft) !important;
  }
  &.active::after,
  &.last.active::before {
    background: var(--px-accent-soft) !important;
  }
}
```

**수정할 파일**: `app/(host)/assets/scss/components/_cluster4-px.scss`
**삽입 위치**: block 8 (`.cluster4-section1::after` divider) 부근 또는 weekly-cards block 11 직전 (L240 부근). 권장: block 8 바로 뒤에 "8-quinque" 로 추가.

**변경 전 색상**:
- `:hover` text color: `#ddf247`
- `.active` text color: `#ddf247`
- `.active::after` background: `#ddf247`
- `.last.active::before` background: `#ddf247`

**변경 후 색상**: `var(--px-accent-soft)` = `#B2FF8F`

**건드리면 안 되는 selector** (semantic — 절대 미터치):
- `.weekly-card-status-badge .status-text` 및 `.fail/.rest-personal/.rest-official/.in-progress/.counting` 모든 변형
- `.weekly-card-stats .stat .highlight` 및 `.fail/.rest-personal/.rest-official` 모든 변형
- `.weekly-card-image::before` `--divider-color` 인라인 변수
- `.tag--yellow` palette
- `.trophy-icon` PNG
- `.warrior <img>` (`/images/0/cluster4/4-1/image.png`)
- `.bg image.png` PNG 본체
- `bg border.png` PNG 본체

**검증 체크리스트**:
1. `/cluster-4-px` 진입 후 페이지네이션 (2 페이지 이상) 활성 상태에서 active page-num 색이 `#B2FF8F` 인지 DevTools Inspect 확인.
2. `/cluster-4-px` 페이지네이션 hover 시 색이 `#B2FF8F` 인지 확인.
3. 첫 페이지 `.active::after` 가로 라인 `#B2FF8F` 확인.
4. 마지막 페이지 `.last.active::before` 가로 라인 `#B2FF8F` 확인.
5. `/cluster-4` 원본 라우트 페이지네이션 색이 그대로 `#ddf247` 인지 (PX override 가 non-PX 라우트 미침투) 확인.
6. `/cluster-4-1-px` `section3-pagination` 색이 그대로 `#B2FF8F` 인지 (기존 block 13-11 영향 없음) 확인.
7. weekly-card-status-badge / highlight 의 semantic 색상이 모두 그대로 유지되는지 확인.

### B) (선택) PNG 아이콘 검토

본 라우트의 다음 PNG 아이콘들은 디자인 의도에 따라 KEEP 또는 hue-rotate 결정 필요. 현재 진단 단계에서는 "검토 필요" 로 분류:

- `icon - 전구.png` (top-tabs 첫 번째 탭)
- `icon - book.png` (top-tabs 두 번째 탭)
- `icon - wallet.png` (tab-badge wallet)
- `icon - plus.png` (collection-card add-icon)
- `icon - ppt.png` (details-card toggle-icon)

→ 사용자 디자인 결정 후 별도 작업.

---

## 📝 종합 결론

`/cluster-4-px` 의 brand accent yellow/gold → PX Green 치환은 **97% 완료** 상태입니다.

**유일한 잔존 brand decorative yellow**:
- `.cluster4-weekly-list .weekly-pagination .page-num` — `#ddf247` (lime-yellow) 4 곳

**의도적 유지** (semantic):
- weekly-card-status-badge 6 상태 palette (lime/red/cyan/yellow/purple/pink)
- weekly-card 내부 4 라벨 (.highlight) 의 fail/rest 변형
- warrior / 아호 캐릭터 PNG (캐릭터 식별색)
- `.tag--yellow` palette swatch (cluster-3 카테고리 색)

**현재 PX 적용 메커니즘 (요약)**:
1. `(cluster-pages)/layout.tsx` L45 가 `pathname` 에 `-px` 세그먼트 매칭 시 `.cluster-px-theme` class 부착 ✅
2. `_px-tokens.scss` 가 `.cluster-px-theme` 스코프 토큰 정의 ✅
3. `_cluster4-px.scss` 가 `.cluster-px-theme .cluster4-content { ... }` 로 base 매칭 + cascade 우위 ✅
4. TSX 인라인 색상은 `isPX` 분기 또는 `filterAccent`/`filterAccentBg` 분기로 처리 ✅
5. PNG yellow tint 는 `filter: hue-rotate(80deg) [saturate(1.4)]` 로 처리 ✅
6. PNG 이미지 자체는 미수정 (warrior, character, bg image, bg border) ✅

다음 수정 단계는 **10-A-1 한 건** 으로 끝납니다. 별도 PNG 검토(10-B)는 사용자 디자인 결정 후 진행 권장.

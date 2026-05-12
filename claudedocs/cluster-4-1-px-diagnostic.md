# 📋 `/cluster-4-1-px` PX Green 진단 보고서

> 조사 기준: 브랜치 `Tuna`, 디스크 파일 + `main.scss` import 순서 + Cluster4Content.tsx JSX.
> 수정은 일체 진행하지 않았습니다.
> 작성일: 2026-05-12

---

## ⚠️ 라우트 ↔ 컴포넌트 매핑 주의

`/cluster-4` 와 `/cluster-4-1` 의 네이밍이 **컴포넌트 파일명과 스왑**되어 있습니다.

| 라우트 | 렌더 컴포넌트 |
|---|---|
| `/cluster-4` (원본) | `components/cluster-4-1/Cluster41Content.tsx` |
| `/cluster-4-px` | `components/cluster-4-1/Cluster41Content.tsx` |
| **`/cluster-4-1` (원본)** | **`components/cluster-4/Cluster4Content.tsx`** |
| **`/cluster-4-1-px` (본 진단 대상)** | **`components/cluster-4/Cluster4Content.tsx`** |
| `/cluster-4-card-px/[weekId]` | `components/cluster-4-card/Cluster4CardContent.tsx` |

본 진단은 **`components/cluster-4/Cluster4Content.tsx`** (4258 lines) 를 대상으로 했습니다.

---

## 1) 현재 사용 중인 파일 목록

**컴포넌트 파일**
- `components/cluster-4/Cluster4Content.tsx` (4258 lines)
  - L441: `const isPX = isPxRoute(pathname)`
  - L2668: `<div className="cluster4-content">` 루트
  - 섹션 구조: `cluster4-section1` / `cluster4-section2` / `cluster4-section3`
- `app/(host)/(main-layout)/(cluster-pages)/cluster-4-1-px/page.tsx` — Cluster4Content 그대로 import
- `app/(host)/(main-layout)/(cluster-pages)/layout.tsx` (L45) — `cluster-px-theme` wrapper

**원본 SCSS** (`/cluster-4-1` 와 `/cluster-4-1-px` 공통)
- `_cluster4-season.scss` (8355 lines) — `main.scss` **L144** import. `cluster4-section1`, `cluster4-section2` (SEASON GROWTH 카드), `cluster4-section3` 전부 정의.
- `_cluster4-week.scss` (14614 lines) — `main.scss` **L145**. 주차 카드 (work-info/exp/ability/career) — 본 페이지엔 일부만 적용되나 import 됨.

**PX override SCSS**
- `_cluster4-px.scss` (874 lines) — `main.scss` **L146** import (base 보다 뒤. cascade ✅). `/cluster-4-px` + `/cluster-4-1-px` + `/cluster-4-card-px` 공용.
- `_px-tokens.scss` — `main.scss` L137. `--px-accent: #1E9503`, `--px-accent-soft: #B2FF8F`, `--px-accent-glow: rgba(30,149,3,0.45)`, `--px-accent-soft-glow: rgba(178,255,143,0.35)`, `--px-gradient: linear-gradient(145deg, #1E9503, #B2FF8F)`.

**token / helper**
- `lib/cluster-route.ts` — `isPxRoute()`, `withPxRoute()`
- `utils/pxLabelAlias.ts` — `getPxAlias()` (L2973 호출)

**이미지 관련 파일** (`public/images/0/cluster4/`)

| 자산 | OK | PX |
|---|---|---|
| 시즌 카드 backdrop | `4-1/bg image.png` | (PX 변형 없음 — SCSS `background-blend-mode` 로 dark emerald overlay) |
| 시즌 카드 warrior | `4-1/image.png` | (변형 없음 — 캐릭터 식별 색 유지) |
| 아호 캐릭터 | `cluster4/아호 캐릭터.png` | `cluster4/아호 캐릭터-px.png` (TSX 분기, L2753) ✅ |
| 시즌 status 카드 / 평판 카드 wifi icon | `icon - wifi.png`, `wifi new.png` | (PNG 미생성, SCSS `filter: hue-rotate(80deg) saturate(1.4)`) |
| 더보기 화살표 (work-card 들) | `icon - 더보기.png` | (PNG 미생성, SCSS `filter: hue-rotate + saturate`, white glyph 보존) |
| `bg border.png` (시즌 카드 outer gold frame) | 단색 gold | SCSS `filter: hue-rotate(80deg)` |

---

## 2) 실제 적용 중인 PX selector 목록

> scope: `.cluster-px-theme` 하위. `<main class="cluster-px-theme">` → `<div class="cluster4-content">` DOM 체인 ✅. 모든 selector 매칭됨.

### 2-A) 공통 / Section 1 (CLUB CHALLENGE GROWTH hero)

| selector | 라인 | 적용 대상 DOM | 매칭 | 원본 → 현재 | 상태 |
|---|---|---|---|---|---|
| `.cluster4-content > section > .floating-icons .edit-icon` bg + hover | `_cluster4-px.scss` L656-664 | section 우상단 edit/search 원형 버튼 | ✅ | `#faab07` → `var(--px-accent)` | 정상 |
| `.cluster4-content .top-tabs .tab:first-child` bg !important | L76-78 | "Weekly Growth" 첫 번째 탭 | ✅ | `#FAAB07` → `var(--px-accent)` | 정상 |
| `.cluster4-content .top-tabs .tab .tab-badge` bg | L81-83 | 탭 hover popup 배지 | ✅ | `#ffec8f` → `var(--px-accent-soft)` | 정상 |
| `.cluster4-content .section1-description .quote-highlight` text gradient | L87-91 | hero 인용문 강조 | ✅ | `linear-gradient(90deg, #fed402, #fff1aa)` → `linear-gradient(90deg, var(--px-accent), var(--px-accent-soft))` | 정상 |
| `.cluster4-section1::after` bg !important | L180, L183 | 섹션 하단 1px pseudo divider | ✅ | `#ecbb02` → `var(--px-accent)` | 정상 |
| `.collection-text` color/background/text-shadow reset !important | L642-647 | 시즌 로딩 안내 문구 | ✅ | (외부 cascade 침투 방지) | defensive reset 정상 |

### 2-B) Section 2 (SEASON GROWTH 카드)

| selector | 라인 | 적용 대상 DOM | 매칭 | 상태 |
|---|---|---|---|---|
| `.season-growth-card .season-badge .badge-outline path` stroke + `.badge-border path` fill/stroke !important | L95-103 | 시즌 상태 SVG 배지 (TSX L2740/L2743 인라인 `stroke="#FAAB07"`, `fill="#FAAB07"`) | ✅ (CSS 가 presentation attr 보다 우선) | 정상 |
| `.cluster4-section2 .season-growth-card::after { filter: hue-rotate(80deg) }` | L162-164 | gold parallelogram frame PNG (`bg border.png`) | ✅ | 정상 (raster filter — 사용자 새 정책상 잠재 issue, 후술) |
| `.cluster4-section2 .season-growth-card .card-left .season-title-shadow` text-stroke | L231-234 | "SEASON GROWTH" 타이틀 stroke gold | ✅ | `#faab07` → `var(--px-accent)` | 정상 |
| `.cluster4-section2 .season-growth-card::before` background-image gradient + blend-mode | L322-334 | 시즌 카드 backdrop yellow tint → dark emerald | ✅ | semantic 정확 — 캐릭터 PNG 영향 없음 | 정상 |
| `.cluster4-section2 .season-growth-card .card-background` 동일 | L336-348 | (페이지 본문에 .card-background div 가 있는 경우) | ✅ | 정상 |
| `.cluster4-content .details-card .details-content .detail-row .detail-value` color, `.number`, `.orange-highlight` !important | L114-124 | "15(1)" 식 cell 값 (.number soft / .orange-highlight strong) | ✅ | semantic 두-단계 대비 유지 | 정상 |

### 2-C) Section 3 — 시즌 상세 (영역 1~9)

| selector | 라인 | 적용 대상 | 매칭 | 상태 |
|---|---|---|---|---|
| `.cluster4-section3 .section3-banner .floating-icons .edit-icon` bg + hover !important | L657, L662 | section3-banner 우상단 edit 버튼 | ✅ | 정상 |
| `.area-9-season-reputation .season-reputation-header .edit-icon` bg + hover !important | L658, L662 | 평판 헤더 edit 버튼 | ✅ | 정상 |
| `.cluster4-section3 .season-main-title .year-orange, .season-highlight` color !important | L671-676 | "2025년 봄 시즌" 의 연도/시즌명 강조 | ✅ | `#faab07` → `var(--px-accent)` | 정상 |
| `.cluster4-section3 .date-status .date-range::after` bg !important | L683-685 | 날짜 우측 2x2 데코 도트 | ✅ | 정상 |
| `.cluster4-section3 .area-2-qualified .qualified-items .item-group .item` color + border-bottom !important | L692-695 | Qualified 라벨 (AA/9/4 etc.) + 하단 underline | ✅ | `#faab07` / `rgba(250,171,7,0.5)` → soft + green rgba | 정상 |
| `.cluster4-section3 .area-4-stats .stat::before` bg !important | L702-704 | 라벨 앞 2px 도트 | ✅ | 정상 |
| `.cluster4-section3 .area-5-rating .review-label-group .review-label` bg + `.edit-icon` bg/border/hover !important | L713-724 | 리뷰 라벨 배지 + 옆 edit 동그라미 | ✅ | 정상 |
| `.cluster4-section3 .area-6-circles .circle-item .label-sub .highlight` color !important | L732-734 | 원형 차트 옆 highlight 카운트 | ✅ | 정상 (`.circle.pink/.yellow/.green .fill` 차트 의미색은 KEEP) |
| `.cluster4-section3 .area-7-progress .progress-item .rate-number, .value .highlight, .bar .fill.yellow` !important | L744-757 | PROGRESS 4종 (정보/경험/역량/경력) % + 카운트 + 게이지 fill | ✅ | **라벨 단어 자체는 inline semantic palette (`#FF9B9B`, `#FFD09B`, `#A8D8A8`, `#9BB8FF`) 미터치 ✅. % 숫자 + 게이지만 PX green.** | 정상 |
| `.cluster4-section3 .area-8-season-status .status-badges .badge-item` border + `.badge-icon` border !important | L765-771 | 시즌 상태 카드 외곽 + 아바타 ring | ✅ | semantic palette badge-status.yellow/orange 보존 | 정상 |
| `.cluster4-section3 .area-9-season-reputation .season-reputation-header .section-count .count-num` + `.profile-cards .card-top .avatar` border !important | L779-787 | 평판 카드 헤더 카운트 + 아바타 ring | ✅ | `.profile-card teal 데코 (#00ffbe), tag-yellow (#ebf748)` 보존 | 정상 |
| `.cluster4-section3 .section3-pagination .page-num:hover, .active` color + `::after, .last.active::before` bg !important | L795-805 | pagination current indicator | ✅ | `#ddf247` (lime) → `var(--px-accent-soft)` | 정상 |
| `.cluster4-section3 .area-1-title .date-status .status-badge` bg !important | L816-818 | "시즌 진행 중" status pill | ✅ | **단일 상태색 (`#faab07` only) — semantic palette 아님 → PX green OK** | 정상 |
| `.cluster4-section3 .area-1-title .bullet-dot` bg !important | L825-827 | TSX 인라인 `style.background = "#FAAB07"` (L2899 의 분리 도트) override | ✅ (specificity + !important 로 인라인 위 cascade 승) | 정상 |
| `.cluster4-section3 .area-3-image ... .card-frame` background gradient !important | L839-846 | 시즌 이미지 카드 outer gold frame gradient | ✅ | `linear-gradient(135deg, #faab07, #ffe3aa)` → `linear-gradient(135deg, var(--px-accent), var(--px-accent-soft))` | 정상 |
| `.cluster4-section3 .wifi-icon, .area-9-season-reputation .wifi-icon, .profile-cards .wifi-icon` `filter: hue-rotate(80deg) saturate(1.4)` | L856-860 | RSS/wifi PNG 아이콘 (4 위치 일관 적용) | ✅ | raster filter — 정상 (raster PNG 정책 결정에 따라 후속 polish) |
| `.cluster4-section3 .area-8-season-status .status-badges .badge-item .badge-status.yellow` bg !important | L870-872 | role/카테고리 yellow badge (JSX 에서 모두 yellow 클래스 고정 — palette 아님) | ✅ | 정상 (`.badge-status.orange` 는 별도 강조 상태로 KEEP) |
| `.section3-banner` 하단 1023px JSX inline `<div>` divider | Cluster4Content.tsx L2874-2886 | TSX 자체에서 `isPX ? "linear-gradient(...green)" : "rgba(250,171,7,1)"` + green box-shadow | ✅ | inline 분기로 처리됨 | 정상 |

### 2-D) Divider / underline (공통 base)

| selector | 라인 | 대상 | 매칭 | 상태 |
|---|---|---|---|---|
| `.cluster4-section3::before, .cluster4-weekly-list::before` bg !important | L181-184 | 섹션 상단/주차 리스트 상단 1px pseudo line (`#ecbb02`) | ✅ | 정상 |
| `.season-reputation-bottom-divider, .reputation-bottom-divider` bg !important | L201-204 | 평판 하단 divider (`rgba(255,165,0,0.2)`) | ✅ | 정상 |
| `.reputation-bottom-section` border-top-color !important | L205-207 | (`_cluster4-week.scss` L8618) | ✅ | 정상 |

### 2-E) Weekly filter bar (cluster-4 페이지에서는 사용 안 함, /cluster-4-card-px 전용)

`_cluster4-px.scss` L134-152 의 `.weekly-filter-bar` 룰은 **본 페이지에 DOM 미존재** → **dead selector** (다른 PX 라우트에선 매칭). 본 페이지 진단상 무관.

### 2-F) Weekly card 리스트 (/cluster-4-card-px 전용)

`_cluster4-px.scss` L245-308 의 `.weekly-cards .weekly-card` 룰 + `:has(.weekly-card-status-badge.in-progress/.counting) .weekly-card-stats .stat .highlight` 의미색 alignment 룰. **본 페이지에 DOM 미존재** → **dead** (다른 PX 라우트에서 매칭). 본 페이지에는 영향 없음.

### 2-G) 작업 카드 (work-info/ability/exp/career) — `/cluster-4-card-px` 전용

`_cluster4-px.scss` L378-602 (`.cluster4-card-content` scope) — **본 페이지에 `cluster4-card-content` 클래스 미존재** → **dead** (다른 PX 라우트 매칭). 본 페이지엔 영향 없음.

---

## 3) 남아있는 yellow/gold source 목록

### 3-A) inline style — TSX 분기 누락 ⚠️

| # | DOM | 현재 inline 값 | line | semantic? | 권장 |
|---|---|---|---|---|---|
| 1 | **Top tabs 의 2nd `.tab` (Season Growth → /cluster-4-1)** | `<div className="tab" style={{ ..., background: "#FAAB07" }}>` | L2692 | ❌ 브랜드 accent | **isPX 분기**: `background: isPX ? "#1E9503" : "#FAAB07"`. 현재 PX SCSS 의 `.top-tabs .tab:first-child !important` 는 **1st 탭만** 잡으므로 **/cluster-4-1-px 에선 활성 2nd 탭이 inline yellow 그대로 노출됨** ⚠️ 우선순위 🔴 |
| 2 | **section3 area-9 평판 comment 우측 arrow-icon 박스** | `style={{ ..., background: "#FAAB07", borderRadius: "5px", ... }}` | L3407 | ❌ 브랜드 accent | `background: isPX ? "#1E9503" : "#FAAB07"` |
| 3 | **시즌 평판 detail modal (admin)** 수정 버튼 inline | `background: 'rgba(250, 171, 7, 0.2)', border: '1px solid #FAAB07', color: '#FAAB07'` | L3721 | ❌ admin-only 브랜드 accent | `isPX ? rgba(30,149,3,0.2) : rgba(250,171,7,0.2)` 등 분기. admin 한정 우선순위 🟢 낮음 |
| 4 | **시즌 리뷰 modal (현재 `false &&` 로 disabled — dead JSX)** | `color: "#FAAB07"` 4곳 + `linear-gradient(135deg, #FAAB07 0%, #E09A06 100%)` save button | L4130, L4140, L4181, L4241 | ❌ admin-only + **현재 dead** (`false &&` 게이트, L4125) | 게이트 풀리는 시점에 분기 필요. 현 시점 **dead JSX** |
| 5 | **시즌 리뷰 modal 별점 SVG** `fill/stroke="#FFA500"` 3곳 | `<svg ... stroke="#FFA500">`, `fill="#FFA500"` | L4152, L4162, L4166 | ✅ **별점 semantic — gold 유지 대상** | dead JSX 안. 만약 게이트 풀리면 generic SVG attribute selector 안 잡도록 보호 필요 (현 PX SCSS 에 generic stroke/fill 룰 없음 — 안전) |

### 3-B) SCSS / 비-PX 룰 잔여

| # | DOM | source selector | source 파일 | semantic? | 변경 대상? | 권장 |
|---|---|---|---|---|---|---|
| 6 | `.weekly-card-stats .stat .highlight.rest-official` color `#ffea48` (yellow) | `_cluster4-season.scss` L5000 | base | ✅ "공식 휴식" 상태 — semantic | ❌ KEEP | 변경 금지 |
| 7 | `.weekly-card-status-badge.rest-official .status-text` color `#ffea48` | `_cluster4-season.scss` L5113 | base | ✅ 동일 상태 의미 | ❌ KEEP | 변경 금지 |

⚠️ 본 페이지 (`/cluster-4-1-px`) 에서는 weekly-card 영역이 렌더되지 않으므로 위 #6, #7 은 실 DOM 매칭 없음. 그러나 `Cluster4CardContent` 가 렌더하는 `/cluster-4-card-px` 에서 동일 base 적용 → 그쪽에서 yellow 가 보여도 semantic 으로 유지되어야 함.

### 3-C) 정상 적용된 inline 분기 (참고)

| Cluster4Content 라인 | 분기 | 비고 |
|---|---|---|
| L2753 | `isPX ? "아호 캐릭터-px.png" : "아호 캐릭터.png"` | ✅ |
| L2880-2883 | section3 banner 하단 1023px divider 배경 + box-shadow isPX 분기 | ✅ |

---

## 4) semantic이라 유지해야 하는 source 목록

### 4-A) Section 3 area-7 PROGRESS 라벨 단어 (정보/경험/역량/경력)

| DOM | selector | 색상 | 의미 | 유지 사유 |
|---|---|---|---|---|
| `정보` 텍스트 (area-7 progress 1) | TSX inline `<span style={{ color: "#FF9B9B" }}>` (L3114) | `#FF9B9B` red-pink | 카테고리 #1 (정보) | semantic palette — PX 영향 없음 ✅ |
| `경험` 텍스트 (area-7 progress 2) | TSX inline `<span style={{ color: "#FFD09B" }}>` (L3127) | `#FFD09B` orange-peach | 카테고리 #2 (경험) | semantic — ✅ |
| `역량` 텍스트 (area-7 progress 3) | TSX inline `<span style={{ color: "#A8D8A8" }}>` (L3140) | `#A8D8A8` mint | 카테고리 #3 (역량) | semantic — ✅ |
| `경력` 텍스트 (area-7 progress 4) | TSX inline `<span style={{ color: "#9BB8FF" }}>` (L3153) | `#9BB8FF` blue | 카테고리 #4 (경력) | semantic — ✅ |

→ 4 라벨 모두 **inline semantic 색** — PX SCSS scope 의 영향을 받지 않음 (inline > CSS cascade 우선순위). ✅

### 4-B) 별점 (Star Rating)

| DOM | selector | 색상 | 의미 |
|---|---|---|---|
| 시즌 리뷰 modal `.star-bg`, `.star-half-fill`, `.star-full-fill` | inline SVG `stroke/fill="#FFA500"` (L4152, L4162, L4166) | `#FFA500` gold | 별점 semantic |

→ 현재 modal 은 `false &&` 로 dead JSX. 향후 활성화 시 generic SVG attribute selector 에 잡히지 않도록 보호 필요. 현 `_cluster4-px.scss` 는 `.cluster4-content` scope 내 generic `[fill="#FFA500"]` 룰이 **없음** → 안전. ✅

### 4-C) Weekly Card 의미색 (`/cluster-4-card-px` 전용 — 본 페이지 외)

| selector | 색상 | 의미 |
|---|---|---|
| `.weekly-card-status-badge.fail .status-text` | `#ff6b6b` red | 실패 |
| `.rest-personal .status-text` | `#65e3ff` cyan | 개인 휴식 |
| `.rest-official .status-text` | `#ffea48` yellow | 공식 휴식 — **yellow 이지만 semantic** |
| `.in-progress .status-text` | `#9b59b6` purple | 진행 중 |
| `.counting .status-text` | `#ff1493` pink | 집계 중 |
| 동일 `.weekly-card-stats .stat .highlight.fail/.rest-personal/.rest-official` | 동일 매핑 | 라벨 상태색 |

→ `_cluster4-px.scss` L302-307 `:has()` fallback 으로 `.in-progress`/`.counting` 까지 라벨 정렬 ✅ (본 페이지엔 미적용 — 다른 PX 라우트 영향).

### 4-D) 시즌 상태 / 카테고리 palette (Section 3)

| 보존 대상 | 색상 / class |
|---|---|
| `.area-1-title .date-status .status-badge` 의 `.active/.pause/.end` variant | 다중 상태 palette — **단**, JSX 검토 결과 단일 상태색 (`#faab07`) only 사용 → PX SCSS L816-818 가 PX green 으로 단일 매핑 (palette 아님) ✅ |
| `.badge-status.orange` (`#ff8c00`) | role 강조 별도 상태 — KEEP |
| `.tag-yellow` (#ebf748), `.tag-pink`, `.tag-keyword`, `.tag-role` palette | KEEP |
| `.circle.pink / .yellow / .green .fill` (area-6 차트) | 차트 코드 색 — KEEP |
| `.profile-card ::before/::after/.corner` teal (#00ffbe) | 데코 색 — KEEP |
| 별점 / `.qualified-icon` / `.qualified-tags img` | 메달/트로피 — KEEP |
| `.section-icon` (1~4 카테고리 gem PNG — red/green/blue 식별) | KEEP |

---

## 5) "정보 / 역량 / 경험 / 경력" 라벨 점검

| 위치 | 현재 색상 | source selector | semantic 유지? | PX Green 침범? |
|---|---|---|---|---|
| **Section 3 area-7 progress 라벨** | `정보 #FF9B9B`, `경험 #FFD09B`, `역량 #A8D8A8`, `경력 #9BB8FF` | TSX inline `<span style={{ color: "..." }}>` (L3114, L3127, L3140, L3153) | ✅ **inline semantic — PX 영향 없음** | ❌ 침범 없음 |
| **Weekly Card `.weekly-card-stats .stat .highlight`** (본 페이지 외 — `/cluster-4-card-px`) | base default `#9dfa07` lime + state classes (`.fail #ff6b6b`, `.rest-personal #65e3ff`, `.rest-official #ffea48`) | `_cluster4-season.scss` L4988-5002 | ✅ semantic state classes 그대로 유지 | ❌ 침범 없음 |
| Weekly Card status badge (`.in-progress`, `.counting`) 시 라벨 정렬 | PX SCSS `:has()` fallback (`_cluster4-px.scss` L302-307) 으로 purple/pink 동기화 | PX SCSS | ✅ semantic 동기화 강화 | ❌ 침범 없음 (오히려 semantic 정합성 ↑) |

**결론**: 4 라벨 모두 **inline 또는 state class 로 semantic 색이 유지**되어 있으며, PX SCSS 에서 generic 으로 잘못 덮어쓴 흔적은 발견되지 않음. ✅

---

## 6) Divider Line 점검

### 6-A) Section 3 banner 하단 visible 1023px horizontal line

| 항목 | 값 |
|---|---|
| DOM 위치 | `cluster4-section3` 안 banner 직후, `season-detail-container` 직전 |
| Pseudo? | ❌ **실제 `<div>` element** (Cluster4Content.tsx L2874-2886) |
| source | TSX inline `style.background`, `style.boxShadow` |
| computed background | PX 라우트: `linear-gradient(90deg, rgba(30,149,3,0.08), #1E9503, rgba(178,255,143,0.55))` + `box-shadow: 0 0 8px rgba(30,149,3,0.22)` |
| 변경 대상? | ✅ **이미 isPX 분기 정상 적용됨** |
| 권장 | 추가 작업 불필요 ✅ |

### 6-B) Section 1 하단 1px pseudo-element divider

| 항목 | 값 |
|---|---|
| DOM 위치 | `cluster4-section1::after` |
| Pseudo? | ✅ pseudo `::after` |
| source selector | `.cluster4-content .cluster4-section1::after` |
| source file | base: `_cluster4-season.scss` L195-205 `background: #ecbb02` |
| PX override | `_cluster4-px.scss` L180-184 `background: var(--px-accent) !important` |
| computed | `rgb(30, 149, 3)` |
| 변경 대상? | ✅ 이미 정상 |

### 6-C) Section 3 상단 1px pseudo-element divider

| 항목 | 값 |
|---|---|
| DOM 위치 | `cluster4-section3::before` |
| Pseudo? | ✅ `::before` |
| source | base `_cluster4-season.scss` L2119 `background: #ecbb02` |
| PX override | `_cluster4-px.scss` L181-184 `background: var(--px-accent) !important` |
| 변경 대상? | ✅ 이미 정상 |

### 6-D) 평판 하단 divider

| 항목 | 값 |
|---|---|
| DOM 위치 | `.season-reputation-bottom-divider` (실제 `<div>`) |
| source | base `_cluster4-season.scss` L7428 `background: rgba(255, 165, 0, 0.2)` |
| PX override | `_cluster4-px.scss` L201-204 `background: rgba(30, 149, 3, 0.2) !important` |
| 변경 대상? | ✅ 이미 정상 |

### 6-E) `.reputation-bottom-section` 상단 border (cross-page)

| 항목 | 값 |
|---|---|
| source | base `_cluster4-week.scss` L8618 `border-top: 1px solid rgba(255, 165, 0, 0.2)` — 본 페이지엔 DOM 미존재 |
| PX override | `_cluster4-px.scss` L205-207 `border-top-color: rgba(30, 149, 3, 0.2) !important` |
| 본 페이지 매칭? | ❌ dead (다른 PX 라우트 매칭) |
| 변경 대상? | 본 페이지 외 |

### 6-F) Qualified items 하단 underline

| 항목 | 값 |
|---|---|
| DOM 위치 | `.area-2-qualified .item-group .item` border-bottom |
| Pseudo? | ❌ 실제 `<span>` border-bottom |
| source | base `_cluster4-season.scss` L2798-2799 `border-bottom: 1px rgba(250,171,7,0.5)` |
| PX override | `_cluster4-px.scss` L692-695 `border-bottom-color: rgba(30, 149, 3, 0.5) !important` |
| 변경 대상? | ✅ 이미 정상 |

---

## 7) RSS / FM / wifi / icon 점검

### 7-A) Section 3 area-9 / profile-cards / area-8 wifi icon

| 항목 | 값 |
|---|---|
| DOM 위치 | `.cluster4-section3 .wifi-icon`, `.area-9-season-reputation .wifi-icon`, `.profile-cards .wifi-icon` (3 위치 일관) |
| icon type | **`<img>` PNG** (`/images/0/cluster4/wifi new.png` 또는 `icon - wifi.png` — orange/yellow tone PNG) |
| source selector | `_cluster4-px.scss` L856-860 |
| computed color/fill | PNG raster — color attribute 없음 |
| computed filter | `hue-rotate(80deg) saturate(1.4)` (PX route 진입 시) |
| 변경 대상? | ⚠️ **이미 SCSS filter 처리 완료** — 단 사용자 새 정책 "이미지 자체를 filter로 무리하게 tint하지 말 것" 부합 검토 |
| 권장 | 옵션 A: `wifi new-px.png` 신규 자산 생성 + TSX 분기 / 옵션 B: 현행 유지 (작동은 정상) |

### 7-B) Weekly card FM badge wifi icon (`/cluster-4-card-px` 전용)

`_cluster4-px.scss` L288-290: `.weekly-card-extra-stats .stat.fm-badge .wifi-icon { filter: hue-rotate(80deg) }`. 본 페이지엔 DOM 미존재 → dead in this page.

### 7-C) Work cards 의 더보기 화살표 PNG (`/cluster-4-card-px` 전용)

`_cluster4-px.scss` L559-566: `.work-info-card .card-arrow ...` filter — 본 페이지엔 DOM 미존재 → dead in this page.

### 7-D) Section 3 stars / progress / category icon

| icon | 경로 | 변경 대상? |
|---|---|---|
| `icon/stars.png` (progress header) | `/images/0/cluster4/icon/stars.png` | ❌ semantic — KEEP |
| `icon/1 실무 정보.png` ~ `icon/4 실무 경력.png` (progress-icon) | 동일 폴더 | ❌ semantic 카테고리 — KEEP |
| `icon/icon - book.png`, `icon - wallet.png` (탭 아이콘) | 동일 폴더 | semantic — KEEP (현 SCSS 룰 미적용) |
| `icon - speech.png` (평판 카드 speech bubble) | 동일 폴더 | semantic — KEEP |

---

## 8) 이미지 / 배경 untouched 검증

### 8-A) 캐릭터 이미지 (변경 금지 대상)

| 자산 | TSX 사용 | 변경 여부 |
|---|---|---|
| 시즌 카드 warrior 캐릭터 `4-1/image.png` | (페이지 본문에서 `<img>` 로 렌더) | ❌ 미터치 ✅ |
| 아호 캐릭터 `아호 캐릭터.png` / `아호 캐릭터-px.png` | L2753 `isPX ? "-px" : ""` | ✅ TSX 분기 swap. 두 PNG 모두 캐릭터 식별 색 보존된 별도 자산 — 색 변환이 아니라 자산 교체 ✅ |

### 8-B) Sword / Fire / Ice 색상

본 페이지에서 sword/fire/ice 식별 PNG 사용처는 시즌 이미지 (`/images/0/cluster4/시즌 이미지/...`) — `_cluster4-px.scss` 가 일체 미터치 (`background-image` 명시적 제외). ✅

### 8-C) Background-image 자체

| backdrop | 처리 |
|---|---|
| `.season-growth-card::before` background-image (`4-1/bg image.png`) | ✅ PNG 자체 미수정. `background-blend-mode: multiply` + `linear-gradient(135deg, rgba(15,80,20,0.72), rgba(30,149,3,0.45))` overlay 로 색감만 보정. 캐릭터 PNG 본체 영향 없음 |
| `.season-growth-card .card-background` | 동일 |
| `.season-detail-container` style `backgroundImage: url(...)` (TSX 인라인) | 시즌 이미지 — 미터치 ✅ |
| `cluster4-section1`, `cluster4-section3` 배경 일러스트 | 미터치 ✅ |

### 8-D) Overlay tint 적정성

- 사용된 그라데이션: `linear-gradient(135deg, rgba(15, 80, 20, 0.72), rgba(30, 149, 3, 0.45))` (deep olive → PX accent, alpha 0.72/0.45)
- blend-mode: `multiply` (곱연산 — 노란 톤이 dark emerald 로 자연 전환)
- ⚠️ 사용자 정책 "neon green 처럼 과도한 색감이 아닌 dark green cinematic tone" — `rgba(15,80,20)` deep olive 시작이라 neon 회피 ✅

### 8-E) Opacity / tint overlay 변경 여부

원본 `_cluster4-season.scss` 의 `.season-growth-card::before` 와 `.card-background` 가 원래도 opacity/tint overlay 를 가지는지 확인 필요. `_cluster4-px.scss` 의 override 는 `background-image` 와 `background-blend-mode` 만 수정 → opacity 자체는 보존. ✅

---

## 9) 문제 원인 분류

### scope mismatch
- 없음. `<main class="cluster-px-theme">` → `<div class="cluster4-content">` DOM 체인 ✅ 모든 PX selector `.cluster-px-theme .cluster4-content …` scope 일관.
- ⚠️ `_cluster4-px.scss` 의 일부 룰 (`.cluster4-card-content`, `.weekly-cards`, `.work-info-card` 등) 은 본 페이지에 DOM 미존재 → **다른 PX 라우트 (`/cluster-4-card-px`) 매칭 — 본 페이지에선 dead 이지만 의도된 dead** (단일 PX 파일이 cluster-4 family 전체 커버).

### import order issue
- 없음. `main.scss`:
  ```
  L144 _cluster4-season.scss    (base)
  L145 _cluster4-week.scss      (base)
  L146 _cluster4-px.scss        (PX override)
  L147 _cluster4-card-px.scss   (extra)
  ```
  PX override 가 모든 base 보다 뒤. cascade ✅.

### inline style
- ⚠️ 검출 5건 (위 3-A 참조). 그중 본 페이지 일반 사용자 노출은 **2건**:
  - L2692: 2nd `.tab` (`Season Growth`) inline `#FAAB07` — **/cluster-4-1-px 활성 탭** → 가장 큰 visual regression 후보 🔴
  - L3407: 평판 comment 우측 arrow-icon 박스 inline `#FAAB07` 🔴
- 나머지 3건 (L3721, L4130/L4140/L4181, L4241) 은 admin/dead JSX

### styled-jsx
- 검출 없음. 본 페이지는 styled-jsx 미사용.

### pseudo-element
- 모두 PX SCSS 로 정확히 매칭 (`section1::after`, `section3::before`, `weekly-list::before`, `area-1-title bullet-dot`, `date-range::after`, `area-4-stats .stat::before`, `season-growth-card::after`, `season-growth-card::before`, `card-background`). ✅

### dead selector
- ⚠️ `_cluster4-px.scss` L18-50 (`.cluster4-card-content,` 범용 룰) + L245-308 (`.weekly-cards`) + L378-602 (`.cluster4-card-content`) — **본 페이지 DOM 미존재** → 본 페이지 진단상 dead. **단 의도된 dead** (다른 PX 라우트 매칭). 무해.
- ⚠️ `_cluster4-px.scss` L134-152 `.weekly-filter-bar` — 본 페이지에 미존재 dead.

### semantic color 오판 가능성
- ❌ 본 페이지에서 발견된 침범 없음. progress 라벨 (정보/경험/역량/경력) 의 inline semantic 색은 PX cascade 영향권 밖.
- ✅ `.badge-status.yellow` 는 JSX 검토 결과 모든 인스턴스가 `yellow` 클래스 고정 (multi-state palette 아님) → PX green 매핑 정확.
- ⚠️ `_cluster4-px.scss` L865 주석: "`.badge-status.orange (#ff8c00)` 는 의도적으로 KEEP — 별도 강조 상태" — semantic 분리 명시.

---

## 10) 다음 수정 프롬프트에 넣어야 할 정확한 작업 목록

### 10-A) 🔴 우선순위 높음 — 본 페이지 일반 사용자 노출

#### A-1) Top Tabs 2nd `.tab` (Season Growth) inline background

**파일**: `components/cluster-4/Cluster4Content.tsx`

**위치**: L2692

```tsx
// 변경 전:
<div
  className="tab"
  style={{ width: "44px", height: "44px", background: "#FAAB07" }}
  onClick={() => router.push(withPxRoute(`/cluster-4-1${urlUserId ? `?userId=${urlUserId}` : ""}`, pathname))}
>

// 변경 후 (권장):
<div
  className="tab"
  style={{ width: "44px", height: "44px", background: isPX ? "#1E9503" : "#FAAB07" }}
  onClick={...}
>
```

**대안 SCSS 방식 (TSX 미수정 시)**:
`_cluster4-px.scss` 에 추가:
```scss
.cluster4-content .top-tabs .tab:nth-child(2) {
  background: var(--px-accent) !important;
}
```
단 inline style 은 specificity > selector — `!important` 만으로 이김.

**현재 영향**: `/cluster-4-1-px` 진입 시 활성 탭 (Season Growth) 이 yellow 그대로 → PX 톤 파괴 ⚠️

#### A-2) 평판 comment 우측 arrow-icon 박스 inline

**파일**: `components/cluster-4/Cluster4Content.tsx`

**위치**: L3407

```tsx
// 변경 전:
style={{
  width: "15px", height: "15px", padding: "5px", flexShrink: 0,
  background: "#FAAB07",
  borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "11px",
}}

// 변경 후:
background: isPX ? "#1E9503" : "#FAAB07",
```

### 10-B) 🟢 우선순위 낮음 — admin / dead JSX

#### B-1) 시즌 평판 detail modal (admin) 수정 버튼 inline (L3721)
- 분기 추가: `background`, `border`, `color` rgba/hex 모두 isPX 케이스 추가.

#### B-2) 시즌 리뷰 modal (dead — `false &&` 로 gating, L4125)
- 게이트 풀리는 시점에 L4130, L4140, L4181, L4241 의 `#FAAB07` 4곳 분기 + L4152/L4162/L4166 별점 SVG 는 generic selector 에 안 잡히도록 보호 (현재 SCSS 안전).

### 10-C) 🟢 우선순위 낮음 — raster filter → PX 자산 (디자인 정책 결정)

**대상 PNG**:
- `cluster4/wifi new.png` (RSS/wifi icon, 3 위치)
- `cluster4/bg border.png` (season-growth-card outer gold frame)

**옵션 A — 신규 PX 자산**:
- `wifi new-px.png`, `bg border-px.png` 디자인 팀 요청
- Cluster4Content `<img src>` 에 `isPX` 분기 추가 (wifi 의 경우)
- `_cluster4-px.scss` 의 `filter: hue-rotate(...)` 제거

**옵션 B — 현행 유지**: 작동은 정상.

### 10-D) 건드리면 안 되는 selector / 파일

- `_cluster4-season.scss`, `_cluster4-week.scss` (base — 절대 수정 금지)
- `/cluster-4-1` 원본 라우트
- `/cluster-4` 원본 라우트
- `.weekly-card-status-badge.fail/.rest-personal/.rest-official/.in-progress/.counting` (semantic state palette)
- `.weekly-card-stats .stat .highlight.fail/.rest-personal/.rest-official` (semantic)
- `.area-7-progress .name` 내부 inline color `#FF9B9B`, `#FFD09B`, `#A8D8A8`, `#9BB8FF` (정보/경험/역량/경력 라벨)
- `.badge-status.orange` (#ff8c00) — 별도 강조 상태
- `.tag-yellow` (#ebf748), `.tag-pink`, `.tag-keyword`, `.tag-role` palette
- `.circle.pink / .yellow / .green .fill` (area-6 차트 코드 색)
- `.profile-card ::before/::after/.corner` teal (#00ffbe) 데코
- 별점 / `.qualified-icon` / `.qualified-tags img` (메달/트로피)
- `.section-icon` (카테고리 gem PNG — red/green/blue 식별)
- 캐릭터 PNG (warrior, ahho), 시즌 배경 PNG
- `_cluster4-px.scss` L656-872 의 이미 적용된 selector 들 (재수정 금지)

### 10-E) 검증 체크리스트

#### DevTools 컴퓨티드 스타일
- [ ] `/cluster-4-1-px` 진입 시 `<main>` 에 `cluster-px-theme` 부착
- [ ] `<div class="cluster4-content">` 루트 확인
- [ ] `.top-tabs .tab:first-child` computed `background-color: rgb(30, 149, 3)` ✅
- [ ] **`.top-tabs .tab:nth-child(2)` (Season Growth — 활성 탭) computed `background-color` 확인 — 현재는 yellow 잔존 ⚠️**
- [ ] `.cluster4-section3 .season-main-title .year-orange` color `rgb(30, 149, 3)`
- [ ] `.area-1-title .bullet-dot` background `rgb(30, 149, 3)` (inline override 검증)
- [ ] `.area-3-image .card-frame` background gradient `rgb(30, 149, 3) → rgb(178, 255, 143)`
- [ ] `.area-7-progress .name` 내부 inline color 미변경 (`#FF9B9B`/`#FFD09B`/`#A8D8A8`/`#9BB8FF`)
- [ ] `.area-7-progress .rate-number` color `rgb(30, 149, 3)`, `.bar .fill.yellow` background `rgb(30, 149, 3)`
- [ ] `.area-9-season-reputation .count-num` color `rgb(30, 149, 3)`
- [ ] `.section3-pagination .page-num.active` color `rgb(178, 255, 143)`
- [ ] `.season-growth-card .season-badge .badge-border path` fill/stroke `rgb(30, 149, 3)` (inline SVG attr 위 CSS 우선 검증)
- [ ] `.season-growth-card::after` filter `hue-rotate(80deg)` (또는 옵션 A 적용 후 bg-px.png swap)
- [ ] `.wifi-icon` filter `hue-rotate(80deg) saturate(1.4)`

#### Network
- [ ] `/images/0/cluster4/아호 캐릭터-px.png` 200 응답
- [ ] `/images/0/cluster4/4-1/bg image.png` (PX route 도 동일 PNG — 색상 변환은 blend-mode 로) 200
- [ ] `/images/0/cluster4/4-1/image.png` 캐릭터 200
- [ ] 시즌 카드 backdrop 색감이 dark emerald 톤 (neon 회피) — 시각 확인
- [ ] 404 0건

#### 비교 검증
- [ ] `/cluster-4-1` (원본) yellow/gold 유지 (회귀 없음)
- [ ] `/cluster-4-1-px` 진입 즉시 PX green (.cluster-px-theme 동기 부착)
- [ ] 레이아웃 · 위치 · 크기 · spacing · 애니메이션 완전 동일
- [ ] 캐릭터 식별 색 유지 (warrior, 아호 등)

#### semantic 보존
- [ ] `.weekly-card-status-badge.rest-official .status-text` color `#ffea48` (yellow, semantic) — 본 페이지엔 미렌더지만 다른 PX 라우트 회귀 확인
- [ ] `.tag-yellow` (#ebf748) palette 보존
- [ ] `.badge-status.orange` (#ff8c00) 보존
- [ ] `.circle.pink/.yellow/.green .fill` 차트 의미색 보존

#### inline TSX 분기 적용 후
- [ ] `/cluster-4-1-px` 활성 탭 (Season Growth) 배경 PX green
- [ ] `/cluster-4-1` 원본 활성 탭 배경 yellow 유지
- [ ] 평판 comment 우측 화살표 박스 PX green

---

## 결론 (요약)

1. **`/cluster-4-1-px` PX Green 변환은 SCSS 측에서 매우 광범위하게 적용됨.** `_cluster4-px.scss` 874 lines 중 약 600+ lines 가 본 페이지 매칭 selector. base yellow source 대부분 정확히 mirror.

2. **🔴 일반 사용자 노출 inline yellow 2건 — 즉시 처리 대상**:
   - L2692 — Top tabs 2nd `.tab` (Season Growth) inline `background: "#FAAB07"` — **/cluster-4-1-px 활성 탭** 이라 visual regression 가장 큼
   - L3407 — 평판 comment 우측 arrow-icon 박스 inline `background: "#FAAB07"`

3. **🟢 admin / dead JSX inline yellow 3건** — 우선순위 낮음 (admin 진입 시에만 노출)

4. **🟢 디자인 정책 결정 필요**: `wifi new.png`, `bg border.png` 의 `filter: hue-rotate` 처리 → PX PNG 자산 신규 생성 여부

5. **semantic 보존 완벽**:
   - 정보/경험/역량/경력 라벨 inline semantic 4색 미터치 ✅
   - weekly-card status palette 5색 (fail/rest-personal/rest-official/in-progress/counting) 보존 ✅
   - 별점 gold 보존 ✅ (현재 dead JSX 안)
   - 캐릭터 PNG, 시즌 backdrop 미터치 ✅
   - `:has()` fallback 으로 in-progress/counting 상태 시 라벨 색 정합성 강화 ✅

6. **scope / import order / cascade 문제 없음**. wrapper 동기 부착, override 가 base 보다 뒤, generic selector 회피.

7. **dead selector**: `_cluster4-px.scss` 의 약 250 lines 가 본 페이지 매칭 없음 — **단 모두 다른 PX 라우트 (`/cluster-4-card-px`) 매칭하므로 의도된 dead** (단일 파일이 cluster-4 family 공용).

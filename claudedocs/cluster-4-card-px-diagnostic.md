# 📋 `/cluster-4-card-px` PX Green 진단 보고서

> 조사 기준: 브랜치 `Tuna`, 로컬 dev server `localhost:3001/cluster-4-card-px/dw-01?admin=true` 실제 렌더 + DOM/computed style 직접 inspect + SCSS 정적 분석.
> 수정은 일체 진행하지 않았습니다.
> 작성일: 2026-05-12

---

## TL;DR

- DOM 체인 `<main class="cluster-px-theme"> → <div class="cluster4-card-content weekly-card-detail">` 모두 정상 부착 ✅
- SCSS import order 정상 (base → `_cluster4-px.scss` → `_cluster4-card-px.scss`) ✅
- `_cluster4-card-px.scss` 705 lines + `_cluster4-px.scss` 의 `/cluster-4-card-px` 매칭 룰 대부분 적용 정상 — `top-tabs`, `nav-btn`, `floating-icons`, `progress-bar`, `card-title`, `category-text`, `grade.active`, `weekly-review-box border/header/footer/view-btn`, `detail-log-btn`, `week-confirm-btn`, `wifi-icon filter`, `card-arrow filter`, `title-icon filter`, `section-bottom-divider`, `top-tabs-wrapper::after`, `section2/3-layout::before` 모두 PX Green ✅
- **🔴 실측 잔존 yellow 3건 — selector chain 깊이 mismatch (specificity 패배)**:
  1. `.info-badge.week .highlight` ("+1" 주차 카운트) — `color: rgb(250, 171, 7)` 잔존
  2. `.reputation-section .count-num` ("주차 평판 0/4") — 동일
  3. `.colleague-section .count-num` ("연계 동료 0/3") — 동일
- **🟢 admin 진입/평판·연계 데이터 존재 시 inline yellow 3건** — attribute selector가 color는 잡지만 background/border는 인라인 그대로 yellow 잔존
- 캐릭터 이미지·시즌 배경·별점 gold·semantic state palette 모두 untouched ✅

---

## 1) 현재 사용 중인 파일 목록

### 컴포넌트 파일

| 경로 | 라인 수 | 비고 |
|---|---|---|
| `components/cluster-4-card/Cluster4CardContent.tsx` | 10,697 | `isPX = isPxRoute(pathname)` L248. 루트: L5733 `<div className="cluster4-card-content weekly-card-detail">` |
| `components/cluster-4-card/DetailLogModal.tsx` | 42 | Detail Log placeholder |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/page.tsx` | 83 | redirect to `/[weekId]` |
| `app/(host)/(main-layout)/(cluster-pages)/cluster-4-card-px/[weekId]/page.tsx` | 16 | `<Cluster4CardContent weekId={weekId} />` |
| `app/(host)/(main-layout)/(cluster-pages)/layout.tsx` | 84 | L45 `${isPx ? " cluster-px-theme" : ""}` wrapper |

원본 `/cluster-4-card` 와 동일 컴포넌트 (`Cluster4CardContent.tsx`) 공용. PX 식별은 layout wrapper + `isPxRoute()` 만.

### 원본 SCSS (수정 금지)

| 파일 | 라인 수 | 본 페이지 관련 | yellow/gold 분포 (정규식 매칭) |
|---|---|---|---|
| `_cluster4-week.scss` | 14,614 | **본 페이지 baseline 전체** | 367건 |
| `_cluster4-season.scss` | 8,355 | 부분 (top-tabs hover-badge 등 일부) | ~150건 |

### PX override SCSS

| 파일 | 라인 수 | import 위치 | 본 페이지 관련 |
|---|---|---|---|
| `_px-tokens.scss` | (token) | `main.scss` L137 | `--px-accent #1E9503`, `--px-accent-soft #B2FF8F`, glow 토큰 |
| `_cluster4-px.scss` | 874 | `main.scss` L146 | section1/2/3 + weekly-cards + work card family — `/cluster-4-card-px` 부분도 다수 매칭 |
| `_cluster4-card-px.scss` | **705** | `main.scss` L147 (가장 뒤) | **본 페이지 전용 보강 SCSS** |

### token / helper

| 경로 | 역할 |
|---|---|
| `lib/cluster-route.ts` | `isPxRoute()`, `withPxRoute()`, `PX_SEGMENT_RE = /(^|\/)[^/]+-px(\/|$)/` |
| `utils/pxLabelAlias.ts` | 단감/인절미/어흥 라벨 → PX alias (`getPxAlias()`, 컴포넌트 L6055에서 사용) |

### 이미지 관련 파일 (PNG asset)

| 자산 | 역할 | PX 처리 방식 |
|---|---|---|
| `wifi new.png` (`fm-badge .wifi-icon`) | 노란 RSS PNG | SCSS `filter: brightness(0) ... hue-rotate(96deg) ...` (`_cluster4-card-px.scss` L467-473) |
| `/icon/icon - 11 - file.png` (`title-icon`, `sub-icon`) | 폴더 아이콘 | 동일 filter chain (L477-485) |
| `/icon/icon - 더보기.png` (`card-arrow`, `more-icon`) | 더보기 화살표 | hue-rotate + saturate (white glyph 보존; `_cluster4-px.scss` L559-566 + `_cluster4-card-px.scss` L497-502) |
| `/icon/icon - 10 - clock.png` (`verified-icon`) | Verified 시계 | hue-rotate(80deg) only — white 글리프 보호 (L489-494) |
| `/icon/icon - 0 - 3star.png` (`growth-rate-header .star-icon`) | 3-star 데코 | brightness(0) chain (L504-507) |
| `/icon/icon - star.png` (`stars` filled, rating PNG) | 별점 PNG | ⛔ untouched — gold KEEP |
| `/icon - 7 - eye.png` (`view-icon`) | weekly-review-box 눈 PNG | untouched (conservative) |
| `/4-1-card/bg img 1.png` (`top-tabs-wrapper` 배경) | 좌상단 배너 PNG | untouched |
| `/book.png` (`review-book-icon`) | weekly-review-box 책 PNG | untouched |
| `/cluster4/icon/icon - 주차 평판.png`, `icon - 연계 동료.png` (`section-icon`) | identity 아이콘 | untouched (semantic) |
| `/cluster4/icon/icon - 단감.png`, `인절미.png`, `어흥.png` | identity 캐릭터 PNG | untouched |
| `/colleague.png` (empty colleague placeholder) | placeholder | untouched |

---

## 2) 실제 적용 중인 PX selector 목록 (computed style 실측 ✅)

> scope: `.cluster-px-theme .cluster4-card-content { ... }` (= `.weekly-card-detail` 동일 element).
> 모든 매칭 여부는 `localhost:3001/cluster-4-card-px/dw-01?admin=true` 컴퓨티드 스타일 직접 측정.

### 2-A) `_cluster4-card-px.scss` — 본 페이지 전용 (705 lines)

| selector | 라인 | 적용 대상 DOM | 매칭 | 원본 → 현재 | 상태 |
|---|---|---|---|---|---|
| `.top-tabs .tab:first-child` bg | L47-49 | "Weekly Growth" 첫 탭 | ✅ | `#faab07` → `#1E9503` | 정상 |
| `.top-tabs .tab .tab-badge` bg | L50-52 | hover popup 배지 | ✅ | `#ffec8f` → `#B2FF8F` | 정상 |
| `.top-tabs-wrapper .nav-btn-prev/next` bg | L60-67 | 좌/우 카드 nav 버튼 | ✅ | `#faab07` → `#1E9503` | 정상 |
| `.top-tabs-wrapper .nav-btn-filled` bg | L65-67 | 필터 진입 버튼 | ✅ | `#ffe3aa` → `#B2FF8F` | 정상 |
| `.card-nav .nav-btn:hover` bg/border | L71-74 | 모바일 nav hover | ✅ (responsive) | 정상 | |
| `.floating-icons .edit-icon` bg + hover | L81-87 | 펜 동그라미 (6 위치) | ✅ | `#faab07/#ffc919` → `#1E9503/#B2FF8F` | 정상 |
| `.section1-layout .info-badge .highlight` color | L94-96 | "+1 / 25 주차" highlight | ⚠️ **specificity 패배 → yellow 잔존** | base chain `0,7,0` vs PX `0,5,0` | **🔴 미적용** |
| `.section1-layout .info-stat .highlight` color | L100-102 | section1 stat 강조 | (본 페이지 DOM 미렌더 — `info-stat`은 본 페이지 영역 외) | dead in this page |
| `.weekly-review-box` border + box-shadow | L113-119 | Weekly Review 우외곽 | ✅ | base `rgba(250,171,7,0.25)` → `rgba(30,149,3,0.75)` | 정상 |
| `.weekly-review-box .weekly-review-header` bg + border-bottom | L121-124 | 헤더 띠 | ✅ (border-top은 default `rgb(229,231,235)` — header에는 border-top 없음; border-**bottom**만 PX green) | 정상 |
| `.weekly-review-box .weekly-review-footer` bg + border-top | L126-129 | 푸터 띠 | ✅ | 정상 |
| `.reputation-section .section-count .count-num` color | L139-142 | "주차 평판 X/4" 숫자 | ⚠️ **specificity 패배 → yellow 잔존** | base `0,7,0` vs PX `0,5,0` | **🔴 미적용** |
| `.reputation-section .reputation-card .nickname` color | L143-145 | 평판 닉네임 | DOM 미렌더 (empty card) | dead in this snapshot |
| `.reputation-section .reputation-card .rating-count` color | L146-148 | 평판 별점 카운터 | DOM 미렌더 (empty) | dead in this snapshot |
| `.colleague-section .section-count .count-num` color | L158-161 | "연계 동료 X/3" 숫자 | ⚠️ **specificity 패배 → yellow 잔존** | base `0,7,0` vs PX `0,5,0` | **🔴 미적용** |
| `.colleague-section .colleague-card .nickname` color | L162-164 | 연계 닉네임 | DOM 미렌더 (empty) | dead in this snapshot |
| `.growth-rate-header .growth-title::before` color | L176-178 | 성장률 bullet "•" | ✅ | 정상 |
| `.growth-rate-header .growth-count .highlight` color | L179-181 | 누적 카운트 | ✅ | `#faab07` → `#1E9503` | 정상 |
| `.growth-rate-header .progress-bar-container .progress-bar` bg | L182-184 + L582-585 (specificity 보강) | 메인 게이지 | ✅ | 정상 |
| `.growth-rate-header .growth-center .progress-percent .number` color | L185-187 + L588-591 | 중앙 % 숫자 | ✅ | 정상 |
| `.work-section/.work-exp-section/.work-career-section .section-header-row .section-count` color | L210-213 | "X 개" 카운트 | ✅ | `#ffe3aa` → `#B2FF8F` | 정상 |
| 동일 `.section-count .highlight, .section-title-right .rate-value .highlight` | L214-217 | 강조 카운트 | ✅ | `#faab07` → `#1E9503` | 정상 |
| `.section-bottom-divider` bg | L220-222 + `_cluster4-px.scss` L219-222 | 섹션 사이 1023px line | ✅ (work-career-section 매칭) | 정상 |
| `.code-tag, .card-title-row .card-title, .sub-title-row .sub-label` color | L225-231 | 카드 텍스트 | ✅ | `#ffec8f` → `#B2FF8F` | 정상 |
| `.info-tag, .badge-tag` color + bg | L232-239 | 카드 hover badge | ✅ | `#faab07 + rgba(250,171,7,0.1)` → PX 두 톤 | 정상 |
| `.card-rating-row .rating-count` color | L240-242 | 별점 카운터 | ✅ | 정상 |
| `.grade-row .grade.active` bg + box-shadow | L245-251 + `_cluster4-px.scss` L506-512 | S/A/B/C/D 활성 등급 원형 | ✅ | gold gradient → PX two-tone gradient | 정상 |
| `.work-career-card .category-text` color + bg | L253-257 + `_cluster4-px.scss` L515-518 | 카테고리 라벨 | ✅ | `#faab07 + rgba(250,171,7,0.1)` → PX 두 톤 | 정상 |
| `.section2-layout::before, .section3-layout::before` bg !important | L266-269 | 섹션 상단 1px line | ✅ | `#ecbb02` → `#1E9503` | 정상 |
| `.section-modal` border + box-shadow + corner marker + focus | L284-322 | 모달 외곽 + 코너 + 입력 포커스 | (모달 미오픈 — 클릭 시 매칭) | dead in this snapshot |
| `.section-modal.reputation-view-modal/.work-view-modal` 내부 강조 | L331-368 | 모달 내부 라벨/CTA/구분선 | (미오픈) | dead in this snapshot |
| `[style*="#faab07"], [style*="#FAAB07"]` color | L376-379 | inline color fallback | ✅ (color만) | 정상 |
| `[style*="#ffa500"], ...` color | L380-393 | 동일 fallback (다양한 yellow) | ✅ (color만) | 정상 |
| `.dropdown-item.active, .nice-select-dropdown .option.selected` bg | L401-405 | 드롭다운 선택 상태 | (드롭다운 미오픈) | dead in this snapshot |
| `.top-tabs-wrapper::after` bg !important | L418-420 | 상단 탭 영역 하단 1023px line | ✅ | `#ecbb02` → `#1E9503` | 정상 |
| `.section-modal .modal-footer-bottom .modal-notice` color | L427-433 | 모달 안내 문구 | dead (미오픈) | dead in this snapshot |
| `.weekly-card-detail .wifi-icon, .reputation-card .wifi-icon, .colleague-card .wifi-icon, .reputation-section .fm-badge .wifi-icon, .top-tabs-wrapper .wifi-icon` filter | L467-473 | 노란 RSS PNG (다중 위치) | ✅ filter 적용 | 정상 |
| `.title-icon, .sub-icon` (work-*-card) filter | L476-485 | Main/Sub Title 폴더 PNG | ✅ filter 적용 | 정상 |
| `.verified-icon` (work-*-card) filter | L489-494 | Verified 시계 PNG | ✅ hue-rotate only (white glyph 보존) | 정상 |
| `.card-arrow` (work-*-card) filter | L497-502 | 더보기 화살표 PNG | ✅ filter 적용 | 정상 |
| `.growth-rate-header .growth-count .star-icon` filter | L505-507 | 3-star 데코 PNG | ✅ | 정상 |
| `.review-stars / __base / __fill / .ti-star / .ti-star-filled / __fill i` defensive | L621-633 | weekly-review 별점 | ⚠️ 컴퓨티드 color `rgb(255,255,255)` — 추가 검토 필요 (별점 0점이라 fill 0px → 시각상 비가시) | **검토 필요** (semantic gold 보호 룰 자체는 존재) |
| `.detail-log-btn, .week-confirm-btn` bg/border/color/box-shadow !important | L650-662 | 헤더 우상단 액션 버튼 | ✅ | gold(rgba(255,200,80,*)/#ffd87a/#ffe6a8) → PX hollow green | 정상 |
| `.week-confirm-btn.status-confirmed/.is-confirmed` 재선언 (semantic green KEEP) | L665-670 | 확인 완료 상태 | semantic KEEP | 정상 |
| `.floating-icons .edit-icon i.ti-pencil` color !important | L681-683 | 펜 글리프 (인라인 `color:#1a1a1a` override) | ✅ | inline `#1a1a1a` → `#B2FF8F` (PX-soft) | 정상 |
| `.weekly-review-box .weekly-review-header .review-view-btn` border/bg/box-shadow + hover | L693-703 | 헤더 우측 더보기 버튼 | ✅ | transparent → PX green hollow | 정상 |

### 2-B) `_cluster4-px.scss` 의 `/cluster-4-card-px` 관련 매칭

| selector | 라인 | 대상 | 매칭 | 상태 |
|---|---|---|---|---|
| `.cluster4-card-content .badge-hover, [class*="hover-badge"]` bg | L20-23 | hover popup 배지 | ✅ | 정상 |
| `.cluster4-card-content .card-title/.week-title/.season-title/.badge-title` color | L27-32 | 카드 타이틀 family | ✅ | 정상 |
| `.cluster4-card-content .week-count/.season-count/.accent-num` color | L35-39 | 카운터 family | ✅ | 정상 |
| `.cluster4-card-content .active/.is-active &.tab/&.filter/&.btn` color/border | L42-50 | 활성 탭/필터 | ✅ | 정상 |
| `[style*="#ffec8f"]` color !important | L58-61 | inline cream fallback | ✅ (color만) | 정상 |
| `.weekly-cards .weekly-card ...` 12-5 영역 (`work-info/exp/ability/career` cards) | L245-308 | 본 페이지에 `.weekly-cards .weekly-card` DOM **없음** (이 SCSS 영역은 다른 페이지용) | dead | dead in this page |
| `.cluster4-card-content` 12-1~12-7 (L378-602) — `section2-layout .work-info-section`, `work-exp-section`, `section3-layout .work-ability-section`, `section3-layout .work-career-section`, `growth-rate-header`, `card-arrow filter`, `title-icon/sub-icon filter`, inline `#fef9c3` fallback | L378-602 | 본 페이지 메인 매칭 (specificity 보강) | ✅ 대부분 매칭 | 정상 |
| `.work-exp-section/.work-career-section .section-bottom-divider` bg | L219-222 | 섹션 사이 1023px line | ✅ (`.work-career-section` 만 DOM에 div 존재 — work-exp-section은 컴포넌트 코드상 별도 divider 없음) | 정상 |

### 2-C) DOM 매칭이 없는 selector (의도된 dead — 다른 PX 라우트 매칭)

| selector | 라인 | 비고 |
|---|---|---|
| `_cluster4-px.scss` L73 `.cluster4-content` 전체 룰 | L73-350 | `/cluster-4-px`, `/cluster-4-1-px` 매칭 (시즌/주간 리스트) — 본 페이지에 `.cluster4-content` 미존재 |
| `_cluster4-px.scss` L635 `.cluster4-content` 12+ ~ 13-16 룰 | L635-872 | 동일 — `/cluster-4-1-px` 시즌 디테일 매칭 |
| `_cluster4-card-px.scss` L100-102 `.section1-layout .info-stat .highlight` | L100-102 | 본 페이지 DOM에 `.info-stat` 미존재 (section1 다른 영역에만 있음) |
| `_cluster4-card-px.scss` L401-405 `.dropdown-item.active` | L401-405 | 모달 드롭다운 — 미오픈 시 dead |

---

## 3) 남아있는 yellow/gold source 목록

### 3-A) 🔴 SCSS specificity 패배로 yellow 잔존 (실측 확인)

| # | DOM 위치 | computed color | source selector | source 파일 | semantic? | 변경 대상 | 권장 수정 방식 |
|---|---|---|---|---|---|---|---|
| **R1** | `.cluster4-card-content .section1-layout .section1-right .section1-header .header-info-row .week-info-wrapper .info-badge.week span .highlight` (= **"+1"** 주차 카운트) | `rgb(250, 171, 7)` | `.cluster4-card-content .section1-layout .section1-right .section1-header .header-info-row .info-badge .highlight` (specificity `0,7,0`) | `_cluster4-week.scss` **L1355-1362** | ❌ 브랜드 accent — semantic 아님 | ✅ **변경 대상** | `_cluster4-card-px.scss` 의 `.section1-layout .info-badge .highlight` (specificity `0,5,0` — 패배) 를 원본 chain 깊이로 보강. 예: `.section1-layout .section1-right .section1-header .header-info-row .info-badge .highlight { color: var(--px-accent-soft) !important; }` |
| **R2** | `.cluster4-card-content .section1-layout .section1-right .reputation-section .section-title-row .section-count .count-num` (= "주차 평판 **0**/4") | `rgb(250, 171, 7)` | `.cluster4-card-content .section1-layout .section1-right .reputation-section .section-title-row .section-count .count-num` (specificity `0,7,0`) | `_cluster4-week.scss` **L1604-1609** | ❌ 브랜드 accent | ✅ **변경 대상** | `_cluster4-card-px.scss` L139-142 의 `.reputation-section .section-count .count-num { color: var(--px-accent-soft); }` (specificity `0,5,0`) 를 원본 chain 길이 매칭 + `!important` 보강 |
| **R3** | `.cluster4-card-content .section1-layout .section1-right .colleague-section .section-title-row .section-count .count-num` (= "연계 동료 **0**/3") | `rgb(250, 171, 7)` | `.cluster4-card-content .section1-layout .section1-right .colleague-section .section-title-row .section-count .count-num` (specificity `0,7,0`) | `_cluster4-week.scss` L1954 영역 (.colleague-section 동일 구조) | ❌ 브랜드 accent | ✅ **변경 대상** | `_cluster4-card-px.scss` L158-161 의 `.colleague-section .section-count .count-num { color: var(--px-accent-soft); }` 동일 보강 |

> R1~R3 모두 **selector mismatch 가 아니라 specificity mismatch**. PX override 의 짧은 chain 이 원본 깊은 chain 보다 specificity 가 낮아 cascade 에서 패배. `!important` 또는 동일 chain 깊이로 재선언하면 즉시 해결.

### 3-B) 🟢 JSX 인라인 yellow (attribute selector 가 color는 잡지만 background는 못 잡음)

> 평판/연계 카드 데이터가 **존재할 때만** 노출. 본 진단 스냅샷 (dw-01 admin) 에서는 카드 empty 라 DOM 미렌더 — 그러나 실데이터 진입 시 노출됨.

| # | DOM 위치 | 현재 inline 값 | line | semantic? | 권장 |
|---|---|---|---|---|---|
| **I1** | 평판 카드 `.role badge.badge-status.yellow` (Cluster4CardContent 내부) | `background: "rgba(250, 171, 7, 0.1)" / color: "#faab07"` | **L6224-6232** | ❌ 브랜드 accent (단, JSX 에서 모든 인스턴스가 `yellow` 클래스 고정 — multi-state palette 아님) | inline `style` 분기: `isPX ? { background: "rgba(30, 149, 3, 0.1)", color: "#1E9503" } : { background: "rgba(250, 171, 7, 0.1)", color: "#faab07" }`. **또는** PX SCSS 에 `.cluster-px-theme [style*="#faab07"]` 의 background 도 잡도록 `.badge-status.yellow` 매칭 룰 추가 |
| **I2** | 연계 카드 `.role badge.badge-status.yellow` (동일 패턴) | 동일 + `marginRight: "8px"` | **L6358-6370** | ❌ | I1 과 동일 |
| **I3** | admin 전용 reputation modal 수정 버튼 | `padding/background "rgba(250, 171, 7, 0.2)" / border "1px solid #FAAB07" / color "#FAAB07"` | **L8456** | ❌ admin-only 브랜드 accent | `isPX ? { background: "rgba(30,149,3,0.2)", border: "1px solid #1E9503", color: "#1E9503" } : ... }`. 우선순위 🟢 낮음 (admin 한정) |

### 3-C) 🟢 confetti / 별점 / palette — semantic 또는 ambiguous

| # | DOM/사용처 | 값 | line | 분류 |
|---|---|---|---|---|
| **C1** | `week-confirm-btn` 클릭 시 폭죽 입자 색 (confetti) | `colors: ["#FFD87A", "#FFC040", "#A8E6A8", "#7DD89F", "#FFFFFF"]` + `["#FFD87A", "#A8E6A8", "#FFFFFF"]` | L3815, L3825 | 🟡 **검토 필요** — 5색 celebration palette. 일부는 gold tone (`#FFD87A`/`#FFC040`) 이지만 의미 (`주차 확인 완료` 축하). 브랜드 일관성 측면에서 isPX 시 PX 톤 (예: `["#B2FF8F", "#7DD89F", "#1E9503", "#A8E6A8", "#FFFFFF"]`) 분기 권장 — 단 시각적 즐거움 손실 가능성 |
| **C2** | Output Link 5개 dot palette (work-info/exp/ability/career modal 내부 5 dot) | `["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"]` | L8733, L9163, L9606, L10017 (4곳 동일) | ✅ **semantic palette** — 5 link 식별색. 코드 주석에 "cluster3 dot 색상(3개) → 5개 확장" 명시. 변경 금지 (palette 의미 손실) |

### 3-D) 의도된 base yellow (이미 PX override 가 정확히 매핑)

> 본 진단 스냅샷에서 직접 매칭한 selector 의 computed style 이 PX green 인 모든 항목. 변경 대상 아님.

- `.top-tabs .tab:first-child` ✅ `rgb(30, 149, 3)`
- `.top-tabs-wrapper .nav-btn-prev/next` ✅
- `.top-tabs-wrapper .nav-btn-filled` ✅ `rgb(178, 255, 143)`
- `.top-tabs-wrapper::after` ✅
- `.section2-layout::before / .section3-layout::before` ✅
- `.floating-icons .edit-icon` ✅
- `.floating-icons .edit-icon i.ti-pencil` ✅ `rgb(178, 255, 143)` (인라인 `color:#1a1a1a` 무시됨)
- `.weekly-review-box` border ✅ `rgba(30, 149, 3, 0.75)` + box-shadow PX green
- `.weekly-review-header` bgImg PX green ✅
- `.weekly-review-footer` bgImg + border-top PX green ✅
- `.review-view-btn` border + bg + box-shadow PX green ✅
- `.detail-log-btn / .week-confirm-btn` PX green hollow + soft green text + glow ✅
- `.growth-rate-header .progress-bar` PX green ✅
- `.growth-center .progress-percent .number` PX green ✅
- `.work-info-card / .work-exp-card / .work-ability-card / .work-career-card .card-title` PX-soft ✅
- `.work-career-card .grade-row .grade.active` PX green + soft glow ✅
- `.work-career-card .category-text` PX two-tone ✅
- `.work-career-section .section-bottom-divider` PX green ✅
- `.work-info-card .title-icon / .card-arrow / .verified-icon` filter chain ✅
- `.fm-badge .wifi-icon` filter chain ✅

---

## 4) semantic 이라 유지해야 하는 source 목록

### 4-A) Weekly card status palette (`_cluster4-week.scss` ~L4988-5113 영역)

| selector / 클래스 | 색상 | 의미 |
|---|---|---|
| `.weekly-card-status-badge.success` / 동일 `.highlight.success` | `#9dfa07` lime | 성장 성공 |
| `.fail` / `.highlight.fail` | `#ff6b6b` red | 실패 |
| `.rest-personal` | `#65e3ff` cyan | 개인 휴식 |
| `.rest-official` | `#ffea48` yellow | 공식 휴식 — **yellow 이지만 semantic** |
| `.in-progress` | `#9b59b6` purple | 진행 중 |
| `.counting` | `#ff1493` pink | 집계 중 |

> 본 페이지 `cluster-4-card-px/[weekId]` 에는 weekly-card list 미렌더 — DOM 미존재. `_cluster4-px.scss` L302-307 의 `:has()` fallback 도 본 페이지엔 dead.

### 4-B) Output Link dot palette (4 위치)

| selector | 값 |
|---|---|
| 모든 4종 work modal `.link-dot { backgroundColor: dotColor }` | `["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"]` |

### 4-C) 상태/카테고리 palette

- `.web-badge` `#4caf50` (web-only 표시)
- `.university` `#4fc3f7` (출처)
- `.failed-text` `#ff0d0d` (실패 텍스트)
- `.failed-emoji` 동일
- `.not-applicable-text` `#dc2626` (해당 없음)
- `.required-mark` `#e74c3c` (필수 표시)
- `.tag.tag--red/yellow/purple/dark/green/cyan/mint` — palette
- `.info-stat .highlight-yellow` `#ffd700`, `.highlight-red` `#ff6b6b` — 두 단계 강조 palette
- `.badge-status.orange` `#ff8c00` — role 특수 강조 (yellow 와 의미 분리)
- 상태 confirmed/is-confirmed (`week-confirm-btn`) `rgba(120, 200, 120, *)` + `#a8e6a8` — 성장 성공 semantic green ✅ PX SCSS 에 명시적 재선언 (`_cluster4-card-px.scss` L665-670)

### 4-D) NICKNAME_COLORS palette (component constant)

> Cluster4CardContent.tsx 상단에 정의된 4색 닉네임 palette — index 회전. semantic identifier.

---

## 5) Weekly Review 별점 gold 유지 여부

| 항목 | 값 |
|---|---|
| selector | `.weekly-review-box .weekly-review-footer .review-stars__fill i` |
| base source | `_cluster4-week.scss` L13352 `color: #faab07` |
| PX defensive 룰 | `_cluster4-card-px.scss` **L621-633** — `.review-stars, .review-stars__base, .review-stars__fill, .ti-star, .ti-star-filled, .review-stars__fill i { color: inherit; fill: currentColor; }` + `.review-stars__fill i { color: #faab07; }` (semantic gold 명시 재선언, !important 없음 → base cascade 보존) |
| computed (실측) | `rgb(255, 255, 255)` ⚠️ **검토 필요** — 본 진단 dw-01 admin 모드에서 `weeklyReviewFromDB?.rating || 0` 이라 `review-stars__fill` 의 inline `width: 0px` → 채워진 별이 시각상 비가시. 즉 별점이 0이라 fill `<i>` 들이 가려져 색이 어떻든 안 보임 |
| PX Green 으로 잘못 변경된 흔적 | ❌ **없음** — PX SCSS L621-633 명시 `gold KEEP`. `_cluster4-card-px.scss` 의 17a/17b 블록 주석 (L451-461, L509-515) 에 "ratings palette 절대 변경 금지" 명시 ✅ |
| 권장 추가 검증 | rating > 0 인 실데이터 (예: 데모 weekId) 진입해 `review-stars__fill i` 의 computed color 가 `rgb(250, 171, 7)` 인지 재측정. 본 스냅샷에서 white 인 이유는 fill width 0px 로 i 자체가 hidden 영역에 있어 inherit 흐름이 다른 cascade 를 탔을 가능성 (또는 ti-icons 폰트 패키지가 자체 color reset 적용). **현 SCSS 상 별점 gold 보호 룰은 정확히 작성되어 있음** |

> ⚠️ 만약 다른 weekId 진입 시에도 white 로 보인다면 (rating > 0 인데 별이 안 보임) base specificity 가 PX defensive 보다 깊어서 패배하는 동일 패턴 가능 — 그 시점에 `!important` 추가 필요. 본 진단 시점 데이터 부족으로 단정 불가.

---

## 6) divider line 점검

### 6-A) top-tabs-wrapper 하단 1023px 얇은 line

| 항목 | 값 |
|---|---|
| DOM 위치 | `.cluster4-card-content > .top-tabs-wrapper::after` |
| Pseudo? | ✅ `::after` |
| source selector | `.cluster4-card-content .top-tabs-wrapper::after` |
| base 파일 | `_cluster4-week.scss` **L146-156** `background: #ecbb02` |
| PX override | `_cluster4-card-px.scss` **L418-420** `background: var(--px-accent) !important` |
| computed background | `rgb(30, 149, 3)` ✅ |
| 변경 대상? | ❌ 이미 정상 |
| 실제 visible 여부 | ✅ 가시 (1023px 가로선) |

### 6-B) section2-layout / section3-layout 상단 1px line

| 항목 | 값 |
|---|---|
| Pseudo? | ✅ `::before` (양쪽 모두) |
| base | `_cluster4-week.scss` L2654 `background: #ecbb02` (section2), section3-layout 도 동일 패턴 |
| PX override | `_cluster4-card-px.scss` L266-269 `background: var(--px-accent) !important` |
| computed | `rgb(30, 149, 3)` ✅ |
| 변경 대상? | ❌ 정상 |

### 6-C) work-exp-section / work-career-section 하단 section-bottom-divider

| 항목 | 값 |
|---|---|
| Pseudo? | ❌ 실제 `<div className="section-bottom-divider">` (Cluster4CardContent L7083 등) |
| base | `_cluster4-week.scss` L3927-3933 `width: 1023px; height: 1px; background: #ffa500` |
| PX override 1 | `_cluster4-card-px.scss` L220-222 (`.section-bottom-divider { background: var(--px-accent) }` — `.work-section/.work-exp-section/.work-career-section` 그룹 내) |
| PX override 2 | `_cluster4-px.scss` L219-222 `.work-exp-section/.work-career-section .section-bottom-divider { background: var(--px-accent) !important }` |
| computed (work-career-section) | `rgb(30, 149, 3)` ✅ |
| 변경 대상? | ❌ 정상 |
| 실제 visible 여부 | ✅ work-career-section 측 가시. work-exp-section 측은 DOM 에 element 미존재 (해당 위치 divider 가 없는 layout) — dead matching ok |

### 6-D) profile-divider / footer-divider (카드 내부 작은 구분자)

| 항목 | 값 |
|---|---|
| DOM | `.profile-divider`, `.footer-divider` — 평판/연계 카드 내부 `|` 텍스트 또는 작은 line |
| 변경 대상? | 본 페이지 카드 데이터 empty 라 DOM 미렌더 → 미관찰. 단 `_cluster4-week.scss` 내 정의는 yellow 가 아닌 흰색/회색 가능성 ↑ (별도 SCSS line 명시 검색 결과 yellow 매칭 없음). 권장: 데이터 진입 후 재검증 |

### 6-E) weekly-review-box header/footer border

| 항목 | 값 |
|---|---|
| DOM | `.weekly-review-header` border-bottom + `.weekly-review-footer` border-top |
| Pseudo? | ❌ 실제 border |
| base | `_cluster4-week.scss` **L13222** `border-bottom: 1px solid rgba(250, 171, 7, 0.25)`, **L13299** `border-top: 1px solid rgba(250, 171, 7, 0.25)` |
| PX override | `_cluster4-card-px.scss` L123 `border-bottom-color: rgba(30, 149, 3, 0.45) !important`, L128 `border-top-color: rgba(30, 149, 3, 0.45) !important` |
| computed (footer border-top) | `rgba(30, 149, 3, 0.45)` ✅ |
| 변경 대상? | ❌ 정상 |

---

## 7) wifi / rss / FM / icon 점검

### 7-A) `.fm-badge .wifi-icon` (RSS 모양 노란 PNG)

| 항목 | 값 |
|---|---|
| DOM 위치 | `.reputation-section .fm-badge .wifi-icon` (헤더 1곳) + 데이터 시: `.reputation-card .wifi-icon`, `.colleague-card .wifi-icon` |
| icon type | **PNG `<img>`** (`/images/0/cluster4/wifi new.png`) — 노란 RSS 톤 베이크인 |
| source selector | `_cluster4-card-px.scss` **L467-473** + `_cluster4-px.scss` L288-290 (weekly-card-extra-stats) |
| computed filter | `brightness(0) saturate(1) invert(0.36) sepia(0.94) saturate(20.69) hue-rotate(96deg) brightness(0.95) contrast(1.02)` ✅ — multi-stage chain 으로 PX green tint |
| 변경 대상? | ❌ 이미 정상. ⚠️ raster filter 정책 (사용자 새 정책: "PNG 자체 색 변환 자제") 부합 검토 필요 |
| 권장 | 옵션 A: `wifi new-px.png` 신규 PX 자산 + JSX `<img src={isPX ? "...-px.png" : "..."}>` 분기 + SCSS filter 제거. 옵션 B: 현행 유지 (필터 결과 시각상 자연스럽다면 유지 가능) |

### 7-B) `.ti-rss / .ti-wifi / .broadcast-icon` (Tabler Icons webfont)

| 항목 | 값 |
|---|---|
| DOM 매칭 | ❌ **본 페이지에 매칭 없음** (`<i className="ti ti-rss">` 또는 `ti-wifi` 사용처 없음) |
| 권장 | dead — 변경 대상 아님 |

### 7-C) `.broadcast-icon`

| 항목 | 값 |
|---|---|
| DOM 매칭 | ❌ 본 페이지 매칭 없음 |
| 권장 | dead |

### 7-D) `.review-book-icon` (weekly-review-box 책 PNG)

| 항목 | 값 |
|---|---|
| icon type | PNG `<img src="/images/0/book.png">` |
| filter | 없음 — untouched |
| 권장 | semantic (책 식별 색) — KEEP ✅ |

### 7-E) `.view-icon` (eye PNG)

| 항목 | 값 |
|---|---|
| icon type | PNG `<img src="/images/0/cluster4/icon/icon - 7 - eye.png">` |
| filter | 없음 (PX SCSS L459 명시적 KEEP 주석) |
| 권장 | conservative KEEP ✅ |

### 7-F) `.ti-pencil` (Tabler Icons webfont)

| 항목 | 값 |
|---|---|
| DOM 매칭 | `.floating-icons .edit-icon i.ti-pencil` × 6 (work-info/exp/ability/career section, reputation, colleague) |
| inline | `style={{ color: "#1a1a1a", fontSize: "16px" }}` (6곳 동일) |
| PX override | `_cluster4-card-px.scss` L681-683 `.floating-icons .edit-icon i.ti-pencil { color: var(--px-accent-soft) !important; }` |
| computed | `rgb(178, 255, 143)` ✅ — inline override 성공 |
| 권장 | ❌ 정상 |

### 7-G) `.card-arrow` (work-*-card 우하단 더보기)

| 항목 | 값 |
|---|---|
| icon type | PNG `<img src="/images/0/cluster4/icon - 더보기.png">` (yellow BG + WHITE arrow glyph) |
| filter | `hue-rotate(80deg) saturate(1.4)` (`_cluster4-px.scss` L559-566) — white glyph 보존 의도 |
| 13개 DOM 매칭 | ✅ |
| 권장 | ❌ 정상 (white glyph 보존이 의도) |

### 7-H) `.title-icon` / `.sub-icon` (work-*-card 폴더 아이콘)

| 항목 | 값 |
|---|---|
| icon type | PNG `<img src="/images/0/cluster4/icon/icon - 11 - file.png">` (pure yellow, no white glyph) |
| filter | brightness(0) chain (`_cluster4-card-px.scss` L477-485, `_cluster4-px.scss` L582-592) |
| 18개 title-icon DOM 매칭 | ✅ |
| 권장 | ❌ 정상 |

---

## 8) Weekly Review Box 점검

| 항목 | 실측 computed | 권장 |
|---|---|---|
| **border** | `rgba(30, 149, 3, 0.75)` (PX `_cluster4-card-px.scss` L115) ✅ | ❌ 정상 |
| **header background** | `linear-gradient(rgba(30, 149, 3, 0.05) 0%, rgba(30, 149, 3, 0.01) 100%)` ✅ | ❌ 정상 |
| **header border-bottom** | `rgba(30, 149, 3, 0.45)` (PX L123 `border-bottom-color`) | ❌ 정상 |
| **footer background** | `linear-gradient(0deg, rgba(30, 149, 3, 0.05) ...)` ✅ | ❌ 정상 |
| **footer border-top** | `rgba(30, 149, 3, 0.45)` (PX L128) ✅ | ❌ 정상 |
| **glow / box-shadow** | `rgba(0,0,0,0.5) 0 8px 24px, rgba(30,149,3,0.22) 0 0 10px, rgba(178,255,143,0.08) inset 0 0 0 1px` ✅ | ❌ 정상 |
| **`.review-view-btn`** | border `rgba(30,149,3,0.55)` + bg `rgba(30,149,3,0.1)` + box-shadow `rgba(30,149,3,0.22)` ✅ | ❌ 정상 |
| **`.review-title`** color | `rgb(255, 255, 255)` (base #fff, PX 미터치) | semantic 텍스트 — ❌ 정상 |
| **`.review-content`** color | `rgba(255, 255, 255, 0.85)` (base, PX 미터치) | semantic — ❌ 정상 |
| **`.review-score`** color | `rgb(255, 255, 255)` (base, PX 미터치) | semantic 흰색 텍스트 — ❌ 정상 |
| **별점 (`.review-stars__fill i`)** | 본 스냅샷 `rgb(255, 255, 255)` — 단 rating=0 이라 fill width 0 (비가시) | semantic gold 유지 룰은 PX SCSS L621-633 에 존재. rating>0 인 weekId 로 추가 검증 권장 |
| **semantic star 유지 여부** | PX SCSS 명시적 보호 룰 존재 ✅ | ❌ 정상 (의도 보존) |

---

## 9) 이미지 / 배경 untouched 검증

### 9-A) 캐릭터 / identity 이미지 (변경 금지 대상)

| 자산 | 사용 위치 | 변경 여부 |
|---|---|---|
| `/images/0/cluster4/주차 이미지/...png` (메인 주차 이미지) | `.main-week-image` `<img src>` (Cluster4CardContent.tsx L5895 부근) | ❌ 미터치 ✅ |
| `/images/0/cluster4/icon/icon - 단감.png` / `인절미.png` / `어흥.png` | header `.info-item.with-icon .item-icon` | ❌ 미터치 ✅ — PX 시에는 `getPxAlias()` 의 별도 `<span className="badge-icon">` 이용 (CSS sprite/font, 컴포넌트 L6063), 원본 PNG 영향 없음 |
| `/images/0/colleague.png` (empty colleague placeholder) | `.empty-colleague-image` | ❌ 미터치 ✅ |
| `/images/0/book.png` (review-book-icon) | `.review-book-icon` | ❌ 미터치 ✅ |
| `/images/0/cluster4/icon/icon - 주차 평판.png` (section-icon) | `.reputation-section .section-title-row .section-icon` | ❌ 미터치 ✅ |
| `/images/0/cluster4/icon/icon - 연계 동료.png` | `.colleague-section .section-title-row .section-icon` | ❌ 미터치 ✅ |
| `/icon/icon - 7 - eye.png` (.view-icon) | weekly-review-box + reputation modal | ❌ 미터치 ✅ (PX SCSS L459 명시 KEEP) |
| 별점 PNG (`/icon/icon - star.png`, `icon - 0 - 3star.png` 중 후자는 filter 적용; 전자는 KEEP) | rating stars | ✅ 별점 자체 PNG 미터치, decorative star-icon (3-star) 만 filter |

### 9-B) Background-image 자체

| 자산 | 처리 |
|---|---|
| `.top-tabs-wrapper` `background-image: url(/4-1-card/bg img 1.png)` | ❌ 미터치 ✅. 70% black overlay (`&::before`) 는 base 의 그대로 |
| `.main-week-image` (사용자 주차 image) | `<img>` 직접 — 미터치 |
| `.section-modal` / `.section-modal-reputation` background | 모달 미오픈 — DOM 미렌더 |

### 9-C) Overlay tint / opacity

| 항목 | 값 |
|---|---|
| weekly-review-box bgImg | `linear-gradient(135deg, rgba(35, 25, 20, 0.45) 0%, rgba(20, 15, 25, 0.5) 100%)` (base 그대로, PX 미터치 — neutral dark) ✅ |
| 캐릭터 이미지 색상 변경 | ❌ 없음 — 본 페이지에 캐릭터 PNG 위 색 변경 처리 0건 |
| neon green 회피 | weekly-review-header bgImg `rgba(30, 149, 3, 0.05~0.01)` — 매우 낮은 alpha 의 PX accent. neon 톤 회피 ✅ |

### 9-D) Body / main / section 전체 tint

- ❌ 전무 — PX SCSS 어디에서도 `body`, `main`, `.cluster4-card-content` 전체에 색감 overlay 부여 없음 ✅

---

## 10) 문제 원인 분류

### scope mismatch
- 없음. `<main class="cluster-px-theme"> → <div class="cluster4-card-content weekly-card-detail">` DOM 체인 매칭 ✅
- `cluster4-card-content` 와 `weekly-card-detail` 두 클래스가 같은 element 에 부착 (L5733) — `_cluster4-card-px.scss` 가 둘 다 잡도록 작성됨 (주석 L6-7)

### import order issue
- 없음. `main.scss`:
  ```
  L137 _px-tokens.scss            (CSS vars)
  L144 _cluster4-season.scss      (base)
  L145 _cluster4-week.scss        (base)
  L146 _cluster4-px.scss          (PX override - family)
  L147 _cluster4-card-px.scss     (PX override - card page 전용, 가장 뒤)
  ```
  PX override 가 모든 base 보다 뒤. cascade ✅

### inline style
- ⚠️ 검출 3건 (위 3-B I1/I2/I3) — 본 진단 스냅샷에선 DOM 미렌더 (데이터 empty)
- L8456 admin 진입 + 데이터 존재 시 노출

### styled-jsx
- 검출 없음. 본 페이지는 styled-jsx 미사용.

### pseudo-element
- 모두 PX SCSS 로 정확히 매칭 (`top-tabs-wrapper::after`, `section2/3-layout::before`) ✅

### dead selector
- ⚠️ `_cluster4-px.scss` L73-350 (`.cluster4-content`) 의 시즌 카드 family — 본 페이지에 `.cluster4-content` **미존재** → 본 페이지 진단상 dead. **단 의도된 dead** (`/cluster-4-px`, `/cluster-4-1-px` 매칭). 무해
- `_cluster4-px.scss` L245-308 `.weekly-cards .weekly-card` — 본 페이지엔 weekly-cards list 미존재. dead in this page (다른 PX 라우트 매칭)
- `_cluster4-card-px.scss` L100-102 `.section1-layout .info-stat .highlight` — 본 페이지엔 `.info-stat` 미존재 (cluster-4 시리즈 일부에서만 사용). dead
- `_cluster4-card-px.scss` L401-405 `.dropdown-item.active` — 드롭다운 미오픈 시 dead, 오픈 시 매칭
- 모달 관련 룰 (`.section-modal*`) — 모달 미오픈 시 dead, 오픈 시 매칭

### semantic color 오판 가능성
- ❌ 본 페이지에서 발견된 침범 없음
- progress / counting / status badge / star palette 모두 보존 ✅
- `.week-confirm-btn.status-confirmed` 의 success green (`rgba(120,200,120,*)`) PX SCSS L665-670 에서 명시적 재선언 ✅
- 별점 gold 보호 룰 PX SCSS L621-633 ✅

### selector mismatch
- 없음. 모든 PX override selector 가 실제 DOM 에 매칭 (단 일부는 dead by 데이터 부재)

### **🔴 specificity mismatch (보고상 수정됐지만 실제 DOM 미적용 사례)**
- **3건** (3-A 의 R1/R2/R3) — PX override 가 작성되어 있지만 base SCSS 의 chain 이 더 깊어 cascade 패배
- 패턴: 원본 `_cluster4-week.scss` 가 `.cluster4-card-content .section1-layout .section1-right .section1-header .header-info-row .info-badge .highlight` (`0,7,0`) 처럼 7~8단계 chain 으로 작성되어 있고, PX override 는 `.section1-layout .info-badge .highlight` (`0,3,0` + `.cluster-px-theme .cluster4-card-content` prefix = `0,5,0`) 짧은 chain
- 해결: 원본 chain 깊이로 PX override 재선언 + `!important` 보강

### "보고상 수정됐지만 실제 DOM 미매칭" 사례
- 위 3건 — `_cluster4-card-px.scss` L94-96, L139-149, L158-165 에 "✅ 작성됨" 으로 기재되어 있으나 실측 yellow 잔존
- 이전 진단 `cluster-4-1-px-diagnostic.md` 에서 해당 SCSS 룰을 "✅ 정상" 으로 분류했던 부분이 본 페이지 실측에서 cascade 패배 발견

---

## 11) 다음 수정 프롬프트에 넣어야 할 정확한 작업 목록

### 11-A) 🔴 우선순위 높음 — SCSS specificity 보강 (3건, 실측 yellow 잔존)

#### A-1) `.info-badge .highlight` ("+1" 주차 카운트)

**파일**: `app/(host)/assets/scss/components/_cluster4-card-px.scss`

**현재 (L94-96)**:
```scss
.section1-layout .info-badge .highlight {
  color: var(--px-accent-soft);
}
```

**변경 후 (권장)**:
```scss
// 원본 _cluster4-week.scss L1355 chain (.cluster4-card-content .section1-layout
// .section1-right .section1-header .header-info-row .info-badge .highlight) 의
// specificity 0,7,0 을 이기기 위해 동일 깊이 + !important.
.section1-layout .section1-right .section1-header .header-info-row .info-badge .highlight {
  color: var(--px-accent-soft) !important;
}
```

#### A-2) `.reputation-section .count-num` ("주차 평판 X/4" 숫자)

**파일**: 동일

**현재 (L139-149)**:
```scss
.reputation-section {
  .section-count .count-num {
    color: var(--px-accent-soft);
  }
  ...
}
```

**변경 후**:
```scss
.section1-layout .section1-right .reputation-section .section-title-row .section-count .count-num {
  color: var(--px-accent-soft) !important;
}
```

#### A-3) `.colleague-section .count-num` ("연계 동료 X/3" 숫자)

**파일**: 동일

**현재 (L158-165)**:
```scss
.colleague-section {
  .section-count .count-num {
    color: var(--px-accent-soft);
  }
  ...
}
```

**변경 후**:
```scss
.section1-layout .section1-right .colleague-section .section-title-row .section-count .count-num {
  color: var(--px-accent-soft) !important;
}
```

> 세 패턴 모두 PX SCSS 블록 `(4) section1 header info` 와 `(6) reputation-section`, `(7) colleague-section` 내부에서 selector chain 만 원본 깊이로 매칭하면 해결. 추가 SCSS 분량 거의 없음.

### 11-B) 🟢 우선순위 낮음 — JSX inline 분기 (데이터 존재 시 노출)

#### B-1) `.role badge-status.yellow` inline (평판 카드 L6224-6232 / 연계 카드 L6358-6370)

**파일**: `components/cluster-4-card/Cluster4CardContent.tsx`

**변경 전 (예: L6224)**:
```tsx
<span
  className="badge-status yellow"
  style={{
    padding: "4px 7.2px",
    background: "rgba(250, 171, 7, 0.1)",
    ...
    color: "#faab07",
    ...
  }}
>
```

**변경 후**:
```tsx
<span
  className="badge-status yellow"
  style={{
    padding: "4px 7.2px",
    background: isPX ? "rgba(30, 149, 3, 0.1)" : "rgba(250, 171, 7, 0.1)",
    ...
    color: isPX ? "#1E9503" : "#faab07",
    ...
  }}
>
```

**대안 SCSS**: PX SCSS 에 추가 (style attribute selector 가 background 는 못 잡으므로 클래스 기반):
```scss
.cluster-px-theme .cluster4-card-content .badge-status.yellow {
  background: rgba(30, 149, 3, 0.1) !important;
  color: var(--px-accent) !important;
}
```
단, JSX inline `style` 의 `background`/`color` 는 specificity 1,0,0,0 이라 `!important` 가 있어야만 이김.

#### B-2) admin 전용 reputation modal 수정 버튼 inline (L8456)

`isPX` 분기로 `background / border / color` 3개 모두 PX 톤 매핑.

### 11-C) 🟢 우선순위 낮음 — confetti 색상 PX 일관성 (선택)

#### C-1) `fireConfettiAtButton` confetti palette (L3815, L3825)

```tsx
colors: isPX
  ? ["#B2FF8F", "#7DD89F", "#1E9503", "#A8E6A8", "#FFFFFF"]  // PX celebration
  : ["#FFD87A", "#FFC040", "#A8E6A8", "#7DD89F", "#FFFFFF"], // 원본 gold
```

> 시각적 효과는 의도에 따라 선택 — confetti 는 짧은 1초 이벤트라 사용자 의사에 맞춰.

### 11-D) 🟢 우선순위 낮음 — 별점 gold 추가 검증

#### D-1) rating>0 인 weekId 로 별점 색상 재측정

- 본 진단은 `dw-01?admin=true` rating=0 → fill width 0 → 별점 비가시
- 다른 weekId (실데이터) 로 진입 후 `.review-stars__fill i` computed color 가 `rgb(250, 171, 7)` 인지 확인
- white 로 나오면 base chain specificity 가 PX defensive 보다 더 깊어 패배 — `!important` 추가 필요

### 11-E) 건드리면 안 되는 selector / 파일

- `_cluster4-season.scss`, `_cluster4-week.scss` (base — **절대 수정 금지**)
- `/cluster-4-card` 원본 라우트 (`page.tsx`, `[weekId]/page.tsx`)
- `Cluster4CardContent.tsx` 의 `NICKNAME_COLORS` (palette)
- Output Link dot palette `["#FF6B6B", "#4ECDC4", "#FAAB07", "#6BCB77", "#A084DC"]` (4 위치: work-info/exp/ability/career modal 내부)
- `.weekly-card-status-badge.fail/.rest-personal/.rest-official/.in-progress/.counting` (semantic state palette)
- `.weekly-card-stats .stat .highlight.fail/.rest-personal/.rest-official` (semantic)
- `.badge-status.orange` (#ff8c00) — role 특수 강조
- `.tag.tag--red/yellow/purple/dark/green/cyan/mint` palette
- `.web-badge` (#4caf50), `.university` (#4fc3f7), `.failed-text` (#ff0d0d), `.not-applicable-text` (#dc2626), `.required-mark` (#e74c3c)
- `.info-stat .highlight-yellow` (#ffd700), `.highlight-red` (#ff6b6b)
- `.week-confirm-btn.status-confirmed/.is-confirmed` (성공 semantic green)
- `.review-stars / __base / __fill / .ti-star / .ti-star-filled` (별점 gold)
- `/images/0/book.png`, `/images/0/colleague.png`, `/images/0/cluster4/icon - 7 - eye.png`, `/images/0/cluster4/icon/icon - 단감.png`, `인절미.png`, `어흥.png`, `icon - 주차 평판.png`, `icon - 연계 동료.png` (모든 identity / semantic PNG)
- `_cluster4-card-px.scss` 의 17a/17b/22 블록 (별점 gold 명시 KEEP 룰)
- `_cluster4-card-px.scss` L665-670 (`week-confirm-btn` success green 재선언)

### 11-F) 검증 체크리스트

#### DevTools 컴퓨티드 스타일
- [ ] `/cluster-4-card-px/dw-01?admin=true` 진입 시 `<main>` 에 `cluster-px-theme` 부착 ✅ (이미 정상)
- [ ] `<div class="cluster4-card-content weekly-card-detail">` 루트 ✅
- [ ] **🔴 `.section1-layout .header-info-row .info-badge.week .highlight` computed color `rgb(30, 149, 3)` 또는 `rgb(178, 255, 143)` (현재 `rgb(250, 171, 7)` — 수정 후 확인)**
- [ ] **🔴 `.reputation-section .section-count .count-num` computed color PX green (현재 `rgb(250, 171, 7)`)**
- [ ] **🔴 `.colleague-section .section-count .count-num` computed color PX green (현재 `rgb(250, 171, 7)`)**
- [ ] `.weekly-review-box` border `rgba(30, 149, 3, 0.75)` ✅ (이미 정상)
- [ ] `.weekly-review-footer` border-top `rgba(30, 149, 3, 0.45)` ✅
- [ ] `.review-view-btn` border/bg PX green ✅
- [ ] `.detail-log-btn`, `.week-confirm-btn` PX green hollow ✅
- [ ] `.floating-icons .edit-icon` bg `rgb(30, 149, 3)` ✅
- [ ] `.floating-icons .edit-icon i.ti-pencil` color `rgb(178, 255, 143)` ✅
- [ ] `.fm-badge .wifi-icon` filter chain ✅
- [ ] `.top-tabs .tab:first-child` bg `rgb(30, 149, 3)` ✅
- [ ] `.top-tabs-wrapper::after` bg `rgb(30, 149, 3)` ✅
- [ ] `.section2-layout::before`, `.section3-layout::before` bg PX green ✅
- [ ] `.work-*-card .card-title` color `rgb(178, 255, 143)` ✅
- [ ] `.work-career-card .grade-row .grade.active` bg `rgb(30, 149, 3)` + soft glow ✅
- [ ] `.work-career-card .category-text` color `rgb(30, 149, 3)` + bg `rgba(30, 149, 3, 0.1)` ✅
- [ ] `.work-career-section .section-bottom-divider` bg `rgb(30, 149, 3)` ✅
- [ ] rating>0 인 weekId 진입 후 `.review-stars__fill i` color `rgb(250, 171, 7)` (gold 보존) — **추가 검증 필요**

#### Network
- [ ] `/images/0/cluster4/wifi new.png` 200 응답 (PNG 미수정 — filter 만 적용)
- [ ] `/images/0/cluster4/icon - 더보기.png` 200
- [ ] `/images/0/cluster4/icon/icon - 11 - file.png` 200
- [ ] `/images/0/book.png` 200
- [ ] 캐릭터 PNG (`/images/0/cluster4/icon/icon - 단감/인절미/어흥.png`) 200
- [ ] 404 0건

#### 비교 검증
- [ ] `/cluster-4-card/dw-01` (원본) yellow/gold 유지 (회귀 없음)
- [ ] `/cluster-4-card-px/dw-01` 진입 즉시 PX green (`.cluster-px-theme` 동기 부착)
- [ ] 레이아웃 · 위치 · 크기 · spacing · 애니메이션 완전 동일
- [ ] 캐릭터 식별 색 / 책 / eye / 평판/연계 section-icon 식별 색 유지

#### semantic 보존
- [ ] 별점 (rating>0 데이터) computed color `rgb(250, 171, 7)` 유지
- [ ] `.week-confirm-btn.status-confirmed` 시 color `#a8e6a8` + bg `rgba(120, 200, 120, 0.18)` 유지
- [ ] confetti 폭죽 (옵션 C-1 미적용 시) 기존 색상 유지
- [ ] Output Link 5 dot palette 유지

#### inline 분기 적용 후 (옵션 B 적용 시)
- [ ] `/cluster-4-card-px/[weekId]` 평판 카드 role badge background `rgba(30, 149, 3, 0.1)`, color `#1E9503`
- [ ] `/cluster-4-card/[weekId]` 원본 role badge background `rgba(250, 171, 7, 0.1)`, color `#faab07` 유지
- [ ] admin 진입 시 reputation modal 수정 버튼 PX 톤

---

## 결론 (요약)

1. **`/cluster-4-card-px` PX Green 변환은 SCSS 측에서 매우 광범위하게 적용됨.** `_cluster4-card-px.scss` 705 lines 중 약 600+ lines 가 본 페이지 매칭 selector. `_cluster4-px.scss` 의 `.cluster4-card-content` scope (L378-602) 도 정확히 매칭. 약 95% 영역에서 PX Green 정상 적용 ✅

2. **🔴 SCSS specificity 패배로 실측 yellow 잔존 3건 — 즉시 처리 대상**:
   - **R1**: `.info-badge.week .highlight` ("+1" 주차 카운트) — base chain `0,7,0` vs PX `0,5,0` cascade 패배
   - **R2**: `.reputation-section .count-num` ("주차 평판 0/4") — 동일 패턴
   - **R3**: `.colleague-section .count-num` ("연계 동료 0/3") — 동일 패턴
   - 해결: `_cluster4-card-px.scss` 의 해당 selector 를 원본 chain 깊이로 재선언 + `!important`

3. **🟢 데이터 존재 시 노출되는 JSX inline yellow 3건** (본 진단 dw-01 admin 모드에선 카드 empty 라 DOM 미렌더):
   - L6224-6232 — 평판 카드 `.role badge.badge-status.yellow` inline
   - L6358-6370 — 연계 카드 동일 패턴
   - L8456 — admin reputation modal 수정 버튼

4. **🟢 confetti 폭죽 색상** — `isPX` 분기 옵션 (시각적 의도에 따라 선택)

5. **semantic 보존 완벽**:
   - 별점 gold 보호 룰 명시적 SCSS 작성 ✅ (단 본 스냅샷 rating=0 → 추가 데이터 검증 권장)
   - `week-confirm-btn` 성공 상태 green semantic 보존 ✅
   - Output Link 5 dot palette 보존 ✅
   - weekly-card status palette 5색 (semantic) 본 페이지엔 미렌더 — 다른 PX 라우트에서 보존 ✅
   - 모든 캐릭터/identity PNG 미터치 ✅

6. **scope / import order / wrapper 부착 / cascade 모두 정상**. `.cluster-px-theme` 동기 부착, `_cluster4-card-px.scss` 가 가장 뒤 import.

7. **dead selector**: PX SCSS 의 약 250+ lines 가 본 페이지 매칭 없음 — **모두 의도된 dead** (다른 PX 라우트 매칭 / 모달 등 상호작용 시 매칭). 무해.

8. **raster PNG filter 정책 결정 미해결**: `wifi new.png`, `icon - 11 - file.png` 등 약 5개 PNG 가 `filter:brightness(0) ... hue-rotate(...) ...` multi-stage chain 으로 재착색 중. 옵션 A (PX 자산 신규 생성) vs 옵션 B (현행 유지) 정책 결정 필요. 본 진단상으로는 시각적 결과 자연스럽고 white glyph (card-arrow) 보존 의도도 정확 → 우선순위 🟢 낮음.

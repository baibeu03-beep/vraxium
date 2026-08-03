"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveOrgFromLocation, ORGANIZATION_CONFIG } from "@/lib/cluster-route";

// Figma 기준: Career Resume 파일, node 1068:22075 (Frame 2121457496, 1336x482,
// authoritative source).
//
// 공용 컴포넌트: /cluster-5(-marketing), /cluster-5-entertainment(물리 폴더
// cluster-5-ec), /cluster-5-planning(물리 폴더 cluster-5-px) 세 canonical
// org 라우트가 모두 본 컴포넌트를 그대로 import한다(cluster-3/Cluster3Content,
// cluster-3-px/page.tsx 의 기존 관례와 동일 — 각 page.tsx는 얇은 wrapper).
// org별 JSX 복제나 별도 UI 파일 없음, API/DTO/조회 로직도 전혀 없음(순수
// 프레젠테이션).
//
// 이 버전은 픽셀 단위 정밀 보정판이다. Figma 레퍼런스 PNG를 직접 픽셀
// 스캔해 실제 렌더된 줄 위치(y)를 측정한 결과, raw 레이어 데이터만으로는
// 알 수 없던 사실이 드러났다:
//   실제 시각 순서 = 본문(백색) → 강조문(골드) → "-맹자-"(백색, 맨 마지막)
// "-맹자-"는 raw 텍스트 노드 안에서는 본문 문단의 마지막 줄이지만, 본문
// 컨테이너(중심 y=265, 10줄=220px)와 강조문 컨테이너(중심 y=335, 1줄)가
// 서로 다른 절대좌표로 독립 배치되어 있어 실제로는 강조문 "뒤"에 렌더된다.
//
// 데스크톱은 Figma 절대좌표(top/left/width)를 그대로 재현한다. `left:
// calc(50% - 537.5px)` + `width: 1075px` 조합은 컨테이너 폭에 관계없이
// "1075px 폭 블록을 정중앙 정렬"과 수학적으로 동일하므로, 실제 컬럼 폭이
// Figma의 1336px와 다르더라도(사이드바 때문에 보통 더 좁음) 정확히 중앙
// 정렬된다. 좁은 화면(≤1199.98px)에서는 별도 media query로 절대배치를
// 해제하고 자연스러운 flow 레이아웃으로 전환한다.
//
// 색상 정책(org 테마): 강조 인용구 그라디언트만 org별로 달라진다. org는
// lib/cluster-route.ts의 단일 SoT인 resolveOrgFromLocation(pathname, orgQuery)
// → ORGANIZATION_CONFIG 로만 계산하며, 이 파일 안에 새 색상표나 if/switch
// 분기를 두지 않는다. resolveOrgFromLocation은 "?org=" 쿼리를 먼저 보고,
// 없으면 canonical 경로 suffix(-marketing/-entertainment/-planning)로
// 판정한다 — /cluster-5-entertainment 처럼 실제 pathname으로 접근한
// 사용자도 쿼리 없이 정확한 org를 받는다(cluster-3/cluster-4와 동일 SoT).
// gradientStart/gradientEnd = ORGANIZATION_CONFIG[org].themeColor/accentSoft를
// React inline style로 CSS 커스텀 프로퍼티(--cluster5-accent/-soft)에 얹어
// 최초 렌더부터(useEffect 없이, 동기 계산) 적용한다 — FOUC 없음. 각도/stop
// 위치(6.52deg, 48.5%/91.7%)는 org와 무관한 이 컴포지션 고유의 기하학적
// 디테일로 고정 유지. 타이틀 흰색/검정 오프셋, 본문 흰색, 출처 흰색,
// 배경 이미지, 검정 스크림(0.7), 타이포그래피·위치·간격은 org 무관 공통
// 요소로 전부 유지(var(--white)/var(--black) 그대로, Figma에 별도
// 포인트/외곽선 레이어가 없어 타이틀 자체엔 org색을 적용하지 않음).
//
// 타이틀의 2겹 오프셋(검정 뒤 + 흰색 위, 3.54px/3px 오프셋)은 CSS
// text-shadow 근사가 아니라 Figma와 동일하게 실제 두 개의 중첩 DOM
// 텍스트 레이어로 구현했다(title-shadow / title). 동일 기법이 이미
// _weekly-ranking.scss(.weekly-hero__title / __title-shadow, Khula
// 800/72px)에 존재해 그 정적 버전을 재사용한다(글로우/드리프트
// 애니메이션은 Figma 스펙에 없으므로 가져오지 않음). Khula 800 웹폰트도
// _cluster2.scss에서 이미 전역 로드되어 추가 네트워크 비용 0.
//
// HakgyoansimTuho 검증: 프로젝트 @font-face(_resume-card.scss)가 로드하는
// 파일은 TTHakgyoansimTuhoR.woff2 — 파일명의 "R"이 Figma의
// "Hakgyoansim_Tuho:R"(스타일 "R" = Regular)과 정확히 대응하는 동일
// 폰트 파일이다. font-weight:normal(=400)로 등록되어 있어 우리가 쓰는
// weight 400과 합성(synthetic) 없이 정확히 매핑된다. font-synthesis:none
// 을 명시해 브라우저가 임의로 가짜 굵게/기울임을 합성하지 못하도록
// 막는다.
const heroStyles = `
  .cluster5-hero {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    min-height: 482px;
  }
  .cluster5-hero__bg {
    position: absolute;
    inset: 0;
    background-image: url(/images/0/cluster5/Hero.png);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .cluster5-hero__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
  }
  .cluster5-hero__content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 482px;
    font-synthesis: none;
  }

  /* ---- 타이틀 (Khula ExtraBold 800, 72px/82px, uppercase, letter-spacing 0) ---- */
  .cluster5-hero__title-shadow,
  .cluster5-hero__title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 1303px;
    margin: 0;
    display: block;
    /* [수정] 폰트 실측(CDP CSS.getPlatformFontsForNode)에서 이 선언이 Khula 가
       아니라 Malgun Gothic 으로 렌더되고 있었다. Khula 는 app/(host)/layout.tsx
       의 next/font/google 로만 로드되는데, next/font 가 만드는 실제 패밀리명은
       __Khula_xxxxxx 라서 문자열 "Khula" 로는 매칭되지 않는다(_cluster2.scss 의
       @import 는 번들 중간에 위치해 브라우저가 무시). 같은 파일의 .c5card__score
       가 이미 쓰고 있는 var(--rajdhani) 패턴대로 CSS 변수를 맨 앞에 둔다. */
    font-family: var(--khula), "Khula", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 72px;
    line-height: 82px;
    letter-spacing: 0;
    text-transform: uppercase;
    text-align: center;
    /* nowrap을 강제하지 않는다 — 실사이드바 컬럼 폭이 뷰포트보다 훨씬 좁아지는
       992~1199.98px 구간에서 고정폭 박스를 뚫고 실제로 텍스트가 잘리는 버그를
       전수 감사에서 발견(스크린샷으로 확인). 폭이 충분한 데스크톱에서는 한
       줄로 자연히 유지되고, 좁아지면 줄바꿈되어 잘림 없이 안전하다. */
    white-space: normal;
    word-break: keep-all;
  }
  .cluster5-hero__title-shadow {
    top: 50px;
    color: var(--black, #000000);
    z-index: 0;
    pointer-events: none;
    user-select: none;
  }
  .cluster5-hero__title {
    /* Figma: 검정 레이어 origin(0,0) 대비 흰색 레이어 offset (+3.54px, +3px) */
    top: 53px;
    transform: translateX(calc(-50% + 3.54px));
    color: var(--white, #ffffff);
    z-index: 1;
  }

  /* ---- 본문 / 강조문 공통 ---- */
  .cluster5-hero__line {
    position: absolute;
    left: 50%;
    transform: translateX(-537.5px); /* = 1075px 폭 블록 중앙 정렬, Figma calc(50% - 537px)와 동일 수학 */
    width: 1075px;
    margin: 0;
    font-family: "HakgyoansimTuho", "Pretendard", "Noto Sans KR", sans-serif;
    font-weight: 400;
    letter-spacing: 0;
    font-synthesis: none;
  }
  .cluster5-hero__line--body {
    color: var(--white, #ffffff);
    font-size: 20px;
    line-height: 22px;
  }
  .cluster5-hero__line--highlight {
    /* org 강조색 — var() 폴백(#fed402/#fff1aa)은 커스텀 프로퍼티가 미설정일
       때만 쓰이는 방어값이며, 정상 렌더 시엔 항상 아래 컴포넌트가 주입한
       ORGANIZATION_CONFIG[org] 값이 적용된다. */
    background: linear-gradient(
      6.52deg,
      var(--cluster5-accent, #fed402) 48.5%,
      var(--cluster5-accent-soft, #fff1aa) 91.7%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 24px;
    line-height: 22px;
  }
  .cluster5-hero__line--attribution {
    color: var(--white, #ffffff);
    font-size: 20px;
    line-height: 22px;
  }

  /* Figma 실측 y좌표(레퍼런스 PNG 픽셀 스캔으로 검증) 기준에서, 타이틀-본문
     간격만 +40px 보정한 값. cluster-2/3/4/4-1의 .section1-title(72px) →
     .section1-description 첫 문단 간격을 Playwright getBoundingClientRect로
     실측한 결과 4개 페이지 전부 정확히 60px(72px 대비 0.833 비율)로 통일되어
     있었음. Figma 원본 gap(20px)은 이 리듬과 어긋나 있어, 본문 내부 줄 간격
     (l1→l4→l6→highlight→attribution의 상대 간격)은 그대로 보존한 채 전체
     블록만 40px 아래로 이동해 title bottom 기준 60px gap을 재현했다. */
  .cluster5-hero__line--l1 { top: 195px; }
  .cluster5-hero__line--l4 { top: 261px; }
  .cluster5-hero__line--l6 { top: 305px; }
  .cluster5-hero__line--highlight { top: 364px; }
  .cluster5-hero__line--attribution { top: 393px; }

  /* ---- ≤1199.98px: 절대배치 해제, 자연스러운 flow 레이아웃으로 전환 ---- */
  @media only screen and (max-width: 1199.98px) {
    .cluster5-hero__content {
      height: auto;
      padding: 32px 72px 48px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .cluster5-hero__title-shadow,
    .cluster5-hero__title {
      /* static이 아닌 relative — z-index(스택 순서)가 계속 적용되도록 유지.
         left:50% 는 relative에서도 오프셋으로 작동하므로 반드시 auto로 리셋. */
      position: relative;
      top: auto;
      left: auto;
      max-width: 100%;
      font-size: 52px;
      line-height: 60px;
      white-space: normal;
    }
    .cluster5-hero__title-shadow {
      transform: none;
    }
    .cluster5-hero__title {
      margin-top: -60px; /* shadow 레이어와 겹치도록 흰 레이어를 그 위로 끌어올림 */
      transform: translate(3.54px, 3px);
    }
    .cluster5-hero__line {
      position: static;
      transform: none;
      width: 100%;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
    .cluster5-hero__line--l1 { margin-top: 12px; }
    .cluster5-hero__line--highlight { margin-top: 4px; }
  }

  @media only screen and (max-width: 991.98px) {
    .cluster5-hero {
      min-height: 0;
    }
    .cluster5-hero__content {
      padding: 28px 48px 40px;
      gap: 16px;
    }
    .cluster5-hero__title-shadow,
    .cluster5-hero__title {
      font-size: 38px;
      line-height: 46px;
    }
    .cluster5-hero__title {
      margin-top: -46px;
    }
    .cluster5-hero__line--body,
    .cluster5-hero__line--attribution {
      font-size: 18px;
      line-height: 24px;
    }
    .cluster5-hero__line--highlight {
      font-size: 21px;
      line-height: 26px;
    }
  }

  @media only screen and (max-width: 575.98px) {
    .cluster5-hero__content {
      padding: 24px 20px 32px;
      gap: 14px;
    }
    .cluster5-hero__title-shadow,
    .cluster5-hero__title {
      font-size: 24px;
      line-height: 30px;
    }
    .cluster5-hero__title {
      margin-top: -30px;
    }
    .cluster5-hero__line--body,
    .cluster5-hero__line--attribution {
      font-size: 15px;
      line-height: 21px;
    }
    .cluster5-hero__line--highlight {
      font-size: 17px;
      line-height: 23px;
    }
  }
`;

// Figma 기준: 동일 파일, node 1068:22958 ("Image" 프레임, 1333x595) — /cluster-5
// 두 번째 섹션("Keyword Map" 카드). authoritative source, 1068:22075 히어로와
// 별개 selection이며 억지로 이어붙이지 않고 새로 전체 분석했다.
//
// 꽃/파이 장식은 진짜 데이터 차트가 아니라 "모양은 고정, 숫자만 바뀌는"
// 고정 장식(Figma dev annotation 원문)이다. 그래서 기존 ApexCharts 패턴
// (components/home-career/BalanceChart.tsx)처럼 값 기반으로 각도를
// 계산하면 Figma 모양이 깨진다 — 대신 Figma가 export한 5개 꽃잎의 실제
// SVG path(base + 4겹 오버레이)를 그대로 추출해 inline <svg>로 재현했다.
//
// org 색상: 5장 꽃잎의 원본 fill(FAAB07/FFC242/FFCD66/FFDA8D/FFE9BC)을
// 직접 대조한 결과, 정확히 ORGANIZATION_CONFIG.marketing.themeColor(#FAAB07)
// 를 100%로 하고 흰색을 28/45/62/80/100% 섞은 5단계 톤 램프였다(직접 계산해
// 검증 — 각 스텝 RGB가 Figma 원본과 1~3 단위 오차로 일치). 새 color map을
// 만드는 대신 이 사실을 이용해 var(--cluster5-accent)에서 CSS color-mix()로
// 5단계를 그대로 유도한다 — 어떤 org 색상이 들어와도 동일 로직으로 자연스러운
// 톤 램프가 나온다. 카드 테두리·shadow·"Keyword Map" 라벨·타이틀 글로우도
// 전부 같은 --cluster5-accent/-soft 재사용(신규 하드코딩 없음).
//
// 좌표: Figma % inset(부모=1333x595 카드 기준)을 px로 환산해 정확한
// left/top을 얻었다(예: SvgjsG1625 inset 47.02%/68.08%/36.92%/24.77% →
// left=24.77%*1333=330.1px, top=47.02%*595=279.8px — SVG 파일 자체의
// width/height(96.431/96.576)와 대조해 검증 완료). 5개 꽃잎+숫자 5개를
// 하나의 "flower cluster" 서브컨테이너(270x270, 카드 기준 left:180/top:220)
// 로 묶어, 내부 상대좌표는 고정한 채 컨테이너 하나만 반응형에서 scale()
// 하는 방식을 썼다 — Figma의 "모양은 고정" 요구와 모바일 반응형을 동시에
// 만족시킨다.
//
// 흰 placeholder 박스는 Figma 주석("퍼블리싱 필요", "워드클라우드 라이브러리
// 삽입 예정")대로, 새 워드클라우드 라이브러리를 설치하지 않고 Figma가 보여준
// placeholder 상태 그대로 구현했다(불필요한 라이브러리 설치 금지 원칙).
//
// 배경 이미지는 Figma 임시 URL을 쓰지 않고 public/images/0/cluster5/
// KeywordMap-bg.png로 다운로드해 로컬 정적 자산으로 저장했다(Hero.png와
// 동일 컨벤션).
const keywordSectionStyles = `
  .cluster5-keyword {
    position: relative;
    /* [수정] 통계 바 패널(1068:22049, y 617~1308)이 이 카드 뒤로 파고들어야
       Figma 와 같은 겹침이 된다 — Figma z-order 상 패널이 먼저 그려진다.
       hero(z auto=0) 위에 그려지던 기존 순서는 그대로 유지된다. */
    z-index: 1;
    width: 100%;
    max-width: 1333px;
    margin: 0 auto;
    aspect-ratio: 1333 / 595;
    box-sizing: border-box;
    overflow: hidden;
    border-radius: 25px;
    border: 5px solid var(--cluster5-accent, #f7ba48);
    box-shadow: 0 10px 20px color-mix(in srgb, var(--cluster5-accent-soft, #ffe96b) 60%, transparent);
  }
  .cluster5-keyword__bg {
    position: absolute;
    inset: 0;
    background-image: url(/images/0/cluster5/KeywordMap-bg.png);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .cluster5-keyword__scrim {
    position: absolute;
    inset: 0;
    /* Figma: linear-gradient(to right, transparent 1.437%, rgba(0,0,0,0.5) 48.147%) — 중립(비-org) */
    background: linear-gradient(90deg, rgba(0, 0, 0, 0) 1.437%, rgba(0, 0, 0, 0.5) 48.147%);
  }

  .cluster5-keyword__title {
    position: absolute;
    left: 50%;
    top: 11.76%; /* 70px / 595px */
    transform: translate(-50%, -50%);
    margin: 0;
    width: 90%;
    text-align: center;
    /* [수정] 실측 결과 Lobster 가 아니라 Gungsuh 로 폴백되고 있었다 —
       원인/처방은 위 Khula 와 동일(next/font 실제 패밀리명 미매칭). */
    font-family: var(--lobster), "Lobster", cursive;
    font-weight: 400;
    font-size: 60px;
    line-height: 1.2;
    color: var(--white, #ffffff);
    text-shadow: 0 0 30px var(--cluster5-accent, #f7c848);
    /* nowrap 제거 이유는 히어로 타이틀과 동일 — 좁은 데스크톱 폭에서 실제
       텍스트 잘림 발생을 전수 감사에서 확인해 수정. */
    white-space: normal;
  }
  .cluster5-keyword__subtitle {
    position: absolute;
    left: 50%;
    top: 21.76%; /* 129.5px / 595px */
    transform: translate(-50%, -50%);
    margin: 0;
    width: 90%;
    text-align: center;
    font-family: "Cafe24Ohsquare", "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 30px;
    line-height: 1.5;
    color: var(--white, #ffffff);
    white-space: normal;
    word-break: keep-all;
  }

  /* ---- 꽃/파이 장식 — "모양은 고정, 숫자만 변경" (Figma dev annotation) ---- */
  .cluster5-keyword__flower {
    position: absolute;
    left: 13.5%; /* 180px / 1333px */
    top: 36.97%; /* 220px / 595px */
    width: 270px;
    height: 270px;
  }
  .cluster5-keyword__petal {
    position: absolute;
    display: block;
  }
  .cluster5-keyword__petal-base { fill: color-mix(in srgb, var(--cluster5-accent, #faab07) 28%, white); }
  .cluster5-keyword__petal-1 { fill: var(--cluster5-accent, #faab07); }
  .cluster5-keyword__petal-2 { fill: color-mix(in srgb, var(--cluster5-accent, #faab07) 80%, white); }
  .cluster5-keyword__petal-3 { fill: color-mix(in srgb, var(--cluster5-accent, #faab07) 62%, white); }
  .cluster5-keyword__petal-4 { fill: color-mix(in srgb, var(--cluster5-accent, #faab07) 45%, white); }
  .cluster5-keyword__petal-stroke { stroke: #010a07; }

  .cluster5-keyword__count {
    position: absolute;
    margin: 0;
    transform: translateY(-50%);
    /* [수정] 실측 결과 Gungsuh 로 폴백되고 있었다(문자열 "Black Ops One" 만으로는
       next/font 패밀리에 매칭되지 않음). Section 5 pill 과 동일하게 변수를 앞에 둔다. */
    font-family: var(--black-ops-one), "Black Ops One", cursive;
    font-weight: 400;
    font-size: 36px;
    line-height: 36px;
    color: #333;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ---- Keyword Map placeholder ---- */
  .cluster5-keyword__label {
    /* [정정] 이전에 넣었던 right:8.6% 근사값이 실제로는 폭을 82.67%~91.27%
       구간(약 113px)으로 강제로 좁혀 "Keyword Map"이 의도치 않게 2줄로
       줄바꿈되는 회귀를 유발했다(전수 감사에서 스크린샷으로 발견).
       Figma 원본은 right 제약이 없는 nowrap(콘텐츠 폭 그대로) 배치이고,
       "Keyword Map" 텍스트는 left:82.67% 지점부터 카드 우측 끝까지 여유
       있게 들어가므로(실측 폭 ~160px < 카드 우측까지 남은 공간) right
       제약 없이 nowrap으로 되돌리는 것이 정확하다. */
    position: absolute;
    left: 82.67%; /* 1102px / 1333px */
    top: 32.77%; /* 195px / 595px */
    transform: translateY(-50%);
    margin: 0;
    font-family: "Cafe24Ohsquare", "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 22px;
    color: var(--cluster5-accent, #f7ba48);
    white-space: nowrap;
  }
  .cluster5-keyword__placeholder {
    position: absolute;
    left: 54%; /* 720px / 1333px */
    top: 36.97%; /* 220px / 595px */
    width: 40%; /* 533px / 1333px */
    height: 50.42%; /* 300px / 595px */
    background: var(--white, #ffffff);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }
  .cluster5-keyword__placeholder-caption {
    margin: 0;
    font-family: "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 12px;
    line-height: 1.4;
    color: #000000;
    text-align: center;
  }

  /* ---- ≤1199.98px: 절대배치 해제, 자연스러운 flow 레이아웃으로 전환
     (히어로 섹션과 동일한 breakpoint·기법 재사용 — 새 디자인 언어 없음) ---- */
  @media only screen and (max-width: 1199.98px) {
    .cluster5-keyword {
      aspect-ratio: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 40px 24px;
      box-sizing: border-box;
    }
    .cluster5-keyword__title,
    .cluster5-keyword__subtitle {
      position: relative;
      left: auto;
      top: auto;
      transform: none;
      width: 100%;
      white-space: normal;
      word-break: keep-all;
    }
    .cluster5-keyword__title { font-size: 40px; }
    .cluster5-keyword__subtitle { font-size: 22px; }
    .cluster5-keyword__flower {
      position: relative;
      left: auto;
      top: auto;
      transform: scale(0.85);
      margin: -20px 0;
    }
    .cluster5-keyword__label {
      position: relative;
      left: auto;
      top: auto;
      transform: none;
      white-space: normal;
    }
    .cluster5-keyword__placeholder {
      position: relative;
      left: auto;
      top: auto;
      width: 100%;
      max-width: 480px;
      height: 220px;
    }
  }

  @media only screen and (max-width: 767.98px) {
    .cluster5-keyword__flower {
      transform: scale(0.68);
      margin: -44px 0;
    }
    .cluster5-keyword__title { font-size: 30px; }
    .cluster5-keyword__subtitle { font-size: 18px; }
    .cluster5-keyword__placeholder { height: 180px; }
  }
`;

// Figma 기준: 동일 파일, node 1068:22050 ("Frame 2121457686", 1026x117) —
// /cluster-5 세 번째 섹션(통계 바: 사회 명성도 총합 / 평판 카드 수 / 챔피언 수).
// authoritative source, 새로 전체 분석 후 구현했다(기존 구현에 억지로 이어붙이지
// 않음). 카드형이 아니라 순수 타이포그래피 통계 바라 기존 "카드/리스트" 패턴이
// 적용되지 않는 요소이며, 히어로·키워드맵 섹션에서 이미 확립한 --cluster5-accent
// 토큰과 Khula 폰트(히어로 타이틀에서 이미 로드 검증됨)를 그대로 재사용한다.
//
// org 색상: 라벨 텍스트·상단 포인트 바 색상이 Figma 원본에서 정확히
// #FAAB07(=ORGANIZATION_CONFIG.marketing.themeColor)였다 — 새 토큰 없이
// var(--cluster5-accent) 재사용. 숫자·구분선(흰색)은 중립 요소로 공통 유지.
// [수정 — 전체 페이지 프레임(1068:22043) 대조에서 발견]
// 통계 바는 단독으로 떠 있는 요소가 아니라, 그 뒤에 깔린 라운드 패널
// 1068:22049("Image", rounded-rectangle, (2, 616.97) 1328x690.769) 위에 얹혀
// 있었다. 이 패널은 짙은 네이비 배경 + 좌측 얇은 민트 곡선 2줄 + 우측 굵은
// 민트 그라디언트 스우시가 들어간 이미지 fill 이며, 하단 모서리만 둥글고
// 그 바닥선(y=1307.77)에 org accent 구분선(1168x2, #FAAB07)이 붙는다.
// 기존 구현은 이 패널과 구분선을 통째로 빠뜨려 통계 바가 맨 검정 배경 위에
// 떠 있었다.
//
// 패널 상단(617~1047)은 Keyword Map 카드(1068:22958, 452~1047) 뒤에 완전히
// 가려진다(z-order: 패널이 먼저 그려짐). 그래서 패널 박스 자체는 Figma
// 프레임 그대로 두고 음수 margin 으로 카드 뒤로 밀어 넣은 뒤, 카드에
// z-index:1 을 줘 Figma 와 동일한 겹침 순서를 만든다. 모든 치수는 %/
// aspect-ratio 라 컬럼 폭이 변해도 배경·리본·구분선이 함께 축소된다.
//
// 항목 분포도 함께 바로잡았다. Figma 원본의 세 VerticalBorder 는 컨테이너
// (152.29, 1131) 1026.05 안에서 x=0 / 406.28 / 858.66 에 놓여 있어 실제로는
// 페이지 폭 전체에 넓게 퍼져 있는데, 기존 구현은 max-width 1075 + gap 48 로
// 가운데 뭉쳐 있었다. 패널 기준 상대값(11.32% / 41.91% / 75.98%)으로 고정한다.
const statsSectionStyles = `
  .cluster5-statspanel {
    position: relative;
    z-index: 0;
    width: 99.4757%; /* 1328px / 1335px */
    max-width: 1328px;
    /* 패널 top(617) 은 Keyword Map 카드 bottom(1047) 보다 430px 위 →
       음수 margin 으로 카드 뒤에 밀어 넣는다. %는 컨테이너 폭 기준이라
       컬럼이 좁아져도 같은 비율로 유지된다(430 / 1335). */
    margin: -32.2097% auto 0;
    aspect-ratio: 1328 / 690.769;
    box-sizing: border-box;
    /* 통계 바 top(1131) - 패널 top(617) = 514px → 패널 폭(1328) 대비 38.7048% */
    padding-top: 38.7048%;
    border-radius: 0 0 1.8072% 1.8072% / 0 0 3.4743% 3.4743%; /* 24px */
    background-color: #1a1e2a;
    background-image: url(/images/0/cluster5/StatsPanel-bg.png);
    background-repeat: no-repeat;
    /* Figma: left -0.67% / width 101.34% / height 100% (비균등 stretch) */
    background-size: 101.34% 100%;
    background-position: -0.67% 0;
  }
  .cluster5-statspanel__rule {
    /* Figma Vector(1084:1820) — 패널 바닥선에 걸친 1168x2 stroke #FAAB07 */
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 87.9518%; /* 1168px / 1328px */
    height: 2px;
    background: var(--cluster5-accent, #faab07);
  }

  .cluster5-stats {
    display: grid;
    /* Figma 실측 항목 시작점(패널 좌표): 150.29 / 556.57 / 1008.95 of 1328.
       ⚠ grid-template-columns 의 %는 padding 을 제외한 content box(1328-150.29
       =1177.71) 기준으로 풀린다 — 패널 폭 기준으로 적었다가 2·3번 항목이 각각
       45px / 96px 왼쪽으로 밀리는 것을 accent 바 픽셀 실측으로 확인해 교정. */
    grid-template-columns: 34.4977% 38.4122% auto;
    align-items: center;
    width: 100%;
    padding-left: 11.3170%;
    box-sizing: border-box;
  }
  .cluster5-stats__item {
    position: relative;
    min-width: 0;
    padding-left: 32px;
    border-left: 1px solid var(--white, #ffffff);
  }
  .cluster5-stats__item::before {
    /* Figma: 테두리 상단에 겹쳐진 3px 폭, 64px 높이의 org accent 포인트 바 */
    content: "";
    position: absolute;
    left: -2px;
    top: 0;
    width: 3px;
    height: 64px;
    background: var(--cluster5-accent, #faab07);
  }
  .cluster5-stats__value {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 0;
    white-space: nowrap;
  }
  .cluster5-stats__number {
    font-family: var(--khula), "Khula", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 64px;
    line-height: 1;
    color: var(--white, #ffffff);
  }
  .cluster5-stats__unit {
    font-family: var(--khula), "Khula", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 36px;
    line-height: 1;
    color: var(--white, #ffffff);
    text-transform: uppercase;
  }
  .cluster5-stats__label {
    margin: 8px 0 0 0;
    font-family: var(--khula), "Khula", "Pretendard", sans-serif;
    font-weight: 600;
    font-size: 20px;
    line-height: 34px;
    color: var(--cluster5-accent, #faab07);
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media only screen and (max-width: 1199.98px) {
    /* 좁은 구간에서는 패널의 Figma 고정 비율(aspect-ratio + 38.7% padding)이
       과도한 여백을 만들므로 해제하고, 겹침(음수 margin)도 풀어 일반 흐름으로
       되돌린다. 배경 리본은 cover 로 유지 — 다른 섹션의 반응형 원칙과 동일. */
    .cluster5-statspanel {
      width: 100%;
      max-width: 100%;
      margin-top: 0;
      aspect-ratio: auto;
      padding: 48px 0 40px;
      border-radius: 0 0 24px 24px;
      background-size: cover;
      background-position: center bottom;
    }
    .cluster5-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 40px 32px;
      padding: 0 24px;
    }
    .cluster5-stats__number { font-size: 48px; }
    .cluster5-stats__unit { font-size: 26px; }
    .cluster5-stats__label { font-size: 16px; }
  }

  @media only screen and (max-width: 575.98px) {
    .cluster5-stats {
      flex-direction: column;
      align-items: flex-start;
      gap: 28px;
    }
    .cluster5-stats__label { white-space: normal; }
  }
`;

const CLUSTER5_STATS = [
  { key: "fm", number: "100,000", unit: "FM", label: "사회 명성도_Total Society" },
  { key: "comment", number: "34", unit: "Comment", label: "평판 카드 수" },
  { key: "champions", number: "0", unit: "k+", label: "Champions" },
] as const;

// 꽃잎 SVG path — Figma export 원본 그대로(모양 고정), 좌표만 flower 서브
// 컨테이너(270x270, 카드 기준 left:180px/top:220px) 상대값으로 환산.
const KEYWORD_PETALS = [
  {
    key: "base",
    className: "cluster5-keyword__petal-base",
    left: 2.6,
    top: 7,
    width: 148.615,
    height: 149.322,
    viewBox: "0 0 148.615 149.322",
    d: "M0.637538 103.501C10.7555 73.5665 30.4707 47.4791 56.9582 28.9764C83.4456 10.4738 115.346 0.505577 148.088 0.500084L148.115 146.836C148.115 148.2 146.766 149.143 145.417 148.721L0.637538 103.501Z",
  },
  {
    key: "1",
    className: "cluster5-keyword__petal-1",
    left: 150.1,
    top: 59.8,
    width: 96.431,
    height: 96.5762,
    viewBox: "0 0 96.431 96.5762",
    d: "M0.5 0.5C21.6596 0.5 42.2761 6.93936 59.3946 18.8952C76.5131 30.851 89.2548 47.7094 95.7935 67.0543L3.19879 95.9754C1.84939 96.3969 0.5 95.4544 0.5 94.0905V0.5Z",
  },
  {
    key: "2",
    className: "cluster5-keyword__petal-2",
    left: 151.4,
    top: 122.8,
    width: 111.862,
    height: 121.816,
    viewBox: "0 0 111.862 121.816",
    d: "M105.875 0.622909C113.192 22.2708 113.192 45.5897 105.875 67.2376C98.5575 88.8854 84.2989 107.751 65.1425 121.13L0.904608 36.1371C0.0706301 35.0337 0.586042 33.5088 1.93545 33.0873L105.875 0.622909Z",
  },
  {
    key: "3",
    className: "cluster5-keyword__petal-3",
    left: 77.3,
    top: 157.5,
    width: 147.258,
    height: 118.872,
    viewBox: "0 0 147.258 118.872",
    d: "M146.546 95.597C125.352 110.399 99.8267 118.372 73.629 118.372C47.4314 118.372 21.9062 110.399 0.711902 95.597L71.9611 1.32757C72.7951 0.224142 74.463 0.224142 75.297 1.32757L146.546 95.597Z",
  },
  {
    key: "4",
    className: "cluster5-keyword__petal-4",
    left: 11.9,
    top: 115,
    width: 138.105,
    height: 150.019,
    viewBox: "0 0 138.105 150.019",
    d: "M57.5373 149.334C33.8975 132.823 16.3018 109.543 7.27221 82.8283C-1.7574 56.1139 -1.7574 27.3373 7.27221 0.622909L136.169 40.8826C137.519 41.3041 138.034 42.829 137.2 43.9324L57.5373 149.334Z",
  },
] as const;

// 숫자 라벨 — Figma 절대좌표를 flower 서브컨테이너 상대값(원본 - left180/top220)으로 환산.
// "단위 없이 숫자만" 표기가 의도된 디자인(Figma dev annotation 원문 유지).
const KEYWORD_COUNTS = [
  { key: "14", value: "14", left: 68.77, top: 75.61 },
  { key: "8", value: "8", left: 58.77, top: 178.61 },
  { key: "6", value: "6", left: 138.77, top: 230.61 },
  { key: "4", value: "4", left: 208.77, top: 175.61 },
  { key: "2", value: "2", left: 176.77, top: 111.61 },
] as const;

// 섹션 간 간격 — [정정, 이전 값 폐기] 이전 구현은 cluster-2의
// .section1-description → .cluster2-top-frame 간격(169.4px)을 히어로↔
// Keyword Map, Keyword Map↔통계 바 두 곳 모두에 그대로 재사용했으나, 이는
// "비교 가능한 선례가 없을 때의 대체값"이었을 뿐이다. 이번 전수 감사에서
// node 1068:22043("Frame 633", 전체 페이지, 1336x9718)을 새로 확보해
// 히어로(1068:22075)·Keyword Map(1068:22958)·통계 바(1068:22050)가 모두
// 동일 부모(1068:22048)의 직계 자식이라는 사실을 확인했다 — 즉 세 섹션의
// y좌표가 실제로 같은 좌표계에 있어 직접 비교 가능하다(이전엔 이 상위
// 프레임을 몰라 신뢰할 수 없다고 판단했었다):
//   히어로      y=0,    h=482  → bottom=482
//   Keyword Map y=452,  h=595  → top=452   (히어로 바닥보다 30px 위 = 30px 오버랩)
//   통계 바     y=1131, h=117  → Keyword Map 바닥(1047) 대비 gap=84px
// Figma 스크린샷(전체 페이지 상단 크롭)으로도 히어로→Keyword Map은 거의
// 맞닿아 있고(사실상 오버랩), Keyword Map→통계 바는 작은 간격만 있음을
// 육안으로 재확인했다. "Figma가 의도적으로 다른 간격을 쓰는 부분은 Figma를
// 우선"이라는 지침에 따라 cluster-2 대체값 대신 이 실측 좌표를 채택한다.
// ≤1199.98px(flow 레이아웃 전환 구간)에서는 오버랩 마진이 접힌 카드 순서와
// 충돌할 수 있어 작은 양수 gap으로 대체한다(Figma는 이 구간에 대한 반응형
// 스펙이 없으므로 자연스러운 값으로 대체 — 사용자 지침 상 "모바일은 자연스럽게
// 반응형" 원칙 적용).
// Figma 기준: 동일 파일, node 1068:24527("Frame 2121457577", 1335x1170) —
// /cluster-5 네 번째 섹션(전체 배경 사진 카드 + 우측 상단 아이콘 버튼 2개).
// authoritative source, 새로 전체 분석 후 구현했다. get_metadata로 이
// 노드의 상위 프레임 정보는 조회되지 않아(세션 사이 Figma 파일이 갱신되며
// 새로 추가된 노드로 추정 — 직전 감사에서 저장해 둔 전체 페이지 트리에
// 이 id가 없음을 확인) 간격은 사용자 지침대로 기존 3개 섹션에서 이미
// 실측 확정한 리듬(-30/84px 패턴)에 맞춰 자연스럽게 이어지도록 정했다.
//
// 레이어 구조: 배경 이미지 + 검정 0.7 스크림(히어로·Keyword Map과 동일
// 중립 패턴, border/shadow 없음 — Figma에 rounded-corner/stroke 클래스가
// 없어 사각 모서리 그대로) + 우측 상단 원형 아이콘 버튼 2개(연필 "수정",
// 돋보기 "검색/보기" — 둘 다 Figma 아이콘 배경색이 정확히
// ORGANIZATION_CONFIG.marketing.themeColor(#FAAB07)와 일치해 var(--cluster5-accent)
// 재사용). 아이콘은 실제 동작이 연결된 버튼이 아니라 Figma의 정적 시각
// 요소이므로(API/데이터 조회 수정 금지 원칙상 새 인터랙션을 만들지 않음)
// 순수 장식(button이 아닌 aria-hidden div)으로 구현했다.
// [중대 정정 — 구조] 이전 구현은 배너(1068:24527)와 "The Best TOP 3"
// 헤더(1068:24533)를 각각 독립 섹션으로 세로로 쌓았다(배너 아래 84px gap).
// 이번에 상위 노드 1068:24526("Group 2121454081", 1346x1170)를 찾아내
// 실제 구성이 전혀 다름을 확인했다 — 배너는 독립 섹션이 아니라 이 그룹의
// **배경**이고, 헤더/카드가 그 위에 겹쳐 얹히는 오버레이 합성이다:
//   Group 2121454081        (481,1476) 1346x1170  ← 실제 섹션 단위
//     ├ Frame 2121457577    (492,1476) 1335x1170  offset( 11,   0) 배경 배너
//     ├ Container(TOP 3)    (481,1523) 1346x 160  offset(  0,  47) 헤더 오버레이
//     ├ Container(카드 캐러셀)(481,1829) 1346x 691  offset(  0, 353) ※ 미구현
//     └ Component 5(중앙 큰 카드)(874,1829) 561x690 offset(393, 353) ※ 미구현
// get_screenshot으로 그룹 전체를 렌더해 육안 확인까지 마쳤다. 즉 기존
// 구현은 "1170px짜리 빈 사진 + 그 아래 텍스트"로 보였고, Figma는 "사진을
// 배경으로 깔고 그 위에 헤더와 카드가 얹힌" 형태였다 — 사용자가 지적한
// "Section 4가 Figma와 다르다"의 진짜 원인이 바로 이것이다.
// 아래 % 값은 전부 그룹(1346x1170) 기준 실측 환산값이다.
const galleryBannerSectionStyles = `
  .cluster5-showcase {
    position: relative;
    width: 100%;
    max-width: 1346px;
    margin: 0 auto;
    aspect-ratio: 1346 / 1170;
    box-sizing: border-box;
    /* 카드 내부 치수를 cqw로 쓰기 위한 컨테이너 선언. 그룹이 aspect-ratio로
       가로세로 동일 배율로만 축소되므로 px -> cqw 환산(px / 1346 * 100)이
       가로/세로 양축 모두에 그대로 성립한다. 이렇게 하면 이전 아이콘 버그
       (고정 px가 스케일을 안 받아 9% 크게 렌더)가 카드에서 재발하지 않는다. */
    container-type: inline-size;
  }
  .cluster5-gallery {
    position: absolute;
    left: 0.8172%; /* 11px / 1346px */
    top: 0;
    width: 99.1828%; /* 1335px / 1346px */
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  .cluster5-gallery__bg {
    position: absolute;
    inset: 0;
    background-image: url(/images/0/cluster5/CardBanner-bg.png);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .cluster5-gallery__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
  }
  .cluster5-gallery__actions {
    /* [정정] 이전 구현은 이 컨테이너를 auto-width로 두고 자식(icon-btn)에
       고정 px(22px, gap 5px)를 줬다 — .cluster5-gallery는 aspect-ratio로
       모든 폭에서 비율대로 축소되는데, 아이콘만 고정 px라 실제 렌더
       폭(예: 사이드바 있는 1920뷰포트=1236px, 스케일 92.58%)에서 Figma
       대비 아이콘 뭉치가 더 크게 나오는 실측 버그가 있었다. get_screenshot로
       Figma 노드를 브라우저와 동일 픽셀 크기(1236x1084)로 받아 sharp로
       직접 픽셀 diff를 뜬 결과 아이콘 2개+gap의 bounding box가 Figma
       45x20px 대비 브라우저 49x22px로 실측 9% 더 컸다(고정 22px/gap 5px가
       스케일을 전혀 안 받았기 때문). 이제 이 컨테이너 자체를 Figma 실측
       (get_metadata node 1068:24528, "Frame 2121457272") 크기인
       49px/22px를 %로 박아 넣어(w=49/1335, h=22/1170) 자식 icon-btn이
       그 안에서 다시 %로 스케일되게 했다 — 이렇게 하면 aspect-ratio
       컨테이너가 줄어들 때 아이콘도 같은 비율로 함께 줄어든다. */
    position: absolute;
    left: 92.9588%; /* 1241px / 1335px */
    top: 2.1368%; /* 25px / 1170px */
    width: 3.6704%; /* 49px / 1335px — Figma "Frame 2121457272" 실측 폭 */
    height: 1.8803%; /* 22px / 1170px — 위 프레임 실측 높이 */
    display: flex;
    align-items: center;
    gap: 10.2041%; /* 5px / 49px — actions 폭 기준 상대 gap */
  }
  .cluster5-gallery__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44.898%; /* 22px / 49px(actions 폭) */
    height: 100%; /* actions 높이(=22px 상당)를 그대로 채움 */
    border-radius: 50%; /* 50px 고정 대신 %로 — 크기가 줄어도 항상 완전한 원 */
    background: var(--cluster5-accent, #faab07);
    backdrop-filter: blur(2.5px);
    -webkit-backdrop-filter: blur(2.5px);
    flex-shrink: 0;
  }
  .cluster5-gallery__icon-btn svg {
    width: 72.7273%; /* 16px / 22px */
    height: 72.7273%;
  }
  /* 데스크톱은 aspect-ratio 컨테이너 + 위 %체인 덕분에 아이콘까지 포함해
     전체가 비율 그대로 자연스럽게 축소된다. 다만 ≤1199.98px에서는 오버레이
     헤더(고정 px 타이포)가 배너 위에서 넘칠 수 있어 아래에서 절대배치를
     해제하고 배너→헤더 flow 순서로 전환한다(Figma에 모바일 스펙이 없어
     "모바일은 자연스럽게 반응형" 원칙 적용 — 히어로/Keyword Map과 동일 기법). */
  @media only screen and (max-width: 1199.98px) {
    .cluster5-showcase {
      aspect-ratio: auto;
      display: flex;
      flex-direction: column;
    }
    .cluster5-gallery {
      position: relative;
      left: auto;
      top: auto;
      width: 100%;
      height: auto;
      aspect-ratio: 1335 / 1170;
    }
  }
`;

// Figma 기준: 동일 파일, node 1068:24533("Container", 1346x160) — /cluster-5
// 다섯 번째 섹션(다음 섹션 CTA 헤더: "The Best TOP 3" + 3줄 설명 + 버튼 2개).
// authoritative source, 새로 전체 분석 후 구현했다. get_metadata로 상위
// 프레임을 조회했으나 gallery(1068:24527)와 마찬가지로 이 노드도 기존에
// 확보해 둔 전체 페이지 트리(1068:22048, Frame 633)의 하위에 없었다 — 두
// 노드의 raw x좌표(481/492)가 Frame 633의 실제 폭(1336px)을 초과해 서로
// 다른(또는 아직 트리 스냅샷에 없는) 상위 프레임에 속함을 확인, 신뢰
// 가능한 상대좌표를 얻을 수 없었다. 사용자 지침대로 기존 4개 섹션에서
// 이미 실측 확정한 간격 리듬(84px)을 그대로 이어 자연스럽게 배치했다.
//
// 레이어 구조: 배경/카드 없이 텍스트+버튼만 있는 투명 섹션(px-15 패딩,
// 세로 flex, gap-20 중앙 정렬) — 히어로/Keyword Map/갤러리와 달리 이
// 섹션 자체는 배경 이미지나 카드 컨테이너가 없다.
//   - 타이틀 "The Best TOP 3": Manrope ExtraBold 800, 54px/74px, 흰색,
//     capitalize. Manrope 800은 _cluster3.scss가 이미 전역 로드
//     (`@import ...family=Manrope:wght@800`) 중이라 추가 네트워크 비용 0.
//   - 설명 3줄: Pretendard Regular 16px/22px, rgba(255,255,255,0.53),
//     최대 폭 730px, 중앙 정렬. 히어로 본문과 동일하게 <br/>로 명시적
//     줄바꿈을 재현했다(원본 텍스트가 3개의 개별 <p> 줄로 분리되어 있음).
//   - 버튼 2개: "Discover more"(배경 #ddf247, 라임그린) / "All collections
//     3"(배경 흰색) — 둘 다 텍스트는 Manrope 800 14px, 색상 #161616.
//     get_variable_defs로 확인한 결과 #ddf247은 어떤 디자인 변수에도
//     매핑되어 있지 않은 이 컴포지션 고유의 고정 브랜드 색상이며, 3개 org
//     accent(FAAB07/FF4B70/1E9503) 중 어느 것과도 대응하지 않는다 — 즉
//     org 반응형 요소가 아니므로 var(--cluster5-accent)로 치환하지 않고
//     Figma 원본 그대로 하드코딩했다(이 섹션은 org 무관 공통 요소로만
//     구성되어 있어 style={orgVars}도 부여하지 않음).
//   - 두 버튼은 실제 목적지(전체 컬렉션 페이지 등)가 이 앱의 라우팅에
//     정의되어 있지 않아, 갤러리 섹션의 아이콘 버튼과 동일한 이유로
//     (API/라우팅 변경 금지 원칙) <a>/<button>이 아닌 순수 시각 요소로
//     구현했다 — 다만 텍스트 자체는 실제로 읽히는 콘텐츠이므로
//     aria-hidden은 주지 않았다(아이콘과 달리 장식이 아님).
//   - 좁은 화면에서 두 버튼(190px×2 + gap)이 겹치지 않도록 flex-wrap을
//     추가했다(Figma에 없는 방어적 추가, 모바일 자연 반응형 원칙).
const top3SectionStyles = `
  .cluster5-top3 {
    /* [정정] 독립 섹션이 아니라 .cluster5-showcase(=Figma Group 2121454081)
       안에서 배너 위에 겹쳐지는 오버레이다. Figma offset (0, 47) 기준. */
    position: absolute;
    left: 0;
    top: 4.0171%; /* 47px / 1170px */
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 0 1.1144cqw;
    box-sizing: border-box;
    text-align: center;
  }
  /* [정정] 타이포를 고정 px로 두면 aspect-ratio 그룹이 축소될 때 헤더만
     스케일을 안 받아 요소마다 아래로 밀린다(1236px 폭 실측 기준 블록당
     +6px 누적 → Figma diff에서 텍스트가 이중으로 보이는 원인이었다).
     아이콘·카드와 동일하게 cqw(px / 1346 * 100)로 통일한다. */
  .cluster5-top3__title {
    margin: 0;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 4.0119cqw; /* 54px */
    line-height: 5.4978cqw; /* 74px */
    color: var(--white, #ffffff);
    text-transform: capitalize;
  }
  .cluster5-top3__subtitle {
    margin: 1.4859cqw 0 0;
    max-width: 54.2348cqw; /* 730px */
    font-family: "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 1.1887cqw; /* 16px */
    line-height: 1.6345cqw; /* 22px */
    color: rgba(255, 255, 255, 0.53);
  }
  .cluster5-top3__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 2.2288cqw; /* 30px */
    margin-top: 2.9718cqw; /* 40px */
  }
  .cluster5-top3__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14.1159cqw; /* 190px */
    height: 3.7147cqw; /* 50px */
    border-radius: 0.8915cqw; /* 12px */
    box-sizing: border-box;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 1.0401cqw; /* 14px */
    line-height: 1.0401cqw;
    color: #161616;
    text-transform: capitalize;
  }
  .cluster5-top3__btn--primary {
    background: #ddf247;
  }
  .cluster5-top3__btn--secondary {
    background: var(--white, #ffffff);
  }

  @media only screen and (max-width: 1199.98px) {
    /* 오버레이 해제 — 배너 아래 일반 흐름으로 내려온다(위 showcase 규칙과 짝).
       데스크톱에서 cqw로 바꾼 값들도 이 구간에서는 전부 px로 되돌린다
       (좁은 폭에서 cqw는 글자를 읽을 수 없을 만큼 작아지기 때문). */
    .cluster5-top3 {
      position: relative;
      top: auto;
      margin-top: 48px;
      padding: 0 20px;
    }
    .cluster5-top3__title {
      font-size: 40px;
      line-height: 52px;
    }
    .cluster5-top3__subtitle {
      margin-top: 20px;
      max-width: 730px;
      font-size: 16px;
      line-height: 22px;
    }
    .cluster5-top3__actions {
      gap: 20px;
      margin-top: 32px;
    }
    .cluster5-top3__btn {
      width: 190px;
      height: 50px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 14px;
    }
  }

  @media only screen and (max-width: 575.98px) {
    .cluster5-top3__title {
      font-size: 28px;
      line-height: 36px;
    }
    .cluster5-top3__subtitle {
      font-size: 14px;
      line-height: 20px;
    }
    .cluster5-top3__actions {
      gap: 16px 12px;
    }
  }
`;

// Figma 기준: 동일 파일, node 1068:24543("Container", 1346x691, 그룹 offset
// (0,353)) + 형제 노드 1068:24734("Component 5", 561x690, 그룹 offset
// (393,353)) — Section 4 그룹의 마지막 구성요소인 "The Best TOP 3" 평판 카드
// 캐러셀. 1068:24543 안에는 좌/우 사이드 카드 2장만 있고 가운데 큰 카드는
// 별도 형제 노드라, 둘을 함께 구현해야 Figma 합성이 완성된다.
//
// 좌표는 Figma 메타데이터(중첩 offset 누적)와 실제 렌더 PNG 픽셀 스캔을
// 교차 검증해 확정했다. 픽셀 스캔 결과 좌측 카드는 x 25~435(폭 411),
// 우측 카드는 x 934~1330(폭 397)로 서로 폭이 달랐는데, 이는 두 카드 모두
// 410.43px짜리 Component 5이지만 우측 카드가 부모 Container(1316px, 그룹
// x 15~1331)에 의해 잘리기 때문이다 — 그래서 아래에서 .cluster5-cardrow에
// overflow:hidden 클립 박스를 두어 동일한 잘림을 재현한다.
//
// 색상 정책: 화살표 버튼 배경 #FAAB07만 ORGANIZATION_CONFIG.marketing.
// themeColor와 정확히 일치하므로 var(--cluster5-accent)로 치환한다. 별점
// #F7BA48, 등급 배지 #45F882, 해시태그 #00FFBE/#EBF748, 명성도 아이콘
// #FFE3AA는 어느 org 색상과도 대응하지 않는 이 컴포지션 고유값이라
// TOP3 버튼 #DDF247과 동일하게 하드코딩 유지한다(억지 org 반응형 금지).
//
// 데이터: 히어로/통계 바/키워드맵과 동일하게 Figma placeholder 그대로의
// 정적 마크업이다. 평판 API/DTO를 새로 연결하지 않는다(데이터 조회 로직
// 변경 금지 원칙 — 실데이터 연동은 별도 지시가 있을 때 진행).
//
// [폰트 실측 — 중요] CDP CSS.getPlatformFontsForNode로 "선언된 폰트"가 아닌
// "실제 렌더된 폰트"를 확인한 결과:
//   - Rajdhani: next/font/google로 로드되지만 실제 패밀리명이
//     `__Rajdhani_6184ad`(CSS 변수 --rajdhani)라서 `"Rajdhani"` 문자열로는
//     매칭되지 않고 Malgun Gothic으로 폴백됐다. 그래서 var(--rajdhani)를
//     먼저 두고 문자열을 폴백으로 남긴다(앱 내 기존 "Rajdhani" 선언들도
//     동일한 잠재 이슈지만 그건 이 작업 범위 밖이라 건드리지 않는다).
//   - Pretendard / Manrope: 이 앱은 두 폰트를 실제로 로드하지 않는다
//     (Pretendard는 _cluster4-week.scss에 이미 문서화된 앱 전역 이슈,
//     Manrope는 _cluster3.scss의 @import가 실행되지 않아 요청 자체가 없음).
//     둘 다 Malgun Gothic으로 폴백되며, 이것이 Figma 대비 한글 텍스트 폭이
//     넓게 나오는 유일한 잔여 원인이다. 웹폰트 신규 로드는 앱 전역 서체를
//     바꾸는 변경이라 지시 없이 진행하지 않는다.
//   - document.fonts.check()는 이 3개 폰트에 대해 전부 true를 반환했지만
//     실제 렌더 폰트는 Malgun Gothic이었다 — check()만으로 폰트 적용을
//     판정하면 안 된다(위양성).
const top3CardsSectionStyles = `
  /* ---- 카드 행 클립 박스 (Figma Container 1068:24544, 그룹 (15,393.5) 1316x610) ---- */
  .cluster5-cardrow {
    position: absolute;
    left: 1.1144cqw;
    top: 29.2348cqw;
    width: 97.7712cqw;
    height: 45.3195cqw;
    overflow: hidden;
    z-index: 1;
  }

  /* ---- 카드 공통 ---- */
  .c5card {
    position: absolute;
    box-sizing: border-box;
    background: #1e1e1e;
    overflow: hidden;
    font-synthesis: none;
  }
  .c5card--side {
    top: 2.9703cqw;
    width: 30.4926cqw; /* 410.43px */
    height: 37.4473cqw; /* 504.04px */
    border-radius: 2.2288cqw; /* 30px */
    box-shadow: 0 0.3715cqw 2.2288cqw #0a0a0a;
  }
  .c5card--left { left: 0.76cqw; }
  .c5card--right { left: 68.2935cqw; }
  .c5card--center {
    position: absolute;
    left: 29.1976cqw;
    top: 26.2259cqw;
    width: 41.679cqw; /* 561px */
    height: 51.263cqw; /* 690px */
    border-radius: 1.1887cqw; /* 16px */
    box-shadow: 0 0.3715cqw 2.2288cqw #0a0a0a;
    z-index: 2;
  }

  .c5card__img {
    position: absolute;
    display: block;
    object-fit: cover;
  }
  .c5card--side .c5card__img {
    left: 0;
    top: 0;
    width: 29.4948cqw; /* 397px */
    height: 45.6909cqw; /* 615px — 카드(504)보다 커서 아래가 잘린다(Figma 동일) */
  }
  .c5card--center .c5card__img {
    inset: 0;
    width: 100%;
    height: 100%;
    /* Figma: 이미지를 높이 127.8%로 늘리고 top -0.84% — cover + 상단 근접
       object-position(3%)이 동일 결과(원본 829x1305 -> 커버 시 883px). */
    object-position: 50% 3%;
  }

  /* ---- 날짜 배지 (좌상단 pill) ---- */
  .c5card__date {
    position: absolute;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    border-radius: 9999px;
    color: #ffffff;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    white-space: nowrap;
  }
  .c5card--side .c5card__date {
    left: 1.766cqw;
    top: 0.9673cqw;
    height: 1.9316cqw;
    padding: 0 0.7429cqw;
    font-size: 0.8915cqw;
    line-height: 0.6686cqw;
  }
  .c5card--center .c5card__date {
    left: 1.4859cqw;
    top: 1.4859cqw;
    height: 2.2288cqw;
    padding: 0 0.7429cqw;
    font-size: 1.3373cqw;
    line-height: 1.3373cqw;
  }

  /* ---- 등급 배지 (우상단 검정 박스) ---- */
  .c5card__cat {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    background: #000000;
    border: 1px solid #414141;
    border-radius: 0.2972cqw;
    filter: drop-shadow(0 0.2972cqw 0.1858cqw rgba(255, 255, 255, 0.25));
    color: #45f882;
    font-family: "Pretendard", sans-serif;
    font-weight: 400;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .c5card--side .c5card__cat {
    padding: 0.1486cqw 0.8172cqw;
    font-size: 1.1144cqw;
    line-height: 1.7831cqw;
  }
  .c5card--left .c5card__cat { left: 19.5966cqw; top: 1.1159cqw; }
  .c5card--right .c5card__cat { left: 21.6025cqw; top: 0.821cqw; }
  .c5card--center .c5card__cat {
    left: 30.3863cqw;
    top: 1.4859cqw;
    padding: 0.2972cqw 0.8172cqw;
    font-size: 1.3373cqw;
    line-height: 1.7831cqw;
  }

  /* ---- 하단 정보 패널 ---- */
  .c5card__panel {
    position: absolute;
    left: 0;
    bottom: 0;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    border-bottom-left-radius: 1.1887cqw;
    border-bottom-right-radius: 1.1887cqw;
  }
  .c5card--side .c5card__panel {
    width: 29.4948cqw; /* 397px */
    height: 13.2244cqw; /* 178px */
    padding: 0.8172cqw 1.1887cqw 1.4859cqw 0.7429cqw;
  }
  .c5card--center .c5card__panel {
    width: 100%;
    height: 14.7103cqw; /* 198px */
    padding: 1.1144cqw 1.1887cqw 1.4859cqw 1.1144cqw;
  }

  /* 프로필 행 (아바타 + 2줄 신원 정보) */
  .c5card__profile {
    display: flex;
    align-items: center;
    gap: 0.7429cqw;
  }
  .c5card__avatar {
    display: block;
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
  }
  .c5card--side .c5card__avatar { width: 2.9718cqw; height: 2.9718cqw; }
  .c5card--center .c5card__avatar { width: 3.7147cqw; height: 3.7147cqw; }
  .c5card__ident {
    display: flex;
    flex-direction: column;
    gap: 0.2229cqw;
    color: #ffffff;
    font-family: "Pretendard", sans-serif;
  }
  .c5card__idrow {
    display: flex;
    align-items: flex-start;
    margin: 0;
    white-space: nowrap;
    line-height: 1.4116cqw;
    /* font-family를 부모(.c5card__ident) 상속에 맡기면 안 된다 — 이 요소는
       <p>라서 전역 스타일시트의 엘리먼트 선택자(p{...})가 상속값을 이겨
       Khula로 렌더된다(CDP CSS.getPlatformFontsForNode로 확인). 클래스
       선택자로 직접 지정해 특정성을 확보한다. */
    font-family: "Pretendard", sans-serif;
  }
  .c5card--side .c5card__idrow { gap: 0.2229cqw; }
  .c5card--center .c5card__idrow { gap: 0.3715cqw; }
  .c5card--side .c5card__idrow { font-size: 0.8915cqw; }
  .c5card--center .c5card__idrow { font-size: 1.1887cqw; }
  .c5card__sep {
    font-size: 1.0401cqw;
    font-weight: 400;
  }
  .c5card__b { font-weight: 700; }
  .c5card__m { font-weight: 500; }
  .c5card__r { font-weight: 400; }

  /* 별점 행 */
  .c5card__stars {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 0.7429cqw;
    left: 1.0401cqw;
    height: 1.3373cqw;
  }
  .c5card--side .c5card__stars { top: 4.7548cqw; }
  .c5card--center .c5card__stars { top: 6.0178cqw; }
  .c5card__starset {
    display: flex;
    align-items: flex-start;
    gap: 0.2972cqw;
  }
  .c5card__star {
    display: block;
    width: 0.9443cqw;
    height: 1.3373cqw;
    flex-shrink: 0;
  }
  .c5card__score {
    padding-left: 0.2972cqw;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.3373cqw;
    white-space: nowrap;
  }
  .c5card--side .c5card__score {
    font-family: var(--rajdhani), "Rajdhani", sans-serif;
    font-size: 0.8915cqw;
    letter-spacing: 0.0523cqw;
  }
  .c5card--center .c5card__score {
    font-family: "Pretendard", sans-serif;
    font-size: 0.8915cqw;
  }

  /* 해시태그 칩 */
  .c5card__tags {
    position: absolute;
    display: flex;
    align-items: flex-start;
  }
  .c5card--side .c5card__tags {
    left: 12.4814cqw;
    top: 4.7571cqw;
    width: 16.5082cqw;
    gap: 0.2972cqw;
  }
  .c5card--center .c5card__tags {
    left: 18.7221cqw;
    top: 5.8692cqw;
    gap: 0.1486cqw;
    align-items: center;
  }
  .c5card__tag {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0.2972cqw 0.5349cqw;
    border-radius: 0.2972cqw;
    white-space: nowrap;
    text-align: center;
    /* 칩 폭은 Figma 고정(222.2px / 3분할). 폴백 폰트가 넓어 글자가 넘칠 때
       옆 칩을 밀지 않고 칩 안에서 잘리도록 한다. */
    overflow: hidden;
  }
  .c5card--side .c5card__tag {
    flex: 1 0 0;
    min-width: 1px;
    font-family: var(--rajdhani), "Rajdhani", sans-serif;
    font-weight: 500;
    font-size: 0.5944cqw;
    line-height: 0.7132cqw;
  }
  .c5card--center .c5card__tag {
    flex: 0 0 auto;
    font-family: "Pretendard", sans-serif;
    font-weight: 500;
    font-size: 0.8915cqw;
    line-height: 0.8915cqw;
  }
  .c5card__tag--teal { background: rgba(0, 255, 190, 0.1); color: #00ffbe; }
  .c5card__tag--lime { background: rgba(235, 247, 72, 0.1); color: #ebf748; }

  /* 80자 본문 + 화살표 버튼 */
  .c5card__text {
    position: absolute;
    left: 1.0401cqw;
    margin: 0;
    color: #ffffff;
    font-family: "Pretendard", sans-serif;
    font-weight: 600;
    line-height: 1.6345cqw;
    /* Figma의 텍스트 프레임은 높이 44px(2줄) 고정 클리핑이다. Pretendard가
       실제로 로드되지 않아 Malgun Gothic(더 넓음)으로 폴백되면 같은 문구가
       3줄이 되어 아래 명성도 행 위로 흘러넘친다 — Figma와 동일하게 2줄에서
       자른다(문구 자체가 "..."로 끝나는 디자인이라 시각적으로도 일치). */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .c5card--side .c5card__text {
    top: 6.6865cqw;
    width: 28.0832cqw;
    height: 3.2689cqw;
    font-size: 0.9658cqw;
  }
  .c5card--center .c5card__text {
    top: 7.7266cqw;
    width: 39.0045cqw;
    height: 3.2689cqw;
    font-size: 1.1887cqw;
  }
  .c5card__arrow {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.1144cqw;
    height: 1.1144cqw;
    border-radius: 0.3715cqw;
    background: var(--cluster5-accent, #faab07);
  }
  .c5card--side .c5card__arrow { left: 25.6315cqw; top: 8.5438cqw; }
  .c5card--center .c5card__arrow { left: 28.1575cqw; top: 9.584cqw; }
  .c5card__arrow svg { display: block; width: 0.6686cqw; height: 0.6686cqw; }

  /* 명성도 행 */
  .c5card__fm {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 0.5944cqw;
    left: 1.0401cqw;
    height: 1.8054cqw;
  }
  .c5card--side .c5card__fm { top: 10.5498cqw; }
  .c5card--center .c5card__fm { top: 11.5899cqw; }
  .c5card__fm-link {
    display: flex;
    align-items: center;
    gap: 0.2972cqw;
    color: #ffffff;
    white-space: nowrap;
    line-height: 1.4487cqw;
  }
  .c5card--side .c5card__fm-link { font-family: var(--rajdhani), "Rajdhani", sans-serif; letter-spacing: 0.0523cqw; }
  .c5card--center .c5card__fm-link { font-family: "Pretendard", sans-serif; }
  .c5card__fm-icon { display: block; width: 1.0186cqw; height: 0.9658cqw; flex-shrink: 0; }
  .c5card__fm-label { font-size: 1.1144cqw; font-weight: 400; }
  .c5card__fm-value { font-size: 1.3373cqw; font-weight: 700; color: #f7ba48; }
  .c5card__fm-divider {
    width: 1px;
    height: 1.1293cqw;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  /* ---- ≤1199.98px: showcase가 flow로 풀리면 카드도 배너 아래로 내려간다 ----
     Figma에 모바일 스펙이 없어, 겹침 캐러셀 대신 세로 스택으로 자연 전환한다
     (히어로/Keyword Map/헤더와 동일한 breakpoint·원칙). cqw 기준이 사라지지
     않도록 .cluster5-showcase의 container-type은 유지된다. */
  @media only screen and (max-width: 1199.98px) {
    /* 겹침 캐러셀 해제 — 카드 3장 모두 동일 크기 스택.
       ⚠ 아래 규칙들은 데스크톱의 ".c5card--side .c5card__X"(특정성 0,2,0)를
       이겨야 하므로 반드시 ".c5card .c5card__X"(동일 0,2,0 + 소스 순서 뒤)로
       쓴다. ".c5card__X"(0,1,0) 단독으로 쓰면 적용되지 않는다(실측 확인:
       패널 높이가 cqw 고정값에 묶여 본문이 패널 밖으로 흘러넘쳤다). */
    .cluster5-cardrow {
      position: relative;
      left: auto;
      top: auto;
      width: 100%;
      height: auto;
      overflow: visible;
      margin-top: 40px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: flex-start;
      gap: 24px;
    }
    .c5card--side,
    .c5card--center {
      position: relative;
      left: auto;
      top: auto;
      width: 320px;
      max-width: 100%;
      height: auto;
      border-radius: 20px;
      box-shadow: 0 4px 18px #0a0a0a;
    }
    .c5card .c5card__img {
      position: relative;
      left: auto;
      top: auto;
      width: 100%;
      height: 300px;
      object-position: 50% 20%;
    }
    .c5card .c5card__date {
      left: 14px;
      top: 12px;
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
      line-height: 24px;
    }
    .c5card .c5card__cat {
      left: auto;
      right: 12px;
      top: 12px;
      padding: 2px 10px;
      font-size: 13px;
      line-height: 20px;
    }
    .c5card .c5card__panel {
      position: relative;
      width: 100%;
      height: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-radius: 0;
    }
    .c5card .c5card__profile { gap: 10px; }
    .c5card .c5card__avatar { width: 40px; height: 40px; }
    .c5card .c5card__ident { gap: 3px; min-width: 0; }
    .c5card .c5card__idrow {
      gap: 4px;
      font-size: 12px;
      line-height: 18px;
      white-space: normal;
      flex-wrap: wrap;
    }
    .c5card .c5card__sep { font-size: 12px; }
    .c5card .c5card__stars,
    .c5card .c5card__tags,
    .c5card .c5card__text,
    .c5card .c5card__fm {
      position: relative;
      left: auto;
      top: auto;
      width: auto;
      height: auto;
      gap: 8px;
    }
    .c5card .c5card__tags { flex-wrap: wrap; }
    .c5card .c5card__star { width: 13px; height: 18px; }
    .c5card .c5card__starset { gap: 4px; }
    .c5card .c5card__score { font-size: 12px; line-height: 18px; letter-spacing: 0; }
    .c5card .c5card__tag {
      flex: 0 0 auto;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 13px;
    }
    .c5card .c5card__text {
      font-size: 13px;
      line-height: 20px;
      -webkit-line-clamp: 3;
    }
    .c5card .c5card__arrow {
      position: relative;
      left: auto;
      top: auto;
      display: inline-flex;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      align-self: flex-end;
    }
    .c5card .c5card__arrow svg { width: 9px; height: 9px; }
    .c5card .c5card__fm-icon { width: 14px; height: 13px; }
    .c5card .c5card__fm-link { gap: 6px; line-height: 20px; letter-spacing: 0; }
    .c5card .c5card__fm-label { font-size: 14px; }
    .c5card .c5card__fm-value { font-size: 16px; }
    .c5card .c5card__fm-divider { height: 15px; }
  }
`;

// =====================================================================
// Section 5 — "기업/실무자 Mention"
//
// Figma 기준: 동일 파일, node 1068:22090("Group 2121454071", 1335x1288,
// 부모 Frame 633 = 1068:22048 기준 x=0.5 / y=2500) — 사용자가 지정한 selection.
//
// [조사 — selection 하나가 구현 대상 전체가 아니었다]
// selection(1068:22090)만 조회하면 "사진 배너 + 헤더"만 나온다. 부모
// Frame 633의 자식 목록을 전부 확보해 대조한 결과, 이 그룹의 y구간
// (2500~3788) 안에 완전히 포함되면서 그룹보다 뒤(=위)에 그려지는 형제
// 노드가 하나 더 있었다:
//   1068:22706 "Frame 2121457663" (86, 2801) 535x918  ← 멘션 카드 리스트
// 즉 Section 5의 실제 구성은 Section 4(Group 2121454081)와 동일한
// "배너를 배경으로 깔고 그 위에 콘텐츠를 얹는" 오버레이 합성이다. 배너의
// 좌측 어두운 그라디언트(linear-gradient(-89.5deg, ...) → x 6~544px 구간이
// rgb(12,15,20))가 정확히 이 카드 리스트(x 86~621)를 받기 위한 레이어라는
// 점으로 교차 검증했다. selection만 믿고 배너만 구현했다면 Section 4에서
// 이미 한 번 겪은 것과 똑같은 "빈 사진만 덩그러니" 회귀가 났을 것이다.
//
// [조회 제약 — 명시]
//   - Section 4(1068:24526 계열)는 Frame 633의 자식이 아니다(전수 확인).
//     즉 Section 4와 Section 5는 같은 좌표계에 있지 않아 "Section 4 하단 →
//     Section 5 상단"의 Figma 실측 간격을 직접 얻을 수 없다. 사용자 지침
//     대로 기존 섹션에서 이미 실측 확정한 리듬(84px)을 그대로 이어 붙인다.
//   - get_metadata는 1068:22091(배너 프레임)의 자식을 반환하지 않는다
//     (leaf로 축약). 배너 내부 구조/좌표는 get_design_context 결과와 레퍼런스
//     PNG 픽셀 대조로 확보했다.
//
// [레이어 / 구조] 그룹(1335x1288) 기준 상대좌표
//   Frame 2121457572   (0,      0)     1335x1288  배경 배너(overflow clip)
//     ├ 배경 이미지 + 3중 그라디언트 스크림
//     ├ 헤더 블록      (112.5,  51)    1110 wide  (auto-layout, gap 50)
//     └ Vector 12      (bottom)        1168x2     org accent 구분선(#FAAB07)
//   Frame 2121457272   (1240.5, 26.96) 49x23.72   수정/검색 아이콘 2개
//   Frame 2121457663   (85.5,   301)   535x918    멘션 카드 리스트(오버레이)
//
// [org 색상 정책 — 기존 SoT 그대로]
// Figma 원본 색을 ORGANIZATION_CONFIG와 1:1 대조해 "정확히 일치하는 것만"
// var(--cluster5-accent)로 치환한다(Section 2~4에서 확립한 규칙):
//   #FAAB07 = marketing.themeColor  → 통계 pill 숫자 / 아이콘 버튼 배경 /
//              카드 화살표 버튼 / 상하 원형 화살표 / 하단 구분선  → accent
//   #DDF247(Starship) / #161616 / #919191 / #FFEAA4 / #F7BA48 /
//   #EBF748 / #8F00FF / #FC6C85 / rgba(0,111,255,.2)
//            → 어느 org 색과도 대응하지 않는 이 컴포지션 고유값 → 하드코딩 유지
// (Section 4의 #DDF247 버튼과 동일한 판정. 억지 org 반응형 금지.)
//
// [스케일] Section 4(.cluster5-showcase)와 동일하게 container-type:
// inline-size + aspect-ratio를 쓰고 내부 치수를 전부 cqw(px / 1335 * 100)로
// 적는다. 이렇게 해야 아이콘·SVG·배지·gap·absolute 요소가 전부 부모와 같은
// 비율로 축소된다(Section 4에서 아이콘만 고정 px로 남아 9% 크게 렌더된
// 실측 버그의 재발 방지).
//
// [데이터] 순수 표현 계층이다. Figma placeholder 문구/숫자를 그대로 정적
// 마크업으로 넣는다 — API/DTO/조회 로직/권한/라우팅을 일절 건드리지 않으며,
// 일반 / mode=test / actAsTestUserId / demoUserId 가 완전히 동일한 DOM을 탄다
// (이 컴포넌트는 org 계산 외에 어떤 쿼리도 읽지 않는다).
const mentionSectionStyles = `
  .cluster5-mention {
    position: relative;
    width: 100%;
    max-width: 1335px;
    margin: 0 auto;
    aspect-ratio: 1335 / 1288;
    box-sizing: border-box;
    container-type: inline-size;
    font-synthesis: none;
  }
  .cluster5-mention__banner {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .cluster5-mention__bg {
    position: absolute;
    inset: 0;
    background-image: url(/images/0/cluster5/mention/Banner-bg.png);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .cluster5-mention__scrim {
    /* Figma 원본 3중 그라디언트 그대로(중립 — org 무관).
       1) 상단 검정 페이드 = 헤더 가독성
       2) 좌측 rgb(12,15,20) 페이드 = 멘션 카드 리스트 오버레이 자리
       3) 전면 10% 검정 */
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0) 25.867%),
      linear-gradient(-89.5deg, rgba(12, 15, 20, 0) 59.25%, rgb(12, 15, 20) 99.547%),
      linear-gradient(90deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.1) 100%);
  }
  .cluster5-mention__rule {
    /* Figma Vector(1084:1815) — 1168x2 stroke #FAAB07, 배너 하단 경계에 걸쳐
       절반만 보인다(부모 overflow clip). org accent. */
    position: absolute;
    left: 50%;
    bottom: -0.0749cqw; /* -1px */
    transform: translateX(-50%);
    width: 87.4906cqw; /* 1168px */
    height: 0.1498cqw; /* 2px */
    background: var(--cluster5-accent, #faab07);
  }
  .cluster5-mention__rule--top {
    /* [수정] 전체 페이지 프레임 대조에서 발견 — Figma Vector 12(1068:22083)가
       섹션 상단 경계(y=2500)에도 있다. 하단 rule 과 완전 대칭. */
    top: -0.0749cqw;
    bottom: auto;
  }

  /* ---- 헤더 블록 (Figma 1068:22092 — left 112.5 / top 51 / w 1110, gap 50) ---- */
  .cluster5-mention__header {
    position: absolute;
    left: 8.427cqw; /* 112.5px */
    top: 3.8202cqw; /* 51px */
    width: 83.1461cqw; /* 1110px */
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3.7453cqw; /* 50px */
    z-index: 2;
  }
  .cluster5-mention__heading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3745cqw; /* 5px (Figma flex-wrap row-gap) */
    width: 100%;
  }
  .cluster5-mention__eyebrow {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cluster5-mention__eyebrow-text {
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 1.0487cqw; /* 14px */
    line-height: 1.4232cqw; /* 19px */
    letter-spacing: 0;
    color: #ddf247;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .cluster5-mention__badge {
    position: relative;
    display: block;
    flex-shrink: 0;
    width: 1.4981cqw; /* 20px */
    height: 1.4981cqw;
    margin-left: 0.7491cqw; /* Figma Margin pl-10 */
  }
  .cluster5-mention__badge svg {
    position: absolute;
    left: 0.0469cqw; /* 0.626px */
    top: 0.0281cqw; /* 0.375px */
    width: 1.4045cqw; /* 18.75px */
    height: 1.4045cqw;
    display: block;
    /* 이 아이콘 세트의 Figma export path 는 전부 상하 반전된 좌표계다
       (별/하트/화살표/다이아와 동일). 반전 없이 그리면 체크(✓)가 "^" 로
       렌더된다 — 레퍼런스 PNG 확대 비교로 확인. */
    transform: scaleY(-1);
  }
  .cluster5-mention__title {
    margin: 0;
    width: 100%;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 2.6966cqw; /* 36px */
    line-height: 3.2959cqw; /* 44px */
    letter-spacing: 0;
    color: var(--white, #ffffff);
    text-align: center;
    text-transform: capitalize;
    word-break: keep-all;
  }

  /* ---- 헤더 2행: Type by / 통계 pill 3개 / 공유·더보기 (gap 107) ---- */
  .cluster5-mention__meta {
    display: flex;
    align-items: center;
    gap: 8.015cqw; /* 107px */
    width: 100%;
  }
  .cluster5-mention__type {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .cluster5-mention__type-icon {
    display: block;
    flex-shrink: 0;
    width: 2.8464cqw; /* 38px */
    height: 2.8464cqw;
    margin-right: 0.7491cqw; /* Figma Margin pr-10 (48 - 38) */
    border-radius: 50%;
    object-fit: cover;
  }
  .cluster5-mention__type-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: "Azeret Mono", "Pretendard", monospace;
    font-weight: 400;
    font-size: 0.8989cqw; /* 12px */
    line-height: 1.4232cqw; /* 19px */
    white-space: nowrap;
  }
  .cluster5-mention__type-label { color: rgba(255, 255, 255, 0.3); }
  .cluster5-mention__type-value { color: var(--white, #ffffff); }

  .cluster5-mention__pills {
    display: flex;
    align-items: center;
    gap: 0.7491cqw; /* 10px */
    flex-shrink: 0;
  }
  .cluster5-mention__pill {
    display: flex;
    align-items: center;
    gap: 0.4494cqw; /* 6px */
    height: 5.6929cqw; /* 76px */
    padding: 0.7491cqw 0.9738cqw; /* 10 / 13 */
    box-sizing: border-box;
    background: rgba(17, 17, 17, 0.1);
    border: 0.0749cqw solid rgba(255, 255, 255, 0.12); /* 1px */
    border-radius: 0.8989cqw; /* 12px */
    flex-shrink: 0;
  }
  .cluster5-mention__pill-icon {
    display: block;
    flex-shrink: 0;
    width: 4.1199cqw; /* 55px */
    object-fit: contain;
  }
  .cluster5-mention__pill-text {
    margin: 0;
    font-family: var(--black-ops-one), "Black Ops One", cursive;
    font-weight: 400;
    font-size: 1.3483cqw; /* 18px */
    line-height: 2.2472cqw; /* 30px */
    color: var(--white, #ffffff);
    text-transform: capitalize;
    /* nowrap 이 아니라 pre — Figma 원문 "2 " / "103" 뒤(앞)의 공백이 span
       경계에서 접혀 "2/ 10", "103FM" 으로 붙어 렌더되던 것을 실측으로 확인. */
    white-space: pre;
  }
  .cluster5-mention__pill-text--tight { line-height: 1.4232cqw; /* 19px */ }
  .cluster5-mention__pill-num { color: var(--cluster5-accent, #faab07); }

  .cluster5-mention__tools {
    display: flex;
    align-items: flex-start;
    gap: 1.3483cqw; /* 18px */
    flex-shrink: 0;
  }
  .cluster5-mention__tool {
    position: relative;
    display: block;
    width: 1.7978cqw; /* 24px */
    height: 1.7978cqw;
    padding-bottom: 0.1124cqw; /* Figma pb-1.5px */
    flex-shrink: 0;
  }
  .cluster5-mention__tool svg { position: absolute; display: block; }
  .cluster5-mention__tool--share svg {
    left: 0.1686cqw; /* 2.2512px */
    top: 0.1122cqw; /* 1.4976px */
    width: 1.3488cqw; /* 18.0064px */
    height: 1.573cqw; /* 21.0004px */
  }
  .cluster5-mention__tool--more svg {
    left: 0.1124cqw; /* 1.5px */
    top: 0.6742cqw; /* 9px */
    width: 1.573cqw; /* 21px */
    height: 0.4494cqw; /* 6px */
  }

  /* ---- 우상단 수정/검색 아이콘 (Figma 1068:22125, 배너와 형제) ----
     .cluster5-gallery__actions 와 완전히 동일한 기법(컨테이너 자체를 %가 아닌
     cqw로 고정 → 자식이 그 안에서 다시 비율 스케일)을 재사용한다. */
  .cluster5-mention__actions {
    position: absolute;
    left: 92.9213cqw; /* 1240.5px */
    top: 2.0192cqw; /* 26.957px */
    width: 3.6704cqw; /* 49px */
    height: 1.7769cqw; /* 23.722px */
    display: flex;
    align-items: center;
    gap: 0.3745cqw; /* 5px */
    z-index: 3;
  }
  .cluster5-mention__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.6479cqw; /* 22px */
    height: 1.6479cqw;
    border-radius: 50%;
    background: var(--cluster5-accent, #faab07);
    backdrop-filter: blur(2.5px);
    -webkit-backdrop-filter: blur(2.5px);
    flex-shrink: 0;
  }
  .cluster5-mention__icon-btn svg {
    width: 1.1985cqw; /* 16px */
    height: 1.1985cqw;
  }

  /* ---- ≤1199.98px: 오버레이/절대배치 해제, flow 레이아웃 + px 타이포 ----
     (히어로 / Keyword Map / showcase 와 동일한 breakpoint·기법 재사용) */
  @media only screen and (max-width: 1199.98px) {
    .cluster5-mention {
      aspect-ratio: auto;
      display: flex;
      flex-direction: column;
    }
    .cluster5-mention__banner {
      position: relative;
      inset: auto;
      width: 100%;
      aspect-ratio: 1335 / 620;
      min-height: 320px;
    }
    .cluster5-mention__rule {
      bottom: -1px;
      width: 100%;
      max-width: 1168px;
      height: 2px;
    }
    .cluster5-mention__header {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      align-items: center;
      gap: 24px;
      padding: 28px 20px;
      box-sizing: border-box;
    }
    .cluster5-mention__heading { gap: 6px; }
    .cluster5-mention__eyebrow-text { font-size: 13px; line-height: 18px; }
    .cluster5-mention__badge { width: 18px; height: 18px; margin-left: 8px; }
    .cluster5-mention__badge svg { left: 0; top: 0; width: 18px; height: 18px; }
    .cluster5-mention__title { font-size: 30px; line-height: 40px; }
    .cluster5-mention__meta {
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px 24px;
    }
    .cluster5-mention__type-icon { width: 34px; height: 34px; margin-right: 10px; }
    .cluster5-mention__type-text { font-size: 12px; line-height: 18px; }
    .cluster5-mention__pills { flex-wrap: wrap; justify-content: center; gap: 10px; }
    .cluster5-mention__pill {
      height: 60px;
      padding: 8px 12px;
      gap: 6px;
      border-width: 1px;
      border-radius: 12px;
    }
    .cluster5-mention__pill-icon { width: 42px; }
    .cluster5-mention__pill-text,
    .cluster5-mention__pill-text--tight { font-size: 15px; line-height: 22px; }
    .cluster5-mention__tools { gap: 18px; }
    .cluster5-mention__tool { width: 24px; height: 24px; padding-bottom: 0; }
    .cluster5-mention__tool--share svg { left: 3px; top: 1.5px; width: 18px; height: 21px; }
    .cluster5-mention__tool--more svg { left: 1.5px; top: 9px; width: 21px; height: 6px; }
    .cluster5-mention__actions {
      left: auto;
      right: 16px;
      top: 16px;
      width: 49px;
      height: 22px;
      gap: 5px;
    }
    .cluster5-mention__icon-btn { width: 22px; height: 22px; }
    .cluster5-mention__icon-btn svg { width: 16px; height: 16px; }
  }

  @media only screen and (max-width: 767.98px) {
    .cluster5-mention__banner { aspect-ratio: auto; min-height: 0; }
    .cluster5-mention__header { position: relative; padding: 24px 16px; }
    .cluster5-mention__title { font-size: 22px; line-height: 30px; }
    .cluster5-mention__pill { height: 52px; padding: 6px 10px; }
    .cluster5-mention__pill-icon { width: 34px; }
    .cluster5-mention__pill-text,
    .cluster5-mention__pill-text--tight { font-size: 13px; line-height: 20px; }
  }
`;

// Figma 기준: 1068:22706("Frame 2121457663", 535x918) + 자식 Component 12/13/14
// (각 535x258, 세로 gap 15) + 상하 Arrow_Circle_Down 인스턴스(38x37).
// 카드는 Figma에서 auto-layout(px-20 py-12, gap 10, radius 20, bg #1e1e1e)이라
// 절대좌표 복사가 아니라 flex flow로 그대로 옮긴다 — 폭이 줄면 내부가 함께
// 재배치된다.
//
// [별 아이콘 방향 — 실측] Figma export path 자체는 꼭짓점이 아래를 향하고
// (bottom-center 정점 + top-left/top-right 정점), Figma는 -scale-y-100 으로
// 뒤집어 렌더한다. 레퍼런스 PNG 픽셀 확대로 별이 위를 향하는 것을 확인했으므로
// 여기서는 transform: scaleY(-1)을 적용한다. (Section 4의 .c5card__star 는
// 이 뒤집기가 없어 별이 거꾸로 렌더되는데, 기존 섹션 회귀 방지 원칙상
// 이번 작업에서는 손대지 않고 보고만 한다.)
const mentionCardsStyles = `
  .cluster5-mention__list {
    position: absolute;
    left: 6.4045cqw; /* 85.5px */
    top: 22.5468cqw; /* 301px */
    width: 40.0749cqw; /* 535px */
    height: 68.764cqw; /* 918px */
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  }
  .cluster5-mention__scroll-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.8464cqw; /* 38px */
    height: 2.7715cqw; /* 37px */
    flex-shrink: 0;
  }
  .cluster5-mention__scroll-btn svg {
    display: block;
    width: 2.2846cqw; /* 30.5px */
    height: 2.2285cqw; /* 29.75px */
  }
  /* [실측] get_metadata 는 위쪽 화살표 인스턴스를 y=37 로 보고하지만, 레퍼런스
     PNG 를 픽셀 스캔하니 실제 렌더 위치는 y≈0 이었다(accent #FAAB07 bbox
     y 4~32 → 30.5x29.75 아이콘이 38x37 박스 안에 중앙 정렬된 상태의 y=0).
     아래쪽 화살표는 메타데이터(y=881)와 실측(884~914)이 일치한다. 따라서
     실제 세로 리듬은 화살표(0~37) / 20 / 카드 3장(57~861) / 20 / 화살표(881~918). */
  .cluster5-mention__scroll-btn--up { margin-top: 0; }
  .cluster5-mention__scroll-btn--up svg { transform: rotate(180deg); }
  .cluster5-mention__scroll-btn--down { margin-top: 1.4981cqw; /* 881 - 861 = 20px */ }
  .cluster5-mention__cards {
    display: flex;
    flex-direction: column;
    gap: 1.1236cqw; /* 15px (273 - 258) */
    width: 100%;
    margin-top: 1.4981cqw; /* 57 - 37 = 20px */
  }

  /* ---- 멘션 카드 ---- */
  .c5mcard {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.7491cqw; /* 10px */
    width: 100%;
    height: 19.3258cqw; /* 258px */
    padding: 0.8989cqw 1.4981cqw; /* 12 / 20 */
    box-sizing: border-box;
    background: #1e1e1e;
    border-radius: 1.4981cqw; /* 20px */
  }
  .c5mcard__row {
    display: flex;
    align-items: center;
    gap: 0.7491cqw; /* 10px */
    width: 37.0787cqw; /* 495px */
    height: 17.5281cqw; /* 234px */
  }
  .c5mcard__photo {
    display: block;
    flex-shrink: 0;
    width: 17.603cqw; /* 235px */
    height: 17.5281cqw; /* 234px */
    object-fit: cover;
  }
  .c5mcard__like {
    position: absolute;
    left: 1.4981cqw; /* 20px */
    top: 1.4981cqw;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.9476cqw; /* 26px */
    height: 1.9476cqw;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
  }
  .c5mcard__like svg {
    display: block;
    width: 0.9738cqw; /* 13px */
    height: 0.8351cqw; /* 11.1465px */
    transform: scaleY(-1); /* Figma export 좌표계 상하 반전 (별 아이콘과 동일) */
  }

  .c5mcard__info {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    width: 18.7266cqw; /* 250px */
    height: 17.5281cqw; /* 234px */
  }
  .c5mcard__top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.7491cqw;
    width: 100%;
  }

  /* 배지 + 날짜 + 본문 + 화살표 (Figma Frame 2121457656, 250x74) */
  .c5mcard__body {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.7491cqw; /* 10px */
    width: 100%;
  }
  .c5mcard__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .c5mcard__kind {
    display: flex;
    align-items: center;
    padding: 0.1498cqw 0.5993cqw; /* 2 / 8 */
    box-sizing: border-box;
    background: #ffeaa4;
    color: #000000;
    font-family: "Cafe24Ohsquare", "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 1.0487cqw; /* 14px */
    line-height: 1.4981cqw; /* 20px */
    white-space: nowrap;
  }
  .c5mcard__date {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4494cqw 0.7491cqw; /* 6 / 10 */
    box-sizing: border-box;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    color: var(--white, #ffffff);
    font-family: "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 0.8989cqw; /* 12px */
    line-height: 0.8989cqw;
    white-space: nowrap;
  }
  .c5mcard__text {
    margin: 0;
    width: 18.427cqw; /* 246px */
    color: var(--white, #ffffff);
    font-family: "Pretendard", sans-serif;
    font-weight: 500;
    font-size: 1.0487cqw; /* 14px */
    line-height: 1.4981cqw; /* 20px */
    /* Figma 텍스트 프레임은 2줄(40px) 고정이다. Pretendard가 실제로 로드되지
       않아 더 넓은 폴백(Malgun Gothic)으로 렌더되면 3줄이 되어 아래 프로필
       블록을 밀어낸다 — Section 4의 .c5card__text 와 동일하게 2줄에서 자른다
       (원문이 "..."로 끝나는 디자인이라 시각적으로도 일치). */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .c5mcard__go {
    position: absolute;
    left: 12.7341cqw; /* 170px */
    top: 4.1199cqw; /* 55px */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.1953cqw; /* 15.957px */
    height: 1.2702cqw; /* 16.957px */
    border-radius: 0.3745cqw; /* 5px */
    background: var(--cluster5-accent, #faab07);
  }
  .c5mcard__go svg {
    display: block;
    width: 0.7491cqw; /* 10px */
    height: 0.7491cqw;
    /* 반전 없이 그리면 화살표가 ↘ 로 렌더된다(Figma 는 ↗). */
    transform: scaleY(-1);
  }

  /* 프로필 블록 */
  .c5mcard__profile {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    height: 4.0449cqw; /* 54px */
    padding: 0.2996cqw 0.1498cqw; /* 4 / 2 */
    box-sizing: border-box;
    background: rgba(0, 111, 255, 0.2);
  }
  .c5mcard__profile-row {
    display: flex;
    align-items: center;
    gap: 0.2996cqw; /* 4px */
  }
  .c5mcard__avatar {
    display: block;
    flex-shrink: 0;
    width: 2.8464cqw; /* 38px */
    height: 2.8464cqw;
    border-radius: 50%;
    object-fit: cover;
  }
  .c5mcard__ident {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .c5mcard__idrow {
    display: flex;
    align-items: flex-start;
    gap: 0.3745cqw; /* 5px */
    margin: 0;
    color: var(--white, #ffffff);
    /* <p> 엘리먼트라 전역 스타일시트의 p{...} 선택자가 부모 상속을 이긴다 —
       Section 4에서 확인한 것과 동일한 이유로 클래스에서 직접 지정한다. */
    font-family: "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 0.8989cqw; /* 12px */
    line-height: 1.4232cqw; /* 19px */
    white-space: nowrap;
  }
  .c5mcard__sep { font-family: "Azeret Mono", "Pretendard", monospace; font-weight: 400; }

  /* 해시태그 */
  .c5mcard__tags {
    display: flex;
    align-items: flex-start;
    gap: 0.2247cqw; /* 3px */
    width: 100%;
  }
  .c5mcard__tag {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    min-width: 1px;
    padding: 0.2996cqw 0.5393cqw; /* 4 / 7.2 */
    box-sizing: border-box;
    border-radius: 0.2996cqw; /* 4px */
    font-family: "Pretendard", sans-serif;
    font-weight: 500;
    font-size: 0.7491cqw; /* 10px */
    line-height: 0.7491cqw;
    text-align: center;
    white-space: nowrap;
    /* 칩 폭은 Figma 고정(81.4 x 3). 폴백 폰트가 넓어도 옆 칩을 밀지 않는다. */
    overflow: hidden;
  }
  .c5mcard__tag--lime { background: rgba(235, 247, 72, 0.1); color: #ebf748; }
  .c5mcard__tag--purple { background: rgba(143, 0, 255, 0.1); color: #8f00ff; }
  .c5mcard__tag--pink { background: rgba(252, 108, 133, 0.1); color: #fc6c85; }

  /* 하단 (별점 / 명성도) */
  .c5mcard__bottom {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3745cqw; /* 5px */
    width: 100%;
  }
  .c5mcard__stars {
    display: flex;
    align-items: center;
    gap: 0.7491cqw; /* 10px */
  }
  .c5mcard__starset {
    display: flex;
    align-items: flex-start;
    gap: 0.2996cqw; /* 4px */
  }
  .c5mcard__starset .c5card__star {
    width: 0.952cqw; /* 12.71px */
    height: 1.3483cqw; /* 18px */
    /* Figma export path 는 위아래가 뒤집혀 있다(위 주석 참조). */
    transform: scaleY(-1);
  }
  .c5mcard__score {
    padding-left: 0.2996cqw; /* 4px */
    color: rgba(255, 255, 255, 0.9);
    font-family: var(--rajdhani), "Rajdhani", sans-serif;
    font-weight: 400;
    font-size: 0.8989cqw; /* 12px */
    line-height: 1.3483cqw; /* 18px */
    letter-spacing: 0.0527cqw; /* 0.704px */
    white-space: nowrap;
  }
  .c5mcard__fmrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 1.6479cqw; /* 22px */
  }
  .c5mcard__fm-label {
    font-family: "Azeret Mono", "Pretendard", monospace;
    font-weight: 400;
    font-size: 0.8989cqw; /* 12px */
    line-height: 1.4232cqw; /* 19px */
    color: rgba(255, 255, 255, 0.3);
    white-space: nowrap;
  }
  .c5mcard__fm {
    display: flex;
    align-items: center;
    gap: 0.2996cqw; /* 4px */
  }
  .c5mcard__fm svg {
    display: block;
    flex-shrink: 0;
    width: 0.735cqw; /* 9.8125px */
    height: 1.1985cqw; /* 16px */
    transform: scaleY(-1); /* Figma export 좌표계 상하 반전 */
  }
  .c5mcard__fm-value {
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 1.1985cqw; /* 16px */
    line-height: 1.6479cqw; /* 22px */
    color: var(--white, #ffffff);
    white-space: pre;
  }

  /* ---- ≤1199.98px: 오버레이 해제 → 배너 아래 일반 흐름 + px 타이포 ----
     Figma에 모바일 스펙이 없어 자연 반응형 원칙을 적용한다. cqw 기준
     컨테이너(.cluster5-mention)는 유지되므로, 여기서 쓰는 규칙은 데스크톱
     선택자와 동일 특정성 이상이어야 한다(Section 4에서 확인한 함정). */
  @media only screen and (max-width: 1199.98px) {
    .cluster5-mention__list {
      position: relative;
      left: auto;
      top: auto;
      width: 100%;
      max-width: 620px;
      height: auto;
      margin: 32px auto 0;
      padding: 0 16px;
      box-sizing: border-box;
    }
    .cluster5-mention__scroll-btn { width: 38px; height: 37px; }
    .cluster5-mention__scroll-btn svg { width: 30.5px; height: 29.75px; }
    .cluster5-mention__scroll-btn--up { margin-top: 0; }
    .cluster5-mention__scroll-btn--down { margin-top: 12px; }
    .cluster5-mention__cards { gap: 16px; margin-top: 16px; }
    .c5mcard {
      height: auto;
      gap: 12px;
      padding: 14px;
      border-radius: 16px;
    }
    .c5mcard__row {
      flex-direction: column;
      align-items: stretch;
      width: 100%;
      height: auto;
      gap: 12px;
    }
    .c5mcard__photo { width: 100%; height: 220px; }
    .c5mcard__like { left: 22px; top: 22px; width: 26px; height: 26px; }
    .c5mcard__like svg { width: 13px; height: 11.1465px; transform: scaleY(-1); }
    .c5mcard__info { width: 100%; height: auto; gap: 12px; }
    .c5mcard__top { gap: 10px; }
    .c5mcard__body { gap: 10px; }
    .c5mcard__kind { padding: 2px 8px; font-size: 13px; line-height: 20px; }
    .c5mcard__date { padding: 5px 10px; font-size: 11px; line-height: 12px; }
    .c5mcard__text {
      width: 100%;
      font-size: 13px;
      line-height: 20px;
      -webkit-line-clamp: 3;
    }
    .c5mcard__go {
      position: relative;
      left: auto;
      top: auto;
      align-self: flex-end;
      width: 18px;
      height: 18px;
      border-radius: 5px;
    }
    .c5mcard__go svg { width: 10px; height: 10px; transform: scaleY(-1); }
    .c5mcard__profile { height: auto; padding: 6px; }
    .c5mcard__profile-row { gap: 8px; }
    .c5mcard__avatar { width: 38px; height: 38px; }
    .c5mcard__idrow {
      gap: 5px;
      font-size: 12px;
      line-height: 18px;
      white-space: normal;
      flex-wrap: wrap;
    }
    .c5mcard__tags { gap: 4px; flex-wrap: wrap; }
    .c5mcard__tag {
      flex: 0 0 auto;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 13px;
    }
    .c5mcard__bottom { gap: 8px; }
    .c5mcard__stars { gap: 10px; }
    .c5mcard__starset { gap: 4px; }
    .c5mcard__starset .c5card__star { width: 13px; height: 18px; }
    .c5mcard__score { font-size: 12px; line-height: 18px; letter-spacing: 0; }
    .c5mcard__fmrow { height: auto; }
    .c5mcard__fm-label { font-size: 12px; line-height: 18px; }
    .c5mcard__fm svg { width: 10px; height: 16px; transform: scaleY(-1); }
    .c5mcard__fm-value { font-size: 16px; line-height: 22px; }
  }
`;

const sectionSpacingStyles = `
  .cluster5-sections {
    display: flex;
    flex-direction: column;
  }
  .cluster5-keyword {
    margin-top: -30px;
  }
  /* [수정] 통계 바 세로 위치는 이제 패널(.cluster5-statspanel)의 padding-top
     (Figma 실측 514px = 패널 폭의 38.7048%)이 결정한다. 기존 margin-top:84px 은
     패널을 몰랐을 때 "Keyword 카드 bottom → 통계 바 top" 을 직접 준 값이라
     이중 적용되므로 제거한다(Figma 상 그 간격 84px 자체는 그대로 유지된다). */
  /* 배너+헤더는 하나의 합성 섹션(.cluster5-showcase)이므로 간격도 한 번만 준다.
     [수정] 전체 페이지 프레임(1068:22043)을 확보하면서 Section 4가 놓일 자리가
     확정됐다 — 통계 패널 바닥 구분선(y=1307.8)과 멘션 섹션 상단 구분선(y=2499)
     사이의 빈 슬롯(1191px)이 그것이고, Section 4 그룹 높이(1170px)와 거의 정확히
     맞는다. 즉 Figma 의도는 "구분선 → 약 10px → Section 4 → 약 10px → 구분선"
     이며, 두 섹션 사이를 84px 씩 띄우던 기존 값은 페이지 프레임을 모를 때의
     대체값이었다. 11px 로 교정한다. */
  .cluster5-showcase {
    margin-top: 11px;
  }
  .cluster5-mention {
    margin-top: 11px;
  }
  @media only screen and (max-width: 1199.98px) {
    .cluster5-keyword {
      margin-top: 32px;
    }
    .cluster5-showcase {
      margin-top: 48px;
    }
    .cluster5-mention {
      margin-top: 48px;
    }
  }
`;

// Figma placeholder 데이터 그대로(1068:24612 / 1068:24736 텍스트 노드 원문).
// 세 카드가 동일 인물/문구를 쓰는 것도 Figma 시안 그대로다.
const TOP3_CARDS = [
  {
    key: "left",
    variant: "side" as const,
    position: "left" as const,
    image: "/images/0/cluster5/top3/card-left.png",
    avatar: "/images/0/cluster5/top3/avatar-side.png",
    category: "클러빙 평판(M)",
    text: "80자까지 쓴 내용을 확인할 수 있습니다~ 80자는 어떻게 채울까요 잘 한번 써봐서 80자를 채울 수 있도록 해주세요 80808080808080...",
  },
  {
    key: "center",
    variant: "center" as const,
    position: "center" as const,
    image: "/images/0/cluster5/top3/card-center.png",
    avatar: "/images/0/cluster5/top3/avatar-center.png",
    category: "클러빙 평판(M)",
    text: "80자까지 쓴 내용을 확인할 수 있습니다~ 80자는 어떻게 채울까요 잘잘잘 한번 써봐서 80자를 채울 수 있도록 해주세요 808080808080...",
  },
  {
    key: "right",
    variant: "side" as const,
    position: "right" as const,
    image: "/images/0/cluster5/top3/card-right.png",
    avatar: "/images/0/cluster5/top3/avatar-side.png",
    category: "시니어 평판",
    text: "80자까지 쓴 내용을 확인할 수 있습니다~ 80자는 어떻게 채울까요 잘 한번 써봐서 80자를 채울 수 있도록 해주세요 80808080808080...",
  },
] as const;

const TOP3_CARD_DATE = "2025 - 08 - 01 (월)";
const TOP3_CARD_TAGS = [
  { key: "t1", label: "#추진력추진력추", tone: "teal" as const },
  { key: "t2", label: "#리더쉽리더쉽쉽", tone: "lime" as const },
  { key: "t3", label: "#신속함신속함함", tone: "lime" as const },
];
// 별점: 채운 별 3 + 빈 별 2 (Figma 원본 아이콘 순서 그대로, "6 / 10" 표기와 별개)
const TOP3_CARD_STARS = ["full", "full", "full", "empty-a", "empty-b"] as const;

// Figma export SVG 원본 path 그대로 인라인(꽃잎/갤러리 아이콘과 동일 기법).
// 사이드/센터 카드용 export가 별도 id로 내려오지만 path는 완전히 동일해
// (clipPath id만 다름) 한 벌만 유지한다.
const StarFullIcon = () => (
  <svg className="c5card__star" viewBox="0 0 12.71 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M6.355 5.34588L2.61614 3.24873L3.45288 7.45362L0.307159 10.3557L4.56501 10.8641L6.355 14.7513L8.14499 10.8641L12.4028 10.3557L9.25712 7.45362L10.0939 3.24873L6.355 5.34588Z"
      fill="#F7BA48"
    />
  </svg>
);
const StarEmptyAIcon = () => (
  <svg className="c5card__star" viewBox="0 0 12.72 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M6.35976 5.34588L2.61796 3.24873L3.45536 7.45362L0.307159 10.3557L4.56836 10.8641L6.35976 14.7513L8.15116 10.8641L12.4124 10.3557L9.26416 7.45362L10.1016 3.24873L6.35976 5.34588ZM6.35976 6.55333L8.60696 5.29292L8.10876 7.82432L10.0062 9.57195L7.44096 9.87911L6.35976 12.2199L5.27856 9.87911L2.71336 9.57195L4.61076 7.82432L4.11256 5.29292L6.35976 6.55333Z"
      fill="#F7BA48"
    />
  </svg>
);
const StarEmptyBIcon = () => (
  <svg className="c5card__star" viewBox="0 0 12.71 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M6.355 5.34588L2.61614 3.24873L3.45288 7.45362L0.307159 10.3557L4.56501 10.8641L6.355 14.7513L8.14499 10.8641L12.4028 10.3557L9.25712 7.45362L10.0939 3.24873L6.355 5.34588ZM6.355 6.55333L8.60043 5.29292L8.10262 7.82432L9.99853 9.57195L7.43535 9.87911L6.355 12.2199L5.27465 9.87911L2.71147 9.57195L4.60738 7.82432L4.10957 5.29292L6.355 6.55333Z"
      fill="#F7BA48"
    />
  </svg>
);
const STAR_ICONS = {
  full: StarFullIcon,
  "empty-a": StarEmptyAIcon,
  "empty-b": StarEmptyBIcon,
} as const;

const FmIcon = () => (
  <svg className="c5card__fm-icon" viewBox="0 0 13.71 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M2.825 10.53C2.305 9.98111 1.90056 9.36 1.61167 8.66667C1.32278 7.97333 1.17833 7.25111 1.17833 6.5C1.17833 5.74889 1.32278 5.02667 1.61167 4.33333C1.90056 3.64 2.305 3.01889 2.825 2.47C2.91167 2.38333 2.955 2.28944 2.955 2.18833C2.955 2.08722 2.91167 1.99333 2.825 1.90667C2.73833 1.82 2.64444 1.77667 2.54333 1.77667C2.44222 1.77667 2.34833 1.82 2.26167 1.90667C1.655 2.51333 1.18556 3.21389 0.853333 4.00833C0.521111 4.80278 0.355 5.63333 0.355 6.5C0.355 7.36667 0.521111 8.19722 0.853333 8.99167C1.18556 9.78611 1.655 10.4867 2.26167 11.0933C2.34833 11.18 2.44222 11.2233 2.54333 11.2233C2.64444 11.2233 2.73833 11.18 2.825 11.0933C2.91167 11.0067 2.955 10.9128 2.955 10.8117C2.955 10.7106 2.91167 10.6167 2.825 10.53ZM4.55833 8.79667C4.15389 8.39222 3.87222 7.90833 3.71333 7.345C3.55444 6.78167 3.55444 6.21833 3.71333 5.655C3.87222 5.09167 4.15389 4.60778 4.55833 4.20333C4.645 4.11667 4.68833 4.01556 4.68833 3.9C4.68833 3.78444 4.645 3.69056 4.55833 3.61833C4.47167 3.54611 4.37056 3.51 4.255 3.51C4.13944 3.51 4.05278 3.55333 3.995 3.64C3.61944 4.01556 3.32333 4.44889 3.10667 4.94C2.89 5.43111 2.78167 5.95111 2.78167 6.5C2.78167 7.04889 2.89 7.56889 3.10667 8.06C3.32333 8.55111 3.61944 8.98444 3.995 9.36C4.05278 9.44667 4.13944 9.49 4.255 9.49C4.37056 9.49 4.47167 9.45389 4.55833 9.38167C4.645 9.30944 4.68833 9.21556 4.68833 9.1C4.68833 8.98444 4.645 8.88333 4.55833 8.79667ZM9.15167 9.36C9.23833 9.44667 9.33944 9.49 9.455 9.49C9.57056 9.49 9.65722 9.44667 9.715 9.36C10.0906 8.98444 10.3867 8.55111 10.6033 8.06C10.82 7.56889 10.9283 7.04889 10.9283 6.5C10.9283 5.95111 10.82 5.43111 10.6033 4.94C10.3867 4.44889 10.0906 4.01556 9.715 3.64C9.59944 3.52444 9.46944 3.48833 9.325 3.53167C9.18056 3.575 9.08667 3.66889 9.04333 3.81333C9 3.95778 9.03611 4.08778 9.15167 4.20333C9.55611 4.60778 9.83778 5.09167 9.99667 5.655C10.1556 6.21833 10.1556 6.78167 9.99667 7.345C9.83778 7.90833 9.55611 8.39222 9.15167 8.79667C9.065 8.88333 9.02167 8.98444 9.02167 9.1C9.02167 9.21556 9.065 9.30222 9.15167 9.36ZM10.885 11.0933C10.9717 11.18 11.0656 11.2233 11.1667 11.2233C11.2678 11.2233 11.3617 11.18 11.4483 11.0933C12.2861 10.2556 12.8494 9.28056 13.1383 8.16833C13.4272 7.05611 13.4272 5.94389 13.1383 4.83167C12.8494 3.71944 12.2861 2.74444 11.4483 1.90667C11.3617 1.82 11.2678 1.77667 11.1667 1.77667C11.0656 1.77667 10.9717 1.82 10.885 1.90667C10.7983 1.99333 10.755 2.08722 10.755 2.18833C10.755 2.28944 10.7983 2.38333 10.885 2.47C11.405 3.01889 11.8094 3.64 12.0983 4.33333C12.3872 5.02667 12.5317 5.74889 12.5317 6.5C12.5317 7.25111 12.3872 7.97333 12.0983 8.66667C11.8094 9.36 11.405 9.98111 10.885 10.53C10.7983 10.6167 10.755 10.7106 10.755 10.8117C10.755 10.9128 10.7983 11.0067 10.885 11.0933ZM8.50167 6.5C8.50167 6.03778 8.34278 5.64778 8.025 5.33C7.70722 5.01222 7.31722 4.86056 6.855 4.875C6.39278 4.88944 6.01 5.04833 5.70667 5.35167C5.40333 5.655 5.25167 6.03778 5.25167 6.5C5.25167 6.96222 5.40333 7.35222 5.70667 7.67C6.01 7.98778 6.39278 8.14667 6.855 8.14667C7.31722 8.14667 7.70722 7.98778 8.025 7.67C8.34278 7.35222 8.50167 6.96222 8.50167 6.5Z"
      fill="#FFE3AA"
    />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 13.5 13.5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M1.91602 0.333984L11.25 9.65039V5.625C11.25 5.30859 11.3584 5.04199 11.5752 4.8252C11.792 4.6084 12.0586 4.5 12.375 4.5C12.6914 4.5 12.958 4.6084 13.1748 4.8252C13.3916 5.04199 13.5 5.30859 13.5 5.625V12.375C13.5 12.5977 13.4355 12.8057 13.3066 12.999C13.1777 13.1924 13.0078 13.3301 12.7969 13.4121C12.7383 13.4473 12.6709 13.4707 12.5947 13.4824C12.5186 13.4941 12.4453 13.5 12.375 13.5H5.625C5.30859 13.5 5.04199 13.3916 4.8252 13.1748C4.6084 12.958 4.5 12.6914 4.5 12.375C4.5 12.0586 4.6084 11.792 4.8252 11.5752C5.04199 11.3584 5.30859 11.25 5.625 11.25H9.65039L0.333984 1.91602C0.216797 1.81055 0.131836 1.6875 0.0791016 1.54688C0.0263672 1.40625 0 1.26562 0 1.125C0 0.984375 0.0263672 0.84375 0.0791016 0.703125C0.131836 0.5625 0.216797 0.439453 0.333984 0.333984C0.544922 0.111328 0.808594 0 1.125 0C1.44141 0 1.70508 0.111328 1.91602 0.333984Z"
      fill="white"
    />
  </svg>
);

type Top3Card = (typeof TOP3_CARDS)[number];

const Top3ReputationCard = ({ card }: { card: Top3Card }) => (
  <div className={`c5card c5card--${card.variant} c5card--${card.position}`}>
    <img className="c5card__img" src={card.image} alt="" />
    <div className="c5card__date">{TOP3_CARD_DATE}</div>
    <div className="c5card__cat">{card.category}</div>

    <div className="c5card__panel">
      <div className="c5card__profile">
        <img className="c5card__avatar" src={card.avatar} alt="" />
        <div className="c5card__ident">
          <p className="c5card__idrow">
            <span className="c5card__b">김미현</span>
            <span className="c5card__sep">|</span>
            <span className="c5card__m">여</span>
            <span className="c5card__sep">|</span>
            <span className="c5card__m">24</span>
            <span className="c5card__sep">|</span>
            <span>
              <span className="c5card__b">서울대</span>
              <span className="c5card__r">학교</span>
            </span>
            <span className="c5card__sep">|</span>
            <span>
              <span className="c5card__b">미디어커뮤니케이션</span>
              <span className="c5card__r">학과</span>
            </span>
          </p>
          <p className="c5card__idrow">
            <span>
              <span className="c5card__b">엔터테인먼트 </span>
              <span className="c5card__r">팀</span>
            </span>
            <span className="c5card__sep">|</span>
            <span>
              <span className="c5card__b">내돈내산 </span>
              <span className="c5card__r">파트</span>
            </span>
            <span className="c5card__sep">|</span>
            <span className="c5card__b">엔비디아구글테슬라쿵</span>
          </p>
        </div>
      </div>

      <div className="c5card__stars">
        <span className="c5card__starset">
          {TOP3_CARD_STARS.map((kind, i) => {
            const Icon = STAR_ICONS[kind];
            return <Icon key={`${card.key}-star-${i}`} />;
          })}
        </span>
        <span className="c5card__score">6 / 10</span>
      </div>

      <div className="c5card__tags">
        {TOP3_CARD_TAGS.map((tag) => (
          <span key={tag.key} className={`c5card__tag c5card__tag--${tag.tone}`}>
            {tag.label}
          </span>
        ))}
      </div>

      <p className="c5card__text">{card.text}</p>
      {/* 화살표는 .c5card__text의 자식이 아니라 패널의 형제여야 한다 —
          Figma 좌표(345,115 / 379,129)가 패널 기준이라 텍스트 박스 안에
          두면 기준점이 텍스트 박스로 바뀌어 오른쪽/아래로 밀린다. */}
      <span className="c5card__arrow">
        <ArrowIcon />
      </span>

      <div className="c5card__fm">
        <span className="c5card__fm-link">
          <FmIcon />
          <span className="c5card__fm-label">명성도 : </span>
          <span className="c5card__fm-value">325</span>
          <span className="c5card__fm-label"> FM</span>
        </span>
        <span className="c5card__fm-divider" />
      </div>
    </div>
  </div>
);

// =====================================================================
// Section 5 데이터 / 아이콘 — 전부 Figma placeholder 원문 그대로의 정적
// 마크업이다(히어로·통계 바·Keyword Map·TOP3와 동일 정책). 평판/멘션 API를
// 새로 붙이지 않는다 — 실데이터 연동은 별도 지시가 있을 때 진행한다.
const MENTION_STATS = [
  {
    key: "comment",
    icon: "/images/0/cluster5/mention/pill-cards.png",
    iconHeight: "4.0449cqw", // 54px
    num: "2 ",
    rest: "/ 10 comment",
  },
  {
    key: "mail",
    icon: "/images/0/cluster5/mention/pill-mail.png",
    iconHeight: "4.1948cqw", // 56px
    num: "- ",
    rest: "/ - comment",
  },
  {
    key: "fm",
    icon: "/images/0/cluster5/mention/pill-hearts.png",
    iconHeight: "3.8951cqw", // 52px
    num: "103",
    rest: " FM",
    tight: true, // Figma: 이 pill 만 line-height 19px
  },
] as const;

const MENTION_CARDS = [
  {
    key: "m1",
    photo: "/images/0/cluster5/mention/card-1.png",
    avatar: "/images/0/cluster5/mention/avatar-1.png",
  },
  {
    key: "m2",
    photo: "/images/0/cluster5/mention/card-2.png",
    avatar: "/images/0/cluster5/mention/avatar-2.png",
  },
  {
    key: "m3",
    photo: "/images/0/cluster5/mention/card-3.png",
    avatar: "/images/0/cluster5/mention/avatar-3.png",
  },
] as const;

const MENTION_CARD_KIND = "시니어평판";
const MENTION_CARD_DATE = "2025 - 08 - 01 (월)";
const MENTION_CARD_TEXT =
  "기업/실무자 멘션은 40자 입니다 40자는 실무자가 작성하고 평가하는 것...";
const MENTION_CARD_TAGS = [
  { key: "t1", label: "#추진력추진력추", tone: "lime" as const },
  { key: "t2", label: "#신속함신속함함", tone: "purple" as const },
  { key: "t3", label: "#리더쉽리더쉽쉽", tone: "pink" as const },
];

// Figma export SVG 원본 path 그대로 인라인(Section 2~4와 동일 기법).
// 인증 배지는 Figma에서 배지 도형(#DDF247)과 체크(#161616) 두 레이어가
// 겹쳐 있다 — 두 좌표차(4.902, 6.113)를 translate 로 흡수해 한 벌의 svg 로 합쳤다.
const MentionBadgeIcon = () => (
  <svg viewBox="0 0 18.75 18.75" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M18.75 9.375C18.75 8.97135 18.5775 8.59701 18.2324 8.25195C17.8874 7.9069 17.6693 7.55208 17.5781 7.1875C17.474 6.79688 17.4837 6.36719 17.6074 5.89844C17.7311 5.42969 17.6953 5.02604 17.5 4.6875C17.3047 4.34896 16.9694 4.11458 16.4941 3.98438C16.0189 3.85417 15.6445 3.65234 15.3711 3.37891C15.0977 3.10547 14.8958 2.73112 14.7656 2.25586C14.6354 1.7806 14.401 1.44531 14.0625 1.25C13.724 1.05469 13.3203 1.01888 12.8516 1.14258C12.3828 1.26628 11.9531 1.27604 11.5625 1.17188C11.1979 1.08073 10.8431 0.86263 10.498 0.517578C10.153 0.172526 9.77865 0 9.375 0C8.97135 0 8.59701 0.172526 8.25195 0.517578C7.9069 0.86263 7.55208 1.08073 7.1875 1.17188C6.79688 1.27604 6.36719 1.26628 5.89844 1.14258C5.42969 1.01888 5.02604 1.05469 4.6875 1.25C4.34896 1.44531 4.11458 1.7806 3.98438 2.25586C3.85417 2.73112 3.65234 3.10547 3.37891 3.37891C3.10547 3.65234 2.73112 3.85417 2.25586 3.98438C1.7806 4.11458 1.44531 4.34896 1.25 4.6875C1.05469 5.02604 1.01888 5.42969 1.14258 5.89844C1.26628 6.36719 1.27604 6.79688 1.17188 7.1875C1.08073 7.55208 0.86263 7.9069 0.517578 8.25195C0.172526 8.59701 0 8.97135 0 9.375C0 9.77865 0.172526 10.153 0.517578 10.498C0.86263 10.8431 1.08073 11.1979 1.17188 11.5625C1.27604 11.9531 1.26628 12.3828 1.14258 12.8516C1.01888 13.3203 1.05469 13.724 1.25 14.0625C1.44531 14.401 1.7806 14.6354 2.25586 14.7656C2.73112 14.8958 3.10547 15.0977 3.37891 15.3711C3.65234 15.6445 3.85417 16.0189 3.98438 16.4941C4.11458 16.9694 4.34896 17.3047 4.6875 17.5C5.02604 17.6953 5.42969 17.7311 5.89844 17.6074C6.36719 17.4837 6.79688 17.474 7.1875 17.5781C7.55208 17.6693 7.9069 17.8874 8.25195 18.2324C8.59701 18.5775 8.97135 18.75 9.375 18.75C9.77865 18.75 10.153 18.5775 10.498 18.2324C10.8431 17.8874 11.1979 17.6693 11.5625 17.5781C11.9531 17.474 12.3828 17.4837 12.8516 17.6074C13.3203 17.7311 13.724 17.6953 14.0625 17.5C14.401 17.3047 14.6354 16.9694 14.7656 16.4941C14.8958 16.0189 15.0977 15.6445 15.3711 15.3711C15.6445 15.0977 16.0189 14.8958 16.4941 14.7656C16.9694 14.6354 17.3047 14.401 17.5 14.0625C17.6953 13.724 17.7311 13.3203 17.6074 12.8516C17.4837 12.3828 17.474 11.9531 17.5781 11.5625C17.6693 11.1979 17.8874 10.8431 18.2324 10.498C18.5775 10.153 18.75 9.77865 18.75 9.375Z"
      fill="#DDF247"
    />
    <path
      transform="translate(4.902 6.113)"
      d="M7.1875 6.05469L3.61328 2.48047L1.75781 4.33594C1.66667 4.42708 1.55924 4.4987 1.43555 4.55078C1.31185 4.60286 1.17839 4.62891 1.03516 4.62891C0.904948 4.62891 0.77474 4.60286 0.644531 4.55078C0.514323 4.4987 0.403646 4.42708 0.3125 4.33594C0.208333 4.24479 0.130208 4.13411 0.078125 4.00391C0.0260417 3.8737 0 3.74349 0 3.61328C0 3.47005 0.0260417 3.33659 0.078125 3.21289C0.130208 3.08919 0.208333 2.98177 0.3125 2.89062L2.91016 0.292969C3.0013 0.188802 3.10872 0.113932 3.23242 0.0683594C3.35612 0.0227865 3.48307 0 3.61328 0C3.74349 0 3.87044 0.0227865 3.99414 0.0683594C4.11784 0.113932 4.22526 0.188802 4.31641 0.292969L8.63281 4.60938C8.73698 4.70052 8.8151 4.80794 8.86719 4.93164C8.91927 5.05534 8.94531 5.1888 8.94531 5.33203C8.94531 5.46224 8.91927 5.59245 8.86719 5.72266C8.8151 5.85286 8.73698 5.96354 8.63281 6.05469C8.58073 6.10677 8.52865 6.15234 8.47656 6.19141C8.42448 6.23047 8.36589 6.25651 8.30078 6.26953C8.23568 6.29557 8.17057 6.3151 8.10547 6.32812C8.04036 6.34115 7.97526 6.34766 7.91016 6.34766C7.84505 6.34766 7.77995 6.34115 7.71484 6.32812C7.64974 6.3151 7.58464 6.29557 7.51953 6.26953C7.45443 6.25651 7.39258 6.23047 7.33398 6.19141C7.27539 6.15234 7.22656 6.10677 7.1875 6.05469Z"
      fill="#161616"
    />
  </svg>
);

const MentionShareIcon = () => (
  <svg viewBox="0 0 18.0064 21.0004" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M14.25 7.50276C14 7.50276 13.7539 7.47932 13.5117 7.43244C13.2695 7.38557 13.0312 7.30744 12.7969 7.19807C12.5625 7.10432 12.3438 6.98713 12.1406 6.84651C11.9375 6.70588 11.7422 6.54963 11.5547 6.37776L7.24219 9.14338C7.41406 9.58088 7.5 10.034 7.5 10.5028C7.5 10.9715 7.41406 11.4246 7.24219 11.8621L11.5547 14.6278C11.8828 14.2996 12.2578 14.0379 12.6797 13.8426C13.1016 13.6473 13.5469 13.534 14.0156 13.5028C14.4844 13.4871 14.9375 13.5457 15.375 13.6785C15.8125 13.8114 16.2188 14.0262 16.5938 14.3231C16.9531 14.6199 17.25 14.9676 17.4844 15.366C17.7188 15.7645 17.875 16.1903 17.9531 16.6434C18.0312 17.1121 18.0234 17.5731 17.9297 18.0262C17.8359 18.4793 17.6641 18.9012 17.4141 19.2918C17.1484 19.6824 16.8281 20.0145 16.4531 20.2879C16.0781 20.5614 15.6719 20.7606 15.2344 20.8856C14.7812 20.9949 14.3242 21.0262 13.8633 20.9793C13.4023 20.9324 12.9609 20.8074 12.5391 20.6043C12.1328 20.3856 11.7734 20.1043 11.4609 19.7606C11.1484 19.4168 10.9063 19.0262 10.7344 18.5887C10.5781 18.1512 10.5 17.702 10.5 17.241C10.5 16.7801 10.5859 16.3309 10.7578 15.8934L6.42188 13.1278C6.17187 13.3934 5.88281 13.616 5.55469 13.7957C5.22656 13.9754 4.88281 14.1043 4.52344 14.1824C4.14844 14.2606 3.77734 14.2801 3.41016 14.241C3.04297 14.202 2.6875 14.1121 2.34375 13.9715C1.98438 13.8309 1.66016 13.6434 1.37109 13.409C1.08203 13.1746 0.835938 12.9012 0.632812 12.5887C0.429687 12.2918 0.273437 11.9637 0.164062 11.6043C0.0546875 11.2449 0 10.8778 0 10.5028C0 10.1278 0.0546875 9.76448 0.164062 9.41291C0.273437 9.06135 0.429687 8.72932 0.632812 8.41682C0.835938 8.10432 1.08203 7.83088 1.37109 7.59651C1.66016 7.36213 1.98438 7.17463 2.34375 7.03401C2.6875 6.89338 3.04297 6.80744 3.41016 6.77619C3.77734 6.74494 4.14844 6.76057 4.52344 6.82307C4.88281 6.90119 5.22656 7.0301 5.55469 7.20979C5.88281 7.38948 6.17187 7.61213 6.42188 7.87776L10.7578 5.11213C10.6172 4.73713 10.5352 4.35041 10.5117 3.95198C10.4883 3.55354 10.5313 3.15901 10.6406 2.76838C10.7344 2.37776 10.8945 2.01838 11.1211 1.69026C11.3477 1.36213 11.6172 1.07307 11.9297 0.82307C12.2422 0.57307 12.5859 0.377757 12.9609 0.237132C13.3359 0.0965074 13.7188 0.0183824 14.1094 0.00275735C14.5156 -0.0128676 14.9102 0.0379136 15.293 0.155101C15.6758 0.272289 16.0312 0.440257 16.3594 0.659007C16.7031 0.893382 16.9961 1.16682 17.2383 1.47932C17.4805 1.79182 17.6641 2.13557 17.7891 2.51057C17.9297 2.90119 18 3.29573 18 3.69416C18 4.0926 17.9453 4.47932 17.8359 4.85432C17.7109 5.24494 17.5352 5.60432 17.3086 5.93244C17.082 6.26057 16.8047 6.54182 16.4766 6.77619C16.1484 7.01057 15.7969 7.19026 15.4219 7.31526C15.0469 7.44026 14.6563 7.50276 14.25 7.50276ZM14.25 19.5028C14.4687 19.5028 14.6836 19.4715 14.8945 19.409C15.1055 19.3465 15.3047 19.2528 15.4922 19.1278C15.6797 19.0028 15.8438 18.8543 15.9844 18.6824C16.125 18.5106 16.2422 18.3231 16.3359 18.1199C16.4141 17.9168 16.4648 17.702 16.4883 17.4754C16.5117 17.2489 16.5 17.0262 16.4531 16.8074C16.4062 16.5887 16.332 16.3817 16.2305 16.1864C16.1289 15.991 16 15.8153 15.8438 15.659C15.6875 15.5028 15.5117 15.3739 15.3164 15.2723C15.1211 15.1707 14.9141 15.0965 14.6953 15.0496C14.4766 15.0028 14.2539 14.991 14.0273 15.0145C13.8008 15.0379 13.5859 15.0887 13.3828 15.1668C13.1797 15.2606 12.9922 15.3778 12.8203 15.5184C12.6484 15.659 12.5 15.8231 12.375 16.0106C12.25 16.1981 12.1563 16.3973 12.0938 16.6082C12.0312 16.8192 12 17.034 12 17.2528C12 17.5496 12.0586 17.8348 12.1758 18.1082C12.293 18.3817 12.4531 18.6278 12.6562 18.8465C12.875 19.0496 13.1211 19.2098 13.3945 19.327C13.668 19.4442 13.9531 19.5028 14.25 19.5028ZM3.75 8.25276C3.53125 8.25276 3.3125 8.28401 3.09375 8.34651C2.875 8.40901 2.67969 8.50276 2.50781 8.62776C2.32031 8.75276 2.15625 8.90119 2.01562 9.07307C1.875 9.24494 1.75781 9.43244 1.66406 9.63557C1.58594 9.83869 1.53516 10.0535 1.51172 10.2801C1.48828 10.5067 1.5 10.7293 1.54688 10.9481C1.59375 11.1668 1.66797 11.3739 1.76953 11.5692C1.87109 11.7645 2 11.9403 2.15625 12.0965C2.3125 12.2528 2.48828 12.3817 2.68359 12.4832C2.87891 12.5848 3.08594 12.659 3.30469 12.7059C3.52344 12.7528 3.74609 12.7645 3.97266 12.741C4.19922 12.7176 4.41406 12.6668 4.61719 12.5887C4.82031 12.4949 5.00781 12.3778 5.17969 12.2371C5.35156 12.0965 5.5 11.9324 5.625 11.7449C5.75 11.5731 5.84375 11.3778 5.90625 11.159C5.96875 10.9403 6 10.7215 6 10.5028C6 10.2059 5.94141 9.92073 5.82422 9.64729C5.70703 9.37385 5.54688 9.12776 5.34375 8.90901C5.125 8.70588 4.87891 8.54573 4.60547 8.42854C4.33203 8.31135 4.04688 8.25276 3.75 8.25276ZM14.25 1.50276C14.0313 1.50276 13.8125 1.53401 13.5938 1.59651C13.375 1.65901 13.1797 1.75276 13.0078 1.87776C12.8203 2.00276 12.6562 2.15119 12.5156 2.32307C12.375 2.49494 12.2578 2.68244 12.1641 2.88557C12.0859 3.08869 12.0352 3.30354 12.0117 3.5301C11.9883 3.75666 12 3.97932 12.0469 4.19807C12.0938 4.41682 12.168 4.62385 12.2695 4.81916C12.3711 5.01448 12.5 5.19026 12.6562 5.34651C12.8125 5.50276 12.9883 5.63166 13.1836 5.73323C13.3789 5.83479 13.5859 5.90901 13.8047 5.95588C14.0234 6.00276 14.2461 6.01448 14.4727 5.99104C14.6992 5.9676 14.9141 5.91682 15.1172 5.83869C15.3203 5.74494 15.5078 5.62776 15.6797 5.48713C15.8516 5.34651 16 5.18244 16.125 4.99494C16.25 4.82307 16.3437 4.62776 16.4062 4.40901C16.4688 4.19026 16.5 3.97151 16.5 3.75276C16.5 3.45588 16.4414 3.17073 16.3242 2.89729C16.207 2.62385 16.0469 2.37776 15.8438 2.15901C15.625 1.95588 15.3789 1.79573 15.1055 1.67854C14.832 1.56135 14.5469 1.50276 14.25 1.50276Z"
      fill="#919191"
    />
  </svg>
);

const MentionMoreIcon = () => (
  <svg viewBox="0 0 21 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M10.5 6C10.2031 6 9.91406 5.95703 9.63281 5.87109C9.35156 5.78516 9.08594 5.65625 8.83594 5.48438C8.58594 5.32813 8.36719 5.13672 8.17969 4.91016C7.99219 4.68359 7.84375 4.42969 7.73438 4.14844C7.60937 3.86719 7.53516 3.58203 7.51172 3.29297C7.48828 3.00391 7.5 2.71094 7.54688 2.41406C7.60938 2.11719 7.71094 1.83984 7.85156 1.58203C7.99219 1.32422 8.16406 1.08594 8.36719 0.867188C8.58594 0.664062 8.82422 0.492188 9.08203 0.351562C9.33984 0.210938 9.61719 0.109375 9.91406 0.046875C10.2109 0 10.5039 -0.0117188 10.793 0.0117188C11.082 0.0351562 11.3672 0.109375 11.6484 0.234375C11.9297 0.34375 12.1836 0.492188 12.4102 0.679688C12.6367 0.867188 12.8281 1.08594 12.9844 1.33594C13.1563 1.58594 13.2852 1.85156 13.3711 2.13281C13.457 2.41406 13.5 2.70312 13.5 3C13.5 3.39062 13.4258 3.77344 13.2773 4.14844C13.1289 4.52344 12.9141 4.85156 12.6328 5.13281C12.3516 5.41406 12.0234 5.62891 11.6484 5.77734C11.2734 5.92578 10.8906 6 10.5 6ZM10.5 1.5C10.3594 1.5 10.2148 1.52344 10.0664 1.57031C9.91797 1.61719 9.78125 1.67969 9.65625 1.75781C9.54688 1.83594 9.44531 1.93359 9.35156 2.05078C9.25781 2.16797 9.17969 2.29688 9.11719 2.4375C9.05469 2.5625 9.01563 2.69922 9 2.84766C8.98437 2.99609 8.99219 3.14062 9.02344 3.28125C9.05469 3.4375 9.10547 3.58203 9.17578 3.71484C9.24609 3.84766 9.33594 3.96094 9.44531 4.05469C9.53906 4.16406 9.65234 4.25391 9.78516 4.32422C9.91797 4.39453 10.0625 4.44531 10.2188 4.47656C10.3594 4.50781 10.5039 4.51563 10.6523 4.5C10.8008 4.48437 10.9375 4.44531 11.0625 4.38281C11.2031 4.32031 11.332 4.24219 11.4492 4.14844C11.5664 4.05469 11.6641 3.95312 11.7422 3.84375C11.8203 3.71875 11.8828 3.58203 11.9297 3.43359C11.9766 3.28516 12 3.14062 12 3C12 2.79687 11.9609 2.60547 11.8828 2.42578C11.8047 2.24609 11.6953 2.08594 11.5547 1.94531C11.4141 1.80469 11.2539 1.69531 11.0742 1.61719C10.8945 1.53906 10.7031 1.5 10.5 1.5ZM3 6C2.70312 6 2.41406 5.95703 2.13281 5.87109C1.85156 5.78516 1.58594 5.65625 1.33594 5.48438C1.08594 5.32813 0.867188 5.13672 0.679688 4.91016C0.492188 4.68359 0.34375 4.42969 0.234375 4.14844C0.109375 3.86719 0.0351562 3.58203 0.0117188 3.29297C-0.0117188 3.00391 0 2.71094 0.046875 2.41406C0.109375 2.11719 0.210938 1.83984 0.351562 1.58203C0.492188 1.32422 0.664062 1.08594 0.867188 0.867188C1.08594 0.664062 1.32422 0.492188 1.58203 0.351562C1.83984 0.210938 2.11719 0.109375 2.41406 0.046875C2.71094 0 3.00391 -0.0117188 3.29297 0.0117188C3.58203 0.0351562 3.86719 0.109375 4.14844 0.234375C4.42969 0.34375 4.68359 0.492188 4.91016 0.679688C5.13672 0.867188 5.32813 1.08594 5.48438 1.33594C5.65625 1.58594 5.78516 1.85156 5.87109 2.13281C5.95703 2.41406 6 2.70312 6 3C6 3.39062 5.92578 3.77344 5.77734 4.14844C5.62891 4.52344 5.41406 4.85156 5.13281 5.13281C4.85156 5.41406 4.52344 5.62891 4.14844 5.77734C3.77344 5.92578 3.39062 6 3 6ZM3 1.5C2.85938 1.5 2.71484 1.52344 2.56641 1.57031C2.41797 1.61719 2.28125 1.67969 2.15625 1.75781C2.04688 1.83594 1.94531 1.93359 1.85156 2.05078C1.75781 2.16797 1.67969 2.29688 1.61719 2.4375C1.55469 2.5625 1.51563 2.69922 1.5 2.84766C1.48437 2.99609 1.49219 3.14062 1.52344 3.28125C1.55469 3.4375 1.60547 3.58203 1.67578 3.71484C1.74609 3.84766 1.83594 3.96094 1.94531 4.05469C2.03906 4.16406 2.15234 4.25391 2.28516 4.32422C2.41797 4.39453 2.5625 4.44531 2.71875 4.47656C2.85938 4.50781 3.00391 4.51563 3.15234 4.5C3.30078 4.48437 3.4375 4.44531 3.5625 4.38281C3.70312 4.32031 3.83203 4.24219 3.94922 4.14844C4.06641 4.05469 4.16406 3.95312 4.24219 3.84375C4.32031 3.71875 4.38281 3.58203 4.42969 3.43359C4.47656 3.28516 4.5 3.14062 4.5 3C4.5 2.79687 4.46094 2.60547 4.38281 2.42578C4.30469 2.24609 4.19531 2.08594 4.05469 1.94531C3.91406 1.80469 3.75391 1.69531 3.57422 1.61719C3.39453 1.53906 3.20313 1.5 3 1.5ZM18 6C17.7031 6 17.4141 5.95703 17.1328 5.87109C16.8516 5.78516 16.5859 5.65625 16.3359 5.48438C16.0859 5.32813 15.8672 5.13672 15.6797 4.91016C15.4922 4.68359 15.3437 4.42969 15.2344 4.14844C15.1094 3.86719 15.0352 3.58203 15.0117 3.29297C14.9883 3.00391 15 2.71094 15.0469 2.41406C15.1094 2.11719 15.2109 1.83984 15.3516 1.58203C15.4922 1.32422 15.6641 1.08594 15.8672 0.867188C16.0859 0.664062 16.3242 0.492188 16.582 0.351562C16.8398 0.210938 17.1172 0.109375 17.4141 0.046875C17.7109 0 18.0039 -0.0117188 18.293 0.0117188C18.582 0.0351562 18.8672 0.109375 19.1484 0.234375C19.4297 0.34375 19.6836 0.492188 19.9102 0.679688C20.1367 0.867188 20.3281 1.08594 20.4844 1.33594C20.6563 1.58594 20.7852 1.85156 20.8711 2.13281C20.957 2.41406 21 2.70312 21 3C21 3.39062 20.9258 3.77344 20.7773 4.14844C20.6289 4.52344 20.4141 4.85156 20.1328 5.13281C19.8516 5.41406 19.5234 5.62891 19.1484 5.77734C18.7734 5.92578 18.3906 6 18 6ZM18 1.5C17.8594 1.5 17.7148 1.52344 17.5664 1.57031C17.418 1.61719 17.2813 1.67969 17.1562 1.75781C17.0469 1.83594 16.9453 1.93359 16.8516 2.05078C16.7578 2.16797 16.6797 2.29688 16.6172 2.4375C16.5547 2.5625 16.5156 2.69922 16.5 2.84766C16.4844 2.99609 16.4922 3.14062 16.5234 3.28125C16.5547 3.4375 16.6055 3.58203 16.6758 3.71484C16.7461 3.84766 16.8359 3.96094 16.9453 4.05469C17.0391 4.16406 17.1523 4.25391 17.2852 4.32422C17.418 4.39453 17.5625 4.44531 17.7188 4.47656C17.8594 4.50781 18.0039 4.51563 18.1523 4.5C18.3008 4.48437 18.4375 4.44531 18.5625 4.38281C18.7031 4.32031 18.832 4.24219 18.9492 4.14844C19.0664 4.05469 19.1641 3.95312 19.2422 3.84375C19.3203 3.71875 19.3828 3.58203 19.4297 3.43359C19.4766 3.28516 19.5 3.14062 19.5 3C19.5 2.79687 19.4609 2.60547 19.3828 2.42578C19.3047 2.24609 19.1953 2.08594 19.0547 1.94531C18.9141 1.80469 18.7539 1.69531 18.5742 1.61719C18.3945 1.53906 18.2031 1.5 18 1.5Z"
      fill="#919191"
    />
  </svg>
);

// Figma "Arrow / Arrow_Circle_Down" 인스턴스. stroke 가 정확히 #FAAB07
// (= marketing.themeColor) 이므로 org accent 로 치환한다.
const MentionScrollIcon = () => (
  <svg viewBox="0 0 30.5 29.75" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M20 16.4167L15.25 21.0417L10.5 16.4167M15.25 21.0417V8.70833M29.5 14.875C29.5 7.21205 23.1201 1 15.25 1C7.37994 1 1 7.21205 1 14.875C1 22.538 7.37994 28.75 15.25 28.75C23.1201 28.75 29.5 22.538 29.5 14.875Z"
      stroke="var(--cluster5-accent, #faab07)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MentionHeartIcon = () => (
  <svg viewBox="0 0 13 11.1465" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M12.0732 7.74414C12.0732 8.76823 11.7939 9.43685 11.2354 9.75C10.6768 10.0632 10.1097 10.2197 9.53418 10.2197C9.26335 10.2197 8.98828 10.1562 8.70898 10.0293C8.42969 9.90234 8.16943 9.75212 7.92822 9.57861C7.68701 9.40511 7.47331 9.22526 7.28711 9.03906C7.09245 8.85286 6.94857 8.70475 6.85547 8.59473C6.77083 8.49316 6.65234 8.44238 6.5 8.44238C6.34766 8.44238 6.22917 8.49316 6.14453 8.59473C6.05143 8.70475 5.90755 8.85286 5.71289 9.03906C5.52669 9.22526 5.31299 9.40511 5.07178 9.57861C4.83057 9.75212 4.57031 9.90234 4.29102 10.0293C4.01172 10.1562 3.73665 10.2197 3.46582 10.2197C2.8903 10.2197 2.32324 10.0632 1.76465 9.75C1.20605 9.43685 0.926758 8.76823 0.926758 7.74414C0.926758 7.41406 0.998698 7.09668 1.14258 6.79199C1.27799 6.47884 1.43034 6.20378 1.59961 5.9668C1.76888 5.72982 1.92546 5.53939 2.06934 5.39551C2.21322 5.25163 2.28516 5.17546 2.28516 5.16699L6.5 1.10449L10.7021 5.16699C10.7106 5.17546 10.7868 5.25163 10.9307 5.39551C11.0745 5.53939 11.2311 5.72982 11.4004 5.9668C11.5697 6.20378 11.722 6.47884 11.8574 6.79199C12.0013 7.09668 12.0732 7.41406 12.0732 7.74414ZM13 7.74414C13 7.3125 12.9154 6.90202 12.7461 6.5127C12.5853 6.12337 12.4012 5.7806 12.1938 5.48438C11.9865 5.18815 11.7982 4.95117 11.6289 4.77344C11.4512 4.5957 11.3538 4.49837 11.3369 4.48145L6.81738 0.126953C6.77507 0.0846354 6.7264 0.0528971 6.67139 0.0317383C6.61637 0.0105794 6.55924 0 6.5 0C6.44076 0 6.38363 0.0105794 6.32861 0.0317383C6.2736 0.0528971 6.22493 0.0846354 6.18262 0.126953L1.65039 4.49414C1.64193 4.51107 1.54883 4.6084 1.37109 4.78613C1.19336 4.96387 1.00293 5.19873 0.799805 5.49072C0.59668 5.78271 0.414714 6.12337 0.253906 6.5127C0.0846354 6.90202 0 7.3125 0 7.74414C0 8.27734 0.0804036 8.75553 0.241211 9.17871C0.393555 9.59342 0.619954 9.94678 0.92041 10.2388C1.22087 10.5308 1.58268 10.7529 2.00586 10.9053C2.4375 11.0661 2.92415 11.1465 3.46582 11.1465C4.10059 11.1465 4.69303 10.9561 5.24316 10.5752C5.79329 10.1943 6.21224 9.86003 6.5 9.57227C6.78776 9.86003 7.20671 10.1943 7.75684 10.5752C8.30697 10.9561 8.89941 11.1465 9.53418 11.1465C10.0758 11.1465 10.5625 11.0661 10.9941 10.9053C11.4173 10.7529 11.7791 10.5308 12.0796 10.2388C12.38 9.94678 12.6064 9.59342 12.7588 9.17871C12.9196 8.75553 13 8.27734 13 7.74414Z"
      fill="white"
    />
  </svg>
);

// 명성도 다이아 아이콘 (Figma Component 1 variant 13).
const MentionFmIcon = () => (
  <svg viewBox="0 0 9.8125 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M0 7.84375L4.90625 16L9.8125 7.84375L4.90625 4.95312L0 7.84375ZM0 6.92188L4.90625 4.01562L9.8125 6.92188L4.90625 0L0 6.92188Z"
      fill="white"
    />
  </svg>
);

type MentionCard = (typeof MENTION_CARDS)[number];

const MentionReputationCard = ({ card }: { card: MentionCard }) => (
  <div className="c5mcard">
    <div className="c5mcard__row">
      <img className="c5mcard__photo" src={card.photo} alt="" />
      <div className="c5mcard__info">
        <div className="c5mcard__top">
          <div className="c5mcard__body">
            <div className="c5mcard__head">
              <span className="c5mcard__kind">{MENTION_CARD_KIND}</span>
              <span className="c5mcard__date">{MENTION_CARD_DATE}</span>
            </div>
            <p className="c5mcard__text">{MENTION_CARD_TEXT}</p>
            {/* Figma 좌표(170, 55)는 배지행+본문을 감싸는 프레임 기준이라
                .c5mcard__body 를 기준 컨테이너로 둔다(텍스트 박스 안이 아님). */}
            <span className="c5mcard__go">
              <ArrowIcon />
            </span>
          </div>

          <div className="c5mcard__profile">
            <div className="c5mcard__profile-row">
              <img className="c5mcard__avatar" src={card.avatar} alt="" />
              <div className="c5mcard__ident">
                <p className="c5mcard__idrow">
                  <span>조지 워싱턴</span>
                  <span className="c5mcard__sep">|</span>
                  <span>직무직무직무직무열자</span>
                </p>
                <p className="c5mcard__idrow">
                  <span>기업명기업명기업명</span>
                  <span className="c5mcard__sep">|</span>
                  <span>직급직급직여덟자</span>
                </p>
              </div>
            </div>
          </div>

          <div className="c5mcard__tags">
            {MENTION_CARD_TAGS.map((tag) => (
              <span key={tag.key} className={`c5mcard__tag c5mcard__tag--${tag.tone}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        {/* Figma Frame 2121457659 — 정보 컬럼(250x234) 안에서 justify-between
            의 아래쪽 블록이다. 카드 루트의 형제로 두면 카드 높이(258)가 무너진다. */}
        <div className="c5mcard__bottom">
          <div className="c5mcard__stars">
            <span className="c5mcard__starset">
              {TOP3_CARD_STARS.map((kind, i) => {
                const Icon = STAR_ICONS[kind];
                return <Icon key={`${card.key}-star-${i}`} />;
              })}
            </span>
            <span className="c5mcard__score">6 / 10</span>
          </div>
          <div className="c5mcard__fmrow">
            <span className="c5mcard__fm-label">명성도</span>
            <span className="c5mcard__fm">
              <MentionFmIcon />
              <span className="c5mcard__fm-value">{"350  FM"}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <span className="c5mcard__like" aria-hidden="true">
      <MentionHeartIcon />
    </span>
  </div>
);

const Cluster5Content = () => {
  // org 계산 SoT: lib/cluster-route.ts resolveOrgFromLocation (?org= 쿼리
  // 우선, 그다음 canonical 경로 suffix, 둘 다 없으면 null → marketing 폴백).
  // /cluster-5-entertainment, /cluster-5-planning 등 실제 pathname 진입도
  // 쿼리 없이 이 경로만으로 정확한 org를 받는다. 일반 사용자와
  // mode=test/actAsTestUserId/demoUserId는 이 값에 전혀 관여하지 않는
  // 쿼리들이므로 자동으로 동일 경로를 탄다(별도 분기 없음).
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const org = resolveOrgFromLocation(pathname, searchParams.get("org")) ?? "marketing";
  const orgConfig = ORGANIZATION_CONFIG[org];

  const orgVars = {
    "--cluster5-accent": orgConfig.themeColor,
    "--cluster5-accent-soft": orgConfig.accentSoft,
  } as React.CSSProperties;

  return (
    <>
      <style>{heroStyles}</style>
      <style>{keywordSectionStyles}</style>
      <style>{statsSectionStyles}</style>
      <style>{galleryBannerSectionStyles}</style>
      <style>{top3SectionStyles}</style>
      <style>{top3CardsSectionStyles}</style>
      <style>{mentionSectionStyles}</style>
      <style>{mentionCardsStyles}</style>
      <style>{sectionSpacingStyles}</style>
      <div className="cluster5-sections">
        <section className="cluster5-hero" style={orgVars}>
          <div className="cluster5-hero__bg" aria-hidden="true" />
          <div className="cluster5-hero__scrim" aria-hidden="true" />
          <div className="cluster5-hero__content">
            <h2 className="cluster5-hero__title-shadow" aria-hidden="true">
              Societal Reputation
            </h2>
            <h2 className="cluster5-hero__title">Societal Reputation</h2>

            <p className="cluster5-hero__line cluster5-hero__line--body cluster5-hero__line--l1">
              “오로지 타인에게서 받은 나의 ‘평판’ 이 취합되어 있습니다.
              <br />
              ‘내가 말하는 나’ 가 아닌, 타인의 객관적인 목소리로 나의 역량과 캐릭터를 보여주세요. 😊”
            </p>
            <p className="cluster5-hero__line cluster5-hero__line--body cluster5-hero__line--l4">
              이 세상 어느 누구도 나를 향한 비판과 지적을 듣기 싫지만, 그 이야기를 귀담아 듣고, 타인의 시각으로 나를 보는 것은 나를 진정으로 강하게 만드는 핵심입니다.
            </p>
            <p className="cluster5-hero__line cluster5-hero__line--body cluster5-hero__line--l6">
              내가 지킬 것이 있다면, 내가 강해져야 한다면.. 😊
              <br />
              타인의 시각과 비판을 들을 수 있는 황금같은 기회를 잡으세요.
            </p>
            <p className="cluster5-hero__line cluster5-hero__line--highlight">
              “자신의 잘못을 깨닫고 고치려 하는 자, 그가 바로 진정한 성인의 길에 이르는 자이다.”
            </p>
            <p className="cluster5-hero__line cluster5-hero__line--body cluster5-hero__line--attribution">
              -맹자-
            </p>
          </div>
        </section>

        <section className="cluster5-keyword" style={orgVars}>
          <div className="cluster5-keyword__bg" aria-hidden="true" />
          <div className="cluster5-keyword__scrim" aria-hidden="true" />

          <p className="cluster5-keyword__title">“Quid societati conferre potes?”</p>
          <p className="cluster5-keyword__subtitle">나는 우리 사회에 무엇으로 기여할 수 있을까?</p>

          <div className="cluster5-keyword__flower" aria-hidden="true">
            {KEYWORD_PETALS.map((petal) => (
              <svg
                key={petal.key}
                className="cluster5-keyword__petal"
                style={{ left: petal.left, top: petal.top, width: petal.width, height: petal.height }}
                viewBox={petal.viewBox}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d={petal.d}
                  className={`${petal.className} cluster5-keyword__petal-stroke`}
                />
              </svg>
            ))}
            {KEYWORD_COUNTS.map((count) => (
              <p
                key={count.key}
                className="cluster5-keyword__count"
                style={{ left: count.left, top: count.top }}
              >
                {count.value}
              </p>
            ))}
          </div>

          <p className="cluster5-keyword__label">Keyword Map</p>
          <div className="cluster5-keyword__placeholder">
            <p className="cluster5-keyword__placeholder-caption">
              워드클라우드 라이브러리 삽입 예정 (임배드)
            </p>
          </div>
        </section>

        {/* Figma 1068:22049 — 통계 바 뒤 라운드 패널(민트 리본 장식) + 바닥 구분선.
            상단은 Keyword Map 카드 뒤로 들어간다(음수 margin + z-index). */}
        <div className="cluster5-statspanel" style={orgVars}>
          <section className="cluster5-stats" aria-label="사회 명성도 통계">
            {CLUSTER5_STATS.map((stat) => (
              <div key={stat.key} className="cluster5-stats__item">
                <p className="cluster5-stats__value">
                  <span className="cluster5-stats__number">{stat.number}</span>
                  <span className="cluster5-stats__unit">{stat.unit}</span>
                </p>
                <p className="cluster5-stats__label">{stat.label}</p>
              </div>
            ))}
          </section>
          <div className="cluster5-statspanel__rule" aria-hidden="true" />
        </div>

        {/* Figma Group 2121454081 — 배너를 배경으로 깔고 그 위에 헤더가 겹친다.
            (카드 캐러셀 1068:24543 / 중앙 큰 카드 1068:24734 는 아직 미구현) */}
        <section className="cluster5-showcase" style={orgVars} aria-label="베스트 평판 TOP 3">
          <div className="cluster5-gallery" aria-hidden="true">
            <div className="cluster5-gallery__bg" />
            <div className="cluster5-gallery__scrim" />
            <div className="cluster5-gallery__actions">
              <div className="cluster5-gallery__icon-btn">
                <svg viewBox="0 0 11.6667 11.3907" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M5.83333 2.8907L0.5 8.22404V10.8907H11.1667M5.83333 2.8907L7.74575 0.978267L7.7469 0.977133C8.01016 0.713878 8.14202 0.582017 8.29402 0.532629C8.42792 0.489124 8.57216 0.489124 8.70605 0.532629C8.85795 0.581982 8.98966 0.713693 9.25254 0.976575L10.4124 2.13644C10.6764 2.40045 10.8085 2.53252 10.8579 2.68474C10.9014 2.81863 10.9014 2.96286 10.8579 3.09676C10.8085 3.24887 10.6766 3.38073 10.413 3.64437L10.4124 3.64493L8.49999 5.55736L3.16667 10.8907L0.5 10.8907M5.83333 2.8907L8.49999 5.55736"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="cluster5-gallery__icon-btn">
                <svg viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M7.16667 7.16667L10.5 10.5M4.38889 8.27778C2.24112 8.27778 0.5 6.53666 0.5 4.38889C0.5 2.24112 2.24112 0.5 4.38889 0.5C6.53666 0.5 8.27778 2.24112 8.27778 4.38889C8.27778 6.53666 6.53666 8.27778 4.38889 8.27778Z"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="cluster5-top3">
            <h2 className="cluster5-top3__title">The Best TOP 3</h2>
            <p className="cluster5-top3__subtitle">
              누군가의 말 한마디는, 평생을 걸쳐 이룩해내는 원동력이 될 수 있습니다.
              <br />
              내가 받은 최고의 평판은 무엇인가요?
              <br />
              마음과 심장에 새겨진 평판을 골라보자구요! 😊
            </p>
            <div className="cluster5-top3__actions">
              <div className="cluster5-top3__btn cluster5-top3__btn--primary">Discover more</div>
              <div className="cluster5-top3__btn cluster5-top3__btn--secondary">All collections 3</div>
            </div>
          </div>

          {/* Figma 1068:24543(좌/우 사이드 카드) — 부모 Container 폭 1316px에
              의해 우측 카드가 잘리는 것까지 overflow:hidden으로 재현 */}
          <div className="cluster5-cardrow">
            {TOP3_CARDS.filter((c) => c.variant === "side").map((card) => (
              <Top3ReputationCard key={card.key} card={card} />
            ))}
          </div>
          {/* Figma 1068:24734 — 가운데 큰 카드는 24543의 형제 노드라 클립 박스
              바깥에 두어야 잘리지 않는다(그룹 정중앙 561x690) */}
          {TOP3_CARDS.filter((c) => c.variant === "center").map((card) => (
            <Top3ReputationCard key={card.key} card={card} />
          ))}
        </section>

        {/* Figma Group 2121454071(1068:22090) + 형제 오버레이 Frame 2121457663
            (1068:22706) — Section 4와 동일하게 "배너를 배경으로 깔고 그 위에
            콘텐츠를 얹는" 합성이라 하나의 section 으로 묶는다. */}
        <section className="cluster5-mention" style={orgVars} aria-label="기업/실무자 Mention">
          <div className="cluster5-mention__banner">
            <div className="cluster5-mention__bg" aria-hidden="true" />
            <div className="cluster5-mention__scrim" aria-hidden="true" />

            <div className="cluster5-mention__header">
              <div className="cluster5-mention__heading">
                <span className="cluster5-mention__eyebrow">
                  <span className="cluster5-mention__eyebrow-text">Career Main Collection</span>
                  <span className="cluster5-mention__badge" aria-hidden="true">
                    <MentionBadgeIcon />
                  </span>
                </span>
                <h2 className="cluster5-mention__title">기업/실무자 Mention</h2>
              </div>

              <div className="cluster5-mention__meta">
                <div className="cluster5-mention__type">
                  <img
                    className="cluster5-mention__type-icon"
                    src="/images/0/cluster5/mention/type-icon.png"
                    alt=""
                  />
                  <span className="cluster5-mention__type-text">
                    <span className="cluster5-mention__type-label">Type by :</span>
                    <span className="cluster5-mention__type-value">Senior Mention Card</span>
                  </span>
                </div>

                <div className="cluster5-mention__pills">
                  {MENTION_STATS.map((stat) => (
                    <div key={stat.key} className="cluster5-mention__pill">
                      <img
                        className="cluster5-mention__pill-icon"
                        style={{ height: stat.iconHeight }}
                        src={stat.icon}
                        alt=""
                      />
                      <p
                        className={`cluster5-mention__pill-text${
                          "tight" in stat && stat.tight ? " cluster5-mention__pill-text--tight" : ""
                        }`}
                      >
                        <span className="cluster5-mention__pill-num">{stat.num}</span>
                        <span>{stat.rest}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="cluster5-mention__tools" aria-hidden="true">
                  <span className="cluster5-mention__tool cluster5-mention__tool--share">
                    <MentionShareIcon />
                  </span>
                  <span className="cluster5-mention__tool cluster5-mention__tool--more">
                    <MentionMoreIcon />
                  </span>
                </div>
              </div>
            </div>

            <div
              className="cluster5-mention__rule cluster5-mention__rule--top"
              aria-hidden="true"
            />
            <div className="cluster5-mention__rule" aria-hidden="true" />
          </div>

          {/* 우상단 수정/검색 — Figma 정적 시각 요소(실동작 없음).
              .cluster5-gallery__actions 와 동일한 아이콘 path 재사용. */}
          <div className="cluster5-mention__actions" aria-hidden="true">
            <div className="cluster5-mention__icon-btn">
              <svg viewBox="0 0 11.6667 11.3907" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5.83333 2.8907L0.5 8.22404V10.8907H11.1667M5.83333 2.8907L7.74575 0.978267L7.7469 0.977133C8.01016 0.713878 8.14202 0.582017 8.29402 0.532629C8.42792 0.489124 8.57216 0.489124 8.70605 0.532629C8.85795 0.581982 8.98966 0.713693 9.25254 0.976575L10.4124 2.13644C10.6764 2.40045 10.8085 2.53252 10.8579 2.68474C10.9014 2.81863 10.9014 2.96286 10.8579 3.09676C10.8085 3.24887 10.6766 3.38073 10.413 3.64437L10.4124 3.64493L8.49999 5.55736L3.16667 10.8907L0.5 10.8907M5.83333 2.8907L8.49999 5.55736"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="cluster5-mention__icon-btn">
              <svg viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7.16667 7.16667L10.5 10.5M4.38889 8.27778C2.24112 8.27778 0.5 6.53666 0.5 4.38889C0.5 2.24112 2.24112 0.5 4.38889 0.5C6.53666 0.5 8.27778 2.24112 8.27778 4.38889C8.27778 6.53666 6.53666 8.27778 4.38889 8.27778Z"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Figma 1068:22706 — 배너 좌측 어두운 그라디언트 위에 얹히는 멘션 카드 리스트 */}
          <div className="cluster5-mention__list">
            <span
              className="cluster5-mention__scroll-btn cluster5-mention__scroll-btn--up"
              aria-hidden="true"
            >
              <MentionScrollIcon />
            </span>
            <div className="cluster5-mention__cards">
              {MENTION_CARDS.map((card) => (
                <MentionReputationCard key={card.key} card={card} />
              ))}
            </div>
            <span
              className="cluster5-mention__scroll-btn cluster5-mention__scroll-btn--down"
              aria-hidden="true"
            >
              <MentionScrollIcon />
            </span>
          </div>
        </section>
      </div>
    </>
  );
};

export default Cluster5Content;

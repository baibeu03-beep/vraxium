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
    font-family: "Khula", "Pretendard", sans-serif;
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
    font-family: "Lobster", cursive;
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
    font-family: "Black Ops One", cursive;
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
const statsSectionStyles = `
  .cluster5-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 96px 48px;
    width: 100%;
    max-width: 1075px;
    margin: 0 auto;
    padding: 0 24px;
    box-sizing: border-box;
  }
  .cluster5-stats__item {
    position: relative;
    flex: 0 0 auto;
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
    font-family: "Khula", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 64px;
    line-height: 1;
    color: var(--white, #ffffff);
  }
  .cluster5-stats__unit {
    font-family: "Khula", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 36px;
    line-height: 1;
    color: var(--white, #ffffff);
    text-transform: uppercase;
  }
  .cluster5-stats__label {
    margin: 8px 0 0 0;
    font-family: "Khula", "Pretendard", sans-serif;
    font-weight: 600;
    font-size: 20px;
    line-height: 34px;
    color: var(--cluster5-accent, #faab07);
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media only screen and (max-width: 1199.98px) {
    .cluster5-stats {
      gap: 40px 32px;
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
const galleryBannerSectionStyles = `
  .cluster5-gallery {
    position: relative;
    width: 100%;
    max-width: 1335px;
    margin: 0 auto;
    aspect-ratio: 1335 / 1170;
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
    position: absolute;
    left: 92.96%; /* 1241px / 1335px */
    top: 2.14%; /* 25px / 1170px */
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .cluster5-gallery__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50px;
    background: var(--cluster5-accent, #faab07);
    backdrop-filter: blur(2.5px);
    -webkit-backdrop-filter: blur(2.5px);
    flex-shrink: 0;
  }
  .cluster5-gallery__icon-btn svg {
    width: 16px;
    height: 16px;
  }
  /* 반응형 breakpoint 불필요 — aspect-ratio + % 기반 아이콘 좌표라 폭에
     따라 전체가 비율 그대로 자연스럽게 축소된다(히어로/Keyword Map처럼
     고정 px 텍스트 박스가 없어 별도 flow 전환이 필요 없음). */
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
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1346px;
    margin: 0 auto;
    padding: 0 15px;
    box-sizing: border-box;
    text-align: center;
  }
  .cluster5-top3__title {
    margin: 0;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 54px;
    line-height: 74px;
    color: var(--white, #ffffff);
    text-transform: capitalize;
  }
  .cluster5-top3__subtitle {
    margin: 20px 0 0;
    max-width: 730px;
    font-family: "Pretendard", sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: rgba(255, 255, 255, 0.53);
  }
  .cluster5-top3__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-top: 40px;
  }
  .cluster5-top3__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 190px;
    height: 50px;
    border-radius: 12px;
    box-sizing: border-box;
    font-family: "Manrope", "Pretendard", sans-serif;
    font-weight: 800;
    font-size: 14px;
    line-height: 14px;
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
    .cluster5-top3__title {
      font-size: 40px;
      line-height: 52px;
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

const sectionSpacingStyles = `
  .cluster5-sections {
    display: flex;
    flex-direction: column;
  }
  .cluster5-keyword {
    margin-top: -30px;
  }
  .cluster5-stats {
    margin-top: 84px;
  }
  .cluster5-gallery {
    margin-top: 84px;
  }
  .cluster5-top3 {
    margin-top: 84px;
  }
  @media only screen and (max-width: 1199.98px) {
    .cluster5-keyword {
      margin-top: 32px;
    }
    .cluster5-stats {
      margin-top: 64px;
    }
    .cluster5-gallery {
      margin-top: 48px;
    }
    .cluster5-top3 {
      margin-top: 48px;
    }
  }
`;

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

        <section className="cluster5-stats" style={orgVars} aria-label="사회 명성도 통계">
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

        <section className="cluster5-gallery" style={orgVars} aria-label="포트폴리오 배너">
          <div className="cluster5-gallery__bg" aria-hidden="true" />
          <div className="cluster5-gallery__scrim" aria-hidden="true" />
          <div className="cluster5-gallery__actions" aria-hidden="true">
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
        </section>

        <section className="cluster5-top3" aria-label="베스트 평판 TOP 3">
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
        </section>
      </div>
    </>
  );
};

export default Cluster5Content;

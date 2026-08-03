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
    white-space: nowrap;
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

  return (
    <>
      <style>{heroStyles}</style>
      <section
        className="cluster5-hero"
        style={
          {
            "--cluster5-accent": orgConfig.themeColor,
            "--cluster5-accent-soft": orgConfig.accentSoft,
          } as React.CSSProperties
        }
      >
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
    </>
  );
};

export default Cluster5Content;

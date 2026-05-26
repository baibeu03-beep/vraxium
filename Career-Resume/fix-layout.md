# 반응형/뷰포트/해상도 관련 수정 요청

## 핵심 목표
네이버(naver.com)와 같은 **고정 너비 레이아웃(fixed-width layout)** 방식으로 전환하여, 현재의 유동적(fluid) 반응형 레이아웃에서 발생하는 문제들을 해결한다.

---

## 작업 전 필수 사전 조사

수정을 시작하기 전에 아래 명령어로 프로젝트 전체를 검색하여 현재 반응형 관련 코드를 모두 파악할 것:

```bash
# 1. 모든 media query 찾기
grep -rn "@media" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.styled.*"

# 2. JS/TS 반응형 로직 찾기
grep -rn "innerWidth\|matchMedia\|resize\|useMediaQuery\|useWindowSize\|breakpoint" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx"

# 3. .resume-card 관련 스타일 전부 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 4. 뷰포트 상대 단위 사용 찾기
grep -rn "vh\|vw\|vmin\|vmax" --include="*.css" --include="*.scss" --include="*.module.css"

# 5. 현재 전체 레이아웃 wrapper 구조 파악
grep -rn "max-width\|min-width\|margin.*auto\|width.*100%" --include="*.css" --include="*.scss" --include="*.module.css"
```

검색 결과를 기반으로 아래 수정 항목을 진행한다.

---

## 수정 항목 1 (최우선): 전체 컨테이너를 고정 너비 + 가운데 정렬로 변경

**현재 문제:** 전체 레이아웃이 뷰포트 100% 너비를 차지하고 있어서 좌우 여백이 없다. 확대/축소 시 nav/헤더는 그대로인데 내부 콘텐츠만 좌우 여백이 변하는 불일치가 발생한다.

**요구사항:**
- 페이지 최상위에 wrapper 요소를 만들거나 기존 최상위 컨테이너를 수정하여, **nav, 헤더, 사이드바, 본문 콘텐츠 전체**를 감싸도록 한다.
- 이 wrapper에 `max-width`와 `margin: 0 auto`를 적용한다.
- `max-width` 값은 기존 코드에서 데스크톱 전체화면(1920px 너비)일 때 콘텐츠가 실제로 차지하는 영역의 너비를 분석하여 결정할 것. (사전 조사 5번 결과 참고)
- 모니터가 이 max-width보다 넓으면 **좌우에 균등한 빈 여백**이 생겨야 한다.
- 확대/축소 시 nav/헤더/콘텐츠가 **모두 함께** 같은 비율로 움직여야 한다. 어떤 요소도 뷰포트 width: 100%로 남아있으면 안 된다.

**확인 기준:** 브라우저를 전체화면(1920px)으로 열었을 때, 콘텐츠 양쪽에 여백이 보여야 한다. nav/헤더도 콘텐츠와 동일한 너비 안에 있어야 한다.

---

## 수정 항목 2: 모바일/태블릿 반응형 완전 제거 + 가로 스크롤 전환

**현재 문제:** 브라우저 창을 줄이면 모바일/태블릿 반응형이 작동한다. 구체적으로:
- 사이드바가 숨겨진다 (모바일용 사이드바 숨김 규칙이 그대로 적용됨)
- 콘텐츠 크기가 줄어든다
- 가로 스크롤이 생기지 않는다

**요구사항:**
- 사전 조사 1번에서 찾은 **모든 화면 너비 기반 media query**(`max-width`, `min-width` breakpoint)를 **제거하거나 주석 처리**한다.
- 특히 사이드바를 `display: none` 또는 `visibility: hidden` 처리하는 media query를 반드시 찾아서 제거한다.
- 사전 조사 2번에서 찾은 **JS/TS 반응형 로직**도 모두 제거한다. (예: window.innerWidth 체크 후 사이드바 토글, matchMedia 리스너 등)
- `body` 또는 최상위 wrapper에 `min-width`를 설정한다. 값은 수정 항목 1에서 설정한 `max-width`와 동일하거나 약간 작은 값으로, 기존 레이아웃이 깨지지 않는 최소 너비를 기준으로 결정할 것.
- 브라우저 창이 이 `min-width`보다 좁아지면 **가로 스크롤바가 나타나야** 한다.

**확인 기준:** 브라우저 창을 절반으로 줄여도 사이드바가 보이고, 레이아웃이 데스크톱과 동일하며, 가로 스크롤로 나머지 영역을 볼 수 있어야 한다.

---

## 수정 항목 3: 브라우저 확대(zoom) 시 .resume-card 레이아웃 깨짐

**현재 문제:** 기본 해상도(1920×1080)에서 브라우저 zoom을 175% 이상으로 올리면 `.resume-card`의 레이아웃이 깨진다.

**요구사항:** 수정 항목 1, 2가 올바르게 적용되면 이 문제는 자동으로 해결될 가능성이 높다 (zoom 시 viewport가 줄어들어도 모바일 스타일로 전환되지 않으므로). 수정 항목 1, 2 완료 후 zoom 175%, 200%에서 `.resume-card`가 정상인지 확인할 것.

만약 여전히 깨진다면:
- 사전 조사 3번에서 찾은 `.resume-card` 관련 스타일에서 `vw`, `vh`, `%` 등 뷰포트 상대 단위를 `px`, `rem`으로 변경한다.
- `.resume-card`에 적용되는 media query도 모두 제거한다.

**기대 동작:** zoom 비율에 관계없이(100%→200%→...) `.resume-card`는 동일한 방식으로 비례 확대되어야 한다. 특정 zoom 레벨에서 레이아웃이 갑자기 변하거나 깨지면 안 된다.

---

## 작업 순서

1. **사전 조사** — 위 grep 명령어 5개 실행하여 현황 파악
2. **수정 항목 1** — 전체 컨테이너 고정 너비 + 가운데 정렬
3. **수정 항목 2** — media query 제거 + min-width + 가로 스크롤
4. **수정 항목 3** — zoom 테스트 후 필요 시 추가 수정

> 수정 항목 1→2 작업으로 수정 항목 3이 자동 해결될 가능성이 높다.

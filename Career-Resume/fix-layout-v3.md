# 반응형/뷰포트/해상도 관련 수정 요청 (3차 피드백 반영)

## 핵심 목표
현재 레이아웃에서 발생하는 헤더 레이아웃 깨짐 문제, 축소 시 여백 처리, .cluster-tab 잘림 문제를 해결한다.

---

## 작업 전 필수 사전 조사

수정을 시작하기 전에 아래 명령어로 프로젝트 전체를 검색하여 현재 관련 코드를 모두 파악할 것:

```bash
# 1. 헤더 관련 스타일 전부 찾기
grep -rn "header\|Header\|\.header\|#header" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 2. 뷰포트 상대 단위 사용 찾기 (vh, vw, %, vmin, vmax)
grep -rn "vh\|vw\|vmin\|vmax" --include="*.css" --include="*.scss" --include="*.module.css"

# 3. 모든 media query 찾기
grep -rn "@media" --include="*.css" --include="*.scss" --include="*.module.css"

# 4. 헤더에 적용되는 media query 구체적으로 찾기
grep -rn -A10 "@media" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i -B5 "header"

# 5. .cluster-tab 관련 스타일 전부 찾기
grep -rn "cluster-tab\|clusterTab\|cluster_tab" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 6. 전체 레이아웃 wrapper/컨테이너 구조 파악
grep -rn "max-width\|min-width\|margin.*auto\|width.*100%\|overflow" --include="*.css" --include="*.scss" --include="*.module.css"

# 7. JS/TS 반응형 로직 찾기
grep -rn "innerWidth\|matchMedia\|resize\|useMediaQuery\|useWindowSize\|breakpoint\|screen\.width" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx"

# 8. 헤더 내부 flex/grid 레이아웃 찾기
grep -rn "flex\|grid\|flex-wrap\|flex-direction\|align-items\|justify-content" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "header"
```

검색 결과를 기반으로 아래 수정 항목을 진행한다.

---

## 수정 항목 1 (최우선): 헤더 레이아웃 깨짐 문제 해결

**현재 문제:**
- 브라우저 zoom 175% 이상이거나, 데스크톱에서 브라우저 창을 중간 너비로 줄이면 **헤더 내부 요소들의 배치가 깨진다.**
- 구체적 증상: 헤더 안의 요소들(프로필 이미지, 로그인 버튼, 소셜 아이콘, 네비게이션 메뉴 등)이 원래는 가로로 한 줄 정렬되어야 하는데, **세로로 풀려서 아래로 쌓이고**, 결과적으로 헤더 영역이 화면 대부분을 차지하게 되어 나머지 콘텐츠가 아래로 밀려 잘린다.
- 자연스러운 비례 확대는 정상이다. 문제는 **레이아웃 구조 자체가 깨지는 것**이다.

**원인 추정:** 헤더 또는 헤더 내부 요소에 다음 중 하나 이상이 적용되어 있을 가능성이 높다:
1. media query에서 특정 breakpoint 이하일 때 `flex-direction: column`으로 변경하거나 `flex-wrap: wrap`을 추가하는 규칙
2. media query에서 헤더 내부 요소의 `display`, `width`, `position` 등을 모바일용으로 변경하는 규칙
3. JS/TS에서 화면 너비를 감지하여 헤더의 레이아웃이나 클래스를 동적으로 변경하는 로직

**요구사항:**
- 헤더 및 헤더 내부 요소에 적용되는 **모든 media query 규칙을 제거하거나 주석 처리**한다. (사전 조사 4번 결과 참고)
- 특히 다음 패턴을 찾아서 제거할 것:
  - `flex-direction: column` (가로 배치를 세로 배치로 바꾸는 것)
  - `flex-wrap: wrap` (줄바꿈을 허용하는 것)
  - `display: none` 또는 `visibility: hidden` (헤더 내부 요소를 숨기는 것)
  - `width: 100%` (원래 고정 너비/auto인 요소를 full-width로 바꾸는 것)
  - `position` 변경 (고정 위치를 변경하는 것)
- JS/TS에서 헤더 관련 반응형 로직도 제거한다. (사전 조사 7번 결과 참고)
- 헤더는 zoom이나 창 크기에 관계없이 **항상 데스크톱 레이아웃(가로 한 줄 배치)을 유지**해야 한다. 뷰포트가 좁아지면 헤더가 재배치되는 것이 아니라, 수정 항목 2에서 설정할 가로 스크롤로 처리한다.

**확인 기준:**
- zoom 175%, 200%에서 헤더 내부 요소들이 가로 한 줄 배치를 유지해야 한다.
- 브라우저 창을 절반으로 줄여도 헤더 레이아웃이 깨지지 않아야 한다. (가로 스크롤로 나머지를 볼 수 있으면 됨)
- 헤더 아래 콘텐츠가 정상 위치에 보여야 한다.

---

## 수정 항목 2: 축소 시 좌우 여백 + 가로 스크롤 처리

**현재 문제:** 이전 수정에서 100% 비율에서도 좌우 여백이 생기도록 했는데, 이는 의도와 다르다.

**요구사항:**
- **100% 비율(zoom 100%, 1920×1080 전체화면)에서는 좌우 여백 없이** 콘텐츠가 뷰포트 전체 너비를 사용해야 한다.
- **축소(zoom 90%, 80%, 75% 등) 시에만** 콘텐츠가 고정 너비를 유지하면서 좌우에 여백이 생겨야 한다.
- 구현 방향: 전체 wrapper에 `max-width`가 아닌 **`min-width`만 설정**한다. `min-width` 값은 현재 1920×1080 기준 zoom 100%에서 콘텐츠가 차지하는 실제 너비를 분석하여 결정할 것.
- 브라우저 창을 줄이거나 zoom을 올려서 뷰포트가 `min-width`보다 좁아지면 **가로 스크롤바가 나타나야** 한다. 콘텐츠가 축소되거나 재배치되면 안 된다.
- 모바일/태블릿용 media query는 **프로젝트 전체에서** 모두 제거한다. (사전 조사 3번 결과에서 화면 너비 기반 breakpoint 전부 제거)
- JS/TS의 반응형 로직(사전 조사 7번)도 모두 제거한다. 사이드바 숨김, 레이아웃 변경 등의 동적 처리를 하는 코드 포함.

**확인 기준:**
- zoom 100% + 1920px 전체화면: 좌우 여백 없음, 콘텐츠가 뷰포트 전체 사용
- zoom 75%: 콘텐츠가 고정 너비를 유지하고 좌우에 여백이 생김
- 브라우저 창을 절반으로 줄임: 가로 스크롤이 생기고, 스크롤하면 데스크톱 레이아웃 그대로 보임
- 사이드바가 어떤 상황에서든 항상 보임

---

## 수정 항목 3: 기본 100% 비율에서 .cluster-tab 우측 잘림 해결

**현재 문제:** zoom 100%, 1920×1080 전체화면 기본 상태에서 `.cluster-tab`의 우측이 잘린다.

**원인 추정:** `.cluster-tab` 또는 부모 컨테이너에 `overflow: hidden`이 적용되어 있거나, `.cluster-tab`의 너비가 부모 컨테이너보다 넓거나, 부모의 `width`/`max-width` 계산이 잘못되었을 가능성이 있다. (사전 조사 5, 6번 결과로 확인)

**요구사항:**
- `.cluster-tab`과 그 부모 요소들의 `width`, `max-width`, `overflow`, `padding`, `margin` 값을 확인한다.
- `.cluster-tab`이 부모 컨테이너 안에 온전히 들어가도록 너비 계산을 수정한다.
- 부모에 `overflow: hidden`이 있어서 잘리는 것이라면, overflow 설정을 조정하거나 `.cluster-tab`의 너비를 부모에 맞게 조정한다.
- 수정 시 다른 요소들의 레이아웃에 영향을 주지 않도록 주의한다.

**확인 기준:** zoom 100%, 1920×1080 전체화면에서 `.cluster-tab` 전체(우측 끝 포함)가 잘리지 않고 온전히 보여야 한다.

---

## 작업 순서

1. **사전 조사** — 위 grep 명령어 8개 실행하여 현황 파악
2. **수정 항목 1** — 헤더 레이아웃 깨짐 해결 (가장 먼저, 다른 항목에 영향을 줌)
3. **수정 항목 3** — .cluster-tab 잘림 해결 (독립적 문제)
4. **수정 항목 2** — min-width 설정 + media query 전체 제거 + 가로 스크롤

> 수정 항목 1을 먼저 해결해야 항목 2의 결과를 정확히 확인할 수 있다.
> 항목 2에서 media query를 전체 제거하면 항목 1의 헤더 문제도 근본적으로 해결될 수 있으므로, 항목 1에서는 헤더 관련 media query만 우선 제거하고, 항목 2에서 나머지를 전체 정리하는 순서로 진행한다.

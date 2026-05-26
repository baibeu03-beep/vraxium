# 추가 수정 요청 (v3 완료 후 적용할 것)

> 이 파일은 fix-layout-v3.md의 후속 작업이다. v3의 작업이 완료된 상태에서 추가로 적용한다.

---

## ⚠️ 최우선 원칙: 변경 범위 엄격 제한

**이 파일에서 명시적으로 요청한 항목만 수정할 것. 그 외 어떤 요소도 절대 변경하지 말 것.**

- 요청하지 않은 CSS 속성, HTML 구조, JS/TS 로직을 수정하면 안 된다.
- 기존에 정상 작동하고 있는 기능이나 레이아웃을 건드리면 안 된다.
- 특히 `.resume-card`가 현재 모니터 높이 안에 들어오게 되어 있는 설정이 있다면, 그 설정을 해치면 안 된다.
- 수정 전후로 변경한 파일 목록과 변경한 속성만 정리하여 보고할 것.
- 확신이 없으면 수정하지 말고, 어떤 변경이 필요한지 먼저 보고할 것.

**이 원칙은 아래 모든 수정 항목에 적용된다.**

---

## 사전 조사 (추가)

```bash
# 1. .resume-card 높이 관련 스타일 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "height\|min-height\|max-height"

# 2. .resume-card에 영향을 주는 JS/TS zoom 관련 로직 찾기
grep -rn "resume-card\|resumeCard" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" | grep -i "zoom\|scale\|height\|style"

# 3. 프로젝트 전체 zoom/scale 관련 로직 찾기
grep -rn "cssZoom\|css-zoom\|transform.*scale\|zoom" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.css" --include="*.scss"

# 4. 현재 전체 wrapper의 max-width, min-width 설정 확인
grep -rn "max-width\|min-width" --include="*.css" --include="*.scss" --include="*.module.css"

# 5. body 또는 html에 적용된 스타일 확인
grep -rn "body\|html" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "width\|margin\|overflow"
```

---

## 수정 항목 B: min-width 기준값 설정

**v3의 수정 항목 2에서 min-width를 설정하도록 했는데, 최적값을 코드 분석 후 결정한다.**

### 1단계: 분석 (수정 없이 보고만 할 것)

아래를 조사하여 보고할 것:

1. 현재 레이아웃의 주요 요소(사이드바, 본문, .resume-card 등)의 width가 `px` 고정인지, `%`나 유동적 단위인지 확인
2. 각 주요 요소의 고정 너비를 합산하여, 레이아웃이 깨지지 않는 최소 너비를 산출
3. 1366px 너비에서 현재 레이아웃이 정상 표시되는지, 아니면 잘리는 부분이 있는지 판단
4. 위 분석을 바탕으로 `min-width` 최적값을 제안 (레이아웃이 깨지지 않는 최소 너비)

### 2단계: 적용

- 1단계에서 산출한 `min-width` 값을 body 또는 최상위 wrapper에 적용한다.
- 이 사이트는 데스크톱 전용이므로 모바일/태블릿 대응은 하지 않는다.
- `min-width` 미만으로 뷰포트가 줄어드는 경우(브라우저 창 줄임, zoom 확대 등)에는 가로 스크롤이 발생한다.
- 1366×768 모니터에서 가로 스크롤 없이 정상 표시되는 것이 이상적이다. 다만 레이아웃 구조상 불가능하다면, 그 이유를 보고할 것.

**변경 범위:** body 또는 최상위 wrapper에 `min-width` 추가만 허용. 그 외 변경 금지.

**확인 기준:**
- 1920×1080 zoom 100%: 기존과 완전히 동일
- 1366×768 모니터: 가로 스크롤 없이 정상 표시 (가능한 경우)
- `min-width` 미만으로 브라우저 창을 줄임: 가로 스크롤 발생, 레이아웃은 그대로 유지
- **기존 레이아웃의 어떤 부분도 변하지 않아야 함**

---

## 수정 항목 C: .resume-card 높이 동작 진단 및 최적화

**⚠️ 이 항목은 즉시 수정하지 말고, 먼저 현재 상태를 진단하여 보고할 것.**

### 1단계: 진단 (수정 없이 보고만 할 것)

아래 질문에 대해 코드를 분석하여 답변할 것:

1. `.resume-card`의 height는 현재 어떤 단위(`px`, `vh`, `%`, `calc()`)로 설정되어 있는가?
2. `.resume-card`의 height에 영향을 주는 부모 요소의 height 설정은 무엇인가?
3. JS/TS에서 `.resume-card`의 크기를 동적으로 변경하는 로직이 있는가? (zoom 감지, resize 이벤트 등)
4. 프로젝트에 cssZoom이나 transform: scale 등 전역 스케일링 로직이 있는가? 있다면 `.resume-card`에 어떤 영향을 주는가?
5. 현재 1920×1080 zoom 100%에서 `.resume-card`의 computed height 값은 대략 몇 px인가? (코드 기반 추정)

### 2단계: 보고 후 방향 제안

진단 결과를 보고한 뒤, 아래 목표를 달성하기 위한 **최소한의 변경 방안**을 제안할 것. 직접 수정하지 말 것.

**목표:**
- **기본(zoom 100%, 모든 해상도):** `.resume-card`가 모니터 높이(헤더 아래 영역)에 딱 맞게 표시된다. (현재 이미 이렇게 동작하고 있다면 유지)
- **확대 시:** `.resume-card` 콘텐츠가 화면 높이를 넘어가면, LinkedIn처럼 자연스럽게 페이지 스크롤로 나머지를 볼 수 있어야 한다. 콘텐츠가 잘리면 안 된다.
- **현재 정상 작동 중인 "모니터 높이에 맞추기" 설정은 절대 해치지 않는다.**

---

## 작업 순서

1. **수정 항목 C - 1단계** — 진단 및 보고 (수정 없음)
2. **수정 항목 B - 1단계** — min-width 분석 및 보고
3. **수정 항목 B - 2단계** — min-width 적용
4. **수정 항목 C - 2단계** — 진단 결과 기반 방향 제안 (수정 전 승인 필요)

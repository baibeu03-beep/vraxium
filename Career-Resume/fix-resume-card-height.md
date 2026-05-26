# .resume-card 높이 실시간 재계산 적용 요청

---

## ⚠️ 최우선 원칙: 변경 범위 엄격 제한

**이 파일에서 명시적으로 요청한 항목만 수정할 것. 그 외 어떤 요소도 절대 변경하지 말 것.**

- .resume-card의 높이 계산 관련 코드만 수정한다.
- .resume-card 내부의 레이아웃, 스타일, 콘텐츠 배치는 건드리지 않는다.
- .resume-card 외부의 다른 요소(헤더, 사이드바, 우측 콘텐츠 영역 등)는 절대 변경하지 않는다.
- 기존에 정상 작동하고 있는 기능이나 레이아웃을 건드리면 안 된다.
- 수정 전후로 변경한 파일 목록과 변경한 속성만 정리하여 보고할 것.

---

## 사전 조사

```bash
# 1. .resume-card 현재 높이 관련 스타일 전부 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "height\|min-height\|max-height"

# 2. .resume-card에 높이를 설정하는 JS/TS 로직 찾기
grep -rn "resume-card\|resumeCard" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" | grep -i "height\|style\|className"

# 3. 헤더 높이 관련 값 찾기
grep -rn "header-height\|headerHeight\|header.*height" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.ts" --include="*.tsx"

# 4. 기존 resize/zoom 이벤트 리스너 찾기
grep -rn "addEventListener.*resize\|useEffect.*resize\|onResize\|ResizeObserver" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx"

# 5. .resume-card의 overflow 설정 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "overflow"
```

---

## 요구사항

### 목표

사용자가 화면을 확대/축소하거나, 브라우저 창 크기를 변경하거나, 다른 해상도의 모니터에서 볼 때, **.resume-card가 항상 모니터 높이(헤더 아래 남은 영역)에 딱 맞게** 표시되어야 한다.

### 구현 방식

화면 크기가 바뀔 때마다 JS로 .resume-card의 높이를 실시간 재계산하여 적용한다.

**계산 공식:**
```
.resume-card 높이 = window.innerHeight - 헤더의 실제 높이(px) - 여백(필요 시)
```

**구체적 요구사항:**

1. 페이지 로드 시 위 공식으로 .resume-card 높이를 계산하여 적용한다.
2. 다음 이벤트 발생 시에도 재계산하여 적용한다:
   - `window resize` (브라우저 창 크기 변경)
   - `zoom 변경` (가능하다면 감지)
3. 헤더의 실제 높이는 하드코딩하지 말고, DOM에서 헤더 요소의 실제 높이(`offsetHeight` 또는 `getBoundingClientRect().height`)를 읽어서 사용한다.
4. 기존 CSS에 .resume-card의 `height`, `min-height`, `max-height`가 `!important`로 고정되어 있다면, JS에서 `element.style.height`로 덮어쓸 수 있도록 해당 CSS의 `!important`를 제거하거나, JS에서 `setProperty('height', '...', 'important')`를 사용한다.
5. 재계산 시 성능을 위해 `debounce` 또는 `requestAnimationFrame`을 사용하여 과도한 호출을 방지한다.
6. .resume-card 내부 콘텐츠가 계산된 높이를 초과하면, .resume-card 내부에서 스크롤이 가능해야 한다. (기존에 내부 스크롤이 이미 구현되어 있다면 그대로 유지)

### 주의사항

- 우측 콘텐츠 영역은 건드리지 않는다. 우측은 현재처럼 자유롭게 페이지 스크롤되어야 한다.
- .resume-card의 width, position, margin, padding 등 높이 외의 속성은 변경하지 않는다.
- 기존 프로젝트에 resize 이벤트 리스너가 이미 있다면, 그 구조를 따르거나 충돌하지 않도록 한다. 기존 리스너를 수정하지 말고 별도로 추가한다.
- 기존 cssZoom/scale 관련 로직이 있다면 건드리지 않는다. 이 작업은 cssZoom과 독립적으로 동작해야 한다.
- React 프로젝트이므로, 가능하면 해당 컴포넌트 내부에서 `useEffect` + `useCallback` 패턴으로 구현한다. 전역 스크립트는 지양한다.

---

## 확인 기준

- **1920×1080 zoom 100%:** .resume-card가 헤더 아래 공간을 정확히 채움 (기존과 동일하게 보여야 함)
- **zoom 150%:** .resume-card가 줄어든 화면 높이에 맞게 자동 조절됨. 잘리지 않음.
- **zoom 75%:** .resume-card가 늘어난 화면 높이에 맞게 자동 조절됨. 빈 공간 없음.
- **2560×1440 모니터:** .resume-card가 해당 모니터 높이에 맞게 자동 조절됨.
- **브라우저 창 크기 변경 시:** 실시간으로 .resume-card 높이가 업데이트됨. 깜빡임이나 눈에 띄는 지연 없음.
- **우측 콘텐츠 영역:** 변화 없음. 기존처럼 자유롭게 스크롤됨.
- **.resume-card 외 다른 요소:** 변화 없음.

---

## 수정 후 보고

수정 완료 후 아래 내용을 보고할 것:

1. 변경한 파일 목록
2. 각 파일에서 변경한 내용 요약
3. 기존 CSS의 .resume-card height 관련 속성을 어떻게 처리했는지 (제거/주석처리/덮어쓰기)
4. resize 이벤트 처리 방식 (debounce/rAF 등)
5. 기존 코드와 충돌 가능성이 있는 부분이 있다면 명시

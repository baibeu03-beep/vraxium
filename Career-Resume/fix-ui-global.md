# 사이트 전역 UI 수정 요청

---

## ⚠️ 최우선 원칙: 변경 범위 엄격 제한

**이 파일에서 명시적으로 요청한 항목만 수정할 것. 그 외 어떤 요소도 절대 변경하지 말 것.**

- 요청하지 않은 CSS 속성, HTML 구조, JS/TS 로직을 수정하면 안 된다.
- 기존에 정상 작동하고 있는 기능이나 레이아웃을 건드리면 안 된다.
- 수정 전후로 변경한 파일 목록과 변경한 내용만 정리하여 보고할 것.
- 확신이 없으면 수정하지 말고, 어떤 변경이 필요한지 먼저 보고할 것.

**이 원칙은 아래 모든 수정 항목에 적용된다.**

---

## 사전 조사

```bash
# 1. 모달 관련 컴포넌트/로직 찾기
grep -rn "modal\|Modal\|dialog\|Dialog" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" | grep -i "open\|close\|show\|hide\|onHide\|onClose\|backdrop"

# 2. 드롭다운 관련 컴포넌트/로직 찾기
grep -rn "dropdown\|Dropdown\|select\|Select" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" | grep -i "open\|close\|toggle\|isOpen\|show"

# 3. 모달 외부 클릭 닫기 로직 찾기
grep -rn "backdrop\|onHide\|handleClose\|closeModal\|mousedown\|mouseup\|click.*outside\|clickOutside" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

# 4. floating-icon 관련 스타일 찾기
grep -rn "floating-icon\|floatingIcon\|floating_icon" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 5. Identity-Core 연필 아이콘 크기 찾기
grep -rn "Identity.*Core\|identity.*core\|pencil\|edit.*icon\|편집" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx" | grep -i "size\|width\|height\|font-size"

# 6. .cluster-tab 관련 스타일 찾기
grep -rn "cluster-tab\|clusterTab" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 7. 기존 커스텀 스크롤바 스타일 찾기
grep -rn "scrollbar\|::-webkit-scrollbar\|scrollbar-width\|scrollbar-color" --include="*.css" --include="*.scss" --include="*.module.css"

# 8. footer 관련 요소 찾기
grep -rn "footer\|Footer" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 9. 드래그 관련 이벤트 찾기
grep -rn "mousedown\|mouseup\|mousemove\|drag\|onDrag\|isDragging" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"
```

---

## 수정 항목 1: 드롭다운 외부 클릭 시 닫히도록 수정

**현재 문제:** 모달 내 드롭다운(예: 주소 수정 시 시/구 선택)에서 아무런 항목을 선택하지 않은 상태로 드롭다운 외부를 클릭하면, 드롭다운이 닫히지 않는다.

**요구사항:**
- 사이트 전역의 모든 드롭다운에 적용한다.
- 드롭다운이 열린 상태에서, 드롭다운 영역 외부를 클릭하면 아무런 항목을 선택하지 않았더라도 드롭다운이 닫혀야 한다.
- 드롭다운이 닫힐 때 기존 선택값은 유지한다. (이전에 선택한 값이 있으면 그대로 유지, 없으면 빈 상태 유지)
- 드롭다운 내부를 클릭하는 것은 기존 동작 그대로 유지한다.

**확인 기준:** 모달 내 드롭다운을 열고, 아무것도 선택하지 않은 채 드롭다운 바깥(모달 내부의 다른 영역)을 클릭하면 드롭다운이 닫혀야 한다.

---

## 수정 항목 2: 모달 내부 드래그 시 모달이 닫히지 않도록 수정

**현재 문제:** 모달 내부의 input 영역 등에서 텍스트를 드래그(선택)하면 모달이 닫혀버린다. 모든 모달에서 공통으로 발생한다.

**원인 추정:** 모달 외부 클릭 감지 로직이 mousedown/mouseup 위치를 제대로 구분하지 못하여, 모달 내부에서 시작한 드래그가 외부 클릭으로 인식되는 것으로 보인다.

**요구사항:**
- 사이트 전역의 모든 모달에 적용한다.
- 모달 내부에서 드래그(mousedown → mousemove → mouseup)를 해도 모달이 닫히지 않아야 한다.
- 구현 방향: mousedown 위치와 mouseup 위치를 모두 확인하여, 둘 다 모달 외부일 때만 닫히도록 수정한다. 또는 수정 항목 3에서 외부 클릭 닫기 자체를 제거하므로, 이 문제가 자동으로 해결될 수 있다.

**확인 기준:** 모달 내부의 input에서 텍스트를 드래그로 선택해도 모달이 닫히지 않아야 한다.

---

## 수정 항목 3: 모달은 'x' 버튼으로만 닫히도록 수정

**현재 문제:** 모달 외부(backdrop)를 클릭하면 모달이 닫힌다. 사용자가 실수로 외부를 클릭하여 작업 중인 내용이 사라질 수 있다.

**요구사항:**
- 사이트 전역의 모든 모달에 적용한다.
- 모달은 상단바의 'x' 버튼을 눌러야만 닫혀야 한다.
- 모달 외부(backdrop) 클릭으로는 모달이 닫히지 않아야 한다.
- ESC 키로 모달이 닫히는 동작이 있다면, 이것도 비활성화한다.
- React Bootstrap Modal을 사용하고 있다면: `backdrop="static"` 과 `keyboard={false}` 속성을 적용한다.
- 커스텀 모달을 사용하고 있다면: backdrop 클릭 이벤트 핸들러를 제거하거나, 클릭 이벤트를 무시하도록 수정한다.

**확인 기준:**
- 모달이 열린 상태에서 외부(어두운 배경)를 클릭해도 모달이 닫히지 않아야 한다.
- 모달 상단바의 'x' 버튼을 클릭하면 모달이 정상적으로 닫혀야 한다.
- ESC 키를 눌러도 모달이 닫히지 않아야 한다.

> 참고: 이 수정이 적용되면 수정 항목 2의 드래그 문제도 자동으로 해결될 가능성이 높다. 그래도 수정 항목 2의 확인 기준은 별도로 검증할 것.

---

## 수정 항목 4: 모든 floating-icon 크기 통일

**현재 문제:** 사이트 내 floating-icon들의 크기가 제각각이다.

**요구사항:**
- 사이트 전역의 모든 `.floating-icon` (또는 이에 해당하는 클래스/요소)의 크기를 통일한다.
- 기준: **Identity-Core 영역에 사용된 연필(편집) 아이콘의 현재 크기**를 기준값으로 한다.
- 사전 조사 4번, 5번 결과를 바탕으로 Identity-Core 연필 아이콘의 width, height, font-size 값을 파악한 뒤, 모든 floating-icon에 동일한 값을 적용한다.
- 아이콘의 위치(position, top, right 등)는 변경하지 않는다. 크기(width, height, font-size)만 통일한다.

**확인 기준:** 사이트 내 모든 floating-icon이 Identity-Core 연필 아이콘과 동일한 크기로 표시되어야 한다.

---

## 수정 항목 5: .cluster-tab ~ footer 영역에 세로 스크롤바 추가

**현재 문제:** .cluster-tab 아래부터 footer까지의 우측 콘텐츠 영역에 세로 스크롤바가 없다.

**요구사항:**
- .cluster-tab 아래부터 footer 부분까지의 콘텐츠 영역에 세로 스크롤바를 추가한다.
- 스크롤바 스타일은 아래 사양을 따른다 (Vector 38 참고):
  - 스크롤바 너비: 얇게 (약 4~6px)
  - 스크롤바 thumb(움직이는 부분) 색상: 노란-초록 계열 (`#C8D21E` 또는 이에 가까운 색상, 프로젝트 내 기존 색상 변수가 있으면 그것을 사용)
  - 스크롤바 track(배경) 색상: 투명 또는 페이지 배경과 동일
  - 스크롤바 thumb 모양: 둥근 모서리 (border-radius 적용)
- 스크롤바는 콘텐츠가 영역 높이를 초과할 때만 나타나야 한다. (overflow-y: auto)
- .resume-card 영역에는 영향을 주지 않는다.

**확인 기준:** .cluster-tab 아래 콘텐츠가 길 때, 우측에 노란-초록색의 얇은 세로 스크롤바가 나타나야 한다.

---

## 수정 항목 6: 모든 모달에 세로 스크롤바 추가

**현재 문제:** 모달 내부 콘텐츠가 모달 높이를 초과하면 스크롤은 가능하지만 스크롤바가 보이지 않거나 기본 스타일이다.

**요구사항:**
- 사이트 전역의 모든 모달에 적용한다.
- 모달 본문(body) 영역에 콘텐츠가 모달 높이를 초과할 때 세로 스크롤바가 나타나도록 한다.
- 스크롤바 스타일은 수정 항목 5와 동일하게 적용한다 (Vector 38 참고):
  - 스크롤바 너비: 얇게 (약 4~6px)
  - 스크롤바 thumb 색상: 노란-초록 계열 (`#C8D21E` 또는 프로젝트 내 기존 색상 변수)
  - 스크롤바 track 색상: 투명 또는 모달 배경과 동일
  - 스크롤바 thumb 모양: 둥근 모서리
- 모달의 상단바와 푸터에는 스크롤바가 적용되지 않는다. 본문(body) 영역에만 적용한다.

**구현 참고:** 스크롤바 스타일은 공통 CSS 클래스 또는 mixin으로 만들어서 수정 항목 5와 6에서 재사용할 것. 같은 스타일 코드를 여러 곳에 중복 작성하지 말 것.

**확인 기준:** 모달 내부 콘텐츠가 길 때, 모달 본문 영역 우측에 노란-초록색의 얇은 세로 스크롤바가 나타나야 한다.

---

## 작업 순서

1. **사전 조사** — 위 grep 명령어 9개 실행하여 현황 파악
2. **수정 항목 3** — 모달 'x' 버튼으로만 닫히도록 (가장 먼저, 항목 2에 영향)
3. **수정 항목 2** — 항목 3 적용 후 드래그 문제가 해결되었는지 확인. 해결되지 않았으면 추가 수정
4. **수정 항목 1** — 드롭다운 외부 클릭 시 닫히도록
5. **수정 항목 4** — floating-icon 크기 통일
6. **수정 항목 5** — .cluster-tab ~ footer 스크롤바 추가
7. **수정 항목 6** — 모달 스크롤바 추가 (항목 5의 공통 스타일 재사용)

---

## 수정 후 보고

수정 완료 후 아래 내용을 보고할 것:

1. 변경한 파일 목록
2. 각 파일에서 변경한 내용 요약
3. 항목 3 적용 후 항목 2가 자동 해결되었는지 여부
4. 스크롤바 공통 스타일을 어떤 파일/클래스에 정의했는지
5. 기존 코드와 충돌 가능성이 있는 부분이 있다면 명시

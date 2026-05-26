# .resume-card UI 수정 요청

---

## ⚠️ 최우선 원칙: 변경 범위 엄격 제한

**이 파일에서 명시적으로 요청한 항목만 수정할 것. 그 외 어떤 요소도 절대 변경하지 말 것.**

- .resume-card 관련 코드만 수정한다.
- .resume-card 외부의 다른 요소(헤더, 사이드바, 우측 콘텐츠 영역 등)는 절대 변경하지 않는다.
- 기존에 정상 작동하고 있는 기능이나 레이아웃을 건드리면 안 된다.
- 수정 전후로 변경한 파일 목록과 변경한 내용만 정리하여 보고할 것.
- 확신이 없으면 수정하지 말고, 어떤 변경이 필요한지 먼저 보고할 것.

**이 원칙은 아래 모든 수정 항목에 적용된다.**

---

## 사전 조사

```bash
# 1. .resume-card 내 모달 컴포넌트 찾기
grep -rn "resume-card\|resumeCard" --include="*.tsx" --include="*.jsx" | grep -i "modal\|Modal\|dialog"

# 2. .resume-card 내 드롭다운 컴포넌트 찾기 (주소 관련 포함)
grep -rn "resume-card\|resumeCard" --include="*.tsx" --include="*.jsx" | grep -i "dropdown\|Dropdown\|select\|Select\|address\|주소\|시\|구"

# 3. .resume-card 내 input/form 관련 컴포넌트 찾기
grep -rn "resume-card\|resumeCard" --include="*.tsx" --include="*.jsx" | grep -i "input\|Input\|form\|Form\|onSubmit\|onKeyDown\|onKeyPress"

# 4. .resume-card 모달의 상단바/헤더 스타일 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "header\|title\|close\|modal"

# 5. 다른 모달의 상단바 스타일 참고 (프로필 사진 수정 모달 등)
grep -rn "modal-header\|modalHeader\|modal.*title\|상단.*바" --include="*.css" --include="*.scss" --include="*.module.css" --include="*.tsx" --include="*.jsx"

# 6. .resume-card 내 폰트 크기 관련 스타일 찾기
grep -rn "resume-card\|resumeCard" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "font-size\|fontSize"

# 7. .resume-card 내 저장/작성완료 버튼 로직 찾기
grep -rn "resume-card\|resumeCard" --include="*.tsx" --include="*.jsx" | grep -i "save\|submit\|저장\|작성.*완료\|완료"

# 8. Enter 키 이벤트 핸들링 찾기
grep -rn "onKeyDown\|onKeyPress\|keyCode.*13\|key.*Enter" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"

# 9. .resume-card 내 주소 input의 폰트 크기 확인
grep -rn "address\|주소" --include="*.css" --include="*.scss" --include="*.module.css" | grep -i "font-size\|fontSize"
```

---

## 수정 항목 1: .resume-card 주소 드롭다운 외부 클릭 시 닫히도록 수정

**현재 문제:** .resume-card 모달에서 주소를 수정할 때, 시/구 드롭다운을 열고 아무런 선택을 하지 않은 상태에서 드롭다운 외부를 클릭해도 드롭다운이 닫히지 않는다.

**요구사항:**
- .resume-card 내 주소 관련 드롭다운(시/구 선택 등)에 적용한다.
- 드롭다운이 열린 상태에서 드롭다운 영역 외부를 클릭하면, 아무런 항목을 선택하지 않았더라도 드롭다운이 닫혀야 한다.
- 드롭다운이 닫힐 때 기존 선택값은 유지한다. (이전에 선택한 값이 있으면 그대로 유지, 없으면 빈 상태 유지)
- 드롭다운 내부 클릭 동작은 기존 그대로 유지한다.

**확인 기준:** .resume-card 모달에서 주소 드롭다운을 열고, 아무것도 선택하지 않은 채 드롭다운 바깥을 클릭하면 드롭다운이 닫혀야 한다.

---

## 수정 항목 2: .resume-card 모달에 상단바 + X 버튼 스타일 적용

**현재 문제:** .resume-card의 모달을 열었을 때, 다른 모달(예: 프로필 사진 수정)에는 상단바와 X 버튼 스타일이 적용되어 있는데, .resume-card의 모달에는 이 스타일이 없다.

**참고 스타일 (프로필 사진 수정 모달 기준):**
- 상단바: 어두운 배경, 좌측에 타이틀 텍스트 + 아래에 설명 텍스트, 우측 상단에 X 버튼
- 본문: 모달 콘텐츠 영역
- 푸터: 취소/저장 버튼 영역

**요구사항:**
- .resume-card의 모든 모달(input UI)에, 다른 모달들과 동일한 상단바 + X 버튼 스타일을 적용한다.
- 상단바의 타이틀과 설명 텍스트는 각 모달의 맥락에 맞게 설정한다. (예: "주소 수정" 등)
- X 버튼의 위치, 크기, 색상은 프로필 사진 수정 모달의 X 버튼과 동일하게 맞춘다. (사전 조사 5번 결과 참고)
- 기존 모달의 본문과 푸터 영역은 변경하지 않는다.

### X 버튼 클릭 시 확인 팝업 추가

- X 버튼을 클릭하면 바로 닫히지 않고, 아래 메시지의 **확인 팝업(confirm dialog)**이 먼저 표시되어야 한다:

  > **변경사항이 저장되지 않았습니다.**
  > 하단에 [작성 완료]를 눌러야 저장이 완료됩니다.
  > 지금 나가시겠습니까?

- 팝업에는 "나가기"와 "계속 작성" 두 가지 버튼이 있어야 한다.
  - **"나가기"**: 변경사항을 저장하지 않고 모달을 닫는다. (수정한 내용이 반영되지 않음)
  - **"계속 작성"**: 팝업만 닫고 모달로 돌아간다. (작성 중이던 내용 유지)
- "작성 완료" (또는 "저장") 버튼을 누르면 변경사항이 저장되고 모달이 닫힌다. (기존 저장 로직 유지)

**확인 기준:**
- .resume-card 모달에 다른 모달과 동일한 상단바 + X 버튼이 표시되어야 한다.
- X 버튼 클릭 시 확인 팝업이 뜨고, "나가기" 시 저장 없이 닫힘, "계속 작성" 시 모달로 복귀해야 한다.
- "작성 완료"/"저장" 버튼은 기존대로 변경사항을 저장하고 모달을 닫아야 한다.

---

## 수정 항목 3: Enter 키로 다음 input 탭 이동 + 마지막 input에서 저장

**현재 문제:** .resume-card의 input UI에서 Enter 키를 눌러도 아무 반응이 없다.

**요구사항:**
- .resume-card 내 모든 input UI에 적용한다.
- input 필드에서 Enter 키를 누르면 **다음 input 필드로 포커스가 이동**한다. (Tab 키와 동일한 동작)
- **맨 마지막 input 필드**에서 Enter 키를 누르면 **"작성 완료"/"저장" 동작이 실행**된다.
- 구현 방향:
  - 각 input에 onKeyDown 이벤트를 추가하여 Enter 키(key === 'Enter')를 감지한다.
  - 다음 input이 있으면 해당 input에 focus()를 호출한다.
  - 마지막 input이면 저장/작성완료 버튼의 click 이벤트를 트리거하거나, 기존 저장 함수를 호출한다.
- textarea 등 여러 줄 입력이 필요한 필드에서는 Enter가 줄바꿈으로 동작해야 하므로 제외한다. (input[type="text"], input[type="number"] 등 한 줄 입력 필드에만 적용)
- 드롭다운(select)에서는 Enter가 선택 확인으로 동작해야 하므로 제외한다.

**확인 기준:**
- input 필드에서 Enter 누르면 다음 input으로 이동해야 한다.
- 마지막 input에서 Enter 누르면 저장이 실행되어야 한다.
- textarea에서는 Enter가 줄바꿈으로 정상 동작해야 한다.

---

## 수정 항목 4: .resume-card input UI 데이터 값의 폰트 크기 통일

**현재 문제:** .resume-card의 input UI에서 보여지는 데이터 값들의 폰트 크기가 일관적이지 않다. 주소 입력 값의 폰트 크기는 적절한데, 성/이름/영문 성/영문 이름 등의 데이터 값은 상대적으로 폰트 크기가 작다.

**요구사항:**
- .resume-card input UI에 표시되는 **데이터 값**(사용자가 입력한 값)의 폰트 크기를 통일한다.
- 기준: **현재 주소 입력 값에 사용되는 폰트 크기**를 기준값으로 한다.
- 사전 조사 6번, 9번 결과를 바탕으로 주소 input의 font-size 값을 파악한 뒤, 다른 input(성, 이름, 영문 성, 영문 이름 등)에도 동일한 font-size를 적용한다.
- **인덱스 값(라벨/필드명)**의 폰트 크기는 현재 스타일을 그대로 유지한다. 변경하지 않는다.
- 데이터 값의 font-size만 변경하고, font-weight, font-family, color 등 다른 속성은 변경하지 않는다.

**확인 기준:** .resume-card 모달 내 모든 input 필드의 데이터 값(성, 이름, 영문 성, 영문 이름, 주소 등)이 동일한 폰트 크기로 표시되어야 한다. 인덱스 값(라벨)은 기존 크기 유지.

---

## 작업 순서

1. **사전 조사** — 위 grep 명령어 9개 실행하여 현황 파악
2. **수정 항목 2** — 상단바 + X 버튼 + 확인 팝업 (구조 변경이 가장 크므로 먼저)
3. **수정 항목 1** — 드롭다운 외부 클릭 닫기
4. **수정 항목 3** — Enter 키 탭 이동 + 마지막 저장
5. **수정 항목 4** — 데이터 값 폰트 크기 통일

---

## 수정 후 보고

수정 완료 후 아래 내용을 보고할 것:

1. 변경한 파일 목록
2. 각 파일에서 변경한 내용 요약
3. X 버튼 확인 팝업의 구현 방식 (별도 컴포넌트 생성 여부, 기존 confirm 패턴 재사용 여부)
4. Enter 키 이동 시 제외한 필드 목록 (textarea, select 등)
5. 폰트 크기 통일 시 기준값(주소 input의 font-size)이 몇 px/rem인지
6. 기존 코드와 충돌 가능성이 있는 부분이 있다면 명시

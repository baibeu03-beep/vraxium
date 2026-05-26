# 팝업/모달 사용 현황 조사 보고서

> 조사 기준일: 2026-04-27
> 조사 범위: 프로젝트 전체 (`components/`, `app/`, `hooks/`, `utils/` 등)
> 조사 목적: Cluster 1~4 팝업 일괄 교체를 위한 사전 데이터 수집 (코드 변경 없음)

---

## 요약 (Executive Summary)

| 카테고리                    | 사용처    | 주요 위치                                                      |
| --------------------------- | --------- | -------------------------------------------------------------- |
| `alert()`                   | **182개** | cluster-4-card 63 / cluster-2 42 / cluster-4 32 / cluster-3 22 |
| `window.confirm()`          | **82개**  | cluster-4-card 42 / cluster-2 24 / cluster-4 10                |
| `prompt()`                  | **0개**   | —                                                              |
| `window.open()`             | **29개**  | cluster-4-card 4 / cluster-3 4 / 기타 21                       |
| 커스텀 모달 클래스 인스턴스 | **477개** | cluster-4-card 237 / cluster-2 115 / cluster-3 68              |
| `<input type="file">`       | **10개**  | cluster-3 4 / cluster-4-card 5 / cluster-2 1                   |
| React Bootstrap 컴포넌트    | **0개**   | 미설치 (CSS만 사용)                                            |
| 외부 토스트 라이브러리      | **0개**   | 미설치                                                         |

→ **네이티브 `alert/confirm` 사용 비중이 절대적**. 현재는 외부 토스트/모달 라이브러리 없이 브라우저 기본 다이얼로그 + SCSS 기반 자체 모달 두 축으로 운영.

---

## 1. 브라우저 네이티브 팝업

### 1.1 `alert()` — 총 182개

| 파일                                                | 사용 수 | 대표 맥락                                                |
| --------------------------------------------------- | ------- | -------------------------------------------------------- |
| `components/cluster-4-card/Cluster4CardContent.tsx` | 63      | 저장 성공/실패, 권한 안내, 입력 길이 제한, 비즈니스 규칙 |
| `components/cluster-2/Cluster2Content.tsx`          | 42      | 학력·경력 폼 검증, 저장 결과                             |
| `components/cluster-4/Cluster4Content.tsx`          | 32      | 시즌 평판 저장/제한, 권한 안내                           |
| `components/cluster-3/Cluster3Content.tsx`          | 22      | 채널 등록·산출물 검증                                    |
| `components/home-career/Sidebar.tsx`                | 10      | 사이드바 액션 알림                                       |
| 기타                                                | 13      | —                                                        |

**대표 패턴**:

- 성공: `alert("저장되었습니다.");`
- 실패: `alert(result.error || "저장에 실패했습니다.");`
- 권한: `alert("작성할 수 있는 기간이 아닙니다. 😊");`
- 검증: `alert("최대 ${maxLength}자까지 입력할 수 있습니다.");`
- 비즈니스 규칙: `alert("한 주에 최대 7명까지만 평판을 보낼 수 있습니다.");`

### 1.2 `window.confirm()` — 총 82개

| 파일                                                | 사용 수 | 대표 맥락                  |
| --------------------------------------------------- | ------- | -------------------------- |
| `components/cluster-4-card/Cluster4CardContent.tsx` | 42      | 저장/초기화/삭제/이탈 확인 |
| `components/cluster-2/Cluster2Content.tsx`          | 24      | 학력·경력 변경 확인        |
| `components/cluster-4/Cluster4Content.tsx`          | 10      | 시즌 평판 삭제/저장 확인   |
| `components/cluster-3/Cluster3Content.tsx`          | 4       | 채널 변경 확인             |
| `components/home-career/Sidebar.tsx`                | 2       | 사이드바 액션 확인         |

**대표 패턴**:

- 저장 확인: `if (!window.confirm("저장하시겠습니까?")) return;`
- 초기화: `if (window.confirm("내용을 모두 초기화하시겠어요?"))`
- 이탈: `if (window.confirm("입력한 데이터가 저장되지 않았습니다. 종료하시겠습니까?"))`
- 삭제: `if (window.confirm("이 평판을 삭제하시겠습니까?"))`

### 1.3 `window.open()` — 총 29개

| 파일                                                  | 사용 수 | 용도             |
| ----------------------------------------------------- | ------- | ---------------- |
| `components/cluster-4-card/Cluster4CardContent.tsx`   | 4       | 외부 링크 새 탭  |
| `components/cluster-3/Cluster3Content.tsx`            | 4       | 채널/산출물 링크 |
| `components/cluster-2/Cluster2Content.tsx`            | 2       | 외부 링크        |
| `components/home-career/Sidebar.tsx`                  | 2       | 외부 링크        |
| 기타 (`home-two`, `home-three`, `Cluster4Content` 등) | 17      | 외부 링크/동영상 |

**패턴**:

- `window.open(card.link, "_blank")`
- `window.open(video.videoUrl, "_blank")`

→ 단순 외부 링크 이동이 대부분이라 모달화 대상 아님 (Phase 2에서 제외 가능).

### 1.4 `prompt()` — 총 0개

코드베이스에 없음 (모든 텍스트 입력은 폼 또는 인라인 input 사용).

---

## 2. React Bootstrap 사용

**결과: 미설치**

- `package.json`에 `react-bootstrap` 의존성 없음
- `bootstrap@5.3.3` (CSS만) 설치됨 → 클래스명만 활용, 컴포넌트는 직접 작성

---

## 3. 자체 커스텀 모달 패턴

### 3.1 클래스명 인스턴스 합계

총 **477개** 모달 관련 클래스 사용 (요소 단위, 동일 모달 내 중복 포함).

| 클래스명                                                           | 인스턴스 | 역할             |
| ------------------------------------------------------------------ | -------- | ---------------- |
| `modal-close-btn`                                                  | 37       | 닫기 X 버튼      |
| `modal-header-top`                                                 | 32       | 헤더 영역        |
| `modal-subtitle`                                                   | 25       | 부제목           |
| `section-modal-header`                                             | 20       | 섹션 모달 헤더   |
| `modal-save-btn`                                                   | 20       | 저장 버튼        |
| `section-modal-overlay`                                            | 18       | 배경 오버레이    |
| 기타 (`modal-edit-btn`, `modal-delete-btn`, `modal-cancel-btn`, …) | 325+     | 다양한 버튼/요소 |

### 3.2 파일별 모달 클래스 사용량

| 파일                                                | 인스턴스 |
| --------------------------------------------------- | -------- |
| `components/cluster-4-card/Cluster4CardContent.tsx` | 237      |
| `components/cluster-2/Cluster2Content.tsx`          | 115      |
| `components/cluster-3/Cluster3Content.tsx`          | 68       |
| `components/cluster-4/Cluster4Content.tsx`          | 57       |

### 3.3 모달 컨텍스트 분류

- **Cluster 페이지 기반**: `section1-modal-*` (프로필), `section2-modal-*` (슬로건), `section-modal-*` (일반/공용)
- **편집 전용**: `section-modal-work-edit`
- **특수 용도**: `edu-modal-*` (학력), `help-modal-*` (도움말), `nftg-child-modal` (자식), `image-preview-modal`, `photo-preview-modal`

### 3.4 컴포넌트 파일명 (Modal/Dialog/Popup 패턴)

| 패턴                      | 매치                                                     |
| ------------------------- | -------------------------------------------------------- |
| `**/*Modal*.tsx`          | 0개 (별도 파일로 분리되지 않음 — 부모 컴포넌트에 인라인) |
| `**/*Dialog*.tsx`         | 0개                                                      |
| `**/*Popup*.tsx`          | 0개                                                      |
| `utils/useModalScroll.ts` | 1개 (스크롤 락 훅)                                       |

→ **재사용 가능한 모달 컴포넌트 추출이 안 된 상태** (부모 컴포넌트에 마크업 인라인). 향후 `<Modal>`/`<ConfirmDialog>` 추출 시 큰 정리 효과 기대.

---

## 4. 외부 토스트/알림 라이브러리

**결과: 미설치**

확인된 미설치 라이브러리:

- ❌ `react-toastify`
- ❌ `sonner`
- ❌ `react-hot-toast`
- ❌ `notistack`
- ❌ `react-toast`

→ 모든 알림은 `alert()` 사용 (비파괴적 토스트 부재).

---

## 5. 파일 입력 / 시스템 다이얼로그

### 5.1 `<input type="file">` — 총 10개

| 파일                                                | 사용 수 | 용도                      |
| --------------------------------------------------- | ------- | ------------------------- |
| `components/cluster-3/Cluster3Content.tsx`          | 4       | 산출물 파일/이미지 업로드 |
| `components/cluster-4-card/Cluster4CardContent.tsx` | 5       | 카드 이미지 업로드        |
| `components/cluster-2/Cluster2Content.tsx`          | 1       | 사진 업로드               |

### 5.2 File System Access API

- `showPicker()` — 0개
- `showOpenFilePicker()` — 0개

→ 모두 표준 HTML input 사용. 드래그앤드롭/미리보기는 자체 구현 또는 미구현.

---

## 6. UI 관련 외부 라이브러리 (`package.json`)

**설치됨**:

- ✅ `react-modal-video` — `^2.0.2` (동영상 모달, 5개 파일에서 사용)
  - `home-career/LastStream.tsx`, `home-two/LastStream.tsx`, `home-three/LastStream.tsx`, `tournaments/tabs/LiveStreaming.tsx`, `about/Poster.tsx`
- ✅ `bootstrap@5.3.3` — CSS only

**미설치** (검토 후 도입 가능):

- ❌ `react-bootstrap`, `@mui/material`, `@chakra-ui/react`, `antd`
- ❌ `@radix-ui/react-dialog`, `@headlessui/react`
- ❌ `react-modal`, `sweetalert2`

---

## 7. 가장 많이 사용되는 팝업 패턴 TOP 5

| 순위 | 패턴                                     | 사용 수 | 분류           |
| ---- | ---------------------------------------- | ------- | -------------- |
| 1    | 커스텀 모달 (인라인 마크업, SCSS 클래스) | 477     | D              |
| 2    | `alert()` 알림                           | 182     | A              |
| 3    | `window.confirm()` 확인                  | 82      | B              |
| 4    | `window.open()` 외부 링크                | 29      | (외부 이동)    |
| 5    | `react-modal-video` 동영상 모달          | 5       | D (라이브러리) |

---

## 8. 클러스터별 팝업 분포

| 영역                     | alert | confirm | open | 모달 클래스 | 핵심 특징                        |
| ------------------------ | ----- | ------- | ---- | ----------- | -------------------------------- |
| **cluster-4-card**       | 63    | 42      | 4    | 237         | 평판/키워드/폼 검증 등 가장 복잡 |
| **cluster-2**            | 42    | 24      | 2    | 115         | 학력/경력, 사진 업로드           |
| **cluster-4**            | 32    | 10      | —    | 57          | 시즌 리뷰/평판                   |
| **cluster-3**            | 22    | 4       | 4    | 68          | 채널/산출물                      |
| **home-career/Sidebar**  | 10    | 2       | 2    | —           | 사이드바 액션                    |
| 기타 (home-\*, about, …) | 13    | —       | 17   | —           | 외부 링크/단순 알림              |

---

## 9. A/B/C/D 분류 (교체 후보)

### A. 알림형 (Toast 후보) — 약 182개

- 출처: `alert()` 전체
- 분류 기준: 사용자 액션 결과를 비파괴적으로 알림 (저장 성공/실패, 검증 실패, 권한 안내 등)
- **권장 라이브러리**: `sonner` 또는 `react-hot-toast` (TS 친화 / 작은 번들 / Tailwind 호환)
- **마이그레이션 난이도**: 낮음 — 1:1 치환 가능

### B. 확인형 (ConfirmDialog 후보) — 약 82개

- 출처: `window.confirm()` 전체
- 분류 기준: 파괴적 액션 확인 (삭제, 초기화, 이탈)
- **권장 패턴**: 자체 ConfirmDialog 컴포넌트 (Promise 반환 API)
  ```ts
  const ok = await confirmDialog("삭제하시겠습니까?", { variant: "danger" });
  if (!ok) return;
  ```
- **마이그레이션 난이도**: 중간 — `if (!window.confirm(...))` 패턴 → `await confirmDialog(...)` 로 비동기화 필요

### C. 입력형 (InputDialog 후보) — 0개

- 현재 사용 없음 → 신규 컴포넌트 도입 우선순위 낮음

### D. 기존 커스텀 모달 (디자인 토큰 정렬 후보) — 약 477개 인스턴스

- 출처: `section-modal-*`, `section1-modal-*`, `section2-modal-*`, `edu-modal-*`, `help-modal-*` 등
- 마크업이 부모 컴포넌트에 인라인 → **컴포넌트 추출이 가장 큰 개선점**
- **권장 작업**:
  1. `<Modal>`, `<ModalHeader>`, `<ModalBody>`, `<ModalFooter>` 추출
  2. 디자인 토큰 정렬 (overlay opacity, border-radius, padding, button 스타일)
  3. 접근성 개선 (focus trap, ESC 닫기, aria-modal, aria-labelledby)
- **마이그레이션 난이도**: 높음 — 마크업 다양성이 커서 점진적 대체 필요

---

## 10. 강점 / 개선 필요 / 권장사항

### 강점

- ✅ 모달 클래스 네이밍이 일관됨 (`modal-*`, `section-modal-*` 패턴)
- ✅ `react-modal-video`로 동영상 모달은 외부 라이브러리화 완료
- ✅ `useModalScroll` 훅으로 스크롤 락 표준화

### 개선 필요

- ❌ `alert()` 182개 — UX 일관성/디자인 통일 부재
- ❌ `window.confirm()` 82개 — 디자인 통제 불가, A11y 한계
- ❌ 토스트 라이브러리 부재 → 비파괴적 알림 표현 수단 없음
- ❌ 모달 컴포넌트 추출 안 됨 → 마크업 477개 인라인 중복

### 권장 로드맵 (단계별)

1. **Phase 1 — 토스트 도입** (`sonner` 권장)
   - `alert()` → `toast.success/error/info` 전환 (자동화 후보 1순위)
2. **Phase 2 — ConfirmDialog 추출**
   - `window.confirm()` → `await confirmDialog(...)` 전환
   - 변종: 일반 / 위험(삭제) / 이탈 경고 (3가지 variant)
3. **Phase 3 — 공용 Modal 컴포넌트 추출**
   - `<Modal>` / `<ModalHeader>` / `<ModalBody>` / `<ModalFooter>` 정의
   - 기존 인라인 모달 점진 대체
   - 디자인 토큰 정렬 (overlay, radius, padding, 버튼 스타일)
4. **Phase 4 — A11y 개선**
   - focus trap, ESC 닫기, aria 속성, scroll lock 통합

---

## 부록: 조사 명령 요약

```bash
# 1. 네이티브 팝업
grep -rn '\balert(' --include='*.tsx' --include='*.ts'
grep -rn 'window\.confirm(' --include='*.tsx' --include='*.ts'
grep -rn '\bprompt(' --include='*.tsx' --include='*.ts'
grep -rn 'window\.open' --include='*.tsx' --include='*.ts'

# 2. React Bootstrap
grep -rn "from .react-bootstrap." --include='*.tsx' --include='*.ts'

# 3. 모달 클래스
grep -rn 'modal-' --include='*.tsx'

# 4. 토스트 라이브러리 (package.json)
cat package.json | grep -E "react-toastify|sonner|react-hot-toast|notistack"

# 5. 파일 입력
grep -rn 'type="file"' --include='*.tsx'
```

> 본 보고서는 조사 시점의 정적 분석 결과이며, 코드는 일절 수정하지 않았습니다.

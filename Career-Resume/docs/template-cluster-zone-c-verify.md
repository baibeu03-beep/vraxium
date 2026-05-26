# 📋 재사용 템플릿: 새 클러스터 페이지 Zone C(>1920px) 검증

> 새 클러스터 페이지를 만든 뒤, Zone C(>1920px 환경)에서 기존 처리가 정상 적용되는지 점검하는 템플릿.
> Zone A 템플릿과 달리 "selector 추가" 작업이 아니라 **"문제 없음을 확인하는 진단 점검표"**.

---

## 🎯 이 템플릿의 목적

Zone C는 다음 처리들이 **전역으로 모든 페이지에 자동 적용**됨:
- `zoom: 1.08` (ResponsiveScale.tsx)
- `max-width: 2072px` (body, .nftg-app)
- `sidebar transform: scale(1.31)` (JS 인라인)

새 클러스터 페이지를 만들면 위 처리들이 **자동으로 적용되어야 정상**.
본 템플릿으로 자동 적용 여부를 확인하고, 문제 발견 시 Claude에게 별도 진단 요청.

---

## 🔄 사용 순서

### 사전 준비

Zone C 환경 만들기. 다음 중 하나:
- 1920px 초과 모니터 (예: 2560×1440, 3440×1440, 4K)
- 또는 브라우저 창을 1921px 이상으로 늘리기
- 또는 DevTools 디바이스 시뮬레이션으로 큰 해상도 설정

확인:
```javascript
console.log('현재 뷰포트:', window.innerWidth, '(1921 이상이어야 Zone C)');
```

### 검증 페이지 목록

새로 만든 클러스터 페이지 + 기존 페이지 비교:
- `/cluster-신규` (예: /cluster-5)
- `/cluster-2` (이미 검증됨, 비교 기준)
- `/cluster-4` (이미 검증됨, 비교 기준)

---

## 🔍 검증 콘솔 스크립트 (각 페이지에서 실행)

```javascript
// === Zone C 검증 ===
console.log('=== Zone C 검증:', window.location.pathname, '===');
console.log('뷰포트:', window.innerWidth);
console.log('Zone C 매칭:', window.matchMedia('(min-width: 1921px)').matches);

// 1. zoom 적용 확인
const html = document.documentElement;
const body = document.body;
const app = document.querySelector('.nftg-app');

console.log('\n[1] zoom 적용 확인 (목표: 1.08)');
console.log('  html zoom:', getComputedStyle(html).zoom);
console.log('  body zoom:', getComputedStyle(body).zoom);
console.log('  nftg-app zoom:', getComputedStyle(app).zoom);

// 2. max-width 2072px 적용 확인
console.log('\n[2] max-width 적용 확인');
console.log('  body max-width:', getComputedStyle(body).maxWidth, '(목표: 2072px)');
console.log('  nftg-app max-width:', getComputedStyle(app).maxWidth, '(목표: 2072px)');
console.log('  body 실제 width:', body.getBoundingClientRect().width.toFixed(0));
console.log('  nftg-app 실제 width:', app.getBoundingClientRect().width.toFixed(0));

// 3. sidebar scale 확인
const sb = document.querySelector('.sidebar-sticky-wrapper, .nftg-sidebar');
console.log('\n[3] sidebar scale 확인 (목표: 1.31 적용)');
if (sb) {
  console.log('  sidebar transform:', getComputedStyle(sb).transform);
  console.log('  sidebar 실제 height:', sb.getBoundingClientRect().height.toFixed(0));
}

// 4. 콘텐츠 root 위치/폭 확인
const main = document.querySelector('.home-two-content-col');
console.log('\n[4] 콘텐츠 영역 확인');
if (main) {
  const r = main.getBoundingClientRect();
  console.log('  home-two-content-col width:', r.width.toFixed(0));
  console.log('  left/right:', r.left.toFixed(0), '~', r.right.toFixed(0));
}

// 5. 가로 스크롤 발생 여부 (Zone C는 가로 스크롤 없어야 정상)
console.log('\n[5] 가로 스크롤 확인 (Zone C는 없어야 정상)');
console.log('  document scrollWidth:', document.documentElement.scrollWidth);
console.log('  innerWidth:', window.innerWidth);
console.log('  가로 스크롤 발생?:', document.documentElement.scrollWidth > window.innerWidth);

// 6. 화면 밖으로 튀어나간 요소 확인
console.log('\n[6] 화면 밖 요소 확인');
const allElements = document.querySelectorAll('.home-two-content-col *');
const overflowing = [];
allElements.forEach(el => {
  const r = el.getBoundingClientRect();
  if (r.right > window.innerWidth + 10) {
    overflowing.push({
      tag: el.tagName,
      cls: el.className.toString().slice(0, 40),
      right: r.right.toFixed(0)
    });
  }
});
console.log('  화면 우측 밖으로 나간 요소 수:', overflowing.length);
if (overflowing.length > 0) {
  console.log('  처음 5개:', overflowing.slice(0, 5));
}
```

---

## ✅ 정상 결과 판정 기준

각 항목이 모두 충족되면 **새 페이지가 Zone C에서 정상 동작** = 추가 작업 불필요.

| 항목 | 기대값 | 의미 |
|------|--------|------|
| [1] nftg-app zoom | `1.08` (또는 ResponsiveScale 적용된 값) | 전역 zoom 정상 적용 |
| [2] body max-width | `2072px` | 전역 max-width 정상 적용 |
| [2] nftg-app max-width | `2072px` | 전역 max-width 정상 적용 |
| [3] sidebar transform | `matrix(...)` 또는 `scale(1.31, 1.31)` | sidebar scale 정상 적용 |
| [4] home-two-content-col width | 1238px 또는 zoom 반영된 값 | 콘텐츠 영역 정상 |
| [5] 가로 스크롤 | `false` | Zone C는 1920~2072 사이라 스크롤 없음 |
| [6] 화면 밖 요소 | `0개` | 콘텐츠가 뷰포트 안에 들어감 |

---

## 🚨 문제 유형별 분류 (발견 시)

### 유형 A: zoom 1.08이 적용 안 됨
- 현상: nftg-app zoom이 `normal` 또는 `1`
- 원인 추정: ResponsiveScale.tsx의 매칭 조건이 새 페이지에서 작동 안 함
- 대응: Claude에게 "새 클러스터에서 ResponsiveScale이 적용 안 됨" 보고

### 유형 B: max-width 2072가 적용 안 됨
- 현상: body 또는 nftg-app의 max-width가 `none` 또는 다른 값
- 원인 추정: 새 페이지가 다른 wrapper 구조 사용
- 대응: Claude에게 "wrapper 구조 다름" 보고 + 부모 체인 진단 요청

### 유형 C: sidebar scale이 적용 안 됨
- 현상: sidebar transform이 `none`
- 원인 추정: JS 인라인 적용 로직이 새 페이지를 인식 못 함
- 대응: Claude에게 "sidebar scale 미적용" 보고

### 유형 D: 화면 밖으로 요소가 튀어나감
- 현상: [6] 검증에서 1개 이상 요소가 우측 밖
- 원인 추정: 페이지 내 특정 요소가 max-width 무시
- 대응: 튀어나간 요소 클래스명 보고 + 별도 진단 요청

### 유형 E: 가로 스크롤 발생
- 현상: [5] 검증에서 scrollWidth > innerWidth
- 원인 추정: max-width 적용 안 됐거나 특정 요소가 뚫고 나감
- 대응: 유형 B 또는 D와 함께 검토

### 유형 F: sidebar jitter (메모상 미해결 이슈)
- 현상: 화면 리사이즈/스크롤 시 sidebar가 떨림
- 알려진 이슈 (메모 참조): hysteresis + throttle 적용했으나 완전 해결 안 됨
- 대응: 일단 보고만, 별도 추적 사안

---

## 📨 문제 발견 시 Claude에 전달할 프롬프트 양식

```
# Zone C 검증 결과 보고

## 페이지
[/cluster-N URL]

## 발견된 문제 유형
유형 [A/B/C/D/E/F]

## 콘솔 검증 결과 (전체 붙여넣기)
[위 검증 스크립트 출력 전체]

## 비교: 기존 페이지(cluster2 또는 cluster4)에서 같은 스크립트 실행 결과
[cluster2 또는 cluster4에서 실행한 출력 전체]

## 시각적 차이
- 기존 페이지(cluster2~4)와 새 페이지의 시각적 차이 설명
- 가능하면 양쪽 스크린샷 첨부

## 요청
이 문제의 원인 진단 + 해결 방법 제안
```

---

## ⚠️ 본 템플릿이 다루지 않는 것

본 템플릿은 **검증/진단**만 담당. 실제 수정은 다음을 따라야 함:

1. 검증에서 문제 발견 → 위 양식으로 Claude에 보고
2. Claude가 원인 진단 + 별도 .md 프롬프트 작성
3. 그 프롬프트로 Claude Code에 작업 지시

**절대 하지 말 것**:
- 본 템플릿 결과만 보고 임의로 SCSS 수정 시도
- ResponsiveScale.tsx 직접 수정
- max-width 2072 변경
- Zone B(1920) baseline 영향 줄 수 있는 수정

---

## 📚 참고: Zone A vs Zone C 작업 방식 비교

| 구분 | Zone A | Zone C |
|------|--------|--------|
| 새 클러스터 추가 시 | selector 1줄 추가 (단순) | 보통 자동 적용 (작업 불필요) |
| 문제 패턴 | 모든 페이지 동일 (1238px 갇힘) | 페이지마다 다를 수 있음 |
| 메커니즘 | flex 폭 강제 | zoom + max-width 전역 |
| 템플릿 용도 | 작업 프롬프트 | 검증 점검표 |
| 검증 후 액션 | push | 보통 작업 없음, 문제 시만 별도 진단 |

---

## 🎯 권장 워크플로우 (새 클러스터 만들 때 전체 흐름)

```
1. 새 클러스터 페이지 만들기 (디자인 + 기능)
   ↓
2. Zone B(1920) 환경에서 페이지 정상 작동 확인
   ↓
3. Zone A(<1920) 환경에서 진단 → Zone A 템플릿 사용 → selector 추가
   ↓
4. Zone C(>1920) 환경에서 본 템플릿으로 검증
   ├─ 모두 정상 → 작업 종료
   └─ 문제 발견 → 보고 양식으로 Claude에 진단 요청 → 별도 처리
   ↓
5. 모든 Zone에서 정상 작동 확인 후 push
```

# Reputation + Weekly Review 코드 추출 (2026-04-25)

> 재사용 가이드 작성을 위한 현재 코드 추출. 파일 수정 없이 읽기만.

---

## A. SCSS 블록 위치 요약

| 블록                                         | 파일                 | 시작  | 끝    |
| -------------------------------------------- | -------------------- | ----- | ----- |
| `&.section-modal-reputation-form`            | \_cluster4-week.scss | 5356  | 5926  |
| `&.reputation-view-modal` (nested)           | \_cluster4-week.scss | 7255  | 7771  |
| `.section-modal-weekly-review-form`          | \_cluster4-week.scss | 12884 | 13473 |
| `.weekly-review-box`                         | \_cluster4-week.scss | 12622 | 12791 |
| `@keyframes weekly-review-float`             | \_cluster4-week.scss | 12795 | 12802 |
| reputation-form `.rating-field` 패턴         | \_cluster4-week.scss | 12807 | 12878 |
| `@keyframes weekly-review-field-error-flash` | \_cluster4-week.scss | 13475 | 13484 |
| `@keyframes field-error-flash`               | \_cluster4-week.scss | 5526  | 5536  |
| `@keyframes colleague-edit-field-flash`      | \_cluster4-week.scss | 5215  | 5224  |
| `.dropdown-options-fixed` (글로벌, cluster3) | \_cluster3.scss      | 2567  | 2615  |

### .workinfo-personal-card 정의 위치들 (\_cluster4-week.scss)

| 모달/컨텍스트            | 시작                                                          | 끝    |
| ------------------------ | ------------------------------------------------------------- | ----- |
| reputation-view-modal 내 | 7416                                                          | 7619  |
| colleague-view-modal 내  | 8014                                                          | 8162  |
| weekly-review-form 내    | 13112                                                         | 13248 |
| 기타 (workInfo view 등)  | 10669, 11645, 11691, 11737, 11783, 12109, 12403, 12429, 12483 | 각각  |

---

## B-1. reputation-form 별점 커스텀 드롭다운

### SCSS (.section-modal.section-modal-reputation-form)

- 위치: `_cluster4-week.scss:12807~12878`

```scss
.section-modal.section-modal-reputation-form {
  .rating-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .star-rating {
    display: flex;
    align-items: center;
    gap: 2px;
    font-family: Pretendard, sans-serif !important;
    height: 36px;
    min-height: 36px;
    box-sizing: border-box;
    flex-shrink: 0;

    i {
      color: #faab07;
      font-size: 16px;
    }

    .rating-text {
      margin-left: 6px;
      color: #faab07;
      font-size: 16px !important;
      font-family: Pretendard, sans-serif !important;
      font-weight: 600;
      background: none;
      padding: 0;
      white-space: nowrap;
    }
  }

  .custom-dropdown.small {
    position: relative;

    .dropdown-selected {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 10px;
      min-width: 55px;

      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;

      font-family: Pretendard, sans-serif;
      font-size: 16px;
      color: #fff;
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s;

      &:hover:not(.disabled) {
        border-color: rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.08);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      i.ti-chevron-down {
        font-size: 12px;
        opacity: 0.7;
      }
    }
  }
}
```

### TSX — state (Cluster4CardContent.tsx:1577~1579)

```tsx
const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
const [ratingDropdownPos, setRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const ratingDropdownTriggerRef = useRef<HTMLDivElement>(null);
```

### TSX — useEffect 외부 클릭/ESC (Cluster4CardContent.tsx:3010~3031)

```tsx
useEffect(() => {
  if (!ratingDropdownOpen) return;

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".dropdown-selected") && !target.closest(".dropdown-options-fixed")) {
      setRatingDropdownOpen(false);
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setRatingDropdownOpen(false);
  };

  document.addEventListener("mousedown", handleClick);
  document.addEventListener("keydown", handleKey);

  return () => {
    document.removeEventListener("mousedown", handleClick);
    document.removeEventListener("keydown", handleKey);
  };
}, [ratingDropdownOpen]);
```

### TSX — 핸들러 (Cluster4CardContent.tsx:3033~3046)

```tsx
const openRatingDropdown = () => {
  if (!isReputationFormEditing) return;
  const trigger = ratingDropdownTriggerRef.current;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  setRatingDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  setRatingDropdownOpen(true);
};

const handleRatingSelect = (value: number) => {
  setReputationEditData((prev) => ({ ...prev, rating: value }));
  setRatingDropdownOpen(false);
  if (saveAttemptFailed) setSaveAttemptFailed(false);
};
```

### TSX — rating-field JSX (Cluster4CardContent.tsx:7136~7168)

```tsx
<div className={`rating-input rating-field ${saveAttemptFailed && (!reputationEditData.rating || reputationEditData.rating === 0) ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`} data-field="rating">
  <span className="star-rating">
    {(() => {
      const r = reputationEditData.rating || 0;
      const fullStars = Math.floor(r / 2);
      const hasHalf = r % 2 === 1;
      const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
      return (
        <>
          {Array(fullStars)
            .fill(0)
            .map((_, i) => (
              <i key={`f${i}`} className="ti ti-star-filled" />
            ))}
          {hasHalf && <i className="ti ti-star-half-filled" />}
          {Array(emptyStars)
            .fill(0)
            .map((_, i) => (
              <i key={`e${i}`} className="ti ti-star" />
            ))}
        </>
      );
    })()}
    <span className="rating-text">{reputationEditData.rating || 0}/10</span>
  </span>

  <div className="custom-dropdown small">
    <div ref={ratingDropdownTriggerRef} className={`dropdown-selected ${!isReputationFormEditing ? "disabled" : ""}`} onClick={openRatingDropdown} role="button" tabIndex={isReputationFormEditing ? 0 : -1} aria-haspopup="listbox" aria-expanded={ratingDropdownOpen}>
      <span>{reputationEditData.rating || "-"}</span>
      <i className="ti ti-chevron-down"></i>
    </div>
  </div>
</div>
```

### TSX — 옵션 패널 Portal (Cluster4CardContent.tsx:9519~9547)

```tsx
{
  ratingDropdownOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="dropdown-options-fixed"
        style={{
          position: "fixed",
          top: ratingDropdownPos.top,
          left: ratingDropdownPos.left,
          width: Math.max(ratingDropdownPos.width, 70),
          zIndex: 100010,
        }}
        role="listbox"
        onWheel={(e) => e.stopPropagation()}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <div key={n} className={`dropdown-option${reputationEditData.rating === n ? " selected" : ""}`} onClick={() => handleRatingSelect(n)} role="option" aria-selected={reputationEditData.rating === n}>
            {n}
          </div>
        ))}
      </div>,
      document.body,
    );
}
```

---

## B-2. reputation-form handleEditMode 승인 게이트

- 위치: `Cluster4CardContent.tsx:3273~3289`

```tsx
const handleEditMode = () => {
  // 승인 체크 — reputation-view-modal [수정] (L3031)과 동일 패턴
  if (!canEditReputation) {
    alert("작성할 수 있는 기간이 아닙니다. 😊");
    return;
  }

  setFormSnapshot({
    rating: reputationEditData.rating,
    content: reputationEditData.content,
    keyword: reputationEditData.keyword,
  });
  setIsReputationFormEditing(true);
  setReputationSaveError(null);
  setReputationSaveSuccess(false);
  setSaveAttemptFailed(false);
};
```

---

## B-3. weekly-review-form 전체

### SCSS 전체 블록

- 위치: `_cluster4-week.scss:12884~13473`
- (위 A 섹션의 SCSS 읽기 결과 전체 — 590줄)

### TSX — state 정의 (Cluster4CardContent.tsx:1582~1594)

```tsx
const [weeklyReviewModalOpen, setWeeklyReviewModalOpen] = useState(false);
const [weeklyReviewData, setWeeklyReviewData] = useState({ rating: 0, content: "" });
const [isWeeklyReviewEditing, setIsWeeklyReviewEditing] = useState(false);
const [reviewRatingDropdownOpen, setReviewRatingDropdownOpen] = useState(false);
const [reviewRatingDropdownPos, setReviewRatingDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const reviewRatingDropdownTriggerRef = useRef<HTMLDivElement>(null);
const [weeklyReviewSaving, setWeeklyReviewSaving] = useState(false);
const [weeklyReviewSaveAttemptFailed, setWeeklyReviewSaveAttemptFailed] = useState(false);
const [weeklyReviewFormSnapshot, setWeeklyReviewFormSnapshot] = useState<{ rating: number; content: string } | null>(null);
const [weeklyReviewFieldErrorFlash, setWeeklyReviewFieldErrorFlash] = useState(false);
const [weeklyReviewFromDB, setWeeklyReviewFromDB] = useState<{
  id?: string;
  weekCardId?: string;
  rating: number;
  content: string;
  created_at?: string;
  updated_at?: string;
} | null>(null);
```

unfurl ref/state (Cluster4CardContent.tsx:1773~1774):

```tsx
const weeklyReviewRef = useRef<HTMLDivElement>(null);
const [isReviewUnfurled, setIsReviewUnfurled] = useState(false);
```

### TSX — 핸들러

**openReviewRatingDropdown (3049~3056):**

```tsx
const openReviewRatingDropdown = () => {
  if (!isWeeklyReviewEditing) return;
  const trigger = reviewRatingDropdownTriggerRef.current;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  setReviewRatingDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  setReviewRatingDropdownOpen(true);
};
```

**handleReviewRatingSelect (3058~3061):**

```tsx
const handleReviewRatingSelect = (value: number) => {
  setWeeklyReviewData((prev) => ({ ...prev, rating: value }));
  setReviewRatingDropdownOpen(false);
};
```

**fetchWeeklyReview (3083~3122):**

```tsx
const fetchWeeklyReview = async () => {
  if (isDemoMode) {
    setWeeklyReviewFromDB({
      id: "demo-weekly-review-init",
      weekCardId: weekId,
      rating: 8,
      content: "이번 주차에는 새로운 프로젝트를 시작하면서 팀워크의 중요성을 다시 한번 느꼈습니다. 협업 도구를 적극 활용하여 효율적으로 진행했고, 동료들의 피드백을 통해 많이 성장할 수 있었습니다.",
      created_at: new Date().toISOString(),
    });
    return;
  }

  try {
    const res = await fetch(`/api/weekly-reviews?weekCardId=${weekId}`);
    if (!res.ok) {
      setWeeklyReviewFromDB(null);
      return;
    }
    const data = await res.json();
    let record = null;
    if (Array.isArray(data)) {
      record = data.length > 0 ? data[0] : null;
    } else if (data && data.id) {
      record = data;
    }
    if (record) {
      setWeeklyReviewFromDB({
        id: record.id,
        weekCardId: record.weekCardId || weekId,
        rating: record.rating,
        content: record.content,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    } else {
      setWeeklyReviewFromDB(null);
    }
  } catch (err) {
    console.error("[weekly-review] fetch 예외:", err);
    setWeeklyReviewFromDB(null);
  }
};
```

**isWeeklyReviewValid (3130~3132):**

```tsx
const isWeeklyReviewValid = (): boolean => {
  return weeklyReviewData.rating > 0 && weeklyReviewData.content.trim().length > 0;
};
```

**isWeeklyReviewDirty (3134~3139):**

```tsx
const isWeeklyReviewDirty = (): boolean => {
  if (!weeklyReviewFormSnapshot) {
    return weeklyReviewData.rating > 0 || weeklyReviewData.content.length > 0;
  }
  return weeklyReviewData.rating !== weeklyReviewFormSnapshot.rating || weeklyReviewData.content !== weeklyReviewFormSnapshot.content;
};
```

**saveWeeklyReview (3142~3169):**

```tsx
const saveWeeklyReview = async (): Promise<{ id: string; weekCardId?: string; created_at: string; updated_at?: string } | null> => {
  const isUpdate = !!weeklyReviewFromDB?.id;

  if (isDemoMode) {
    const now = new Date().toISOString();
    if (isUpdate && weeklyReviewFromDB) {
      return { id: weeklyReviewFromDB.id!, weekCardId: weeklyReviewFromDB.weekCardId, created_at: weeklyReviewFromDB.created_at || now, updated_at: now };
    }
    return { id: `demo-weekly-review-${Date.now()}`, weekCardId: weekId, created_at: now };
  }

  try {
    const endpoint = isUpdate ? `/api/weekly-reviews/${weeklyReviewFromDB?.id}` : "/api/weekly-reviews";
    const method = isUpdate ? "PUT" : "POST";
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekCardId: weekId, rating: weeklyReviewData.rating, content: weeklyReviewData.content }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, weekCardId: data.weekCardId, created_at: data.created_at, updated_at: data.updated_at };
  } catch (err) {
    console.error("[weekly-review] API 예외:", err);
    return null;
  }
};
```

**handleWeeklyReviewClose (3186~3191):**

```tsx
const handleWeeklyReviewClose = () => {
  if (isWeeklyReviewEditing && isWeeklyReviewDirty()) {
    if (!window.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?")) return;
  }
  setWeeklyReviewModalOpen(false);
};
```

**handleWeeklyReviewEditClick (3194~3203):**

```tsx
const handleWeeklyReviewEditClick = () => {
  if (!canEditReputation) {
    alert("작성할 수 있는 기간이 아닙니다. 😊");
    return;
  }
  setWeeklyReviewFormSnapshot({ rating: weeklyReviewData.rating, content: weeklyReviewData.content });
  setWeeklyReviewSaveAttemptFailed(false);
  setWeeklyReviewFieldErrorFlash(false);
  setIsWeeklyReviewEditing(true);
};
```

**handleWeeklyReviewCancel (3205~3220):**

```tsx
const handleWeeklyReviewCancel = () => {
  if (isWeeklyReviewDirty()) {
    if (!window.confirm("작성 중인 내용이 있습니다. 취소하시겠습니까?")) return;
  }
  if (weeklyReviewFormSnapshot) {
    setWeeklyReviewData({ rating: weeklyReviewFormSnapshot.rating, content: weeklyReviewFormSnapshot.content });
  } else if (weeklyReviewFromDB) {
    setWeeklyReviewData({ rating: weeklyReviewFromDB.rating, content: weeklyReviewFromDB.content });
  } else {
    setWeeklyReviewData({ rating: 0, content: "" });
  }
  setIsWeeklyReviewEditing(false);
  setWeeklyReviewSaveAttemptFailed(false);
  setWeeklyReviewFieldErrorFlash(false);
  setWeeklyReviewFormSnapshot(null);
};
```

**handleWeeklyReviewHelp (3222~3224):**

```tsx
const handleWeeklyReviewHelp = () => {
  setHelpModalKind("weeklyReview");
};
```

**handleWeeklyReviewReset (3226~3235):**

```tsx
const handleWeeklyReviewReset = () => {
  if (!window.confirm("작성 내용을 초기 상태로 되돌리시겠습니까?")) return;
  if (weeklyReviewFormSnapshot) {
    setWeeklyReviewData({ rating: weeklyReviewFormSnapshot.rating, content: weeklyReviewFormSnapshot.content });
  } else {
    setWeeklyReviewData({ rating: 0, content: "" });
  }
  setWeeklyReviewSaveAttemptFailed(false);
  setWeeklyReviewFieldErrorFlash(false);
};
```

**handleWeeklyReviewSave (3237~3266):**

```tsx
const handleWeeklyReviewSave = async () => {
  if (!isWeeklyReviewValid()) {
    setWeeklyReviewSaveAttemptFailed(true);
    setWeeklyReviewFieldErrorFlash(true);
    setTimeout(() => setWeeklyReviewFieldErrorFlash(false), 600);
    return;
  }
  setWeeklyReviewSaving(true);
  try {
    const savedRecord = await saveWeeklyReview();
    if (!savedRecord) {
      alert("저장에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setWeeklyReviewFromDB({
      id: savedRecord.id,
      weekCardId: savedRecord.weekCardId,
      rating: weeklyReviewData.rating,
      content: weeklyReviewData.content,
      created_at: savedRecord.created_at,
      updated_at: savedRecord.updated_at,
    });
    setIsWeeklyReviewEditing(false);
    setWeeklyReviewSaveAttemptFailed(false);
    setWeeklyReviewFieldErrorFlash(false);
    setWeeklyReviewFormSnapshot(null);
  } catch (err) {
    console.error("[weekly-review] 저장 실패:", err);
    alert("저장 중 오류가 발생했습니다.");
  } finally {
    setWeeklyReviewSaving(false);
  }
};
```

### TSX — useEffect

**드롭다운 외부 클릭/ESC (3063~3080):**

```tsx
useEffect(() => {
  if (!reviewRatingDropdownOpen) return;
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".review-rating-section .dropdown-selected") && !target.closest(".review-rating-dropdown-options")) {
      setReviewRatingDropdownOpen(false);
    }
  };
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setReviewRatingDropdownOpen(false);
  };
  document.addEventListener("mousedown", handleClick);
  document.addEventListener("keydown", handleKey);
  return () => {
    document.removeEventListener("mousedown", handleClick);
    document.removeEventListener("keydown", handleKey);
  };
}, [reviewRatingDropdownOpen]);
```

**페이지 로드 fetch (3124~3127):**

```tsx
useEffect(() => {
  if (!weekId) return;
  fetchWeeklyReview();
}, [weekId, isDemoMode]);
```

**모달 초기화 (3172~3183):**

```tsx
useEffect(() => {
  if (!weeklyReviewModalOpen) return;
  if (weeklyReviewFromDB) {
    setWeeklyReviewData({ rating: weeklyReviewFromDB.rating, content: weeklyReviewFromDB.content });
  } else {
    setWeeklyReviewData({ rating: 0, content: "" });
  }
  setIsWeeklyReviewEditing(false);
  setWeeklyReviewFormSnapshot(null);
  setWeeklyReviewSaveAttemptFailed(false);
  setWeeklyReviewFieldErrorFlash(false);
}, [weeklyReviewModalOpen, weeklyReviewFromDB]);
```

**IntersectionObserver / scroll unfurl (1783~1808):**

```tsx
useEffect(() => {
  const target = weeklyReviewRef.current;
  if (!target) return;
  if (isReviewUnfurled) return;

  const checkVisible = () => {
    const r = target.getBoundingClientRect();
    const isVisible = r.top < window.innerHeight && r.bottom > 0;
    if (isVisible) {
      setIsReviewUnfurled(true);
      window.removeEventListener("scroll", checkVisible);
      window.removeEventListener("resize", checkVisible);
    }
  };

  const initialTimer = setTimeout(checkVisible, 100);
  window.addEventListener("scroll", checkVisible, { passive: true });
  window.addEventListener("resize", checkVisible, { passive: true });

  return () => {
    clearTimeout(initialTimer);
    window.removeEventListener("scroll", checkVisible);
    window.removeEventListener("resize", checkVisible);
  };
}, [isReviewUnfurled]);
```

### TSX — 모달 JSX Portal (9303~9485)

(전체 코드는 B-3 SCSS 블록 다음에 위치. 아래 요약)

```
L9303: {weeklyReviewModalOpen && typeof document !== "undefined" && createPortal(
L9306:   <div className="section-modal-overlay">
L9307:     <div className="section-modal section-modal-weekly-review-form">
           ... 헤더 (write.png + "주차 리뷰" + subtitle)
           ... 미드 3행 (주차정보+평점 / 인적사항 / textarea)
           ... 푸터 Type B (🔎 + 수정/취소/초기화/저장)
L9482:     </div>
L9484:   </div>, document.body)
L9485: }
```

### TSX — 옵션 패널 Portal (9488~9516)

```tsx
{
  reviewRatingDropdownOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="dropdown-options-fixed review-rating-dropdown-options"
        style={{
          position: "fixed",
          top: reviewRatingDropdownPos.top,
          left: reviewRatingDropdownPos.left,
          width: Math.max(reviewRatingDropdownPos.width, 70),
          zIndex: 100010,
        }}
        role="listbox"
        onWheel={(e) => e.stopPropagation()}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <div key={n} className={`dropdown-option${weeklyReviewData.rating === n ? " selected" : ""}`} onClick={() => handleReviewRatingSelect(n)} role="option" aria-selected={weeklyReviewData.rating === n}>
            {n}
          </div>
        ))}
      </div>,
      document.body,
    );
}
```

---

## B-5. 인적사항 카드 reputation 패턴 (display: contents)

- 위치: `_cluster4-week.scss:13112~13248` (weekly-review-form 내)

핵심:

```scss
.personal-row-2,
.personal-row-3 {
  display: grid !important;
  grid-template-columns: 160px 40px 20px 160px 40px !important;
  grid-template-rows: 26px !important;
  gap: 5px 0 !important;
  align-items: center !important;
}

.personal-field {
  display: contents !important;
}

.tag-badge {
  width: 192px !important;
  height: 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  &.tag-role {
    background: rgba(250, 171, 7, 0.15);
    border: 1px solid rgba(250, 171, 7, 0.3);
    color: rgb(250, 171, 7);
  }
  &.tag-keyword {
    background: rgba(135, 206, 250, 0.15);
    border: 1px solid rgba(135, 206, 250, 0.3);
    color: rgb(135, 206, 235);
  }
}
```

---

## B-6. Weekly Review 박스 (좌하단 unfurl 카드)

### SCSS

- 위치: `_cluster4-week.scss:12622~12791`
- (위 읽기 결과 전체 참조)

### TSX 마크업 (4981~5015)

```tsx
<div ref={weeklyReviewRef} className={`weekly-review-box ${isReviewUnfurled ? "unfurled" : ""}`}>
  <div className="weekly-review-header">
    <img src="/images/0/book.png" alt="book" className="review-book-icon" />
    <h3 className="review-title">Weekly Review</h3>
    <button className="review-view-btn" onClick={() => setWeeklyReviewModalOpen(true)} aria-label="더보기">
      <img src="/images/0/cluster4/icon/icon - 7 - eye.png" alt="view" className="view-icon" />
    </button>
  </div>
  <div className="weekly-review-mid">
    <p className="review-content">{weeklyReviewFromDB?.content || "아직 작성된 리뷰가 없습니다. 클릭하여 작성해보세요. 😊"}</p>
  </div>
  <div className="weekly-review-footer">
    <div className="review-rating-group">
      <div className="review-stars">
        {[1, 2, 3, 4, 5].map((i) => {
          const r = (weeklyReviewFromDB?.rating || 0) / 2;
          let cls = "ti-star";
          if (r >= i) cls = "ti-star-filled";
          else if (r >= i - 0.5) cls = "ti-star-half-filled";
          return <i key={i} className={`ti ${cls}`}></i>;
        })}
      </div>
      <span className="review-score">{weeklyReviewFromDB?.rating || 0} / 10</span>
    </div>
  </div>
</div>
```

---

## C. 공유 글로벌 패턴 — 버튼/푸터 스타일 정의 위치

| 패턴                                | 정의 위치                                                                    | 비고                    |
| ----------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `.modal-edit-btn / .modal-save-btn` | reputation-form L5305~5334, work-view L5859~5928, weekly-review L13404~13453 | 모달 스코프별 개별 정의 |
| `.modal-cancel-btn`                 | reputation-form L5320~5334, work-view L5879~5894, weekly-review L13417~13427 | 동일                    |
| `.modal-reset-btn`                  | reputation-form L5336~5350, work-view L5895~5910, weekly-review L13429~13438 | 동일                    |
| `.modal-help-icon`                  | reputation-form L5248~5275, work-view L5799~5826, weekly-review L13376~13395 | 동일                    |
| `.modal-footer-right`               | reputation-form L5276, work-view L5827, weekly-review L13397                 | 동일                    |
| `.modal-footer-bottom`              | reputation-form L5286, work-view L5838, weekly-review L13455                 | 동일                    |
| `.section-modal-overlay`            | 글로벌 (main.scss 또는 \_global.scss)                                        | 조사 필요               |
| `.dropdown-options-fixed`           | \_cluster3.scss L2567~2615                                                   | 글로벌 스코프           |

**결론**: 버튼/푸터 스타일은 글로벌 공통이 아닌, 각 모달 스코프에 개별 복제되어 있음.
새 모달 추가 시 해당 블록을 복제해야 함.

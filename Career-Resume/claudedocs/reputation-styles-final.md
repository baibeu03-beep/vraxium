# reputation-view-modal / reputation-form — 최종 스타일 추출

> 생성: 2026-04-24, 읽기 전용 추출 (파일 미수정)
> 대상 파일:
> - `app/assets/scss/components/_cluster4-week.scss`
> - `components/cluster-4-card/Cluster4CardContent.tsx`

## ⚠️ 인코딩 경고

두 원본 파일 모두 현재 **UTF-8 (with BOM)** + CRLF/LF 혼재 상태이며, IDE 자동 저장 과정에서 Korean 텍스트 일부가 mojibake(깨진 글자)로 재인코딩됨. 이 문서의 SCSS/JSX 블록은 구조·클래스명·속성·값은 정확하지만 **주석·placeholder·h3/subtitle/h4 내 텍스트 등은 원본과 다를 수 있음**. 기능·스타일 복원에는 지장 없음. Korean 텍스트가 필요하면 IDE(CP949 인식 가능한 편집기)로 직접 확인하거나 git HEAD에서 `git show HEAD:<path>` 로 재추출 권장.

---

# 1. reputation-form 최종 스펙

## 1-1. 크기 + 중앙 배치

- **selector**: `.section-modal.section-modal-reputation-form`
- width: `979px !important`
- max-width: `979px !important`
- height: `570px !important`
- max-height: `570px !important`
- display: flex / flex-direction: column
- 중앙 배치 (Zone A overlay `display:block` override 대응): `position: absolute !important; left: 50% !important; top: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important;`

## 1-2. SCSS 블록 전체 (L4849~L5691)

`.cluster4-card-content .section-modal` 스코프 내부의 `&.section-modal-reputation-form {}` 블록. 전체 843행.

```scss
    &.section-modal-reputation-form {
      width: 979px !important;
      max-width: 979px !important;
      height: 570px !important;
      max-height: 570px !important;
      display: flex;
      flex-direction: column;
      position: absolute !important;
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;

      .tagsanjiseok-highlight {
        background: rgba(250, 171, 7, 0.3);
        color: #faab07;
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: 600;
      }

      .section-modal-header {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        box-sizing: border-box;
        flex-shrink: 0;
        height: auto;
        min-height: 110px;
        max-height: none;
        padding: 8px 24px 16px;
        position: relative;
        overflow: visible;
        border-bottom: none;
        background: transparent;

        .modal-header-top {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          width: 100%;

          img {
            width: 72px;
            height: 72px;
            object-fit: contain;
            flex-shrink: 0;
          }

          h3 {
            margin: 0;
            font-family: "Pretendard", sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #faab07;
            line-height: 1.4;
            padding-top: 0;
          }
        }

        .modal-subtitle {
          margin: 4px 67px 0 80px;
          padding-left: 0 !important;  // h3 시작 x좌표와 일치
          max-width: calc(100% - 147px);
          min-width: 0;
          font-family: "Pretendard", sans-serif;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.6);
        }

        .modal-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 4px;
          line-height: 1;

          i { font-size: 20px; }
          &:hover { color: #faab07; }
        }
      }

      // 미드 (342px) — 2열 그리드 + 내용 textarea
      .reputation-form-body {
        padding: 12px 24px 24px;
        flex: 1 1 auto;
        overflow-y: auto;
        box-sizing: border-box;
      }

      .reputation-form-top {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-bottom: 12px;
      }

      // 공통 h4 + 제약 힌트
      .form-rating-section,
      .form-keyword-section,
      .form-content-section {
        h4 {
          font-family: "Pretendard", sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #ddd;
          margin: 0 0 12px 0;

          .required-mark {
            color: #e74c3c !important;
            font-weight: 700 !important;
            font-size: 16px !important;
            margin-left: 4px;
            margin-right: 4px;
          }

          .limit-hint {
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.5);
            margin-left: 8px;
          }
        }
      }

      .form-content-section { position: relative; }  // char-count 기준

      // 필수필드 검증 실패 표시 + 깜빡임
      .field-error {
        border-color: #e74c3c !important;
        box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.2) !important;

        &.flash {
          animation: field-error-flash 0.3s ease-in-out 2 !important;
        }
      }

      .rating-stars.field-error {
        background: rgba(231, 76, 60, 0.05);
        border: 1px solid rgba(231, 76, 60, 0.3) !important;
        box-shadow: none !important;
        padding: 4px 8px;
        border-radius: 4px;

        &.flash {
          animation: field-error-flash 0.3s ease-in-out 2 !important;
        }
      }

      @keyframes field-error-flash {
        0%, 100% {
          border-color: #e74c3c;
          box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.2);
        }
        50% {
          border-color: #ff6b6b;
          box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.5);
        }
      }

      // 1열: 평점 (select + 별 readonly)
      .rating-input {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-left: 19px;

        &.field-missing {
          animation: reputation-field-blink 0.3s ease-in-out 3;
          outline-offset: 4px;
        }

        .rating-select {
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ddd;
          font-family: "Pretendard", sans-serif;
          font-size: 14px;
          border-radius: 4px;
          cursor: pointer;

          &:focus { outline: none; border-color: #faab07; }
          &:disabled { opacity: 0.6; cursor: not-allowed; }
          &.field-error {
            border-color: rgba(231, 76, 60, 0.6) !important;
            background: rgba(231, 76, 60, 0.05);
          }
        }

        .rating-stars {
          display: flex;
          gap: 4px;
          margin-top: 11px !important;  // y좌표 0.3cm 아래로

          .rating-star {
            font-size: 32px;
            line-height: 1;
            cursor: default;
            transition: transform 0.1s;
            user-select: none;

            &.clickable { cursor: pointer; }
            &.clickable:hover { transform: scale(1.1); }
            &.readonly {
              cursor: default;
              &:hover { transform: none; }
            }

            &.star-empty { color: rgba(255, 255, 255, 0.2); }
            &.star-full  { color: #faab07; }
            &.star-half {
              background: linear-gradient(90deg, #faab07 50%, rgba(255, 255, 255, 0.2) 50%);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              color: transparent;
            }
          }
        }

        .rating-value {
          font-family: "Pretendard", sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #faab07;
          min-width: 50px;
        }
      }

      // 2열: 키워드 (라디오 모드 + # prefix + input)
      .keyword-mode-select {
        display: flex;
        gap: 24px;
        margin-bottom: 8px !important;

        label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: #ddd;
          font-family: "Pretendard", sans-serif;
          font-size: 14px;

          input[type="radio"] {
            cursor: pointer;
            accent-color: #faab07;
          }
        }
      }

      .keyword-input-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;

        .keyword-hash {
          color: #faab07;
          font-family: "Pretendard", sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .keyword-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ddd;
          font-family: "Pretendard", sans-serif;
          font-size: 13px;
          border-radius: 4px;
          outline: none;
          transition: border-color 0.15s;

          &::placeholder { color: rgba(255, 255, 255, 0.3); }
          &:focus { border-color: #faab07; }
          &[readonly] {
            cursor: default;
            background: rgba(255, 255, 255, 0.08);
          }
        }
      }

      // 하단: 내용 textarea
      .form-content-textarea {
        width: 100%;
        height: 100px;
        padding: 12px 16px;
        padding-bottom: 24px !important;  // char-count 공간 확보
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ddd;
        font-family: "Pretendard", sans-serif;
        font-size: 13px;
        line-height: 1.6;
        border-radius: 4px;
        resize: none;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s;

        &::placeholder { color: rgba(255, 255, 255, 0.3); }
        &:focus { border-color: #faab07; }
      }

      // char-count (textarea 하단 absolute)
      .char-count {
        position: absolute !important;
        bottom: 6px !important;
        right: 10px !important;
        font-family: "Pretendard", sans-serif;
        font-size: 10px !important;
        color: rgba(255, 255, 255, 0.4) !important;
        background: transparent !important;
        padding: 0 !important;
        border-radius: 0 !important;
        pointer-events: none;
        margin: 0 !important;
        z-index: 2;
      }

      // 5단계 Type B 푸터: 행1 [도움말 + 버튼] / 행2 [안내문]
      .reputation-form-body { padding-top: 8px !important; }
      .form-rating-section h4,
      .form-keyword-section h4,
      .form-content-section h4 { margin-bottom: 4px !important; }
      .rating-input { margin-top: 0 !important; }
      .keyword-mode-select { margin-top: 0 !important; margin-bottom: 4px !important; }
      .reputation-form-top { margin-bottom: 0 !important; }
      .form-content-textarea {
        margin-top: 0 !important;
        height: 90px !important;
        min-height: 90px !important;
        max-height: 90px !important;
        padding-bottom: 20px !important;
      }
      .form-content-section { margin-top: 0 !important; padding-top: 0 !important; }
      .keyword-input-wrapper { margin-bottom: 0 !important; }

      .section-modal-footer {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
        padding: 16px 28px;
        height: 118px;
        min-height: 118px;
        max-height: 118px;
        box-sizing: border-box;
        border-top: none;
        background: transparent;

        // 행 1: 도움말 + 버튼 그룹
        .modal-footer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          position: relative;

          .modal-help-icon {
            flex-shrink: 0;
            width: 40px;
            height: 36px;
            font-size: 20px;
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #fff;

            &::before {
              content: "";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 46px;
              height: 46px;
              background: rgba(0, 0, 0, 0.6);
              border: none;
              border-radius: 0;
              z-index: -1;
            }
          }

          .modal-footer-right {
            flex-shrink: 0;
            min-width: 160px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
          }
        }

        // 행 2: 안내문 (visibility 토글로 공간 유지)
        .modal-footer-bottom {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          text-align: right;
          border: none;

          .modal-notice {
            font-family: "Pretendard", sans-serif;
            font-size: 15px;
            color: #faab07;
            text-align: right;
            margin: 0;

            &.notice-error { color: #ff4444; }
          }
        }

        // 공통 버튼
        .modal-save-btn {
          padding: 8px 20px;
          background: #faab07;
          border: 1px solid transparent;
          color: #1a1a1a;
          border-radius: 0;
          font-weight: 600;
          font-size: 14px;
          font-family: "Pretendard", sans-serif;
          cursor: pointer;
          white-space: nowrap;
          &:hover { background: #ffb820; }
          &:disabled { opacity: 0.3; cursor: not-allowed; }
        }

        .modal-cancel-btn {
          padding: 8px 20px;
          border: 1px solid #888;
          background: transparent;
          color: #888;
          border-radius: 0;
          font-size: 14px;
          font-family: "Pretendard", sans-serif;
          cursor: pointer;
          white-space: nowrap;
          &:hover {
            background: rgba(136, 136, 136, 0.1);
            color: #aaa;
          }
        }

        .modal-reset-btn {
          padding: 8px 20px;
          border: 1px solid #4caf50;
          background: transparent;
          color: #4caf50;
          border-radius: 0;
          font-size: 14px;
          font-family: "Pretendard", sans-serif;
          cursor: pointer;
          white-space: nowrap;
          &:hover { background: rgba(76, 175, 80, 0.1); }
        }

        .modal-edit-btn {
          padding: 8px 20px;
          background: #faab07;
          border: 1px solid transparent;
          color: #1a1a1a;
          border-radius: 0;
          font-size: 14px;
          font-weight: 600;
          font-family: "Pretendard", sans-serif;
          cursor: pointer;
          white-space: nowrap;
          &:hover { background: #ffb820; }
        }
      }

      // ══ 중첩: 키워드 선택 모달 (979×570) ══
      .keyword-select-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.68);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100002;
      }

      .keyword-select-modal {
        width: 979px !important;
        max-width: 979px !important;
        height: 570px !important;
        max-height: 570px !important;
        background: #121212;
        border: 1px solid rgba(250, 171, 7, 0.24);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .section-modal-header {
          height: 110px;
          min-height: 110px;
          max-height: 110px;
          padding: 16px 24px 4px;
          position: relative;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          box-sizing: border-box;
          border-bottom: none;
          background: transparent;

          .modal-header-top {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            width: 100%;

            img {
              width: 72px;
              height: 72px;
              object-fit: contain;
              flex-shrink: 0;
            }

            h3 {
              font-family: "Pretendard", sans-serif;
              font-size: 20px;
              font-weight: 700;
              color: #faab07;
              margin: 0;
            }
          }

          .modal-close-btn {
            position: absolute;
            top: 40px;
            right: 24px;
            z-index: 2;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            padding: 4px;
            line-height: 1;

            i { font-size: 20px; }
            &:hover { color: #faab07; }
          }

          .btn-select-header {
            position: absolute;
            top: 40px;
            right: 80px;
            z-index: 2;
            padding: 8px 20px;
            background: #faab07;
            color: #1a1a1a;
            border: none;
            border-radius: 4px;
            font-family: "Pretendard", sans-serif;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            &:disabled { opacity: 0.3; cursor: not-allowed; }
          }
        }

        .keyword-select-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
          box-sizing: border-box;

          &::-webkit-scrollbar { width: 8px; }
          &::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
          &::-webkit-scrollbar-thumb {
            background: rgba(250, 171, 7, 0.5);
            border-radius: 4px;
            &:hover { background: #faab07; }
          }
        }

        .keyword-group {
          margin-bottom: 24px;

          .group-title {
            font-family: "Pretendard", sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #ddd;
            margin: 0 0 4px 0 !important;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);

            .group-count {
              font-size: 11px;
              font-weight: 400;
              color: #faab07;
              margin-left: 8px;
            }
          }

          &.group-blue   .group-title { border-bottom-color: rgba(82, 167, 255, 0.6); }
          &.group-green  .group-title { border-bottom-color: rgba(91, 209, 130, 0.6); }
          &.group-yellow .group-title { border-bottom-color: rgba(255, 203, 70, 0.6); }
          &.group-orange .group-title { border-bottom-color: rgba(255, 149, 63, 0.6); }
          &.group-red    .group-title { border-bottom-color: rgba(255, 99, 99, 0.6); }
        }

        .keyword-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .keyword-chip {
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ddd;
          font-family: "Pretendard", sans-serif;
          font-size: 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;

          &:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 165, 0, 0.5);
          }

          &.selected {
            background: rgba(250, 171, 7, 0.2);
            border: 2px solid #faab07;
            color: #faab07;
            font-weight: 700;
            position: relative;

            &::after {
              content: "•";
              position: absolute;
              top: -4px;
              right: -4px;
              color: #e74c3c;
              font-size: 16px;
            }
          }
        }
      }

      // ══ 중첩: confirm-popup (삭제/초기화 등 window.confirm로 전환됨, 스타일만 잔존) ══
      .confirm-popup-overlay {
        position: absolute !important;  // fixed → absolute (모달 중심에 배치)
        inset: 0 !important;
        background: rgba(0, 0, 0, 0.6);
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 100003;
      }

      .confirm-popup {
        width: 400px;
        padding: 28px 24px 24px;
        background: #1a1a1a;
        border: 1px solid rgba(250, 171, 7, 0.35);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        text-align: center !important;

        p, h3, h4, span { text-align: center !important; }
        p {
          margin: 0 0 20px;
          font-family: "Pretendard", sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          line-height: 1.6;
        }

        .popup-buttons {
          display: flex !important;
          flex-direction: row !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 12px;
          width: 100%;
          margin: 0 auto;

          button {
            min-width: 88px;
            width: auto !important;
            flex: 0 0 auto !important;
            height: 38px;
            padding: 0 18px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            background: transparent;
            color: #ddd;
            font-family: "Pretendard", sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-align: center !important;
          }

          .btn-confirm {
            border-color: transparent;
            background: #faab07;
            color: #1a1a1a;
          }
        }
      }
    }
```

## 1-3. JSX 구조 (`Cluster4CardContent.tsx` L6830~L7083)

```tsx
{headerModalOpen && headerModalType === "평판" && (
  <div className="section-modal-overlay">
    <div className="section-modal section-modal-reputation-form">
      <div className="section-modal-header">
        <button className="modal-close-btn" onClick={...}>
          <i className="ti ti-x"></i>
        </button>
        <div className="modal-header-top">
          <img src="/images/0/write.png" alt="write"
               style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
          <h3>위클리 평판 (Weekly Reputation)</h3>
        </div>
        <p className="modal-subtitle">…2줄 설명…</p>
      </div>

      {/* 미드 (342px) — 2열 레이아웃 + textarea */}
      <div className="section-modal-body reputation-form-body">
        <div className="reputation-form-top">

          {/* 1열: 평점 (select + readonly 별) */}
          <div className="form-rating-section">
            <h4>■ 평점을 입력해주세요. <span className="required-mark">*</span></h4>
            <div className="rating-input" data-field="rating">
              <select
                className={`rating-select ${saveAttemptFailed && !rating ? "field-error" : ""}`}
                value={reputationEditData.rating || 0}
                disabled={!isReputationFormEditing}
                onChange={...}
              >
                <option value={0}>-</option>
                {[1..10].map(n => <option value={n}>{n}</option>)}
              </select>
              <div className={`rating-stars ${saveAttemptFailed && !rating ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`}>
                {[1..5].map(star => <span className={`rating-star readonly ${starClass}`}>★</span>)}
              </div>
              <span className="rating-value">{rating || 0} / 10</span>
            </div>
          </div>

          {/* 2열: 키워드 */}
          <div className="form-keyword-section">
            <h4>■ 키워드를 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 10자)</span></h4>
            <div className="keyword-mode-select">
              <label><input type="radio" name="keywordMode" value="select" .../> 선택</label>
              <label><input type="radio" name="keywordMode" value="write"  .../> 작성</label>
            </div>
            <div className="keyword-input-wrapper" data-field="keyword">
              <span className="keyword-hash">#</span>
              <input
                type="text"
                className={`keyword-input ${saveAttemptFailed && keyword.trim().length < 7 ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`}
                value={reputationEditData.keyword}
                maxLength={10}
                readOnly={!isReputationFormEditing || formKeywordMode === "select"}
                onChange={...}
              />
            </div>
          </div>
        </div>

        {/* 하단: 내용 textarea */}
        <div className="form-content-section" data-field="content">
          <h4>■ 내용을 입력해주세요. <span className="required-mark">*</span> <span className="limit-hint">(최대 100자)</span></h4>
          <textarea
            className={`form-content-textarea ${saveAttemptFailed && !content.trim() ? `field-error ${fieldErrorFlash ? "flash" : ""}` : ""}`}
            value={reputationEditData.content}
            readOnly={!isReputationFormEditing}
            maxLength={100}
            onChange={...}
          />
          <div className="char-count">{content.length}/100</div>
        </div>
      </div>

      {/* 푸터 (118px) Type B — 행1[🔎 + 버튼] / 행2[안내문] */}
      <div className="section-modal-footer">
        <div className="modal-footer-top">
          <div className="modal-help-icon" title="도움말" onClick={() => setShowHelpModal(true)}>🔎</div>
          <div className="modal-footer-right">
            {!isReputationFormEditing ? (
              <button className="modal-edit-btn" onClick={handleEditMode}>수정</button>
            ) : (
              <>
                <button className="modal-cancel-btn" onClick={handleFormCancel}>취소</button>
                <button className="modal-reset-btn"  onClick={handleFormReset}>초기화</button>
                <button className="modal-save-btn"   onClick={handleFormSave} disabled={reputationSaving}>
                  {reputationSaving ? "저장 중..." : "저장"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer-bottom">
          <span
            className={`modal-notice modal-footer-notice ${saveAttemptFailed ? "notice-error" : ""}`}
            style={{ visibility: isReputationFormEditing ? "visible" : "hidden" }}
          >
            {saveAttemptFailed
              ? "필수 사항이 누락되었어요! 확인 부탁드려요! 😊"
              : "내용을 모두 잘 확인하신 후 저장을 눌러주세요. 😊"}
          </span>
        </div>
      </div>

      {/* 중첩 모달: 키워드 선택 (979×570, KEYWORD_GROUPS 5군락 × 20개) */}
      {keywordModalOpen && (
        <div className="section-modal-overlay keyword-select-overlay">
          <div className="section-modal keyword-select-modal">
            <div className="section-modal-header">
              <button className="modal-close-btn" onClick={...}><i className="ti ti-x"/></button>
              <button className="btn-select-header" onClick={handleKeywordSelectConfirm} disabled={!selectedKeywordTemp}>선택</button>
              <div className="modal-header-top">
                <img src="/images/0/write.png" alt="write" .../>
                <h3>키워드를 선택해주세요. 😊</h3>
              </div>
            </div>
            <div className="section-modal-body keyword-select-body">
              {KEYWORD_GROUPS.map((group, gIdx) => (
                <div className={`keyword-group group-${group.color}`}>
                  <h4 className="group-title">[군락 {gIdx + 1}] {group.title} <span className="group-count">({group.count}개)</span></h4>
                  <div className="keyword-grid">
                    {group.keywords.map(keyword => (
                      <button
                        className={`keyword-chip ${selectedKeywordTemp === keyword ? "selected" : ""}`}
                        onClick={() => handleKeywordSelect(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

---

# 2. reputation-view-modal 최종 스펙

## 2-1. 크기 + 중앙 배치

- **selector**: `.section-modal.reputation-view-modal`
- width / height: `979px × 570px !important`
- display: flex / flex-direction: column
- 중앙 배치: 동일 패턴 (`position: absolute; left/top: 50%; transform: translate(-50%, -50%); margin: 0;`)

## 2-2. SCSS 블록 전체 (L6734~L7250)

```scss
    &.reputation-view-modal {
      width: 979px !important;
      max-width: 979px !important;
      height: 570px !important;
      max-height: 570px !important;
      display: flex;
      flex-direction: column;
      position: absolute !important;
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;

      // ═══ 헤더 (110px) ═══
      .section-modal-header {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        box-sizing: border-box;
        flex-shrink: 0;
        height: auto;
        min-height: 110px;
        max-height: none;
        padding: 8px 24px 16px;
        position: relative;
        overflow: visible;
        border-bottom: none;
        background: transparent;

        .modal-header-top {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          width: 100%;

          img {
            width: 72px;
            height: 72px;
            object-fit: contain;
            flex-shrink: 0;
          }

          h3 {
            font-family: "Pretendard", sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #faab07;
            margin: 0;

            // 전역 season scope의 ✦ ::before 제거
            &::before {
              content: none !important;
              display: none !important;
            }
          }
        }

        .modal-subtitle {
          font-family: "Pretendard", sans-serif;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 4px 67px 0 80px;
          padding-left: 0 !important;  // h3 x좌표와 일치
          max-width: calc(100% - 147px);
          min-width: 0;
          white-space: normal !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
          overflow: visible !important;
          text-overflow: unset !important;
          box-sizing: border-box !important;
          transform: none !important;
          margin-left: 80px !important;
        }

        .modal-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 4px;
          line-height: 1;

          i { font-size: 20px; }
          &:hover { color: #faab07; }
        }

        // 참고: [삭제][수정] 버튼 SCSS는 잔존하나 TSX에서 제거됨 (L6814~6878)
        // 현재 렌더되지 않음. 복원 시 TSX에 <button.modal-delete-btn>/<button.modal-edit-btn> 추가 필요.
        .modal-delete-btn {
          position: absolute;
          top: 16px;
          right: 148px;
          padding: 6px 14px;
          background: rgba(231, 76, 60, 0.15);
          border: 1px solid rgba(231, 76, 60, 0.4);
          color: #e74c3c;
          font-family: "Pretendard", sans-serif;
          font-size: 13px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          line-height: 1;
          &:hover {
            background: rgba(231, 76, 60, 0.3);
            border-color: #e74c3c;
          }
        }

        .modal-edit-btn {
          position: absolute;
          top: 16px;
          right: 80px;
          padding: 6px 14px;
          background: rgba(250, 171, 7, 0.15);
          border: 1px solid rgba(250, 171, 7, 0.4);
          color: #faab07;
          font-family: "Pretendard", sans-serif;
          font-size: 13px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          line-height: 1;
          &:hover {
            background: rgba(250, 171, 7, 0.3);
            border-color: #faab07;
          }
        }
      }

      // ═══ 미드 (460px) — 1열 세로 배치 ═══
      .section-modal-body.reputation-body {
        height: auto;
        min-height: 0;
        flex: 1 1 auto;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        box-sizing: border-box;
      }

      // ═══ 상단: 인적사항 카드 ═══
      .workinfo-personal-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 7px 12px;
        flex-shrink: 0;
        display: flex;
        align-items: center;

        .personal-grid {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1fr;  // 사진 | 정보
          grid-template-rows: auto;
          gap: 3px 12px;
          align-items: center;
        }

        .personal-photo {
          grid-column: 1;
          grid-row: 1;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          align-self: center;
          img { width: 100%; height: 100%; object-fit: cover; display: block; }
        }

        .personal-info {
          grid-column: 2;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .personal-row-1,
        .personal-row-2,
        .personal-row-3 {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: "Pretendard", sans-serif;
          font-size: 13px !important;
          line-height: 1.14;
          color: #ddd;
          min-width: 0;
        }

        .personal-row-1 {
          display: flex !important;
          align-items: center !important;
          gap: 8px;

          .personal-tags {
            margin-left: auto !important;
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            flex-shrink: 0;
          }
        }

        .personal-row-2,
        .personal-row-3 {
          display: grid;
          grid-template-columns: minmax(0, 160px) 40px 20px minmax(0, 160px) 40px;
          align-items: center;
          column-gap: 0;
          white-space: normal !important;
          min-width: 0;

          > .personal-field { display: contents; }
        }

        .personal-separator {
          color: rgba(255, 255, 255, 0.3);
          flex-shrink: 0;
          padding-left: 6px !important;
          font-size: 13px !important;
        }

        .personal-name {
          min-width: 64px;
          display: flex;
          align-items: center;
          width: 150px;
          height: 32px;
          padding: 4px 10px;
          margin: 0;
          border: 1px solid rgba(255, 165, 0, 0.3);
          background: rgb(26, 26, 46);
          white-space: nowrap;
          font-size: 13px !important;
        }
        .personal-gender {
          min-width: 16px;
          display: inline-block;
          white-space: nowrap;
          font-size: 13px !important;
        }
        .personal-age {
          min-width: 48px;
          display: inline-block;
          white-space: nowrap;
          font-size: 13px !important;
        }

        .personal-tags {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          width: auto;
          flex-shrink: 0;
        }

        .tag-badge {
          padding: 3px 11px !important;
          border-radius: 4px;
          font-family: "Pretendard", sans-serif;
          font-size: 13px !important;
          line-height: 1.14;
          font-weight: 600;
          white-space: normal !important;
          text-align: center;
          width: 170px;
          min-width: 170px;
          flex-shrink: 0;
          overflow: visible !important;
          overflow-wrap: break-word !important;
          text-overflow: unset !important;
          display: block;
          box-sizing: border-box;
        }

        .personal-tags .tag-badge { width: 170px; box-sizing: border-box; flex-shrink: 0; }
        .personal-tags .tag-badge.tag-role,
        .personal-tags .tag-badge.tag-keyword { width: 170px; text-align: center; }

        .tag-role {
          background: rgba(250, 171, 7, 0.15);
          color: #faab07;
          border: 1px solid rgba(250, 171, 7, 0.3);
        }

        .tag-keyword {
          background: rgba(135, 206, 250, 0.15);
          color: #87ceeb;
          border: 1px solid rgba(135, 206, 250, 0.3);
        }

        .personal-field {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          flex-shrink: 0;

          .field-value {
            font-family: "Pretendard", sans-serif;
            font-size: 13px !important;
            line-height: 1.14;
            color: #ddd;
            display: block;
            min-width: 0;
            white-space: normal !important;
            overflow: visible !important;
            overflow-wrap: break-word !important;
            text-overflow: unset !important;
          }

          .field-label {
            font-family: "Pretendard", sans-serif;
            font-size: 13px !important;
            line-height: 1.14;
            color: rgba(255, 255, 255, 0.4);
            flex-shrink: 0;
            min-width: 28px;
            display: block;
            white-space: nowrap;
            margin-right: 6px !important;
          }
        }
      }

      // ═══ 중단: 키워드 태그 + 내용 ═══
      .reputation-content-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;

        > .tag {
          align-self: flex-start;
          font-size: 15.6px !important;
          white-space: normal !important;
          overflow: visible !important;
          overflow-wrap: break-word !important;
          text-overflow: unset !important;
        }

        .reputation-content-box {
          margin-top: 0 !important;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          height: 80px !important;
          min-height: 80px !important;
          max-height: 80px !important;
          overflow-y: auto;

          .reputation-content-text {
            font-family: "Pretendard", sans-serif;
            font-size: 13px;
            line-height: 1.6;
            color: #ddd;
            white-space: pre-wrap !important;
            overflow-wrap: break-word !important;
            text-overflow: unset !important;
            margin: 0;
          }
        }
      }

      // ═══ 하단: 평점 + FM ═══
      .reputation-stats-row {
        display: flex;
        align-items: flex-end !important;  // 별·라벨·값 하단 y 일치
        gap: 40px;
        padding: 4px 0;
        flex-shrink: 0;

        .reputation-rating,
        .reputation-fm {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stats-label {
          font-family: "Pretendard", sans-serif;
          font-size: 18px !important;
          font-weight: 700;
          color: #ddd;
        }

        .rating-stars {
          display: flex;
          gap: 2px;
          transform: translateY(5px) !important;  // 별만 0.3cm 아래로
          line-height: 1.4 !important;
          height: auto !important;
          overflow: visible !important;

          .rating-star {
            display: inline-block;
            font-size: 24px !important;
            line-height: 1.4 !important;
            overflow: visible !important;
            vertical-align: middle;

            &.star-empty { color: rgba(255, 255, 255, 0.2); }
            &.star-full  { color: #faab07; }
            &.star-half {
              background: linear-gradient(90deg, #faab07 50%, rgba(255, 255, 255, 0.2) 50%);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              color: transparent;
            }
          }
        }

        .rating-value {
          font-family: "Pretendard", sans-serif;
          font-size: 18px !important;
          font-weight: 700;
          color: #faab07;
          min-width: 48px;
        }

        .fm-value {
          font-family: "Pretendard", sans-serif;
          font-size: 24px !important;
          font-weight: 700;
          color: #ddd;
          min-width: 28px;
        }
      }

      // ═══ 최하단: 구분선 + 타임스탬프 ═══
      .reputation-bottom-section {
        margin-top: auto;
        margin-left: -24px !important;
        margin-right: -24px !important;
        padding-top: 16px;
        padding-left: 24px !important;
        padding-right: 24px !important;
        flex-shrink: 0;

        .reputation-bottom-divider {
          height: 1px;
          background: rgba(255, 165, 0, 0.2);
          margin-left: -48px !important;
          margin-right: -48px !important;
          width: calc(100% + 96px) !important;
          margin-bottom: 12px;
        }
      }

      .reputation-timestamp {
        display: flex;
        justify-content: flex-end;
        padding: 4px 0;
        flex-shrink: 0;

        span {
          font-family: "Pretendard", sans-serif;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }
      }

      .section-modal-header h3,
      .reputation-content-text,
      .personal-field .field-value {
        text-overflow: unset !important;
        overflow-wrap: break-word !important;
      }
    }
```

## 2-3. JSX 구조 (`Cluster4CardContent.tsx` L7086~L7198)

```tsx
{reputationViewModalOpen && selectedReputationCard && (
  <div className="section-modal-overlay">
    <div className="section-modal reputation-view-modal">
      {/* 헤더 (110px) */}
      <div className="section-modal-header">
        <div className="modal-header-top">
          <img src="/images/0/write.png" alt="write" />
          <h3>위클리 평판 (Weekly Reputation)</h3>
        </div>
        <p className="modal-subtitle">…저는 당신의 한 주를 아래와 같이 바라보았습니다. 😊…</p>
        <button className="modal-close-btn" onClick={() => setReputationViewModalOpen(false)}>
          <i className="ti ti-x"></i>
        </button>
        {/* 참고: [삭제][수정] 버튼 제거됨 (이전 요청). SCSS는 잔존 */}
      </div>

      {/* 미드 (460px) — 1열 세로 배치 */}
      <div className="section-modal-body reputation-body">

        {/* 상단: 인적사항 카드 */}
        <div className="workinfo-personal-card">
          <div className="personal-grid">
            <div className="personal-photo"><img src={profileImg || "default"} .../></div>
            <div className="personal-info">
              <div className="personal-row-1">
                <span className="personal-name">{name}</span>
                <span className="personal-separator">|</span>
                <span className="personal-gender">{gender}</span>
                <span className="personal-separator">|</span>
                <span className="personal-age">{mask.age(age)} 세</span>
              </div>
              <div className="personal-row-2">
                <span className="personal-field">
                  <span className="field-value">{formatSchool(mask.school(university))}</span>
                  <span className="field-label">학교</span>
                </span>
                <span className="personal-separator">|</span>
                <span className="personal-field">
                  <span className="field-value">{formatMajor(mask.major(major))}</span>
                  <span className="field-label">학과</span>
                </span>
              </div>
              <div className="personal-row-3">
                <span className="personal-field">
                  <span className="field-value">{team}</span>
                  <span className="field-label">팀</span>
                </span>
                <span className="personal-separator">|</span>
                <span className="personal-field">
                  <span className="field-value">{part}</span>
                  <span className="field-label">파트</span>
                </span>
              </div>
            </div>
            <div className="personal-tags">
              <span className="tag-badge tag-role">{role || "일반"}</span>
              <span className="tag-badge tag-keyword">{nickname || keyword || "키워드"}</span>
            </div>
          </div>
        </div>

        {/* 중단: 키워드 태그 + 내용 */}
        <div className="reputation-content-section">
          <span className={`tag ${tagColor || "tag--pink"}`}>{tagText || "#—"}</span>
          <div className="reputation-content-box">
            <p className="reputation-content-text">{description || "-"}</p>
          </div>
        </div>

        {/* 하단: 평점 + FM */}
        <div className="reputation-stats-row">
          <div className="reputation-rating">
            <span className="stats-label">■ 평점</span>
            <div className="rating-stars">
              {[1..5].map(star => <span className={`rating-star ${starClass}`}>★</span>)}
            </div>
            <span className="rating-value">{ratingCount || "- / 10"}</span>
          </div>
          <div className="reputation-fm">
            <span className="stats-label">■ FM</span>
            <span className="fm-value">{fm ?? 0}</span>
          </div>
        </div>

        {/* 최하단: 구분선 + 타임스탬프 */}
        <div className="reputation-bottom-section">
          <div className="reputation-bottom-divider"></div>
          <div className="reputation-timestamp">
            <span>{formatReputationTime(createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

---

# 3. 공유 셀렉터 (두 모달 이상 영향)

| 위치 | 셀렉터 | 설명 |
|---|---|---|
| L4801 | `&.reputation-view-modal, &.colleague-view-modal` | body 내 텍스트 태그 font-size unset !important (리셋) |
| L11107 | `.cluster4-card-content .section-modal.reputation-view-modal` | 인적사항 카드 편집 UI 제거(border/outline/bg/shadow 초기화) |
| L11861 | reputation-view-modal + 4개 work-view-modal (5개 묶음) | 인적사항 pt 13px 통일, tag-badge padding 3px 10px |
| L11891 | `.cluster4-card-content .section-modal.reputation-view-modal` | 인적사항 원복 - pt 11/9, tag-badge 140px 세로 |
| L11945 | `.cluster4-card-content .section-modal.reputation-view-modal` | 미세 조정 - pt +4, tag 192px, bottom-section divider/timestamp 가시성 강화 |

⚠️ L11107 이후 블록들은 **외부 스코프(`.cluster4-card-content .section-modal.reputation-view-modal {}`)에 재선언**되어 내부 `&.reputation-view-modal {}` 블록의 일부 값을 덮어씀. 수정 시 두 위치 모두 확인 필요.

---

# 4. State 목록

## 공통 (두 모달에서 참조)
| state | 타입 | 위치 | 용도 |
|---|---|---|---|
| `weeklyReputations` | `any[]` | L1623 | 서버 평판 데이터 배열 |
| `canEditReputation` | `boolean` | L1605 | 관리자 승인 상태 (편집/삭제 가능 여부) |
| `sentReputationsThisWeek` | `Array<{targetUserId, weekCardId, createdAt}>` | L1616 | 이번주 발송 평판 중복 체크용 |

## reputation-form 전용
| state | 타입 | 위치 | 용도 |
|---|---|---|---|
| `headerModalOpen` | `boolean` | L1543 | 상단 섹션 모달 오픈 (평판/동료 공용) |
| `headerModalType` | `"평판" \| "본인" \| "동료"` | (별도) | 현재 열린 모달 종류 |
| `reputationEditData` | `{rating, content, keyword}` | L1569 | 폼 입력값 |
| `reputationSaving` | `boolean` | L1586 | 저장 중 상태 |
| `formKeywordMode` | `"select" \| "write"` | L1591 | 키워드 입력 모드 |
| `keywordModalOpen` | `boolean` | L1592 | 키워드 선택 중첩 모달 |
| `selectedKeywordTemp` | `string` | (별도) | 중첩 모달에서 임시 선택된 키워드 |
| `showWriteConfirm` | `boolean` | L1594 | 작성 모드 전환 확인 (현재 window.confirm 사용) |
| `showSelectConfirm` | `boolean` | L1595 | 선택 모드 전환 확인 (현재 window.confirm 사용) |
| `showResetConfirm` | `boolean` | L1600 | 초기화 확인 (현재 window.confirm 사용) |
| `formSnapshot` | `{rating, content, keyword} \| null` | L1596 | 편집 시작 시점 원본 (취소·초기화용) |
| `isReputationFormEditing` | `boolean` | L1597 | 폼 편집 모드 |
| `saveAttemptFailed` | `boolean` | L1598 | 검증 실패 → 필드 하이라이트 트리거 |
| `fieldErrorFlash` | `boolean` | L1599 | 검증 실패 시 테두리 깜빡임 0.6초 |

## reputation-view-modal 전용
| state | 타입 | 위치 | 용도 |
|---|---|---|---|
| `reputationViewModalOpen` | `boolean` | L1635 | 상세보기 모달 오픈 |
| `selectedReputationCard` | `any \| null` | L1636 | 현재 표시 중인 카드 데이터 |

---

# 5. 핸들러 목록

## reputation-form
| 핸들러 | 위치 | 시그니처 | 설명 |
|---|---|---|---|
| `handleRatingClick(value)` | L2952 | `(value: number) => void` | 별 클릭 시 평점 설정 (현재 select 사용으로 일부 대체) |
| `handleKeywordModeChange(mode)` | L2964 | `(mode: "select" \| "write") => void` | 라디오 전환 + 중첩 모달 제어 |
| `handleKeywordSelect(keyword)` | L2985 | `(keyword: string) => void` | 중첩 모달에서 키워드 임시 선택 |
| `handleKeywordSelectConfirm()` | L2991 | `() => void` | 중첩 모달 확인 버튼 |
| `handleKeywordSelectFinal()` | L3000 | `() => void` | 선택 확정 + 모달 닫기 |
| `handleFormCancel()` | L3008 | `() => void` | 편집 취소 (snapshot 복원) |
| `handleEditMode()` / `handleFormEditStart` | L3028 / L3041 | `() => void` | 편집 모드 진입 + snapshot 저장 |
| `handleFormReset()` | L3044 | `() => void` | 초기화 (window.confirm) |
| `handleFormSave()` | L3190 | `async () => void` | 검증 → 저장 → UI 반영 |
| `saveWeeklyReputation()` | L3279 | `async () => {id, created_at} \| null` | DB API 호출 (return for post-save 처리) |
| `isFormValid()` | L3169 | `() => boolean` | rating>0 && keyword 7~10자 && content>0 |
| `isFormDirty()` | L3153 | `() => boolean` | snapshot 대비 변경 여부 |

## reputation-view-modal
| 핸들러 | 위치 | 시그니처 | 설명 |
|---|---|---|---|
| `handleReputationEditClick()` | L3078 | `() => void` | view → form 편집 진입 (canEditReputation 체크, selectedReputationCard → reputationEditData 복원) |
| `handleReputationDeleteClick()` | L3112 | `async () => void` | 삭제 (승인 체크 → window.confirm → DB delete → 로컬 제거) |
| `formatReputationTime(timestamp)` | L762~777 | `(string \| null) => string` | `"YY. MM. DD(요일)  HH:MM"` 포맷, null → placeholder `"00. 00. 00(0)  00:00"` |

⚠️ TSX에서 `<button.modal-edit-btn onClick={handleReputationEditClick}>` / `<button.modal-delete-btn onClick={handleReputationDeleteClick}>`는 제거됨(L6814~6878 SCSS는 잔존). 재연결 필요 시 L7086 헤더에 button 추가.

---

# 6. 재사용 팁

## 다른 모달 통일 시
1. **크기 + 중앙 배치 템플릿** — 모든 세로형/가로형 모달에 동일 패턴 적용:
   ```scss
   &.my-modal {
     width: ???px !important;
     height: ???px !important;
     display: flex;
     flex-direction: column;
     position: absolute !important;
     left: 50% !important;
     top: 50% !important;
     transform: translate(-50%, -50%) !important;
     margin: 0 !important;
   }
   ```

2. **헤더 구조 재사용** — reputation-view-modal 헤더가 가장 범용:
   - `.section-modal-header` (padding 8px 24px 16px, position: relative)
   - `.modal-header-top { display: flex; gap: 8px; img 72×72 + h3 20px/700/#faab07 }`
   - `.modal-subtitle { margin-left: 80px; padding-left: 0; max-width: calc(100% - 147px); }`
   - `.modal-close-btn { position: absolute; top: 16px; right: 16px; }`

3. **검증 실패 + 깜빡임 패턴** (reputation-form) — 여타 폼 모달에 이식 가능:
   - `.field-error { border-color: #e74c3c; box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.2); }`
   - `.field-error.flash { animation: field-error-flash 0.3s ease-in-out 2; }`
   - `@keyframes field-error-flash` (red → light-red + shadow expand)

4. **인적사항 카드 (workinfo-personal-card)** — reputation-view-modal / colleague-view-modal / 4개 work-view-modal에서 공용:
   - 3행 grid (photo | info 2열, row-1에 tags inline)
   - 공유 override는 `.cluster4-card-content .section-modal.<modal>` 스코프에 별도 선언 (L11107, L11861, L11891, L11945 참고)

5. **Type B 푸터 (행1+행2)** — reputation-form 고유:
   - 행1: modal-help-icon(🔎) 좌 + modal-footer-right(버튼 그룹) 우
   - 행2: modal-footer-bottom(안내문, `visibility` 토글로 공간 유지)
   - 버튼 4종 (edit/cancel/reset/save) 색상·형태는 `.section-modal-footer .modal-*-btn` 참조

## 중앙 배치 이유
Zone A (<1920) 환경에서 `.section-modal-overlay { display: block }` override가 발생하면 flex 중앙 정렬이 무효화됨. 따라서 모달 element 자체를 `absolute + transform translate` 방식으로 배치. Zone B/C에서도 동일 효과.

---

# 7. 복제·이식 시 체크리스트

- [ ] SCSS 블록이 `.cluster4-card-content .section-modal` 외부 스코프에 위치하는지 확인
- [ ] `&.modal-name {}` 형식으로 모달 이름 스코프 지정
- [ ] 중앙 배치 5줄 (position/left/top/transform/margin) 포함
- [ ] `display: flex; flex-direction: column;` 포함 (body flex: 1 영향)
- [ ] TSX에 `<div className="section-modal-overlay"><div className="section-modal my-modal">` 래퍼
- [ ] 헤더·바디·푸터 각 영역의 `flex-shrink: 0` / `flex: 1 auto` 확인
- [ ] 전역 `::before ✦` (`_cluster4-season.scss` L5371) 차단이 필요하면 `.section-modal-header h3::before { content: none !important; display: none !important; }` 추가
- [ ] 편집 가능한 필드가 없으면 `.personal-name`의 `border: 1px solid rgba(255, 165, 0, 0.3)` 같은 "편집 UI처럼 보이는 스타일" 제거

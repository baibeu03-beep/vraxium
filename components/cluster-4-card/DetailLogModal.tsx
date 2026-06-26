"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { getThemeClass } from "@/lib/cluster-route";

/** 성장 결과 1줄(체크박스) — 충족/미충족 */
export interface DetailLogCondition {
  checked: boolean;
  text: string;
}

/** 포인트 카드 1개 (조직별 명칭 — 별/단감/투구 …, 미상 시 Po.A/B/C) */
export interface DetailLogPoint {
  label: string;
  icon: string;
  value: number;
}

/**
 * Detail Log 모달이 표시할 데이터 묶음.
 * 모든 값은 호출부(Cluster4CardContent)에서 단일 출처로 계산해 주입한다.
 * (본 컴포넌트는 순수 표시 — 데이터 fetch/가공을 하지 않는다.)
 */
export interface DetailLogData {
  /** "2026년, 여름 시즌, 1주차" */
  seasonWeekTitle: string;
  /** "2026.06.29(월) ~ 2026.07.05(일)" */
  periodText: string;
  crew: {
    name: string;
    team: string;
    part: string;
    level: string;
  };
  /** 성장 결과 텍스트 ("성장 성공" 등) */
  statusText: string;
  /** status-badge 톤 클래스 (success/fail/rest-personal/…) — 기존 토큰 재사용 */
  statusClass: string;
  /** 누적 성공 주차 수 */
  cumulativeWeeks: number;
  /** 결과 메시지(Alert 본문) */
  resultMessage: string;
  /** 포인트 카드 3개 */
  points: DetailLogPoint[];
  /** 성장 성공 조건 체크 */
  conditions: DetailLogCondition[];
  /** 이번 주 도움말 */
  weeklyHelp: string;
}

interface DetailLogModalProps {
  show: boolean;
  onHide: () => void;
  data: DetailLogData | null;
  /**
   * Phase A — portal root 에 직접 부착될 theme scope class.
   * 미지정 시 usePathname() 으로 자동 추론.
   * createPortal 이 document.body 직속이라 descendant theme selector 가
   * 닿지 않으므로 overlay 에 직접 부착해 SCSS(var(--org-accent))가 매칭되게 한다.
   */
  themeClassName?: string;
}

/** status-badge 톤 → Alert 톤 (positive/warn/neutral) */
const alertToneFromStatus = (statusClass: string): "positive" | "warn" | "neutral" => {
  if (statusClass.includes("success")) return "positive";
  if (statusClass.includes("fail")) return "warn";
  return "neutral";
};

/** +53개 / -3개 / 0개 — '개' 단위 포함 */
const formatPointValue = (v: number): string => (v > 0 ? `+${v}개` : `${v}개`);

const DetailLogModal: React.FC<DetailLogModalProps> = ({
  show,
  onHide,
  data,
  themeClassName,
}) => {
  const pathname = usePathname();
  const resolvedThemeClass = themeClassName ?? getThemeClass(pathname);
  // 헤더 도움말 버튼 → 2차 도움말 모달(기존 도움말 규격). 본문은 비워둔다.
  const [showHelp, setShowHelp] = useState(false);

  // 모달이 닫히면 2차 도움말 상태도 초기화.
  useEffect(() => {
    if (!show) setShowHelp(false);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 2차 도움말이 열려 있으면 그것부터 닫는다.
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      onHide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onHide, showHelp]);

  if (!show || typeof document === "undefined") return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onHide();
  };

  const overlayClass = `section-modal-overlay detail-log-modal-overlay${
    resolvedThemeClass ? ` ${resolvedThemeClass}` : ""
  }`;

  const crewSegments = data
    ? [data.crew.name, data.crew.team, data.crew.part, data.crew.level].filter(
        (s) => s && s.trim() && s.trim() !== "-",
      )
    : [];

  return createPortal(
    <div className={overlayClass} onClick={handleOverlayClick}>
      <div
        className="section-modal section-modal-detail-log"
        role="dialog"
        aria-modal="true"
        aria-label="Weekly League Detail Log"
      >
        {/* ── Header (제목 좌측 · 시즌/주차/기간 우측, 동일 행) ── */}
        <div className="dl-modal-header">
          <span className="dl-header-icon" aria-hidden="true">
            <i className="ti ti-list-details" />
          </span>
          <h3 className="dl-modal-title">Weekly League Detail Log</h3>
          {data && (
            <p className="dl-modal-meta">
              <span className="dl-meta-strong">{data.seasonWeekTitle}</span>
              <span className="dl-meta-dot">·</span>
              <span className="dl-meta-period">{data.periodText}</span>
            </p>
          )}
          <div className="dl-header-actions">
            <button type="button" className="dl-help-btn" onClick={() => setShowHelp(true)} aria-label="도움말">
              <i className="ti ti-help-circle" />
              <span>도움말</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onHide} aria-label="닫기">
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="detail-log-modal-body dl-modal-body">
          {!data ? (
            <div className="dl-empty">데이터를 불러오는 중입니다…</div>
          ) : (
            <>
              {/* 크루 프로필 (Badge) */}
              <div className="dl-crew-badge">
                {crewSegments.map((seg, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="dl-crew-sep">|</span>}
                    <span className={i === 0 ? "dl-crew-name" : "dl-crew-seg"}>{seg}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* 요약: 좌측 포인트 카드 / 우측(상단 성장 결과 · 하단 결과 메시지) */}
              <div className="dl-summary-layout">
                <div className="dl-summary-left">
                  <div className="dl-point-cards">
                    {data.points.map((p, i) => (
                      <div className="dl-point-card" key={i}>
                        <span className="dl-point-icon">
                          {p.icon ? <img src={p.icon} alt={p.label} /> : null}
                        </span>
                        <span className="dl-point-text">
                          <span className="dl-point-label">{p.label}</span>
                          <span className="dl-point-value">{formatPointValue(p.value)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dl-summary-right">
                  {/* 성장 결과 + 누적 성공 주차 */}
                  <div className="dl-result-row">
                    <div className="dl-result-left">
                      <span className="dl-section-label">성장 결과</span>
                      <span className={`status-badge dl-status-badge ${data.statusClass}`}>
                        <span>{data.statusText || "-"}</span>
                      </span>
                    </div>
                    <div className="dl-result-right">
                      <span className="dl-cumulative-num">{data.cumulativeWeeks}</span>
                      <span className="dl-cumulative-label">
                        누적 성공
                        <br />
                        주차
                      </span>
                    </div>
                  </div>

                  {/* 결과 메시지 (Alert) */}
                  <div className={`dl-alert dl-alert--${alertToneFromStatus(data.statusClass)}`}>
                    <i className="ti ti-message-2 dl-alert-icon" aria-hidden="true" />
                    <p className="dl-alert-text">{data.resultMessage}</p>
                  </div>
                </div>
              </div>

              {/* 하단 2단 — 조건 체크 + 이번 주 도움말 */}
              <div className="dl-bottom-grid">
                <section className="dl-card dl-card--check">
                  <header className="dl-card-head">
                    <i className="ti ti-checklist" aria-hidden="true" />
                    <h4>성장 성공 조건 체크</h4>
                  </header>
                  <ul className="dl-check-list">
                    {data.conditions.map((c, i) => (
                      <li key={i} className={c.checked ? "is-checked" : "is-unchecked"}>
                        <span className="dl-checkbox" aria-hidden="true">
                          <i className={c.checked ? "ti ti-check" : "ti ti-x"} />
                        </span>
                        <span className="dl-check-text">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="dl-card dl-card--help">
                  <header className="dl-card-head">
                    <i className="ti ti-bulb" aria-hidden="true" />
                    <h4>이번 주 도움말</h4>
                  </header>
                  <p className="dl-help-text">{data.weeklyHelp}</p>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 2차 도움말 모달 (기존 도움말 규격 — Detail Log 위에 표시, 본문 비움) ── */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="modal-header-top">
                <span style={{ fontSize: "20px" }}>🔎</span>
                <h3>도움말</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowHelp(false)}
                  aria-label="닫기"
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>
            </div>
            <div className="help-modal-body" />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default DetailLogModal;

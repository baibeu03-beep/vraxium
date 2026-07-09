"use client";
import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { usePopup } from "@/components/ui/popup";
import { useDemoUserMode } from "@/hooks/useDemoUserMode";
import {
  addDaysIso,
  normalizeVacationSeason,
  MAX_VACATION_WEEKS,
  NON_CONSECUTIVE_POPUP_MESSAGE,
  VACATION_REASON_MAX,
} from "@/lib/vacationWeeks";

const KNOWN_ORGS = ["phalanx", "encre", "oranke"] as const;
type OrgSlug = (typeof KNOWN_ORGS)[number];
const isOrgSlug = (v: unknown): v is OrgSlug =>
  typeof v === "string" && (KNOWN_ORGS as readonly string[]).includes(v);

const ORG_LABEL: Record<OrgSlug, string> = {
  phalanx: "팔랑크스",
  encre: "엥크레",
  oranke: "오랑캐",
};
// 페이지 루트에 붙일 org 테마 클래스(대표색 CSS 변수 스코프).
const ORG_THEME_CLASS: Record<OrgSlug, string> = {
  phalanx: "vacation-phalanx",
  encre: "vacation-encre",
  oranke: "vacation-oranke",
};

interface EligibleWeek {
  weekId: string;
  weekNumber: number;
  seasonKey: string;
  seasonType: string | null;
  startDate: string;
  endDate: string;
}

interface MyRequest {
  id: string;
  org: string;
  seasonKey: string;
  weekId: string;
  weekStartDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const STATUS_LABEL: Record<MyRequest["status"], string> = {
  pending: "승인 대기",
  approved: "승인",
  rejected: "반려",
};

// 선택된(정렬된) 주차 시작일들에서 index 0 부터 연속된 구간만 남긴다.
// (중간 주차 제거로 끊긴 경우 앞쪽 연속 블록만 유지 → 항상 연속 보장)
function contiguousPrefix(sortedStarts: string[]): string[] {
  if (sortedStarts.length === 0) return [];
  const out = [sortedStarts[0]];
  for (let i = 1; i < sortedStarts.length; i++) {
    if (sortedStarts[i] === addDaysIso(out[out.length - 1], 7)) {
      out.push(sortedStarts[i]);
    } else {
      break;
    }
  }
  return out;
}

// ── 표시용 포맷 (와이어프레임 규격: "26년, 여름, 4주차" / "26. 07. 20(월)") ──
const SEASON_KO: Record<string, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function weekLabel(w: EligibleWeek): string {
  const yy = w.startDate.slice(2, 4);
  const st = normalizeVacationSeason(w.seasonType);
  return `${yy}년, ${st ? SEASON_KO[st] : ""}, ${w.weekNumber}주차`;
}
function dotDate(iso: string): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return `${iso.slice(2, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}(${WEEKDAY_KO[d.getUTCDay()]})`;
}
function dotWeekRange(start: string): string {
  return `${dotDate(start)} ~ ${dotDate(addDaysIso(start, 6))}`;
}
function dotSelectedRange(starts: string[]): string {
  if (starts.length === 0) return "";
  const s = [...starts].sort();
  return `${dotDate(s[0])} ~ ${dotDate(addDaysIso(s[s.length - 1], 6))}`;
}

function VacationContent() {
  const searchParams = useSearchParams();
  const orgParam = searchParams?.get("org") ?? null;
  const org: OrgSlug | null = isOrgSlug(orgParam) ? orgParam : null;
  const { confirm, alert } = usePopup();
  const demo = useDemoUserMode();

  const [loading, setLoading] = useState(true);
  const [eligibleWeeks, setEligibleWeeks] = useState<EligibleWeek[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [dropdownStart, setDropdownStart] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 데이터 로드 — 일반/테스트 유저 모두 동일 API(demoUserId suffix 만 조건부 부착).
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(demo.appendDemoUserParams("/api/vacation"), { cache: "no-store" });
      if (!res.ok) {
        setEligibleWeeks([]);
        setMyRequests([]);
        return;
      }
      const json = await res.json();
      setEligibleWeeks((json.eligibleWeeks as EligibleWeek[]) ?? []);
      setMyRequests((json.myRequests as MyRequest[]) ?? []);
    } catch {
      setEligibleWeeks([]);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // 드롭다운에서 아직 선택 안 된 주차만 노출.
  const dropdownOptions = useMemo(
    () => eligibleWeeks.filter((w) => !selected.includes(w.startDate)),
    [eligibleWeeks, selected],
  );

  // 선택 목록이 바뀌면 드롭다운 기본값을 유효한 첫 옵션으로 맞춘다.
  useEffect(() => {
    if (dropdownOptions.length === 0) {
      setDropdownStart("");
    } else if (!dropdownOptions.some((w) => w.startDate === dropdownStart)) {
      setDropdownStart(dropdownOptions[0].startDate);
    }
  }, [dropdownOptions, dropdownStart]);

  const dropdownWeek = useMemo(
    () => eligibleWeeks.find((w) => w.startDate === dropdownStart) ?? null,
    [eligibleWeeks, dropdownStart],
  );

  const handleAdd = useCallback(async () => {
    if (!dropdownStart) return;
    if (selected.includes(dropdownStart)) return;

    // 최대 개수 또는 비연속 → 안내 팝업(추가하지 않음).
    if (selected.length >= MAX_VACATION_WEEKS) {
      await alert(NON_CONSECUTIVE_POPUP_MESSAGE, { variant: "B" });
      return;
    }
    if (selected.length > 0) {
      const sorted = [...selected].sort();
      const expectedNext = addDaysIso(sorted[sorted.length - 1], 7);
      if (dropdownStart !== expectedNext) {
        await alert(NON_CONSECUTIVE_POPUP_MESSAGE, { variant: "B" });
        return;
      }
    }
    setSelected((prev) => [...prev, dropdownStart].sort());
  }, [dropdownStart, selected, alert]);

  const handleRemove = useCallback((start: string) => {
    setSelected((prev) => contiguousPrefix(prev.filter((s) => s !== start).sort()));
  }, []);

  const handleReasonChange = useCallback((v: string) => {
    setReason(v.slice(0, VACATION_REASON_MAX));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selected.length === 0 || submitting) return;
    const ok = await confirm("휴식을 신청하시겠습니까?", { variant: "A" });
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(demo.appendDemoUserParams("/api/vacation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, weekStartDates: selected, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alert(json?.error ?? "휴식 신청에 실패했습니다.", { variant: "B" });
        return;
      }
      setSelected([]);
      setReason("");
      await loadData();
      await alert("휴식 신청이 완료되었습니다.", { variant: "B" });
    } catch {
      await alert("휴식 신청 중 오류가 발생했습니다.", { variant: "B" });
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, confirm, alert, demo, org, reason, loadData]);

  const themeClass = org ? ORG_THEME_CLASS[org] : "";

  // org 미지정 — 사이드바에서 조직 선택 유도(크루 페이지와 동일 정책).
  if (!org) {
    return (
      <main className="nftg-content nftg-content-home vacation-page">
        <Animations />
        <Breadcrumb title="클럽 주차 휴식 신청" />
        <section className="pb-120" style={{ paddingTop: 60 }}>
          <div className="container">
            <div className="vacation-empty-org">
              <h1 className="vacation-title">클럽 주차 휴식 신청</h1>
              <p>사이드바에서 조직(팔랑크스 · 엥크레 · 오랑캐)을 선택하면<br />휴식 신청 화면이 표시됩니다.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`nftg-content nftg-content-home vacation-page ${themeClass}`}>
      <Animations />
      <Breadcrumb title={`클럽 주차 휴식 신청 · ${ORG_LABEL[org]}`} />
      <section className="pb-120" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="vacation-layout">
            {/* [1] 상단 배너 제목 */}
            <header className="vacation-banner">
              <span className="vacation-banner__badge">
                <i className="ti ti-calendar-pause" aria-hidden="true"></i>CLUB REST
              </span>
              <h1 className="vacation-banner__title">클럽 주차 휴식 신청</h1>
              <span className="vacation-banner__bar" aria-hidden="true"></span>
              <p className="vacation-banner__subtitle">
                쉬어갈 주차를 선택해 신청하세요 · 연속된 주차만 최대 {MAX_VACATION_WEEKS}주까지
              </p>
            </header>

            {/* [2] 좌측 이미지 */}
            <figure className="vacation-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/0/vacation.png" alt="클럽 주차 휴식 신청" className="vacation-figure__img" />
            </figure>

            {/* [3]~[7] 우측 폼 */}
            <div className="vacation-form">
              {/* [3] 휴식 희망 기간 + [4] 선택 */}
              <div className="vacation-field">
                <div className="vacation-field__label">
                  <i className="ti ti-chevron-right" aria-hidden="true"></i>휴식 희망 기간
                </div>
                <div className="vacation-select-row">
                  <div className="vacation-select-wrap">
                    <select
                      className="vacation-select"
                      value={dropdownStart}
                      onChange={(e) => setDropdownStart(e.target.value)}
                      disabled={loading || dropdownOptions.length === 0}
                    >
                      {dropdownOptions.length === 0 ? (
                        <option value="">신청 가능한 주차가 없습니다</option>
                      ) : (
                        dropdownOptions.map((w) => (
                          <option key={w.startDate} value={w.startDate}>
                            {weekLabel(w)}
                          </option>
                        ))
                      )}
                    </select>
                    <i className="ti ti-chevron-down vacation-select__chevron" aria-hidden="true"></i>
                  </div>
                  <button
                    type="button"
                    className="vacation-btn vacation-btn--select"
                    onClick={handleAdd}
                    disabled={loading || !dropdownStart}
                  >
                    선택
                  </button>
                </div>
                {dropdownWeek && (
                  <div className="vacation-daterange">{dotWeekRange(dropdownWeek.startDate)}</div>
                )}
              </div>

              {/* [5] 선택한 주차 트레이 */}
              <div className="vacation-field">
                <div className="vacation-field__label vacation-field__label--sub">
                  선택한 주차
                  <span className="vacation-count">{selected.length}/{MAX_VACATION_WEEKS}</span>
                </div>
                <div className="vacation-tray">
                  {selected.length === 0 ? (
                    <p className="vacation-tray__empty">신청할 주차를 선택하면 여기에 표시됩니다.</p>
                  ) : (
                    <ul className="vacation-chips">
                      {selected.map((start) => {
                        const w = eligibleWeeks.find((e) => e.startDate === start);
                        return (
                          <li key={start} className="vacation-chip">
                            <span className="vacation-chip__label">{w ? weekLabel(w) : dotWeekRange(start)}</span>
                            <button
                              type="button"
                              className="vacation-chip__remove"
                              aria-label="주차 제거"
                              onClick={() => handleRemove(start)}
                            >
                              <i className="ti ti-x" aria-hidden="true"></i>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {selected.length > 0 && (
                  <div className="vacation-daterange vacation-daterange--total">{dotSelectedRange(selected)}</div>
                )}
              </div>

              {/* [6] 휴식 신청 사유 */}
              <div className="vacation-field">
                <div className="vacation-field__label">
                  <i className="ti ti-chevron-right" aria-hidden="true"></i>휴식 신청 사유
                </div>
                <textarea
                  className="vacation-reason"
                  value={reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  maxLength={VACATION_REASON_MAX}
                  rows={4}
                  placeholder="휴식 신청 사유를 입력해주세요. (선택)"
                />
                <div className="vacation-reason__count">
                  {reason.length}/{VACATION_REASON_MAX}
                </div>
              </div>

              {/* [7] 휴식 신청 버튼 */}
              <button
                type="button"
                className="vacation-btn vacation-btn--submit"
                onClick={handleSubmit}
                disabled={selected.length === 0 || submitting}
              >
                {submitting ? "신청 중…" : "휴식 신청"}
              </button>
            </div>

            {/* MY 휴식 주차 (하단 전체 폭 — 영역 준비, 상세 미구현) */}
            <div className="vacation-my">
              <div className="vacation-field__label">
                <i className="ti ti-calendar-check" aria-hidden="true"></i>MY 휴식 주차
              </div>
              <div className="vacation-my__area">
                {myRequests.length === 0 ? (
                  <p className="vacation-empty-text">아직 신청한 휴식이 없습니다.</p>
                ) : (
                  <ul className="vacation-my__list">
                    {myRequests.map((r) => (
                      <li key={r.id} className="vacation-my__item">
                        <span className="vacation-my__range">{dotWeekRange(r.weekStartDate)}</span>
                        <span className={`vacation-my__status is-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function VacationPage() {
  return (
    <Suspense fallback={null}>
      <VacationContent />
    </Suspense>
  );
}

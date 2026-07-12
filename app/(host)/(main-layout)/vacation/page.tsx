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
  CANCEL_BLOCK_PRESTART_MESSAGE,
  CANCEL_BLOCK_FULFILLED_MESSAGE,
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

type DisplayStatus = "휴식 신청" | "휴식 승인" | "휴식 이행";
type CancelState = "cancelable" | "prestart" | "fulfilled";

interface MyApplication {
  groupId: string;
  displayStatus: DisplayStatus;
  category: "정상";
  weeks: { weekStartDate: string; label: string }[];
  spanStart: string;
  spanEnd: string;
  reason: string | null;
  createdAt: string;
  cancelState: CancelState;
}

interface VacationSummary {
  fulfilledWeeks: number;
  upcomingWeeks: number;
}

// 진행 상태 badge 클래스 키.
const STATUS_KEY: Record<DisplayStatus, string> = {
  "휴식 신청": "applied",
  "휴식 승인": "approved",
  "휴식 이행": "fulfilled",
};

const PAGE_SIZE = 15;

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

// "2026년 8월 17일" (신청 기간용, YYYY-MM-DD 입력).
function longDate(iso: string): string {
  return `${+iso.slice(0, 4)}년 ${+iso.slice(5, 7)}월 ${+iso.slice(8, 10)}일`;
}
// "2026년 7월 9일 오후 2:00" (신청 시점용, created_at 타임스탬프를 KST 로 변환).
function longDateTime(ts: string): string {
  const kst = new Date(new Date(ts).getTime() + 9 * 3_600_000);
  const h = kst.getUTCHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 || 12;
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${ampm} ${h12}:${mm}`;
}

function VacationContent() {
  const searchParams = useSearchParams();
  const orgParam = searchParams?.get("org") ?? null;
  const org: OrgSlug | null = isOrgSlug(orgParam) ? orgParam : null;
  const { confirm, alert } = usePopup();
  const demo = useDemoUserMode();

  const [loading, setLoading] = useState(true);
  const [eligibleWeeks, setEligibleWeeks] = useState<EligibleWeek[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [summary, setSummary] = useState<VacationSummary>({ fulfilledWeeks: 0, upcomingWeeks: 0 });
  // 서버가 판정한 viewer 실제 소속 조직(조직 스코프 게이트). URL org 와 다르면
  // 개인 데이터가 비어 내려오고, 아래에서 교정 안내를 노출한다.
  const [viewerOrg, setViewerOrg] = useState<OrgSlug | null>(null);
  const [dropdownStart, setDropdownStart] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myPage, setMyPage] = useState(1);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // 데이터 로드 — 일반/테스트 유저 모두 동일 API(demoUserId suffix 만 조건부 부착).
  //   org 를 권위 필터로 함께 전송한다(서버가 viewer 소속과 대조해 스코프).
  const loadData = useCallback(async () => {
    const clearPersonal = () => {
      setEligibleWeeks([]);
      setMyApplications([]);
      setSummary({ fulfilledWeeks: 0, upcomingWeeks: 0 });
    };
    if (!org) {
      clearPersonal();
      setViewerOrg(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        demo.appendDemoUserParams(`/api/vacation?org=${encodeURIComponent(org)}`),
        { cache: "no-store" },
      );
      if (!res.ok) {
        clearPersonal();
        setViewerOrg(null);
        return;
      }
      const json = await res.json();
      setViewerOrg(isOrgSlug(json.viewerOrg) ? json.viewerOrg : null);
      setEligibleWeeks((json.eligibleWeeks as EligibleWeek[]) ?? []);
      setMyApplications((json.myApplications as MyApplication[]) ?? []);
      setSummary((json.summary as VacationSummary) ?? { fulfilledWeeks: 0, upcomingWeeks: 0 });
    } catch {
      clearPersonal();
      setViewerOrg(null);
    } finally {
      setLoading(false);
    }
  }, [demo, org]);

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

  // 휴식 취소 — 취소 불가 상태면 서버 호출 없이 즉시 안내 팝업, 가능하면 확인 후 PATCH.
  //   서버가 시점을 재검증하므로(레이스) 200 이 아니면 서버 메시지를 그대로 노출한다.
  const handleCancel = useCallback(
    async (app: MyApplication) => {
      if (cancelingId) return;
      if (app.cancelState === "prestart") {
        await alert(CANCEL_BLOCK_PRESTART_MESSAGE, { variant: "B" });
        return;
      }
      if (app.cancelState === "fulfilled") {
        await alert(CANCEL_BLOCK_FULFILLED_MESSAGE, { variant: "B" });
        return;
      }
      const ok = await confirm("휴식 신청을 취소하시겠습니까?", { variant: "A" });
      if (!ok) return;
      setCancelingId(app.groupId);
      try {
        const res = await fetch(demo.appendDemoUserParams("/api/vacation"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", requestId: app.groupId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          await alert(json?.error ?? "휴식 취소에 실패했습니다.", { variant: "B" });
          return;
        }
        await loadData();
        await alert("휴식 신청이 취소되었습니다.", { variant: "B" });
      } catch {
        await alert("휴식 취소 중 오류가 발생했습니다.", { variant: "B" });
      } finally {
        setCancelingId(null);
      }
    },
    [cancelingId, confirm, alert, demo, loadData],
  );

  // 페이지네이션(15개/페이지). 목록이 줄어들면 현재 페이지를 보정.
  const totalMyPages = Math.max(1, Math.ceil(myApplications.length / PAGE_SIZE));
  useEffect(() => {
    if (myPage > totalMyPages) setMyPage(totalMyPages);
  }, [myPage, totalMyPages]);
  const pagedApplications = myApplications.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);

  const themeClass = org ? ORG_THEME_CLASS[org] : "";

  // 조직 스코프 불일치 — viewer 실제 소속(viewerOrg)과 URL org 가 다르면
  // 개인 데이터를 렌더하지 않고 본인 조직 페이지로 교정 안내한다.
  const orgMismatch = !!org && !!viewerOrg && viewerOrg !== org;

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

  // 타 조직 페이지 접근 — 개인 데이터 없이 본인 조직으로 이동 안내.
  if (orgMismatch && viewerOrg) {
    const ownOrgHref = demo.appendDemoUserParams(`/vacation?org=${encodeURIComponent(viewerOrg)}`);
    return (
      <main className={`nftg-content nftg-content-home vacation-page ${themeClass}`}>
        <Animations />
        <Breadcrumb title="클럽 주차 휴식 신청" />
        <section className="pb-120" style={{ paddingTop: 60 }}>
          <div className="container">
            <div className="vacation-empty-org">
              <h1 className="vacation-title">클럽 주차 휴식 신청</h1>
              <p>
                회원님은 <b>{ORG_LABEL[viewerOrg]}</b> 소속입니다.<br />
                본인 조직의 휴식 신청 페이지에서 신청·조회하실 수 있습니다.
              </p>
              <p style={{ marginTop: 16 }}>
                <a className="vacation-btn vacation-btn--select" href={ownOrgHref}>
                  {ORG_LABEL[viewerOrg]} 휴식 신청으로 이동
                </a>
              </p>
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

            {/* MY 휴식 주차 (하단 전체 폭) */}
            <div className="vacation-my">
              <div className="vacation-my__head">
                <div className="vacation-field__label vacation-my__title">
                  <i className="ti ti-calendar-check" aria-hidden="true"></i>MY 휴식 주차
                </div>
                <div className="vacation-my__stats">
                  <span className="vacation-my__stat">
                    누적 휴식 주차 <b>{summary.fulfilledWeeks}</b> 주
                  </span>
                  <span className="vacation-my__stat">
                    예정 휴식 신청 <b>{summary.upcomingWeeks}</b> 주
                  </span>
                </div>
              </div>

              {/* 데이터 0건·API 에러·마이그레이션 전이어도 테이블 골격(헤더)은 항상 렌더 */}
              <div className="vacation-my__area">
                  {/* 데스크톱 테이블 */}
                  <div className="vacation-table-wrap">
                    <table className="vacation-table">
                      <thead>
                        <tr>
                          <th>진행 상태</th>
                          <th>분류</th>
                          <th>신청 주차명</th>
                          <th>신청 기간</th>
                          <th>신청 시점</th>
                          <th className="vacation-table__reason-col">휴식 사유</th>
                          <th>휴식 취소</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedApplications.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="vacation-table__empty">
                              아직 신청한 휴식 주차가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          pagedApplications.map((app) => (
                          <tr key={app.groupId}>
                            <td>
                              <span className={`vacation-badge is-status-${STATUS_KEY[app.displayStatus]}`}>
                                {app.displayStatus}
                              </span>
                            </td>
                            <td>
                              <span className="vacation-badge is-cat-normal">{app.category}</span>
                            </td>
                            <td>
                              <div className="vacation-weeknames">
                                {app.weeks.map((w) => (
                                  <span key={w.weekStartDate} className="vacation-weekname">{w.label}</span>
                                ))}
                              </div>
                            </td>
                            <td className="vacation-table__nowrap">
                              {longDate(app.spanStart)} → {longDate(app.spanEnd)}
                            </td>
                            <td className="vacation-table__nowrap">{longDateTime(app.createdAt)}</td>
                            <td>
                              <span className="vacation-reason-cell" title={app.reason ?? ""}>
                                {app.reason || "-"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="vacation-btn vacation-btn--cancel"
                                onClick={() => handleCancel(app)}
                                disabled={cancelingId === app.groupId}
                              >
                                {cancelingId === app.groupId ? "취소 중…" : "휴식 취소"}
                              </button>
                            </td>
                          </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 모바일 카드 */}
                  <ul className="vacation-cards">
                    {pagedApplications.length === 0 ? (
                      <li className="vacation-card-empty">아직 신청한 휴식 주차가 없습니다.</li>
                    ) : (
                      pagedApplications.map((app) => (
                      <li key={app.groupId} className="vacation-card-item">
                        <div className="vacation-card-item__top">
                          <span className={`vacation-badge is-status-${STATUS_KEY[app.displayStatus]}`}>
                            {app.displayStatus}
                          </span>
                          <span className="vacation-badge is-cat-normal">{app.category}</span>
                        </div>
                        <div className="vacation-weeknames">
                          {app.weeks.map((w) => (
                            <span key={w.weekStartDate} className="vacation-weekname">{w.label}</span>
                          ))}
                        </div>
                        <dl className="vacation-card-item__meta">
                          <div><dt>신청 기간</dt><dd>{longDate(app.spanStart)} → {longDate(app.spanEnd)}</dd></div>
                          <div><dt>신청 시점</dt><dd>{longDateTime(app.createdAt)}</dd></div>
                          <div><dt>휴식 사유</dt><dd>{app.reason || "-"}</dd></div>
                        </dl>
                        <button
                          type="button"
                          className="vacation-btn vacation-btn--cancel vacation-card-item__cancel"
                          onClick={() => handleCancel(app)}
                          disabled={cancelingId === app.groupId}
                        >
                          {cancelingId === app.groupId ? "취소 중…" : "휴식 취소"}
                        </button>
                      </li>
                      ))
                    )}
                  </ul>

                  {totalMyPages > 1 && (
                    <div className="vacation-pagination">
                      <button
                        type="button"
                        className="vacation-page-btn"
                        onClick={() => setMyPage((p) => Math.max(1, p - 1))}
                        disabled={myPage <= 1}
                        aria-label="이전 페이지"
                      >
                        <i className="ti ti-chevron-left" aria-hidden="true"></i>
                      </button>
                      {Array.from({ length: totalMyPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`vacation-page-btn${n === myPage ? " is-active" : ""}`}
                          onClick={() => setMyPage(n)}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="vacation-page-btn"
                        onClick={() => setMyPage((p) => Math.min(totalMyPages, p + 1))}
                        disabled={myPage >= totalMyPages}
                        aria-label="다음 페이지"
                      >
                        <i className="ti ti-chevron-right" aria-hidden="true"></i>
                      </button>
                    </div>
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

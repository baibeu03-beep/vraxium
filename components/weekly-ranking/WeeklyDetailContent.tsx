"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WEEKLY_CARD_DUMMY, type WeeklyCardData, type ChampionCrew } from "@/constants/dummyData/weekly-card-dummy";
import { isDemoMode } from "@/utils/isDemoMode";
import { getRankingThemeForSeason, getRankingThemeVars } from "@/lib/rankingTheme";

// ── 기본 이미지(요구사항 SoT) ── DTO 이미지 필드 미설정 시 폴백.
const DEFAULT_HERO_IMAGE = "/images/0/weekly-b.png";
const DEFAULT_REPRESENTATIVE_IMAGE = "/images/0/weekly-b-2.png";

// ── Champion's Hall ── 포인트 아이콘은 조직(org)별로 매칭한다.
//   포인트 A = 성장 활동량 / 포인트 B = 성장 집중력. 탭 아이콘과 카드 내부 아이콘이 동일 매핑 사용.
const GROWTH_RATE_ICON = "/images/0/cluster4/icon/icon - 시즌 성장률.png"; // 주차 성장률(공통)

// 조직별 포인트 아이콘(웹 경로 = public 기준). 경로 대소문자·공백을 정확히 유지.
const ORG_POINT_ICONS: Record<string, { a: string; b: string }> = {
  encre: { a: "/images/0/Graphic10.png", b: "/images/0/Shield.png" },
  oranke: { a: "/images/0/cluster 1/Ok01.png", b: "/images/0/cluster 1/OK02.png" },
  phalanx: { a: "/images/0/cluster 1/PX01.png", b: "/images/0/cluster 1/pX02.png" },
};
// 기본값(org 미지정/미매칭) — encre 세트로 폴백.
const DEFAULT_POINT_ICONS = ORG_POINT_ICONS.encre;

// org slug(phalanx·encre·oranke) 또는 한글 클럽명을 정규화해 포인트 아이콘 세트를 반환.
function resolvePointIcons(org: string | null): { a: string; b: string } {
  const key = (org ?? "").trim().toLowerCase();
  if (key === "encre" || key === "엥크레") return ORG_POINT_ICONS.encre;
  if (key === "oranke" || key === "오랑캐") return ORG_POINT_ICONS.oranke;
  if (key === "phalanx" || key === "팔랑크스") return ORG_POINT_ICONS.phalanx;
  return DEFAULT_POINT_ICONS;
}

type ChampTabKey = "activity" | "focus" | "growth";

// 순위별 Accent Color(카드 전체가 아닌 강조색만 변경) — 무지개(빨→보) 순서 10단계.
const RANK_ACCENTS = [
  "#FF4B4B", // 1 빨강
  "#FF7A2F", // 2 주황
  "#FFB020", // 3 노랑(앰버)
  "#FFE23D", // 4 노랑
  "#7ED957", // 5 연두
  "#2FD07E", // 6 초록
  "#22C3D6", // 7 청록
  "#3D8BFF", // 8 파랑
  "#6C5CE7", // 9 남색
  "#A55CF0", // 10 보라
];
// 이니셜 폴백 아바타용 — 순위 accent 로 틴트.
const initialOf = (name: string) => (name?.trim()?.[0] ?? "?");

// ── [5] 하단 격언(페이지 디자인 상수 — 주차 데이터 아님) ──
const QUOTE_TEXT =
  "어떤 아름다운 것도 언젠가는 쇠퇴하고, 우연이나 자연의 무상한 이치로 모습이 망가지지만, 그러나 그대의 영원한 여름만은 절대로 시들지 않으리";
const QUOTE_AUTHOR = "William Shakespeare";

// ── [6][7] 본문 폴백(예시) ── DTO 값 부재 시 표시하는 샘플/플레이스홀더 카피.
//   DTO(weeklyComment / cluvActivityFlow)가 실제 값을 내려주면 그 값이 우선한다.
const SAMPLE_WEEKLY_COMMENT =
  "태풍 ‘고래’가 우리나라를 강타한 한 주였습니다. 세상이 떠나갈 듯 내리는 이번 한 주에 우리 크루분들은 또 한 주의 성장을 이루어냈을겁니다.\n선의의 경쟁이 치열했던 위클리 리그를 살펴보고, 나의 한 주를 돌아보자구요! 😊";
const SAMPLE_ACTIVITY_FLOW =
  "이번 주 우리 클럽은, 총 5개 팀, 17개 파트가 성장을 위해 굵은 땀방울을 흘렸습니다.\n총 14개의 라인이 오픈되었고, [확장] 주간 중 첫 번째 주간을 진행했어요.\n\n후회 없는 한 주가 되었길 바래요!";

// [4] 활동 여부 라벨 — 공식 휴식이면 휴식, 그 외(정상/심화 진행)는 공식 활동.
const resolveActivity = (card: WeeklyCardData) => {
  const isRest = card.leagueResultStatus === "공식 휴식";
  return { isRest, label: isRest ? "공식 휴식" : "공식 활동" };
};

interface WeeklyDetailContentProps {
  weekId: string;
  // 조직 slug(phalanx · encre · oranke). 상세 데이터 조회에 필요.
  org: string | null;
}

type LoadState = "loading" | "ready" | "notfound";

export default function WeeklyDetailContent({ weekId, org }: WeeklyDetailContentProps) {
  const [card, setCard] = useState<WeeklyCardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // 대시보드 Progress Bar 진입 애니메이션 트리거(0% → 목표%).
  const [barsIn, setBarsIn] = useState(false);
  // Champion's Hall 활성 탭 — 기본 '성장 활동량 Top 10'.
  const [champTab, setChampTab] = useState<ChampTabKey>("activity");
  const rootRef = useRef<HTMLElement | null>(null);

  // 조직별 포인트 아이콘(포인트 A/B) — 탭·카드가 공유하는 단일 소스.
  const pointIcons = useMemo(() => resolvePointIcons(org), [org]);
  const championTabs = useMemo<
    Array<{ key: ChampTabKey; label: string; icon: string; ready: boolean }>
  >(
    () => [
      { key: "activity", label: "성장 활동량 Top 10", icon: pointIcons.a, ready: true },
      { key: "focus", label: "성장 집중력 Top 10", icon: pointIcons.b, ready: true },
      { key: "growth", label: "주차 성장률 Top 10", icon: GROWTH_RATE_ICON, ready: false },
    ],
    [pointIcons],
  );

  // 데이터 로드 — 데모: 더미에서 id 매칭 / 일반: /api/weekly-league?org= 응답에서 id 매칭.
  //   리스트와 동일 DTO(WeeklyCardData)를 그대로 소비(현재 Week DTO 재사용).
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setCard(null);

    const demo = isDemoMode();
    if (demo) {
      const found = WEEKLY_CARD_DUMMY.find((c) => c.id === weekId) ?? null;
      setCard(found);
      setState(found ? "ready" : "notfound");
      return;
    }

    if (!org) {
      setState("notfound");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/weekly-league?org=${encodeURIComponent(org)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        const cards: WeeklyCardData[] = json?.success && Array.isArray(json.cards) ? json.cards : [];
        const found = cards.find((c) => c.id === weekId) ?? null;
        setCard(found);
        setState(found ? "ready" : "notfound");
      } catch {
        if (!cancelled) setState("notfound");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekId, org]);

  // 스크롤 진입 fade-up — data-fadeup 요소가 뷰포트에 들어오면 is-visible 부여.
  //   콘텐츠가 opacity:0 로 영구 숨는 일이 없도록 3중 안전장치:
  //   (1) 마운트 시 이미 뷰포트에 있는 요소 즉시 노출, (2) 나머지는 IO 로 스크롤 시 노출,
  //   (3) IO 미지원/미발화 대비 900ms 후 남은 전부 강제 노출.
  useEffect(() => {
    if (state !== "ready") return;
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-fadeup]"));
    const reveal = (el: Element) => el.classList.add("is-visible");

    // (1) 즉시 노출 — 마운트 시점 뷰포트 안(약간의 여유 포함)에 걸친 요소.
    const vh = window.innerHeight || 0;
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.98) reveal(el);
    });

    // (2) 나머지 — 스크롤 진입 시 노출.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
      );
      items.forEach((el) => {
        if (!el.classList.contains("is-visible")) io!.observe(el);
      });
    }

    // (3) 안전망 — 900ms 후에도 안 보인 요소는 강제 노출(영구 숨김 방지).
    const safety = window.setTimeout(() => items.forEach(reveal), 900);

    return () => {
      io?.disconnect();
      window.clearTimeout(safety);
    };
  }, [state]);

  // Progress Bar 진입 애니메이션 — 카드 준비 후 0% → 목표% 로 전개.
  useEffect(() => {
    if (state !== "ready") {
      setBarsIn(false);
      return;
    }
    const t = window.setTimeout(() => setBarsIn(true), 260);
    return () => window.clearTimeout(t);
  }, [state]);

  // 조직 + 주차 시즌 → 테마 변수(--wr-*). 카드 부재 시에도 org 브랜드색으로 폴백.
  const themeVars = useMemo(
    () => getRankingThemeVars(getRankingThemeForSeason(org, card?.seasonName)),
    [org, card?.seasonName],
  );

  const backHref = org ? `/weekly-ranking?org=${encodeURIComponent(org)}` : "/weekly-ranking";

  // ── 로딩 / 미발견 상태 ──
  if (state === "loading") {
    return (
      <section className="weekly-detail-page weekly-detail-page--status" style={themeVars}>
        <div className="wd-status" role="status" aria-live="polite">
          <span className="wd-status__spinner" aria-hidden="true" />
          <p>주차 정보를 불러오는 중입니다…</p>
        </div>
      </section>
    );
  }

  if (state === "notfound" || !card) {
    return (
      <section className="weekly-detail-page weekly-detail-page--status" style={themeVars}>
        <div className="wd-status">
          <p className="wd-status__title">해당 주차 정보를 찾을 수 없습니다.</p>
          <Link href={backHref} className="wd-back-btn">
            <i className="ti ti-arrow-left" aria-hidden="true" /> 목록으로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  const heroImage = card.heroImage || DEFAULT_HERO_IMAGE;
  const representativeImage = card.representativeImage || DEFAULT_REPRESENTATIVE_IMAGE;
  const weeklyComment = card.weeklyComment || SAMPLE_WEEKLY_COMMENT;
  const activityFlow = card.cluvActivityFlow || SAMPLE_ACTIVITY_FLOW;
  const { isRest, label: activityLabel } = resolveActivity(card);

  // ── [2] 대시보드 값 ── 원자 DTO 필드에서 파생 계산해 화면 등식을 항상 보장한다:
  //   ① 소속크루 = ② 시즌휴식 + ③ 개인휴식 + ④ 성장도전,  ④ = ⑤ 성장성공 + ⑥ 성장실패
  //   도전율 = ④/①·100,  성공률 = ⑤/④·100. (DTO totalCrews/growthChallenge 대신 재계산 → 불일치 방지)
  const successCount = card.growthSuccess ?? 0;
  const failCount = card.growthFail ?? 0;
  const challengeCount = successCount + failCount;
  const personalRest = card.personalRest ?? 0;
  const seasonRest = card.seasonRest ?? 0;
  const totalCrew = seasonRest + personalRest + challengeCount;
  const challengeRate = totalCrew > 0 ? Math.round((challengeCount / totalCrew) * 100) : 0;
  const successRate = challengeCount > 0 ? Math.round((successCount / challengeCount) * 100) : 0;

  // KPI 카드(라벨/아이콘은 UI 카피, 값은 위 파생값). 3행×2열 배치 순서 = 스펙 ①~⑥.
  //   보조 설명(desc)은 노출하지 않는다 — 아이콘/label/value 핵심 정보만.
  const kpis: Array<{ tone: string; icon: string; label: string; value: number }> = [
    { tone: "accent", icon: "ti ti-users", label: "소속 크루", value: totalCrew },
    { tone: "gray", icon: "ti ti-zzz", label: "시즌 휴식", value: seasonRest },
    { tone: "gray", icon: "ti ti-bed", label: "개인 휴식", value: personalRest },
    { tone: "blue", icon: "ti ti-flame", label: "성장 도전", value: challengeCount },
    { tone: "green", icon: "ti ti-trophy", label: "성장 성공", value: successCount },
    { tone: "red", icon: "ti ti-circle-x", label: "성장 실패", value: failCount },
  ];
  // 공식(formula)은 화면 비노출 — 값은 위에서 계산 완료. 카드에는 제목/퍼센트/바만 표시.
  const progresses: Array<{ tone: string; label: string; value: number }> = [
    { tone: "blue", label: "성장 도전율", value: challengeRate },
    { tone: "green", label: "성장 성공률", value: successRate },
  ];

  // Champion's Hall — DTO(card.top10 / card.top10Focus)에서 수신(하드코딩 없음).
  const activeTab = championTabs.find((t) => t.key === champTab) ?? championTabs[0];
  // 탭별 표시 데이터: 리스트 / 포인트 아이콘 / 포인트 값 getter.
  const champTabData: Record<
    ChampTabKey,
    { list: ChampionCrew[]; pointIcon: string; pointOf: (c: ChampionCrew) => number }
  > = {
    activity: { list: Array.isArray(card.top10) ? card.top10 : [], pointIcon: pointIcons.a, pointOf: (c) => c.pointA },
    focus: { list: Array.isArray(card.top10Focus) ? card.top10Focus : [], pointIcon: pointIcons.b, pointOf: (c) => c.pointB },
    growth: { list: [], pointIcon: GROWTH_RATE_ICON, pointOf: () => 0 },
  };
  const activeChamp = champTabData[champTab];

  return (
    <section className="weekly-detail-page" style={themeVars} ref={rootRef}>
      <Link href={backHref} className="wd-back-link">
        <i className="ti ti-arrow-left" aria-hidden="true" /> Weekly League
      </Link>

      {/* [1] Hero — 헤드 이미지 + 제목 */}
      <header className="wd-hero" data-fadeup>
        <div className="wd-hero__bg" style={{ backgroundImage: `url("${heroImage}")` }} aria-hidden="true" />
        <div className="wd-hero__overlay" aria-hidden="true" />
        <div className="wd-hero__inner">
          <span className="wd-hero__eyebrow">Championship</span>
          <h1 className="wd-hero__title">CREW WEEKLY LEAGUE</h1>
        </div>
      </header>

      <div className="wd-divider" aria-hidden="true" />

      <div className="wd-grid">
        {/* 좌측 — [5] 대표 이미지 카드 + 격언 */}
        <div className="wd-col wd-col--left">
          <figure className="wd-repr" data-fadeup>
            <div className="wd-repr__imgwrap">
              <img className="wd-repr__img" src={representativeImage} alt={`${card.seasonName} 대표 이미지`} />
              <div className="wd-repr__scrim" aria-hidden="true" />
              {/* [2][3][4] 오버레이 — 대표 이미지 위 상단 배치 */}
              <div className="wd-repr__overlays">
                <div className="wd-repr__meta">
                  <h2 className="wd-chip wd-chip--season">{card.seasonName}</h2>
                  <p className="wd-chip wd-chip--date">{card.dateRangeText}</p>
                </div>
                <span className={`wd-activity ${isRest ? "wd-activity--rest" : "wd-activity--active"}`}>
                  <i className={isRest ? "ti ti-bed" : "ti ti-flame"} aria-hidden="true" />
                  {activityLabel}
                </span>
              </div>
            </div>
          </figure>

          {/* [5] 하단 격언 */}
          <blockquote className="wd-quote" data-fadeup>
            <span className="wd-quote__mark" aria-hidden="true">
              &ldquo;
            </span>
            <p className="wd-quote__text">{QUOTE_TEXT}</p>
            <footer className="wd-quote__author">
              <span className="wd-quote__author-emoji" aria-hidden="true">
                👨‍🎨
              </span>
              {QUOTE_AUTHOR}
            </footer>
          </blockquote>
        </div>

        {/* 우측 — [6] Weekly Comment / [7] Cluv Activity Flow */}
        <div className="wd-col wd-col--right">
          <article className="wd-glass" data-fadeup>
            <h2 className="wd-glass__title">
              <span className="wd-glass__mark" aria-hidden="true" />
              Weekly Comment
            </h2>
            <p className="wd-glass__body">{weeklyComment}</p>
          </article>

          <article className="wd-glass" data-fadeup>
            <h2 className="wd-glass__title">
              <span className="wd-glass__mark" aria-hidden="true" />
              Cluv Activity Flow
            </h2>
            <p className="wd-glass__body">{activityFlow}</p>
          </article>
        </div>
      </div>

      {/* [8] 이번 주 크루 종합 결과 Dashboard — wd-grid 아래 배치. 좌 KPI(55%) / 우 Progress(45%) */}
      <section className="wd-dash" data-fadeup aria-label="이번 주 크루 종합 결과">
        <div className="wd-dash__head">
          <h2 className="wd-dash__title">
            <span className="wd-dash__mark" aria-hidden="true" />
            이번 주 크루 종합 결과
          </h2>
          <p className="wd-dash__caption">{card.seasonName} · 이번 주 클럽 전체 활동 현황</p>
        </div>

        <div className="wd-dash__body">
          {/* 좌측 — KPI 3×2 (아이콘 | label/value) */}
          <div className="wd-dash__kpis">
            {kpis.map((k) => (
              <div key={k.label} className={`wd-kpi wd-kpi--${k.tone}`}>
                <span className="wd-kpi__icon" aria-hidden="true">
                  <i className={k.icon} />
                </span>
                <div className="wd-kpi__content">
                  <span className="wd-kpi__label">{k.label}</span>
                  <strong className="wd-kpi__value">
                    {k.value.toLocaleString()}
                    <span className="wd-kpi__unit">명</span>
                  </strong>
                </div>
              </div>
            ))}
          </div>

          {/* 우측 — Progress 2개 */}
          <div className="wd-dash__progress">
            {progresses.map((p) => (
              <div key={p.label} className={`wd-prog wd-prog--${p.tone}`}>
                <div className="wd-prog__head">
                  <span className="wd-prog__label">{p.label}</span>
                  <span className="wd-prog__value">
                    {p.value}
                    <span className="wd-prog__unit">%</span>
                  </span>
                </div>
                <div
                  className="wd-prog__track"
                  role="progressbar"
                  aria-valuenow={p.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={p.label}
                >
                  <div className="wd-prog__fill" style={{ width: barsIn ? `${p.value}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* [3] Champion's Hall — 우수 크루 Top 10 (탭 전환) */}
      <section className="wd-champ" data-fadeup aria-label="Champion's Hall">
        {/* [0] 헤드 — 명예의 전당 타이틀(장식 라인·글로우) */}
        <header className="wd-champ__head">
          <span className="wd-champ__deco" aria-hidden="true" />
          <h2 className="wd-champ__title">
            Champion&rsquo;s Hall
            <span className="wd-champ__title-glow" aria-hidden="true">Champion&rsquo;s Hall</span>
          </h2>
          <span className="wd-champ__deco" aria-hidden="true" />
        </header>

        <div className="wd-champ__card">
          {/* [2] Tabs — 포인트 아이콘 + 라벨 */}
          <div className="wd-champ__tabs" role="tablist">
            {championTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={champTab === t.key}
                className={`wd-champ__tab${champTab === t.key ? " is-active" : ""}`}
                onClick={() => setChampTab(t.key)}
              >
                <img className="wd-champ__tab-icon" src={t.icon} alt="" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* 탭 내용 — key 로 재마운트해 fade/slide 전환 */}
          <div className="wd-champ__panel" key={champTab}>
            {activeTab.ready && activeChamp.list.length > 0 ? (
              <div className="wd-champ__grid">
                {activeChamp.list.map((c) => {
                  const accent = RANK_ACCENTS[(c.rank - 1) % RANK_ACCENTS.length];
                  return (
                    <div
                      key={c.rank}
                      className="wd-champ-card"
                      style={{ ["--card-accent" as string]: accent }}
                    >
                      <span className="wd-champ-card__rank">TOP {c.rank}</span>

                      <div className="wd-champ-card__head">
                        <span className="wd-champ-card__avatar">
                          {c.profileImage ? (
                            <img src={c.profileImage} alt="" />
                          ) : (
                            <span className="wd-champ-card__avatar-ph">{initialOf(c.name)}</span>
                          )}
                        </span>
                        <span className="wd-champ-card__id">
                          <span className="wd-champ-card__name">{c.name}</span>
                          {c.className ? <span className="wd-champ-card__class">{c.className}</span> : null}
                        </span>
                      </div>

                      <div className="wd-champ-card__meta">
                        {(c.school || c.major) && (
                          <span className="wd-champ-card__meta-row">
                            {c.school ? <span className="wd-champ-card__tag">{c.school}</span> : null}
                            {c.major ? <span className="wd-champ-card__tag">{c.major}</span> : null}
                          </span>
                        )}
                        {(c.team || c.part) && (
                          <span className="wd-champ-card__meta-row">
                            {c.team ? <span className="wd-champ-card__tag">{c.team} 팀</span> : null}
                            {c.part ? <span className="wd-champ-card__tag">{c.part} 파트</span> : null}
                          </span>
                        )}
                      </div>

                      <div className="wd-champ-card__point">
                        <img className="wd-champ-card__point-icon" src={activeChamp.pointIcon} alt="" aria-hidden="true" />
                        <strong className="wd-champ-card__point-value">{activeChamp.pointOf(c).toLocaleString()}</strong>
                        <span className="wd-champ-card__point-unit">개</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="wd-champ__empty">
                {activeTab.ready ? "표시할 크루가 없습니다." : "곧 공개됩니다."}
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

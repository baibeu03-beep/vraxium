"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WEEKLY_CARD_DUMMY, type WeeklyCardData } from "@/constants/dummyData/weekly-card-dummy";
import { isDemoMode } from "@/utils/isDemoMode";
import { getRankingThemeForSeason, getRankingThemeVars } from "@/lib/rankingTheme";

// ── 기본 이미지(요구사항 SoT) ── DTO 이미지 필드 미설정 시 폴백.
const DEFAULT_HERO_IMAGE = "/images/0/weekly-b.png";
const DEFAULT_REPRESENTATIVE_IMAGE = "/images/0/weekly-b-2.png";

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
  const rootRef = useRef<HTMLElement | null>(null);

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
          <p className="wd-hero__season">{card.seasonName}</p>
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
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import WeeklyCardItem from "./WeeklyCardItem";
import type { WeeklyCardData } from "@/constants/dummyData/weekly-card-dummy";

const PAGE_SIZE = 12;

interface WeeklyCardListProps {
  cards: WeeklyCardData[];
  // 로딩/빈 상태 분리 — 상위(WeeklyRankingContent)가 API 응답 완료 여부를 내려준다.
  loading?: boolean;
}

export default function WeeklyCardList({ cards, loading = false }: WeeklyCardListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // 필터/정렬 변경으로 cards가 갱신되면 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [cards]);

  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const visibleCards = cards.slice(startIdx, startIdx + PAGE_SIZE);

  // 1) 로딩 중 — API 응답 전에는 빈 상태 문구 대신 로딩 UI.
  if (loading) {
    return (
      <div className="weekly-list-loading" role="status" aria-live="polite">
        <span className="weekly-list-loading__spinner" aria-hidden="true" />
        <p>주차 카드를 불러오는 중입니다…</p>
      </div>
    );
  }

  // 2) 응답 완료 후 실제 카드가 0개일 때만 빈 상태 노출.
  if (cards.length === 0) {
    return (
      <div className="weekly-list-empty">
        <p>표시할 주차 카드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="weekly-card-list">
      <div className="row vertical-column-gap">
        {visibleCards.map((card) => (
          <WeeklyCardItem key={card.id} data={card} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="weekly-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <span
              key={num}
              className={`page-num ${currentPage === num ? "active" : ""} ${num === totalPages ? "last" : ""}`}
              onClick={() => setCurrentPage(num)}
            >
              {num}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

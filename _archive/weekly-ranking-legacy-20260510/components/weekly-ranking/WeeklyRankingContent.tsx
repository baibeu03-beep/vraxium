"use client";

import { useState, useEffect } from "react";
import RankingCard from "./RankingCard";
import WeekSelector from "./WeekSelector";
import { RankingUser, WeekOption, WeekInfo, WeeklyRankingResponse } from "./types";

const WeeklyRankingContent = () => {
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [availableWeeks, setAvailableWeeks] = useState<WeekOption[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 가져오기
  const fetchRankings = async (weekId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = weekId
        ? `/api/weekly-ranking?weekId=${weekId}`
        : '/api/weekly-ranking';

      const response = await fetch(url);
      const data: WeeklyRankingResponse = await response.json();

      if (data.success) {
        setRankings(data.data.rankings);
        setAvailableWeeks(data.data.availableWeeks);
        setCurrentWeek(data.data.week);
        if (!selectedWeekId && data.data.week) {
          setSelectedWeekId(data.data.week.id);
        }
      } else {
        setError('데이터를 가져오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchRankings();
  }, []);

  // 주차 변경 시
  const handleWeekChange = (weekId: string) => {
    setSelectedWeekId(weekId);
    fetchRankings(weekId);
  };

  return (
    <section className="leaderboard pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">
                주간 랭킹
              </h2>
              {currentWeek && (
                <p className="mt-16" style={{ color: '#888', fontSize: '16px' }}>
                  {currentWeek.season.year} {currentWeek.season.name_korean} {currentWeek.week_number}주차 단감 획득 순위
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="leaderboard__inner">
              <div className="d-flex justify-content-between align-items-center mb-30">
                <h5 className="mt-8 fw-6">
                  <i className="ti ti-star-filled" style={{ color: '#f7931a', marginRight: '8px' }}></i>
                  단감 랭킹
                </h5>
                {availableWeeks.length > 0 && (
                  <WeekSelector
                    weeks={availableWeeks}
                    selectedWeekId={selectedWeekId}
                    onWeekChange={handleWeekChange}
                  />
                )}
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3" style={{ color: '#888' }}>랭킹을 불러오는 중...</p>
                </div>
              ) : error ? (
                <div className="text-center py-5">
                  <p style={{ color: '#ff6b6b' }}>{error}</p>
                  <button
                    className="btn btn-primary mt-3"
                    onClick={() => fetchRankings(selectedWeekId || undefined)}
                  >
                    다시 시도
                  </button>
                </div>
              ) : rankings.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-mood-empty" style={{ fontSize: '48px', color: '#888' }}></i>
                  <p className="mt-3" style={{ color: '#888' }}>
                    이번 주차에는 아직 단감 획득 기록이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="leaderboard-item__wrapper mt-16">
                  {rankings.map((user) => (
                    <RankingCard key={user.user_id} user={user} />
                  ))}
                </div>
              )}

              {currentWeek && (
                <div className="mt-40 text-center" style={{ color: '#666', fontSize: '14px' }}>
                  <p>
                    {currentWeek.start_date} ~ {currentWeek.end_date}
                  </p>
                  <p className="mt-2">
                    카드를 클릭하면 해당 유저의 성장 기록을 볼 수 있습니다
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WeeklyRankingContent;

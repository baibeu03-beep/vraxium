"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { getFixedDropdownPosition } from "@/utils/documentZoom";

interface WeekOption {
  id: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
  startDate: string;
  endDate: string;
  isClubBreak: boolean;
  holidayName: string | null;
  label: string;
}

interface RateInfo {
  total: number;
  count: number;
  rate: number;
}

interface RankingUser {
  userId: string;
  displayName: string;
  profilePhotoUrl: string | null;
  status: string;
  teamName: string | null;
  partName: string | null;
  roleLabel: string;
  star: number;
  lightning: number;
  shield: number;
  injeolmi: number;
  growthStatus: string;
  cumulativeApprovedWeeks: number;
  growthRate: RateInfo;
  infoRate: RateInfo;
  competencyRate: RateInfo;
  experienceRate: RateInfo;
  careerRate: RateInfo;
  // pms1.5 calculate-weekly 산정 결과 (성공/실패 판정 근거).
  failureReason: 'stars_insufficient' | 'experience_incomplete' | 'multiple' | null;
  failureDetails: unknown;
  earnedStars: number | null;
  requiredStars: number | null;
  experienceCompleted: number | null;
  experienceRequired: number | null;
  experienceMinRating: number | null;
}

interface TeamStats {
  teamName: string;
  memberCount: number;
  // rate 평균에 들어가는 비휴식 멤버 수 (모든 rate 배열의 분모와 동일).
  activeCount: number;
  totalStar: number;
  totalInjeolmi: number;
  totalLightning: number;
  avgGrowthRate: number;
  avgInfoRate: number;
  avgCompetencyRate: number;
  avgExperienceRate: number;
  avgCareerRate: number;
  // rate === 100 인 멤버 수 (각 라인을 100% 달성한 인원).
  growthFullCount: number;
  infoFullCount: number;
  competencyFullCount: number;
  experienceFullCount: number;
  careerFullCount: number;
  successCount: number;
  failCount: number;
  restCount: number;
}

// 글자수 기반 말줄임 (info-badge role 8자 초과 시 "..")
const truncate = (text: string | null | undefined, maxLen: number = 5): string => {
  const t = text || "-";
  return t.length > maxLen ? t.slice(0, maxLen) + ".." : t;
};

// 성장 상태 표시 헬퍼 — '성장 (xxx)' / '휴식 (xxx)' 통일
// TODO: [백엔드 작업 필요] '진행 중' / '집계 중' 상태 결정 로직 추가
const getStatusDisplay = (status: string): string => {
  if (status === "휴식(개인)") return "휴식 (개인)";
  if (status === "휴식(공식)") return "휴식 (공식)";
  return `성장 (${status})`;
};
const getStatusClass = (status: string): string => {
  switch (status) {
    case "실패": return "fail";
    case "휴식(개인)": return "rest-personal";
    case "휴식(공식)": return "rest-official";
    case "진행 중": return "in-progress";
    case "집계 중": return "counting";
    default: return "";
  }
};
const getStatusIcon = (status: string): string => {
  if (status === "진행 중") return "/images/0/cluster4/icon/icon%20-%20성장%20(진행%20중).png";
  if (status === "집계 중") return "/images/0/cluster4/icon/icon%20-%20성장%20(집계%20중).png";
  if (status.includes("휴식")) return `/images/0/cluster4/icon/icon%20-%20${status.replace("(", "%28").replace(")", "%29")}.png`;
  return `/images/0/cluster4/icon/icon%20-%20성장%28${status}%29.png`;
};
const isStatusPlusOne = (status: string): boolean => status === "진행 중" || status === "집계 중";

const Cluster4RankingContent = () => {
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState("역대 시즌");
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [seasonBtnPos, setSeasonBtnPos] = useState({ top: 0, left: 0 });
  const [weekBtnPos, setWeekBtnPos] = useState({ top: 0, left: 0 });
  const seasonBtnRef = useRef<HTMLDivElement>(null);
  const weekBtnRef = useRef<HTMLDivElement>(null);

  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeekOption | null>(null);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 로드: 주차 목록 + 기본 주차 랭킹을 한 번에 가져오기
  useEffect(() => {
    const fetchInitial = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/cluster-4-ranking?default=true');
        const result = await response.json();
        if (result.success) {
          if (result.weeks) setWeeks(result.weeks);
          if (result.selectedWeek) {
            setSelectedWeekId(result.selectedWeek.id);
            setSelectedSeason(`${result.selectedWeek.seasonYear}년, ${result.selectedWeek.seasonName} 시즌`);
            setSelectedWeek(result.selectedWeek);
          }
          setRankings(result.rankings || []);
        }
      } catch (error) {
        console.error("초기 데이터 로드 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitial();
  }, []);

  // 사용자가 주차를 변경했을 때만 랭킹 데이터 재로드
  const initialWeekIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!selectedWeekId) return;
    // 초기 로드에서 이미 가져온 경우 스킵
    if (initialWeekIdRef.current === null) {
      initialWeekIdRef.current = selectedWeekId;
      return;
    }
    if (selectedWeekId === initialWeekIdRef.current) return;
    initialWeekIdRef.current = selectedWeekId;

    const fetchRankings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/cluster-4-ranking?weekId=${selectedWeekId}`);
        const result = await response.json();
        if (result.success) {
          setSelectedWeek(result.selectedWeek);
          setRankings(result.rankings || []);
        }
      } catch (error) {
        console.error("랭킹 데이터 로드 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRankings();
  }, [selectedWeekId]);

  // 시즌 옵션 추출
  const seasonOptions = React.useMemo(() => {
    const seasonOrder: { [key: string]: number } = { '겨울': 1, '봄': 2, '여름': 3, '가을': 4 };
    const uniqueSeasons = new Map<string, { year: number; season: string }>();
    weeks.forEach(week => {
      const key = `${week.seasonYear}-${week.seasonName}`;
      if (!uniqueSeasons.has(key)) {
        uniqueSeasons.set(key, { year: week.seasonYear, season: week.seasonName });
      }
    });
    return Array.from(uniqueSeasons.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return (seasonOrder[b.season] || 0) - (seasonOrder[a.season] || 0);
      })
      .map(s => `${s.year}년, ${s.season} 시즌`);
  }, [weeks]);

  // 선택된 시즌의 주차 옵션
  const weekOptions = React.useMemo(() => {
    if (selectedSeason === "역대 시즌") return weeks;
    const [yearPart, seasonPart] = selectedSeason.replace("년,", "").split(" ");
    const year = parseInt(yearPart);
    const season = seasonPart;
    return weeks.filter(w => w.seasonYear === year && w.seasonName === season);
  }, [weeks, selectedSeason]);

  // hash fragment 기반 스크롤 (#weekly-filter-bar)
  useEffect(() => {
    if (window.location.hash === '#weekly-filter-bar') {
      const tryScroll = () => {
        const el = document.getElementById('weekly-filter-bar');
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top, left: 0, behavior: 'auto' });
        }
      };
      // DOM 렌더링 + 데이터 fetch 완료 대기
      setTimeout(tryScroll, 500);
      setTimeout(tryScroll, 1000);
    }
  }, []);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setSeasonDropdownOpen(false);
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 버튼 위치 업데이트
  const updateSeasonPos = () => {
    if (seasonBtnRef.current) {
      const rect = seasonBtnRef.current.getBoundingClientRect();
      const { top, left } = getFixedDropdownPosition(rect, 8);
      setSeasonBtnPos({ top, left });
    }
  };

  const updateWeekPos = () => {
    if (weekBtnRef.current) {
      const rect = weekBtnRef.current.getBoundingClientRect();
      const { top, left } = getFixedDropdownPosition(rect, 8);
      setWeekBtnPos({ top, left });
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = days[date.getDay()];
    return `${year} - ${month} - ${day} (${dayOfWeek})`;
  };

  // 팀별 통계 집계
  const teamStats = useMemo(() => {
    const teamMap = new Map<string, {
      members: RankingUser[];
      totalStar: number;
      totalInjeolmi: number;
      totalLightning: number;
      growthRates: number[];
      infoRates: number[];
      competencyRates: number[];
      experienceRates: number[];
      careerRates: number[];
      successCount: number;
      failCount: number;
      restCount: number;
    }>();

    rankings.forEach(user => {
      const teamName = user.teamName || '미배정';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, {
          members: [],
          totalStar: 0,
          totalInjeolmi: 0,
          totalLightning: 0,
          growthRates: [],
          infoRates: [],
          competencyRates: [],
          experienceRates: [],
          careerRates: [],
          successCount: 0,
          failCount: 0,
          restCount: 0
        });
      }

      const team = teamMap.get(teamName)!;
      team.members.push(user);
      team.totalStar += user.star;
      team.totalInjeolmi += user.injeolmi;
      team.totalLightning += user.lightning;

      // 휴식이 아닌 경우에만 강화율 집계
      if (!user.growthStatus.includes('휴식')) {
        team.growthRates.push(user.growthRate.rate);
        team.infoRates.push(user.infoRate.rate);
        team.competencyRates.push(user.competencyRate.rate);
        team.experienceRates.push(user.experienceRate.rate);
        team.careerRates.push(user.careerRate.rate);
      }

      if (user.growthStatus === '성공') team.successCount++;
      else if (user.growthStatus === '실패') team.failCount++;
      else team.restCount++;
    });

    const stats: TeamStats[] = [];
    teamMap.forEach((data, teamName) => {
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      const fullCount = (arr: number[]) => arr.filter(r => r >= 100).length;
      stats.push({
        teamName,
        memberCount: data.members.length,
        activeCount: data.growthRates.length,
        totalStar: data.totalStar,
        totalInjeolmi: data.totalInjeolmi,
        totalLightning: data.totalLightning,
        avgGrowthRate: avg(data.growthRates),
        avgInfoRate: avg(data.infoRates),
        avgCompetencyRate: avg(data.competencyRates),
        avgExperienceRate: avg(data.experienceRates),
        avgCareerRate: avg(data.careerRates),
        growthFullCount: fullCount(data.growthRates),
        infoFullCount: fullCount(data.infoRates),
        competencyFullCount: fullCount(data.competencyRates),
        experienceFullCount: fullCount(data.experienceRates),
        careerFullCount: fullCount(data.careerRates),
        successCount: data.successCount,
        failCount: data.failCount,
        restCount: data.restCount
      });
    });

    // 단감 총합 기준으로 정렬
    return stats.sort((a, b) => b.totalStar - a.totalStar);
  }, [rankings]);

  return (
    <>
      {/* 드롭다운 애니메이션 스타일 */}
      <style jsx global>{`
        @keyframes dropdownSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(138, 43, 226, 0.3); }
          50% { box-shadow: 0 0 30px rgba(138, 43, 226, 0.6); }
        }
        .team-stats-section {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) {
          .metric-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .metric-grid { grid-template-columns: 1fr; }
        }
        .metric-card {
          position: relative;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow: hidden;
          transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
          min-height: 160px;
        }
        .metric-card:hover {
          transform: translateY(-3px);
          filter: brightness(1.1);
        }
        .metric-card-watermark {
          position: absolute;
          top: -12px;
          right: -8px;
          font-size: 72px;
          opacity: 0.08;
          pointer-events: none;
          line-height: 1;
          user-select: none;
        }
        .metric-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          line-height: 1.25;
          word-break: keep-all;
          min-width: 0;
          flex: 1;
        }
        .metric-card-team {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          word-break: keep-all;
          line-height: 1.2;
        }
      `}</style>

      {/* 시즌 드롭다운 */}
      {seasonDropdownOpen && (
        <div
          style={{
            position: 'fixed',
            top: seasonBtnPos.top,
            left: seasonBtnPos.left,
            width: '200px',
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            zIndex: 999999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'dropdownSlide 0.2s ease-out',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {seasonOptions.map((option, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                color: selectedSeason === option ? '#FFA500' : '#fff',
                background: selectedSeason === option ? 'rgba(255,165,0,0.2)' : 'transparent',
                cursor: 'pointer',
                borderBottom: index < seasonOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
              }}
              onClick={() => {
                setSelectedSeason(option);
                setSeasonDropdownOpen(false);
                // 시즌 변경 시 해당 시즌의 첫 주차 선택
                const [yearPart, seasonPart] = option.replace("년,", "").split(" ");
                const year = parseInt(yearPart);
                const season = seasonPart;
                const firstWeek = weeks.find(w => w.seasonYear === year && w.seasonName === season);
                if (firstWeek) setSelectedWeekId(firstWeek.id);
              }}
              onMouseEnter={(e) => {
                if (selectedSeason !== option) e.currentTarget.style.background = 'rgba(255,165,0,0.1)';
              }}
              onMouseLeave={(e) => {
                if (selectedSeason !== option) e.currentTarget.style.background = 'transparent';
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}

      {/* 주차 드롭다운 */}
      {weekDropdownOpen && (
        <div
          style={{
            position: 'fixed',
            top: weekBtnPos.top,
            left: weekBtnPos.left,
            width: '280px',
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            zIndex: 999999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'dropdownSlide 0.2s ease-out',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {weekOptions.map((week, index) => (
            <div
              key={week.id}
              style={{
                padding: '12px 16px',
                color: selectedWeekId === week.id ? '#FFA500' : '#fff',
                background: selectedWeekId === week.id ? 'rgba(255,165,0,0.2)' : 'transparent',
                cursor: 'pointer',
                borderBottom: index < weekOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
              }}
              onClick={() => {
                setSelectedWeekId(week.id);
                setWeekDropdownOpen(false);
              }}
              onMouseEnter={(e) => {
                if (selectedWeekId !== week.id) e.currentTarget.style.background = 'rgba(255,165,0,0.1)';
              }}
              onMouseLeave={(e) => {
                if (selectedWeekId !== week.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              {week.weekNumber}주차 ({formatDate(week.startDate).split(' ').slice(2).join(' ')})
            </div>
          ))}
        </div>
      )}

      <div className="cluster4-content cluster4-content--week">

        {/* Section 3: 랭킹 리스트 */}
        <section className="cluster4-weekly-list" id="cluster4-weekly-list">
          {/* 필터 바 */}
          <div className="weekly-filter-bar" id="weekly-filter-bar">
            <div
              className="filter-card filter-card-large"
              onClick={() => {
                setSelectedSeason("역대 시즌");
                if (weeks.length > 0) setSelectedWeekId(weeks[0].id);
                setSeasonDropdownOpen(false);
                setWeekDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 1.png" alt="reset" className="filter-icon" />
                <span>Reset</span>
              </div>
            </div>
            {/* 시즌 선택 */}
            <div
              ref={seasonBtnRef}
              className="filter-card filter-dropdown"
              style={{
                borderColor: selectedSeason !== "역대 시즌" ? '#FFA500' : 'rgba(255, 255, 255, 0.12)',
                background: selectedSeason !== "역대 시즌" ? 'rgba(255, 165, 0, 0.1)' : 'transparent'
              }}
              onClick={() => {
                updateSeasonPos();
                setSeasonDropdownOpen(!seasonDropdownOpen);
                setWeekDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 2.png" alt="calendar" className="card-icon" />
                <span className="card-label" style={{ color: selectedSeason !== "역대 시즌" ? '#FFA500' : '#fff' }}>{selectedSeason}</span>
              </div>
              <span className={`card-arrow ${seasonDropdownOpen ? 'open' : ''}`} style={{ color: selectedSeason !== "역대 시즌" ? '#FFA500' : '#fff' }}>▼</span>
            </div>
            {/* 주차 선택 */}
            <div
              ref={weekBtnRef}
              className="filter-card filter-dropdown"
              style={{
                borderColor: '#FFA500',
                background: 'rgba(255, 165, 0, 0.1)'
              }}
              onClick={() => {
                updateWeekPos();
                setWeekDropdownOpen(!weekDropdownOpen);
                setSeasonDropdownOpen(false);
              }}
            >
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 7.png" alt="clock" className="card-icon" />
                <span className="card-label" style={{ color: '#FFA500' }}>
                  {selectedWeek ? `${selectedWeek.weekNumber}주차` : '주차 선택'}
                </span>
              </div>
              <span className={`card-arrow ${weekDropdownOpen ? 'open' : ''}`} style={{ color: '#FFA500' }}>▼</span>
            </div>
            <div className="filter-card">
              <div className="card-left">
                <img src="/images/0/cluster4/icon/icon - 4.png" alt="search" className="card-icon" />
                <span className="card-label">크루 수</span>
              </div>
              <span className="card-value">{rankings.length}</span>
            </div>
          </div>

          {/* 선택된 주차 정보 */}
          {selectedWeek && (
            <div style={{
              padding: '16px 20px',
              background: 'rgba(255, 165, 0, 0.1)',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid rgba(255, 165, 0, 0.3)'
            }}>
              <span style={{ color: '#FFA500', fontWeight: 600 }}>
                {selectedWeek.seasonYear}년 {selectedWeek.seasonName} 시즌, {selectedWeek.weekNumber}주차
              </span>
              <span style={{ color: '#888', marginLeft: '16px' }}>
                {formatDate(selectedWeek.startDate)} ~ {formatDate(selectedWeek.endDate)}
              </span>
            </div>
          )}

          {/* 팀별 활동 인정률 섹션 - 스와이퍼 기반 지표별 비교 */}
          {!isLoading && teamStats.length > 0 && (() => {
            // 지표별 데이터 정의
            type MetricFormat = (v: number, t: TeamStats) => string;
            interface MetricSlide {
              id: string;
              title: string;
              subtitle: string;
              icon: string | null;
              emoji: string;
              color: string;
              bgGradient: string;
              getValue: (t: TeamStats) => number;
              format: MetricFormat;
              // 값 옆에 표시할 작은 컨텍스트 (예: '(3/12명)' / '총 12명 크루').
              getSubtext: (t: TeamStats) => string;
              isPercentage: boolean;
              reverse?: boolean;
              isBattle?: boolean;
            }
            const metricSlides: MetricSlide[] = [
              {
                id: 'star',
                title: '단감 획득',
                subtitle: 'Star Points',
                icon: '/images/0/cluster4/icon/icon - 단감.png',
                emoji: '⭐',
                color: '#FFD700',
                bgGradient: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 140, 0, 0.1) 100%)',
                getValue: (t) => t.totalStar,
                format: (v) => `${v}개`,
                getSubtext: (t) => `총 ${t.memberCount}명 크루가 획득`,
                isPercentage: false
              },
              {
                id: 'injeolmi',
                title: '인절미 보유',
                subtitle: 'Injeolmi Balance',
                icon: '/images/0/cluster4/icon/icon - 인절미.png',
                emoji: '🍡',
                color: '#FF69B4',
                bgGradient: 'linear-gradient(135deg, rgba(255, 105, 180, 0.15) 0%, rgba(219, 112, 147, 0.1) 100%)',
                getValue: (t) => t.totalInjeolmi,
                format: (v) => `${v}개`,
                getSubtext: (t) => `총 ${t.memberCount}명 크루가 보유`,
                isPercentage: false
              },
              {
                id: 'lightning',
                title: '어흥 획득',
                subtitle: 'Lightning Strikes',
                icon: '/images/0/cluster4/icon/icon - 어흥.png',
                emoji: '⚡',
                color: '#FF4444',
                bgGradient: 'linear-gradient(135deg, rgba(255, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
                getValue: (t) => t.totalLightning,
                format: (v) => v > 0 ? `-${v}개` : '0개',
                getSubtext: (t) => `총 ${t.memberCount}명 크루가 획득`,
                isPercentage: false,
                reverse: true
              },
              {
                id: 'growth',
                title: '평균 주차 성장률',
                subtitle: 'Weekly Growth Rate',
                icon: null,
                emoji: '📈',
                color: '#4ADE80',
                bgGradient: 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(34, 197, 94, 0.1) 100%)',
                getValue: (t) => t.avgGrowthRate,
                format: (v) => `${v}%`,
                getSubtext: () => '',
                isPercentage: true
              },
              {
                id: 'info',
                title: '실무 정보 강화율',
                subtitle: 'Info Enhancement',
                icon: null,
                emoji: '📚',
                color: '#60A5FA',
                bgGradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
                getValue: (t) => t.avgInfoRate,
                format: (v) => `${v}%`,
                getSubtext: () => '',
                isPercentage: true
              },
              {
                id: 'competency',
                title: '실무 역량 강화율',
                subtitle: 'Competency Enhancement',
                icon: null,
                emoji: '💪',
                color: '#A78BFA',
                bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                getValue: (t) => t.avgCompetencyRate,
                format: (v) => `${v}%`,
                getSubtext: () => '',
                isPercentage: true
              },
              {
                id: 'experience',
                title: '실무 경험 강화율',
                subtitle: 'Experience Enhancement',
                icon: null,
                emoji: '🎯',
                color: '#F472B6',
                bgGradient: 'linear-gradient(135deg, rgba(244, 114, 182, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)',
                getValue: (t) => t.avgExperienceRate,
                format: (v) => `${v}%`,
                getSubtext: () => '',
                isPercentage: true
              },
              {
                id: 'career',
                title: '실무 경력 강화율',
                subtitle: 'Career Enhancement',
                icon: null,
                emoji: '🚀',
                color: '#FBBF24',
                bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
                getValue: (t) => t.avgCareerRate,
                format: (v) => `${v}%`,
                getSubtext: () => '',
                isPercentage: true
              }
            ];

            return (
              <div className="team-stats-section" style={{ marginBottom: '32px' }}>

                {/* 지표 카드 그리드 — 8개 metric 1등 팀을 4×2로 한눈에 */}
                <div className="metric-grid">
                  {metricSlides.map((metric) => {
                    const sortedTeams = [...teamStats].sort((a, b) => {
                      const aVal = metric.getValue(a);
                      const bVal = metric.getValue(b);
                      return metric.reverse ? aVal - bVal : bVal - aVal;
                    });
                    const top = sortedTeams[0];
                    if (!top) return null;
                    const value = metric.getValue(top);

                    return (
                      <div key={metric.id} className="metric-card" style={{
                        background: metric.bgGradient,
                        border: `1px solid ${metric.color}40`,
                        boxShadow: `0 4px 20px ${metric.color}15`
                      }}>
                        {/* 우상단 워터마크 emoji */}
                        <div className="metric-card-watermark">{metric.emoji}</div>

                        {/* 헤더: 컬러 아이콘 + title */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', position: 'relative', zIndex: 1 }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: `linear-gradient(135deg, ${metric.color} 0%, ${metric.color}99 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            flexShrink: 0,
                            boxShadow: `0 3px 12px ${metric.color}60`
                          }}>
                            {metric.icon ? (
                              <Image src={metric.icon} alt={metric.title} width={20} height={20} />
                            ) : (
                              metric.emoji
                            )}
                          </div>
                          <div className="metric-card-title">{metric.title}</div>
                        </div>

                        {/* 큰 값 + 작은 컨텍스트 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '8px',
                          flexWrap: 'wrap',
                          position: 'relative',
                          zIndex: 1
                        }}>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: metric.color,
                            textShadow: `0 0 20px ${metric.color}60`,
                            lineHeight: 1
                          }}>
                            {metric.format(value, top)}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#aaa',
                            fontWeight: 500,
                            wordBreak: 'keep-all',
                            lineHeight: 1.2
                          }}>
                            {metric.getSubtext(top)}
                          </div>
                        </div>

                        {/* 하단 1위 팀 칩 */}
                        <div style={{
                          marginTop: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          position: 'relative',
                          zIndex: 1,
                          padding: '7px 10px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          border: `1px solid ${metric.color}40`
                        }}>
                          <span style={{ fontSize: '14px', flexShrink: 0 }}>👑</span>
                          <span className="metric-card-team">{top.teamName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 팀별 성장 승패 세로 막대 그래프 */}
                <div style={{
                  marginTop: '24px',
                  padding: '24px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
                  borderRadius: '20px',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}>
                  {/* 그래프 헤더 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '28px' }}>⚔️</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>팀별 성장 승패 현황</h4>
                        <p style={{ margin: 0, fontSize: '14px', color: '#888' }}>Team Growth Battle Overview</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(180deg, #4ADE80, #22C55E)' }} />
                        <span style={{ color: '#ccc', fontWeight: 600 }}>성공</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(180deg, #EF4444, #DC2626)' }} />
                        <span style={{ color: '#ccc', fontWeight: 600 }}>실패</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(180deg, #6B7280, #4B5563)' }} />
                        <span style={{ color: '#ccc', fontWeight: 600 }}>휴식</span>
                      </div>
                    </div>
                  </div>

                  {/* 세로 막대 그래프 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-around',
                    height: '200px',
                    padding: '0 20px',
                    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative'
                  }}>
                    {/* Y축 라인 */}
                    {[0, 25, 50, 75, 100].map((val) => (
                      <div
                        key={val}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: `${val}%`,
                          borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                          pointerEvents: 'none'
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          left: '-34px',
                          top: '-9px',
                          fontSize: '13px',
                          color: '#888',
                          fontWeight: 600
                        }}>{val}%</span>
                      </div>
                    ))}

                    {/* 팀별 막대 */}
                    {teamStats.map((team, idx) => {
                      const total = team.successCount + team.failCount + team.restCount;
                      const successHeight = total > 0 ? (team.successCount / total) * 100 : 0;
                      const failHeight = total > 0 ? (team.failCount / total) * 100 : 0;
                      const restHeight = total > 0 ? (team.restCount / total) * 100 : 0;
                      const successRate = (team.successCount + team.failCount) > 0
                        ? Math.round((team.successCount / (team.successCount + team.failCount)) * 100)
                        : 0;

                      return (
                        <div
                          key={team.teamName}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            flex: 1,
                            maxWidth: '120px'
                          }}
                        >
                          {/* 승률 표시 */}
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: successRate >= 70 ? '#4ADE80' : successRate >= 50 ? '#FBBF24' : '#EF4444',
                            textShadow: `0 0 10px ${successRate >= 70 ? 'rgba(74, 222, 128, 0.5)' : successRate >= 50 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`
                          }}>
                            {successRate}%
                          </div>

                          {/* 스택 막대 */}
                          <div style={{
                            width: '50px',
                            height: '160px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px 8px 0 0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column-reverse',
                            position: 'relative',
                            border: idx === 0 ? '2px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: idx === 0 ? '0 0 20px rgba(255, 215, 0, 0.3)' : 'none'
                          }}>
                            {/* 성공 바 */}
                            <div style={{
                              width: '100%',
                              height: `${successHeight}%`,
                              background: 'linear-gradient(180deg, #4ADE80 0%, #22C55E 100%)',
                              transition: 'height 0.5s ease-out',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 0 10px rgba(74, 222, 128, 0.3) inset'
                            }}>
                              {successHeight > 15 && (
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#000' }}>{team.successCount}</span>
                              )}
                            </div>
                            {/* 실패 바 */}
                            <div style={{
                              width: '100%',
                              height: `${failHeight}%`,
                              background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                              transition: 'height 0.5s ease-out',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 0 10px rgba(239, 68, 68, 0.3) inset'
                            }}>
                              {failHeight > 15 && (
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{team.failCount}</span>
                              )}
                            </div>
                            {/* 휴식 바 */}
                            {restHeight > 0 && (
                              <div style={{
                                width: '100%',
                                height: `${restHeight}%`,
                                background: 'linear-gradient(180deg, #6B7280 0%, #4B5563 100%)',
                                transition: 'height 0.5s ease-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {restHeight > 15 && (
                                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{team.restCount}</span>
                                )}
                              </div>
                            )}

                            {/* 1등 표시 */}
                            {idx === 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '-28px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontSize: '20px'
                              }}>
                                👑
                              </div>
                            )}
                          </div>

                          {/* 팀 이름 */}
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: idx === 0 ? '#FFD700' : '#fff',
                            textAlign: 'center',
                            maxWidth: '90px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {team.teamName}
                          </div>

                          {/* 인원 수 */}
                          <div style={{
                            fontSize: '12px',
                            color: '#888',
                            fontWeight: 500
                          }}>
                            {team.memberCount}명
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 하단 요약 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '40px',
                    marginTop: '24px',
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', fontWeight: 600 }}>🥰주차 성장 성공</div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#4ADE80' }}>
                        {teamStats.reduce((sum, t) => sum + t.successCount, 0)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', fontWeight: 600 }}>😭주차 성장 실패</div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#EF4444' }}>
                        {teamStats.reduce((sum, t) => sum + t.failCount, 0)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', fontWeight: 600 }}>😴주차 휴식</div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#6B7280' }}>
                        {teamStats.reduce((sum, t) => sum + t.restCount, 0)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', fontWeight: 600 }}>⚔️전체 승률</div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#8B5CF6' }}>
                        {(() => {
                          const totalSuccess = teamStats.reduce((sum, t) => sum + t.successCount, 0);
                          const totalFail = teamStats.reduce((sum, t) => sum + t.failCount, 0);
                          return (totalSuccess + totalFail) > 0
                            ? Math.round((totalSuccess / (totalSuccess + totalFail)) * 100)
                            : 0;
                        })()}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 랭킹 카드 리스트 */}
          <div className="weekly-cards">
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>랭킹 데이터 로딩 중...</div>
            ) : rankings.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>해당 주차에 활동한 크루가 없습니다.</div>
            ) : rankings.map((user, index) => (
              <Link href={`/cluster-4-card/${selectedWeekId}?userId=${user.userId}`} key={user.userId} className={`weekly-card${user.growthStatus === '성공' ? ' weekly-card--success' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {/* 왼쪽: 프로필 이미지 */}
                <div className={`weekly-card-image ${user.growthStatus === '휴식(개인)' ? 'rest-personal-overlay' : ''}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#1a1a1a',
                  position: 'relative',
                  minWidth: '100px',
                  maxWidth: '100px'
                }}>
                  <div style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid rgba(255, 165, 0, 0.5)',
                    position: 'relative'
                  }}>
                    <Image
                      src={user.profilePhotoUrl || "/images/0/1.png"}
                      alt={`${user.displayName} profile`}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  {/* 랭킹 배지 — Top 3 금/은/동 메달, 4위 이하 다크 칩 */}
                  {(() => {
                    const rank = index + 1;
                    const medal: Record<number, { bg: string; border: string; glow: string; text: string; crown?: string }> = {
                      1: {
                        bg: 'linear-gradient(135deg, #FFE066 0%, #FFC700 35%, #FF9500 75%, #E67E00 100%)',
                        border: '2px solid rgba(255, 230, 100, 0.9)',
                        glow: '0 0 14px rgba(255, 200, 0, 0.85), 0 0 28px rgba(255, 165, 0, 0.45), inset 0 1px 2px rgba(255,255,255,0.6)',
                        text: '#3a2200',
                        crown: '👑',
                      },
                      2: {
                        bg: 'linear-gradient(135deg, #F5F5F5 0%, #D6D6D6 40%, #A8A8A8 100%)',
                        border: '2px solid rgba(240, 240, 240, 0.9)',
                        glow: '0 0 12px rgba(200, 200, 200, 0.7), 0 0 22px rgba(180, 180, 180, 0.35), inset 0 1px 2px rgba(255,255,255,0.7)',
                        text: '#2a2a2a',
                      },
                      3: {
                        bg: 'linear-gradient(135deg, #E8A878 0%, #C97D44 45%, #8B4513 100%)',
                        border: '2px solid rgba(232, 168, 120, 0.9)',
                        glow: '0 0 12px rgba(201, 125, 68, 0.7), 0 0 22px rgba(139, 69, 19, 0.35), inset 0 1px 2px rgba(255,255,255,0.4)',
                        text: '#fff',
                      },
                    };
                    if (rank <= 3) {
                      const m = medal[rank];
                      return (
                        <>
                          {m.crown && (
                            <div className="rank-crown" style={{
                              position: 'absolute',
                              top: '-12px',
                              left: '14px',
                              fontSize: '20px',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                              zIndex: 3,
                            }}>
                              {m.crown}
                            </div>
                          )}
                          {rank === 1 && (
                            <div className="rank-sparkles" aria-hidden="true">
                              <span /><span /><span /><span />
                            </div>
                          )}
                          <div className={`rank-medal rank-medal--${rank}`} style={{
                            top: '6px',
                            left: '6px',
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: m.bg,
                            border: m.border,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: m.text,
                            fontFamily: '"Cinzel", "Playfair Display", Georgia, serif',
                            fontWeight: 900,
                            fontSize: '17px',
                            textShadow: '0 1px 2px rgba(255,255,255,0.4)',
                            zIndex: 2,
                          }}>
                            {rank}
                          </div>
                        </>
                      );
                    }
                    return (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        minWidth: '26px',
                        height: '26px',
                        padding: '0 8px',
                        borderRadius: '13px',
                        background: 'linear-gradient(135deg, rgba(40,40,40,0.95) 0%, rgba(20,20,20,0.95) 100%)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#e0e0e0',
                        fontWeight: 700,
                        fontSize: '12px',
                        letterSpacing: '0.3px',
                        zIndex: 2,
                      }}>
                        {rank}
                      </div>
                    );
                  })()}
                  {user.growthStatus === '휴식(개인)' && (
                    <div className="rest-message">
                      <span className="rest-text-line">충분히</span>
                      <span className="rest-text-line">쉬었나요..?</span>
                    </div>
                  )}
                  <div className="image-badges">
                    <div className={`badge-tag ${getStatusClass(user.growthStatus)}`}>
                      {getStatusDisplay(user.growthStatus)}
                    </div>
                  </div>
                </div>

                {/* 중앙 콘텐츠 */}
                <div className="weekly-card-content">
                  {/* 첫 번째 줄: 이름, 날짜, 주차 */}
                  <div className="weekly-card-header">
                    <h4 className="weekly-card-title">{user.displayName}</h4>
                    {selectedWeek && (
                      <>
                        <span className="weekly-card-date">
                          <img src="/images/0/cluster4/icon/icon - 6.png" alt="calendar" className="date-icon" />
                          {formatDate(selectedWeek.startDate)} ~ {formatDate(selectedWeek.endDate)}
                        </span>
                        <span className="weekly-card-week">
                          <img src="/images/0/cluster4/icon/icon - 7.png" alt="clock" className="week-icon" />
                          <span className="week-number">
                            {isStatusPlusOne(user.growthStatus) ? "+1" : user.cumulativeApprovedWeeks}
                          </span> / 25 주차
                        </span>
                      </>
                    )}
                  </div>

                  {/* 두 번째 줄: 팀, 파트, 역할, 아이템 */}
                  <div className="weekly-card-info">
                    <div className="info-group">
                      <span className="info-item team">
                        <strong>[팀]</strong>{' '}
                        <span className="text-gray">{user.teamName || '-'}</span>
                      </span>
                      <span className="info-divider">|</span>
                      <span className="info-item part">
                        <strong>[파트]</strong>{' '}
                        <span className="text-gray">{user.partName || '-'}</span>
                      </span>
                    </div>
                    <div className="info-group">
                      <span className="info-badge role">
                        <img src="/images/0/cluster4/icon/icon - 8.png" alt="role" className="role-icon" />
                        <span>{truncate(user.roleLabel, 8)}</span>
                      </span>
                    </div>
                    <div className="info-group items">
                      <span className="info-divider">·</span>
                      <span className="info-item with-icon">
                        단감
                        <img src="/images/0/cluster4/icon/icon - 단감.png" alt="단감" className="item-icon" />
                        <strong className="number-value">{user.star}</strong>
                        개
                      </span>
                      <span className="info-divider">·</span>
                      <span className="info-item with-icon">
                        인절미
                        <img src="/images/0/cluster4/icon/icon - 인절미.png" alt="인절미" className="item-icon" />
                        <strong className="number-value">{user.injeolmi}</strong>
                        개
                      </span>
                      <span className="info-divider">·</span>
                      <span className="info-item with-icon">
                        어흥
                        <img src="/images/0/cluster4/icon/icon - 어흥.png" alt="어흥" className="item-icon" />
                        <strong className="number-value">{Math.abs(user.lightning)}</strong>
                        개
                      </span>
                    </div>
                  </div>

                  {/* 세 번째 줄: 주차 성장률 */}
                  {(() => {
                    const isRest = user.growthStatus.includes('휴식');
                    return (
                      <>
                        <div className="weekly-card-main-progress">
                          <span className="progress-label"><span className="dot">·</span> 주차 성장률 <strong>{isRest ? '-' : user.growthRate.rate}%</strong></span>
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${isRest ? 0 : user.growthRate.rate}%` }}></div>
                            </div>
                          </div>
                          <span className="total-count">
                            <img src="/images/0/cluster4/icon/icon - 0.png" alt="leaf" className="leaf-icon" />
                            총 {isRest ? '-' : user.growthRate.total} 개 중 <strong>{isRest ? '-' : user.growthRate.count}</strong> 개
                          </span>
                        </div>

                        <div className={`weekly-card-stats-wrapper ${user.growthStatus === '실패' ? 'fail' : ''} ${user.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${user.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>
                          <div className="weekly-card-stats">
                            <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${user.growthStatus === '실패' ? 'fail' : ''} ${user.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${user.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>정보</span> 강화율 <strong>{isRest ? '-' : user.infoRate.rate}%</strong> <span className="gray">(<span className="num">{isRest ? '-' : user.infoRate.count}</span>/{isRest ? '-' : user.infoRate.total})</span></span>
                            <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${user.growthStatus === '실패' ? 'fail' : ''} ${user.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${user.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>경험</span> 강화율 <strong>{isRest ? '-' : user.experienceRate.rate}%</strong> <span className="gray">(<span className="num">{isRest ? '-' : user.experienceRate.count}</span>/{isRest ? '-' : user.experienceRate.total})</span></span>
                            <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${user.growthStatus === '실패' ? 'fail' : ''} ${user.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${user.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>역량</span> 강화율 <strong>{isRest ? '-' : user.competencyRate.rate}%</strong> <span className="gray">(<span className="num">{isRest ? '-' : user.competencyRate.count}</span>/{isRest ? '-' : user.competencyRate.total})</span></span>
                            <span className="stat"><span className="dot">·</span> 실무 <span className={`highlight ${user.growthStatus === '실패' ? 'fail' : ''} ${user.growthStatus === '휴식(개인)' ? 'rest-personal' : ''} ${user.growthStatus === '휴식(공식)' ? 'rest-official' : ''}`}>경력</span> 강화율 <strong>{isRest ? '-' : user.careerRate.rate}%</strong> <span className="gray">(<span className="num">{isRest ? '-' : user.careerRate.count}</span>/{isRest ? '-' : user.careerRate.total})</span></span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 우측 성장 상태 */}
                <div className={`weekly-card-status-badge ${getStatusClass(user.growthStatus)}`}>
                  <span className="status-text">{getStatusDisplay(user.growthStatus)}</span>
                  <img src={getStatusIcon(user.growthStatus)} alt={getStatusDisplay(user.growthStatus)} className="trophy-icon" />
                </div>

                {/* 더보기 버튼 */}
                <div className="weekly-card-more-btn">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="2" fill="none" />
                    <path d="M7 5.5L10 8L7 10.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

export default Cluster4RankingContent;

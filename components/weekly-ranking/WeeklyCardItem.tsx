"use client";

import Image from "next/image";
import Tilt from "react-parallax-tilt";
import type { WeeklyCardCrew, WeeklyCardData } from "@/constants/dummyData/weekly-card-dummy";

type CrewRow = WeeklyCardCrew & { isPlaceholder?: boolean };

const PLACEHOLDER_TEXT = '-';

// placeholder 표시 형태: "- | -    팀 | -    파트"
// 실제 데이터 row 와 동일한 inner grid(minmax(0,1fr) auto + suffix justify-self:end) 를 그대로 사용.
// text span 에 "-" 를 채워 좌측 정렬, suffix span 의 "팀"/"파트" 는 기존처럼 우측 정렬 유지.
const buildPlaceholderRow = (rank: 1 | 2 | 3): CrewRow => ({
  rank,
  name: PLACEHOLDER_TEXT,
  team: PLACEHOLDER_TEXT,
  part: PLACEHOLDER_TEXT,
  isPlaceholder: true,
});

const stripSuffix = (value: string | null | undefined, suffix: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length).trim() : trimmed;
};

const truncateName = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.length >= 5 ? `${value.slice(0, 3)}..` : value;
};

// max = 표시할 최대 본문 글자수 (말줄임표 제외). 본문 길이가 max+1 이상이면 first(max) + ".." 로 잘라낸다.
// 검증 케이스: "마케팅전략"(5) → "마케팅전..", "브랜드콘텐츠"(6) → "브랜드콘..".
const truncateLabel = (value: string, max = 4): string => {
  if (!value) return '';
  return value.length >= max + 1 ? `${value.slice(0, max)}..` : value;
};

const getStatusTone = (status: string): string => {
  switch (status) {
    case '정상 진행':
    case '검수 완료':
      return 'status-green';
    case '심화 진행':
    case '대전 집계':
      return 'status-yellow';
    case '공식 휴식':
      return 'status-muted';
    case '대전 중':
      return 'status-blue';
    case '공표 중':
      return 'status-purple';
    default:
      return 'status-neutral';
  }
};

const STATUS_ICON_MAP: Record<string, string> = {
  '정상 진행': 'ti ti-circle-check',
  '심화 진행': 'ti ti-flame',
  '공식 휴식': 'ti ti-bed',
  '대전 중': 'ti ti-swords',
  '대전 집계': 'ti ti-chart-bar',
  '공표 중': 'ti ti-speakerphone',
  '검수 완료': 'ti ti-shield-check',
};

const RANK_IMAGE_MAP: Record<number, string> = {
  1: '/images/0/first.png',
  2: '/images/0/second.png',
  3: '/images/0/third.png',
};

interface Props {
  data: WeeklyCardData;
}

export default function WeeklyCardItem({ data }: Props) {
  // [crew row placeholder 규칙]
  // - "대전 중" / "대전 집계" (leagueRecordStatus): 결과 미확정이라 실제 top crew 노출 금지 → 3행 placeholder.
  // - "공식 휴식" (leagueResultStatus): 주차 자체가 휴식 → 3행 placeholder.
  // - 그 외 상태에서도 data.top3 가 비어 있거나 3개 미만이면 부족한 slot 만 placeholder 로 채워
  //   crew list 영역이 빈칸으로 보이는 것을 방지(높이/3행 1열 구조 항상 유지).
  const shouldForceCrewPlaceholder =
    data.leagueRecordStatus === '대전 중' ||
    data.leagueRecordStatus === '대전 집계' ||
    data.leagueResultStatus === '공식 휴식';

  const crewRows: CrewRow[] = (() => {
    const ranks: Array<1 | 2 | 3> = [1, 2, 3];
    if (shouldForceCrewPlaceholder) {
      return ranks.map((rank) => buildPlaceholderRow(rank));
    }
    const source = Array.isArray(data.top3) ? data.top3 : [];
    return ranks.map((rank) => {
      const existing = source.find((crew) => crew?.rank === rank);
      return existing ?? buildPlaceholderRow(rank);
    });
  })();

  return (
    <Tilt
      tiltMaxAngleX={5}
      tiltMaxAngleY={5}
      transitionSpeed={400}
      className="col-12 col-md-6 col-xl-4"
    >
      <div className="badge__single weekly-card">
        <div className="weekly-card__header">
          <div className="weekly-card__title">
            {/* [상세 페이지 라우팅 자리] href/onClick 자리는 비워두고, 추후 상세 페이지 연결 시 추가. */}
            <button
              type="button"
              className="weekly-card__league-link"
              aria-label="Weekly League 상세 페이지 준비 중"
            >
              <span className="weekly-card__league-icon" aria-hidden="true">
                <i className="ti ti-trophy" />
              </span>
              <span>Weekly League</span>
            </button>
            {/* 첨부 cluster-4-card 의 2026 표시 문자열을 그대로 출력.
                연도/시즌명/주차명/기간 모두 재계산·재포맷·split 금지. */}
            <h4 className="weekly-card__season">
              {data.seasonName}
            </h4>
            <p className="weekly-card__date">
              {data.dateRangeText}
            </p>
          </div>
          <div className="weekly-card__status-panel">
            <span className={`weekly-card__status-badge ${getStatusTone(data.leagueResultStatus)}`}>
              <span className="icon-shift">
                <i className={STATUS_ICON_MAP[data.leagueResultStatus]}></i>
              </span>
              <span>{data.leagueResultStatus}</span>
            </span>
            <span className={`weekly-card__status-badge ${getStatusTone(data.leagueRecordStatus)}`}>
              <span className="icon-shift">
                <i className={STATUS_ICON_MAP[data.leagueRecordStatus]}></i>
              </span>
              <span>{data.leagueRecordStatus}</span>
            </span>
          </div>
        </div>

        <div className="weekly-card__thumb">
          {data.imageUrl ? (
            <Image
              src={data.imageUrl}
              alt={data.seasonName}
              width={280}
              height={180}
              className="weekly-card__thumb-image"
            />
          ) : (
            <div className="weekly-card__thumb-placeholder">
              <span>주차 이미지</span>
            </div>
          )}
        </div>

        <div className="resume-stats weekly-card__rates">
          <div className="stat-item">
            <div className="stat-row">
              <span className="stat-label"><span className="stat-dot">·</span> 성장 성공율</span>
              <div className="weekly-card__stat-meter">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${data.growthSuccessRate}%` }} />
                </div>
                <span className="stat-value">{data.growthSuccessRate}<span className="stat-unit">%</span></span>
              </div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-row">
              <span className="stat-label"><span className="stat-dot">·</span> 성장 도전율</span>
              <div className="weekly-card__stat-meter">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${data.growthChallengeRate}%` }} />
                </div>
                <span className="stat-value">{data.growthChallengeRate}<span className="stat-unit">%</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="resume-skills weekly-card__skills">
          <div className="skill-card">
            <Image src="/images/0/cluster4/icon/icon - cluv.png" alt="" width={34} height={34} className="skill-icon" />
            <div className="skill-num-row">
              <span className="skill-num">{data.totalCrews}</span>
              <span className="skill-unit">명</span>
            </div>
            <span className="skill-label">전체 크루</span>
          </div>

          <div className="skill-card">
            <Image src="/images/0/cluster4/icon/icon - 성장 (진행 중).png" alt="" width={34} height={34} className="skill-icon" />
            <div className="skill-num-row">
              <span className="skill-num">{data.growthChallenge}</span>
              <span className="skill-unit">명</span>
            </div>
            <span className="skill-label">성장 도전</span>
          </div>

          <div className="skill-card">
            <Image src="/images/0/cluster4/icon/icon - 성장(성공).png" alt="" width={34} height={34} className="skill-icon" />
            <div className="skill-num-row">
              <span className="skill-num">{data.growthSuccess}</span>
              <span className="skill-unit">명</span>
            </div>
            <span className="skill-label">성장 성공</span>
          </div>

          <div className="skill-card">
            <Image src="/images/0/cluster4/icon/icon - 성장(실패).png" alt="" width={34} height={34} className="skill-icon" />
            <div className="skill-num-row">
              <span className="skill-num">{data.growthFail}</span>
              <span className="skill-unit">명</span>
            </div>
            <span className="skill-label">성장 실패</span>
          </div>

          <div className="skill-card">
            <Image src="/images/0/cluster4/icon/icon - 휴식(개인).png" alt="" width={34} height={34} className="skill-icon" />
            <div className="skill-num-row">
              <span className="skill-num">{data.personalRest}</span>
              <span className="skill-unit">명</span>
            </div>
            <span className="skill-label">개인 휴식</span>
          </div>

          {(() => {
            // status badge "대전 중" / "대전 집계" 는 leagueRecordStatus 값.
            // (leagueResultStatus 는 '정상 진행' | '심화 진행' | '공식 휴식' 만 가질 수 있어 분기 대상 아님.)
            const isBattleActive =
              data.leagueRecordStatus === '대전 중' || data.leagueRecordStatus === '대전 집계';
            const battleLabel = data.leagueRecordStatus === '대전 중' ? '대전 중' : '집계 중';
            return (
              <div className="weekly-card__winner">
                {isBattleActive ? (
                  <img
                    className="weekly-card__winner-trophy weekly-card__winner-trophy--clock"
                    src="/images/0/clock.png"
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <img
                    className="weekly-card__winner-trophy"
                    src="/images/0/crown.png"
                    alt=""
                    aria-hidden="true"
                  />
                )}
                <span className="weekly-card__winner-label">
                  {isBattleActive ? battleLabel : '우승'}
                </span>
                {data.winningTeamImage && !isBattleActive ? (
                  <Image src={data.winningTeamImage} alt="우승 팀" width={80} height={80} className="weekly-card__winner-image" />
                ) : (
                  <div className="weekly-card__winner-placeholder" />
                )}
              </div>
            );
          })()}
        </div>

        <div className="weekly-card__top3">
          {crewRows.map((crew) => (
            <div key={crew.rank} className={`weekly-card__crew weekly-card__rank-row weekly-card__crew--rank${crew.rank}`}>
              <div className="weekly-card__crew-icon weekly-card__rank-badge">
                <Image
                  src={RANK_IMAGE_MAP[crew.rank] ?? RANK_IMAGE_MAP[1]}
                  alt={`${crew.rank}등`}
                  width={28}
                  height={28}
                  className="weekly-card__rank-image"
                />
              </div>
              <span className="weekly-card__rank-name">
                {crew.isPlaceholder ? PLACEHOLDER_TEXT : truncateName(crew.name)}
              </span>
              <span className="weekly-card__rank-separator" aria-hidden="true">|</span>
              <span className="weekly-card__rank-team">
                <span className="weekly-card__rank-team-text">
                  {crew.isPlaceholder ? PLACEHOLDER_TEXT : truncateLabel(stripSuffix(crew.team, '팀'))}
                </span>
                <span className="weekly-card__rank-team-suffix">팀</span>
              </span>
              <span className="weekly-card__rank-separator" aria-hidden="true">|</span>
              <span className="weekly-card__rank-part">
                <span className="weekly-card__rank-part-text">
                  {crew.isPlaceholder ? PLACEHOLDER_TEXT : truncateLabel(stripSuffix(crew.part, '파트'))}
                </span>
                <span className="weekly-card__rank-part-suffix">파트</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Tilt>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { RankingUser } from "./types";

interface RankingCardProps {
  user: RankingUser;
}

const RankingCard = ({ user }: RankingCardProps) => {
  // 1, 2, 3위에 대한 특별 스타일
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: "🥇", color: "#FFD700" };
    if (rank === 2) return { emoji: "🥈", color: "#C0C0C0" };
    if (rank === 3) return { emoji: "🥉", color: "#CD7F32" };
    return { emoji: "", color: "#666" };
  };

  const rankBadge = getRankBadge(user.rank);
  const defaultAvatar = "/images/streamer/t-two.png";

  return (
    <div className="leaderboard-item__single" style={{ padding: '16px 20px' }}>
      <div className="leaderboard-item__left" style={{ flex: 1 }}>
        <div className="meta-thumb">
          <Link
            href={`/cluster-4?userId=${user.user_id}`}
            aria-label={`${user.display_name}'s profile`}
            title={`${user.display_name}의 성장 기록 보기`}
          >
            <Image
              src={user.profile_photo_url || defaultAvatar}
              alt={`${user.display_name}'s avatar`}
              width={60}
              height={60}
              style={{ objectFit: 'cover' }}
            />
            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
            </svg>
            <span className="ratings" style={{ backgroundColor: rankBadge.color }}>
              {user.rank <= 3 ? rankBadge.emoji : user.rank.toString().padStart(2, "0")}
            </span>
          </Link>
        </div>
        <div className="meta-info">
          <p className="text-xl" style={{ marginBottom: '4px' }}>
            <Link href={`/cluster-4?userId=${user.user_id}`}>{user.display_name}</Link>
          </p>
          <p className="text-sm" style={{ color: '#888', marginBottom: '4px' }}>
            <span style={{ marginRight: '8px' }}>[{user.team_name}]</span>
            <span>{user.part_name}</span>
          </p>
          <p className="text-sm" style={{ color: '#666' }}>
            누적:
            <span style={{ color: '#f7931a', marginLeft: '4px' }}>⭐{user.total_stars}</span>
            <span style={{ color: '#ffeb3b', marginLeft: '6px' }}>⚡{user.total_lightnings}</span>
            <span style={{ color: '#4caf50', marginLeft: '6px' }}>🛡️{user.shields}</span>
          </p>
        </div>
      </div>
      <div className="leaderboard-item__right" style={{ textAlign: 'right', minWidth: '120px' }}>
        <p className="text-xxl fw-6" style={{ color: '#f7931a', marginBottom: '4px' }}>
          ⭐ {user.stars}
        </p>
        <p className="text-sm" style={{ color: '#888' }}>
          <span style={{ color: '#ffeb3b' }}>⚡{user.lightnings}</span>
          <span style={{ color: '#4caf50', marginLeft: '8px' }}>🛡️{user.shields}</span>
        </p>
      </div>
    </div>
  );
};

export default RankingCard;

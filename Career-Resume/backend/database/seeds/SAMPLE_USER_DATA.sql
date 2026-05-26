-- 김크루 (fade949c-faf1-44c6-a3f1-ccd98a89bc60) 샘플 데이터

-- 1. user_reliability_rates 추가
INSERT INTO user_reliability_rates (user_id, reliability_rate)
VALUES ('fade949c-faf1-44c6-a3f1-ccd98a89bc60', 95)
ON CONFLICT (user_id) DO UPDATE SET reliability_rate = 95;

-- 2. user_cumulative_points 추가
INSERT INTO user_cumulative_points (user_id, total_stars, total_shields, total_lightnings)
VALUES ('fade949c-faf1-44c6-a3f1-ccd98a89bc60', 245, 38, 12)
ON CONFLICT (user_id) DO UPDATE SET
  total_stars = 245,
  total_shields = 38,
  total_lightnings = 12;

-- 3. user_cumulative_compliance_rates 추가
INSERT INTO user_cumulative_compliance_rates (
  user_id,
  practical_info_participated,
  practical_competency_participated,
  practical_experience_participated,
  practical_career_participated
)
VALUES ('fade949c-faf1-44c6-a3f1-ccd98a89bc60', 28, 15, 22, 8)
ON CONFLICT (user_id) DO UPDATE SET
  practical_info_participated = 28,
  practical_competency_participated = 15,
  practical_experience_participated = 22,
  practical_career_participated = 8;

-- 4. user_season_histories - 기존 데이터 삭제 후 재생성
DELETE FROM user_season_histories WHERE user_id = 'fade949c-faf1-44c6-a3f1-ccd98a89bc60';

-- 2025 봄 시즌
INSERT INTO user_season_histories (
  user_id, season_id, role_in_season, approved_weeks, total_weeks,
  progress_status, review_status, review_completion_date
)
SELECT
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60',
  id,
  'crew_advanced_agent',
  16,
  16,
  'completed',
  'approved',
  '2025-07-06'
FROM seasons WHERE year = '2025' AND name = 'spring';

-- 2025 여름 시즌
INSERT INTO user_season_histories (
  user_id, season_id, role_in_season, approved_weeks, total_weeks,
  progress_status, review_status, review_completion_date
)
SELECT
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60',
  id,
  'crew_advanced_agent',
  8,
  8,
  'completed',
  'approved',
  '2025-09-07'
FROM seasons WHERE year = '2025' AND name = 'summer';

-- 2025 가을 시즌
INSERT INTO user_season_histories (
  user_id, season_id, role_in_season, approved_weeks, total_weeks,
  progress_status, review_status, review_completion_date
)
SELECT
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60',
  id,
  'admin_team_leader',
  12,
  16,
  'in_progress',
  'reviewing',
  '2026-01-04'
FROM seasons WHERE year = '2025' AND name = 'fall';

-- 2026 겨울 시즌
INSERT INTO user_season_histories (
  user_id, season_id, role_in_season, approved_weeks, total_weeks,
  progress_status, review_status, review_completion_date
)
SELECT
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60',
  id,
  'admin_team_leader',
  5,
  8,
  'in_progress',
  'reviewing',
  '2026-03-08'
FROM seasons WHERE year = '2026' AND name = 'winter';

-- 2026 봄 시즌
INSERT INTO user_season_histories (
  user_id, season_id, role_in_season, approved_weeks, total_weeks,
  progress_status, review_status, review_completion_date
)
SELECT
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60',
  id,
  'admin_ambassador',
  8,
  16,
  'in_progress',
  'reviewing',
  '2026-07-05'
FROM seasons WHERE year = '2026' AND name = 'spring';

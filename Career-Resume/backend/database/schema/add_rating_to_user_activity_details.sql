-- =============================================
-- user_activity_details.rating 컬럼 추가
-- Work Exp 라인 평점 (0~10, NULL = 미입력)
-- Source of Truth 전환: points(point_type='star') → user_activity_details.rating
-- 사용자가 직접 입력/수정하는 self-edit 항목.
-- =============================================

ALTER TABLE user_activity_details
  ADD COLUMN IF NOT EXISTS rating SMALLINT NULL;

ALTER TABLE user_activity_details
  DROP CONSTRAINT IF EXISTS user_activity_details_rating_range;

ALTER TABLE user_activity_details
  ADD CONSTRAINT user_activity_details_rating_range
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10));

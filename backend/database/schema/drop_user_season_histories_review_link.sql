-- =====================================================================
-- user_season_histories.review_link 컬럼 삭제
-- 시즌 리뷰에서 링크 입력 기능이 제거됨에 따라 컬럼도 정리
-- =====================================================================

ALTER TABLE public.user_season_histories
  DROP COLUMN IF EXISTS review_link;
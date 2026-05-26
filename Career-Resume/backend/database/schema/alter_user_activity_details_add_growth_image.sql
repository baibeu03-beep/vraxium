-- =============================================
-- user_activity_details 확장: growth_point / image_urls / image_captions 컬럼 추가
-- cluster-4-card 모달에서 사용하는 추가 2차 정보 필드
-- =============================================

ALTER TABLE user_activity_details
  ADD COLUMN IF NOT EXISTS growth_point TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS image_captions TEXT[] DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN user_activity_details.growth_point IS '성장 포인트 텍스트 (자유 서술, 권장 500자)';
COMMENT ON COLUMN user_activity_details.image_urls IS '이미지 영구 URL 배열 (Supabase Storage), 최대 4개';
COMMENT ON COLUMN user_activity_details.image_captions IS '각 이미지 캡션 배열 (image_urls와 인덱스 정렬), 최대 4개';
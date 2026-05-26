-- =============================================
-- cluster-2 Adventure With Us: 사진 6장 업로드 지원
-- user_introductions 테이블에 sub_photo_5 컬럼 추가
--
-- 매핑:
--   사진[1] → user_profiles.profile_photo_url (Sidebar Identity-Core)
--   사진[2] → user_introductions.sub_photo_5 (cluster-2 중앙 큰 사진) ← NEW
--   사진[3] → user_introductions.sub_photo_1 (육각형: Joy)
--   사진[4] → user_introductions.sub_photo_2 (육각형: Blue)
--   사진[5] → user_introductions.sub_photo_3 (육각형: Passion)
--   사진[6] → user_introductions.sub_photo_4 (육각형: Moments)
--
-- 실행 위치: Supabase SQL Editor
-- =============================================

-- 1) 컬럼 추가
ALTER TABLE user_introductions
  ADD COLUMN IF NOT EXISTS sub_photo_5 TEXT;

-- 2) 기존 사용자 백필: cluster-2 중앙 사진이 이전엔 profile_photo_url과 동일했으므로
--    sub_photo_5가 NULL이면 현재 profile_photo_url 값을 복사해 기존 표시를 유지
UPDATE user_introductions ui
SET sub_photo_5 = up.profile_photo_url
FROM user_profiles up
WHERE ui.user_id = up.id
  AND ui.sub_photo_5 IS NULL
  AND up.profile_photo_url IS NOT NULL;

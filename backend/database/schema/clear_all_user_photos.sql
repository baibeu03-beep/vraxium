-- =============================================
-- 기존 크루 프로필 사진 전체 삭제
-- (이전 테스트 시드 데이터 정리 — INSERT_RANDOM_PROFILE_IMAGES.sql 등)
--
-- 영향 범위:
--   user_profiles.profile_photo_url  → Sidebar 사진
--   user_introductions.sub_photo_1..5 → cluster-2 Adventure With Us 5장
--
-- 삭제 후: 모든 유저가 /images/0/1~6.png 기본값으로 표시됨
-- 실행 위치: Supabase SQL Editor
-- =============================================

-- 1) Sidebar 사진 초기화
UPDATE user_profiles
SET profile_photo_url = NULL,
    updated_at = NOW()
WHERE profile_photo_url IS NOT NULL;

-- 2) cluster-2 서브 사진(4개 육각형 + 중앙 큰 사진) 초기화
UPDATE user_introductions
SET sub_photo_1 = NULL,
    sub_photo_2 = NULL,
    sub_photo_3 = NULL,
    sub_photo_4 = NULL,
    sub_photo_5 = NULL,
    updated_at = NOW()
WHERE sub_photo_1 IS NOT NULL
   OR sub_photo_2 IS NOT NULL
   OR sub_photo_3 IS NOT NULL
   OR sub_photo_4 IS NOT NULL
   OR sub_photo_5 IS NOT NULL;

-- 3) 확인 쿼리 (SELECT — 선택 실행)
-- SELECT COUNT(*) FILTER (WHERE profile_photo_url IS NOT NULL) AS sidebar_remaining
-- FROM user_profiles;
--
-- SELECT COUNT(*) FILTER (
--   WHERE sub_photo_1 IS NOT NULL OR sub_photo_2 IS NOT NULL
--      OR sub_photo_3 IS NOT NULL OR sub_photo_4 IS NOT NULL
--      OR sub_photo_5 IS NOT NULL
-- ) AS cluster2_remaining
-- FROM user_introductions;

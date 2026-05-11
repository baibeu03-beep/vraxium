-- =============================================
-- 윤재윤 크루 프로필 사진 전체 초기화
--
-- 영향 범위 (윤재윤 크루 한정):
--   user_profiles.profile_photo_url         → Sidebar 사진 (사진[1])
--   user_introductions.sub_photo_5          → cluster-2 중앙 메인 사진 (사진[2])
--   user_introductions.sub_photo_1..4       → cluster-2 육각형 4장 (사진[3~6])
--
-- 실행 위치: Supabase SQL Editor
-- 실행 후: 윤재윤 크루는 모든 슬롯이 NULL → /crews 리스트 포함 전체에서 기본 이미지로 표시
-- =============================================

-- 0) 대상 유저 확인 (실행 전 검증 — 꼭 1명인지 확인)
SELECT id, display_name, email, profile_photo_url
FROM user_profiles
WHERE display_name = '윤재윤';

-- 1) Sidebar 사진 초기화
UPDATE user_profiles
SET profile_photo_url = NULL,
    updated_at = NOW()
WHERE display_name = '윤재윤';

-- 2) cluster-2 중앙 + 육각형 사진 5장 초기화
UPDATE user_introductions
SET sub_photo_1 = NULL,
    sub_photo_2 = NULL,
    sub_photo_3 = NULL,
    sub_photo_4 = NULL,
    sub_photo_5 = NULL,
    updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM user_profiles WHERE display_name = '윤재윤'
);

-- 3) 초기화 결과 확인
SELECT
  p.display_name,
  p.profile_photo_url                 AS sidebar_photo,
  i.sub_photo_5                       AS main_photo,
  i.sub_photo_1, i.sub_photo_2, i.sub_photo_3, i.sub_photo_4
FROM user_profiles p
LEFT JOIN user_introductions i ON i.user_id = p.id
WHERE p.display_name = '윤재윤';

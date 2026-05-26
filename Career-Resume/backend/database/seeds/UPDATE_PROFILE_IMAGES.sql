-- 10명의 유저에게 프로필 이미지 URL 업데이트
-- Supabase Storage URL 형식: https://PROJECT_ID.supabase.co/storage/v1/object/public/BUCKET_NAME/FILE_NAME

-- 방법 1: 로컬 이미지 사용 (임시)
UPDATE user_profiles
SET profile_photo_url = '/images/0/iZKpm7I6mM-X1RCe8whJEe_K4L1q7r24whHrO5pK6vLZ1ivZs-sMvk3r35n6xbZ5P3Y8updzx8RXuoYL_5-GCQ.webp',
    updated_at = NOW()
WHERE id IN (
  'f8f68127-7241-45cd-9732-bbddf822043f', -- 김공남
  'fade949c-faf1-44c6-a3f1-ccd98a89bc60', -- 김크루
  '58c4539f-5392-464f-9121-edf3d4a00573', -- 신짱구
  'fd22c0c7-f03e-4eb1-b83e-01d0b461b1d9', -- 썹웨이
  '1919d76d-33f8-45ae-b0a0-8339125cfb28', -- 김일남
  '054bd63d-d6b4-434c-a40d-06521b9c2a95', -- 김팔녀
  '575ba5af-f206-4fe5-ace3-1aad7cf096f7', -- 김이남
  'f70a60e8-6af3-4676-a3b7-c965463b6b14', -- 김삼남
  '4302ebf4-801b-4a7f-bc62-310626dab7bc', -- 김사남
  'a802585a-e172-4e29-a196-6aa448ae3947'  -- 김오남
);

-- 방법 2: Supabase Storage 사용 (이미지 업로드 후)
-- 각 유저별로 다른 이미지를 설정하려면:

-- 김공남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user1.jpg',
    updated_at = NOW()
WHERE id = 'f8f68127-7241-45cd-9732-bbddf822043f';

-- 김크루
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user2.jpg',
    updated_at = NOW()
WHERE id = 'fade949c-faf1-44c6-a3f1-ccd98a89bc60';

-- 신짱구
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user3.jpg',
    updated_at = NOW()
WHERE id = '58c4539f-5392-464f-9121-edf3d4a00573';

-- 썹웨이
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user4.jpg',
    updated_at = NOW()
WHERE id = 'fd22c0c7-f03e-4eb1-b83e-01d0b461b1d9';

-- 김일남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user5.jpg',
    updated_at = NOW()
WHERE id = '1919d76d-33f8-45ae-b0a0-8339125cfb28';

-- 김팔녀
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user6.jpg',
    updated_at = NOW()
WHERE id = '054bd63d-d6b4-434c-a40d-06521b9c2a95';

-- 김이남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user7.jpg',
    updated_at = NOW()
WHERE id = '575ba5af-f206-4fe5-ace3-1aad7cf096f7';

-- 김삼남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user8.jpg',
    updated_at = NOW()
WHERE id = 'f70a60e8-6af3-4676-a3b7-c965463b6b14';

-- 김사남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user9.jpg',
    updated_at = NOW()
WHERE id = '4302ebf4-801b-4a7f-bc62-310626dab7bc';

-- 김오남
UPDATE user_profiles
SET profile_photo_url = 'https://otaoevvpavpkohdkmtre.supabase.co/storage/v1/object/public/profile_photo_url/user10.jpg',
    updated_at = NOW()
WHERE id = 'a802585a-e172-4e29-a196-6aa448ae3947';

-- 확인 쿼리
SELECT id, display_name, profile_photo_url
FROM user_profiles
WHERE profile_photo_url IS NOT NULL
ORDER BY display_name
LIMIT 10;
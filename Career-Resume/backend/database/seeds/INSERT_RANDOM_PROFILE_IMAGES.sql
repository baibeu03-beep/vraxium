-- 모든 유저에게 랜덤 프로필 이미지 할당 (pack-avatar 폴더 사용)

-- 김팔녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/one.png',
    updated_at = NOW()
WHERE id = '054bd63d-d6b4-434c-a40d-06521b9c2a95';

-- 김칠남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/two.png',
    updated_at = NOW()
WHERE id = '08427126-2eb2-4172-9ab0-e1081381d098';

-- 김육녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/three.png',
    updated_at = NOW()
WHERE id = '0cf463ae-e841-4ee5-8ec1-5f44860ac340';

-- 김일녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/four.png',
    updated_at = NOW()
WHERE id = '15bc0966-fafd-4836-9591-47f65bf0c1d4';

-- 김구남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/five.png',
    updated_at = NOW()
WHERE id = '18f78b38-7825-4ebf-862c-8c4d10e8e7ac';

-- 김일남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/six.png',
    updated_at = NOW()
WHERE id = '1919d76d-33f8-45ae-b0a0-8339125cfb28';

-- 장커피
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/seven.png',
    updated_at = NOW()
WHERE id = '22329c8e-eb69-433e-aa7c-925bd9e00e2e';

-- 김삼녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/eight.png',
    updated_at = NOW()
WHERE id = '35ce465f-5e91-4c1f-86fb-86e8b1f5b7cd';

-- Admin 2
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/nine.png',
    updated_at = NOW()
WHERE id = '3db5cda1-cc1e-4886-85af-f1f4ea578a56';

-- 김사남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/ten.png',
    updated_at = NOW()
WHERE id = '4302ebf4-801b-4a7f-bc62-310626dab7bc';

-- 김육남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/eleven.png',
    updated_at = NOW()
WHERE id = '55332495-bedd-4e2c-ab8d-610a57ab44e3';

-- 김이남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/one.png',
    updated_at = NOW()
WHERE id = '575ba5af-f206-4fe5-ace3-1aad7cf096f7';

-- 신짱구
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/two.png',
    updated_at = NOW()
WHERE id = '58c4539f-5392-464f-9121-edf3d4a00573';

-- 김오녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/three.png',
    updated_at = NOW()
WHERE id = '5b11c0cc-7ad4-48ec-99e5-826c6acf95df';

-- 김공녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/four.png',
    updated_at = NOW()
WHERE id = '5f335228-d827-4a2f-9044-2410fe92d166';

-- 김팔남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/five.png',
    updated_at = NOW()
WHERE id = '8006cf97-1abc-4449-a6f5-662c66df6ae0';

-- Admin 3
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/six.png',
    updated_at = NOW()
WHERE id = '8fb656a3-be6a-469f-bdfe-1b779200c795';

-- 김이녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/seven.png',
    updated_at = NOW()
WHERE id = '995cbc86-c625-4bbf-b3ed-1a493cae95d1';

-- Admin 1
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/eight.png',
    updated_at = NOW()
WHERE id = '9ccae547-79be-414e-b726-a6d78aee3126';

-- 김사녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/nine.png',
    updated_at = NOW()
WHERE id = 'a54c0e9c-82f2-42ca-a38b-0a6863cc0987';

-- 김오남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/ten.png',
    updated_at = NOW()
WHERE id = 'a802585a-e172-4e29-a196-6aa448ae3947';

-- Admin 4
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/eleven.png',
    updated_at = NOW()
WHERE id = 'a82a6b56-338d-4f87-99fc-b26b5377414c';

-- 김구녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/one.png',
    updated_at = NOW()
WHERE id = 'aa06779c-9c05-49da-990e-9e1664fdad2f';

-- 김칠녀
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/two.png',
    updated_at = NOW()
WHERE id = 'b8bdb797-9c87-4646-b60f-bf26d422d64c';

-- 김삼남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/three.png',
    updated_at = NOW()
WHERE id = 'f70a60e8-6af3-4676-a3b7-c965463b6b14';

-- 김공남
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/four.png',
    updated_at = NOW()
WHERE id = 'f8f68127-7241-45cd-9732-bbddf822043f';

-- 김크루
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/five.png',
    updated_at = NOW()
WHERE id = 'fade949c-faf1-44c6-a3f1-ccd98a89bc60';

-- 썹웨이
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/six.png',
    updated_at = NOW()
WHERE id = 'fd22c0c7-f03e-4eb1-b83e-01d0b461b1d9';

-- Admin 5
UPDATE user_profiles
SET profile_photo_url = '/images/pack-avatar/seven.png',
    updated_at = NOW()
WHERE id = 'ff77ba2e-1a24-49bc-859e-d4b66568828c';

-- 확인
SELECT id, display_name, profile_photo_url
FROM user_profiles
ORDER BY display_name;
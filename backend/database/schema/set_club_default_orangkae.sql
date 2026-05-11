-- user_profiles.club 컬럼의 DEFAULT 를 '오랑캐'로 설정.
-- 현재는 오랑캐 클럽만 운영중이라 신규 가입 시 값이 없으면 자동으로 '오랑캐'가 들어가도록.
-- 추후 엥크레/팔랑크스 클럽 합류 시 이 DEFAULT 를 수정/제거.
ALTER TABLE user_profiles ALTER COLUMN club SET DEFAULT '오랑캐';

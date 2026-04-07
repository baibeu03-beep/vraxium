-- user_reliability_rates 테이블의 외래 키를 user_profiles를 직접 참조하도록 변경

-- 기존 FK 제약 조건 삭제
ALTER TABLE user_reliability_rates
  DROP CONSTRAINT IF EXISTS user_reliability_rates_user_id_fkey;

-- 새로운 FK 제약 조건 추가: user_profiles를 직접 참조
ALTER TABLE user_reliability_rates
  ADD CONSTRAINT user_reliability_rates_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES user_profiles(id)
    ON DELETE CASCADE;

-- 변경 확인
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'user_reliability_rates';
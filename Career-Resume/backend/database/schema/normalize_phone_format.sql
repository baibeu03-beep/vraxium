-- =============================================================================
-- 전화번호 형식 정규화: user_profiles.phone
-- =============================================================================
-- 목적:
--   다양한 형식(하이픈 유무, 공백, 별표 마스킹 흔적 등)으로 저장된 전화번호를
--   표준 형식으로 통일하여 마스킹/표시 로직이 안정적으로 동작하도록 한다.
--
-- 변환 규칙 (숫자만 추출 후 길이 기준):
--   - 11자리: XXX-XXXX-XXXX  (예: 01012345678 → 010-1234-5678)
--   - 10자리: XXX-XXX-XXXX   (예: 0212345678  → 021-234-5678)
--   - NULL / 빈 문자열: 변경 없음
--   - 그 외(인식 불가): 변경 없음 (데이터 보존)
--
-- 멱등(idempotent): 이미 정규화된 행은 다시 실행해도 변경되지 않음.
--
-- 실행 순서:
--   1) STEP 1 (SELECT) — 변경될 행을 먼저 확인
--   2) STEP 2 (UPDATE) — 실제 정규화 적용
-- =============================================================================


-- =============================================================================
-- STEP 1: 미리보기 — 변경 대상 행만 표시
-- =============================================================================
SELECT
  id,
  display_name,
  phone AS old_phone,
  CASE
    WHEN phone IS NULL OR phone = '' THEN phone
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3')
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3')
    ELSE phone
  END AS new_phone,
  length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) AS digit_count
FROM user_profiles
WHERE phone IS NOT NULL
  AND phone <> ''
  AND phone <> CASE
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3')
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3')
    ELSE phone
  END
ORDER BY display_name NULLS LAST;


-- =============================================================================
-- STEP 2: 실제 정규화 적용
-- =============================================================================
-- STEP 1 결과 확인 후 아래 UPDATE 실행
UPDATE user_profiles
SET phone = CASE
  WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
    THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                        '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3')
  WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
    THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                        '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3')
  ELSE phone
END
WHERE phone IS NOT NULL
  AND phone <> ''
  AND phone <> CASE
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3')
    WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
      THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'),
                          '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3')
    ELSE phone
  END;


-- =============================================================================
-- (선택) STEP 3: 정규화 후 잔여 비표준 행 점검
-- =============================================================================
-- 자릿수가 10/11이 아닌 값이 남아있는지 확인 (수동 점검 필요한 데이터)
SELECT id, display_name, phone, length(regexp_replace(phone, '[^0-9]', '', 'g')) AS digit_count
FROM user_profiles
WHERE phone IS NOT NULL
  AND phone <> ''
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) NOT IN (10, 11)
ORDER BY display_name NULLS LAST;

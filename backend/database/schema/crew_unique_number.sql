-- =====================================================================
-- 크루 고유 번호 (crew_unique_number)
-- 형식: YYMM(시작시기) YY(생년) G(성별 3=남/4=여/0=기타) - NNNNNN(순번 11~)
-- 예: 2603023-000777
-- 규칙: 순번 1-10은 가상 데이터용으로 예약, 실제 크루는 11부터
-- =====================================================================

-- ========== 0) 사전 컬럼/시퀀스 (이미 적용됨, 참고용) ==========
-- ALTER TABLE user_profiles
--   ADD COLUMN IF NOT EXISTS crew_serial        INTEGER UNIQUE,
--   ADD COLUMN IF NOT EXISTS crew_unique_number TEXT;
-- CREATE SEQUENCE IF NOT EXISTS crew_serial_seq START 11;

-- ========== 1) 기존 크루 backfill: created_at ASC 순서로 11부터 ==========
WITH ordered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) + 10) AS rn
  FROM user_profiles
  WHERE crew_serial IS NULL
)
UPDATE user_profiles up
SET crew_serial = ordered.rn
FROM ordered
WHERE up.id = ordered.id;

-- 시퀀스를 backfill 후 max+1 로 점프시켜 다음 INSERT가 연속되게 함
SELECT setval('crew_serial_seq', COALESCE((SELECT MAX(crew_serial) FROM user_profiles), 10), true);

-- ========== 2) 기존 크루 crew_unique_number backfill ==========
-- 2-a. joined_week_id가 있는 경우: weeks.start_date 의 YYMM 사용
UPDATE user_profiles up
SET crew_unique_number = (
  TO_CHAR(w.start_date, 'YYMM')
  || COALESCE(TO_CHAR(up.birth_date, 'YY'), '00')
  || CASE up.gender WHEN '남' THEN '3' WHEN '여' THEN '4' ELSE '0' END
  || '-'
  || LPAD(up.crew_serial::text, 6, '0')
)
FROM weeks w
WHERE up.joined_week_id = w.id
  AND up.crew_serial IS NOT NULL
  AND up.crew_unique_number IS NULL;

-- 2-b. joined_week_id가 없는 경우: created_at 폴백
UPDATE user_profiles up
SET crew_unique_number = (
  TO_CHAR(COALESCE(up.created_at, now()), 'YYMM')
  || COALESCE(TO_CHAR(up.birth_date, 'YY'), '00')
  || CASE up.gender WHEN '남' THEN '3' WHEN '여' THEN '4' ELSE '0' END
  || '-'
  || LPAD(up.crew_serial::text, 6, '0')
)
WHERE up.joined_week_id IS NULL
  AND up.crew_serial IS NOT NULL
  AND up.crew_unique_number IS NULL;

-- ========== 3) 신규 INSERT 시 자동 부여 트리거 ==========
-- 한 번 부여된 crew_unique_number 는 변경되지 않음(UPDATE 트리거 없음 — 의도)
CREATE OR REPLACE FUNCTION assign_crew_unique_number()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date timestamptz;
  v_yymm text;
  v_yy   text;
  v_g    text;
BEGIN
  -- 순번 자동 부여
  IF NEW.crew_serial IS NULL THEN
    NEW.crew_serial := nextval('crew_serial_seq');
  END IF;

  -- 시작시기: joined_week_id → weeks.start_date, 없으면 created_at, 그것도 없으면 now()
  IF NEW.joined_week_id IS NOT NULL THEN
    SELECT start_date INTO v_start_date FROM weeks WHERE id = NEW.joined_week_id;
  END IF;
  v_yymm := TO_CHAR(COALESCE(v_start_date, NEW.created_at, now()), 'YYMM');

  -- 생년
  v_yy := COALESCE(TO_CHAR(NEW.birth_date, 'YY'), '00');

  -- 성별
  v_g := CASE NEW.gender WHEN '남' THEN '3' WHEN '여' THEN '4' ELSE '0' END;

  -- 합성 (이미 값이 있으면 보존)
  IF NEW.crew_unique_number IS NULL THEN
    NEW.crew_unique_number := v_yymm || v_yy || v_g || '-' || LPAD(NEW.crew_serial::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_crew_unique_number ON user_profiles;
CREATE TRIGGER trg_assign_crew_unique_number
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION assign_crew_unique_number();

-- ========== 4) 검증 쿼리 (실행 후 결과 확인용) ==========
-- SELECT crew_serial, crew_unique_number, display_name, gender, birth_date, joined_week_id, created_at
-- FROM user_profiles
-- ORDER BY crew_serial ASC NULLS LAST
-- LIMIT 30;
--
-- SELECT COUNT(*) total, COUNT(crew_unique_number) assigned, COUNT(*) - COUNT(crew_unique_number) missing
-- FROM user_profiles;
-- season_reputations 테이블에 keyword_3 컬럼 추가 + keyword 컬럼 길이 확장
-- 사유:
--   1) 시즌 평판 키워드 정책이 2개 → 3개로 변경됨 (origin/Tuna 머지)
--      API(app/api/season-reputations/route.ts)는 keyword_3 를 INSERT/SELECT 하지만
--      실제 DB 컬럼이 없어서 모든 GET/POST 가 500 으로 실패.
--   2) keyword_1/keyword_2 가 varchar(7) 로 정의돼 있는데 API 검증은 10자까지
--      허용하고, 실제 키워드("AI 프롬프트", "시스템 구축력" 등)도 7자를 초과해서
--      INSERT 시 'value too long for type character varying(7)' (22001) 발생.

ALTER TABLE season_reputations
  ADD COLUMN IF NOT EXISTS keyword_3 text;

ALTER TABLE season_reputations
  ALTER COLUMN keyword_1 TYPE text,
  ALTER COLUMN keyword_2 TYPE text;
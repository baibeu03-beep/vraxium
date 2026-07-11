-- =============================================
-- portfolio_channel_cards 확장: top_metric_name / top_metric_value 컬럼 추가
--
-- cluster-3 채널 카드 모달의 신규 입력 항목 "TOP 지표" (카드 대표 지표 1쌍).
-- 카드 [6] 인덱스명/인덱스값 영역에 표시된다. 기존 metrics(출력지표 서술)
-- 와는 의미가 다른 독립 필드이므로 별도 컬럼으로 둔다.
--
-- 기존 행은 모두 NULL 로 남는다 (기본값 채우지 않음).
-- 값 길이 제한(각 5자)은 API/UI validation 에서 담당 — DB 는 원문 보존.
--
-- 실행 위치: Supabase SQL Editor
-- =============================================

ALTER TABLE portfolio_channel_cards
  ADD COLUMN IF NOT EXISTS top_metric_name TEXT,
  ADD COLUMN IF NOT EXISTS top_metric_value TEXT;

COMMENT ON COLUMN portfolio_channel_cards.top_metric_name IS 'TOP 지표명 (카드 대표 지표 라벨, 예: 조회수) — UI/API 에서 5자 제한, 공백만이면 NULL 정규화';
COMMENT ON COLUMN portfolio_channel_cards.top_metric_value IS 'TOP 지표값 (카드 대표 지표 수치, 예: 24만) — UI/API 에서 5자 제한, 공백만이면 NULL 정규화';

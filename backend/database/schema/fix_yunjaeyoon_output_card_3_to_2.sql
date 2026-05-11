-- =============================================
-- 일회성 데이터 정정: 윤재윤 크루 Output 카드 3 → 카드 2 이동
-- 잠금 로직 적용 전 카드 2를 비워둔 채 카드 3을 작성한 상태였음.
-- 순차 강제(B 정책) 적용 후 카드 3이 잠겨버려, 데이터 보존 위해 카드 2로 옮김.
--
-- 실행 위치: Supabase SQL Editor
-- =============================================

UPDATE portfolio_top_cards
SET card_index = 2
WHERE user_id = '11a3b954-dff0-46fb-99ec-5c459a1d2600'
  AND card_type = 'output'
  AND card_index = 3;

-- 확인
-- SELECT card_index, main_title FROM portfolio_top_cards
-- WHERE user_id = '11a3b954-dff0-46fb-99ec-5c459a1d2600' AND card_type = 'output'
-- ORDER BY card_index;

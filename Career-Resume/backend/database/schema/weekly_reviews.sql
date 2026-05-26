-- =====================================================================
-- weekly_reviews
-- 주차별 본인 회고(주차 리뷰)
-- 한 유저가 하나의 week_card_id에 대해 단 1개의 리뷰만 보유
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  week_card_id  uuid NOT NULL,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 10),
  content       text    NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reviews_user_week_unique UNIQUE (user_id, week_card_id)
);

CREATE INDEX IF NOT EXISTS weekly_reviews_user_id_idx
  ON public.weekly_reviews (user_id);

CREATE INDEX IF NOT EXISTS weekly_reviews_week_card_id_idx
  ON public.weekly_reviews (week_card_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_weekly_reviews_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_reviews_updated_at ON public.weekly_reviews;
CREATE TRIGGER trg_weekly_reviews_updated_at
  BEFORE UPDATE ON public.weekly_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_weekly_reviews_updated_at();
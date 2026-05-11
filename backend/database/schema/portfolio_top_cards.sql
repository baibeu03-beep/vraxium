-- =============================================
-- cluster-3 World Of Top Works: Output Top 5 + Detail 10 통합 저장
-- 두 모달이 OutputCard 타입/검증 함수를 100% 공유하므로 한 테이블로 일원화.
-- card_type 디스크리미네이터로 'output'(1~5) vs 'detail'(1~10) 구분.
--
-- 실행 위치: Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS portfolio_top_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('output', 'detail')),
  card_index SMALLINT NOT NULL,

  -- 텍스트 본문
  main_title TEXT,
  sub_title TEXT,
  role_description TEXT,
  report TEXT,
  insight TEXT,

  -- 채널/플랫폼
  platform TEXT,             -- PLATFORM_ICONS의 한국어 키 ('유튜브' 등)

  -- 기여도 (0~100, %)
  contribution SMALLINT,

  -- 활동 기간 (UI가 분리 입력)
  period_start_year SMALLINT,
  period_start_month SMALLINT,
  period_start_day SMALLINT,
  period_end_year SMALLINT,
  period_end_month SMALLINT,
  period_end_day SMALLINT,

  -- 역할 / 도구 (코드 키 배열)
  roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  tools TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- 이미지: main 1장 + sub 2장 (Supabase Storage public URL)
  main_image_url TEXT,
  sub_image_urls TEXT[] DEFAULT ARRAY[NULL, NULL]::TEXT[],

  -- 캡션: main 1 + sub 2 (각 최대 20자)
  main_image_caption TEXT,
  sub_image_captions TEXT[] DEFAULT ARRAY['', '']::TEXT[],

  -- 정량 지표 (label, value) × 3 — 평탄화한 6칸
  metrics TEXT[] DEFAULT ARRAY['', '', '', '', '', '']::TEXT[],

  -- 외부 링크 최대 3개
  links TEXT[] DEFAULT ARRAY['', '', '']::TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 같은 유저 + 같은 타입 + 같은 인덱스는 1행
  UNIQUE(user_id, card_type, card_index),

  -- 인덱스 범위 검증 (output 1~5, detail 1~10)
  CHECK (
    (card_type = 'output' AND card_index BETWEEN 1 AND 5)
    OR
    (card_type = 'detail' AND card_index BETWEEN 1 AND 10)
  )
);

CREATE INDEX IF NOT EXISTS idx_portfolio_top_cards_user_type
  ON portfolio_top_cards(user_id, card_type);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_portfolio_top_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_portfolio_top_cards_updated_at
  ON portfolio_top_cards;

CREATE TRIGGER trigger_update_portfolio_top_cards_updated_at
  BEFORE UPDATE ON portfolio_top_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_top_cards_updated_at();

-- RLS (API는 service role을 쓰므로 우회됨, 안전장치로 enable)
ALTER TABLE portfolio_top_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "top cards: read all" ON portfolio_top_cards;
CREATE POLICY "top cards: read all"
  ON portfolio_top_cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "top cards: own write" ON portfolio_top_cards;
CREATE POLICY "top cards: own write"
  ON portfolio_top_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Storage 버킷: portfolio-top-images (public read)
-- 경로 컨벤션: {userId}/{output|detail}-{N}/{main|sub-0|sub-1}_{ts}.{ext}
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-top-images', 'portfolio-top-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "top images: public read" ON storage.objects;
CREATE POLICY "top images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio-top-images');

DROP POLICY IF EXISTS "top images: own write" ON storage.objects;
CREATE POLICY "top images: own write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-top-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "top images: own update" ON storage.objects;
CREATE POLICY "top images: own update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'portfolio-top-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "top images: own delete" ON storage.objects;
CREATE POLICY "top images: own delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio-top-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

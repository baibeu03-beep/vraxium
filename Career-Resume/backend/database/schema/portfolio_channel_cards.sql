-- =============================================
-- cluster-3 포트폴리오 아카이빙 Channel: 카드별 전체 데이터 저장
-- 기존 user_introductions.portfolio_archive_1..10 (링크 only) → 신규 테이블로 일원화
--
-- 카드 1~16 슬롯 × (channel_name / platform / management / start_date /
-- rating / status / link / images[5] / insight / experience / metrics)
--
-- 실행 위치: Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS portfolio_channel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관계 키
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  card_index SMALLINT NOT NULL CHECK (card_index BETWEEN 1 AND 16),

  -- 채널 메타
  channel_name TEXT,
  platform TEXT,           -- '유튜브', '인스타그램', ...
  management TEXT,         -- '개인 소유 관리', '팀 소속 협업', '기타 진행'
  start_year TEXT,         -- 'YYYY' (UI가 분리 입력하므로 텍스트로 보존)
  start_month TEXT,        -- 'MM'
  start_day TEXT,          -- 'DD'
  rating TEXT,             -- '1' ~ '10' (문자열 통일, UI 호환)
  status TEXT,             -- '운영 중', '운영 중단', '운영 보류'
  link TEXT,

  -- 이미지 5장 (Supabase Storage public URL, 빈 슬롯은 NULL)
  image_urls TEXT[] DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],

  -- 텍스트 본문 (각 250자)
  insight TEXT,
  experience TEXT,
  metrics TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유저당 카드 인덱스 1개씩
  UNIQUE(user_id, card_index)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_channel_cards_user_id
  ON portfolio_channel_cards(user_id);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_portfolio_channel_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_portfolio_channel_cards_updated_at
  ON portfolio_channel_cards;

CREATE TRIGGER trigger_update_portfolio_channel_cards_updated_at
  BEFORE UPDATE ON portfolio_channel_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_channel_cards_updated_at();

-- RLS (API는 service role을 쓰므로 우회되지만 안전장치로 enable)
ALTER TABLE portfolio_channel_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel cards: read all" ON portfolio_channel_cards;
CREATE POLICY "channel cards: read all"
  ON portfolio_channel_cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "channel cards: own write" ON portfolio_channel_cards;
CREATE POLICY "channel cards: own write"
  ON portfolio_channel_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Storage 버킷: portfolio-channel-images (public read)
-- 경로 컨벤션: {userId}/card-{1~16}/slot-{0~4}_{timestamp}.{ext}
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-channel-images', 'portfolio-channel-images', true)
ON CONFLICT (id) DO NOTHING;

-- public read
DROP POLICY IF EXISTS "channel images: public read" ON storage.objects;
CREATE POLICY "channel images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio-channel-images');

-- 본인 폴더에만 쓰기 (admin은 service role로 우회)
DROP POLICY IF EXISTS "channel images: own write" ON storage.objects;
CREATE POLICY "channel images: own write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-channel-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "channel images: own update" ON storage.objects;
CREATE POLICY "channel images: own update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'portfolio-channel-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "channel images: own delete" ON storage.objects;
CREATE POLICY "channel images: own delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio-channel-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

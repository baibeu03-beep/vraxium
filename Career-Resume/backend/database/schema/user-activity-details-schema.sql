-- =============================================
-- user_activity_details: 2차 정보 저장 테이블
-- 각 유저별, 주차별, 라인별 서브타이틀/아웃풋링크 저장
-- =============================================

CREATE TABLE IF NOT EXISTS user_activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관계 키
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  activity_type_id TEXT NOT NULL,  -- 'wisdom', 'essay', 'forum', 'infodesk', 'calendar', 'session', 'etc_a' 등

  -- 2차 정보
  sub_title TEXT,                                  -- 서브타이틀 (최대 300자)
  output_links JSONB,                              -- 아웃풋 링크들 [{desc: "설명", url: "https://..."}, ...] 최대 5개
  growth_point TEXT,                               -- 성장 포인트 (자유 서술, 권장 500자)
  image_urls TEXT[] DEFAULT '{}'::TEXT[],          -- 이미지 영구 URL 배열 (Supabase Storage), 최대 4개
  image_captions TEXT[] DEFAULT '{}'::TEXT[],      -- 각 이미지 캡션 (image_urls와 인덱스 정렬), 최대 4개

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유니크 제약: 유저+주차+라인당 하나의 레코드만
  UNIQUE(user_id, week_id, activity_type_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_activity_details_user_id ON user_activity_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_details_week_id ON user_activity_details(week_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_details_user_week ON user_activity_details(user_id, week_id);

-- RLS 정책
ALTER TABLE user_activity_details ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 조회 가능
CREATE POLICY "Users can view own activity details"
  ON user_activity_details FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 데이터만 삽입 가능
CREATE POLICY "Users can insert own activity details"
  ON user_activity_details FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 데이터만 수정 가능
CREATE POLICY "Users can update own activity details"
  ON user_activity_details FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own activity details"
  ON user_activity_details FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_activity_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_activity_details_updated_at
  BEFORE UPDATE ON user_activity_details
  FOR EACH ROW
  EXECUTE FUNCTION update_user_activity_details_updated_at();

-- =============================================
-- 사용 예시
-- =============================================
-- INSERT INTO user_activity_details (user_id, week_id, activity_type_id, sub_title, output_link)
-- VALUES ('user-uuid', 'week-uuid', 'wisdom', '나의 인사이트 서브타이틀', 'https://cafe.naver.com/...')
-- ON CONFLICT (user_id, week_id, activity_type_id)
-- DO UPDATE SET sub_title = EXCLUDED.sub_title, output_link = EXCLUDED.output_link;

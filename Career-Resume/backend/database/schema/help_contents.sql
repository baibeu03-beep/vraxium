-- 도움말 모달 본문을 어드민이 직접 편집할 수 있도록 저장하는 테이블.
-- key 는 코드에서 정의한 고정 식별자 (예: 'seasonReputation', 'colleague' 등).
-- body 는 줄바꿈 보존 일반 텍스트. 비어있으면 프론트에서 기본 placeholder 노출.
CREATE TABLE IF NOT EXISTS help_contents (
  key         text PRIMARY KEY,
  body        text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 읽기는 RLS 무관하게 누구나(비로그인 포함) 가능해야 하므로 RLS 미적용.
-- 쓰기는 service role 키를 쓰는 API 라우트에서 isAdminEmail 게이팅으로만 막음.

-- 9개 도움말 키 미리 시드 (key 만 박아두고 body 는 빈 문자열).
INSERT INTO help_contents (key) VALUES
  ('seasonReputation'),
  ('seasonReview'),
  ('colleague'),
  ('workInfo'),
  ('reputation'),
  ('weeklyReview'),
  ('exp'),
  ('ability'),
  ('career')
ON CONFLICT (key) DO NOTHING;

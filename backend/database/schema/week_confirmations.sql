-- =====================================================================
-- week_confirmations
-- /cluster-4-card "주차 확인(확인 완료)" 버튼의 영구 저장소.
--
-- 의미: "이 유저가 이 주차의 활동 내역을 본인이 확인했다"는 사실 + 확인 시각.
--   · 한 유저 × 한 주차에 최대 1행 (UNIQUE) — 중복 클릭/재요청이 행을 늘리지 않는다.
--   · confirmed_at 은 "최초 확인 시각"으로 고정한다(API 가 idempotent — 재요청 시 기존 행 반환).
--
-- 주차 키(week_id) 선정 근거:
--   · /cluster-4-card/[weekId] 라우트 파라미터 = public.weeks.id (권위 PK).
--   · 같은 주차 자원인 weekly_reviews.week_card_id / career-records.week_id /
--     weekly_reputations.weekCardId 가 모두 이 값을 쓴다 → 새 식별자를 만들지 않고 그대로 참조.
--   · 별칭(week_card_id) 대신 실제 참조 대상 이름인 week_id 로 두고 FK 를 건다.
--
-- 소유자 키(user_id): public.user_profiles.user_id (앱 전역 유저 식별자, 730행 전수 unique 확인).
--   ⚠ user_profiles 에는 id 컬럼이 없다 — weekly_reviews.sql 의 `REFERENCES user_profiles(id)`
--      는 현행 스키마와 맞지 않는 옛 기술이다. 여기서는 실제 컬럼(user_id)을 참조한다.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.week_confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  week_id      uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT week_confirmations_user_week_unique UNIQUE (user_id, week_id)
);

CREATE INDEX IF NOT EXISTS week_confirmations_user_id_idx
  ON public.week_confirmations (user_id);

CREATE INDEX IF NOT EXISTS week_confirmations_week_id_idx
  ON public.week_confirmations (week_id);

-- FK 는 참조 대상에 UNIQUE 제약이 실제로 있을 때만 건다(없으면 테이블 자체는 그대로 살아 있고
-- 애플리케이션 검증만 남는다 → 마이그레이션이 통째로 실패하지 않는다).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'week_confirmations_user_id_fkey'
  ) AND EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname = 'user_profiles'
      AND i.indisunique AND i.indnatts = 1 AND a.attname = 'user_id'
  ) THEN
    ALTER TABLE public.week_confirmations
      ADD CONSTRAINT week_confirmations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles (user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'week_confirmations_week_id_fkey'
  ) THEN
    ALTER TABLE public.week_confirmations
      ADD CONSTRAINT week_confirmations_week_id_fkey
      FOREIGN KEY (week_id) REFERENCES public.weeks (id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS: 이 테이블은 서버 라우트(service_role)로만 접근한다. 정책을 두지 않은 채 RLS 를 켜면
-- anon/authenticated 키로는 직접 읽기·쓰기가 모두 차단되고, service_role 은 RLS 를 우회한다.
ALTER TABLE public.week_confirmations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 롤백
-- =====================================================================
-- DROP TABLE IF EXISTS public.week_confirmations;
--   (인덱스·UNIQUE·FK·RLS 설정이 테이블과 함께 사라진다. 다른 테이블을 참조하기만 하고
--    참조당하지는 않으므로 CASCADE 없이 안전하게 드롭된다.)

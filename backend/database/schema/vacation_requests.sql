-- =====================================================================
-- vacation_requests
-- 고객 앱 "클럽 주차 휴식 신청"(개인 휴식) 신청 원장.
--
-- 배경: 기존 rest_requests 테이블은 어드민이 status='approved' 로 생성하는
--       "승인된 개인 휴식" 읽기 전용 소스다(고객 앱은 조회만). 고객이 직접
--       신청하는 셀프서비스 휴식 신청은 의미가 달라(승인 대기 포함) 별도
--       테이블로 분리한다. 어드민 승인 시 status 를 approved/rejected 로 갱신한다.
--
-- 한 유저가 같은 주차(week_id)에 대해 신청 1건만 보유(UNIQUE).
-- mode=test / actAsTestUserId(테스트 유저) 도 일반 사용자와 동일 스키마/DTO 를 탄다.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 신청자 — 작성 시 resolveWriteUserId/Actor 가 반환하는 값(= user_profiles 의 canonical
  -- PK 인 user_id, uuid). user_profiles 에는 별도 id 컬럼이 없고 user_id 가 PK 이므로
  -- FK 대상은 user_profiles(user_id). 테스트 유저(demoUserId) 도 동일 컬럼에 저장.
  user_id         uuid NOT NULL REFERENCES public.user_profiles (user_id) ON DELETE CASCADE,
  -- 조직 slug: 'encre' | 'oranke' | 'phalanx'. 신청 시점 org 컨텍스트 보존.
  org             text NOT NULL,
  -- 대상 주차의 시즌 키(weeks.season_key 를 그대로 비정규화 저장, 예: '2026-summer').
  season_key      text NOT NULL,
  -- 대상 주차(weeks.id). 실제 주차 매핑/승인 처리의 기준.
  week_id         uuid NOT NULL REFERENCES public.weeks (id) ON DELETE CASCADE,
  -- 대상 주차 시작일(월요일). weeks.start_date 비정규화 — 클라 "이미 신청한 주차" 제외
  -- 필터와 날짜 범위 표시에 사용(week_id 조인 없이 빠르게 비교).
  week_start_date date NOT NULL,
  -- 휴식 신청 사유(선택, 최대 100자).
  reason          text CHECK (reason IS NULL OR char_length(reason) <= 100),
  -- 신청 상태: 신청 시 pending, 어드민이 approved/rejected 로 갱신.
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 같은 유저가 같은 주차를 중복 신청하지 못하게 한다.
  CONSTRAINT vacation_requests_user_week_unique UNIQUE (user_id, week_id)
);

CREATE INDEX IF NOT EXISTS vacation_requests_user_id_idx
  ON public.vacation_requests (user_id);

CREATE INDEX IF NOT EXISTS vacation_requests_user_season_idx
  ON public.vacation_requests (user_id, season_key);

CREATE INDEX IF NOT EXISTS vacation_requests_week_id_idx
  ON public.vacation_requests (week_id);

-- updated_at 자동 갱신 트리거 (weekly_reviews 패턴 동일)
CREATE OR REPLACE FUNCTION public.set_vacation_requests_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vacation_requests_updated_at ON public.vacation_requests;
CREATE TRIGGER trg_vacation_requests_updated_at
  BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vacation_requests_updated_at();

-- =====================================================================
-- vacation_requests — 휴식 취소 + 신청 건 그룹핑 확장
-- =====================================================================
-- 1) status 에 'cancelled' 추가 (hard delete 대신 상태 전이로 취소 이력 보존).
-- 2) group_id 추가 — 한 번의 신청(연속 1~3주)을 이루는 주차 행들을 하나의
--    "신청 건"으로 묶는다. POST 는 신청마다 group_id 를 하나 생성해 모든 주차
--    행에 부여하고, MY 목록/취소는 group_id 단위로 동작한다.
-- 이미 적용된 backend/database/schema/vacation_requests.sql 이후 실행한다.
-- =====================================================================

-- status CHECK 재정의 (cancelled 허용)
ALTER TABLE public.vacation_requests
  DROP CONSTRAINT IF EXISTS vacation_requests_status_check;
ALTER TABLE public.vacation_requests
  ADD CONSTRAINT vacation_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- group_id (신청 건 묶음). 기존 행이 있으면 (user_id, org, created_at, reason)
-- 동일 건을 같은 group_id 로 backfill 한다.
ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS group_id uuid;

WITH grp AS (
  SELECT user_id, org, created_at, reason, gen_random_uuid() AS gid
  FROM public.vacation_requests
  WHERE group_id IS NULL
  GROUP BY user_id, org, created_at, reason
)
UPDATE public.vacation_requests v
SET group_id = grp.gid
FROM grp
WHERE v.group_id IS NULL
  AND v.user_id = grp.user_id
  AND v.org = grp.org
  AND v.created_at = grp.created_at
  AND v.reason IS NOT DISTINCT FROM grp.reason;

CREATE INDEX IF NOT EXISTS vacation_requests_group_id_idx
  ON public.vacation_requests (group_id);

NOTIFY pgrst, 'reload schema';

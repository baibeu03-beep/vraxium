-- ============================================================================
-- Migration: Add organization_slug to crews + backfill existing 28 members
-- Purpose:   /crews 페이지의 ?org= 기반 조직 필터링을 위한 컬럼 추가.
-- Naming:    고슴도치 → phalanx · 사슴 → encre · 호랑이 → oranke
-- Run order: Supabase SQL Editor에서 위에서 아래로 순서대로 실행.
-- ============================================================================

-- 1) organization_slug 컬럼 추가 (idempotent)
alter table crews
  add column if not exists organization_slug text;

-- 2) 기존 데이터 backfill — 현재 등록된 28명은 모두 phalanx 소속
update crews
   set organization_slug = 'phalanx'
 where organization_slug is null;

-- ----------------------------------------------------------------------------
-- (선택) 검증 쿼리 — 실행 후 결과 확인용
-- ----------------------------------------------------------------------------
-- select organization_slug, count(*) from crews group by organization_slug;
-- 기대값:
--   phalanx | 28
--   <null>  |  0  (없어야 함)

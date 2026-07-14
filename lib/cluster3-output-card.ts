// =============================================
// cluster-3 아웃풋(Top Works) 카드 미리보기 공통 매퍼 (SoT)
//
// 슬라이더 카드 미리보기가 상세 모달 DOM 을 다시 파싱하지 않고, 상세 모달과
// 동일한 OutputCard 원천값에서 표시용 파생값을 계산하도록 이 파일에 모은다.
// React / Next 의존성 없음 → node 로 단위 테스트 가능.
//
// 관련 단위 테스트: scripts/cluster3-output-card.test.mjs
// =============================================

// ---------- [3] 종료일 포맷 ----------
// 기간 텍스트("26. 04. 15 ~ 26. 04. 23")를 정규식으로 재파싱하지 않고,
// DTO 의 종료일 원천 필드(년/월/일)를 직접 받아 "YY - MM - DD" 로 통일.
// 종료일이 없으면 "-". 시작일을 대신 표시하지 않는다.
export function formatOutputCardEndDate(
  year: number | null | undefined,
  month: number | null | undefined,
  day: number | null | undefined,
): string {
  if (!year || !month || !day) return "-";
  const yy = String(year).slice(-2).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yy} - ${mm} - ${dd}`;
}

// ---------- [6] 기여도 clamp ----------
// 0~100 범위로 clamp. null/undefined/비수치 → null (미입력, "0%" 로 오인 금지).
export function clampContribution(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ---------- [8] 주요 지표 1개 ----------
// metrics 배열은 [name0, value0, name1, value1, ...] 쌍 구조.
// 첫 번째 "유효한(이름 또는 값이 채워진)" 쌍을 반환. 없으면 null.
// 상세 모달과 동일 원천(metrics 배열) 사용 — disabled input DOM 복사 금지.
export function getFirstValidMetric(
  metrics: readonly (string | null | undefined)[] | null | undefined,
): { label: string; value: string } | null {
  if (!Array.isArray(metrics)) return null;
  for (let i = 0; i < metrics.length; i += 2) {
    const label = (metrics[i] ?? "").toString().trim();
    const value = (metrics[i + 1] ?? "").toString().trim();
    if (label || value) return { label, value };
  }
  return null;
}

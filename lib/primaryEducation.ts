export type PrimaryEducationCandidate = {
  id: string | number;
  is_primary?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
};

export function comparePrimaryEducation(
  a: PrimaryEducationCandidate,
  b: PrimaryEducationCandidate,
): number {
  const primaryDelta =
    Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
  if (primaryDelta !== 0) return primaryDelta;

  const sortDelta =
    (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
    (b.sort_order ?? Number.MAX_SAFE_INTEGER);
  if (sortDelta !== 0) return sortDelta;

  const updatedDelta = (b.updated_at ?? "").localeCompare(
    a.updated_at ?? "",
  );
  if (updatedDelta !== 0) return updatedDelta;

  return 0;
}

export function orderEducationsByPrimaryRule<
  T extends PrimaryEducationCandidate,
>(rows: readonly T[]): T[] {
  return [...rows].sort(comparePrimaryEducation);
}

export function pickPrimaryEducation<
  T extends PrimaryEducationCandidate,
>(rows: readonly T[]): T | null {
  return orderEducationsByPrimaryRule(rows)[0] ?? null;
}

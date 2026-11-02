const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const candidate = value.slice(0, 10);
  if (!dateOnlyPattern.test(candidate)) return "";
  const [year, month, day] = candidate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? candidate
    : "";
}

export function fromDateInputValue(value: string | null | undefined) {
  return toDateInputValue(value) || null;
}

export type DateRangeValidation = "missing" | "invalid" | "reversed" | null;

export function validateDateRange(startDate: string | null | undefined, endDate: string | null | undefined): DateRangeValidation {
  if (!startDate || !endDate) return "missing";
  const start = toDateInputValue(startDate);
  const end = toDateInputValue(endDate);
  if (!start || !end || start !== startDate || end !== endDate) return "invalid";
  return start <= end ? null : "reversed";
}


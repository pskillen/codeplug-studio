const UK_DATE_TIME_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Operator-facing Environment field: day-first, 24-hour (`14/08/2026 13:00`). */
export function formatUkDateTime(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Wire value for `<input type="datetime-local">` (always `YYYY-MM-DDTHH:mm` in local time). */
export function formatDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Parses `dd/mm/yyyy HH:mm` in local time. Rejects 12-hour AM/PM strings and
 * calendar overflow (e.g. 31/02). Returns `null` when the text is incomplete or invalid.
 */
export function parseUkDateTime(value: string): Date | null {
  const match = value.trim().match(UK_DATE_TIME_PATTERN);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || day < 1) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  return parsed;
}

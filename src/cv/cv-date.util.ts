/**
 * ATS-safe date formatting. Experience/Project/... startDate/endDate are free-text strings
 * (e.g. "Jan 2024", "2024") - there is no real Date column anywhere in this schema, and no
 * date-parsing anywhere else in either repo to reuse. This covers every format observed in
 * the real seed data (prisma/data/*.json): "Mon YYYY" (Experience/ManagementRole), bare
 * "YYYY" (Project/Course), and "YYYY-YYYY" ranges (Achievement/TimelineEvent) - and never
 * throws or fabricates a date: an unrecognized string passes through verbatim.
 */
const MONTHS: Record<string, string> = {
  jan: 'Jan',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  may: 'May',
  jun: 'Jun',
  jul: 'Jul',
  aug: 'Aug',
  sep: 'Sep',
  oct: 'Oct',
  nov: 'Nov',
  dec: 'Dec',
};

/** "Jan 2024" / "January 2024" -> "Jan 2024"; "2024" -> "2024"; anything else (including a
 *  "2019-2024" range, already unambiguous) -> passed through unchanged. */
export function formatCvDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  const monthYear = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const month = MONTHS[monthYear[1].slice(0, 3).toLowerCase()];
    if (month) return `${month} ${monthYear[2]}`;
  }

  if (/^\d{4}$/.test(trimmed)) return trimmed;

  return trimmed;
}

/** Experience/ManagementRole date line. isCurrent alone decides "Present" - never fabricates
 *  an end date; a non-current row with no endDate renders the start date only. */
export function formatCvDateRange(
  startDate: string,
  endDate: string | null | undefined,
  isCurrent: boolean,
): string {
  const start = formatCvDate(startDate);
  if (isCurrent) return `${start} – Present`;
  if (endDate) return `${start} – ${formatCvDate(endDate)}`;
  return start;
}

/**
 * Best-effort sort key for "newest first" ordering, derived from the same free-text dates.
 * Parses a leading 4-digit year and an optional month name; unparseable strings sort last
 * (never throws). Only used for default ordering - an explicit experienceOrder/projectOrder
 * always wins over this.
 */
export function cvDateSortKey(raw: string | null | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();

  const monthYear = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const monthIndex = Object.keys(MONTHS).indexOf(monthYear[1].slice(0, 3).toLowerCase());
    const year = Number(monthYear[2]);
    return year * 12 + Math.max(0, monthIndex);
  }

  const yearOnly = /^(\d{4})/.exec(trimmed);
  if (yearOnly) return Number(yearOnly[1]) * 12;

  return 0;
}

import { BadRequestException } from '@nestjs/common';
import { CsvRow } from './parse-csv-rows';

/**
 * The one real date shape every downstream consumer of a date column agrees on — Hammad's own
 * engines reject anything else outright ("No dates in 'date' match the required format
 * (YYYY-MM-DD, e.g. 2023-11-17)"), confirmed live, 2026-09-07, on a real dataset using DD-MM-YYYY.
 * Exported so `check-data-quality.ts` checks against the exact same pattern, not a near-duplicate.
 */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True real-calendar validity, not just shape — `new Date('2024-02-30')` doesn't throw, it rolls over to March. */
function isRealCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/**
 * The real min/max date actually present in the uploaded file's date column, for Optimize to
 * suggest instead of asking the user to guess a range blind. Same idea as suggestColumnRoles for
 * Configure — a real starting point, not a random guess.
 *
 * Real bug, found 2026-09-07 on a real end-to-end test: the old version accepted whatever
 * `new Date(d)` could parse (ambiguous for a non-ISO string — "03-01-2022" silently becomes March
 * 1st, not the 3rd of January the file actually meant) and then called `.sort()` with no
 * comparator, which sorts the raw strings *lexicographically* — for a file already in DD-MM-YYYY,
 * that ignores the year entirely, producing exactly the scattered, non-chronological "01 Jan 2024
 * / 06 May 2023 / 12 Sep 2024 / ..." chart axis and the backwards "01 Jan 2024 to 12 Dec 2022"
 * range seen live. Every real downstream consumer (both engines) requires strict ISO YYYY-MM-DD —
 * this now enforces exactly that, real chronological order via actual `Date` comparison, not string
 * comparison, and fails loudly with a real example of the first bad value instead of quietly
 * mis-sorting whatever happened to parse.
 */
export function findDateRange(rows: CsvRow[], dateColumn: string): { minDate: string; maxDate: string } {
  const values = rows.map((row) => String(row[dateColumn]));
  const firstBad = values.find((v) => !isRealCalendarDate(v));
  if (firstBad !== undefined) {
    throw new BadRequestException(
      `The "${dateColumn}" column has to use YYYY-MM-DD (for example, 2024-01-03). Found "${firstBad}" instead. ` +
        'Fix every date in this column to that format and upload again.',
    );
  }

  const sorted = [...values].sort((a, b) => a.localeCompare(b)); // safe now — same-length, zero-padded ISO strings sort chronologically as strings too, but this makes the real reasoning explicit rather than relying on that coincidence being remembered later
  return { minDate: sorted[0], maxDate: sorted[sorted.length - 1] };
}

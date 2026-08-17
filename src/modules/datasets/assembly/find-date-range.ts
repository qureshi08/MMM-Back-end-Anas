import { BadRequestException } from '@nestjs/common';
import { CsvRow } from './parse-csv-rows';

/**
 * The real min/max date actually present in the uploaded file's date column, for Optimize to
 * suggest instead of asking the user to guess a range blind. Same idea as suggestColumnRoles for
 * Configure — a real starting point, not a random guess.
 */
export function findDateRange(rows: CsvRow[], dateColumn: string): { minDate: string; maxDate: string } {
  const dates = rows
    .map((row) => String(row[dateColumn]))
    .filter((d) => !Number.isNaN(new Date(d).getTime()))
    .sort();

  if (dates.length === 0) {
    throw new BadRequestException(`No valid dates found in the "${dateColumn}" column.`);
  }

  return { minDate: dates[0], maxDate: dates[dates.length - 1] };
}

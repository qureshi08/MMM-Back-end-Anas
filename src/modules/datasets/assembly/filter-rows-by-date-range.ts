import { BadRequestException } from '@nestjs/common';
import { CsvRow } from './parse-csv-rows';

/**
 * Hammad's real contract JSON has no separate date-range field, the "df" array is just every row
 * the model should train on. So Optimize's date range does its real work here: which rows actually
 * make it into that array, not a parameter sent alongside it. Worth confirming directly with
 * Hammad, this is the sensible reading of the contract, not something spelled out word for word in it.
 */
export function filterRowsByDateRange(
  rows: CsvRow[],
  dateColumn: string,
  startDate: string,
  endDate: string,
): CsvRow[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const filtered = rows.filter((row) => {
    const raw = row[dateColumn];
    const rowDate = new Date(String(raw));
    return !Number.isNaN(rowDate.getTime()) && rowDate >= start && rowDate <= end;
  });

  if (filtered.length === 0) {
    throw new BadRequestException(
      `No rows fall inside the Optimize date range (${startDate} to ${endDate}). Check the range against the real dates in the file.`,
    );
  }
  return filtered;
}

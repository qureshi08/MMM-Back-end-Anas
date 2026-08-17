import { BadRequestException } from '@nestjs/common';
import { splitCsvLine } from '../assembly/parse-csv-rows';

/**
 * Configure asks a user to type real column names from memory, blind, with
 * nothing to check them against — the actual source of "why does Save keep
 * rejecting this" confusion. This turns the first line of a real CSV into
 * the real list of column names the frontend can show as a pick-list
 * instead, so the user selects from what they actually uploaded rather than
 * retyping it.
 *
 * Uses the same quote-aware `splitCsvLine` as `parseCsvRows` — a plain
 * `split(',')` here would either split a quoted header containing a comma
 * into two fake columns, or leave literal quote characters in a quoted
 * header with no comma, either way a name that can never match a real row
 * key from GET /datasets/:id/rows.
 */
export function extractCsvHeaders(buffer: Buffer): string[] {
  if (buffer.includes(0)) {
    throw new BadRequestException('This file contains binary data, not text, its columns cannot be read.');
  }

  const text = buffer.toString('utf8');
  const firstLine = text.split(/\r\n|\r|\n/)[0] ?? '';
  const headers = splitCsvLine(firstLine).filter((h) => h.length > 0);

  if (headers.length === 0) {
    throw new BadRequestException('No header row could be found in this file.');
  }

  return headers;
}

import { BadRequestException } from '@nestjs/common';

/**
 * The real "df" array Hammad's contract expects: one object per row, numeric-looking values as
 * real JSON numbers (his own example: `"Google Display Cost": 5.2935`, not `"5.2935"`), everything
 * else — dates, flags — left as the real string from the file.
 */
export type CsvRow = Record<string, string | number>;

function coerce(value: string): string | number {
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && trimmed.match(/^-?\d+(\.\d+)?$/) ? asNumber : trimmed;
}

/** A single line of real CSV, respecting double-quoted fields that may contain a comma. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseCsvRows(buffer: Buffer): CsvRow[] {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new BadRequestException('This file has no real data rows to assemble.');
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, i) => {
      row[header] = coerce(fields[i] ?? '');
    });
    return row;
  });
}

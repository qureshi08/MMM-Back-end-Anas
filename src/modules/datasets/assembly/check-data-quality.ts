import { CsvRow } from './parse-csv-rows';
import { ISO_DATE_PATTERN } from './find-date-range';
import { ColumnRoleSuggestions } from '../validators/suggest-column-roles';

export interface DataQualityFlag {
  severity: 'error' | 'warning';
  message: string;
  columnsInvolved: string[];
}

/**
 * Real gap found 2026-09-07 on an end-to-end test: a bad date format (or a blank cell, or a
 * negative spend value) was only ever discovered at Train Model — after Configure, Optimize,
 * Calibrate and Hyperparameterization were all already filled in, and only because Hammad's engine
 * itself rejected the file. Anas's own words: "all the data quality issues must be diagnosed
 * upfront (when the dataset is initially uploaded)."
 *
 * Runs the same real checks a person would do scanning the file by eye, against the *suggested*
 * column roles if Configure hasn't been saved yet (called right after Upload, before the user has
 * confirmed anything) or the real saved `columnMapping` once it has. Deliberately does not require
 * Configure to be saved first — the whole point is catching this before the user invests time in
 * the later steps.
 */
export function checkDataQuality(
  rows: CsvRow[],
  columns: { dateColumn: string | null; targetColumn: string | null; mediaColumns: string[] } | ColumnRoleSuggestions,
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];

  if (rows.length === 0) {
    return [{ severity: 'error', message: 'This file has no data rows.', columnsInvolved: [] }];
  }

  const { dateColumn, targetColumn, mediaColumns } = columns;

  if (dateColumn) {
    const badDates = new Set<string>();
    const seenDates = new Set<string>();
    const duplicateDates = new Set<string>();
    let blankCount = 0;

    for (const row of rows) {
      const raw = String(row[dateColumn] ?? '').trim();
      if (raw === '') {
        blankCount += 1;
        continue;
      }
      if (!ISO_DATE_PATTERN.test(raw)) {
        badDates.add(raw);
      } else {
        if (seenDates.has(raw)) duplicateDates.add(raw);
        seenDates.add(raw);
      }
    }

    if (badDates.size > 0) {
      const examples = [...badDates].slice(0, 3).join(', ');
      flags.push({
        severity: 'error',
        message: `The "${dateColumn}" column must use YYYY-MM-DD (example: 2024-01-03). Found ${badDates.size} row(s) that don't, for example: ${examples}.`,
        columnsInvolved: [dateColumn],
      });
    }
    if (blankCount > 0) {
      flags.push({
        severity: 'error',
        message: `The "${dateColumn}" column is blank on ${blankCount} row(s). Every row needs a real date.`,
        columnsInvolved: [dateColumn],
      });
    }
    if (duplicateDates.size > 0) {
      flags.push({
        severity: 'warning',
        message: `The "${dateColumn}" column has ${duplicateDates.size} repeated date(s) — each real week should appear once.`,
        columnsInvolved: [dateColumn],
      });
    }
  }

  if (targetColumn) {
    let blankCount = 0;
    let negativeCount = 0;
    let nonNumericCount = 0;
    for (const row of rows) {
      const value = row[targetColumn];
      if (value === undefined || value === '') {
        blankCount += 1;
      } else if (typeof value !== 'number') {
        nonNumericCount += 1;
      } else if (value < 0) {
        negativeCount += 1;
      }
    }
    if (blankCount > 0) {
      flags.push({
        severity: 'error',
        message: `The target column "${targetColumn}" is blank on ${blankCount} row(s).`,
        columnsInvolved: [targetColumn],
      });
    }
    if (nonNumericCount > 0) {
      flags.push({
        severity: 'error',
        message: `The target column "${targetColumn}" has ${nonNumericCount} row(s) that aren't real numbers.`,
        columnsInvolved: [targetColumn],
      });
    }
    if (negativeCount > 0) {
      flags.push({
        severity: 'warning',
        message: `The target column "${targetColumn}" has ${negativeCount} negative value(s) — real if this is a genuine loss/return, worth a second look otherwise.`,
        columnsInvolved: [targetColumn],
      });
    }
  }

  for (const mediaColumn of mediaColumns) {
    let negativeCount = 0;
    let nonNumericCount = 0;
    let allZero = true;
    for (const row of rows) {
      const value = row[mediaColumn];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'number') {
        nonNumericCount += 1;
        continue;
      }
      if (value < 0) negativeCount += 1;
      if (value !== 0) allZero = false;
    }
    if (nonNumericCount > 0) {
      flags.push({
        severity: 'error',
        message: `The media column "${mediaColumn}" has ${nonNumericCount} row(s) that aren't real numbers.`,
        columnsInvolved: [mediaColumn],
      });
    }
    if (negativeCount > 0) {
      flags.push({
        severity: 'error',
        message: `The media column "${mediaColumn}" has ${negativeCount} negative spend value(s) — real spend can't be negative.`,
        columnsInvolved: [mediaColumn],
      });
    }
    if (allZero) {
      flags.push({
        severity: 'warning',
        message: `The media column "${mediaColumn}" is zero on every real row — there's nothing for the model to learn from it.`,
        columnsInvolved: [mediaColumn],
      });
    }
  }

  return flags;
}

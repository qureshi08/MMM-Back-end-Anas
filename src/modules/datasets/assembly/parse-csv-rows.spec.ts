import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRows } from './parse-csv-rows';

describe('parseCsvRows', () => {
  it('parses a small real CSV, coercing numeric values to real numbers', () => {
    const buffer = Buffer.from('Date,TV Cost,Promotion\n2025-01-06,680.32,18\n2025-01-13,0,13\n', 'utf8');
    const rows = parseCsvRows(buffer);
    expect(rows).toEqual([
      { Date: '2025-01-06', 'TV Cost': 680.32, Promotion: 18 },
      { Date: '2025-01-13', 'TV Cost': 0, Promotion: 13 },
    ]);
  });

  it('rejects a file with only a header row', () => {
    expect(() => parseCsvRows(Buffer.from('Date,TV Cost\n', 'utf8'))).toThrow(BadRequestException);
  });

  it('parses the real sample dataset, matching Hammad\'s exact contract example shape', () => {
    const buffer = readFileSync(join(__dirname, '../../../../samples/sample-dataset.csv'));
    const rows = parseCsvRows(buffer);
    // Real dataset swapped 2026-08-27 (Anas: use Resources/Handover MMM - Hammad/clean_test_data.csv
    // as the real sample, not the old 16-row placeholder) — 157 real weeks, 2022-01-03 to 2024-12-30.
    expect(rows.length).toBe(157);
    expect(rows[0]).toEqual({
      Date: '2022-01-03',
      'Accounts Subscriptions': 4182,
      'Google Display Cost': 5.2935,
      'Google Branded Paid Search Cost': 3580.52,
      'TV Cost': 0,
      'Google Generic Paid Search Cost': 5322.2,
      'Influencers Cost': 0,
      'Meta Cost': 11637.193,
      'YouTube Cost': 5572.056,
      Dates_School_Holidays: 0,
      'Competitors Promotion': 14,
      Promotion: 14,
    });
  });
});

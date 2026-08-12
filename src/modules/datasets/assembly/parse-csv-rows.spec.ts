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
    expect(rows.length).toBe(16);
    expect(rows[0]).toEqual({
      Date: '2025-01-06',
      'Accounts Subscriptions': 3251,
      'Google Display Cost': 680.32,
      'Google Branded Paid Search Cost': 2387.74,
      'TV Cost': 0,
      'Google Generic Paid Search Cost': 3446.52,
      'Influencers Cost': 0,
      'Meta Cost': 11075.25,
      'YouTube Cost': 6336.37,
      Dates_School_Holidays: 1,
      'Competitors Promotion': 2,
      Promotion: 18,
    });
  });
});

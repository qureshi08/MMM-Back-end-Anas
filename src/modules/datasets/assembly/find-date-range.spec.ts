import { BadRequestException } from '@nestjs/common';
import { findDateRange } from './find-date-range';

describe('findDateRange', () => {
  it('finds the real chronological min/max, not the lexicographic one', () => {
    const rows = [{ date: '2024-03-01' }, { date: '2024-01-15' }, { date: '2024-02-10' }];
    expect(findDateRange(rows, 'date')).toEqual({ minDate: '2024-01-15', maxDate: '2024-03-01' });
  });

  it('rejects real, non-ISO dates instead of silently mis-parsing them (the DD-MM-YYYY bug, 2026-09-07)', () => {
    const rows = [{ date: '03-01-2022' }, { date: '10-01-2022' }];
    expect(() => findDateRange(rows, 'date')).toThrow(BadRequestException);
    expect(() => findDateRange(rows, 'date')).toThrow(/YYYY-MM-DD/);
  });

  it('rejects a real calendar-invalid date even when the shape looks right', () => {
    const rows = [{ date: '2024-02-30' }];
    expect(() => findDateRange(rows, 'date')).toThrow(BadRequestException);
  });
});

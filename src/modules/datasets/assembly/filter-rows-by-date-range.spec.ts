import { BadRequestException } from '@nestjs/common';
import { filterRowsByDateRange } from './filter-rows-by-date-range';

describe('filterRowsByDateRange', () => {
  const rows = [
    { Date: '2025-01-06', Value: 1 },
    { Date: '2025-02-03', Value: 2 },
    { Date: '2025-03-03', Value: 3 },
  ];

  it('keeps only rows inside the real range, inclusive', () => {
    const result = filterRowsByDateRange(rows, 'Date', '2025-01-06', '2025-02-03');
    expect(result).toEqual([
      { Date: '2025-01-06', Value: 1 },
      { Date: '2025-02-03', Value: 2 },
    ]);
  });

  it('rejects a range that excludes every real row', () => {
    expect(() => filterRowsByDateRange(rows, 'Date', '2026-01-01', '2026-02-01')).toThrow(
      BadRequestException,
    );
  });
});

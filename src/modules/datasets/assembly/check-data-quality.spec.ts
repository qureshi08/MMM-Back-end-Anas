import { checkDataQuality } from './check-data-quality';

describe('checkDataQuality', () => {
  const columns = { dateColumn: 'date', targetColumn: 'sales', mediaColumns: ['tv_spend'] };

  it('flags a real non-ISO date column (the DD-MM-YYYY bug, 2026-09-07)', () => {
    const rows = [
      { date: '03-01-2022', sales: 100, tv_spend: 10 },
      { date: '10-01-2022', sales: 100, tv_spend: 10 },
    ];
    const flags = checkDataQuality(rows, columns);
    expect(flags).toContainEqual(
      expect.objectContaining({ severity: 'error', columnsInvolved: ['date'] }),
    );
  });

  it('flags blank target values and negative media spend', () => {
    const rows = [
      { date: '2024-01-01', sales: '', tv_spend: -5 },
      { date: '2024-01-08', sales: 100, tv_spend: 10 },
    ];
    const flags = checkDataQuality(rows, columns);
    expect(flags.some((f) => f.message.includes('blank') && f.columnsInvolved.includes('sales'))).toBe(true);
    expect(flags.some((f) => f.message.includes('negative') && f.columnsInvolved.includes('tv_spend'))).toBe(true);
  });

  it('warns on a media column that is always zero', () => {
    const rows = [
      { date: '2024-01-01', sales: 100, tv_spend: 0 },
      { date: '2024-01-08', sales: 100, tv_spend: 0 },
    ];
    const flags = checkDataQuality(rows, columns);
    expect(flags).toContainEqual(
      expect.objectContaining({ severity: 'warning', columnsInvolved: ['tv_spend'] }),
    );
  });

  it('returns no flags for a genuinely clean file', () => {
    const rows = [
      { date: '2024-01-01', sales: 100, tv_spend: 10 },
      { date: '2024-01-08', sales: 120, tv_spend: 12 },
    ];
    expect(checkDataQuality(rows, columns)).toEqual([]);
  });
});

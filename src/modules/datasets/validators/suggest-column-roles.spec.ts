import { suggestColumnRoles } from './suggest-column-roles';

describe('suggestColumnRoles', () => {
  it('correctly guesses every role on the real sample dataset', () => {
    const columns = [
      'Date',
      'Accounts Subscriptions',
      'Google Display Cost',
      'Google Branded Paid Search Cost',
      'TV Cost',
      'Google Generic Paid Search Cost',
      'Influencers Cost',
      'Meta Cost',
      'YouTube Cost',
      'Dates_School_Holidays',
      'Competitors Promotion',
      'Promotion',
    ];

    const result = suggestColumnRoles(columns);

    expect(result.dateColumn).toBe('Date');
    expect(result.targetColumn).toBe('Accounts Subscriptions');
    expect(result.mediaColumns).toEqual([
      'Google Display Cost',
      'Google Branded Paid Search Cost',
      'TV Cost',
      'Google Generic Paid Search Cost',
      'Influencers Cost',
      'Meta Cost',
      'YouTube Cost',
    ]);
    expect(result.controlColumns).toEqual(['Dates_School_Holidays', 'Competitors Promotion', 'Promotion']);
    expect(result.organicColumns).toEqual([]);
  });

  it('does not let "Dates_School_Holidays" get picked as the date column just because it contains "date"', () => {
    const result = suggestColumnRoles(['Date', 'Dates_School_Holidays']);
    expect(result.dateColumn).toBe('Date');
    expect(result.controlColumns).toContain('Dates_School_Holidays');
  });

  it('never suggests the same column for two roles', () => {
    const columns = ['Date', 'Revenue', 'TV Cost', 'Promotion', 'Organic Social Cost'];
    const result = suggestColumnRoles(columns);
    const all = [
      result.dateColumn,
      result.targetColumn,
      ...result.mediaColumns,
      ...result.controlColumns,
      ...result.organicColumns,
    ].filter((c): c is string => c !== null);
    expect(new Set(all).size).toBe(all.length);
  });

  it('leaves dateColumn and targetColumn null when nothing matches, instead of guessing wrong', () => {
    const result = suggestColumnRoles(['Column A', 'Column B']);
    expect(result.dateColumn).toBeNull();
    expect(result.targetColumn).toBeNull();
  });
});

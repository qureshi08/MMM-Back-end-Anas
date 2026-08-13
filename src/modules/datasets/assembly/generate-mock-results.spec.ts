import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRows } from './parse-csv-rows';
import { generateMockResults } from './generate-mock-results';

function realPayload() {
  const buffer = readFileSync(join(__dirname, '../../../../samples/sample-dataset.csv'));
  const df = parseCsvRows(buffer);
  return {
    df,
    column_mapping: {
      date_column: 'Date',
      target_column: 'Accounts Subscriptions',
      media_columns: ['TV Cost', 'Meta Cost', 'Google Display Cost'],
      control_columns: ['Dates_School_Holidays', 'Promotion'],
      organic_columns: [],
      geo_columns: [],
    },
    model_configuration: {
      channels: {
        'TV Cost': { carryover: 0.85, saturation: 1.5 },
        'Meta Cost': { carryover: 0.4, saturation: 1.1 },
        'Google Display Cost': { carryover: 0.2, saturation: 0.7 },
      },
    },
  };
}

describe('generateMockResults', () => {
  it('matches the real shape from Hammad\'s own sample output, one key per key', () => {
    const results = generateMockResults(realPayload());
    expect(Object.keys(results).sort()).toEqual(
      [
        'data_used',
        'model_confidence',
        'channel_contribution',
        'channel_efficiency',
        'data_quality_flags',
        'budget_recommendation',
        'saturation_status',
        'adstock_decay_curves',
        'saturation_curves',
        'status',
        'mock',
      ].sort(),
    );
    expect(results.status).toBe('completed');
    expect(results.mock).toBe(true);
  });

  it('uses the real sample dataset\'s real date range and row count', () => {
    const results = generateMockResults(realPayload());
    expect(results.data_used.first_date).toBe('2025-01-06');
    expect(results.data_used.row_count).toBe(16);
  });

  it('shortens channel names the same way Hammad\'s real file does ("TV Cost" -> "TV")', () => {
    const results = generateMockResults(realPayload());
    const channels = results.channel_contribution.map((c) => c.channel);
    expect(channels).toEqual(['TV', 'Meta', 'Google Display']);
  });

  it('is deterministic: the same real input always produces the same mock output', () => {
    const a = generateMockResults(realPayload());
    const b = generateMockResults(realPayload());
    expect(a).toEqual(b);
  });

  it('spend in channel_contribution matches the real sum from the real file', () => {
    const results = generateMockResults(realPayload());
    const tvCost = results.channel_contribution.find((c) => c.channel === 'TV')!;
    const buffer = readFileSync(join(__dirname, '../../../../samples/sample-dataset.csv'));
    const df = parseCsvRows(buffer);
    const realTotal = df.reduce((sum, row) => sum + (Number(row['TV Cost']) || 0), 0);
    expect(tvCost.spend).toBeCloseTo(realTotal, 5);
  });

  it('always flags itself as mock in a real, checkable data quality warning', () => {
    const results = generateMockResults(realPayload());
    expect(results.data_quality_flags[0].message).toMatch(/simulated/i);
  });
});

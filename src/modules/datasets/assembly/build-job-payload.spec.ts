import { Dataset, KpiType } from '../entities/dataset.entity';
import { buildJobPayload } from './build-job-payload';

function fakeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    columnMapping: {
      dateColumn: 'Date',
      targetColumn: 'Accounts Subscriptions',
      mediaColumns: ['TV Cost', 'Meta Cost'],
      controlColumns: ['Promotion'],
      organicColumns: [],
      geoColumns: [],
    },
    kpiType: KpiType.NON_REVENUE,
    revenuePerKpiValue: 50,
    calibration: { contributionBeliefPercent: 30, confidencePercent: 80 },
    channelHyperparameters: [
      { channel: 'TV Cost', carryover: 0.85, saturation: 1.5 },
      { channel: 'Meta Cost', carryover: 0.4, saturation: 1.1 },
    ],
    ...overrides,
  } as Dataset;
}

describe('buildJobPayload', () => {
  it('matches Hammad\'s real contract shape exactly, field for field', () => {
    const rows = [{ Date: '2025-01-06', 'Accounts Subscriptions': 3251 }];
    const payload = buildJobPayload(fakeDataset(), rows);

    expect(payload).toEqual({
      df: rows,
      column_mapping: {
        date_column: 'Date',
        target_column: 'Accounts Subscriptions',
        media_columns: ['TV Cost', 'Meta Cost'],
        control_columns: ['Promotion'],
        organic_columns: [],
        geo_columns: [],
      },
      kpi_type: 'non_revenue',
      revenue_per_kpi_value: 50,
      model_configuration: {
        channels: {
          'TV Cost': { carryover: 0.85, saturation: 1.5 },
          'Meta Cost': { carryover: 0.4, saturation: 1.1 },
        },
        calibration: { contribution_belief_percent: 30, confidence_percent: 80 },
      },
    });
  });

  it('sends revenue_per_kpi_value as null when the KPI is already revenue', () => {
    const payload = buildJobPayload(fakeDataset({ kpiType: KpiType.REVENUE, revenuePerKpiValue: null }), []);
    expect(payload.revenue_per_kpi_value).toBeNull();
  });
});

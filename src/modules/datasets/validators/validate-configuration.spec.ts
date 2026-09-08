import { BadRequestException } from '@nestjs/common';
import { KpiType } from '../entities/dataset.entity';
import {
  assertCalibrationBothOrNeither,
  assertChannelHyperparameterHasAtLeastOneField,
  assertChannelsAreRealMediaColumns,
  assertNoDuplicateColumns,
  assertRevenuePerKpiValueMatchesKpiType,
  assertValidDateRange,
} from './validate-configuration';

describe('assertNoDuplicateColumns', () => {
  it('accepts a real, distinct set of columns', () => {
    expect(() =>
      assertNoDuplicateColumns(['Date', 'Accounts Subscriptions', 'TV Cost', 'Meta Cost', 'Promotion']),
    ).not.toThrow();
  });

  it('rejects the same column reused as both target and a media column', () => {
    expect(() => assertNoDuplicateColumns(['Date', 'TV Cost', 'TV Cost'])).toThrow(BadRequestException);
  });
});

describe('assertValidDateRange', () => {
  it('accepts a real, forward-moving range', () => {
    expect(() => assertValidDateRange('2025-01-01', '2025-06-01')).not.toThrow();
  });

  it('rejects a range where the start is after the end', () => {
    expect(() => assertValidDateRange('2025-06-01', '2025-01-01')).toThrow(BadRequestException);
  });

  it('rejects a range where the start equals the end', () => {
    expect(() => assertValidDateRange('2025-01-01', '2025-01-01')).toThrow(BadRequestException);
  });
});

describe('assertChannelsAreRealMediaColumns', () => {
  const mediaColumns = ['TV Cost', 'Meta Cost', 'Google Display Cost'];

  it('accepts a real full match, any order', () => {
    expect(() =>
      assertChannelsAreRealMediaColumns(mediaColumns, ['Meta Cost', 'TV Cost', 'Google Display Cost']),
    ).not.toThrow();
  });

  it('accepts a real, partial subset — "no input to some channels" is valid, per Hammad\'s contract', () => {
    expect(() => assertChannelsAreRealMediaColumns(mediaColumns, ['TV Cost'])).not.toThrow();
  });

  it('accepts a genuinely empty list — "no input to any channel" is valid', () => {
    expect(() => assertChannelsAreRealMediaColumns(mediaColumns, [])).not.toThrow();
  });

  it('rejects a channel that is not a real media column', () => {
    expect(() => assertChannelsAreRealMediaColumns(mediaColumns, ['TV Cost', 'Radio Cost'])).toThrow(
      BadRequestException,
    );
  });

  it('rejects a duplicated channel', () => {
    expect(() => assertChannelsAreRealMediaColumns(mediaColumns, ['TV Cost', 'TV Cost'])).toThrow(
      BadRequestException,
    );
  });
});

describe('assertChannelHyperparameterHasAtLeastOneField', () => {
  it('accepts carryover only', () => {
    expect(() => assertChannelHyperparameterHasAtLeastOneField('TV Cost', 0.85, undefined)).not.toThrow();
  });

  it('accepts saturation only', () => {
    expect(() => assertChannelHyperparameterHasAtLeastOneField('TV Cost', undefined, 1.5)).not.toThrow();
  });

  it('accepts both', () => {
    expect(() => assertChannelHyperparameterHasAtLeastOneField('TV Cost', 0.85, 1.5)).not.toThrow();
  });

  it('rejects neither — a channel with nothing real set should not be in the list at all', () => {
    expect(() => assertChannelHyperparameterHasAtLeastOneField('TV Cost', undefined, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => assertChannelHyperparameterHasAtLeastOneField('TV Cost', null, null)).toThrow(BadRequestException);
  });
});

describe('assertCalibrationBothOrNeither', () => {
  it('accepts both real values provided', () => {
    expect(() => assertCalibrationBothOrNeither(50, 70)).not.toThrow();
  });

  it('accepts neither provided', () => {
    expect(() => assertCalibrationBothOrNeither(undefined, undefined)).not.toThrow();
    expect(() => assertCalibrationBothOrNeither(null, null)).not.toThrow();
  });

  it('rejects belief without confidence', () => {
    expect(() => assertCalibrationBothOrNeither(50, undefined)).toThrow(BadRequestException);
  });

  it('rejects confidence without belief', () => {
    expect(() => assertCalibrationBothOrNeither(undefined, 70)).toThrow(BadRequestException);
  });
});

describe('assertRevenuePerKpiValueMatchesKpiType', () => {
  it('accepts non_revenue with a real value provided', () => {
    expect(() => assertRevenuePerKpiValueMatchesKpiType(KpiType.NON_REVENUE, 50)).not.toThrow();
  });

  it('rejects non_revenue with no value provided', () => {
    expect(() => assertRevenuePerKpiValueMatchesKpiType(KpiType.NON_REVENUE, undefined)).toThrow(
      BadRequestException,
    );
  });

  it('accepts revenue with no value provided', () => {
    expect(() => assertRevenuePerKpiValueMatchesKpiType(KpiType.REVENUE, undefined)).not.toThrow();
  });

  it('rejects revenue with a value provided anyway', () => {
    expect(() => assertRevenuePerKpiValueMatchesKpiType(KpiType.REVENUE, 50)).toThrow(BadRequestException);
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  assertChannelsMatchMediaColumns,
  assertNoDuplicateColumns,
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

describe('assertChannelsMatchMediaColumns', () => {
  const mediaColumns = ['TV Cost', 'Meta Cost', 'Google Display Cost'];

  it('accepts channels that exactly match the media columns, any order', () => {
    expect(() =>
      assertChannelsMatchMediaColumns(mediaColumns, ['Meta Cost', 'TV Cost', 'Google Display Cost']),
    ).not.toThrow();
  });

  it('rejects a missing channel', () => {
    expect(() => assertChannelsMatchMediaColumns(mediaColumns, ['TV Cost', 'Meta Cost'])).toThrow(
      BadRequestException,
    );
  });

  it('rejects a channel that is not a real media column', () => {
    expect(() =>
      assertChannelsMatchMediaColumns(mediaColumns, ['TV Cost', 'Meta Cost', 'Google Display Cost', 'Radio Cost']),
    ).toThrow(BadRequestException);
  });

  it('rejects a duplicated channel', () => {
    expect(() =>
      assertChannelsMatchMediaColumns(mediaColumns, ['TV Cost', 'TV Cost', 'Meta Cost']),
    ).toThrow(BadRequestException);
  });
});

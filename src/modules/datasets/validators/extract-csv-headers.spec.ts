import { BadRequestException } from '@nestjs/common';
import { extractCsvHeaders } from './extract-csv-headers';

describe('extractCsvHeaders', () => {
  it('extracts the real header row from a real CSV', () => {
    const buffer = Buffer.from('Date,TV Cost,Meta Cost\n2025-01-06,680.32,11075.25\n', 'utf8');
    expect(extractCsvHeaders(buffer)).toEqual(['Date', 'TV Cost', 'Meta Cost']);
  });

  it('trims whitespace around header names', () => {
    const buffer = Buffer.from('Date, TV Cost , Meta Cost\n', 'utf8');
    expect(extractCsvHeaders(buffer)).toEqual(['Date', 'TV Cost', 'Meta Cost']);
  });

  it('works when the file is truncated mid-way through the data (only the header row matters)', () => {
    const buffer = Buffer.from('Date,TV Cost,Meta Cost\n2025-01-06,680', 'utf8');
    expect(extractCsvHeaders(buffer)).toEqual(['Date', 'TV Cost', 'Meta Cost']);
  });

  it('rejects binary data', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02]);
    expect(() => extractCsvHeaders(buffer)).toThrow(BadRequestException);
  });

  it('rejects an empty file', () => {
    expect(() => extractCsvHeaders(Buffer.alloc(0))).toThrow(BadRequestException);
  });
});

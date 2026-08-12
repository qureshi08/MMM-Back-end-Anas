import { BadRequestException } from '@nestjs/common';
import { validateDatasetFile } from './validate-dataset-file';

function fakeFile(originalname: string, buffer: Buffer): Express.Multer.File {
  return { originalname, buffer, size: buffer.length } as Express.Multer.File;
}

describe('validateDatasetFile', () => {
  it('accepts a real CSV with a header row and a data row', () => {
    const buffer = Buffer.from('Date,Revenue,TV Spend\n2026-01-01,10000,500\n', 'utf8');
    expect(() => validateDatasetFile(fakeFile('sample.csv', buffer))).not.toThrow();
  });

  it('accepts a real XLSX (zip signature)', () => {
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('rest of a real xlsx')]);
    expect(() => validateDatasetFile(fakeFile('sample.xlsx', buffer))).not.toThrow();
  });

  it('accepts a real Parquet file (PAR1 magic at both ends)', () => {
    const buffer = Buffer.concat([Buffer.from('PAR1'), Buffer.from('middle of a real parquet file'), Buffer.from('PAR1')]);
    expect(() => validateDatasetFile(fakeFile('sample.parquet', buffer))).not.toThrow();
  });

  it('rejects an unsupported extension', () => {
    const buffer = Buffer.from('whatever', 'utf8');
    expect(() => validateDatasetFile(fakeFile('sample.txt', buffer))).toThrow(BadRequestException);
  });

  it('rejects a CSV with only a header row, no data', () => {
    const buffer = Buffer.from('Date,Revenue,TV Spend\n', 'utf8');
    expect(() => validateDatasetFile(fakeFile('sample.csv', buffer))).toThrow(BadRequestException);
  });

  it('rejects a .csv that is actually binary data', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => validateDatasetFile(fakeFile('sample.csv', buffer))).toThrow(BadRequestException);
  });

  it('rejects a .xlsx that is really just a renamed text file', () => {
    const buffer = Buffer.from('not actually an excel file', 'utf8');
    expect(() => validateDatasetFile(fakeFile('sample.xlsx', buffer))).toThrow(BadRequestException);
  });

  it('rejects a .parquet that is really just a renamed text file', () => {
    const buffer = Buffer.from('not actually a parquet file', 'utf8');
    expect(() => validateDatasetFile(fakeFile('sample.parquet', buffer))).toThrow(BadRequestException);
  });

  it('rejects an empty file', () => {
    const buffer = Buffer.alloc(0);
    expect(() => validateDatasetFile(fakeFile('sample.csv', buffer))).toThrow(BadRequestException);
  });
});

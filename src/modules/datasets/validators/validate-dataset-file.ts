import { BadRequestException } from '@nestjs/common';

/**
 * The Upload Data screen tells the user "CSV, XLSX or Parquet," but until now
 * nothing on the backend actually checked that. Any file, any extension, any
 * bytes, went straight into R2. This is a real, if shallow, check: the right
 * extension, plus a signature check so a renamed .txt or .exe can't pass as
 * a .csv/.xlsx/.parquet just because the extension matches. Deeper checks
 * (does this CSV actually have the columns Configure needs) belong to the
 * Configure step, once real column names exist to check against, not here.
 */
const ALLOWED_EXTENSIONS = new Set(['csv', 'xlsx', 'parquet']);

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // XLSX is a zip archive
const PARQUET_MAGIC = Buffer.from('PAR1', 'ascii'); // present at both the start and end of a real parquet file

function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot + 1).toLowerCase();
}

function validateCsv(buffer: Buffer): void {
  if (buffer.includes(0)) {
    throw new BadRequestException('This file has a .csv extension but contains binary data, not text.');
  }
  const text = buffer.toString('utf8');
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new BadRequestException('This CSV needs at least a header row and one row of data.');
  }
  if (!lines[0].includes(',')) {
    throw new BadRequestException('The first row of this CSV has no commas, it does not look like a real header row.');
  }
}

function validateXlsx(buffer: Buffer): void {
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
    throw new BadRequestException('This file has an .xlsx extension but is not a real Excel file.');
  }
}

function validateParquet(buffer: Buffer): void {
  const startsWithMagic = buffer.length >= 4 && buffer.subarray(0, 4).equals(PARQUET_MAGIC);
  const endsWithMagic = buffer.length >= 4 && buffer.subarray(-4).equals(PARQUET_MAGIC);
  if (!startsWithMagic || !endsWithMagic) {
    throw new BadRequestException('This file has a .parquet extension but is not a real Parquet file.');
  }
}

export function validateDatasetFile(file: Express.Multer.File): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('The uploaded file is empty.');
  }

  const extension = extensionOf(file.originalname);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new BadRequestException(
      `"${file.originalname}" is not a supported format. Upload a .csv, .xlsx or .parquet file.`,
    );
  }

  switch (extension) {
    case 'csv':
      validateCsv(file.buffer);
      break;
    case 'xlsx':
      validateXlsx(file.buffer);
      break;
    case 'parquet':
      validateParquet(file.buffer);
      break;
  }
}

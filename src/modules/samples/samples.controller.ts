import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from '../auth/decorators/public.decorator';

/**
 * A real, downloadable example dataset, matching the exact column shape
 * Hammad's modeling engine actually expects (date, target, media/control
 * columns) — see `dev-log/for-anas/modeling-engine-explained.html` Section
 * 03. `@Public()`: nothing sensitive in a sample file, no reason to require
 * sign-in just to see the expected format.
 */
@Controller('samples')
export class SamplesController {
  @Public()
  @Get('dataset.csv')
  download(@Res() res: Response): void {
    const filePath = join(process.cwd(), 'samples', 'sample-dataset.csv');
    if (!existsSync(filePath)) {
      throw new NotFoundException('Sample dataset file is missing on this deployment.');
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sample-dataset.csv"');
    res.sendFile(filePath);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DatasetsService } from './datasets.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { ConfigureDatasetDto } from './dto/configure-dataset.dto';
import { OptimizeDatasetDto } from './dto/optimize-dataset.dto';
import { CalibrateDatasetDto } from './dto/calibrate-dataset.dto';
import { HyperparameterizeDatasetDto } from './dto/hyperparameterize-dataset.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Dataset } from './entities/dataset.entity';

/** 200 MB — generous for a CSV of weekly marketing spend, not unbounded. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

@Controller()
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Post('projects/:projectId/datasets')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDatasetDto,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES })] }))
    file: Express.Multer.File,
  ): Promise<Dataset> {
    return this.datasets.create(projectId, user.userId!, user.tenantId!, dto, file);
  }

  @Get('projects/:projectId/datasets')
  findAllForProject(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<Dataset[]> {
    return this.datasets.findAllForProject(projectId);
  }

  @Get('datasets/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Dataset> {
    return this.datasets.findOne(id);
  }

  @Get('datasets/:id/download-url')
  async getDownloadUrl(@Param('id', ParseUUIDPipe) id: string): Promise<{ url: string }> {
    return { url: await this.datasets.getDownloadUrl(id) };
  }

  @Get('datasets/:id/columns')
  getColumns(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.getColumns(id);
  }

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.datasets.remove(id, user.userId!);
  }

  @Patch('datasets/:id/configuration')
  configure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureDatasetDto,
  ): Promise<Dataset> {
    return this.datasets.configure(id, user.userId!, dto);
  }

  @Patch('datasets/:id/optimize')
  optimize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OptimizeDatasetDto,
  ): Promise<Dataset> {
    return this.datasets.optimize(id, user.userId!, dto);
  }

  @Patch('datasets/:id/calibration')
  calibrate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalibrateDatasetDto,
  ): Promise<Dataset> {
    return this.datasets.calibrate(id, user.userId!, dto);
  }

  @Patch('datasets/:id/hyperparameters')
  hyperparameterize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HyperparameterizeDatasetDto,
  ): Promise<Dataset> {
    return this.datasets.hyperparameterize(id, user.userId!, dto);
  }

  /**
   * Builds and saves the real job file, generates a real job_id. Does not send anything to
   * Hammad's worker, there's nowhere stable to send it yet — see the service method's own comment.
   */
  @Post('datasets/:id/assemble')
  assemble(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.datasets.assemble(id, user.userId!);
  }

  /**
   * "Train Model." Real training is on hold, this runs a mock instead — see DatasetsService.train's
   * own comment. Real shape, mock content, always flagged (results.mock === true).
   */
  @Post('datasets/:id/train')
  train(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<Dataset> {
    return this.datasets.train(id, user.userId!);
  }

  @Get('datasets/:id/status')
  getTrainingStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.getTrainingStatus(id);
  }

  @Get('datasets/:id/results')
  getResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.getResults(id);
  }
}

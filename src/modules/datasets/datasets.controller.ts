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
import { CombineColumnsDto } from './dto/combine-columns.dto';
import { CombineChannelsDto } from './dto/combine-channels.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { assertWriteAccess } from '../../common/auth/permissions';
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
    assertWriteAccess(user);
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

  @Get('datasets/:id/date-range')
  getDateRange(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.getDateRange(id);
  }

  @Get('datasets/:id/rows')
  getRows(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.getRows(id);
  }

  @Post('datasets/:id/combine-columns')
  combineColumns(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CombineColumnsDto,
  ) {
    assertWriteAccess(user);
    return this.datasets.combineColumns(id, dto);
  }

  /**
   * The real version of combining channels — changes what training actually sees, not just the
   * Optimize preview chart. Clears channelHyperparameters, Hyperparameterization needs a redo
   * against the new combined channel list.
   */
  @Patch('datasets/:id/combine-channels')
  combineChannels(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CombineChannelsDto,
  ): Promise<Dataset> {
    assertWriteAccess(user);
    return this.datasets.combineChannels(id, user.userId!, dto);
  }

  /**
   * "Combine what's flagged" — one click, no picking pairs by hand. Finds every real group of
   * media columns correlated 90%+ and combines each group for real, same effect as calling
   * combine-channels once per group.
   */
  @Post('datasets/:id/auto-combine-channels')
  autoCombineChannels(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    assertWriteAccess(user);
    return this.datasets.autoCombineChannels(id, user.userId!);
  }

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    assertWriteAccess(user);
    return this.datasets.remove(id, user.userId!);
  }

  @Patch('datasets/:id/configuration')
  configure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureDatasetDto,
  ): Promise<Dataset> {
    assertWriteAccess(user);
    return this.datasets.configure(id, user.userId!, dto);
  }

  @Patch('datasets/:id/optimize')
  optimize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OptimizeDatasetDto,
  ): Promise<Dataset> {
    assertWriteAccess(user);
    return this.datasets.optimize(id, user.userId!, dto);
  }

  @Patch('datasets/:id/calibration')
  calibrate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalibrateDatasetDto,
  ): Promise<Dataset> {
    assertWriteAccess(user);
    return this.datasets.calibrate(id, user.userId!, dto);
  }

  @Patch('datasets/:id/hyperparameters')
  hyperparameterize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HyperparameterizeDatasetDto,
  ): Promise<Dataset> {
    assertWriteAccess(user);
    return this.datasets.hyperparameterize(id, user.userId!, dto);
  }

  /**
   * Builds and saves the real job file, generates a real job_id. Doesn't call the model engine
   * itself, `train()` does that — this only produces the artifact, see the service method's own
   * comment.
   */
  @Post('datasets/:id/assemble')
  assemble(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    assertWriteAccess(user);
    return this.datasets.assemble(id, user.userId!);
  }

  /**
   * "Train Model." Calls the real Meridian engine over ngrok when `MODEL_ENGINE_URL` is configured,
   * falls back to a mock in the exact real result shape otherwise — see DatasetsService.train's own
   * comment. Mock results are always flagged (results.mock === true), never presented as real.
   */
  @Post('datasets/:id/train')
  train(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<Dataset> {
    assertWriteAccess(user);
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

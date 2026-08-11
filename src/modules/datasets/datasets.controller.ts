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
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DatasetsService } from './datasets.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
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

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.datasets.remove(id, user.userId!);
  }
}

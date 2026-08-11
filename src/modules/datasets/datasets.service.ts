import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { Project } from '../projects/entities/project.entity';
import { Dataset } from './entities/dataset.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { STORAGE_SERVICE } from './storage/storage.provider';
import { StorageService } from './storage/storage.service';

/**
 * `datasets` has Row-Level Security, same reasoning as `ProjectsService`:
 * every query goes through the per-request tenant-scoped `QueryRunner`, no
 * `@InjectRepository`.
 */
@Injectable()
export class DatasetsService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(Dataset);
  }

  private projectsRepo() {
    return getTenantContext().queryRunner.manager.getRepository(Project);
  }

  private async findProjectOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectsRepo().findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }
    return project;
  }

  /**
   * Same owner-only rule `ProjectsService` uses for the project itself — a
   * dataset belongs to a project, so editing/removing it follows the
   * project's own ownership, not a separate permission on the dataset row.
   */
  private assertProjectOwner(project: Project, requesterId: string): void {
    if (project.ownerId !== requesterId) {
      throw new ForbiddenException('Only the project owner can do this.');
    }
  }

  async create(
    projectId: string,
    requesterId: string,
    tenantId: string,
    dto: CreateDatasetDto,
    file: Express.Multer.File,
  ): Promise<Dataset> {
    const project = await this.findProjectOrThrow(projectId);
    this.assertProjectOwner(project, requesterId);

    const storageKey = `tenants/${tenantId}/projects/${projectId}/datasets/${randomUUID()}-${file.originalname}`;
    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    return this.repo().save(
      this.repo().create({
        tenantId,
        projectId,
        name: dto.name,
        modelType: dto.modelType,
        storageKey,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
      }),
    );
  }

  /** RLS already limits this to the caller's own tenant. */
  findAllForProject(projectId: string): Promise<Dataset[]> {
    return this.repo().find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Dataset> {
    const dataset = await this.repo().findOne({ where: { id } });
    if (!dataset) {
      throw new NotFoundException(`Dataset ${id} not found.`);
    }
    return dataset;
  }

  async getDownloadUrl(id: string): Promise<string> {
    const dataset = await this.findOne(id);
    return this.storage.getDownloadUrl(dataset.storageKey);
  }

  /**
   * Soft delete only, same audit-trail rationale as `ProjectsService`, the
   * row stays. The R2 object itself is left in place deliberately, not
   * removed on every dataset delete, matching that same "keep it for
   * audit" reasoning rather than assuming delete always means gone.
   */
  async remove(id: string, requesterId: string): Promise<void> {
    const dataset = await this.findOne(id);
    const project = await this.findProjectOrThrow(dataset.projectId);
    this.assertProjectOwner(project, requesterId);
    await this.repo().softDelete(id);
  }
}

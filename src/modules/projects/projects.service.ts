import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { Project } from './entities/project.entity';
import { Dataset } from '../datasets/entities/dataset.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export type ProjectWithCounts = Project & { datasetCount: number };

/**
 * Deliberately not @InjectRepository — `projects` has Row-Level Security
 * (AddProjectsTable1785900000003), and the injected default repository
 * runs on the app's pooled connection, which never has `app.tenant_id` set
 * on it. Every query here goes through the same per-request, tenant-scoped
 * QueryRunner that TenantContextInterceptor already opened, exactly the
 * pattern TenantResolutionService established for `users`. Any future
 * RLS-protected table's service should follow this same shape, not
 * @InjectRepository — that only stays safe for tables RLS doesn't apply to
 * (like `tenants` itself).
 */
@Injectable()
export class ProjectsService {
  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(Project);
  }

  private datasetsRepo() {
    return getTenantContext().queryRunner.manager.getRepository(Dataset);
  }

  create(ownerId: string, tenantId: string, dto: CreateProjectDto): Promise<Project> {
    return this.repo().save(this.repo().create({ ...dto, ownerId, tenantId }));
  }

  /**
   * How many real, non-deleted datasets (models-in-progress) exist per project. The frontend's
   * "0 models" bug traced back to this never existing at all — GET /projects had nothing to show
   * a real count from. One grouped count query, not N+1.
   */
  private async countDatasetsByProject(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.datasetsRepo()
      .createQueryBuilder('d')
      .select('d.project_id', 'projectId')
      .addSelect('COUNT(*)', 'count')
      .where('d.project_id IN (:...ids)', { ids: projectIds })
      .andWhere('d.deleted_at IS NULL')
      .groupBy('d.project_id')
      .getRawMany<{ projectId: string; count: string }>();
    return new Map(rows.map((r) => [r.projectId, Number(r.count)]));
  }

  /**
   * RLS already limits this to the caller's own tenant — no explicit
   * `where: { tenantId }` needed, the database enforces it even if this
   * line were wrong.
   */
  async findAll(): Promise<ProjectWithCounts[]> {
    const projects = await this.repo().find({ order: { createdAt: 'DESC' } });
    const counts = await this.countDatasetsByProject(projects.map((p) => p.id));
    return projects.map((p) => ({ ...p, datasetCount: counts.get(p.id) ?? 0 }));
  }

  /** Plain entity, no computed fields — for internal use (update/remove) where those don't apply and would confuse repo().save(). */
  private async findEntity(id: string): Promise<Project> {
    const project = await this.repo().findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found.`);
    }
    return project;
  }

  async findOne(id: string): Promise<ProjectWithCounts> {
    const project = await this.findEntity(id);
    const counts = await this.countDatasetsByProject([id]);
    return { ...project, datasetCount: counts.get(id) ?? 0 };
  }

  async update(id: string, requesterId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findEntity(id);
    this.assertOwner(project, requesterId);
    // class-transformer sets every declared optional DTO field as its own
    // property (value undefined) even when the caller never sent it, so a
    // plain Object.assign(project, dto) would overwrite untouched columns
    // with undefined, and TypeORM's save() writes that as NULL. Only merge
    // fields the caller actually provided.
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (project as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return this.repo().save(project);
  }

  async remove(id: string, requesterId: string): Promise<void> {
    const project = await this.findEntity(id);
    this.assertOwner(project, requesterId);
    await this.repo().softDelete(id);
  }

  /**
   * Owner-only for now — CMP-41's scope is plain CRUD, not sharing.
   * `user_project_permissions` (view/edit grants beyond the owner) is its
   * own table in the schema doc and its own future ticket; an
   * administrator-role override isn't built here either, deliberately, so
   * this doesn't get ahead of a permission model that doesn't exist yet.
   */
  private assertOwner(project: Project, requesterId: string): void {
    if (project.ownerId !== requesterId) {
      throw new ForbiddenException('Only the project owner can do this.');
    }
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

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

  create(ownerId: string, tenantId: string, dto: CreateProjectDto): Promise<Project> {
    return this.repo().save(this.repo().create({ ...dto, ownerId, tenantId }));
  }

  /**
   * RLS already limits this to the caller's own tenant — no explicit
   * `where: { tenantId }` needed, the database enforces it even if this
   * line were wrong.
   */
  findAll(): Promise<Project[]> {
    return this.repo().find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.repo().findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found.`);
    }
    return project;
  }

  async update(id: string, requesterId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
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
    const project = await this.findOne(id);
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

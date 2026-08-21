import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { Dataset } from '../datasets/entities/dataset.entity';
import { User, GlobalRole } from '../users/entities/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

export type ProjectWithCounts = Project & { datasetCount: number };

/**
 * Deliberately not @InjectRepository — `projects`/`project_members` have Row-Level Security, and
 * the injected default repository runs on the app's pooled connection, which never has
 * `app.tenant_id` set on it. Every query here goes through the same per-request, tenant-scoped
 * QueryRunner that TenantContextInterceptor already opened, exactly the pattern
 * TenantResolutionService established for `users`.
 */
@Injectable()
export class ProjectsService {
  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(Project);
  }

  private membersRepo() {
    return getTenantContext().queryRunner.manager.getRepository(ProjectMember);
  }

  private usersRepo() {
    return getTenantContext().queryRunner.manager.getRepository(User);
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
   * Real project-level visibility, 2026-08-20: a Master sees every project in the tenant. Anyone
   * else only sees projects they own or were explicitly added to — RLS already limits both to the
   * caller's own tenant, no explicit `where: { tenantId }` needed on top.
   */
  async findAll(requesterId: string, globalRole: GlobalRole): Promise<ProjectWithCounts[]> {
    const qb = this.repo().createQueryBuilder('p').orderBy('p.createdAt', 'DESC');
    if (globalRole !== GlobalRole.MASTER) {
      qb.where('p.ownerId = :requesterId', { requesterId }).orWhere(
        `p.id IN (SELECT project_id FROM project_members WHERE user_id = :requesterId)`,
        { requesterId },
      );
    }
    const projects = await qb.getMany();
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

  async findOne(id: string, requesterId: string, globalRole: GlobalRole): Promise<ProjectWithCounts> {
    const project = await this.findEntity(id);
    await this.assertAccess(project, requesterId, globalRole);
    const counts = await this.countDatasetsByProject([id]);
    return { ...project, datasetCount: counts.get(id) ?? 0 };
  }

  async update(id: string, requesterId: string, globalRole: GlobalRole, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findEntity(id);
    this.assertOwnerOrMaster(project, requesterId, globalRole);
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

  async remove(id: string, requesterId: string, globalRole: GlobalRole): Promise<void> {
    const project = await this.findEntity(id);
    this.assertOwnerOrMaster(project, requesterId, globalRole);
    await this.repo().softDelete(id);
  }

  async listMembers(id: string, requesterId: string, globalRole: GlobalRole): Promise<User[]> {
    const project = await this.findEntity(id);
    await this.assertAccess(project, requesterId, globalRole);
    const rows = await this.membersRepo().find({ where: { projectId: id } });
    if (rows.length === 0) return [];
    return this.usersRepo().find({ where: rows.map((r) => ({ id: r.userId })) });
  }

  /**
   * Real project-level invite, 2026-08-20: grants visibility only, not a role — must already be a
   * real tenant member (this doesn't bring in a brand-new person, that's the tenant-wide invite
   * flow in UsersService). Master or the project's own owner can add someone.
   */
  async addMember(id: string, requesterId: string, globalRole: GlobalRole, dto: AddProjectMemberDto): Promise<void> {
    const project = await this.findEntity(id);
    this.assertOwnerOrMaster(project, requesterId, globalRole);

    const target = await this.usersRepo().findOne({ where: { tenantId: project.tenantId, email: dto.email } });
    if (!target) {
      throw new BadRequestException(
        `${dto.email} isn't a member of this team yet. Invite them from Settings first, then add them to the project.`,
      );
    }
    if (target.id === project.ownerId) {
      throw new BadRequestException(`${dto.email} already owns this project.`);
    }

    const existing = await this.membersRepo().findOne({ where: { projectId: id, userId: target.id } });
    if (existing) {
      throw new BadRequestException(`${dto.email} already has access to this project.`);
    }

    await this.membersRepo().save(
      this.membersRepo().create({
        tenantId: project.tenantId,
        projectId: id,
        userId: target.id,
        addedByUserId: requesterId,
      }),
    );
  }

  async removeMember(id: string, requesterId: string, globalRole: GlobalRole, memberUserId: string): Promise<void> {
    const project = await this.findEntity(id);
    this.assertOwnerOrMaster(project, requesterId, globalRole);
    if (memberUserId === project.ownerId) {
      throw new BadRequestException('The project owner cannot be removed from their own project.');
    }
    await this.membersRepo().delete({ projectId: id, userId: memberUserId });
  }

  /**
   * Real access check shared with DatasetsService — a dataset's own privacy is only as real as
   * its parent project's, so every dataset read/write goes through this too via its `projectId`.
   * A Master or the project's owner always has access; anyone else needs a real `project_members`
   * row. Throws NotFoundException, not ForbiddenException, deliberately — a private project a
   * caller isn't on shouldn't even confirm it exists.
   */
  async assertAccess(project: Project, requesterId: string, globalRole: GlobalRole): Promise<void> {
    if (globalRole === GlobalRole.MASTER || project.ownerId === requesterId) {
      return;
    }
    const member = await this.membersRepo().findOne({ where: { projectId: project.id, userId: requesterId } });
    if (!member) {
      throw new NotFoundException(`Project ${project.id} not found.`);
    }
  }

  /** Same shape as `assertAccess`, for callers that only have a projectId (DatasetsService). */
  async assertAccessById(projectId: string, requesterId: string, globalRole: GlobalRole): Promise<void> {
    await this.assertAccess(await this.findEntity(projectId), requesterId, globalRole);
  }

  private assertOwnerOrMaster(project: Project, requesterId: string, globalRole: GlobalRole): void {
    if (globalRole !== GlobalRole.MASTER && project.ownerId !== requesterId) {
      throw new ForbiddenException('Only the project owner or a Master can do this.');
    }
  }
}

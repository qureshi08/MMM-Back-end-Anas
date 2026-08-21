import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Project } from './project.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Real project-level visibility, 2026-08-20 (Anas + Amna's decision): a project is invite-only,
 * not automatically visible to every tenant member the way it was before this table existed —
 * `ProjectsService.findAll`/`findOne` filtered nothing beyond tenant scope, so any signed-in
 * member could see any project. A row here grants visibility, not permission — what a member can
 * *do* once they can see a project still comes from their existing tenant-wide GlobalRole
 * (Master/Read/Read-Write), deliberately not a second per-project role system. The project's owner
 * and any tenant Master always have access without a row here — see
 * `ProjectsService.assertAccess`.
 */
@Entity('project_members')
@Index('IDX_project_members_project_id', ['projectId'])
@Unique('UQ_project_members_project_user', ['projectId', 'userId'])
export class ProjectMember extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'added_by_user_id', type: 'uuid' })
  addedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'added_by_user_id' })
  addedByUser: User;
}

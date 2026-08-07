import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `projects`, per Database Schema Design v1.1 (Proposed) — the first
 * business table built after `tenants`/`users` themselves, and the first
 * one whose RLS policy and app-role grants come from this migration alone
 * (CreateAppRole1785900000002's `ALTER DEFAULT PRIVILEGES` already covers
 * the grants automatically; only the policy needs writing here, same shape
 * as EnableUsersRls1785900000001).
 *
 * Soft-delete via `deleted_at`, matching `users`. A deleted project's row
 * stays for audit purposes; application queries filter it out.
 */
export class AddProjectsTable1785900000003 implements MigrationInterface {
  name = 'AddProjectsTable1785900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   uuid NOT NULL
                      CONSTRAINT "FK_projects_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name"        text NOT NULL,
        "description" text NULL,
        "owner_id"    uuid NOT NULL
                      CONSTRAINT "FK_projects_owner" REFERENCES "users"("id") ON DELETE CASCADE,
        "status"      text NOT NULL DEFAULT 'active'
                      CONSTRAINT "CHK_projects_status" CHECK ("status" IN ('active', 'archived')),
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        "deleted_at"  timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_projects_tenant_id" ON "projects" ("tenant_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_projects_owner_id" ON "projects" ("owner_id");
    `);

    await queryRunner.query(`ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "projects"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "projects";`);
    await queryRunner.query(`ALTER TABLE "projects" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP TABLE "projects";`);
  }
}

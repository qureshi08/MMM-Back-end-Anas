import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real project-level visibility, Anas + Amna's decision 2026-08-20: a project should be
 * invite-only, not automatically visible to every tenant member. `project_members` grants
 * visibility only — what a member can *do* once they can see a project still comes from their
 * existing tenant-wide role, not a second per-project role system. A project's owner and any
 * tenant Master always have access without a row here (see `ProjectsService.assertAccess`).
 *
 * Also adds `datasets.created_by_user_id` — real "model owner" for display, the person who
 * actually uploaded that dataset, not the project's owner (a project commonly has more than one
 * uploader). Backfilled from the parent project's `owner_id` for existing rows, the closest real
 * fact available for data that predates this column; every new upload sets the real uploader.
 */
export class AddProjectMembersAndDatasetOwner1785900000012 implements MigrationInterface {
  name = 'AddProjectMembersAndDatasetOwner1785900000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          uuid NOT NULL
                             CONSTRAINT "FK_project_members_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "project_id"         uuid NOT NULL
                             CONSTRAINT "FK_project_members_project" REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id"            uuid NOT NULL
                             CONSTRAINT "FK_project_members_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "added_by_user_id"   uuid NOT NULL
                             CONSTRAINT "FK_project_members_added_by" REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_members_project_id" ON "project_members" ("project_id");
    `);

    await queryRunner.query(`ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "project_members" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "project_members"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);

    await queryRunner.query(`
      ALTER TABLE "datasets" ADD COLUMN "created_by_user_id" uuid NULL
        CONSTRAINT "FK_datasets_created_by" REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    // Both tables have FORCE ROW LEVEL SECURITY, and a migration runs with no app.tenant_id set —
    // same real gap hit in 1785900000011, the backfill below would silently match zero rows
    // otherwise. Lifted only for this one statement.
    await queryRunner.query(`ALTER TABLE "datasets" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "projects" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      UPDATE "datasets" d SET "created_by_user_id" = p."owner_id"
      FROM "projects" p WHERE p."id" = d."project_id" AND d."created_by_user_id" IS NULL;
    `);
    await queryRunner.query(`ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "datasets" FORCE ROW LEVEL SECURITY;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "datasets" DROP COLUMN "created_by_user_id";`);

    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "project_members";`);
    await queryRunner.query(`ALTER TABLE "project_members" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "project_members" DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP TABLE "project_members";`);
  }
}

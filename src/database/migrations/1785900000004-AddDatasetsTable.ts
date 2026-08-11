import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `datasets`, per CMP-38 as scoped 2026-08-11 (Farhan's real feedback,
 * `dev-log/raw/2026-08-11.md`). Points at wherever its file actually lives
 * (`storage_provider` + `storage_key`) rather than storing the file itself.
 * Same shape as `AddProjectsTable1785900000003`: RLS with `FORCE`, same
 * `tenant_isolation` policy wording, soft delete via `deleted_at`.
 *
 * `model_type` is a real, caller-supplied choice (confirmed 2026-08-11,
 * final answer after two corrections that day): a dropdown, same shape as
 * Cassandra's, deliberately built to scale to more models. Only 'meridian'
 * is allowed today because that's the only one that's real yet, not
 * because the column is fixed — adding a second real model later is a new
 * migration widening this CHECK, not a schema redesign. No DEFAULT, on
 * purpose: this has to be an explicit choice, not an implicit one.
 */
export class AddDatasetsTable1785900000004 implements MigrationInterface {
  name = 'AddDatasetsTable1785900000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "datasets" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"        uuid NOT NULL
                           CONSTRAINT "FK_datasets_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "project_id"       uuid NOT NULL
                           CONSTRAINT "FK_datasets_project" REFERENCES "projects"("id") ON DELETE CASCADE,
        "name"             text NOT NULL,
        "model_type"       text NOT NULL
                           CONSTRAINT "CHK_datasets_model_type" CHECK ("model_type" IN ('meridian')),
        "storage_provider" text NOT NULL DEFAULT 'cloudflare_r2'
                           CONSTRAINT "CHK_datasets_storage_provider" CHECK ("storage_provider" IN ('cloudflare_r2', 'azure_blob')),
        "storage_key"      text NOT NULL,
        "file_name"        text NOT NULL,
        "file_size_bytes"  bigint NOT NULL,
        "mime_type"        text NOT NULL,
        "status"           text NOT NULL DEFAULT 'uploaded'
                           CONSTRAINT "CHK_datasets_status" CHECK ("status" IN ('uploaded', 'validated', 'failed')),
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_datasets_tenant_id" ON "datasets" ("tenant_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_datasets_project_id" ON "datasets" ("project_id");
    `);

    await queryRunner.query(`ALTER TABLE "datasets" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "datasets" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "datasets"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "datasets";`);
    await queryRunner.query(`ALTER TABLE "datasets" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "datasets" DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP TABLE "datasets";`);
  }
}

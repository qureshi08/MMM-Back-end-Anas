import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real Settings-page features, 2026-08-19: member invites, real roles on
 * arrival, and real email notifications when a training run finishes.
 *
 * `tenant_invites` records a real, pending role assignment for an email
 * that hasn't signed in yet — TenantResolutionService checks this at
 * first-login and applies the invited role instead of the previous
 * "everyone becomes Administrator" default, which was flagged as
 * provisional from the start (CMP-42, 2026-08-04) and never revisited
 * until now. The partial unique index allows re-inviting someone whose
 * earlier invite was already accepted, only one *pending* invite per
 * tenant+email at a time.
 */
export class AddMembersAndNotifications1785900000010 implements MigrationInterface {
  name = 'AddMembersAndNotifications1785900000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "notification_preferences" jsonb NOT NULL
          DEFAULT '{"runCompleted": true, "runFailed": true, "weeklyDigest": false}'::jsonb;
    `);

    await queryRunner.query(`
      ALTER TABLE "datasets"
        ADD COLUMN "trained_by_user_id" uuid NULL,
        ADD COLUMN "notified_at" timestamptz NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "tenant_invites" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          uuid NOT NULL
                             CONSTRAINT "FK_tenant_invites_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "email"              text NOT NULL,
        "role"               text NOT NULL
                             CHECK ("role" IN ('marketing_analyst', 'marketing_manager', 'data_scientist', 'administrator')),
        "invited_by_user_id" uuid NOT NULL
                             CONSTRAINT "FK_tenant_invites_invited_by" REFERENCES "users"("id") ON DELETE CASCADE,
        "invited_at"         timestamptz NOT NULL DEFAULT now(),
        "accepted_at"        timestamptz NULL,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tenant_invites_tenant_id" ON "tenant_invites" ("tenant_id");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_tenant_invites_tenant_email_pending"
        ON "tenant_invites" ("tenant_id", "email") WHERE "accepted_at" IS NULL;
    `);

    await queryRunner.query(`ALTER TABLE "tenant_invites" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "tenant_invites" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "tenant_invites"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "tenant_invites";`);
    await queryRunner.query(`ALTER TABLE "tenant_invites" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "tenant_invites" DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP TABLE "tenant_invites";`);

    await queryRunner.query(`
      ALTER TABLE "datasets"
        DROP COLUMN "trained_by_user_id",
        DROP COLUMN "notified_at";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "notification_preferences";
    `);
  }
}

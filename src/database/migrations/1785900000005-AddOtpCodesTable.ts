import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The custom email one-time-code second factor, decided 2026-08-11 after
 * discovering Microsoft Entra's own Security Defaults MFA is effectively
 * invisible to test (silent SSO reuse, no visible code, needs Reports
 * Reader access even to confirm it fired). This gives a real, always-shown
 * code instead, sent through Microsoft Graph (see GraphMailService), fully
 * within this app's own control.
 *
 * Same shape as every other table: RLS with FORCE, `tenant_isolation`
 * policy. `code_hash` stores a SHA-256 of the six-digit code, never the
 * code itself, so a database read alone can't hand someone a valid code.
 */
export class AddOtpCodesTable1785900000005 implements MigrationInterface {
  name = 'AddOtpCodesTable1785900000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "otp_codes" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    uuid NOT NULL
                       CONSTRAINT "FK_otp_codes_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "user_id"      uuid NOT NULL
                       CONSTRAINT "FK_otp_codes_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "code_hash"    text NOT NULL,
        "expires_at"   timestamptz NOT NULL,
        "attempts"     integer NOT NULL DEFAULT 0,
        "consumed_at"  timestamptz NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_otp_codes_tenant_id" ON "otp_codes" ("tenant_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_otp_codes_user_id" ON "otp_codes" ("user_id");
    `);

    await queryRunner.query(`ALTER TABLE "otp_codes" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "otp_codes" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "otp_codes"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "otp_codes";`);
    await queryRunner.query(`ALTER TABLE "otp_codes" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "otp_codes" DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP TABLE "otp_codes";`);
  }
}

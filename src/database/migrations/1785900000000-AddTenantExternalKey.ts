import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the column TenantResolutionService uses to find-or-create a tenant
 * on first login (CMP-42). No existing rows to backfill in any environment
 * this has run in yet, so it goes straight in as NOT NULL, matching the
 * entity.
 */
export class AddTenantExternalKey1785900000000 implements MigrationInterface {
  name = 'AddTenantExternalKey1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN "external_key" text NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_tenants_external_key" ON "tenants" ("external_key");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_tenants_external_key";`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "external_key";`);
  }
}

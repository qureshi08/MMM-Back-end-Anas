import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real incident, 2026-08-21: removing a member soft-deletes their `users` row, but
 * `UQ_users_tenant_email` was a plain unique index with no `WHERE` clause — it counted a
 * soft-deleted row toward uniqueness forever. The next time that person signed in,
 * `TenantResolutionService.resolveOrProvision` correctly found no active row for them (its own
 * lookup already excludes soft-deleted rows), tried to create a new one, and hit this same
 * constraint — a real, permanent 500 on every single request they made, live during a call. Made
 * partial (`WHERE deleted_at IS NULL`), matching the pattern `tenant_invites`' own partial index
 * already used for the identical "removed, can come back later" shape.
 */
export class ReplaceUsersEmailIndexWithPartialUnique1785900000013 implements MigrationInterface {
  name = 'ReplaceUsersEmailIndexWithPartialUnique1785900000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_users_tenant_email";`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_tenant_email"
        ON "users" ("tenant_id", "email") WHERE "deleted_at" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_users_tenant_email";`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_tenant_email" ON "users" ("tenant_id", "email");
    `);
  }
}

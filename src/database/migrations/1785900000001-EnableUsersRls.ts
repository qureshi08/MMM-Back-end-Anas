import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The actual Row-Level Security enforcement the schema's tenant_id columns
 * were designed for (Design Principle 1) — this is what TypeORM's
 * QueryRunner pattern was chosen to support, and until this migration it
 * was still just a plan, not a real constraint. Without it, tenant_id is
 * only data; any bug in application code could still read across tenants.
 *
 * FORCE is required, not just ENABLE — Postgres skips RLS for a table's own
 * owner by default, and the app's DB user owns every table it migrated.
 * Without FORCE, this policy would silently do nothing.
 *
 * app.tenant_id is set per-request via set_config(..., true) inside a
 * transaction (see TenantContextInterceptor), so it never leaks between
 * requests sharing a pooled connection. current_setting(..., true) with
 * missing_ok=true means an unset session (nothing has called set_config
 * yet) matches zero rows rather than erroring — fail closed, not open.
 */
export class EnableUsersRls1785900000001 implements MigrationInterface {
  name = 'EnableUsersRls1785900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "users" FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "users"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "users";`);
    await queryRunner.query(`ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;`);
  }
}

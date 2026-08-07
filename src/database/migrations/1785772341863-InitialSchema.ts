import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First migration: tenants and users only — exactly what today's Auth
 * module needs, nothing ahead of it. The other eleven tables in Database
 * Schema Design v1.1 (Proposed) come in one migration per module, as each
 * one gets built, following this same shape:
 *   - every table: id uuid primary key default gen_random_uuid(), then the
 *     table's own columns, then created_at / updated_at timestamptz
 *   - a text column standing in for an enum gets an explicit CHECK
 *     constraint naming the allowed values, so a typo can't silently insert
 *     a status nothing in the app understands
 *   - foreign keys are always ON DELETE CASCADE unless a table is a
 *     platform-wide audit trail (not the case for either table here)
 *
 * PostgreSQL 16 ships gen_random_uuid() in core — no extension required.
 */
export class InitialSchema1785772341863 implements MigrationInterface {
  name = 'InitialSchema1785772341863';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"        text NOT NULL,
        "status"      text NOT NULL DEFAULT 'active'
                      CONSTRAINT "CHK_tenants_status" CHECK ("status" IN ('active', 'suspended', 'deprovisioned')),
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   uuid NOT NULL
                      CONSTRAINT "FK_users_tenant" REFERENCES "tenants"("id") ON DELETE CASCADE,
        "email"       text NOT NULL,
        "first_name"  text NOT NULL,
        "last_name"   text NOT NULL,
        "global_role" text NOT NULL
                      CONSTRAINT "CHK_users_global_role" CHECK (
                        "global_role" IN ('marketing_analyst', 'marketing_manager', 'data_scientist', 'administrator')
                      ),
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        "deleted_at"  timestamptz NULL
      );
    `);

    // Email is unique per tenant, not globally — the same person can belong
    // to more than one customer organization. See the schema review notes.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_tenant_email" ON "users" ("tenant_id", "email");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_tenant_id" ON "users" ("tenant_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TABLE "tenants";`);
  }
}

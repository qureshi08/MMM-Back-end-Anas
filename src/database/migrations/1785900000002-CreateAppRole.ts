import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the role the running app actually connects as (DB_USERNAME),
 * separate from the Postgres bootstrap superuser (DB_ADMIN_USERNAME) that
 * runs migrations. Found the hard way while testing CMP-42's RLS policy,
 * 2026-08-04: Postgres exempts superusers from Row-Level Security
 * unconditionally, and refuses to ever demote a bootstrap user off
 * superuser ("the bootstrap user must have the SUPERUSER attribute"). A
 * second, genuinely restricted role is the only way RLS does anything.
 *
 * Password comes from DB_PASSWORD (the same one app.module.ts already
 * connects with) rather than being duplicated here — one source of truth,
 * can't drift out of sync with .env.
 *
 * Grants are additive and idempotent (DO blocks check before creating), so
 * this migration is safe to have already run once nothing here changes.
 */
export class CreateAppRole1785900000002 implements MigrationInterface {
  name = 'CreateAppRole1785900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUsername = process.env.DB_USERNAME;
    const appPassword = process.env.DB_PASSWORD;
    if (!appUsername || !appPassword) {
      throw new Error('DB_USERNAME/DB_PASSWORD must be set to create the app role — check .env.');
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${appUsername}') THEN
          CREATE ROLE "${appUsername}" LOGIN PASSWORD '${appPassword}';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `GRANT CONNECT ON DATABASE "${queryRunner.connection.options.database}" TO "${appUsername}";`,
    );
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO "${appUsername}";`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appUsername}";`,
    );
    // Every future migration's new tables are covered automatically —
    // nobody has to remember to re-grant when the next module's table
    // shows up.
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${appUsername}";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const appUsername = process.env.DB_USERNAME;
    if (!appUsername) return;
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${appUsername}";
    `);
    await queryRunner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${appUsername}";`);
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM "${appUsername}";`);
    await queryRunner.query(
      `REVOKE CONNECT ON DATABASE "${queryRunner.connection.options.database}" FROM "${appUsername}";`,
    );
    await queryRunner.query(`DROP ROLE IF EXISTS "${appUsername}";`);
  }
}

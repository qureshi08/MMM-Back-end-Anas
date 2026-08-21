import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real role redesign, Anas 2026-08-20: the 4 marketing-titled roles (Marketing Analyst, Marketing
 * Manager, Data Scientist, Administrator) never actually gated anything beyond member management
 * — every signed-in member could create/edit/train/delete projects and datasets regardless of
 * role. Replaced with 3 real permission tiers: Master (member management + everything Read/Write
 * has), Read/Write (create/edit/train/delete projects and datasets, no member management), Read
 * (view everything, change nothing). Enforced in `assertWriteAccess()`/`requireMaster()`, not just
 * relabeled.
 *
 * Existing data mapping, applied before the constraints change so nothing is ever briefly invalid:
 * `administrator` -> `master` (same people, same real capability). The 3 working-member roles all
 * map to `read_write` — every one of those users already had full create/edit/train/delete access
 * under the old (unenforced) system, so this is the non-disruptive choice; nobody's workflow breaks
 * on deploy. Anyone who should actually be Read-only gets moved there by a Master, same as any
 * other role change, through the real UI built for this feature.
 */
export class ReplaceGlobalRolesWithPermissionTiers1785900000011 implements MigrationInterface {
  name = 'ReplaceGlobalRolesWithPermissionTiers1785900000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Real ordering bug hit running this migration once already: the old CHECK constraints only
    // allow the 4 old values, so an UPDATE writing 'master'/'read_write' has to happen *after*
    // they're dropped, not before — doing it in the other order fails immediately on the very
    // first row. Constraints go first now, data second, new constraints last.
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_global_role";`);
    await queryRunner.query(`ALTER TABLE "tenant_invites" DROP CONSTRAINT "tenant_invites_role_check";`);

    // Both tables have FORCE ROW LEVEL SECURITY, so even the owning role's own UPDATE gets
    // filtered by the tenant_isolation policy — with no app.tenant_id set (a migration runs
    // outside any request), current_setting() is null and the policy matches nothing, so the
    // UPDATE below would silently touch zero rows across every tenant except whichever one a
    // prior query happened to have set. Lifting FORCE for the length of each statement, same as
    // the table owner already could without it, then restoring it.
    await queryRunner.query(`ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      UPDATE "users" SET "global_role" = CASE "global_role"
        WHEN 'administrator' THEN 'master'
        ELSE 'read_write'
      END;
    `);
    await queryRunner.query(`ALTER TABLE "users" FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`ALTER TABLE "tenant_invites" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      UPDATE "tenant_invites" SET "role" = CASE "role"
        WHEN 'administrator' THEN 'master'
        ELSE 'read_write'
      END;
    `);
    await queryRunner.query(`ALTER TABLE "tenant_invites" FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_global_role"
        CHECK ("global_role" IN ('master', 'read', 'read_write'));
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_role_check"
        CHECK ("role" IN ('master', 'read', 'read_write'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_invites" DROP CONSTRAINT "tenant_invites_role_check";`);
    await queryRunner.query(`
      ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_role_check"
        CHECK ("role" IN ('marketing_analyst', 'marketing_manager', 'data_scientist', 'administrator'));
    `);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_global_role";`);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_global_role"
        CHECK ("global_role" IN ('marketing_analyst', 'marketing_manager', 'data_scientist', 'administrator'));
    `);

    await queryRunner.query(`ALTER TABLE "tenant_invites" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      UPDATE "tenant_invites" SET "role" = CASE "role"
        WHEN 'master' THEN 'administrator'
        ELSE 'marketing_analyst'
      END;
    `);
    await queryRunner.query(`ALTER TABLE "tenant_invites" FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      UPDATE "users" SET "global_role" = CASE "global_role"
        WHEN 'master' THEN 'administrator'
        ELSE 'marketing_analyst'
      END;
    `);
    await queryRunner.query(`ALTER TABLE "users" FORCE ROW LEVEL SECURITY;`);
  }
}

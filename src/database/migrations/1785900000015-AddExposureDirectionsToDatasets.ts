import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `exposure_directions` — the real, saved answer to the Exposure Metrics screen's
 * "does this column help or hurt your outcome," per control/organic column. Built 2026-09-07
 * alongside the real correlation-based suggestion backend (see compute-exposure-metrics.ts) —
 * that screen previously had nothing real behind it at all.
 */
export class AddExposureDirectionsToDatasets1785900000015 implements MigrationInterface {
  name = 'AddExposureDirectionsToDatasets1785900000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "datasets" ADD COLUMN "exposure_directions" jsonb NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "datasets" DROP COLUMN "exposure_directions";`);
  }
}

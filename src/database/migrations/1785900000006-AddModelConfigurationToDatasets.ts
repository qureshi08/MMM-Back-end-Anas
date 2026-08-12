import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The four pieces Hammad's real contract needs beyond the raw file, in the
 * order the frontend collects them (see the Cassandra mapping table in
 * `dev-log/for-anas/modeling-engine-explained.html` Section 04):
 * Configure -> column_mapping + kpi_type, Optimize -> the training date
 * range, Calibrate -> model_configuration.calibration, Hyperparameterization
 * -> model_configuration.channels. All four live on the dataset row itself,
 * nullable until that step is actually saved, since one dataset is one
 * model-in-progress in the current design, not a separate table.
 */
export class AddModelConfigurationToDatasets1785900000006 implements MigrationInterface {
  name = 'AddModelConfigurationToDatasets1785900000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        ADD COLUMN "column_mapping" jsonb NULL,
        ADD COLUMN "kpi_type" text NULL CHECK ("kpi_type" IN ('revenue', 'non_revenue')),
        ADD COLUMN "date_range" jsonb NULL,
        ADD COLUMN "calibration" jsonb NULL,
        ADD COLUMN "channel_hyperparameters" jsonb NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        DROP COLUMN "column_mapping",
        DROP COLUMN "kpi_type",
        DROP COLUMN "date_range",
        DROP COLUMN "calibration",
        DROP COLUMN "channel_hyperparameters";
    `);
  }
}

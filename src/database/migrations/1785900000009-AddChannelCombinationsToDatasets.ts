import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real gap found 2026-08-18: "combine similar channels" only ever affected the Optimize preview
 * chart, never what actually got sent to training. Meridian correctly rejected a dataset with
 * extreme multicollinearity (paid_social_spend, VIF > 1000) because the "combined" channel was
 * still reaching it as two separate raw columns. This stores the real combination decision so
 * Assembly can actually apply it before building the job file.
 */
export class AddChannelCombinationsToDatasets1785900000009 implements MigrationInterface {
  name = 'AddChannelCombinationsToDatasets1785900000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        ADD COLUMN "channel_combinations" jsonb NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        DROP COLUMN "channel_combinations";
    `);
  }
}

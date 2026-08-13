import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real training against Hammad's worker is on hold (2026-08-12, blocked on decisions still with
 * Farhan). Decided with Anas: a mock training run instead, same real result shape as Hammad's own
 * sample output, so the swap to a real trained model later only ever means changing where the data
 * comes from.
 */
export class AddMockTrainingToDatasets1785900000008 implements MigrationInterface {
  name = 'AddMockTrainingToDatasets1785900000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        ADD COLUMN "job_id" text NULL,
        ADD COLUMN "dataset_reference" text NULL,
        ADD COLUMN "training_status" text NOT NULL DEFAULT 'not_started'
          CHECK ("training_status" IN ('not_started', 'running', 'completed', 'failed')),
        ADD COLUMN "training_started_at" timestamptz NULL,
        ADD COLUMN "results" jsonb NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        DROP COLUMN "job_id",
        DROP COLUMN "dataset_reference",
        DROP COLUMN "training_status",
        DROP COLUMN "training_started_at",
        DROP COLUMN "results";
    `);
  }
}

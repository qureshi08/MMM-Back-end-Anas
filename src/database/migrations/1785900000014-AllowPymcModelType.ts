import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widens datasets.model_type to allow 'pymc' — Hammad's second real handover
 * (Resources/Handover MMM - Hammad/PyMC Testing Published/), 2026-08-27. The original CHECK
 * constraint only allowed 'meridian' because that was the only real engine at the time
 * (1785900000004's own comment already called this "a fact about the roadmap, not a reason to
 * remove the choice from the API").
 */
export class AllowPymcModelType1785900000014 implements MigrationInterface {
  name = 'AllowPymcModelType1785900000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "datasets" DROP CONSTRAINT "CHK_datasets_model_type";`);
    await queryRunner.query(`
      ALTER TABLE "datasets" ADD CONSTRAINT "CHK_datasets_model_type"
        CHECK ("model_type" IN ('meridian', 'pymc'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "datasets" DROP CONSTRAINT "CHK_datasets_model_type";`);
    await queryRunner.query(`
      ALTER TABLE "datasets" ADD CONSTRAINT "CHK_datasets_model_type"
        CHECK ("model_type" IN ('meridian'));
    `);
  }
}

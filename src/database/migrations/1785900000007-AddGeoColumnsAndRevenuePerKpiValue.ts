import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two real fields Hammad's actual API Contracts document requires that Configure never collected:
 * `geo_columns` (his own note: "not yet present in the current database schema, this needs to be
 * added there") and `revenue_per_kpi_value` (required whenever kpi_type is non_revenue). Found by
 * cross-checking the real contract doc after Hammad said the frontend "feels like some data is
 * missing" — it was, provably, not a vague impression.
 *
 * `geo_columns` lives inside the existing `column_mapping` jsonb (same shape as date/target/media/
 * control/organic columns, no schema change needed there). `revenue_per_kpi_value` gets its own
 * column, same pattern as `kpi_type` itself.
 */
export class AddGeoColumnsAndRevenuePerKpiValue1785900000007 implements MigrationInterface {
  name = 'AddGeoColumnsAndRevenuePerKpiValue1785900000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        ADD COLUMN "revenue_per_kpi_value" numeric NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
        DROP COLUMN "revenue_per_kpi_value";
    `);
  }
}

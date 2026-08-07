import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { validate } from '../config/env.validation';
import { buildDataSourceOptions } from '../config/database.config';

/**
 * The DataSource the TypeORM CLI uses for `npm run migration:generate` /
 * `migration:run` / `migration:revert`. This file runs outside a Nest
 * application context — Nest's ConfigModule never gets a chance to load
 * .env — so it loads and validates .env itself, through the exact same
 * validate() the app uses, then builds options through the exact same
 * buildDataSourceOptions() the app uses. Same rules, same host/database,
 * same SSL setting, just a different entry point.
 *
 * Deliberately NOT the same username as the app, though (see
 * DB_ADMIN_USERNAME's comment in env.validation.ts) — migrations need
 * DDL rights (CREATE TABLE, CREATE POLICY, ...) that the app's own
 * restricted role should never have.
 */
loadEnv();

const env = validate(process.env as Record<string, unknown>);

export default new DataSource(
  buildDataSourceOptions({
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_USERNAME: env.DB_ADMIN_USERNAME,
    DB_PASSWORD: env.DB_ADMIN_PASSWORD,
    DB_NAME: env.DB_NAME,
    DB_SSL: env.DB_SSL,
    DB_SYNCHRONIZE: env.DB_SYNCHRONIZE,
    DB_LOGGING: env.DB_LOGGING,
  }),
);

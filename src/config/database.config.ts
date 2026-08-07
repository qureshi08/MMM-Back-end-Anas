import { DataSourceOptions } from 'typeorm';

/**
 * The one function that decides how we talk to Postgres. Both the running
 * app (via TypeOrmModule.forRootAsync, see app.module.ts) and the migration
 * CLI (see src/database/data-source.ts) call this, so "it works when I run
 * the app but the migration connects somewhere else" can't happen.
 *
 * Nothing here branches on an environment *name*. Local Docker Postgres and
 * Azure Postgres Flexible Server are both just "a Postgres reachable at
 * DB_HOST with these credentials, SSL on or off" — moving from one to the
 * other is a .env change, never a code change.
 */
export function buildDataSourceOptions(env: {
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
  DB_SYNCHRONIZE: boolean;
  DB_LOGGING: boolean;
}): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    // Azure Postgres Flexible Server rejects plain connections outright.
    // rejectUnauthorized: false accepts Azure's managed certificate chain
    // without pinning a specific CA file — fine for Dev, worth revisiting
    // with a pinned CA bundle before this ever points at a Prod database.
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsTableName: 'schema_migrations',
    // Always false: see DB_SYNCHRONIZE's comment in .env.example. Schema
    // changes go through a migration, every time, in every environment.
    synchronize: env.DB_SYNCHRONIZE,
    logging: env.DB_LOGGING,
  };
}

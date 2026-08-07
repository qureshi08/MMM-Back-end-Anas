import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Every environment variable the app reads, in one place, typed and
 * validated. If one is missing or malformed the app refuses to start with a
 * message naming exactly which one — not a stack trace three layers deep
 * the first time something tries to use it.
 */
class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  /**
   * A separate, elevated role used only by the migration CLI (see
   * data-source.ts) — not the running app. Row-Level Security cannot apply
   * to a Postgres superuser no matter what a policy says (CMP-42,
   * 2026-08-04: found empirically, the official Postgres Docker image's
   * bootstrap user is a superuser and Postgres refuses to ever demote it).
   * DB_USERNAME above is the restricted, non-superuser role the app
   * actually queries as, so RLS is real for it.
   */
  @IsString()
  @IsNotEmpty()
  DB_ADMIN_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_ADMIN_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsBoolean()
  DB_SSL: boolean;

  @IsBoolean()
  DB_SYNCHRONIZE: boolean;

  @IsBoolean()
  DB_LOGGING: boolean;

  @IsString()
  @IsNotEmpty()
  AZURE_AD_TENANT_ID: string;

  @IsString()
  @IsNotEmpty()
  AZURE_AD_AUDIENCE: string;

  @IsBoolean()
  AUTH_DEV_BYPASS: boolean;
}

/** class-validator sees strings for everything coming out of process.env, so
 * booleans and numbers are coerced by hand before validation runs. */
function coerce(config: Record<string, unknown>): Record<string, unknown> {
  const asBool = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v);
  return {
    ...config,
    PORT: Number(config.PORT),
    DB_PORT: Number(config.DB_PORT),
    DB_SSL: asBool(config.DB_SSL),
    DB_SYNCHRONIZE: asBool(config.DB_SYNCHRONIZE),
    DB_LOGGING: asBool(config.DB_LOGGING),
    AUTH_DEV_BYPASS: asBool(config.AUTH_DEV_BYPASS),
  };
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, coerce(config), {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration — check your .env file:\n${details}`);
  }

  if (validated.AUTH_DEV_BYPASS && validated.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_DEV_BYPASS=true with NODE_ENV=production. This would let every ' +
        'request into the API unauthenticated. Refusing to start.',
    );
  }

  return validated;
}

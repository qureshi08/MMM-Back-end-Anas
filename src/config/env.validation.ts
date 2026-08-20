import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
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

  /**
   * Cloudflare R2, the Dev-stage dataset storage backend (CMP-38, decided
   * 2026-08-11). Optional, unlike every other variable above: R2 setup is
   * real infra work still in progress, and the rest of the app has to keep
   * booting without it. `CloudflareR2StorageService` throws a clear error
   * the moment a dataset route actually needs these and they're missing,
   * see `storage.provider.ts`.
   */
  @IsOptional()
  @IsString()
  R2_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  R2_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  R2_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  R2_BUCKET_NAME?: string;

  /**
   * Microsoft Graph, for the custom email one-time-code second factor
   * (decided 2026-08-11, see OtpService). A separate app registration from
   * AZURE_AD_TENANT_ID/AZURE_AD_AUDIENCE above, own client credentials,
   * own client secret, kept apart from the public sign-in flow on purpose.
   * Optional, same reasoning as R2_* above.
   */
  @IsOptional()
  @IsString()
  GRAPH_MAIL_TENANT_ID?: string;

  @IsOptional()
  @IsString()
  GRAPH_MAIL_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GRAPH_MAIL_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GRAPH_MAIL_SENDER?: string;

  /**
   * Real member-invite and training-notification emails link back into the app — this is the base
   * URL to build those links against (e.g. https://mmm-frontend-amna.vercel.app). Optional: without
   * it, those emails still send, just without a clickable link, same "degrade, don't block" pattern
   * as every other optional integration here.
   */
  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;
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

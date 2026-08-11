import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { CloudflareR2StorageService } from './cloudflare-r2-storage.service';
import { StorageService } from './storage.service';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/**
 * `R2_*` are optional in `env.validation.ts` on purpose (unlike every
 * `DB_*`/`AZURE_AD_*` var, which refuse to boot if missing): Cloudflare R2
 * setup is real infra work still in progress as of 2026-08-11, and the rest
 * of the app must keep running without it. `CloudflareR2StorageService`
 * itself throws a clear error the moment a dataset route actually tries to
 * use it unconfigured, so the gap is loud at the one place it matters, not
 * silent everywhere else.
 */
export const storageServiceProvider: Provider = {
  provide: STORAGE_SERVICE,
  useFactory: (config: ConfigService): StorageService => {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucketName = config.get<string>('R2_BUCKET_NAME');

    const options =
      accountId && accessKeyId && secretAccessKey && bucketName
        ? { accountId, accessKeyId, secretAccessKey, bucketName }
        : null;

    return new CloudflareR2StorageService(options);
  },
  inject: [ConfigService],
};

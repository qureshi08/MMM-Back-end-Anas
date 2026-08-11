/**
 * Every dataset file goes through this interface, never a storage SDK
 * called directly from `DatasetsService`. Dev runs on Cloudflare R2
 * (`CloudflareR2StorageService`); the real Azure Marketplace target is
 * Azure Blob Storage. Swapping providers later means writing one new class
 * against this same interface and changing the provider in
 * `storage.provider.ts`, not touching `DatasetsService` at all.
 */
export interface StorageService {
  /** Stores the file under `key`, overwriting whatever was there before. */
  upload(key: string, body: Buffer, mimeType: string): Promise<void>;

  /** A time-limited URL the caller can download the file from directly. */
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  delete(key: string): Promise<void>;
}

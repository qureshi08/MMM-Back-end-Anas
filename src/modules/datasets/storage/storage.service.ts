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

  /**
   * The first `maxBytes` of the file, not the whole thing. For a file that
   * could be up to 200 MB, reading a column header row never needs more
   * than a few KB — this lets the caller ask for just that without paying
   * for a full download.
   */
  downloadPrefix(key: string, maxBytes: number): Promise<Buffer>;

  /** The whole file. Only call this when the real content is actually needed (e.g. assembling a job payload), not just a header preview. */
  download(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;
}

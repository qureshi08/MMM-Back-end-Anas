import { InternalServerErrorException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

export interface CloudflareR2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

/**
 * R2 is S3-compatible (Cloudflare's own documented API), so the AWS SDK
 * works against it unmodified once pointed at R2's own endpoint with
 * `region: "auto"` — no Cloudflare-specific SDK needed.
 *
 * Options can be `null` (see `storage.provider.ts`): the module loads even
 * before a real Cloudflare account and bucket exist, so a developer without
 * R2 credentials yet can still boot the app and hit every other route.
 * Actually calling a dataset upload/download/delete route without R2
 * configured throws a clear error here, not an opaque AWS SDK failure three
 * layers down.
 */
export class CloudflareR2StorageService implements StorageService {
  private readonly client: S3Client | null;

  constructor(private readonly options: CloudflareR2Options | null) {
    this.client = options
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          },
        })
      : null;
  }

  private requireClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.options) {
      throw new InternalServerErrorException(
        'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
          'R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to use dataset storage.',
      );
    }
    return { client: this.client, bucket: this.options.bucketName };
  }

  async upload(key: string, body: Buffer, mimeType: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mimeType }),
    );
  }

  async getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const { client, bucket } = this.requireClient();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

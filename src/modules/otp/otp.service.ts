import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { createHash, randomInt } from 'node:crypto';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { OtpCode } from './entities/otp-code.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GRAPH_MAIL_SERVICE } from './mail/graph-mail.provider';
import { GraphMailService } from './mail/graph-mail.service';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * `otp_codes` has Row-Level Security, same reasoning as every other
 * tenant-owned table — queries go through the per-request tenant-scoped
 * `QueryRunner`, no `@InjectRepository`.
 */
@Injectable()
export class OtpService {
  constructor(@Inject(GRAPH_MAIL_SERVICE) private readonly mail: GraphMailService) {}

  private repo() {
    return getTenantContext().queryRunner.manager.getRepository(OtpCode);
  }

  async requestCode(user: AuthenticatedUser): Promise<void> {
    if (!user.email) {
      throw new BadRequestException('This account has no email on file, cannot send a code.');
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

    await this.repo().save(
      this.repo().create({
        tenantId: user.tenantId!,
        userId: user.userId!,
        codeHash: hashCode(code),
        expiresAt,
        attempts: 0,
        consumedAt: null,
      }),
    );

    await this.mail.sendMail(
      user.email,
      'Your MMM Platform verification code',
      otpEmailHtml(code),
    );
  }

  async verifyCode(user: AuthenticatedUser, code: string): Promise<void> {
    const active = await this.repo().findOne({
      where: { userId: user.userId!, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!active) {
      throw new NotFoundException('No active code for this account. Request a new one.');
    }
    if (active.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('That code expired. Request a new one.');
    }
    if (active.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many incorrect attempts. Request a new one.');
    }

    active.attempts += 1;
    await this.repo().save(active);

    if (hashCode(code) !== active.codeHash) {
      throw new UnauthorizedException('Incorrect code.');
    }

    active.consumedAt = new Date();
    await this.repo().save(active);
  }
}

function otpEmailHtml(code: string): string {
  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;border:1px solid #E2E8E4;border-radius:16px;">
      <h2 style="font-family:Georgia,'Times New Roman',serif;color:#0C1A10;margin:0 0 16px;">Your verification code</h2>
      <p style="color:#374151;margin:0 0 20px;">Use this code to finish signing in. It expires in ${CODE_TTL_MINUTES} minutes.</p>
      <div style="background:#F7F8F7;border-radius:12px;padding:20px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#0C1A10;">
        ${code}
      </div>
      <p style="color:#6B7280;font-size:13px;margin:20px 0 0;">If you didn't request this, you can ignore this email.</p>
    </div>
  `.trim();
}

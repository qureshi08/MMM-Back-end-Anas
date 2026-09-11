import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { OtpService } from './otp.service';
import { OtpCode } from './entities/otp-code.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** A real, minimal fake of the one repo method surface OtpService actually calls. */
function fakeRepo() {
  const rows: OtpCode[] = [];
  return {
    rows,
    create: (partial: Partial<OtpCode>) => ({ id: randomUUID(), ...partial }) as OtpCode,
    save: async (row: OtpCode) => {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i === -1) rows.push(row);
      else rows[i] = row;
      return row;
    },
    findOne: async ({ where }: { where: { userId: string; consumedAt: null } }) => {
      const matches = rows
        .filter((r) => r.userId === where.userId && r.consumedAt === null)
        .sort((a, b) => (b as any).createdAt - (a as any).createdAt);
      return matches[0] ?? null;
    },
  };
}

describe('OtpService.verifyCode', () => {
  const user: AuthenticatedUser = { userId: randomUUID(), tenantId: randomUUID(), email: 'a@b.com' } as AuthenticatedUser;
  let repo: ReturnType<typeof fakeRepo>;
  let service: OtpService;

  beforeEach(() => {
    repo = fakeRepo();
    service = new OtpService({ sendMail: jest.fn() } as any);
    jest.spyOn(service as any, 'repo').mockReturnValue(repo);
  });

  function seedActiveCode(realCode: string, attempts = 0): void {
    const row: any = {
      id: randomUUID(),
      userId: user.userId,
      tenantId: user.tenantId,
      codeHash: hashCode(realCode),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      attempts,
      consumedAt: null,
      createdAt: Date.now(),
    };
    repo.rows.push(row);
  }

  it('throws with a real attemptsRemaining count on a wrong guess', async () => {
    seedActiveCode('123456', 0);
    await expect(service.verifyCode(user, '000000')).rejects.toMatchObject({
      response: { message: 'Incorrect code.', attemptsRemaining: 4 },
    });
  });

  it('counts down attemptsRemaining across repeated wrong guesses on the same code', async () => {
    seedActiveCode('123456', 0);
    for (const expected of [4, 3, 2, 1, 0]) {
      await expect(service.verifyCode(user, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
      const active = repo.rows[0];
      expect(Math.max(0, 5 - active.attempts)).toBe(expected);
    }
  });

  it('blocks with attemptsRemaining 0 once the real 5-attempt limit is hit, even for the right code', async () => {
    seedActiveCode('123456', 5);
    await expect(service.verifyCode(user, '123456')).rejects.toMatchObject({
      response: { message: 'Too many incorrect attempts. Request a new one.', attemptsRemaining: 0 },
    });
  });

  it('succeeds on the real correct code within the attempt limit', async () => {
    seedActiveCode('123456', 2);
    await expect(service.verifyCode(user, '123456')).resolves.toBeUndefined();
    expect(repo.rows[0].consumedAt).not.toBeNull();
  });

  it('throws NotFoundException when there is no active code at all', async () => {
    await expect(service.verifyCode(user, '123456')).rejects.toBeInstanceOf(NotFoundException);
  });
});

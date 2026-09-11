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
    findOne: async ({ where }: { where: Partial<Record<'userId' | 'consumedAt', unknown>> }) => {
      // Every real call in this service that filters by consumedAt uses IsNull() — this fake only
      // ever needs to tell "filter to unconsumed" apart from "no filter at all," not model IsNull().
      const matches = rows
        .filter((r) => r.userId === where.userId)
        .filter((r) => !('consumedAt' in where) || r.consumedAt === null)
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

describe('OtpService.requestCode', () => {
  const user: AuthenticatedUser = { userId: randomUUID(), tenantId: randomUUID(), email: 'a@b.com' } as AuthenticatedUser;
  let repo: ReturnType<typeof fakeRepo>;
  let service: OtpService;

  beforeEach(() => {
    repo = fakeRepo();
    service = new OtpService({ sendMail: jest.fn() } as any);
    jest.spyOn(service as any, 'repo').mockReturnValue(repo);
  });

  function seedRecentCode(secondsAgo: number, consumed = false): void {
    repo.rows.push({
      id: randomUUID(),
      userId: user.userId,
      tenantId: user.tenantId,
      codeHash: 'irrelevant',
      expiresAt: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      consumedAt: consumed ? new Date() : null,
      createdAt: new Date(Date.now() - secondsAgo * 1000),
    } as any);
  }

  it('sends a real first code with no prior history', async () => {
    await expect(service.requestCode(user)).resolves.toBeUndefined();
    expect(repo.rows).toHaveLength(1);
  });

  it('real gap found live 2026-09-11: blocks a resend requested less than 30s after the last one', async () => {
    seedRecentCode(5);
    await expect(service.requestCode(user)).rejects.toMatchObject({
      response: { message: expect.stringContaining('Please wait'), retryAfterSeconds: 25 },
    });
    expect(repo.rows).toHaveLength(1); // no second row got created
  });

  it('allows a resend once the real 30s cooldown has passed', async () => {
    seedRecentCode(31);
    await expect(service.requestCode(user)).resolves.toBeUndefined();
    expect(repo.rows).toHaveLength(2);
  });

  it('the cooldown applies even against an already-consumed code, not just an active one', async () => {
    seedRecentCode(5, true);
    await expect(service.requestCode(user)).rejects.toMatchObject({
      response: { retryAfterSeconds: 25 },
    });
  });
});

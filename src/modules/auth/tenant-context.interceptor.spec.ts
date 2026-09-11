import { CallHandler, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantResolutionService } from './tenant-resolution.service';

function fakeQueryRunner() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {},
  };
}

function fakeContext(user: unknown) {
  const request: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function fakeHandler(next: CallHandler['handle']): CallHandler {
  return { handle: next } as CallHandler;
}

describe('TenantContextInterceptor', () => {
  function build(queryRunner: ReturnType<typeof fakeQueryRunner>) {
    const dataSource = { createQueryRunner: () => queryRunner } as any;
    const tenantResolution = {
      resolveOrProvision: jest.fn().mockResolvedValue({ tenantId: 't1', userId: 'u1', globalRole: 'member' }),
    } as unknown as TenantResolutionService;
    return new TenantContextInterceptor(dataSource, tenantResolution);
  }

  it('commits a real write made before the handler completes normally', (done) => {
    const queryRunner = fakeQueryRunner();
    const interceptor = build(queryRunner);
    const handler = fakeHandler(() => of('ok'));

    interceptor.intercept(fakeContext({ userId: 'u1' }), handler).subscribe({
      complete: () => {
        expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('real bug this session: commits, not rolls back, a real write made before a normal 4xx rejection', (done) => {
    const queryRunner = fakeQueryRunner();
    const interceptor = build(queryRunner);
    const handler = fakeHandler(() => throwError(() => new UnauthorizedException('Incorrect code.')));

    interceptor.intercept(fakeContext({ userId: 'u1' }), handler).subscribe({
      error: () => {
        expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('still rolls back on a genuinely unexpected, non-HTTP failure', (done) => {
    const queryRunner = fakeQueryRunner();
    const interceptor = build(queryRunner);
    const handler = fakeHandler(() => throwError(() => new Error('genuinely unexpected')));

    interceptor.intercept(fakeContext({ userId: 'u1' }), handler).subscribe({
      error: () => {
        expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('skips tenant resolution and passes through untouched for a real @Public() route', (done) => {
    const queryRunner = fakeQueryRunner();
    const interceptor = build(queryRunner);
    const handler = fakeHandler(() => of('public-ok'));

    interceptor.intercept(fakeContext(undefined), handler).subscribe({
      next: (value) => expect(value).toBe('public-ok'),
      complete: () => {
        expect(queryRunner.connect).not.toHaveBeenCalled();
        done();
      },
    });
  });
});

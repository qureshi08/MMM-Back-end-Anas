import { ArgumentsHost, BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function fakeHost(url = '/api/v1/auth/otp/verify') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = { url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('keeps real extra fields from the exception body, not just message', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = fakeHost();

    filter.catch(new UnauthorizedException({ message: 'Incorrect code.', attemptsRemaining: 3 }), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Incorrect code.',
      attemptsRemaining: 3,
      path: '/api/v1/auth/otp/verify',
      timestamp: expect.any(String),
    });
  });

  it('never lets the exception body\'s own statusCode/error override the real HTTP status', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = fakeHost();

    filter.catch(new BadRequestException('Bad input.'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Bad input.',
      path: '/api/v1/auth/otp/verify',
      timestamp: expect.any(String),
    });
  });

  it('reports a real 500 for a non-HTTP exception, without crashing on it', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = fakeHost();

    filter.catch(new Error('genuinely unexpected'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/auth/otp/verify',
      timestamp: expect.any(String),
    });
  });

  it('still reports the real status for a built-in exception with no custom body', () => {
    const filter = new AllExceptionsFilter();
    const { host, status } = fakeHost();

    filter.catch(new InternalServerErrorException(), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Every error response — validation failure, a rejected token, an unhandled
 * exception — comes back in the same shape. One format for the whole API
 * from the first endpoint, not something to retrofit once four developers
 * have each picked their own.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const message = 'message' in bodyObj ? bodyObj.message : isHttpException ? exception.message : 'Internal server error';

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    // Real bug found live 2026-09-11: this filter used to keep only `message` from the thrown
    // exception's own response body, silently dropping every other field — confirmed live when
    // OtpService's real `attemptsRemaining` field never reached the client at all, even though the
    // service genuinely set it on every failed verify. `statusCode`, `message`, and Nest's own
    // built-in `error` field (e.g. "Unauthorized") are excluded here since this filter already
    // sets its own canonical `statusCode`/`message` below — everything else a real exception adds
    // on purpose (like `attemptsRemaining`) now survives instead of being thrown away.
    const { statusCode: _statusCode, message: _message, error: _error, ...extra } = bodyObj;

    response.status(status).json({
      statusCode: status,
      message,
      ...extra,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

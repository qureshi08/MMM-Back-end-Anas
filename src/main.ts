import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Matches what the Angular frontend already calls (environment.ts's
  // apiBaseUrl ends in /api/v1) — found while writing the cross-team
  // deployment protocol, 2026-08-06, before it ever became a live bug.
  app.setGlobalPrefix('api/v1');

  // The Angular SPA runs on its own origin (Vercel today, Static Web Apps
  // or Blob + Front Door once on Azure). Tighten this to the real deployed
  // origin once it exists — wide open is fine for local Dev only.
  app.enableCors();

  if (config.get<boolean>('AUTH_DEV_BYPASS')) {
    logger.warn(
      '⚠ AUTH_DEV_BYPASS is ON — every request is being treated as an ' +
        'authenticated dev user, no real Entra token required. Never set ' +
        'this in a deployed environment (the app refuses to boot with it ' +
        'on if NODE_ENV=production, but check your Azure App Settings too).',
    );
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`MMM backend listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  // Most likely cause here: env.validation.ts rejected the .env file.
  // That message is already clear — just surface it and exit, rather than
  // an unhandled-rejection warning that hides why the process didn't start.
  console.error('Failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});

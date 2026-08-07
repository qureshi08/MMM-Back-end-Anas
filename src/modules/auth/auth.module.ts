import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { EntraAuthGuard } from './guards/entra-auth.guard';
import { entraJwtVerifierProvider } from './entra-jwt-verifier.provider';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [UsersModule, TenantsModule],
  controllers: [AuthController],
  providers: [
    entraJwtVerifierProvider,
    TenantResolutionService,
    // Registered globally: every route in the app goes through this guard
    // unless the handler (or its whole controller) is marked @Public().
    { provide: APP_GUARD, useClass: EntraAuthGuard },
    // Runs immediately after the guard on every route the guard didn't skip
    // — resolves who's asking to a tenant + user and opens their
    // RLS-scoped database session for the rest of the request.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AuthModule {}

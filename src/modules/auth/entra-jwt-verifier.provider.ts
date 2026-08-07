import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { EntraJwtVerifier } from './entra-jwt.verifier';

export const ENTRA_JWT_VERIFIER = Symbol('ENTRA_JWT_VERIFIER');
export type EntraJwtVerifierProvider = EntraJwtVerifier;

/**
 * Built once at startup, not per request — `jose`'s remote JWKS carries its
 * own in-memory cache of Microsoft's signing keys, and constructing a new
 * one per request would throw that cache away every time.
 */
export const entraJwtVerifierProvider: Provider = {
  provide: ENTRA_JWT_VERIFIER,
  useFactory: (config: ConfigService) =>
    new EntraJwtVerifier({
      tenantId: config.getOrThrow<string>('AZURE_AD_TENANT_ID'),
      audience: config.getOrThrow<string>('AZURE_AD_AUDIENCE'),
    }),
  inject: [ConfigService],
};

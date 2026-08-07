import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';

/**
 * Verifies an Entra ID (Azure AD) access token as a resource server. No
 * Passport, no MSAL — a bearer JWT resource server is just "check the
 * signature, the issuer, and the audience", and `jose` does that in about
 * twenty lines, so that's all this is.
 *
 * The one real subtlety: when the app registration is multi-tenant
 * (AZURE_AD_TENANT_ID="common"), the issuer is different for every signing
 * organization — "https://login.microsoftonline.com/<their-tenant-id>/v2.0"
 * — so there is no single fixed issuer string to pin. We still fetch the
 * JWKS from Microsoft's own /common/ discovery endpoint (Microsoft serves
 * the same rotating key set there regardless of which tenant actually
 * signed the token — `jose` matches the right key by `kid`), and once the
 * signature has actually been verified we check the *shape* of the issuer
 * rather than one exact string: it must be a real Microsoft v2 issuer URL.
 * That is what proves "some real Entra tenant issued this", which is the
 * correct trust boundary for "any customer organization can sign in".
 *
 * If AZURE_AD_TENANT_ID is a specific tenant GUID instead of "common", we
 * pin the exact issuer, which additionally restricts sign-in to that one
 * tenant — tighter, for when the app registration is single-tenant.
 */

const MICROSOFT_V2_ISSUER_PATTERN =
  /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/i;

export interface EntraVerifierOptions {
  tenantId: string; // a tenant GUID, or the literal "common"
  audience: string;
}

export class EntraJwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly pinnedIssuer: string | null;
  /**
   * Both forms of the configured audience, `api://<id>` and the bare id.
   * Found the hard way, 2026-08-06: Entra does not consistently issue the
   * full Application ID URI as `aud` — for this app registration it issued
   * just the bare Client ID instead. Accepting either form is the correct
   * fix, not guessing which one a given registration will produce.
   */
  private readonly acceptedAudiences: string[];

  constructor(private readonly options: EntraVerifierOptions) {
    const discoveryUrl = new URL(
      `https://login.microsoftonline.com/${options.tenantId}/discovery/v2.0/keys`,
    );
    this.jwks = createRemoteJWKSet(discoveryUrl);
    this.pinnedIssuer =
      options.tenantId.toLowerCase() === 'common'
        ? null
        : `https://login.microsoftonline.com/${options.tenantId}/v2.0`;

    const bareId = options.audience.replace(/^api:\/\//, '');
    this.acceptedAudiences = [bareId, `api://${bareId}`];
  }

  async verify(bearerToken: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(bearerToken, this.jwks, {
      audience: this.acceptedAudiences,
      issuer: this.pinnedIssuer ?? undefined,
    });

    if (!this.pinnedIssuer) {
      const issuer = typeof payload.iss === 'string' ? payload.iss : '';
      if (!MICROSOFT_V2_ISSUER_PATTERN.test(issuer)) {
        throw new Error(`Token issuer "${issuer}" is not a recognised Microsoft Entra v2 issuer.`);
      }
    }

    return payload;
  }
}

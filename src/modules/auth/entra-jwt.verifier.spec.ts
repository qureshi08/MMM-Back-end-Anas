import { jwtVerify } from 'jose';
import { EntraJwtVerifier } from './entra-jwt.verifier';

// createRemoteJWKSet would make a real HTTP call to Microsoft on
// construction-adjacent use; jwtVerify is what actually decides pass/fail.
// Mocking both keeps this test offline and fast, and lets us drive exactly
// the payload/error scenarios that matter: the multi-tenant issuer check.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'FAKE_JWKS'),
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

describe('EntraJwtVerifier', () => {
  const AUDIENCE = 'api://test-app-id-uri';
  // Entra doesn't consistently issue the full api:// URI as `aud` — found
  // 2026-08-06 testing a real login, the token came back with just the bare
  // Client ID instead. The verifier accepts both forms; these tests check
  // exactly that, not just the one originally configured.
  const EXPECTED_AUDIENCES = ['test-app-id-uri', 'api://test-app-id-uri'];
  const REAL_TENANT_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    mockedJwtVerify.mockReset();
  });

  describe('multi-tenant mode (tenantId: "common")', () => {
    const verifier = new EntraJwtVerifier({ tenantId: 'common', audience: AUDIENCE });

    it('accepts a token whose issuer is a real-shaped Microsoft v2 issuer', async () => {
      mockedJwtVerify.mockResolvedValue({
        payload: {
          iss: `https://login.microsoftonline.com/${REAL_TENANT_ID}/v2.0`,
          tid: REAL_TENANT_ID,
        },
        protectedHeader: { alg: 'RS256' },
      } as any);

      const payload = await verifier.verify('irrelevant-in-this-test');
      expect(payload.tid).toBe(REAL_TENANT_ID);

      // no fixed issuer is pinned when the tenant is "common" — the
      // multi-tenant issuer varies per signing organization
      expect(mockedJwtVerify.mock.calls[0][2]).toMatchObject({
        audience: EXPECTED_AUDIENCES,
        issuer: undefined,
      });
    });

    it('rejects a token whose issuer does not look like a Microsoft v2 issuer', async () => {
      mockedJwtVerify.mockResolvedValue({
        payload: { iss: 'https://not-microsoft.example.com/whatever', tid: 'x' },
        protectedHeader: { alg: 'RS256' },
      } as any);

      await expect(verifier.verify('irrelevant-in-this-test')).rejects.toThrow(/not a recognised/i);
    });

    it('propagates a signature/expiry failure from jose as-is', async () => {
      mockedJwtVerify.mockRejectedValue(new Error('signature verification failed'));
      await expect(verifier.verify('bad-token')).rejects.toThrow('signature verification failed');
    });
  });

  describe('single-tenant mode (a specific tenant GUID)', () => {
    it('pins the exact issuer for that tenant', async () => {
      const verifier = new EntraJwtVerifier({ tenantId: REAL_TENANT_ID, audience: AUDIENCE });
      mockedJwtVerify.mockResolvedValue({
        payload: {
          iss: `https://login.microsoftonline.com/${REAL_TENANT_ID}/v2.0`,
          tid: REAL_TENANT_ID,
        },
        protectedHeader: { alg: 'RS256' },
      } as any);

      await verifier.verify('irrelevant-in-this-test');

      expect(mockedJwtVerify.mock.calls[0][2]).toMatchObject({
        audience: EXPECTED_AUDIENCES,
        issuer: `https://login.microsoftonline.com/${REAL_TENANT_ID}/v2.0`,
      });
    });
  });
});

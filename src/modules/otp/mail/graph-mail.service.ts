import { InternalServerErrorException } from '@nestjs/common';
import { ClientSecretCredential } from '@azure/identity';

export interface GraphMailOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderAddress: string;
}

/**
 * Sends real mail through Microsoft Graph, as `senderAddress`, using a
 * dedicated app registration's own client-credentials identity, not a
 * signed-in user's token. This is a separate app registration from the one
 * users sign in through (2026-08-11 decision: keep the confidential-client
 * secret this needs fully apart from the public sign-in flow).
 *
 * A plain `fetch()` call against Graph's REST API rather than the full
 * `@microsoft/microsoft-graph-client` SDK, same reasoning as
 * `EntraJwtVerifier` choosing `jose` directly over a heavier auth library,
 * one HTTP call doesn't need a whole SDK.
 *
 * `options` can be `null`, same pattern as `CloudflareR2StorageService`:
 * the module loads even before real Graph credentials exist, and only
 * throws when a route actually tries to send mail.
 */
export class GraphMailService {
  private readonly credential: ClientSecretCredential | null;

  constructor(private readonly options: GraphMailOptions | null) {
    this.credential = options
      ? new ClientSecretCredential(options.tenantId, options.clientId, options.clientSecret)
      : null;
  }

  async sendMail(to: string, subject: string, htmlBody: string): Promise<void> {
    if (!this.credential || !this.options) {
      throw new InternalServerErrorException(
        'Microsoft Graph mail is not configured. Set GRAPH_MAIL_TENANT_ID, ' +
          'GRAPH_MAIL_CLIENT_ID, GRAPH_MAIL_CLIENT_SECRET, and GRAPH_MAIL_SENDER.',
      );
    }

    const token = await this.credential.getToken('https://graph.microsoft.com/.default');

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.options.senderAddress)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new InternalServerErrorException(
        `Microsoft Graph refused to send mail (${response.status}): ${detail}`,
      );
    }
  }
}

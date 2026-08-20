import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { GraphMailService } from './graph-mail.service';

export const GRAPH_MAIL_SERVICE = Symbol('GRAPH_MAIL_SERVICE');

/**
 * `GRAPH_MAIL_*` are optional in `env.validation.ts`, same reasoning as
 * `R2_*`: the app registration and secret were only just created
 * (2026-08-11), the rest of the app has to keep booting without them.
 */
export const graphMailServiceProvider: Provider = {
  provide: GRAPH_MAIL_SERVICE,
  useFactory: (config: ConfigService): GraphMailService => {
    const tenantId = config.get<string>('GRAPH_MAIL_TENANT_ID');
    const clientId = config.get<string>('GRAPH_MAIL_CLIENT_ID');
    const clientSecret = config.get<string>('GRAPH_MAIL_CLIENT_SECRET');
    const senderAddress = config.get<string>('GRAPH_MAIL_SENDER');

    const options =
      tenantId && clientId && clientSecret && senderAddress
        ? { tenantId, clientId, clientSecret, senderAddress }
        : null;

    return new GraphMailService(options);
  },
  inject: [ConfigService],
};

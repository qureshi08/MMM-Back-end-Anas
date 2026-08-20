import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GRAPH_MAIL_SERVICE } from './graph-mail.provider';
import { GraphMailService } from './graph-mail.service';

/**
 * The real email templates the app actually sends — member invites and
 * training completion/failure. One place for the HTML so a member invite
 * and a training email look like they came from the same product, and so
 * a broken `FRONTEND_URL` degrades to "no link" rather than a crash;
 * sending the email itself still matters even without one.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(GRAPH_MAIL_SERVICE) private readonly mail: GraphMailService,
    private readonly config: ConfigService,
  ) {}

  private frontendUrl(path: string): string | null {
    const base = this.config.get<string>('FRONTEND_URL');
    return base ? `${base.replace(/\/$/, '')}${path}` : null;
  }

  private wrap(title: string, bodyHtml: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#00994D">${title}</h2>
      ${bodyHtml}
      <p style="color:#6B7280;font-size:12px;margin-top:32px">MMM Platform &middot; Convergent Business Technologies</p>
    </div>`;
  }

  /** Real gap this closes, see failures logged if it throws: a caller inviting someone should know if the email genuinely didn't go out. */
  async sendInvite(email: string, tenantName: string, invitedByName: string): Promise<void> {
    const link = this.frontendUrl('/overview');
    const html = this.wrap(
      `You're invited to ${tenantName} on MMM Platform`,
      `<p>${invitedByName} added you to ${tenantName}'s Marketing Mix Modeling workspace.</p>
       <p>Sign in with your Microsoft account to get started.${
         link ? ` <a href="${link}" style="color:#00994D">Open MMM Platform</a>` : ''
       }</p>`,
    );
    try {
      await this.mail.sendMail(email, `You're invited to ${tenantName} on MMM Platform`, html);
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${email}: ${err}`);
    }
  }

  async sendRunCompleted(email: string, datasetId: string, datasetName: string): Promise<void> {
    const link = this.frontendUrl(`/models/${datasetId}`);
    const html = this.wrap(
      'Your model finished training',
      `<p><strong>${datasetName}</strong> finished training and real results are ready.</p>
       ${link ? `<p><a href="${link}" style="color:#00994D">View results</a></p>` : ''}`,
    );
    try {
      await this.mail.sendMail(email, `"${datasetName}" finished training`, html);
    } catch (err) {
      this.logger.error(`Failed to send run-completed email for dataset ${datasetId}: ${err}`);
    }
  }

  async sendRunFailed(email: string, datasetId: string, datasetName: string, errorMessage: string | null): Promise<void> {
    const link = this.frontendUrl(`/models/${datasetId}`);
    const html = this.wrap(
      'Training failed',
      `<p><strong>${datasetName}</strong> failed to train.</p>
       ${errorMessage ? `<p style="background:#FEF7E7;padding:12px;border-left:3px solid #F59E0B;white-space:pre-wrap">${errorMessage}</p>` : ''}
       ${link ? `<p><a href="${link}" style="color:#00994D">Open the dataset</a></p>` : ''}`,
    );
    try {
      await this.mail.sendMail(email, `"${datasetName}" failed to train`, html);
    } catch (err) {
      this.logger.error(`Failed to send run-failed email for dataset ${datasetId}: ${err}`);
    }
  }
}

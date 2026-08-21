import { ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantInvite } from '../tenants/entities/tenant-invite.entity';
import { DEFAULT_NOTIFICATION_PREFERENCES, GlobalRole, User } from '../users/entities/user.entity';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

/** Microsoft's fixed pseudo-tenant ID shared by every personal Microsoft account. */
const CONSUMERS_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

@Injectable()
export class TenantResolutionService {
  /**
   * First-login provisioning, per the 2026-08-04 decision: open signup, any
   * real Microsoft account including personal ones, no invite required.
   * Early-stage decision, revisit before general availability (gate new
   * tenant creation behind a real Marketplace subscription once billing
   * exists, see CMP-55/CMP-77).
   *
   * A company Entra tenant (its `tid`) maps to one platform tenant, shared
   * by everyone signing in from it. A personal Microsoft account can't be
   * grouped the same way — every personal account shares the exact same
   * fixed `tid`, Microsoft's own consumers pseudo-tenant — so each one gets
   * its own platform tenant instead. Whether there's a better way to group
   * personal accounts later is still explicitly undecided (see CMP-42's
   * description); this is the safe, reversible default chosen to unblock
   * building today, not a final answer.
   *
   * `manager` must be bound to a session that already has (or is about to
   * have) `app.tenant_id` set for the resolved tenant — this method sets it
   * itself, on this same manager, as soon as the tenant is known, so the
   * user lookup right after stays correctly RLS-scoped instead of running
   * on a session with no tenant context at all.
   */
  async resolveOrProvision(
    user: AuthenticatedUser,
    manager: EntityManager,
  ): Promise<{ tenantId: string; userId: string; globalRole: GlobalRole }> {
    const isPersonalAccount = user.tid === CONSUMERS_TENANT_ID;
    const externalKey = isPersonalAccount ? `personal:${user.oid}` : `org:${user.tid}`;

    const tenants = manager.getRepository(Tenant);
    let tenant = await tenants.findOne({ where: { externalKey } });
    const isNewTenant = !tenant;
    if (!tenant) {
      // Real bug, found 2026-08-20: this used to be `user.email`, so the whole
      // organization's tenant got permanently named after whichever single person
      // happened to sign in first (e.g. invite emails read "added you to
      // amna.minhas@convergentbt.com's workspace"). An org tenant's name is now
      // its email domain instead, since that's shared by everyone in it. A
      // personal Microsoft account has no domain to share with anyone else, so
      // it keeps using the individual's email.
      const domain = user.email?.split('@')[1];
      const name = isPersonalAccount ? (user.email ?? externalKey) : (domain ?? externalKey);
      tenant = await tenants.save(tenants.create({ name, externalKey }));
    }

    // Set before touching `users` — that table has Row-Level Security, this
    // session's app.tenant_id has to be set or every query against it,
    // including this lookup, returns nothing at all.
    await manager.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenant.id]);

    const email = user.email ?? `${user.oid}@unknown.local`;
    const users = manager.getRepository(User);
    let platformUser = await users.findOne({ where: { tenantId: tenant.id, email } });
    if (!platformUser) {
      const [firstName, ...rest] = (user.name ?? 'Unknown User').split(' ');

      // Real fix, 2026-08-19, for a gap flagged as provisional since this method was first
      // written: every new sign-in used to become Master, not just the first one. Now only the
      // first person into a genuinely brand-new tenant gets that — everyone else takes the role
      // a real pending invite already assigned them.
      const invites = manager.getRepository(TenantInvite);
      const pendingInvite = await invites.findOne({ where: { tenantId: tenant.id, email, acceptedAt: IsNull() } });

      // Real incident, 2026-08-21, caught live: an existing tenant used to be open — anyone
      // signing in got auto-created at Read, no invite needed. That silently undid "remove
      // member": the moment a removed person's browser made another request, they walked right
      // back in on their own, just downgraded to Read instead of actually being kept out. A
      // removed (or never-invited) email now can't rejoin an existing tenant at all until a
      // Master sends them a real invite — same open-signup rule stays for a genuinely brand-new
      // tenant (isNewTenant), that part was never the problem.
      if (!isNewTenant && !pendingInvite) {
        throw new ForbiddenException(
          `${email} isn't a member of this team. Ask a Master to invite you from Settings first.`,
        );
      }

      const globalRole = isNewTenant ? GlobalRole.MASTER : pendingInvite!.role;

      platformUser = await users.save(
        users.create({
          tenantId: tenant.id,
          email,
          firstName: firstName || 'Unknown',
          lastName: rest.join(' ') || 'User',
          globalRole,
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        }),
      );

      if (pendingInvite) {
        await invites.update(pendingInvite.id, { acceptedAt: new Date() });
      }
    }

    return { tenantId: tenant.id, userId: platformUser.id, globalRole: platformUser.globalRole };
  }
}

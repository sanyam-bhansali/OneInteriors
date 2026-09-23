import 'server-only';

/**
 * Studio applications — apply, review, approve.
 *
 * The shape of the funnel is deliberate: **studios apply, we approve, then
 * onboarding begins.** Nobody self-serves onto the roster, and an application
 * is never the same object as a Studio — an application is a *claim*, a Studio
 * is something we have checked. Keeping them separate means an unreviewed
 * applicant can never briefly exist as a studio row, which the whole product
 * rests on.
 *
 * Approval creates the Studio in ONBOARDING (invisible to customers), creates a
 * STUDIO user for the contact, and emails them a sign-in link. They then fill
 * in their own detail — which is both better data and less of our time than us
 * transcribing it.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { Prisma, ApplicationStatus } from '@prisma/client';
import {
  requireRole,
  getCurrentUser,
  hasRole,
  hashIp,
  type AuthUser,
} from '@/modules/auth/session';
import { validateGstin } from '@/modules/verification/gstin';
import { isValidEmail, normaliseEmail, requestMagicLink } from '@/modules/auth/magic-link';
import { sendApplicationReceived, sendApplicationRejected } from '@/modules/auth/email';
import { revokeAllSessions } from '@/modules/auth/session';
import { lakhsToPaise } from '@/lib/money';
import { normalisePhone } from './phone';
import { provisionWorkspace } from './provision';
import { revalidateRoster } from './roster-cache';
import { siteUrlFor } from '@/lib/site';

export type ApplyResult =
  /** `emailDelivered` false means the row was written but the acknowledgement
   *  did not send — the application stands, the studio just heard nothing. */
  | { ok: true; id: string; emailDelivered: boolean }
  | { ok: false; errors: Record<string, string> };

export interface ApplyInput {
  tradeName: string;
  legalName?: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  instagram?: string;
  localities: string[];
  gstin?: string;
  yearsActive?: number;
  teamSize?: number;
  minLakhs?: number;
  maxLakhs?: number;
  about?: string;
  howHeard?: string;
  ip?: string | null;
}

const MAX_PER_EMAIL_PER_DAY = 3;

export async function submitApplication(input: ApplyInput): Promise<ApplyResult> {
  const errors: Record<string, string> = {};

  const tradeName = input.tradeName?.trim() ?? '';
  const contactName = input.contactName?.trim() ?? '';
  const email = normaliseEmail(input.email ?? '');
  const phone = normalisePhone(input.phone ?? '');

  if (tradeName.length < 2) errors.tradeName = 'What is the studio called?';
  if (contactName.length < 2) errors.contactName = 'Who should we talk to?';
  if (!isValidEmail(email)) errors.email = "That doesn't look like an email address.";
  if (!phone) errors.phone = 'A 10-digit Indian mobile number, please.';
  if (input.localities.length === 0) errors.localities = 'Pick at least one area you work in.';

  // A GSTIN is optional at application — plenty of good studios are
  // proprietorships still getting registered. But if they give one, it has to
  // be real, and we can tell offline for free.
  let gstin: string | null = null;
  if (input.gstin?.trim()) {
    const result = validateGstin(input.gstin);
    if (!result.valid) errors.gstin = result.reason;
    else gstin = result.gstin;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  /**
   * No database, no application.
   *
   * Validation runs first deliberately: a studio who typed a bad GSTIN should
   * be told about the GSTIN, not about our infrastructure. But past this point
   * every line touches Prisma, and without this guard `/apply` rendered a
   * working form that threw an unhandled server-action exception on submit —
   * the studio sees a generic error and assumes they did something wrong.
   *
   * `requestConsultation` has always guarded this way. This one did not.
   */
  if (!hasDatabase()) {
    return {
      ok: false,
      errors: {
        form: 'We cannot take applications on this deployment yet. Write to us directly and we will pick it up by hand.',
      },
    };
  }

  // Cheap flood control. Not security — just enough that a bored person cannot
  // fill the review queue.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.studioApplication.count({
    where: { email, createdAt: { gte: since } },
  });
  if (recent >= MAX_PER_EMAIL_PER_DAY) {
    return { ok: false, errors: { form: "You've already applied today. We'll be in touch." } };
  }

  const application = await prisma.studioApplication.create({
    data: {
      tradeName,
      legalName: input.legalName?.trim() || null,
      contactName,
      email,
      phone: phone!,
      website: input.website?.trim() || null,
      instagram: input.instagram?.trim() || null,
      localities: input.localities,
      gstin,
      yearsActive: input.yearsActive ?? null,
      teamSize: input.teamSize ?? null,
      minProjectPaise: input.minLakhs ? BigInt(lakhsToPaise(input.minLakhs)) : null,
      maxProjectPaise: input.maxLakhs ? BigInt(lakhsToPaise(input.maxLakhs)) : null,
      about: input.about?.trim() || null,
      howHeard: input.howHeard?.trim() || null,
      ipHash: hashIp(input.ip),
    },
  });

  /**
   * Acknowledge it, and do not let a mail failure lose the application.
   *
   * The row is already written. If Resend is down, the right outcome is a
   * studio who applied successfully and did not get an email — not a studio
   * who is told their application failed when it did not. So this is after
   * the create, and its failure is logged rather than thrown.
   *
   * The delivery result is returned so ops can see, on the applications
   * screen, that this one never got its acknowledgement and may need a
   * personal note.
   */
  const ack = await sendApplicationReceived(email, {
    contactName,
    studioName: tradeName,
  }).catch((e) => {
    console.error('[apply] acknowledgement threw:', e);
    return { delivered: false, reason: 'threw' as const };
  });

  return { ok: true, id: application.id, emailDelivered: ack.delivered };
}

// ── Review ─────────────────────────────────────────────────────

/**
 * The application queue.
 *
 * `hasRole`, not `requireRole` — same reason as `listConsultations`, and the
 * same miss. This is awaited during the render of `/ops/applications`, and
 * `requireRole` throws, which races the layout's redirect and turns a
 * wrong-role visit into a 500.
 */
export async function listApplications(status?: ApplicationStatus) {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return [];
  return prisma.studioApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getApplication(id: string) {
  await requireRole('OPS');
  return prisma.studioApplication.findUnique({ where: { id } });
}

export type DecisionResult =
  | {
      ok: true;
      studioSlug?: string;
      /**
       * Did the sign-in email actually send?
       *
       * Approval used to report "a sign-in link is on its way" unconditionally,
       * with the mail result discarded. With no email provider configured that
       * sentence is false, nothing surfaces it, and the first anyone knows is a
       * studio saying they never received anything — by which point ops has
       * told them twice to check their spam folder.
       */
      emailDelivered?: boolean;
    }
  | { ok: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base: string, tx: Prisma.TransactionClient): Promise<string> {
  let slug = base || 'studio';
  let n = 1;
  while (await tx.studio.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/**
 * Approve an application.
 *
 * Creates the Studio in **ONBOARDING** — invisible to customers, unmatched, no
 * tier. It becomes visible only when ops has recorded enough checks to earn a
 * tier and flipped the status to ACTIVE. Approval means "worth our time", not
 * "vouched for".
 */
export async function approveApplication(id: string, note: string): Promise<DecisionResult> {
  const actor = await requireRole('OPS');

  try {
    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.studioApplication.findUniqueOrThrow({ where: { id } });
      if (app.status === 'APPROVED') throw new Error('Already approved.');

      const slug = await uniqueSlug(slugify(app.tradeName), tx);

      const studio = await tx.studio.create({
        data: {
          slug,
          tradeName: app.tradeName,
          legalName: app.legalName ?? app.tradeName,
          city: app.city,
          localities: app.localities,
          gstin: app.gstin,
          yearsActive: app.yearsActive,
          teamSize: app.teamSize,
          website: app.website,
          instagram: app.instagram,
          about: app.about,
          minProjectPaise: app.minProjectPaise,
          maxProjectPaise: app.maxProjectPaise,
          // Invisible until verified. Approval is not endorsement.
          status: 'ONBOARDING',
          tier: 'UNVERIFIED',
        },
      });

      /**
       * The contact becomes a STUDIO user and gets a sign-in link.
       *
       * The role must be set on the UPDATE branch too, not only on create.
       * Anyone can now self-serve a CUSTOMER account just by signing in with
       * an address, so a studio's contact may already exist as a customer by
       * the time we approve them — someone at the studio poking around the
       * site is enough. Without this, approval would leave them a CUSTOMER,
       * `/studio` would reject them, and they would be bounced to the homepage
       * with no explanation and no way to tell us what went wrong.
       *
       * Existing OPS and ADMIN accounts are never demoted: approving an
       * application is not a privilege change, and a form must not be able to
       * strip a staff account of its access.
       */
      const existing = await tx.user.findUnique({
        where: { email: app.email },
        select: { role: true },
      });
      const keepsElevatedRole = existing?.role === 'OPS' || existing?.role === 'ADMIN';

      const user = await tx.user.upsert({
        where: { email: app.email },
        create: { email: app.email, name: app.contactName, role: 'STUDIO' },
        update: {
          name: app.contactName,
          ...(keepsElevatedRole ? {} : { role: 'STUDIO' as const }),
        },
      });

      await tx.studioMember.upsert({
        where: { userId: user.id },
        create: { studioId: studio.id, userId: user.id, isOwner: true },
        update: { studioId: studio.id, isOwner: true },
      });

      await tx.studioApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          decisionReason: note.trim() || null,
          studioId: studio.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'application.approve',
          entityType: 'StudioApplication',
          entityId: id,
          before: { status: app.status } as Prisma.InputJsonValue,
          after: { status: 'APPROVED', studioId: studio.id, slug, note } as Prisma.InputJsonValue,
        },
      });

      return {
        slug,
        studioId: studio.id,
        email: app.email,
        contactName: app.contactName,
        tradeName: app.tradeName,
        userId: user.id,
      };
    });

    /**
     * The workspace, provisioned once, here.
     *
     * Their starter catalogue and their pipeline. Both used to be seeded
     * lazily on every page read — see `modules/studio/provision.ts` for why
     * that had to stop. It never throws: a studio who signs in to an empty
     * catalogue is a smaller problem than an approval that failed because a
     * starter row would not insert.
     */
    await provisionWorkspace(result.studioId);

    // The roster is cached for a minute; approving someone should not wait for
    // that to expire.
    await revalidateRoster();

    // Outside the transaction — a mail failure must not roll back the approval.
    // But it must be reported: the studio is now created and cannot get in.
    /* Every existing session for this account is killed before the welcome
       goes out.
       This flips a live CUSTOMER account to STUDIO in place, and until now
       nothing revoked what was already signed in. Anyone holding a session on
       that account — a shared laptop, a session an attacker had planted,
       a browser in an internet café — silently inherited studio access the
       moment we approved them. `revokeAllSessions` existed and was documented
       as "used when a role changes"; it had no callers. */
    await revokeAllSessions(result.userId);

    const sent = await requestMagicLink(result.email, {
      /* The studio host, not the public one. The cookie this link writes is
         host-only, so a link redeemed on the apex would sign them in somewhere
         `studio.oneinteriors.in` cannot see — and they would be asked to sign
         in again with no explanation. See `siteUrlFor`. */
      baseUrl: siteUrlFor('studio'),
      // Land them on their own dashboard rather than the homepage, and on a
      // sign-in page that leads with the email form they actually need.
      next: '/studio',
      /* The welcome, not the plain sign-in email — and a seven-day token.
         This link arrives unannounced, so a fifteen-minute expiry meant a
         studio reading it after a site visit clicked a dead link as their
         first experience of us. */
      purpose: 'invite',
      invite: { contactName: result.contactName, studioName: result.tradeName },
    });

    return {
      ok: true,
      studioSlug: result.slug,
      emailDelivered: sent.ok ? sent.delivered !== false : false,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not approve.' };
  }
}

/**
 * Reject an application.
 *
 * A reason is required. These are local businesses in one city who talk to each
 * other — a silent rejection is how a supply pool closes to you.
 */
export async function rejectApplication(id: string, reason: string): Promise<DecisionResult> {
  const actor = await requireRole('OPS');

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { ok: false, error: 'Give a reason. They will ask, and Pune is a small market.' };
  }

  /* Read before the transaction rather than capturing out of the closure.
     A `let` assigned only inside an async callback is invisible to TypeScript's
     control-flow analysis, which narrows it to `never` afterwards — and working
     around that with a cast would be hiding a real fact about when the value
     exists. Reading first is simpler and the row is not changing underneath us
     in the milliseconds between. */
  const app = await prisma.studioApplication.findUnique({
    where: { id },
    select: { email: true, contactName: true, tradeName: true, status: true },
  });
  if (!app) return { ok: false, error: 'That application no longer exists.' };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.studioApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          decisionReason: trimmed,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'application.reject',
          entityType: 'StudioApplication',
          entityId: id,
          before: { status: app.status } as Prisma.InputJsonValue,
          after: { status: 'REJECTED', reason: trimmed } as Prisma.InputJsonValue,
        },
      });
    });

    /**
     * Send the reason. Outside the transaction, deliberately.
     *
     * An email inside a transaction holds a database connection open for the
     * length of an HTTP call to a third party, and a slow provider becomes a
     * slow database. Worse, a transaction that rolls back after the send has
     * already gone out leaves a studio holding a rejection for a decision the
     * database does not record.
     *
     * The reverse failure is the safe one: rejected in our records, email did
     * not send, and the result says so.
     */
    const sent = await sendApplicationRejected(
      app.email,
      { contactName: app.contactName, studioName: app.tradeName },
      trimmed,
    ).catch((e) => {
      console.error('[apply] rejection email threw:', e);
      return { delivered: false };
    });

    return { ok: true, emailDelivered: sent.delivered };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reject.' };
  }
}

export async function setReviewing(id: string): Promise<DecisionResult> {
  const actor: AuthUser = await requireRole('OPS');
  await prisma.studioApplication.update({
    where: { id },
    data: { status: 'REVIEWING', reviewedById: actor.id },
  });
  return { ok: true };
}

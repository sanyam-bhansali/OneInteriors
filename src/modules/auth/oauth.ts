import 'server-only';

/**
 * Sign in with Google — the requests, the cookies and the session.
 *
 * The rules live in `oauth-google.ts` (pure, tested). This file does the
 * three round trips and hands over to the same session, brief-claim and
 * consent-claim path the emailed link uses, so a customer who signs in with
 * Google ends up exactly where one who signed in by code would.
 *
 * Nothing here is reachable when `googleOAuth()` is null: the start route
 * answers "not available" and no button links to it.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { googleOAuth, hasDatabase } from '@/lib/env';
import { safeNext } from '@/lib/site';
import { createSession, safeEqual } from './session';
import { claimBrief } from '@/modules/brief/repository';
import { claimConsent } from '@/modules/consent/record';
import { record } from '@/modules/analytics/record';
import {
  GOOGLE_TOKEN_URL,
  decideLink,
  googleAuthUrl,
  newOAuthSecret,
  readGoogleIdToken,
  type Role,
} from './oauth-google';

const STATE = 'oi_oauth_state';
const VERIFIER = 'oi_oauth_verifier';
const NEXT = 'oi_oauth_next';

/** Ten minutes to choose an account and come back. Then it starts again. */
const COOKIE_SECONDS = 10 * 60;

function callbackUrl(request: Request): string {
  return new URL('/auth/oauth/google/callback', request.url).toString();
}

/** Back to sign-in with a reason the page can explain. */
function failed(request: Request, reason: string): NextResponse {
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}

/** Step one: send the browser to Google, remembering what we will check. */
export async function beginGoogle(request: Request): Promise<NextResponse> {
  const config = googleOAuth();
  if (!config || !hasDatabase()) return failed(request, 'google-unavailable');

  const state = newOAuthSecret();
  const verifier = newOAuthSecret();
  const next = safeNext(new URL(request.url).searchParams.get('next'));

  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/oauth',
    maxAge: COOKIE_SECONDS,
  };
  jar.set(STATE, state, options);
  jar.set(VERIFIER, verifier, options);
  if (next) jar.set(NEXT, next, options);
  else jar.delete(NEXT);

  return NextResponse.redirect(
    googleAuthUrl({
      clientId: config.clientId,
      redirectUri: callbackUrl(request),
      state,
      verifier,
    }),
  );
}

/**
 * Step two: Google sent them back. Check the state, redeem the code, read
 * who they are, and sign them in.
 */
export async function completeGoogle(request: Request): Promise<NextResponse> {
  const config = googleOAuth();
  if (!config || !hasDatabase()) return failed(request, 'google-unavailable');

  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expectedState = jar.get(STATE)?.value ?? '';
  const verifier = jar.get(VERIFIER)?.value ?? '';
  const next = safeNext(jar.get(NEXT)?.value ?? null);
  // One use only, whatever happens next.
  jar.delete(STATE);
  jar.delete(VERIFIER);
  jar.delete(NEXT);

  // They pressed Cancel on Google's screen. Not an error; back where they were.
  if (params.get('error')) return NextResponse.redirect(new URL(next ?? '/sign-in', request.url));

  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  if (!expectedState || !verifier || !code || !safeEqual(state, expectedState)) {
    return failed(request, 'google');
  }

  let idToken: string | null = null;
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: callbackUrl(request),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // The status only — Google's error body can echo the code back.
      console.error('[oauth] google token exchange failed', response.status);
      return failed(request, 'google');
    }
    const body = (await response.json()) as { id_token?: unknown };
    idToken = typeof body.id_token === 'string' ? body.id_token : null;
  } catch (error) {
    console.error('[oauth] google token exchange error', error instanceof Error ? error.name : 'unknown');
    return failed(request, 'google');
  }
  if (!idToken) return failed(request, 'google');

  const read = readGoogleIdToken(idToken, config.clientId, Math.floor(Date.now() / 1000));
  if (!read.ok) {
    console.error('[oauth] google id token refused:', read.reason);
    return failed(request, 'google');
  }
  const identity = read.identity;
  if (!identity.email) return failed(request, 'google');

  const [linked, byEmail] = await Promise.all([
    prisma.authIdentity.findUnique({
      where: { provider_subject: { provider: 'GOOGLE', subject: identity.subject } },
      select: { user: { select: { id: true, role: true, deletedAt: true } } },
    }),
    prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true, role: true, deletedAt: true },
    }),
  ]);
  const shape = (u: { id: string; role: string; deletedAt: Date | null } | null | undefined) =>
    u ? { id: u.id, role: u.role as Role, deleted: u.deletedAt !== null } : null;

  const decision = decideLink({ linkedUser: shape(linked?.user), emailUser: shape(byEmail) });

  let userId: string;
  switch (decision.kind) {
    case 'refuse-staff':
      return failed(request, 'google-staff');
    case 'refuse-deleted':
      return failed(request, 'google');
    case 'sign-in':
      userId = decision.userId;
      await prisma.authIdentity.update({
        where: { provider_subject: { provider: 'GOOGLE', subject: identity.subject } },
        data: { lastUsedAt: new Date(), email: identity.email },
      });
      break;
    case 'link':
      userId = decision.userId;
      await prisma.authIdentity.create({
        data: { provider: 'GOOGLE', subject: identity.subject, userId, email: identity.email },
      });
      break;
    case 'create': {
      const user = await prisma.user.create({
        data: {
          email: identity.email,
          emailVerified: new Date(),
          name: identity.name,
          role: 'CUSTOMER',
          identities: {
            create: { provider: 'GOOGLE', subject: identity.subject, email: identity.email },
          },
        },
        select: { id: true },
      });
      userId = user.id;
      break;
    }
  }

  // A name from Google fills an empty one; it never overwrites what they told us.
  if (identity.name) {
    await prisma.user.updateMany({ where: { id: userId, name: null }, data: { name: identity.name } });
  }

  await createSession(userId, {
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  const { claimed, anonKey } = await claimBrief(userId);
  await claimConsent(userId, anonKey);
  if (claimed) await record('brief.claimed');
  await record('signin.completed');

  return NextResponse.redirect(new URL(next ?? (claimed ? '/match' : '/account'), request.url));
}

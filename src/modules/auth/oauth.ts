import 'server-only';

/**
 * Sign in with Google, Facebook and Apple — the requests, the cookies and the
 * session.
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
import { appleOAuth, facebookOAuth, googleOAuth, hasDatabase } from '@/lib/env';
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
import {
  APPLE_TOKEN_URL,
  FACEBOOK_ME_URL,
  FACEBOOK_TOKEN_URL,
  appSecretProof,
  appleAuthUrl,
  appleClientSecret,
  facebookAuthUrl,
  readAppleIdToken,
  readAppleUser,
  readFacebookProfile,
} from './oauth-social';

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
  return finishSignIn(request, 'GOOGLE', identity, next);
}

/**
 * Every provider ends here: link or create the customer account (by the
 * provider's stable subject, never by email alone once linked), refuse
 * staff accounts, open the session, and claim the brief and consent this
 * browser holds — the same path whichever button they pressed.
 */
async function finishSignIn(
  request: Request,
  provider: 'GOOGLE' | 'APPLE' | 'FACEBOOK',
  identity: { subject: string; email: string | null; name: string | null },
  next: string | null,
): Promise<NextResponse> {
  const key = provider.toLowerCase();
  if (!identity.email) return failed(request, key);
  const email = identity.email;

  const [linked, byEmail] = await Promise.all([
    prisma.authIdentity.findUnique({
      where: { provider_subject: { provider, subject: identity.subject } },
      select: { user: { select: { id: true, role: true, deletedAt: true } } },
    }),
    prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, deletedAt: true },
    }),
  ]);
  const shape = (u: { id: string; role: string; deletedAt: Date | null } | null | undefined) =>
    u ? { id: u.id, role: u.role as Role, deleted: u.deletedAt !== null } : null;

  const decision = decideLink({ linkedUser: shape(linked?.user), emailUser: shape(byEmail) });

  let userId: string;
  switch (decision.kind) {
    case 'refuse-staff':
      return failed(request, `${key}-staff`);
    case 'refuse-deleted':
      return failed(request, key);
    case 'sign-in':
      userId = decision.userId;
      await prisma.authIdentity.update({
        where: { provider_subject: { provider, subject: identity.subject } },
        data: { lastUsedAt: new Date(), email },
      });
      break;
    case 'link':
      userId = decision.userId;
      await prisma.authIdentity.create({
        data: { provider, subject: identity.subject, userId, email },
      });
      break;
    case 'create': {
      const user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          name: identity.name,
          role: 'CUSTOMER',
          identities: {
            create: { provider, subject: identity.subject, email },
          },
        },
        select: { id: true },
      });
      userId = user.id;
      break;
    }
  }

  // A name from the provider fills an empty one; it never overwrites what they told us.
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

// ── Facebook ───────────────────────────────────────────────────

const cookieOptions = (sameSite: 'lax' | 'none') => ({
  httpOnly: true,
  sameSite,
  // SameSite=None requires Secure; browsers treat localhost as secure.
  secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
  path: '/auth/oauth',
  maxAge: COOKIE_SECONDS,
});

async function rememberStart(request: Request, sameSite: 'lax' | 'none'): Promise<string> {
  const state = newOAuthSecret();
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  const jar = await cookies();
  jar.set(STATE, state, cookieOptions(sameSite));
  if (next) jar.set(NEXT, next, cookieOptions(sameSite));
  else jar.delete(NEXT);
  return state;
}

async function takeStart(): Promise<{ expected: string; next: string | null }> {
  const jar = await cookies();
  const expected = jar.get(STATE)?.value ?? '';
  const next = safeNext(jar.get(NEXT)?.value ?? null);
  jar.delete(STATE);
  jar.delete(NEXT);
  return { expected, next };
}

const socialCallback = (request: Request, provider: 'facebook' | 'apple') =>
  new URL(`/auth/oauth/${provider}/callback`, request.url).toString();

export async function beginFacebook(request: Request): Promise<NextResponse> {
  const config = facebookOAuth();
  if (!config || !hasDatabase()) return failed(request, 'facebook-unavailable');
  const state = await rememberStart(request, 'lax');
  return NextResponse.redirect(
    facebookAuthUrl({ appId: config.appId, redirectUri: socialCallback(request, 'facebook'), state }),
  );
}

export async function completeFacebook(request: Request): Promise<NextResponse> {
  const config = facebookOAuth();
  if (!config || !hasDatabase()) return failed(request, 'facebook-unavailable');
  const params = new URL(request.url).searchParams;
  const { expected, next } = await takeStart();
  if (params.get('error')) return NextResponse.redirect(new URL(next ?? '/sign-in', request.url));
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  if (!expected || !code || !safeEqual(state, expected)) return failed(request, 'facebook');

  try {
    const tokenUrl = new URL(FACEBOOK_TOKEN_URL);
    tokenUrl.searchParams.set('client_id', config.appId);
    tokenUrl.searchParams.set('client_secret', config.appSecret);
    tokenUrl.searchParams.set('redirect_uri', socialCallback(request, 'facebook'));
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(10_000) });
    if (!tokenRes.ok) {
      console.error('[oauth] facebook token exchange failed', tokenRes.status);
      return failed(request, 'facebook');
    }
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: unknown };
    if (typeof accessToken !== 'string') return failed(request, 'facebook');

    const me = new URL(FACEBOOK_ME_URL);
    me.searchParams.set('fields', 'id,name,email');
    me.searchParams.set('access_token', accessToken);
    me.searchParams.set('appsecret_proof', appSecretProof(accessToken, config.appSecret));
    const meRes = await fetch(me, { signal: AbortSignal.timeout(10_000) });
    if (!meRes.ok) {
      console.error('[oauth] facebook profile failed', meRes.status);
      return failed(request, 'facebook');
    }
    const identity = readFacebookProfile(await meRes.json());
    if (!identity) return failed(request, 'facebook');
    // No email (a phone-only Facebook account): we could never reach them.
    if (!identity.email) return failed(request, 'facebook-no-email');
    return finishSignIn(request, 'FACEBOOK', identity, next);
  } catch (error) {
    console.error('[oauth] facebook error', error instanceof Error ? error.name : 'unknown');
    return failed(request, 'facebook');
  }
}

// ── Apple ──────────────────────────────────────────────────────

export async function beginApple(request: Request): Promise<NextResponse> {
  const config = appleOAuth();
  if (!config || !hasDatabase()) return failed(request, 'apple-unavailable');
  // Apple answers with a cross-site POST, which only carries SameSite=None cookies.
  const state = await rememberStart(request, 'none');
  return NextResponse.redirect(
    appleAuthUrl({ clientId: config.clientId, redirectUri: socialCallback(request, 'apple'), state }),
  );
}

/** Apple posts the answer back as a form (response_mode=form_post). */
export async function completeApple(request: Request): Promise<NextResponse> {
  const config = appleOAuth();
  if (!config || !hasDatabase()) return failed(request, 'apple-unavailable');
  const form = await request.formData().catch(() => null);
  const { expected, next } = await takeStart();
  // A POST can only redirect with 303, or the browser re-posts the form.
  const go = (url: URL) => NextResponse.redirect(url, 303);
  if (!form || form.get('error')) return go(new URL(next ?? '/sign-in', request.url));
  const state = String(form.get('state') ?? '');
  const code = String(form.get('code') ?? '');
  if (!expected || !code || !safeEqual(state, expected)) return go(failedUrl(request, 'apple'));

  try {
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: appleClientSecret({ ...config, nowSeconds: now }),
        code,
        grant_type: 'authorization_code',
        redirect_uri: socialCallback(request, 'apple'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[oauth] apple token exchange failed', res.status);
      return go(failedUrl(request, 'apple'));
    }
    const { id_token: idToken } = (await res.json()) as { id_token?: unknown };
    if (typeof idToken !== 'string') return go(failedUrl(request, 'apple'));
    const read = readAppleIdToken(idToken, config.clientId, now);
    if (!read.ok) {
      console.error('[oauth] apple id token refused:', read.reason);
      return go(failedUrl(request, 'apple'));
    }
    const identity = { ...read.identity, name: readAppleUser(form.get('user') as string | null) };
    const done = await finishSignIn(request, 'APPLE', identity, next);
    return go(new URL(done.headers.get('location') ?? '/account', request.url));
  } catch (error) {
    console.error('[oauth] apple error', error instanceof Error ? error.name : 'unknown');
    return go(failedUrl(request, 'apple'));
  }
}

function failedUrl(request: Request, reason: string): URL {
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('error', reason);
  return url;
}

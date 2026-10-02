import { NextResponse } from 'next/server';
import { cleanCode, REFERRAL_COOKIE, REFERRAL_DAYS } from '@/modules/portal/referral';

/**
 * A shared referral link — /r/SANYAM-7K2Q. Remembers the code for 30 days
 * and lands on the home page. A malformed code is ignored rather than
 * refused: the visitor came to see us, not to be told their link was wrong.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  const response = NextResponse.redirect(new URL('/', request.url));
  if (code) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REFERRAL_DAYS * 86_400,
    });
  }
  return response;
}

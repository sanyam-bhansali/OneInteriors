import { beginApple } from '@/modules/auth/oauth';

/** "Continue with Apple" lands here. See modules/auth/oauth.ts. */
export async function GET(request: Request) {
  return beginApple(request);
}

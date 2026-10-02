import { beginFacebook } from '@/modules/auth/oauth';

/** "Continue with Facebook" lands here. See modules/auth/oauth.ts. */
export async function GET(request: Request) {
  return beginFacebook(request);
}

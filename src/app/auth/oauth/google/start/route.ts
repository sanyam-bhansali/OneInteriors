import { beginGoogle } from '@/modules/auth/oauth';

/** "Continue with Google" links here. See modules/auth/oauth.ts. */
export async function GET(request: Request) {
  return beginGoogle(request);
}

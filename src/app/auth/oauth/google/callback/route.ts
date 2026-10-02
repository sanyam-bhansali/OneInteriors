import { completeGoogle } from '@/modules/auth/oauth';

/** Where Google sends them back. See modules/auth/oauth.ts. */
export async function GET(request: Request) {
  return completeGoogle(request);
}

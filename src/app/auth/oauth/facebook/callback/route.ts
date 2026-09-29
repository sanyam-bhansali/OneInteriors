import { completeFacebook } from '@/modules/auth/oauth';

/** Where Facebook sends them back. See modules/auth/oauth.ts. */
export async function GET(request: Request) {
  return completeFacebook(request);
}

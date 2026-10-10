import { signOut } from '@/modules/auth/session';
import { gate, json } from '@/modules/app-api/http';

/** POST /api/app/v1/auth/sign-out — revokes the bearer session. Always 200. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const g = gate();
  if (!g.ok) return g.response;
  await signOut().catch(() => {});
  return json({ ok: true });
}

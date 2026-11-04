import { loadBrief } from '@/modules/brief/repository';
import { homeProfile } from '@/modules/brief/home-profile';
import { gate, json, signedIn } from '@/modules/app-api/http';

/**
 * GET /api/app/v1/profile — My Home Profile (owner, 4 Nov 2026): every answer
 * in words, grouped, with the style DNA. The same shape the website's
 * /account/profile renders (modules/brief/home-profile.ts), so the phone and
 * the laptop say the same thing. `profile` is null before any answers.
 *
 * On the project app's switch, like sign-in itself: a studio's own client has
 * no Home Profile yet but may still look, and is shown "not started".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { brief, found } = await loadBrief();
  const profile = found ? homeProfile(brief, me.user.name) : null;
  return json({
    ok: true,
    profile: profile && profile.groups.length > 0 ? profile : null,
    contact: { name: me.user.name ?? null, phone: me.user.phone ?? null, email: me.user.email ?? null },
  });
}

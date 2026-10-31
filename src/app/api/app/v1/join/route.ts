import { codeFromPaste } from '@/modules/auth/customer-password-rules';
import { joinOwnProject, joinView } from '@/modules/project/own-project';
import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/join — { code } → { ok, studio }.
 *
 * "Connect your project" in the phone app (owner, 1 Nov 2026): the link or
 * code the designer sent. The project is already on the account for the
 * invited number, so this only checks the code is theirs and notes that they
 * joined; a code for another number says which number to sign in with.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const code = codeFromPaste(str(body?.code, 300));
  if (!code) return fail(400, 'That is not a project link or code. Paste the whole link your designer sent, or type its code.');
  const view = await joinView(code, me.user.id);
  if (!view) return fail(404, 'This link has been replaced. Ask your designer for the new one.');
  if (!view.matches) return fail(403, `This project is for ${view.phoneHint}. Sign out, and sign in with that number.`);
  await joinOwnProject(code, me.user.id);
  return json({ ok: true, studio: view.studio });
}

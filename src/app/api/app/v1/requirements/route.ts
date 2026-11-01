import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { customerRequirementForm, submitRequirementForm } from '@/modules/project/requirement-form';

/**
 * The requirement form in the phone app (owner, 1 Nov 2026;
 * project/requirement-form.ts).
 *
 * GET  /api/app/v1/requirements — the form the designer sent: its sections and
 *      questions, and the answers (filled in where we know them, or what was
 *      sent). `form: null` when none was sent.
 * POST /api/app/v1/requirements — { answers: { [questionId]: string } }: sends
 *      it in, once. A 400 names the question that needs an answer.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  return json({ ok: true, form: await customerRequirementForm(me.user.id) });
}

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const r = await submitRequirementForm(me.user.id, b.answers);
  if (r.ok) return json({ ok: true, message: r.message });
  return r.questionId ? json({ ok: false, error: r.error, questionId: r.questionId }, 400) : fail(400, r.error);
}

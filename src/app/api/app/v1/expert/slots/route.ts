import { gate, json, signedIn } from '@/modules/app-api/http';
import { availableSlots } from '@/modules/consultation/availability';
import { slotDays } from '@/modules/consultation/slots';
import { ARCHITECT } from '@/modules/consultation/architect';
import { expertFirstName } from '@/modules/app/geio-input';

/**
 * GET /api/app/v1/expert/slots — the expert's open half-hours, by IST day:
 * `{ ok, expert: { name, photo, line }, days: [{ date, slots: [{ startsAt, label }] }] }`.
 * The same calendar the website's expert screen books from (`availableSlots`).
 * No days means nobody has hours set this week.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  return json({
    ok: true,
    expert: {
      name: expertFirstName(),
      photo: null,
      line: `${ARCHITECT.role}. On our payroll, never a studio's, and paid the same whichever studio you pick.`,
    },
    days: slotDays(await availableSlots()),
  });
}

import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { myClients, BOARD_KINDS } from '@/modules/studio-practice/clients';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { Board, AddClientButton, AddFirstClientButton } from './Board';

export const metadata: Metadata = {
  title: 'Clients',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Everyone who might become work, and everyone who already is.
 *
 * ## One inbox
 *
 * Walk-ins, referrals, Instagram messages and the customers we introduce all
 * land in the same place. Two lists — ours over here, yours over there — is the
 * thing that makes a studio keep using WhatsApp, because WhatsApp at least has
 * everybody in it.
 *
 * ## Ordered by who is waiting
 *
 * The list sorts on the follow-up date, soonest first, nulls last. A studio
 * opens this to find out who is owed a call today, not to browse — and a client
 * with no date sits at the bottom, which is a quiet argument for setting one.
 */
export default async function ClientsPage() {
  const [clients, stages, fields] = await Promise.all([myClients(), myStages(), myFields()]);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const open = clients.filter((c) => BOARD_KINDS.includes(c.stageKind));
  const due = open.filter((c) => c.nextActionOn !== null && c.nextActionOn <= today).length;

  return (
    <>
      <PageHead
        title={due > 0 ? `${due} waiting on you` : 'Clients'}
        sub={
          clients.length === 0
            ? 'Nothing here yet.'
            : `${open.length} open · ${clients.length} in total`
        }
        action={<AddClientButton fields={fields} />}
      />

      <PageBody>
        {clients.length === 0 ? (
          <div className="s-card p-8">
            <p className="m-0 mb-2 text-[15.5px] font-semibold">
              Everyone who might become work lives here.
            </p>
            <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              Your walk-ins and referrals as much as the customers we introduce — one list, because
              two is what makes people go back to WhatsApp. Add the last person who called, and put
              a date on the next thing you owe them. That date is the only reason this screen is
              worth opening twice.
            </p>
            {/* A door in the body as well as the header. An empty page whose
                only way forward is one button in a corner has no way forward
                at all if that button is ever out of reach. */}
            <div className="mt-5">
              <AddFirstClientButton fields={fields} />
            </div>
          </div>
        ) : (
          <Board clients={clients} stages={stages} fields={fields} />
        )}
      </PageBody>
    </>
  );
}

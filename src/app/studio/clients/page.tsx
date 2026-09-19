import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, PageBody } from '../StudioShell';
import { GuidePanel } from '../GuidePanel';
import { guideContext } from '@/modules/studio/guide-store';
import { myClients, BOARD_KINDS } from '@/modules/studio-practice/clients';
import { myStages } from '@/modules/studio-practice/stages';
import { myFields } from '@/modules/studio-practice/fields';
import { assignableMembers, myMembershipId } from '@/modules/studio-practice/team';
import { Board, AddClientButton, AddFirstClientButton } from './Board';

export const metadata: Metadata = {
  title: 'Clients',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const importLink =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium no-underline hover:border-[var(--s-ink-3)]';

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
  const [clients, stages, fields, members, meId] = await Promise.all([
    myClients(),
    myStages(),
    myFields(),
    assignableMembers(),
    myMembershipId(),
  ]);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const open = clients.filter((c) => BOARD_KINDS.includes(c.stageKind));
  const due = open.filter((c) => c.nextActionOn !== null && c.nextActionOn <= today).length;

  const { state, facts } = await guideContext();
  const dismissed = state.dismissed.includes('leads');

  return (
    <>
      <PageHead
        title={due > 0 ? `${due} waiting on you` : 'Clients'}
        sub={
          clients.length === 0
            ? 'Nothing here yet.'
            : `${open.length} open · ${clients.length} in total`
        }
        action={
          <>
            <Link href="/studio/clients/import" className={importLink}>
              Import a list
            </Link>
            <AddClientButton fields={fields} />
          </>
        }
      />

      <PageBody>
        <GuidePanel guide="leads" facts={facts} dismissed={dismissed} />

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
            <p className="m-0 mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              If you already keep this in a spreadsheet, bring it across instead of typing it
              again — you get to check every column before anything is saved.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <AddFirstClientButton fields={fields} />
              <Link href="/studio/clients/import" className={importLink}>
                Import a list
              </Link>
            </div>
          </div>
        ) : (
          <Board
            clients={clients}
            stages={stages}
            fields={fields}
            members={members}
            meId={meId}
          />
        )}

        {/* Quiet, and at the bottom. A bin people can find when they need it
            and never notice otherwise. */}
        <p className="mt-8 mb-0 text-[13px] text-[var(--s-ink-3)]">
          <Link href="/studio/clients/bin" className="underline">
            Deleted clients
          </Link>
        </p>
      </PageBody>
    </>
  );
}

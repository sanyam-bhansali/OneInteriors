import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { myPaymentTemplate } from '@/modules/studio-sales/settings';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { StagesForm } from './StagesForm';

export const metadata: Metadata = { title: 'Payment stages', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Payment stages (Studio OS Phase 1; "Library → Payments" in the
 * plan, here until the Library exists). The studio's stages for its own
 * sales: each quotation's sales final starts from them, and the project's
 * payments are copied from the sales final at booking. Owner only.
 */
export default async function PaymentStagesPage() {
  const member = await currentMember();
  const template = member && can(member, 'payments.template') ? await myPaymentTemplate() : null;
  return (
    <PageBody>
      <div className="max-w-[52rem]">
        {!template ? (
          <p className="m-0 text-[14.5px] text-[var(--s-ink-2)]">Only the studio owner sets the payment stages.</p>
        ) : (
          <>
            <p className="m-0 mb-4 max-w-[64ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
              How your clients pay you, stage by stage. When a salesperson marks a quotation&apos;s sales final, these are filled in (they can change
              them for that one client), and the booking copies them onto the project.
              {template.isDefault ? ' These are Hauspire’s six until you save your own.' : ''}
            </p>
            <StagesForm initial={template.stages} />
          </>
        )}
      </div>
    </PageBody>
  );
}

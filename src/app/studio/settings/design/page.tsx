import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { myDesignTemplate } from '@/modules/studio-design/design-flow';
import { DesignStepsForm } from './DesignStepsForm';

export const metadata: Metadata = { title: 'Design steps', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Design steps (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md
 * §2). The studio's design process: every new project's design stage starts
 * from it; each project can then be changed on its own. Owner only.
 */
export default async function DesignStepsPage() {
  const template = await myDesignTemplate();
  return (
    <PageBody>
      <div className="max-w-[60rem]">
        {!template ? (
          <p className="m-0 text-[14.5px] text-[var(--s-ink-2)]">Only the studio owner sets the design steps.</p>
        ) : (
          <>
            <p className="m-0 mb-4 max-w-[68ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
              Your design process, from the booking to handing over to the site. Every new project starts with these steps; you can change them on
              any one project later. &ldquo;Days&rdquo; is how long after the step before it, for a 2 BHK: smaller and bigger homes are scaled to 14,
              27 or 29 days. A step with a payment opens only once that payment is recorded.
              {template.custom ? '' : ' These are Hauspire’s steps until you save your own.'}
            </p>
            <DesignStepsForm initial={template.steps} custom={template.custom} />
          </>
        )}
      </div>
    </PageBody>
  );
}

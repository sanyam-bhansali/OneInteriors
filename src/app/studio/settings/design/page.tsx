import Link from 'next/link';
import type { Metadata } from 'next';
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
    <>
      <div className="max-w-[60rem]">
        {!template ? (
          <p className="m-0 text-[14.5px] muted">Only the studio owner sets the design steps.</p>
        ) : (
          <>
            <p className="m-0 mb-4 max-w-[68ch] text-[14px] leading-relaxed muted">
              Your design process, from the booking to handing over to the site. Every new project starts with these steps; you can change them on
              any one project later. &ldquo;Days&rdquo; is how long after the step before it, and &ldquo;Effort&rdquo; the hours of work, for a 2 BHK:
              a 1 BHK is 20% less, a 3 BHK 20% more, a 4 BHK 40% more. A step with a payment, and every step after it, opens only once that payment is
              recorded. Pre-execution steps belong to the execution team; the designer supports.
              {template.custom ? '' : ' These are Hauspire’s steps until you save your own.'}
            </p>
            <p className="m-0 mb-4 text-[14px]">
              <Link href="/studio/settings/design/switch" className="btn sec sm">
                Move running projects to these steps
              </Link>
            </p>
            <DesignStepsForm initial={template.steps} custom={template.custom} />
          </>
        )}
      </div>
    </>
  );
}

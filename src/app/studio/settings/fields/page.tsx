import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { myFields } from '@/modules/studio-practice/fields';
import { FieldEditor } from './FieldEditor';

export const metadata: Metadata = {
  title: 'Fields',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The extra things a studio captures on every client.
 *
 * ## Why there are no defaults
 *
 * Carpet area, society, possession month, BHK, which tower, whose referral.
 * Every studio wants a slightly different handful and the right set depends on
 * how they sell: a studio working one tower at a time needs Society and will
 * group its whole list by it; a studio living on architect referrals needs the
 * architect's name and will never once type a society.
 *
 * Shipping our guess would be us deciding what a studio should ask its clients,
 * and the cost of a wrong guess is a form with three fields nobody fills in,
 * which teaches people to skip the form.
 *
 * ## Why the key is shown
 *
 * Because it explains the one behaviour that would otherwise be alarming:
 * renaming a label does not move the values. The key is derived from the label
 * once, at creation, and frozen. If it moved, every value already captured
 * would still be in the row and invisible on the screen.
 */
export default async function FieldsPage() {
  const fields = await myFields();

  return (
    <PageBody>
      <div className="s-card mb-5 border-l-[3px] !border-l-[var(--s-accent)] p-5">
        <p className="m-0 mb-2 text-[14.5px] font-semibold">
          Whatever you keep writing in the notes probably belongs here.
        </p>
        <p className="m-0 max-w-[70ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          A field added here appears on every client — on the add form, on the card, and in the
          update panel. Turn on <strong>Group by</strong> and it becomes a way to read the whole
          list: a studio working one tower at a time groups by society and sees nine buildings
          instead of two hundred names.
        </p>
      </div>

      <FieldEditor fields={fields} />
    </PageBody>
  );
}

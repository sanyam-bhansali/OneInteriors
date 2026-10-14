import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { tx } from '@/modules/i18n/site';
import { siteSnag } from '@/modules/project/snag-read';
import { SNAG_WORDS, type SnagWordKey } from '../words';
import { FixSnag } from './FixSnag';

export const metadata: Metadata = { title: 'Fix a snag', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · *Fix a snag* (studio workspace Phase 4, design
 * docs/studio-workspace/designs/studio/SiteSnag.dc.html). One obvious next
 * step at a time: take the after photo → say what you fixed → mark fixed.
 * Mark fixed stays disabled until the after photo is saved, and says why.
 */
export default async function FixSnagPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, lang] = await Promise.all([params, getLang()]);
  const snag = await siteSnag(id);
  if (!snag) notFound();
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const day = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  // Every phrase in this person's language, placeholders left for the screen to fill.
  const words = Object.fromEntries(Object.entries(SNAG_WORDS).map(([k, v]) => [k, tx(lang, v)])) as Record<SnagWordKey, string>;

  return (
    <FixSnag
      words={words}
      lang={lang}
      snag={{
        id: snag.id,
        projectId: snag.projectId,
        title: snag.title,
        room: snag.room,
        home: snag.home,
        customerFirst: snag.customerFirst,
        raisedBy: snag.raisedBy,
        raisedNote: snag.raisedNote,
        raisedOn: day(snag.raisedAt),
        state: snag.state,
        fixByLabel: snag.fixBy ? day(snag.fixBy) : null,
        overdue: snag.overdue,
        mine: snag.mine,
        assigneeName: snag.assigneeName,
        internalNote: snag.internalNote,
        notFixedReason: snag.notFixedReason,
        before: snag.before[0] ?? null,
        after: snag.after[0] ?? null,
        fixSentence: snag.fixSentence,
        canFix: snag.canFix,
      }}
    />
  );
}

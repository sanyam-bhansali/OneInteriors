import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLang } from '@/modules/i18n/server';
import { postContext } from '@/modules/project/site-log';
import { PostUpdate } from './PostUpdate';
import { errorWords, siteWords } from '../../words';

export const metadata: Metadata = { title: 'Today on site', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Site mode · Post today's update (studio workspace Phase 2, design
 * studio/SiteUpdate.dc.html): photos with a mic under each, who is on site,
 * what got done, the customer's preview, Post. Only for a member who may
 * post on this project (`update.post`); anyone else gets a 404.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, lang] = await Promise.all([params, getLang()]);
  const r = await postContext(id.slice(0, 64));
  const t = siteWords(lang);
  if (!r.ok) {
    if (r.error === 'not_yours' || r.error === 'gone') notFound();
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <p className="s-card m-0 p-5 text-[16px] text-[var(--s-ink-2)]">{errorWords(t, r.error)}</p>
        <Link href="/studio/site" className="text-[16px] text-[var(--s-accent)]">
          {t('post.back')}
        </Link>
      </div>
    );
  }
  return <PostUpdate context={r.context} lang={lang} />;
}

'use client';

/**
 * Home format C, "One thing at a time" (the owner's v1 screens; chosen 1 Nov
 * 2026): a studio client usually has one thing waiting, so it goes first, as
 * a card with one button. The thing is the project lifecycle's blocker
 * (portal/lifecycle-view.ts), said in the client's language by the same
 * words as the project screen (modules/app/lifecycle-words.ts). With nothing
 * waiting, the card says what the studio is doing. Below: shortcuts, and the
 * stages with where each one is.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Arrow, BellIcon, Frame, Tabs } from '@/components/app/ui';
import { useLang } from '@/components/app/i18n';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { lifecycleLines, lw } from '@/modules/app/lifecycle-words';
import type { BlockerKind } from '@/modules/portal/lifecycle-view';
import { STAGE_SHORT, dayLabel, shortDate } from '@/modules/app/project-view';

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Where the one thing is done. */
function hrefFor(kind: BlockerKind, p: MyProject): string {
  switch (kind) {
    case 'decide': {
      const d = p.decisions.find((x) => x.state === 'open' || x.state === 'due-soon');
      return d ? `/app/decision?id=${d.id}` : '/app/decision';
    }
    case 'confirm_snag':
    case 'sign_off':
      return '/app/snags';
    case 'sign_design_final':
    case 'sign_sales_final': {
      const s = p.signoffs?.find((x) => x.canSign);
      return s ? `/app/signoff/${s.id}` : '/app/project';
    }
    default:
      return '/app/project';
  }
}

/** "Good morning" by the clock in India. */
function greeting(): string {
  const h = new Date(Date.now() + 330 * 60_000).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function OneThingHome({ project }: { project: MyProject }) {
  const lang = useLang();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void fetch('/api/app/v1/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { user?: { name?: string | null } } | null) => live && setName(b?.user?.name?.trim().split(/\s+/)[0] ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const l = project.lifecycle;
  const lines = l ? lifecycleLines(l, lang, { studio: project.studio, money: (p) => formatINR(p), date: (d) => shortDate(d), today: today() }) : null;
  const latest = project.updates[0] ?? null;
  const photo = latest?.photos[0] ?? null;
  const blocker = l?.blocker ?? null;

  return (
    <Frame>
      <header className="oa-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span>
          <span className="oa-meta">{greeting()}</span>
          <h1 style={{ marginTop: 2 }}>{name ?? project.studio}</h1>
        </span>
        <Link href="/app/notifications" className="oa-bell" aria-label="Notifications">
          <BellIcon />
        </Link>
      </header>

      <main className="oa-body">
        <section className="oa-card-dark" style={{ padding: 0, overflow: 'hidden' }} data-testid="one-thing">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Your home, from the latest site update" style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover' }} />
          ) : null}
          <div style={{ padding: 20 }}>
            <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
              {blocker ? 'Your one thing today' : lw(lang, 'life.nothing')}
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: 27, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
              {blocker && lines?.blocker ? lines.blocker : lines ? lines.current : `${project.studio} is working on your home`}
            </h2>
            <p style={{ margin: '10px 0 16px', fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,.75)' }}>
              {blocker ? `${project.studio} waits for this before the next step${lines?.next ? `: ${lines.next}` : ''}.` : lines?.doing}
            </p>
            {blocker ? (
              <Link href={hrefFor(blocker.kind, project)} className="oa-cta" style={{ display: 'inline-flex', width: 'auto', paddingInline: 22 }}>
                Do it now <Arrow />
              </Link>
            ) : (
              <Link href="/app/project" className="oa-cta light" style={{ display: 'inline-flex', width: 'auto', paddingInline: 22 }}>
                See your project <Arrow />
              </Link>
            )}
          </div>
        </section>

        <nav className="oa-list" aria-label="Shortcuts">
          <Shortcut href="/app/site" title="On site" sub={latest ? `Last update ${dayLabel(latest.at)}` : 'Photos from every working day'} />
          <Shortcut href="/app/project" title="Your project" sub={project.progressPct !== null && project.progressPct !== undefined ? `${project.progressPct}% done` : 'Every step and payment'} />
          <Shortcut href="/app/locker" title="Documents" sub="Quotation, drawings, receipts" />
          <Shortcut href="/app/snags" title="Snags" sub="Photograph anything that is not right" />
        </nav>

        {project.stages.length ? (
          <>
            <div className="oa-section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <h2>Your home, stage by stage</h2>
              <Link href="/app/project" className="oa-meta">
                Project →
              </Link>
            </div>
            <ul className="oa-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {project.stages.map((s) => (
                <li key={s.key} className="oa-row">
                  <span className="oa-row-title">{STAGE_SHORT[s.key] ?? s.label}</span>
                  <span className="oa-row-sub">{s.state === 'done' ? 'Done' : s.state === 'now' ? 'In progress' : 'Next'}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
      <Tabs />
    </Frame>
  );
}

function Shortcut({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="oa-row" style={{ textDecoration: 'none' }}>
      <span>
        <span className="oa-row-title">{title}</span>
        <span className="oa-row-sub">{sub}</span>
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}

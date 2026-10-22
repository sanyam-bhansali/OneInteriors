'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ConnectionRow, IntakeResult, IntakeScreen } from '@/modules/studio-intake/connections';
import type { ConnectionKindName } from '@/modules/studio-intake/payloads';
import {
  addConnectionAction,
  removeConnectionAction,
  retryLeadAction,
  rotateKeyAction,
  setConnectionEnabledAction,
} from './intake-actions';
import { Said, useAct } from '../../SalesUi';
import type { RoutingPerson } from '@/modules/studio-sales/settings';
import type { LeadRouteModeName } from '@/modules/studio-sales/lead-routing';
import { saveConnectionRoutingAction } from './routing-actions';
import { useRouter } from 'next/navigation';

/**
 * Settings → Lead sources, "Leads that come in by themselves" (lead intake,
 * 21 Oct 2026; docs/studio-os/LEAD-INTAKE.md): the doors Meta, Google, the
 * studio's website and portals post leads through, each with its address,
 * its key (shown once), the last few leads and what went wrong.
 */

const KIND_LABELS: Record<ConnectionKindName, string> = {
  META_PAGE: 'Facebook and Instagram lead ads',
  GOOGLE_LEAD_FORM: 'Google Ads lead form',
  WEBSITE: 'Your website',
  PORTAL: 'A portal or tool (99acres, Housing.com, WhatsApp, Zapier)',
};

const KIND_SHORT: Record<ConnectionKindName, string> = {
  META_PAGE: 'Meta lead ads',
  GOOGLE_LEAD_FORM: 'Google lead form',
  WEBSITE: 'Website',
  PORTAL: 'Portal or tool',
};

const KIND_ORDER: ConnectionKindName[] = ['META_PAGE', 'GOOGLE_LEAD_FORM', 'WEBSITE', 'PORTAL'];

type Act = (fn: () => Promise<IntakeResult>, after?: (r: IntakeResult) => void) => void;

/** `useAct` from SalesUi, keeping the whole result (it may carry the key). */
function useIntakeAct(): { pending: boolean; result: IntakeResult | null; run: Act } {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<IntakeResult | null>(null);
  const run: Act = (fn, after) =>
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) router.refresh();
        after?.(r);
      } catch {
        setResult({ ok: false, error: 'That did not go through. Check your connection and try again.' });
      }
    });
  return { pending, result, run };
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* Blocked clipboard: the text is selectable beside the button. */
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function Copyable({ value, label }: { value: string; label: string }) {
  return (
    <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
      <input readOnly value={value} aria-label={label} className="fld" style={{ flex: '1 1 16rem', minWidth: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5 }} onFocus={(e) => e.currentTarget.select()} />
      <CopyButton text={value} />
    </div>
  );
}

export function IntakeConnections({ screen, people = [] }: { screen: IntakeScreen; people?: RoutingPerson[] }) {
  const [kind, setKind] = useState<ConnectionKindName>('META_PAGE');
  const [label, setLabel] = useState('');
  const [pageId, setPageId] = useState('');
  const [fresh, setFresh] = useState<{ secret: string; label: string } | null>(null);
  const { pending, result, run } = useIntakeAct();

  if (!screen.canManage) {
    return (
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="m-0 text-[16px] font-semibold">Leads that come in by themselves</h2>
        <p className="m-0 text-[13.5px] muted">The owner or a project manager connects your ads, website and portals here.</p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="m-0 text-[16px] font-semibold">Leads that come in by themselves</h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed muted">
          Connect your Facebook and Instagram lead ads, Google lead forms, your website and portals. Each lead lands with a callback due today, in the pool or with whoever &ldquo;New leads go to&rdquo; says (above; each source can have its own), and the owner and project managers are told. Someone already on your board who enquires again gets a line on their timeline, not a second card.
        </p>
      </div>

      <form
        className="flex flex-col gap-2 rounded-[9px] bg-[var(--s-surface-2)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const named = label;
          run(
            () => addConnectionAction(kind, label, pageId),
            (r) => {
              if (r.ok) {
                setLabel('');
                setPageId('');
                setFresh(r.secret ? { secret: r.secret, label: named } : null);
              }
            },
          );
        }}
      >
        <span className="text-[13.5px] font-medium">Connect a source</span>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Where the leads come from" value={kind} onChange={(e) => setKind(e.target.value as ConnectionKindName)} className="fld w-auto">
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'META_PAGE' ? 'Hauspire Facebook Page' : kind === 'PORTAL' ? '99acres' : kind === 'WEBSITE' ? 'Website' : 'Google kitchen campaign'}
            aria-label="A name for it"
            className="fld w-auto min-w-[12rem] flex-1"
          />
          {kind === 'META_PAGE' ? (
            <input value={pageId} onChange={(e) => setPageId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Facebook Page ID" aria-label="Facebook Page ID" className="fld w-auto min-w-[12rem]" />
          ) : null}
          <button type="submit" disabled={pending || label.trim().length < 2 || (kind === 'META_PAGE' && pageId.length < 5)} className="btn pri sm">
            {pending ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {kind === 'META_PAGE' ? <p className="m-0 text-[12.5px] muted">The Page ID is on your Facebook Page: About → Page transparency (a long number).</p> : null}
        <Said result={result} />
      </form>

      {fresh ? <FreshKey secret={fresh.secret} label={fresh.label} onDone={() => setFresh(null)} /> : null}

      {screen.connections.length === 0 ? (
        <p className="m-0 text-[13.5px] muted">Nothing connected yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {screen.connections.map((c) => (
            <ConnectionCard key={c.id} c={c} screen={screen} people={people} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The key, once. */
function FreshKey({ secret, label, onDone }: { secret: string; label: string; onDone: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[9px] border border-[var(--s-accent)] p-3">
      <span className="text-[13.5px] font-medium">The key for {label}</span>
      <p className="m-0 text-[12.5px] muted">Copy it now and keep it somewhere safe. It is shown only this once; if you lose it, make a new key.</p>
      <Copyable value={secret} label="The key" />
      <div>
        <button type="button" className="btn ghost sm" onClick={onDone}>
          I have copied it
        </button>
      </div>
    </div>
  );
}

const STATUS_WORDS: Record<string, string> = {
  LANDED: 'New lead',
  DUPLICATE: 'Already on your board: added to their timeline',
  FAILED: 'Did not land',
  RECEIVED: 'Being taken…',
};

function ConnectionCard({ c, screen, people }: { c: ConnectionRow; screen: IntakeScreen; people: RoutingPerson[] }) {
  const [sure, setSure] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const { pending, result, run } = useIntakeAct();
  return (
    <li className="flex flex-col gap-2 rounded-[9px] bg-[var(--s-surface-2)] px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
        <span className="font-medium">{c.label}</span>
        <span className="text-[12.5px] muted">{KIND_SHORT[c.kind]}</span>
        <span className={`text-[12.5px] ${c.enabled ? 'text-[var(--s-good)]' : 'muted'}`}>{c.enabled ? 'On' : 'Off'}</span>
        <span className="text-[12.5px] muted">
          {c.eventCount === 0 ? 'No leads yet' : `${c.eventCount} received, last ${c.lastEventLabel}`}
          {c.failed > 0 ? ` · ${c.failed} did not land` : ''}
        </span>
      </div>

      {c.kind === 'META_PAGE' ? (
        <p className="m-0 text-[12.5px] muted">Facebook Page {c.metaPageId}</p>
      ) : (
        <Copyable value={c.url} label={`Address for ${c.label}`} />
      )}

      {fresh ? <FreshKey secret={fresh} label={c.label} onDone={() => setFresh(null)} /> : null}

      {people.length > 0 ? <RouteOverride c={c} people={people} /> : null}

      <details>
        <summary className="cursor-pointer text-[13px]">How to set it up</summary>
        <div className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed">
          <SetupHelp c={c} screen={screen} />
        </div>
      </details>

      {c.events.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
          {c.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="muted">{e.atLabel}</span>
              <span className={e.status === 'FAILED' ? 'text-[var(--s-bad)]' : ''}>{e.isTest ? 'Test lead received (not put on your board)' : STATUS_WORDS[e.status]}</span>
              {e.clientId ? (
                <Link href={`/studio/clients/${e.clientId}`} className="underline">
                  Open the lead
                </Link>
              ) : null}
              {e.error ? <span className="muted">{e.error}</span> : null}
              {e.status === 'FAILED' && c.kind === 'META_PAGE' ? (
                <button type="button" disabled={pending} className="underline" onClick={() => run(() => retryLeadAction(e.id))}>
                  Try again
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-3 text-[12.5px]">
        <button type="button" disabled={pending} className="muted hover:text-[var(--s-ink)]" onClick={() => run(() => setConnectionEnabledAction(c.id, !c.enabled))}>
          {c.enabled ? 'Turn off' : 'Turn on'}
        </button>
        {c.kind !== 'META_PAGE' ? (
          <button type="button" disabled={pending} className="muted hover:text-[var(--s-ink)]" onClick={() => run(() => rotateKeyAction(c.id), (r) => setFresh(r.ok && r.secret ? r.secret : null))}>
            Make a new key
          </button>
        ) : null}
        {sure ? (
          <span className="flex gap-3">
            <button type="button" disabled={pending} onClick={() => run(() => removeConnectionAction(c.id))} className="bad-t">
              Yes, remove (its leads stay on your board)
            </button>
            <button type="button" onClick={() => setSure(false)} className="muted">
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="muted hover:text-[var(--s-bad)]">
            Remove
          </button>
        )}
      </div>
      <Said result={result} />
    </li>
  );
}

/**
 * "Its leads go to" for one door (owner, 22 Oct 2026): the studio's rule, the
 * pool, take turns (the studio's list), one person, or a team's pool. Saved as it is picked.
 */
function RouteOverride({ c, people }: { c: ConnectionRow; people: RoutingPerson[] }) {
  const current = (c.routeMode === 'PERSON' || c.routeMode === 'TEAM') && c.routeMemberId ? `${c.routeMode}:${c.routeMemberId}` : (c.routeMode ?? '');
  const [value, setValue] = useState(current);
  const { pending, result, run } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="muted">Its leads go to</span>
      <select
        aria-label={`Where leads from ${c.label} go`}
        value={value}
        disabled={pending}
        className="fld w-auto"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          const [mode, personId] = v.startsWith('PERSON:') ? ['PERSON', v.slice(7)] : v.startsWith('TEAM:') ? ['TEAM', v.slice(5)] : [v as LeadRouteModeName | '', ''];
          run(() => saveConnectionRoutingAction(c.id, mode, personId));
        }}
      >
        <option value="">Same as new leads (above)</option>
        <option value="POOL">The pool</option>
        <option value="TURNS">Take turns (the list above)</option>
        {people.map((p) => (
          <option key={p.id} value={`PERSON:${p.id}`} disabled={!p.canTake}>
            {p.name}
            {p.canTake ? '' : ' — cannot take leads now'}
          </option>
        ))}
        {/* Sales roles and teams (owner, 22 Oct 2026): this door's leads wait in a head's team pool. */}
        {people
          .filter((p) => p.canHead)
          .map((p) => (
            <option key={`team-${p.id}`} value={`TEAM:${p.id}`}>
              {p.name}’s team pool
            </option>
          ))}
      </select>
      <Said result={result} />
    </div>
  );
}

const FIELDS_LINE = 'name (or full_name), phone (or mobile, phone_number), email, city, locality (or area), society (or project), bhk, budget, message, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, and id (your own lead id, so a resend never makes a second lead). Any other field is kept in the lead’s notes.';

function SetupHelp({ c, screen }: { c: ConnectionRow; screen: IntakeScreen }) {
  if (c.kind === 'META_PAGE') {
    const ready = screen.metaReady;
    return (
      <>
        <p className="m-0">Leads from this Page&rsquo;s lead ads, on Facebook and on Instagram, land here by themselves. One Interiors switches it on once for your Page:</p>
        <ol className="m-0 flex flex-col gap-1 pl-5">
          <li>Make One Interiors&rsquo;s Meta app a partner on your Page (Meta Business Suite → Settings → Partners), or share the Page with us, so we can read its leads.</li>
          <li>
            We subscribe the app to the Page&rsquo;s <code>leadgen</code> field, with this callback address:
            <Copyable value={screen.metaCallbackUrl} label="Meta callback address" />
          </li>
          <li>We add the Page&rsquo;s access token on our side. You do not paste any token here.</li>
          <li>Test it with Meta&rsquo;s Lead Ads Testing Tool: the test lead should show below within a minute.</li>
        </ol>
        <p className="m-0 muted">
          On our side: {ready.appSecret ? 'app secret set' : 'app secret not set yet'} · {ready.verifyToken ? 'verify token set' : 'verify token not set yet'} · {ready.pageTokens ? 'page tokens set' : 'page tokens not set yet'}.
        </p>
      </>
    );
  }
  if (c.kind === 'GOOGLE_LEAD_FORM') {
    return (
      <>
        <ol className="m-0 flex flex-col gap-1 pl-5">
          <li>In Google Ads, open the campaign&rsquo;s lead form asset → Lead delivery → Webhook integration.</li>
          <li>Paste the address above as the Webhook URL, and the key you copied when you made this as the Key.</li>
          <li>Press &ldquo;Send test data&rdquo;. A test lead shows below (it is not put on your board).</li>
        </ol>
        <p className="m-0 muted">Lost the key? Make a new key and paste that one into Google Ads instead.</p>
      </>
    );
  }
  if (c.kind === 'WEBSITE') {
    const fetchSnippet = `fetch('${c.url}', {\n  method: 'POST',\n  headers: { 'content-type': 'application/json', 'x-oi-key': 'YOUR_KEY' },\n  body: JSON.stringify({ name, phone, email, locality, bhk, message }),\n});`;
    const formSnippet = `<form method="post" action="${c.url}?key=YOUR_KEY">\n  <input name="name" required>\n  <input name="phone" required>\n  <input name="email">\n  <input name="locality">\n  <textarea name="message"></textarea>\n  <button>Send</button>\n</form>`;
    return (
      <>
        <p className="m-0">Have your website send each enquiry here. From the page&rsquo;s script:</p>
        <pre className="m-0 overflow-x-auto rounded-[8px] bg-[var(--s-surface)] p-2 text-[12px]">{fetchSnippet}</pre>
        <p className="m-0">Or, with no script at all, a plain form (the visitor sees a short thank-you):</p>
        <pre className="m-0 overflow-x-auto rounded-[8px] bg-[var(--s-surface)] p-2 text-[12px]">{formSnippet}</pre>
        <p className="m-0 muted">Fields it understands: {FIELDS_LINE}</p>
      </>
    );
  }
  return (
    <>
      <p className="m-0">Works with anything that can send a lead to a web address (a webhook): portals, WhatsApp tools, Zapier, Pabbly, Make. Send a POST with JSON or a form, and the key in a header <code>x-oi-key</code> (or add <code>?key=</code> to the address).</p>
      <p className="m-0 muted">Fields it understands: {FIELDS_LINE}</p>
      <p className="m-0 muted">A <code>source</code> like &ldquo;99acres&rdquo; becomes one of your source names, so the dashboard can say which portal closes.</p>
    </>
  );
}

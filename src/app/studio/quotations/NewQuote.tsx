'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { CONFIGS, standardRunFor, type ConfigName } from '@/modules/studio-quote/configure';
import { createQuoteAction } from './actions';
import { searchAction } from '../search-actions';
import type { FoundClient } from '@/modules/studio-practice/clients';
import { IDLE } from '../form-state';
import { LineIcon } from '../ui/icons';

/**
 * Starting a quotation — which means building one.
 *
 * ## What this replaced, and why
 *
 * A "+ New quotation" button that opened a four-field popover and dropped the
 * studio on an empty page. That is a filing cabinet with a form on the front:
 * the software stored quotations and helped write none of them.
 *
 * The facts a build needs are the same facts anybody types when starting a
 * quotation — who it is for, how big the flat is, how long the kitchen is. So
 * they are asked once, here, and the press that creates the quotation also
 * builds it. A 3 BHK arrives as about forty priced lines from the studio's own
 * catalogue, ready to be corrected rather than typed.
 *
 * ## Blank is still one press away
 *
 * A single-room renovation has no standard build worth applying, and forcing
 * one would mean deleting thirty-eight lines to quote a wardrobe. It is the
 * quiet button rather than the loud one because it is the rarer job, not
 * because it is discouraged.
 *
 * ## It never hides itself
 *
 * The old button disappeared entirely when no product had a rate — so the one
 * screen that could have explained what to do next showed an empty page and
 * no way forward. Readiness is now stated, with a link, and the form still
 * works: an unpriced build produces lines at zero, which is visibly unfinished
 * rather than silently absent.
 */
export function StartQuote({
  priced,
  standard,
  total,
  compact,
  leadRequired = false,
}: {
  /** Products with a rate. */
  priced: number;
  /** Products ticked into the standard build. */
  standard: number;
  total: number;
  /** Folded away by default, for the page that already has quotations on it. */
  compact?: boolean;
  /** A salesperson: the quotation must be for a lead (theirs, or a new one). */
  leadRequired?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [state, action, pending] = useActionState(createQuoteAction, IDLE);
  const [config, setConfig] = useState<ConfigName>('3 BHK');
  const [build, setBuild] = useState(true);
  /* Who it is for (Studio OS Phase 1): an existing lead, found by name or
     phone, or a new person (added to the leads unless unticked). */
  const [lead, setLead] = useState<FoundClient | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [society, setSociety] = useState('');
  const [found, setFound] = useState<FoundClient[]>([]);
  const [addLead, setAddLead] = useState(true);

  async function look(text: string) {
    setName(text);
    setLead(null);
    if (text.trim().length < 2) {
      setFound([]);
      return;
    }
    const rows = await searchAction(text);
    setFound(rows.slice(0, 6));
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn pri">
        <LineIcon name="plus" size={17} />
        New quotation
      </button>
    );
  }

  return (
    <form action={action} className="card qform" style={{ flex: '1 1 100%' }}>
      {/* The hidden pair that turns "create" into "create and build". A
          checkbox would post nothing when unticked, which is exactly the
          value we need to send. */}
      <input type="hidden" name="build" value={build ? 'yes' : 'no'} />

      <div className="chead">
        <div>
          <h2>New quotation</h2>
          <p className="muted sm" style={{ margin: '4px 0 0', maxWidth: '64ch', lineHeight: 1.5 }}>
            Tell us the flat and we build it — a wardrobe in each bedroom, a vanity in each bathroom, the kitchen sized to its
            run, everything at your own rates. You correct it rather than type it.
          </p>
        </div>
      </div>

      <div className="qrow">
        <input type="hidden" name="clientId" value={lead?.id ?? ''} />
        <input type="hidden" name="addLead" value={!lead && (addLead || leadRequired) ? 'yes' : 'no'} />
        <div className="qfield" style={{ flex: '1 1 16rem', position: 'relative' }}>
          <label htmlFor="nq-name" className="lbl">
            Who is it for — a lead&apos;s name or phone, or someone new
          </label>
          <input
            id="nq-name"
            name="clientName"
            required
            autoFocus
            autoComplete="off"
            value={name}
            onChange={(e) => void look(e.target.value)}
            placeholder="Mrs Kothari"
            className="fld"
          />
          {lead ? (
            <p className="qok">
              For the lead {lead.name}
              {lead.phone ? ` · ${lead.phone}` : ''}.{' '}
              <button type="button" onClick={() => setLead(null)} className="linkbtn" style={{ textDecoration: 'underline' }}>
                Not them
              </button>
            </p>
          ) : found.length > 0 ? (
            <ul className="pick qfound">
              {found.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLead(f);
                      setName(f.name);
                      setPhone(f.phone ?? '');
                      setSociety(f.society ?? '');
                      setFound([]);
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                    <span className="muted sm">{[f.phone, f.society, f.stageName].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <label className="qfield" style={{ flex: '0 1 11rem' }}>
          <span className="lbl">Phone{leadRequired ? '' : ' — optional'}</span>
          <input name="clientPhone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="fld" />
        </label>

        <label className="qfield" style={{ flex: '1 1 12rem' }}>
          <span className="lbl">Society or address — optional</span>
          <input name="society" value={society} onChange={(e) => setSociety(e.target.value)} placeholder="Kalyani Nagar" className="fld" />
        </label>
        {!lead && !leadRequired ? (
          <label className="qcheck" style={{ flexBasis: '100%', minHeight: 0 }}>
            <input type="checkbox" checked={addLead} onChange={(e) => setAddLead(e.target.checked)} />
            Also add them to my leads (their quotations then show on the lead)
          </label>
        ) : null}
      </div>

      <div className="qrow">
        <label className="qfield" style={{ width: '8rem' }}>
          <span className="lbl">Configuration</span>
          <select name="config" value={config} onChange={(e) => setConfig(e.target.value as ConfigName)} className="fld">
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="qfield" style={{ width: '8.5rem' }}>
          <span className="lbl">Kitchen run mm</span>
          <input name="kitchenRunMm" inputMode="numeric" placeholder={String(standardRunFor(config))} className="fld num" />
        </label>

        <label className="qfield" style={{ width: '6rem' }}>
          <span className="lbl">Bathrooms</span>
          <input name="bathrooms" inputMode="numeric" defaultValue="2" className="fld num" />
        </label>

        <label className="qcheck">
          <input type="checkbox" name="study" value="yes" />
          Study or office
        </label>

        <label className="qcheck">
          <input type="checkbox" name="balcony" value="yes" defaultChecked />
          Dry balcony
        </label>

        <label className="qfield" style={{ width: '8.5rem' }}>
          <span className="lbl">Carpet sq ft — optional</span>
          <input name="carpetSqft" inputMode="numeric" placeholder="1150" className="fld num" />
        </label>
      </div>

      <p className="muted sm" style={{ margin: 0, lineHeight: 1.5 }}>
        Leave the kitchen run blank and a {config} is assumed at <span className="mono">{standardRunFor(config)}</span>mm — it is
        the one measurement that moves the total, so it is worth taking. Every size and rate is editable afterwards.
      </p>

      <div className="hstack" style={{ paddingTop: 14, borderTop: '1px solid var(--fill2)' }}>
        <button type="submit" disabled={pending} onClick={() => setBuild(true)} className="btn pri">
          {pending ? 'Building…' : `Build the ${config}`}
        </button>

        {/* Same form, same submit. The flag decides, so there is no second
            code path to keep in step with the first. */}
        <button type="submit" disabled={pending} onClick={() => setBuild(false)} className="btn sec">
          Start it blank
        </button>

        {compact ? (
          <button type="button" onClick={() => setOpen(false)} className="btn ghost">
            Cancel
          </button>
        ) : null}
      </div>

      <Readiness priced={priced} standard={standard} total={total} />

      {'ok' in state && !state.ok ? (
        <p role="alert" className="qerr">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * What the build will actually produce, said before it is pressed.
 *
 * Silence here is what made the old screen feel broken: a studio with nothing
 * ticked pressed Build, got an empty quotation, and had no way to know why.
 * Two numbers and a link answer it in advance.
 */
function Readiness({
  priced,
  standard,
  total,
}: {
  priced: number;
  standard: number;
  total: number;
}) {
  if (total === 0) return null;

  if (standard === 0) {
    return (
      <p className="qnote warn">
        <span>
          Nothing in your product list is marked <strong>standard</strong> yet, so a build has nothing to put on the page.{' '}
          <Link href="/studio/products" className="acc-t" style={{ fontWeight: 600 }}>
            Tick what you fit on nearly every job
          </Link>{' '}
          — about twenty-five ticks, once, and every quotation after this one builds itself.
        </span>
      </p>
    );
  }

  return (
    <p className="muted sm" style={{ margin: 0, lineHeight: 1.5 }}>
      <span className="mono">{standard}</span> of your {total} products are marked standard and <span className="mono">{priced}</span>{' '}
      are priced.{' '}
      {priced < total ? (
        <>
          Anything without a rate lands at zero and is flagged —{' '}
          <Link href="/studio/products" className="acc-t">
            price them
          </Link>
          .
        </>
      ) : null}
    </p>
  );
}

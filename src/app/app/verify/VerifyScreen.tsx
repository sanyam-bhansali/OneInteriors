'use client';

/**
 * Phone and consent (the owner's v1 screens). The number is asked for here,
 * once, when the quotes are ready. Contact and consent are written by the
 * same server action the website's brief uses, consent first.
 *
 * No WhatsApp code for now (owner, 8 Oct 2026): the number is saved on the
 * brief, unverified, and nobody is signed in by it — signing in still needs
 * a code on /sign-in. A build with no database (local, or SAMPLE_DATA_ONLY)
 * saves nothing, and says so.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { normalisePhone } from '@/modules/studio/phone';
import { submitContactAction } from '@/app/quiz/actions';
import type { AppData } from '../data';

const COUNT = ['No', 'One', 'Two', 'Three'];

export function VerifyScreen({ data }: { data: AppData }) {
  const { sample } = data;
  const router = useRouter();
  const { brief, matches } = useJourney(data);
  const n = matches.length;
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = normalisePhone(phone) !== null;
  const name = brief?.contactName?.trim() || 'there';

  const verify = async () => {
    if (!brief) return;
    setError(null);
    if (sample) {
      router.push('/app/quote');
      return;
    }
    setBusy(true);
    const contact = await submitContactAction(brief, { name, phone, email: '', agreed, whatsappUpdates: whatsapp });
    setBusy(false);
    if (!contact.ok) {
      return setError(Object.values(contact.errors)[0] ?? 'Check your details and try again.');
    }
    router.push('/app/quote');
  };

  const ready = valid && agreed;

  return (
    <Frame>
      <Head back="/app/matches" meta="Quotes ready" />
      <Body>
        <h1 className="oa-title">{n === 1 ? 'Your quote is' : `Your ${n || ''} quotes are`} ready. Where should we send them?</h1>
        <p className="oa-sub">Your expert uses this number to reach you about these quotes. Nothing goes to a studio without your say.</p>

        <label className="oa-label" htmlFor="oa-phone">
          Mobile number
        </label>
        <div className="flex items-end gap-3">
          <span className="oa-input mono" style={{ width: 'auto', color: 'var(--ink-2)' }} aria-hidden>
            +91
          </span>
          <input
            id="oa-phone"
            className="oa-input mono"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98220 41736"
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {sample ? <p className="oa-sample">Test build · nothing is saved</p> : null}

        <div className="oa-list mt-2">
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
            <span className="text-[15px] leading-[1.45]">
              Share my home details and answers with {n === 1 ? 'this studio' : `these ${COUNT[n]?.toLowerCase() ?? n} studios`} so they can quote. I agree to the{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--accent-ink)' }}>
                privacy policy
              </a>
              .
            </span>
          </label>
          <label className="oa-row" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
            <span className="text-[15px] leading-[1.45] text-[var(--ink-2)]">Send me tips and offers on WhatsApp too (optional)</span>
          </label>
        </div>

        {error ? (
          <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
            {error}
          </p>
        ) : null}
      </Body>
      <Foot>
        <Cta onClick={verify} disabled={!ready || busy}>
          See my quotes
        </Cta>
      </Foot>
    </Frame>
  );
}

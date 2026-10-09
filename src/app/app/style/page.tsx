'use client';

/**
 * Your style DNA (v79 design, 9 Oct 2026): right after the last question and
 * before the matches. Their picks as shares, the leading style's materials
 * and palette, one sentence that uses their household answers, and a share
 * for the family. The share carries no name, flat or number.
 */

import { useState } from 'react';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';
import { styleDna, whatsappShare } from '@/modules/brief/style-dna';
import { localityLabel, type Brief } from '@/modules/brief/types';
import { useLang, useT } from '@/components/app/i18n';

const HOMES: Record<string, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4+ BHK',
  VILLA: 'Villa',
};

/** One plain sentence from what they told us about who lives there. Nothing invented. */
function livedIn(brief: Brief): string | null {
  const h = brief.household;
  if (!h) return null;
  const parts: string[] = [];
  if (h.elderly > 0) parts.push(h.elderly === 1 ? 'a parent at home' : 'parents at home');
  if (h.children > 0) parts.push(h.children === 1 ? 'a child' : 'children');
  if (h.pets) parts.push('a pet');
  if (h.worksFromHome) parts.push('someone working from home');
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Planned to be easy to live in with ${list}.`;
}

export default function StyleDnaScreen() {
  const [brief] = useBrief();
  const [shared, setShared] = useState(false);
  const t = useT();
  const lang = useLang();
  if (!brief) return <Frame>{null}</Frame>;

  const dna = styleDna(brief.styleLikes);
  const name = brief.contactName?.trim();
  if (!dna) {
    return (
      <Frame>
        <Head back="/app/q/4" />
        <Body>
          <h1 className="oa-title">Pick a style or two first.</h1>
          <p className="oa-sub">Your style DNA is made from the rooms you liked.</p>
        </Body>
        <Foot>
          <Cta href="/app/q/4">Choose styles</Cta>
        </Foot>
      </Frame>
    );
  }

  const [lead, second] = dna.shares;
  const leaning =
    (second ? t('style.leans', { lead: lead!.label, second: second.label }) : t('style.leansOne', { lead: lead!.label })) +
    ' ' +
    t('style.think', { materials: dna.materials.map((m) => m.toLowerCase()).join(', ') });
  const where = [localityLabel(brief.locality), brief.propertyType ? HOMES[brief.propertyType] : null].filter(Boolean).join(' · ');

  const share = async () => {
    const text = dna.shareText;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setShared(true);
        return;
      }
    } catch {
      return; // they closed the sheet
    }
    window.open(whatsappShare(text), '_blank', 'noopener');
    setShared(true);
  };

  return (
    <Frame>
      <Head back="/app/q/7" meta={t('style.meta')} />
      <Body>
        <h1 className="oa-title">{t('style.h1', { name: name ? `, ${name}` : '' })}</h1>

        <section className="oa-dna" aria-label="Your style DNA">
          <div className="bar" aria-hidden>
            {dna.shares.map((s, i) => (
              <span key={s.tag} style={{ flex: s.pct, background: dna.palette[[2, 1, 4][i] ?? 0] }} />
            ))}
          </div>
          <ul className="shares">
            {dna.shares.map((s) => (
              <li key={s.tag}>
                <b>{s.pct}%</b> {s.label}
              </li>
            ))}
          </ul>
          <div className="swatches" aria-hidden>
            {dna.palette.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="oa-chips">
            {dna.materials.map((m) => (
              <span key={m} className="oa-chip small" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                {m}
              </span>
            ))}
          </div>
          <p className="words">
            {leaning} {lang === 'en' ? (livedIn(brief) ?? '') : ''}
          </p>
          {where ? <p className="where">{where}</p> : null}
        </section>

        <button type="button" className="oa-share-row" onClick={share}>
          <span>
            <b>{shared ? t('style.shared') : t('style.share')}</b>
            <small>{t('style.share.sub')}</small>
          </span>
          <span className="go" aria-hidden>
            ↗
          </span>
        </button>
      </Body>
      <Foot>
        <Cta href="/app/matches">{t('style.cta')}</Cta>
      </Foot>
    </Frame>
  );
}

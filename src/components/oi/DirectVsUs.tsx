'use client';

import { showcase, showcaseWorthPaise } from '@/modules/portal/benefits';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';
import { known } from '@/modules/i18n/site/expert';
import { formatINR } from '@/lib/money';
import type { OfferState } from '@/modules/consultation/offer';
import { ExpertPitch } from './ExpertPitch';

/**
 * "Ringing {studio} directly, or through One Interiors" — on the studio's own
 * profile, the page most likely to send a customer straight to the studio.
 *
 * Only what is true of every studio on the roster: the same studio does the
 * work either way; what changes is what comes with it.
 *
 * In the landing's manner (owner, 10 Oct 2026): the table on a soft tile, the
 * "through us" ticks as mint pills, the pitch as the landing's architect
 * tile. The studio page is not on the landing canvas, so this carries
 * `cb cb-part` itself — the landing's tokens, type and pills, nothing else.
 */
export function DirectVsUs({ studioName, offer }: { studioName: string; offer: OfferState }) {
  const t = useSiteT(OI_DICT);
  const lang = useLang();
  const rows = [
    { label: t('dvu.doesWork', { studio: studioName }), direct: true, us: true },
    ...showcase().map((b) => ({
      label: known(lang, `benefit.${b.id}.short`, b.short),
      direct: false,
      us: true,
      terms: known(lang, `benefit.${b.id}.terms`, b.terms),
    })),
  ];
  return (
    <div className="cb cb-part grid gap-4 lg:grid-cols-[1.3fr_1fr]" style={{ background: 'transparent', overflowX: 'visible' }}>
      <div className="min-w-0 rounded-[var(--r-l)] bg-[var(--soft)] p-[clamp(20px,3vw,36px)]">
        <table className="w-full border-collapse text-[15px]">
          <caption className="mb-5 text-left">
            <span className="eyebrow block" style={{ marginBottom: 10 }}>
              {t('dvu.caption')}
            </span>
            <span className="block text-[clamp(1.25rem,1rem+0.9vw,1.7rem)] font-medium leading-[1.15] tracking-[-0.025em] text-[var(--ink)]">
              {t('dvu.worth', { amount: formatINR(showcaseWorthPaise()) })}
            </span>
          </caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="pb-3 pr-3 font-normal" />
              <th scope="col" className="w-[6.5rem] pb-3 pr-3 text-[13px] font-medium text-[var(--ink-2)]">{t('dvu.direct')}</th>
              <th scope="col" className="w-[6.5rem] pb-3 text-[13px] font-medium text-[var(--ink)]">{t('dvu.through')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-[var(--line)]">
                <th scope="row" className="py-3 pr-3 text-left font-normal text-[var(--ink)]" title={'terms' in r ? r.terms : undefined}>
                  {r.label}
                </th>
                <td className="py-3 pr-3 text-[var(--ink-2)]">{r.direct ? t('dvu.yes') : '—'}</td>
                <td className="py-3">
                  {r.us ? (
                    <span className="inline-block rounded-full bg-[var(--mint)] px-3 py-1 text-[13px] font-medium text-[var(--ink)]">
                      {t('dvu.yes')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ExpertPitch offer={offer} lead={t('dvu.lead', { studio: studioName })} />
    </div>
  );
}

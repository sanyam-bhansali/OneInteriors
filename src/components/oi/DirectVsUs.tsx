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
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <table className="w-full border-collapse text-[14px]">
        <caption className="mb-3 text-left">
          <span className="oi-eyebrow block">{t('dvu.caption')}</span>
          <span className="mt-1 block text-[14px] text-[var(--ink2)]">
            {t('dvu.worth', { amount: formatINR(showcaseWorthPaise()) })}
          </span>
        </caption>
        <thead>
          <tr className="border-b border-[var(--ink)] text-left">
            <th scope="col" className="py-2 pr-3 font-normal text-[var(--ink2)]" />
            <th scope="col" className="w-[7rem] py-2 pr-3 text-[12.5px] font-semibold">{t('dvu.direct')}</th>
            <th scope="col" className="w-[7rem] py-2 text-[12.5px] font-semibold text-[var(--acc-ink)]">{t('dvu.through')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--line)]">
              <th scope="row" className="py-2.5 pr-3 text-left font-normal text-[var(--ink)]" title={'terms' in r ? r.terms : undefined}>
                {r.label}
              </th>
              <td className="py-2.5 pr-3 text-[var(--ink2)]">{r.direct ? t('dvu.yes') : '—'}</td>
              <td className="py-2.5 font-semibold text-[var(--acc-ink)]">{r.us ? t('dvu.yes') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ExpertPitch offer={offer} lead={t('dvu.lead', { studio: studioName })} />
    </div>
  );
}

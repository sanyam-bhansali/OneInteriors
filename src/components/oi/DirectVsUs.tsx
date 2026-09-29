import { showcase, showcaseWorthPaise } from '@/modules/portal/benefits';
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
  const rows = [
    { label: `${studioName} does the work`, direct: true, us: true },
    ...showcase().map((b) => ({ label: b.short, direct: false, us: true, terms: b.terms })),
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <table className="w-full border-collapse text-[14px]">
        <caption className="mb-3 text-left">
          <span className="oi-eyebrow block">Directly, or through us</span>
          <span className="mt-1 block text-[14px] text-[var(--ink2)]">
            Worth up to {formatINR(showcaseWorthPaise())} through us, and nothing directly.
          </span>
        </caption>
        <thead>
          <tr className="border-b border-[var(--ink)] text-left">
            <th scope="col" className="py-2 pr-3 font-normal text-[var(--ink2)]" />
            <th scope="col" className="w-[7rem] py-2 pr-3 text-[12.5px] font-semibold">Ringing them directly</th>
            <th scope="col" className="w-[7rem] py-2 text-[12.5px] font-semibold text-[var(--acc-ink)]">Through One Interiors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--line)]">
              <th scope="row" className="py-2.5 pr-3 text-left font-normal text-[var(--ink)]" title={'terms' in r ? r.terms : undefined}>
                {r.label}
              </th>
              <td className="py-2.5 pr-3 text-[var(--ink2)]">{r.direct ? 'Yes' : '—'}</td>
              <td className="py-2.5 font-semibold text-[var(--acc-ink)]">{r.us ? 'Yes' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ExpertPitch offer={offer} lead={`Before you ring ${studioName}`} />
    </div>
  );
}

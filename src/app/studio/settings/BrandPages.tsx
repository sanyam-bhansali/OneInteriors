'use client';

import { useActionState } from 'react';
import { uploadBrandPageAction, brandPageAction, type BrandAssetState } from './actions';
import { ACCEPTED_LOGO, MAX_BRAND_PAGE_MB } from '@/modules/storage/logo-limits';
import { BRAND_PAGES_MAX } from '@/modules/studio-quote/document';

const IDLE: BrandAssetState = { status: 'idle' };

/**
 * Settings → Quotation PDF → Brand pages (owner, 13 Oct 2026): up to three
 * full-page images the studio designed — its cover with the logo and its
 * promises, "Why choose us", its partners' logos — printed first in every
 * quotation PDF, as Hauspire's sample has them. Without any, the PDF draws a
 * cover from the studio's details. Each its own form, as the logo is.
 */
export function BrandPages({
  pages,
  hasBranding,
  uploadEnabled,
}: {
  /** Signed links, in print order; a page that could not be signed is absent. */
  pages: { url: string | null }[];
  hasBranding: boolean;
  uploadEnabled: boolean;
}) {
  const [state, upload, pending] = useActionState(uploadBrandPageAction, IDLE);
  const [opState, op, working] = useActionState(brandPageAction, IDLE);
  const full = pages.length >= BRAND_PAGES_MAX;

  return (
    <section className="card" aria-labelledby="brand-pages-h">
      <span className="eyebrow">Quotation PDF</span>
      <h2 id="brand-pages-h" className="m-0 mb-1 text-[16px] font-semibold">
        Brand pages
      </h2>
      <p className="m-0 mb-4 max-w-[64ch] text-[13.5px] leading-relaxed muted">
        Up to {BRAND_PAGES_MAX} full pages you designed — your cover, why clients choose you, the brands you work with — printed before the
        quotation, in this order. Make each one A4 portrait (about 1240 × 1754 pixels). {ACCEPTED_LOGO}, up to {MAX_BRAND_PAGE_MB} MB each.
        Without any, the PDF opens with a cover drawn from your logo, name, address, phone, email and website.
      </p>

      {!hasBranding ? (
        <p className="m-0 rounded-[10px] bg-[var(--s-surface-2)] px-4 py-3 text-[13.5px] leading-relaxed muted">Fill in your studio details above and save them first — the brand pages go with them.</p>
      ) : !uploadEnabled ? (
        <p className="m-0 rounded-[10px] bg-[var(--s-surface-2)] px-4 py-3 text-[13.5px] leading-relaxed muted">
          Uploading images is not switched on on this site (the file storage is not configured here), so quotation PDFs open with the cover
          drawn from your details.{pages.length > 0 ? ` ${pages.length} page${pages.length === 1 ? ' is' : 's are'} saved but cannot be shown here.` : ''}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {pages.length > 0 ? (
            <ol className="m-0 flex list-none flex-wrap gap-4 p-0">
              {pages.map((p, i) => (
                <li key={i} className="flex w-[150px] flex-col gap-2">
                  <div className="grid aspect-[210/297] w-full place-items-center overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--fill)]">
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={`Brand page ${i + 1}`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="sm muted">Page {i + 1}</span>
                    )}
                  </div>
                  <form action={op} className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <input type="hidden" name="index" value={i} />
                    <span className="sm muted">{i + 1}.</span>
                    <button type="submit" name="op" value="up" className="btn ghost sm" disabled={working || i === 0} aria-label={`Move page ${i + 1} earlier`}>
                      ↑
                    </button>
                    <button type="submit" name="op" value="down" className="btn ghost sm" disabled={working || i === pages.length - 1} aria-label={`Move page ${i + 1} later`}>
                      ↓
                    </button>
                    <button type="submit" name="op" value="remove" className="btn ghost sm" disabled={working}>
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 sm muted">No brand pages yet.</p>
          )}

          {!full ? (
            <form action={upload}>
              <input
                type="file"
                name="page"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="sr-only"
                id="brand-page-input"
                disabled={pending}
              />
              <label htmlFor="brand-page-input" className="btn sec sm" style={{ cursor: 'pointer' }}>
                {pending ? 'Uploading…' : pages.length > 0 ? 'Add another page' : 'Add a page'}
              </label>
            </form>
          ) : (
            <p className="m-0 sm muted">That is all {BRAND_PAGES_MAX}. Remove one to add another.</p>
          )}

          {state.status === 'error' || opState.status === 'error' ? (
            <p role="alert" className="m-0 sm warn-t">
              {state.error ?? opState.error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

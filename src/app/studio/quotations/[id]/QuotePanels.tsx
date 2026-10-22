'use client';

import Link from 'next/link';
import type { QuoteTotals } from '@/modules/studio-quote/pricing';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { PaymentStage } from '@/modules/studio-sales/payment-template';
import { docHead, type DocSpecRow, type DocStudio } from '@/modules/studio-quote/document';
import { QuotationDocument } from '../doc/QuotationDocument';
import '../doc/quote-doc.css';
import type { PricedLine } from './QuoteLines';

/** What the PDF needs that the builder does not edit, loaded on the server (`quoteDocContext`). */
export interface DocPreviewStatics {
  studio: DocStudio | null;
  brandPages: string[];
  schedule: PaymentStage[] | null;
  spec: DocSpecRow[];
  terms: string | null;
  validDays: number;
}

/**
 * The PDF preview tab: the quotation PDF itself (`doc/QuotationDocument`,
 * the one format the print page, "Save & Quotation PDF" and what is sent to
 * the client use), drawn from what is on screen, so it moves as the lines,
 * the client and the terms are edited.
 */
export function DocumentPreview({
  quote,
  lines,
  rooms,
  totals,
  branding,
  showMark,
  markText,
  logoUrl,
  doc,
}: {
  quote: QuoteRow;
  lines: PricedLine[];
  rooms: string[];
  totals: QuoteTotals;
  branding: {
    legalName: string;
    addressLine: string | null;
    city: string;
    pincode: string | null;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    accentHex: string;
  } | null;
  showMark: boolean;
  markText: string;
  logoUrl: string | null;
  /** The studio's brand pages, stages, specification and terms; absent on the first quote, which prints none of them. */
  doc?: DocPreviewStatics | null;
}) {
  if (!branding) {
    return (
      <div className="empty">
        <b>Your studio details are not filled in yet.</b>
        <span className="muted sm" style={{ maxWidth: '62ch', lineHeight: 1.5 }}>
          A quotation carries your registered name, your address and your GSTIN — a document without them is one a client cannot
          act on.{' '}
          <Link href="/studio/settings" className="acc-t" style={{ fontWeight: 600 }}>
            Add them in Settings
          </Link>{' '}
          and this preview fills in.
        </span>
      </div>
    );
  }

  const studio: DocStudio = doc?.studio ?? {
    name: branding.legalName,
    tradeName: null,
    addressLine: branding.addressLine,
    city: branding.city,
    pincode: branding.pincode,
    phone: branding.phone,
    email: branding.email,
    website: null,
    gstin: branding.gstin,
    logoUrl,
    accentHex: branding.accentHex,
  };

  return (
    <div className="qdoc-pdf" aria-label="What the client sees">
      <QuotationDocument
        embedded
        studio={studio}
        brandPages={doc?.brandPages ?? []}
        head={docHead(quote, branding.city || null)}
        lines={lines}
        roomOrder={rooms}
        totals={totals}
        feeBps={quote.feeBps}
        discountBps={quote.discountBps}
        gstBps={quote.gstBps}
        onSpotLabel={quote.onSpotLabel}
        schedule={doc?.schedule ?? null}
        spec={doc?.spec ?? []}
        terms={doc?.terms ?? null}
        welcomeNote={quote.welcomeNote}
        showMark={showMark}
        markText={markText}
        validDays={doc?.validDays}
      />
    </div>
  );
}

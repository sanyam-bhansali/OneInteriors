'use client';

import Link from 'next/link';

/**
 * Print, with a filename a client can recognise.
 *
 * Browsers use `document.title` as the default name in the save-to-PDF dialog,
 * so setting it before `window.print()` is the difference between
 * "Kothari — Akara Design Studio 2026-014.pdf" landing in somebody's downloads
 * and "localhost.pdf" doing so. Restored afterwards, on `afterprint` and on a
 * timer, because Safari does not always fire the event.
 *
 * The strip itself is `no-print`, so none of it reaches the paper.
 */
export function PrintButton({ filename }: { filename: string }) {
  function print() {
    const previous = document.title;
    document.title = filename
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };

    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 2000);
  }

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={print}
        className="btn pri"
      >
        Print or save as PDF
      </button>
      <Link
        href="."
        className="btn sec"
      >
        ← Back to the builder
      </Link>
      <span className="muted sm">
        In the print dialog choose &ldquo;Save as PDF&rdquo;. Nothing of ours appears on the page.
      </span>
    </div>
  );
}

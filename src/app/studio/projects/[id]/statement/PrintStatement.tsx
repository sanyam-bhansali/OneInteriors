'use client';

import Link from 'next/link';

/**
 * "Download PDF" for the statement: the browser's print to PDF, as the
 * quotation does (quotations/[id]/print/PrintButton.tsx), with a file name
 * the client recognises. The strip is `no-print`, so none of it reaches the
 * paper.
 */
export function PrintStatement({ filename, backHref }: { filename: string; backHref: string }) {
  const print = () => {
    const previous = document.title;
    document.title = filename.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 2000);
  };
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-3">
      <button type="button" onClick={print} className="btn pri">
        Download PDF
      </button>
      <Link href={backHref} className="btn sec">
        Back to the project
      </Link>
      <span className="muted sm">In the print dialog choose &ldquo;Save as PDF&rdquo;.</span>
    </div>
  );
}

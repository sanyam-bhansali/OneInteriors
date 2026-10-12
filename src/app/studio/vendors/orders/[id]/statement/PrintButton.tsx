'use client';

/** Print, or "Save as PDF" from the browser's print dialog. No PDF library: the page is the document. */
export function PrintButton() {
  return (
    <button type="button" className="s-btn" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}

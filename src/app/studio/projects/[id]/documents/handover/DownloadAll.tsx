'use client';

import { useState } from 'react';
import { makeZip } from '@/lib/zip';

/**
 * "Download all (.zip)": the finals fetched straight from storage by this
 * browser and zipped here, so nothing large passes through a server
 * function (DESIGN-PROCESS-PLAN.md §3.5).
 */
export function DownloadAll({ files, zipName }: { files: { url: string; fileName: string }[]; zipName: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = files.filter((f) => f.url);
  const go = async () => {
    setError(null);
    try {
      const entries = [];
      for (const [i, f] of ready.entries()) {
        setBusy(`Fetching ${i + 1} of ${ready.length}…`);
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`${f.fileName} did not download. Reload the page and try again.`);
        entries.push({ name: f.fileName, data: new Uint8Array(await res.arrayBuffer()) });
      }
      setBusy('Making the zip…');
      const zip = makeZip(entries);
      const blob = new Blob([zip as BlobPart], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn pri" disabled={busy !== null || ready.length === 0} onClick={() => void go()}>
        {busy ?? `Download all (.zip, ${ready.length} file${ready.length === 1 ? '' : 's'})`}
      </button>
      {error ? (
        <span role="alert" className="bad-t sm">
          {error}
        </span>
      ) : null}
    </span>
  );
}

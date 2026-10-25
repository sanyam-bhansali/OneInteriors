'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DOC_TYPES, MAX_UPLOAD_BYTES, OFFERED_TYPES, UPLOAD_ACCEPT, type DocType } from '@/modules/studio-design/documents';
import { uploadDocumentAction } from './design-actions';

/**
 * Upload a project document (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md §3): pick what it is (and the room,
 * if it is for one), choose the file, upload. Nobody names it or numbers it:
 * the same type and room again is its next version, and the download is
 * named TYPE_Studio_Client_date_time_vX.Y. The file goes straight to storage
 * (up to 50 MB), then is recorded.
 */
export function UploadDocument({ projectId, customerFirst, preset, onDone }: { projectId: string; customerFirst: string; preset?: { type: DocType; room: string | null } | null; onDone?: () => void }) {
  const [type, setType] = useState<DocType>(preset?.type ?? 'LAYOUT_2D');
  const [room, setRoom] = useState(preset?.room ?? '');
  const [share, setShare] = useState(DOC_TYPES[preset?.type ?? 'LAYOUT_2D'].approval);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const pick = (t: DocType) => {
    setType(t);
    // Drawings the client approves go to them; the factory's sheets and site photos stay with the team unless ticked.
    setShare(DOC_TYPES[t].approval);
  };

  const upload = async () => {
    if (!file) return setSaid({ ok: false, text: 'Choose the file.' });
    if (file.size > MAX_UPLOAD_BYTES) return setSaid({ ok: false, text: 'Files can be up to 50 MB. Split a larger set into parts.' });
    setSaid(null);
    try {
      setBusy('Getting a place for it…');
      const t = await fetch('/api/studio/docs/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name: file.name, bytes: file.size }) });
      const ticket = (await t.json()) as { ok: boolean; path?: string; url?: string | null; error?: string };
      if (!ticket.ok || !ticket.path) throw new Error(ticket.error || 'We could not get a place to store that file.');
      if (ticket.url) {
        setBusy(`Uploading ${Math.round(file.size / 1024 / 102.4) / 10} MB…`);
        const put = await fetch(ticket.url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
        if (!put.ok) throw new Error('The upload did not finish. Try again.');
      }
      setBusy('Saving…');
      const r = await uploadDocumentAction({ projectId, kind: type, room, share, path: ticket.path, name: file.name, bytes: file.size });
      if (!r.ok) throw new Error(r.error);
      setSaid({ ok: true, text: r.message });
      setFile(null);
      router.refresh();
      onDone?.();
    } catch (e) {
      setSaid({ ok: false, text: e instanceof Error ? e.message : 'That did not save.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-[14px] bg-[var(--soft)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void upload();
      }}
    >
      <p className="m-0 text-[13.5px] font-semibold">{preset ? `New version: ${DOC_TYPES[preset.type].label}${preset.room ? `, ${preset.room}` : ''}` : 'Upload a document'}</p>
      {!preset ? (
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-[13px]">
            What it is
            <select value={type} onChange={(e) => pick(e.target.value as DocType)} className="fld">
              {OFFERED_TYPES.map((k) => (
                <option key={k} value={k}>
                  {DOC_TYPES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Room (if it is for one)
            <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} className="fld" placeholder="Leave empty for the whole home" />
          </label>
        </div>
      ) : null}
      <input type="file" accept={UPLOAD_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px]" aria-label="The file" />
      <span className="text-[12px] text-[var(--muted)]">PDF, images, Excel, DWG, DXF, SKP or ZIP, up to 50 MB. Named and numbered for you.</span>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        {DOC_TYPES[type].approval ? `Share with ${customerFirst} for approval (one notice)` : `Share with ${customerFirst}`}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn pri sm" disabled={busy !== null}>
          {busy ?? 'Upload'}
        </button>
        {onDone ? (
          <button type="button" className="btn ghost sm" onClick={onDone}>
            Cancel
          </button>
        ) : null}
      </div>
      {said ? (
        <p role={said.ok ? 'status' : 'alert'} className={`m-0 text-[13px] ${said.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
          {said.text}
        </p>
      ) : null}
    </form>
  );
}

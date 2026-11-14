'use client';

import { useRef, useState } from 'react';
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
 *
 * Owner, 13 Nov 2026 (pre-execution uploads "glitched", and every file had
 * to be marked final one by one): the upload shows its progress and says
 * plainly what went wrong; the form clears after each file (the file box
 * too, so the same file can be picked again); and "Mark it final" is ticked
 * by default for files the client does not approve (material list, cut
 * list, site photo), so no second click. A drawing the client approves is
 * marked once they have, as before; the box can still be ticked.
 */
export function UploadDocument({ projectId, customerFirst, preset, onDone }: { projectId: string; customerFirst: string; preset?: { type: DocType; room: string | null } | null; onDone?: () => void }) {
  const first = preset?.type ?? 'LAYOUT_2D';
  const [type, setType] = useState<DocType>(first);
  const [room, setRoom] = useState(preset?.room ?? '');
  const [share, setShare] = useState<boolean>(DOC_TYPES[first].approval);
  const [final, setFinal] = useState<boolean>(!DOC_TYPES[first].approval);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const going = useRef(false);
  const router = useRouter();

  const pick = (t: DocType) => {
    setType(t);
    // Drawings the client approves go to them; the factory's sheets and site photos stay with the team unless ticked.
    setShare(DOC_TYPES[t].approval);
    setFinal(!DOC_TYPES[t].approval);
  };

  const clearFile = () => {
    setFile(null);
    if (input.current) input.current.value = '';
  };

  /** The PUT to storage with its progress (fetch has none). */
  const put = (url: string, f: File) =>
    new Promise<void>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
      x.setRequestHeader('x-upsert', 'false');
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`The upload did not finish (${x.status}). Try again.`)));
      x.onerror = () => reject(new Error('The upload stopped: check the connection and try again.'));
      x.onabort = () => reject(new Error('The upload was stopped. Try again.'));
      x.send(f);
    });

  const upload = async () => {
    if (going.current) return;
    if (!file) return setSaid({ ok: false, text: 'Choose the file first.' });
    if (file.size === 0) return setSaid({ ok: false, text: 'That file is empty. Pick it again.' });
    if (file.size > MAX_UPLOAD_BYTES) return setSaid({ ok: false, text: 'Files can be up to 50 MB. Split a larger set into parts.' });
    going.current = true;
    setSaid(null);
    setPct(null);
    try {
      setBusy('Getting a place for it…');
      const t = await fetch('/api/studio/docs/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name: file.name, bytes: file.size }) });
      const ticket = (await t.json().catch(() => ({ ok: false }))) as { ok: boolean; path?: string; url?: string | null; error?: string };
      if (!ticket.ok || !ticket.path) throw new Error(ticket.error || 'We could not get a place to store that file. Try again.');
      if (ticket.url) {
        setBusy(`Uploading ${Math.round(file.size / 1024 / 102.4) / 10} MB…`);
        setPct(0);
        await put(ticket.url, file);
        setPct(100);
      }
      setBusy('Saving…');
      const r = await uploadDocumentAction({ projectId, kind: type, room, share, final, path: ticket.path, name: file.name, bytes: file.size });
      if (!r.ok) throw new Error(r.error);
      setSaid({ ok: true, text: `${file.name}: ${r.message}` });
      clearFile();
      if (!preset) setRoom('');
      router.refresh();
      onDone?.();
    } catch (e) {
      setSaid({ ok: false, text: e instanceof Error ? e.message : 'That did not save. Try again.' });
    } finally {
      setBusy(null);
      setPct(null);
      going.current = false;
    }
  };

  const needsApproval = DOC_TYPES[type].approval;
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
            <select value={type} onChange={(e) => pick(e.target.value as DocType)} className="fld" disabled={busy !== null}>
              {OFFERED_TYPES.map((k) => (
                <option key={k} value={k}>
                  {DOC_TYPES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Room (if it is for one)
            <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} className="fld" placeholder="Leave empty for the whole home" disabled={busy !== null} />
          </label>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        onChange={(e) => {
          setSaid(null);
          setFile(e.target.files?.[0] ?? null);
        }}
        className="text-[13px]"
        aria-label="The file"
        disabled={busy !== null}
      />
      <span className="text-[12px] text-[var(--muted)]">PDF, images, Excel, DWG, DXF, SKP or ZIP, up to 50 MB. Named and numbered for you.</span>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} disabled={busy !== null} />
        {needsApproval ? `Share with ${customerFirst} for approval (one notice)` : `Share with ${customerFirst}`}
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={busy !== null} data-testid="upload-final" />
        {needsApproval ? `Mark it final now (${customerFirst} has not approved it yet)` : 'Mark it final'}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn pri sm" disabled={busy !== null || !file}>
          {busy ? (pct !== null && pct < 100 ? `Uploading… ${pct}%` : busy) : 'Upload'}
        </button>
        {onDone ? (
          <button type="button" className="btn ghost sm" onClick={onDone} disabled={busy !== null}>
            Cancel
          </button>
        ) : null}
      </div>
      {pct !== null ? (
        <div className="h-1.5 w-full max-w-[320px] overflow-hidden rounded-full bg-[var(--fill2)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
          <div className="h-full bg-[var(--acc,var(--ink))]" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {said ? (
        <p role={said.ok ? 'status' : 'alert'} className={`m-0 text-[13px] ${said.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
          {said.text}
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ITEM_ROOMS } from '@/modules/items/input';
import { coverItemPhotoAction, removeItemPhotoAction, saveItemAction, uploadItemPhotoAction } from '../actions';

interface Words {
  name: string;
  summary: string;
  whatItDoes: string;
  materials: string;
  finishes: string;
  typicalSize: string;
}

interface Initial extends Words {
  slug: string;
  room: string;
  aliases: string;
  published: boolean;
  hi: Words;
  mr: Words;
}

const field = 'w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';
const label = 'grid gap-1 text-[12px] text-[var(--color-ink-2)]';

function WordsFields({ value, onChange, lang }: { value: Words; onChange: (w: Words) => void; lang: 'en' | 'hi' | 'mr' }) {
  const set = (k: keyof Words) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  const opt = lang === 'en' ? '' : ' (empty: English shows)';
  return (
    <div className="grid gap-3">
      <label className={label}>
        Name{opt}
        <input className={field} value={value.name} onChange={set('name')} required={lang === 'en'} />
      </label>
      <label className={label}>
        What it is, one sentence{opt}
        <textarea className={field} rows={2} value={value.summary} onChange={set('summary')} />
      </label>
      <label className={label}>
        What it does, two or three sentences{opt}
        <textarea className={field} rows={4} value={value.whatItDoes} onChange={set('whatItDoes')} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Materials, one per line{opt}
          <textarea className={field} rows={4} value={value.materials} onChange={set('materials')} />
        </label>
        <label className={label}>
          Finish options, one per line{opt}
          <textarea className={field} rows={4} value={value.finishes} onChange={set('finishes')} />
        </label>
      </div>
      <label className={label}>
        Typical size{opt}
        <input className={field} value={value.typicalSize} onChange={set('typicalSize')} />
      </label>
    </div>
  );
}

export function ItemEditor({ id, photos, uploadOn, uploadHint, initial }: { id: string; photos: string[]; uploadOn: boolean; uploadHint: string; initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const en: Words = { name: v.name, summary: v.summary, whatItDoes: v.whatItDoes, materials: v.materials, finishes: v.finishes, typicalSize: v.typicalSize };

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveItemAction(id, { ...v, hi: v.hi, mr: v.mr });
      setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setPhotoMsg(null);
    const errors: string[] = [];
    // One per request: each has to fit under the 4 MB request limit.
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.append('photo', f);
      const r = await uploadItemPhotoAction(id, form);
      if (r.error) errors.push(r.error);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    setPhotoMsg(errors.length ? errors.join(' ') : 'Added.');
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <h2 className="m-0 text-[18px]">Photos</h2>
        <p className="m-0 mt-1 text-[13px] text-[var(--color-ink-2)]">{uploadHint} Real installed work or a clean product shot; no studio names, logos or watermarks.</p>
        {photos.length === 0 ? (
          <p className="m-0 mt-4 rounded-[12px] bg-[var(--color-atrisk)] px-4 py-3 text-[14px] text-white">
            No photo yet. Studios cannot send quotations with this item until one is added.
          </p>
        ) : (
          <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
            {photos.map((src, i) => (
              <li key={src} className="overflow-hidden rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="flex flex-wrap items-center gap-2 p-2 text-[12px]">
                  {i === 0 ? (
                    <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[var(--color-paper)]">Shown on hover</span>
                  ) : (
                    <button type="button" className="underline" disabled={pending} onClick={() => start(async () => { await coverItemPhotoAction(id, src); router.refresh(); })}>
                      Show this on hover
                    </button>
                  )}
                  <button
                    type="button"
                    className="ml-auto underline"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm('Remove this photo? It is deleted from storage.')) return;
                      start(async () => {
                        await removeItemPhotoAction(id, src);
                        router.refresh();
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={fileRef} id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={!uploadOn || uploading} onChange={(e) => upload(e.target.files)} />
          <label htmlFor="item-photo" className={`rounded-full px-4 py-2 text-[14px] ${uploadOn ? 'cursor-pointer bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper-3)] text-[var(--color-ink-3)]'}`}>
            {uploading ? 'Uploading…' : 'Add photos'}
          </label>
          {!uploadOn ? <span className="text-[12px] text-[var(--color-ink-3)]">Upload is off on this deployment.</span> : null}
          {photoMsg ? <span className="text-[13px] text-[var(--color-ink-2)]">{photoMsg}</span> : null}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          {(['en', 'hi', 'mr'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-[13px] ${lang === l ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border border-[var(--color-rule)]'}`}
            >
              {l === 'en' ? 'English' : l === 'hi' ? 'हिंदी' : 'मराठी'}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {lang === 'en' ? (
            <WordsFields lang="en" value={en} onChange={(w) => setV({ ...v, ...w })} />
          ) : (
            <WordsFields lang={lang} value={v[lang]} onChange={(w) => setV({ ...v, [lang]: w })} />
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Room
            <select className={field} value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })}>
              {ITEM_ROOMS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Address: /items/…
            <input className={field} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />
          </label>
        </div>
        <label className={`${label} mt-3`}>
          Other names studios use, one per line (matches their products to this item)
          <textarea className={field} rows={4} value={v.aliases} onChange={(e) => setV({ ...v, aliases: e.target.value })} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} />
          Public page on (shows on the site and in search engines)
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-[14px] text-[var(--color-paper)]">
            {pending ? 'Saving…' : 'Save'}
          </button>
          {v.published ? (
            <a href={`/items/${initial.slug}`} target="_blank" rel="noopener" className="text-[13px]">
              Open the public page
            </a>
          ) : null}
          {msg ? <span className={`text-[13px] ${msg.ok ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-atrisk)]'}`}>{msg.text}</span> : null}
        </div>
      </section>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { STYLE_LABELS, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { MATERIAL_TAGS } from '@/modules/discover/tags';
import { PHOTO_ROOMS } from '@/modules/discover/suggest';
import { savePhotoAction, saveProjectStylesAction, suggestPhotoAction } from './actions';

const ROOM_LABEL: Record<string, string> = {
  LIVING: 'Living',
  DINING: 'Dining',
  KITCHEN: 'Kitchen',
  MASTER_BEDROOM: 'Main bedroom',
  BEDROOM: 'Bedroom',
  KIDS: "Kids' room",
  POOJA: 'Mandir',
  FOYER: 'Foyer',
  BATH: 'Bathroom',
  OTHER: 'Other',
};

interface Photo {
  index: number;
  src: string;
  room: string;
  materials: string[];
  checked: boolean;
  checkedBy: string | null;
}

interface Project {
  id: string;
  title: string;
  locality: string | null;
  studio: string;
  styles: StyleTag[];
  photos: Photo[];
}

const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-[12px] ${
    on ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border-[var(--color-rule)] text-[var(--color-ink-2)]'
  }`;

export function PhotoProject({ project, canSuggest }: { project: Project; canSuggest: boolean }) {
  const [styles, setStyles] = useState<StyleTag[]>(project.styles);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const toggleStyle = (s: StyleTag) =>
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < 3 ? [...cur, s] : cur));

  return (
    <section className="rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            {project.studio}
          </p>
          <h2 className="m-0 mt-1 text-[18px]">
            {project.title}
            {project.locality ? <span className="text-[var(--color-ink-3)]"> · {project.locality}</span> : null}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {styles.map((s) => (
            <span key={s} className="rounded-full bg-[var(--color-paper)] px-2.5 py-1 text-[12px]">
              {STYLE_LABELS[s]}
            </span>
          ))}
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[12px] underline">
            {editing ? 'Close' : 'Fix styles'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-3">
          <p className="m-0 mb-2 text-[12px] text-[var(--color-ink-2)]">Up to three, strongest first. Applies to every photo in this project.</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_TAGS.map((s) => (
              <button key={s} type="button" aria-pressed={styles.includes(s)} onClick={() => toggleStyle(s)} className={chip(styles.includes(s))}>
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending || styles.length === 0}
            onClick={() =>
              start(async () => {
                const r = await saveProjectStylesAction(project.id, styles);
                if (r.ok) setEditing(false);
              })
            }
            className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-[13px] text-[var(--color-paper)] disabled:opacity-40"
          >
            Save styles
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.photos.map((p) => (
          <PhotoCard key={p.index} projectId={project.id} photo={p} canSuggest={canSuggest} />
        ))}
      </div>
    </section>
  );
}

function PhotoCard({ projectId, photo, canSuggest }: { projectId: string; photo: Photo; canSuggest: boolean }) {
  const [room, setRoom] = useState(photo.room);
  const [materials, setMaterials] = useState<string[]>(photo.materials);
  const [checked, setChecked] = useState(photo.checked);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (patch: { room?: string; materials?: string[]; checked?: boolean }) =>
    start(async () => {
      const r = await savePhotoAction(projectId, photo.index, patch);
      if (!r.ok) setNote('Could not save. Reload and try again.');
    });

  const suggest = () =>
    start(async () => {
      setNote('Asking Claude…');
      const s = await suggestPhotoAction(projectId, photo.index);
      if (!s) return setNote('No suggestion. Tag it by eye.');
      if (s.room) setRoom(s.room);
      setMaterials(s.materials);
      setNote(
        `Suggested: ${s.styles.map((x) => STYLE_LABELS[x]).join(', ') || 'no style'}${s.looksRendered ? ' · Looks like a render: do not check it.' : ''}. Review, then save.`,
      );
    });

  const toggleMaterial = (m: string) => setMaterials((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  return (
    <article className={`overflow-hidden rounded-[14px] border bg-[var(--color-paper)] ${checked ? 'border-[var(--color-petrol)]' : 'border-[var(--color-rule)]'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={`Photo ${photo.index + 1}`} loading="lazy" className="block aspect-[4/3] w-full object-cover" />
      <div className="grid gap-3 p-3.5">
        <label className="grid gap-1 text-[12px] text-[var(--color-ink-2)]">
          Room
          <select
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              save({ room: e.target.value });
            }}
            className="rounded-[8px] border border-[var(--color-rule)] bg-transparent px-2 py-1.5 text-[14px] text-[var(--color-ink)]"
          >
            <option value="">Not said</option>
            {PHOTO_ROOMS.map((r) => (
              <option key={r} value={r}>
                {ROOM_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="m-0 mb-1.5 text-[12px] text-[var(--color-ink-2)]">What you can see</p>
          <div className="flex flex-wrap gap-1.5">
            {MATERIAL_TAGS.map((m) => (
              <button key={m} type="button" aria-pressed={materials.includes(m)} onClick={() => toggleMaterial(m)} className={chip(materials.includes(m))}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {note ? <p className="m-0 text-[12px] text-[var(--color-ink-2)]" role="status">{note}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ materials })}
            className="rounded-full border border-[var(--color-rule)] px-3.5 py-1.5 text-[13px] disabled:opacity-40"
          >
            Save tags
          </button>
          {canSuggest ? (
            <button type="button" disabled={pending} onClick={suggest} className="rounded-full border border-[var(--color-rule)] px-3.5 py-1.5 text-[13px] disabled:opacity-40">
              Suggest with Claude
            </button>
          ) : null}
          <button
            type="button"
            aria-pressed={checked}
            disabled={pending || !room}
            title={room ? undefined : 'Pick the room first'}
            onClick={() => {
              const next = !checked;
              setChecked(next);
              save({ materials, room, checked: next });
            }}
            className={`ml-auto rounded-full px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-40 ${
              checked ? 'bg-[var(--color-petrol)] text-[var(--color-paper)]' : 'bg-[var(--color-ink)] text-[var(--color-paper)]'
            }`}
          >
            {checked ? '✓ Checked' : 'Mark checked'}
          </button>
        </div>
        {checked && photo.checkedBy ? <p className="m-0 text-[11px] text-[var(--color-ink-3)]">Checked by {photo.checkedBy}</p> : null}
      </div>
    </article>
  );
}

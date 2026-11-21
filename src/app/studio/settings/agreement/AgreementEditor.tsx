'use client';

import { useState, useTransition } from 'react';
import { saveAgreementTemplateAction } from './actions';

export function AgreementEditor({
  initial,
  signatory,
  signatoryRole,
  canEdit,
  placeholders,
  maxLength,
}: {
  initial: string;
  signatory: string;
  signatoryRole: string;
  canEdit: boolean;
  placeholders: { key: string; help: string }[];
  maxLength: number;
}) {
  const [text, setText] = useState(initial);
  const [who, setWho] = useState(signatory);
  const [role, setRole] = useState(signatoryRole);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, go] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="lbl">Signs for the studio</span>
            <input className="fld" value={who} onChange={(e) => setWho(e.target.value)} disabled={!canEdit || pending} placeholder="Full name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="lbl">Designation</span>
            <input className="fld" value={role} onChange={(e) => setRole(e.target.value)} disabled={!canEdit || pending} placeholder="Director" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="lbl">The agreement</span>
          <textarea
            className="fld mono"
            style={{ minHeight: '32rem', fontSize: 13, lineHeight: 1.5 }}
            value={text}
            maxLength={maxLength}
            onChange={(e) => setText(e.target.value)}
            disabled={!canEdit || pending}
            data-testid="agreement-template"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <button
              type="button"
              className="btn pri sm"
              disabled={pending}
              onClick={() =>
                go(async () => {
                  setMsg(await saveAgreementTemplateAction(text, who, role));
                })
              }
            >
              Save
            </button>
          ) : (
            <span className="muted sm">Only the owner changes it.</span>
          )}
          <span className="muted sm">
            {text.length.toLocaleString('en-IN')} / {maxLength.toLocaleString('en-IN')} characters
          </span>
        </div>
        {msg ? (
          <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
            {msg.message}
          </p>
        ) : null}
      </div>
      <aside className="card flex flex-col gap-2 self-start p-4 text-[13px]">
        <b>Filled in for each client</b>
        {placeholders.map((p) => (
          <div key={p.key}>
            <code className="mono">{`{{${p.key}}}`}</code>
            <div className="muted">{p.help}</div>
          </div>
        ))}
        <b className="mt-2">Layout</b>
        <div className="muted">
          <code>## Title</code>, <code>### Heading</code>, <code>* point</code> (two spaces before it for a sub-point), <code>**bold**</code>. A blank line is a gap.
        </div>
      </aside>
    </div>
  );
}

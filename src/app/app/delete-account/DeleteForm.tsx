'use client';

import { useState } from 'react';

/** Tick, then delete: the same call as the app's Me → Delete my account. */
export function DeleteForm() {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/app/v1/me', { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) setDone(true);
      else setError('That did not go through. Try again, or write to hello@oneinteriors.in.');
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p role="status" className="oa-note">
        Your account is deleted, and you are signed out everywhere.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <label className="oa-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} style={{ marginTop: 4 }} />
        I understand this deletes my account and cannot be undone.
      </label>
      {error ? (
        <p role="alert" className="oa-note oa-error">
          {error}
        </p>
      ) : null}
      <button type="button" className="oa-cta" disabled={!sure || busy} onClick={() => void erase()}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  );
}

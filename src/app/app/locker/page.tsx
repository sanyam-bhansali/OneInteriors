'use client';

/** Home locker (the owner's v1 screens): what the home is made of, and every paper about it, searchable. */

import { useState } from 'react';
import { Arrow, AskGeio, ExampleTag, Frame, SearchIcon, Tabs } from '@/components/app/ui';
import { DOCUMENTS, EXAMPLE, MATERIALS } from '@/modules/app/example-project';

export default function AppLocker() {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const hit = (s: string) => !term || s.toLowerCase().includes(term);
  const materials = MATERIALS.filter((m) => hit(`${m.part} ${m.name} ${m.note}`));
  const documents = DOCUMENTS.filter((d) => hit(`${d.name} ${d.meta}`));

  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-meta">{EXAMPLE.flat.split(',')[0]}, for as long as you live there</span>
        <h1>Home locker</h1>
      </header>
      <main className="oa-body">
        <label className="oa-search">
          <SearchIcon />
          <input placeholder="Search, for example hinge warranty" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {materials.length > 0 ? (
          <>
            <div className="oa-section-head">
              <h2>What your home is made of</h2>
            </div>
            <div className="oa-cmp-mini" style={{ rowGap: 18 }}>
              {materials.map((m) => (
                <div key={m.part}>
                  <span style={{ display: 'block', height: 72, borderRadius: 12, background: m.swatch }} aria-hidden />
                  <span className="oa-meta" style={{ display: 'block', marginTop: 10, fontSize: 10.5 }}>
                    {m.part}
                  </span>
                  <b style={{ display: 'block', marginTop: 2, fontSize: 15, fontWeight: 600 }}>{m.name}</b>
                  <span style={{ font: '400 12px var(--mono)', color: 'var(--ink-2)' }}>{m.note}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {documents.length > 0 ? (
          <>
            <div className="oa-section-head" style={{ marginTop: 8 }}>
              <h2>Documents</h2>
            </div>
            <div style={{ borderTop: '1px solid var(--line)' }}>
              {documents.map((d) => (
                <div key={d.name} className="oa-doc">
                  <div>
                    <b>{d.name}</b>
                    <span>{d.meta}</span>
                  </div>
                  <span style={{ color: 'var(--ink-2)' }}>
                    <Arrow />
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {materials.length === 0 && documents.length === 0 ? <p className="oa-note">Nothing matches &ldquo;{q}&rdquo;.</p> : null}
      </main>
      <AskGeio from="locker" />
      <Tabs />
    </Frame>
  );
}

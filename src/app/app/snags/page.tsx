'use client';

/** Snags (the owner's v1 screens): fixed by a date, or we chase it, and the last payment waits for the list to close. */

import { useState } from 'react';
import { AskGeio, CameraIcon, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { EXAMPLE, SNAGS, photo } from '@/modules/app/example-project';

export default function AppSnags() {
  const [tab, setTab] = useState<'open' | 'fixed'>('open');
  const [tried, setTried] = useState(false);
  const list = SNAGS[tab];
  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-meta">Fixed by a date, or we chase it</span>
        <h1>Snags</h1>
      </header>
      <main className="oa-body">
        <button type="button" className="oa-cta" onClick={() => setTried(true)}>
          <CameraIcon />
          Photograph a problem
        </button>
        {tried ? (
          <p className="oa-sample" role="status">
            Example · in your project this opens the camera
          </p>
        ) : null}
        <div className="oa-chips">
          <button type="button" className="oa-chip" aria-pressed={tab === 'open'} onClick={() => setTab('open')}>
            Open <small>{SNAGS.open.length}</small>
          </button>
          <button type="button" className="oa-chip" aria-pressed={tab === 'fixed'} onClick={() => setTab('fixed')}>
            Fixed <small>{SNAGS.fixed.length}</small>
          </button>
        </div>
        <div>
          {list.map((s) => (
            <div key={s.title} className="oa-snag">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(s.img)} alt="" />
              <div className="min-w-0">
                <b style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{s.title}</b>
                <p style={{ margin: '6px 0 0', font: '400 12.5px var(--mono)', color: 'var(--ink-2)' }}>{s.where}</p>
                <p
                  style={{
                    margin: '4px 0 0',
                    font: '400 12.5px var(--mono)',
                    color: tab === 'open' && s.status.startsWith('Fix by') ? 'var(--accent-ink)' : 'var(--ink-2)',
                  }}
                >
                  {s.status}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="oa-card-dark">
          <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
            Handover walk-through, {EXAMPLE.handover}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
            We walk the flat with you room by room and add everything here. The last payment is due only once these are
            closed.
          </p>
        </div>
      </main>
      <AskGeio from="snags" />
      <Tabs />
    </Frame>
  );
}

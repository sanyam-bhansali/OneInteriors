'use client';

/** On site (the owner's v1 screens): every working day, photographed, and a day nobody came, said plainly. */

import { AskGeio, ExampleTag, Frame, Tabs } from '@/components/app/ui';
import { EXAMPLE, WEEK, photo } from '@/modules/app/example-project';

export default function AppSite() {
  const worked = WEEK.filter((d) => d.state === 'worked' || d.state === 'today').length;
  const sofar = WEEK.filter((d) => d.state !== 'ahead').length;
  return (
    <Frame>
      <ExampleTag />
      <header className="oa-page-head">
        <span className="oa-meta">Every working day</span>
        <h1>On site</h1>
      </header>
      <main className="oa-body">
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="oa-section-head">
            <b style={{ fontSize: 16 }}>This week</b>
            <span style={{ font: '500 12px var(--mono)', color: 'var(--ink-2)' }}>
              {worked} of {sofar} days worked
            </span>
          </div>
          <div className="oa-week mt-3">
            {WEEK.map((d) => (
              <span
                key={d.day}
                className={d.state === 'missed' ? 'miss' : d.state === 'ahead' ? 'off' : ''}
                style={
                  d.state === 'missed' ? { color: 'var(--accent-ink)' } : d.state === 'today' ? { color: 'var(--ink)' } : undefined
                }
              >
                <i />
                {d.day.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="oa-section-head">
          <h2>Today, {EXAMPLE.today}</h2>
          <span style={{ font: '500 12px var(--mono)', color: 'var(--ink-2)' }}>5:12 pm</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="oa-photo-main" src={photo(32)} alt="The living room at the end of the day" />
        <div className="oa-photo-pair">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(29)} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(26)} alt="" />
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
          Wardrobe frames fitted in both bedrooms. Kitchen carcass levelled and fixed to the wall.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="oa-who">Ramesh, carpenter, 9:40 am</span>
          <span className="oa-who">1 helper</span>
        </div>

        <div className="oa-card-dark">
          <p className="oa-meta" style={{ color: '#f08a5d', margin: 0 }}>
            Tue 6 Oct, nobody on site
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.85)' }}>
            The studio says the carpenter was finishing another site. The day is added to the schedule, not to your bill.
          </p>
        </div>
      </main>
      <AskGeio from="site" />
      <Tabs />
    </Frame>
  );
}

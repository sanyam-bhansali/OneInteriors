'use client';

/**
 * Your home's story (v79 design): every site photo, oldest first, played
 * as a film in the app. The rendered video file for handover day needs
 * server-side encoding and comes later; this plays the same photos now.
 */

import { useEffect, useMemo, useState } from 'react';
import { Frame, Head, Tabs } from '@/components/app/ui';
import { useMyProject } from '@/components/app/useMyProject';
import { shortDate } from '@/modules/app/project-view';

const FRAME_MS = 900;

export default function AppStory() {
  const mine = useMyProject();
  const project = mine.state === 'real' ? mine.project : null;
  const frames = useMemo(
    () =>
      (project?.updates ?? [])
        .slice()
        .reverse()
        .flatMap((u) => u.photos.map((src) => ({ src, at: u.at, note: u.note }))),
    [project],
  );
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  const days = new Set((project?.updates ?? []).map((u) => u.at.slice(0, 10))).size;
  const f = frames[i];

  return (
    <Frame>
      <Head back="/app/site" />
      <main className="oa-body">
        <h1 className="oa-title">Your home&rsquo;s story</h1>
        {!project || frames.length === 0 ? (
          <p className="oa-sub">Every site photo is stitched into one film here. It starts with the first update from your studio.</p>
        ) : (
          <>
            <p className="oa-sub">Every site photo, in order. The full film is ready on handover day.</p>
            <button type="button" className="oa-story" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f!.src} alt={`Site, ${shortDate(f!.at)}`} />
              <span className="when">{shortDate(f!.at)}</span>
              <span className="bar">
                <i style={{ width: `${((i + 1) / frames.length) * 100}%` }} />
              </span>
            </button>
            <div className="oa-stats">
              <div>
                <span className="oa-meta">Days</span>
                <b>{days}</b>
              </div>
              <div>
                <span className="oa-meta">Photos</span>
                <b>{frames.length}</b>
              </div>
              <div>
                <span className="oa-meta">Since</span>
                <b>{shortDate(project.startOn)}</b>
              </div>
            </div>
          </>
        )}
      </main>
      <Tabs />
    </Frame>
  );
}

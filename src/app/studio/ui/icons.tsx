import type { AppIconName } from '@/modules/studio/apps';

/**
 * The app icons from the owner's UI handoff, with their small looping
 * animations (`.ai`; studio-ui.css stops them under reduced motion). The
 * "From One Interiors" app shows our logo instead of a drawing.
 */
export function AppIcon({ name, size = 26 }: { name: AppIconName; size?: number }) {
  if (name === 'inbox') {
    const w = Math.round(size * 1.77);
    return <span className="oim" style={{ width: w, height: Math.round(w / 1.91), color: '#FFFFFF' }} role="img" aria-label="One Interiors" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 22 ? 1.7 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ai">
      {DRAW[name]}
    </svg>
  );
}

const DRAW: Record<Exclude<AppIconName, 'inbox'>, React.ReactNode> = {
  home: (
    <g className="a-float">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </g>
  ),
  users: (
    <>
      <g className="a-bob1">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      </g>
      <g className="a-bob2">
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6a6 6 0 0 1 3.5 5.4" />
      </g>
      <circle className="a-ping" cx="20.5" cy="4" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path className="a-write" d="M9 12h6" />
      <path className="a-write w2" d="M9 15h6" />
      <path className="a-write w3" d="M9 18h4" />
    </>
  ),
  layers: (
    <>
      <path className="a-l1" d="M12 3 3 7.5l9 4.5 9-4.5z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path className="a-l3" d="M3 16.5 12 21l9-4.5" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle className="a-flash" cx="12" cy="13" r="3.5" />
    </>
  ),
  rupee: (
    <g className="a-coin">
      <path d="M7 5h10M7 9h10M13 9a4 4 0 0 1-4 4H7l7 7M9 5a4 4 0 0 1 4 4" />
    </g>
  ),
  truck: (
    <g className="a-drive">
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle className="a-wheel" cx="7" cy="18" r="2" />
      <circle className="a-wheel" cx="17" cy="18" r="2" />
    </g>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <g className="a-flip">
        <path d="M3 10h18M8 3v4M16 3v4" />
      </g>
      <circle className="a-ping" cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  box: (
    <g className="a-float">
      <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />
    </g>
  ),
  gear: (
    <g className="a-gear">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </g>
  ),
};

/** The plain line icons the header and pages use. */
export type LineIconName =
  | 'grid' | 'search' | 'bell' | 'home' | 'theme' | 'plus' | 'upload' | 'warn'
  | 'phone' | 'chat' | 'arrow' | 'back' | 'check' | 'eye' | 'lock' | 'close';

const LINES: Record<LineIconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20.5a2 2 0 0 0 4 0" />,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  warn: <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />,
  phone: <path d="M5 4h3.5l2 5-2.3 1.4a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
};

export function LineIcon({ name, size = 19, stroke = 1.8 }: { name: LineIconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {LINES[name]}
    </svg>
  );
}

/** The One Verified seal. */
export function SealIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.4-.6 2.9 1.2 2.7-2.2 2 .1 3-2.9.8-1.6 2.6-2.9-.9-2.7 1.2-2-2.2-3-.1-.6-2.9-2.4-1.8 1-2.8-1.2-2.7 2.2-2.1L5.1 4l2.9-.6L9.6 1z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

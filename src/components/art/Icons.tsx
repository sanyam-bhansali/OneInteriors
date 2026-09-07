/**
 * Line-art icons for the quiz option tiles.
 *
 * Deliberately thin, open, and hand-drawn in feel rather than a UI icon set:
 * these sit at 40px inside a soft circle and have to read as *friendly* at a
 * moment where the person is being asked to describe their home. A dense
 * interface glyph reads as a form field; this reads as a conversation.
 *
 * One stroke weight, one cap style, one corner radius across the whole set —
 * that consistency is what makes twelve separate drawings feel like one family.
 */

type IconProps = { className?: string };

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" {...S}>
      {children}
    </svg>
  );
}

// ── Home types ──

export function IconStudio({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="8" y="12" width="24" height="20" rx="1.5" />
      <path d="M8 18h24" />
      <path d="M14 32v-8h5v8" />
      <path d="M24 22h4" />
    </Frame>
  );
}

export function IconApartment2({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="7" y="11" width="26" height="21" rx="1.5" />
      <path d="M20 11v21" />
      <path d="M11 16h5M11 21h5M24 16h5M24 21h5" />
      <path d="M14 32v-6h4M26 32v-6h-4" />
    </Frame>
  );
}

export function IconApartment3({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="6" y="10" width="28" height="22" rx="1.5" />
      <path d="M15 10v22M25 10v10M25 20h9" />
      <path d="M9.5 15h3M18.5 15h3M28.5 25h3" />
      <path d="M18 32v-5h4v5" />
    </Frame>
  );
}

export function IconApartment4({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="5" y="9" width="30" height="24" rx="1.5" />
      <path d="M15 9v24M25 9v24M5 21h30" />
      <path d="M9 14h2M19 14h2M29 14h2M9 26h2M19 26h2M29 26h2" />
    </Frame>
  );
}

export function IconVilla({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M6 19l14-10 14 10" />
      <path d="M9.5 17v15h21V17" />
      <path d="M17 32v-8h6v8" />
      <path d="M13 21h3M24 21h3" />
    </Frame>
  );
}

// ── Scope ──

export function IconFullHome({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M7 18l13-9 13 9" />
      <path d="M10.5 16v16h19V16" />
      <path d="M20 24v8M10.5 24h19" />
      <circle cx="15" cy="20" r="1.6" />
      <circle cx="25" cy="20" r="1.6" />
    </Frame>
  );
}

export function IconKitchen({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="7" y="10" width="12" height="22" rx="1.5" />
      <path d="M7 20h12" />
      <path d="M12 15h2M12 25h2" />
      <rect x="23" y="10" width="10" height="8" rx="1.5" />
      <path d="M23 24h10v8h-10z" />
      <circle cx="26" cy="14" r="1" />
      <circle cx="30" cy="14" r="1" />
    </Frame>
  );
}

export function IconSingleRoom({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="7" y="13" width="26" height="17" rx="1.5" />
      <path d="M11 26v-6h8v6" />
      <path d="M11 22h8" />
      <path d="M25 30v-9M22 21h6l-1-4h-4z" />
    </Frame>
  );
}

export function IconRenovation({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M8 18l12-9 12 9" />
      <path d="M11 16.5V31h18V16.5" />
      <path d="M17 31v-7h6v7" />
      <path d="M27 8.5l4.5 4.5M29 6l5.5 5.5-2.5 2.5L26.5 8.5z" />
    </Frame>
  );
}

// ── Involvement ──

export function IconHandsOff({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="20" cy="15" r="5" />
      <path d="M10 32c0-5.5 4.5-9 10-9s10 3.5 10 9" />
      <path d="M27 10l1.6 3.4L32 15l-3.4 1.6L27 20l-1.6-3.4L22 15l3.4-1.6z" />
    </Frame>
  );
}

export function IconCollaborate({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="14" cy="15" r="4.5" />
      <circle cx="26" cy="15" r="4.5" />
      <path d="M6 31c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5" />
      <path d="M22.5 24.2c1-.5 2.2-.7 3.5-.7 4.5 0 8 3 8 7.5" />
    </Frame>
  );
}

export function IconHandsOn({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="9" y="8" width="22" height="26" rx="2" />
      <path d="M13.5 15h9M13.5 20h13M13.5 25h7" />
      <path d="M22 28.5l2.5 2.5 5.5-6" />
    </Frame>
  );
}

// ── Priority ──

export function IconBudget({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="6" y="12" width="28" height="17" rx="2" />
      <circle cx="20" cy="20.5" r="4.5" />
      <path d="M11 17v7M29 17v7" />
    </Frame>
  );
}

export function IconSpeed({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="20" cy="21" r="11" />
      <path d="M20 15v6l4 3" />
      <path d="M16 7h8" />
    </Frame>
  );
}

export function IconAmbition({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M20 7l3.4 7.2 7.6 1.1-5.5 5.6L26.8 29 20 25.3 13.2 29l1.3-8.1L9 15.3l7.6-1.1z" />
    </Frame>
  );
}

export function IconMaterial({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M20 7l12 6.5-12 6.5-12-6.5z" />
      <path d="M8 20.5L20 27l12-6.5" />
      <path d="M8 26.5L20 33l12-6.5" />
    </Frame>
  );
}

// ── Household ──

export function IconAdults({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="20" cy="14" r="5" />
      <path d="M10 32c0-5.5 4.5-9.5 10-9.5s10 4 10 9.5" />
    </Frame>
  );
}

export function IconChildren({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="20" cy="16" r="4" />
      <path d="M13 32c0-4 3-7 7-7s7 3 7 7" />
      <path d="M16.5 12.5C16.5 10 18 8.5 20 8.5s3.5 1.5 3.5 4" />
    </Frame>
  );
}

export function IconElderly({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="18" cy="13" r="4.5" />
      <path d="M11 32c0-5 3-8.5 7-8.5s7 3.5 7 8.5" />
      <path d="M28 18v14" />
    </Frame>
  );
}

export function IconPets({ className }: IconProps) {
  return (
    <Frame className={className}>
      <ellipse cx="20" cy="26" rx="5" ry="4" />
      <circle cx="12.5" cy="19" r="2.6" />
      <circle cx="27.5" cy="19" r="2.6" />
      <circle cx="16" cy="13" r="2.4" />
      <circle cx="24" cy="13" r="2.4" />
    </Frame>
  );
}

export function IconWork({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="8" y="12" width="24" height="15" rx="1.5" />
      <path d="M5 31h30" />
      <path d="M16 27v4M24 27v4" />
    </Frame>
  );
}

// ── Misc ──

export function IconCalendar({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="7" y="11" width="26" height="22" rx="2" />
      <path d="M7 18h26M14 8v6M26 8v6" />
      <path d="M13 24h3M19 24h3M25 24h3" />
    </Frame>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M20 6l12 4.5v9c0 7.5-5 12.5-12 14.5-7-2-12-7-12-14.5v-9z" />
      <path d="M15 20l3.5 3.5L26 16" />
    </Frame>
  );
}

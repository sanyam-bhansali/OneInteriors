import type { Metadata } from 'next';
import '@/components/app/app.css';

export const metadata: Metadata = {
  title: { default: 'One Interiors', template: '%s · One Interiors' },
};

/**
 * The One Interiors app — the owner's v1 screens (8 Oct 2026), at /app.
 * What the installed icon opens (src/app/manifest.ts). Gated with the rest of
 * the customer side by CUSTOMER_LIVE (lib/host.ts).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="oa">{children}</div>;
}

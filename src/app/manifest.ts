import type { MetadataRoute } from 'next';

/**
 * The web app manifest: One Interiors installs to a phone's home screen and
 * opens full-screen, like an app (docs/CUSTOMER-APP-PLAN.md, route B — the
 * installable web app, until the store app covers every screen).
 *
 * Opens on the app (/app): the owner's v1 screens, from the opening film to
 * the project.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'One Interiors',
    short_name: 'One Interiors',
    description: 'Verified interior studios in Pune, matched to your home and quoted line by line.',
    start_url: '/app?source=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['lifestyle', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

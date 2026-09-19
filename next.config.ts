import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  eslint: {
    // Lint runs in CI (.github/workflows/ci.yml), on every PR, and blocks merge.
    // Running it again inside `next build` only means a style rule — or a
    // resolution failure in eslint-config-next's ESLint patch — can break a
    // deploy of code that is already correct. Correctness is gated by
    // TypeScript below, which deliberately still runs during the build.
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Never turn this on. Type errors are correctness, not style, and a build
    // that skips them ships broken code.
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      // Stock photography, pre-launch only. Unsplash's licence permits
      // commercial use without attribution and their guidelines expect hot
      // linking to this CDN, which is also how the studios we are onboarding
      // serve their own site images.
      //
      // These MUST be replaced with photographs of real work before launch.
      // A page promising verified local studios, illustrated with somebody
      // else's living room, is a small lie that undermines a large claim.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Studio portfolio images, once the bucket is provisioned.
      { protocol: 'https', hostname: 'tkxuvtctaknmymtuvcuo.supabase.co' },
    ],
  },

  async headers() {
    /**
     * Content-Security-Policy.
     *
     * The largest single gap in the header set: without a CSP, any XSS gets
     * full script execution and can post the page's contents anywhere it
     * likes. That matters more here than on a brochure site, because this app
     * renders a lot of text other people typed — client names and notes on a
     * studio's board, society names, quotation line descriptions, the original
     * floor-plan filename.
     *
     * `'unsafe-inline'` on script-src is here and is a real weakening. Next's
     * App Router inlines hydration and flight data in <script> tags, and a
     * nonce requires generating one per request in middleware and threading it
     * through — worth doing, not worth blocking this on. What the policy still
     * buys with it in place: `connect-src` stops an injected script talking to
     * an attacker's server, `object-src 'none'` kills plugin vectors,
     * `base-uri 'self'` stops a <base> tag redirecting every relative URL, and
     * `form-action 'self'` stops a form being repointed at another origin.
     * Those four close most of what an XSS would be used FOR.
     *
     * Kept deliberately narrow: this app loads no third-party scripts, no
     * analytics, no tag manager, no external fonts. If that ever changes, this
     * header is where it has to be declared, which is the point.
     */
    const csp = [
      "default-src 'self'",
      // Next inlines hydration data; see above.
      "script-src 'self' 'unsafe-inline'",
      // Tailwind and the design tokens set styles inline.
      "style-src 'self' 'unsafe-inline'",
      // Supabase storage for floor plans and portfolio images; Unsplash for
      // the pre-launch photography that has to go before launch anyway.
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
      "font-src 'self' data:",
      // Server actions post to our own origin; storage is the one exception.
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          /* Two years, subdomains included. Vercel already redirects HTTP to
             HTTPS, so this closes the first-visit downgrade window that the
             redirect cannot. `preload` is deliberately absent — it is
             effectively irreversible and belongs to a decision about the
             domain, not a header file. */
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          /* Nothing in this app uses a camera, a microphone or location.
             They were allowed on `self` for no reason; a permission granted
             to a feature that does not exist is only useful to an attacker
             who finds an injection. */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

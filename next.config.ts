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

  // Studio portfolio images will come from our own object storage. Add the
  // bucket host here when S3 is provisioned.
  images: {
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

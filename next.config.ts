import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components + Partial Prefetching give every route a static "app
  // shell" that renders instantly and can be prefetched. On a slow or patchy
  // connection, the screen frame appears right away and only the live data
  // streams in, which matters for our "log in 10 seconds" goal.
  cacheComponents: true,
  partialPrefetching: true,

  // Health data must never be framed by another site or sniffed as a
  // different content type. These headers are cheap insurance from day one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

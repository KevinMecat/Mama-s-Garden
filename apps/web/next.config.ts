import type { NextConfig } from "next";

const apiInternalUrl =
  process.env.API_INTERNAL_URL ?? "http://api:8000";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 88],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*/`,
      },
      {
        source: "/media/:path*",
        destination: `${apiInternalUrl}/media/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

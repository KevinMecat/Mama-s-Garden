import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  productionBrowserSourceMaps: process.env.BUILD_AUDIT_MAPS === "1",
  images: { unoptimized: true },
  ...(process.env.NODE_ENV === "development" ? {
    async rewrites() {
      const origin = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
      return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
    },
  } : {}),
};
export default nextConfig;
